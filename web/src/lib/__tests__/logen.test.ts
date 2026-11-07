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
import { MockChain } from "../chain/mock";
import { DEMO_ACCOUNT } from "../chain/types";

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

  it("proves R4 S1 Sale in the Middle of a Payout under both payout-before-sale and payout-after-sale schedules", () => {
    const presets = createSimulatorPresets();
    const s1 = presets.find((p) => p.id === "s1_payout_race")!;
    expect(s1).toBeDefined();

    // Schedule A: Ticket -> Claim R1 -> Claim R2 (payout lands in vault) -> Seller withdraw attempt -> Agent withdraw attempt -> Bob buy R1..R3
    const worldA = structuredClone(s1.initialWorld);
    const txMap = Object.fromEntries(s1.transactions.map((t) => [t.txId, t]));
    txMap.tx_ticket.receipts[0].execute(worldA);
    txMap.tx_claim.receipts[0].execute(worldA);
    txMap.tx_claim.receipts[1].execute(worldA);
    txMap.tx_seller_withdraw.receipts[0].execute(worldA);
    txMap.tx_agent_withdraw.receipts[0].execute(worldA);
    txMap.tx_buy.receipts[0].execute(worldA);
    txMap.tx_buy.receipts[1].execute(worldA);
    txMap.tx_buy.receipts[2].execute(worldA);

    expect(worldA.vaultOwner).toBe("bob.testnet");
    expect(worldA.vaultSeq).toBe(1);
    expect(worldA.vaultBalance).toBe(40); // 20 initial + 20 ticket payout
    expect(worldA.delegateAccount).toBeNull();
    expect(
      worldA.logs.filter((l) => l.outcome === "BLOCKED").map((l) => l.code)
    ).toEqual(["E_FROZEN", "E_FROZEN"]);

    // Schedule B: Ticket -> Claim R1 -> Bob buy R1 -> Bob buy R2 (cut-off!) -> Seller withdraw -> Agent withdraw -> Claim R2 lands -> Bob buy R3
    const worldB = structuredClone(s1.initialWorld);
    txMap.tx_ticket.receipts[0].execute(worldB);
    txMap.tx_claim.receipts[0].execute(worldB);
    txMap.tx_buy.receipts[0].execute(worldB);
    txMap.tx_buy.receipts[1].execute(worldB);
    txMap.tx_seller_withdraw.receipts[0].execute(worldB);
    txMap.tx_agent_withdraw.receipts[0].execute(worldB);
    txMap.tx_claim.receipts[1].execute(worldB);
    txMap.tx_buy.receipts[2].execute(worldB);

    expect(worldB.vaultOwner).toBe("bob.testnet");
    expect(worldB.vaultBalance).toBe(40);
    expect(
      worldB.logs.filter((l) => l.outcome === "BLOCKED").map((l) => l.code)
    ).toEqual(["E_NOT_OWNER", "E_NOT_OWNER"]);
  });

  it("foils S2 Bait-and-Switch relist via monotonic listing_nonce and refunds buyer 100%", () => {
    const s2 = createSimulatorPresets().find((p) => p.id === "s2_bait_and_switch")!;
    const world = structuredClone(s2.initialWorld);
    const txMap = Object.fromEntries(s2.transactions.map((t) => [t.txId, t]));

    // Bob enters escrow quoting nonce=1 -> Alice cancels, drains 16N, relists at nonce=2 -> Bob settlement runs
    txMap.tx_bob_buy.receipts[0].execute(world);
    txMap.tx_alice_bait.receipts[0].execute(world);
    txMap.tx_alice_bait.receipts[1].execute(world);
    txMap.tx_alice_bait.receipts[2].execute(world);
    txMap.tx_bob_buy.receipts[1].execute(world);
    txMap.tx_bob_buy.receipts[2].execute(world);

    expect(world.listingNonce).toBe(2);
    expect(world.vaultOwner).toBe("alice.testnet");
    expect(world.wallets["bob.testnet"]).toBe(1000); // 100% refunded
    expect(world.logs.some((l) => l.code === "E_NONCE_MISMATCH")).toBe(true);
  });

  it("heals S4 Lost Callback divergence via permissionless sync()", () => {
    const s4 = createSimulatorPresets().find((p) => p.id === "s4_lost_callback_sync")!;
    const world = structuredClone(s4.initialWorld);
    const txMap = Object.fromEntries(s4.transactions.map((t) => [t.txId, t]));

    // Stale owner Alice tries to transfer to Mallory -> Vault rejects -> Keeper runs sync()
    txMap.tx_stale_transfer.receipts[0].execute(world);
    txMap.tx_stale_transfer.receipts[1].execute(world);
    txMap.tx_sync.receipts[0].execute(world);
    txMap.tx_sync.receipts[1].execute(world);

    expect(world.vaultOwner).toBe("bob.testnet");
    expect(world.indexOwner).toBe("bob.testnet");
    expect(world.indexSeq).toBe(1);
    expect(world.logs.some((l) => l.code === "E_NOT_OWNER")).toBe(true);
  });
});

describe("MockChain epoch-bound delegate & 5/5 sealed proof", () => {
  it("configures epoch-bound delegate, blocks delegate changes while listed, and wipes delegate on sale/handoff", async () => {
    const chain = new MockChain();
    const seat7 = await chain.getSeat("s007.logen.testnet");
    expect(seat7?.delegate?.accountId).toBe("agent.demo.testnet");
    expect(seat7?.rotationSeq).toBe(1);

    const updated = await chain.setDelegate(
      "s007.logen.testnet",
      "bot.logen.testnet",
      parseNearToYocto("1.25"),
      7200
    );
    expect(updated.delegate?.accountId).toBe("bot.logen.testnet");
    expect(updated.delegate?.seq).toBe(1);

    // Listing freezes delegate mutations
    await chain.listSeat("s007.logen.testnet", parseNearToYocto("9.5"));
    await expect(
      chain.setDelegate("s007.logen.testnet", "evil.testnet", parseNearToYocto("1"), 3600)
    ).rejects.toThrow("E_FROZEN");

    // Handoff rotates seq to 2 and wipes delegate automatically
    const handedOff = await chain.simulateHandoff("s007.logen.testnet");
    expect(handedOff?.ownerId).toBe("mara.near");
    expect(handedOff?.rotationSeq).toBe(2);
    expect(handedOff?.delegate).toBeNull();
  });

  it("returns 5/5 passing checks including SEALED (0 KEYS) build status", async () => {
    const chain = new MockChain();
    const proof = await chain.getProof("s007.logen.testnet");
    expect(proof.allOk).toBe(true);
    expect(proof.rows).toHaveLength(5);
    expect(proof.rows.every((r) => r.status === "ok")).toBe(true);
    const buildRow = proof.rows.find((r) => r.id === "build");
    expect(buildRow?.value).toBe("SEALED (0 KEYS)");
  });
});

describe("MockChain mint with a portrait", () => {
  it("creates a custom-handle seat with its portrait, history and holder", async () => {
    const chain = new MockChain();
    const before = await chain.getSeats(null);

    const seat = await chain.mintSeat({
      ownerId: DEMO_ACCOUNT,
      name: "The Blue Cube",
      description: "A seat for the keeper of the cube.",
      imageUrl: "data:image/webp;base64,AAAA",
      handle: "blue-cube",
    });

    expect(seat.tokenId).toBe("blue-cube.logen.testnet");
    expect(seat.ownerId).toBe(DEMO_ACCOUNT);
    expect(seat.name).toBe("The Blue Cube");
    expect(seat.description).toBe("A seat for the keeper of the cube.");
    expect(seat.imageUrl).toBe("data:image/webp;base64,AAAA");
    expect(seat.handle).toBe("blue-cube");
    expect(seat.status).toBe("active");
    expect(seat.balanceYocto).toBe("0");
    expect(seat.number).toBe(Math.max(...before.map((item) => item.number)) + 1);

    const history = await chain.getHistory(seat.tokenId);
    expect(history.items[0]?.label).toBe("Seat minted");
    expect(history.holdersCount).toBe(1);
    expect(history.holders[0]?.ownerId).toBe(DEMO_ACCOUNT);

    const after = await chain.getSeats(DEMO_ACCOUNT);
    expect(after.some((item) => item.tokenId === seat.tokenId)).toBe(true);
  });

  it("rejects a handle that is already taken and clears mints on reset", async () => {
    const chain = new MockChain();
    await chain.mintSeat({ handle: "blue-cube" });
    await expect(chain.mintSeat({ handle: "blue-cube" })).rejects.toThrow(
      "That handle is already taken"
    );

    await chain.reset();
    expect(await chain.getSeat("blue-cube.logen.testnet")).toBeNull();
  });
});
