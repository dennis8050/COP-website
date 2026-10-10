import { it, expect } from "vitest";
import QRCode from "qrcode";
it("generates a QR code from an opaque token", async () => {
  const svg = await QRCode.toString("a".repeat(64), { type: "svg" });
  expect(svg).toContain("<svg");
  expect(svg).not.toContain("example.test");
});
