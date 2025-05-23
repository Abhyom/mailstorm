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
  Info
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
  const [errors, setErrors] = useState<{ name?: string; context?: string; csv?: string; form?: string }>({});
  const [columns, setColumns] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [suggestedMappings, setSuggestedMappings] = useState<{ companyName?: string; email?: string }>({});
  const [columnMapping, setColumnMapping] = useState<{ companyName?: string; email?: string }>({});
  const [previewData, setPreviewData] = useState<{ company: string; email: string }[]>([]);

  // Page load animation
  useEffect(() => {
    setPageLoaded(true);
  }, []);

  // Auto-suggest column mappings when CSV is parsed
  useEffect(() => {
    if (columns.length > 0) {
      const suggestions = {
        companyName: findBestMatch(columns, ["company", "organization", "business", "name"]),
        email: findBestMatch(columns, ["email", "mail", "e-mail", "contact"]),
      };
      
      setSuggestedMappings(suggestions);
      setColumnMapping(suggestions);
      
      // If we have good suggestions, automatically prepare preview data
      if (suggestions.companyName && suggestions.email) {
        generatePreviewData(suggestions);
      }
    }
  }, [columns, csvData]);

  // Find the best matching column name from the CSV
  const findBestMatch = (columns: string[], keywords: string[]) => {
    const lowerCaseColumns = columns.map(col => col.toLowerCase());
    
    // First try exact matches
    for (const keyword of keywords) {
      const exactMatch = lowerCaseColumns.findIndex(col => col === keyword);
      if (exactMatch !== -1) return columns[exactMatch];
    }
    
    // Then try partial matches
    for (const keyword of keywords) {
      const partialMatch = lowerCaseColumns.findIndex(col => col.includes(keyword));
      if (partialMatch !== -1) return columns[partialMatch];
    }
    
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Reset errors
    setErrors({});

    // Validation
    const newErrors: { name?: string; context?: string; csv?: string; form?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!context.trim()) newErrors.context = "Context is required";
    if (!csvFile) newErrors.csv = "CSV file is required";
    if (!columnMapping.companyName) newErrors.csv = "Please map a column to 'Company Name'";
    if (!columnMapping.email) newErrors.csv = "Please map a column to 'Email'";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      // Simulate a delay for demonstration
      await new Promise((resolve) => setTimeout(resolve, 1500));

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

        setIsParsing(false);

        // Check for parsing errors
        if (parseErrors.length > 0) {
          setErrors({ ...errors, csv: "Error parsing the CSV file" });
          return;
        }

        // Extract column headers and data
        const headers = meta.fields || [];
        setColumns(headers);
        setCsvData(data);
        setIsParsed(true);
        
        // Automatically advance to mapping step
        setStep(2);
        
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

  const handleColumnMappingChange = (field: "companyName" | "email", value: string) => {
    const newMapping = {
      ...columnMapping,
      [field]: value,
    };
    
    setColumnMapping(newMapping);
    
    // Generate preview data with the new mapping
    if (newMapping.companyName && newMapping.email) {
      generatePreviewData(newMapping);
    }
  };
  
  const generatePreviewData = (mapping: { companyName?: string; email?: string }) => {
    if (!mapping.companyName || !mapping.email || csvData.length === 0) return;
    
    const preview = csvData.slice(0, 3).map(row => ({
      company: row[mapping.companyName!] || "N/A",
      email: row[mapping.email!] || "N/A"
    }));
    
    setPreviewData(preview);
  };

  // Continue to next step handler
  const handleContinue = () => {
    // Reset errors first
    setErrors({});
    
    // For step 1, validate name and context
    if (step === 1) {
      const newErrors: { name?: string; context?: string; csv?: string } = {};
      
      if (!name.trim()) {
        newErrors.name = "Your name is required";
      }
      
      if (!context.trim()) {
        newErrors.context = "Email context is required";
      }
      
      if (!csvFile) {
        newErrors.csv = "Please upload a CSV file";
      }
      
      // If there are errors, show them and don't proceed
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      
      // No errors, proceed to next step
      setStep(2);
    }
    // For step 2, validate column mappings
    else if (step === 2) {
      // Validate mappings before proceeding
      if (!columnMapping.companyName || !columnMapping.email) {
        setErrors({ csv: "Please map both company name and email columns" });
        return;
      }
      setStep(3);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-purple-950 to-black overflow-x-hidden">
      {/* Page load animation wrapper */}
      <div 
        className={`w-full max-w-4xl px-4 py-8 md:py-16 transition-all duration-1000 ease-out ${
          pageLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        {/* Progress indicator */}
        <div className="max-w-lg mx-auto mb-16">
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-800 -translate-y-1/2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500 ease-out" 
                style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
              ></div>
            </div>
            
            {/* Step circles */}
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="relative">
                <div className="flex flex-col items-center">
                  <div 
                    className={`flex items-center justify-center w-12 h-12 rounded-full z-10 transition-all duration-300 ${
                      step === stepNumber 
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-4 ring-purple-900/30" 
                        : step > stepNumber 
                          ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-900/20" 
                          : "bg-slate-800 text-gray-400 shadow-inner shadow-black/50"
                    }`}
                  >
                    {step > stepNumber ? <CheckCircle className="w-6 h-6" /> : stepNumber}
                  </div>
                  <span 
                    className={`mt-3 text-center whitespace-nowrap text-sm font-medium transition-colors duration-300 ${
                      step === stepNumber ? "text-purple-400" : step > stepNumber ? "text-green-400" : "text-gray-500"
                    }`}
                  >
                    {stepNumber === 1 ? "Upload CSV" : stepNumber === 2 ? "Map Columns" : "Review & Submit"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border border-purple-500/20 bg-black/40 p-4 backdrop-blur-sm shadow-[0_0_30px_rgba(147,51,234,0.2)] sm:p-6 md:p-8"
          style={{ 
            background: "linear-gradient(145deg, rgba(0,0,0,0.9), rgba(15,3,30,0.8))",
            boxShadow: "0 10px 40px -15px rgba(139, 92, 246, 0.3)"
          }}
        >
          <h1 className="mb-8 text-center text-2xl font-semibold text-gray-200 sm:text-3xl relative">
            <span className="block text-xl text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-500 to-gray-400">
              Bulk Email Campaign Setup
            </span>
          </h1>


          <form onSubmit={handleSubmit}>
            {/* Step 1: Upload CSV */}
            <div className={`transition-all duration-500 ${step === 1 ? "block" : "hidden"}`}>
              {/* Name Input */}
              <div className="mb-5">
                <label htmlFor="name-input" className="mb-2 block text-sm font-medium text-slate-300 flex items-center">
                  <User className="mr-2 inline h-4 w-4 text-purple-400" />
                  Your Name <span className="text-pink-500 ml-1">*</span>
                </label>
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full rounded-lg border ${
                    errors.name ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"
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

              {/* Context Input */}
              <div className="mb-5">
                <label htmlFor="context-input" className="mb-2 block text-sm font-medium text-slate-300 flex items-center">
                  <MessageSquare className="mr-2 inline h-4 w-4 text-purple-400" />
                  Email Context <span className="text-pink-500 ml-1">*</span>
                </label>
                <textarea
                  id="context-input"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className={`w-full rounded-lg border ${
                    errors.context ? "border-red-500 ring-1 ring-red-500" : "border-slate-700"
                  } bg-slate-900/60 p-3 text-white shadow-sm backdrop-blur-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500`}
                  placeholder="e.g., Applying for software engineering internship opportunities"
                  rows={3}
                />
                {errors.context && (
                  <div className="mt-2 flex items-center text-sm text-red-500">
                    <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                    <p>{errors.context}</p>
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Describe what you're emailing about (internship application, job opportunity, etc.)
                </p>
              </div>

              {/* CSV Upload */}
              <div className="mb-6 relative">
                <label htmlFor="csv-upload" className="mb-2 block text-sm font-medium text-slate-300 flex items-center">
                  <FileSpreadsheet className="mr-2 inline h-4 w-4 text-purple-400" />
                  Contact List (CSV)
                </label>
                
                <div
                  className={`group flex flex-col cursor-pointer items-center justify-center rounded-lg border-2 border-dashed ${
                    errors.csv ? "border-red-500/50" : csvFile ? "border-purple-500/50" : "border-slate-700/50"
                  } bg-slate-900/30 backdrop-blur-sm p-8 text-center shadow-sm transition-all hover:border-purple-400/80 hover:bg-slate-900/50`}
                  onClick={() => document.getElementById("csv-upload")?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      document.getElementById("csv-upload")?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload CSV file"
                >
                  {isParsing ? (
                    <div className="flex flex-col items-center py-4">
                      {/* Modern Loading Animation */}
                      <div className="relative w-16 h-16 mb-3">
                        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
                      </div>
                      <p className="text-sm text-slate-300">Processing your file...</p>
                    </div>
                  ) : isParsed ? (
                    <div className="flex flex-col items-center py-2">
                      <div className="bg-green-500/10 rounded-full p-3 mb-2">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="text-sm font-medium text-green-400">{csvFile?.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {csvData.length} rows, {columns.length} columns detected
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
                        {csvFile ? csvFile.name : "Drag and drop or click to upload"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        CSV file with company names and email addresses
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

              {/* Continue Button for Step 1 */}
              <button
                type="button"
                onClick={handleContinue}
                className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-purple-700 to-pink-600 px-4 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-black sm:px-6 sm:py-4"
              >
                Continue <ChevronRight className="ml-2 h-5 w-5" />
              </button>
            </div>

            {/* Step 2: CSV Column Mapping */}
            <div className={`transition-all duration-500 ${step === 2 ? "block" : "hidden"}`}>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-white">Map Your CSV Columns</h2>
                  <p className="text-xs text-purple-400">
                    <CheckCircle className="inline h-3 w-3 mr-1" />
                    {csvFile?.name}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-5 shadow-sm mb-6">
                  <p className="text-sm text-slate-400 mb-4">
                    We've automatically detected the best column mappings from your CSV. Please verify or adjust them below.
                  </p>

                  <div className="space-y-4">
                    {/* Company Name Mapping */}
                    <div>
                      <label htmlFor="company-column" className="mb-1 block text-sm font-medium text-slate-300">
                        Company Name Column
                      </label>
                      <div className="relative">
                        <select
                          id="company-column"
                          value={columnMapping.companyName || ""}
                          onChange={(e) => handleColumnMappingChange("companyName", e.target.value)}
                          className="w-full rounded border border-slate-600 bg-black/50 p-2 pl-3 pr-10 text-sm text-white appearance-none focus:border-purple-500 focus:outline-none"
                        >
                          <option value="" disabled>
                            Select a column
                          </option>
                          {columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20">
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M6 8l4 4 4-4"
                            />
                          </svg>
                        </div>
                      </div>
                      {suggestedMappings.companyName && (
                        <p className="mt-1 text-xs text-green-500">
                          <CheckCircle className="inline h-3 w-3 mr-1" />
                          Auto-detected company column
                        </p>
                      )}
                    </div>

                    {/* Email Mapping */}
                    <div>
                      <label htmlFor="email-column" className="mb-1 block text-sm font-medium text-slate-300">
                        Email Address Column
                      </label>
                      <div className="relative">
                        <select
                          id="email-column"
                          value={columnMapping.email || ""}
                          onChange={(e) => handleColumnMappingChange("email", e.target.value)}
                          className="w-full rounded border border-slate-600 bg-black/50 p-2 pl-3 pr-10 text-sm text-white appearance-none focus:border-purple-500 focus:outline-none"
                        >
                          <option value="" disabled>
                            Select a column
                          </option>
                          {columns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20">
                            <path
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M6 8l4 4 4-4"
                            />
                          </svg>
                        </div>
                      </div>
                      {suggestedMappings.email && (
                        <p className="mt-1 text-xs text-green-500">
                          <CheckCircle className="inline h-3 w-3 mr-1" />
                          Auto-detected email column
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preview Section */}
                {previewData.length > 0 && (
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-5 shadow-sm">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Preview</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Company Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Email Address</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((item, idx) => (
                            <tr key={idx} className="border-t border-slate-800">
                              <td className="px-3 py-2 text-xs text-slate-300">{item.company}</td>
                              <td className="px-3 py-2 text-xs text-slate-300">{item.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      {csvData.length > 3 ? `Showing ${previewData.length} of ${csvData.length} rows` : ""}
                    </p>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
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
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="flex items-center px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white text-sm font-medium transition-all hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 focus:ring-offset-black"
                  >
                    Continue 
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Review & Submit */}
            <div className={`transition-all duration-500 ${step === 3 ? "block" : "hidden"}`}>
              <div className="mb-6">
                <h2 className="text-lg font-medium text-white mb-4">Review and Generate</h2>
                
                <div className="space-y-4 mb-6">
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
                    <h3 className="text-xs uppercase tracking-wider text-slate-500">Campaign Details</h3>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Your Name:</span>
                        <span className="text-sm text-white font-medium">{name}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-sm text-slate-400">Context:</span>
                        <span className="text-sm text-white font-medium text-right max-w-[60%]">{context}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">File:</span>
                        <span className="text-sm text-white font-medium">{csvFile?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Recipients:</span>
                        <span className="text-sm text-white font-medium">{csvData.length} companies</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
                    <h3 className="text-xs uppercase tracking-wider text-slate-500">Column Mapping</h3>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Company Name:</span>
                        <span className="text-sm text-white font-medium">{columnMapping.companyName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-400">Email Address:</span>
                        <span className="text-sm text-white font-medium">{columnMapping.email}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Sample from the CSV */}
                  {previewData.length > 0 && (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 backdrop-blur-sm p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs uppercase tracking-wider text-slate-500">Sample Recipients</h3>
                        <span className="text-xs text-slate-500">{previewData.length} of {csvData.length}</span>
                      </div>
                      {previewData.map((item, idx) => (
                        <div key={idx} className="py-2 border-t border-slate-800 flex justify-between">
                          <span className="text-sm text-white">{item.company}</span>
                          <span className="text-sm text-slate-400">{item.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Error */}
                {errors.form && (
                  <div className="mb-5 rounded-md bg-red-500/10 p-3 flex items-center text-sm text-red-500">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    {errors.form}
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
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
                    Back
                  </button>
                  
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <>
                        Generate Sample Email <ArrowUpRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Help Tip */}
        <div className="mt-8 rounded-lg border border-purple-900/30 bg-black/60 backdrop-blur-sm p-4 flex items-start shadow-[0_5px_25px_-5px_rgba(139,92,246,0.2)]">
          <div className="mr-3 mt-0.5 bg-purple-900/40 p-1.5 rounded-full">
            <Info className="h-4 w-4 text-purple-300" />
          </div>
          <div>
            <p className="text-xs text-slate-300">
              Your CSV file should contain company names and email addresses. We'll help you map these columns and generate personalized emails for each recipient.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}