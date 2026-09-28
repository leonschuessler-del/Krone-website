import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { checkSelection } from "@/domain/availability";
import { generateBookingNumber, statusBlocksAvailability } from "@/domain/booking";
import { describeSelectionIssue, sanitizeSpaceIds, validateSelection } from "@/domain/selection";
import { resolveSchedule, type ScheduleInput } from "@/domain/schedule";
import { utcToLocal } from "@/domain/time";
import type { BookingKind } from "@/domain/types";
import { env } from "@/lib/env";
import { formatDateTime, formatInstantDateLong, formatMoney, formatTimeRange } from "@/lib/format";
import type { Database } from "@/server/db/client";
import {
  availabilityBlocks,
  bookingExtras,
  bookingItems,
  bookings,
  customers,
  payments,
  spaces as spacesTable,
  type BillingAddress,
} from "@/server/db/schema";
import { requiredTermIds } from "@/content/terms";
import { eventTypes } from "@/content/event-types";
import { rowToBlock, toProfile } from "./availability-service";
import { operatorEmail, sendEmail } from "./email-service";
import { getHandoverOptions, isAllowedOption } from "./handover-service";
import { releaseExpiredHolds } from "./hold-service";
import { calculatePrice } from "./pricing-service";
import { getVenueSettings } from "./settings-service";
import { listSpaceRows, rowToSpace } from "./space-service";

/**
 * ============================================================================
 *  bookingService – creates bookings and inquiries.
 * ============================================================================
 *  Race-condition strategy (documented in docs/ARCHITECTURE.md):
 *   1. Everything is validated again on the server (spaces, schedule, rules,
 *      prices, handover slots) – client data is never trusted.
 *   2. Inside ONE database transaction:
 *        a) per-space advisory locks (pg_advisory_xact_lock, sorted order →
 *           no deadlocks) serialise concurrent checkouts for the same spaces,
 *        b) expired holds are released,
 *        c) availability is re-checked against live data,
 *        d) customer, booking, items, extras, blocks and payment are inserted.
 *   3. The EXCLUDE constraint on availability_blocks is the final guarantee:
 *      if two transactions still collide, the second INSERT fails
 *      (SQLSTATE 23P01) and the whole transaction rolls back → no double booking.
 *   4. Instant bookings first hold the spaces (`reserved`, expiring) while the
 *      payment is pending. Only a successful payment turns the hold into
 *      `booked` and the booking into `confirmed`. A failed payment never
 *      confirms a booking.
 * ============================================================================
 */

export class BookingError extends Error {
  constructor(
    public readonly code:
      | "INVALID_SELECTION"
      | "INVALID_SCHEDULE"
      | "NOT_AVAILABLE"
      | "INQUIRY_REQUIRED"
      | "TERMS_REQUIRED"
      | "INVALID_HANDOVER"
      | "INVALID_EVENT"
      | "NOT_FOUND",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  company?: string | null;
  email: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  billing?: BillingAddress | null;
}

export interface BookingSubmission {
  kind: BookingKind;
  spaceIds: string[];
  schedule: ScheduleInput;
  extras: Array<{ extraId: string; quantity: number }>;
  event: { eventType: string | null; guestCount: number | null; notes: string | null };
  contact: ContactInput;
  handoverAt: string | null;
  returnAt: string | null;
  acceptedTerms: string[];
}

export interface BookingCreated {
  bookingNumber: string;
  accessToken: string;
  kind: BookingKind;
  status: string;
  paymentRequired: boolean;
  dueNow: number | null;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isExclusionViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "23P01" || e?.cause?.code === "23P01" || /exclusion constraint/i.test(e?.message ?? "");
}

export async function createBooking(db: Database, input: BookingSubmission, now = Date.now()): Promise<BookingCreated> {
  // ---- 1. validation ---------------------------------------------------------
  const rows = await listSpaceRows(db);
  const allSpaces = rows.map((r) => rowToSpace(r));
  const spaceIds = sanitizeSpaceIds(input.spaceIds, allSpaces);
  if (spaceIds.length === 0 || spaceIds.length !== new Set(input.spaceIds).size) {
    throw new BookingError("INVALID_SELECTION", "Die Auswahl enthält ungültige oder nicht buchbare Bereiche.");
  }
  const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? id;
  const issues = validateSelection(spaceIds, allSpaces);
  if (issues.length) throw new BookingError("INVALID_SELECTION", issues.map((i) => describeSelectionIssue(i, nameOf)).join(" "));

  if (input.event.eventType && !eventTypes.some((e) => e.id === input.event.eventType)) {
    throw new BookingError("INVALID_EVENT", "Unbekannte Veranstaltungsart.");
  }

  const settings = await getVenueSettings(db);
  let resolved;
  try {
    resolved = resolveSchedule(input.schedule, settings.bookableHours.weeklyHours);
  } catch (e) {
    throw new BookingError("INVALID_SCHEDULE", e instanceof Error ? e.message : "Ungültiger Zeitraum");
  }
  if (resolved.kind !== "range") throw new BookingError("INVALID_SCHEDULE", "Bitte wählen Sie Start- und Endzeit.");

  const required = requiredTermIds(input.kind);
  const missingTerms = required.filter((id) => !input.acceptedTerms.includes(id));
  if (missingTerms.length) throw new BookingError("TERMS_REQUIRED", "Bitte bestätigen Sie alle erforderlichen Bedingungen.", missingTerms);

  const handoverOptions = await getHandoverOptions(db, resolved.start, resolved.end, now);
  let handoverAt: number | null = null;
  let returnAt: number | null = null;
  if (!handoverOptions.individual) {
    if (input.handoverAt) {
      if (!isAllowedOption(handoverOptions.handover, input.handoverAt)) throw new BookingError("INVALID_HANDOVER", "Die gewählte Übergabezeit ist nicht verfügbar.");
      handoverAt = Date.parse(input.handoverAt);
    }
    if (input.returnAt) {
      if (!isAllowedOption(handoverOptions.return, input.returnAt)) throw new BookingError("INVALID_HANDOVER", "Die gewählte Rückgabezeit ist nicht verfügbar.");
      returnAt = Date.parse(input.returnAt);
    }
    if (input.kind === "booking" && (!handoverAt || !returnAt)) {
      throw new BookingError("INVALID_HANDOVER", "Bitte wählen Sie Übergabe- und Rückgabezeit.");
    }
  }

  // ---- 2. server-side price (source of truth) --------------------------------
  const quote = await calculatePrice(db, { ...input.schedule, spaceIds, guestCount: input.event.guestCount, extras: input.extras });
  if (input.kind === "booking" && quote.bookingMode === "inquiry") {
    throw new BookingError("INQUIRY_REQUIRED", "Diese Kombination kann nur unverbindlich angefragt werden.");
  }
  const paymentRequired = input.kind === "booking" && (quote.dueNow ?? 0) > 0;

  // ---- 3. transaction ------------------------------------------------------------
  const accessToken = randomBytes(24).toString("base64url");
  const year = Number(utcToLocal(now).date.slice(0, 4));
  const blockFrom = Math.min(resolved.start, handoverAt ?? resolved.start);
  const blockTo = Math.max(resolved.end, returnAt ?? resolved.end);

  const createInquiryHold = input.kind === "inquiry" && settings.holds.inquiryCreatesHold;
  const blockType: "reserved" | "booked" | null =
    input.kind === "booking" ? (paymentRequired ? "reserved" : "booked") : createInquiryHold ? "reserved" : null;
  const holdExpiry =
    blockType === "reserved"
      ? new Date(now + (input.kind === "booking" ? settings.holds.checkoutHoldMinutes * 60_000 : settings.holds.inquiryHoldHours * 3_600_000))
      : null;
  const status = input.kind === "inquiry" ? "inquiry" : paymentRequired ? "pending" : "confirmed";

  try {
    const created = await db.transaction(async (tx) => {
      // a) serialise per space (sorted → deadlock free)
      for (const id of [...spaceIds].sort()) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"space:" + id}))`);
      }
      // b) release expired holds for these spaces
      await releaseExpiredHolds(tx as unknown as Database, spaceIds, new Date(now));

      // c) live re-check (with the effective handover/return range for bookings)
      const liveBlocks = (
        await tx
          .select()
          .from(availabilityBlocks)
          .where(and(inArray(availabilityBlocks.spaceId, spaceIds), eq(availabilityBlocks.active, true)))
      ).map(rowToBlock);
      const profiles = Object.fromEntries(
        rows.filter((r) => spaceIds.includes(r.id)).map((r) => [r.id, toProfile(r, settings.bookableHours.weeklyHours)]),
      );
      const ctx = { profiles, blocks: liveBlocks, now };
      const check = checkSelection(spaceIds, { start: resolved.start, end: resolved.end }, ctx, {
        enforceBookableHours: resolved.rentalMode === "hourly",
        enforceDuration: true,
      });
      const extendedConflict =
        blockType &&
        checkSelection(spaceIds, { start: blockFrom, end: blockTo }, ctx, { enforceBookableHours: false }).blockedSpaces;
      if (!check.bookingAllowed || (extendedConflict && extendedConflict.length)) {
        const blocked = check.bookingAllowed ? (extendedConflict as string[]) : check.blockedSpaces;
        throw new BookingError(
          "NOT_AVAILABLE",
          blocked.map((id) => `${nameOf(id)} ist in diesem Zeitraum nicht (mehr) verfügbar.`).join(" "),
          { blockedSpaces: blocked, results: check.results.map((r) => ({ spaceId: r.spaceId, reason: r.reason })) },
        );
      }

      // d) inserts
      const [customer] = await tx
        .insert(customers)
        .values({
          firstName: input.contact.firstName,
          lastName: input.contact.lastName,
          company: input.contact.company || null,
          email: input.contact.email.toLowerCase(),
          phone: input.contact.phone,
          street: input.contact.street,
          houseNumber: input.contact.houseNumber,
          postalCode: input.contact.postalCode,
          city: input.contact.city,
          country: input.contact.country,
          billingAddress: input.contact.billing ?? null,
        })
        .returning();

      let bookingNumber = generateBookingNumber(input.kind, year);
      for (let i = 0; i < 5; i++) {
        const exists = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.bookingNumber, bookingNumber));
        if (!exists.length) break;
        bookingNumber = generateBookingNumber(input.kind, year);
      }

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingNumber,
          kind: input.kind,
          customerId: customer!.id,
          status,
          paymentStatus: input.kind === "inquiry" ? "unpaid" : paymentRequired ? "pending" : "unpaid",
          rentalMode: resolved.rentalMode,
          startAt: new Date(resolved.start),
          endAt: new Date(resolved.end),
          eventType: input.event.eventType,
          guestCount: input.event.guestCount,
          notes: input.event.notes,
          subtotal: quote.rentalSubtotal,
          discountTotal: quote.discountTotal,
          cleaningFee: quote.cleaningTotal,
          extrasTotal: quote.extrasTotal,
          deposit: quote.deposit,
          total: quote.total,
          dueNow: input.kind === "booking" ? quote.dueNow : null,
          handoverAt: handoverAt ? new Date(handoverAt) : null,
          returnAt: returnAt ? new Date(returnAt) : null,
          accessTokenHash: hashToken(accessToken),
          quoteSnapshot: quote,
          acceptedTerms: Object.fromEntries(input.acceptedTerms.map((id) => [id, new Date(now).toISOString()])),
          isDemo: env.demoMode,
        })
        .returning();

      await tx.insert(bookingItems).values(
        spaceIds.map((spaceId) => {
          const line = quote.lines.find((l) => l.kind === "rental" && l.refId === spaceId);
          return {
            bookingId: booking!.id,
            spaceId,
            startAt: new Date(resolved.start),
            endAt: new Date(resolved.end),
            priceModel: rows.find((r) => r.id === spaceId)?.priceModel ?? null,
            unitPrice: rows.find((r) => r.id === spaceId)?.basePrice ?? null,
            quantity: 1,
            subtotal: line?.amount ?? null,
          };
        }),
      );

      const extraLines = quote.lines.filter((l) => l.kind === "extra");
      if (extraLines.length) {
        await tx.insert(bookingExtras).values(
          extraLines.map((l) => ({
            bookingId: booking!.id,
            extraId: l.refId,
            quantity: input.extras.find((e) => e.extraId === l.refId)?.quantity ?? 1,
            unitPrice: null,
            subtotal: l.amount,
          })),
        );
      }

      if (blockType) {
        await tx.insert(availabilityBlocks).values(
          spaceIds.map((spaceId) => {
            const r = rows.find((x) => x.id === spaceId)!;
            return {
              spaceId,
              startAt: new Date(blockFrom - (r.setupBufferMinutes ?? 0) * 60_000),
              endAt: new Date(blockTo + (r.cleanupBufferMinutes ?? 0) * 60_000),
              type: blockType,
              reason: `${input.kind === "inquiry" ? "Anfrage" : "Buchung"} ${bookingNumber}`,
              bookingId: booking!.id,
              expiresAt: holdExpiry,
              isDemo: env.demoMode,
              createdBy: "booking",
            };
          }),
        );
      }

      if (paymentRequired) {
        await tx.insert(payments).values({
          bookingId: booking!.id,
          provider: env.paymentProvider === "stripe" ? "stripe" : "demo",
          kind: quote.dueNow === quote.total ? "rent" : "down_payment",
          amount: quote.dueNow!,
          currency: "EUR",
          status: "pending",
        });
      }

      return { booking: booking!, customer: customer! };
    });

    // ---- 4. notifications (outside the transaction) -----------------------------
    const url = `${env.siteUrl}/buchung/${created.booking.bookingNumber}?token=${accessToken}`;
    const ctxMail = {
      customerName: `${input.contact.firstName} ${input.contact.lastName}`,
      bookingNumber: created.booking.bookingNumber,
      bookingUrl: url,
      spaces: spaceIds.map(nameOf),
      dateLabel: formatInstantDateLong(resolved.start),
      timeLabel: formatTimeRange(resolved.start, resolved.end),
      totalLabel: formatMoney(quote.total, "auf Anfrage"),
      handoverLabel: handoverAt ? `${formatDateTime(handoverAt)} Uhr` : undefined,
    };
    await sendEmail(db, input.kind === "inquiry" ? "inquiry_received" : "booking_request_received", created.customer.email, ctxMail, created.booking.id);
    const op = operatorEmail();
    if (op) await sendEmail(db, "operator_new_request", op, ctxMail, created.booking.id);
    else await sendEmail(db, "operator_new_request", "betreiber@krone.invalid (nicht konfiguriert)", ctxMail, created.booking.id);

    return {
      bookingNumber: created.booking.bookingNumber,
      accessToken,
      kind: input.kind,
      status: created.booking.status,
      paymentRequired,
      dueNow: created.booking.dueNow,
    };
  } catch (err) {
    if (err instanceof BookingError) throw err;
    if (isExclusionViolation(err)) {
      throw new BookingError("NOT_AVAILABLE", "Ein ausgewählter Bereich wurde soeben anderweitig gebucht. Bitte wählen Sie einen anderen Zeitraum.");
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reading bookings
// ---------------------------------------------------------------------------

export async function findBookingByNumber(db: Database, bookingNumber: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.bookingNumber, bookingNumber));
  return booking ?? null;
}

export async function getBookingDetails(db: Database, bookingId: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) return null;
  const [customer] = await db.select().from(customers).where(eq(customers.id, booking.customerId));
  const items = await db
    .select({ item: bookingItems, spaceName: spacesTable.name, spaceColor: spacesTable.color, spaceCode: spacesTable.code })
    .from(bookingItems)
    .innerJoin(spacesTable, eq(bookingItems.spaceId, spacesTable.id))
    .where(eq(bookingItems.bookingId, booking.id));
  const extrasRows = await db.select().from(bookingExtras).where(eq(bookingExtras.bookingId, booking.id));
  const paymentRows = await db.select().from(payments).where(eq(payments.bookingId, booking.id)).orderBy(desc(payments.createdAt));
  return { booking, customer: customer!, items, extras: extrasRows, payments: paymentRows };
}

/** Public view – requires the access token. Returns null for wrong tokens (no enumeration). */
export async function getPublicBooking(db: Database, bookingNumber: string, token: string) {
  const booking = await findBookingByNumber(db, bookingNumber);
  if (!booking || !token || booking.accessTokenHash !== hashToken(token)) return null;
  return getBookingDetails(db, booking.id);
}

export async function applyBookingStatusToBlocks(db: Database, bookingId: string, status: Parameters<typeof statusBlocksAvailability>[0]) {
  const type = statusBlocksAvailability(status);
  if (type === null) {
    await db.update(availabilityBlocks).set({ active: false }).where(eq(availabilityBlocks.bookingId, bookingId));
  } else {
    await db
      .update(availabilityBlocks)
      .set({ type, expiresAt: type === "booked" ? null : undefined })
      .where(and(eq(availabilityBlocks.bookingId, bookingId), eq(availabilityBlocks.active, true)));
  }
}
