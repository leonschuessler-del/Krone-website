import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";
import { pageMeta } from "@/lib/page-metadata";

export const metadata: Metadata = pageMeta({
  title: "Impressum",
  description: "Impressum der Eventlocation Zur Krone in Leidersbach – Anbieterkennzeichnung und Kontakt.",
  path: "/impressum",
});

export default function Page() {
  return <LegalPage doc={legalDocuments["impressum"]!} />;
}
