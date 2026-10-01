import { Info } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type { LegalDocument } from "@/content/legal";
import { env } from "@/lib/env";

export function LegalPage({ doc }: { doc: LegalDocument }) {
  const sections = doc.sections.filter(
    (s) => !s.when || (s.when === "stripe" && env.paymentProvider === "stripe") || (s.when === "resend" && env.emailProvider === "resend"),
  );
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-36">
      <div className="container-page max-w-3xl">
        <Breadcrumbs items={[{ label: "Start", href: "/" }, { label: doc.title }]} />
        <h1 className="mt-6 text-5xl md:text-6xl">{doc.title}</h1>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft" data-legal-intro>
          {doc.intro}
        </p>
        {doc.draft && (
          <div role="note" className="mt-6 flex items-start gap-3 rounded-2xl border border-sand bg-cream p-5 text-sm text-ink-soft">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
            <p>Diese Bedingungen werden derzeit überarbeitet. Bei Fragen erreichen Sie uns jederzeit telefonisch oder per E-Mail.</p>
          </div>
        )}
        <div className="mt-12 space-y-10" data-legal-body>
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-28 border-t border-sand pt-8">
              <h2 className="font-serif text-[1.75rem] leading-tight md:text-3xl">{s.heading}</h2>
              <div className="mt-4 space-y-3 leading-relaxed text-ink-soft">
                {renderBody(s.body)}
              </div>
            </section>
          ))}
        </div>
        {doc.updated && <p className="mt-12 text-sm text-muted">Stand: {doc.updated}</p>}
      </div>
    </div>
  );
}

function renderBody(lines: string[]) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    out.push(
      <ul key={`l${out.length}`} className="list-disc space-y-1 pl-5">
        {list.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith("• ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    out.push(<p key={`p${out.length}`}>{line}</p>);
  }
  flush();
  return out;
}
