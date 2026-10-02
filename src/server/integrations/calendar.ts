import { createHash } from "node:crypto";
import { siteConfig } from "@/config/site";

/**
 * Calendar connection for the operator's Apple Calendar (iCloud) – two ways,
 * both without extra software:
 *
 *  1. CalDAV push (recommended): a confirmed booking is written as an event
 *     into one iCloud calendar; a cancellation removes it again. Setup:
 *       CALDAV_URL          calendar collection URL, e.g.
 *                           https://pXX-caldav.icloud.com/<dsid>/calendars/<calendar-id>/
 *       CALDAV_USERNAME     Apple-ID e-mail
 *       CALDAV_PASSWORD     app-specific password (appleid.apple.com → Sign-In and Security)
 *     See docs/INTEGRATIONS.md for finding the URL.
 *
 *  2. Subscription feed (works always): /api/calendar/krone.ics?key=CALENDAR_FEED_KEY
 *     lists every confirmed booking; subscribe to it in Apple Calendar
 *     (Datei → Neues Kalenderabonnement). Read-only, refreshed by Apple.
 *
 * Event UIDs are derived from the booking id, so writing twice updates the
 * same event (idempotent), and the feed and push never duplicate each other
 * when only one of them is used.
 */

export interface CalendarEvent {
  /** stable id (booking id or reservation id) */
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  /** all-day event (hotel nights): dates instead of timestamps */
  allDay?: boolean;
}

export const calendarConfig = {
  get caldav() {
    const url = process.env.CALDAV_URL?.trim();
    const username = process.env.CALDAV_USERNAME?.trim();
    const password = process.env.CALDAV_PASSWORD;
    return url && username && password ? { url: url.endsWith("/") ? url : `${url}/`, username, password } : null;
  },
  get feedKey() {
    return process.env.CALENDAR_FEED_KEY?.trim() || null;
  },
};

const pad = (n: number) => String(n).padStart(2, "0");
const stampUtc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateOnly = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const escapeText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** RFC 5545: lines ≤ 75 octets, folded with CRLF + space */
const fold = (line: string) => {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 73) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
};

export function eventUid(id: string): string {
  return `${createHash("sha1").update(id).digest("hex").slice(0, 24)}@krone-landhotel.de`;
}

export function renderVEvent(e: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${eventUid(e.id)}`,
    `DTSTAMP:${stampUtc(now)}`,
    e.allDay ? `DTSTART;VALUE=DATE:${dateOnly(e.start)}` : `DTSTART:${stampUtc(e.start)}`,
    e.allDay ? `DTEND;VALUE=DATE:${dateOnly(e.end)}` : `DTEND:${stampUtc(e.end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    e.location ? `LOCATION:${escapeText(e.location)}` : "",
    e.description ? `DESCRIPTION:${escapeText(e.description)}` : "",
    "END:VEVENT",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n");
}

export function renderCalendar(events: CalendarEvent[], name = `${siteConfig.name} – Buchungen`): string {
  const now = new Date();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zur Krone//Buchungen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escapeText(name)}`),
    "X-WR-TIMEZONE:Europe/Berlin",
    ...events.map((e) => renderVEvent(e, now)),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export type CalendarSyncResult = { ok: true; mode: "caldav" } | { ok: false; mode: "caldav" | "none"; error?: string };

async function caldavRequest(method: "PUT" | "DELETE", uid: string, body?: string): Promise<Response> {
  const cfg = calendarConfig.caldav!;
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`,
  };
  if (body !== undefined) headers["Content-Type"] = "text/calendar; charset=utf-8";
  return fetch(`${cfg.url}${uid}.ics`, { method, headers, body });
}

/** Create or update the event in the operator's calendar. Never throws – a calendar hiccup must not block a booking. */
export async function pushCalendarEvent(e: CalendarEvent): Promise<CalendarSyncResult> {
  if (!calendarConfig.caldav) return { ok: false, mode: "none" };
  try {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Zur Krone//Buchungen//DE", renderVEvent(e), "END:VCALENDAR", ""].join("\r\n");
    const res = await caldavRequest("PUT", eventUid(e.id), ics);
    if (!res.ok && res.status !== 201 && res.status !== 204) return { ok: false, mode: "caldav", error: `HTTP ${res.status}` };
    return { ok: true, mode: "caldav" };
  } catch (err) {
    return { ok: false, mode: "caldav", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Remove the event again (cancellation). 404 counts as removed. */
export async function removeCalendarEvent(id: string): Promise<CalendarSyncResult> {
  if (!calendarConfig.caldav) return { ok: false, mode: "none" };
  try {
    const res = await caldavRequest("DELETE", eventUid(id));
    if (!res.ok && res.status !== 404) return { ok: false, mode: "caldav", error: `HTTP ${res.status}` };
    return { ok: true, mode: "caldav" };
  } catch (err) {
    return { ok: false, mode: "caldav", error: err instanceof Error ? err.message : String(err) };
  }
}
