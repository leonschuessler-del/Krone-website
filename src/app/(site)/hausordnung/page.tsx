import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = { title: "Hausordnung", alternates: { canonical: "/hausordnung" } };

export default function Page() {
  return <LegalPage doc={legalDocuments["hausordnung"]!} />;
}
