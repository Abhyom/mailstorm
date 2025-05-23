// filepath: /Users/habitat/WebProjects/mailstorm/src/utils/csvUtils.ts
import Papa from "papaparse";

export interface CsvValidationResult {
  isValid: boolean;
  errors?: string;
}

export const validateCsvFile = (
  file: File,
  requiredColumns: string[]
): Promise<CsvValidationResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const { data, errors: parseErrors } = result;

        if (parseErrors.length > 0) {
          resolve({ isValid: false, errors: "Error parsing the CSV file" });
          return;
        }

        const headers = Object.keys(data[0] || {});
        const missingColumns = requiredColumns.filter(
          (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          resolve({
            isValid: false,
            errors: `Missing required columns: ${missingColumns.join(", ")}`,
          });
          return;
        }

        resolve({ isValid: true });
      },
      error: (error) => {
        console.error("CSV Parsing Error:", error);
        resolve({ isValid: false, errors: "Error reading the CSV file" });
      },
    });
  });
};