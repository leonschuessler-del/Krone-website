import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = { title: "Impressum", alternates: { canonical: "/impressum" } };

export default function Page() {
  return <LegalPage doc={legalDocuments["impressum"]!} />;
}
