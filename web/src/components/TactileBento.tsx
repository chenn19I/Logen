"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Lock, ShieldCheck, Sparkles, Snowflake, Eye } from "lucide-react";

export const SPRING_RELIC = {
  type: "spring" as const,
  stiffness: 380,
  damping: 30,
};

export interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "jade" | "frozen" | "blocked";
  hoverLift?: boolean;
  onClick?: () => void;
}

export function BentoCard({
  children,
  className = "",
  variant = "default",
  hoverLift = false,
  onClick,
}: BentoCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  const spotlightColor =
    variant === "frozen"
      ? "rgba(245, 158, 11, 0.22)"
      : variant === "blocked"
      ? "rgba(239, 68, 68, 0.22)"
      : "rgba(0, 236, 151, 0.2)";

  const innerGlowColor =
    variant === "frozen"
      ? "rgba(245, 158, 11, 0.07)"
      : variant === "blocked"
      ? "rgba(239, 68, 68, 0.07)"
      : "rgba(0, 236, 151, 0.06)";

  const borderSpotlight = useMotionTemplate`radial-gradient(320px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 75%)`;
  const surfaceGlow = useMotionTemplate`radial-gradient(420px circle at ${mouseX}px ${mouseY}px, ${innerGlowColor}, transparent 80%)`;

  const baseBorder =
    variant === "frozen"
      ? "frozen-glass shadow-frozen"
      : variant === "blocked"
      ? "bg-[#0B0F1A]/85 backdrop-blur-2xl border-t border-[#EF4444]/40 border-x border-b border-[#EF4444]/15"
      : variant === "jade"
      ? "bg-[#0B0F1A]/85 backdrop-blur-2xl border-t border-[#00EC97]/35 border-x border-b border-white/[0.06] shadow-jade-sm"
      : "bento-glass";

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onClick={onClick}
      whileHover={hoverLift ? { y: -3 } : undefined}
      whileTap={onClick ? { scale: 0.992 } : undefined}
      transition={SPRING_RELIC}
      className={`group relative overflow-hidden rounded-3xl ${baseBorder} ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      {/* Cursor-Tracking Spotlight Border Mask */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: borderSpotlight,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />

      {/* Cursor-Tracking Ambient Surface Glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: surfaceGlow }}
      />

      {/* Frozen Glass Crystalline Pattern when Listed */}
      {variant === "frozen" && (
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(245,158,11,0.14) 0px, rgba(245,158,11,0.14) 1px, transparent 1px, transparent 12px)",
          }}
        />
      )}

      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

export interface SeatArtifact3DProps {
  seatLabel: string;
  tokenId: string;
  ownerId: string;
  vaultBalanceNear: string;
  claimableNear: string;
  rotationSeq: number;
  status: "Idle" | "Listed" | "Active" | "Frozen";
  codeHash: string;
  isId: boolean;
  onInspectClick?: () => void;
}

export function SeatArtifact3D({
  seatLabel,
  tokenId,
  ownerId,
  vaultBalanceNear,
  claimableNear,
  rotationSeq,
  status,
  codeHash,
  isId,
  onInspectClick,
}: SeatArtifact3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [xray, setXray] = useState(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const smoothX = useSpring(rawX, SPRING_RELIC);
  const smoothY = useSpring(rawY, SPRING_RELIC);

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [9, -9]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-11, 11]);
  const glareX = useTransform(smoothX, [-0.5, 0.5], ["15%", "85%"]);
  const glareY = useTransform(smoothY, [-0.5, 0.5], ["15%", "85%"]);

  const holoSheen = useMotionTemplate`radial-gradient(360px circle at ${glareX} ${glareY}, rgba(0, 236, 151, 0.22), rgba(56, 189, 248, 0.08) 42%, transparent 72%)`;

  function handlePointerMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    rawX.set(nx);
    rawY.set(ny);
  }

  function handlePointerLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  const isFrozen = status === "Listed" || status === "Frozen";

  return (
    <div style={{ perspective: 1200 }} className="w-full select-none">
      <motion.div
        ref={cardRef}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileTap={{ scale: 0.99 }}
        transition={SPRING_RELIC}
        className={`relative overflow-hidden rounded-[28px] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.75)] ${
          isFrozen
            ? "frozen-glass"
            : "bg-gradient-to-br from-[#101829]/95 via-[#0B0F1A]/95 to-[#06080D]/95 backdrop-blur-2xl border-t border-white/[0.18] border-x border-b border-[#00EC97]/25"
        }`}
      >
        {/* Holographic Foil Sheen */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-90 mix-blend-screen"
          style={{ background: holoSheen }}
        />

        {/* Top Specular Hairline */}
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {/* Geometric Relic Seal Watermark */}
        <svg
          className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 opacity-[0.09]"
          viewBox="0 0 200 200"
          fill="none"
        >
          <polygon
            points="100,12 176,56 176,144 100,188 24,144 24,56"
            stroke="#00EC97"
            strokeWidth="1.5"
          />
          <polygon
            points="100,36 155,68 155,132 100,164 45,132 45,68"
            stroke="#FFFFFF"
            strokeWidth="1"
          />
          <circle cx="100" cy="100" r="26" stroke="#00EC97" strokeWidth="1.5" />
        </svg>

        <div className="relative z-10 space-y-5">
          {/* Card Header: Relic Identity & Status Pill */}
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#00EC97]" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00EC97]">
                  {seatLabel}
                </span>
              </div>
              <h3 className="mt-1 font-mono text-lg font-bold tracking-tight text-white">
                {tokenId}
              </h3>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                isFrozen
                  ? "border border-[#F59E0B]/45 bg-[#F59E0B]/15 text-[#FBBF24]"
                  : "border border-[#10B981]/45 bg-[#10B981]/15 text-[#00EC97]"
              }`}
            >
              {isFrozen ? (
                <>
                  <Snowflake className="h-3 w-3" />
                  FROZEN · LISTED
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                  IDLE · ACTIVE
                </>
              )}
            </span>
          </div>

          {!xray ? (
            <>
              {/* 1. Actual Vault Balance + 2. Claimable Pool Share */}
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="rounded-2xl border border-white/[0.08] bg-[#06080D]/80 p-4 sm:col-span-7">
                  <span className="block text-[11px] font-medium text-slate-400">
                    {isId
                      ? "Saldo Aktual Vault (Ikut Berpindah)"
                      : "Actual Vault Balance (Moves with Seat)"}
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-bold tracking-tight text-white">
                      {vaultBalanceNear}
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#00EC97]">
                      NEAR
                    </span>
                  </div>
                  <span className="mt-1 block font-mono text-[10px] text-slate-400">
                    {isId
                      ? "Tersimpan langsung di sub-account kursi"
                      : "Held natively by seat sub-account"}
                  </span>
                </div>

                <div className="rounded-2xl border border-[#00EC97]/25 bg-[#00EC97]/[0.06] p-4 sm:col-span-5">
                  <span className="block text-[11px] font-medium text-[#5CFFB8]">
                    {isId ? "Siap Klaim (Pool 40%)" : "Claimable (40% Pool)"}
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="font-mono text-2xl font-bold text-[#00EC97]">
                      +{claimableNear}
                    </span>
                    <span className="font-mono text-xs text-[#5CFFB8]">NEAR</span>
                  </div>
                  <span className="mt-1 block font-mono text-[10px] text-slate-300">
                    {isId ? "Dari akumulator O(1)" : "Via O(1) acc"}
                  </span>
                </div>
              </div>

              {/* 3. Bukti Tanpa Kunci Badge (0 Keys + rotation_seq) */}
              <div className="rounded-2xl border border-white/[0.09] bg-[#06080D]/90 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#00EC97]/40 bg-[#00EC97]/10 text-[#00EC97]">
                      <Lock className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#00EC97]">
                        {isId
                          ? "Lencana Bukti Tanpa Kunci"
                          : "Keyless Cryptographic Proof"}
                      </span>
                      <span className="font-mono text-xs text-slate-200">
                        view_access_key_list: <strong className="text-[#00EC97]">[] (0 Keys)</strong>
                      </span>
                    </div>
                  </div>

                  <span className="rounded-lg border border-white/10 bg-[#0B0F1A] px-2.5 py-1 font-mono text-xs font-bold text-white">
                    rotation_seq: <span className="text-[#00EC97]">#{rotationSeq}</span>
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2 font-mono text-[11px] text-slate-400">
                  <span>
                    {isId ? "Pemegang Sah:" : "Canonical Owner:"}{" "}
                    <strong className="text-slate-200">{ownerId}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#10B981]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    sharded-item-1.0.0
                  </span>
                </div>
              </div>
            </>
          ) : (
            /* Cryptographic X-Ray View */
            <div className="space-y-2.5 rounded-2xl border border-[#00EC97]/30 bg-[#06080D]/95 p-4 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">spec:</span>
                <span className="text-[#00EC97]">&quot;sharded-item-1.0.0&quot;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">token_id (sub-account):</span>
                <span className="text-white">{tokenId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">view_access_key_list:</span>
                <span className="font-bold text-[#00EC97]">[] (0 Access Keys)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">rotation_seq:</span>
                <span className="text-white">#{rotationSeq}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">vault_code_hash:</span>
                <span className="truncate max-w-[180px] text-slate-300">{codeHash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">old_owner_access:</span>
                <span className="font-bold text-[#EF4444]">BLOCKED (E_NOT_OWNER)</span>
              </div>
            </div>
          )}

          {/* Footer Interactive Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setXray((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-slate-300 transition hover:border-[#00EC97]/40 hover:text-white"
            >
              <Eye className="h-3.5 w-3.5 text-[#00EC97]" />
              {xray
                ? isId
                  ? "Tampilan Artefak"
                  : "Artifact Surface"
                : isId
                ? "Mode X-Ray Kriptografi"
                : "Cryptographic X-Ray"}
            </button>

            {onInspectClick && (
              <button
                type="button"
                onClick={onInspectClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00EC97] px-3.5 py-1.5 text-xs font-bold text-[#06080D] shadow-jade-sm transition hover:brightness-110"
              >
                {isId ? "Kendali Vault →" : "Vault Controls →"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
