"use client";

import React, { useRef, useState } from "react";
import { Eye, ScanLine } from "lucide-react";
import { LogenMascot } from "@/components/brand/LogenMascot";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { playScanPulse, playTactileClick } from "@/lib/sound";
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
 * 3D perspective tilt, live CAD yaw/pitch telemetry, and an interactive
 * X-Ray Vault Inspection mode ("What's inside the seat").
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
  const [tilt, setTilt] = useState({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 30,
    active: false,
  });
  const [xray, setXray] = useState(false);

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

  const toggleXray = () => {
    const next = !xray;
    setXray(next);
    if (next) playScanPulse();
    else playTactileClick();
  };

  const yawStr = String(Math.round(Math.abs(tilt.ry * 10))).padStart(3, "0");
  const pitchStr = String(Math.round(45 + tilt.rx * 2)).padStart(2, "0");

  return (
    <div
      className={cn("w-full", className)}
      style={{ perspective: "1100px" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-label text-paper-muted">
        <div className="flex items-center gap-2">
          <span>Member pass / {seatNumber}</span>
          <span className="hidden text-paper-muted/60 sm:inline">
            · YAW {yawStr} / PITCH {pitchStr}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleXray}
            aria-pressed={xray}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[8px] uppercase tracking-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
              xray
                ? "border-signal bg-signal-soft text-signal-strong"
                : "border-line bg-surface-sunken text-paper-dim hover:border-line-strong hover:text-paper"
            )}
          >
            {xray ? (
              <>
                <Eye className="h-2.5 w-2.5 text-signal" aria-hidden="true" />
                Portrait view
              </>
            ) : (
              <>
                <ScanLine className="h-2.5 w-2.5 text-signal" aria-hidden="true" />
                X-Ray vault
              </>
            )}
          </button>
          <span className="inline-flex items-center gap-1.5 text-positive">
            <span className="h-1 w-1 rounded-full bg-positive" aria-hidden="true" />
            Live
          </span>
        </div>
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
        <div
          className={cn(
            "transition-all duration-300",
            xray ? "scale-[0.98] opacity-25 saturate-0" : "opacity-100"
          )}
        >
          <LogenMascot
            size={430}
            aspectRatio="4 / 5"
            priority
            caption={null}
            className="w-full !rounded-none !border-0"
            imageClassName="object-cover object-[50%_44%]"
          />
        </div>

        {/* Subtle interactive specular sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: tilt.active || xray ? 1 : 0,
            background: `radial-gradient(290px circle at ${tilt.gx}% ${tilt.gy}%, rgba(77, 232, 255, ${
              xray ? "0.22" : "0.14"
            }), rgba(236, 232, 216, 0.04) 45%, transparent 72%)`,
          }}
        />

        {/* X-Ray Vault Internal Anatomy Overlay (Bardhyl "What's In My Bag" + NORRVIK LiDAR) */}
        {xray ? (
          <div
            className="absolute inset-0 z-10 flex flex-col justify-between bg-[radial-gradient(circle_at_50%_42%,rgba(59,155,255,0.12),rgba(5,7,13,0.86)_78%)] p-4"
            aria-label="X-Ray internal seat vault anatomy"
          >
            {/* Blueprint grid & diagonal LiDAR scan beam */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(77,232,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(77,232,255,0.06)_1px,transparent_1px)] bg-[size:24px_24px]"
            />

            <div className="relative z-10 mt-11 space-y-2.5">
              <div className="flex items-center justify-between border-b border-[rgba(77,232,255,0.24)] pb-1.5 font-mono text-[8px] uppercase tracking-label text-[#4de8ff]">
                <span>[ INTERNAL VAULT ANATOMY · SHARDED-ITEM-1.0.0 ]</span>
                <span>SCAN 100%</span>
              </div>

              <div className="grid gap-2">
                <div className="rounded border border-[rgba(77,232,255,0.28)] bg-[#070d16]/90 p-2.5 font-mono">
                  <div className="flex items-center justify-between text-[8px] uppercase tracking-label text-paper-muted">
                    <span>01 / SUB-ACCOUNT IDENTITY</span>
                    <span className="text-positive">KEYS: [] (0)</span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-paper">
                    {tokenId}
                  </div>
                  <div className="mt-0.5 text-[9px] text-paper-muted">
                    Created via atomic batch without AddKey (Invariant K1)
                  </div>
                </div>

                <div className="rounded border border-[rgba(77,232,255,0.28)] bg-[#070d16]/90 p-2.5 font-mono">
                  <div className="flex items-center justify-between text-[8px] uppercase tracking-label text-paper-muted">
                    <span>02 / PINNED VAULT WASM</span>
                    <span className="text-[#4de8ff]">IMMUTABLE</span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-paper-dim">
                    4MMm6JjN8YiGcx11EJoNejVZGeZEpeGXU4Ak32FhZUk3
                  </div>
                  <div className="mt-0.5 text-[9px] text-paper-muted">
                    Parent registry sealed · zero upgrade authority (K7)
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-[rgba(123,216,143,0.3)] bg-[#07130d]/90 p-2.5 font-mono">
                    <div className="text-[8px] uppercase tracking-label text-paper-muted">
                      03 / INSIDE BALANCE
                    </div>
                    <div className="mt-1 text-[14px] font-semibold text-positive tabular">
                      {balance} NEAR
                    </div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-label text-paper-muted">
                      0.05 N storage reserve
                    </div>
                  </div>

                  <div className="rounded border border-[rgba(77,232,255,0.28)] bg-[#070d16]/90 p-2.5 font-mono">
                    <div className="text-[8px] uppercase tracking-label text-paper-muted">
                      04 / ROTATION EPOCH
                    </div>
                    <div className="mt-1 text-[14px] font-semibold text-signal tabular">
                      seq = 0
                    </div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-label text-paper-muted">
                      Moves in 1 receipt
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mb-20 flex items-center justify-between rounded border border-line bg-[#06090f]/90 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-label text-paper-muted">
              <span>PAIR CHECK: REGISTRY == VAULT</span>
              <span className="text-positive">VERIFIED T0–T3</span>
            </div>
          </div>
        ) : null}

        <span
          className="pointer-events-none absolute left-2 top-2 z-20 h-3 w-3 border-l border-t border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute right-2 top-2 z-20 h-3 w-3 border-r border-t border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-2 left-2 z-20 h-3 w-3 border-b border-l border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute bottom-2 right-2 z-20 h-3 w-3 border-b border-r border-[rgba(236,232,216,0.3)]"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4">
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

        <div className="absolute inset-x-0 bottom-0 z-20 p-4">
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
            <span className="text-paper-muted">
              {xray ? "X-Ray inspection active" : "Keeper of the seat"}
            </span>
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
