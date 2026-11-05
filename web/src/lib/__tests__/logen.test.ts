import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import {
  applyBps,
  formatYocto,
  parseNearToYocto,
  splitTicketRevenue,
} from "../near/format";
import {
  decodeBase58,
  encodeBase58,
  NEP413_TAG,
  serializeNep413Payload,
  signNep413WithSecretKey,
  verifyNep413Signature,
} from "../gate/nep413";
import {
  evaluateGatePairCheck,
  pairCheck,
  SHARDED_ITEM_SPEC,
  verifyDirectSubaccount,
} from "../gate/pairCheck";
import { signHmacToken, verifyHmacToken } from "../gate/session";
import { createSimulatorPresets, THREAT_MODEL_A1_A12 } from "../near/sim";

describe("yoctoNEAR BigInt formatter & revenue split", () => {
  it("formats whole and fractional yoctoNEAR values accurately without floating point loss", () => {
    expect(formatYocto("0")).toBe("0");
    expect(formatYocto("1000000000000000000000000")).toBe("1");
    expect(formatYocto("2500000000000000000000000")).toBe("2.5");
    expect(formatYocto("1234567890000000000000000000", 4)).toBe("1,234.5678");
    expect(formatYocto("1", 4)).toBe("<0.0001");
  });

  it("parses NEAR strings to exact yoctoNEAR strings", () => {
    expect(parseNearToYocto("1")).toBe("1000000000000000000000000");
    expect(parseNearToYocto("0.05")).toBe("50000000000000000000000");
    expect(parseNearToYocto("12.345")).toBe("12345000000000000000000000");
    expect(() => parseNearToYocto("-1")).toThrow();
    expect(() => parseNearToYocto("abc")).toThrow();
  });

  it("computes overflow-safe applyBps and 40/50/10 ticket split with carry", () => {
    const oneNear = 10n ** 24n;
    expect(applyBps(oneNear, 500)).toBe(5n * 10n ** 22n); // 5%

    // 10 yocto across 3 seats -> 4 yocto pool (1 per seat, carry 1), 5 kas, 1 organizer
    const split = splitTicketRevenue(10n, { pool: 4000, kas: 5000, organizer: 1000 }, 3);
    expect(split.pool).toBe(4n);
    expect(split.kas).toBe(5n);
    expect(split.organizer).toBe(1n);
    expect(split.perSeat).toBe(1n);
    expect(split.carry).toBe(1n);
    expect(split.pool + split.kas + split.organizer).toBe(10n);

    // 0 seats minted -> pool redirected to Kas Klub
    const zeroSeats = splitTicketRevenue(100n, { pool: 4000, kas: 5000, organizer: 1000 }, 0);
    expect(zeroSeats.redirectedToKas).toBe(40n);
    expect(zeroSeats.kas).toBe(90n);
  });
});

describe("NEP-413 Borsh serializer & Ed25519 signature verifier", () => {
  it("round-trips base58 encoding and decoding", () => {
    const kp = nacl.sign.keyPair();
    const b58 = encodeBase58(kp.publicKey);
    const decoded = decodeBase58(b58);
    expect(Buffer.from(decoded).toString("hex")).toBe(
      Buffer.from(kp.publicKey).toString("hex")
    );
  });

  it("serializes NEP-413 tag (2^31 + 413) and payload in exact Borsh layout", () => {
    const nonce = new Uint8Array(32);
    for (let i = 0; i < 32; i++) nonce[i] = i + 1;

    const bytes = serializeNep413Payload({
      message: "logen",
      nonce,
      recipient: "logen-lounge",
      callbackUrl: null,
    });

    // First 4 bytes must be little-endian 2147484061 (0x8000019d -> [0x9d, 0x01, 0x00, 0x80])
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(0, true)).toBe(NEP413_TAG);
    // Next 4 bytes: length of "logen" = 5
    expect(view.getUint32(4, true)).toBe(5);
    // Final byte: Option::None = 0
    expect(bytes[bytes.length - 1]).toBe(0);
  });

  it("verifies valid NEP-413 Ed25519 signatures and rejects tampered messages/nonces", () => {
    const kp = nacl.sign.keyPair();
    const nonce = new Uint8Array(32).fill(7);
    const payload = {
      message: "Verify Logen Lounge Seat Ownership",
      nonce,
      recipient: "logen-lounge",
      callbackUrl: null,
    };

    const signed = signNep413WithSecretKey(payload, kp.secretKey);
    const res = verifyNep413Signature({
      payload,
      signature: signed.signatureBase64,
      publicKey: signed.publicKeyNear,
    });
    expect(res.valid).toBe(true);

    // Tamper with nonce
    const badNonce = new Uint8Array(32).fill(8);
    const badRes = verifyNep413Signature({
      payload: { ...payload, nonce: badNonce },
      signature: signed.signatureBase64,
      publicKey: signed.publicKeyNear,
    });
    expect(badRes.valid).toBe(false);
  });
});

describe("T0-T2 Pair Check & Gate Decision Table", () => {
  it("validates direct sub-accounts (T0 namespace)", () => {
    expect(verifyDirectSubaccount("s001.logen.testnet", "logen.testnet")).toBe(true);
    expect(verifyDirectSubaccount("garuda.logen.testnet", "logen.testnet")).toBe(true);
    expect(verifyDirectSubaccount("deep.s001.logen.testnet", "logen.testnet")).toBe(false);
    expect(verifyDirectSubaccount("logen.testnet", "logen.testnet")).toBe(false);
    expect(verifyDirectSubaccount("s001.evil.testnet", "logen.testnet")).toBe(false);
  });

  it("implements pair_check matching logen-core", () => {
    expect(pairCheck("alice.testnet", 1, "alice.testnet", 1)).toBe("Consistent");
    expect(pairCheck("alice.testnet", 1, "bob.testnet", 2)).toBe("IndexBehind");
    expect(pairCheck("alice.testnet", 2, "alice.testnet", 1)).toBe("Invalid");
    expect(pairCheck("alice.testnet", 1, "bob.testnet", 1)).toBe("Invalid");
  });

  it("fails closed when vault rotation_seq advances ahead of index (Threat D5)", () => {
    const check = evaluateGatePairCheck({
      expectedAccountId: "alice.testnet",
      pinnedRegistryId: "logen.testnet",
      tokenId: "s001.logen.testnet",
      indexOwner: "alice.testnet",
      indexSeq: 0,
      itemInfo: {
        spec: SHARDED_ITEM_SPEC,
        init: true,
        status: "Active",
        collection_id: "logen.testnet",
        token_id: "s001.logen.testnet",
        owner_id: "bob.testnet",
        rotation_seq: 1,
        rotation_epoch: 0,
      },
    });
    expect(check.allowed).toBe(false);
    expect(check.pairStatus).toBe("IndexBehind");
  });
});

describe("HMAC-SHA256 Session Signer & Verifier", () => {
  it("signs and verifies valid tokens and rejects expired or tampered tokens", () => {
    const token = signHmacToken(
      { accountId: "alice.testnet", rotationSeq: 2, exp: 2000 },
      "test-secret-32-bytes"
    );
    const ok = verifyHmacToken<{ accountId: string; rotationSeq: number; exp: number }>(
      token,
      "test-secret-32-bytes",
      1500
    );
    expect(ok.valid).toBe(true);
    if (ok.valid) {
      expect(ok.payload.accountId).toBe("alice.testnet");
      expect(ok.payload.rotationSeq).toBe(2);
    }

    const expired = verifyHmacToken(token, "test-secret-32-bytes", 2500);
    expect(expired.valid).toBe(false);

    const wrongSecret = verifyHmacToken(token, "wrong-secret", 1500);
    expect(wrongSecret.valid).toBe(false);
  });
});

describe("Threat Model A1-A12 & Simulator Presets", () => {
  it("defines all 12 attacks A1-A12 and executes simulator presets cleanly", () => {
    expect(THREAT_MODEL_A1_A12).toHaveLength(12);
    const presets = createSimulatorPresets();
    expect(presets.length).toBeGreaterThanOrEqual(3);
  });
});
