import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "../src/oauthState.js";

describe("OAuth state", () => {
  it("verifies signed states", () => {
    const state = createOAuthState("subscriber-1", "state-secret-value");
    expect(verifyOAuthState(state, "state-secret-value").subscriberId).toBe("subscriber-1");
  });

  it("rejects tampered states", () => {
    const state = createOAuthState("subscriber-1", "state-secret-value");
    expect(() => verifyOAuthState(`${state}x`, "state-secret-value")).toThrow("Invalid OAuth state signature");
  });
});
