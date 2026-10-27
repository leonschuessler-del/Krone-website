import type { Metadata, Viewport } from "next";
import { fraktur, goudy, sans, serif } from "./fonts";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  // Event-only scope (10/2026): this site is the event location of the Krone.
  title: {
    default: "Eventlocation Zur Krone – Räume mieten in Leidersbach",
    template: "%s · Eventlocation Zur Krone",
  },
  description: siteConfig.description,
  applicationName: "Eventlocation Zur Krone",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "Eventlocation Zur Krone Leidersbach",
    title: "Eventlocation Zur Krone – Ein Ort. Viele Möglichkeiten.",
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
    <html lang="de" className={`${serif.variable} ${sans.variable} ${fraktur.variable} ${goudy.variable}`}>
      <body className="min-h-dvh bg-paper antialiased">{children}</body>
    </html>
  );
}
