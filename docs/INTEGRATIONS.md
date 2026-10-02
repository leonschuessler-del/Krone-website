# Anbindungen (E-Mail, Apple-Kalender, DIRS21)

Alle Anbindungen werden nur über Umgebungsvariablen eingerichtet. Ohne Variablen läuft alles im Vorschaumodus: E-Mails landen im Verwaltungsbereich unter „E-Mails“, der Kalender wird nicht beschrieben, Hotelzimmer werden intern geführt.

## Ablauf einer Anfrage

1. Gast wählt Räume (Restaurant ist immer dabei), Termin, Zusatzleistungen und sendet die Anfrage.
2. Sofort: Bestätigungsmail an den Gast („Anfrage eingegangen“) und Benachrichtigung an `EMAIL_OPERATOR_TO` (sonst `info@krone-landhotel.de`).
3. Verwaltung → Buchungen → Anfrage öffnen:
   - **Annehmen** → Status „bestätigt“, Räume im Kalender belegt, Mail „Anfrage angenommen“ (wir melden uns telefonisch wegen Schlüsselübergabe und Kaution), Termin wird in den Apple-Kalender geschrieben.
   - **Ablehnen** → Grund wählen (Termin vergeben, Mietdauer, Gästezahl, Art der Veranstaltung, Raumkombination, geschlossen, Sonstiges) + optionale persönliche Zeile → Mail „Anfrage abgelehnt“ mit passendem Text.
   - **Stornieren** (später) → Belegung aufgehoben, Kalendertermin entfernt, Stornomail.

## E-Mail

| Variable | Bedeutung |
|---|---|
| `EMAIL_PROVIDER` | `preview` (Standard) oder `resend` |
| `EMAIL_API_KEY` | API-Schlüssel von Resend |
| `EMAIL_FROM` | Absender, z. B. `Zur Krone <buchung@krone-landhotel.de>` (Domain bei Resend verifizieren) |
| `EMAIL_OPERATOR_TO` | Postfach für neue Anfragen (Standard: Kontakt-E-Mail der Website) |

## Apple-Kalender (iCloud)

Zwei Wege, beide ohne zusätzliche Software:

**A) Schreiben in den Kalender (CalDAV, empfohlen)**

1. Auf appleid.apple.com → „Anmeldung und Sicherheit“ → **App-spezifisches Passwort** erzeugen.
2. In der Kalender-App einen eigenen Kalender „Krone Buchungen“ anlegen (iCloud).
3. Die Kalender-URL ermitteln: In der Kalender-App Rechtsklick auf den Kalender → „Informationen“ zeigt keine URL; am einfachsten über `curl`:
   ```
   curl -s -u 'apple-id@example.com:app-passwort' -X PROPFIND -H 'Depth: 0' \
     -H 'Content-Type: text/xml' --data '<propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>' \
     https://caldav.icloud.com/
   ```
   Die Antwort enthält den Principal-Pfad (`/<dsid>/principal/`). Mit `Depth: 1` auf `https://caldav.icloud.com/<dsid>/calendars/` erscheinen alle Kalender mit ihren URLs (die Server-Nummer `pXX-caldav.icloud.com` aus der Weiterleitung übernehmen).
4. Variablen setzen:
   ```
   CALDAV_URL=https://pXX-caldav.icloud.com/<dsid>/calendars/<kalender-id>/
   CALDAV_USERNAME=apple-id@example.com
   CALDAV_PASSWORD=<app-spezifisches Passwort>
   ```
   Bestätigte Buchungen erscheinen danach als Termine; Stornierungen entfernen sie wieder. Ein Fehler beim Kalender blockiert nie eine Buchung (wird im Protokoll der Buchung vermerkt).

**B) Kalender-Abo (nur lesen, immer verfügbar)**

`CALENDAR_FEED_KEY=<langes zufälliges Geheimnis>` setzen, dann in der Kalender-App „Ablage → Neues Kalenderabonnement“ mit
`https://<domain>/api/calendar/krone.ics?key=<geheimnis>`. Apple aktualisiert das Abo automatisch (Intervall einstellbar). Enthält alle bestätigten Veranstaltungen und Hotelzimmer-Reservierungen.

## Hotelzimmer / DIRS21

Zimmer werden einzeln gebucht (8 Doppelzimmer, 2 Einzelzimmer, 1 Apartment; Preise in `src/content/hotel.ts`). Die Website führt Verfügbarkeit und Reservierungen selbst (`hotel_reservations`). Für den Channel-Manager **DIRS21** gibt es den Adapter `src/server/integrations/dirs21.ts` mit drei Funktionen – Verfügbarkeit, Reservierung anlegen, stornieren – hinter einer schmalen Schnittstelle (`HotelChannel`).

| Variable | Bedeutung |
|---|---|
| `DIRS21_ENDPOINT` | Basis-URL der DIRS21-Schnittstelle (vom DIRS21-Support) |
| `DIRS21_HOTEL_ID` | Objektnummer bei DIRS21 |
| `DIRS21_API_KEY` | Zugangsschlüssel |
| `DIRS21_ROOM_MAP` | Zuordnung Zimmertyp → DIRS21-Kategorie, z. B. `double=DZ,double-single=DZE,single=EZ,apartment=APP` |

Ohne diese Variablen arbeitet die Website intern („local“). Die genauen Request-Formate von DIRS21 werden beim Freischalten des Zugangs gegen die DIRS21-Dokumentation vervollständigt; die Stellen sind im Adapter markiert.
