import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { footerNavigation, legalNavigation } from "@/config/navigation";
import { formatAddressLine, siteConfig } from "@/config/site";

export function Footer() {
  const { contact, social } = siteConfig;
  const socialLinks = social.filter((s) => s.url);
  return (
    <footer className="panel-dark relative mt-0 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-6 max-w-xs font-serif text-2xl leading-snug text-paper/90">
            Ein Ort. <span className="italic text-gold-light">Viele Möglichkeiten.</span>
          </p>
          <p className="mt-3 text-sm tracking-[0.18em] text-paper/55 uppercase">{siteConfig.tagline}</p>
        </div>

        <div>
          <h2 className="eyebrow !text-gold-light">Navigation</h2>
          <ul className="mt-5 space-y-2.5 text-[0.95rem]">
            {footerNavigation.map((item) => (
              <li key={item.href}>
                <Link className="text-paper/75 transition-colors hover:text-paper" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="eyebrow !text-gold-light">Kontakt</h2>
          <address className="mt-5 space-y-2 text-[0.95rem] not-italic text-paper/75">
            <p className="text-paper">
              {siteConfig.name}
              <br />
              {formatAddressLine()}
            </p>
            {siteConfig.address.street === null && <p className="text-xs text-paper/45">Straße folgt</p>}
            <p>{contact.phone ?? <span className="text-paper/45">Telefon: Angabe folgt</span>}</p>
            <p>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="hover:text-paper">
                  {contact.email}
                </a>
              ) : (
                <span className="text-paper/45">E-Mail: Angabe folgt</span>
              )}
            </p>
            <p>
              <Link href="/kontakt" className="text-gold-light underline-offset-4 hover:underline">
                Kontaktformular
              </Link>
            </p>
          </address>
        </div>

        <div>
          <h2 className="eyebrow !text-gold-light">Rechtliches</h2>
          <ul className="mt-5 space-y-2.5 text-[0.95rem]">
            {legalNavigation.map((item) => (
              <li key={item.href}>
                <Link className="text-paper/75 transition-colors hover:text-paper" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {socialLinks.length > 0 && (
            <ul className="mt-6 flex gap-4 text-sm">
              {socialLinks.map((s) => (
                <li key={s.id}>
                  <a href={s.url!} rel="noopener noreferrer" target="_blank" className="text-paper/75 hover:text-paper">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-paper/45 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name} · {siteConfig.locality}
          </p>
          <p>Kartendarstellung schematisch · Angaben ohne Gewähr, solange nicht bestätigt</p>
        </div>
      </div>
    </footer>
  );
}
