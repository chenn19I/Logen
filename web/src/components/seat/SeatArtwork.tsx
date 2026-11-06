import React from "react";
import type { Seat } from "@/lib/chain/types";
import { cn, seatLabel } from "@/lib/utils";

/**
 * A holder-uploaded portrait. Demo portraits live in the mock seat; live
 * portraits are read from this browser's local portrait store.
 */
export function SeatArtwork({
  seat,
  className,
  imageClassName,
  showLabel = false,
}: {
  seat: Seat;
  className?: string;
  imageClassName?: string;
  showLabel?: boolean;
}) {
  if (!seat.imageUrl) return null;
  const label = seat.name?.trim() || `Seat ${seatLabel(seat.tokenId)}`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded border border-line bg-ink-deep",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={seat.imageUrl}
        alt={`Portrait for ${label}`}
        className={cn("h-full w-full object-cover", imageClassName)}
        loading="lazy"
        decoding="async"
      />
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5"
        aria-hidden="true"
      />
      {showLabel ? (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5">
          <span className="font-mono text-[9px] uppercase tracking-label text-paper">
            {label}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-label text-[#4de8ff]">
            Portrait
          </span>
        </div>
      ) : null}
    </div>
  );
}
