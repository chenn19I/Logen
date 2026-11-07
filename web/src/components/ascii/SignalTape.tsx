"use client";

import React from "react";
import { cn } from "@/lib/utils";

const DEFAULT_SIGNALS = [
  "SELL THE SEAT · THE WALLET GOES WITH IT",
  "KEYLESS NEAR SUB-ACCOUNT VAULTS (0 KEYS)",
  "O(1) TICKET REVENUE SPLIT · 40% POOL / 50% KAS / 10% ORGANIZER",
  "NEP-413 ZERO-GAS LOUNGE CHALLENGE GATE",
  "12 / 12 THREAT VECTORS BLOCKED ON-CHAIN",
  "DYNAMIC NEP-171 SEAT PASSES",
];

export function SignalTape({
  items = DEFAULT_SIGNALS,
  className,
  tone = "default",
}: {
  items?: string[];
  className?: string;
  tone?: "default" | "accent" | "positive";
}) {
  const starColor =
    tone === "positive"
      ? "text-positive"
      : tone === "accent"
        ? "text-signal"
        : "text-signal";

  return (
    <div
      className={cn(
        "signal-tape group relative overflow-hidden rounded border border-line bg-surface-sunken py-2 select-none",
        className
      )}
      aria-hidden="true"
    >
      <div className="signal-tape-track flex w-max items-center font-mono text-[10px] uppercase tracking-label text-paper-dim">
        {[0, 1].map((groupIndex) => (
          <span key={groupIndex} className="flex shrink-0 items-center">
            {[0, 1].map((unitIndex) => (
              <span key={unitIndex} className="flex shrink-0 items-center">
                {items.map((text, itemIndex) => (
                  <React.Fragment key={`${groupIndex}-${unitIndex}-${itemIndex}`}>
                    <span className="px-3 transition-colors group-hover:text-paper">
                      {text}
                    </span>
                    <i className={cn("not-italic px-1", starColor)}>✳</i>
                  </React.Fragment>
                ))}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
