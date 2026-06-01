import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

type EncryptedPayload = {
  v: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

function keyFromSecret(secret: string): Buffer {
  if (/^[a-f0-9]{64}$/i.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  const maybeBase64 = Buffer.from(secret, "base64");
  if (maybeBase64.length === 32 && maybeBase64.toString("base64").replace(/=+$/, "") === secret.replace(/=+$/, "")) {
    return maybeBase64;
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptText(plaintext: string, secret: string, aad?: string): string {
  const key = keyFromSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  if (aad) {
    cipher.setAAD(Buffer.from(aad));
  }

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload: EncryptedPayload = {
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decryptText(encodedPayload: string, secret: string, aad?: string): string {
  const key = keyFromSecret(secret);
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as EncryptedPayload;

  if (payload.v !== 1) {
    throw new Error("Unsupported encrypted payload version");
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  if (aad) {
    decipher.setAAD(Buffer.from(aad));
  }
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
