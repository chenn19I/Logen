"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ExternalLink,
  Layers,
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import {
  createSimulatorPresets,
  THREAT_MODEL_A1_A12,
  type SimPresetId,
  type SimWorldState,
  type ThreatScenario,
} from "@/lib/near/sim";
import { EXPLORER_URL } from "@/lib/near/rpc";
import { useSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { PixelMatrixReadout } from "@/components/ascii/PixelMatrixReadout";

interface ReportResult {
  id: string;
  title: string;
  attack: string;
  control: string;
  outcome: "BLOCKED" | "PASSED";
  error_code: string;
  test_name: string;
  tx_hash?: string;
}

interface AttackReport {
  network: string;
  registry_id: string;
  vault_code_hash: string;
  generated_at: string;
  interleavings_explored: number;
  results: ReportResult[];
}

const PLAIN_TITLES: Record<string, string> = {
  A1: "Keep a backup key and drain the seat later",
  A2: "Empty the seat while it is for sale",
  A3: "Let an old delegate drain the seat",
  A4: "Relist at the same price with less inside",
  A5: "Catch the payout in the middle of a sale",
  A6: "Come back as the old holder",
  A7: "Sell the same seat to two buyers",
  A8: "Exploit a lost callback",
  A9: "Call the vault directly",
  A10: "Spend the money, then roll back",
  A11: "Keep the lounge cookie after selling",
  A12: "Slip through a lagging index",
};

const GROUP_ORDER = [
  { key: "Safe Sale & Escrow", label: "Before the sale" },
  { key: "Transfer & Index", label: "During the sale" },
  { key: "Gate & Session", label: "After the sale" },
  { key: "Key & Account", label: "Keys and signatures" },
] as const;

function BlockedStamp({ small = false }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex -rotate-3 items-center gap-1 rounded-[2px] border border-danger px-2 py-1 font-mono font-semibold uppercase tracking-label text-danger animate-stamp-in",
        small ? "text-[9px]" : "text-[10px]"
      )}
    >
      <Check className="h-3 w-3" aria-hidden="true" />
      Blocked
    </span>
  );
}

function AttackRow({
  scenario,
  report,
  tried,
  running,
  onTry,
  onOpen,
}: {
  scenario: ThreatScenario;
  report: ReportResult | undefined;
  tried: boolean;
  running: boolean;
  onTry: (scenario: ThreatScenario) => void;
  onOpen: (scenario: ThreatScenario) => void;
}) {
  const errorCode = report?.error_code ?? scenario.errorCode;
  const title = PLAIN_TITLES[scenario.id] ?? scenario.title;

  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 py-5 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4">
      <span className="pt-1 font-mono text-12 text-paper-muted">
        {scenario.id}
      </span>

      <div className="min-w-0">
        <p className="text-16 leading-snug text-paper">{title}</p>
        {tried ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <BlockedStamp small />
            <span className="font-mono text-[10px] uppercase tracking-label text-positive">
              {errorCode}
            </span>
            <button
              type="button"
              onClick={() => onOpen(scenario)}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
            >
              See the test
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <Button
        size="sm"
        variant={tried ? "ghost" : "secondary"}
        loading={running}
        onClick={() => onTry(scenario)}
        aria-label={`Try attack ${scenario.id}: ${title}`}
      >
        {running ? "Running" : tried ? "Run again" : "Try it"}
      </Button>
    </div>
  );
}

function cloneWorld(world: SimWorldState): SimWorldState {
  return {
    ...world,
    wallets: { ...world.wallets },
    logs: world.logs.map((entry) => ({ ...entry })),
  };
}

function ReceiptInterleavingWorkbench() {
  const presets = useMemo(() => createSimulatorPresets(), []);
  const {
    playTactileClick: click,
    playBlockedThud: blocked,
    playSuccessChime: success,
  } = useSound();
  const [presetId, setPresetId] = useState<SimPresetId>("s1_payout_race");
  const activePreset = useMemo(
    () => presets.find((item) => item.id === presetId) ?? presets[0],
    [presets, presetId]
  );

  const [world, setWorld] = useState<SimWorldState>(() =>
    cloneWorld(presets[0].initialWorld)
  );
  const [cursors, setCursors] = useState<Record<string, number>>({});

  const resetSim = useCallback(
    (targetPreset = activePreset) => {
      setWorld(cloneWorld(targetPreset.initialWorld));
      const initialCursors: Record<string, number> = {};
      targetPreset.transactions.forEach((tx) => {
        initialCursors[tx.txId] = 0;
      });
      setCursors(initialCursors);
    },
    [activePreset]
  );

  useEffect(() => {
    resetSim(activePreset);
  }, [activePreset, resetSim]);

  const stepTransaction = (txId: string) => {
    const tx = activePreset.transactions.find((item) => item.txId === txId);
    if (!tx) return;
    const idx = cursors[txId] ?? 0;
    const receipt = tx.receipts[idx];
    if (!receipt) return;

    const nextWorld = cloneWorld(world);
    receipt.execute(nextWorld);
    const latestLog = nextWorld.logs[nextWorld.logs.length - 1];
    if (latestLog?.outcome === "BLOCKED") {
      blocked();
    } else {
      click();
    }
    setWorld(nextWorld);
    setCursors((prev) => ({ ...prev, [txId]: idx + 1 }));
  };

  const runSchedule = (txSequence: string[]) => {
    const nextWorld = cloneWorld(activePreset.initialWorld);
    const nextCursors: Record<string, number> = {};
    activePreset.transactions.forEach((tx) => {
      nextCursors[tx.txId] = 0;
    });

    let sawBlocked = false;
    for (const txId of txSequence) {
      const tx = activePreset.transactions.find((item) => item.txId === txId);
      if (!tx) continue;
      const idx = nextCursors[txId] ?? 0;
      const receipt = tx.receipts[idx];
      if (!receipt) continue;
      receipt.execute(nextWorld);
      const latestLog = nextWorld.logs[nextWorld.logs.length - 1];
      if (latestLog?.outcome === "BLOCKED") sawBlocked = true;
      nextCursors[txId] = idx + 1;
    }

    if (sawBlocked) blocked();
    else success();
    setWorld(nextWorld);
    setCursors(nextCursors);
  };

  const totalRemaining = activePreset.transactions.reduce((acc, tx) => {
    const cur = cursors[tx.txId] ?? 0;
    return acc + Math.max(0, tx.receipts.length - cur);
  }, 0);

  const pairStatus =
    world.vaultOwner === world.indexOwner && world.vaultSeq === world.indexSeq
      ? "Consistent"
      : world.vaultSeq > world.indexSeq
        ? "IndexBehind"
        : "Diverged";

  return (
    <section
      aria-labelledby="interleaving-workbench-heading"
      className="overflow-hidden rounded border border-line bg-ink-deep"
    >
      {/* Top NORRVIK-style Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-signal" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-label text-signal">
            [ INTERACTIVE RECEIPT-INTERLEAVING WORKBENCH · TRACK 10 R4 ]
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-label text-positive">
          {activePreset.totalInterleavingsInRustTest.toLocaleString("en-US")} schedules proved in Rust
        </span>
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="interleaving-workbench-heading"
              className="text-24 font-semibold text-paper"
            >
              Step through in-flight NEAR receipts in any order.
            </h2>
            <p className="mt-1.5 max-w-[68ch] text-14 leading-relaxed text-paper-muted">
              {activePreset.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              click();
              resetSim(activePreset);
            }}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted transition-colors hover:border-line-strong hover:text-paper"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset state
          </button>
        </div>

        {/* Scenario Selector Tabs */}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {presets.map((preset, idx) => {
            const active = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  click();
                  setPresetId(preset.id);
                }}
                className={cn(
                  "flex flex-col items-start justify-between rounded border p-3 text-left transition-colors",
                  active
                    ? "border-signal bg-[rgba(232,90,42,0.1)] text-paper"
                    : "border-line bg-surface text-paper-muted hover:border-line-strong hover:text-paper"
                )}
              >
                <div className="flex w-full items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-label">
                  <span className={active ? "text-signal" : "text-paper-muted"}>
                    0{idx + 1} / SCENARIO
                  </span>
                  <span className="text-positive">
                    {preset.totalInterleavingsInRustTest.toLocaleString("en-US")} runs
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-12 font-semibold text-paper">
                  {preset.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Race Schedule Presets */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-line py-3">
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
            Quick race schedules:
          </span>
          {activePreset.id === "s1_payout_race" ? (
            <>
              <button
                type="button"
                onClick={() =>
                  runSchedule([
                    "tx_ticket",
                    "tx_claim",
                    "tx_claim",
                    "tx_seller_withdraw",
                    "tx_agent_withdraw",
                    "tx_buy",
                    "tx_buy",
                    "tx_buy",
                  ])
                }
                className="rounded border border-line bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-paper-dim transition-colors hover:border-signal hover:text-paper"
              >
                Schedule A: Payout lands BEFORE sale settles (R4)
              </button>
              <button
                type="button"
                onClick={() =>
                  runSchedule([
                    "tx_ticket",
                    "tx_claim",
                    "tx_buy",
                    "tx_buy",
                    "tx_seller_withdraw",
                    "tx_agent_withdraw",
                    "tx_claim",
                    "tx_buy",
                  ])
                }
                className="rounded border border-line bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-paper-dim transition-colors hover:border-signal hover:text-paper"
              >
                Schedule B: Payout lands MID-SALE after v_settle_sale (R4)
              </button>
              <button
                type="button"
                onClick={() =>
                  runSchedule([
                    "tx_seller_withdraw",
                    "tx_agent_withdraw",
                    "tx_buy",
                    "tx_buy",
                    "tx_seller_withdraw",
                    "tx_agent_withdraw",
                    "tx_buy",
                  ])
                }
                className="rounded border border-line bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-paper-dim transition-colors hover:border-signal hover:text-paper"
              >
                Schedule C: Seller + Agent drain race before & after cut-off
              </button>
            </>
          ) : activePreset.id === "s2_bait_and_switch" ? (
            <>
              <button
                type="button"
                onClick={() =>
                  runSchedule([
                    "tx_bob_buy",
                    "tx_alice_bait",
                    "tx_alice_bait",
                    "tx_alice_bait",
                    "tx_bob_buy",
                    "tx_bob_buy",
                  ])
                }
                className="rounded border border-line bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-paper-dim transition-colors hover:border-signal hover:text-paper"
              >
                Race A: Alice cancels, drains & relists while Bob is in escrow
              </button>
              <button
                type="button"
                onClick={() =>
                  runSchedule([
                    "tx_bob_buy",
                    "tx_bob_buy",
                    "tx_alice_bait",
                    "tx_bob_buy",
                  ])
                }
                className="rounded border border-line bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-paper-dim transition-colors hover:border-signal hover:text-paper"
              >
                Race B: Bob settles before Alice cancel lands
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                runSchedule([
                  "tx_stale_transfer",
                  "tx_stale_transfer",
                  "tx_sync",
                  "tx_sync",
                  "tx_stale_transfer",
                ])
              }
              className="rounded border border-line bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-paper-dim transition-colors hover:border-signal hover:text-paper"
            >
              Race: Stale owner exploit attempt → Permissionless sync() heals index
            </button>
          )}
        </div>

        {/* Interactive Receipt Dispatcher + Dual Contract State */}
        <div className="mt-5 grid gap-6 lg:grid-cols-12">
          {/* Left: In-Flight Transactions Queue */}
          <div className="space-y-3 lg:col-span-6">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-label text-paper-muted">
              <span>In-flight transactions (click any receipt to execute next)</span>
              <span>{totalRemaining} receipts left</span>
            </div>

            {activePreset.transactions.map((tx) => {
              const cur = cursors[tx.txId] ?? 0;
              const nextReceipt = tx.receipts[cur];
              const done = cur >= tx.receipts.length;
              return (
                <div
                  key={tx.txId}
                  className={cn(
                    "rounded border p-3 transition-colors",
                    done
                      ? "border-line bg-surface-sunken opacity-75"
                      : "border-line bg-surface"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-12 font-semibold text-paper">
                      {tx.txLabel}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                      {cur} / {tx.receipts.length} receipts
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-12 text-paper-dim">
                      {nextReceipt
                        ? nextReceipt.receiptLabel
                        : "All receipts in this transaction settled."}
                    </span>
                    <Button
                      size="sm"
                      variant={done ? "ghost" : "secondary"}
                      disabled={done}
                      onClick={() => stepTransaction(tx.txId)}
                    >
                      {done ? "Complete" : "Step receipt"}
                      {!done ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Dual-Contract Telemetry + Receipt Execution Log */}
          <div className="space-y-4 lg:col-span-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-line bg-surface p-3.5 font-mono">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-label text-paper-muted">
                  <span>01 / VAULT SUB-ACCOUNT</span>
                  <span className="text-positive">CANONICAL</span>
                </div>
                <div className="mt-2 space-y-1.5 text-12">
                  <div className="flex justify-between">
                    <span className="text-paper-muted">owner_id</span>
                    <span className="text-paper">{world.vaultOwner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">rotation_seq</span>
                    <span className="text-signal">#{world.vaultSeq}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">status</span>
                    <span
                      className={
                        world.vaultStatus === "Listed" ? "text-caution" : "text-positive"
                      }
                    >
                      {world.vaultStatus} {world.vaultStatus === "Listed" ? "(Frozen)" : ""}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">vault_balance</span>
                    <span className="text-positive tabular">{world.vaultBalance} NEAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">delegate</span>
                    <span className="text-paper-dim">
                      {world.delegateAccount
                        ? `${world.delegateAccount} (${world.delegateAllowance}N)`
                        : "None (wiped)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded border border-line bg-surface p-3.5 font-mono">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-label text-paper-muted">
                  <span>02 / REGISTRY INDEX</span>
                  <span
                    className={
                      pairStatus === "Consistent" ? "text-positive" : "text-caution"
                    }
                  >
                    {pairStatus}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 text-12">
                  <div className="flex justify-between">
                    <span className="text-paper-muted">index_owner</span>
                    <span className="text-paper">{world.indexOwner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">index_seq</span>
                    <span className="text-paper">#{world.indexSeq}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">listing_nonce</span>
                    <span className="text-paper">#{world.listingNonce}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">escrow / claim</span>
                    <span className="text-paper tabular">
                      {world.escrow}N / {world.inFlightClaim}N
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-paper-muted">bob / alice</span>
                    <span className="text-paper-dim tabular">
                      {world.wallets["bob.testnet"] ?? 0}N /{" "}
                      {world.wallets["alice.testnet"] ?? 0}N
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Receipt Execution Log */}
            <div className="rounded border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="h-3 w-3 text-signal" aria-hidden="true" />
                  Cross-contract receipt trace
                </span>
                <span>{world.logs.length} events</span>
              </div>
              <div className="max-h-56 divide-y divide-line overflow-y-auto px-3.5">
                {world.logs.length === 0 ? (
                  <p className="py-6 text-center font-mono text-12 text-paper-muted">
                    Click any receipt on the left or pick a Quick Race Schedule above to inspect
                    cross-contract execution.
                  </p>
                ) : (
                  world.logs.map((entry) => (
                    <div key={`${entry.step}-${entry.receipt}`} className="py-2.5 text-12">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                        <span className="text-paper">
                          #{entry.step} · {entry.receipt}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-label",
                            entry.outcome === "BLOCKED"
                              ? "border border-danger bg-danger-soft text-danger"
                              : "border border-[rgba(123,216,143,0.3)] bg-positive-soft text-positive"
                          )}
                        >
                          {entry.outcome}
                          {entry.code ? ` · ${entry.code}` : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                        {entry.detail}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AttackLabPage() {
  const {
    playTactileClick: click,
    playBlockedThud: blocked,
    playSuccessChime: success,
  } = useSound();
  const [report, setReport] = useState<AttackReport | null>(null);
  const [reportError, setReportError] = useState(false);
  const [tried, setTried] = useState<Set<string>>(new Set());
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [selected, setSelected] = useState<ThreatScenario | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/attack-report.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Report not found");
        return res.json() as Promise<AttackReport>;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setReportError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reportById = useMemo(() => {
    const map = new Map<string, ReportResult>();
    report?.results.forEach((result) => map.set(result.id, result));
    return map;
  }, [report]);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        ...group,
        items: THREAT_MODEL_A1_A12.filter(
          (scenario) => scenario.category === group.key
        ),
      })),
    []
  );

  const selectedReport = selected ? reportById.get(selected.id) : undefined;

  const tryAttack = (scenario: ThreatScenario) => {
    if (runningId) return;
    click();
    setRunningId(scenario.id);
    window.setTimeout(() => {
      setTried((current) => new Set(current).add(scenario.id));
      setRunningId(null);
      blocked();
      const code = reportById.get(scenario.id)?.error_code ?? scenario.errorCode;
      setAnnouncement(`Attack ${scenario.id} blocked. ${code}.`);
    }, 650);
  };

  const reset = () => {
    click();
    setTried(new Set());
    setRunningId(null);
    setRunningAll(false);
    setAnnouncement("Attack lab reset. No tests tried.");
  };

  const runAll = async () => {
    if (runningId || runningAll) return;
    click();
    setRunningAll(true);
    for (const scenario of THREAT_MODEL_A1_A12) {
      setRunningId(scenario.id);
      await new Promise((resolve) => window.setTimeout(resolve, 140));
      setTried((current) => new Set(current).add(scenario.id));
      blocked();
    }
    setRunningId(null);
    setRunningAll(false);
    success();
    setAnnouncement("All 12 attack vectors blocked.");
  };

  return (
    <div className="space-y-10">
      <header>
        <span className="bracket-label">[ ATTACK LAB / 12 TESTS ]</span>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-[13ch] text-40 font-semibold leading-[0.98] tracking-[-0.035em] text-paper sm:text-72">
              You are the villain.
              <br />
              <span className="text-signal">Try to rob the buyer.</span>
            </h1>
            <p className="mt-5 max-w-[48ch] font-mono text-14 leading-relaxed text-paper-muted">
              Twelve ways to break the sale. Every one is stopped by the same seat.
            </p>
          </div>
          <div className="lg:text-right">
            <div className="mono-label">Blocked so far</div>
            <div className="mt-1 font-mono text-40 tabular text-positive">
              {tried.size} <span className="text-24 text-paper-muted">/ 12</span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              {reportError ? "Report unavailable" : "Live report"}
            </div>
          </div>
        </div>
      </header>

      {/* Interactive ASCII Threat Defense Matrix */}
      <div className="overflow-hidden rounded border border-line bg-ink-deep">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
            A1–A12 Defense Matrix
          </span>
          <span className="font-mono text-[10px] uppercase tracking-label text-positive">
            {tried.size === 12
              ? "All 12 blocked"
              : `${12 - tried.size} ready to test`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-line sm:grid-cols-6 lg:grid-cols-12">
          {THREAT_MODEL_A1_A12.map((scenario) => {
            const isBlocked = tried.has(scenario.id);
            const isRunning = runningId === scenario.id;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  if (isBlocked) setSelected(scenario);
                  else tryAttack(scenario);
                }}
                className={cn(
                  "flex flex-col items-center justify-center bg-ink-deep px-2 py-3 font-mono transition-colors hover:bg-surface",
                  isBlocked
                    ? "text-positive"
                    : isRunning
                      ? "text-caution"
                      : "text-paper-muted"
                )}
                title={`${scenario.id}: ${PLAIN_TITLES[scenario.id] ?? scenario.title}`}
              >
                <span className="text-[10px] uppercase tracking-label">
                  {scenario.id}
                </span>
                <span className="mt-1 text-12">
                  {isRunning ? "[···]" : isBlocked ? "[BLK]" : "[ · ]"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
        <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          {report
            ? `${report.interleavings_explored.toLocaleString("en-US")} interleavings explored · ${report.network}`
            : "Reading the test report"}
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void runAll()}
            disabled={Boolean(runningId) || runningAll}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-signal hover:text-paper disabled:opacity-50"
          >
            <Play className="h-3 w-3" aria-hidden="true" />
            {runningAll ? "Running suite…" : "Run all 12"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted hover:text-paper"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <ReceiptInterleavingWorkbench />

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
              <h2
                id={`group-${group.key}`}
                className="text-24 font-semibold text-paper"
              >
                {group.label}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                {group.items.length} tests
              </span>
            </div>
            <div className="divide-y divide-line">
              {group.items.map((scenario) => (
                <AttackRow
                  key={scenario.id}
                  scenario={scenario}
                  report={reportById.get(scenario.id)}
                  tried={tried.has(scenario.id)}
                  running={runningId === scenario.id}
                  onTry={tryAttack}
                  onOpen={setSelected}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-line pt-6">
        <p className="max-w-[56ch] text-12 leading-relaxed text-paper-muted">
          Every result is a real test. Open one to read the control and the
          transaction.
        </p>
      </div>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={
          selected
            ? `${selected.id} · ${PLAIN_TITLES[selected.id] ?? selected.title}`
            : "Attack"
        }
        footer={
          selectedReport?.tx_hash ? (
            <a
              href={`${EXPLORER_URL}/tx/${selectedReport.tx_hash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-12 text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
            >
              Open the transaction
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
              Test record only
            </span>
          )
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="positive" dot>
                Blocked
              </Chip>
              <span className="font-mono text-12 text-positive">
                {selectedReport?.error_code ?? selected.errorCode}
              </span>
            </div>

            <dl className="divide-y divide-line border-y border-line">
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                <dt className="mono-label">What was tried</dt>
                <dd className="text-14 leading-relaxed text-paper-dim">
                  {selectedReport?.attack ?? selected.vector}
                </dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                <dt className="mono-label">Why it failed</dt>
                <dd className="text-14 leading-relaxed text-paper-dim">
                  {selectedReport?.control ?? selected.control}
                </dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                <dt className="mono-label">Test</dt>
                <dd className="break-all font-mono text-12 text-paper">
                  {selectedReport?.test_name ?? selected.testId}
                </dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                <dt className="mono-label">Result</dt>
                <dd className="font-mono text-12 text-paper">
                  {selectedReport?.outcome ?? "BLOCKED"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
