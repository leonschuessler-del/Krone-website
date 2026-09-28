import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Custom design tokens (text sizes / colours) must be known to tailwind-merge
// so that conflicting classes are resolved correctly.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-family": ["font-serif", "font-sans"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
