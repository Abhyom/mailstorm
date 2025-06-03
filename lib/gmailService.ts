import { google } from "googleapis";
import { prisma } from "./prisma";

export class GmailService {
	private oauth2Client: any;
	private userId: string; // Add userId property

	constructor(accessToken: string, refreshToken: string, userId: string) {
		this.oauth2Client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET
		);

		this.oauth2Client.setCredentials({
			access_token: accessToken,
			refresh_token: refreshToken,
		});

		this.userId = userId; // Store userId
	}

	async refreshAccessToken() {
		// Remove userId parameter since it's now a class property
		try {
			const { credentials } =
				await this.oauth2Client.refreshAccessToken();

			await prisma.user.update({
				where: { id: this.userId },
				data: { accessToken: credentials.access_token },
			});

			this.oauth2Client.setCredentials({
				access_token: credentials.access_token,
			});

			return credentials.access_token;
		} catch (error) {
			console.error("Error refreshing access token:", error);
			throw new Error("Failed to refresh access token");
		}
	}

	private createEmailMessage(
		to: string,
		subject: string,
		htmlBody: string,
		fromEmail: string,
		fromName: string,
		attachments?: { filename: string; content: Buffer; mimeType: string }[]
	) {
		const boundary = "---boundary---";
		let message = [
			`From: "${fromName}" <${fromEmail}>`,
			`To: ${to}`,
			`Subject: ${subject}`,
			"MIME-Version: 1.0",
			`Content-Type: multipart/mixed; boundary="${boundary}"`,
			"",
			`--${boundary}`,
			"Content-Type: text/html; charset=utf-8",
			"",
			htmlBody,
		].join("\n");

		if (attachments && attachments.length > 0) {
			for (const attachment of attachments) {
				message += [
					"",
					`--${boundary}`,
					`Content-Type: ${attachment.mimeType}`,
					`Content-Disposition: attachment; filename="${attachment.filename}"`,
					"Content-Transfer-Encoding: base64",
					"",
					attachment.content.toString("base64"),
				].join("\n");
			}
		}

		message += `\n--${boundary}--`;

		return Buffer.from(message)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	}

	async sendEmail(params: {
		to: string;
		subject: string;
		htmlBody: string;
		fromEmail: string;
		fromName: string;
		attachments?: { filename: string; content: Buffer; mimeType: string }[];
		userId: string;
		emailLogId: string;
		plan: string;
	}): Promise<{ success: boolean; messageId: string | undefined }> {
		try {
			const gmail = google.gmail({
				version: "v1",
				auth: this.oauth2Client,
			});

			let finalBody = GmailService.addWatermark(
				params.htmlBody,
				params.plan
			);
			finalBody = GmailService.addTrackingPixel(
				finalBody,
				params.emailLogId,
				params.plan
			);

			const rawMessage = this.createEmailMessage(
				params.to,
				params.subject,
				finalBody,
				params.fromEmail,
				params.fromName,
				params.attachments
			);

			const response = await gmail.users.messages.send({
				userId: "me",
				requestBody: {
					raw: rawMessage,
				},
			});

			return {
				success: true,
				messageId: response.data.id ?? undefined,
			};
		} catch (error: any) {
			console.error("Gmail send error:", error);

			if (error.code === 401) {
				try {
					await this.refreshAccessToken();
					return this.sendEmail(params);
				} catch (refreshError) {
					throw new Error(
						"Authentication failed. Please reconnect your Gmail account."
					);
				}
			}

			throw new Error(error.message || "Failed to send email");
		}
	}

	static addWatermark(htmlBody: string, plan: string) {
		if (plan === "FREE") {
			const watermark = `
        <div style="background: linear-gradient(to right, #FFDAB9, #ADD8E6); padding: 20px; margin-top: 30px; text-align: center; border-radius: 8px;">
          <img src="${process.env.NEXT_PUBLIC_BASE_URL}/logo.png" alt="MailStorm Logo" style="display: block; margin: 0 auto 15px; width: 100px; height: auto;" />
          <p style="font-size: 16px; color: #333; margin: 0 0 10px;">
            Sent with 
            <span style="font-size: 18px; font-weight: bold;">
              <span style="background: linear-gradient(to top left, #8e44ad, #c27aff, #e0b3ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline;">
                Mail
              </span>
              <span style="background: linear-gradient(to top left, #ff0000, #fdcf58); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline;">
                Storm
              </span>
            </span> 
            - Professional Bulk Email Sender
          </p>
          <p style="margin: 0;">
            <a href="https://mailstorm.com" style="font-size: 14px; color: #007bff; text-decoration: none;">Get your free account at mailstorm.com</a>
          </p>
        </div>
      `;
			return htmlBody + watermark;
		}
		return htmlBody;
	}

	static addTrackingPixel(
		htmlBody: string,
		emailLogId: string,
		plan: string
	) {
		if (plan !== "PRO") return htmlBody;

		const trackingPixel = `
      <img src="${process.env.NEXT_PUBLIC_BASE_URL}/api/track-open?logId=${emailLogId}" style="display:none;" />
    `;
		return htmlBody.replace("</body>", `${trackingPixel}</body>`);
	}
}

export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
