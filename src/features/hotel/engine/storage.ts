import type { Cart } from "@/domain/booking-engine";

/**
 * The cart survives a reload and a detour to the payment provider
 * (localStorage, 7 days). Only ids, dates and counts are stored – never
 * contact data.
 */
const CART_KEY = "krone.hotel.cart.v1";
const DONE_KEY = "krone.hotel.lastReservation.v1";
const TTL = 7 * 24 * 3600 * 1000;

export function loadCart(): Cart | null {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { savedAt: number; cart: Cart };
    if (!data.cart || Date.now() - data.savedAt > TTL) return null;
    return data.cart;
  } catch {
    return null;
  }
}

export function saveCart(cart: Cart | null) {
  try {
    if (!cart || !cart.items.length) localStorage.removeItem(CART_KEY);
    else localStorage.setItem(CART_KEY, JSON.stringify({ savedAt: Date.now(), cart }));
  } catch {
    /* private mode – the cart just does not persist */
  }
}

export interface DoneInfo {
  reservationNumber: string;
  firstName: string;
  arrival: string;
  departure: string;
  lines: Array<{ rooms: number; name: string }>;
  total: number | null;
  payment: "hotel" | "online" | "guarantee";
  paymentStatus: "none" | "paid" | "guaranteed" | "pending";
}

export function saveDone(info: DoneInfo) {
  try {
    sessionStorage.setItem(DONE_KEY, JSON.stringify(info));
  } catch {
    /* ignore */
  }
}

export function loadDone(): DoneInfo | null {
  try {
    const raw = sessionStorage.getItem(DONE_KEY);
    return raw ? (JSON.parse(raw) as DoneInfo) : null;
  } catch {
    return null;
  }
}
