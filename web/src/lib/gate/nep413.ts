import crypto from "crypto";
import nacl from "tweetnacl";

// NEP-413 prefix tag: 2^31 + 413 = 2147484061 (0x8000019d)
export const NEP413_TAG = 2147484061;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) {
    zeroes++;
  }
  const digits: number[] = [0];
  for (let i = zeroes; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "1".repeat(zeroes);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

export function decodeBase58(str: string): Uint8Array {
  const cleaned = str.trim();
  if (cleaned.length === 0) return new Uint8Array(0);
  let zeroes = 0;
  while (zeroes < cleaned.length && cleaned[zeroes] === "1") {
    zeroes++;
  }
  const bytes: number[] = [];
  for (let i = zeroes; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const value = BASE58_ALPHABET.indexOf(ch);
    if (value === -1) {
      throw new Error(`Invalid base58 character "${ch}"`);
    }
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeroes + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[zeroes + i] = bytes[bytes.length - 1 - i];
  }
  return out;
}

export interface Nep413Payload {
  message: string;
  nonce: Uint8Array; // must be exactly 32 bytes
  recipient: string;
  callbackUrl?: string | null;
}

function writeU32LE(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = val & 0xff;
  buf[1] = (val >>> 8) & 0xff;
  buf[2] = (val >>> 16) & 0xff;
  buf[3] = (val >>> 24) & 0xff;
  return buf;
}

function serializeBorshString(str: string): Uint8Array {
  const utf8 = new TextEncoder().encode(str);
  const len = writeU32LE(utf8.length);
  const out = new Uint8Array(4 + utf8.length);
  out.set(len, 0);
  out.set(utf8, 4);
  return out;
}

/**
 * Serializes the NEP-413 tag + payload according to NEP-413 Borsh specification:
 * u32(2147484061) || String(message) || [u8; 32](nonce) || String(recipient) || Option<String>(callbackUrl)
 */
export function serializeNep413Payload(payload: Nep413Payload): Uint8Array {
  if (!(payload.nonce instanceof Uint8Array) || payload.nonce.length !== 32) {
    throw new Error(`NEP-413 nonce must be exactly 32 bytes (got ${payload.nonce?.length ?? 0})`);
  }

  const tagBytes = writeU32LE(NEP413_TAG);
  const msgBytes = serializeBorshString(payload.message);
  const nonceBytes = payload.nonce;
  const recipientBytes = serializeBorshString(payload.recipient);

  let callbackBytes: Uint8Array;
  if (payload.callbackUrl !== undefined && payload.callbackUrl !== null) {
    const strBytes = serializeBorshString(payload.callbackUrl);
    callbackBytes = new Uint8Array(1 + strBytes.length);
    callbackBytes[0] = 1;
    callbackBytes.set(strBytes, 1);
  } else {
    callbackBytes = new Uint8Array([0]);
  }

  const totalLen =
    tagBytes.length +
    msgBytes.length +
    nonceBytes.length +
    recipientBytes.length +
    callbackBytes.length;

  const result = new Uint8Array(totalLen);
  let offset = 0;
  result.set(tagBytes, offset);
  offset += tagBytes.length;
  result.set(msgBytes, offset);
  offset += msgBytes.length;
  result.set(nonceBytes, offset);
  offset += nonceBytes.length;
  result.set(recipientBytes, offset);
  offset += recipientBytes.length;
  result.set(callbackBytes, offset);

  return result;
}

/**
 * Computes the 32-byte SHA-256 hash of the Borsh-serialized NEP-413 payload.
 */
export function hashNep413Payload(payload: Nep413Payload): Uint8Array {
  const serialized = serializeNep413Payload(payload);
  const digest = crypto.createHash("sha256").update(serialized).digest();
  return new Uint8Array(digest);
}

/**
 * Parses a NEAR public key string ("ed25519:..." or raw base58/hex) into 32 raw Ed25519 public key bytes.
 */
export function parseNearPublicKey(publicKey: string): Uint8Array {
  const cleaned = publicKey.trim();
  const body = cleaned.startsWith("ed25519:") ? cleaned.slice("ed25519:".length) : cleaned;
  const decoded = decodeBase58(body);
  if (decoded.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: expected 32 bytes, got ${decoded.length}`);
  }
  return decoded;
}

/**
 * Parses a signature from base64 (standard NEP-413 wallet output), hex, or "ed25519:<base58>".
 */
export function parseSignatureBytes(signature: string | Uint8Array): Uint8Array {
  if (signature instanceof Uint8Array) return signature;
  const trimmed = signature.trim();
  if (trimmed.startsWith("ed25519:")) {
    return decodeBase58(trimmed.slice("ed25519:".length));
  }
  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    return new Uint8Array(Buffer.from(trimmed, "hex"));
  }
  const buf = Buffer.from(trimmed, "base64");
  if (buf.length === 64) {
    return new Uint8Array(buf);
  }
  // Fallback to base58
  return decodeBase58(trimmed);
}

/**
 * Verifies an Ed25519 signature over the SHA-256 hash of the Borsh-serialized NEP-413 payload.
 */
export function verifyNep413Signature(params: {
  payload: Nep413Payload;
  signature: string | Uint8Array;
  publicKey: string;
}): {
  valid: boolean;
  hashHex: string;
  serializedHex: string;
  error?: string;
} {
  try {
    const serialized = serializeNep413Payload(params.payload);
    const hash = new Uint8Array(crypto.createHash("sha256").update(serialized).digest());
    const pubKeyBytes = parseNearPublicKey(params.publicKey);
    const sigBytes = parseSignatureBytes(params.signature);

    if (sigBytes.length !== 64) {
      return {
        valid: false,
        hashHex: Buffer.from(hash).toString("hex"),
        serializedHex: Buffer.from(serialized).toString("hex"),
        error: `Invalid signature length: expected 64 bytes, got ${sigBytes.length}`,
      };
    }

    const valid = nacl.sign.detached.verify(hash, sigBytes, pubKeyBytes);
    return {
      valid,
      hashHex: Buffer.from(hash).toString("hex"),
      serializedHex: Buffer.from(serialized).toString("hex"),
      error: valid ? undefined : "Ed25519 signature verification failed",
    };
  } catch (err) {
    return {
      valid: false,
      hashHex: "",
      serializedHex: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Helper to create a deterministic or random signed NEP-413 payload (used by unit tests and interactive Judge Inspector).
 */
export function signNep413WithSecretKey(
  payload: Nep413Payload,
  secretKey64: Uint8Array
): {
  signatureBase64: string;
  publicKeyNear: string;
  hashHex: string;
  serializedHex: string;
} {
  const serialized = serializeNep413Payload(payload);
  const hash = new Uint8Array(crypto.createHash("sha256").update(serialized).digest());
  const sig = nacl.sign.detached(hash, secretKey64);
  const pubKey = secretKey64.slice(32, 64);
  return {
    signatureBase64: Buffer.from(sig).toString("base64"),
    publicKeyNear: `ed25519:${encodeBase58(pubKey)}`,
    hashHex: Buffer.from(hash).toString("hex"),
    serializedHex: Buffer.from(serialized).toString("hex"),
  };
}
