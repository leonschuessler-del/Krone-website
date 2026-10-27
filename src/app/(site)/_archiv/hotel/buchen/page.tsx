import type { Metadata } from "next";
import { BookingEngine } from "@/features/hotel/engine/BookingEngine";
import { engineRooms } from "@/features/hotel/engine/rooms.server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zimmer buchen – Landhotel Zur Krone",
  description: "Anreise und Abreise wählen, Zimmer vergleichen und direkt beim Haus reservieren – Frühstück inklusive, kostenlose Stornierung bis zwei Tage vor Anreise.",
  robots: { index: false },
};

export default async function HotelBookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])) as [string, string][]).toString();
  return (
    <div className="bg-paper pb-24 pt-28 md:pt-32">
      <div className="container-page">
        <p className="eyebrow">Landhotel garni · Leidersbach</p>
        <h1 className="mt-3 text-[2.6rem] font-light leading-[1] md:text-[3.4rem]">
          Zimmer <em>buchen.</em>
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">Bester Preis direkt beim Haus. Frühstück inklusive, Parken inklusive, kostenlos stornierbar bis zwei Tage vor Anreise.</p>
        <div className="mt-8">
          <BookingEngine rooms={engineRooms()} paymentProvider={env.paymentProvider} initialQuery={query} links={{ agb: "/agb", datenschutz: "/datenschutz", home: "/" }} />
        </div>
      </div>
    </div>
  );
}
