# Zur Krone Leidersbach – Location-, Hotel- & Buchungsplattform

Website für Landhotel / Gasthof **„Zur Krone“**, 63849 Leidersbach, mit
interaktiver Grundstückskarte als zentralem Auswahl-Interface: Bereiche
(Restaurant, Küche, Nebenzimmer, Bühne, Alte Wirtschaft, Wintergarten,
Biergarten, Hotel) einzeln oder kombiniert auswählen, Verfügbarkeit **je
Bereich** live prüfen, gemeinsame freie Zeiten sehen, Preis berechnen und
direkt buchen oder unverbindlich anfragen. Dazu gibt es einen Admin-Bereich für
den Betreiber.

> **Demo-Stand:** Alle Flächen, Kapazitäten, Preise, Verfügbarkeiten, Medien
> und Rechtstexte sind Platzhalter bzw. klar gekennzeichnete Demo-Daten.
> Unbekannte Fakten sind `null` und werden als „Angabe folgt“ / „Preis folgt“
> angezeigt, niemals als 0.

---

## Inhalt

1. [Schnellstart](#schnellstart)
2. [Tech-Stack](#tech-stack)
3. [Umgebungsvariablen](#umgebungsvariablen)
4. [Datenbank, Migrationen & Seed](#datenbank-migrationen--seed)
5. [Tests](#tests)
6. [Entwicklung, Build & Deployment](#entwicklung-build--deployment)
7. [Seiten & Funktionen](#seiten--funktionen)
8. [Medien austauschen](#medien-austauschen) · [Scroll-Rundgang](#scroll-rundgang-eröffnungs-film)
9. [Grundriss / Karte bearbeiten](#grundriss--karte-bearbeiten)
10. [Preise bearbeiten](#preise-bearbeiten)
11. [Verfügbarkeit](#verfügbarkeit)
12. [Admin](#admin)
13. [Zahlung einrichten](#zahlung-einrichten)
14. [E-Mail](#e-mail)
15. [Checkliste vor dem Produktionsstart](#checkliste-vor-dem-produktionsstart)

Weitere Dokumente: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/ADMIN.md](docs/ADMIN.md) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) · [docs/ZAHLUNG.md](docs/ZAHLUNG.md) · [docs/MEDIA.md](docs/MEDIA.md) · [docs/FILM.md](docs/FILM.md)

---

## Schnellstart

Voraussetzung ist Node.js ≥ 20.9 (empfohlen 22 LTS). Eine Datenbank-Installation
ist **nicht** nötig.

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

Ohne `DATABASE_URL` startet automatisch eine eingebettete PostgreSQL-Datenbank
(PGlite, `./.data/pglite`), die migriert und mit Demo-Daten befüllt wird.
Die Online-Vorschau (Vercel + Neon) ist Schritt für Schritt in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) beschrieben.

**Demo ausprobieren:** Auf der Startseite zur Karte scrollen, Restaurant, Bühne
und Wintergarten anklicken und „Datum auswählen“ öffnen. Der Samstag in gut zwei
Wochen ist im Demo-Szenario belegt; dort erscheint „2 von 3 Bereichen
verfügbar – Wintergarten ist in diesem Zeitraum nicht verfügbar“.

## Tech-Stack

| Bereich | Wahl | Grund |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (strict) | SSR/SEO, Route Handler als API, ein Deployment |
| Styling | **Tailwind CSS v4** (Design-Tokens in `src/app/globals.css`) | schnell, konsistent, keine Laufzeitkosten |
| Datenbank | **PostgreSQL** + **Drizzle ORM** | Exclusion-Constraint gegen Doppelbuchungen, SQL-Migrationen |
| Lokale DB | **PGlite** (Postgres als WASM) | Zero-Setup-Entwicklung, Tests mit echtem SQL |
| Validierung | **Zod** | identische Schemas für Server und Client |
| Client-State | **zustand** (sessionStorage) | Auswahl bleibt über Seitenwechsel erhalten |
| Zeit | `@date-fns/tz` | korrekte Europe/Berlin-Umrechnung (Sommer-/Winterzeit) |
| Auth | `jose` (signierte Session), scrypt | keine Fremdanbieter nötig |
| Tests | **Vitest** (Unit + Integration), **Playwright** (E2E) | |
| Icons/Fonts | lucide-react; Cormorant Garamond + Source Sans 3 (selbst gehostet) | DSGVO-freundlich |

## Umgebungsvariablen

Siehe [`.env.example`](.env.example). Die wichtigsten Variablen:

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindung. Leer → eingebettete PGlite-DB |
| `AUTH_SECRET` | Secret für Admin-Sessions (≥ 32 Zeichen, in Produktion Pflicht) |
| `NEXT_PUBLIC_SITE_URL` | öffentliche URL (Sitemap, OpenGraph, Zahlungs-Redirects, E-Mail-Links) |
| `DEMO_MODE` | `true`: Demo-Verfügbarkeiten/-Preise, simulierte Zahlung, E-Mails nur als Vorschau |
| `PAYMENT_PROVIDER` | `demo` \| `stripe` \| `none` (nur Anfragen) – Anbieterwahl und Einrichtung in [docs/ZAHLUNG.md](docs/ZAHLUNG.md) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe (vorbereitet) |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_OPERATOR_TO` | E-Mail (`preview` oder `resend`) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Admin-Zugang beim ersten Seed |
| `CRON_SECRET` | Schutz für `/api/cron/release-holds` |
| `AUTO_MIGRATE` | Migration + Seed beim ersten DB-Zugriff (Standard `true`) |

Es werden keine echten Secrets im Repository gespeichert.

## Datenbank, Migrationen & Seed

```bash
npm run db:migrate     # Migrationen aus ./drizzle anwenden
npm run db:seed        # Basisdaten (+ Demo-Daten bei DEMO_MODE=true), idempotent
npm run db:reset       # PGlite löschen bzw. (Postgres, mit --force) neu aufsetzen
npm run db:generate    # nach Schemaänderung (src/server/db/schema.ts) neue Migration erzeugen
npm run admin:create -- --email name@domain.de --password '…'
```

- **Basis-Seed:** alle Bereiche mit Name, Code, Farbe, Slug und
  Beschreibungs-Platzhaltern. Fläche, Kapazität, Preise und Regeln sind `null`.
  Zusatzleistungen haben keinen Preis und gelten als nicht bestätigt.
- **Demo-Seed** (nur mit `DEMO_MODE`): als `is_demo` markierte Beispielpreise,
  Kombi-Rabatte, Übergabezeiten und Verfügbarkeitsblöcke relativ zum
  heutigen Datum (`src/content/demo-scenario.ts`), z. B. der am Samstag in gut
  zwei Wochen ganztägig belegte Wintergarten.
- Die Migration `0001_availability_exclusion.sql` legt den Exclusion-Constraint
  an, der Doppelbuchungen auf Datenbankebene unmöglich macht (braucht die
  Erweiterung `btree_gist`).

## Tests

```bash
npm run typecheck
npm run lint
npm test                 # Vitest: Unit + Integration (eingebettete DB, keine Installation nötig)
npm run test:e2e         # Playwright: baut die App und testet die Kernstrecke im Browser
```

Die Tests decken unter anderem ab:
- Schnittmengenlogik Restaurant 10–22 / Bühne 12–23 / Wintergarten 15–21 →
  15:00–21:00
- Blockierter Bereich → `bookingAllowed = false`, `blockedSpaces` enthält
  `winter-garden`; nur freie Räume → `bookingAllowed = true`
- Puffer, Holds, Sommer- und Winterzeit, Mitternachtsbuchungen
- Preise, Kombinationspreise, Mindestdauer, Saison- und Wochenendregeln,
  unbekannte Preise
- Gesamte Location (`includedInFullVenue`)
- Buchung mit genau drei BookingItems, parallele Buchungen (genau eine
  gewinnt) und der DB-Constraint
- Statusmaschine, Validierung, Buchungsnummer
- E2E: Mehrfachauswahl per Maus und Tastatur, Kartenstatus, „2 von 3“,
  Gesamte Location, komplette Buchung bis zur Bestätigung, Anfrage, Mobile

## Entwicklung, Build & Deployment

```bash
npm run dev      # Entwicklung (Turbopack)
npm run build    # Produktions-Build (erzeugt vorher das Media-Manifest)
npm start        # Produktionsserver
```

Deployment auf Vercel + Neon oder auf jede Node-Umgebung:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Vorschau-Link ohne Server:** `npm run demo:browser` baut die komplette Website
als statische Vorschau. Die Datenbank läuft dabei als WASM im Browser, Kalender
und Buchung funktionieren. Die Vorschau lässt sich als Link teilen,
Details stehen in [tools/browser-demo/README.md](tools/browser-demo/README.md).

## Seiten & Funktionen

| Route | Inhalt |
|---|---|
| `/` | **Scroll-Rundgang durch alle Räume** → **interaktiver Grundriss + Konfigurator**, Positionierung, Bereiche, Ausstattung, Hotel, Galerie, Buchungsschritte, FAQ, Kontakt |
| `/bereiche` | Übersicht aller Bereiche |
| `/bereiche/restaurant` · `kueche` · `nebenzimmer` · `buehne` · `alte-wirtschaft` · `wintergarten` · `biergarten` · `hotel` | Detailseiten mit Galerie, Video, Fakten, Mini-Karte, Verfügbarkeitskalender, Auswahl |
| `/buchen?spaces=restaurant,stage,winter-garden` | Buchungs-Wizard in 9 Schritten; die Auswahl ist per URL teilbar und wird serverseitig validiert |
| `/buchung/[Nummer]?token=…` | Bestätigung / Buchungsansicht (.ics-Export, Drucken/PDF) |
| `/galerie`, `/kontakt`, `/faq` | Galerie mit Lightbox, Kontaktformular (Spam-Schutz), FAQ |
| `/impressum`, `/datenschutz`, `/agb`, `/mietbedingungen`, `/hausordnung` | Platzhalter mit Hinweis **LEGAL REVIEW REQUIRED** |
| `/admin` | Admin (siehe unten) |

**API:** `GET /api/spaces`, `GET /api/spaces/:id`,
`GET /api/availability?spaces=…&from=…&to=…`, `POST /api/availability/check`,
`POST /api/pricing/calculate`, `POST /api/bookings`, `GET /api/bookings/:nummer?token=`,
`POST /api/inquiries`, `POST /api/payments/session`, `POST /api/payments/webhook`,
`POST /api/contact`, `GET /api/handover`, `GET /api/extras`.
Admin: `POST /api/admin/availability-blocks`, `PATCH /api/admin/bookings/:id`,
`PATCH /api/admin/spaces/:id` usw.

## Medien austauschen

Alle Medien liegen in `public/media/<bereich>/` (`restaurant`, `kitchen`,
`side-room`, `stage`, `old-tavern`, `winter-garden`, `beer-garden`, `hotel`,
dazu `property`, `hero`, `floorplan`, `brand`). Jeder Ordner enthält eine
README mit Dateinamen und Formaten:

```
public/media/restaurant/hero.webp
public/media/restaurant/gallery-01.webp … gallery-NN.webp
public/media/restaurant/tour.mp4  +  poster.webp
public/media/hero/krone-property-tour.mp4 (+ .webm) + poster.webp
```

Neue Dateien ablegen und den Dev-Server bzw. den Build neu starten; das
Media-Manifest wird dabei automatisch erzeugt. **Echte Dateien haben immer
Vorrang.** Solange keine vorhanden sind, werden die generierten
Demo-Illustrationen aus `public/media/_demo/` angezeigt, sichtbar als
„Beispielbild“ bzw. „Testfilm“ markiert. Fehlt beides, erscheint ein neutraler
Platzhalter; leere Videoflächen gibt es nicht. Die Demo-Medien lassen sich
mit `npm run media:demo` neu erzeugen.

## Scroll-Rundgang (Eröffnungs-„Film“)

Die Startseite beginnt mit einem scrollgesteuerten Rundgang: Beim Scrollen
fliegt die Kamera über das Grundstück, taucht nacheinander in jeden Bereich ein
(Restaurant → Bühne → Nebenzimmer → Alte Wirtschaft → Küche → Wintergarten →
Biergarten → Hotel) und endet wieder in der Vogelperspektive. Direkt danach
folgt der interaktive Grundriss. Jeder Raum hat im Rundgang „Details ansehen“
und „Auswählen“.

- Konfiguration: `src/config/tour.ts`. Dort stehen Reihenfolge,
  Kamerapositionen, Scrolllänge pro Kapitel (`scrollPerChapterVh`) und Texte.
- **Storyboard-Modus** (Standard): eigene Grundstücksgrafik plus die Bilder
  jedes Bereichs (`hero` und `gallery-01`, echte Fotos haben Vorrang vor den
  Demo-Illustrationen).
- **Video-Modus** (echter Imagefilm): `public/media/hero/krone-property-tour.mp4`
  ablegen, in `tour.ts` `video.enabled = true`, `video.duration` und je Kapitel
  `videoTime` (Sekunden) setzen. Der Film wird dann per Scroll „gescrubbt“,
  die Kapitel-Einblendungen bleiben erhalten. Für flüssiges Scrubben kurze
  Keyframe-Abstände verwenden (siehe `public/media/hero/README.md`).
- Bei `prefers-reduced-motion` und ohne JavaScript erscheint stattdessen ein
  statischer Hero.

## Grundriss / Karte bearbeiten

- **Interaktive Polygone:** `src/config/floorplan.ts` (viewBox 1536 × 1024,
  gleiches Raster wie die Vogelperspektive des Eigentümers). Jeder Bereich hat
  `polygon: [[x, y], …]` und `labelPosition`. **Einen Punkt verschieben:** die
  Zahlen im jeweiligen `[x, y]`-Paar ändern und speichern; der Dev-Server lädt
  sofort neu. Die Anleitung steht auch im Kopf der Datei.
- **Visueller Editor:** `/admin/karte`. Punkte ziehen, hinzufügen und löschen,
  Label verschieben, speichern (als Override in der DB) und „Als Code
  exportieren“ für `floorplan.ts`.
- **Grundstücksgrafik (Base Layer):** `src/config/site-plan.ts` (Dächer, Bäume,
  Wege, Parkplätze, Straßen) wird als eigenes SVG unter `/map/base.svg`
  gerendert. Für ein lizenziertes Drohnen-Orthofoto trägt man es in
  `src/config/map.ts` ein.
- Die Darstellung ist **schematisch** (`isSchematic: true`,
  `isSurveyAccurate: false`). Der Hotelbereich ist absichtlich noch nicht
  eingezeichnet.
- Ebenen (EG/OG/Außen) sind vorbereitet (`mapLevels`).

## Preise bearbeiten

Admin → **Preise & Extras** oder **Bereiche**:
- Grundpreis und Preismodell je Bereich (Stunde, Tag, Pauschale, auf Anfrage),
  Kaution, Endreinigung, Mindest- und Maximaldauer
- Preisregeln mit Priorität für Wochentage/Wochenende, Saisonzeiträume und
  Mindestdauer
- Kombinationsregeln (Bundles): Rabatt in %, Betrag oder Paket-Festpreis,
  exakte oder enthaltene Kombination, eigener Buchungsmodus je Kombination
  (z. B. „Gesamte Location“ nur auf Anfrage)
- Zusatzleistungen mit Preis, Modell, Menge und „wird tatsächlich angeboten“
- Zahlungsrichtlinie (keine / voll / Anzahlung in %, Kaution separat) unter
  Einstellungen

Die gesamte Berechnung liegt in `src/domain/pricing.ts`. Der Server ist die
maßgebliche Quelle, der Browser zeigt nur an.

## Verfügbarkeit

- Buchbare Zeiten: Admin → Einstellungen (Standard) bzw. pro Bereich.
  Aktuell sind das **Platzhalter**.
- Sperrzeiten, z. B. Wartung: Admin → Sperrzeiten. Sie gelten sofort auch im
  Kundenfrontend.
- Puffer (Auf- und Abbau), Vorlaufzeiten sowie Mindest- und Maximaldauer
  lassen sich je Bereich einstellen.
- Die Engine steht in `src/domain/availability.ts`, Details in
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Admin

`/admin`. Zugang über `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` oder
`npm run admin:create`. Bereiche: Übersicht, Buchungen (Neu, Anfrage,
Reserviert, Bestätigt, Bezahlt, Storniert, Abgeschlossen), Ressourcen-Kalender
(Bereiche als Zeilen), Sperrzeiten, Bereiche, Preise & Extras, Übergabezeiten,
Karten-Editor, E-Mail-Vorschau, Einstellungen. Mehr dazu in
[docs/ADMIN.md](docs/ADMIN.md).

## Zahlung einrichten

1. `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   setzen und `DEMO_MODE=false`.
2. In Stripe einen Webhook auf `/api/payments/webhook` anlegen (Events
   `checkout.session.completed`, `checkout.session.expired`).
3. Zahlungsrichtlinie im Admin festlegen.

Ablauf: Die Buchung wird angelegt und die Bereiche werden 20 Minuten gehalten.
Danach folgt der Stripe Checkout. Erst der verifizierte Webhook bestätigt die
Buchung; eine fehlgeschlagene Zahlung bestätigt nie. Die Kaution ist als
eigene Zahlungsart vorgesehen und wird nicht als Umsatz behandelt. Mit
`PAYMENT_PROVIDER=none` sind nur Anfragen möglich.

## E-Mail

Vorlagen: Anfrage erhalten, Buchung erhalten/bestätigt, Zahlung erhalten,
Termin geändert, Stornierung, Übergabe-Erinnerung, Betreiber-Benachrichtigung.
Standard ist `EMAIL_PROVIDER=preview`: Es wird nichts versendet, alle Mails
sind im Admin unter **E-Mails** einsehbar. Für den echten Versand
`EMAIL_PROVIDER=resend` mit `EMAIL_API_KEY` und `EMAIL_FROM` setzen. Im
Demo-Modus wird nie versendet.

## Checkliste vor dem Produktionsstart

- [ ] echte Grundrissgeometrie verifizieren (Polygone, Hotel-Abgrenzung)
- [ ] echte Raumflächen
- [ ] echte Kapazitäten (sitzend/stehend)
- [ ] echte Preise, Kautionen, Reinigung, Mindestdauern, Kombinationspreise
- [ ] echte Medien (Fotos, Imagefilm, Raumvideos, Logo)
- [ ] echte Verfügbarkeiten, buchbare Zeiten, Übergabezeiten, Puffer
- [ ] Betreiber-Kontaktdaten (Adresse/Straße, Telefon, E-Mail) in `src/config/site.ts`
- [ ] Rechtstexte (Impressum, Datenschutz, AGB, Mietbedingungen, Hausordnung, Storno, Kaution)
- [ ] Zahlungsanbieter (Stripe-Konto, Webhook, Zahlungsrichtlinie)
- [ ] E-Mail-Provider (Absenderdomain, SPF/DKIM)
- [ ] Datenschutzprüfung (Verarbeitungsverzeichnis, AV-Verträge Hosting/DB/Zahlung/E-Mail)
- [ ] Domain + `NEXT_PUBLIC_SITE_URL`
- [ ] Analytics-Entscheidung (derzeit keine; Event-Schicht in `src/lib/analytics.ts`)
- [ ] Zusatzleistungen bestätigen (nur bestätigte werden in Produktion angezeigt)
- [ ] Zulässige Veranstaltungsarten, Abhängigkeiten (`requires`/`incompatibleWith`)
- [ ] `DEMO_MODE=false`, Demo-Daten entfernen (`npm run db:reset -- --force` ohne Demo)
- [ ] Straßennamen auf der Karte (Hauptstraße/Kolpingstraße, aus dem Referenzbild übernommen) verifizieren
