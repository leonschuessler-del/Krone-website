import { randomBytes } from "node:crypto";
import { asc, count, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { WeeklyHours } from "@/domain/availability";
import type { Database } from "@/server/db/client";
import {
  bookingExtras,
  bookings,
  bundlePricingRules,
  contactMessages,
  emailLog,
  extras as extrasTable,
  handoverSlots,
  pricingRules,
  spaceFeatures,
  spaces,
} from "@/server/db/schema";
import type { adminSpacePatchSchema } from "@/server/validation";
import { AdminError, isUuid, writeAudit } from "./admin-service";
import type { bundleRuleSchema, extraSchema, handoverSlotPatchSchema, handoverSlotSchema, pricingRuleSchema, settingsPatchSchema } from "./admin-validation";
import { getVenueSettings, updateSetting, type VenueSettings } from "./settings-service";
import { getSpaceRow, listSpaceRows } from "./space-service";

/**
 * adminCatalogService – master data maintained in the admin:
 * spaces, pricing rules, bundle prices, extras, handover slots, settings,
 * e-mail log and contact messages.
 */

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "eintrag"
  );
}

const newId = (prefix: string, label: string) => `${prefix}-${slugify(label)}-${randomBytes(3).toString("hex")}`;

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------
export type AdminSpacePatch = z.infer<typeof adminSpacePatchSchema>;

export async function getAdminSpace(db: Database, id: string) {
  const row = await getSpaceRow(db, id);
  if (!row) return null;
  const features = await db.select().from(spaceFeatures).where(eq(spaceFeatures.spaceId, id)).orderBy(asc(spaceFeatures.sortOrder));
  return { space: row, features };
}

export async function listAdminSpaces(db: Database) {
  const rows = await listSpaceRows(db, { includeInactive: true });
  const feats = await db.select({ spaceId: spaceFeatures.spaceId, n: count() }).from(spaceFeatures).groupBy(spaceFeatures.spaceId);
  return rows.map((r) => ({ ...r, featureCount: Number(feats.find((f) => f.spaceId === r.id)?.n ?? 0) }));
}

export async function updateSpaceByAdmin(db: Database, id: string, patch: AdminSpacePatch, actor: string) {
  const row = await getSpaceRow(db, id);
  if (!row) throw new AdminError(404, "NOT_FOUND", "Bereich nicht gefunden.");
  const { features, ...fields } = patch;

  const min = fields.minimumDurationMinutes !== undefined ? fields.minimumDurationMinutes : row.minimumDurationMinutes;
  const max = fields.maximumDurationMinutes !== undefined ? fields.maximumDurationMinutes : row.maximumDurationMinutes;
  if (min !== null && max !== null && max < min) {
    throw new AdminError(422, "VALIDATION_ERROR", "Die Höchstdauer darf nicht kleiner als die Mindestdauer sein.", { maximumDurationMinutes: "Kleiner als Mindestdauer" });
  }
  if (fields.name !== undefined && !fields.name.trim()) throw new AdminError(422, "VALIDATION_ERROR", "Bitte einen Namen angeben.");

  const update: Partial<typeof spaces.$inferInsert> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    (update as Record<string, unknown>)[key] = typeof value === "string" && key !== "color" && key !== "name" ? value || null : value;
  }
  if (fields.needsVerification) update.needsVerification = [...new Set(fields.needsVerification)];

  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Database;
    if (Object.keys(update).length) await tx.update(spaces).set({ ...update, updatedAt: new Date() }).where(eq(spaces.id, id));
    if (features !== undefined) {
      await tx.delete(spaceFeatures).where(eq(spaceFeatures.spaceId, id));
      const unique = [...new Set(features.map((f) => f.trim()).filter(Boolean))];
      if (unique.length) {
        await tx.insert(spaceFeatures).values(unique.map((label, i) => ({ spaceId: id, label, confirmed: true, sortOrder: (i + 1) * 10 })));
      }
    }
    await writeAudit(tx, actor, "space.update", "space", id, {
      fields: [...Object.keys(update), ...(features !== undefined ? ["features"] : [])],
    });
  });
  return getAdminSpace(db, id);
}

// ---------------------------------------------------------------------------
// Pricing rules
// ---------------------------------------------------------------------------
type PricingRuleInput = z.infer<typeof pricingRuleSchema>;

async function assertSpaces(db: Database, ids: string[]) {
  const rows = await listSpaceRows(db, { includeInactive: true });
  const unknown = ids.filter((id) => !rows.some((r) => r.id === id));
  if (unknown.length) throw new AdminError(422, "INVALID_SPACE", `Unbekannter Bereich: ${unknown.join(", ")}`);
}

export async function listPricingData(db: Database) {
  const [rules, bundles, extraRows, spaceRows] = await Promise.all([
    db.select().from(pricingRules).orderBy(asc(pricingRules.spaceId), desc(pricingRules.priority)),
    db.select().from(bundlePricingRules).orderBy(desc(bundlePricingRules.priority)),
    db.select().from(extrasTable).orderBy(asc(extrasTable.sortOrder)),
    listSpaceRows(db, { includeInactive: true }),
  ]);
  return {
    rules,
    bundles,
    extras: extraRows,
    spaces: spaceRows.map((s) => ({ id: s.id, name: s.name, code: s.code, color: s.color, bookable: s.bookable, active: s.active })),
  };
}

export async function createPricingRule(db: Database, input: PricingRuleInput, actor: string) {
  await assertSpaces(db, [input.spaceId]);
  const id = newId("rule", `${input.spaceId}-${input.label}`);
  const [row] = await db
    .insert(pricingRules)
    .values({ ...input, id, weekdays: input.weekdays?.length ? input.weekdays : null, isDemo: input.isDemo ?? false })
    .returning();
  await writeAudit(db, actor, "pricing_rule.create", "pricing_rule", id, input);
  return row!;
}

export async function updatePricingRule(db: Database, id: string, input: PricingRuleInput, actor: string) {
  await assertSpaces(db, [input.spaceId]);
  const [row] = await db
    .update(pricingRules)
    .set({ ...input, weekdays: input.weekdays?.length ? input.weekdays : null, isDemo: input.isDemo ?? undefined })
    .where(eq(pricingRules.id, id))
    .returning();
  if (!row) throw new AdminError(404, "NOT_FOUND", "Preisregel nicht gefunden.");
  await writeAudit(db, actor, "pricing_rule.update", "pricing_rule", id, input);
  return row;
}

export async function deletePricingRule(db: Database, id: string, actor: string) {
  const [row] = await db.delete(pricingRules).where(eq(pricingRules.id, id)).returning({ id: pricingRules.id });
  if (!row) throw new AdminError(404, "NOT_FOUND", "Preisregel nicht gefunden.");
  await writeAudit(db, actor, "pricing_rule.delete", "pricing_rule", id);
  return { id, deleted: true };
}

// ---------------------------------------------------------------------------
// Bundle pricing rules
// ---------------------------------------------------------------------------
type BundleRuleInput = z.infer<typeof bundleRuleSchema>;

export async function createBundleRule(db: Database, input: BundleRuleInput, actor: string) {
  await assertSpaces(db, input.spaceIds);
  const id = newId("bundle", input.name);
  const [row] = await db
    .insert(bundlePricingRules)
    .values({ ...input, id, spaceIds: [...new Set(input.spaceIds)], isDemo: input.isDemo ?? false })
    .returning();
  await writeAudit(db, actor, "bundle_rule.create", "bundle_pricing_rule", id, input);
  return row!;
}

export async function updateBundleRule(db: Database, id: string, input: BundleRuleInput, actor: string) {
  await assertSpaces(db, input.spaceIds);
  const [row] = await db
    .update(bundlePricingRules)
    .set({ ...input, spaceIds: [...new Set(input.spaceIds)], isDemo: input.isDemo ?? undefined })
    .where(eq(bundlePricingRules.id, id))
    .returning();
  if (!row) throw new AdminError(404, "NOT_FOUND", "Kombi-Preis nicht gefunden.");
  await writeAudit(db, actor, "bundle_rule.update", "bundle_pricing_rule", id, input);
  return row;
}

export async function deleteBundleRule(db: Database, id: string, actor: string) {
  const [row] = await db.delete(bundlePricingRules).where(eq(bundlePricingRules.id, id)).returning({ id: bundlePricingRules.id });
  if (!row) throw new AdminError(404, "NOT_FOUND", "Kombi-Preis nicht gefunden.");
  await writeAudit(db, actor, "bundle_rule.delete", "bundle_pricing_rule", id);
  return { id, deleted: true };
}

// ---------------------------------------------------------------------------
// Extras
// ---------------------------------------------------------------------------
type ExtraInput = z.infer<typeof extraSchema>;

export async function createExtra(db: Database, input: ExtraInput, actor: string) {
  const id = newId("extra", input.name);
  const [row] = await db
    .insert(extrasTable)
    .values({ ...input, id, description: input.description || null, isDemo: input.isDemo ?? false })
    .returning();
  await writeAudit(db, actor, "extra.create", "extra", id, input);
  return row!;
}

export async function updateExtra(db: Database, id: string, input: ExtraInput, actor: string) {
  const [row] = await db
    .update(extrasTable)
    .set({ ...input, description: input.description || null, isDemo: input.isDemo ?? undefined })
    .where(eq(extrasTable.id, id))
    .returning();
  if (!row) throw new AdminError(404, "NOT_FOUND", "Zusatzleistung nicht gefunden.");
  await writeAudit(db, actor, "extra.update", "extra", id, input);
  return row;
}

/** Extras used by bookings cannot be deleted (history) – they are deactivated instead. */
export async function deleteExtra(db: Database, id: string, actor: string) {
  const [existing] = await db.select({ id: extrasTable.id }).from(extrasTable).where(eq(extrasTable.id, id));
  if (!existing) throw new AdminError(404, "NOT_FOUND", "Zusatzleistung nicht gefunden.");
  const [used] = await db.select({ n: count() }).from(bookingExtras).where(eq(bookingExtras.extraId, id));
  if (Number(used?.n ?? 0) > 0) {
    await db.update(extrasTable).set({ active: false }).where(eq(extrasTable.id, id));
    await writeAudit(db, actor, "extra.deactivate", "extra", id, { reason: "used_by_bookings" });
    return { id, deleted: false, deactivated: true };
  }
  await db.delete(extrasTable).where(eq(extrasTable.id, id));
  await writeAudit(db, actor, "extra.delete", "extra", id);
  return { id, deleted: true, deactivated: false };
}

// ---------------------------------------------------------------------------
// Handover / return slots
// ---------------------------------------------------------------------------
type HandoverSlotInput = z.infer<typeof handoverSlotSchema>;
type HandoverSlotPatch = z.infer<typeof handoverSlotPatchSchema>;

export async function listHandoverSlots(db: Database) {
  return db.select().from(handoverSlots).orderBy(asc(handoverSlots.kind), asc(handoverSlots.time));
}

export async function createHandoverSlot(db: Database, input: HandoverSlotInput, actor: string) {
  const id = newId(input.kind === "handover" ? "slot-handover" : "slot-return", input.time.replace(":", ""));
  const [row] = await db
    .insert(handoverSlots)
    .values({ id, kind: input.kind, time: input.time, weekdays: input.weekdays?.length ? input.weekdays : null, label: input.label || `${input.time} Uhr`, active: input.active })
    .returning();
  await writeAudit(db, actor, "handover_slot.create", "handover_slot", id, input);
  return row!;
}

export async function updateHandoverSlot(db: Database, id: string, patch: HandoverSlotPatch, actor: string) {
  const set: Partial<typeof handoverSlots.$inferInsert> = {};
  if (patch.time !== undefined) set.time = patch.time;
  if (patch.weekdays !== undefined) set.weekdays = patch.weekdays?.length ? patch.weekdays : null;
  if (patch.label !== undefined) set.label = patch.label || null;
  if (patch.active !== undefined) set.active = patch.active;
  if (Object.keys(set).length === 0) throw new AdminError(422, "VALIDATION_ERROR", "Keine Änderungen übermittelt.");
  const [row] = await db.update(handoverSlots).set(set).where(eq(handoverSlots.id, id)).returning();
  if (!row) throw new AdminError(404, "NOT_FOUND", "Zeitfenster nicht gefunden.");
  await writeAudit(db, actor, "handover_slot.update", "handover_slot", id, patch);
  return row;
}

export async function deleteHandoverSlot(db: Database, id: string, actor: string) {
  const [row] = await db.delete(handoverSlots).where(eq(handoverSlots.id, id)).returning({ id: handoverSlots.id });
  if (!row) throw new AdminError(404, "NOT_FOUND", "Zeitfenster nicht gefunden.");
  await writeAudit(db, actor, "handover_slot.delete", "handover_slot", id);
  return { id, deleted: true };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export async function updateSettingsByAdmin(db: Database, patch: SettingsPatch, actor: string): Promise<VenueSettings> {
  const keys: string[] = [];
  if (patch.bookableHours) {
    const weeklyHours: WeeklyHours = {};
    for (const [day, windows] of Object.entries(patch.bookableHours.weeklyHours)) weeklyHours[Number(day)] = windows ?? [];
    await updateSetting(db, "bookableHours", { ...patch.bookableHours, weeklyHours });
    keys.push("bookableHours");
  }
  if (patch.paymentPolicy) {
    const p = patch.paymentPolicy;
    await updateSetting(db, "paymentPolicy", { ...p, downPaymentPercent: p.mode === "down_payment" ? p.downPaymentPercent : null });
    keys.push("paymentPolicy");
  }
  if (patch.holds) {
    await updateSetting(db, "holds", patch.holds);
    keys.push("holds");
  }
  if (keys.length === 0) throw new AdminError(422, "VALIDATION_ERROR", "Keine Änderungen übermittelt.");
  await writeAudit(db, actor, "settings.update", "settings", keys.join(","), patch);
  return getVenueSettings(db);
}

// ---------------------------------------------------------------------------
// E-mail log & contact messages
// ---------------------------------------------------------------------------
export async function listEmailLog(db: Database, limit = 200) {
  return db
    .select({
      id: emailLog.id,
      template: emailLog.template,
      to: emailLog.to,
      subject: emailLog.subject,
      status: emailLog.status,
      error: emailLog.error,
      createdAt: emailLog.createdAt,
      bookingId: emailLog.bookingId,
      bookingNumber: bookings.bookingNumber,
    })
    .from(emailLog)
    .leftJoin(bookings, eq(emailLog.bookingId, bookings.id))
    .orderBy(desc(emailLog.createdAt))
    .limit(limit);
}

export async function getEmail(db: Database, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({ mail: emailLog, bookingNumber: bookings.bookingNumber })
    .from(emailLog)
    .leftJoin(bookings, eq(emailLog.bookingId, bookings.id))
    .where(eq(emailLog.id, id));
  return row ?? null;
}

export async function listContactMessages(db: Database, limit = 200) {
  return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(limit);
}

export async function setContactMessageHandled(db: Database, id: string, handled: boolean, actor: string) {
  if (!isUuid(id)) throw new AdminError(404, "NOT_FOUND", "Nachricht nicht gefunden.");
  const [row] = await db
    .update(contactMessages)
    .set({ handledAt: handled ? new Date() : null })
    .where(eq(contactMessages.id, id))
    .returning({ id: contactMessages.id, handledAt: contactMessages.handledAt });
  if (!row) throw new AdminError(404, "NOT_FOUND", "Nachricht nicht gefunden.");
  await writeAudit(db, actor, handled ? "contact.handled" : "contact.reopened", "contact_message", id);
  return row;
}
