"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { AsciiSpellText, castAsciiSpell } from "@/components/ascii/AsciiSpellEngine";
import {
  ArrowRight,
  CircleAlert,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useAllSeats } from "@/lib/chain/hooks";
import type { Seat } from "@/lib/chain/types";
import { near, seatLabel, shortAccount } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { SeatArtwork } from "@/components/seat/SeatArtwork";
import { SeatGlyph } from "@/components/seat/SeatGlyph";

function statusChip(seat: Seat) {
  if (seat.status === "listed") return <Chip tone="caution" dot>Listed</Chip>;
  if (seat.status === "pending") return <Chip tone="caution" dot>Pending</Chip>;
  if (seat.status === "cooldown") return <Chip tone="caution" dot>Cooldown</Chip>;
  return <Chip tone="positive" dot>Active</Chip>;
}

function SeatDirectoryCard({ seat }: { seat: Seat }) {
  const label = seat.name?.trim() || `Seat ${seatLabel(seat.tokenId)}`;

  return (
    <Link
      href={`/seat/${encodeURIComponent(seat.tokenId)}`}
      className="card-lift group flex flex-col rounded border border-line bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <span className="font-mono text-12 uppercase tracking-label text-paper-muted">
          Seat {String(seat.number).padStart(2, "0")}
        </span>
        {statusChip(seat)}
      </div>

      <div className="flex items-center gap-4 px-4 py-4">
        {seat.imageUrl ? (
          <SeatArtwork seat={seat} className="h-20 w-20 shrink-0" />
        ) : (
          <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-16 font-medium text-paper group-hover:text-signal-strong">
            {label}
          </h2>
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-label text-paper-muted">
            {seat.tokenId}
          </p>
          <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-label text-paper-muted">
            {shortAccount(seat.ownerId, 24)}
          </p>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-px border-t border-line bg-line">
        <div className="bg-surface px-4 py-3">
          <div className="mono-label">Inside</div>
          <div className="mt-1 font-mono text-16 tabular text-positive">
            {near(seat.balanceYocto, 2)} NEAR
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="mono-label">Earned</div>
          <div className="mt-1 font-mono text-16 tabular text-paper">
            {near(seat.earnedYocto, 2)} NEAR
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-3 font-mono text-[10px] uppercase tracking-label text-paper-muted">
        <span>{seat.holdersCount} {seat.holdersCount === 1 ? "holder" : "holders"}</span>
        <span className="inline-flex items-center gap-1 text-signal-strong">
          Open seat
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export default function SeatsDirectoryPage() {
  const queryClient = useQueryClient();
  const { accountId, registryId } = useNear();
  const { demo, demoAccount } = useDemo();
  const currentAccount = demo ? demoAccount : accountId;
  const seatsQuery = useAllSeats();
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const seats = useMemo(
    () =>
      [...(seatsQuery.data ?? [])].sort((a, b) => a.number - b.number),
    [seatsQuery.data]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return seats.filter((seat) => {
      if (mineOnly && currentAccount && seat.ownerId !== currentAccount) return false;
      if (!needle) return true;
      return [seat.tokenId, seat.name, seat.handle, seat.ownerId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [currentAccount, mineOnly, query, seats]);

  const registryLabel = demo ? "logen.testnet" : registryId;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <AsciiSpellText
            as="h1"
            text="Every seat."
            className="text-40 font-semibold text-paper"
          />
          <p className="mt-2 max-w-[56ch] text-14 leading-relaxed text-paper-muted">
            The full club roll on <span className="font-mono text-paper-dim">{registryLabel}</span>.
            Each seat is a keyless NEAR wallet with its own money and history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={demo ? "caution" : "accent"} dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <LinkButton href="/mint" size="sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Mint a seat
          </LinkButton>
        </div>
      </div>

      <Panel className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-h-10 w-full min-w-0 flex-1 items-center rounded border border-line bg-surface-sunken px-3 focus-within:border-signal">
            <Search className="mr-2 h-4 w-4 shrink-0 text-paper-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, handle, id or owner"
              aria-label="Search seats"
              className="w-full bg-transparent py-2 font-mono text-12 text-paper outline-none placeholder:text-paper-muted"
            />
          </div>
          <div className="flex items-center gap-2">
            {currentAccount ? (
              <Button
                variant={mineOnly ? "primary" : "secondary"}
                size="sm"
                onClick={() => setMineOnly((value) => !value)}
                aria-pressed={mineOnly}
                className="flex-1 sm:flex-none"
              >
                My seats
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["seats"] })}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line text-paper-muted transition-colors hover:border-line-strong hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              aria-label="Refresh seats"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-12 text-paper-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
          {filtered.length} of {seats.length} seats · no access keys, ever
        </p>
      </Panel>

      {seatsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Reading seats">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[260px] animate-skeleton rounded border border-line bg-surface"
            />
          ))}
        </div>
      ) : seatsQuery.isError ? (
        <Panel className="mx-auto max-w-prose p-8 text-center">
          <CircleAlert className="mx-auto h-6 w-6 text-caution" aria-hidden="true" />
          <h2 className="mt-4 text-24 font-semibold text-paper">
            We could not read the directory.
          </h2>
          <p className="mt-2 text-14 leading-relaxed text-paper-muted">
            Nothing changed. Try again in a moment.
          </p>
          <Button className="mt-5" variant="secondary" onClick={() => seatsQuery.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel className="p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-5 w-5 text-paper-muted" aria-hidden="true" />
          <h2 className="mt-4 text-24 font-semibold text-paper">
            {seats.length === 0 ? "No seats yet." : "No seats match that search."}
          </h2>
          <p className="mx-auto mt-2 max-w-[40ch] text-14 leading-relaxed text-paper-muted">
            {seats.length === 0
              ? "Mint the first one. It becomes an NFT and a keyless wallet in one move."
              : "Try a shorter name, a handle, or clear the filters."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {seats.length === 0 ? (
              <LinkButton href="/mint">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Mint a seat
              </LinkButton>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setMineOnly(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((seat, idx) => (
            <motion.div
              key={seat.tokenId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 340,
                damping: 28,
                delay: Math.min(idx * 0.04, 0.35),
              }}
              onClick={(e) => castAsciiSpell({ x: e.clientX, y: e.clientY, intensity: 0.8 })}
            >
              <SeatDirectoryCard seat={seat} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
