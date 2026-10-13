import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type pg from "pg";
// Optional persistent PostgreSQL WASM runtime for development without Docker.
// Every statement/transaction is serialized. Never enabled in AWS.
export async function localDatabase(path: string) {
  const engine = new PGlite(path, { extensions: { pgcrypto } });
  await engine.waitReady;
  let tail: Promise<void> = Promise.resolve();
  async function acquire() {
    let release!: () => void;
    const next = new Promise<void>((resolve) => (release = resolve));
    const previous = tail;
    tail = previous.then(() => next);
    await previous;
    return release;
  }
  async function run(sql: string, values: unknown[] = []) {
    if (!values.length && sql.includes(";")) {
      const result = await engine.exec(sql);
      const last = result.at(-1);
      return { rows: last?.rows || [], rowCount: last?.affectedRows || 0 };
    }
    const r = await engine.query(sql, values);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  }
  return {
    query: async (sql: string, values: unknown[] = []) => {
      const release = await acquire();
      try {
        return await run(sql, values);
      } finally {
        release();
      }
    },
    connect: async () => {
      const release = await acquire();
      return { query: run, release };
    },
    end: async () => engine.close(),
  } as unknown as pg.Pool;
}
