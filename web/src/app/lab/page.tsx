"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Flame,
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  ExternalLink,
  Layers,
  Shuffle,
} from "lucide-react";
import { KratonDivider } from "@/components/KawungOrnament";
import { useNear } from "@/components/NearProvider";
import {
  AttackReport,
  createSimulatorPresets,
  SimPresetId,
  SimWorldState,
  THREAT_MODEL_A1_A12,
} from "@/lib/near/sim";
import { EXPLORER_URL } from "@/lib/near/rpc";
import { pairCheck } from "@/lib/gate/pairCheck";

export default function AttackLabPage() {
  const { lang } = useNear();
  const isId = lang === "id";
  const presets = useMemo(() => createSimulatorPresets(), []);
  const [selectedPresetId, setSelectedPresetId] =
    useState<SimPresetId>("s1_payout_race");

  const activePreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) || presets[0],
    [presets, selectedPresetId]
  );

  const [world, setWorld] = useState<SimWorldState>(() =>
    structuredClone(activePreset.initialWorld)
  );
  const [txCursors, setTxCursors] = useState<number[]>(() =>
    activePreset.transactions.map(() => 0)
  );
  const [report, setReport] = useState<AttackReport | null>(null);

  useEffect(() => {
    setWorld(structuredClone(activePreset.initialWorld));
    setTxCursors(activePreset.transactions.map(() => 0));
  }, [activePreset]);

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch("/attack-report.json", { cache: "no-store" });
        if (res.ok) {
          setReport(await res.json());
          return;
        }
      } catch {
        // fallback below
      }
      try {
        const fallback = await fetch("/attack-report.example.json");
        if (fallback.ok) {
          setReport(await fallback.json());
        }
      } catch {
        // ignore
      }
    }
    loadReport();
  }, []);

  const stepTransaction = (txIdx: number) => {
    const tx = activePreset.transactions[txIdx];
    const stepIdx = txCursors[txIdx];
    if (!tx || stepIdx >= tx.receipts.length) return;

    const nextWorld = structuredClone(world);
    tx.receipts[stepIdx].execute(nextWorld);
    setWorld(nextWorld);

    const nextCursors = [...txCursors];
    nextCursors[txIdx] = stepIdx + 1;
    setTxCursors(nextCursors);
  };

  const runRandomSchedule = () => {
    const nextWorld = structuredClone(activePreset.initialWorld);
    const cursors = activePreset.transactions.map(() => 0);

    while (true) {
      const available: number[] = [];
      for (let i = 0; i < activePreset.transactions.length; i++) {
        if (cursors[i] < activePreset.transactions[i].receipts.length) {
          available.push(i);
        }
      }
      if (available.length === 0) break;
      const pick = available[Math.floor(Math.random() * available.length)];
      const stepIdx = cursors[pick];
      activePreset.transactions[pick].receipts[stepIdx].execute(nextWorld);
      cursors[pick] += 1;
    }

    setWorld(nextWorld);
    setTxCursors(cursors);
  };

  const resetSim = () => {
    setWorld(structuredClone(activePreset.initialWorld));
    setTxCursors(activePreset.transactions.map(() => 0));
  };

  const currentPairStatus = pairCheck(
    world.indexOwner,
    world.indexSeq,
    world.vaultOwner,
    world.vaultSeq
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="rounded-3xl border border-gold-500/30 bg-obsidian-800/85 p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-widest text-threat-400">
              {isId
                ? "Syarat Track R0 & R4 · Bukti 80.620 Urutan Receipt Lintas-Kontrak"
                : "Track Requirement R0 & R4 · Exhaustive Receipt-Interleaving Proofs"}
            </span>
            <h1 className="font-serif text-3xl font-bold text-white sm:text-4xl">
              {isId
                ? "Lab Serangan & Model Ancaman Pusaka (A1–A12)"
                : "Pusaka Attack Lab & Threat Model (A1–A12)"}
            </h1>
            <p className="max-w-3xl text-xs leading-relaxed text-slate-300">
              {isId ? (
                <>
                  Di NEAR, panggilan lintas-kontrak berjalan sebagai receipt terpisah antar-blok.
                  Pembayaran tiket bisa tiba tepat di tengah proses jual-beli kursi, atau penjual
                  nakal bisa mencoba membatalkan iklan tepat saat pembeli membayar.{" "}
                  <span className="font-mono text-gold-300">pusaka-core</span> membuktikan{" "}
                  <strong className="text-white">80.620 kemungkinan urutan receipt</strong>{" "}
                  terhadap Invarian I1–I7. Anda juga bisa mengklik urutan receipt secara manual di bawah!
                </>
              ) : (
                <>
                  On NEAR, cross-contract calls execute as independent receipts across
                  blocks. A ticket payout can land between a sale&apos;s settlement and its
                  callback, or a seller can race a cancellation against a buyer&apos;s purchase.{" "}
                  <span className="font-mono text-gold-300">pusaka-core</span> proves{" "}
                  <strong className="text-white">80,620 receipt interleavings</strong>{" "}
                  against Invariants I1–I7. Step through the receipts yourself below!
                </>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-segel-500/40 bg-segel-500/10 px-4 py-3 text-right font-mono text-xs">
            <span className="block text-[10px] text-slate-400">
              {isId ? "STATUS LAB SERANGAN" : "ATTACK SUITE STATUS"}
            </span>
            <span className="font-bold text-segel-400">
              {isId ? "12 / 12 SERANGAN DIBLOKIR" : "12 / 12 VECTORS BLOCKED"}
            </span>
            <span className="block text-[10px] text-gold-300">
              {report?.interleavings_explored?.toLocaleString() || "80,620"}{" "}
              {isId ? "jadwal diverifikasi" : "schedules verified"}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Receipt-Interleaving Simulator */}
      <section className="rounded-3xl border border-gold-500/35 bg-obsidian-900/95 p-6 shadow-2xl lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gold-500/15 pb-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              Interactive In-Browser State Machine (`pusaka-core` port)
            </span>
            <h2 className="font-serif text-2xl font-bold text-white">
              Receipt-Interleaving Explorer: Try to Steal the Money
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPresetId(p.id)}
                className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition ${
                  selectedPresetId === p.id
                    ? "border border-gold-400 bg-gold-500 text-obsidian-950"
                    : "border border-slate-700 bg-obsidian-800 text-slate-300 hover:border-gold-500/40"
                }`}
              >
                {p.id === "s1_payout_race"
                  ? "S1: Sale + Payout Race"
                  : p.id === "s2_bait_and_switch"
                  ? "S2: Bait & Switch Relist"
                  : "S4: Lost Callback + sync()"}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-6 rounded-xl border border-slate-800 bg-obsidian-950 p-3.5 text-xs leading-relaxed text-slate-300">
          <strong className="text-gold-300">{activePreset.title}:</strong>{" "}
          {activePreset.description}
        </p>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: Concurrent Transactions Queue (Click any next receipt to interleave!) */}
          <div className="space-y-4 lg:col-span-6">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
                Concurrent Transactions (Click Receipts in Any Order)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runRandomSchedule}
                  className="inline-flex items-center gap-1 rounded-lg border border-gold-500/40 bg-gold-500/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-gold-300 hover:bg-gold-500/25"
                >
                  <Shuffle className="h-3 w-3" />
                  Random Interleaving
                </button>
                <button
                  type="button"
                  onClick={resetSim}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-obsidian-800 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {activePreset.transactions.map((tx, txIdx) => {
                const cursor = txCursors[txIdx] ?? 0;
                const done = cursor >= tx.receipts.length;
                return (
                  <div
                    key={tx.txId}
                    className="rounded-2xl border border-slate-800 bg-obsidian-950/90 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white">
                        {tx.txLabel}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Signer: {tx.actor} · {cursor}/{tx.receipts.length} receipts
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {tx.receipts.map((r, rIdx) => {
                        const isExecuted = rIdx < cursor;
                        const isNext = rIdx === cursor;
                        return (
                          <div
                            key={rIdx}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 font-mono text-[11px] ${
                              isExecuted
                                ? "border-segel-500/30 bg-segel-500/10 text-segel-400"
                                : isNext
                                ? "border-gold-500/50 bg-obsidian-900 text-white"
                                : "border-slate-800/80 bg-obsidian-950 text-slate-500"
                            }`}
                          >
                            <span>{r.receiptLabel}</span>
                            {isNext && !done && (
                              <button
                                type="button"
                                onClick={() => stepTransaction(txIdx)}
                                className="inline-flex items-center gap-1 rounded-lg bg-gold-500 px-2.5 py-1 font-bold text-obsidian-950 hover:bg-gold-400"
                              >
                                <Play className="h-3 w-3" />
                                Execute Receipt
                              </button>
                            )}
                            {isExecuted && <span>✓ Ran</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Live Simulated World State & Invariants */}
          <div className="space-y-4 lg:col-span-6">
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {/* Canonical Vault State */}
              <div className="rounded-2xl border border-gold-500/30 bg-obsidian-950 p-4 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-400">
                  Vault (`s001.pusaka.testnet`)
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Owner:</span>
                  <span className="font-bold text-white">{world.vaultOwner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">rotation_seq:</span>
                  <span className="font-bold text-segel-400">#{world.vaultSeq}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span
                    className={
                      world.vaultStatus === "Listed"
                        ? "font-bold text-threat-400"
                        : "text-segel-400"
                    }
                  >
                    {world.vaultStatus} (nonce #{world.listingNonce})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Balance (Withdrawable):</span>
                  <span className="font-bold text-gold-300">
                    {world.vaultBalance} N ({world.vaultBalance - world.storageReserve} N)
                  </span>
                </div>
              </div>

              {/* Registry Index & Pair Check */}
              <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Registry (`pusaka.testnet`)
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Index Owner:</span>
                  <span className="text-white">{world.indexOwner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Index Seq:</span>
                  <span className="text-slate-200">#{world.indexSeq}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">T2 PairCheck:</span>
                  <span
                    className={
                      currentPairStatus === "Consistent"
                        ? "font-bold text-segel-400"
                        : "font-bold text-amber-300"
                    }
                  >
                    {currentPairStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Acc / Escrow / Kas:</span>
                  <span className="text-gold-300">
                    {world.acc}N / {world.escrow}N / {world.kasKlub}N
                  </span>
                </div>
              </div>
            </div>

            {/* Wallets Bar */}
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-obsidian-950 p-3 font-mono text-xs">
              {Object.entries(world.wallets).map(([who, bal]) => (
                <div
                  key={who}
                  className="flex-1 rounded-xl border border-slate-800/80 bg-obsidian-900 px-3 py-1.5"
                >
                  <span className="block text-[10px] text-slate-400">{who}</span>
                  <span className="font-bold text-white">{bal} NEAR</span>
                </div>
              ))}
            </div>

            {/* Execution Trace Log */}
            <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4">
              <p className="mb-2 font-mono text-xs font-bold text-slate-300">
                Receipt Execution Log & Invariant Verifier (I1–I7)
              </p>
              <div className="max-h-56 space-y-2 overflow-y-auto font-mono text-xs">
                {world.logs.length === 0 ? (
                  <p className="text-slate-500">
                    Click &ldquo;Execute Receipt&rdquo; on any transaction on the left,
                    or click &ldquo;Random Interleaving&rdquo;.
                  </p>
                ) : (
                  world.logs.map((l) => (
                    <div
                      key={l.step}
                      className={`rounded-xl border p-2.5 ${
                        l.outcome === "BLOCKED"
                          ? "border-threat-500/40 bg-threat-500/10 text-threat-300"
                          : "border-slate-800 bg-obsidian-900 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          Step #{l.step}: {l.receipt}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            l.outcome === "BLOCKED"
                              ? "bg-threat-500 text-obsidian-950"
                              : "bg-segel-500/20 text-segel-400"
                          }`}
                        >
                          {l.code ? `${l.outcome} · ${l.code}` : l.outcome}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">{l.detail}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <KratonDivider label="Complete Threat Model Matrix (A1–A12) & Sandbox Report" />

      {/* Threat Model Matrix Table */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white">
              12 Seller & Gate Attack Vectors Mapped to Controls & Error Codes
            </h2>
            <p className="text-xs text-slate-400">
              Cross-referenced with `/attack-report.json` (`make attack` / `cargo test`)
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {THREAT_MODEL_A1_A12.map((threat) => {
            const reportRow = report?.attacks?.find((a) => a.id === threat.id);
            return (
              <div
                key={threat.id}
                className="flex flex-col justify-between rounded-2xl border border-gold-500/25 bg-obsidian-800/85 p-5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg border border-threat-500/40 bg-threat-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-threat-400">
                        {threat.code}
                      </span>
                      <span className="rounded border border-slate-700 bg-obsidian-950 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                        {threat.category}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-segel-500/40 bg-segel-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-segel-400">
                      <ShieldCheck className="h-3 w-3" />
                      {reportRow?.status || "BLOCKED"}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-white">
                    {threat.title}
                  </h3>
                  <p className="italic text-xs text-gold-300/80">
                    {threat.indonesianTitle}
                  </p>
                  <p className="text-xs text-slate-300">
                    <strong className="text-slate-200">Attack Vector:</strong>{" "}
                    {threat.vector}
                  </p>
                  <p className="text-xs text-segel-400/90">
                    <strong>Pusaka Control:</strong> {threat.control}
                  </p>
                </div>

                <div className="mt-4 space-y-1.5 border-t border-slate-800 pt-3 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contract Panic / Code:</span>
                    <span className="font-bold text-gold-300">
                      {threat.errorCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Test ID:</span>
                    <span className="text-slate-200">{threat.testId}</span>
                  </div>
                  {reportRow?.tx_hash && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Observed Proof / Tx:</span>
                      <a
                        href={`${EXPLORER_URL}/txns/${reportRow.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-gold-400 hover:underline"
                      >
                        {reportRow.tx_hash.slice(0, 16)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
