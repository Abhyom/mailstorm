"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, RefreshCw, Paperclip, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import {
	Bold,
	Italic,
	Underline as UnderlineIcon,
	Strikethrough,
	Quote,
	List,
	ListOrdered,
	AlignLeft,
	AlignCenter,
	AlignRight,
	AlignJustify,
	Undo,
	Redo,
	Link as LinkIcon,
	Image as ImageIcon,
} from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

export default function EditPage() {
	const router = useRouter();
	const [campaignData, setCampaignData] = useState<{
		name: string;
		context: string;
		csvData: any[];
		columnMapping: { companyName?: string; email?: string };
	} | null>(null);
	const [subject, setSubject] = useState<string>("");
	const [bodyTemplate, setBodyTemplate] = useState<string>("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [attachments, setAttachments] = useState<File[]>([]);
	const [previews, setPreviews] = useState<
		{ company: string; email: string; subject: string; body: string }[]
	>([]);

	// Retrieve campaign data from sessionStorage on mount
	useEffect(() => {
		const data = sessionStorage.getItem("campaignData");
		if (data) {
			const parsedData = JSON.parse(data);
			if (
				!parsedData.name ||
				!parsedData.context ||
				!parsedData.csvData ||
				!parsedData.columnMapping
			) {
				setError("Invalid campaign data. Please start over.");
				router.push("/upload");
				return;
			}
			setCampaignData(parsedData);
		} else {
			router.push("/upload");
		}
	}, [router]);

	// Watch for changes in subject, bodyTemplate, or campaignData and update previews
	useEffect(() => {
		if (!campaignData || !subject || !bodyTemplate) return;

		const updatedPreviews = campaignData.csvData.map((recipient) => {
			const companyName =
				recipient[campaignData.columnMapping.companyName!] ||
				"Unknown Company";
			const emailAddress =
				recipient[campaignData.columnMapping.email!] || "Unknown Email";
			const body = bodyTemplate.replace(/{companyName}/g, companyName);
			return {
				company: companyName,
				email: emailAddress,
				subject,
				body,
			};
		});

		setPreviews(updatedPreviews);
	}, [subject, bodyTemplate, campaignData]);

	// Initialize Tiptap editor for email body
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				bulletList: {
					HTMLAttributes: { class: "list-disc pl-6" },
				},
				orderedList: {
					HTMLAttributes: { class: "list-decimal pl-6" },
				},
			}),
			Underline,
			TextAlign.configure({
				types: ["heading", "paragraph"],
			}),
			Link.configure({
				openOnClick: false,
			}),
			Image,
			Typography,
		],
		content: "",
		onUpdate: ({ editor }) => {
			const html = editor.getHTML();
			setBodyTemplate(html);
		},
		editorProps: {
			attributes: {
				class: "prose prose-invert max-w-none p-4 min-h-[200px] bg-slate-900/60 border border-slate-700 rounded-[12px] focus:outline-none focus:ring-1 focus:ring-purple-500 text-white",
			},
		},
	});

	// Convert plain text to HTML for Tiptap
	const convertPlainTextToHTML = (text: string) => {
		if (!text) return "<p></p>";
		return text
			.split("\n")
			.map((line) => (line.trim() ? `<p>${line}</p>` : "<p><br></p>"))
			.join("");
	};

	// Function to generate an email template using OpenRouter's DeepSeek R1 API
	const generateEmail = async () => {
		if (
			!campaignData ||
			!campaignData.columnMapping.companyName ||
			!campaignData.columnMapping.email
		) {
			setError("Missing campaign data or column mappings.");
			return;
		}

		setIsGenerating(true);
		setError(null);
		setSubject("");
		setBodyTemplate("");
		setAttachments([]);
		setPreviews([]);

		try {
			const messages = [
				{
					role: "system",
					content:
						"You are an AI that generates professional email templates based on given details.",
				},
				{
					role: "user",
					content: `Generate a professional email template with the following details:
- Sender's name: ${campaignData.name}
- Context: ${campaignData.context}
- Recipient's company: Use the placeholder {companyName}

The email should be concise, personalized, and professional, with a clear subject line and a call to action. Ensure the email is complete, including a proper greeting, body, call to action, closing, and signature with the sender's name. Do not cut off mid-sentence; complete all thoughts and sections.
Format the email as plain text, starting with the subject line, followed by a blank line, then the body. The subject line must start with "Subject: " exactly. Use {companyName} as a placeholder for the company name in the body.`,
				},
			];

			const response = await fetch("/api/generate-email", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ messages }),
			});

			const data = await response.json();
			if (!response.ok || data.error) {
				if (response.status === 429) {
					throw new Error(
						"Rate limit exceeded for OpenRouter's free tier. Please try again later or consider upgrading to a paid plan."
					);
				}
				if (response.status === 401) {
					throw new Error(
						"Invalid OpenRouter API key. Please check your API key in the environment variables."
					);
				}
				throw new Error(data.error || "Failed to generate email.");
			}

			const emailContent = data.email;
			const lines = emailContent
				.split("\n")
				.map((line: string) => line.trim());

			let subjectLine = "Untitled";
			let subjectIndex = -1;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].toLowerCase();
				if (line.startsWith("subject:")) {
					subjectLine = lines[i].substring("subject:".length).trim();
					subjectIndex = i;
					break;
				}
			}

			let bodyLines;
			if (subjectIndex !== -1) {
				const startIndex =
					subjectIndex + 1 < lines.length &&
					lines[subjectIndex + 1] === ""
						? subjectIndex + 2
						: subjectIndex + 1;
				bodyLines = lines.slice(startIndex).join("\n").trim();
			} else {
				const firstNonEmptyLineIndex = lines.findIndex(
					(line: string) => line !== ""
				);
				if (firstNonEmptyLineIndex !== -1) {
					subjectLine = lines[firstNonEmptyLineIndex];
					const startIndex =
						firstNonEmptyLineIndex + 1 < lines.length &&
						lines[firstNonEmptyLineIndex + 1] === ""
							? firstNonEmptyLineIndex + 2
							: firstNonEmptyLineIndex + 1;
					bodyLines = lines.slice(startIndex).join("\n").trim();
				} else {
					bodyLines = "";
				}
			}

			const htmlBody = convertPlainTextToHTML(bodyLines);
			setSubject(subjectLine);
			setBodyTemplate(htmlBody);
			if (editor) {
				editor.commands.setContent(htmlBody);
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "An unknown error occurred while generating the email."
			);
		} finally {
			setIsGenerating(false);
		}
	};

	// Handle file attachments
	const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		const maxSize = 5 * 1024 * 1024; // 5MB limit per file
		const validFiles = files.filter((file) => {
			if (file.size > maxSize) {
				setError(`File "${file.name}" exceeds 5MB limit.`);
				return false;
			}
			return true;
		});
		setAttachments((prev) => [...prev, ...validFiles]);
		e.target.value = "";
	};

	const handleRemoveAttachment = (index: number) => {
		setAttachments((prev) => prev.filter((_, i) => i !== index));
	};

	// Handle link insertion
	const handleSetLink = () => {
		if (!editor) return;
		const url = window.prompt("Enter the URL:");
		if (url) {
			editor.chain().focus().setLink({ href: url }).run();
		} else {
			editor.chain().focus().unsetLink().run();
		}
	};

	// Handle image insertion
	const handleAddImage = () => {
		if (!editor) return;
		const url = window.prompt("Enter the image URL:");
		if (url) {
			editor.chain().focus().setImage({ src: url }).run();
		}
	};

	if (!campaignData) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-purple-950 to-black">
				<Loader2 className="h-8 w-8 animate-spin text-purple-500" />
			</div>
		);
	}

	return (
		<div className="mt-6 flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-purple-950 to-black overflow-x-hidden">
			<style>{`
        div::-webkit-scrollbar {
          width: 4px;
        }
        div::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5); /* slate-800/50 */
          border-radius: 2px;
        }
        div::-webkit-scrollbar-thumb {
          background: #9333ea; /* purple-500 */
          border-radius: 2px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #a855f7; /* purple-400 */
        }
        /* Custom underline effect for active tab */
        .custom-tab-active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 50%;
          height: 3px;
          background: linear-gradient(to right, #ff0000, #fdcf58);
          border-radius: 2px;
        }
      `}</style>
			<Tooltip.Provider>
				<div className="w-full max-w-4xl px-4 py-8 md:py-16">
					<div
						className="rounded-[16px] border border-purple-500/20 bg-black/40 p-4 backdrop-blur-sm shadow-[0_0_30px_rgba(147,51,234,0.2)] sm:p-6 md:p-8"
						style={{
							background:
								"linear-gradient(145deg, rgba(0,0,0,0.9), rgba(15,3,30,0.8))",
							boxShadow:
								"0 10px 40px -15px rgba(139, 92, 246, 0.3)",
						}}
					>
						<h1 className="mb-8 text-center text-2xl font-semibold text-gray-200 sm:text-3xl">
							<span className="block text-xl text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400">
								Generate Personalized Emails
							</span>
						</h1>

						{/* Campaign Summary */}
						<div className="mb-6 rounded-[12px] border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
							<h2 className="text-lg font-medium text-white mb-4">
								Campaign Summary
							</h2>
							<div className="space-y-2">
								<div className="flex justify-between">
									<span className="text-sm text-slate-400">
										Your Name:
									</span>
									<span className="text-sm text-white font-medium">
										{campaignData.name}
									</span>
								</div>
								<div className="flex justify-between items-start">
									<span className="text-sm text-slate-400">
										Context:
									</span>
									<div className="text-sm text-white font-medium max-w-[60%] text-right max-h-[120px] overflow-y-auto pr-2 leading-relaxed scrollbar scrollbar-thin scrollbar-track-slate-800/50 scrollbar-thumb-purple-500 hover:scrollbar-thumb-purple-400">
										{campaignData.context}
									</div>
								</div>
								<div className="flex justify-between">
									<span className="text-sm text-slate-400">
										Recipients:
									</span>
									<span className="text-sm text-white font-medium">
										{campaignData.csvData.length} companies
									</span>
								</div>
							</div>
						</div>

						{/* Generate Email Button */}
						<button
							onClick={generateEmail}
							disabled={isGenerating}
							className="flex items-center justify-center w-full rounded-[12px] bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02] disabled:opacity-70 mb-6"
						>
							{isGenerating ? (
								<Loader2 className="h-5 w-5 animate-spin mr-2" />
							) : (
								<RefreshCw className="h-5 w-5 mr-2" />
							)}
							{isGenerating
								? "Generating..."
								: subject || bodyTemplate
								? "Regenerate Emails"
								: "Generate Emails"}
						</button>

						{/* Combined Email Previews and Editor Tabs */}
						{(previews.length > 0 || subject || bodyTemplate) && (
							<div className="mb-6 rounded-[12px] border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
								<Tabs defaultValue="preview" className="w-full">
									<TabsList className="mb-6 flex justify-center gap-4">
										<TabsTrigger
											value="preview"
											className="relative w-60 transform rounded-[10px] border !border-[#fdcf58] bg-transparent px-6 py-3 font-black uppercase text-transparent opacity-60 shadow-[0_0_5px_rgba(147,51,234,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:opacity-80 !bg-clip-text !bg-cover !bg-center data-[state=active]:-translate-y-1 data-[state=active]:opacity-100 data-[state=active]:shadow-[0_0_15px_rgba(147,51,234,0.7)] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff0000] data-[state=active]:to-[#fdcf58] data-[state=active]:custom-tab-active"
											style={{
												background:
													"linear-gradient(to top left, #ff0000, #fdcf58)",
											}}
										>
											Preview Emails
										</TabsTrigger>
										<TabsTrigger
											value="edit"
											className="relative w-60 transform rounded-[10px] border !border-[#fdcf58] bg-transparent px-6 py-3 font-black uppercase text-transparent opacity-60 shadow-[0_0_5px_rgba(147,51,234,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:opacity-80 !bg-clip-text !bg-cover !bg-center data-[state=active]:-translate-y-1 data-[state=active]:opacity-100 data-[state=active]:shadow-[0_0_15px_rgba(147,51,234,0.7)] data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff0000] data-[state=active]:to-[#fdcf58] data-[state=active]:custom-tab-active"
											style={{
												background:
													"linear-gradient(to top left, #ff0000, #fdcf58)",
											}}
										>
											Edit Template
										</TabsTrigger>
									</TabsList>

									{/* Email Previews Tab */}
									<TabsContent value="preview">
										{previews.length > 0 && (
											<div>
												<h3 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
													Email Previews
												</h3>
												<Tabs
													defaultValue="0"
													className="w-full"
												>
													<TabsList className="mb-6 flex flex-wrap gap-2 justify-start">
														{previews.map(
															(
																preview,
																index
															) => (
																<TabsTrigger
																	key={index}
																	value={index.toString()}
																	className="px-4 py-2 rounded-[8px] border border-slate-700 text-white hover:bg-slate-700 data-[state=active]:bg-purple-600"
																>
																	{
																		preview.company
																	}
																</TabsTrigger>
															)
														)}
													</TabsList>
													{previews.map(
														(preview, index) => (
															<TabsContent
																key={index}
																value={index.toString()}
																className="overflow-hidden"
															>
																<div className="p-6 bg-slate-900/80 rounded-[12px] border border-slate-700 text-sm text-white font-sans shadow-sm shadow-purple-500/20">
																	<p className="text-sm text-slate-400 mb-2">
																		<strong>
																			Subject:
																		</strong>{" "}
																		{
																			preview.subject
																		}
																	</p>
																	<p className="text-sm text-slate-400 mb-4">
																		<strong>
																			To:
																		</strong>{" "}
																		{
																			preview.email
																		}
																	</p>
																	<div
																		className="text-sm text-white leading-relaxed"
																		dangerouslySetInnerHTML={{
																			__html: preview.body,
																		}}
																	/>
																	{attachments.length >
																		0 && (
																		<div className="mt-4">
																			<p className="text-sm text-slate-400 mb-2">
																				Attachments:
																			</p>
																			<div className="flex flex-wrap gap-2">
																				{attachments.map(
																					(
																						file,
																						idx
																					) => (
																						<div
																							key={
																								idx
																							}
																							className="flex items-center bg-slate-800 rounded-[8px] px-3 py-1 text-sm text-white"
																						>
																							{
																								file.name
																							}
																						</div>
																					)
																				)}
																			</div>
																		</div>
																	)}
																</div>
															</TabsContent>
														)
													)}
												</Tabs>
											</div>
										)}
									</TabsContent>

									{/* Email Template Editor Tab */}
									<TabsContent value="edit">
										{(subject || bodyTemplate) && (
											<div>
												{error && (
													<div className="mb-4 rounded-[12px] bg-red-500/10 p-3 flex items-center text-sm text-red-500">
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
												<h3 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
													Email Template Editor
												</h3>

												{/* Subject Line Input */}
												<div className="mb-4">
													<label className="text-sm text-slate-400 mb-1 block">
														Subject
													</label>
													<input
														type="text"
														value={subject}
														onChange={(e) =>
															setSubject(
																e.target.value
															)
														}
														className="w-full rounded-[12px] border border-slate-700 bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
														placeholder="Enter email subject"
													/>
												</div>

												{/* Tiptap Editor for Body */}
												<div className="mb-4">
													<label className="text-sm text-slate-400 mb-1 block">
														Body
													</label>
													<div className="mb-2 flex flex-wrap gap-2 p-2 bg-slate-800 border border-slate-700 rounded-[12px]">
														{/* Formatting Buttons with Tooltips */}
														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleBold()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"bold"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleBold()
																	}
																>
																	<Bold className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Bold
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleItalic()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"italic"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleItalic()
																	}
																>
																	<Italic className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Italic
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleUnderline()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"underline"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleUnderline()
																	}
																>
																	<UnderlineIcon className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Underline
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleStrike()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"strike"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleStrike()
																	}
																>
																	<Strikethrough className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Strikethrough
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleBlockquote()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"blockquote"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleBlockquote()
																	}
																>
																	<Quote className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Quote
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleBulletList()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"bulletList"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleBulletList()
																	}
																>
																	<List className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Bullet List
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.toggleOrderedList()
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"orderedList"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																	disabled={
																		!editor
																			?.can()
																			.toggleOrderedList()
																	}
																>
																	<ListOrdered className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Ordered List
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.setTextAlign(
																				"left"
																			)
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"textAlign",
																			{
																				textAlign:
																					"left",
																			}
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																>
																	<AlignLeft className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Align Left
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.setTextAlign(
																				"center"
																			)
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"textAlign",
																			{
																				textAlign:
																					"center",
																			}
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																>
																	<AlignCenter className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Align Center
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.setTextAlign(
																				"right"
																			)
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"textAlign",
																			{
																				textAlign:
																					"right",
																			}
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																>
																	<AlignRight className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Align Right
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.setTextAlign(
																				"justify"
																			)
																			.run()
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"textAlign",
																			{
																				textAlign:
																					"justify",
																			}
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																>
																	<AlignJustify className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Justify
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.undo()
																			.run()
																	}
																	className="p-2 rounded-full border border-slate-700 bg-slate-900/60 hover:bg-slate-700"
																	disabled={
																		!editor
																			?.can()
																			.undo()
																	}
																>
																	<Undo className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Undo
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={() =>
																		editor
																			?.chain()
																			.focus()
																			.redo()
																			.run()
																	}
																	className="p-2 rounded-full border border-slate-700 bg-slate-900/60 hover:bg-slate-700"
																	disabled={
																		!editor
																			?.can()
																			.redo()
																	}
																>
																	<Redo className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Redo
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={
																		handleSetLink
																	}
																	className={`p-2 rounded-full border border-slate-700 ${
																		editor?.isActive(
																			"link"
																		)
																			? "bg-purple-600"
																			: "bg-slate-900/60 hover:bg-slate-700"
																	}`}
																>
																	<LinkIcon className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Insert Link
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>

														<Tooltip.Root>
															<Tooltip.Trigger
																asChild
															>
																<button
																	onClick={
																		handleAddImage
																	}
																	className="p-2 rounded-full border border-slate-700 bg-slate-900/60 hover:bg-slate-700"
																>
																	<ImageIcon className="h-4 w-4 text-white" />
																</button>
															</Tooltip.Trigger>
															<Tooltip.Portal>
																<Tooltip.Content
																	className="bg-slate-900 text-white text-xs p-2 rounded-[4px] shadow-lg"
																	sideOffset={
																		5
																	}
																>
																	Insert Image
																	<Tooltip.Arrow className="fill-slate-900" />
																</Tooltip.Content>
															</Tooltip.Portal>
														</Tooltip.Root>
													</div>
													<EditorContent
														editor={editor}
													/>
												</div>

												{/* File Attachments */}
												<div className="mb-4">
													<label className="text-sm text-slate-400 mb-1 block">
														Attachments
													</label>
													<div className="flex items-center">
														<label className="flex items-center cursor-pointer rounded-[12px] border border-slate-700 bg-slate-900/60 px-4 py-2 text-white shadow-sm hover:bg-slate-700/80">
															<Paperclip className="h-4 w-4 mr-2" />
															Attach Files
															<input
																type="file"
																multiple
																onChange={
																	handleAttachFiles
																}
																className="hidden"
															/>
														</label>
													</div>
													{attachments.length > 0 && (
														<div className="mt-2 flex flex-wrap gap-2">
															{attachments.map(
																(
																	file,
																	index
																) => (
																	<div
																		key={
																			index
																		}
																		className="flex items-center bg-slate-800 rounded-[8px] px-3 py-1 text-sm text-white"
																	>
																		{
																			file.name
																		}
																		<button
																			onClick={() =>
																				handleRemoveAttachment(
																					index
																				)
																			}
																			className="ml-2 text-red-500 hover:text-red-400"
																		>
																			<X className="h-4 w-4" />
																		</button>
																	</div>
																)
															)}
														</div>
													)}
												</div>
											</div>
										)}
									</TabsContent>
								</Tabs>
							</div>
						)}
					</div>
				</div>
			</Tooltip.Provider>
		</div>
	);
}
