"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  FlaskConical,
  ImagePlus,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Terminal,
  Ticket,
  UserRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useEvents, useProof, useSeatHistory, useSeats } from "@/lib/chain/hooks";
import type { HistoryEntry } from "@/lib/chain/types";
import { parseNearToYocto } from "@/lib/near/format";
import { playSuccessChime, playTactileClick } from "@/lib/sound";
import {
  countdownLabel,
  formatDate,
  formatTime,
  near,
  nearValue,
  seatLabel,
  shortAccount,
} from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";
import { MascotPass } from "@/components/brand/MascotPass";
import { SeatCard } from "@/components/seat/SeatCard";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { PixelChair } from "@/components/seat/PixelChair";
import { SeatSwitcher } from "@/components/seat/SeatSwitcher";
import { ProofStamp } from "@/components/seat/ProofStamp";
import { VerifyDrawer } from "@/components/seat/VerifyDrawer";
import { ConfirmationSheet } from "@/components/seat/ConfirmationSheet";
import { HandoffOverlay, type HandoffMode } from "@/components/seat/Handoff";
import { AsciiVaultField } from "@/components/ascii/AsciiVaultField";
import { AsciiArchitectureFlow } from "@/components/ascii/AsciiArchitectureFlow";
import { PixelMatrixReadout } from "@/components/ascii/PixelMatrixReadout";

const PREVIEW_ROLL = [
  { num: "01", tokenId: "s001.logen.testnet", balance: "2.46", holder: "bob.testnet", dots: 4 },
  { num: "02", tokenId: "s002.logen.testnet", balance: "2.80", holder: "sari.testnet", dots: 5 },
  { num: "03", tokenId: "s003.logen.testnet", balance: "1.95", holder: "listed · 1.5 N", dots: 3 },
  { num: "04", tokenId: "s004.logen.testnet", balance: "3.10", holder: "dharma.testnet", dots: 6 },
  { num: "05", tokenId: "s005.logen.testnet", balance: "2.64", holder: "wira.testnet", dots: 4 },
  { num: "06", tokenId: "s006.logen.testnet", balance: "3.45", holder: "nila.testnet", dots: 8 },
  { num: "07", tokenId: "s007.logen.testnet", balance: "3.20", holder: "Keeper 07", dots: 7 },
  { num: "08", tokenId: "s008.logen.testnet", balance: "2.30", holder: "raya.testnet", dots: 5 },
  { num: "09", tokenId: "s009.logen.testnet", balance: "2.90", holder: "kavi.testnet", dots: 6 },
  { num: "10", tokenId: "s010.logen.testnet", balance: "4.12", holder: "bayu.testnet", dots: 8 },
  { num: "11", tokenId: "s011.logen.testnet", balance: "2.50", holder: "tara.testnet", dots: 4 },
  { num: "12", tokenId: "s012.logen.testnet", balance: "3.05", holder: "seno.testnet", dots: 7 },
] as const;

function ConnectScreen() {
  const { openWalletModal, registryId } = useNear();
  const { setDemo } = useDemo();
  const [activeRollIdx, setActiveRollIdx] = useState(6);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const activePreview = PREVIEW_ROLL[activeRollIdx] ?? PREVIEW_ROLL[6];

  const proofCmd = `curl -s https://rpc.testnet.near.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"view_access_key_list","finality":"final","account_id":"s001.${registryId || "logen-84b273.testnet"}"}}'`;

  const copyProofCmd = async () => {
    playTactileClick();
    try {
      await navigator.clipboard.writeText(proofCmd);
      setCopiedCmd(true);
      playSuccessChime();
      window.setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const moves = [
    {
      number: "01",
      title: "Upload a portrait",
      copy: "A face for the seat. PNG, JPEG or WebP, up to 8 MB.",
      icon: ImagePlus,
    },
    {
      number: "02",
      title: "Mint the seat",
      copy: "An NFT and a keyless NEAR wallet in one move.",
      icon: Sparkles,
    },
    {
      number: "03",
      title: "Hold the wallet",
      copy: "The money, history and access travel with the seat.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="terminal-grid relative overflow-hidden rounded border border-line bg-surface">
        {/* NORRVIK Architectural Telemetry Sub-Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-ink-deep/80 px-4 py-2 font-mono text-[9px] uppercase tracking-label text-paper-muted sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-paper-dim">
              FIG. 01 / KEYLESS SEAT ARCHITECTURE / SHARDED-ITEM-1.0.0
            </span>
            <span className="hidden text-paper-muted/60 md:inline">
              · LOCAL GRID / 1 : 1
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-positive">KEYS 00 / SEALED</span>
            <span className="hidden text-paper-dim sm:inline">
              {registryId || "logen-84b273.testnet"}
            </span>
          </div>
        </div>

        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:p-14 lg:pl-16">
          {/* Left-edge vertical elevation ruler (NORRVIK CAD scale) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-8 flex-col justify-between border-r border-line/60 bg-ink-deep/40 py-8 font-mono text-[8px] text-paper-muted/65 lg:flex"
          >
            {["06", "07", "08", "09", "10", "11", "12"].map((tick) => (
              <div key={tick} className="flex items-center gap-1">
                <span className="h-px w-2 bg-line-strong" />
                <span>{tick}</span>
              </div>
            ))}
          </div>

          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-signal">
              <span>(01) NEP-171 SEAT</span>
              <span className="text-paper-muted">/</span>
              <span>SUB-ACCOUNT VAULT</span>
              <span className="text-paper-muted">/</span>
              <span className="text-positive">ZERO KEYS</span>
            </div>

            <h1 className="max-w-[12ch] text-40 font-semibold leading-[0.98] tracking-[-0.035em] text-paper sm:text-72">
              Sell the seat.
              <br />
              <span className="text-signal">The wallet goes with it.</span>
            </h1>
            <p className="mt-6 max-w-[48ch] font-mono text-14 leading-[1.8] text-paper-dim">
              A membership NFT that owns its own keyless wallet.
              <br />
              Mint it with your own portrait. Hold the seat, hold the money.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {/* NORRVIK Split Architectural Primary CTA */}
              <button
                type="button"
                onClick={() => {
                  playTactileClick();
                  openWalletModal();
                }}
                className="group inline-flex min-h-12 w-full items-stretch overflow-hidden rounded border border-line-strong bg-paper text-left font-mono text-12 font-semibold uppercase tracking-label text-ink-deep transition-transform active:translate-y-px sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                <span className="flex flex-1 items-center px-5 py-3 transition-colors group-hover:bg-white">
                  Connect wallet
                </span>
                <span className="flex w-12 items-center justify-center border-l border-ink-deep/15 bg-signal text-ink-deep transition-colors group-hover:bg-[var(--accent-strong)]">
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
              <LinkButton
                href="/mint"
                variant="secondary"
                size="lg"
                onClick={() => playTactileClick()}
                className="w-full sm:w-auto"
              >
                Mint a seat
              </LinkButton>
            </div>
            <p className="mt-3 max-w-[42ch] text-12 leading-relaxed text-paper-muted">
              Signing proves you hold a seat. No transaction, no fee. Minting is free
              in demo.
            </p>

            {/* Lettra-style one-click RPC zero-key verification command pill */}
            <div className="mt-4 flex max-w-[480px] items-center justify-between gap-2 rounded border border-line bg-ink-deep px-3 py-2 font-mono text-[11px]">
              <div className="flex min-w-0 items-center gap-2">
                <Terminal className="h-3.5 w-3.5 shrink-0 text-signal" aria-hidden="true" />
                <span className="truncate text-paper-dim">
                  rpc view_access_key_list({activePreview.tokenId}) →{" "}
                  <span className="text-positive">&quot;keys&quot;:[]</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => void copyProofCmd()}
                aria-label="Copy curl on-chain zero-key proof command"
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded border border-line bg-surface px-2 text-[9px] uppercase tracking-label text-paper-muted transition-colors hover:border-signal hover:text-paper"
              >
                {copiedCmd ? (
                  <>
                    <Check className="h-3 w-3 text-positive" aria-hidden="true" />
                    <span className="text-positive">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>curl</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playTactileClick();
                setDemo(true);
              }}
              className="mt-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 transition-colors hover:text-paper"
            >
              Preview with demo data
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>

            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Preview club seats">
                {PREVIEW_ROLL.map((seatItem, index) => {
                  const selected = index === activeRollIdx;
                  return (
                    <button
                      key={seatItem.tokenId}
                      type="button"
                      onMouseEnter={() => setActiveRollIdx(index)}
                      onFocus={() => setActiveRollIdx(index)}
                      onClick={() => {
                        playTactileClick();
                        setActiveRollIdx(index);
                      }}
                      aria-label={`Preview seat ${seatItem.num} (${seatItem.balance} NEAR inside)`}
                      aria-pressed={selected}
                      className={`rounded p-0.5 transition-transform duration-150 ${
                        selected
                          ? "-translate-y-0.5 ring-1 ring-signal bg-signal-soft"
                          : "opacity-75 hover:-translate-y-0.5 hover:opacity-100"
                      }`}
                    >
                      <SeatGlyph
                        tokenId={seatItem.tokenId}
                        innerDots={seatItem.dots}
                        size={22}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                  12 seats. Each one a wallet ·{" "}
                  <span className="text-paper-dim">
                    #{activePreview.num} ({activePreview.balance} NEAR)
                  </span>
                </p>
                <Link
                  href="/seats"
                  onClick={() => playTactileClick()}
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 transition-colors hover:text-paper"
                >
                  Open the roll
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 justify-center lg:justify-end">
            <MascotPass
              className="max-w-[430px]"
              seatNumber={activePreview.num}
              tokenId={activePreview.tokenId}
              balance={activePreview.balance}
              holderLabel={activePreview.holder}
              innerDots={activePreview.dots}
            />
          </div>
        </div>

        {/* NORRVIK Multi-Cell Telemetry Dock at bottom of hero */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line font-mono text-[9px] uppercase tracking-label sm:grid-cols-4 lg:grid-cols-7">
          <div className="bg-ink-deep px-3.5 py-3">
            <div className="text-paper-muted">Interleavings</div>
            <div className="mt-1 text-12 font-semibold text-paper tabular">80,620</div>
          </div>
          <div className="bg-ink-deep px-3.5 py-3">
            <div className="text-paper-muted">Access keys</div>
            <div className="mt-1 text-12 font-semibold text-positive tabular">0 / 0</div>
          </div>
          <div className="bg-ink-deep px-3.5 py-3">
            <div className="text-paper-muted">Pool share</div>
            <div className="mt-1 text-12 font-semibold text-signal tabular">40.0%</div>
          </div>
          <Link
            href="/mint"
            onClick={() => playTactileClick()}
            className="bg-ink-deep px-3.5 py-3 transition-colors hover:bg-surface"
          >
            <div className="text-signal">01</div>
            <div className="mt-1 text-paper-dim">Mint seat</div>
          </Link>
          <Link
            href="/events"
            onClick={() => playTactileClick()}
            className="bg-ink-deep px-3.5 py-3 transition-colors hover:bg-surface"
          >
            <div className="text-signal">02</div>
            <div className="mt-1 text-paper-dim">Ticket pool</div>
          </Link>
          <Link
            href="/lounge"
            onClick={() => playTactileClick()}
            className="bg-ink-deep px-3.5 py-3 transition-colors hover:bg-surface"
          >
            <div className="text-signal">03</div>
            <div className="mt-1 text-paper-dim">Lounge gate</div>
          </Link>
          <Link
            href="/lab"
            onClick={() => playTactileClick()}
            className="col-span-2 bg-ink-deep px-3.5 py-3 transition-colors hover:bg-surface sm:col-span-1"
          >
            <div className="text-signal">04</div>
            <div className="mt-1 text-paper-dim">Attack lab</div>
          </Link>
        </div>
      </section>

      <Reveal>
        <section className="grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
          {moves.map((move) => (
            <div
              key={move.number}
              className="bg-surface p-4 sm:p-5"
            >
              <span className="font-mono text-[10px] uppercase tracking-label text-signal">
                {move.number}
              </span>
              <h2 className="mt-2 text-16 font-medium text-paper">{move.title}</h2>
              <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                {move.copy}
              </p>
            </div>
          ))}
        </section>
      </Reveal>

      <Reveal delay={0.04}>
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <AsciiVaultField />

          <Panel className="flex flex-col justify-between p-5 sm:p-6">
            <div>
              <h2 className="text-24 font-semibold text-paper">
                Every seat is a keyless vault.
              </h2>
              <p className="mt-2 text-14 leading-relaxed text-paper-muted">
                Each seat is a dedicated NEAR sub-account with zero access keys.
                Event revenue flows in automatically, and selling the NFT transfers
                the entire vault atomically.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3 border-y border-line py-4">
                <div>
                  <div className="mono-label">Access keys</div>
                  <div className="mt-2">
                    <PixelMatrixReadout value="00" size="sm" tone="positive" label="0 access keys" />
                  </div>
                </div>
                <div>
                  <div className="mono-label">Pool split</div>
                  <div className="mt-2">
                    <PixelMatrixReadout value="40%" size="sm" tone="signal" label="40 percent pool split" />
                  </div>
                </div>
                <div>
                  <div className="mono-label">Attacks blocked</div>
                  <div className="mt-2">
                    <PixelMatrixReadout value="12/12" size="sm" tone="paper" label="12 of 12 attacks blocked" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <LinkButton href="/lab" variant="secondary" size="sm" className="justify-between">
                <span>Attack Lab</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/lounge" variant="secondary" size="sm" className="justify-between">
                <span>Lounge Gate</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </LinkButton>
            </div>
          </Panel>
        </section>
      </Reveal>

      <Reveal delay={0.08}>
        <AsciiArchitectureFlow />
      </Reveal>
    </div>
  );
}

function SeatEmptyState() {
  return (
    <Panel className="p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded border border-line bg-surface-sunken">
        <Ticket className="h-5 w-5 text-paper-muted" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-24 font-semibold text-paper">No seat in this wallet.</h1>
      <p className="mx-auto mt-2 max-w-[42ch] text-14 leading-relaxed text-paper-muted">
        Mint one with your own portrait, or buy a listed seat. Either way, the seat
        carries its own wallet, money and history.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <LinkButton href="/mint">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Mint a seat
        </LinkButton>
        <LinkButton href="/market" variant="secondary">
          Browse market
        </LinkButton>
        <LinkButton href="/lounge" variant="ghost">
          Visit the lounge
        </LinkButton>
      </div>
    </Panel>
  );
}

function HistoryMiniRow({
  entry,
  currentOwner,
  seatId,
}: {
  entry: HistoryEntry;
  currentOwner: string;
  seatId: string;
}) {
  const isIn = entry.kind === "earned" || entry.kind === "credit";
  const isOut = entry.kind === "paid_out";
  const Icon = isIn ? ArrowDownLeft : isOut ? ArrowUpRight : UserRound;
  const amount = entry.amountYocto ? near(entry.amountYocto, 2) : null;

  return (
    <Link
      href={`/seat/${encodeURIComponent(seatId)}`}
      className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-line py-3 last:border-b-0 hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded border ${
          isIn
            ? "border-[rgba(123,216,143,0.3)] bg-positive-soft text-positive"
            : "border-line bg-surface-sunken text-paper-muted"
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-14 text-paper">{entry.label}</span>
        <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-label text-paper-muted">
          {formatDate(entry.atMs, { month: "short", day: "numeric" })} ·{" "}
          {entry.holderId === currentOwner ? "you" : shortAccount(entry.holderId, 18)}
        </span>
      </span>
      <span className="text-right font-mono text-14 tabular">
        {amount ? (
          <span className={isIn ? "text-positive" : isOut ? "text-paper-dim" : "text-paper-muted"}>
            {isIn ? "+" : isOut ? "−" : ""}
            {amount}
          </span>
        ) : (
          <span className="text-paper-muted">—</span>
        )}
        <span className="block text-[9px] uppercase tracking-label text-paper-muted">
          NEAR
        </span>
      </span>
    </Link>
  );
}

export default function SeatWalletPage() {
  const { accountId, registryId, callContractMethod } = useNear();
  const {
    demo,
    demoAccount,
    mock,
    simulateHandoff,
  } = useDemo();
  const queryClient = useQueryClient();

  const seatsQuery = useSeats();
  const eventsQuery = useEvents();
  const [selectedId, setSelectedId] = useState<string>("");
  const seats = seatsQuery.data ?? [];
  const selectedSeat = useMemo(
    () => seats.find((seat) => seat.tokenId === selectedId) ?? seats[0],
    [seats, selectedId]
  );
  const historyQuery = useSeatHistory(selectedSeat?.tokenId);
  const proofQuery = useProof(selectedSeat?.tokenId);

  const [proofOpen, setProofOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [delistOpen, setDelistOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("0.50");
  const [listPrice, setListPrice] = useState("6.40");
  const [privateBuyer, setPrivateBuyer] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localCooldownUntil, setLocalCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [handoff, setHandoff] = useState<{
    open: boolean;
    mode: HandoffMode;
    seatNumber: string;
    amount: string;
  }>({ open: false, mode: "seller", seatNumber: "07", amount: "3.20" });

  useEffect(() => {
    if (seats.length === 0) {
      setSelectedId("");
      return;
    }
    if (!seats.some((seat) => seat.tokenId === selectedId)) {
      setSelectedId(seats[0].tokenId);
    }
  }, [seats, selectedId]);

  useEffect(() => {
    setLocalCooldownUntil(null);
    setNotice(null);
    setActionError(null);
  }, [selectedSeat?.tokenId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cooldownUntil = selectedSeat?.cooldownUntilMs ?? localCooldownUntil;
  const cooldownLeft =
    cooldownUntil && cooldownUntil > now
      ? Math.ceil((cooldownUntil - now) / 1000)
      : 0;
  const effectiveStatus =
    selectedSeat?.status === "cooldown" && cooldownLeft === 0
      ? "active"
      : selectedSeat?.status;

  const nextEvent = useMemo(() => {
    const events = eventsQuery.data ?? [];
    return (
      events
        .filter((event) => event.status === "upcoming")
        .sort((a, b) => a.startsAtMs - b.startsAtMs)[0] ??
      events[0]
    );
  }, [eventsQuery.data]);

  const recentHistory = (historyQuery.data?.items ?? []).slice(0, 3);
  const balance = selectedSeat ? near(selectedSeat.balanceYocto, 2) : "0.00";
  const effectiveAccount = demo ? demoAccount : accountId;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["seats"] }),
      queryClient.invalidateQueries({ queryKey: ["history"] }),
      queryClient.invalidateQueries({ queryKey: ["proof"] }),
      queryClient.invalidateQueries({ queryKey: ["listings"] }),
    ]);
  };

  const openWithdraw = () => {
    if (!selectedSeat) return;
    const max = nearValue(selectedSeat.withdrawableYocto, 2);
    setWithdrawAmount(Math.min(1, max).toFixed(2));
    setActionError(null);
    setNotice(null);
    setWithdrawOpen(true);
  };

  const openList = () => {
    if (!selectedSeat) return;
    const suggested = Math.max(1, nearValue(selectedSeat.balanceYocto, 2) * 2);
    setListPrice(suggested.toFixed(2));
    setPrivateBuyer("");
    setActionError(null);
    setNotice(null);
    setListOpen(true);
  };

  const withdraw = async () => {
    if (!selectedSeat) return;
    setActionError(null);
    setPending(true);
    try {
      const amountYocto = parseNearToYocto(withdrawAmount);
      if (BigInt(amountYocto) <= 0n) throw new Error("Amount must be above zero");
      if (BigInt(amountYocto) > BigInt(selectedSeat.withdrawableYocto)) {
        throw new Error("Amount is above the withdrawable balance");
      }
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        await mock.withdraw(selectedSeat.tokenId, amountYocto);
      } else {
        await callContractMethod({
          receiverId: selectedSeat.tokenId,
          methodName: "withdraw",
          args: { amount: amountYocto },
          gas: "30000000000000",
          deposit: "1",
        });
        await refreshAll();
      }
      setWithdrawOpen(false);
      setNotice(`Withdrawal sent. ${withdrawAmount} NEAR is on its way.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  const listSeat = async () => {
    if (!selectedSeat) return;
    setActionError(null);
    setPending(true);
    try {
      const priceYocto = parseNearToYocto(listPrice);
      if (BigInt(priceYocto) <= 0n) throw new Error("Price must be above zero");
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        await mock.listSeat(selectedSeat.tokenId, priceYocto, privateBuyer.trim() || null);
      } else {
        await callContractMethod({
          receiverId: registryId,
          methodName: "list_seat",
          args: {
            token_id: selectedSeat.tokenId,
            price: priceYocto,
            min_balance: selectedSeat.withdrawableYocto,
            ttl_sec: 86_400,
          },
          gas: "100000000000000",
          deposit: "1",
        });
        await refreshAll();
      }
      setListOpen(false);
      setNotice("Seat listed. Withdrawals are paused.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  const delistSeat = async () => {
    if (!selectedSeat) return;
    setActionError(null);
    setPending(true);
    try {
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        await mock.delistSeat(selectedSeat.tokenId);
      } else {
        await callContractMethod({
          receiverId: registryId,
          methodName: "cancel_listing",
          args: { token_id: selectedSeat.tokenId },
          gas: "100000000000000",
          deposit: "1",
        });
        setLocalCooldownUntil(Date.now() + 120_000);
        await refreshAll();
      }
      setDelistOpen(false);
      setNotice("Listing removed. Withdrawals resume in about 2 minutes.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  const simulateSale = async () => {
    if (!selectedSeat) return;
    setHandoff({
      open: true,
      mode: "seller",
      seatNumber: seatLabel(selectedSeat.tokenId),
      amount: near(selectedSeat.balanceYocto, 2),
    });
    await simulateHandoff(selectedSeat.tokenId);
  };

  if (!effectiveAccount) {
    return <ConnectScreen />;
  }

  if (seatsQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Reading your seats">
        <div className="h-5 w-40 animate-skeleton rounded bg-line" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="h-[440px] animate-skeleton rounded border border-line bg-surface lg:col-span-5" />
          <div className="h-[440px] animate-skeleton rounded border border-line bg-surface lg:col-span-7" />
        </div>
      </div>
    );
  }

  if (seatsQuery.isError) {
    return (
      <Panel className="mx-auto max-w-prose p-8 text-center">
        <CircleAlert className="mx-auto h-6 w-6 text-caution" aria-hidden="true" />
        <h1 className="mt-4 text-24 font-semibold text-paper">We could not read the chain.</h1>
        <p className="mt-2 text-14 leading-relaxed text-paper-muted">
          Nothing changed. Try again in a moment.
        </p>
        <Button className="mt-5" variant="secondary" onClick={() => seatsQuery.refetch()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </Panel>
    );
  }

  if (!selectedSeat) {
    return <SeatEmptyState />;
  }

  const listed = effectiveStatus === "listed";
  const cooldown = effectiveStatus === "cooldown" && cooldownLeft > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="bracket-label">[ SEAT WALLET ]</span>
          <h1 className="mt-2 text-40 font-semibold text-paper">Your seat.</h1>
          <p className="mt-2 max-w-[52ch] text-14 leading-relaxed text-paper-muted">
            One membership. Its own wallet. Everything inside belongs to whoever holds
            the seat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral" dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <LinkButton href="/mint" variant="secondary" size="sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Mint a seat
          </LinkButton>
          <button
            type="button"
            onClick={() => {
              void refreshAll();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-line text-paper-muted transition-colors hover:border-line-strong hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            aria-label="Refresh seat data"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {seats.length > 1 ? (
        <SeatSwitcher
          seats={seats}
          selectedId={selectedSeat.tokenId}
          onSelect={(seat) => setSelectedId(seat.tokenId)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-5">
          <SeatCard seat={selectedSeat} />

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="mono-label">Balance inside</div>
              <div className="mt-1 font-mono text-72 leading-none text-paper tabular">
                {balance}
              </div>
              <div className="mt-1 font-mono text-12 uppercase tracking-label text-paper-muted">
                NEAR · withdrawable {near(selectedSeat.withdrawableYocto, 2)}
              </div>
            </div>
            <ProofStamp onClick={() => setProofOpen(true)} />
          </div>

          {notice ? (
            <p
              role="status"
              className="rounded border border-[rgba(123,216,143,0.3)] bg-positive-soft px-3 py-2 text-12 text-positive"
            >
              {notice}
            </p>
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="rounded border border-[rgba(255,107,94,0.35)] bg-danger-soft px-3 py-2 text-12 text-danger"
            >
              That did not go through. Nothing moved.
            </p>
          ) : null}

          {cooldown ? (
            <div className="flex items-center justify-between rounded border border-[rgba(230,180,80,0.3)] bg-caution-soft px-3 py-2">
              <span className="text-12 text-caution">Withdrawals resume in</span>
              <span className="font-mono text-14 tabular text-caution" aria-live="polite">
                {countdownLabel(cooldownLeft)}
              </span>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            {listed ? (
              <>
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => {
                    setActionError(null);
                    setDelistOpen(true);
                  }}
                  className="w-full"
                >
                  <Tag className="h-4 w-4" aria-hidden="true" />
                  Delist seat
                </Button>
                <LinkButton href="/market" variant="secondary" size="lg" className="w-full">
                  View listing
                </LinkButton>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={openWithdraw}
                  disabled={cooldown}
                  className="w-full"
                >
                  <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
                  Withdraw
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={openList}
                  disabled={cooldown}
                  className="w-full"
                >
                  <Tag className="h-4 w-4" aria-hidden="true" />
                  List for sale
                </Button>
              </>
            )}
          </div>

          {listed ? (
            <p className="flex items-center gap-2 text-12 leading-relaxed text-caution">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Listed, withdrawals paused. The balance stays put for the buyer.
            </p>
          ) : null}

          {demo ? (
            <button
              type="button"
              onClick={() => void simulateSale()}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-caution"
            >
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              Demo: simulate a sale
            </button>
          ) : null}
        </div>

        <div className="space-y-6 lg:col-span-7">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <div className="mono-label">Next event</div>
                <h2 className="mt-1 text-24 font-semibold text-paper">
                  {nextEvent?.title ?? "No event yet"}
                </h2>
              </div>
              <Chip tone="accent" icon={<CalendarDays className="h-3 w-3" aria-hidden="true" />}>
                {nextEvent
                  ? `${formatDate(nextEvent.startsAtMs, { month: "short", day: "numeric" })} · ${formatTime(nextEvent.startsAtMs)}`
                  : "TBA"}
              </Chip>
            </div>
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              <div>
                <div className="mono-label">Ticket price</div>
                <div className="mt-1 font-mono text-24 tabular text-paper">
                  {nextEvent ? near(nextEvent.ticketPriceYocto, 2) : "—"}{" "}
                  <span className="text-12 text-paper-muted">NEAR</span>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="mono-label">Seats sold</div>
                <div className="mt-1 font-mono text-14 tabular text-paper">
                  {nextEvent ? `${nextEvent.sold} / ${nextEvent.capacity}` : "—"}
                </div>
              </div>
            </div>
            <div className="border-t border-line px-4 py-3 text-12 text-paper-muted">
              Members earn a share of every ticket. It lands in the seat, not a wallet.
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <div className="mono-label">Recent history</div>
                <h2 className="mt-1 text-16 font-medium text-paper">Last three movements</h2>
              </div>
              <Link
                href={`/seat/${encodeURIComponent(selectedSeat.tokenId)}`}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted hover:text-paper"
              >
                All history
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            <div className="px-4">
              {recentHistory.length === 0 ? (
                <p className="py-6 text-12 leading-relaxed text-paper-muted">
                  Nothing here yet. Earnings appear after the first event settles.
                </p>
              ) : (
                recentHistory.map((entry) => (
                  <HistoryMiniRow
                    key={entry.id}
                    entry={entry}
                    currentOwner={selectedSeat.ownerId}
                    seatId={selectedSeat.tokenId}
                  />
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <VerifyDrawer
        open={proofOpen}
        onOpenChange={setProofOpen}
        proof={proofQuery.data}
        loading={proofQuery.isLoading}
        onRecheck={async () => {
          if (demo) {
            await new Promise((resolve) => window.setTimeout(resolve, 600));
          }
          await proofQuery.refetch();
        }}
      />

      <ConfirmationSheet
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title={`Withdraw ${withdrawAmount || "0"} NEAR`}
        description="Money leaves the seat and goes to your wallet."
        primaryLabel={`Withdraw ${withdrawAmount || "0"} NEAR`}
        onConfirm={withdraw}
        pending={pending}
        error={actionError}
        confirmDisabled={!withdrawAmount || Number(withdrawAmount) <= 0}
        blocks={[
          {
            label: "What will happen",
            value: `${withdrawAmount || "0"} NEAR moves from the seat to your wallet.`,
          },
          {
            label: "What leaves the seat",
            value: `${withdrawAmount || "0"} NEAR. Nothing else moves.`,
          },
          { label: "Who can do this", value: "You, as the holder." },
        ]}
      >
        <label className="block">
          <span className="mono-label">Amount</span>
          <div className="mt-2 flex min-h-12 items-center rounded border border-line bg-surface-sunken px-3 focus-within:border-signal">
            <input
              type="text"
              inputMode="decimal"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              className="w-full bg-transparent py-3 font-mono text-24 text-paper outline-none tabular"
              aria-label="Amount to withdraw in NEAR"
            />
            <span className="ml-2 font-mono text-12 uppercase tracking-label text-paper-muted">
              NEAR
            </span>
          </div>
          <p className="mt-2 text-12 text-paper-muted">
            Withdrawable: {near(selectedSeat.withdrawableYocto, 2)} NEAR
          </p>
        </label>
      </ConfirmationSheet>

      <ConfirmationSheet
        open={listOpen}
        onOpenChange={setListOpen}
        title="List this seat for sale"
        description="The seat and everything inside it change hands together."
        primaryLabel={`List for ${listPrice || "0"} NEAR`}
        onConfirm={listSeat}
        pending={pending}
        error={actionError}
        confirmDisabled={!listPrice || Number(listPrice) <= 0}
        blocks={[
          {
            label: "What will happen",
            value: `Buyers see the seat at ${listPrice || "0"} NEAR, with ${balance} NEAR inside.`,
          },
          { label: "What leaves the seat", value: "Nothing. The balance is frozen for the buyer." },
          { label: "Who can do this", value: "You, as the holder." },
        ]}
        note="While listed, withdrawals are paused so buyers can trust the balance."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mono-label">Price</span>
            <div className="mt-2 flex min-h-12 items-center rounded border border-line bg-surface-sunken px-3 focus-within:border-signal">
              <input
                type="text"
                inputMode="decimal"
                value={listPrice}
                onChange={(event) => setListPrice(event.target.value)}
                className="w-full bg-transparent py-3 font-mono text-24 text-paper outline-none tabular"
                aria-label="Asking price in NEAR"
              />
              <span className="ml-2 font-mono text-12 uppercase tracking-label text-paper-muted">
                NEAR
              </span>
            </div>
          </label>
          <label className="block">
            <span className="mono-label">Private buyer (optional)</span>
            <input
              type="text"
              value={privateBuyer}
              onChange={(event) => setPrivateBuyer(event.target.value)}
              placeholder="account.testnet"
              className="mt-2 min-h-11 w-full rounded border border-line bg-surface-sunken px-3 font-mono text-14 text-paper outline-none placeholder:text-paper-muted focus:border-signal"
            />
          </label>
        </div>
      </ConfirmationSheet>

      <ConfirmationSheet
        open={delistOpen}
        onOpenChange={setDelistOpen}
        title="Delist this seat"
        description="The seat comes off the market and withdrawals resume shortly."
        primaryLabel="Delist seat"
        onConfirm={delistSeat}
        pending={pending}
        error={actionError}
        blocks={[
          { label: "What will happen", value: "The listing is removed. The seat stays yours." },
          { label: "What leaves the seat", value: "Nothing." },
          { label: "Who can do this", value: "You, as the holder." },
        ]}
        note="Withdrawals resume in about 2 minutes."
      />

      <HandoffOverlay
        open={handoff.open}
        mode={handoff.mode}
        seatNumber={handoff.seatNumber}
        amountNear={handoff.amount}
        onClose={() => setHandoff((value) => ({ ...value, open: false }))}
        onContinue={() => setHandoff((value) => ({ ...value, open: false }))}
        continueLabel="Back to wallet"
      />
    </div>
  );
}
