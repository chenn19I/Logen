"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Landmark,
  Coins,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import { EXPLORER_URL, getSales } from "@/lib/near/rpc";
import type { Sale } from "@/lib/near/types";
import { formatTimestampMs, formatYocto } from "@/lib/near/format";

export default function TreasuryPage() {
  const {
    accountId,
    registryId,
    config,
    stats,
    refreshChainState,
    openWalletModal,
    callContractMethod,
  } = useNear();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await refreshChainState();
      const s = await getSales(registryId, 0, 50);
      setSales(s);
    } finally {
      setLoading(false);
    }
  }, [registryId, refreshChainState]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRelease = async (
    method: "release_kas_klub" | "release_organizer"
  ) => {
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsBusy(true);
    setStatusMsg(null);
    try {
      await callContractMethod({
        receiverId: registryId,
        methodName: method,
        args: {},
        gas: "30000000000000",
        deposit: "0",
      });
      setStatusMsg(`Executed ${method}() successfully!`);
      await loadData();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-gold-500/25 bg-obsidian-800/80 p-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
            Design Decision K10 · Permissionless Pull Ledgers
          </span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">
            Kas Klub Treasury & Protocol Ledgers
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-300">
            To prevent failed cross-contract pushes from ever blocking a ticket sale or
            seat settlement, all outgoing payments in{" "}
            <span className="font-mono text-gold-300">{registryId}</span> use pull
            ledgers. Fixed recipient addresses (<span className="font-mono">kas_klub_id</span>{" "}
            and <span className="font-mono">organizer_id</span>) are immutable from deploy;
            anyone may trigger <span className="font-mono">release_kas_klub</span> or{" "}
            <span className="font-mono">release_organizer</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-obsidian-900 px-4 py-2 text-xs text-slate-300 hover:text-gold-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Ledgers
        </button>
      </div>

      {statusMsg && (
        <div className="rounded-2xl border border-gold-500/40 bg-obsidian-800 p-4 font-mono text-xs text-gold-300">
          {statusMsg}
        </div>
      )}

      {/* Three Core Treasury Books */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 1. Kas Klub Ledger */}
        <div className="flex flex-col justify-between rounded-3xl border border-segel-500/35 bg-obsidian-900/90 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-segel-400">
                50% Ticket Cut + 5% Secondary Royalties
              </span>
              <Landmark className="h-5 w-5 text-segel-400" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">
              Kas Klub (Club Treasury)
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Fixed Recipient:</span>
                <span className="font-bold text-white">
                  {config?.kas_klub_id || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Owed (`kas_klub_owed`):</span>
                <span className="text-base font-bold text-segel-400">
                  {formatYocto(stats?.kas_klub_owed ?? "0")} NEAR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Released:</span>
                <span className="text-slate-200">
                  {formatYocto(stats?.kas_klub_released ?? "0")} NEAR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Royalties Accrued:</span>
                <span className="text-gold-300">
                  {formatYocto(stats?.royalties_total ?? "0")} NEAR
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy || BigInt(stats?.kas_klub_owed || "0") === 0n}
            onClick={() => handleRelease("release_kas_klub")}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-segel-500 to-segel-400 py-3 text-xs font-bold text-obsidian-950 shadow transition hover:brightness-110 disabled:opacity-40"
          >
            Trigger `release_kas_klub()` (30 Tgas)
          </button>
        </div>

        {/* 2. Organizer Ledger */}
        <div className="flex flex-col justify-between rounded-3xl border border-indigo-500/35 bg-obsidian-900/90 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-indigo-300">
                10% Primary Ticket Cut
              </span>
              <Coins className="h-5 w-5 text-indigo-400" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">
              Organizer Pull Ledger
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Fixed Recipient:</span>
                <span className="font-bold text-white">
                  {config?.organizer_id || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Owed (`organizer_owed`):</span>
                <span className="text-base font-bold text-indigo-300">
                  {formatYocto(stats?.organizer_owed ?? "0")} NEAR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Released:</span>
                <span className="text-slate-200">
                  {formatYocto(stats?.organizer_released ?? "0")} NEAR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Events Created:</span>
                <span className="text-slate-300">{stats?.events_count ?? 0}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy || BigInt(stats?.organizer_owed || "0") === 0n}
            onClick={() => handleRelease("release_organizer")}
            className="mt-5 w-full rounded-xl bg-indigo-500 py-3 text-xs font-bold text-white shadow transition hover:bg-indigo-400 disabled:opacity-40"
          >
            Trigger `release_organizer()` (30 Tgas)
          </button>
        </div>

        {/* 3. Member Pool Accumulator Book */}
        <div className="flex flex-col justify-between rounded-3xl border border-gold-500/35 bg-obsidian-900/90 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-gold-400">
                40% Primary Ticket Cut · O(1) Accrual
              </span>
              <CheckCircle2 className="h-5 w-5 text-gold-400" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">
              Pool Anggota (Seat Holders)
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Accumulator (`acc`):</span>
                <span className="text-base font-bold text-gold-300">
                  {formatYocto(stats?.acc ?? "0")} NEAR/seat
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Distributed:</span>
                <span className="text-white">
                  {formatYocto(stats?.total_pool_distributed ?? "0")} NEAR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Claimed to Vaults:</span>
                <span className="text-segel-400">
                  {formatYocto(stats?.total_claimed ?? "0")} NEAR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Remainder Carry (`carry`):</span>
                <span className="text-slate-300">
                  {stats?.carry ?? "0"} yoctoNEAR
                </span>
              </div>
            </div>
          </div>

          <a
            href={`${EXPLORER_URL}/address/${registryId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold-500/40 bg-obsidian-950 py-3 text-xs font-semibold text-gold-300 hover:bg-obsidian-800"
          >
            Inspect `{registryId}` on NearBlocks
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <KratonDivider label="Secondary Sales & Royalty Feed (`get_sales`)" />

      {/* Secondary Sales Table */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-2xl font-bold text-white">
            Secondary Sales & 5% Kas Klub Royalty Log
          </h3>
          <span className="font-mono text-xs text-slate-400">
            Total Volume: {formatYocto(stats?.sales_volume ?? "0")} NEAR
          </span>
        </div>

        {sales.length === 0 ? (
          <p className="font-mono text-xs text-slate-400">
            No secondary sales recorded on `{registryId}` yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2">Seat</th>
                  <th className="pb-2">Seller</th>
                  <th className="pb-2">Buyer</th>
                  <th className="pb-2">Sale Price</th>
                  <th className="pb-2">Kas Klub Royalty</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sales.map((s, idx) => (
                  <tr key={`${s.token_id}-${s.at_ms}-${idx}`}>
                    <td className="py-2.5 font-bold text-gold-300">{s.token_id}</td>
                    <td className="py-2.5 text-slate-300">{s.seller}</td>
                    <td className="py-2.5 text-segel-400">{s.buyer}</td>
                    <td className="py-2.5 text-white">{formatYocto(s.price)} NEAR</td>
                    <td className="py-2.5 text-gold-400">
                      {formatYocto(s.royalty)} NEAR
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {formatTimestampMs(s.at_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
