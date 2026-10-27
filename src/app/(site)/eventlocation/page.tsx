import { permanentRedirect } from "next/navigation";

/**
 * Since 10/2026 the event location is the start page. Old links and bookmarks
 * to /eventlocation (also from krone-landhotel.de) land there with a 308.
 * A hash (#karte, #bereiche …) is kept by the browser across the redirect.
 */
export default function EventLocationRedirect() {
  permanentRedirect("/");
}
