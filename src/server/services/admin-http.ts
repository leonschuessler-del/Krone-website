import { revalidatePath } from "next/cache";
import { InvalidTransitionError } from "@/domain/booking";
import { errorJson, handleServiceError } from "@/server/http";
import { AdminError, isExclusionViolation, pgErrorCode } from "./admin-service";

/** Error mapping shared by all admin route handlers. */
export function handleAdminError(err: unknown) {
  if (err instanceof AdminError) return errorJson(err.status, err.code, err.message, err.details);
  if (err instanceof InvalidTransitionError) return errorJson(422, "INVALID_TRANSITION", err.message);
  if (isExclusionViolation(err)) return errorJson(409, "SLOT_TAKEN", "Zeitraum inzwischen belegt.");
  const code = pgErrorCode(err);
  if (code === "23503") return errorJson(409, "IN_USE", "Der Datensatz wird noch verwendet und kann nicht gelöscht werden.");
  if (code === "23505") return errorJson(409, "DUPLICATE", "Ein Eintrag mit diesen Daten existiert bereits.");
  return handleServiceError(err);
}

/** Public pages read spaces/prices/settings from the DB – drop cached renders after admin edits. */
export function revalidatePublicPages(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    // outside a request context (tests, scripts) – nothing to revalidate
  }
}
