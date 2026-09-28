# Verwaltung (Admin) – Zur Krone

Interner Bereich unter **`/admin`** für Buchungen, Belegung, Sperrzeiten, Bereiche, Preise, Übergabezeiten, Karte, E-Mails und Einstellungen. Die Oberfläche ist für Desktop optimiert, funktioniert aber auch auf Tablet und Smartphone (Menü oben rechts, Tabellen und Kalender horizontal scrollbar).

Alle Zeiten werden in **Ortszeit (Europe/Berlin)** angezeigt und eingegeben – inklusive Sommer-/Winterzeitumstellung. Beträge werden in **Euro** eingegeben und intern in Cent gespeichert. **Leere Felder bedeuten „unbekannt“** (Website: „Preis folgt“ / „Angabe folgt“) – niemals 0.

---

## 1. Einrichtung & Anmeldung

### Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `AUTH_SECRET` | Geheimer Schlüssel für die Anmelde-Sitzungen (mind. 32 Zeichen). Erzeugen: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. **Pflicht in Produktion** – ohne Secret ist die Anmeldung dort deaktiviert. In der Entwicklung wird ersatzweise ein zufälliges Secret pro Serverstart verwendet (mit Warnung in der Konsole; Sitzungen enden beim Neustart). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Optional: legt beim ersten Befüllen der Datenbank automatisch einen Admin an. Ohne Passwort wird ein zufälliges Passwort erzeugt und **einmalig** in der Server-Konsole ausgegeben. |
| `DEMO_MODE` | `true`: Demo-Daten, simulierte Zahlungen, E-Mails nur als Vorschau. Im Admin erscheint der Hinweis „DEMO-Modus aktiv“. |

Es gibt **keine fest eingebauten Passwörter**. Passwörter werden ausschließlich als scrypt-Hash gespeichert.

### Admin-Zugang anlegen oder Passwort zurücksetzen

```bash
npm run admin:create                                   # fragt E-Mail und Passwort ab (Eingabe verdeckt)
npm run admin:create -- --email chef@zur-krone.de      # fragt nur das Passwort ab
npm run admin:create -- --email chef@zur-krone.de --password '…' --name "Vorname Name" --role owner
```

- Existiert die E-Mail-Adresse bereits, wird nur das Passwort (und ggf. Name/Rolle) aktualisiert.
- Passwort: mindestens 10 Zeichen. Die interaktive Abfrage ist vorzuziehen – als Argument übergebene Passwörter können in der Shell-Historie landen.

### Anmelden

`/admin/login` → E-Mail-Adresse und Passwort. Bei falschen Daten erscheint bewusst nur die allgemeine Meldung „E-Mail-Adresse oder Passwort ist nicht korrekt.“ Nach 8 Fehlversuchen innerhalb von 15 Minuten (pro IP) wird die Anmeldung vorübergehend gesperrt. Eine Sitzung ist **8 Stunden** gültig; danach ist eine erneute Anmeldung nötig. **Abmelden** unten in der Seitenleiste.

### Datenbank-Befehle

| Befehl | Wirkung |
| --- | --- |
| `npm run db:migrate` | Wendet die SQL-Migrationen aus `./drizzle` an (PostgreSQL über `DATABASE_URL`, sonst die eingebettete Datenbank `./.data/pglite`). |
| `npm run db:seed` | Grunddaten (Bereiche, Extras ohne Preise, Einstellungen) und – bei `DEMO_MODE=true` – gekennzeichnete Demo-Daten. Mehrfach ausführbar (legt nur Fehlendes an). |
| `npm run db:reset` | **Löscht alle Daten** und baut die Datenbank neu auf (Migration + Seed). Eingebettete DB: Ordner `./.data/pglite` wird gelöscht. PostgreSQL: nur mit `-- --force` (Schema `public` wird gelöscht und neu angelegt). |

> Die eingebettete Datenbank (PGlite) darf nur von **einem** Prozess geöffnet werden. Die Befehle brechen deshalb ab, wenn auf Port 3000 ein Dev-Server läuft – bitte vorher stoppen (oder bewusst mit `--force` erzwingen).

---

## 2. Die Seiten im Überblick

### Übersicht (`/admin`)
Kennzahlen: **Neu/ungesehen**, **Anfragen**, **Reserviert** (inkl. ausstehender Zahlungen), **Bestätigt**, **Termine der nächsten 14 Tage**. Darunter die nächsten Termine, die neuesten unbearbeiteten Eingänge, kommende Sperrzeiten und offene Kontaktanfragen. Im Demo-Modus erscheint ein Hinweisbanner.

### Buchungen (`/admin/buchungen`)
- **Filter:** Neu (noch nicht als gesehen markiert, nicht storniert) · Anfrage · Reserviert (ausstehend/reserviert) · Bestätigt · Bezahlt (bezahlt/Anzahlung bezahlt) · Storniert · Abgeschlossen · Alle – jeweils mit Anzahl.
- **Suche** nach Buchungs-/Anfragenummer, Name, Firma oder E-Mail.
- Tabelle mit Nummer, Kunde, Bereichen (Farbpunkte), Termin, Summe („auf Anfrage“, wenn unbekannt), Status und Zahlungsstatus.

**Detailseite** (`/admin/buchungen/[id]`): Veranstaltung (Zeitraum, Art, Personen, Übergabe/Rückgabe, Bemerkungen), Bereiche, Preis-Snapshot zum Buchungszeitpunkt, Zusatzleistungen, Zahlungen, Belegung im Kalender, E-Mails zu dieser Buchung, Kundendaten und Verlauf (Audit-Log).

Rechts im Feld **„Bearbeiten“**:
- **Status ändern** – es werden nur zulässige Wechsel angeboten:

  | von | nach |
  | --- | --- |
  | Anfrage | Reserviert, Bestätigt, Storniert |
  | Neu / ausstehend | Reserviert, Bestätigt, Storniert |
  | Reserviert | Bestätigt, Storniert |
  | Bestätigt | Abgeschlossen, Storniert |
  | Storniert, Abgeschlossen | – (endgültig) |

  Wird eine **Anfrage reserviert oder bestätigt**, belegt das System die gebuchten Bereiche im Kalender (inkl. Auf-/Abbaupuffer und Übergabe/Rückgabe). Ist der Zeitraum inzwischen anderweitig vergeben, wird der Wechsel mit „**Zeitraum inzwischen belegt: …**“ abgelehnt – nichts wird halb geändert. **Stornieren** gibt die Bereiche sofort wieder frei.
  Optional wird der Kunde per E-Mail informiert (Bestätigung, Stornierung bzw. Änderungsmitteilung).
- **Zahlungsstatus (manuell)**, z. B. nach Eingang einer Überweisung – es wird dabei keine Zahlung ausgelöst.
- **Interne Notiz** (nur für die Verwaltung sichtbar).
- **Als gesehen markieren** / wieder als neu markieren.

### Kalender (`/admin/kalender`)
Ressourcen-Kalender: **Zeilen = Bereiche, Spalten = Tage** (Woche oder 2 Wochen; Navigation zurück/heute/weiter, Sprung zu Datum). Balken sind zeitgenau positioniert:
- **Gebucht**: volle Farbe des Bereichs
- **Reserviert / Zahlung ausstehend**: gestreift
- **Gesperrt** / **Wartung**: grau schraffiert (Wartung dunkler, mit Werkzeug-Symbol)
- **Offene Anfrage**: gestrichelter Rahmen in einer eigenen Spur (blockiert nicht)
- **Demo-Daten**: gestrichelte weiße Umrandung; rote Linie = jetzt

Mauszeiger auf einem Balken zeigt Grund, Buchungsnummer und Zeiten. Klick öffnet die Buchung bzw. die Sperrzeit (mit „Sperre aufheben“).

### Sperrzeiten (`/admin/sperrzeiten`)
Formular: einen oder mehrere Bereiche, Datum (optional „Mehrere Tage“ mit Enddatum), ganztägig oder mit Uhrzeiten (Ende vor Beginn = bis zum Folgetag), Art (**Gesperrt** oder **Wartung**) und Grund. Pro Bereich wird eine Sperre angelegt – alles oder nichts: Überschneidet sich die Sperre mit einer bestehenden Belegung, wird sie abgelehnt und der betroffene Bereich genannt. Gesperrte Zeiten sind **sofort** auf der Website und im Buchungsprozess nicht mehr verfügbar. Die Liste zeigt aktuelle und kommende Sperren; „Aufheben“ deaktiviert eine Sperre (sie bleibt zur Nachverfolgung gespeichert). Belegungen durch Buchungen werden über die jeweilige Buchung verwaltet.

### Bereiche (`/admin/bereiche`)
Übersicht aller Räume/Flächen mit Fläche, Kapazität, Preis, Buchungsart, Status und Anzahl offener Angaben. In der Bearbeitung:
Name, Farbe, Kurz-/Langbeschreibung, Fläche, Kapazität (sitzend/stehend), Preismodell, Grundpreis, Endreinigung, Kaution, Buchungsart, Mindest-/Höchstdauer, Auf-/Abbaupuffer, Vorlaufzeit, Buchungshorizont, Schalter (aktiv, buchbar, einzeln mietbar, Teil der Gesamtlocation), Ausstattung, Nutzungsmöglichkeiten und Regeln.
**„Noch zu bestätigen“**: Liste der Angaben, die der Betreiber noch bestätigen muss (auch als „offen“-Kennzeichen an den Feldern). Mit × als bestätigt markieren, über die Auswahl wieder hinzufügen – wirksam nach „Änderungen speichern“.

### Preise & Extras (`/admin/preise`)
- **Preisregeln**: abweichende Preise je Bereich nach Wochentag, Zeitraum (gültig ab/bis) und Mindestdauer. Bei mehreren passenden Regeln gilt die höchste Priorität, sonst der Grundpreis.
- **Kombi-Preise**: Rabatt in %, Rabatt in Euro oder Festpreis, wenn bestimmte Bereiche zusammen gebucht werden („genau diese Auswahl“ oder „enthält diese Bereiche“); optional abweichende Buchungsart (z. B. Gesamtlocation nur auf Anfrage).
- **Zusatzleistungen**: Preis und Preismodell, maximale Menge, Kategorie, Sortierung. Im Live-Betrieb erscheinen nur Extras mit **„Wird angeboten“**. Extras, die bereits in Buchungen verwendet wurden, werden beim Löschen deaktiviert statt gelöscht.
Demo-Werte sind mit „Demo“ gekennzeichnet und sollten vor dem Live-Betrieb ersetzt oder gelöscht werden.

### Übergabezeiten (`/admin/uebergabe`)
Feste Zeitpunkte für **Übergabe** (am Veranstaltungstag oder Vortag, vor Beginn) und **Rückgabe** (nach Ende, am selben oder am Folgetag), optional nur an bestimmten Wochentagen. Zeiten lassen sich aktivieren/deaktivieren und löschen. Ohne aktive Zeiten werden Übergabe und Rückgabe individuell abgestimmt.

### Karte (`/admin/karte`) – Karten-Editor
Bereich oben auswählen. Die Fläche wird über der Grundstückskarte (`/map/base.svg`) mit Anfasspunkten angezeigt, die übrigen Bereiche gestrichelt zur Orientierung.

| Aktion | Bedienung |
| --- | --- |
| Punkt verschieben | weißen Punkt anfassen und ziehen |
| Punkt einfügen | auf ein **+** in der Mitte einer Kante klicken (und direkt ziehen) |
| Punkt löschen | Punkt anklicken, dann **Entf**/**Rücktaste** oder „Punkt löschen“ (mindestens 3 Punkte bleiben) |
| Feinjustieren | ausgewählten Punkt mit den Pfeiltasten verschieben (mit **Shift** in 10er-Schritten) |
| ganze Fläche verschieben | in die Fläche klicken und ziehen |
| Beschriftung verschieben | das dunkle Kürzel-Schild ziehen |

- **Speichern** legt die Form als Überschreibung in der Datenbank ab – die Website verwendet sie sofort.
- **Verwerfen** stellt den zuletzt gespeicherten Zustand wieder her.
- **Zurücksetzen** entfernt die Überschreibung; es gilt wieder die Form aus `src/config/floorplan.ts`.
- **Als Code** zeigt den Eintrag im Format von `src/config/floorplan.ts` (`polygon: [[x, y], …]`, `labelPosition: { x, y }`) zum Kopieren – so lässt sich eine im Editor erstellte Form dauerhaft in den Code übernehmen (danach die Überschreibung zurücksetzen).
- Für Bereiche ohne Fläche (z. B. **Hotel**) legt „Fläche anlegen“ ein Rechteck an, das anschließend angepasst wird.

Koordinaten beziehen sich auf das Raster der Karte (1536 × 1024).

### E-Mails (`/admin/emails`)
- **E-Mail-Protokoll**: alle automatisch erzeugten E-Mails (Vorlage, Empfänger, Betreff, Status *Vorschau / Versendet / Fehlgeschlagen*, Datum). Die Detailansicht zeigt die HTML-Fassung **isoliert** (sandboxed iframe, keine Skripte/Links) und die Textfassung. Im Demo- bzw. Vorschau-Modus wird nichts versendet.
- **Kontaktanfragen** aus dem Kontaktformular der Website mit Schaltfläche „Als erledigt markieren“ / „Wieder öffnen“.

### Einstellungen (`/admin/einstellungen`)
- **Buchungszeiten** je Wochentag (mehrere Zeitfenster möglich; Ende ≤ Beginn = bis zum Folgetag, 00:00 als Ende = Mitternacht; „für alle“ überträgt den Montag auf alle Tage), Kennzeichen „Noch zu bestätigen“ und „Demo-Werte“.
- **Zahlung**: keine Online-Zahlung (nur Anfragen), vollständige Zahlung oder Anzahlung in %; Kaution separat oder mit der Online-Zahlung; bei mehreren Bereichen Summe oder höchste Einzelkaution.
- **Vorläufige Reservierungen**: Haltezeit während der Zahlung (Minuten), ob Anfragen Bereiche vorläufig reservieren und wie lange (Stunden).

---

## 3. Sicherheit

- **Sitzung**: signiertes JWT (HS256, `AUTH_SECRET`) im Cookie `krone_admin` – `httpOnly`, `SameSite=Lax`, in Produktion `Secure`, Laufzeit 8 Stunden. Ohne `AUTH_SECRET` ist die Anmeldung in Produktion deaktiviert.
- **Mehrfache Prüfung**: `src/proxy.ts` leitet `/admin/**` ohne gültige Sitzung auf die Anmeldung um und beantwortet `/api/admin/**` mit 401 (Ausnahmen: Login/Logout). Zusätzlich prüft **jede** Admin-Seite und **jeder** Admin-API-Endpunkt die Sitzung erneut – inklusive Abgleich mit der Tabelle `admin_users` (ein gelöschter Admin verliert sofort den Zugriff).
- **CSRF-Schutz**: SameSite-Cookie plus Prüfung des `Origin`-Headers bei allen ändernden Anfragen.
- **Anmeldung**: Rate-Limit (8 Versuche / 15 Min. pro IP), allgemeine Fehlermeldung, gleiche Antwortzeit für unbekannte E-Mail-Adressen, scrypt-Passwort-Hashes, `lastLoginAt` und Audit-Einträge für erfolgreiche und fehlgeschlagene Anmeldungen.
- **Eingaben** werden serverseitig mit zod validiert; Datenbankzugriffe laufen ausschließlich parametrisiert über Drizzle.
- **Keine sensiblen Daten** in Antworten: Passwort-Hashes, Zugangs-Token-Hashes von Buchungen und Roh-Zahlungsdaten werden nie an die Oberfläche gegeben.
- **Doppelbuchungen** verhindert die Datenbank selbst (Exclusion-Constraint auf `availability_blocks`); Statuswechsel und Sperrzeiten laufen in Transaktionen mit Sperren pro Bereich.
- **Nachvollziehbarkeit**: Statuswechsel, Zahlungsstatus, Notizen, Sperrzeiten, Stammdaten-, Preis- und Einstellungsänderungen werden im `audit_log` mit Benutzer und Zeitpunkt protokolliert.
- **Nicht indexierbar**: alle Admin-Seiten senden `robots: noindex` und den Header `X-Robots-Tag: noindex`.

**Bekannte Grenzen (MVP):** Abmelden löscht das Cookie, ein bereits kopiertes Token bleibt aber bis zum Ablauf (max. 8 h) gültig – zum sofortigen Sperren eines Kontos den Admin löschen oder `AUTH_SECRET` wechseln (beendet alle Sitzungen). Das Rate-Limit gilt pro Serverinstanz (für mehrere Instanzen einen gemeinsamen Speicher wie Redis verwenden). Rollen (`owner`/`staff`) sind angelegt, aber noch nicht unterschiedlich berechtigt.

---

## 4. Technik (für Entwickler)

| Pfad | Inhalt |
| --- | --- |
| `src/app/admin/**` | Seiten (`(auth)/login`, `(panel)/…` mit Seitenleiste) |
| `src/app/api/admin/**` | API: `login`, `logout`, `session`, `bookings[/id]`, `availability-blocks[/id]`, `spaces/[id]`, `pricing-rules[/id]`, `bundle-rules[/id]`, `extras[/id]`, `handover-slots[/id]`, `settings`, `contact-messages/[id]` |
| `src/features/admin/**` | Client-Komponenten (Aktionen, Kalender, Formulare, Karten-Editor) |
| `src/server/auth/session.ts` | JWT signieren/prüfen, Cookie-Optionen |
| `src/server/auth/admin-session.ts` | Sitzungsprüfung für Seiten und API (inkl. Origin-Prüfung) |
| `src/server/services/admin-service.ts` | Buchungen, Statuswechsel, Sperrzeiten, Kalender, Dashboard, Audit |
| `src/server/services/admin-catalog-service.ts` | Bereiche, Preise, Extras, Übergabezeiten, Einstellungen, E-Mails, Kontakt |
| `src/proxy.ts` | Zugriffsschutz vor dem Rendern |
| `scripts/admin-create.ts`, `scripts/db-*.ts` | CLI-Befehle |
| `tests/integration/admin.test.ts` | Tests: Statuswechsel, Sperrzeiten ↔ Verfügbarkeit, Überschneidungen, Sitzungs-Token |

Tests ausführen: `npx vitest run --project integration`.
