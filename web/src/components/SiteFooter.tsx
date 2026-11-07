"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { useSound } from "@/lib/sound";

const clubLinks = [
  { href: "/mint", label: "Mint a seat" },
  { href: "/seats", label: "Seat roll" },
  { href: "/market", label: "Market" },
  { href: "/lounge", label: "Lounge" },
];

const systemLinks = [
  { href: "/verify", label: "Verify" },
  { href: "/lab", label: "Attack Lab" },
  { href: "/events", label: "Events" },
  { href: "/treasury", label: "Treasury" },
  { href: "/kit", label: "Brand Kit" },
];

export function SiteFooter() {
  const [atmosphere, setAtmosphere] = useState<"cobalt" | "obsidian">("cobalt");
  const { playTactileClick } = useSound();
  const isCobalt = atmosphere === "cobalt";

  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink-deep">
      {/* Atmospheric Stippled Horizon Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[280px] overflow-hidden transition-opacity duration-500"
      >
        <div
          className="absolute inset-x-0 bottom-[-120px] mx-auto h-[300px] w-[92%] max-w-[1140px] rounded-full blur-3xl transition-all duration-700"
          style={{
            background: isCobalt
              ? "radial-gradient(ellipse at center, rgba(34, 102, 255, 0.32) 0%, rgba(18, 58, 170, 0.12) 48%, rgba(12, 12, 11, 0) 76%)"
              : "radial-gradient(ellipse at center, rgba(232, 90, 42, 0.22) 0%, rgba(236, 232, 216, 0.06) 46%, rgba(12, 12, 11, 0) 75%)",
          }}
        />
        <svg
          viewBox="0 0 1200 260"
          fill="none"
          className="absolute inset-x-0 bottom-0 h-full w-full opacity-45"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="logen-footer-stipple"
              x="0"
              y="0"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="2"
                cy="2"
                r="1"
                fill={isCobalt ? "#6CA0FF" : "#ECE8D8"}
                fillOpacity="0.32"
              />
              <circle
                cx="8"
                cy="8"
                r="0.75"
                fill={isCobalt ? "#3A74FF" : "#E85A2A"}
                fillOpacity="0.24"
              />
            </pattern>
          </defs>
          <path
            d="M0 260 L0 165 Q600 42 1200 165 L1200 260 Z"
            fill="url(#logen-footer-stipple)"
          />
          <path
            d="M0 165 Q600 42 1200 165"
            stroke={isCobalt ? "rgba(108, 160, 255, 0.45)" : "rgba(232, 90, 42, 0.38)"}
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        </svg>
      </div>

      <div className="relative mx-auto w-full max-w-page px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true">
                <SeatGlyph tokenId="logen-club-footer" innerDots={6} size={32} />
              </span>
              <span className="font-display text-14 font-semibold uppercase tracking-[0.12em] text-paper">
                Logen
              </span>
            </div>
            <p className="mt-4 max-w-[38ch] text-14 leading-relaxed text-paper-muted">
              A seat is a portrait and a wallet on NEAR. Sell the seat and the
              wallet goes with it.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-positive">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              No keys. Ever.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 font-mono text-[10px] uppercase tracking-label">
            <div>
              <div className="text-paper-muted">Club</div>
              <ul className="mt-3 space-y-2">
                {clubLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-paper-dim transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-paper-muted">System</div>
              <ul className="mt-3 space-y-2">
                {systemLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-paper-dim transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-label text-paper-muted">
          <span>© 2026 Logen · NEAR Track 10</span>
          <button
            type="button"
            onClick={() => {
              playTactileClick();
              setAtmosphere((prev) => (prev === "cobalt" ? "obsidian" : "cobalt"));
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[9px] text-paper-dim transition-colors hover:border-line-strong hover:text-paper"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isCobalt ? "bg-[#6CA0FF]" : "bg-signal"
              }`}
              aria-hidden="true"
            />
            {isCobalt ? "Cobalt glow" : "Obsidian glow"}
          </button>
        </div>
      </div>
    </footer>
  );
}
