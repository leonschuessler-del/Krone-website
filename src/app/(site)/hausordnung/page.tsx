import type { Metadata } from "next";
import { legalDocuments } from "@/content/legal";
import { LegalPage } from "@/features/legal/LegalPage";
import { pageMeta } from "@/lib/page-metadata";

export const metadata: Metadata = pageMeta({
  title: "Hausordnung",
  description: "Hausordnung der Eventlocation Zur Krone in Leidersbach – Regeln für einen angenehmen Aufenthalt und reibungslose Veranstaltungen.",
  path: "/hausordnung",
});

export default function Page() {
  return <LegalPage doc={legalDocuments["hausordnung"]!} />;
}
