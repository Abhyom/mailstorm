import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge class names (compatible with Tailwind)
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
