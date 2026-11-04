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
  Globe,
} from "lucide-react";
import { useNear } from "./NearProvider";
import { shortenAccount } from "@/lib/near/format";

export function Navbar() {
  const pathname = usePathname();
  const {
    lang,
    setLang,
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

  const navLinks = [
    {
      href: "/",
      label: "Pendopo",
      sub: lang === "id" ? "Beranda & Simulasi" : "Overview & Sim",
      icon: Sparkles,
    },
    {
      href: "/seats",
      label: lang === "id" ? "Kursi" : "Seats",
      sub: lang === "id" ? "Brankas NFT" : "Keyless Vaults",
      icon: ShieldCheck,
    },
    {
      href: "/market",
      label: lang === "id" ? "Pasar" : "Market",
      sub: lang === "id" ? "Jual Beli Aman" : "Safe Sale",
      icon: Store,
    },
    {
      href: "/events",
      label: lang === "id" ? "Acara" : "Events",
      sub: lang === "id" ? "Bagi Hasil 40%" : "40/50/10 Split",
      icon: Ticket,
    },
    {
      href: "/lounge",
      label: "Lounge",
      sub: lang === "id" ? "Akses NEP-413" : "NEP-413 Gate",
      icon: Lock,
    },
    {
      href: "/lab",
      label: "Attack Lab",
      sub: lang === "id" ? "12 Uji Bobol" : "A1–A12 Proofs",
      icon: Flame,
    },
    {
      href: "/treasury",
      label: lang === "id" ? "Kas Klub" : "Treasury",
      sub: lang === "id" ? "Tarik Dana" : "Pull Ledgers",
      icon: Landmark,
    },
    {
      href: "/verify",
      label: lang === "id" ? "Verifikasi" : "Verify",
      sub: lang === "id" ? "Bukti 0 Kunci" : "Segel Proof",
      icon: CheckCircle2,
    },
  ];

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
                  · {lang === "id" ? "Blok Final" : "Final Block"} #{finalBlockHeight.toLocaleString()}
                </span>
              )}
            </span>

            <span className="text-slate-600">|</span>

            {!editingRegistry ? (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">
                  {lang === "id" ? "Kontrak Induk:" : "Registry:"}
                </span>
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
                  {lang === "id" ? "Ganti" : "Switch"}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveRegistry} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={draftRegistry}
                  onChange={(e) => setDraftRegistry(e.target.value)}
                  placeholder="pusaka-c10747.testnet"
                  className="rounded border border-gold-500/50 bg-obsidian-950 px-2 py-0.5 font-mono text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-gold-500 px-2 py-0.5 font-medium text-obsidian-950 hover:bg-gold-400"
                >
                  {lang === "id" ? "Simpan" : "Apply"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRegistry(false)}
                  className="text-slate-400 hover:text-white"
                >
                  {lang === "id" ? "Batal" : "Cancel"}
                </button>
              </form>
            )}

            {contractDeployed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-segel-500/40 bg-segel-500/10 px-2.5 py-0.5 font-mono text-[10px] text-segel-400">
                <ShieldCheck className="h-3 w-3" />
                LIVE ON-CHAIN
                {parentKeysCount === 0
                  ? lang === "id"
                    ? " · SEGEL INDUK (0 KUNCI)"
                    : " · SEALED (0 KEYS)"
                  : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                RPC LIVE · {registryId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Bilingual Language Switcher */}
            <div className="inline-flex items-center rounded-lg border border-gold-500/30 bg-obsidian-950 p-0.5 text-[11px]">
              < Globe className="ml-1.5 mr-1 h-3 w-3 text-gold-400" />
              <button
                type="button"
                onClick={() => setLang("id")}
                className={`rounded-md px-2 py-0.5 font-semibold transition ${
                  lang === "id"
                    ? "bg-gold-500 text-obsidian-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇮🇩 ID
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-md px-2 py-0.5 font-semibold transition ${
                  lang === "en"
                    ? "bg-gold-500 text-obsidian-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🇬🇧 EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => refreshChainState()}
              disabled={isLoadingChain}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-gold-300 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoadingChain ? "animate-spin text-gold-400" : ""}`}
              />
              {lang === "id" ? "Segarkan RPC" : "Sync RPC"}
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
              {lang === "id"
                ? "Jual kursinya, brankas uangnya ikut berpindah"
                : "Sell the seat — the keyless wallet goes with it"}
            </p>
          </div>
        </Link>

        {/* Nav Items */}
        <nav className="hidden lg:flex lg:items-center lg:gap-1">
          {navLinks.map((item) => {
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
                title={lang === "id" ? "Putuskan Dompet" : "Disconnect Wallet"}
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
              {lang === "id" ? "Hubungkan Dompet NEAR" : "Connect NEAR Wallet"}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <div className="flex overflow-x-auto border-t border-gold-500/10 bg-obsidian-900/60 px-3 py-2 lg:hidden">
        <div className="flex items-center gap-1.5">
          {navLinks.map((item) => {
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
