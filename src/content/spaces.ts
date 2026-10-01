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
    shortDescription: "Der große, zentrale Gastraum im Herzen des Hauses.",
    longDescription:
      "Das Restaurant bildet den zentralen Bereich des Hauptgebäudes und grenzt an Küche, Nebenzimmer, Bühne und Wintergarten. " +
      "Ausführliche Beschreibung, Ausstattung und Bestuhlungsvarianten folgen. [PLACEHOLDER – Text durch Betreiber zu bestätigen]",
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
    shortDescription: "Die Küche im oberen Bereich des Hauptkomplexes.",
    longDescription:
      "Die Küche liegt im nördlichen Teil des Hauptgebäudes, direkt am Restaurant. Ob und in welchem Umfang eine Küchennutzung " +
      "(z. B. durch Caterer) möglich ist, wird noch festgelegt. [PLACEHOLDER – Nutzungsbedingungen durch Betreiber zu bestätigen]",
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
    shortDescription: "Separater Raum östlich des Restaurants.",
    longDescription:
      "Das Nebenzimmer schließt östlich an das Restaurant an und eignet sich als eigenständiger Raum oder als Ergänzung. " +
      "Details folgen. [PLACEHOLDER – Text durch Betreiber zu bestätigen]",
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
    shortDescription: "Bühnenbereich im Südosten des Hauptgebäudes.",
    longDescription:
      "Die Bühne liegt südöstlich angrenzend an Restaurant und Nebenzimmer. Technische Ausstattung (Licht, Ton) wird noch ergänzt. " +
      "[PLACEHOLDER – Text durch Betreiber zu bestätigen]",
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
    shortDescription: "Der längliche, traditionsreiche Gebäudeteil im Westen.",
    longDescription:
      "Die Alte Wirtschaft befindet sich im länglichen westlichen Gebäudeteil zwischen Biergarten und Restaurant. " +
      "Geschichte, Ausstattung und Kapazität folgen. [PLACEHOLDER – Text durch Betreiber zu bestätigen]",
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
    shortDescription: "Heller Wintergarten südlich des Restaurants.",
    longDescription:
      "Der Wintergarten liegt südlich bzw. südöstlich des Restaurants. Weitere Informationen folgen. " +
      "[PLACEHOLDER – Text durch Betreiber zu bestätigen]",
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
    shortDescription: "Der Außenbereich im Westen des Grundstücks.",
    longDescription:
      "Der Biergarten liegt im westlichen Außenbereich des Grundstücks. Saisonale Nutzbarkeit, Kapazität und Wetterregelungen folgen. " +
      "[PLACEHOLDER – Text durch Betreiber zu bestätigen]",
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
