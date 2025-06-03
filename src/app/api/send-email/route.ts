// src/app/api/send-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
	getUserWithLimits,
	checkUserLimit,
	updateEmailCount,
} from "../../../../lib/prisma";
import {
	GmailService,
	isValidEmail,
	delay,
} from "../../../../lib/gmailService";
import { prisma } from "../../../../lib/prisma";

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
			content: Buffer.from(att.content, "base64"),
			mimeType: att.mimeType,
		}));

		const campaignPromise = (async () => {
			const results = {
				sent: 0,
				failed: 0,
				errors: [] as string[],
			};

			const BATCH_SIZE = 10;
			const DELAY_BETWEEN_EMAILS = 6000;
			const DELAY_BETWEEN_BATCHES = 60000;

			for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
				const batch = recipients.slice(i, i + BATCH_SIZE);

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

					try {
						const personalizedBody = bodyTemplate.replace(
							/{companyName}/g,
							recipient.companyName || "there"
						);

						const result = await gmailService.sendEmail({
							to: recipient.email,
							subject,
							htmlBody: personalizedBody,
							fromEmail: user.email,
							fromName: user.name || "MailStorm User",
							attachments: processedAttachments,
							userId: user.id, // Pass userId for token refresh
							emailLogId: emailLog.id,
							plan: user.plan,
						});

						await prisma.emailLog.update({
							where: { id: emailLog.id },
							data: {
								status: "SENT",
								sentAt: new Date(),
							},
						});

						results.sent++;

						if (
							i + batch.indexOf(recipient) <
							recipients.length - 1
						) {
							await delay(DELAY_BETWEEN_EMAILS);
						}
					} catch (error) {
						console.error(
							`Failed to send to ${recipient.email}:`,
							error
						);

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
					}
				}

				if (i + BATCH_SIZE < recipients.length) {
					await delay(DELAY_BETWEEN_BATCHES);
				}
			}

			await prisma.campaign.update({
				where: { id: campaign.id },
				data: {
					status: results.failed > 0 ? "COMPLETED" : "COMPLETED",
					emailsSent: results.sent,
					emailsFailed: results.failed,
				},
			});

			await updateEmailCount(user.id, results.sent);

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

			return results;
		})();

		const results = await campaignPromise; // Wait for the promise to resolve

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
