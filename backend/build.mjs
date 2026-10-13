import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
await build({
  entryPoints: ["src/handler.ts", "src/migrate.ts", "src/provision.ts", "src/followup.ts"],
  outdir: "dist",
  bundle: true,
  external: ["@electric-sql/pglite", "@electric-sql/pglite/contrib/pgcrypto"],
  platform: "node",
  target: "node22",
  format: "esm",
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});
await copyFile("database/001_initial.sql", "dist/001_initial.sql");
await copyFile("database/002_district_followup.sql", "dist/002_district_followup.sql");
await copyFile("certs/global-bundle.pem", "dist/global-bundle.pem");
await mkdir("dist", { recursive: true });
await import("node:fs/promises").then((fs) =>
  fs.writeFile("dist/package.json", JSON.stringify({ type: "module" })),
);
