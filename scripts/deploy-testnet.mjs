#!/usr/bin/env node
/**
 * Logen NEAR Testnet Provisioner, Deployer & On-Chain Attack Lab Runner
 * (`scripts/deploy-testnet.mjs`)
 *
 * Uses Node's built-in `node:crypto` Ed25519 + exact NEAR Borsh transaction encoding
 * over JSON-RPC (`https://test.rpc.fastnear.com` / `https://rpc.testnet.near.org`).
 *
 * Security rule (HACKATHON.md):
 * - Private keys are stored ONLY in `~/.near-credentials/testnet/<account>.json`
 *   (outside the repository).
 * - Run `node scripts/deploy-testnet.mjs prepare` to create and fund a testnet account
 *   via the public testnet faucet without signing any contract transactions.
 * - Run `node scripts/deploy-testnet.mjs deploy --confirm` ONLY after human confirmation
 *   to deploy the contracts, seed a live seat + event + safe sale, and record real
 *   on-chain Attack Lab transactions.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const CRED_DIR = path.join(os.homedir(), ".near-credentials", "testnet");
const RPC_URLS = [
  process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com",
  "https://rpc.testnet.near.org",
];
const FAUCET_HELPER_URL = "https://helper.testnet.near.org/account";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(buf) {
  let digits = [0];
  for (let i = 0; i < buf.length; i++) {
    let carry = buf[i];
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
  let out = "";
  for (let i = 0; i < buf.length && buf[i] === 0; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]];
  return out;
}

export function base58Decode(str) {
  let bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const val = BASE58_ALPHABET.indexOf(c);
    if (val < 0) throw new Error(`Invalid base58 character: ${c}`);
    let carry = val;
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
  for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

// -----------------------------------------------------------------------------
// Ed25519 Keypair Management (~/.near-credentials/testnet)
// -----------------------------------------------------------------------------

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function generateOrLoadAccountKey(accountId) {
  fs.mkdirSync(CRED_DIR, { recursive: true });
  const credFile = path.join(CRED_DIR, `${accountId}.json`);
  if (fs.existsSync(credFile)) {
    const data = JSON.parse(fs.readFileSync(credFile, "utf8"));
    const secretB58 = data.private_key.replace(/^ed25519:/, "");
    const secretFull = base58Decode(secretB58);
    const seed = secretFull.subarray(0, 32);
    const pubRaw = secretFull.subarray(32, 64);
    const privObj = crypto.createPrivateKey({
      key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
      format: "der",
      type: "pkcs8",
    });
    return {
      accountId,
      publicKeyStr: `ed25519:${base58Encode(pubRaw)}`,
      pubRaw,
      privObj,
      credFile,
    };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" });
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" });
  const pubRaw = spki.subarray(ED25519_SPKI_PREFIX.length);
  const seed = pkcs8.subarray(ED25519_PKCS8_PREFIX.length);
  const secretFull = Buffer.concat([seed, pubRaw]);

  const publicKeyStr = `ed25519:${base58Encode(pubRaw)}`;
  const privateKeyStr = `ed25519:${base58Encode(secretFull)}`;
  fs.writeFileSync(
    credFile,
    JSON.stringify(
      {
        account_id: accountId,
        public_key: publicKeyStr,
        private_key: privateKeyStr,
      },
      null,
      2
    ) + "\n",
    { mode: 0o600 }
  );

  return { accountId, publicKeyStr, pubRaw, privObj: privateKey, credFile };
}

// -----------------------------------------------------------------------------
// NEAR Borsh Transaction Serializer
// -----------------------------------------------------------------------------

function borshU32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function borshU64(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  return b;
}

function borshU128(n) {
  const v = BigInt(n);
  const b = Buffer.alloc(16);
  b.writeBigUInt64LE(v & 0xffffffffffffffffn, 0);
  b.writeBigUInt64LE(v >> 64n, 8);
  return b;
}

function borshString(str) {
  const s = Buffer.from(str, "utf8");
  return Buffer.concat([borshU32(s.length), s]);
}

function borshBytes(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return Buffer.concat([borshU32(b.length), b]);
}

function borshPublicKey(pubRaw) {
  return Buffer.concat([Buffer.from([0]), pubRaw]); // 0 = Ed25519
}

export const Actions = {
  createAccount() {
    return Buffer.from([0]);
  },
  deployContract(wasmBytes) {
    return Buffer.concat([Buffer.from([1]), borshBytes(wasmBytes)]);
  },
  functionCall(methodName, argsBufferOrJson, gas, depositYocto) {
    const argsBuf = Buffer.isBuffer(argsBufferOrJson)
      ? argsBufferOrJson
      : Buffer.from(JSON.stringify(argsBufferOrJson), "utf8");
    return Buffer.concat([
      Buffer.from([2]),
      borshString(methodName),
      borshBytes(argsBuf),
      borshU64(gas),
      borshU128(depositYocto),
    ]);
  },
  transfer(depositYocto) {
    return Buffer.concat([Buffer.from([3]), borshU128(depositYocto)]);
  },
  addFullAccessKey(pubRaw) {
    return Buffer.concat([
      Buffer.from([5]),
      borshPublicKey(pubRaw),
      borshU64(0),
      Buffer.from([0]), // Permission::FullAccess
    ]);
  },
  deleteKey(pubRaw) {
    return Buffer.concat([Buffer.from([6]), borshPublicKey(pubRaw)]);
  },
};

// -----------------------------------------------------------------------------
// JSON-RPC Client with Automatic Fallback
// -----------------------------------------------------------------------------

async function rpcRequest(method, params) {
  let lastErr;
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "logen", method, params }),
      });
      const data = await res.json();
      if (data.error) {
        const err = new Error(data.error.data || data.error.message || JSON.stringify(data.error));
        err.rpcError = data.error;
        throw err;
      }
      return data.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function signAndSendTx(signerKey, receiverId, actions) {
  const ak = await rpcRequest("query", {
    request_type: "view_access_key",
    finality: "optimistic",
    account_id: signerKey.accountId,
    public_key: signerKey.publicKeyStr,
  });
  const nonce = BigInt(ak.nonce) + 1n;
  const blockHash = base58Decode(ak.block_hash);

  const txBytes = Buffer.concat([
    borshString(signerKey.accountId),
    borshPublicKey(signerKey.pubRaw),
    borshU64(nonce),
    borshString(receiverId),
    blockHash,
    borshU32(actions.length),
    ...actions,
  ]);

  const txHash = crypto.createHash("sha256").update(txBytes).digest();
  const sig = crypto.sign(null, txHash, signerKey.privObj);
  const signedTx = Buffer.concat([txBytes, Buffer.from([0]), sig]);

  const result = await rpcRequest("send_tx", {
    signed_tx_base64: signedTx.toString("base64"),
    wait_until: "EXECUTED_OPTIMISTIC",
  });
  return {
    txHash: result.transaction?.hash || base58Encode(txHash),
    status: result.status,
    receiptsOutcome: result.receipts_outcome || [],
    raw: result,
  };
}

function findFailureMessage(txOutcome) {
  if (txOutcome.status?.Failure) {
    return JSON.stringify(txOutcome.status.Failure);
  }
  for (const r of txOutcome.receiptsOutcome) {
    if (r.outcome?.status?.Failure) {
      return JSON.stringify(r.outcome.status.Failure);
    }
  }
  return null;
}

async function createTestnetAccountViaFaucet(accountId, publicKeyStr) {
  console.log(`Requesting NEAR Testnet account creation for ${accountId} ...`);
  const res = await fetch(FAUCET_HELPER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      newAccountId: accountId,
      newAccountPublicKey: publicKeyStr,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Testnet helper returned HTTP ${res.status}: ${txt}`);
  }
  // Verify account exists via RPC
  for (let i = 0; i < 6; i++) {
    try {
      const acc = await rpcRequest("query", {
        request_type: "view_account",
        finality: "optimistic",
        account_id: accountId,
      });
      console.log(`  [OK] Created ${accountId} with balance ${(Number(BigInt(acc.amount) / 10n ** 22n) / 100).toFixed(2)} NEAR`);
      return acc;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error(`Account ${accountId} was not visible on RPC after faucet call`);
}

async function prepareAccounts() {
  const statePath = path.join(CRED_DIR, "logen-active-accounts.json");
  if (fs.existsSync(statePath)) {
    const existing = JSON.parse(fs.readFileSync(statePath, "utf8"));
    console.log("Loaded prepared testnet accounts:", existing);
    return existing;
  }
  const suffix = crypto.randomBytes(3).toString("hex");
  const registryId = `logen-${suffix}.testnet`;
  const aliceId = `alice-${suffix}.testnet`;
  const bobId = `bob-${suffix}.testnet`;

  const regKey = generateOrLoadAccountKey(registryId);
  const aliceKey = generateOrLoadAccountKey(aliceId);
  const bobKey = generateOrLoadAccountKey(bobId);

  await createTestnetAccountViaFaucet(registryId, regKey.publicKeyStr);
  await createTestnetAccountViaFaucet(aliceId, aliceKey.publicKeyStr);
  await createTestnetAccountViaFaucet(bobId, bobKey.publicKeyStr);

  const info = {
    network: "testnet",
    registryId,
    aliceId,
    bobId,
    credentialsDir: CRED_DIR,
    preparedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statePath, JSON.stringify(info, null, 2) + "\n", "utf8");
  console.log(`\n[READY] Prepared testnet accounts saved to ${statePath}`);
  return info;
}

const NEAR = 10n ** 24n;
const TGAS = 10n ** 12n;

async function deployAndSeed() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "Refusing to sign transactions without --confirm (per HACKATHON.md human confirmation rule)."
    );
    process.exit(1);
  }
  const accounts = await prepareAccounts();
  const regKey = generateOrLoadAccountKey(accounts.registryId);
  const aliceKey = generateOrLoadAccountKey(accounts.aliceId);
  const bobKey = generateOrLoadAccountKey(accounts.bobId);

  const vaultWasmPath = path.join(
    ROOT,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "logen_vault.wasm"
  );
  const regWasmPath = path.join(
    ROOT,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "logen_registry.wasm"
  );
  const vaultWasm = fs.readFileSync(vaultWasmPath);
  const regWasm = fs.readFileSync(regWasmPath);

  const vaultCodeHash = base58Encode(crypto.createHash("sha256").update(vaultWasm).digest());
  const registryCodeHash = base58Encode(crypto.createHash("sha256").update(regWasm).digest());

  console.log(`\n1. Deploying logen_registry.wasm (${regWasm.length}B) to ${accounts.registryId} ...`);
  const deployTx = await signAndSendTx(regKey, accounts.registryId, [
    Actions.deployContract(regWasm),
    Actions.functionCall(
      "init",
      {
        organizer_id: accounts.aliceId,
        kas_klub_id: accounts.aliceId,
        seat_price: ((22n * NEAR) / 10n).toString(), // 2.2 NEAR
        vault_initial_balance: (2n * NEAR).toString(), // 2.0 NEAR (covers 175KB WASM storage + liquid reserve)
        royalty_bps: 500,
      },
      50n * TGAS,
      0n
    ),
  ]);
  console.log(`   tx: ${deployTx.txHash}`);

  console.log(`2. Pinning logen_vault.wasm (${vaultWasm.length}B, hash=${vaultCodeHash}) ...`);
  const borshVault = Buffer.concat([borshU32(vaultWasm.length), vaultWasm]);
  const pinTx = await signAndSendTx(regKey, accounts.registryId, [
    Actions.functionCall("pin_vault_wasm", borshVault, 100n * TGAS, 0n),
  ]);
  console.log(`   tx: ${pinTx.txHash}`);

  console.log(`3. Alice mints Seat #001 (s001.${accounts.registryId}) ...`);
  const mint1Tx = await signAndSendTx(aliceKey, accounts.registryId, [
    Actions.functionCall("mint_seat", {}, 220n * TGAS, (22n * NEAR) / 10n),
  ]);
  console.log(`   tx: ${mint1Tx.txHash}`);

  console.log(`4. Alice mints Seat #002 with custom handle (garuda.${accounts.registryId}) ...`);
  const mint2Tx = await signAndSendTx(aliceKey, accounts.registryId, [
    Actions.functionCall("mint_seat", { handle: "garuda" }, 220n * TGAS, (22n * NEAR) / 10n),
  ]);
  console.log(`   tx: ${mint2Tx.txHash}`);

  console.log(`5. Organizer creates Event #0 ("Kraton Genesis Summit", 1.0 NEAR) ...`);
  const evTx = await signAndSendTx(aliceKey, accounts.registryId, [
    Actions.functionCall(
      "create_event",
      {
        name: "Kraton Genesis Summit",
        price: NEAR.toString(),
        capacity: 100,
        starts_at_ms: Date.now() + 7 * 86400 * 1000,
        member_discount_bps: 1000,
      },
      40n * TGAS,
      0n
    ),
  ]);
  console.log(`   tx: ${evTx.txHash}`);

  console.log(`6. Bob buys a ticket to Event #0 (1.0 NEAR -> 40% accrues to seats) ...`);
  const ticketTx = await signAndSendTx(bobKey, accounts.registryId, [
    Actions.functionCall("buy_ticket", { event_id: 0 }, 40n * TGAS, NEAR),
  ]);
  console.log(`   tx: ${ticketTx.txHash}`);

  const seat1Id = `s001.${accounts.registryId}`;
  const seat2Id = `garuda.${accounts.registryId}`;

  console.log(`7. Claiming pool share into ${seat1Id} vault ...`);
  const claimTx = await signAndSendTx(bobKey, accounts.registryId, [
    Actions.functionCall("claim", { token_id: seat1Id }, 40n * TGAS, 0n),
  ]);
  console.log(`   tx: ${claimTx.txHash}`);

  console.log(`8. Alice lists ${seat1Id} on Safe Market for 1.5 NEAR ...`);
  const listTx = await signAndSendTx(aliceKey, accounts.registryId, [
    Actions.functionCall(
      "list_seat",
      {
        token_id: seat1Id,
        price: ((15n * NEAR) / 10n).toString(),
        min_balance: (NEAR / 10n).toString(),
        ttl_sec: 86400,
      },
      100n * TGAS,
      1n
    ),
  ]);
  console.log(`   tx: ${listTx.txHash}`);

  // On-chain Attack Lab transactions!
  const attackTxs = {};
  console.log(`9. Executing live on-chain Attack A1 (Direct v_rotate on ${seat1Id}) ...`);
  const a1Tx = await signAndSendTx(aliceKey, seat1Id, [
    Actions.functionCall(
      "v_rotate",
      { from: accounts.aliceId, to: accounts.bobId, expected_seq: 0 },
      30n * TGAS,
      0n
    ),
  ]);
  attackTxs.A1 = a1Tx.txHash;
  console.log(`   BLOCKED (${a1Tx.txHash}): ${findFailureMessage(a1Tx)}`);

  console.log(`10. Executing live on-chain Attack A2 (Drain vault while ${seat1Id} is listed) ...`);
  const a2Tx = await signAndSendTx(aliceKey, seat1Id, [
    Actions.functionCall("withdraw", { amount: "10000" }, 30n * TGAS, 1n),
  ]);
  attackTxs.A2 = a2Tx.txHash;
  console.log(`   BLOCKED (${a2Tx.txHash}): ${findFailureMessage(a2Tx)}`);

  console.log(`11. Executing live on-chain Attack A3 (Buy with mismatched listing nonce) ...`);
  const a3Tx = await signAndSendTx(bobKey, accounts.registryId, [
    Actions.functionCall(
      "buy_seat",
      { token_id: seat1Id, nonce: 99, min_balance: "0" },
      80n * TGAS,
      (15n * NEAR) / 10n
    ),
  ]);
  attackTxs.A3 = a3Tx.txHash;
  console.log(`   BLOCKED (${a3Tx.txHash}): ${findFailureMessage(a3Tx)}`);

  console.log(`12. Bob buys ${seat1Id} safely (1.5 NEAR) & Alice lists ${seat2Id} so market stays active ...`);
  const buyTx = await signAndSendTx(bobKey, accounts.registryId, [
    Actions.functionCall(
      "buy_seat",
      {
        token_id: seat1Id,
        nonce: 1,
        min_balance: (NEAR / 10n).toString(),
      },
      150n * TGAS,
      (15n * NEAR) / 10n
    ),
  ]);
  console.log(`   tx: ${buyTx.txHash}`);

  console.log(`13. Executing live on-chain Attack A7 (Former owner Alice tries to withdraw from ${seat1Id} after sale) ...`);
  const a7Tx = await signAndSendTx(aliceKey, seat1Id, [
    Actions.functionCall("withdraw", { amount: "10000" }, 30n * TGAS, 1n),
  ]);
  attackTxs.A7 = a7Tx.txHash;
  console.log(`   BLOCKED (${a7Tx.txHash}): ${findFailureMessage(a7Tx)}`);

  // List seat2Id so the marketplace has a live listing for judges to inspect/buy
  const list2Tx = await signAndSendTx(aliceKey, accounts.registryId, [
    Actions.functionCall(
      "list_seat",
      {
        token_id: seat2Id,
        price: ((15n * NEAR) / 10n).toString(),
        min_balance: (NEAR / 10n).toString(),
        ttl_sec: 14 * 86400,
      },
      100n * TGAS,
      1n
    ),
  ]);
  console.log(`14. Listed ${seat2Id} for live market inspection (tx: ${list2Tx.txHash})`);

  const deploymentMeta = {
    network: "testnet",
    registryId: accounts.registryId,
    organizerId: accounts.aliceId,
    kasKlubId: accounts.aliceId,
    buyerId: accounts.bobId,
    sampleSeatId: seat1Id,
    listedSeatId: seat2Id,
    vaultCodeHash,
    registryCodeHash,
    deployedAt: new Date().toISOString(),
    transactions: {
      deployAndInit: deployTx.txHash,
      pinVaultWasm: pinTx.txHash,
      mintSeat1: mint1Tx.txHash,
      mintSeat2: mint2Tx.txHash,
      createEvent: evTx.txHash,
      buyTicket: ticketTx.txHash,
      claimPool: claimTx.txHash,
      listSeat1: listTx.txHash,
      buySeat1: buyTx.txHash,
      listSeat2: list2Tx.txHash,
    },
    attackTransactions: attackTxs,
  };

  const outPath = path.join(ROOT, "docs", "deployment.testnet.json");
  fs.writeFileSync(outPath, JSON.stringify(deploymentMeta, null, 2) + "\n", "utf8");
  console.log(`\n[SUCCESS] Saved live deployment metadata to ${outPath}`);
}

export async function sealRegistry() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing to seal without --confirm flag.");
    process.exit(1);
  }
  const outPath = path.join(ROOT, "docs", "deployment.testnet.json");
  const meta = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const regKey = generateOrLoadAccountKey(meta.registryId);
  console.log(`Sealing parent registry ${meta.registryId} by deleting FullAccess key ${regKey.publicKeyStr} ...`);
  const sealTx = await signAndSendTx(regKey, meta.registryId, [
    Actions.deleteKey(regKey.pubRaw),
  ]);
  console.log(`   Sealed tx: ${sealTx.txHash}`);
  meta.transactions.sealRegistry = sealTx.txHash;
  fs.writeFileSync(outPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
  console.log(`[SUCCESS] Parent registry ${meta.registryId} now has 0 access keys (Segel Induk active).`);
}

if (process.argv[1] === __filename) {
  const sub = process.argv[2] || "prepare";
  if (sub === "prepare") {
    await prepareAccounts();
  } else if (sub === "deploy") {
    await deployAndSeed();
  } else if (sub === "seal") {
    await sealRegistry();
  } else {
    console.error("Usage: node scripts/deploy-testnet.mjs [prepare | deploy --confirm | seal --confirm]");
    process.exit(1);
  }
}
