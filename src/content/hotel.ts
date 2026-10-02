/**
 * Hotel rooms (operator, 10/2026). Rooms are booked individually, breakfast
 * included. Prices per night in cents; `null` = on request (apartment price
 * not yet given).
 *
 * "Doppelzimmer zur Einzelnutzung" is the same room as a double room, so both
 * share the inventory group "double" (8 rooms in total).
 */
export interface RoomTypeSeed {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
  basePricePerNight: number | null;
  /** rooms sharing one physical inventory */
  inventoryGroup: string;
  sortOrder: number;
}

/**
 * Whole floor (8 double + 2 single rooms + apartment, up to 22 guests) at a
 * fixed price per night – PROPOSAL (operator to confirm): singles alone add up
 * to 936 € without the apartment, so 849 € incl. apartment and breakfast is
 * the "then I'll just take the whole floor" price for weddings and groups.
 */
export const FLOOR_PRICE_PER_NIGHT = 84900;
export const FLOOR_ROOMS_SUM = 8 * 10000 + 2 * 6800; // 936 € – shown as the comparison

export const roomTypeSeeds: RoomTypeSeed[] = [
  { id: "double", name: "Doppelzimmer", description: "Doppelbett, eigenes Bad, Frühstück inklusive.", maxGuests: 2, basePricePerNight: 10000, inventoryGroup: "double", sortOrder: 10 },
  { id: "double-single", name: "Doppelzimmer zur Einzelnutzung", description: "Ein Doppelzimmer für eine Person, Frühstück inklusive.", maxGuests: 1, basePricePerNight: 7400, inventoryGroup: "double", sortOrder: 20 },
  { id: "single", name: "Einzelzimmer", description: "Einzelbett, eigenes Bad, Frühstück inklusive.", maxGuests: 1, basePricePerNight: 6800, inventoryGroup: "single", sortOrder: 30 },
  { id: "apartment", name: "Apartment", description: "Wohnung mit eigener Küche, Frühstück inklusive. Preis auf Anfrage.", maxGuests: 4, basePricePerNight: null, inventoryGroup: "apartment", sortOrder: 40 },
  { id: "floor", name: "Ganze Etage", description: "Alle acht Doppelzimmer, beide Einzelzimmer und das Apartment – das Hotel exklusiv für Ihre Gesellschaft, Frühstück inklusive.", maxGuests: 22, basePricePerNight: FLOOR_PRICE_PER_NIGHT, inventoryGroup: "floor", sortOrder: 50 },
];

/** Long stays: from this many nights the room price drops by LONG_STAY_PERCENT. */
export const LONG_STAY_NIGHTS = 4;
export const LONG_STAY_PERCENT = 10;

/** Physical rooms per inventory group. */
export const roomInventory: Record<string, number> = { double: 8, single: 2, apartment: 1, floor: 1 };

/** Individual rooms (labels only – numbers can be adjusted in the admin later). */
export const hotelRoomSeeds = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: `dz-${i + 1}`, roomTypeId: "double", label: `Doppelzimmer ${i + 1}` })),
  { id: "ez-1", roomTypeId: "single", label: "Einzelzimmer 1" },
  { id: "ez-2", roomTypeId: "single", label: "Einzelzimmer 2" },
  { id: "app-1", roomTypeId: "apartment", label: "Apartment" },
];

export const hotelCopy = {
  eyebrow: "Landhotel",
  title: "Übernachten in der Krone.",
  text: "Acht Doppelzimmer, zwei Einzelzimmer und ein Apartment im Obergeschoss – jedes mit eigenem Bad, Frühstück inklusive. Wählen Sie An- und Abreise, wir bestätigen Ihre Reservierung persönlich.",
  checkIn: "Anreise ab 15 Uhr, Abreise bis 11 Uhr. Frühstück im Haus.",
};
