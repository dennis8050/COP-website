import { describe, it, expect } from "vitest";
import { allow, ApiError, percentage } from "../src/errors.js";
import { schemas, paging } from "../src/validation.js";
import { districtFor } from "../src/district.js";
import { formatAbsenceSms,runFollowups } from "../src/followup.js";
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
  it("rejects district switching for non-admins", () => {
    expect(() => districtFor({id:"1",name:"Member",email:"m@example.test",role:"MEMBER",status:"active",district_id:"peel-piwc"},"triumph-piwc")).toThrow(ApiError);
  });
  it("personalizes a respectful SMS template", () => {
    expect(formatAbsenceSms("Hello [Member Name] from [District Name]", "Jane Doe", "Peel PIWC")).toBe("Hello Jane Doe from Peel PIWC");
  });
  it("never sends by default", async () => {
    delete process.env.SMS_SEND_ENABLED;
    expect((await runFollowups()).enabled).toBe(false);
  });
  it("handles attendance percentage", () => {
    expect(percentage(23, 25)).toBe(92);
    expect(percentage(0, 0)).toBe(0);
  });
});
