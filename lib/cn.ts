import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the custom radius tokens defined in app/globals.css so that
// e.g. cn("rounded-control", "rounded-panel") keeps only the last one.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["control", "panel", "badge"],
    },
  },
});

/** Joins conditional class names and resolves conflicting Tailwind utilities (last wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
