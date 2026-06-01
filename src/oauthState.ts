import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type StatePayload = {
  subscriberId: string;
  createdAt: number;
};

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOAuthState(subscriberId: string, secret: string): string {
  const payload: StatePayload = {
    subscriberId,
    createdAt: Date.now()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyOAuthState(state: string, secret: string, now = Date.now()): StatePayload {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid OAuth state");
  }

  const expected = sign(encodedPayload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("Invalid OAuth state signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as StatePayload;
  if (!payload.subscriberId || !payload.createdAt) {
    throw new Error("Invalid OAuth state payload");
  }
  if (now - payload.createdAt > STATE_TTL_MS) {
    throw new Error("OAuth state expired");
  }

  return payload;
}
