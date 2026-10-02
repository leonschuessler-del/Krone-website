import type { Space } from "@/domain/types";

/**
 * Seed content for all spaces ("Bereiche").
 *
 * Prices and seats: operator's price sheet (10/2026, figures confirmed by the
 * operator on 2026-10-02) – flat package per
 * booking, Fri–Sun, every further day +100 €, all prices net (plus VAT). The
 * Restaurant is always part of a booking (entrance, bar); every other room is
 * an add-on to it (`requires: ["restaurant"]`). Areas and a few other facts
 * are still unconfirmed and listed in `needsVerification`.
 *
 * Descriptions below only restate what is known from the briefing
 * (function and approximate position on the property) and are marked as
 * placeholders.
 *
 * Map geometry (polygons, label positions) lives in `src/config/floorplan.ts`.
 */

type SpaceSeed = Omit<Space, "images" | "videos"> & { mediaFolder: string };

/** One neutral badge colour for every area (the map and lists stay calm; selection is shown by state, not hue). */
const NEUTRAL = "#4a423b";

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
/** Facts known from the price sheet → not flagged any more. */
const PRICED = UNKNOWN_FACTS.filter((f) => !["capacitySeated", "basePrice", "priceModel", "cleaningFee"].includes(f));
/** Every bookable room is an add-on to the Restaurant. */
const ADD_ON = {
  requires: ["restaurant"],
  availableForStandaloneRental: false,
  bookingMode: "inquiry",
  needsVerification: PRICED,
  cleaningFee: 0, // "inkl. NK" – ancillary costs are included in the flat price
} as Pick<SpaceSeed, "requires" | "availableForStandaloneRental" | "bookingMode" | "needsVerification" | "cleaningFee">;

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
  bookingMode: "inquiry",
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
    color: NEUTRAL,
    mediaFolder: "restaurant",
    sortOrder: 10,
    capacitySeated: 60,
    basePrice: 130000,
    priceModel: "flat",
    cleaningFee: 0, // inkl. NK
    needsVerification: PRICED,
    shortDescription: "Die Gaststube mit Theke und Rezeption – das Herz des Hauses.",
    longDescription:
      "Das Hauptrestaurant liegt im Erdgeschoss zwischen Küche und Nebenzimmer: helles Holz, Polsterbänke, Steinsäulen und die große Theke mit Rezeption. Über eine mobile Trennwand lässt es sich mit dem Nebenzimmer zu einem großen Raum verbinden. Der Haupteingang mit Vorraum liegt direkt davor.",
  },
  {
    ...defaults,
    id: "kitchen",
    slug: "kueche",
    code: "K",
    name: "Küche",
    type: "service",
    level: "ground-floor",
    color: NEUTRAL,
    mediaFolder: "kitchen",
    sortOrder: 20,
    // not rented as a room: kitchen use is an add-on (only with a caterer), see content/extras.ts
    bookable: false,
    includedInFullVenue: false,
    shortDescription: "Die Profiküche direkt hinter der Rezeption.",
    longDescription:
      "Die Küche erreicht man durch die Tür hinter der Rezeption. Sie ist voll ausgestattet mit Herdblock, Kombidämpfern und Spülküche. Ob die Küche bei Ihrer Feier mitgenutzt werden kann, etwa durch einen Caterer, stimmen wir individuell mit Ihnen ab.",
  },
  {
    ...defaults,
    id: "side-room",
    slug: "nebenzimmer",
    code: "NZ",
    name: "Nebenzimmer",
    type: "indoor",
    level: "ground-floor",
    color: NEUTRAL,
    mediaFolder: "side-room",
    sortOrder: 30,
    ...ADD_ON,
    capacitySeated: 55,
    basePrice: 30000,
    priceModel: "flat",
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
    color: NEUTRAL,
    mediaFolder: "stage",
    sortOrder: 40,
    ...ADD_ON,
    capacitySeated: 30,
    basePrice: 20000,
    priceModel: "flat",
    shortDescription: "Der leicht erhöhte Bereich hinter der Schiebetür – für Band, Reden und Auftritte.",
    longDescription:
      "Die Bühne liegt am Ende des Gebäudes, hinter einer großen Schiebetür neben dem Nebenzimmer, und ist leicht erhöht. Geschlossen dient sie als gemütlicher Bereich mit Sesseln, geöffnet als Bühne für Musik, Reden oder Programm. Licht- und Tontechnik auf Anfrage.",
  },
  {
    ...defaults,
    id: "old-tavern",
    slug: "alte-wirtschaft",
    code: "AW",
    name: "Alte Wirtschaft",
    type: "indoor",
    level: "ground-floor",
    color: NEUTRAL,
    mediaFolder: "old-tavern",
    sortOrder: 50,
    ...ADD_ON,
    needsVerification: UNKNOWN_FACTS,
    priceModel: "on_request",
    shortDescription: "Die gemütliche Stube mit Holzboden und eigener Theke.",
    longDescription:
      "Die Alte Wirtschaft ist der traditionsreiche Teil des Hauses: Holzboden, Bänke und eine eigene kleine Theke – ideal für kleinere Runden und gesellige Abende.",
  },
  {
    ...defaults,
    id: "winter-garden",
    slug: "wintergarten",
    code: "WG",
    name: "Wintergarten",
    type: "indoor",
    level: "ground-floor",
    color: NEUTRAL,
    mediaFolder: "winter-garden",
    sortOrder: 60,
    ...ADD_ON,
    capacitySeated: 30,
    basePrice: 25000,
    priceModel: "flat",
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
    color: NEUTRAL,
    mediaFolder: "beer-garden",
    sortOrder: 70,
    ...ADD_ON,
    capacitySeated: 100,
    basePrice: 30000,
    priceModel: "flat",
    shortDescription: "Unter der Weinlaube – mit Sandsteinmauer, Pergola und Platz für 100 Gäste.",
    longDescription:
      "Der Biergarten liegt vor dem Wintergarten: lange Holztafeln unter einer begrünten Pergola, eine historische Sandsteinmauer mit Ziegelkrone und Bäume als Schattenspender. Mit Wintergarten und Grillplatz ein Fest unter freiem Himmel – bei jedem Wetter mit Rückzugsort.",
  },
  {
    ...defaults,
    id: "hotel",
    slug: "hotel",
    code: "H",
    name: "Hotel",
    type: "hotel",
    level: "first-floor",
    color: NEUTRAL,
    mediaFolder: "hotel",
    sortOrder: 80,
    // Rooms are booked individually via the hotel booking (src/content/hotel.ts),
    // not as part of an event booking.
    bookable: false,
    includedInFullVenue: false,
    availableForStandaloneRental: true,
    bookingMode: "inquiry",
    shortDescription: "Übernachten im Haus: acht Doppelzimmer, zwei Einzelzimmer und ein Apartment im Obergeschoss, Frühstück inklusive.",
    longDescription:
      "Im Obergeschoss über Restaurant, Nebenzimmer und Bühne liegt das Landhotel: acht Doppelzimmer, zwei Einzelzimmer und ein Apartment, " +
      "alle mit eigenem Bad, dazu ein heller Flur und ein Aufenthaltsraum mit Balkon. Die Zimmer werden einzeln gebucht, " +
      "Frühstück ist inklusive – ideal für Gäste einer Feier im Haus, aber ebenso für Reisende im Spessart.",
    needsVerification: [...UNKNOWN_FACTS, "apartmentPrice"],
  },
];

export const SPACE_IDS = spaceSeeds.map((s) => s.id);
