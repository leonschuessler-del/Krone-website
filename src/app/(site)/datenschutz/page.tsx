import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = { title: "Datenschutz", alternates: { canonical: "/datenschutz" } };

export default function Page() {
  return <LegalPage doc={legalDocuments["datenschutz"]!} />;
}
