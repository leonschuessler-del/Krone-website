import { asc, eq } from "drizzle-orm";
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

export async function listSpaceViews(db?: Database, options: { includeInactive?: boolean } = {}): Promise<SpaceView[]> {
  const d = db ?? (await getDb());
  const [rows, feats] = await Promise.all([listSpaceRows(d, options), featuresBySpace(d)]);
  return rows.map((r) =>
    toSpaceView(rowToSpace(r, feats.get(r.id) ?? []), r.mediaFolder, {
      polygon: r.polygonOverride ?? null,
      labelPosition: r.labelPositionOverride ?? null,
    }),
  );
}

export async function getSpaceViewBySlug(slug: string, db?: Database): Promise<SpaceView | null> {
  const all = await listSpaceViews(db);
  return all.find((s) => s.slug === slug) ?? null;
}

export async function getSpaceRow(db: Database, id: string): Promise<SpaceRow | null> {
  const [row] = await db.select().from(spaces).where(eq(spaces.id, id));
  return row ?? null;
}
