import React from "react";

export function KawungPatternBg({ className = "opacity-[0.04]" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="pusaka-kawung"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="#D4A64A"
              strokeWidth="0.75"
            />
            <path
              d="M32 2 C46 16, 46 48, 32 62 C18 48, 18 16, 32 2 Z"
              fill="none"
              stroke="#D4A64A"
              strokeWidth="0.75"
            />
            <path
              d="M2 32 C16 18, 48 18, 62 32 C48 46, 16 46, 2 32 Z"
              fill="none"
              stroke="#D4A64A"
              strokeWidth="0.75"
            />
            <circle cx="32" cy="32" r="3" fill="#D4A64A" />
            <circle cx="0" cy="0" r="2" fill="#D4A64A" />
            <circle cx="64" cy="0" r="2" fill="#D4A64A" />
            <circle cx="0" cy="64" r="2" fill="#D4A64A" />
            <circle cx="64" cy="64" r="2" fill="#D4A64A" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pusaka-kawung)" />
      </svg>
    </div>
  );
}

export function KratonDivider({ label }: { label?: string }) {
  return (
    <div className="my-8 flex items-center gap-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/35 to-gold-500/60" />
      <div className="flex items-center gap-2 text-gold-400">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="rgba(212,166,74,0.18)"
          />
        </svg>
        {label && (
          <span className="font-serif text-xs uppercase tracking-[0.25em] text-gold-300/90">
            {label}
          </span>
        )}
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="rgba(212,166,74,0.18)"
          />
        </svg>
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/35 to-gold-500/60" />
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
  return (
    <svg
      viewBox="0 0 400 250"
      className="h-full w-full rounded-xl border border-gold-500/30 bg-obsidian-950 shadow-inner"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="kratonCardBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#090B14" />
          <stop offset="55%" stopColor="#101424" />
          <stop offset="100%" stopColor="#1B160C" />
        </linearGradient>
        <linearGradient id="goldAccent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D4A64A" />
          <stop offset="50%" stopColor="#F3C969" />
          <stop offset="100%" stopColor="#A87E2B" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" rx="12" fill="url(#kratonCardBg)" />
      <rect
        x="10"
        y="10"
        width="380"
        height="230"
        rx="8"
        fill="none"
        stroke="url(#goldAccent)"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <circle
        cx="340"
        cy="125"
        r="75"
        fill="none"
        stroke="#D4A64A"
        strokeOpacity="0.12"
        strokeWidth="1"
      />
      <path
        d="M340 50 C375 85, 375 165, 340 200 C305 165, 305 85, 340 50 Z"
        fill="none"
        stroke="#D4A64A"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <path
        d="M265 125 C300 90, 380 90, 415 125 C380 160, 300 160, 265 125 Z"
        fill="none"
        stroke="#D4A64A"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <text
        x="26"
        y="40"
        fill="#F3C969"
        fontSize="11"
        fontFamily="monospace"
        letterSpacing="2"
      >
        PUSAKA · SHARDED SEAT VAULT
      </text>
      <text
        x="26"
        y="74"
        fill="#FFFFFF"
        fontSize="20"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {tokenId}
      </text>
      <rect
        x="26"
        y="92"
        width={isFrozen ? "132" : "138"}
        height="24"
        rx="12"
        fill={isFrozen ? "rgba(244,63,94,0.18)" : "rgba(16,185,129,0.18)"}
        stroke={isFrozen ? "#F43F5E" : "#10B981"}
        strokeWidth="1"
      />
      <text
        x="38"
        y="108"
        fill={isFrozen ? "#FB7185" : "#34D399"}
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {isFrozen ? "FROZEN · LISTED" : "ACTIVE · 0 KEYS"}
      </text>
      <text x="26" y="152" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">
        CANONICAL OWNER (SEQ #{rotationSeq})
      </text>
      <text x="26" y="170" fill="#E2E8F0" fontSize="13" fontFamily="monospace">
        {ownerId}
      </text>
      <text x="26" y="204" fill="#94A3B8" fontSize="10" fontFamily="sans-serif">
        VAULT BALANCE
      </text>
      <text
        x="26"
        y="224"
        fill="#F3C969"
        fontSize="16"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {balanceNear} NEAR
      </text>
    </svg>
  );
}
