# Vermarktungsstrategie „Zur Krone“ – Haus voll, Hotel voll

Stand 10/2026. Ziel: Eventlocation so oft wie möglich vermietet, Hotelzimmer ausgelastet,
bei praktisch null Budget. Provisionen für Vermittlung sind in Ordnung, wöchentliche
Social-Media-Produktion nicht. Reihenfolge nach Wirkung pro Stunde Aufwand.

## 1. Die Website selbst arbeiten lassen (0 €)
- **Angebote aus dem Kalender** laufen automatisch (freie Wochenenden −15 %, Wochentage −10 %,
  7 Tage für 6, Dauermiete-Hinweis). Nichts muss gepflegt werden; der Preis gilt nur, solange der
  Termin frei ist.
- **Direktbucher-Vorteile** statt Rabatt im Hotel: Bestpreis, Storno bis 2 Tage, Parken, persönliche
  Bestätigung. Das hält Gäste von Portalen (15–18 % Provision) fern.
- **Google Business Profile** (0 €): Öffnungszeiten „Hotel garni“, Kategorie „Veranstaltungsort“ +
  „Hotel“, alle Fotos, Buchungslink auf /hotel#buchen, wöchentlich ein Beitrag aus den Kalender-
  Angeboten (Text kopieren, 2 Minuten). Wichtigster kostenloser Kanal für „Hochzeitslocation
  Aschaffenburg“, „Raum mieten Leidersbach“, „Hotel Leidersbach“.
- **Suchbegriffe**, die die Seiten schon tragen: Eventlocation Aschaffenburg/Spessart, Hochzeit
  Leidersbach, Trauerkaffee Leidersbach, Vereinsheim mieten, Gewerbeküche mieten Aschaffenburg,
  Hotel Mespelbrunn Umgebung, Monteurzimmer Aschaffenburg.

## 2. Eventlocation-Portale (kostenlos oder Provision)
| Portal | Modell | Warum |
|---|---|---|
| fiylo.de | kostenloser Eintrag | großes Locationportal, Anfragen direkt |
| eventano.com | Basiseintrag, Gebühr für Sichtbarkeit | 4.000+ Locations, Firmenkunden |
| MeineLocation.com / RAC-Portale | Eintrag kostenlos, Provision bei Kontaktweitergabe | reine Erfolgsprovision |
| PLACCES | provisionsfrei | Vermietung direkt |
| Locationguide24 | Eintrag | Hochzeiten und Feiern |
| hochzeits-location.info | Basiseintrag kostenlos | Hochzeitspaare, Premium optional ab 99 €/Monat |
| unserehochzeitslocation.de | kostenlos ohne Registrierung | Hochzeiten |
| Location-Suchen.de | 48 €/Jahr, 6 Monate kostenlos | Tagungen und Feiern |
| location-ratgeber.de | kostenlos | Tagungshotels/Hochzeiten |
| Spacebase, Eventsofa, Event Inc | Provision 10–15 % je Buchung | Firmenevents aus Frankfurt (45 min) |

Einmal eintragen (je 20–30 Minuten mit Texten und Fotos von der Website), dann nur Anfragen
beantworten. Texte und Preise aus `src/content/` kopieren, damit überall dasselbe steht.

## 3. Hotel: Zimmer über Kanäle verkaufen
- **DIRS21** (Channelmanager + Buchungsmaske) ist in der Website vorbereitet
  (`src/server/integrations/dirs21.ts`, `docs/INTEGRATIONS.md`). Anbindung an **ibelsa** (PMS) über
  die DIRS21-Schnittstelle: Verfügbarkeiten und Preise zentral, Buchungen von Booking.com, HRS,
  Expedia, hotel.de landen im PMS, die Website zeigt dieselben Kontingente.
- **Google Hotel Ads – kostenlose Buchungslinks** über DIRS21: Direktpreis neben den Portalen.
- **Monteure und Handwerker** (Mo–Do): Einzelzimmer 68 € mit Frühstück und Parkplatz sind ein
  starkes Angebot. Eintrag bei monteurzimmer.de, mein-monteurzimmer.de; Firmen in Sulzbach,
  Elsenfeld, Aschaffenburg (Industriegebiete) anschreiben: Firmenrate, Sammelrechnung.
- **Motorrad**: „All Bikers Welcome“ als Zielgruppe: Eintrag bei motorradhotels.info, Tourenportale
  Spessart. Garage/Trockenraum erwähnen.
- **Radfahrer**: Bett+Bike (ADFC) zertifizieren lassen (ca. 60 €/Jahr) – Mainradweg liegt 5 km weit.
- **Hochzeitsgäste**: jede Feier im Haus bekommt die ganze Etage angeboten (Festpreis). Jede
  Veranstaltungsanfrage ist automatisch eine Hotelanfrage.

## 4. Dauermiete – die stabilste Einnahme
- Zielgruppen in 15 km Umkreis: Vereine (Stammlokal), Yoga/Tanz/Musikschulen (Wintergarten),
  Caterer und Food-Start-ups (Gewerbeküche), Bestatter (Trauerkaffee-Partner), Gastronomen für
  Pop-up oder Pacht.
- Kanäle: Immobilienscout24/Immowelt Gewerbe (Gastronomiefläche zur Miete, ab ca. 40 €/Anzeige),
  kleinanzeigen.de (kostenlos: „Gewerbeküche mieten“, „Vereinsraum mieten“), Gemeindeblatt
  Leidersbach, Vereinsregister des Landkreises (direkt anschreiben), IHK Aschaffenburg
  Existenzgründer-Börse.
- Ein PDF-Exposé je Mietmodell (aus `/aktuelles#mietmodelle`) reicht als Anhang.

## 5. Partner statt Werbung (Provision oder Gegenseitigkeit)
- **Caterer und Hochzeitsdienstleister** (DJ, Fotograf, Floristik) im Umkreis: gegenseitige
  Empfehlung, 5–10 % Vermittlungsprovision auf die Raummiete für vermittelte Feiern.
- **Bestatter** in Leidersbach, Sulzbach, Mespelbrunn: Trauerkaffee-Paket (Nebenzimmer, Kaffee-
  logistik durch Caterer), Flyer auslegen.
- **Standesamt Leidersbach / Mespelbrunn / Schloss Mespelbrunn** (Trauungen): Liste der
  Feierlocations – Krone eintragen lassen.
- **Firmen**: Weihnachtsfeier-Mailing im September an 50 Firmen der Region (Wochentage-Vorteil).
- **Vereine**: Jahreshauptversammlungen, Ehrungen – ein Brief an alle Vereine der Gemeinde.

## 6. Minimal-Social (ohne Videoproduktion)
- Ein Instagram/Facebook-Profil, Fotos von der Website, ein Beitrag pro Monat (automatisches
  Angebot kopieren). Google-Profil ist wichtiger als Instagram.
- Bewertungen: nach jeder Feier und jedem Aufenthalt per Mail (Vorlage in der Bestätigung) um eine
  Google-Bewertung bitten. 30 gute Bewertungen schlagen jede Anzeige.

## 7. Preisstrategie (kurz)
- Hotel nie rabattieren, stattdessen Paket-Mehrwert (Frühstück, Parken, Storno) betonen; über
  DIRS21 Portalpreise 10 % über Direktpreis setzen (Rate-Parität prüfen).
- Räume: Pauschale hält den Wochenendpreis, Angebote nur für kurzfristig Leeres; Woche und
  Monat als Volumenprodukt (siehe Mietmodelle). Nebenkosten bei Dauermiete immer extra.

## 8. Reihenfolge für die ersten 30 Tage
1. Google Business Profile vollständig (Tag 1).
2. Fünf Portale eintragen: fiylo, eventano, hochzeits-location.info, unserehochzeitslocation,
   PLACCES (Woche 1).
3. DIRS21 + ibelsa anbinden, Booking.com/HRS live (Woche 2–3).
4. Mailing Vereine + Bestatter + Firmen (Woche 2).
5. Dauermiete-Anzeigen (kleinanzeigen, Immowelt) mit Exposé (Woche 3).
6. Bewertungsbitte in alle Bestätigungsmails (Woche 4).

Quellen: fiylo.de, eventano.com, meinelocation.com/agb, placces.de, hochzeits-location.info,
location-suchen.de, ibelsa.com/anbindungen/dirs21, dirs21.de – abgerufen 10/2026.
