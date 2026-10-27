import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";
import { pageMeta } from "@/lib/page-metadata";

export const metadata: Metadata = pageMeta({
  title: "AGB",
  description: "Allgemeine Geschäftsbedingungen der Krone in Leidersbach für die Beherbergung, auch für Zimmer zu Ihrer Feier.",
  path: "/agb",
});

export default function Page() {
  return <LegalPage doc={legalDocuments["agb"]!} />;
}
