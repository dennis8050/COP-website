import { randomBytes } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
async function create(path, contents) {
  try {
    await access(path);
    console.log(`${path} already exists; preserved.`);
  } catch {
    await writeFile(path, contents, { mode: 0o600 });
    console.log(`Created ${path}.`);
  }
}
await create(
  "backend/.env",
  `NODE_ENV=development\nAUTH_MODE=local\nDATABASE_URL=pglite://./.local-postgres\nLOCAL_JWT_SECRET=${randomBytes(48).toString("hex")}\nDEMO_PASSWORD=${randomBytes(20).toString("base64url")}\nCORS_ORIGIN=http://localhost:5173\n`,
);
await create(
  "frontend/.env",
  "VITE_API_URL=http://localhost:3001\nVITE_AUTH_MODE=local\n",
);
console.log(
  "Run npm run db:migrate, npm run db:seed, then npm run dev. Login: admin@example.test, using DEMO_PASSWORD in backend/.env. These credentials are local only.",
);
