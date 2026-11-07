"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EXPLORER_URL } from "@/lib/near/rpc";
import type { ProofRow, ProofSnapshot } from "@/lib/chain/types";
import { cn, formatTime } from "@/lib/utils";

function RowIcon({ row }: { row: ProofRow }) {
  if (row.status === "ok") {
    return (
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[rgba(123,216,143,0.4)] bg-positive-soft text-positive">
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[rgba(230,180,80,0.4)] bg-caution-soft text-caution">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

export function VerifyDrawer({
  open,
  onOpenChange,
  proof,
  loading = false,
  onRecheck,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proof?: ProofSnapshot | null;
  loading?: boolean;
  onRecheck: () => Promise<void>;
}) {
  const [checkingRow, setCheckingRow] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const warnings =
    proof?.rows.filter((row) => row.status === "warn").length ?? 0;

  const recheck = async (rowId?: string) => {
    if (rowId) setCheckingRow(rowId);
    else setCheckingAll(true);
    setAnnouncement(rowId ? "Re-checking this row." : "Re-checking every row.");
    try {
      await onRecheck();
      setAnnouncement(
        rowId ? "Row checked against the chain." : "All five rows checked against the chain."
      );
    } catch {
      setAnnouncement("The check did not complete. Nothing changed.");
    } finally {
      setCheckingRow(null);
      setCheckingAll(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Proof"
      description="Five checks, read again from the chain. No keys, ever."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href={
              proof?.seatId
                ? `${EXPLORER_URL}/address/${proof.seatId}`
                : EXPLORER_URL
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-12 text-paper-muted underline decoration-line underline-offset-4 hover:text-paper"
          >
            Open explorer
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => recheck()}
            loading={checkingAll}
          >
            Re-check all
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-12 text-paper-muted">{proof?.seatId}</span>
          {proof ? (
            <Chip tone={warnings === 0 ? "positive" : "caution"} dot>
              {warnings === 0
                ? "All checks pass"
                : `${warnings} warning${warnings === 1 ? "" : "s"}`}
            </Chip>
          ) : null}
        </div>

        <p className="text-14 leading-relaxed text-paper-dim">
          This seat has no keys. Only the club contract can move its money, and only
          for the current holder.
        </p>

        <div className="divide-y divide-line border-y border-line">
          {loading && !proof
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex gap-3 py-4">
                  <div className="h-5 w-5 animate-skeleton rounded border border-line" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 animate-skeleton rounded bg-line" />
                    <div className="h-4 w-40 animate-skeleton rounded bg-line" />
                  </div>
                </div>
              ))
            : proof?.rows.map((row) => (
                <div key={row.id} className="flex items-start gap-3 py-4">
                  <RowIcon row={row} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="mono-label">{row.label}</span>
                      <button
                        type="button"
                        onClick={() => recheck(row.id)}
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
                      className={cn(
                        "mt-1 break-all font-mono text-14",
                        row.status === "warn" ? "text-caution" : "text-paper"
                      )}
                    >
                      {row.value}
                    </div>
                    <p className="mt-1 break-words text-12 leading-relaxed text-paper-muted">
                      {row.detail}
                    </p>
                  </div>
                </div>
              ))}
        </div>

        {proof ? (
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-label text-paper-muted">
            <span>Block {proof.blockHeight?.toLocaleString("en-US") ?? "—"}</span>
            <span>Checked {formatTime(proof.checkedAtMs)}</span>
          </div>
        ) : null}

        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>
    </Sheet>
  );
}
