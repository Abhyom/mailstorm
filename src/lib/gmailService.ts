import { google } from "googleapis";
import { prisma } from "./prisma";

export class GmailService {
	private oauth2Client: any;
	private userId: string;

	constructor(accessToken: string, refreshToken: string, userId: string) {
		this.oauth2Client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET
		);

		this.oauth2Client.setCredentials({
			access_token: accessToken,
			refresh_token: refreshToken,
		});

		this.userId = userId;
	}

	async refreshAccessToken() {
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
		attachments?: { filename: string; content: string; mimeType: string }[]
	) {
		const boundary = `----=_Part_${Date.now()}_${Math.random()
			.toString(36)
			.substring(2)}`;

		// Start building the message
		let message = [
			`From: "${fromName}" <${fromEmail}>`,
			`To: ${to}`,
			`Subject: ${subject}`,
			"MIME-Version: 1.0",
		];

		// Determine content type based on attachments
		if (attachments && attachments.length > 0) {
			message.push(
				`Content-Type: multipart/mixed; boundary="${boundary}"`
			);
		} else {
			message.push(`Content-Type: text/html; charset=utf-8`);
		}

		message.push(""); // Empty line after headers

		if (attachments && attachments.length > 0) {
			// Add HTML body part
			message.push(`--${boundary}`);
			message.push("Content-Type: text/html; charset=utf-8");
			message.push("Content-Transfer-Encoding: quoted-printable");
			message.push("");
			message.push(this.encodeQuotedPrintable(htmlBody));

			// Add attachments
			for (const attachment of attachments) {
				message.push("");
				message.push(`--${boundary}`);
				message.push(
					`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`
				);
				message.push(
					`Content-Disposition: attachment; filename="${attachment.filename}"`
				);
				message.push("Content-Transfer-Encoding: base64");
				message.push("");

				// Ensure content is a string and split into 76-character lines
				const base64Content = attachment.content.toString();
				for (let i = 0; i < base64Content.length; i += 76) {
					message.push(base64Content.substring(i, i + 76));
				}
			}

			message.push(`--${boundary}--`); // End boundary
		} else {
			// No attachments, just HTML content
			message.push(htmlBody);
		}

		const fullMessage = message.join("\n");

		return Buffer.from(fullMessage)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	}

	// Helper function to encode quoted-printable (for better email compatibility)
	private encodeQuotedPrintable(str: string): string {
		return str
			.replace(/[\x80-\xFF]/g, (match) => {
				return (
					"=" +
					match
						.charCodeAt(0)
						.toString(16)
						.toUpperCase()
						.padStart(2, "0")
				);
			})
			.replace(/=/g, "=3D")
			.replace(/\n/g, "\r\n");
	}

	// Add retry logic with exponential backoff
	private async retryWithBackoff<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		baseDelay: number = 1000
	): Promise<T> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error: any) {
				console.log(`Attempt ${attempt} failed:`, error.message);

				// Don't retry on authentication errors
				if (error.code === 401) {
					throw error;
				}

				// Don't retry on final attempt
				if (attempt === maxRetries) {
					throw error;
				}

				// Check if it's a retryable error
				const isRetryable = this.isRetryableError(error);
				if (!isRetryable) {
					throw error;
				}

				// Calculate delay with exponential backoff
				const delay = baseDelay * Math.pow(2, attempt - 1);
				console.log(`Retrying in ${delay}ms...`);
				await this.delay(delay);
			}
		}

		throw new Error("Max retries exceeded");
	}

	private isRetryableError(error: any): boolean {
		// Network errors that are typically retryable
		const retryableCodes = [
			"ENETUNREACH", // Network unreachable
			"ECONNRESET", // Connection reset
			"ECONNREFUSED", // Connection refused
			"ETIMEDOUT", // Timeout
			"ENOTFOUND", // DNS lookup failed
			"EAI_AGAIN", // DNS temporary failure
		];

		// Gmail API specific retryable errors
		const retryableHttpCodes = [429, 500, 502, 503, 504];

		return (
			retryableCodes.includes(error.code) ||
			retryableCodes.includes(error.errno) ||
			retryableHttpCodes.includes(error.status) ||
			error.message?.includes("network") ||
			error.message?.includes("timeout") ||
			error.message?.includes("ENETUNREACH") ||
			error.type === "system"
		);
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async sendEmail(params: {
		to: string;
		subject: string;
		htmlBody: string;
		fromEmail: string;
		fromName: string;
		attachments?: { filename: string; content: string; mimeType: string }[];
		userId: string;
		emailLogId: string;
		plan: string;
	}): Promise<{ success: boolean; messageId: string | undefined }> {
		const sendOperation = async () => {
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

			console.log(
				`Preparing email for ${params.to} with ${
					params.attachments?.length || 0
				} attachments`
			);

			const rawMessage = this.createEmailMessage(
				params.to,
				params.subject,
				finalBody,
				params.fromEmail,
				params.fromName,
				params.attachments
			);

			// Add timeout to the Gmail API call
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error("Request timeout")), 45000); // Increased timeout for attachments
			});

			const gmailPromise = gmail.users.messages.send({
				userId: "me",
				requestBody: {
					raw: rawMessage,
				},
			});

			const response = await Promise.race([gmailPromise, timeoutPromise]);

			return {
				success: true,
				messageId: (response as any).data.id ?? undefined,
			};
		};

		try {
			// Use retry logic for the send operation
			return await this.retryWithBackoff(sendOperation, 3, 2000);
		} catch (error: any) {
			console.error("Gmail send error:", error);

			// Handle authentication errors
			if (error.code === 401) {
				try {
					console.log("Refreshing access token...");
					await this.refreshAccessToken();
					// Retry once after token refresh
					return await this.retryWithBackoff(sendOperation, 1, 1000);
				} catch (refreshError) {
					throw new Error(
						"Authentication failed. Please reconnect your Gmail account."
					);
				}
			}

			// Provide more specific error messages
			let errorMessage = "Failed to send email";
			if (error.code === "ENETUNREACH") {
				errorMessage =
					"Network connectivity issue - please check your internet connection";
			} else if (error.message?.includes("timeout")) {
				errorMessage =
					"Request timed out - Gmail API may be experiencing issues";
			} else if (error.status === 429) {
				errorMessage = "Rate limit exceeded - please try again later";
			} else if (error.message) {
				errorMessage = error.message;
			}

			throw new Error(errorMessage);
		}
	}

	static addWatermark(htmlBody: string, plan: string) {
		if (plan === "FREE") {
			// Modern dark theme watermark - email client compatible
			const watermark = `
				<div style="margin-top: 30px; padding: 24px; background: linear-gradient(135deg, #1a1a2e, #16213e); border: 1px solid #2d2d44; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
  
  <!-- Title + Tagline -->
  <div style="margin-bottom: 10px;">
    <div style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
      <span style="color: #8b5cf6;">Mail</span><span style="color: #f59e0b;">Storm</span>
    </div>
    <div style="font-size: 14px; color: #d4d4d8; margin-top: 4px;">Professional Bulk Email Sender</div>
  </div>

  <!-- Divider -->
  <div style="height: 1px; background-color: #2d2d44; margin: 16px auto; width: 60%;"></div>

  <!-- Sent with + Button -->
  <div style="font-size: 13px; color: #71717a; margin-bottom: 12px;">Sent with MailStorm’s powerful email engine</div>

  <a href="https://mailstorm.com" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; padding: 10px 20px; font-size: 13px; font-weight: 600; border-radius: 8px; transition: background 0.3s ease;">Get Your Free Account</a>

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
			<img src="${process.env.NEXT_PUBLIC_BASE_URL}/api/track-open?logId=${emailLogId}" width="1" height="1" style="display:none !important; visibility:hidden !important; opacity:0 !important; background:transparent !important; width:1px !important; height:1px !important;" alt="" />
		`;

		// Try to insert before closing body tag, or append if no body tag found
		if (htmlBody.includes("</body>")) {
			return htmlBody.replace("</body>", `${trackingPixel}</body>`);
		} else {
			return htmlBody + trackingPixel;
		}
	}
}

export function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
