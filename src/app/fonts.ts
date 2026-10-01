import localFont from "next/font/local";

/**
 * Self-hosted fonts (no request to Google at runtime – privacy by design).
 * Headlines: Cormorant Garamond (elegant serif)
 * UI / body: Source Sans 3 (highly legible humanist sans)
 */
export const serif = localFont({
  variable: "--font-serif",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const sans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2", weight: "200 900", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-italic.woff2", weight: "200 900", style: "italic" },
  ],
  fallback: ["system-ui", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

/** Brand word mark: Fraktur lettering as painted on the façade ("Zur Krone"). */
export const fraktur = localFont({
  variable: "--font-fraktur",
  display: "swap",
  src: [{ path: "../../node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2", weight: "400", style: "normal" }],
  fallback: ["Georgia", "serif"],
});
