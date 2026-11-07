"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LogOut,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useSeats } from "@/lib/chain/hooks";
import { useSound } from "@/lib/sound";
import { Chip } from "@/components/ui/Chip";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { SeatGlyph } from "@/components/seat/SeatGlyph";
import { cn, shortAccount } from "@/lib/utils";

const links = [
  { href: "/", label: "Wallet", idx: "01" },
  { href: "/lounge", label: "Lounge", idx: "02" },
  { href: "/market", label: "Market", idx: "03" },
  { href: "/mint", label: "Mint", idx: "04" },
  { href: "/lab", label: "Attack Lab", idx: "05" },
];

export function Navbar() {
  const pathname = usePathname();
  const {
    accountId,
    openWalletModal,
    signOutWallet,
  } = useNear();
  const { demo, toggleDemo, demoAccount, resetDemo } = useDemo();
  const { data: seats } = useSeats();
  const { soundEnabled, toggleSound, playTactileClick } = useSound();
  const primarySeat = seats?.[0];
  const effectiveAccount = demo ? demoAccount : accountId;

  const historyHref = primarySeat
    ? `/seat/${encodeURIComponent(primarySeat.tokenId)}`
    : "/market";

  const navLinks = [
    ...links,
    { href: historyHref, label: "History", idx: "06" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-page items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          onClick={() => playTactileClick()}
          className="flex min-w-0 items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          <span aria-hidden="true">
            <SeatGlyph tokenId="logen-club" innerDots={6} size={26} />
          </span>
          <span className="flex items-baseline gap-2">
            <span className="font-display text-16 font-semibold uppercase tracking-[0.06em] text-paper">
              Logen
            </span>
            <span className="hidden font-mono text-[9px] uppercase tracking-label text-paper-muted sm:inline">
              Members club
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {navLinks.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => playTactileClick()}
                className={cn(
                  "group relative flex items-baseline gap-1 py-2 font-mono text-12 uppercase tracking-label transition-colors duration-120 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
                  active ? "text-paper" : "text-paper-muted"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span>{item.label}</span>
                <sup
                  aria-hidden="true"
                  className={cn(
                    "font-mono text-[8px] tracking-normal transition-colors",
                    active
                      ? "text-signal"
                      : "text-paper-muted/60 group-hover:text-paper-dim"
                  )}
                >
                  {item.idx}
                </sup>
                {active ? (
                  <motion.span
                    layoutId="nav-active-line"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-x-0 bottom-0 h-px bg-signal"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Mute tactile UI audio" : "Enable tactile UI audio"}
            title={soundEnabled ? "Tactile audio ON" : "Tactile audio OFF"}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded border px-2 font-mono text-[9px] uppercase tracking-label transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
              soundEnabled
                ? "border-signal/60 bg-signal-soft text-signal-strong"
                : "border-line bg-surface-sunken text-paper-muted hover:border-line-strong hover:text-paper"
            )}
          >
            {soundEnabled ? (
              <Volume2 className="h-3 w-3 text-signal" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3 w-3" aria-hidden="true" />
            )}
            <span className="hidden xl:inline">{soundEnabled ? "Audio" : "Muted"}</span>
          </button>

          <Chip tone="caution" className="hidden sm:inline-flex">
            Testnet
          </Chip>
          <div className="hidden sm:block">
            <Switch
              checked={demo}
              onCheckedChange={() => {
                playTactileClick();
                toggleDemo();
              }}
              label="Demo"
              id="demo-mode"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              playTactileClick();
              toggleDemo();
            }}
            aria-pressed={demo}
            className={cn(
              "rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-label sm:hidden",
              demo
                ? "border-[rgba(230,180,80,0.5)] bg-caution-soft text-caution"
                : "border-line text-paper-muted"
            )}
          >
            Demo
          </button>

          {effectiveAccount ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/"
                onClick={() => playTactileClick()}
                className="hidden items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] sm:flex"
                aria-label={`Wallet ${effectiveAccount}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
                <span className="font-mono text-12 text-paper">
                  {shortAccount(effectiveAccount, 18)}
                </span>
              </Link>
              {!demo ? (
                <button
                  type="button"
                  onClick={() => void signOutWallet()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-paper-muted transition-colors hover:border-line hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                playTactileClick();
                openWalletModal();
              }}
              className="whitespace-nowrap"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Connect wallet</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex overflow-x-auto border-t border-line px-4 no-scrollbar lg:hidden">
        <nav className="mx-auto flex w-full max-w-page items-center gap-4 sm:gap-6" aria-label="Main mobile">
          {navLinks.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => playTactileClick()}
                className={cn(
                  "shrink-0 border-b border-transparent py-3 font-mono text-[10px] uppercase tracking-label sm:text-[11px]",
                  active
                    ? "border-signal text-paper"
                    : "text-paper-muted hover:text-paper"
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                <sup className="ml-0.5 text-[7px] text-paper-muted">{item.idx}</sup>
              </Link>
            );
          })}
        </nav>
      </div>

      {demo ? (
        <div className="border-t border-[rgba(230,180,80,0.3)] bg-caution-soft">
          <div className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <div className="flex items-center gap-2 text-12 text-caution">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Simulated data. Not on chain.</span>
              <span className="hidden font-mono text-[10px] uppercase tracking-label opacity-80 md:inline">
                {demoAccount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void resetDemo()}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-label text-caution hover:text-paper"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reset
              </button>
              <button
                type="button"
                onClick={toggleDemo}
                className="font-mono text-[10px] uppercase tracking-label text-caution underline decoration-[rgba(230,180,80,0.4)] underline-offset-4 hover:text-paper"
              >
                Exit demo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
