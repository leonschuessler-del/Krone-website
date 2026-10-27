# Prompt für ChatGPT

Den Block unten **vollständig kopieren** und in ChatGPT einfügen. Zugangsdaten, Passwörter und API-Schlüssel
**nicht** in den Chat schreiben – die trägt man selbst im Hosting ein.

Hintergrund und Details: [UEBERGABE-CHATGPT.md](UEBERGABE-CHATGPT.md).

---

## Hauptprompt

```text
Du hilfst mir, eine fertige Eventlocation-Website an meine bestehende Hotel-Website anzubinden.
Erkläre jeden Schritt so, dass ich ihn als Laie selbst ausführen kann (wo klicken, was eintragen).
Frag nach, bevor du etwas annimmst.

## Kontext
- Betrieb: Landhotel Gasthof „Zur Krone“, Hauptstraße 106, 63849 Leidersbach.
- Bestehende Website: https://www.krone-landhotel.de (Hotel garni, Zimmer; seit 2026 ohne Restaurant). Sie hat einen Knopf/Menüpunkt
  „Eventlocation“. Die bestehende Website soll ansonsten UNVERÄNDERT bleiben.
- Neue Eventlocation-Website: eigene Next.js-16-App (React, TypeScript, PostgreSQL/Drizzle) mit
  Raumplaner (Luftbild-Karte), Verfügbarkeitskalender, unverbindlichem Anfrageformular und Admin-Bereich.
  Sie braucht einen Node.js-Server (≥ 20.9, empfohlen 22) und eine PostgreSQL-Datenbank (≥ 14, Erweiterung
  btree_gist). Sie ist KEINE statische HTML-Seite und lässt sich nicht in einen Baukasten kopieren.
- Code: https://github.com/leonschuessler-del/Krone-website, Branch: claude/clever-lovelace-vysb7y
  (Anleitung im Repo: docs/UEBERGABE-CHATGPT.md und docs/DEPLOYMENT.md).
- Die Seite zeigt bewusst KEINE Preise (alles „auf Anfrage“) und hat keine Online-Zahlung.

## Ziel
Der Knopf „Eventlocation“ auf krone-landhotel.de soll zur neuen Eventlocation-Website führen.
Empfohlener Weg:
1. App bei Vercel hosten (Repository importieren, Production Branch = claude/clever-lovelace-vysb7y,
   Build-Einstellungen unverändert). Datenbank: Neon über Vercel → Storage, oder Neon/Supabase direkt.
   Alternativen: Render, Railway, Fly.io, eigener Server mit `npm ci && npm run build && npm start`.
2. Subdomain event.krone-landhotel.de in Vercel hinzufügen und beim Domain-Anbieter einen CNAME-Eintrag
   „event“ auf den von Vercel angezeigten Wert setzen. Bestehende DNS-Einträge (Hauptdomain, www, MX)
   nicht verändern.
3. Auf der bestehenden Website NUR den Link des Knopfs „Eventlocation“ auf
   https://event.krone-landhotel.de ändern.
Einbettung per iframe nur, wenn ich das ausdrücklich will – dann vorher im Code in next.config.ts den
Header „X-Frame-Options: SAMEORIGIN“ durch
„Content-Security-Policy: frame-ancestors 'self' https://krone-landhotel.de https://www.krone-landhotel.de“
ersetzen, sonst blockiert der Browser das iframe. Weise mich auf die Nachteile hin (Scroll im Scroll,
Höhe, SEO, Datenschutzerklärung).

## Umgebungsvariablen (im Hosting eintragen, Werte nicht in den Chat)
- DATABASE_URL = PostgreSQL-Verbindung (Neon/Supabase)
- AUTH_SECRET = Zufallswert ≥ 32 Zeichen (Admin-Login)
- NEXT_PUBLIC_SITE_URL = https://event.krone-landhotel.de
- NEXT_PUBLIC_MAIN_SITE_URL = https://www.krone-landhotel.de (Rücklink zur Hauptseite)
- DEMO_MODE = false
- PAYMENT_PROVIDER = none
- EMAIL_PROVIDER = resend, EMAIL_API_KEY, EMAIL_FROM (z. B. Zur Krone <buchung@krone-landhotel.de>),
  EMAIL_OPERATOR_TO (Postfach für neue Anfragen)
- SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (legt beim ersten Start den Admin an; danach Passwort entfernen)
- AUTO_MIGRATE = true (Tabellen werden beim ersten Aufruf angelegt)
- optional: CALDAV_URL, CALDAV_USERNAME, CALDAV_PASSWORD (Apple-Kalender), CALENDAR_FEED_KEY
- nicht nötig: STRIPE_*, DIRS21_*, CRON_SECRET
Nach jeder Änderung an NEXT_PUBLIC_* neu deployen.

## Vorgehen
1. Frag mich zuerst:
   a) Mit welchem System ist krone-landhotel.de gebaut (WordPress, Jimdo, IONOS MyWebsite, Wix,
      Strato, eigener Webdesigner …)? Wenn ich es nicht weiß: wie ich es herausfinde.
   b) Wie ich Zugriff habe (eigenes Login, Agentur/Webdesigner, kein Zugang).
   c) Bei welchem Anbieter die Domain krone-landhotel.de registriert ist und ob ich dort DNS-Einträge
      ändern kann.
   d) Ob ich schon ein Vercel-/GitHub-Konto habe.
2. Dann Schritt für Schritt: Datenbank → Vercel-Projekt → Umgebungsvariablen → Test unter der
   Vercel-Adresse → Subdomain + DNS → NEXT_PUBLIC_SITE_URL anpassen und neu deployen → Knopf umstellen.
3. Zum Schluss die Checkliste aus docs/UEBERGABE-CHATGPT.md Abschnitt 5 mit mir durchgehen
   (Impressum/Datenschutz abstimmen, E-Mail-Empfang testen, Testanfrage, Handy-Test, keine Preise sichtbar).

## Grenzen
- Keine Preise, Beträge, Rabatte oder Zahlungsfunktionen einbauen – weder auf der Hauptseite noch in der App.
- Keine Inhalte, Fakten, Bilder oder Rechtstexte erfinden. Wenn etwas fehlt, frag mich.
- Die bestehende Website außer dem Eventlocation-Knopf (bzw. einer neuen Eventlocation-Seite bei iframe)
  nicht verändern. Keine Designänderungen, keine Plugins entfernen.
- Keine DNS-Einträge löschen oder überschreiben, nur den neuen CNAME hinzufügen.
- Am Code der App nichts ändern, außer ich wähle die iframe-Variante (dann nur den einen Header).
- Frag nie nach Passwörtern oder API-Schlüsseln im Chat.
```

---

## Kurzvarianten: nur den Knopf umstellen

Voraussetzung: Die App läuft bereits unter `https://event.krone-landhotel.de`. Passenden Block an ChatGPT geben
(oder selbst befolgen).

### WordPress

```text
Meine Website krone-landhotel.de läuft mit WordPress. Ich will NUR den Menüpunkt bzw. Knopf
„Eventlocation“ auf https://event.krone-landhotel.de verlinken, sonst nichts ändern, keine Plugins.
Führe mich Schritt für Schritt:
- Menüpunkt: Design → Menüs (bzw. bei Block-Themes: Design → Editor → Navigation) → Eintrag
  „Eventlocation“ → URL ändern; falls er auf eine Seite zeigt, durch einen „Individuellen Link“ ersetzen.
- Knopf auf einer Seite: Seite bearbeiten (Gutenberg/Elementor/Divi …) → Button anklicken → Link ändern
  → Aktualisieren.
- Danach Cache leeren (Caching-Plugin oder Hosting) und im privaten Fenster prüfen.
Frag mich, welchen Editor/Page-Builder ich sehe, bevor du Klickwege nennst.
```

### Jimdo / IONOS MyWebsite / Wix (Baukästen)

```text
Meine Website krone-landhotel.de ist mit [Jimdo | IONOS MyWebsite | Wix] gebaut. Ich will NUR den
Knopf bzw. Navigationspunkt „Eventlocation“ auf https://event.krone-landhotel.de verlinken, sonst
nichts ändern. Führe mich Schritt für Schritt durch den Editor:
- Navigation: Menü/Navigation bearbeiten → Eintrag „Eventlocation“ → als externen Link auf
  https://event.krone-landhotel.de setzen (Seite selbst nicht löschen, nur ausblenden, falls nötig).
- Knopf auf einer Seite: Button anklicken → Link → „Externe URL/Webadresse“ → Adresse eintragen,
  im selben Fenster öffnen.
- Veröffentlichen und im privaten Fenster prüfen.
Hinweis: Baukästen können die App nicht selbst hosten – sie läuft extern (Vercel), hier wird nur verlinkt.
```
