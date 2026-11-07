"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { DEFAULT_REGISTRY_ID, EXPLORER_URL } from "@/lib/near/rpc";
import { useSound } from "@/lib/sound";

const clubLinks = [
  { href: "/mint", label: "Mint a seat", index: "01" },
  { href: "/seats", label: "Seat roll", index: "02" },
  { href: "/market", label: "Market", index: "03" },
  { href: "/lounge", label: "Lounge", index: "04" },
];

const systemLinks = [
  { href: "/verify", label: "Verify (5 checks)", index: "01" },
  { href: "/lab", label: "Attack Lab (A1–A12)", index: "02" },
  { href: "/events", label: "Events & Pool", index: "03" },
  { href: "/treasury", label: "Treasury", index: "04" },
  { href: "/kit", label: "Brand Kit", index: "05" },
];

export function SiteFooter() {
  const [atmosphere, setAtmosphere] = useState<"cobalt" | "obsidian">("cobalt");
  const { playTactileClick } = useSound();
  const isCobalt = atmosphere === "cobalt";

  return (
    <footer className="relative overflow-hidden border-t border-line bg-ink-deep">
      {/* Top NORRVIK + Pranav Atmosphere Bar */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-3 px-4 py-2.5 font-mono text-[10px] uppercase tracking-label sm:px-6">
          <div className="flex flex-wrap items-center gap-3 text-paper-muted">
            <span className="inline-flex items-center gap-1.5 text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
              SEALED ON NEAR TESTNET
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">SHARDED-ITEM-1.0.0</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">80,418 RECEIPT INTERLEAVINGS VERIFIED</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-paper-muted">HORIZON:</span>
            <button
              type="button"
              onClick={() => {
                playTactileClick();
                setAtmosphere("cobalt");
              }}
              aria-pressed={isCobalt}
              className={`rounded border px-2 py-0.5 transition-colors ${
                isCobalt
                  ? "border-[#4A88FF] bg-[rgba(30,94,255,0.2)] text-[#9AC0FF]"
                  : "border-line text-paper-muted hover:text-paper"
              }`}
            >
              Cobalt Glow
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick();
                setAtmosphere("obsidian");
              }}
              aria-pressed={!isCobalt}
              className={`rounded border px-2 py-0.5 transition-colors ${
                !isCobalt
                  ? "border-signal bg-[rgba(232,90,42,0.18)] text-paper"
                  : "border-line text-paper-muted hover:text-paper"
              }`}
            >
              Obsidian Ink
            </button>
          </div>
        </div>
      </div>

      {/* Atmospheric Stippled Horizon Backdrop (Ref #3 @PranavOriginals) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[310px] overflow-hidden transition-opacity duration-500"
      >
        <div
          className="absolute inset-x-0 bottom-[-120px] mx-auto h-[320px] w-[92%] max-w-[1140px] rounded-full blur-3xl transition-all duration-700"
          style={{
            background: isCobalt
              ? "radial-gradient(ellipse at center, rgba(34, 102, 255, 0.34) 0%, rgba(18, 58, 170, 0.14) 48%, rgba(12, 12, 11, 0) 76%)"
              : "radial-gradient(ellipse at center, rgba(232, 90, 42, 0.24) 0%, rgba(236, 232, 216, 0.06) 46%, rgba(12, 12, 11, 0) 75%)",
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

      {/* Monumental Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 right-4 hidden select-none font-display text-[172px] font-semibold leading-none tracking-[-0.07em] text-[rgba(236,232,216,0.03)] sm:block"
      >
        LOGEN
      </div>

      <div className="relative mx-auto w-full max-w-page px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span aria-hidden="true">
                <SeatGlyph tokenId="logen-club-footer" innerDots={6} size={36} />
              </span>
              <div>
                <div className="font-display text-16 font-semibold uppercase tracking-[0.1em] text-paper">
                  Logen
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-label text-paper-muted">
                  Keyless Seat-Account Protocol / NEAR Track 10
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-[42ch] text-14 leading-relaxed text-paper-muted">
              Every seat is an NEP-171 NFT paired 1:1 with its own keyless NEAR sub-account
              vault. Sell the seat and the money, provenance, and lounge access go with it in
              one atomic cut-off.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded border border-[rgba(123,216,143,0.3)] bg-positive-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-label text-positive">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                No keys. Ever.
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                <Sparkles className="h-3 w-3 text-signal" aria-hidden="true" />
                NEP-171 · NEP-177 · NEP-297 · NEP-413
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 font-mono text-[10px] uppercase tracking-label">
            <div>
              <div className="text-paper-muted">01 / Club</div>
              <ul className="mt-3 space-y-2.5">
                {clubLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-baseline gap-1.5 text-paper-dim transition-colors hover:text-paper"
                    >
                      <span className="text-[8px] text-paper-muted">{link.index}</span>
                      <span>{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-paper-muted">02 / System</div>
              <ul className="mt-3 space-y-2.5">
                {systemLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-baseline gap-1.5 text-paper-dim transition-colors hover:text-paper"
                    >
                      <span className="text-[8px] text-paper-muted">{link.index}</span>
                      <span>{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 3: Pinned On-Chain Artifacts (Ref #5 @ianneo_ai) */}
          <div className="rounded border border-line bg-[rgba(20,20,18,0.82)] p-4 font-mono text-[10px] backdrop-blur-sm">
            <div className="flex items-center justify-between uppercase tracking-label text-paper-muted">
              <span>03 / Pinned Testnet Artifacts</span>
              <span className="text-positive">VERIFIED</span>
            </div>
            <dl className="mt-3 space-y-2 border-t border-line pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <dt className="uppercase tracking-label text-paper-muted">Registry</dt>
                <dd>
                  <a
                    href={`${EXPLORER_URL}/address/${DEFAULT_REGISTRY_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-paper hover:text-signal"
                  >
                    {DEFAULT_REGISTRY_ID}
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="uppercase tracking-label text-paper-muted">Vault WASM</dt>
                <dd className="text-paper-dim" title="DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg">
                  DFuv6M…PLmwSg
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="uppercase tracking-label text-paper-muted">Parent Seal Tx</dt>
                <dd>
                  <a
                    href={`${EXPLORER_URL}/txns/BETN1taRa4tGaKAdKmVPq657geoQAxk2NuNvZxuEj4ek`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-positive hover:underline"
                  >
                    BETN1t…j4ek (0 keys)
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-label text-paper-muted">
          <span>© 2026 Logen · Built for NEAR Hackathon Track 10 (NFTs That Do Something)</span>
          <span>Zero FullAccess Keys · Zero FunctionCall Keys</span>
        </div>
      </div>
    </footer>
  );
}
