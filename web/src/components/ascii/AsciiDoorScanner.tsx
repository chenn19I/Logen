"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Interactive ASCII telemetry scanner used on the Lounge & Attack Lab pages.
 * Renders a live deterministic ASCII wave / radar matrix that reacts to state.
 */
export function AsciiStageVisualizer({
  state = "open",
  seatLabel = "07",
  className,
}: {
  state?: "open" | "closed" | "locked";
  seatLabel?: string;
  className?: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const id = window.setInterval(() => {
      setTick((t) => (t + 1) % 64);
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  const rows = 5;
  const cols = 32;
  const chars = state === "open" ? "·:+=*#▣◈" : state === "locked" ? "·×!#⚠" : "·:+-=";

  const gridLines: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    for (let c = 0; c < cols; c += 1) {
      const wave =
        Math.sin((c * 0.35) + tick * 0.45 + r * 0.8) *
        Math.cos((r * 0.6) - tick * 0.25);
      const norm = (wave + 1) / 2;
      const idx = Math.min(chars.length - 1, Math.floor(norm * chars.length));
      line += chars[idx];
    }
    gridLines.push(line);
  }

  const toneClass =
    state === "open"
      ? "text-positive"
      : state === "locked"
        ? "text-caution"
        : "text-signal";

  return (
    <div
      className={cn(
        "overflow-hidden rounded border border-line bg-ink-deep px-3.5 py-2.5 font-mono",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5 text-[9px] uppercase tracking-label text-paper-muted">
        <span>
          [ NEP-413 GATE RADAR · SEAT {seatLabel} ]
        </span>
        <span className={toneClass}>
          {state === "open"
            ? "● VERIFIED"
            : state === "locked"
              ? "▲ ROTATED OUT"
              : "○ STANDBY"}
        </span>
      </div>
      <pre
        className={cn(
          "mt-2 select-none overflow-hidden text-center text-[10px] leading-[1.25] tracking-[0.18em] opacity-85",
          toneClass
        )}
      >
        {gridLines.join("\n")}
      </pre>
    </div>
  );
}
