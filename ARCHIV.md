# Archiv – was im Oktober 2026 zurückgestellt wurde

**Stand:** 27.10.2026 · **Umfang der öffentlichen Website:** nur noch die **Eventlocation**.

Der Betreiber hat entschieden, dass vorerst nur die Eventlocation online geht. Sie wird in die
bestehende Website [krone-landhotel.de](https://www.krone-landhotel.de) eingebunden (dort, wo
der Knopf „Eventlocation“ ist). Hotel, Zimmerbuchung, Angebote und Sehenswürdigkeiten sind
**archiviert – nicht gelöscht**. Jede Datei ist noch da, wird weiter typgeprüft und lässt sich
mit wenigen Handgriffen zurückholen.

## 1. Was archiviert ist

| Früher (Route) | Inhalt | Liegt jetzt in |
|---|---|---|
| `/` (alte Startseite) | Hotel-Startseite mit Imagefilm, Buchungsleiste, Zimmern, Historie, Angeboten, Umgebung | `src/app/(site)/_archiv/start/page.tsx` |
| `/hotel` | Hotelseite: Zimmer, Frühstück, Hausregeln, Direktbuchungsvorteile | `src/app/(site)/_archiv/hotel/page.tsx` |
| `/hotel/buchen` | Zimmer-Buchungsmaschine (Suche → Zimmer → Kasse) | `src/app/(site)/_archiv/hotel/buchen/page.tsx` |
| `/aktuelles` | Angebote & Aktuelles (Rabatte, Last-Minute, Langzeitmiete) | `src/app/(site)/_archiv/aktuelles/page.tsx` |
| `/sehenswuerdigkeiten` | Umgebung mit Karte und Ausflugszielen | `src/app/(site)/_archiv/sehenswuerdigkeiten/page.tsx` |
| E2E-Test der Buchungsmaschine | Playwright-Spec | `tests/archive/hotel-engine.spec.ts` |

Next.js routet Ordner, deren Name mit `_` beginnt, nicht (private folders). Die Seiten sind also
**nicht erreichbar**, ihr Code bleibt aber Teil des Projekts und wird von `tsc` geprüft.
Jede archivierte `page.tsx` trägt oben den Kommentar `// ARCHIV (10/2026): nicht geroutet, siehe ARCHIV.md`.

**Unverändert im Code geblieben** (wird von den archivierten Seiten benutzt):
`src/features/hotel/**`, `src/features/offers/**`, `src/features/sights/**`,
`src/content/hotel.ts`, `src/content/sights.ts`, `src/domain/offers.ts`,
`src/features/home/Offers.tsx` (rendert bei `showPrices: false` nichts),
die Hotel-APIs und die Unit-Tests der Hotel-Domäne (laufen weiter mit `npm test`).

## 2. Was sich öffentlich geändert hat

- `/` ist die Eventlocation (vorher `/eventlocation`).
- `/eventlocation` leitet dauerhaft (308) auf `/` weiter – alte Links funktionieren weiter, `#karte` usw. bleiben erhalten.
- `/bereiche/hotel` leitet auf `/#hotel` weiter (die ganze Hotel-Etage als Zusatz zur Feier).
- Navigation: Räume · Raumplaner · Galerie · FAQ · Kontakt, Knopf „Termin anfragen“.
  Im Footer führt „Hotel & Restaurant“ auf die Hauptseite (`siteScope.mainSiteUrl`).
- **Keine Preise** auf der öffentlichen Seite, alles „auf Anfrage“; Anfragen sind unverbindlich.
  Preise bleiben in Datenbank und Admin für interne Angebote.
- `sitemap.xml` enthält nur noch die öffentlichen Event-Routen.

## 3. Zentrale Schalter

`src/config/scope.ts`:

```ts
siteScope = {
  eventOnly: true,     // nur Eventlocation
  showPrices: false,   // keine Preise/Summen/Rabatte im Browser
  requestOnly: true,   // nur unverbindliche Anfragen, keine Zahlung
  mainSiteUrl,         // NEXT_PUBLIC_MAIN_SITE_URL, Standard https://www.krone-landhotel.de
  mainSiteLabel,
}
```

`showPrices: true` blendet die Preisanzeigen wieder ein, `requestOnly: false` erlaubt wieder
verbindliche Buchungen mit Zahlung. Beides ist unabhängig vom Archiv.

## 4. Vollständiger Stand vor dem Umbau

Lokales Git-Tag **`archiv/vollversion-2026-10`** (Commit `3a1c7ea`) – die komplette Website
mit Hotel, Buchungsmaschine, Angeboten und Preisen, so wie sie vor dem Umbau war.

```bash
git show archiv/vollversion-2026-10 --stat      # ansehen
git checkout archiv/vollversion-2026-10         # ausprobieren (detached HEAD)
git push origin archiv/vollversion-2026-10      # Tag sichern, falls noch nicht auf dem Server
```

## 5. Zurückholen – Schritt für Schritt

1. **Seiten zurückverschieben** (mit `git mv`, damit die Historie erhalten bleibt):
   ```bash
   cd "src/app/(site)"
   git mv _archiv/hotel hotel
   git mv _archiv/aktuelles aktuelles
   git mv _archiv/sehenswuerdigkeiten sehenswuerdigkeiten
   # alte Hotel-Startseite wieder als "/": Event-Startseite vorher nach eventlocation/page.tsx zurück
   git mv page.tsx eventlocation/page.tsx   # (Weiterleitung dort vorher entfernen)
   git mv _archiv/start/page.tsx page.tsx
   cd -
   git mv tests/archive/hotel-engine.spec.ts tests/e2e/hotel-engine.spec.ts
   ```
   Danach die Kopfkommentare `ARCHIV (10/2026)` entfernen und in der Eventlocation-Seite
   Canonical/Links wieder auf `/eventlocation` setzen.
2. **Navigation** in `src/config/navigation.ts` erweitern (Hotel, Umgebung, Aktuelles,
   „Zimmer buchen“) und `heroRoutes` um `/hotel`, `/eventlocation`, `/sehenswuerdigkeiten`,
   `/aktuelles` ergänzen. Die alte Fassung steht im Tag (`git show archiv/vollversion-2026-10:src/config/navigation.ts`).
3. **Weiterleitungen** zurücknehmen: `src/app/(site)/bereiche/hotel/page.tsx` wieder auf `/hotel`.
4. **Schalter** in `src/config/scope.ts` setzen (`eventOnly: false`, bei Bedarf `showPrices: true`,
   `requestOnly: false`).
5. **Sitemap** (`src/app/sitemap.ts`) und **StructuredData** (`src/features/home/StructuredData.tsx`,
   Typ `Hotel`) ergänzen.
6. Prüfen: `npx tsc --noEmit`, `npm test`, `npm run test:e2e`.

## 6. Grundsatz

Beim Umbau wurde **nichts gelöscht**. Alles wurde verschoben (`git mv`) oder per Schalter
ausgeblendet. Übergabe an die Einbindung in krone-landhotel.de: siehe
[docs/UEBERGABE-CHATGPT.md](docs/UEBERGABE-CHATGPT.md).
