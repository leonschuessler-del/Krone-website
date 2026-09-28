# Architektur

## Schichten

| Schicht | Ort | Inhalt |
|---|---|---|
| Konfiguration & Inhalte | `src/config/*`, `src/content/*` | Seitentexte, Navigation, Karten-Geometrie, Raum-Stammdaten (Seed), FAQ, Rechtstext-Platzhalter, Zusatzleistungen, Bedingungen |
| Domäne (rein, ohne I/O) | `src/domain/*` | Zeit (Europe/Berlin), Intervalle, **Availability Engine**, **Pricing Engine**, Auswahlregeln, Buchungs-Statusmaschine, Buchungsnummern |
| Server-Services | `src/server/services/*` | `spaceService`, `availabilityService`, `pricingService`, `bookingService`, `paymentService`, `emailService`, Übergabe, Holds, Einstellungen |
| Datenbank | `src/server/db/*`, `drizzle/*` | Drizzle-Schema, Migrationen, Seed |
| API | `src/app/api/*` | Route Handler mit Zod-Validierung und Rate Limiting |
| UI | `src/app/*`, `src/features/*`, `src/components/*` | Seiten, Karte, Kalender, Wizard, Admin |
| Client-State | `src/store/booking-store.ts` | Auswahl & Checkout (zustand, sessionStorage) |

UI-Komponenten enthalten **keine Geschäftslogik**: Preise und Verfügbarkeit
kommen ausschließlich vom Server, der dieselben Domänenfunktionen nutzt.

## Datenmodell (Auszug)

- `spaces` – Bereiche (unbekannte Fakten = `NULL`, nie 0), `type`
  (indoor/outdoor/hotel/service), `level`, `bookingMode` (inquiry/instant/both),
  `includedInFullVenue`, `requires[]`, `incompatibleWith[]`, Puffer, Min/Max-Dauer,
  Vorlaufzeiten, optionale Polygon-Overrides aus dem Map-Editor.
- `bookings` + `booking_items` (ein Item je Bereich) + `booking_extras`
- `availability_blocks` – **pro Bereich** und Zeitraum; Typen `reserved`,
  `booked`, `blocked`, `maintenance`; `expires_at` für Holds.
- `pricing_rules`, `bundle_pricing_rules`, `extras`, `handover_slots`,
  `payments`, `settings`, `customers`, `admin_users`, `email_log`,
  `contact_messages`, `audit_log`
- Hotel (vorbereitet, getrennte Logik): `room_types`, `hotel_rooms`,
  `hotel_reservations`

## Verfügbarkeit

- Jeder Bereich hat eigene buchbare Zeiten (Standard aus den Einstellungen,
  pro Bereich überschreibbar) und eigene Blöcke.
- Freie Zeit eines Bereichs = buchbare Fenster − (Blöcke, erweitert um die
  Puffer des Bereichs).
- **Mehrere Bereiche:** `getCommonAvailability()` bildet die **Schnittmenge**
  der freien Intervalle. `checkSelection()` prüft jeden Bereich einzeln und
  liefert `bookingAllowed`, `availableSpaceIds`, `blockedSpaces` – ein belegter
  Bereich blockiert nie die anderen.
- Alternativen: freie Fenster am selben Tag und nächste Tage mit gleicher
  Uhrzeit (`findAlternativeSlots`).
- Zeitzone: alle Zeitpunkte UTC, alle Eingaben als Wandzeit in
  `Europe/Berlin` (inkl. Sommer-/Winterzeit, 23/25-Stunden-Tage).
- Caching: Verfügbarkeitsantworten werden nicht gecacht (`no-store`); die
  finale Prüfung erfolgt immer live in der Buchungstransaktion.

## Schutz vor Doppelbuchungen (Race Conditions)

1. Der Server validiert alles neu (Bereiche, Zeitraum, Regeln, Preise,
   Übergabe-Slots).
2. In **einer Transaktion**:
   - `pg_advisory_xact_lock` pro Bereich (sortiert → keine Deadlocks)
     serialisiert parallele Checkouts derselben Bereiche,
   - abgelaufene Holds werden freigegeben,
   - Verfügbarkeit wird live erneut geprüft,
   - Kunde, Buchung, Items, Extras, Blöcke und Zahlung werden angelegt.
3. **Letzte Garantie in der Datenbank:** `EXCLUDE USING gist (space_id WITH =,
   tstzrange(start_at, end_at) WITH &&) WHERE (active)` auf
   `availability_blocks`. Überschneiden sich zwei aktive Blöcke desselben
   Bereichs, schlägt das INSERT mit SQLSTATE `23P01` fehl und die gesamte
   Transaktion wird zurückgerollt.
4. Direktbuchungen reservieren die Bereiche zunächst (`reserved`, mit Ablauf).
   Erst eine **erfolgreiche Zahlung** (Demo-Bestätigung bzw. verifizierter
   Stripe-Webhook) setzt Buchung → `confirmed` und Blöcke → `booked`.
   Eine fehlgeschlagene Zahlung bestätigt nie.

Getestet in `tests/integration/booking-flow.test.ts` (parallele Buchungen,
Constraint direkt).

## Preise

`calculateQuote()` in `src/domain/pricing.ts`:
Regel-Auswahl je Bereich (Priorität; Wochentage, Saison, Mindestdauer) →
Stunden/Tag/Pauschale → Mindestmietdauer → Bundle-Regel (Rabatt %, Betrag oder
Paket-Festpreis; auch eigener Buchungsmodus je Kombination) → Extras →
Endreinigung → Kaution (separat, keine Einnahme) → „Heute fällig“ gemäß
Zahlungsrichtlinie (voll / Anzahlung / keine).
Fehlt irgendein Preis → `null` → UI zeigt „Preis folgt“ bzw. „auf Anfrage“
und die Buchung ist nur als Anfrage möglich.

## Status

- Buchung: `draft → inquiry | pending → reserved → confirmed → completed`,
  jederzeit `cancelled` (siehe `BOOKING_TRANSITIONS`).
- Zahlung (separat): `unpaid, pending, deposit_required, deposit_paid, paid,
  partially_refunded, refunded, failed`.
- Verfügbarkeit (separat): `available, partially_available, reserved, booked,
  blocked, closed`.

## Sicherheit

- Zod-Validierung aller Eingaben, `strict()`-Schemas (unbekannte Felder werden
  abgelehnt), Größenlimit für Request-Bodies.
- Rate Limiting für Verfügbarkeit, Preise, Buchung, Kontakt, Login, Zahlung.
- Öffentliche Buchungsansicht nur mit zufälligem Zugriffstoken (gespeichert als
  SHA-256-Hash); Buchungsnummern zufällig, nicht fortlaufend.
- Stripe-Webhook-Signaturprüfung (HMAC-SHA256, Toleranzfenster).
- Admin: scrypt-Passwort-Hashes, signierte httpOnly-Session, `proxy.ts` +
  Prüfung in jedem Admin-Handler.
- Security-Header (nosniff, Referrer-Policy, Frame-Options, Permissions-Policy).
- Keine Tracker, keine externen Skripte, Fonts selbst gehostet.

## Mehrsprachigkeit (später)

Texte liegen zentral in `src/config` und `src/content`. Für weitere Sprachen
können diese Module pro Locale dupliziert und über ein `[locale]`-Segment
geladen werden; die Domänenlogik ist sprachunabhängig.
