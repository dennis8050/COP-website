import { readFile } from "node:fs/promises";
import { db } from "./database.js";
export async function handler(event: { bootstrap_admin_sub?: string } = {}) {
  const c = await (await db()).connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(932174)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now())",
    );
    const existing = await c.query(
      "SELECT 1 FROM schema_migrations WHERE version='001'",
    );
    if (!existing.rowCount) {
      await c.query(
        await readFile(
          new URL(
            process.env.AWS_LAMBDA_FUNCTION_NAME
              ? "./001_initial.sql"
              : "../database/001_initial.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await c.query("INSERT INTO schema_migrations(version) VALUES('001')");
    }
    if (event.bootstrap_admin_sub) {
      const admins = await c.query(
        "SELECT id FROM users WHERE role='ADMIN' AND status='active'",
      );
      if (admins.rowCount) throw new Error("Administrator already exists");
      const promoted = await c.query(
        "UPDATE users SET role='ADMIN' WHERE cognito_sub=$1 RETURNING id",
        [event.bootstrap_admin_sub],
      );
      if (!promoted.rowCount)
        throw new Error("Verified account does not exist");
    }
    await c.query("COMMIT");
    return { success: true };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  await handler();
  await (await db()).end();
}
