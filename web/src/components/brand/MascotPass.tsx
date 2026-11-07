"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Lock, ShieldCheck, Sparkles } from "lucide-react";
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
 * Physical club pass with smooth 3D pointer tilt, animated number transitions,
 * and a clean visual X-Ray reveal (no wall of text).
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
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const ry = (nx - 0.5) * 11;
    const rx = (0.5 - ny) * 9;
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

  return (
    <div
      className={cn("w-full select-none", className)}
      style={{ perspective: "1200px" }}
    >
      <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-label text-paper-muted">
        <span>Seat {seatNumber}</span>
        <button
          type="button"
          onClick={toggleXray}
          aria-pressed={xray}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-label transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
            xray
              ? "border-signal bg-signal-soft text-paper"
              : "border-line bg-surface text-paper-muted hover:border-line-strong hover:text-paper"
          )}
        >
          <Eye className="h-2.5 w-2.5 text-signal" aria-hidden="true" />
          {xray ? "Portrait" : "Inside vault"}
        </button>
      </div>

      <div
        ref={cardRef}
        onClick={toggleXray}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: tilt.active
            ? `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`
            : "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transition: tilt.active
            ? "transform 80ms ease-out"
            : "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className="group relative mt-2 cursor-pointer overflow-hidden rounded border border-line bg-[#05070d] will-change-transform hover:border-line-strong"
      >
        <div
          className={cn(
            "transition-all duration-500 ease-out",
            xray ? "scale-105 opacity-20 blur-[2px] saturate-0" : "scale-100 opacity-100"
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

        {/* Interactive pointer spotlight sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: tilt.active || xray ? 1 : 0,
            background: `radial-gradient(300px circle at ${tilt.gx}% ${tilt.gy}%, rgba(77, 232, 255, ${
              xray ? "0.2" : "0.14"
            }), rgba(236, 232, 216, 0.04) 45%, transparent 72%)`,
          }}
        />

        {/* Visual Vault Core Overlay (minimal, animated, zero text bloat) */}
        <AnimatePresence>
          {xray ? (
            <motion.div
              key="xray-overlay"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(59,155,255,0.16),rgba(5,7,13,0.88)_75%)] p-6 text-center"
            >
              {/* Animated orbital vault ring */}
              <motion.div
                initial={{ rotate: -20, scale: 0.85 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 18 }}
                className="relative flex h-36 w-36 flex-col items-center justify-center rounded-full border border-[rgba(77,232,255,0.35)] bg-[#060c16]/90 shadow-[0_0_40px_rgba(77,232,255,0.18)]"
              >
                <span className="font-mono text-[9px] uppercase tracking-label text-paper-muted">
                  Locked inside
                </span>
                <span className="mt-1 font-mono text-32 font-semibold leading-none text-positive tabular">
                  {balance}
                </span>
                <span className="mt-1 font-mono text-[9px] uppercase tracking-label text-[#4de8ff]">
                  NEAR
                </span>
              </motion.div>

              {/* 3 minimal animated pills */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.25 }}
                className="mt-5 flex flex-wrap justify-center gap-2 font-mono text-[10px] uppercase tracking-label"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(123,216,143,0.35)] bg-[#07130d]/90 px-3 py-1 text-positive">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  0 Keys
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(77,232,255,0.3)] bg-[#070d16]/90 px-3 py-1 text-[#4de8ff]">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Pinned Code
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-3 py-1 text-paper">
                  <Sparkles className="h-3 w-3 text-signal" aria-hidden="true" />
                  1-Step Handoff
                </span>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Top header inside card */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4">
          <div>
            <div className="font-display text-[13px] font-semibold uppercase leading-none tracking-[0.18em] text-paper">
              Logen
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tokenId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16 }}
                className="mt-1.5 font-mono text-[9px] uppercase tracking-label text-paper-muted"
              >
                {tokenId}
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={holderLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="rounded-full border border-[rgba(77,232,255,0.25)] bg-[#050a14]/80 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-label text-[#4de8ff] backdrop-blur-sm"
            >
              {holderLabel}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom pass footer with spring-animated seat number & balance */}
        <div className="absolute inset-x-0 bottom-0 z-20 p-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <motion.span
                key={tokenId}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                aria-hidden="true"
              >
                <SeatGlyph tokenId={tokenId} innerDots={innerDots} size={38} />
              </motion.span>
              <div>
                <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
                  Seat
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={seatNumber}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="mt-1 font-mono text-[52px] leading-[0.72] tracking-[-0.05em] text-paper tabular"
                  >
                    {seatNumber}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[8px] uppercase tracking-label text-paper-muted">
                Inside
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={balance}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="mt-1 font-mono text-[22px] leading-none text-positive tabular"
                >
                  {balance}
                </motion.div>
              </AnimatePresence>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-label text-paper-muted">
                NEAR
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
