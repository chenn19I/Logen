import React from "react";

export function KawungPatternBg({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#06080D] ${className}`}
      aria-hidden="true"
    >
      {/* Top Radial Light Bias (#0D1526 + subtle Jade Pusaka aura) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 55% at 50% -8%, #0D1526 0%, rgba(13, 21, 38, 0.55) 48%, #06080D 100%)",
        }}
      />
      <div
        className="absolute -top-40 left-1/2 h-[420px] w-[780px] -translate-x-1/2 rounded-full blur-[130px]"
        style={{ background: "rgba(0, 236, 151, 0.06)" }}
      />

      {/* Subtle Cryptographic Micro-Grid */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="pusaka-relic-grid"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 56 0 L 0 0 0 56"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.6"
            />
            <circle cx="0" cy="0" r="1.1" fill="#00EC97" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pusaka-relic-grid)" />
      </svg>

      {/* Tactile 2% Noise Texture Overlay */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
        <filter id="pusaka-void-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.82"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#pusaka-void-noise)" />
      </svg>
    </div>
  );
}

export function KratonDivider({ label }: { label?: string }) {
  return (
    <div className="my-10 flex items-center gap-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-[#00EC97]/40" />
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0B0F1A]/90 px-3.5 py-1 text-[#00EC97] backdrop-blur-xl">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00EC97] shadow-[0_0_8px_rgba(0,236,151,0.8)]" />
        {label && (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
            {label}
          </span>
        )}
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-[#00EC97]/40" />
    </div>
  );
}

export function DefaultSeatSvgCard({
  tokenId,
  ownerId,
  rotationSeq,
  status,
  balanceNear,
}: {
  tokenId: string;
  ownerId: string;
  rotationSeq: number;
  status: "Active" | "Frozen" | "Idle" | "Listed";
  balanceNear: string;
}) {
  const isFrozen = status === "Frozen" || status === "Listed";
  const accent = isFrozen ? "#F59E0B" : "#00EC97";
  return (
    <svg
      viewBox="0 0 400 250"
      className="h-full w-full rounded-xl border border-white/10 bg-[#06080D] shadow-inner"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="relicCardBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0B0F1A" />
          <stop offset="55%" stopColor="#0D1526" />
          <stop offset="100%" stopColor="#06080D" />
        </linearGradient>
        <linearGradient id="relicEdge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="50%" stopColor={accent} />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" rx="14" fill="url(#relicCardBg)" />
      <rect
        x="10"
        y="10"
        width="380"
        height="230"
        rx="10"
        fill="none"
        stroke="url(#relicEdge)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />
      {/* Geometric Cryptographic Seal */}
      <g transform="translate(332, 125)" opacity="0.2">
        <polygon
          points="0,-64 55,-32 55,32 0,64 -55,32 -55,-32"
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
        />
        <polygon
          points="0,-42 36,-21 36,21 0,42 -36,21 -36,-21"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.8"
        />
        <circle cx="0" cy="0" r="14" fill="none" stroke={accent} strokeWidth="1.2" />
      </g>
      <text
        x="26"
        y="38"
        fill={accent}
        fontSize="10"
        fontFamily="monospace"
        letterSpacing="2"
      >
        PUSAKA · KEYLESS VAULT RELIC
      </text>
      <text
        x="26"
        y="70"
        fill="#FFFFFF"
        fontSize="19"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {tokenId}
      </text>
      <rect
        x="26"
        y="88"
        width={isFrozen ? "148" : "146"}
        height="24"
        rx="12"
        fill={isFrozen ? "rgba(245,158,11,0.16)" : "rgba(16,185,129,0.16)"}
        stroke={isFrozen ? "#F59E0B" : "#10B981"}
        strokeWidth="1"
      />
      <text
        x="38"
        y="104"
        fill={isFrozen ? "#FBBF24" : "#00EC97"}
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {isFrozen ? "FROZEN · SAFE SALE" : "IDLE · 0 ACCESS KEYS"}
      </text>
      <text x="26" y="148" fill="#94A3B8" fontSize="10" fontFamily="monospace">
        CANONICAL OWNER · ROTATION_SEQ #{rotationSeq}
      </text>
      <text x="26" y="168" fill="#F8FAFC" fontSize="13" fontFamily="monospace">
        {ownerId}
      </text>
      <text x="26" y="202" fill="#94A3B8" fontSize="10" fontFamily="monospace">
        VAULT LIQUID BALANCE
      </text>
      <text
        x="26"
        y="224"
        fill={accent}
        fontSize="17"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {balanceNear} NEAR
      </text>
    </svg>
  );
}
