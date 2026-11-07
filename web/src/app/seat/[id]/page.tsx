"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  ExternalLink,
  History,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useProof, useSeat, useSeatHistory } from "@/lib/chain/hooks";
import type {
  HistoryEntry,
  Seat,
  SeatHolder,
  SeatHistory,
} from "@/lib/chain/types";
import { EXPLORER_URL } from "@/lib/near/rpc";
import {
  durationLabel,
  formatDate,
  formatMonth,
  formatTime,
  near,
  seatLabel,
  shortAccount,
} from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { Sheet } from "@/components/ui/Sheet";
import {
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from "@/components/ui/Tabs";
import { SeatCard } from "@/components/seat/SeatCard";
import { SeatArtwork } from "@/components/seat/SeatArtwork";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { ProofStamp } from "@/components/seat/ProofStamp";
import { VerifyDrawer } from "@/components/seat/VerifyDrawer";

function EntryIcon({ kind }: { kind: HistoryEntry["kind"] }) {
  const Icon =
    kind === "earned" || kind === "credit"
      ? ArrowDownLeft
      : kind === "paid_out"
        ? ArrowUpRight
        : UserRound;
  const tone =
    kind === "earned" || kind === "credit"
      ? "border-[rgba(123,216,143,0.3)] bg-positive-soft text-positive"
      : "border-line bg-surface-sunken text-paper-muted";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border ${tone}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

function holderChip(
  entry: HistoryEntry,
  currentOwner: string,
  currentAccount: string | null
) {
  if (entry.holderId === currentAccount) {
    return <Chip tone="accent">You</Chip>;
  }
  return (
    <Chip tone="neutral">
      {shortAccount(entry.holderId, 20)}
      {entry.holderId === currentOwner ? " · now" : ""}
    </Chip>
  );
}

function amountLabel(entry: HistoryEntry): {
  text: string;
  className: string;
} {
  if (!entry.amountYocto) return { text: "—", className: "text-paper-muted" };
  const value = near(entry.amountYocto, 2);
  if (entry.kind === "earned" || entry.kind === "credit") {
    return { text: `+${value}`, className: "text-positive" };
  }
  if (entry.kind === "paid_out") {
    return { text: `−${value}`, className: "text-paper-dim" };
  }
  return { text: value, className: "text-paper-muted" };
}

function MonthGroup({
  month,
  entries,
  currentOwner,
  currentAccount,
  onSelect,
}: {
  month: string;
  entries: HistoryEntry[];
  currentOwner: string;
  currentAccount: string | null;
  onSelect: (entry: HistoryEntry) => void;
}) {
  return (
    <section aria-label={month}>
      <h2 className="mono-label sticky top-16 z-10 -mx-4 bg-ink px-4 py-3 sm:mx-0 sm:px-0">
        {month}
      </h2>
      <div className="border-t border-line">
        {entries.map((entry) => {
          const amount = amountLabel(entry);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-line px-0 py-3 text-left transition-colors duration-120 hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              <EntryIcon kind={entry.kind} />
              <span className="min-w-0">
                <span className="block truncate text-14 text-paper">
                  {entry.label}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
                    {formatDate(entry.atMs, { month: "short", day: "numeric" })} ·{" "}
                    {formatTime(entry.atMs)}
                  </span>
                  {holderChip(entry, currentOwner, currentAccount)}
                </span>
              </span>
              <span className="text-right">
                <span className={`block font-mono text-14 tabular ${amount.className}`}>
                  {amount.text}
                </span>
                <span className="block font-mono text-[9px] uppercase tracking-label text-paper-muted">
                  NEAR
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HoldersStrip({
  holders,
  currentAccount,
}: {
  holders: SeatHolder[];
  currentAccount: string | null;
}) {
  const now = Date.now();
  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {holders.map((holder, index) => {
          const active = holder.untilMs === null;
          return (
            <div
              key={`${holder.ownerId}-${holder.seq}-${index}`}
              className={`min-w-[230px] shrink-0 rounded border p-4 ${
                active
                  ? "border-[rgba(59,155,255,0.4)] bg-signal-soft"
                  : "border-line bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="bracket-label">[ {String(holder.seq + 1).padStart(2, "0")} ]</span>
                <Chip tone={active ? "accent" : "neutral"} dot={active}>
                  {active ? "Current" : "Past"}
                </Chip>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <SeatGlyph
                  tokenId={`${holder.ownerId}-${holder.seq}`}
                  innerDots={active ? 6 : 3}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="truncate font-mono text-14 text-paper">
                    {holder.ownerId === currentAccount ? "You" : holder.ownerId}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                    {holder.via === "mint"
                      ? "Minted"
                      : holder.via === "sale"
                        ? "Bought the seat"
                        : holder.via === "transfer"
                          ? "Received the seat"
                          : "Synced"}
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-3 font-mono text-[10px] uppercase leading-relaxed tracking-label text-paper-muted">
                <div>{formatDate(holder.sinceMs, { month: "short", day: "numeric", year: "numeric" })}</div>
                <div className="mt-1">
                  {active
                    ? `${durationLabel(holder.sinceMs, now)} and counting`
                    : durationLabel(holder.sinceMs, holder.untilMs ?? now)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-12 leading-relaxed text-paper-muted">
        A seat can change hands. Its money, its history and its access move with it.
      </p>
    </div>
  );
}

function DetailDrawer({
  entry,
  seat,
  currentAccount,
  open,
  onOpenChange,
}: {
  entry: HistoryEntry | null;
  seat: Seat;
  currentAccount: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const explorer = entry?.txHash
    ? `${EXPLORER_URL}/tx/${entry.txHash}`
    : `${EXPLORER_URL}/address/${seat.tokenId}`;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry?.label ?? "History"}
      description={
        entry
          ? `${formatDate(entry.atMs, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })} · ${formatTime(entry.atMs)}`
          : undefined
      }
      footer={
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-12 text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
        >
          Open in explorer
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      }
    >
      {entry ? (
        <dl className="divide-y divide-line border-y border-line">
          <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="mono-label">Amount</dt>
            <dd className="font-mono text-24 tabular text-paper">
              {entry.amountYocto ? near(entry.amountYocto, 2) : "—"}
              <span className="ml-1 text-12 text-paper-muted">NEAR</span>
            </dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="mono-label">Holder at the time</dt>
            <dd className="font-mono text-14 text-paper">
              {entry.holderId === currentAccount ? "You" : entry.holderId}
            </dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="mono-label">Detail</dt>
            <dd className="text-14 leading-relaxed text-paper-dim">
              {entry.detail ?? "—"}
            </dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="mono-label">Transaction</dt>
            <dd className="break-all font-mono text-12 text-paper-muted">
              {entry.txHash ?? "Recorded in the seat's history. No separate hash."}
            </dd>
          </div>
        </dl>
      ) : null}
    </Sheet>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Reading seat history">
      <div className="h-8 w-48 animate-skeleton rounded bg-line" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-skeleton rounded border border-line bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-skeleton rounded border border-line bg-surface" />
    </div>
  );
}

export default function SeatHistoryPage() {
  const params = useParams<{ id: string }>();
  const tokenId = decodeURIComponent(params?.id ?? "");
  const { accountId, registryId } = useNear();
  const { demo, demoAccount } = useDemo();
  const currentAccount = demo ? demoAccount : accountId;

  const seatQuery = useSeat(tokenId);
  const historyQuery = useSeatHistory(tokenId);
  const proofQuery = useProof(tokenId);

  const [proofOpen, setProofOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const seat = seatQuery.data;
  const history = historyQuery.data;

  const grouped = useMemo(() => {
    const items = history?.items ?? [];
    const map = new Map<string, HistoryEntry[]>();
    items.forEach((entry) => {
      const key = formatMonth(entry.atMs);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [history]);

  const earnedEntries = (history?.items ?? []).filter(
    (entry) => entry.kind === "earned" || entry.kind === "credit"
  );
  const paidEntries = (history?.items ?? []).filter(
    (entry) => entry.kind === "paid_out"
  );

  if (seatQuery.isLoading || historyQuery.isLoading) return <HistorySkeleton />;

  if (seatQuery.isError || !seat) {
    return (
      <Panel className="mx-auto max-w-prose p-8 text-center">
        <CircleAlert className="mx-auto h-6 w-6 text-caution" aria-hidden="true" />
        <h1 className="mt-4 text-24 font-semibold text-paper">
          This seat is not here.
        </h1>
        <p className="mt-2 text-14 leading-relaxed text-paper-muted">
          Check the seat link, or read the chain again.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => seatQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <LinkButton href="/market" variant="secondary">
            Browse market
          </LinkButton>
        </div>
      </Panel>
    );
  }

  const number = seatLabel(seat.tokenId);
  const data: SeatHistory = history ?? {
    seatId: seat.tokenId,
    items: [],
    holders: [],
    earnedYocto: "0",
    paidOutYocto: "0",
    holdersCount: 1,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted hover:text-paper"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to wallet
          </Link>
          <span className="bracket-label mt-4 block">[ {number} / HISTORY ]</span>
          <h1 className="mt-2 text-40 font-semibold text-paper">
            {seat.name?.trim() || `Seat ${number}`}
          </h1>
          <p className="mt-2 max-w-[52ch] text-14 leading-relaxed text-paper-muted">
            Every credit and every handoff, kept with the seat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={demo ? "neutral" : "accent"} dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <ProofStamp onClick={() => setProofOpen(true)} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel className="p-4">
              <div className="mono-label">Earned</div>
              <div className="mt-2 font-mono text-24 tabular text-positive">
                {near(data.earnedYocto, 2)}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                NEAR, all time
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="mono-label">Paid out</div>
              <div className="mt-2 font-mono text-24 tabular text-paper">
                {near(data.paidOutYocto, 2)}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                NEAR, all time
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="mono-label">Held by</div>
              <div className="mt-2 font-mono text-24 tabular text-paper">
                {data.holdersCount}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                {data.holdersCount === 1 ? "person" : "people"}
              </div>
            </Panel>
          </div>

          <Panel>
            <div className="px-4 pt-4">
              <TabsRoot defaultValue="all">
                <TabsList label="Seat history">
                  <TabsTrigger value="all" count={data.items.length}>
                    All
                  </TabsTrigger>
                  <TabsTrigger value="earned" count={earnedEntries.length}>
                    Earned
                  </TabsTrigger>
                  <TabsTrigger value="paid" count={paidEntries.length}>
                    Paid out
                  </TabsTrigger>
                  <TabsTrigger value="holders" count={data.holdersCount}>
                    Holders
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="pt-4">
                  {data.items.length === 0 ? (
                    <EmptyHistory />
                  ) : (
                    <div className="space-y-8">
                      {grouped.map(([month, entries]) => (
                        <MonthGroup
                          key={month}
                          month={month}
                          entries={entries}
                          currentOwner={seat.ownerId}
                          currentAccount={currentAccount}
                          onSelect={setSelectedEntry}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="earned" className="pt-4">
                  {earnedEntries.length === 0 ? (
                    <EmptyHistory />
                  ) : (
                    <div className="space-y-8">
                      {grouped.map(([month, entries]) => {
                        const filtered = entries.filter(
                          (entry) =>
                            entry.kind === "earned" || entry.kind === "credit"
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <MonthGroup
                            key={month}
                            month={month}
                            entries={filtered}
                            currentOwner={seat.ownerId}
                            currentAccount={currentAccount}
                            onSelect={setSelectedEntry}
                          />
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="paid" className="pt-4">
                  {paidEntries.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-14 text-paper-muted">
                        Nothing paid out yet. The money stays in the seat.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {grouped.map(([month, entries]) => {
                        const filtered = entries.filter(
                          (entry) => entry.kind === "paid_out"
                        );
                        if (filtered.length === 0) return null;
                        return (
                          <MonthGroup
                            key={month}
                            month={month}
                            entries={filtered}
                            currentOwner={seat.ownerId}
                            currentAccount={currentAccount}
                            onSelect={setSelectedEntry}
                          />
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="holders" className="pt-4">
                  {data.holders.length === 0 ? (
                    <p className="py-10 text-center text-14 text-paper-muted">
                      No holders recorded yet.
                    </p>
                  ) : (
                    <HoldersStrip
                      holders={data.holders}
                      currentAccount={currentAccount}
                    />
                  )}
                </TabsContent>
              </TabsRoot>
            </div>
            <div className="border-t border-line px-4 py-3">
              <p className="flex items-center gap-2 text-12 text-paper-muted">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                History travels with the seat, not with the account.
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          {seat.imageUrl ? (
            <Panel className="overflow-hidden">
              <SeatArtwork
                seat={seat}
                className="aspect-[4/5] w-full rounded-none border-0"
                showLabel
              />
            </Panel>
          ) : null}
          <SeatCard seat={seat} compact />
          {seat.description ? (
            <Panel className="p-4">
              <div className="mono-label">The story</div>
              <p className="mt-2 text-14 leading-relaxed text-paper-dim">
                {seat.description}
              </p>
            </Panel>
          ) : null}
          <Panel className="p-4">
            <div className="mono-label">Holder</div>
            <div className="mt-2 break-all font-mono text-14 text-paper">
              {seat.ownerId === currentAccount ? "You" : seat.ownerId}
            </div>
            <div className="mt-4 mono-label">Held since</div>
            <div className="mt-1 font-mono text-14 text-paper">
              {formatDate(seat.holderSinceMs, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="mt-4 mono-label">Events attended</div>
            <div className="mt-1 font-mono text-14 tabular text-paper">
              {seat.eventsAttended}
            </div>
          </Panel>
          <Panel className="p-4">
            <div className="mono-label">Club</div>
            <div className="mt-2 break-all font-mono text-12 text-paper-muted">
              {demo ? "logen.testnet" : registryId}
            </div>
            <p className="mt-3 text-12 leading-relaxed text-paper-muted">
              This seat has no keys. Only the club contract can move its money,
              and only for the current holder.
            </p>
          </Panel>
        </div>
      </div>

      <DetailDrawer
        entry={selectedEntry}
        seat={seat}
        currentAccount={currentAccount}
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
      />

      <VerifyDrawer
        open={proofOpen}
        onOpenChange={setProofOpen}
        proof={proofQuery.data}
        loading={proofQuery.isLoading}
        onRecheck={async () => {
          await proofQuery.refetch();
        }}
      />
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded border border-line bg-surface-sunken">
        <History className="h-4 w-4 text-paper-muted" aria-hidden="true" />
      </div>
      <p className="mx-auto mt-4 max-w-[36ch] text-14 leading-relaxed text-paper-muted">
        Nothing here yet. Earnings appear after the first event settles.
      </p>
    </div>
  );
}
