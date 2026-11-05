"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useProof, useSeats } from "@/lib/chain/hooks";
import type { ProofRow } from "@/lib/chain/types";
import { EXPLORER_URL } from "@/lib/near/rpc";
import { formatTime, near, seatLabel } from "@/lib/utils";
import { Button, LinkButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { VerifyDrawer } from "@/components/seat/VerifyDrawer";
import { SeatGlyph } from "@/components/seat/SeatGlyph";

function RowMark({ row }: { row: ProofRow }) {
  if (row.status === "ok") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[rgba(123,216,143,0.4)] bg-positive-soft text-positive">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[rgba(230,180,80,0.4)] bg-caution-soft text-caution">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

export default function VerifyPage() {
  const { accountId, openWalletModal } = useNear();
  const { demo, demoAccount } = useDemo();
  const currentAccount = demo ? demoAccount : accountId;
  const seatsQuery = useSeats();
  const seats = seatsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string>("");
  const seat = seats.find((item) => item.tokenId === selectedId) ?? seats[0];
  const proofQuery = useProof(seat?.tokenId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkingRow, setCheckingRow] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const recheck = async (rowId?: string) => {
    if (rowId) setCheckingRow(rowId);
    else setCheckingAll(true);
    setAnnouncement(rowId ? "Checking this row." : "Checking every row.");
    try {
      await proofQuery.refetch();
      setAnnouncement(
        rowId ? "Row checked against the chain." : "All five rows checked."
      );
    } catch {
      setAnnouncement("The check did not complete. Nothing changed.");
    } finally {
      setCheckingRow(null);
      setCheckingAll(false);
    }
  };

  if (seatsQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Reading your seat">
        <div className="h-8 w-56 animate-skeleton rounded bg-line" />
        <div className="h-96 animate-skeleton rounded border border-line bg-surface" />
      </div>
    );
  }

  if (!seat) {
    return (
      <Panel className="mx-auto max-w-prose p-8 text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-paper-muted" aria-hidden="true" />
        <h1 className="mt-4 text-24 font-semibold text-paper">
          No seat to verify.
        </h1>
        <p className="mt-2 text-14 leading-relaxed text-paper-muted">
          Connect a wallet that holds a seat, or buy one on the market.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {!currentAccount ? (
            <Button onClick={openWalletModal}>Connect wallet</Button>
          ) : null}
          <LinkButton href="/market" variant="secondary">
            Browse market
          </LinkButton>
        </div>
      </Panel>
    );
  }

  const proof = proofQuery.data;
  const warnings = proof?.rows.filter((row) => row.status === "warn").length ?? 0;
  const summaryTone = warnings > 0 ? "caution" : "positive";
  const summaryText =
    warnings > 0
      ? `${5 - warnings} pass, ${warnings} warning`
      : "All five checks pass";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/seat/${encodeURIComponent(seat.tokenId)}`}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted hover:text-paper"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            Back to seat
          </Link>
          <span className="bracket-label mt-4 block">
            [ VERIFY / SEAT {seatLabel(seat.tokenId)} ]
          </span>
          <h1 className="mt-2 text-40 font-semibold text-paper">
            Five checks. One seat.
          </h1>
          <p className="mt-2 max-w-[56ch] text-14 leading-relaxed text-paper-muted">
            Read again from the chain. No keys, no hidden owner, no swapped code.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={demo ? "neutral" : "accent"} dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDrawerOpen(true)}
          >
            Open drawer
          </Button>
        </div>
      </div>

      {seats.length > 1 ? (
        <div>
          <div className="mono-label mb-2">Choose a seat</div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {seats.map((item) => {
              const active = item.tokenId === seat.tokenId;
              return (
                <button
                  key={item.tokenId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(item.tokenId)}
                  className={`flex shrink-0 items-center gap-2 rounded border px-3 py-2 font-mono text-12 transition-colors ${
                    active
                      ? "border-signal bg-signal-soft text-paper"
                      : "border-line bg-surface text-paper-muted hover:border-line-strong"
                  }`}
                >
                  <SeatGlyph tokenId={item.tokenId} innerDots={item.innerDots} size={20} />
                  Seat {seatLabel(item.tokenId)}
                  <span className="text-positive">{near(item.balanceYocto, 2)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
        <div className="flex items-center gap-3">
          <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={28} />
          <div>
            <div className="font-mono text-12 uppercase tracking-label text-paper">
              Seat {seatLabel(seat.tokenId)}
            </div>
            <div className="mt-0.5 break-all font-mono text-[10px] uppercase tracking-label text-paper-muted">
              {seat.tokenId}
            </div>
          </div>
        </div>
        {proof ? (
          <Chip tone={summaryTone} dot>
            {summaryText}
          </Chip>
        ) : null}
      </div>

      <Panel>
        <div className="divide-y divide-line">
          {proofQuery.isLoading && !proof ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex gap-3 px-4 py-5">
                <div className="h-6 w-6 animate-skeleton rounded border border-line" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-skeleton rounded bg-line" />
                  <div className="h-4 w-48 animate-skeleton rounded bg-line" />
                  <div className="h-3 w-full max-w-[420px] animate-skeleton rounded bg-line" />
                </div>
              </div>
            ))
          ) : (
            proof?.rows.map((row, index) => (
              <div
                key={row.id}
                className="flex items-start gap-3 px-4 py-5 sm:gap-4 sm:px-5"
              >
                <RowMark row={row} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-paper-muted">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="mono-label">{row.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void recheck(row.id)}
                      disabled={checkingRow === row.id}
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted transition-colors hover:text-paper disabled:opacity-50"
                    >
                      {checkingRow === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      )}
                      Re-check
                    </button>
                  </div>
                  <div
                    className={`mt-1 break-all font-mono text-14 ${
                      row.status === "warn" ? "text-caution" : "text-paper"
                    }`}
                  >
                    {row.value}
                  </div>
                  <p className="mt-1 max-w-[68ch] text-12 leading-relaxed text-paper-muted">
                    {row.detail}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
            <span>
              Block {proof?.blockHeight?.toLocaleString("en-US") ?? "—"}
            </span>
            <span>Checked {proof ? formatTime(proof.checkedAtMs) : "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void recheck()}
              loading={checkingAll}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Re-check all
            </Button>
            <a
              href={`${EXPLORER_URL}/address/${seat.tokenId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
            >
              Explorer
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Panel>

      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
        <p className="max-w-[64ch] text-12 leading-relaxed text-paper-muted">
          This seat has no keys. Only the club contract can move its money, and only
          for the current holder.
        </p>
      </div>

      {proofQuery.isError ? (
        <p className="flex items-center gap-2 text-12 text-danger" role="alert">
          <CircleAlert className="h-4 w-4" aria-hidden="true" />
          That did not go through. Nothing moved.
        </p>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <VerifyDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        proof={proof}
        loading={proofQuery.isLoading}
        onRecheck={async () => {
          await proofQuery.refetch();
        }}
      />
    </div>
  );
}
