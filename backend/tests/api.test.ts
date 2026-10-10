import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
const state = vi.hoisted(() => ({ pg: undefined as any }));
vi.mock("../src/database.js", () => ({
  query: async (sql: string, values: unknown[] = []) =>
    (await state.pg.query(sql, values)).rows,
  db: async () => ({
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        const r = await state.pg.query(sql, values);
        return { ...r, rowCount: r.affectedRows ?? r.rows.length };
      },
      release: () => {},
    }),
  }),
}));
process.env.AUTH_MODE = "local";
process.env.NODE_ENV = "test";
process.env.LOCAL_JWT_SECRET =
  "test-secret-that-is-longer-than-thirty-two-characters";
let respond: typeof import("../src/handler.js").respond;
let adminToken = "",
  staffToken = "",
  memberToken = "",
  memberId = "",
  serviceId = "",
  attendanceId = "",
  qrToken = "";
async function call(
  method: string,
  path: string,
  body: unknown = {},
  token = adminToken,
) {
  const r = await respond({
    method,
    path,
    headers: token ? { authorization: "Bearer " + token } : {},
    query: {},
    body,
  });
  return { status: r.statusCode, ...JSON.parse(r.body) };
}
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { pgcrypto } });
  await state.pg.exec(
    await readFile(
      new URL("../database/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  const hash = await bcrypt.hash("TestPassword!123", 4);
  for (const [role, email] of [
    ["ADMIN", "admin@example.test"],
    ["STAFF", "staff@example.test"],
    ["MEMBER", "member@example.test"],
  ])
    await state.pg.query(
      "INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$1,$3)",
      [role, email, hash],
    );
  ({ respond } = await import("../src/handler.js"));
  adminToken = (
    await call(
      "POST",
      "/auth/login",
      { email: "admin@example.test", password: "TestPassword!123" },
      "",
    )
  ).data.token;
  staffToken = (
    await call(
      "POST",
      "/auth/login",
      { email: "staff@example.test", password: "TestPassword!123" },
      "",
    )
  ).data.token;
  memberToken = (
    await call(
      "POST",
      "/auth/login",
      { email: "member@example.test", password: "TestPassword!123" },
      "",
    )
  ).data.token;
}, 30000);
afterAll(async () => {
  await state.pg.close();
});
describe.sequential("PostgreSQL API integration", () => {
  it("rejects unauthenticated dashboard", async () =>
    expect((await call("GET", "/dashboard", {}, "")).status).toBe(401));
  it("rejects bad credentials", async () =>
    expect(
      (
        await call(
          "POST",
          "/auth/login",
          { email: "admin@example.test", password: "wrong" },
          "",
        )
      ).status,
    ).toBe(401));
  it("rejects staff member management", async () =>
    expect(
      (
        await call(
          "POST",
          "/members",
          { first_name: "Demo", last_name: "Example" },
          staffToken,
        )
      ).status,
    ).toBe(403));
  it("validates input", async () =>
    expect(
      (
        await call("POST", "/members", {
          first_name: "",
          last_name: "Example",
          email: "bad",
        })
      ).status,
    ).toBe(400));
  it("creates member with opaque QR token", async () => {
    const r = await call("POST", "/members", {
      first_name: "Demo",
      last_name: "Example",
      email: "demo@example.test",
    });
    expect(r.status).toBe(201);
    memberId = r.data.id;
    qrToken = r.data.qr_token;
    expect(qrToken).toMatch(/^[a-f0-9]{64}$/);
  });
  it("updates member", async () =>
    expect(
      (await call("PUT", "/members/" + memberId, { phone: "+1 555 010 0101" }))
        .data.phone,
    ).toBe("+1 555 010 0101"));
  it("returns missing member 404", async () =>
    expect(
      (await call("GET", "/members/11111111-1111-4111-8111-111111111111"))
        .status,
    ).toBe(404));
  it("creates service", async () => {
    const r = await call("POST", "/services", {
      name: "Test Sunday",
      date: new Date().toISOString().slice(0, 10),
      start_time: "09:00",
    });
    expect(r.status).toBe(201);
    serviceId = r.data.id;
  });
  it("scans QR into real attendance", async () => {
    const r = await call(
      "POST",
      "/attendance/scan",
      { token: qrToken, service_id: serviceId },
      staffToken,
    );
    expect(r.status).toBe(201);
    expect(r.data.attendance_method).toBe("QR_SCAN");
    attendanceId = r.data.id;
  });
  it("prevents duplicate scan", async () =>
    expect(
      (
        await call(
          "POST",
          "/attendance/scan",
          { token: qrToken, service_id: serviceId },
          staffToken,
        )
      ).status,
    ).toBe(409));
  it("denies member scanner access", async () =>
    expect(
      (
        await call(
          "POST",
          "/attendance/scan",
          { token: qrToken, service_id: serviceId },
          memberToken,
        )
      ).status,
    ).toBe(403));
  it("returns attendance reports from database", async () => {
    const r = await call("GET", "/reports/attendance");
    expect(r.status).toBe(200);
    expect(r.data.present).toBe(1);
    expect(r.data.rows).toHaveLength(1);
  });
  it("corrects attendance and deletes it", async () => {
    expect(
      (await call("PUT", "/attendance/" + attendanceId, { status: "excused" }))
        .status,
    ).toBe(200);
    expect((await call("DELETE", "/attendance/" + attendanceId)).status).toBe(
      200,
    );
  });
  it("records manual attendance", async () => {
    const r = await call(
      "POST",
      "/attendance",
      { member_id: memberId, service_id: serviceId },
      staffToken,
    );
    expect(r.status).toBe(201);
    attendanceId = r.data.id;
    expect(r.data.attendance_method).toBe("MANUAL");
  });
  it("rejects inactive members", async () => {
    await call("PUT", "/members/" + memberId, { status: "inactive" });
    await call("DELETE", "/attendance/" + attendanceId);
    expect(
      (
        await call(
          "POST",
          "/attendance/scan",
          { token: qrToken, service_id: serviceId },
          staffToken,
        )
      ).status,
    ).toBe(404);
  });
  it("soft deletes member", async () => {
    expect((await call("DELETE", "/members/" + memberId)).status).toBe(200);
    expect((await call("GET", "/members/" + memberId)).status).toBe(404);
    const r = await state.pg.query(
      "SELECT deleted_at FROM members WHERE id=$1",
      [memberId],
    );
    expect(r.rows[0].deleted_at).toBeTruthy();
  });
  it("creates updates and safely deactivates a ministry", async () => {
    const create = await call("POST", "/ministries", {
      name: "Test Ministry",
      description: "Community",
    });
    expect(create.status).toBe(201);
    const id = create.data.id;
    expect(
      (await call("PUT", "/ministries/" + id, { description: "Updated" })).data
        .description,
    ).toBe("Updated");
    expect((await call("DELETE", "/ministries/" + id)).status).toBe(200);
    expect((await call("GET", "/ministries/" + id)).data.status).toBe(
      "inactive",
    );
  });
  it("creates updates and soft-deletes an event", async () => {
    const create = await call("POST", "/events", {
      name: "Test Event",
      date: "2026-11-01",
      start_time: "10:00",
      registration_required: true,
    });
    expect(create.status).toBe(201);
    const id = create.data.id;
    expect(
      (await call("PUT", "/events/" + id, { location: "Community hall" })).data
        .location,
    ).toBe("Community hall");
    expect((await call("DELETE", "/events/" + id)).status).toBe(200);
    expect((await call("GET", "/events/" + id)).status).toBe(404);
  });
  it("keeps staff out of user management", async () =>
    expect((await call("GET", "/users", {}, staffToken)).status).toBe(403));
  it("rejects invalid service times", async () =>
    expect(
      (
        await call("POST", "/services", {
          name: "Invalid",
          date: "2026-11-01",
          start_time: "29:88",
        })
      ).status,
    ).toBe(400));
  it("returns weekly monthly and ministry analytics", async () => {
    const r = await call("GET", "/dashboard");
    expect(r.data.weekly_series).toBeDefined();
    expect(r.data.monthly_series).toBeDefined();
    expect(r.data.by_ministry).toBeDefined();
  });
});
