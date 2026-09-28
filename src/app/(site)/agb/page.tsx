import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";

export const metadata: Metadata = { title: "AGB", alternates: { canonical: "/agb" } };

export default function Page() {
  return <LegalPage doc={legalDocuments["agb"]!} />;
}
