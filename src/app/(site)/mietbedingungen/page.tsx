import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = { title: "Mietbedingungen", alternates: { canonical: "/mietbedingungen" } };

export default function Page() {
  return <LegalPage doc={legalDocuments["mietbedingungen"]!} />;
}
