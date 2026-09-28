import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Verwaltung", template: "%s · Verwaltung Zur Krone" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** Admin area root: only metadata (noindex). Login and panel have their own layouts. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
