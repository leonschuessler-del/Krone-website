// One-off helper: (re)creates README files in public/media/* describing the
// expected file names. Safe to run repeatedly: `node scripts/media-readmes.mjs`
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = join(process.cwd(), "public", "media");
const spaces = {
  restaurant: "Restaurant",
  kitchen: "Küche",
  "side-room": "Nebenzimmer",
  stage: "Bühne",
  "old-tavern": "Alte Wirtschaft",
  "winter-garden": "Wintergarten",
  "beer-garden": "Biergarten",
  hotel: "Hotel",
};

const spaceReadme = (name) => `# Medien: ${name}

Hier die echten Medien dieses Bereichs ablegen (Dateinamen exakt so verwenden):

| Datei            | Zweck                                  | Empfehlung                    |
|------------------|----------------------------------------|-------------------------------|
| hero.webp        | Titelbild (Karte, Karten, Detailseite) | 2400×1600 px, WebP, < 400 KB  |
| gallery-01.webp  | Galerie-Bild 1                         | 2000×1333 px, WebP            |
| gallery-02.webp  | Galerie-Bild 2                         | 2000×1333 px, WebP            |
| gallery-03.webp  | Galerie-Bild 3 (weitere: gallery-04 …) | 2000×1333 px, WebP            |
| tour.mp4         | Optionales Raum-Video                  | 1920×1080, H.264, < 15 MB     |
| poster.webp      | Standbild für das Video                | 1920×1080 px, WebP            |

Fehlende Dateien werden automatisch durch neutrale Platzhalter ersetzt – es
erscheinen weder kaputte Bilder noch leere schwarze Videoflächen.

Nach dem Hinzufügen den Dev-Server bzw. Build neu starten (das Media-Manifest
\`src/generated/media-manifest.json\` wird dabei automatisch aktualisiert).

Nur echte, freigegebene Aufnahmen der Krone verwenden. Alternativtexte
(alt) werden in \`src/content/media.ts\` gepflegt.
`;

for (const [folder, name] of Object.entries(spaces)) {
  mkdirSync(join(base, folder), { recursive: true });
  writeFileSync(join(base, folder, "README.md"), spaceReadme(name));
}

const other = {
  hero: `# Hero-Film

- \`krone-property-tour.mp4\` – Imagefilm 16:9 (1920×1080, H.264, stumm, ideal < 12 MB)
- \`krone-property-tour.webm\` – optional (VP9/AV1), wird bevorzugt geladen
- \`poster.webp\` – erstes Standbild des Films (1920×1080)

Geplante Dramaturgie: Drohnenflug → gesamte Immobilie → Zoom Richtung Gebäude →
Restaurant → Theke → Bühne → Nebenzimmer → Alte Wirtschaft → Küche →
Wintergarten → Biergarten → Hotel → Rückkehr zur Vogelperspektive.
Endet der Film in der Draufsicht, geht er nahtlos in die interaktive Karte über.

Solange keine Datei vorhanden ist, zeigt die Startseite einen animierten
Platzhalter auf Basis der stilisierten Grundstücksansicht.
`,
  property: `# Allgemeine Immobilienbilder

\`gallery-01.webp\`, \`gallery-02.webp\`, … – Außenansichten, Details, Stimmungen.
Werden in der Galerie unter „Location“ angezeigt.
`,
  floorplan: `# Grundriss / Karte

Die Grundstückskarte wird aus \`src/config/site-plan.ts\` (Grafik) und
\`src/config/floorplan.ts\` (interaktive Polygone) erzeugt.

Optional: eine lizenzierte Drohnen-Orthofotografie hier ablegen
(z. B. \`aerial.webp\`, gleiches Seitenverhältnis 1536:1024) und in
\`src/config/map.ts\` als \`baseLayer.src\` eintragen.
`,
  brand: `# Marke

\`logo.svg\` – offizielles Krone-Logo (sobald freigegeben). Bis dahin wird eine
typografische Wortmarke mit Kronen-Signet verwendet (\`src/components/brand/Logo.tsx\`).
`,
};
for (const [folder, text] of Object.entries(other)) {
  mkdirSync(join(base, folder), { recursive: true });
  writeFileSync(join(base, folder, "README.md"), text);
}
console.log("media READMEs written");
