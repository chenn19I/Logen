"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Wallet,
  RefreshCw,
  LogOut,
  Lock,
  Sparkles,
  Flame,
  Landmark,
  Store,
  Ticket,
  CheckCircle2,
  Settings2,
} from "lucide-react";
import { useNear } from "./NearProvider";
import { shortenAccount } from "@/lib/near/format";

const NAV_LINKS = [
  { href: "/", label: "Pendopo", sub: "Overview", icon: Sparkles },
  { href: "/seats", label: "Seats", sub: "Vaults", icon: ShieldCheck },
  { href: "/market", label: "Market", sub: "Safe Sale", icon: Store },
  { href: "/events", label: "Events", sub: "40/50/10", icon: Ticket },
  { href: "/lounge", label: "Lounge", sub: "NEP-413 Gate", icon: Lock },
  { href: "/lab", label: "Attack Lab", sub: "A1–A12", icon: Flame },
  { href: "/treasury", label: "Treasury", sub: "Kas Klub", icon: Landmark },
  { href: "/verify", label: "Verify", sub: "Segel Proof", icon: CheckCircle2 },
];

export function Navbar() {
  const pathname = usePathname();
  const {
    accountId,
    registryId,
    setRegistryId,
    finalBlockHeight,
    rpcOnline,
    contractDeployed,
    parentKeysCount,
    isLoadingChain,
    refreshChainState,
    openWalletModal,
    signOutWallet,
  } = useNear();

  const [editingRegistry, setEditingRegistry] = useState(false);
  const [draftRegistry, setDraftRegistry] = useState(registryId);

  const handleSaveRegistry = (e: React.FormEvent) => {
    e.preventDefault();
    setRegistryId(draftRegistry);
    setEditingRegistry(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gold-500/20 bg-obsidian-950/90 backdrop-blur-md">
      {/* Top Protocol Telemetry Strip */}
      <div className="border-b border-gold-500/10 bg-obsidian-900/90 px-4 py-1.5 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  rpcOnline
                    ? "bg-segel-400 shadow-[0_0_8px_#10B981]"
                    : "bg-threat-500"
                }`}
              />
              NEAR Testnet RPC
              {finalBlockHeight && (
                <span className="text-gold-300">
                  · Final Block #{finalBlockHeight.toLocaleString()}
                </span>
              )}
            </span>

            <span className="text-slate-600">|</span>

            {!editingRegistry ? (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Registry:</span>
                <span className="rounded border border-gold-500/30 bg-obsidian-800 px-2 py-0.5 font-mono text-gold-300">
                  {registryId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftRegistry(registryId);
                    setEditingRegistry(true);
                  }}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-obsidian-800 hover:text-gold-300"
                  title="Switch Registry Contract ID"
                >
                  <Settings2 className="h-3 w-3" />
                  Switch
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveRegistry} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={draftRegistry}
                  onChange={(e) => setDraftRegistry(e.target.value)}
                  placeholder="pusaka.testnet"
                  className="rounded border border-gold-500/50 bg-obsidian-950 px-2 py-0.5 font-mono text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-gold-500 px-2 py-0.5 font-medium text-obsidian-950 hover:bg-gold-400"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRegistry(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </form>
            )}

            {contractDeployed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-segel-500/40 bg-segel-500/10 px-2 py-0.5 font-mono text-[10px] text-segel-400">
                <ShieldCheck className="h-3 w-3" />
                LIVE ON-CHAIN
                {parentKeysCount === 0 ? " · SEGEL (0 KEYS)" : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                RPC LIVE · AWAITING CONTRACT DEPLOY ({registryId})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refreshChainState()}
              disabled={isLoadingChain}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-gold-300 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoadingChain ? "animate-spin text-gold-400" : ""}`}
              />
              Sync RPC
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-500/40 bg-gradient-to-br from-obsidian-800 to-obsidian-950 shadow-[0_0_20px_rgba(212,166,74,0.15)] transition group-hover:border-gold-400">
            <svg className="h-6 w-6 text-gold-400" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L14.5 7.5L20 9L15.5 13L17 19L12 15.5L7 19L8.5 13L4 9L9.5 7.5L12 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="rgba(212,166,74,0.2)"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-wider text-white">
                PUSAKA
              </span>
              <span className="rounded border border-gold-500/30 bg-gold-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gold-300">
                NEP-171 Vaults
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Keanggotaan yang diwariskan bersama isinya
            </p>
          </div>
        </Link>

        {/* Nav Items */}
        <nav className="hidden lg:flex lg:items-center lg:gap-1">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? "border border-gold-500/40 bg-gold-500/15 text-gold-300 shadow-[0_0_15px_rgba(212,166,74,0.12)]"
                    : "text-slate-300 hover:bg-obsidian-800/80 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive
                      ? "text-gold-400"
                      : "text-slate-400 group-hover:text-gold-300"
                  }`}
                />
                <div className="flex flex-col leading-tight">
                  <span>{item.label}</span>
                  <span className="text-[9px] text-slate-400">{item.sub}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Wallet Button */}
        <div className="flex items-center gap-2">
          {accountId ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-segel-500/40 bg-obsidian-800/90 px-3 py-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-segel-400" />
                <span className="font-mono text-slate-200">
                  {shortenAccount(accountId, 20)}
                </span>
              </div>
              <button
                type="button"
                onClick={signOutWallet}
                className="rounded-lg border border-slate-700 bg-obsidian-800 p-2 text-slate-400 transition hover:border-threat-500/50 hover:text-threat-400"
                title="Disconnect Wallet"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openWalletModal}
              className="inline-flex items-center gap-2 rounded-lg border border-gold-400/60 bg-gradient-to-r from-gold-500 to-gold-400 px-4 py-2 text-xs font-semibold text-obsidian-950 shadow-[0_0_20px_rgba(212,166,74,0.25)] transition hover:brightness-110"
            >
              <Wallet className="h-3.5 w-3.5" />
              Connect NEAR Wallet
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <div className="flex overflow-x-auto border-t border-gold-500/10 bg-obsidian-900/60 px-3 py-2 lg:hidden">
        <div className="flex items-center gap-1.5">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  isActive
                    ? "border border-gold-500/40 bg-gold-500/15 text-gold-300"
                    : "text-slate-300 hover:bg-obsidian-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
