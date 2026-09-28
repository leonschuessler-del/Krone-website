import type { BookingKind } from "@/domain/types";

/**
 * Checkboxes shown before a booking / inquiry is submitted.
 * The linked documents are PLACEHOLDERS – LEGAL REVIEW REQUIRED.
 */
export interface TermDefinition {
  id: string;
  label: string;
  href: string;
  linkLabel: string;
  requiredFor: BookingKind[];
}

export const terms: TermDefinition[] = [
  { id: "house_rules", label: "Ich habe die {link} gelesen und akzeptiere sie.", linkLabel: "Hausordnung", href: "/hausordnung", requiredFor: ["booking"] },
  { id: "rental_terms", label: "Ich akzeptiere die {link}.", linkLabel: "Mietbedingungen", href: "/mietbedingungen", requiredFor: ["booking"] },
  { id: "cancellation", label: "Ich habe die {link} zur Kenntnis genommen.", linkLabel: "Stornobedingungen", href: "/mietbedingungen#storno", requiredFor: ["booking"] },
  { id: "deposit", label: "Ich akzeptiere die {link}.", linkLabel: "Kautionsbedingungen", href: "/mietbedingungen#kaution", requiredFor: ["booking"] },
  { id: "handover", label: "Ich akzeptiere die {link} inkl. Reinigungsvorgaben.", linkLabel: "Übergaberegeln", href: "/mietbedingungen#uebergabe", requiredFor: ["booking"] },
  { id: "privacy", label: "Ich habe die {link} gelesen. Meine Angaben werden zur Bearbeitung meiner Anfrage verwendet.", linkLabel: "Datenschutzhinweise", href: "/datenschutz", requiredFor: ["booking", "inquiry"] },
];

export function requiredTermIds(kind: BookingKind): string[] {
  return terms.filter((t) => t.requiredFor.includes(kind)).map((t) => t.id);
}
