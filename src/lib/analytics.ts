/**
 * Provider-agnostic analytics event layer (privacy by design).
 *
 * No tracking provider is wired in. Events are dispatched as a DOM
 * CustomEvent (`krone:analytics`) so a consent-aware provider can subscribe
 * later without touching feature code. In development they are logged.
 */

export type AnalyticsEvent =
  | "space_viewed"
  | "space_selected"
  | "space_deselected"
  | "availability_checked"
  | "booking_started"
  | "booking_submitted"
  | "inquiry_submitted";

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined | string[]>;

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("krone:analytics", { detail: { event, props, at: Date.now() } }));
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, props);
    }
  } catch {
    // never let analytics break the UI
  }
}
