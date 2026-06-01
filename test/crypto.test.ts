import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "../src/crypto.js";

describe("token encryption", () => {
  it("round-trips encrypted values with authenticated data", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    const encrypted = encryptText("refresh-token", secret, "subscriber-1");

    expect(encrypted).not.toContain("refresh-token");
    expect(decryptText(encrypted, secret, "subscriber-1")).toBe("refresh-token");
  });

  it("rejects wrong authenticated data", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    const encrypted = encryptText("refresh-token", secret, "subscriber-1");

    expect(() => decryptText(encrypted, secret, "subscriber-2")).toThrow();
  });
});
