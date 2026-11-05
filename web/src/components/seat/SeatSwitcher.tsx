"use client";

import React from "react";
import type { Seat } from "@/lib/chain/types";
import { cn, near, seatLabel } from "@/lib/utils";
import { SeatGlyph } from "./SeatGlyph";

export function SeatSwitcher({
  seats,
  selectedId,
  onSelect,
}: {
  seats: Seat[];
  selectedId: string;
  onSelect: (seat: Seat) => void;
}) {
  if (seats.length < 2) return null;
  return (
    <div>
      <div className="mono-label mb-2">Your seats</div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Your seats">
        {seats.map((seat) => {
          const active = seat.tokenId === selectedId;
          return (
            <button
              key={seat.tokenId}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(seat)}
              className={cn(
                "flex min-w-[180px] shrink-0 items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors duration-120 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
                active
                  ? "border-signal bg-signal-soft"
                  : "border-line bg-surface hover:border-line-strong"
              )}
            >
              <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={28} />
              <span className="min-w-0">
                <span className="block font-mono text-12 uppercase tracking-label text-paper-muted">
                  Seat {seatLabel(seat.tokenId)}
                </span>
                <span className="block font-mono text-14 text-paper tabular">
                  {near(seat.balanceYocto, 2)} NEAR
                </span>
              </span>
              {active ? (
                <span className="ml-auto font-mono text-[9px] uppercase tracking-label text-signal-strong">
                  Here
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
