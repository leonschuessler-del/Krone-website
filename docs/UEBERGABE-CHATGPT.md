# Übergabe: Eventlocation in krone-landhotel.de einbinden

**Stand:** 27.10.2026 · **Für:** den Betreiber und für ChatGPT (oder jede andere Hilfe), die die
Eventlocation-Seite an die bestehende Website [krone-landhotel.de](https://www.krone-landhotel.de) anbindet.

Fertiger Prompt zum Kopieren: **[CHATGPT-PROMPT.md](CHATGPT-PROMPT.md)**.

---

## 1. Was ist das?

Eine eigenständige Website **nur für die Eventlocation** „Zur Krone“ in Leidersbach.

| Teil | Was er tut |
|---|---|
| Startseite `/` | Räume, Bildfilm, Ausstattung, Galerie, FAQ, Kontakt |
| Raumplaner (`/#karte`) | Luftbild-Karte: Räume antippen, einzeln oder kombiniert auswählen |
| Kalender | Zeigt live, welche Räume an einem Datum frei sind |
| Anfrage (`/buchen`) | Mehrstufiges Formular, sendet eine **unverbindliche Anfrage** |
| Admin (`/admin`) | Anfragen annehmen/ablehnen, Sperrzeiten, Räume, E-Mails ansehen |

Technik: **Next.js 16** (React, TypeScript) mit **PostgreSQL**-Datenbank. Die App braucht einen
**Server** – sie ist keine Sammlung einfacher HTML-Dateien.

**Was sie NICHT ist:**

- Hotel, Zimmerbuchung und Restaurant bleiben auf der **bestehenden Website**. Diese bleibt, wie sie ist.
  Von der Eventlocation führt der Link „Hotel & Restaurant“ zurück auf die Hauptseite.
- **Keine Preise öffentlich.** Nirgends stehen Preise, Summen, Rabatte oder Anzahlungen – alles „auf Anfrage“.
  Räume, Ausstattung und Zusatzleistungen sind sichtbar, nur ohne Preis.
- **Keine Online-Zahlung.** Gäste senden nur Anfragen; der Betreiber antwortet persönlich.

---

## 2. Empfohlener Weg: eigene Subdomain + Knopf verlinken

```
krone-landhotel.de  (bestehende Seite, bleibt unverändert)
   └─ Knopf „Eventlocation“  ──Link──►  https://event.krone-landhotel.de  (diese App)
                                              └─ „Hotel & Restaurant“ ──► zurück zur Hauptseite
```

**Warum nicht einfach als Unterseite `/eventlocation` hineinkopieren?** Die App braucht einen laufenden Server:
Kalender, Anfragen, E-Mail-Versand und Admin-Bereich greifen auf die Datenbank zu. Baukästen (Jimdo, Wix,
IONOS-Baukasten) und normales WordPress-Hosting können keine Next.js-App ausführen. Kopierter HTML-Code
würde ohne Server nicht funktionieren.

### Schritt für Schritt (Beispiel Vercel – kostenlos für den Start)

1. **Datenbank anlegen** – z. B. [Neon](https://neon.tech) oder [Supabase](https://supabase.com)
   (PostgreSQL ≥ 14). Die Verbindungsadresse (`postgres://…`) notieren. Bei Vercel geht das auch direkt:
   Projekt → **Storage → Create Database → Neon**; dann wird `DATABASE_URL` automatisch gesetzt.
2. **App bei Vercel anlegen** – auf [vercel.com](https://vercel.com) mit GitHub anmelden →
   **Add New… → Project** → Repository `leonschuessler-del/Krone-website` importieren.
   Framework wird als Next.js erkannt; Build-Einstellungen unverändert lassen.
   Unter **Settings → Git → Production Branch** `claude/clever-lovelace-vysb7y` wählen, solange der Stand
   nicht in `main` übernommen ist.
3. **Umgebungsvariablen eintragen** (Abschnitt 4) → **Redeploy**.
4. **Testen** unter der Vercel-Adresse (z. B. `https://krone-website.vercel.app`): Startseite, Raumplaner,
   Testanfrage, Admin-Login.
5. **Subdomain verbinden** – Vercel: **Settings → Domains → Add** → `event.krone-landhotel.de`
   (oder `eventlocation.krone-landhotel.de`). Vercel zeigt den nötigen DNS-Eintrag an.
6. **DNS beim Domain-Anbieter** (dort, wo krone-landhotel.de registriert ist, z. B. IONOS, Strato,
   All-Inkl., united-domains): neuen Eintrag anlegen

   | Typ | Name / Host | Wert / Ziel |
   |---|---|---|
   | `CNAME` | `event` | der Wert, den Vercel anzeigt (meist `cname.vercel-dns.com`) |

   Die Hauptdomain und ihre bestehenden Einträge (A-Record, `www`, MX für E-Mail) **nicht anfassen**.
   Wirksam nach Minuten bis wenigen Stunden; das SSL-Zertifikat erstellt Vercel selbst.
7. **`NEXT_PUBLIC_SITE_URL`** auf `https://event.krone-landhotel.de` setzen → **Redeploy**
   (`NEXT_PUBLIC_…`-Werte werden beim Bauen eingebrannt, Änderungen wirken erst nach neuem Deployment).
8. **Knopf auf der bestehenden Website umstellen** – den vorhandenen Knopf/Menüpunkt „Eventlocation“
   auf `https://event.krone-landhotel.de` verlinken. Sonst nichts an der bestehenden Website ändern.
   Je Plattform siehe [CHATGPT-PROMPT.md](CHATGPT-PROMPT.md) (WordPress, Jimdo, IONOS, Wix).

**Alternativen zu Vercel:** jedes Node-Hosting mit Node.js ≥ 20.9 (empfohlen 22 LTS), z. B. Render,
Fly.io, Railway, eigener V-Server/Docker. Befehle: `npm ci && npm run build && npm start`
(Port über `PORT`). Ein Dockerfile liegt nicht bei; ein Standard-Node-22-Image genügt. Nicht geeignet:
reines Webspace-/PHP-Hosting ohne Node.js.

---

## 3. Alternativen

### B) Einbetten per iframe (Seite auf der bestehenden Website)

Die App läuft trotzdem eigenständig (Schritte 1–7 oben). Auf der bestehenden Website wird eine Seite
„Eventlocation“ angelegt, die die App anzeigt:

```html
<div style="position:relative;width:100%;height:100vh;min-height:720px;">
  <iframe
    src="https://event.krone-landhotel.de/"
    title="Eventlocation Zur Krone"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;"
    loading="lazy"
    allow="fullscreen"
    referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>
```

**Vorher nötig (Code-Änderung):** Die App verbietet derzeit das Einbetten in fremde Seiten
(`X-Frame-Options: SAMEORIGIN` in `next.config.ts`). Für Variante B muss dieser Header ersetzt werden durch

```ts
{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://krone-landhotel.de https://www.krone-landhotel.de" }
```

(nur die tatsächliche Adresse der Hauptseite eintragen, keine Platzhalter wie `*`).

**Nachteile:** zwei Scrollbalken („Scroll im Scroll“), feste Höhe statt natürlicher Seitenlänge, der
Bildfilm und der Raumplaner wirken im Rahmen kleiner, Google ordnet die Inhalte der Subdomain zu (nicht
der Hauptseite), auf dem Handy oft unhandlich. Datenschutz: Die eingebettete Seite ist eine eigene Website –
die Datenschutzerklärung der Hauptseite muss sie erwähnen. **Empfehlung: Variante A (Link) statt iframe.**

### C) Reverse-Proxy unter `krone-landhotel.de/eventlocation`

Nur möglich, wenn das Hosting der Hauptseite Anfragen an einen anderen Server weiterleiten kann (z. B.
eigener Server mit nginx/Apache, Cloudflare Workers/Rules). Baukästen können das nicht.
Zusätzlich müsste die App mit `basePath: "/eventlocation"` in `next.config.ts` gebaut und alle festen
Pfade (Links, Weiterleitungen, Sitemap, Cookies des Admin-Bereichs) geprüft werden. **Spürbarer Aufwand,
nur bei echtem SEO-Bedarf sinnvoll.**

---

## 4. Einrichtung der App

### Umgebungsvariablen

Vorlage: [`.env.example`](../.env.example). **Echte Werte nur im Hosting eintragen, nie ins Repository.**

| Variable | Wert für den Livebetrieb | Zweck |
|---|---|---|
| `DATABASE_URL` | `postgres://…` von Neon/Supabase | Datenbank. Leer = flüchtige Test-DB, Anfragen gehen verloren |
| `AUTH_SECRET` | langer Zufallswert, ≥ 32 Zeichen | Admin-Login. Ohne ihn ist der Login in Produktion gesperrt |
| `NEXT_PUBLIC_SITE_URL` | `https://event.krone-landhotel.de` | Sitemap, Vorschaubilder, Links in E-Mails |
| `NEXT_PUBLIC_MAIN_SITE_URL` | `https://www.krone-landhotel.de` | Rücklink „Hotel & Restaurant“ zur Hauptseite (Standard ist dieser Wert) |
| `DEMO_MODE` | `false` | Demo-Belegungen und Demo-Daten aus |
| `PAYMENT_PROVIDER` | `none` | keine Zahlung, nur Anfragen |
| `EMAIL_PROVIDER` | `resend` | echter Versand (`preview` = nur im Admin sichtbar, nichts geht raus) |
| `EMAIL_API_KEY` | Schlüssel von [Resend](https://resend.com) | E-Mail-Versand |
| `EMAIL_FROM` | z. B. `Zur Krone <buchung@krone-landhotel.de>` | Absender; Domain bei Resend per DNS verifizieren |
| `EMAIL_OPERATOR_TO` | Postfach des Betriebs | erhält jede neue Anfrage (Standard: `info@krone-landhotel.de`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin-E-Mail / Passwort ≥ 10 Zeichen | legt beim ersten Start den Admin an |
| `AUTO_MIGRATE` | `true` (einfach) oder `false` + Migration im Deployment | Tabellen automatisch anlegen |
| `CRON_SECRET` | optional | nur für Zahlungs-Reservierungen; bei `PAYMENT_PROVIDER=none` nicht nötig |
| `CALDAV_URL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD` | optional | bestätigte Anfragen in den Apple-Kalender schreiben ([INTEGRATIONS.md](INTEGRATIONS.md)) |
| `CALENDAR_FEED_KEY` | optional | Kalender-Abo `…/api/calendar/krone.ics?key=…` |

Nicht nötig für die Eventlocation: `STRIPE_*`, `DIRS21_*` (gehören zur archivierten Hotel-/Zahlungsfunktion).

AUTH_SECRET erzeugen: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

### Datenbank

- PostgreSQL ≥ 14 mit Erweiterung **`btree_gist`** (bei Neon und Supabase vorhanden). Sie verhindert
  Doppelbelegungen direkt in der Datenbank.
- Migrationen liegen in `drizzle/`. Mit `AUTO_MIGRATE=true` werden sie beim ersten Seitenaufruf
  ausgeführt, inklusive Basisdaten (Räume). Alternativ manuell: `npm run db:migrate` und `npm run db:seed`
  (mit gesetzter `DATABASE_URL`).
- Bei `DEMO_MODE=false` werden **keine** Demo-Belegungen eingespielt.

### Admin-Zugang

- Automatisch über `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` beim ersten Start, **oder**
- lokal mit der Produktions-`DATABASE_URL`: `npm run admin:create` (fragt E-Mail und Passwort ab).
- Login: `https://event.krone-landhotel.de/admin`. Danach `SEED_ADMIN_PASSWORD` im Hosting wieder entfernen.
- Im Admin Raumdaten (Kapazitäten, Texte) und Sperrzeiten pflegen. Preise im Admin sind nur intern.

---

## 5. Checkliste vor dem Livegang

- [ ] `DEMO_MODE=false`, `PAYMENT_PROVIDER=none`, `EMAIL_PROVIDER=resend` gesetzt, neu deployt.
- [ ] **Impressum, Datenschutz, AGB, Mietbedingungen, Hausordnung** (`/impressum`, `/datenschutz` …):
      Texte sind Entwürfe – mit den Texten der Hauptseite abgleichen bzw. rechtlich prüfen lassen.
      Die Datenschutzerklärung muss Hosting (z. B. Vercel), Datenbank (z. B. Neon), E-Mail-Versand (Resend)
      und das Anfrageformular nennen. Alternativ im Footer auf Impressum/Datenschutz der Hauptseite verweisen
      (nur wenn diese die Eventlocation abdecken).
- [ ] **Cookie-Hinweis:** Die App setzt öffentlich keine Tracking-Cookies, lädt keine Fremd-Skripte, Schriften
      sind selbst gehostet. Nur der Admin-Bereich nutzt ein technisch notwendiges Login-Cookie. Ein
      Cookie-Banner ist daher voraussichtlich nicht nötig – bei Einbau von Analyse-Tools neu prüfen.
- [ ] **Kartendienste:** Der Raumplaner ist ein eigenes Luftbild ohne Google Maps. Der Link „Route planen“
      auf `/kontakt` öffnet Google Maps erst nach Klick (kein Einbetten). Nichts zu tun, außer es soll eine
      eingebettete Karte dazukommen.
- [ ] **E-Mail testen:** Absender-Domain bei Resend verifiziert; Testanfrage senden → Gast-Bestätigung und
      Betreiber-Mail kommen an (auch Spam-Ordner prüfen).
- [ ] **Testanfrage** im Admin annehmen und ablehnen, Mails prüfen; danach Testdaten löschen.
- [ ] Auf dem Handy prüfen: Startseite, Raumplaner, Anfrage, Rücklink zur Hauptseite.
- [ ] Knopf „Eventlocation“ auf der Hauptseite führt auf die neue Adresse; alte Links auf `/eventlocation`
      landen automatisch auf der Startseite.
- [ ] Nirgends ein Preis sichtbar (Stichprobe: Startseite, Raumdetails, Raumplaner, Anfrageformular).

---

## 6. Was liegt wo? (nur zur Info)

| Pfad | Inhalt |
|---|---|
| `src/app/(site)/` | öffentliche Seiten (`page.tsx` = Startseite Eventlocation) |
| `src/app/admin/` | Admin-Bereich |
| `src/app/api/` | Server-Schnittstellen (Verfügbarkeit, Anfragen, Kontakt …) |
| `src/config/site.ts` | Name, Adresse, Kontaktdaten, Texte der Startseite |
| `src/config/scope.ts` | zentrale Schalter (siehe unten) |
| `drizzle/` | Datenbank-Migrationen |
| `public/media/` | Bilder und Filme |
| `docs/DEPLOYMENT.md` | ausführliche Deployment-Hinweise |
| `ARCHIV.md` | was archiviert wurde und wie man es zurückholt |

**Archiv:** Hotel, Zimmerbuchung, Angebote und Sehenswürdigkeiten sind **nicht gelöscht**, sondern
unter `src/app/(site)/_archiv/` abgelegt (nicht erreichbar) und im Git-Tag `archiv/vollversion-2026-10`
gesichert. Details: [ARCHIV.md](../ARCHIV.md).

**Preise wieder einschalten** (nur zur Info, derzeit nicht gewünscht): in `src/config/scope.ts`
`showPrices: true` setzen und neu deployen. `requestOnly: false` würde verbindliche Buchungen mit
Zahlung wieder erlauben (dann zusätzlich [ZAHLUNG.md](ZAHLUNG.md) beachten).
