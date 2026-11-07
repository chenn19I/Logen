"use client";

import React, { useRef, useState } from "react";
import { LogenMascot } from "@/components/brand/LogenMascot";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { cn } from "@/lib/utils";

export interface MascotPassProps {
  className?: string;
  seatNumber?: string;
  tokenId?: string;
  balance?: string;
  holderLabel?: string;
  innerDots?: number;
}

/**
 * The seat pass: the mascot framed as a physical club credential with subtle
 * 3D perspective tilt and live seat readout.
 */
export function MascotPass({
  className,
  seatNumber = "07",
  tokenId = "s007.logen.testnet",
  balance = "3.20",
  holderLabel = "Keeper 07",
  innerDots = 7,
}: MascotPassProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 30, active: false });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width; // 0..1
    const ny = (e.clientY - rect.top) / rect.height; // 0..1
    const ry = (nx - 0.5) * 9;
    const rx = (0.5 - ny) * 8;
    setTilt({
      rx,
      ry,
      gx: Math.round(nx * 100),
      gy: Math.round(ny * 100),
      active: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 30, active: false });
  };

  return (
    <div
      className={cn("w-full", className)}
      style={{ perspective: "1100px" }}
    >
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-label text-paper-muted">
        <span>Member pass / {seatNumber}</span>
        <span className="inline-flex items-center gap-1.5 text-positive">
          <span className="h-1 w-1 rounded-full bg-positive" aria-hidden="true" />
          Live on testnet
        </span>
      </div>

      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: tilt.active
            ? `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg) translateZ(0)`
            : "rotateX(0deg) rotateY(0deg) translateZ(0)",
          transition: tilt.active
            ? "transform 90ms ease-out"
            : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className="relative mt-2 overflow-hidden rounded border border-line bg-[#05070d] will-change-transform"
      >
        <LogenMascot
          size={430}
          aspectRatio="4 / 5"
          priority
          caption={null}
          className="w-full !rounded-none !border-0"
          imageClassName="object-cover object-[50%_44%]"
        />

        {/* Subtle interactive specular sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(280px circle at ${tilt.gx}% ${tilt.gy}%, rgba(77, 232, 255, 0.14), rgba(236, 232, 216, 0.04) 45%, transparent 72%)`,
          }}
        />

        <span
          className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
          <div>
            <div className="font-display text-[13px] font-semibold uppercase leading-none tracking-[0.18em] text-paper">
              Logen
            </div>
            <div className="mt-1.5 font-mono text-[8px] uppercase tracking-label text-paper-muted">
              {tokenId}
            </div>
          </div>
          <div className="text-right font-mono text-[8px] uppercase leading-relaxed tracking-label text-paper-muted">
            <div className="text-[#4de8ff]">{holderLabel}</div>
            <div>0 Access Keys</div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <span aria-hidden="true">
                <SeatGlyph tokenId={tokenId} innerDots={innerDots} size={38} />
              </span>
              <div>
                <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
                  Seat no.
                </div>
                <div className="mt-1 font-mono text-[52px] leading-[0.72] tracking-[-0.05em] text-paper tabular transition-all duration-150">
                  {seatNumber}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
                Inside
              </div>
              <div className="mt-1 font-mono text-[20px] leading-none text-positive tabular transition-all duration-150">
                {balance}
              </div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-label text-paper-muted">
                NEAR / 0 keys
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[rgba(236,232,216,0.18)] pt-2.5 font-mono text-[8px] uppercase tracking-label">
            <span className="text-paper-muted">Keeper of the seat</span>
            <span className="text-[#4de8ff]">No keys, ever</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-x border-b border-line bg-line">
        <div className="bg-ink px-2.5 py-2.5">
          <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
            Network
          </div>
          <div className="mt-1 font-mono text-[10px] text-paper">NEAR Testnet</div>
        </div>
        <div className="bg-ink px-2.5 py-2.5">
          <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
            Wallet
          </div>
          <div className="mt-1 font-mono text-[10px] text-positive">Keyless</div>
        </div>
        <div className="bg-ink px-2.5 py-2.5">
          <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
            Access
          </div>
          <div className="mt-1 font-mono text-[10px] text-paper">Holder</div>
        </div>
      </div>
    </div>
  );
}
