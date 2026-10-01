import type { Space } from "@/domain/types";

/**
 * Seed content for all spaces ("Bereiche").
 *
 * IMPORTANT – NO INVENTED FACTS:
 * Areas, capacities, prices, features, rules and opening hours are unknown and
 * therefore `null` / empty. Fill them in via the admin (`/admin/bereiche`) or
 * here before seeding. Every unconfirmed field is listed in `needsVerification`.
 *
 * Descriptions below only restate what is known from the briefing
 * (function and approximate position on the property) and are marked as
 * placeholders.
 *
 * Map geometry (polygons, label positions) lives in `src/config/floorplan.ts`.
 */

type SpaceSeed = Omit<Space, "images" | "videos"> & { mediaFolder: string };

const UNKNOWN_FACTS = [
  "areaSqm",
  "capacityStanding",
  "capacitySeated",
  "features",
  "basePrice",
  "priceModel",
  "deposit",
  "cleaningFee",
  "minimumDurationMinutes",
  "bookableHours",
  "longDescription",
];

const defaults = {
  areaSqm: null,
  capacityStanding: null,
  capacitySeated: null,
  features: [],
  usageOptions: [],
  rules: [],
  basePrice: null,
  priceModel: null,
  deposit: null,
  cleaningFee: null,
  minimumDurationMinutes: null,
  maximumDurationMinutes: null,
  advanceBookingMinHours: null,
  advanceBookingMaxDays: null,
  setupBufferMinutes: null,
  cleanupBufferMinutes: null,
  availableForStandaloneRental: true,
  includedInFullVenue: true,
  requires: [],
  incompatibleWith: [],
  bookingMode: "both",
  bookable: true,
  active: true,
  needsVerification: UNKNOWN_FACTS,
} satisfies Partial<SpaceSeed>;

export const spaceSeeds: SpaceSeed[] = [
  {
    ...defaults,
    id: "restaurant",
    slug: "restaurant",
    code: "R",
    name: "Restaurant",
    type: "indoor",
    level: "ground-floor",
    color: "#9a3340",
    mediaFolder: "restaurant",
    sortOrder: 10,
    shortDescription: "Die Gaststube mit Theke und Rezeption – das Herz des Hauses.",
    longDescription:
      "Das Hauptrestaurant liegt im Erdgeschoss zwischen Küche und Nebenzimmer: helles Holz, Polsterbänke, Steinsäulen und die große Theke mit Rezeption. Über eine mobile Trennwand lässt es sich mit dem Nebenzimmer zu einem großen Raum verbinden. Der Haupteingang mit Vorraum liegt direkt davor. Bestuhlung und Kapazität werden vom Betreiber ergänzt.",
  },
  {
    ...defaults,
    id: "kitchen",
    slug: "kueche",
    code: "K",
    name: "Küche",
    type: "service",
    level: "ground-floor",
    color: "#4f6d8a",
    mediaFolder: "kitchen",
    sortOrder: 20,
    shortDescription: "Die Profiküche direkt hinter der Rezeption.",
    longDescription:
      "Die Küche erreicht man durch die Tür hinter der Rezeption. Sie ist voll ausgestattet mit Herdblock, Kombidämpfern und Spülküche. Ob und in welchem Umfang eine Küchennutzung (z. B. durch Caterer) möglich ist, wird noch festgelegt. [Nutzungsbedingungen durch Betreiber zu bestätigen]",
  },
  {
    ...defaults,
    id: "side-room",
    slug: "nebenzimmer",
    code: "NZ",
    name: "Nebenzimmer",
    type: "indoor",
    level: "ground-floor",
    color: "#c49a2c",
    mediaFolder: "side-room",
    sortOrder: 30,
    shortDescription: "Der Saal mit Kachelofen – separat oder zum Restaurant geöffnet.",
    longDescription:
      "Das Nebenzimmer schließt an das Hauptrestaurant an und ist durch eine mobile Wand abgetrennt – geöffnet entsteht ein großer, durchgehender Raum. Charakteristisch ist der weiße Kachelofen; lange Tafeln eignen sich für Feiern, Hochzeiten und Firmenessen. Zur Bühne hin führt eine Schiebetür.",
  },
  {
    ...defaults,
    id: "stage",
    slug: "buehne",
    code: "B",
    name: "Bühne",
    type: "indoor",
    level: "ground-floor",
    color: "#6f5a92",
    mediaFolder: "stage",
    sortOrder: 40,
    shortDescription: "Der leicht erhöhte Bereich hinter der Schiebetür – für Band, Reden und Auftritte.",
    longDescription:
      "Die Bühne liegt am Ende des Gebäudes, hinter einer großen Schiebetür neben dem Nebenzimmer, und ist leicht erhöht. Geschlossen dient sie als gemütlicher Bereich mit Sesseln, geöffnet als Bühne für Musik, Reden oder Programm. Technische Ausstattung (Licht, Ton) folgt.",
  },
  {
    ...defaults,
    id: "old-tavern",
    slug: "alte-wirtschaft",
    code: "AW",
    name: "Alte Wirtschaft",
    type: "indoor",
    level: "ground-floor",
    color: "#b0662b",
    mediaFolder: "old-tavern",
    sortOrder: 50,
    shortDescription: "Die gemütliche Stube mit Holzboden und eigener Theke.",
    longDescription:
      "Die Alte Wirtschaft ist der traditionsreiche Teil des Hauses: Holzboden, Bänke und eine eigene kleine Theke – ideal für kleinere Runden und gesellige Abende. Aktuelle Fotos, Ausstattung und Kapazität werden ergänzt.",
  },
  {
    ...defaults,
    id: "winter-garden",
    slug: "wintergarten",
    code: "WG",
    name: "Wintergarten",
    type: "indoor",
    level: "ground-floor",
    color: "#6f9a68",
    mediaFolder: "winter-garden",
    sortOrder: 60,
    shortDescription: "Hell, mit Glasdach – direkt am Biergarten.",
    longDescription:
      "Der Wintergarten mit Glasdach liegt auf der Rückseite des Hauses und öffnet sich über große Holz-Glastüren direkt zum Biergarten. Viel Tageslicht, Korbstühle und Blick ins Grüne – auch an kühleren Tagen.",
  },
  {
    ...defaults,
    id: "beer-garden",
    slug: "biergarten",
    code: "BG",
    name: "Biergarten",
    type: "outdoor",
    level: "outdoor",
    color: "#3f6b3a",
    mediaFolder: "beer-garden",
    sortOrder: 70,
    shortDescription: "Der Hof hinter dem Haus – mit Sandsteinmauer, Pergola und überdachter Terrasse.",
    longDescription:
      "Der Biergarten liegt vor dem Wintergarten im Hof: eine überdachte Terrasse, Holztische mit grünen Polstern, eine historische Sandsteinmauer und Bäume als Schattenspender. Saisonale Nutzbarkeit und Kapazität werden vom Betreiber ergänzt.",
  },
  {
    ...defaults,
    id: "hotel",
    slug: "hotel",
    code: "H",
    name: "Hotel",
    type: "hotel",
    level: "first-floor",
    color: "#7a6f66",
    mediaFolder: "hotel",
    sortOrder: 80,
    // The whole upper floor is rented as one unit (owner: 10 Zimmer + Wohnung).
    // Single-room bookings are not offered here – inquiry only, priced individually.
    bookable: true,
    includedInFullVenue: false,
    availableForStandaloneRental: true,
    bookingMode: "inquiry",
    shortDescription: "Das komplette Hotel im Obergeschoss – 10 Zimmer und eine Wohnung, exklusiv für Ihre Gäste.",
    longDescription:
      "Im Obergeschoss über Restaurant, Nebenzimmer und Bühne liegt das Landhotel: Doppel-, Dreibett- und Einzelzimmer mit eigenem Bad, " +
      "ein heller Flur, ein Aufenthaltsraum mit Balkon und eine Wohnung mit eigener Küche. Das Hotel wird als Ganzes vermietet – " +
      "ideal für Hochzeiten, Familienfeiern und Firmenevents, bei denen die Gäste direkt im Haus übernachten. " +
      "Zimmeranzahl laut Betreiber; Bettenanzahl und Preise auf Anfrage.",
    needsVerification: [...UNKNOWN_FACTS, "roomTypes", "bedCount"],
  },
];

export const SPACE_IDS = spaceSeeds.map((s) => s.id);
