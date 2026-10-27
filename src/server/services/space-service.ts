import { asc, eq } from "drizzle-orm";
import { siteScope } from "@/config/scope";
import type { Space } from "@/domain/types";
import type { SpaceView } from "@/features/spaces/types";
import { getDb, type Database } from "@/server/db/client";
import { spaceFeatures, spaces, type SpaceRow } from "@/server/db/schema";
import { toSpaceView } from "./space-view";

/**
 * spaceService – read/write access to spaces ("Bereiche").
 */

export function rowToSpace(row: SpaceRow, features: string[] = []): Space {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    name: row.name,
    type: row.type,
    level: row.level as Space["level"],
    shortDescription: row.shortDescription,
    longDescription: row.longDescription,
    areaSqm: row.areaSqm,
    capacityStanding: row.capacityStanding,
    capacitySeated: row.capacitySeated,
    features,
    usageOptions: row.usageOptions,
    rules: row.rules,
    images: [],
    videos: [],
    color: row.color,
    basePrice: row.basePrice,
    priceModel: row.priceModel,
    deposit: row.deposit,
    cleaningFee: row.cleaningFee,
    minimumDurationMinutes: row.minimumDurationMinutes,
    maximumDurationMinutes: row.maximumDurationMinutes,
    advanceBookingMinHours: row.advanceBookingMinHours,
    advanceBookingMaxDays: row.advanceBookingMaxDays,
    setupBufferMinutes: row.setupBufferMinutes,
    cleanupBufferMinutes: row.cleanupBufferMinutes,
    availableForStandaloneRental: row.availableForStandaloneRental,
    includedInFullVenue: row.includedInFullVenue,
    requires: row.requires,
    incompatibleWith: row.incompatibleWith,
    bookingMode: row.bookingMode,
    bookable: row.bookable,
    sortOrder: row.sortOrder,
    active: row.active,
    needsVerification: row.needsVerification,
  };
}

export async function listSpaceRows(db: Database, options: { includeInactive?: boolean } = {}): Promise<SpaceRow[]> {
  const rows = await db.select().from(spaces).orderBy(asc(spaces.sortOrder));
  return options.includeInactive ? rows : rows.filter((r) => r.active);
}

async function featuresBySpace(db: Database): Promise<Map<string, string[]>> {
  const rows = await db.select().from(spaceFeatures).orderBy(asc(spaceFeatures.sortOrder));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.spaceId, [...(map.get(r.spaceId) ?? []), r.label]);
  return map;
}

export async function listSpaces(db?: Database, options: { includeInactive?: boolean } = {}): Promise<Space[]> {
  const d = db ?? (await getDb());
  const [rows, feats] = await Promise.all([listSpaceRows(d, options), featuresBySpace(d)]);
  return rows.map((r) => rowToSpace(r, feats.get(r.id) ?? []));
}

/** Price-related facts of a space – never part of a public view while prices are hidden. */
const PRICE_FACTS = new Set<string>(["basePrice", "priceModel", "deposit", "cleaningFee"]);

/**
 * The public face of a space. With `siteScope.showPrices === false` every
 * amount (rent, deposit, cleaning fee) is removed and the price model reads
 * "on_request" – so nothing priced reaches the browser, neither as rendered
 * text nor inside the props serialised into the RSC payload or an API answer.
 * Prices stay in the database and in the admin for internal quotes.
 */
export function toPublicSpaceView(view: SpaceView): SpaceView {
  if (siteScope.showPrices) return view;
  return {
    ...view,
    basePrice: null,
    priceModel: "on_request",
    deposit: null,
    cleaningFee: null,
    needsVerification: view.needsVerification.filter((f) => !PRICE_FACTS.has(f)),
  };
}

/**
 * Spaces as the pages and public APIs receive them. Public by default (see
 * toPublicSpaceView); internal callers that need the amounts pass
 * `includePrices: true` – never hand such a view to a client component.
 */
export async function listSpaceViews(db?: Database, options: { includeInactive?: boolean; includePrices?: boolean } = {}): Promise<SpaceView[]> {
  const d = db ?? (await getDb());
  const [rows, feats] = await Promise.all([listSpaceRows(d, options), featuresBySpace(d)]);
  const views = rows.map((r) =>
    toSpaceView(rowToSpace(r, feats.get(r.id) ?? []), r.mediaFolder, {
      polygon: r.polygonOverride ?? null,
      labelPosition: r.labelPositionOverride ?? null,
    }),
  );
  return options.includePrices ? views : views.map(toPublicSpaceView);
}

/** Explicit name for the public list – identical to listSpaceViews() without `includePrices`. */
export function listPublicSpaceViews(db?: Database, options: { includeInactive?: boolean } = {}): Promise<SpaceView[]> {
  return listSpaceViews(db, { includeInactive: options.includeInactive });
}

export async function getSpaceViewBySlug(slug: string, db?: Database): Promise<SpaceView | null> {
  const all = await listSpaceViews(db);
  return all.find((s) => s.slug === slug) ?? null;
}

export async function getSpaceRow(db: Database, id: string): Promise<SpaceRow | null> {
  const [row] = await db.select().from(spaces).where(eq(spaces.id, id));
  return row ?? null;
}
