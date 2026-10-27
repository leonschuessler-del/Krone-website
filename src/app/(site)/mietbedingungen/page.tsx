import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";
import { pageMeta } from "@/lib/page-metadata";

export const metadata: Metadata = pageMeta({
  title: "Mietbedingungen",
  description: "Mietbedingungen für die Veranstaltungsräume der Eventlocation Zur Krone in Leidersbach.",
  path: "/mietbedingungen",
});

export default function Page() {
  return <LegalPage doc={legalDocuments["mietbedingungen"]!} />;
}
