import { describe, it, expect } from "vitest";
import { allow, ApiError, percentage } from "../src/errors.js";
import { schemas, paging } from "../src/validation.js";
describe("authorization and validation", () => {
  it("denies staff member management", () =>
    expect(() => allow("STAFF", ["ADMIN"])).toThrow(ApiError));
  it("allows admin", () =>
    expect(() => allow("ADMIN", ["ADMIN"])).not.toThrow());
  it("rejects invalid member", () =>
    expect(() =>
      schemas.members.parse({
        first_name: "",
        last_name: "Example",
        email: "bad",
      }),
    ).toThrow());
  it("rejects PII as QR token", () =>
    expect(() =>
      schemas.scan.parse({ token: "person@example.org", service_id: "x" }),
    ).toThrow());
  it("bounds pagination", () =>
    expect(() => paging.parse({ limit: 1000 })).toThrow());
  it("handles attendance percentage", () => {
    expect(percentage(23, 25)).toBe(92);
    expect(percentage(0, 0)).toBe(0);
  });
});
