/**
 * Hotel content (operator, 10/2026 + the previous website krone-landhotel.de).
 * Rooms are booked individually, breakfast included. Prices per night in
 * cents; `null` = on request (apartment price not yet given). No discounts on
 * rooms – the operator's rule.
 *
 * "Doppelzimmer zur Einzelnutzung" is the same room as a double room, so both
 * share the inventory group "double" (8 rooms in total).
 */
export interface RoomTypeSeed {
  id: string;
  name: string;
  description: string;
  /** longer text for the room page */
  details: string;
  bathroom: string;
  features: string[];
  sizeHint?: string;
  maxGuests: number;
  basePricePerNight: number | null;
  /** rooms sharing one physical inventory */
  inventoryGroup: string;
  sortOrder: number;
  /** only offered with an event (whole floor), not on the hotel page */
  eventOnly?: boolean;
  /** image under /media/hotel */
  image: string;
}

/**
 * Whole floor (8 double + 2 single rooms + apartment, up to 22 guests) at a
 * fixed price per night – PROPOSAL (operator to confirm): the single rooms
 * alone add up to 936 € without the apartment. Offered with an event only.
 */
export const FLOOR_PRICE_PER_NIGHT = 84900;
export const FLOOR_ROOMS_SUM = 8 * 10000 + 2 * 6800; // 936 € – shown as the comparison
/** Whole-floor stays of several nights: small discount per night (PROPOSAL). */
export const FLOOR_NIGHT_TIERS: Array<{ nights: number; percent: number }> = [
  { nights: 2, percent: 5 },
  { nights: 3, percent: 10 },
];

const STANDARD = ["WLAN kostenlos", "Smart-TV mit Sat-Empfang", "Telefon", "Schreibtisch", "Sitzecke", "Ganzkörperspiegel"];
const BATH = "Bad mit Dusche, WC, Haartrockner und Kosmetikspiegel.";

export const roomTypeSeeds: RoomTypeSeed[] = [
  {
    id: "double",
    name: "Doppelzimmer",
    description: "Doppelbett, eigenes Bad, Frühstück inklusive.",
    details: "Die geschmackvoll eingerichteten Doppelzimmer liegen im ersten Obergeschoss. Holzmöbel, ein ruhiges Farbkonzept und viel Tageslicht – Gasthof-Charme mit moderner Ausstattung.",
    bathroom: BATH,
    features: STANDARD,
    maxGuests: 2,
    basePricePerNight: 10000,
    inventoryGroup: "double",
    sortOrder: 10,
    image: "/media/hotel/gallery-02.webp",
  },
  {
    id: "double-single",
    name: "Doppelzimmer zur Einzelnutzung",
    description: "Ein Doppelzimmer für eine Person, Frühstück inklusive.",
    details: "Das ganze Doppelzimmer für Sie allein: mehr Platz, mehr Ruhe – zum Preis für eine Person.",
    bathroom: BATH,
    features: STANDARD,
    maxGuests: 1,
    basePricePerNight: 7400,
    inventoryGroup: "double",
    sortOrder: 20,
    image: "/media/hotel/gallery-03.webp",
  },
  {
    id: "single",
    name: "Einzelzimmer",
    description: "Einzelbett, eigenes Bad, Frühstück inklusive.",
    details: "Gemütlich eingerichtet mit Schreibtisch und Sitzecke – für Geschäftsreisende und Alleinreisende, die abends ankommen und morgens gestärkt weiterfahren.",
    bathroom: BATH,
    features: STANDARD,
    maxGuests: 1,
    basePricePerNight: 6800,
    inventoryGroup: "single",
    sortOrder: 30,
    image: "/media/hotel/gallery-01.webp",
  },
  {
    id: "apartment",
    name: "Apartment",
    description: "Ferienwohnung mit drei Schlafzimmern und eigener Küche, Frühstück inklusive. Preis auf Anfrage.",
    details:
      "Die Ferienwohnung liegt im Haupthaus: drei separate Schlafzimmer, Sitz- und Essecke, ausgestattete Küche und ein Südbalkon mit Sitzgelegenheit. " +
      "Zwei Schlafzimmer mit Doppelbett, eines mit 1,40-m-Bett, jedes mit eigenem TV. Bad mit Dusche und Badewanne sowie separates Gäste-WC.",
    bathroom: "Bad mit Dusche, Badewanne, WC, Haartrockner und Kosmetikspiegel; separates Gäste-WC.",
    features: ["WLAN kostenlos", "Sat-TV in jedem Zimmer", "Ausgestattete Küche", "Südbalkon", "Sitz- und Essecke", "Schreibtisch"],
    sizeHint: "bis 5 Personen, Extra-Aufbettung auf Anfrage",
    maxGuests: 5,
    basePricePerNight: null,
    inventoryGroup: "apartment",
    sortOrder: 40,
    image: "/media/hotel/gallery-05.webp",
  },
  {
    id: "floor",
    name: "Ganze Etage",
    description: "Alle acht Doppelzimmer, beide Einzelzimmer und das Apartment – das Hotel exklusiv für Ihre Gesellschaft, Frühstück inklusive.",
    details: "Für Hochzeiten und Familienfeste: das ganze Obergeschoss gehört Ihren Gästen. Kein Heimweg, keine Fremden auf dem Flur, Frühstück für alle am nächsten Morgen.",
    bathroom: BATH,
    features: ["10 Zimmer + Apartment", "bis 22 Gäste", "Frühstück für alle", "Schlüsselübergabe vor Ort"],
    maxGuests: 22,
    basePricePerNight: FLOOR_PRICE_PER_NIGHT,
    inventoryGroup: "floor",
    sortOrder: 50,
    eventOnly: true,
    image: "/media/hotel/hero.webp",
  },
];

/** Room types a guest books on the hotel page (the floor belongs to events). */
export const guestRoomTypes = roomTypeSeeds.filter((t) => !t.eventOnly);

/** No discounts on rooms (operator): kept at 0 so the engine has one place for it. */
export const LONG_STAY_NIGHTS = 99;
export const LONG_STAY_PERCENT = 0;

/** Physical rooms per inventory group. */
export const roomInventory: Record<string, number> = { double: 8, single: 2, apartment: 1, floor: 1 };

/** Individual rooms (labels only – numbers can be adjusted in the admin later). */
export const hotelRoomSeeds = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `dz-${i + 1}`, roomTypeId: "double", label: `Doppelzimmer ${i + 1}` })),
  { id: "ez-1", roomTypeId: "single", label: "Einzelzimmer 1" },
  { id: "ez-2", roomTypeId: "single", label: "Einzelzimmer 2" },
  { id: "app-1", roomTypeId: "apartment", label: "Apartment" },
];

/**
 * Extras for a stay – prices from the previous online booking of the house
 * (krone-landhotel.de, 10/2026), per night in cents. Shown as "Aufenthalt
 * verfeinern" in the booking; nothing is pre-selected.
 */
export const stayExtras = [
  { id: "extra-bed", name: "Zustellbett", pricePerNight: 2500, perRoom: true, description: "Zusätzliches Bett im Zimmer – für Kinder oder einen dritten Gast." },
  { id: "baby-cot", name: "Babybett", pricePerNight: 2000, perRoom: true, description: "Reisebett mit Bettwäsche, auf Wunsch mit Nachtlicht." },
  { id: "dog", name: "Hund", pricePerNight: 1500, perRoom: false, description: "Ihr Hund ist willkommen – bitte vorab ansprechen." },
  { id: "dogs-2", name: "Zwei Hunde", pricePerNight: 2500, perRoom: false, description: "Für zwei Vierbeiner." },
  { id: "ev-charging", name: "Strom für E-Auto", pricePerNight: 0, perRoom: false, description: "Laden am Haus nach Absprache – derzeit ohne Aufpreis." },
] as const;
export type StayExtraId = (typeof stayExtras)[number]["id"];

export const hotelCopy = {
  eyebrow: "Landhotel seit 1919",
  title: "Übernachten in der Krone.",
  text: "Acht Doppelzimmer, zwei Einzelzimmer und ein Apartment im Obergeschoss – jedes mit eigenem Bad, Frühstück inklusive. Wählen Sie An- und Abreise, wir bestätigen Ihre Reservierung persönlich.",
  checkIn: "Anreise 15:30–21 Uhr (Schlüsselsafe vorhanden), Abreise Mo–Fr bis 10 Uhr, Sa–So bis 11 Uhr.",
};

/** The house and its history, as told on krone-landhotel.de. */
export const hotelStory = {
  eyebrow: "Seit 1919 in Familienbesitz",
  title: "Ein Haus mit großer Tradition.",
  paragraphs: [
    "Seit 1919 ist die „Krone“ in der Dorfmitte von Leidersbach nahe Aschaffenburg im Besitz der Familie. Zum Landhotel mit Gasthof wurde das traditionelle Wirtshaus 1980/81 von den ehemaligen Besitzern Cäcilia und Franz Schüßler umgebaut.",
    "Von 2015 bis Ende 2025 setzten Juniorchef Boris Schüßler und seine Frau frische Akzente: am Herd, am Grill und mit schönen Arrangements.",
    "Seit dem 1. Januar 2026 ist das Restaurant geschlossen. Das Hotel garni bleibt – mit Frühstück, das morgens im Haus serviert wird, und mit Räumen, die heute als Eventlocation vermietet werden.",
  ],
  milestones: [
    { year: "1919", text: "Die Krone kommt in Familienbesitz." },
    { year: "1980/81", text: "Umbau des Wirtshauses zum Landhotel mit Gasthof." },
    { year: "2015", text: "Boris Schüßler übernimmt die Küche." },
    { year: "2026", text: "Hotel garni und Eventlocation." },
  ],
};

export const breakfast = {
  title: "Frühstück im Haus.",
  text: "Frische Brötchen vom Bäcker, hausgemachte Marmeladen und weitere Leckereien – im Zimmerpreis inbegriffen.",
};

export const hotelFacts = {
  checkIn: ["15:30 – 21:00 Uhr", "Schlüsselsafe vorhanden"],
  checkOut: ["Montag – Freitag 07:00 – 10:00 Uhr", "Samstag – Sonntag 08:00 – 11:00 Uhr"],
  cancellation:
    "Bis zu 2 Tage vor der Anreise können Gäste kostenlos stornieren. Bei einer Stornierung in den 2 Tagen vor der Anreise werden 80 % des Gesamtpreises berechnet, bei Nichtanreise der Gesamtpreis der Buchung.",
  cards: "EC, Mastercard, Visa, Maestro",
  amenities: ["Extrabett / Kinderbett möglich", "Kostenloses WLAN", "Parkplatz direkt am Hotel", "Frühstück inklusive", "All Bikers Welcome"],
  pets: "Falls Sie zu Ihrem Aufenthalt Haustiere mitbringen möchten, sprechen Sie uns bitte vorab an.",
};

/** Why book here instead of a portal – honest benefits, no discounts. */
export const directBenefits = [
  { title: "Bestpreis", text: "Direkt beim Haus gebucht ist der Zimmerpreis nie höher als auf einem Portal." },
  { title: "Persönliche Bestätigung", text: "Ein Mensch prüft Ihre Anfrage und meldet sich – meist innerhalb eines Tages." },
  { title: "Flexibel bis 2 Tage vorher", text: "Kostenlose Stornierung bis zwei Tage vor Anreise." },
  { title: "Parken inklusive", text: "Stellplätze direkt am Haus, ohne Aufpreis." },
];
