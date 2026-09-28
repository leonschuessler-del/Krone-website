import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { faqItems } from "@/content/faq";
import { FaqList } from "@/features/home/FaqList";

export const metadata: Metadata = {
  title: "Häufige Fragen",
  description: "Antworten zu Buchung, Kombination von Bereichen, Verfügbarkeit, Kaution und Übergabe in der Krone Leidersbach.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems
      .filter((f) => !f.needsVerification)
      .map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <div className="bg-cream pb-24 pt-28 md:pt-32">
      <div className="container-page max-w-4xl">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: "FAQ" }]} />
        <h1 className="mt-6 text-5xl md:text-6xl">Häufige Fragen</h1>
        <div className="mt-10">
          <FaqList items={faqItems} />
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
