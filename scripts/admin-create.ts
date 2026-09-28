/**
 * npm run admin:create                      → asks for e-mail and password
 * npm run admin:create -- --email x@y.de    → asks only for the password
 * npm run admin:create -- --email x@y.de --password '…' [--name "Vorname Name"] [--role owner|staff]
 *
 * Creates an admin account or sets a new password for an existing one.
 * The password is stored as scrypt hash only; it is never printed.
 * Tip: prefer the interactive prompt – passwords given as arguments may end
 * up in the shell history.
 */
import { z } from "zod";
import { createPrompter, describeTarget, guardEmbeddedDb, loadEnv, parseArgs } from "../src/server/services/admin-cli";

async function main() {
  await loadEnv();
  const { flags, values } = parseArgs();
  await guardEmbeddedDb(flags.has("force"));

  let email = values.email ?? "";
  let password = values.password ?? "";
  if (!email || !password) {
    const prompter = createPrompter();
    try {
      if (!email) email = await prompter.ask("E-Mail-Adresse: ");
      if (!password) {
        password = await prompter.ask("Passwort (mind. 10 Zeichen): ", { hidden: true });
        const repeat = await prompter.ask("Passwort wiederholen: ", { hidden: true });
        if (password !== repeat) throw new Error("Die Passwörter stimmen nicht überein.");
      }
    } finally {
      prompter.close();
    }
  }
  const parsedEmail = z.string().trim().toLowerCase().email().max(160).safeParse(email);
  if (!parsedEmail.success) throw new Error("Ungültige E-Mail-Adresse.");
  email = parsedEmail.data;
  if (password.length < 10) throw new Error("Das Passwort muss mindestens 10 Zeichen lang sein.");
  if (password.length > 200) throw new Error("Das Passwort ist zu lang (max. 200 Zeichen).");

  const role = values.role === "staff" ? "staff" : values.role === undefined || values.role === "owner" ? "owner" : null;
  if (!role) throw new Error("--role muss owner oder staff sein.");

  const { eq } = await import("drizzle-orm");
  const { getDb, closeDb } = await import("../src/server/db/client");
  const { adminUsers, auditLog } = await import("../src/server/db/schema");
  const { hashPassword } = await import("../src/server/auth/password");

  console.info(`→ ${describeTarget()}`);
  const db = await getDb();
  try {
    const passwordHash = await hashPassword(password);
    const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email));
    if (existing) {
      await db
        .update(adminUsers)
        .set({ passwordHash, ...(values.name ? { name: values.name } : {}), ...(values.role ? { role } : {}) })
        .where(eq(adminUsers.id, existing.id));
      await db.insert(auditLog).values({ actor: "cli", action: "admin.password_reset", entity: "admin_user", entityId: existing.id });
      console.info(`✔ Passwort für ${email} wurde aktualisiert.`);
    } else {
      const [created] = await db
        .insert(adminUsers)
        .values({ email, passwordHash, name: values.name ?? null, role })
        .returning({ id: adminUsers.id });
      await db.insert(auditLog).values({ actor: "cli", action: "admin.create", entity: "admin_user", entityId: created?.id ?? null });
      console.info(`✔ Admin-Zugang ${email} (${role}) wurde angelegt. Anmeldung unter /admin/login.`);
    }
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("✖", (err as { cause?: { message?: string } })?.cause?.message ?? (err instanceof Error ? err.message.split("\n")[0] : err));
  process.exit(1);
});
