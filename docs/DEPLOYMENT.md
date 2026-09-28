# Deployment & Vorschau

## A) Schnell ansehen – lokal (ca. 3 Minuten)

Voraussetzung: [Node.js 22](https://nodejs.org) (LTS).

```bash
git clone https://github.com/leonschuessler-del/Krone-website.git
cd Krone-website
git checkout claude/clever-lovelace-vysb7y   # solange noch nicht in main gemergt
npm install
cp .env.example .env.local                   # optional – Demo läuft auch ohne
npm run dev
```

Dann <http://localhost:3000> öffnen.

- Es wird **keine Datenbank-Installation** benötigt: Ohne `DATABASE_URL` startet
  eine eingebettete PostgreSQL-Datenbank (PGlite) unter `./.data/pglite`,
  inklusive Demo-Daten.
- Admin: <http://localhost:3000/admin>. Zugangsdaten: `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` aus `.env.local` – oder, falls nicht gesetzt, das beim
  ersten Start in der Konsole ausgegebene Zufallspasswort.
- Demo-Daten zurücksetzen: Server stoppen, `npm run db:reset`, neu starten.

## B) Online-Vorschau mit Vercel + Neon (kostenlos, ca. 10 Minuten)

1. Auf <https://vercel.com> mit GitHub anmelden → **Add New… → Project** →
   Repository `Krone-website` importieren (Framework wird automatisch als
   Next.js erkannt, Build-Einstellungen unverändert lassen).
   Unter **Git → Production Branch** ggf. `claude/clever-lovelace-vysb7y`
   wählen, solange der Stand nicht in `main` ist.
2. Im Projekt **Storage → Create Database → Neon (Postgres)** wählen und mit dem
   Projekt verbinden. Dadurch wird `DATABASE_URL` automatisch gesetzt.
3. Unter **Settings → Environment Variables** ergänzen:

   | Variable | Wert |
   |---|---|
   | `DEMO_MODE` | `true` |
   | `PAYMENT_PROVIDER` | `demo` |
   | `EMAIL_PROVIDER` | `preview` |
   | `AUTH_SECRET` | langer Zufallswert (mind. 32 Zeichen) |
   | `SEED_ADMIN_EMAIL` | Ihre Admin-E-Mail |
   | `SEED_ADMIN_PASSWORD` | sicheres Passwort (mind. 10 Zeichen) |
   | `NEXT_PUBLIC_SITE_URL` | die Vercel-URL, z. B. `https://krone-website.vercel.app` |

4. **Redeploy** auslösen. Beim ersten Seitenaufruf werden die Tabellen
   automatisch angelegt (`AUTO_MIGRATE`, Standard `true`) und Basis- sowie
   Demo-Daten eingespielt. Fertig – die URL kann geteilt werden.

> Ohne Datenbank läuft die Seite auf Vercel ebenfalls (flüchtige In-Memory-
> Datenbank), Buchungen können dann aber zwischen Serverinstanzen verloren
> gehen. Für eine brauchbare Vorschau daher Schritt 2 durchführen.

## C) Produktion

- PostgreSQL ≥ 14 mit Erweiterung `btree_gist` (bei Neon, Supabase, RDS,
  Azure, Google Cloud SQL verfügbar).
- `DEMO_MODE=false`, echte Werte für Zahlung/E-Mail (siehe README → ENV).
- Empfohlen: `AUTO_MIGRATE=false` und Migrationen im Deployment ausführen:
  `npm run db:migrate` (vor `npm run build`/Start).
- Cron (z. B. Vercel Cron, alle 10 Minuten): `GET /api/cron/release-holds` mit
  Header `Authorization: Bearer $CRON_SECRET` – gibt abgelaufene
  Zahlungs-Reservierungen frei (die Verfügbarkeitsprüfung ignoriert
  abgelaufene Holds ohnehin sofort).
- Stripe-Webhook auf `https://<domain>/api/payments/webhook` einrichten
  (Event `checkout.session.completed`, `checkout.session.expired`).
- Mehrere Serverinstanzen: Rate-Limiter (`src/server/rate-limit.ts`) auf einen
  geteilten Speicher (z. B. Redis/Upstash) umstellen.

Andere Plattformen (eigener Server, Docker, Render, Fly.io): `npm ci && npm run
build && npm start` mit `DATABASE_URL`. Es gibt keine Vercel-spezifischen
Abhängigkeiten.
