"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  FlaskConical,
  ImagePlus,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  UserRound,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useEvents, useProof, useSeatHistory, useSeats } from "@/lib/chain/hooks";
import type { HistoryEntry } from "@/lib/chain/types";
import { parseNearToYocto } from "@/lib/near/format";
import {
  AsciiRuneDivider,
  AsciiSpellText,
  castAsciiSpell,
} from "@/components/ascii/AsciiSpellEngine";
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
import { SeatSwitcher } from "@/components/seat/SeatSwitcher";
import { ProofStamp } from "@/components/seat/ProofStamp";
import { VerifyDrawer } from "@/components/seat/VerifyDrawer";
import { ConfirmationSheet } from "@/components/seat/ConfirmationSheet";
import { HandoffOverlay, type HandoffMode } from "@/components/seat/Handoff";
import { AsciiVaultField, type FieldMode } from "@/components/ascii/AsciiVaultField";

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
  const { openWalletModal } = useNear();
  const { setDemo } = useDemo();
  const [activeRollIdx, setActiveRollIdx] = useState(6);
  const [vaultMode, setVaultMode] = useState<FieldMode>("seat");
  const activePreview = PREVIEW_ROLL[activeRollIdx] ?? PREVIEW_ROLL[6];

  const moves: Array<{
    rune: string;
    title: string;
    copy: string;
    mode: FieldMode;
    icon: typeof ImagePlus;
  }> = [
    {
      rune: "✦",
      title: "Upload a portrait",
      copy: "Give the seat its own face. Mint it in one step.",
      mode: "seat",
      icon: ImagePlus,
    },
    {
      rune: "⟡",
      title: "Hold a keyless wallet",
      copy: "Ticket revenue lands directly inside the seat.",
      mode: "cube",
      icon: Sparkles,
    },
    {
      rune: "✧",
      title: "Sell them together",
      copy: "When the seat changes hands, the money inside goes with it.",
      mode: "prism",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="terminal-grid relative overflow-hidden rounded border border-line bg-surface">
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:p-14">
          <div className="min-w-0">
            <h1 className="max-w-[12ch] text-40 font-semibold leading-[0.98] tracking-[-0.035em] text-paper sm:text-72">
              Sell the seat.
              <br />
              <span className="text-signal">The wallet goes with it.</span>
            </h1>
            <p className="mt-6 max-w-[46ch] font-mono text-14 leading-[1.8] text-paper-dim">
              A membership NFT that owns its own keyless wallet.
              <br />
              Mint it with your own portrait. Hold the seat, hold the money.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                onClick={(e) => {
                  castAsciiSpell({ x: e.clientX, y: e.clientY });
                  openWalletModal();
                }}
                className="w-full sm:w-auto"
              >
                Connect wallet
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <LinkButton
                href="/mint"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                Mint a seat
              </LinkButton>
            </div>

            <button
              type="button"
              onClick={(e) => {
                castAsciiSpell({ x: e.clientX, y: e.clientY, tone: "positive" });
                setDemo(true);
              }}
              className="mt-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 transition-colors hover:text-paper"
            >
              Preview with demo data
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </button>

            <div className="mt-8">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Preview club seats"
              >
                {PREVIEW_ROLL.map((seatItem, index) => {
                  const selected = index === activeRollIdx;
                  return (
                    <button
                      key={seatItem.tokenId}
                      type="button"
                      onMouseEnter={() => setActiveRollIdx(index)}
                      onFocus={() => setActiveRollIdx(index)}
                      onClick={(e) => {
                        castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.75 });
                        setActiveRollIdx(index);
                      }}
                      aria-label={`Preview seat ${seatItem.num} (${seatItem.balance} NEAR inside)`}
                      aria-pressed={selected}
                      className="relative rounded p-1 transition-transform duration-150 hover:-translate-y-0.5"
                    >
                      {selected ? (
                        <motion.span
                          layoutId="hero-seat-ring"
                          transition={{ type: "spring", stiffness: 360, damping: 28 }}
                          className="absolute inset-0 rounded border border-signal bg-signal-soft"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="relative z-10 block">
                        <SeatGlyph
                          tokenId={seatItem.tokenId}
                          innerDots={seatItem.dots}
                          size={22}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                  12 seats ·{" "}
                  <span className="text-paper-dim">
                    #{activePreview.num} ({activePreview.balance} NEAR)
                  </span>
                </p>
                <Link
                  href="/seats"
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
      </section>

      <AsciiRuneDivider />

      <Reveal>
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <AsciiVaultField activeMode={vaultMode} onModeChange={setVaultMode} />

          <div className="flex flex-col justify-between gap-3">
            {moves.map((move) => {
              const active = vaultMode === move.mode;
              return (
                <button
                  key={move.mode}
                  type="button"
                  onClick={(e) => {
                    castAsciiSpell({
                      x: e.clientX,
                      y: e.clientY,
                      intensity: 0.95,
                      tone: "signal",
                    });
                    setVaultMode(move.mode);
                  }}
                  aria-pressed={active}
                  className={`relative flex flex-1 flex-col justify-center overflow-hidden rounded border p-5 text-left transition-colors ${
                    active
                      ? "border-signal bg-surface text-paper"
                      : "border-line bg-surface/60 text-paper-muted hover:border-line-strong hover:text-paper"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="active-move-bar"
                      transition={{ type: "spring", stiffness: 340, damping: 28 }}
                      className="absolute inset-y-0 left-0 w-1 bg-signal"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-label">
                    <span className="text-signal" aria-hidden="true">{move.rune}</span>
                    {active ? <span className="text-[9px] text-positive">Active</span> : null}
                  </div>
                  <AsciiSpellText
                    as="h2"
                    text={move.title}
                    className="mt-1.5 text-16 font-medium text-paper"
                  />
                  <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                    {move.copy}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
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
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("0.50");
  const [listPrice, setListPrice] = useState("6.40");
  const [privateBuyer, setPrivateBuyer] = useState("");
  const [delegateAccount, setDelegateAccount] = useState("agent.demo.testnet");
  const [delegateAllowance, setDelegateAllowance] = useState("0.50");
  const [delegateTtlHours, setDelegateTtlHours] = useState("24");
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

  const openDelegate = () => {
    if (!selectedSeat) return;
    setDelegateAccount(selectedSeat.delegate?.accountId || "agent.demo.testnet");
    setDelegateAllowance(
      selectedSeat.delegate
        ? near(selectedSeat.delegate.remainingYocto, 2)
        : Math.min(0.8, nearValue(selectedSeat.withdrawableYocto, 2)).toFixed(2)
    );
    setDelegateTtlHours("24");
    setActionError(null);
    setNotice(null);
    setDelegateOpen(true);
  };

  const saveDelegate = async () => {
    if (!selectedSeat) return;
    setActionError(null);
    setPending(true);
    try {
      const allowanceYocto = parseNearToYocto(delegateAllowance);
      const ttlSec = Math.max(60, Math.round(Number(delegateTtlHours || "24") * 3600));
      const targetAccount = delegateAccount.trim().toLowerCase();
      if (!targetAccount) throw new Error("Enter a delegate account ID");
      if (BigInt(allowanceYocto) <= 0n) throw new Error("Allowance must be above zero");
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        await mock.setDelegate(selectedSeat.tokenId, targetAccount, allowanceYocto, ttlSec);
      } else {
        await callContractMethod({
          receiverId: selectedSeat.tokenId,
          methodName: "set_delegate",
          args: {
            account_id: targetAccount,
            allowance: allowanceYocto,
            ttl_sec: ttlSec,
          },
          gas: "30000000000000",
          deposit: "1",
        });
        await refreshAll();
      }
      setDelegateOpen(false);
      setNotice(
        `Epoch-bound delegate set for ${targetAccount} (${delegateAllowance} NEAR at seq #${
          selectedSeat.rotationSeq ?? Math.max(0, selectedSeat.holdersCount - 1)
        }).`
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setPending(false);
    }
  };

  const revokeDelegate = async () => {
    if (!selectedSeat) return;
    setActionError(null);
    setPending(true);
    try {
      if (demo) {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        await mock.clearDelegate(selectedSeat.tokenId);
      } else {
        await callContractMethod({
          receiverId: selectedSeat.tokenId,
          methodName: "clear_delegate",
          args: {},
          gas: "30000000000000",
          deposit: "1",
        });
        await refreshAll();
      }
      setDelegateOpen(false);
      setNotice("Vault spending delegate revoked.");
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

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={openDelegate}
              disabled={listed || cooldown}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-paper disabled:opacity-50"
            >
              {selectedSeat.delegate
                ? `Delegate: ${selectedSeat.delegate.accountId} (${near(
                    selectedSeat.delegate.remainingYocto,
                    2
                  )} NEAR)`
                : "Set spending delegate"}
            </button>
            {selectedSeat.delegate ? (
              <button
                type="button"
                onClick={() => void revokeDelegate()}
                disabled={listed || pending}
                className="font-mono text-[10px] uppercase tracking-label text-danger underline decoration-line underline-offset-4 hover:opacity-80 disabled:opacity-50"
              >
                Revoke
              </button>
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

      <ConfirmationSheet
        open={delegateOpen}
        onOpenChange={setDelegateOpen}
        title="Epoch-bound spending delegate"
        description="Appoint an AI agent or hot wallet to spend up to a fixed allowance during your ownership epoch."
        primaryLabel={`Authorize ${delegateAllowance || "0"} NEAR`}
        onConfirm={saveDelegate}
        pending={pending}
        error={actionError}
        confirmDisabled={
          !delegateAccount.trim() || !delegateAllowance || Number(delegateAllowance) <= 0
        }
        blocks={[
          {
            label: "What will happen",
            value: `${delegateAccount.trim() || "—"} can call delegate_withdraw up to ${
              delegateAllowance || "0"
            } NEAR while you hold the seat.`,
          },
          {
            label: "Zero-key guarantee",
            value:
              "Zero NEAR access keys are added to the seat. The allowance is stored inside the vault contract.",
          },
          {
            label: "Automatic cutoff (A3)",
            value: `Bound to rotation_seq #${
              selectedSeat.rotationSeq ?? Math.max(0, selectedSeat.holdersCount - 1)
            }. Frozen while listed and destroyed on transfer or sale.`,
          },
        ]}
        note="If you list, transfer, or sell the seat, this delegate loses access in the same block."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mono-label">Delegate / agent account</span>
            <input
              type="text"
              value={delegateAccount}
              onChange={(event) => setDelegateAccount(event.target.value)}
              placeholder="agent.demo.testnet"
              className="mt-2 min-h-11 w-full rounded border border-line bg-surface-sunken px-3 font-mono text-14 text-paper outline-none placeholder:text-paper-muted focus:border-signal"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mono-label">Allowance cap</span>
              <div className="mt-2 flex min-h-11 items-center rounded border border-line bg-surface-sunken px-3 focus-within:border-signal">
                <input
                  type="text"
                  inputMode="decimal"
                  value={delegateAllowance}
                  onChange={(event) => setDelegateAllowance(event.target.value)}
                  className="w-full bg-transparent py-2 font-mono text-16 text-paper outline-none tabular"
                />
                <span className="ml-2 font-mono text-12 uppercase tracking-label text-paper-muted">
                  NEAR
                </span>
              </div>
            </label>
            <label className="block">
              <span className="mono-label">TTL (hours)</span>
              <div className="mt-2 flex min-h-11 items-center rounded border border-line bg-surface-sunken px-3 focus-within:border-signal">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={delegateTtlHours}
                  onChange={(event) => setDelegateTtlHours(event.target.value)}
                  className="w-full bg-transparent py-2 font-mono text-16 text-paper outline-none tabular"
                />
                <span className="ml-2 font-mono text-12 uppercase tracking-label text-paper-muted">
                  HRS
                </span>
              </div>
            </label>
          </div>
        </div>
      </ConfirmationSheet>

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
