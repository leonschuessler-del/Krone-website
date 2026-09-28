"use client";

import { useEffect } from "react";
import { useBookingStore } from "@/store/booking-store";

/** Rehydrates the persisted booking draft after mount (avoids SSR hydration mismatches). */
export function StoreHydrator() {
  useEffect(() => {
    void useBookingStore.persist.rehydrate();
  }, []);
  return null;
}
