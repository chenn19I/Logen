import crypto from "crypto";

export const CHALLENGE_COOKIE_NAME = "pusaka_gate_challenge";
export const SESSION_COOKIE_NAME = "pusaka_lounge_session";
export const LOUNGE_RECIPIENT = "pusaka-lounge";

export interface ChallengeCookiePayload {
  nonceHex: string; // 64 hex chars = 32 bytes
  recipient: string;
  message: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

export interface LoungeSessionPayload {
  accountId: string;
  tokenId: string;
  registryId: string;
  rotationSeq: number;
  blockHeight: number;
  blockHash: string;
  iat: number;
  exp: number;
}

function getSecret(overrideSecret?: string): string {
  return (
    overrideSecret ||
    process.env.SESSION_SECRET ||
    "pusaka-dev-hmac-secret-32-bytes-minimum-key"
  );
}

/**
 * Signs any JSON payload with HMAC-SHA256 into a compact `<base64url>.<hmac_base64url>` token.
 */
export function signHmacToken<T extends object>(payload: T, secret?: string): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret(secret))
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

/**
 * Verifies an HMAC-SHA256 token in constant time and checks expiry (`exp` or `expiresAtMs`).
 */
export function verifyHmacToken<T extends { exp?: number; expiresAtMs?: number }>(
  token: string | undefined | null,
  secret?: string,
  nowMs: number = Date.now()
): { valid: true; payload: T } | { valid: false; reason: string } {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { valid: false, reason: "Missing or malformed token" };
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Invalid token structure" };
  }
  const [b64, providedSig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSecret(secret))
    .update(b64)
    .digest("base64url");

  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "HMAC signature mismatch" };
  }

  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as T;
    const expiry = payload.exp ?? payload.expiresAtMs;
    if (typeof expiry === "number" && nowMs > expiry) {
      return { valid: false, reason: "Token has expired" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: "Invalid JSON payload in token" };
  }
}
