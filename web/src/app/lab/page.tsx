"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  THREAT_MODEL_A1_A12,
  type ThreatScenario,
} from "@/lib/near/sim";
import { EXPLORER_URL } from "@/lib/near/rpc";
import { useSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";

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
        <AnimatePresence>
          {tried ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2"
            >
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
            </motion.div>
          ) : null}
        </AnimatePresence>
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

const VISUAL_RACES = [
  {
    id: "payout",
    label: "Payout mid-sale",
    steps: [
      { tag: "01", title: "Ticket payout in flight", status: "+20 NEAR to seat", ok: true },
      { tag: "02", title: "Seller tries to drain", status: "BLOCKED · E_FROZEN", ok: false },
      { tag: "03", title: "Buyer settles sale", status: "Owns seat + 40 NEAR", ok: true },
    ],
  },
  {
    id: "relist",
    label: "Bait & switch",
    steps: [
      { tag: "01", title: "Seller cancels & drains", status: "Relisted at nonce #2", ok: true },
      { tag: "02", title: "Buyer tx checks nonce #1", status: "BLOCKED · E_NONCE_MISMATCH", ok: false },
      { tag: "03", title: "Escrow auto-refunds", status: "100% refunded to buyer", ok: true },
    ],
  },
  {
    id: "sync",
    label: "Lost callback",
    steps: [
      { tag: "01", title: "Callback drops mid-transfer", status: "Vault ahead of index", ok: true },
      { tag: "02", title: "Old owner tries transfer", status: "BLOCKED · E_NOT_OWNER", ok: false },
      { tag: "03", title: "Permissionless sync()", status: "Index healed to seq #1", ok: true },
    ],
  },
] as const;

function ReceiptInterleavingWorkbench() {
  const {
    playTactileClick: click,
    playBlockedThud: blocked,
    playSuccessChime: success,
  } = useSound();
  const [raceId, setRaceId] = useState<(typeof VISUAL_RACES)[number]["id"]>("payout");
  const [activeStep, setActiveStep] = useState<number>(2);
  const [playing, setPlaying] = useState(false);

  const race = VISUAL_RACES.find((r) => r.id === raceId) ?? VISUAL_RACES[0];

  const playRace = async (targetId = raceId) => {
    if (playing) return;
    click();
    setRaceId(targetId);
    setPlaying(true);
    setActiveStep(0);
    await new Promise((r) => window.setTimeout(r, 420));
    setActiveStep(1);
    blocked();
    await new Promise((r) => window.setTimeout(r, 480));
    setActiveStep(2);
    success();
    setPlaying(false);
  };

  return (
    <section
      aria-label="Live receipt race simulator"
      className="overflow-hidden rounded border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {VISUAL_RACES.map((item) => {
            const active = item.id === raceId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => void playRace(item.id)}
                className={cn(
                  "relative rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-label transition-colors",
                  active ? "text-paper" : "text-paper-muted hover:text-paper"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="active-race-pill"
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="absolute inset-0 rounded border border-signal bg-signal-soft"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="secondary"
          loading={playing}
          onClick={() => void playRace(raceId)}
        >
          <Play className="h-3 w-3" aria-hidden="true" />
          Simulate race
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {race.steps.map((step, index) => {
          const reached = index <= activeStep;
          return (
            <motion.div
              key={`${race.id}-${step.tag}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: reached ? 1 : 0.35,
                y: 0,
                scale: index === activeStep && playing ? 1.02 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="rounded border border-line bg-ink-deep p-3.5"
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-label">
                <span className="text-paper-muted">Step {step.tag}</span>
                <span className={step.ok ? "text-positive" : "text-danger"}>
                  {step.status}
                </span>
              </div>
              <div className="mt-2 text-14 font-medium text-paper">{step.title}</div>
            </motion.div>
          );
        })}
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
