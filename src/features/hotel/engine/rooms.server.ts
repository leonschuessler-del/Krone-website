import { guestRoomTypes } from "@/content/hotel";
import { getSpaceMedia, mediaExists } from "@/lib/media";
import type { EngineRoom } from "./types";

/** The room types with their pictures – resolved on the server from the media manifest. */
export function engineRooms(): EngineRoom[] {
  const hotel = getSpaceMedia("hotel", "Hotel");
  return guestRoomTypes.map((t) => {
    const photo = mediaExists(t.image) ? t.image : null;
    const gallery = [photo ? { src: photo, alt: t.name } : null, ...hotel.gallery.filter((g) => g.src !== photo).map((g) => ({ src: g.src, alt: `${t.name} – ${g.alt}` }))].filter((g): g is { src: string; alt: string } => g !== null);
    return { ...t, photo, gallery: t.id === "apartment" ? gallery.slice(0, 1) : gallery };
  });
}
