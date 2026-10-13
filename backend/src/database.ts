import pg from "pg";
import { readFileSync } from "node:fs";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

let pool: pg.Pool | undefined;
let expiresAt = 0;

export async function db(): Promise<pg.Pool> {
  if (pool && (!expiresAt || Date.now() < expiresAt)) {
    return pool;
  }

  if (pool) {
    await pool.end();
    pool = undefined;
  }

  // Production must use AWS Secrets Manager for database credentials.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DATABASE_URL
  ) {
    throw new Error("Production must use Secrets Manager");
  }

  // Local development only: use PGlite when explicitly configured.
  if (process.env.DATABASE_URL?.startsWith("pglite://")) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error("PGlite is development-only");
    }

    // Keep the local-only database module out of the production bundle.
    const localDatabaseModule = "./local-database.js";
    const localDb = await import(localDatabaseModule);

    pool = await localDb.localDatabase(
      process.env.DATABASE_URL.slice(9),
    );
  } else if (process.env.DATABASE_URL) {
    // Standard database connection for non-production environments.
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  } else {
    // Production: retrieve credentials securely from AWS Secrets Manager.
    const result = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({
        SecretId: process.env.DB_SECRET_ARN,
      }),
    );

    if (!result.SecretString) {
      throw new Error("Database secret has no SecretString");
    }

    const secret = JSON.parse(result.SecretString);

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

  if (!pool) {
    throw new Error("Database pool was not initialized");
  }

  return pool;
}

export async function query<
  T extends pg.QueryResultRow = pg.QueryResultRow,
>(
  sql: string,
  values: unknown[] = [],
) {
  return (await (await db()).query<T>(sql, values)).rows;
}