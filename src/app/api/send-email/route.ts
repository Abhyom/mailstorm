import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
	getUserWithLimits,
	checkUserLimit,
	updateEmailCount,
} from "../../../lib/prisma";
import { GmailService, isValidEmail, delay } from "../../../lib/gmailService";
import { prisma } from "../../../lib/prisma";

interface EmailRecipient {
	email: string;
	companyName: string;
}

interface SendEmailRequest {
	campaignName: string;
	subject: string;
	bodyTemplate: string;
	recipients: EmailRecipient[];
	attachments?: {
		filename: string;
		content: string; // base64 encoded
		mimeType: string;
	}[];
}

const PAY_PER_USE_RATE = 0.05; // $0.05 per email

export async function POST(request: NextRequest) {
	try {
		const session = await auth();

		if (!session?.user?.email || !session?.user?.id) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 }
			);
		}

		const body: SendEmailRequest = await request.json();
		const { campaignName, subject, bodyTemplate, recipients, attachments } =
			body;

		if (!campaignName || !subject || !bodyTemplate || !recipients?.length) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const invalidEmails = recipients.filter((r) => !isValidEmail(r.email));
		if (invalidEmails.length > 0) {
			return NextResponse.json(
				{
					error: `Invalid email addresses: ${invalidEmails
						.map((e) => e.email)
						.join(", ")}`,
				},
				{ status: 400 }
			);
		}

		const user = await getUserWithLimits(session.user.email);
		if (!user) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 }
			);
		}

		if (!user.accessToken || !user.refreshToken) {
			return NextResponse.json(
				{
					error: "Gmail access not configured. Please reconnect your Google account.",
				},
				{ status: 403 }
			);
		}

		const limitCheck = await checkUserLimit(user.id, recipients.length);
		if (!limitCheck.canSend) {
			return NextResponse.json(
				{
					error: "Sending limit exceeded",
					limits: limitCheck.limits,
					current: limitCheck.current,
					remaining: limitCheck.remaining,
				},
				{ status: 429 }
			);
		}

		const campaign = await prisma.campaign.create({
			data: {
				userId: user.id,
				name: campaignName,
				subject,
				bodyTemplate,
				totalRecipients: recipients.length,
				status: "SENDING",
			},
		});

		const gmailService = new GmailService(
			user.accessToken,
			user.refreshToken,
			user.id
		);

		const processedAttachments = attachments?.map((att) => ({
			filename: att.filename,
			content: att.content, // Keep as base64 string
			mimeType: att.mimeType,
		}));

		const campaignPromise = (async () => {
			const results = {
				sent: 0,
				failed: 0,
				errors: [] as string[],
			};

			const BATCH_SIZE = 5; // Reduced batch size for better reliability
			const DELAY_BETWEEN_EMAILS = 8000; // Increased delay between emails
			const DELAY_BETWEEN_BATCHES = 90000; // Increased delay between batches

			for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
				const batch = recipients.slice(i, i + BATCH_SIZE);
				console.log(
					`Processing batch ${
						Math.floor(i / BATCH_SIZE) + 1
					} of ${Math.ceil(recipients.length / BATCH_SIZE)}`
				);

				for (const recipient of batch) {
					const emailLog = await prisma.emailLog.create({
						data: {
							campaignId: campaign.id,
							userId: user.id,
							recipientEmail: recipient.email,
							recipientName: recipient.companyName,
							status: "PENDING",
						},
					});

					let attemptCount = 0;
					const maxAttempts = 2; // Allow one retry per email
					let emailSent = false;

					while (attemptCount < maxAttempts && !emailSent) {
						attemptCount++;

						try {
							console.log(
								`Sending to ${recipient.email} (attempt ${attemptCount})`
							);

							const personalizedBody = bodyTemplate.replace(
								/{companyName}/g,
								recipient.companyName || "there"
							);

							await prisma.emailLog.update({
								where: { id: emailLog.id },
								data: {
									status: "SENT",
									sentAt: new Date(),
								},
							});

							results.sent++;
							emailSent = true;
							console.log(
								`✓ Successfully sent to ${recipient.email}`
							);
						} catch (error) {
							console.error(
								`✗ Failed to send to ${recipient.email} (attempt ${attemptCount}):`,
								error instanceof Error ? error.message : error
							);

							// If this was the last attempt, mark as failed
							if (attemptCount >= maxAttempts) {
								await prisma.emailLog.update({
									where: { id: emailLog.id },
									data: {
										status: "FAILED",
										errorMessage:
											error instanceof Error
												? error.message
												: "Unknown error",
									},
								});

								results.failed++;
								results.errors.push(
									`${recipient.email}: ${
										error instanceof Error
											? error.message
											: "Unknown error"
									}`
								);
							} else {
								// Wait before retrying
								console.log(
									`Waiting 5 seconds before retry...`
								);
								await delay(5000);
							}
						}
					}

					// Update campaign progress in real-time
					await prisma.campaign.update({
						where: { id: campaign.id },
						data: {
							emailsSent: results.sent,
							emailsFailed: results.failed,
						},
					});

					// Delay between emails (but not after the last email in the batch)
					if (i + batch.indexOf(recipient) < recipients.length - 1) {
						console.log(
							`Waiting ${DELAY_BETWEEN_EMAILS}ms before next email...`
						);
						await delay(DELAY_BETWEEN_EMAILS);
					}
				}

				// Delay between batches (but not after the last batch)
				if (i + BATCH_SIZE < recipients.length) {
					console.log(
						`Batch complete. Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`
					);
					await delay(DELAY_BETWEEN_BATCHES);
				}
			}

			// Final campaign update
			await prisma.campaign.update({
				where: { id: campaign.id },
				data: {
					status: "COMPLETED",
					emailsSent: results.sent,
					emailsFailed: results.failed,
				},
			});

			await updateEmailCount(user.id, results.sent);

			// Handle billing for pay-per-use
			if (user.plan === "PAY_PER_USE" && results.sent > 0) {
				const totalCost = results.sent * PAY_PER_USE_RATE;
				await prisma.billing.create({
					data: {
						userId: user.id,
						amount: totalCost,
						emailCount: results.sent,
						description: `Charged for ${results.sent} emails in campaign "${campaignName}"`,
					},
				});
			}

			console.log(
				`Campaign "${campaignName}" completed: ${results.sent} sent, ${results.failed} failed`
			);
			return results;
		})();

		const results = await campaignPromise;

		return NextResponse.json({
			success: true,
			campaignId: campaign.id,
			totalRecipients: recipients.length,
			sent: results.sent,
			failed: results.failed,
			errors: results.errors,
		});
	} catch (error) {
		console.error("Send email API error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
