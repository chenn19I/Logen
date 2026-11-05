"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  FlaskConical,
  Loader2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useAllSeats, useEvents, useSeats } from "@/lib/chain/hooks";
import type { ClubEvent, Seat } from "@/lib/chain/types";
import {
  formatDate,
  formatTime,
  near,
  relativeSeconds,
  seatLabel,
  shortAccount,
} from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { PixelChair } from "@/components/seat/PixelChair";

interface LoungeContent {
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
}

interface GateResponse {
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
  loungeContent?: LoungeContent;
}

function doorCode(tokenId: string): string {
  let hash = 0;
  for (let index = 0; index < tokenId.length; index += 1) {
    hash = (hash * 31 + tokenId.charCodeAt(index)) >>> 0;
  }
  return `P-${seatLabel(tokenId)}-${String(1000 + (hash % 9000))}`;
}

function Door({ locked = false }: { locked?: boolean }) {
  return (
    <div className="relative h-56 w-40" aria-hidden="true">
      <span className="absolute -top-5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-[1px] bg-signal" />
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-label text-paper-muted">
        {locked ? "Closed" : "07"}
      </span>

      <div className="absolute inset-x-0 top-0 h-52 border border-line-strong bg-surface-sunken p-2">
        <div className="flex h-7 items-end gap-1 border-b border-line pb-1">
          <span className="h-full flex-1 border-x border-line" />
          <span className="h-full flex-1 border-x border-line" />
          <span className="h-full flex-1 border-x border-line" />
        </div>

        <div className="mt-2 grid h-[164px] grid-cols-2 gap-1">
          <div className="relative border border-line">
            <span className="absolute inset-2 border border-line/70" />
            <span className="absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-[1px] bg-paper-muted" />
          </div>
          <div className="relative border border-line">
            <span className="absolute inset-2 border border-line/70" />
            <span className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-[1px] bg-paper-muted" />
          </div>
        </div>
      </div>

      <div className="absolute -bottom-2 left-1/2 h-2 w-48 -translate-x-1/2 border-x border-b border-line-strong" />
    </div>
  );
}

function Tonight({
  event,
  seat,
}: {
  event: ClubEvent | null;
  seat: Seat | null;
}) {
  const doorsAt = event ? event.startsAtMs - 30 * 60 * 1000 : null;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <div className="py-8 lg:pr-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="bracket-label">[ TONIGHT ]</span>
          {event ? (
            <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
              {event.sold} / {event.capacity} sold
            </span>
          ) : null}
        </div>
        <h2 className="mt-4 max-w-[18ch] text-40 font-semibold leading-[1.02] text-paper">
          {event?.title ?? "The room is quiet."}
        </h2>
        {event ? (
          <>
            <p className="mt-5 font-mono text-14 text-paper-dim">
              {formatDate(event.startsAtMs, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}{" "}
              · {formatTime(event.startsAtMs)}
            </p>
            <p className="mt-2 max-w-[44ch] text-14 leading-relaxed text-paper-muted">
              Your seat earns a share of every ticket sold. The room opens
              thirty minutes before the first frame.
            </p>
          </>
        ) : (
          <p className="mt-5 max-w-[40ch] text-14 leading-relaxed text-paper-muted">
            No event is scheduled yet. The room stays open for holders.
          </p>
        )}
      </div>

      <div className="flex items-center gap-6 border-t border-line py-8 lg:border-l lg:border-t-0 lg:pl-12">
        <PixelChair size={116} />
        <dl className="flex-1 space-y-2 font-mono text-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
            <dt className="uppercase tracking-label text-paper-muted">Doors</dt>
            <dd className="tabular text-paper">{doorsAt ? formatTime(doorsAt) : "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
            <dt className="uppercase tracking-label text-paper-muted">Start</dt>
            <dd className="tabular text-paper">
              {event ? formatTime(event.startsAtMs) : "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="uppercase tracking-label text-paper-muted">Ticket</dt>
            <dd className="tabular text-paper">
              {event ? `${near(event.ticketPriceYocto, 2)} NEAR` : "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-1">
            <dt className="uppercase tracking-label text-paper-muted">Inside</dt>
            <dd className="text-signal">
              {seat ? `Seat ${seatLabel(seat.tokenId)}` : "Members' room"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function GuestList({
  seats,
  currentAccount,
  loading,
}: {
  seats: Seat[];
  currentAccount: string | null;
  loading: boolean;
}) {
  const visible = [...seats]
    .sort((a, b) => {
      const aYou = a.ownerId === currentAccount ? 0 : 1;
      const bYou = b.ownerId === currentAccount ? 0 : 1;
      return aYou - bYou || a.number - b.number;
    })
    .slice(0, 6);

  return (
    <section className="border-t border-line py-8" aria-labelledby="door-list">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="door-list" className="text-24 font-semibold text-paper">
          Door list
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          {seats.length} seats · six shown
        </span>
      </div>

      <div className="mt-5 grid grid-cols-[32px_64px_1fr_auto] items-center gap-3 border-b border-line pb-2 font-mono text-[9px] uppercase tracking-label text-paper-muted sm:grid-cols-[36px_84px_1fr_auto]">
        <span />
        <span>Seat</span>
        <span>Holder</span>
        <span>State</span>
      </div>

      {loading ? (
        <div className="divide-y divide-line" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 py-3">
              <div className="h-6 w-6 animate-skeleton rounded bg-line" />
              <div className="h-3 w-16 animate-skeleton rounded bg-line" />
              <div className="h-3 flex-1 animate-skeleton rounded bg-line" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-line">
          {visible.map((seat) => {
            const isYou = seat.ownerId === currentAccount;
            const away = seat.status === "listed";
            return (
              <div
                key={seat.tokenId}
                className="grid grid-cols-[32px_64px_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[36px_84px_1fr_auto]"
              >
                <SeatGlyph
                  tokenId={seat.tokenId}
                  innerDots={seat.innerDots}
                  size={24}
                />
                <span className="font-mono text-12 uppercase tracking-label text-paper-muted">
                  Seat {seatLabel(seat.tokenId)}
                </span>
                <span className="min-w-0 truncate text-14 text-paper-dim">
                  {isYou ? "You" : shortAccount(seat.ownerId, 26)}
                </span>
                <Chip tone={isYou ? "accent" : away ? "caution" : "neutral"}>
                  {isYou ? "Here" : away ? "Away" : "In"}
                </Chip>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function LoungePage() {
  const {
    accountId,
    registryId,
    openWalletModal,
    signNep413Message,
  } = useNear();
  const { demo, demoAccount, chain, simulateHandoff } = useDemo();
  const currentAccount = demo ? demoAccount : accountId;

  const seatsQuery = useSeats();
  const eventsQuery = useEvents();
  const [enteredSeatId, setEnteredSeatId] = useState<string | null>(null);
  const allSeatsQuery = useAllSeats(Boolean(enteredSeatId));

  const [demoEntered, setDemoEntered] = useState(false);
  const [liveGate, setLiveGate] = useState<GateResponse | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number>(Date.now());
  const [now, setNow] = useState(Date.now());
  const hadLiveSession = useRef(false);

  const holderSeat = useMemo(
    () =>
      seatsQuery.data?.find((seat) => seat.tokenId === enteredSeatId) ??
      seatsQuery.data?.[0] ??
      null,
    [seatsQuery.data, enteredSeatId]
  );

  const lockedSeat = useMemo(
    () =>
      allSeatsQuery.data?.find((seat) => seat.tokenId === enteredSeatId) ?? null,
    [allSeatsQuery.data, enteredSeatId]
  );

  const nextEvent = useMemo(() => {
    const events = eventsQuery.data ?? [];
    return (
      events
        .filter((event) => event.status === "upcoming")
        .sort((a, b) => a.startsAtMs - b.startsAtMs)[0] ??
      events[0] ??
      null
    );
  }, [eventsQuery.data]);

  const isHolder = demo
    ? demoEntered && !locked
    : Boolean(liveGate?.authenticated) && !locked;

  const content = liveGate?.loungeContent;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!demo) return;
    if (!demoEntered && seatsQuery.data?.[0]) {
      setEnteredSeatId(seatsQuery.data[0].tokenId);
    }
  }, [demo, demoEntered, seatsQuery.data]);

  useEffect(() => {
    if (demo) {
      setLiveGate(null);
      setLocked(false);
      setLockReason(null);
      setAuthError(null);
      setAuthStep(null);
      hadLiveSession.current = false;
    } else {
      setDemoEntered(false);
      setLocked(false);
      setLockReason(null);
    }
  }, [demo]);

  const fetchLiveContent = useCallback(
    async (silent = false) => {
      if (!silent) setAuthStep("Checking the door.");
      try {
        const res = await fetch("/api/gate/content", { cache: "no-store" });
        const data = (await res.json()) as GateResponse;
        if (res.ok && data.authenticated) {
          hadLiveSession.current = true;
          setLiveGate(data);
          if (data.session?.tokenId) setEnteredSeatId(data.session.tokenId);
          setLastCheckedAt(Date.now());
          setLocked(false);
          setLockReason(null);
          setAuthError(null);
        } else {
          setLiveGate(null);
          if (hadLiveSession.current) {
            setLocked(true);
            setLockReason(
              data.code === "E_SESSION_ROTATED_OUT"
                ? "This seat now belongs to someone else."
                : "Only the current holder can enter."
            );
            hadLiveSession.current = false;
          }
        }
      } catch (error) {
        if (!silent) {
          setAuthError(
            error instanceof Error ? error.message : "The door did not answer."
          );
        }
      } finally {
        if (!silent) setAuthStep(null);
      }
    },
    []
  );

  useEffect(() => {
    if (!demo) void fetchLiveContent(true);
  }, [demo, fetchLiveContent]);

  // The door is checked every five seconds. In demo mode the check is local.
  useEffect(() => {
    if (!isHolder) return;
    const timer = window.setInterval(async () => {
      if (demo) {
        if (!enteredSeatId) return;
        const seat = await chain.getSeat(enteredSeatId);
        if (!seat || seat.ownerId !== demoAccount) {
          setLocked(true);
          setLockReason("This seat now belongs to someone else.");
        } else {
          setLastCheckedAt(Date.now());
        }
        return;
      }
      await fetchLiveContent(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [
    isHolder,
    demo,
    enteredSeatId,
    chain,
    demoAccount,
    fetchLiveContent,
  ]);

  const enterDemo = () => {
    const seat = seatsQuery.data?.[0];
    if (!seat) return;
    setEnteredSeatId(seat.tokenId);
    setDemoEntered(true);
    setLocked(false);
    setLockReason(null);
    setLastCheckedAt(Date.now());
  };

  const liveLogin = async () => {
    setAuthError(null);
    if (!accountId) {
      openWalletModal();
      return;
    }
    try {
      setAuthStep("Asking the club for a nonce.");
      const challengeRes = await fetch("/api/gate/challenge", { method: "POST" });
      const challenge = await challengeRes.json();
      if (!challengeRes.ok) {
        throw new Error(challenge.error ?? "The club did not issue a nonce.");
      }

      setAuthStep("Waiting for your signature.");
      const signed = await signNep413Message({
        message: challenge.message,
        recipient: challenge.recipient,
        nonceBase64: challenge.nonceBase64,
      });

      setAuthStep("Checking the seat against the chain.");
      const verifyRes = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: signed.accountId,
          publicKey: signed.publicKey,
          signature: signed.signature,
          registryId,
          challengeToken: challenge.challengeToken,
        }),
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(
          `[${verified.code ?? verifyRes.status}] ${
            verified.error ?? "Verification rejected"
          }`
        );
      }
      await fetchLiveContent();
    } catch (error) {
      setAuthStep(null);
      setAuthError(
        error instanceof Error ? error.message : "The signature was not accepted."
      );
    }
  };

  const logout = async () => {
    if (demo) {
      setDemoEntered(false);
      setLocked(false);
      setLockReason(null);
      return;
    }
    await fetch("/api/gate/content", { method: "DELETE" });
    hadLiveSession.current = false;
    setLiveGate(null);
    setLocked(false);
    setLockReason(null);
  };

  const sellDemoSeat = async () => {
    if (!enteredSeatId) return;
    await simulateHandoff(enteredSeatId);
    setLocked(true);
    setLockReason("This seat now belongs to someone else.");
  };

  const checkedSeconds = Math.max(
    0,
    Math.floor((now - lastCheckedAt) / 1000)
  );

  if (!isHolder) {
    const showLocked = locked;
    const nextSeat = seatsQuery.data?.[0] ?? null;

    return (
      <section className="terminal-grid overflow-hidden rounded border border-line bg-surface">
        <div className="grid lg:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
          <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="bracket-label">
                [ LOUNGE / {showLocked ? "LOCKED" : "CLOSED"} ]
              </span>
              {showLocked ? (
                <Chip tone="caution" dot>
                  Seat changed hands
                </Chip>
              ) : null}
            </div>

            <h1 className="mt-6 max-w-[11ch] text-40 font-semibold leading-[0.98] tracking-[-0.035em] text-paper sm:text-72">
              {showLocked
                ? "This seat now belongs to someone else."
                : "Only the current holder can enter."}
            </h1>
            <p className="mt-5 max-w-[40ch] font-mono text-14 leading-relaxed text-paper-muted">
              {showLocked
                ? "The door closed the moment the seat changed hands. The new holder has the key now."
                : "The door reads the seat, not the name on the list. Sign once to prove it is yours."}
            </p>

            {authStep ? (
              <p
                className="mt-6 flex items-center gap-2 font-mono text-12 text-paper-muted"
                role="status"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {authStep}
              </p>
            ) : null}

            {authError ? (
              <div className="mt-6 max-w-[46ch] rounded border border-[rgba(255,107,94,0.35)] bg-danger-soft px-4 py-3">
                <p className="text-12 text-danger" role="alert">
                  That did not go through. Nothing moved.
                </p>
                <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-danger">
                  {authError}
                </p>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {demo ? (
                <Button size="lg" onClick={enterDemo} disabled={!nextSeat}>
                  {nextSeat
                    ? `Enter with seat ${seatLabel(nextSeat.tokenId)}`
                    : "No demo seat left"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : accountId ? (
                <Button size="lg" onClick={liveLogin}>
                  Sign to enter
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button size="lg" onClick={openWalletModal}>
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Connect wallet
                </Button>
              )}
              <LinkButton href="/market" variant="secondary" size="lg">
                Browse market
              </LinkButton>
            </div>

            <div className="mt-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              <ShieldCheck
                className="h-3.5 w-3.5 text-positive"
                aria-hidden="true"
              />
              No keys. Only the current holder.
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <dt className="mono-label">Door</dt>
                <dd className="mt-1 font-mono text-12 text-paper">
                  {showLocked ? "Closed" : "Waiting"}
                </dd>
              </div>
              <div>
                <dt className="mono-label">Check</dt>
                <dd className="mt-1 font-mono text-12 text-paper">
                  Every 5 seconds
                </dd>
              </div>
              <div>
                <dt className="mono-label">Seat</dt>
                <dd className="mt-1 font-mono text-12 text-paper">
                  {enteredSeatId ? seatLabel(enteredSeatId) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          <aside className="flex flex-col border-t border-line lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <span className="mono-label">The door</span>
              <span className="font-mono text-[9px] uppercase tracking-label text-paper-muted">
                North entrance
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
              <Door locked={showLocked} />

              <div className="mt-10 w-full max-w-[280px] border-t border-line pt-4">
                {showLocked && lockedSeat ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="mono-label">Seat {seatLabel(lockedSeat.tokenId)}</span>
                      <span className="font-mono text-[10px] uppercase tracking-label text-caution">
                        Sold
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-12 text-paper">
                      {lockedSeat.ownerId}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                      Current holder
                    </p>
                  </>
                ) : nextEvent ? (
                  <>
                    <p className="text-16 leading-snug text-paper">
                      {nextEvent.title}
                    </p>
                    <p className="mt-1 font-mono text-12 text-paper-muted">
                      {formatDate(nextEvent.startsAtMs, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {formatTime(nextEvent.startsAtMs)}
                    </p>
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                      {nextEvent.sold} / {nextEvent.capacity} sold
                    </p>
                  </>
                ) : (
                  <p className="text-14 leading-relaxed text-paper-muted">
                    No event is scheduled yet.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-line px-6 py-4">
              <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-label">
                <span className="text-paper-muted">Door code</span>
                <span className="text-paper-muted">— — —</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-label">
                <span className="text-paper-muted">Holder</span>
                <span className={showLocked ? "text-caution" : "text-paper-muted"}>
                  {showLocked ? "Changed" : "Not checked"}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <div>
      <header className="pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="bracket-label">[ LOUNGE / OPEN ]</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
          >
            Lock the room
          </button>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="max-w-[12ch] text-40 font-semibold leading-[0.98] tracking-[-0.035em] text-paper sm:text-72">
              The room is yours.
            </h1>
            <p className="mt-4 max-w-[44ch] font-mono text-14 leading-relaxed text-paper-muted">
              {holderSeat
                ? `Seat ${seatLabel(holderSeat.tokenId)} is on the door list. Show the code below.`
                : "Your seat is on the door list. Show the code below."}
            </p>
          </div>
          <div className="lg:text-right">
            <div className="mono-label">Door code</div>
            <div className="mt-2 font-mono text-40 tabular text-signal">
              {doorCode(enteredSeatId ?? holderSeat?.tokenId ?? "s007")}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
              Show this at the door
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 border-y border-line py-3">
        <p
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-label text-positive"
          role="status"
          aria-live="polite"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
          Verified holder, checked {relativeSeconds(checkedSeconds)}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          {holderSeat ? `Seat ${seatLabel(holderSeat.tokenId)}` : "Seat"} ·{" "}
          {currentAccount ? shortAccount(currentAccount, 28) : "—"}
        </p>
      </div>

      <Tonight event={nextEvent} seat={holderSeat} />

      <GuestList
        seats={allSeatsQuery.data ?? []}
        currentAccount={currentAccount}
        loading={allSeatsQuery.isLoading}
      />

      <section className="grid gap-6 border-t border-line py-6 lg:grid-cols-[150px_1fr]">
        <h2 className="mono-label">Notice</h2>
        <div>
          <p className="max-w-[56ch] text-14 leading-relaxed text-paper-dim">
            {content?.dispatches?.[0]?.body ??
              "The rooftop is heated. The bar runs until 23:00. Bring the seat, not a ticket."}
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-label text-paper-muted">
            {content?.dispatches?.[0]
              ? `${content.dispatches[0].author} · ${content.dispatches[0].date}`
              : "The club"}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
        <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          Door list read from the chain every 5 seconds
        </p>
        <p className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          {demo ? "Simulated data. Not on chain." : "NEAR Testnet"}
        </p>
      </div>

      {demo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
          <p className="font-mono text-[10px] uppercase tracking-label text-caution">
            Demo control
          </p>
          <button
            type="button"
            onClick={() => void sellDemoSeat()}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-caution"
          >
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            Sell this seat and lock the room
          </button>
        </div>
      ) : null}
    </div>
  );
}
