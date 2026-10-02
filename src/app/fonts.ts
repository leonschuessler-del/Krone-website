import localFont from "next/font/local";

/**
 * Self-hosted fonts (no request to Google at runtime – privacy by design).
 * Display: Cormorant Garamond, light weights – the quiet, high-contrast serif
 *          of the great hotel houses.
 * UI/body: Jost – a geometric sans (Futura-like) used sparingly and letter-spaced.
 */
export const serif = localFont({
  variable: "--font-serif",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-italic.woff2", weight: "300", style: "italic" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const sans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/jost/files/jost-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  fallback: ["Futura", "Avenir Next", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

/** Brand word mark: Fraktur lettering as painted on the façade ("Zur Krone"). */
export const fraktur = localFont({
  variable: "--font-fraktur",
  display: "swap",
  src: [{ path: "../../node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2", weight: "400", style: "normal" }],
  fallback: ["Georgia", "serif"],
});

/** Arched "Landhotel-Gasthof" of the logo: Goudy Old Style revival, as on the original logo. */
export const goudy = localFont({
  variable: "--font-goudy",
  display: "swap",
  src: [{ path: "../../node_modules/@fontsource/sorts-mill-goudy/files/sorts-mill-goudy-latin-400-normal.woff2", weight: "400", style: "normal" }],
  fallback: ["Georgia", "serif"],
});
