"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, RefreshCw, Paperclip, X, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";

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
      setCampaignData(JSON.parse(data));
    } else {
      router.push("/upload");
    }
  }, [router]);

  // Watch for changes in subject, bodyTemplate, or campaignData and update previews
  useEffect(() => {
    if (!campaignData || !subject || !bodyTemplate) return;

    const updatedPreviews = campaignData.csvData.map((recipient) => {
      const companyName = recipient[campaignData.columnMapping.companyName!];
      const emailAddress = recipient[campaignData.columnMapping.email!];
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
    extensions: [StarterKit],
    content: "", // Initially empty; we'll set content dynamically
    onUpdate: ({ editor }) => {
      setBodyTemplate(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none p-4 min-h-[200px] bg-slate-900/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500",
      },
    },
  });

  // Convert plain text to HTML for Tiptap
  const convertPlainTextToHTML = (text: string) => {
    if (!text) return "";
    // Split the text into lines, trim each line, and filter out empty lines
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    // Wrap each line in a <p> tag, unless it already contains HTML tags
    const htmlLines = lines.map((line) =>
      line.includes("<") ? line : `<p>${line}</p>`
    );
    return htmlLines.join("");
  };

  // Update editor content when bodyTemplate changes
  useEffect(() => {
    if (editor && bodyTemplate) {
      console.log("Updating editor with bodyTemplate:", bodyTemplate);
      // Convert plain text to HTML
      const htmlContent = convertPlainTextToHTML(bodyTemplate);
      console.log("Converted HTML content:", htmlContent);
      editor.commands.setContent(htmlContent);
      console.log("Editor content after update:", editor.getHTML());
    }
  }, [bodyTemplate, editor]);

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
      // Construct the messages for OpenRouter API (DeepSeek R1)
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

      // Call the API route
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

      // Parse the generated email into subject and body
      const emailContent = data.email;
      console.log("Raw API response email:", emailContent);
      // Split by newlines and trim any leading/trailing whitespace
      const lines = emailContent.split("\n").map((line: string) => line.trim());
      console.log("Split lines:", lines);

      // Find the subject line more flexibly
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

      // If subject line was found, extract the body starting after the subject and the blank line
      let bodyLines;
      if (subjectIndex !== -1) {
        // Skip the subject line and the blank line after it (if it exists)
        const startIndex =
          subjectIndex + 1 < lines.length && lines[subjectIndex + 1] === ""
            ? subjectIndex + 2
            : subjectIndex + 1;
        bodyLines = lines.slice(startIndex).join("\n").trim();
      } else {
        // If no subject line is found, treat the first non-empty line as the subject
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

      console.log("Parsed subject:", subjectLine);
      console.log("Parsed body:", bodyLines);
      setSubject(subjectLine);
      setBodyTemplate(bodyLines);
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "An unknown error occurred.") ||
          "Failed to generate email. Please try again."
      );
      console.error("OpenRouter API error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle file attachments
  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = ""; // Reset the file input
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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
      <div className=" w-full max-w-4xl px-4 py-8 md:py-16">
        <div
          className="rounded-2xl border border-purple-500/20 bg-black/40 p-4 backdrop-blur-sm shadow-[0_0_30px_rgba(147,51,234,0.2)] sm:p-6 md:p-8"
          style={{
            background:
              "linear-gradient(145deg, rgba(0,0,0,0.9), rgba(15,3,30,0.8))",
            boxShadow: "0 10px 40px -15px rgba(139, 92, 246, 0.3)",
          }}
        >
          <h1 className="mb-8 text-center text-2xl font-semibold text-gray-200 sm:text-3xl">
            <span className="block text-xl text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400">
              Generate Personalized Emails
            </span>
          </h1>

          {/* Campaign Summary */}
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
            <h2 className="text-lg font-medium text-white mb-4">
              Campaign Summary
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Your Name:</span>
                <span className="text-sm text-white font-medium">
                  {campaignData.name}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-sm text-slate-400">Context:</span>
                <span className="text-sm text-white font-medium max-w-[60%] text-right">
                  {campaignData.context}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Recipients:</span>
                <span className="text-sm text-white font-medium">
                  {campaignData.csvData.length} companies
                </span>
              </div>
            </div>
          </div>
          {/* Preview All Emails */}
          <button
            onClick={generateEmail}
            disabled={isGenerating}
            className="flex items-center justify-center w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02] disabled:opacity-70 mb-4"
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
          <div className="mb-6">
            {previews.length > 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
                <h3 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
                  Email Previews
                </h3>
                <Tabs defaultValue="0" className="w-full">
                  <TabsList className="flex flex-wrap gap-2 mb-4 bg-slate-800 p-2 rounded-lg">
                    {previews.map((preview, index) => (
                      <TabsTrigger
                        key={index}
                        value={index.toString()}
                        className="px-4 py-2 rounded-md text-sm text-white data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                      >
                        {preview.company}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {previews.map((preview, index) => (
                    <TabsContent key={index} value={index.toString()}>
                      <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <p className="text-sm text-slate-400 mb-1">
                          <strong>Subject:</strong> {preview.subject}
                        </p>
                        <p className="text-sm text-slate-400 mb-1">
                          <strong>To:</strong> {preview.email}
                        </p>
                        <div
                          className="text-sm text-white prose prose-invert"
                          dangerouslySetInnerHTML={{
                            __html: preview.body,
                          }}
                        />
                        {attachments.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm text-slate-400 mb-1">
                              Attachments:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {attachments.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center bg-slate-800 rounded-lg px-3 py-1 text-sm text-white"
                                >
                                  {file.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </div>
          {/* Email Template Editor */}
          <div className="mb-6">
            {/* <button
              onClick={generateEmail}
              disabled={isGenerating}
              className="flex items-center justify-center w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02] disabled:opacity-70 mb-4"
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
            </button> */}
            {error && (
              <div className="mb-4 rounded-md bg-red-500/10 p-3 flex items-center text-sm text-red-500">
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

            {(subject || bodyTemplate) && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
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
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Enter email subject"
                  />
                </div>

                {/* Tiptap Editor for Body */}
                <div className="mb-4">
                  <label className="text-sm text-slate-400 mb-1 block">
                    Body
                  </label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editor?.chain().focus().toggleBold().run()}
                      className={
                        editor?.isActive("bold")
                          ? "bg-purple-500 text-white"
                          : ""
                      }
                    >
                      Bold
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        editor?.chain().focus().toggleItalic().run()
                      }
                      className={
                        editor?.isActive("italic")
                          ? "bg-purple-500 text-white"
                          : ""
                      }
                    >
                      Italic
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        editor?.chain().focus().toggleBulletList().run()
                      }
                      className={
                        editor?.isActive("bulletList")
                          ? "bg-purple-500 text-white"
                          : ""
                      }
                    >
                      Bullet List
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        editor?.chain().focus().toggleOrderedList().run()
                      }
                      className={
                        editor?.isActive("orderedList")
                          ? "bg-purple-500 text-white"
                          : ""
                      }
                    >
                      Ordered List
                    </Button>
                  </div>
                  <EditorContent editor={editor} />
                </div>

                {/* File Attachments */}
                <div className="mb-4">
                  <label className="text-sm text-slate-400 mb-1 block">
                    Attachments
                  </label>
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-white shadow-sm hover:bg-slate-800">
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Files
                      <input
                        type="file"
                        multiple
                        onChange={handleAttachFiles}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center bg-slate-800 rounded-lg px-3 py-1 text-sm text-white"
                        >
                          {file.name}
                          <button
                            onClick={() => handleRemoveAttachment(index)}
                            className="ml-2 text-red-500 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push("/upload")}
              className="flex items-center px-4 py-2 text-sm text-slate-300 hover:text-white"
            >
              <svg className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="none">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M10 16l-6-6 6-6M4 10h12"
                />
              </svg>
              Back to Upload
            </button>

            <button
              disabled={previews.length === 0}
              className="flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 disabled:opacity-70"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Emails
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
