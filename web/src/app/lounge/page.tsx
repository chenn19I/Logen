"use client";

import React, { useCallback, useEffect, useState } from "react";
import nacl from "tweetnacl";
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertOctagon,
  KeyRound,
  RefreshCw,
  Terminal,
  Sparkles,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import { signNep413WithSecretKey } from "@/lib/gate/nep413";

interface ProtectedLoungeData {
  authenticated: boolean;
  mode?: "onchain" | "inspector";
  code?: string;
  error?: string;
  session?: {
    accountId: string;
    tokenId: string;
    registryId: string;
    rotationSeq: number;
    blockHeight: number;
    blockHash: string;
    iat: number;
    exp: number;
  };
  reverifiedAtBlock?: {
    blockHeight: number;
    blockHash: string;
    vaultOwner: string;
    vaultSeq: number;
  };
  loungeContent?: {
    title: string;
    subtitle: string;
    verifiedSeat: string;
    verifiedOwner: string;
    boundRotationSeq: number;
    perks: { code: string; title: string; description: string }[];
    dispatches: {
      id: string;
      date: string;
      author: string;
      heading: string;
      body: string;
    }[];
  };
}

export default function LoungeGatePage() {
  const {
    accountId,
    registryId,
    openWalletModal,
    signNep413Message,
  } = useNear();

  const [gateData, setGateData] = useState<ProtectedLoungeData | null>(null);
  const [loadingGate, setLoadingGate] = useState<boolean>(true);
  const [authStep, setAuthStep] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customTokenId, setCustomTokenId] = useState<string>("");

  // Judge Inspector Telemetry State
  const [inspectorLog, setInspectorLog] = useState<{
    nonceHex: string;
    message: string;
    recipient: string;
    publicKeyNear: string;
    signatureBase64: string;
    borshHex: string;
    sha256Hex: string;
    verifyResponse: Record<string, unknown> | null;
  } | null>(null);

  const fetchProtectedContent = useCallback(
    async (simRotatedSeq?: number, simOwner?: string) => {
      setLoadingGate(true);
      try {
        const params = new URLSearchParams();
        if (simRotatedSeq !== undefined) {
          params.set("simRotatedSeq", String(simRotatedSeq));
        }
        if (simOwner) {
          params.set("simOwner", simOwner);
        }
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/gate/content${query}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as ProtectedLoungeData;
        setGateData(data);
        if (!res.ok && data.error) {
          setAuthError(`[${data.code || res.status}] ${data.error}`);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingGate(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchProtectedContent();
  }, [fetchProtectedContent]);

  // Live Wallet NEP-413 Login Flow
  const handleWalletNep413Login = async () => {
    setAuthError(null);
    if (!accountId) {
      openWalletModal();
      return;
    }
    try {
      setAuthStep("1/3 Requesting 32-byte nonce from POST /api/gate/challenge...");
      const chalRes = await fetch("/api/gate/challenge", { method: "POST" });
      const chal = await chalRes.json();

      setAuthStep(
        "2/3 Signing NEP-413 payload in NEAR Wallet (tag = 2147484061)..."
      );
      const signed = await signNep413Message({
        message: chal.message,
        recipient: chal.recipient,
        nonceBase64: chal.nonceBase64,
      });

      setAuthStep(
        "3/3 Verifying Ed25519 signature + FullAccess key + Same-Final-Block Pair Check..."
      );
      const verRes = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: signed.accountId,
          publicKey: signed.publicKey,
          signature: signed.signature,
          registryId,
          tokenId: customTokenId.trim() || undefined,
          challengeToken: chal.challengeToken,
        }),
      });
      const verData = await verRes.json();
      if (!verRes.ok) {
        throw new Error(
          `[${verData.code || verRes.status}] ${
            verData.error || "Verification rejected"
          }`
        );
      }

      setAuthStep(null);
      await fetchProtectedContent();
    } catch (err) {
      setAuthStep(null);
      setAuthError(err instanceof Error ? err.message : String(err));
    }
  };

  // Judge Cryptographic Inspector Flow
  const runInspectorScenario = async (
    scenario: "happy" | "d5_index_behind" | "not_owner"
  ) => {
    setAuthError(null);
    setAuthStep("Running real NEP-413 Borsh + Ed25519 verification in Inspector...");
    try {
      const chalRes = await fetch("/api/gate/challenge", { method: "POST" });
      const chal = await chalRes.json();
      const nonceBytes = new Uint8Array(Buffer.from(chal.nonceHex, "hex"));

      // Generate ephemeral Ed25519 keypair and sign real NEP-413 Borsh bytes
      const kp = nacl.sign.keyPair();
      const signed = signNep413WithSecretKey(
        {
          message: chal.message,
          nonce: nonceBytes,
          recipient: chal.recipient,
          callbackUrl: null,
        },
        kp.secretKey
      );

      const mockChain =
        scenario === "happy"
          ? {
              enabled: true,
              tokenId: `s001.${registryId}`,
              indexOwner: "alice.testnet",
              indexSeq: 3,
              vaultOwner: "alice.testnet",
              vaultSeq: 3,
            }
          : scenario === "d5_index_behind"
          ? {
              enabled: true,
              tokenId: `s001.${registryId}`,
              indexOwner: "alice.testnet",
              indexSeq: 3,
              vaultOwner: "bob.testnet",
              vaultSeq: 4,
            }
          : {
              enabled: true,
              tokenId: `s001.${registryId}`,
              indexOwner: "bob.testnet",
              indexSeq: 4,
              vaultOwner: "bob.testnet",
              vaultSeq: 4,
            };

      const verRes = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: "alice.testnet",
          publicKey: signed.publicKeyNear,
          signature: signed.signatureBase64,
          registryId,
          challengeToken: chal.challengeToken,
          inspectorMockChain: mockChain,
        }),
      });
      const verData = await verRes.json();

      setInspectorLog({
        nonceHex: chal.nonceHex,
        message: chal.message,
        recipient: chal.recipient,
        publicKeyNear: signed.publicKeyNear,
        signatureBase64: signed.signatureBase64,
        borshHex: signed.serializedHex,
        sha256Hex: signed.hashHex,
        verifyResponse: verData,
      });

      setAuthStep(null);
      if (!verRes.ok) {
        setAuthError(`[${verData.code || verRes.status}] ${verData.error}`);
      } else {
        await fetchProtectedContent();
      }
    } catch (err) {
      setAuthStep(null);
      setAuthError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLogout = async () => {
    await fetch("/api/gate/content", { method: "DELETE" });
    setGateData({ authenticated: false });
    setAuthError(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-gold-500/30 bg-obsidian-800/85 p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              Track Requirement R2 · NEP-413 + Same-Final-Block T2 Pair Check
            </span>
            <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl">
              Pendopo Agung · Holder-Only Gated Lounge
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-300">
              Authenticates seat holders via off-chain{" "}
              <span className="font-mono text-gold-300">NEP-413</span> Borsh signatures (
              <span className="font-mono">tag = 2^31 + 413</span>), verifies active{" "}
              <span className="font-mono">FullAccess</span> key ownership on-chain, and
              re-verifies <span className="font-mono text-segel-400">vault.nft_item_info</span>{" "}
              at the latest final block on <strong className="text-white">every single HTTP request</strong>{" "}
              so a former owner is locked out the very block their seat rotates.
            </p>
          </div>

          {gateData?.authenticated ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-segel-500 bg-segel-500/15 px-3.5 py-1.5 font-mono text-xs font-bold text-segel-400">
                <Unlock className="h-4 w-4" />
                GATE UNLOCKED · SEQ #{gateData.session?.rotationSeq}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-obsidian-900 px-3 py-1.5 text-xs text-slate-300 hover:text-threat-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                End Session
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-threat-500/50 bg-threat-500/15 px-3.5 py-1.5 font-mono text-xs font-bold text-threat-400">
              <Lock className="h-4 w-4" />
              GATE LOCKED · FAIL-CLOSED
            </span>
          )}
        </div>
      </div>

      {/* Status / Error Banner */}
      {authStep && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold-500/40 bg-obsidian-800 p-4 font-mono text-xs text-gold-300">
          <RefreshCw className="h-4 w-4 animate-spin text-gold-400" />
          {authStep}
        </div>
      )}

      {authError && (
        <div className="flex items-start gap-3 rounded-2xl border border-threat-500/50 bg-threat-500/10 p-4 font-mono text-xs text-threat-400">
          <AlertOctagon className="h-5 w-5 shrink-0 text-threat-400" />
          <div>
            <p className="font-bold">Gate Rejection (Fail-Closed Security):</p>
            <p className="mt-1">{authError}</p>
          </div>
        </div>
      )}

      {/* Main Content: Locked vs Unlocked */}
      {gateData?.authenticated && gateData.loungeContent ? (
        <section className="space-y-6 rounded-3xl border border-segel-500/40 bg-gradient-to-br from-obsidian-800/95 via-obsidian-900 to-obsidian-950 p-6 shadow-2xl lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-segel-500/20 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-gold-400" />
                <span className="font-mono text-xs uppercase tracking-widest text-segel-400">
                  Verified Holder Session ({gateData.mode?.toUpperCase()})
                </span>
              </div>
              <h2 className="mt-1 font-serif text-3xl font-bold text-white">
                {gateData.loungeContent.title}
              </h2>
              <p className="text-xs text-slate-300">
                Seat:{" "}
                <strong className="font-mono text-gold-300">
                  {gateData.loungeContent.verifiedSeat}
                </strong>{" "}
                · Canonical Owner:{" "}
                <strong className="font-mono text-white">
                  {gateData.loungeContent.verifiedOwner}
                </strong>{" "}
                · Bound Epoch:{" "}
                <strong className="font-mono text-segel-400">
                  rotation_seq #{gateData.loungeContent.boundRotationSeq}
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchProtectedContent()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-segel-500/40 bg-segel-500/10 px-3.5 py-2 font-mono text-xs text-segel-400 hover:bg-segel-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-Verify Session at Latest Block
              </button>
              <button
                type="button"
                onClick={() =>
                  fetchProtectedContent(
                    (gateData.session?.rotationSeq ?? 0) + 1,
                    "bob.testnet"
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-threat-500/50 bg-threat-500/15 px-3.5 py-2 font-mono text-xs font-bold text-threat-400 hover:bg-threat-500/25"
              >
                Simulate Transfer (`rotation_seq + 1` → Threat D1)
              </button>
            </div>
          </div>

          {/* Holder Perks */}
          <div className="grid gap-4 md:grid-cols-3">
            {gateData.loungeContent.perks.map((perk) => (
              <div
                key={perk.code}
                className="rounded-2xl border border-gold-500/30 bg-obsidian-950/90 p-4"
              >
                <span className="rounded border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 font-mono text-[10px] text-gold-300">
                  {perk.code}
                </span>
                <h3 className="mt-2 font-serif text-lg font-bold text-white">
                  {perk.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {perk.description}
                </p>
              </div>
            ))}
          </div>

          {/* Inner Sanctum Dispatches */}
          <div className="grid gap-4 md:grid-cols-2">
            {gateData.loungeContent.dispatches.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-slate-800 bg-obsidian-950/80 p-5"
              >
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span>
                    {d.id} · {d.author}
                  </span>
                  <span>{d.date}</span>
                </div>
                <h4 className="mt-2 font-serif text-xl font-bold text-gold-300">
                  {d.heading}
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {d.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-12">
          {/* Wallet NEP-413 Sign-In Card */}
          <div className="space-y-4 rounded-3xl border border-gold-500/30 bg-obsidian-800/90 p-6 lg:col-span-6">
            <div className="flex items-center gap-2 text-gold-400">
              <KeyRound className="h-5 w-5" />
              <span className="font-mono text-xs uppercase tracking-widest">
                Live NEAR Testnet Authentication
              </span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">
              Sign In with Connected NEAR Wallet (NEP-413)
            </h2>
            <p className="text-xs leading-relaxed text-slate-300">
              Signs an off-chain <span className="font-mono text-gold-300">NEP-413</span>{" "}
              challenge (0 gas). The server checks your signing key via{" "}
              <span className="font-mono">view_access_key</span> and runs the{" "}
              <span className="font-mono">T2 Pair Check</span> against{" "}
              <span className="font-mono text-gold-300">{registryId}</span> and your seat
              vault at the same final block.
            </p>

            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Optional Specific Seat ID (leave blank to auto-detect via `nft_tokens_for_owner`)
              </label>
              <input
                type="text"
                value={customTokenId}
                onChange={(e) => setCustomTokenId(e.target.value)}
                placeholder={`s001.${registryId}`}
                className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2 font-mono text-xs text-white"
              />
            </div>

            <button
              type="button"
              disabled={loadingGate}
              onClick={handleWalletNep413Login}
              className="w-full rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-3 text-xs font-bold text-obsidian-950 shadow-[0_0_25px_rgba(212,166,74,0.25)] transition hover:brightness-110"
            >
              {accountId
                ? `Sign NEP-413 Challenge as ${accountId}`
                : "Connect NEAR Wallet to Sign NEP-413 Challenge"}
            </button>
          </div>

          {/* Gate Threat Protection Summary */}
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-obsidian-900/90 p-6 lg:col-span-6">
            <div className="flex items-center gap-2 text-segel-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-mono text-xs uppercase tracking-widest">
                Gate Security Guarantees (D1–D5)
              </span>
            </div>
            <h3 className="font-serif text-2xl font-bold text-white">
              Why Former Owners Cannot Keep Lounge Access
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-segel-400" />
                <span>
                  <strong>Borsh Tag Prefix (`2147484061`):</strong> Prevents signing
                  a valid NEAR transaction disguised as an off-chain login message.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-segel-400" />
                <span>
                  <strong>Same-Final-Block T2 Pair Check (Defeats D5):</strong> Queries
                  both `registry` and `vault` at the exact same final `block_id`. If
                  `vault.rotation_seq &gt; index.seq`, the gate fails closed (`E_PAIR_INDEX_BEHIND`).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-segel-400" />
                <span>
                  <strong>Per-Request Re-Verification (Defeats D1):</strong> Every
                  `GET /api/gate/content` re-checks `vault.rotation_seq == session.rotationSeq`.
                  Selling or transferring your seat revokes your cookie in the very next block.
                </span>
              </li>
            </ul>
          </div>
        </section>
      )}

      <KratonDivider label="Interactive Demo / Judge Cryptographic Inspector" />

      {/* Judge Cryptographic Inspector Panel */}
      <section className="rounded-3xl border border-gold-500/35 bg-obsidian-900/95 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Terminal className="h-6 w-6 text-gold-400" />
            <div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Judge NEP-413 & Session Revocation Inspector
              </h2>
              <p className="text-xs text-slate-400">
                Test real Borsh NEP-413 serialization (`tag = 2147484061`), Ed25519
                verification, D5 stale-index fail-closed, and D1 instant session
                revocation on transfer right in your browser.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runInspectorScenario("happy")}
              className="rounded-xl bg-segel-500 px-3.5 py-2 font-mono text-xs font-bold text-obsidian-950 hover:bg-segel-400"
            >
              1. Test Valid Holder Sign-In (`seq=3`)
            </button>
            <button
              type="button"
              onClick={() => runInspectorScenario("d5_index_behind")}
              className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-3.5 py-2 font-mono text-xs font-bold text-amber-300 hover:bg-amber-500/25"
            >
              2. Test Threat D5 (`vault.seq=4 &gt; index.seq=3`)
            </button>
            <button
              type="button"
              onClick={() => fetchProtectedContent(4, "bob.testnet")}
              className="rounded-xl border border-threat-500/50 bg-threat-500/15 px-3.5 py-2 font-mono text-xs font-bold text-threat-400 hover:bg-threat-500/25"
            >
              3. Test Threat D1 (`rotation_seq` Advances 3 → 4)
            </button>
          </div>
        </div>

        {inspectorLog ? (
          <div className="grid gap-4 lg:grid-cols-2 font-mono text-xs">
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-obsidian-950 p-4">
              <p className="font-bold text-gold-300">
                NEP-413 Borsh Payload & Ed25519 Signature
              </p>
              <div className="space-y-1 text-[11px]">
                <p className="text-slate-400">
                  Tag Prefix (u32 LE):{" "}
                  <span className="text-white">2147484061 (0x9d010080)</span>
                </p>
                <p className="text-slate-400">
                  Recipient:{" "}
                  <span className="text-white">{inspectorLog.recipient}</span>
                </p>
                <p className="truncate text-slate-400">
                  Nonce (32B hex):{" "}
                  <span className="text-gold-300">{inspectorLog.nonceHex}</span>
                </p>
                <p className="truncate text-slate-400">
                  Signer Public Key:{" "}
                  <span className="text-segel-400">{inspectorLog.publicKeyNear}</span>
                </p>
                <p className="truncate text-slate-400">
                  SHA-256 Digest:{" "}
                  <span className="text-white">{inspectorLog.sha256Hex}</span>
                </p>
                <p className="break-all text-slate-400">
                  Borsh Bytes (hex):{" "}
                  <span className="text-slate-300">{inspectorLog.borshHex}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-800 bg-obsidian-950 p-4">
              <p className="font-bold text-segel-400">
                Server Verification & Pair Check Response
              </p>
              <pre className="max-h-48 overflow-auto text-[11px] text-slate-200">
                {JSON.stringify(inspectorLog.verifyResponse, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-6 text-center font-mono text-xs text-slate-400">
            Click any of the 3 buttons above to inspect live NEP-413 Borsh bytes,
            Ed25519 signature verification, and same-final-block Pair Check outcomes.
          </div>
        )}
      </section>
    </div>
  );
}
