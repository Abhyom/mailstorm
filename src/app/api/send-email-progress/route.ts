// src/app/api/send-email-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
	const session = await auth();

	if (!session?.user?.email) {
		return new NextResponse("Authentication required", { status: 401 });
	}

	const headers = {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	};

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (data: any) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
				);
			};

			const campaignId = request.nextUrl.searchParams.get("campaignId");
			if (!campaignId) {
				sendEvent({ error: "Campaign ID required" });
				controller.close();
				return;
			}

			let lastSent = 0;
			let lastFailed = 0;
			const interval = setInterval(async () => {
				const campaign = await prisma.campaign.findUnique({
					where: { id: campaignId },
					include: { emailLogs: true },
				});

				if (!campaign) {
					sendEvent({ error: "Campaign not found" });
					clearInterval(interval);
					controller.close();
					return;
				}

				const sent = campaign.emailsSent;
				const failed = campaign.emailsFailed;
				const total = campaign.totalRecipients;

				if (sent !== lastSent || failed !== lastFailed) {
					sendEvent({
						status:
							campaign.status === "SENDING"
								? "sending"
								: campaign.status.toLowerCase(),
						sent,
						failed,
						total,
						currentEmail:
							campaign.emailLogs[campaign.emailLogs.length - 1]
								?.recipientEmail,
					});
					lastSent = sent;
					lastFailed = failed;
				}

				if (campaign.status !== "SENDING") {
					clearInterval(interval);
					controller.close();
				}
			}, 2000);
		},
	});

	return new NextResponse(stream, { headers });
}
