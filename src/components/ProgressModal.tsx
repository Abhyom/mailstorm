// src/components/ProgressModal.tsx
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ProgressModalProps {
	isOpen: boolean;
	onClose: () => void;
	campaignData: {
		name: string;
		subject: string;
		bodyTemplate: string;
		recipients: { email: string; companyName: string }[];
		attachments?: { filename: string; content: string; mimeType: string }[];
	};
}

export default function ProgressModal({
	isOpen,
	onClose,
	campaignData,
}: ProgressModalProps) {
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
	const [sent, setSent] = useState(0);
	const [failed, setFailed] = useState(0);
	const [errors, setErrors] = useState<string[]>([]);

	useEffect(() => {
		if (!isOpen || status !== "idle") return;

		const sendEmails = async () => {
			setStatus("sending");
			setError(null);
			setProgress(0);
			setSent(0);
			setFailed(0);
			setErrors([]);

			try {
				const response = await fetch("/api/send-email", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						campaignName: campaignData.name,
						subject: campaignData.subject,
						bodyTemplate: campaignData.bodyTemplate,
						recipients: campaignData.recipients,
						attachments: campaignData.attachments,
					}),
				});

				const data = await response.json();
				if (!response.ok) {
					throw new Error(data.error || "Failed to send emails");
				}

				const total = campaignData.recipients.length;
				setSent(data.sent || 0);
				setFailed(data.failed || 0);
				setErrors(data.errors || []);
				setProgress((data.sent / total) * 100);

				setStatus("done");
			} catch (err) {
				setError(
					err instanceof Error
						? err.message
						: "An unknown error occurred"
				);
				setStatus("done");
			}
		};

		sendEmails();
	}, [isOpen, status, campaignData]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
			<div className="bg-slate-900 rounded-[16px] p-6 w-full max-w-md border border-slate-700 shadow-lg shadow-purple-500/20">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-lg font-medium text-white">
						Sending Campaign
					</h2>
					<button
						onClick={onClose}
						className="text-slate-400 hover:text-white"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="space-y-3 text-sm text-slate-300">
					<div className="flex justify-between">
						<span>{campaignData.name}</span>
					</div>
					<div className="flex justify-between">
						<span>Subject:</span>
						<span className="text-white">
							{campaignData.subject}
						</span>
					</div>
					<div className="flex justify-between">
						<span>Recipients:</span>
						<span className="text-white">
							{campaignData.recipients.length}
						</span>
					</div>
					{status === "done" && (
						<>
							<div className="flex justify-between">
								<span>Sent:</span>
								<span className="text-green-500">{sent}</span>
							</div>
							<div className="flex justify-between">
								<span>Failed:</span>
								<span className="text-red-500">{failed}</span>
							</div>
						</>
					)}
				</div>

				<div className="mt-4">
					<h3 className="text-sm text-slate-400 mb-1">Progress</h3>
					<div className="w-full bg-slate-700 rounded-full h-2">
						<div
							className="bg-purple-500 h-2 rounded-full transition-all duration-300"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<p className="text-sm text-white mt-1">
						{Math.round(progress)}%
					</p>
				</div>

				{error && (
					<div className="mt-4 rounded-[12px] bg-red-500/10 p-3 text-sm text-red-500 flex items-center">
						<svg
							className="h-4 w-4 mr-2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						{error}
					</div>
				)}

				{errors.length > 0 && (
					<div className="mt-4">
						<h3 className="text-sm text-slate-400 mb-1">Errors</h3>
						<ul className="text-sm text-red-500">
							{errors.map((err, idx) => (
								<li key={idx}>{err}</li>
							))}
						</ul>
					</div>
				)}

				{status === "done" && !error && failed === 0 && (
					<p className="mt-4 text-sm text-green-500">
						Emails sent successfully!
					</p>
				)}
			</div>
		</div>
	);
}
