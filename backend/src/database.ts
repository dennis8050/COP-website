import pg from "pg";
import { readFileSync } from "node:fs";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
let pool: pg.Pool | undefined;
let expiresAt = 0;
export async function db() {
  if (pool && (!expiresAt || Date.now() < expiresAt)) return pool;
  if (pool) {
    await pool.end();
    pool = undefined;
  }
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL)
    throw new Error("Production must use Secrets Manager");
  if (process.env.DATABASE_URL?.startsWith("pglite://")) {
    if (process.env.NODE_ENV !== "development")
      throw new Error("PGlite is development-only");
    pool = await (
      await import("./local-database.js")
    ).localDatabase(process.env.DATABASE_URL.slice(9));
  } else if (process.env.DATABASE_URL) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  } else {
    const result = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }),
    );
    const secret = JSON.parse(result.SecretString!);
    expiresAt = Date.now() + 300000;
    pool = new pg.Pool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: secret.username,
      password: secret.password,
      port: 5432,
      max: 3,
      ssl: {
        rejectUnauthorized: true,
        ca: readFileSync(
          new URL("./global-bundle.pem", import.meta.url),
          "utf8",
        ),
      },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values: unknown[] = [],
) {
  return (await (await db()).query<T>(sql, values)).rows;
}
