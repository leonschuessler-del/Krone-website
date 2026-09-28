import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { BOOKING_STATUS_LABEL, canTransition, InvalidTransitionError, statusBlocksAvailability } from "@/domain/booking";
import { addDays, dayBounds, localRangeToInterval, zonedDateTimeToUtc, type LocalDate } from "@/domain/time";
import type { BookingStatus, PaymentStatus } from "@/domain/types";
import { formatDateTime, formatInstantDateLong, formatMoney, formatTimeRange } from "@/lib/format";
import type { Database } from "@/server/db/client";
import {
  auditLog,
  availabilityBlocks,
  bookingExtras,
  bookingItems,
  bookings,
  contactMessages,
  customers,
  emailLog,
  extras as extrasTable,
  spaces,
} from "@/server/db/schema";
import type { AdminBookingUpdate } from "./admin-validation";
import { applyBookingStatusToBlocks, getBookingDetails } from "./booking-service";
import { sendEmail, type EmailTemplate } from "./email-service";
import { releaseExpiredHolds } from "./hold-service";
import { listSpaceRows } from "./space-service";

/**
 * ============================================================================
 *  adminService – everything the internal admin does with bookings and
 *  availability. Pure data access + business rules; no HTTP concerns.
 * ============================================================================
 *  Status changes only follow BOOKING_TRANSITIONS (canTransition). When a
 *  booking starts to occupy its spaces (e.g. inquiry → confirmed) the missing
 *  availability blocks are created inside a transaction with per-space
 *  advisory locks. The EXCLUDE constraint on availability_blocks remains the
 *  final guarantee: a collision (SQLSTATE 23P01) aborts the change with
 *  "Zeitraum inzwischen belegt".
 * ============================================================================
 */

export class AdminError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID_RE.test(id);

export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code ?? e?.cause?.code;
}

export function isExclusionViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23P01" || /exclusion constraint/i.test((err as { message?: string })?.message ?? "");
}

const asInt = (v: unknown) => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export async function writeAudit(db: Database, actor: string, action: string, entity: string, entityId: string | null, data?: unknown): Promise<void> {
  await db.insert(auditLog).values({ actor, action, entity, entityId, data: data ?? null });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
export interface BookingSpaceRef {
  spaceId: string;
  name: string;
  code: string;
  color: string;
}

async function spacesForBookings(db: Database, bookingIds: string[]): Promise<Map<string, BookingSpaceRef[]>> {
  const map = new Map<string, BookingSpaceRef[]>();
  if (bookingIds.length === 0) return map;
  const rows = await db
    .select({ bookingId: bookingItems.bookingId, spaceId: bookingItems.spaceId, name: spaces.name, code: spaces.code, color: spaces.color, sortOrder: spaces.sortOrder })
    .from(bookingItems)
    .innerJoin(spaces, eq(bookingItems.spaceId, spaces.id))
    .where(inArray(bookingItems.bookingId, bookingIds))
    .orderBy(asc(spaces.sortOrder));
  for (const r of rows) {
    const list = map.get(r.bookingId) ?? [];
    if (!list.some((s) => s.spaceId === r.spaceId)) list.push({ spaceId: r.spaceId, name: r.name, code: r.code, color: r.color });
    map.set(r.bookingId, list);
  }
  return map;
}

const bookingListColumns = {
  id: bookings.id,
  bookingNumber: bookings.bookingNumber,
  kind: bookings.kind,
  status: bookings.status,
  paymentStatus: bookings.paymentStatus,
  rentalMode: bookings.rentalMode,
  startAt: bookings.startAt,
  endAt: bookings.endAt,
  total: bookings.total,
  guestCount: bookings.guestCount,
  eventType: bookings.eventType,
  isDemo: bookings.isDemo,
  reviewedAt: bookings.reviewedAt,
  createdAt: bookings.createdAt,
  firstName: customers.firstName,
  lastName: customers.lastName,
  company: customers.company,
  email: customers.email,
};

export interface AdminBookingListItem {
  id: string;
  bookingNumber: string;
  kind: "booking" | "inquiry";
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  rentalMode: "hourly" | "daily";
  start: number;
  end: number;
  total: number | null;
  guestCount: number | null;
  eventType: string | null;
  isDemo: boolean;
  isNew: boolean;
  createdAt: number;
  customerName: string;
  company: string | null;
  email: string;
  spaces: BookingSpaceRef[];
}

function bookingListQuery(db: Database) {
  return db.select(bookingListColumns).from(bookings).innerJoin(customers, eq(bookings.customerId, customers.id));
}
type ListRow = Awaited<ReturnType<typeof bookingListQuery>>[number];

function toListItem(r: ListRow, spaceMap: Map<string, BookingSpaceRef[]>): AdminBookingListItem {
  return {
    id: r.id,
    bookingNumber: r.bookingNumber,
    kind: r.kind,
    status: r.status,
    paymentStatus: r.paymentStatus,
    rentalMode: r.rentalMode,
    start: r.startAt.getTime(),
    end: r.endAt.getTime(),
    total: r.total,
    guestCount: r.guestCount,
    eventType: r.eventType,
    isDemo: r.isDemo,
    isNew: r.reviewedAt === null && r.status !== "cancelled" && r.status !== "draft",
    createdAt: r.createdAt.getTime(),
    customerName: `${r.firstName} ${r.lastName}`.trim(),
    company: r.company,
    email: r.email,
    spaces: spaceMap.get(r.id) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const OPEN_STATUSES: BookingStatus[] = ["inquiry", "pending", "reserved", "confirmed"];

export async function getDashboardData(db: Database, now = Date.now()) {
  const nowIso = new Date(now).toISOString();
  const in14Iso = new Date(now + 14 * 86_400_000).toISOString();
  const [kpi] = await db
    .select({
      unreviewed: sql<number>`(count(*) filter (where ${bookings.reviewedAt} is null and ${bookings.status} not in ('cancelled', 'draft')))::int`,
      inquiries: sql<number>`(count(*) filter (where ${bookings.status} = 'inquiry'))::int`,
      pending: sql<number>`(count(*) filter (where ${bookings.status} in ('pending', 'reserved')))::int`,
      confirmed: sql<number>`(count(*) filter (where ${bookings.status} = 'confirmed'))::int`,
      upcoming14: sql<number>`(count(*) filter (where ${bookings.startAt} >= ${nowIso}::timestamptz and ${bookings.startAt} < ${in14Iso}::timestamptz and ${bookings.status} in ('inquiry', 'pending', 'reserved', 'confirmed')))::int`,
    })
    .from(bookings);

  const upcomingRows = await bookingListQuery(db)
    .where(and(gte(bookings.endAt, new Date(now)), inArray(bookings.status, OPEN_STATUSES)))
    .orderBy(asc(bookings.startAt))
    .limit(8);

  const latestRows = await bookingListQuery(db)
    .where(and(isNull(bookings.reviewedAt), notInArray(bookings.status, ["cancelled", "draft"])))
    .orderBy(desc(bookings.createdAt))
    .limit(5);

  const spaceMap = await spacesForBookings(db, [...upcomingRows, ...latestRows].map((r) => r.id));

  const upcomingBlocks = await db
    .select({
      id: availabilityBlocks.id,
      startAt: availabilityBlocks.startAt,
      endAt: availabilityBlocks.endAt,
      type: availabilityBlocks.type,
      reason: availabilityBlocks.reason,
      isDemo: availabilityBlocks.isDemo,
      spaceName: spaces.name,
      spaceColor: spaces.color,
    })
    .from(availabilityBlocks)
    .innerJoin(spaces, eq(availabilityBlocks.spaceId, spaces.id))
    .where(and(eq(availabilityBlocks.active, true), isNull(availabilityBlocks.bookingId), gte(availabilityBlocks.endAt, new Date(now))))
    .orderBy(asc(availabilityBlocks.startAt))
    .limit(5);

  const [contact] = await db
    .select({ open: sql<number>`count(*)::int` })
    .from(contactMessages)
    .where(isNull(contactMessages.handledAt));

  return {
    kpi: {
      unreviewed: asInt(kpi?.unreviewed),
      inquiries: asInt(kpi?.inquiries),
      pending: asInt(kpi?.pending),
      confirmed: asInt(kpi?.confirmed),
      upcoming14: asInt(kpi?.upcoming14),
      openContactMessages: asInt(contact?.open),
    },
    upcoming: upcomingRows.map((r) => toListItem(r, spaceMap)),
    latest: latestRows.map((r) => toListItem(r, spaceMap)),
    upcomingBlocks: upcomingBlocks.map((b) => ({
      id: b.id,
      start: b.startAt.getTime(),
      end: b.endAt.getTime(),
      type: b.type,
      reason: b.reason,
      isDemo: b.isDemo,
      spaceName: b.spaceName,
      spaceColor: b.spaceColor,
    })),
  };
}

// ---------------------------------------------------------------------------
// Booking list
// ---------------------------------------------------------------------------
export const BOOKING_FILTERS = ["neu", "anfrage", "reserviert", "bestaetigt", "bezahlt", "storniert", "abgeschlossen", "alle"] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];

function filterCondition(filter: BookingFilter): SQL | undefined {
  switch (filter) {
    case "neu":
      return and(isNull(bookings.reviewedAt), notInArray(bookings.status, ["cancelled", "draft"]));
    case "anfrage":
      return eq(bookings.status, "inquiry");
    case "reserviert":
      return inArray(bookings.status, ["pending", "reserved"]);
    case "bestaetigt":
      return eq(bookings.status, "confirmed");
    case "bezahlt":
      return inArray(bookings.paymentStatus, ["paid", "deposit_paid"]);
    case "storniert":
      return eq(bookings.status, "cancelled");
    case "abgeschlossen":
      return eq(bookings.status, "completed");
    default:
      return undefined;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function searchCondition(q: string | undefined): SQL | undefined {
  const term = q?.trim().slice(0, 100);
  if (!term) return undefined;
  const p = `%${escapeLike(term)}%`;
  return or(
    ilike(bookings.bookingNumber, p),
    ilike(bookings.inquiryNumber, p),
    ilike(customers.email, p),
    ilike(customers.firstName, p),
    ilike(customers.lastName, p),
    ilike(customers.company, p),
    sql`(${customers.firstName} || ' ' || ${customers.lastName}) ilike ${p}`,
  );
}

export async function listAdminBookings(db: Database, options: { filter: BookingFilter; q?: string; limit?: number }) {
  const search = searchCondition(options.q);
  const rows = await bookingListQuery(db)
    .where(and(filterCondition(options.filter), search))
    .orderBy(desc(bookings.createdAt))
    .limit(options.limit ?? 200);
  const spaceMap = await spacesForBookings(db, rows.map((r) => r.id));

  const countExpr = (f: BookingFilter) => {
    const cond = filterCondition(f);
    return cond ? sql<number>`(count(*) filter (where ${cond}))::int` : sql<number>`count(*)::int`;
  };
  const [counts] = await db
    .select({
      neu: countExpr("neu"),
      anfrage: countExpr("anfrage"),
      reserviert: countExpr("reserviert"),
      bestaetigt: countExpr("bestaetigt"),
      bezahlt: countExpr("bezahlt"),
      storniert: countExpr("storniert"),
      abgeschlossen: countExpr("abgeschlossen"),
      alle: countExpr("alle"),
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(search);

  const countMap = Object.fromEntries(BOOKING_FILTERS.map((f) => [f, asInt(counts?.[f])])) as Record<BookingFilter, number>;
  return { items: rows.map((r) => toListItem(r, spaceMap)), counts: countMap };
}

// ---------------------------------------------------------------------------
// Booking detail
// ---------------------------------------------------------------------------
export async function getAdminBookingDetail(db: Database, id: string) {
  if (!isUuid(id)) return null;
  const details = await getBookingDetails(db, id);
  if (!details) return null;
  // never hand the access token hash to the UI
  const { accessTokenHash: _hash, ...booking } = details.booking;

  const [extraRows, mails, blocks, audit] = await Promise.all([
    db
      .select({ id: bookingExtras.id, extraId: bookingExtras.extraId, name: extrasTable.name, priceModel: extrasTable.priceModel, quantity: bookingExtras.quantity, subtotal: bookingExtras.subtotal })
      .from(bookingExtras)
      .innerJoin(extrasTable, eq(bookingExtras.extraId, extrasTable.id))
      .where(eq(bookingExtras.bookingId, id)),
    db
      .select({ id: emailLog.id, template: emailLog.template, to: emailLog.to, subject: emailLog.subject, status: emailLog.status, createdAt: emailLog.createdAt })
      .from(emailLog)
      .where(eq(emailLog.bookingId, id))
      .orderBy(desc(emailLog.createdAt)),
    db
      .select({
        id: availabilityBlocks.id,
        spaceId: availabilityBlocks.spaceId,
        spaceName: spaces.name,
        spaceColor: spaces.color,
        startAt: availabilityBlocks.startAt,
        endAt: availabilityBlocks.endAt,
        type: availabilityBlocks.type,
        active: availabilityBlocks.active,
        expiresAt: availabilityBlocks.expiresAt,
      })
      .from(availabilityBlocks)
      .innerJoin(spaces, eq(availabilityBlocks.spaceId, spaces.id))
      .where(eq(availabilityBlocks.bookingId, id))
      .orderBy(desc(availabilityBlocks.active), asc(spaces.sortOrder)),
    db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, "booking"), eq(auditLog.entityId, id)))
      .orderBy(desc(auditLog.createdAt))
      .limit(50),
  ]);

  return {
    booking,
    customer: details.customer,
    items: details.items,
    extras: extraRows,
    payments: details.payments.map(({ raw: _raw, checkoutUrl: _url, ...p }) => p),
    emails: mails,
    blocks,
    audit,
  };
}

export type AdminBookingDetail = NonNullable<Awaited<ReturnType<typeof getAdminBookingDetail>>>;

// ---------------------------------------------------------------------------
// Booking update (status / payment / notes / review)
// ---------------------------------------------------------------------------
const STATUS_EMAIL: Partial<Record<BookingStatus, EmailTemplate>> = {
  confirmed: "booking_confirmed",
  cancelled: "booking_cancelled",
  reserved: "booking_changed",
  pending: "booking_changed",
  inquiry: "booking_changed",
};

export interface BookingUpdateResult {
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  blocksCreated: number;
  emailSent: EmailTemplate | null;
  changes: string[];
}

async function lockSpaces(db: Database, spaceIds: string[]): Promise<void> {
  for (const id of [...new Set(spaceIds)].sort()) {
    await db.execute(sql`select pg_advisory_xact_lock(hashtext(${"space:" + id}))`);
  }
}

async function findConflicts(db: Database, spaceId: string, start: Date, end: Date, excludeBookingId?: string) {
  return db
    .select({ id: availabilityBlocks.id, type: availabilityBlocks.type, reason: availabilityBlocks.reason, startAt: availabilityBlocks.startAt, endAt: availabilityBlocks.endAt })
    .from(availabilityBlocks)
    .where(
      and(
        eq(availabilityBlocks.spaceId, spaceId),
        eq(availabilityBlocks.active, true),
        lt(availabilityBlocks.startAt, end),
        gt(availabilityBlocks.endAt, start),
        excludeBookingId ? or(isNull(availabilityBlocks.bookingId), ne(availabilityBlocks.bookingId, excludeBookingId)) : undefined,
      ),
    )
    .limit(3);
}

function describeConflict(c: { reason: string | null; startAt: Date; endAt: Date }): string {
  return `${c.reason ?? "Belegung"}, ${formatDateTime(c.startAt)} – ${formatDateTime(c.endAt)} Uhr`;
}

export async function updateBookingByAdmin(db: Database, id: string, patch: AdminBookingUpdate, actor: string, now = Date.now()): Promise<BookingUpdateResult> {
  if (!isUuid(id)) throw new AdminError(404, "NOT_FOUND", "Buchung nicht gefunden.");
  const details = await getBookingDetails(db, id);
  if (!details) throw new AdminError(404, "NOT_FOUND", "Buchung nicht gefunden.");
  const b = details.booking;
  const from = b.status as BookingStatus;
  const to = patch.status as BookingStatus | undefined;
  const statusChange = to !== undefined && to !== from;
  if (statusChange && !canTransition(from, to)) {
    throw new AdminError(422, "INVALID_TRANSITION", `Statuswechsel von „${BOOKING_STATUS_LABEL[from]}“ zu „${BOOKING_STATUS_LABEL[to]}“ ist nicht erlaubt.`, {
      from,
      to,
    });
  }

  const spaceRows = await listSpaceRows(db, { includeInactive: true });
  const nameOf = (sid: string) => spaceRows.find((r) => r.id === sid)?.name ?? sid;
  const nowDate = new Date(now);
  const changes: string[] = [];
  let blocksCreated = 0;
  const set: Partial<typeof bookings.$inferInsert> = {};

  try {
    await db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Database;

      if (statusChange) {
        const blockType = statusBlocksAvailability(to);
        if (blockType) {
          const itemSpaceIds = details.items.map((i) => i.item.spaceId);
          await lockSpaces(tx, itemSpaceIds);
          await releaseExpiredHolds(tx, itemSpaceIds, nowDate);
          const existing = await tx
            .select({ spaceId: availabilityBlocks.spaceId })
            .from(availabilityBlocks)
            .where(and(eq(availabilityBlocks.bookingId, id), eq(availabilityBlocks.active, true)));
          const covered = new Set(existing.map((e) => e.spaceId));
          const missing = details.items.filter((i) => !covered.has(i.item.spaceId));

          for (const i of missing) {
            const row = spaceRows.find((r) => r.id === i.item.spaceId);
            // same effective range as createBooking(): handover/return widen the occupation
            const occupiedFrom = Math.min(i.item.startAt.getTime(), b.handoverAt?.getTime() ?? Number.POSITIVE_INFINITY);
            const until = Math.max(i.item.endAt.getTime(), b.returnAt?.getTime() ?? Number.NEGATIVE_INFINITY);
            const startAt = new Date(occupiedFrom - (row?.setupBufferMinutes ?? 0) * 60_000);
            const endAt = new Date(until + (row?.cleanupBufferMinutes ?? 0) * 60_000);
            const conflicts = await findConflicts(tx, i.item.spaceId, startAt, endAt, id);
            if (conflicts.length) {
              throw new AdminError(
                409,
                "SLOT_TAKEN",
                `Zeitraum inzwischen belegt: ${nameOf(i.item.spaceId)} (${describeConflict(conflicts[0]!)}).`,
                { spaceId: i.item.spaceId, conflicts: conflicts.map((c) => c.id) },
              );
            }
            try {
              await tx.insert(availabilityBlocks).values({
                spaceId: i.item.spaceId,
                startAt,
                endAt,
                type: blockType,
                reason: `${b.kind === "inquiry" ? "Anfrage" : "Buchung"} ${b.bookingNumber}`,
                bookingId: id,
                expiresAt: null,
                isDemo: b.isDemo,
                createdBy: `admin:${actor}`,
              });
            } catch (err) {
              if (isExclusionViolation(err)) {
                throw new AdminError(409, "SLOT_TAKEN", `Zeitraum inzwischen belegt: ${nameOf(i.item.spaceId)}.`, { spaceId: i.item.spaceId });
              }
              throw err;
            }
            blocksCreated++;
          }
          // a reservation set manually by the operator does not expire
          if (to === "reserved") {
            await tx
              .update(availabilityBlocks)
              .set({ expiresAt: null })
              .where(and(eq(availabilityBlocks.bookingId, id), eq(availabilityBlocks.active, true)));
          }
        }
        await applyBookingStatusToBlocks(tx, id, to);
        set.status = to;
        if (to === "cancelled") set.cancelledAt = nowDate;
        set.reviewedAt = b.reviewedAt ?? nowDate;
        changes.push("status");
        await writeAudit(tx, actor, "booking.status", "booking", id, { from, to, blocksCreated });
      }

      if (patch.paymentStatus && patch.paymentStatus !== b.paymentStatus) {
        set.paymentStatus = patch.paymentStatus;
        changes.push("paymentStatus");
        await writeAudit(tx, actor, "booking.payment_status", "booking", id, { from: b.paymentStatus, to: patch.paymentStatus });
      }

      if (patch.adminNotes !== undefined) {
        const notes = patch.adminNotes?.trim() ? patch.adminNotes.trim() : null;
        if (notes !== b.adminNotes) {
          set.adminNotes = notes;
          changes.push("adminNotes");
          await writeAudit(tx, actor, "booking.notes", "booking", id, { length: notes?.length ?? 0 });
        }
      }

      if (patch.markReviewed !== undefined) {
        const current = set.reviewedAt !== undefined ? set.reviewedAt : b.reviewedAt;
        const desired = patch.markReviewed ? (current ?? nowDate) : null;
        if ((desired?.getTime() ?? null) !== (current?.getTime() ?? null)) {
          set.reviewedAt = desired;
          changes.push("reviewed");
          await writeAudit(tx, actor, patch.markReviewed ? "booking.reviewed" : "booking.unreviewed", "booking", id);
        }
      }

      if (Object.keys(set).length) {
        await tx.update(bookings).set({ ...set, updatedAt: nowDate }).where(eq(bookings.id, id));
      }
    });
  } catch (err) {
    if (err instanceof AdminError) throw err;
    if (err instanceof InvalidTransitionError) throw new AdminError(422, "INVALID_TRANSITION", err.message);
    if (isExclusionViolation(err)) throw new AdminError(409, "SLOT_TAKEN", "Zeitraum inzwischen belegt – die Buchung konnte nicht bestätigt werden.");
    throw err;
  }

  // ---- notification (outside the transaction) -------------------------------
  let emailSent: EmailTemplate | null = null;
  if (statusChange && patch.notifyCustomer !== false) {
    const template = STATUS_EMAIL[to];
    if (template && details.customer) {
      const start = b.startAt.getTime();
      const end = b.endAt.getTime();
      await sendEmail(
        db,
        template,
        details.customer.email,
        {
          customerName: `${details.customer.firstName} ${details.customer.lastName}`,
          bookingNumber: b.bookingNumber,
          spaces: details.items.map((i) => i.spaceName),
          dateLabel: formatInstantDateLong(start),
          timeLabel: b.rentalMode === "daily" ? `${formatDateTime(start)} – ${formatDateTime(end)} Uhr` : formatTimeRange(start, end),
          totalLabel: formatMoney(b.total, "auf Anfrage"),
          handoverLabel: b.handoverAt ? `${formatDateTime(b.handoverAt)} Uhr` : undefined,
        },
        id,
      );
      emailSent = template;
    }
  }

  return {
    status: (set.status ?? from) as BookingStatus,
    paymentStatus: (set.paymentStatus ?? b.paymentStatus) as PaymentStatus,
    blocksCreated,
    emailSent,
    changes,
  };
}

// ---------------------------------------------------------------------------
// Manual availability blocks (Sperrzeiten)
// ---------------------------------------------------------------------------
export interface ManualBlockInput {
  spaceIds: string[];
  date: LocalDate;
  endDate?: LocalDate | null;
  startTime: string;
  endTime: string;
  type: "blocked" | "maintenance" | "reserved" | "booked";
  reason: string;
}

export function manualBlockInterval(input: Pick<ManualBlockInput, "date" | "endDate" | "startTime" | "endTime">): { start: number; end: number } {
  if (input.endDate && input.endDate !== input.date) {
    if (input.endDate < input.date) throw new AdminError(422, "INVALID_RANGE", "Das Enddatum liegt vor dem Startdatum.");
    return { start: zonedDateTimeToUtc(input.date, input.startTime), end: zonedDateTimeToUtc(input.endDate, input.endTime) };
  }
  // same day; an end time before the start time means "until the next morning"
  return localRangeToInterval(input.date, input.startTime, input.endTime);
}

export async function createManualBlocks(db: Database, input: ManualBlockInput, actor: string, now = Date.now()) {
  const spaceIds = [...new Set(input.spaceIds)];
  const rows = await listSpaceRows(db, { includeInactive: true });
  const unknown = spaceIds.filter((id) => !rows.some((r) => r.id === id));
  if (unknown.length) throw new AdminError(422, "INVALID_SPACE", `Unbekannter Bereich: ${unknown.join(", ")}`);
  const nameOf = (sid: string) => rows.find((r) => r.id === sid)?.name ?? sid;

  const { start, end } = manualBlockInterval(input);
  if (!(end > start)) throw new AdminError(422, "INVALID_RANGE", "Das Ende muss nach dem Beginn liegen.");
  if (end - start > 400 * 86_400_000) throw new AdminError(422, "INVALID_RANGE", "Eine Sperrzeit darf höchstens 400 Tage lang sein.");
  const startAt = new Date(start);
  const endAt = new Date(end);

  try {
    return await db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as Database;
      await lockSpaces(tx, spaceIds);
      await releaseExpiredHolds(tx, spaceIds, new Date(now));
      const created: Array<{ id: string; spaceId: string }> = [];
      for (const spaceId of spaceIds) {
        const conflicts = await findConflicts(tx, spaceId, startAt, endAt);
        if (conflicts.length) {
          throw new AdminError(409, "SLOT_TAKEN", `${nameOf(spaceId)} ist in diesem Zeitraum bereits belegt (${describeConflict(conflicts[0]!)}).`, {
            spaceId,
          });
        }
        try {
          const [row] = await tx
            .insert(availabilityBlocks)
            .values({ spaceId, startAt, endAt, type: input.type, reason: input.reason.trim(), isDemo: false, createdBy: `admin:${actor}` })
            .returning({ id: availabilityBlocks.id, spaceId: availabilityBlocks.spaceId });
          created.push(row!);
        } catch (err) {
          if (isExclusionViolation(err)) {
            throw new AdminError(409, "SLOT_TAKEN", `${nameOf(spaceId)} ist in diesem Zeitraum bereits belegt.`, { spaceId });
          }
          throw err;
        }
      }
      await writeAudit(tx, actor, "block.create", "availability_block", created.map((c) => c.id).join(","), {
        spaceIds,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        type: input.type,
        reason: input.reason,
      });
      return { created, start, end };
    });
  } catch (err) {
    if (err instanceof AdminError) throw err;
    if (isExclusionViolation(err)) throw new AdminError(409, "SLOT_TAKEN", "Der Zeitraum ist inzwischen belegt.");
    throw err;
  }
}

export async function deactivateBlock(db: Database, id: string, actor: string) {
  if (!isUuid(id)) throw new AdminError(404, "NOT_FOUND", "Sperrzeit nicht gefunden.");
  const [block] = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.id, id));
  if (!block) throw new AdminError(404, "NOT_FOUND", "Sperrzeit nicht gefunden.");
  if (block.bookingId) {
    const [bk] = await db.select({ n: bookings.bookingNumber }).from(bookings).where(eq(bookings.id, block.bookingId));
    throw new AdminError(422, "BOOKING_BLOCK", `Diese Belegung gehört zu ${bk?.n ?? "einer Buchung"} – bitte über die Buchung stornieren.`);
  }
  if (block.active) {
    await db.update(availabilityBlocks).set({ active: false }).where(eq(availabilityBlocks.id, id));
    await writeAudit(db, actor, "block.delete", "availability_block", id, { spaceId: block.spaceId, reason: block.reason });
  }
  return { id, active: false };
}

export interface AdminBlockView {
  id: string;
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  start: number;
  end: number;
  type: "reserved" | "booked" | "blocked" | "maintenance";
  reason: string | null;
  isDemo: boolean;
  createdBy: string | null;
  createdAt: number;
}

export async function listManualBlocks(db: Database, options: { now?: number; includePast?: boolean } = {}): Promise<AdminBlockView[]> {
  const now = options.now ?? Date.now();
  const rows = await db
    .select({ block: availabilityBlocks, spaceName: spaces.name, spaceColor: spaces.color })
    .from(availabilityBlocks)
    .innerJoin(spaces, eq(availabilityBlocks.spaceId, spaces.id))
    .where(
      and(
        isNull(availabilityBlocks.bookingId),
        eq(availabilityBlocks.active, true),
        options.includePast ? undefined : gte(availabilityBlocks.endAt, new Date(now - 86_400_000)),
      ),
    )
    .orderBy(asc(availabilityBlocks.startAt))
    .limit(300);
  return rows.map(({ block: b, spaceName, spaceColor }) => ({
    id: b.id,
    spaceId: b.spaceId,
    spaceName,
    spaceColor,
    start: b.startAt.getTime(),
    end: b.endAt.getTime(),
    type: b.type,
    reason: b.reason,
    isDemo: b.isDemo,
    createdBy: b.createdBy,
    createdAt: b.createdAt.getTime(),
  }));
}

// ---------------------------------------------------------------------------
// Resource calendar
// ---------------------------------------------------------------------------
export interface CalendarBar {
  id: string;
  spaceId: string;
  start: number;
  end: number;
  type: "reserved" | "booked" | "blocked" | "maintenance" | "inquiry";
  reason: string | null;
  isDemo: boolean;
  expiresAt: number | null;
  booking: { id: string; number: string; status: BookingStatus; customer: string } | null;
  manual: boolean;
  createdBy: string | null;
}

export async function getCalendarData(db: Database, from: LocalDate, days: number, now = Date.now()) {
  const to = addDays(from, days - 1);
  const range = { start: dayBounds(from).start, end: dayBounds(to).end };
  const rangeStart = new Date(range.start);
  const rangeEnd = new Date(range.end);
  const spaceRows = await listSpaceRows(db);

  const blockRows = await db
    .select({
      block: availabilityBlocks,
      bookingNumber: bookings.bookingNumber,
      bookingStatus: bookings.status,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(availabilityBlocks)
    .leftJoin(bookings, eq(availabilityBlocks.bookingId, bookings.id))
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .where(
      and(
        eq(availabilityBlocks.active, true),
        lt(availabilityBlocks.startAt, rangeEnd),
        gt(availabilityBlocks.endAt, rangeStart),
        or(isNull(availabilityBlocks.expiresAt), gt(availabilityBlocks.expiresAt, new Date(now))),
      ),
    )
    .orderBy(asc(availabilityBlocks.startAt));

  // open inquiries without a hold do not occupy anything – shown as outlines only
  const inquiryRows = await db
    .select({
      itemId: bookingItems.id,
      spaceId: bookingItems.spaceId,
      startAt: bookingItems.startAt,
      endAt: bookingItems.endAt,
      bookingId: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      isDemo: bookings.isDemo,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(bookingItems)
    .innerJoin(bookings, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(
      and(
        eq(bookings.status, "inquiry"),
        lt(bookingItems.startAt, rangeEnd),
        gt(bookingItems.endAt, rangeStart),
        sql`not exists (select 1 from availability_blocks ab where ab.booking_id = ${bookings.id} and ab.active)`,
      ),
    );

  const bars: CalendarBar[] = [
    ...blockRows.map(({ block: b, bookingNumber, bookingStatus, firstName, lastName }) => ({
      id: b.id,
      spaceId: b.spaceId,
      start: b.startAt.getTime(),
      end: b.endAt.getTime(),
      type: b.type,
      reason: b.reason,
      isDemo: b.isDemo,
      expiresAt: b.expiresAt?.getTime() ?? null,
      booking:
        b.bookingId && bookingNumber
          ? { id: b.bookingId, number: bookingNumber, status: bookingStatus as BookingStatus, customer: `${firstName ?? ""} ${lastName ?? ""}`.trim() }
          : null,
      manual: !b.bookingId,
      createdBy: b.createdBy,
    })),
    ...inquiryRows.map((r) => ({
      id: `inq-${r.itemId}`,
      spaceId: r.spaceId,
      start: r.startAt.getTime(),
      end: r.endAt.getTime(),
      type: "inquiry" as const,
      reason: "Offene Anfrage (blockiert nicht)",
      isDemo: r.isDemo,
      expiresAt: null,
      booking: { id: r.bookingId, number: r.bookingNumber, status: r.status as BookingStatus, customer: `${r.firstName} ${r.lastName}` },
      manual: false,
      createdBy: null,
    })),
  ];

  return {
    from,
    to,
    days,
    spaces: spaceRows.map((s) => ({ id: s.id, name: s.name, code: s.code, color: s.color, bookable: s.bookable })),
    bars,
  };
}

export type CalendarData = Awaited<ReturnType<typeof getCalendarData>>;
