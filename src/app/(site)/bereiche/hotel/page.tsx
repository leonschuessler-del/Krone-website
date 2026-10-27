import { permanentRedirect } from "next/navigation";

/**
 * Event-only scope (10/2026): the hotel page is archived. The whole floor is an
 * add-on of a celebration – the old space URL leads to that section of the start page.
 */
export default function HotelRedirect() {
  permanentRedirect("/#hotel");
}
