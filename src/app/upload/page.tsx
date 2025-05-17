"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, User, ArrowRight, Table, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; context?: string; csv?: string; companyColumn?: string; emailColumn?: string; form?: string }>({});
  const [companyColumn, setCompanyColumn] = useState("A");
  const [emailColumn, setEmailColumn] = useState("B");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Reset errors
    setErrors({});
    
    // Validation
    const newErrors: { name?: string; context?: string; csv?: string; companyColumn?: string; emailColumn?: string; form?: string } = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!context.trim()) newErrors.context = "Context is required";
    if (!csvFile) newErrors.csv = "CSV file is required";
    if (!companyColumn.trim()) newErrors.companyColumn = "Company column is required";
    if (!emailColumn.trim()) newErrors.emailColumn = "Email column is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }
    
    try {
      // Here you would normally upload the files to your server
      // For demonstration, we'll simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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
    if (!file) {
      return;
    }
    
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      setErrors({ ...errors, csv: "Please upload a valid CSV file" });
      return;
    }
    
    setCsvFile(file);
    if (errors.csv) {
      const { csv, ...restErrors } = errors;
      setErrors(restErrors);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-900">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:py-16">
        <div 
          className="rounded-2xl border border-purple-500/20 bg-black/40 p-4 shadow-[0_0_20px_rgba(147,51,234,0.3)] sm:p-6 md:p-8"
          style={{ opacity: 1 }}
        >
          <h1 className="mb-6 text-center text-2xl font-bold text-white sm:mb-8 sm:text-3xl">
            <span className="text-purple-400">Upload</span> Your Details
          </h1>
          
          <form onSubmit={handleSubmit}>
            {/* Name Input */}
            <div className="mb-5">
              <label htmlFor="name-input" className="mb-2 block text-sm font-medium text-slate-300">
                <User className="mr-2 inline h-4 w-4" />
                Your Name
              </label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full rounded-lg border ${
                  errors.name ? "border-red-500" : "border-slate-700"
                } bg-slate-900 p-3 text-white shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500`}
                placeholder="Enter your full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Context Input */}
            <div className="mb-5">
              <label htmlFor="context-input" className="mb-2 block text-sm font-medium text-slate-300">
                <MessageSquare className="mr-2 inline h-4 w-4" />
                Email Context
              </label>
              <textarea
                id="context-input"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className={`w-full rounded-lg border ${
                  errors.context ? "border-red-500" : "border-slate-700"
                } bg-slate-900 p-3 text-white shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500`}
                placeholder="e.g., Applying for software engineering internship opportunities"
                rows={3}
              />
              {errors.context && (
                <p className="mt-1 text-sm text-red-500">{errors.context}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Describe what you're emailing about (internship application, job opportunity, etc.)
              </p>
            </div>

            {/* CSV Upload */}
            <div className="mb-5">
              <label htmlFor="csv-upload" className="mb-2 block text-sm font-medium text-slate-300">
                <FileSpreadsheet className="mr-2 inline h-4 w-4" />
                Contact List (CSV)
              </label>
              <div
                className={`flex cursor-pointer items-center justify-center rounded-lg border ${
                  errors.csv ? "border-red-500" : "border-slate-700"
                } bg-slate-900 p-4 text-center shadow-sm transition-all hover:border-purple-500 sm:p-6`}
                onClick={() => document.getElementById("csv-upload")?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    document.getElementById("csv-upload")?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload CSV file"
              >
                <div>
                  <Upload className="mx-auto mb-2 h-6 w-6 text-slate-400 sm:h-8 sm:w-8" />
                  <p className="text-sm text-slate-300">
                    {csvFile ? csvFile.name : "Upload your contacts (CSV)"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Should contain company names and email addresses
                  </p>
                </div>
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
                <p className="mt-1 text-sm text-red-500">{errors.csv}</p>
              )}
            </div>

            {/* CSV Column Selection */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                <Table className="mr-2 inline h-4 w-4" />
                CSV Column Mapping
              </label>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  {/* Company Column Selection */}
                  <div className="flex-1">
                    <label htmlFor="company-column" className="mb-1 block text-xs font-medium text-slate-400">
                      Company Name Column
                    </label>
                    <input
                      id="company-column"
                      type="text"
                      value={companyColumn}
                      onChange={(e) => setCompanyColumn(e.target.value)}
                      placeholder="A"
                      className={`w-full rounded border ${
                        errors.companyColumn ? "border-red-500" : "border-slate-600"
                      } bg-slate-800 p-2 text-sm text-white focus:border-purple-500 focus:outline-none`}
                    />
                    {errors.companyColumn && (
                      <p className="mt-1 text-xs text-red-500">{errors.companyColumn}</p>
                    )}
                  </div>
                  
                  {/* Email Column Selection */}
                  <div className="flex-1">
                    <label htmlFor="email-column" className="mb-1 block text-xs font-medium text-slate-400">
                      Company Email Column
                    </label>
                    <input
                      id="email-column"
                      type="text"
                      value={emailColumn}
                      onChange={(e) => setEmailColumn(e.target.value)}
                      placeholder="B"
                      className={`w-full rounded border ${
                        errors.emailColumn ? "border-red-500" : "border-slate-600"
                      } bg-slate-800 p-2 text-sm text-white focus:border-purple-500 focus:outline-none`}
                    />
                    {errors.emailColumn && (
                      <p className="mt-1 text-xs text-red-500">{errors.emailColumn}</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Specify which columns contain company names and email addresses (e.g., A, B, C or 1, 2, 3)
                </p>
              </div>
            </div>

            {/* Form Error */}
            {errors.form && (
              <div className="mb-5 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                {errors.form}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-purple-700 to-purple-500 px-4 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-purple-500/50 disabled:opacity-70 sm:px-6 sm:py-4"
            >
              {isLoading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  Generate Sample Email <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <p
          className="mt-4 text-center text-xs text-slate-400 sm:mt-6 sm:text-sm"
        >
          Your CSV should have columns for company names and email addresses
        </p>
      </div>
    </div>
  );
}