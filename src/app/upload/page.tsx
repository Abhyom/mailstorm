"use client";

import { useState, useEffect } from "react";
import {
	Upload,
	FileSpreadsheet,
	User,
	ArrowRight,
	MessageSquare,
	CheckCircle,
	AlertCircle,
	ChevronRight,
	X,
	ArrowUpRight,
	Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

export default function UploadPage() {
	const router = useRouter();
	const [pageLoaded, setPageLoaded] = useState(false);
	const [name, setName] = useState("");
	const [context, setContext] = useState("");
	const [csvFile, setCsvFile] = useState<File | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isParsing, setIsParsing] = useState(false);
	const [isParsed, setIsParsed] = useState(false);
	const [errors, setErrors] = useState<{
		name?: string;
		context?: string;
		csv?: string;
		form?: string;
	}>({});
	const [columns, setColumns] = useState<string[]>([]);
	const [csvData, setCsvData] = useState<any[]>([]);
	const [step, setStep] = useState(1);
	const [suggestedMappings, setSuggestedMappings] = useState<{
		companyName?: string;
		email?: string;
	}>({});
	const [columnMapping, setColumnMapping] = useState<{
		companyName?: string;
		email?: string;
	}>({});
	const [previewData, setPreviewData] = useState<
		{ company: string; email: string }[]
	>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10; // Number of items per page

	const paginatedData = previewData.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Page load animation
	useEffect(() => {
		setPageLoaded(true);
	}, []);

	// Auto-suggest column mappings when CSV is parsed
	useEffect(() => {
		if (columns.length > 0) {
			const suggestions = {
				companyName: findBestMatch(columns, [
					"company",
					"organization",
					"business",
					"name",
				]),
				email: findBestMatch(columns, [
					"email",
					"mail",
					"e-mail",
					"contact",
				]),
			};

			setSuggestedMappings(suggestions);
			setColumnMapping(suggestions);

			if (suggestions.companyName && suggestions.email) {
				generatePreviewData(suggestions);
			}
		}
	}, [columns, csvData]);

	const findBestMatch = (columns: string[], keywords: string[]) => {
		const lowerCaseColumns = columns.map((col) => col.toLowerCase());

		for (const keyword of keywords) {
			const exactMatch = lowerCaseColumns.findIndex(
				(col) => col === keyword
			);
			if (exactMatch !== -1) return columns[exactMatch];
		}

		for (const keyword of keywords) {
			const partialMatch = lowerCaseColumns.findIndex((col) =>
				col.includes(keyword)
			);
			if (partialMatch !== -1) return columns[partialMatch];
		}

		return undefined;
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);

		setErrors({});

		const newErrors: {
			name?: string;
			context?: string;
			csv?: string;
			form?: string;
		} = {};
		if (!name.trim()) newErrors.name = "Name is required";
		if (!context.trim()) newErrors.context = "Context is required";
		if (!csvFile) newErrors.csv = "CSV file is required";
		if (!columnMapping.companyName)
			newErrors.csv = "Please map a column to 'Company Name'";
		if (!columnMapping.email)
			newErrors.csv = "Please map a column to 'Email'";

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			setIsLoading(false);
			return;
		}

		try {
			// Store data in sessionStorage before redirecting
			sessionStorage.setItem(
				"campaignData",
				JSON.stringify({
					name,
					context,
					csvData,
					columnMapping,
				})
			);

			// Redirect to edit page
			router.push("/edit");
		} catch (error) {
			setErrors({ form: "An error occurred. Please try again." });
			console.error("Submission error:", error);
		} finally {
			setIsLoading(false);
		}
	};

	interface CsvChangeEvent extends React.ChangeEvent<HTMLInputElement> {
		target: HTMLInputElement & { files: FileList };
	}

	const handleCsvChange = (e: CsvChangeEvent) => {
		const file = e.target.files[0];
		if (!file) return;

		if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
			setErrors({ ...errors, csv: "Please upload a valid CSV file" });
			return;
		}

		setIsParsing(true);
		setIsParsed(false);
		setCsvFile(file);

		// Parse the CSV file
		Papa.parse(file, {
			header: true,
			skipEmptyLines: true,
			complete: (result) => {
				const { data, errors: parseErrors, meta } = result;

				// Filter out rows where all values are empty or whitespace
				const cleanedData = data.filter((row: any) => {
					if (!row || typeof row !== "object") return false;
					const values = Object.values(row);
					return values.some((value) => {
						if (value === null || value === undefined) return false;
						return value.toString().trim() !== "";
					});
				});

				setIsParsing(false);

				if (parseErrors.length > 0) {
					setErrors({ ...errors, csv: "Error parsing the CSV file" });
					return;
				}

				if (cleanedData.length === 0) {
					setErrors({
						...errors,
						csv: "The CSV file contains no valid data",
					});
					return;
				}

				const headers = meta.fields || [];
				setColumns(headers);
				setCsvData(cleanedData); // Store the cleaned data
				setIsParsed(true);

				// Remove any CSV-related errors if parsing succeeds
				if (errors.csv) {
					const { csv, ...restErrors } = errors;
					setErrors(restErrors);
				}
			},
			error: (error) => {
				console.error("CSV Parsing Error:", error);
				setErrors({ ...errors, csv: "Error reading the CSV file" });
				setIsParsing(false);
			},
		});
	};

	const handleColumnMappingChange = (
		field: "companyName" | "email",
		value: string
	) => {
		const newMapping = {
			...columnMapping,
			[field]: value,
		};

		setColumnMapping(newMapping);

		if (newMapping.companyName && newMapping.email) {
			generatePreviewData(newMapping);
		}
	};

	const generatePreviewData = (mapping: {
		companyName?: string;
		email?: string;
	}) => {
		if (!mapping.companyName || !mapping.email || csvData.length === 0)
			return;

		// Map all rows in the CSV data
		const preview = csvData.map((row) => ({
			company: row[mapping.companyName!] || "N/A",
			email: row[mapping.email!] || "N/A",
		}));

		setPreviewData(preview); // Set the entire dataset for pagination
	};

	const handleContinue = () => {
		setErrors({});

		if (step === 1) {
			const newErrors: { name?: string; context?: string; csv?: string } =
				{};

			if (!name.trim()) {
				newErrors.name = "Your name is required";
			}

			if (!context.trim()) {
				newErrors.context = "Email context is required";
			}

			if (!csvFile || !isParsed) {
				newErrors.csv = "Please upload a valid CSV file";
			}

			if (Object.keys(newErrors).length > 0) {
				setErrors(newErrors);
				return;
			}

			setStep(2);
		} else if (step === 2) {
			if (!columnMapping.companyName || !columnMapping.email) {
				setErrors({
					csv: "Please map both company name and email columns",
				});
				return;
			}
			setStep(3);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-purple-950 to-black overflow-x-hidden">
			<style>{`
        textarea::-webkit-scrollbar {
          width: 4px;
        }
        textarea::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5); /* slate-800/50 */
          border-radius: 2px;
        }
        textarea::-webkit-scrollbar-thumb {
          background: #9333ea; /* purple-500 */
          border-radius: 2px;
        }
        textarea::-webkit-scrollbar-thumb:hover {
          background: #a855f7; /* purple-400 */
        }
      `}</style>
			<div
				className={`w-full max-w-4xl px-4 py-8 md:py-16 transition-all duration-1000 ease-out ${
					pageLoaded
						? "opacity-100 translate-y-0"
						: "opacity-0 translate-y-12"
				}`}
			>
				<div className="max-w-2xl mx-auto mb-4 mt-12">
					<div className="flex justify-between mb-6">
						{[
							{ num: 1, label: "Upload CSV" },
							{ num: 2, label: "Map Columns" },
							{ num: 3, label: "Review & Submit" },
						].map(({ num, label }) => (
							<div
								key={num}
								className="flex flex-col items-start"
							>
								<span
									className={`
                    text-sm font-medium transition-colors duration-300
                    ${
						step === num
							? "text-white"
							: step > num
							? "text-slate-300"
							: "text-slate-500"
					}
                  `}
								>
									{label}
								</span>
								<span
									className={`
                    text-xs mt-1 font-black uppercase tracking-wider transition-colors duration-300
                    ${
						step === num
							? "text-purple-400"
							: step > num
							? "text-slate-400"
							: "text-slate-600"
					}
                  `}
								>
									Step {num}
								</span>
							</div>
						))}
					</div>

					<div className="relative">
						<div className="w-full h-3 bg-slate-800 rounded-[10px] overflow-hidden shadow-[0_0_10px_rgba(147,51,234,0.3)] border border-slate-700">
							<div
								className="h-full transition-all duration-700 ease-out rounded-[10px]"
								style={{
									width:
										step === 1
											? "33.33%"
											: step === 2
											? "66.66%"
											: "100%",
									background:
										"linear-gradient(to right, #9333ea, #ff0000, #fdcf58)",
								}}
							></div>
						</div>

						<div className="absolute inset-0 flex justify-between items-center px-2">
							{[1, 2, 3].map((stepNumber) => (
								<div
									key={stepNumber}
									className={`
                    w-5 h-5 rounded-full border-2 transition-all duration-300 flex items-center justify-center
                    ${
						step >= stepNumber
							? "border-purple-400 bg-slate-900 shadow-[0_0_10px_rgba(147,51,234,0.5)]"
							: "border-slate-600 bg-slate-800"
					}
                  `}
								>
									{step > stepNumber && (
										<CheckCircle
											className="w-3 h-3 text-purple-400"
											strokeWidth={3}
										/>
									)}
									{step === stepNumber && (
										<div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
									)}
								</div>
							))}
						</div>
					</div>

					<div className="mt-4 text-center">
						<span className="text-xs font-black uppercase tracking-wider text-slate-400">
							Progress: {step}/3
						</span>
					</div>
				</div>

				<div
					className="rounded-2xl border border-purple-500/20 bg-black/40 p-4 backdrop-blur-sm shadow-[0_0_30px_rgba(147,51,234,0.2)] sm:p-6 md:p-8"
					style={{
						background:
							"linear-gradient(145deg, rgba(0,0,0,0.9), rgba(15,3,30,0.8))",
						boxShadow: "0 10px 40px -15px rgba(139, 92, 246, 0.3)",
					}}
				>
					<h1 className="mb-8 text-center text-2xl font-semibold text-gray-200 sm:text-3xl relative">
						<span className="block text-xl text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400">
							Bulk Email Campaign Setup
						</span>
					</h1>

					<form onSubmit={handleSubmit}>
						<div
							className={`transition-all duration-500 ${
								step === 1 ? "block" : "hidden"
							}`}
						>
							<div className="mb-5">
								<label
									htmlFor="name-input"
									className="mb-2 block text-sm font-medium text-slate-300 flex items-center"
								>
									<User className="mr-2 inline h-4 w-4 text-purple-400" />
									Your Name{" "}
									<span className="text-pink-500 ml-1">
										*
									</span>
								</label>
								<input
									id="name-input"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className={`w-full rounded-[8px] border ${
										errors.name
											? "border-red-500 ring-1 ring-red-500"
											: "border-slate-700"
									} bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500`}
									placeholder="Enter your full name"
								/>
								{errors.name && (
									<div className="mt-2 flex items-center text-sm text-red-500">
										<AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
										<p>{errors.name}</p>
									</div>
								)}
							</div>

							<div className="mb-5">
								<label
									htmlFor="context-input"
									className="mb-2 block text-sm font-medium text-slate-300 flex items-center"
								>
									<MessageSquare className="mr-2 inline h-4 w-4 text-purple-400" />
									Email Context{" "}
									<span className="text-pink-500 ml-1">
										*
									</span>
								</label>
								<textarea
									id="context-input"
									value={context}
									onChange={(e) => setContext(e.target.value)}
									className={`w-full rounded-[8px] border ${
										errors.context
											? "border-red-500 ring-1 ring-red-500"
											: "border-slate-700"
									} bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y scrollbar scrollbar-thin scrollbar-track-slate-800/50 scrollbar-thumb-purple-500 hover:scrollbar-thumb-purple-400`}
									placeholder="Enter the context for your email to ensure it’s tailored to your needs. Include your full name, current status (e.g., senior at UC Berkeley, or software engineer at Google), and relevant details like your university, previous jobs, or key skills. For best results, you can copy-paste your resume or a summary of your qualifications to provide comprehensive information. Example: 'I’m Sarah Johnson, a senior Computer Science major at UC Berkeley, seeking a software engineering internship. My skills include Python, Java, and cloud computing, with projects in machine learning and web development.'"
									rows={6}
								/>
								{errors.context && (
									<div className="mt-2 flex items-center text-sm text-red-500">
										<AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
										<p>{errors.context}</p>
									</div>
								)}
								<p className="mt-1 text-xs text-slate-500">
									Describe what you're emailing about
									(internship application, job opportunity,
									etc.)
								</p>
							</div>

							<div className="mb-6 relative">
								<label
									htmlFor="csv-upload"
									className="mb-2 block text-sm font-medium text-slate-300 flex items-center"
								>
									<FileSpreadsheet className="mr-2 inline h-4 w-4 text-purple-400" />
									Contact List (CSV)
								</label>

								<div
									className={`group flex flex-col cursor-pointer items-center justify-center rounded-[8px] border-2 border-dashed ${
										errors.csv
											? "border-red-500/50"
											: csvFile
											? "border-purple-500/50"
											: "border-slate-700/50"
									} bg-slate-900/30 backdrop-blur-sm p-8 text-center shadow-sm transition-all hover:border-purple-400/80 hover:bg-slate-900/50`}
									onClick={() =>
										document
											.getElementById("csv-upload")
											?.click()
									}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" ||
											e.key === " "
										) {
											document
												.getElementById("csv-upload")
												?.click();
										}
									}}
									role="button"
									tabIndex={0}
									aria-label="Upload CSV file"
								>
									{isParsing ? (
										<div className="flex flex-col items-center py-4">
											<div className="relative w-16 h-16 mb-3">
												<div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
												<div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
											</div>
											<p className="text-sm text-slate-300">
												Processing your file...
											</p>
										</div>
									) : isParsed ? (
										<div className="flex flex-col items-center py-2">
											<div className="bg-green-500/10 rounded-full p-3 mb-2">
												<CheckCircle className="h-8 w-8 text-green-500" />
											</div>
											<p className="text-sm font-medium text-green-400">
												{csvFile?.name}
											</p>
											<p className="mt-1 text-xs text-slate-400">
												{csvData.length} rows,{" "}
												{columns.length} columns
												detected
											</p>
											<button
												type="button"
												className="mt-3 flex items-center text-xs text-purple-400 hover:text-purple-300"
												onClick={(e) => {
													e.stopPropagation();
													setCsvFile(null);
													setIsParsed(false);
													setColumns([]);
													setCsvData([]);
												}}
											>
												<X className="h-3 w-3 mr-1" />
												Remove and upload different file
											</button>
										</div>
									) : (
										<div className="group-hover:scale-105 transition-transform">
											<div className="bg-purple-500/10 rounded-full p-3 mb-3 mx-auto w-fit">
												<Upload className="h-8 w-8 text-purple-400 group-hover:text-purple-300" />
											</div>
											<p className="text-sm font-medium text-slate-300 group-hover:text-white">
												{csvFile
													? csvFile.name
													: "Drag and drop or click to upload"}
											</p>
											<p className="mt-1 text-xs text-slate-500">
												CSV file with company names and
												email addresses
											</p>
										</div>
									)}
									<input
										id="csv-upload"
										type="file"
										accept=".csv,text/csv"
										onChange={handleCsvChange}
										className="hidden"
										aria-hidden="true"
									/>
								</div>
								{errors.csv && (
									<div className="mt-2 flex items-start text-sm text-red-500">
										<AlertCircle className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
										<p>{errors.csv}</p>
									</div>
								)}
							</div>

							<button
								type="button"
								onClick={handleContinue}
								className="flex w-full items-center justify-center rounded-[12px] bg-gradient-to-r from-purple-700 to-pink-600 px-4 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black sm:px-6 sm:py-4"
							>
								Continue{" "}
								<ChevronRight className="ml-2 h-5 w-5" />
							</button>
						</div>

						<div
							className={`transition-all duration-500 ${
								step === 2 ? "block" : "hidden"
							}`}
						>
							<div className="mb-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg font-medium text-white">
										Map Your CSV Columns
									</h2>
									<p className="text-xs text-purple-400">
										<CheckCircle className="inline h-3 w-3 mr-1" />
										{csvFile?.name}
									</p>
								</div>

								<div className="rounded-[8px] border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-5 shadow-sm mb-6">
									<p className="text-sm text-slate-400 mb-4">
										We've automatically detected the columns
										in your CSV. Please confirm or adjust
										the mappings below.
									</p>

									<div className="space-y-4">
										<div>
											<label
												htmlFor="company-name-mapping"
												className="mb-2 block text-sm font-medium text-slate-300 flex items-center"
											>
												Company Name{" "}
												<span className="text-pink-500 ml-1">
													*
												</span>
											</label>
											<select
												id="company-name-mapping"
												value={
													columnMapping.companyName ||
													""
												}
												onChange={(e) =>
													handleColumnMappingChange(
														"companyName",
														e.target.value
													)
												}
												className="w-full rounded-[8px] border border-slate-700 bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
											>
												<option value="">
													Select a column
												</option>
												{columns.map((col) => (
													<option
														key={col}
														value={col}
													>
														{col}
													</option>
												))}
											</select>
										</div>

										<div>
											<label
												htmlFor="email-mapping"
												className="mb-2 block text-sm font-medium text-slate-300 flex items-center"
											>
												Email Address{" "}
												<span className="text-pink-500 ml-1">
													*
												</span>
											</label>
											<select
												id="email-mapping"
												value={
													columnMapping.email || ""
												}
												onChange={(e) =>
													handleColumnMappingChange(
														"email",
														e.target.value
													)
												}
												className="w-full rounded-[8px] border border-slate-700 bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
											>
												<option value="">
													Select a column
												</option>
												{columns.map((col) => (
													<option
														key={col}
														value={col}
													>
														{col}
													</option>
												))}
											</select>
										</div>
									</div>
								</div>

								{previewData.length > 0 && (
									<div className="mt-6">
										<h3 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
											Data Preview
										</h3>
										<div className="rounded-[8px] border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4 overflow-x-auto">
											<table className="w-full text-sm text-white">
												<thead>
													<tr className="border-b border-slate-700">
														<th className="py-2 px-4 text-left">
															Company
														</th>
														<th className="py-2 px-4 text-left">
															Email
														</th>
													</tr>
												</thead>
												<tbody>
													{paginatedData.map(
														(row, index) => (
															<tr
																key={index}
																className="border-b border-slate-800 last:border-b-0"
															>
																<td className="py-2 px-4">
																	{
																		row.company
																	}
																</td>
																<td className="py-2 px-4">
																	{row.email}
																</td>
															</tr>
														)
													)}
												</tbody>
											</table>
											<div className="flex justify-between items-center mt-4">
												<button
													type="button"
													onClick={() =>
														setCurrentPage((prev) =>
															Math.max(
																prev - 1,
																1
															)
														)
													}
													disabled={currentPage === 1}
													className={`px-4 py-2 rounded-[8px] text-sm font-medium ${
														currentPage === 1
															? "text-slate-500 cursor-not-allowed"
															: "text-purple-400 hover:text-purple-300"
													}`}
												>
													Previous
												</button>
												<span className="text-sm text-slate-400">
													Page {currentPage} of{" "}
													{Math.ceil(
														previewData.length /
															itemsPerPage
													)}
												</span>
												<button
													type="button"
													onClick={() =>
														setCurrentPage((prev) =>
															Math.min(
																prev + 1,
																Math.ceil(
																	previewData.length /
																		itemsPerPage
																)
															)
														)
													}
													disabled={
														currentPage ===
														Math.ceil(
															previewData.length /
																itemsPerPage
														)
													}
													className={`px-4 py-2 rounded-[8px] text-sm font-medium ${
														currentPage ===
														Math.ceil(
															previewData.length /
																itemsPerPage
														)
															? "text-slate-500 cursor-not-allowed"
															: "text-purple-400 hover:text-purple-300"
													}`}
												>
													Next
												</button>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="flex justify-between">
								<button
									type="button"
									onClick={() => setStep(1)}
									className="flex items-center px-4 py-2 text-sm text-slate-300 hover:text-white"
								>
									<ArrowRight className="h-4 w-4 mr-1 rotate-180" />
									Back
								</button>
								<button
									type="button"
									onClick={handleContinue}
									className="flex items-center rounded-[8px] bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02]"
								>
									Continue{" "}
									<ChevronRight className="ml-2 h-5 w-5" />
								</button>
							</div>
						</div>

						<div
							className={`transition-all duration-500 ${
								step === 3 ? "block" : "hidden"
							}`}
						>
							<div className="mb-6">
								<h2 className="text-lg font-medium text-white mb-4">
									Review Your Campaign
								</h2>
								<div className="rounded-[8px] border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-5 shadow-sm">
									<div className="space-y-4">
										<div className="flex justify-between">
											<span className="text-sm text-slate-400">
												Your Name:
											</span>
											<span className="text-sm text-white font-medium">
												{name}
											</span>
										</div>
										<div className="flex justify-between items-start">
											<span className="text-sm text-slate-400">
												Context:
											</span>
											<span className="text-sm text-white font-medium max-w-[60%] text-right">
												{context}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-slate-400">
												File Uploaded:
											</span>
											<span className="text-sm text-white font-medium">
												{csvFile?.name}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-slate-400">
												Recipients:
											</span>
											<span className="text-sm text-white font-medium">
												{csvData.length} companies
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-slate-400">
												Company Name Column:
											</span>
											<span className="text-sm text-white font-medium">
												{columnMapping.companyName}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-sm text-slate-400">
												Email Column:
											</span>
											<span className="text-sm text-white font-medium">
												{columnMapping.email}
											</span>
										</div>
									</div>
								</div>
							</div>

							{errors.form && (
								<div className="mb-4 rounded-md bg-red-500/10 p-3 flex items-center text-sm text-red-500">
									<AlertCircle className="h-4 w-4 mr-2" />
									{errors.form}
								</div>
							)}

							<div className="flex justify-between">
								<button
									type="button"
									onClick={() => setStep(2)}
									className="flex items-center px-4 py-2 text-sm text-slate-300 hover:text-white"
								>
									<ArrowRight className="h-4 w-4 mr-1 rotate-180" />
									Back
								</button>
								<button
									type="submit"
									disabled={isLoading}
									className="flex items-center justify-center rounded-[8px] bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02] disabled:opacity-70"
								>
									{isLoading ? (
										<>
											<div className="relative w-5 h-5 mr-2">
												<div className="absolute inset-0 rounded-full border-2 border-purple-500/20"></div>
												<div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin"></div>
											</div>
											Processing...
										</>
									) : (
										<>
											Proceed to Edit{" "}
											<ArrowUpRight className="ml-2 h-5 w-5" />
										</>
									)}
								</button>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
