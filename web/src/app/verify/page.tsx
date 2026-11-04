"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import {
  EXPLORER_URL,
  getNftTokens,
  verifyKeylessProofOnChain,
  viewAccount,
} from "@/lib/near/rpc";
import type { AccountViewResult, KeylessProofCheck } from "@/lib/near/types";
import { formatYocto } from "@/lib/near/format";

export default function GlobalVerifyPage() {
  const {
    registryId,
    config,
    parentKeysCount,
    finalBlockHeight,
    finalBlockHash,
    refreshChainState,
  } = useNear();

  const [registryAccount, setRegistryAccount] =
    useState<AccountViewResult | null>(null);
  const [seatProofs, setSeatProofs] = useState<
    Record<string, KeylessProofCheck>
  >({});
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const runGlobalVerification = useCallback(async () => {
    setLoading(true);
    try {
      await refreshChainState();
      const [regAcct, tokens] = await Promise.all([
        viewAccount(registryId).catch(() => null),
        getNftTokens(registryId, "0", 50),
      ]);
      setRegistryAccount(regAcct);

      const ids = tokens.map((t) => t.token_id);
      setSeatIds(ids);

      const proofs = await Promise.all(
        ids.map(async (id) => {
          const p = await verifyKeylessProofOnChain(id, registryId);
          return [id, p] as const;
        })
      );
      setSeatProofs(Object.fromEntries(proofs));
    } finally {
      setLoading(false);
    }
  }, [registryId, refreshChainState]);

  useEffect(() => {
    runGlobalVerification();
  }, [runGlobalVerification]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-gold-500/25 bg-obsidian-800/80 p-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-segel-400">
            Sharded NFT Items Draft 1.0.0 · Tier T0–T3 Global Verifier
          </span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">
            Bukti Tanpa Kunci · Global Protocol Verification
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-300">
            Live on-chain audit of the parent Segel status (`view_access_key_list` == 0),
            pinned <span className="font-mono text-gold-300">vault_code_hash</span>, and
            every minted seat sub-account at final block{" "}
            <span className="font-mono text-gold-300">
              #{finalBlockHeight?.toLocaleString() ?? "—"}
            </span>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={runGlobalVerification}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 px-4 py-2.5 text-xs font-bold text-obsidian-950 shadow transition hover:brightness-110 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Re-Run Full Chain Audit
        </button>
      </div>

      {/* Parent Registry & Config Verification Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-gold-500/30 bg-obsidian-900/90 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-gold-400">
              Tier T3 Provenance · Parent Registry Segel
            </span>
            {parentKeysCount === 0 && registryAccount ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-segel-500 bg-segel-500/15 px-3 py-0.5 font-mono text-xs font-bold text-segel-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                SEALED (0 KEYS)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 font-mono text-xs text-amber-300">
                Keys: {parentKeysCount ?? "—"}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Registry Account:</span>
              <a
                href={`${EXPLORER_URL}/address/${registryId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-gold-300 hover:underline"
              >
                {registryId}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Access Keys Count:</span>
              <span
                className={
                  parentKeysCount === 0
                    ? "font-bold text-segel-400"
                    : "text-amber-300"
                }
              >
                {parentKeysCount !== null ? `${parentKeysCount} keys` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Registry Code Hash:</span>
              <span className="truncate max-w-[230px] text-slate-200">
                {registryAccount?.code_hash || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pinned Final Block Hash:</span>
              <span className="truncate max-w-[230px] text-slate-400">
                {finalBlockHash || "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gold-500/30 bg-obsidian-900/90 p-6 space-y-3">
          <span className="font-mono text-xs uppercase tracking-wider text-gold-400">
            Immutable Protocol Configuration (`get_config`)
          </span>
          <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Expected Vault Code Hash:</span>
              <span className="truncate max-w-[240px] font-bold text-segel-400">
                {config?.vault_code_hash || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Seat Mint Price:</span>
              <span className="text-white">
                {formatYocto(config?.seat_price ?? "0")} NEAR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vault Initial Storage Reserve:</span>
              <span className="text-white">
                {formatYocto(config?.vault_initial_balance ?? "0")} NEAR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Secondary Sale Royalty:</span>
              <span className="text-gold-300">
                {config ? `${config.royalty_bps / 100}%` : "5%"} →{" "}
                {config?.kas_klub_id || "Kas Klub"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <KratonDivider label="Per-Seat Keyless & Pair-Check Matrix" />

      {/* Seat Verification Table */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6">
        <h2 className="mb-4 font-serif text-2xl font-bold text-white">
          All Minted Seats Verification ({seatIds.length})
        </h2>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-obsidian-900/60" />
        ) : seatIds.length === 0 ? (
          <p className="font-mono text-xs text-slate-400">
            No seats minted yet on `{registryId}`. Visit{" "}
            <Link href="/seats" className="text-gold-300 underline">
              /seats
            </Link>{" "}
            to mint or inspect a specific seat.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2">Seat (`token_id`)</th>
                  <th className="pb-2">Vault Owner (@seq)</th>
                  <th className="pb-2">T0 Namespace</th>
                  <th className="pb-2">T1/T2 Pair Check</th>
                  <th className="pb-2">0 Access Keys</th>
                  <th className="pb-2">Vault Code Hash</th>
                  <th className="pb-2">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {seatIds.map((id) => {
                  const p = seatProofs[id];
                  return (
                    <tr key={id}>
                      <td className="py-3 font-bold text-gold-300">
                        <Link
                          href={`/seat/${encodeURIComponent(id)}`}
                          className="hover:underline"
                        >
                          {id}
                        </Link>
                      </td>
                      <td className="py-3 text-white">
                        {p?.vaultOwner ?? "—"} (#{p?.vaultSeq ?? "—"})
                      </td>
                      <td className="py-3">
                        {p?.t0NamespaceOk ? (
                          <span className="text-segel-400">✓ Direct Child</span>
                        ) : (
                          <span className="text-threat-400">✗ Invalid</span>
                        )}
                      </td>
                      <td className="py-3">
                        {p?.pairStatus === "Consistent" ? (
                          <span className="text-segel-400">✓ Consistent</span>
                        ) : p?.pairStatus === "IndexBehind" ? (
                          <span className="text-amber-300">⟳ IndexBehind</span>
                        ) : (
                          <span className="text-threat-400">✗ Divergent</span>
                        )}
                      </td>
                      <td className="py-3">
                        {p?.seatZeroKeysOk ? (
                          <span className="font-bold text-segel-400">
                            ✓ 0 Keys
                          </span>
                        ) : (
                          <span className="text-threat-400">
                            {p?.seatKeysCount ?? "—"} Keys
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {p?.vaultCodeHashOk ? (
                          <span className="text-segel-400">✓ Matches Config</span>
                        ) : (
                          <span className="text-slate-400">
                            {p?.actualCodeHash.slice(0, 10)}...
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {p?.allVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-segel-500/20 px-2.5 py-0.5 text-[10px] font-bold text-segel-400">
                            <CheckCircle2 className="h-3 w-3" />
                            BUKTI TANPA KUNCI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] text-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            Check Detail
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
