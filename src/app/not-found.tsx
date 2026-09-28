import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="panel-dark grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Link href="/" aria-label="Zur Startseite">
          <Logo tone="light" />
        </Link>
        <p className="mt-12 font-serif text-7xl text-gold-light">404</p>
        <h1 className="mt-4 text-4xl text-paper">Diese Seite gibt es leider nicht.</h1>
        <p className="mt-3 text-paper/70">Vielleicht finden Sie über die Startseite, was Sie suchen.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-gold px-6 py-3 font-semibold text-anthracite">
            Zur Startseite
          </Link>
          <Link href="/bereiche" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-paper">
            Bereiche ansehen
          </Link>
        </div>
      </div>
    </main>
  );
}
