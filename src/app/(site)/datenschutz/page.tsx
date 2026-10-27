import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";
import { pageMeta } from "@/lib/page-metadata";

export const metadata: Metadata = pageMeta({
  title: "Datenschutz",
  description: "Datenschutzerklärung der Eventlocation Zur Krone in Leidersbach – welche Daten wir verarbeiten und warum.",
  path: "/datenschutz",
});

export default function Page() {
  return <LegalPage doc={legalDocuments["datenschutz"]!} />;
}
