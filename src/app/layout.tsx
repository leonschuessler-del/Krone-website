import type { Metadata, Viewport } from "next";
import { fraktur, sans, serif } from "./fonts";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Zur Krone Leidersbach – Landhotel, Gasthof & Eventlocation",
    template: "%s · Zur Krone Leidersbach",
  },
  description: siteConfig.description,
  applicationName: "Zur Krone",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Zur Krone Leidersbach",
    title: "Zur Krone Leidersbach – Ein Ort. Viele Möglichkeiten.",
    description: siteConfig.description,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${serif.variable} ${sans.variable} ${fraktur.variable}`}>
      <body className="min-h-dvh bg-paper antialiased">{children}</body>
    </html>
  );
}
