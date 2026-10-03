# Online-Zahlung der Zimmerbuchung

Stand 10/2026. Die Zimmerbuchung (`/hotel/buchen`) kennt drei Wege, die der Gast an der Kasse wählt
(`src/content/rates.ts` → `paymentChoices`):

| Wahl | Was passiert | Braucht Anbieter |
|---|---|---|
| **Im Hotel bezahlen** | Reservierung wie bisher, Zahlung bei Abreise (bar, EC, Kreditkarte) | nein |
| **Jetzt online bezahlen** | Gesamtpreis sofort per Karte, Apple Pay, Google Pay oder SEPA | ja |
| **Karte zur Absicherung hinterlegen** | Keine Abbuchung. Die Karte sichert die Reservierung; belastet wird nur bei Nichtanreise oder Stornierung in den letzten 2 Tagen (80 % / 100 % laut Stornobedingungen) | ja |

Ohne Anbieter (`PAYMENT_PROVIDER=none`) zeigt die Kasse nur „Im Hotel bezahlen“. Im Demo-Modus
(`PAYMENT_PROVIDER=demo`, Standard) wird die Zahlung sofort simuliert – es bewegt sich kein Geld.

## Empfehlung: Stripe

Verglichen wurden Stripe, Mollie, Adyen, SumUp und PayPal (Quellen unten). Für ein einzelnes Haus mit
Zimmerpreisen um 70–100 € pro Nacht ist **Stripe** die beste Wahl:

| Kriterium | Stripe | Mollie | Adyen | PayPal (allein) |
|---|---|---|---|---|
| Grundgebühr | keine | keine | ab 100 €/Monat Mindestumsatz | keine |
| EU-Karten | 1,5 % + 0,25 € | 1,65 % + 0,19 € | Interchange++ (nur ab großem Volumen günstiger) | 2,49 % + 0,35 € |
| SEPA-Lastschrift | 0,35 € fix | 0,28 € fix | – | – |
| Apple Pay / Google Pay | ja, ohne Aufpreis | ja | ja | nein |
| Karte hinterlegen, später belasten (No-Show) | ja (SetupIntent, off-session) | eingeschränkt | ja | nein |
| Teilerstattung (80 %-Storno) | ja, per Klick | ja | ja | ja |
| Auszahlung | auf das Geschäftskonto, Standard 2–7 Tage, einstellbar | 1–3 Tage | nach Vereinbarung | PayPal-Konto |

Beispiel: ein Doppelzimmer für 3 Nächte (300 €) kostet bei Stripe 4,75 € Gebühr, bei Mollie 5,14 €, bei
PayPal 7,82 €. Bei Zahlung im Hotel entfallen diese Gebühren – deshalb bleibt „Im Hotel bezahlen“ die
erste Option und die Online-Zahlung ein Angebot für Gäste, die es möchten.

Mollie ist die gleichwertige EU-Alternative (Sitz Amsterdam, deutscher Support, PayPal und Klarna direkt
dabei). Wer das lieber möchte: der Adapter (`src/server/services/hotel-payment-service.ts`) spricht die
Zahlungsseite über eine schmale Schnittstelle an; Mollie ließe sich dort mit etwa einem Tag Aufwand
ergänzen. Adyen lohnt erst ab Kettengröße, SumUp ist für das Kartenterminal vor Ort interessant
(1,39 % Girocard/Karte), nicht für die Website.

**Zu beachten:** Stripe behält bei einer Erstattung die Gebühr ein. Bei kostenloser Stornierung einer
online bezahlten Buchung trägt das Haus also die 1,5 % + 0,25 €. Darum empfiehlt sich für die
Flexible Rate die **Kartenhinterlegung** statt Vorkasse: kein Geld fließt, bis es fällig ist, und bei
Nichtanreise kann die hinterlegte Karte belastet werden.

## Einrichtung (Stripe)

1. Konto auf stripe.com anlegen (Firma Landhotel Gasthof Zur Krone, IBAN des Geschäftskontos für die
   Auszahlungen, Steuernummer). Prüfung durch Stripe dauert meist 1–2 Werktage.
2. Im Stripe-Dashboard → Entwickler → API-Schlüssel: den **geheimen Schlüssel** kopieren.
3. Webhook anlegen: Endpunkt `https://<domain>/api/payments/webhook`, Ereignisse
   `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_failed`.
   Das **Signaturgeheimnis** kopieren.
4. Umgebungsvariablen beim Hosting setzen (niemals ins Repository):
   ```
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   NEXT_PUBLIC_SITE_URL=https://<domain>
   ```
5. Testlauf mit den Testschlüsseln (`sk_test_…`) und Testkarte 4242 4242 4242 4242, dann live schalten.

Technik: Die Website ruft Stripe Checkout direkt über die REST-Schnittstelle auf (kein SDK), Zahlung
`mode=payment`, Kartenhinterlegung `mode=setup`. Bezahlt/hinterlegt gilt erst, wenn der **signierte
Webhook** eintrifft (`hotel_payments` + `payment_status` an der Reservierung: `paid` / `guaranteed`).
Der Gast kommt nach Stripe auf `/hotel/buchen?nr=…&zahlung=ok#bestaetigt` zurück; die Reservierung
bleibt auch bei abgebrochener Zahlung bestehen (dann Zahlung im Hotel).

Im Admin → Hotel steht zu jeder Reservierung der Zahlungsstatus. Noch offen (nächster Schritt): Knöpfe
im Admin für „Erstatten“ und „No-Show belasten“ (Stripe `refunds` bzw. `payment_intents` mit der
hinterlegten Karte) – die Daten dafür (`intent_ref`) werden bereits gespeichert.

## DIRS21 und Zahlung

Wird später die DIRS21-Buchungsmaschine angebunden, läuft die Kartenzahlung dort über die
DIRS21-Partner (Datatrans-Gateway, Payone, Concardis u. a.) mit eigenem Acquirer-Vertrag. Die
Website-Buchung kann parallel bei Stripe bleiben; Verfügbarkeit und Reservierungen gleicht der
DIRS21-Adapter ab (`docs/INTEGRATIONS.md`).

## Quellen (abgerufen 10/2026)

- Stripe Preise: https://stripe.com/pricing/local-payment-methods · https://transaktionsgebuehren.com/blog/stripe-gebuehren-deutschland-2025
- Mollie Preise: https://toolspick.de/zahlungen/mollie-test/ · https://blog.finexer.com/mollie-pricing/
- Vergleich Stripe/Mollie/Adyen/SumUp: https://www.mollie.com/growth/card-payment-fees-merchants · https://hoteltechinsight.com/2026/04/19/hotel-payment-processor-comparison-2026/ · https://www.expertmarket.com/uk/merchant-accounts/sumup-vs-stripe
- DIRS21 Payment: https://www.dirs21.de/wp-content/uploads/2023/08/PM_DIRS21_Payment-im-Direktvertrieb-2023_19-05-23_DIN-Next.pdf
