import { redirect } from "next/navigation";

/** The hotel has its own page now; the old space URL keeps working. */
export default function HotelRedirect() {
  redirect("/hotel");
}
