import { TriangleAlert } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { LegalDocument } from "@/content/legal";

export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-32">
      <div className="container-page max-w-3xl">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: doc.title }]} />
        <h1 className="mt-6 text-5xl">{doc.title}</h1>
        <div role="note" className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-warning/40 bg-warning-pale p-5 text-[#5d4413]">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold uppercase tracking-wider">Legal review required</p>
            <p className="mt-1 text-sm">
              Platzhalter – dieser Text ist nicht rechtsgültig und wird vor dem Livegang durch rechtlich geprüfte Inhalte ersetzt.
            </p>
          </div>
        </div>
        <p className="mt-8 text-lg text-ink-soft">{doc.intro}</p>
        <div className="mt-10 space-y-10">
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="font-serif text-3xl">
                {i + 1}. {s.heading}
              </h2>
              <p className="mt-3 text-ink-soft">{s.placeholder}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
