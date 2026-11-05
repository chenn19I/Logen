"use client";

import React, { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CornerDownLeft, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import type { Seat } from "@/lib/chain/types";
import { cn, formatDate, near, seatLabel, shortAccount } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import { SeatGlyph } from "./SeatGlyph";

function statusChip(seat: Seat) {
  if (seat.status === "listed") {
    return <Chip tone="caution" dot>Listed, withdrawals paused</Chip>;
  }
  if (seat.status === "pending") {
    return <Chip tone="caution" dot>Pending</Chip>;
  }
  if (seat.status === "cooldown") {
    return <Chip tone="caution" dot>Cooldown</Chip>;
  }
  return <Chip tone="positive" dot>Active</Chip>;
}

function ProofRows({ seat }: { seat: Seat }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-left">
      <div>
        <dt className="mono-label">Access keys</dt>
        <dd className="mt-1 flex items-center gap-1.5 font-mono text-14 text-positive">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          None
        </dd>
      </div>
      <div>
        <dt className="mono-label">Code</dt>
        <dd className="mt-1 font-mono text-14 text-paper">Pinned</dd>
      </div>
      <div>
        <dt className="mono-label">Holder since</dt>
        <dd className="mt-1 font-mono text-14 text-paper">
          {formatDate(seat.holderSinceMs, { month: "short", day: "numeric" })}
        </dd>
      </div>
      <div>
        <dt className="mono-label">Events attended</dt>
        <dd className="mt-1 font-mono text-14 text-paper tabular">
          {seat.eventsAttended}
        </dd>
      </div>
      <div className="col-span-2">
        <dt className="mono-label">Holder</dt>
        <dd className="mt-1 truncate font-mono text-14 text-paper">
          {shortAccount(seat.ownerId, 30)}
        </dd>
      </div>
    </dl>
  );
}

function FlipButton({
  flipped,
  onClick,
}: {
  flipped: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={flipped}
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-paper-muted transition-colors hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
    >
      {flipped ? "Tap to return" : "Tap to flip"}
      {flipped ? (
        <RotateCcw className="h-3 w-3" aria-hidden="true" />
      ) : (
        <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  );
}

export function SeatCard({
  seat,
  className,
  compact = false,
  defaultFlipped = false,
}: {
  seat: Seat;
  className?: string;
  compact?: boolean;
  defaultFlipped?: boolean;
}) {
  const [flipped, setFlipped] = useState(defaultFlipped);
  const reduced = useReducedMotion();
  const id = useId();
  const number = seatLabel(seat.tokenId);
  const balance = near(seat.balanceYocto, 2);
  const flip = () => setFlipped((value) => !value);
  const flipButton = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    flip();
  };

  if (compact) {
    return (
      <div
        className={cn(
          "surface-wash flex items-center gap-3 rounded border border-line p-3",
          className
        )}
      >
        <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-12 uppercase tracking-label text-paper-muted">
              Seat {number}
            </span>
            {statusChip(seat)}
          </div>
          <div className="mt-1 font-mono text-16 text-paper tabular">
            {balance} <span className="text-12 text-paper-muted">NEAR inside</span>
          </div>
        </div>
      </div>
    );
  }

  const front = (
    <div className="flex h-full flex-col justify-between p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="bracket-label">[ {number} / SEAT ]</span>
        {statusChip(seat)}
      </div>

      <div className="mt-6 flex items-start justify-between gap-4">
        <SeatGlyph tokenId={seat.tokenId} innerDots={seat.innerDots} size={92} ping />
        <div className="text-right">
          <div className="mono-label">Seat</div>
          <div className="font-mono text-40 leading-none text-paper tabular">{number}</div>
          <div className="mt-2 font-mono text-12 uppercase tracking-label text-paper-muted">
            Logen club
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="mono-label">Inside this seat</div>
            <div className="mt-1 font-mono text-24 leading-none text-paper tabular">
              {balance}
              <span className="ml-1 text-12 uppercase tracking-label text-paper-muted">
                NEAR
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-positive">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Keyless
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-paper-muted">
        <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-label">
          <KeyRound className="h-3 w-3" aria-hidden="true" />
          No keys. Ever.
        </span>
        <FlipButton flipped={flipped} onClick={flipButton} />
      </div>
    </div>
  );

  const back = (
    <div className="flex h-full flex-col justify-between p-5 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className="bracket-label">[ {number} / PROOF ]</span>
          <Chip tone="positive" icon={<Check className="h-3 w-3" aria-hidden="true" />}>
            Keyless
          </Chip>
        </div>
        <h3 className="mt-5 text-24 font-semibold text-paper">This seat has no keys.</h3>
        <p className="mt-2 max-w-[34ch] text-14 leading-relaxed text-paper-muted">
          Only the club contract can move its money, and only for the current holder.
        </p>
      </div>

      <div className="mt-6 border-y border-line py-4">
        <ProofRows seat={seat} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-paper-muted">
        <span className="font-mono uppercase tracking-label">Proof is one tap away</span>
        <FlipButton flipped={flipped} onClick={flipButton} />
      </div>
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      <div
        className="group relative block w-full cursor-pointer rounded border border-line bg-surface text-left transition-colors duration-200 ease-calm hover:border-line-strong"
        onClick={flip}
        style={{ perspective: 1200 }}
        data-seat-card={id}
      >
        <div className="surface-wash relative aspect-[1.62/1] w-full overflow-hidden rounded">
          {reduced ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={flipped ? "back" : "front"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute inset-0"
              >
                {flipped ? back : front}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.div
              className="absolute inset-0"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden" }}
                aria-hidden={flipped}
              >
                {front}
              </div>
              <div
                className="absolute inset-0"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                aria-hidden={!flipped}
              >
                {back}
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {flipped ? "Showing proof side." : "Showing wallet side."}
      </div>
    </div>
  );
}
