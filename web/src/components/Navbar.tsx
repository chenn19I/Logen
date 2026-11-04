"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Wallet,
  RefreshCw,
  LogOut,
  Lock,
  Sparkles,
  Flame,
  Store,
  CheckCircle2,
  Settings2,
  Globe,
  ChevronDown,
  ExternalLink,
  X,
  Ticket,
} from "lucide-react";
import { useNear } from "./NearProvider";
import { SPRING_RELIC } from "./TactileBento";
import {
  EXPLORER_URL,
  getNftTokensForOwner,
} from "@/lib/near/rpc";
import { shortenAccount } from "@/lib/near/format";

export function Navbar() {
  const pathname = usePathname();
  const {
    lang,
    setLang,
    accountId,
    registryId,
    setRegistryId,
    config,
    finalBlockHeight,
    rpcOnline,
    contractDeployed,
    parentKeysCount,
    isLoadingChain,
    refreshChainState,
    openWalletModal,
    signOutWallet,
  } = useNear();

  const isId = lang === "id";

  const [ownedSeats, setOwnedSeats] = useState<string[]>([]);
  const [segelOpen, setSegelOpen] = useState<boolean>(false);
  const [editingRegistry, setEditingRegistry] = useState<boolean>(false);
  const [draftRegistry, setDraftRegistry] = useState<string>(registryId);

  useEffect(() => {
    let cancelled = false;
    async function fetchOwnedSeats() {
      if (!accountId) {
        setOwnedSeats([]);
        return;
      }
      try {
        const tokens = await getNftTokensForOwner(accountId, registryId);
        if (!cancelled) {
          setOwnedSeats(tokens.map((t) => t.token_id));
        }
      } catch {
        if (!cancelled) setOwnedSeats([]);
      }
    }
    fetchOwnedSeats();
    return () => {
      cancelled = true;
    };
  }, [accountId, registryId]);

  const navLinks = [
    {
      href: "/",
      label: isId ? "Artefak & Ringkasan" : "Relic Overview",
      icon: Sparkles,
    },
    {
      href: "/market",
      label: "Safe Sale Market",
      icon: Store,
    },
    {
      href: "/seats",
      label: isId ? "Vault Seat Saya" : "My Seat Vaults",
      icon: ShieldCheck,
    },
    {
      href: "/lounge",
      label: "Member Lounge",
      badge: "Gated",
      icon: Lock,
    },
    {
      href: "/verify",
      label: isId ? "Riwayat & Provenans" : "Provenance & T0–T3",
      icon: CheckCircle2,
    },
    {
      href: "/lab",
      label: "Attack Lab",
      icon: Flame,
    },
    {
      href: "/events",
      label: isId ? "Event & Kas" : "Events & Pool",
      icon: Ticket,
    },
  ];

  const handleSaveRegistry = (e: React.FormEvent) => {
    e.preventDefault();
    setRegistryId(draftRegistry);
    setEditingRegistry(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#06080D]/85 backdrop-blur-2xl">
      {/* Top Cryptographic Telemetry & Global Segel Proof Bar */}
      <div className="border-b border-white/[0.05] bg-[#0B0F1A]/75 px-4 py-1.5 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="relative flex flex-wrap items-center gap-2.5">
            {/* Interactive Global Security Pill (Opens T0-T3 Ladder Pop-up) */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_RELIC}
              onClick={() => setSegelOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[#00EC97]/35 bg-[#00EC97]/[0.08] px-3 py-1 font-mono text-[11px] text-slate-200 shadow-jade-sm transition hover:border-[#00EC97]/70"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  rpcOnline
                    ? "bg-[#00EC97] shadow-[0_0_8px_#00EC97]"
                    : "bg-[#EF4444]"
                }`}
              />
              <span>
                Parent: <strong className="text-white">{registryId}</strong>
              </span>
              <span className="rounded-full bg-[#00EC97]/20 px-2 py-0.5 text-[10px] font-bold text-[#00EC97]">
                {contractDeployed && parentKeysCount === 0
                  ? isId
                    ? "[TERSEGEL · 0 KEY]"
                    : "[SEALED · 0 KEYS]"
                  : contractDeployed
                  ? `[LIVE · ${parentKeysCount ?? 0} KEY]`
                  : "[RPC LIVE]"}
              </span>
              <ChevronDown
                className={`h-3 w-3 text-[#00EC97] transition-transform ${
                  segelOpen ? "rotate-180" : ""
                }`}
              />
            </motion.button>

            {/* Switch Registry Inline Control */}
            {!editingRegistry ? (
              <button
                type="button"
                onClick={() => {
                  setDraftRegistry(registryId);
                  setEditingRegistry(true);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:border-white/15 hover:text-white"
              >
                <Settings2 className="h-3 w-3" />
                {isId ? "Ganti Kontrak" : "Switch"}
              </button>
            ) : (
              <form onSubmit={handleSaveRegistry} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={draftRegistry}
                  onChange={(e) => setDraftRegistry(e.target.value)}
                  placeholder="pusaka-c10747.testnet"
                  className="rounded-md border border-[#00EC97]/50 bg-[#06080D] px-2 py-0.5 font-mono text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-md bg-[#00EC97] px-2 py-0.5 font-mono text-[11px] font-bold text-[#06080D]"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRegistry(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            )}

            {finalBlockHeight && (
              <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">
                · Block <span className="text-slate-200">#{finalBlockHeight.toLocaleString()}</span>
              </span>
            )}

            {/* T0–T3 Verification Ladder Pop-up Modal */}
            <AnimatePresence>
              {segelOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={SPRING_RELIC}
                  className="absolute left-0 top-10 z-50 w-[360px] rounded-2xl border-t border-white/20 border-x border-b border-[#00EC97]/30 bg-[#0B0F1A]/95 p-4 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:w-[430px]"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00EC97]">
                        SHARDED-ITEM-1.0.0 · T0–T3 LADDER
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {isId
                          ? "Tangga Bukti Keamanan Tanpa Kunci"
                          : "Cryptographic Verification Ladder"}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSegelOpen(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-2 font-mono text-[11px]">
                    <div className="rounded-xl border border-white/[0.06] bg-[#06080D]/90 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#00EC97]">T0 · Namespace</span>
                        <span className="text-[#10B981]">VERIFIED</span>
                      </div>
                      <p className="mt-0.5 font-sans text-[11px] text-slate-400">
                        {isId
                          ? `Setiap seat (<id>.${registryId}) adalah sub-account langsung dari registry induk.`
                          : `Every seat (<id>.${registryId}) is a direct sub-account of the parent registry.`}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-[#06080D]/90 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#00EC97]">T1 · NEP-171 Index</span>
                        <span className="text-[#10B981]">ACTIVE</span>
                      </div>
                      <p className="mt-0.5 font-sans text-[11px] text-slate-400">
                        {isId
                          ? "Indeks koleksi standar NEP-171 dengan rekonsiliasi maju sync()."
                          : "Standard NEP-171 enumeration with forward-only sync() healing."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-[#06080D]/90 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#00EC97]">T2 · Same-Block Pair Check</span>
                        <span className="text-[#10B981]">ENFORCED</span>
                      </div>
                      <p className="mt-0.5 font-sans text-[11px] text-slate-400">
                        {isId
                          ? "Membandingkan owner_id & rotation_seq di registry dan vault pada blok final yang sama."
                          : "Cross-verifies owner_id & rotation_seq across registry and vault at one final block."}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#00EC97]/25 bg-[#00EC97]/[0.05] p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#00EC97]">
                          T3 · Segel Tanpa Kunci
                        </span>
                        <span className="font-bold text-[#00EC97]">
                          keys: {parentKeysCount ?? 0}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-slate-300">
                        Vault Hash: {config?.vault_code_hash || "DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-1 text-xs">
                    <a
                      href={`${EXPLORER_URL}/address/${registryId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300 hover:text-[#00EC97]"
                    >
                      NearBlocks Explorer
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Link
                      href="/verify"
                      onClick={() => setSegelOpen(false)}
                      className="rounded-lg bg-[#00EC97] px-3 py-1 font-bold text-[#06080D]"
                    >
                      {isId ? "Audit Lengkap →" : "Full Audit →"}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Controls: Language Toggle & Sync */}
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-[#06080D] p-0.5 text-[11px]">
              <Globe className="ml-2 mr-1 h-3 w-3 text-[#00EC97]" />
              <button
                type="button"
                onClick={() => setLang("id")}
                className={`rounded-full px-2 py-0.5 font-semibold transition ${
                  lang === "id"
                    ? "bg-[#00EC97] text-[#06080D]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-full px-2 py-0.5 font-semibold transition ${
                  lang === "en"
                    ? "bg-[#00EC97] text-[#06080D]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => refreshChainState()}
              disabled={isLoadingChain}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-[#00EC97] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${
                  isLoadingChain ? "animate-spin text-[#00EC97]" : ""
                }`}
              />
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Row */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        {/* Brand Identity */}
        <Link href="/" className="group flex shrink-0 items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0B0F1A] shadow-jade-sm transition group-hover:border-[#00EC97]/60">
            {/* Geometric Cryptographic Seal Logo */}
            <svg className="h-6 w-6 text-[#00EC97]" viewBox="0 0 24 24" fill="none">
              <polygon
                points="12,2 20.5,7 20.5,17 12,22 3.5,17 3.5,7"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="rgba(0,236,151,0.1)"
              />
              <polygon
                points="12,6 17,9 17,15 12,18 7,15 7,9"
                stroke="#FFFFFF"
                strokeOpacity="0.7"
                strokeWidth="1"
              />
              <circle cx="12" cy="12" r="2.2" fill="#00EC97" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-[-0.04em] text-white sm:text-xl">
                PUSAKA
              </span>
              <span className="hidden rounded-md border border-[#00EC97]/30 bg-[#00EC97]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#00EC97] sm:inline">
                RELIC VAULT
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Keanggotaan yang diwariskan bersama isinya
            </p>
          </div>
        </Link>

        {/* Desktop Spring-Animated Navigation */}
        <nav className="hidden xl:flex xl:items-center xl:gap-1">
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
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-100"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="pusaka-active-nav"
                    transition={SPRING_RELIC}
                    className="absolute inset-0 rounded-xl border-t border-white/20 border-x border-b border-[#00EC97]/35 bg-[#0D1526]/90 shadow-jade-sm"
                  />
                )}
                <Icon
                  className={`relative z-10 h-3.5 w-3.5 ${
                    isActive ? "text-[#00EC97]" : "text-slate-400"
                  }`}
                />
                <span className="relative z-10">{item.label}</span>
                {item.badge && (
                  <span className="relative z-10 rounded bg-[#00EC97]/15 px-1.5 py-0.2 font-mono text-[9px] text-[#00EC97]">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Wallet Connection Button + Owned Seat Badge */}
        <div className="flex shrink-0 items-center gap-2">
          {accountId ? (
            <div className="flex items-center gap-2">
              <Link
                href="/seats"
                className="flex items-center gap-2 rounded-xl border-t border-white/15 border-x border-b border-white/[0.07] bg-[#0B0F1A]/90 px-3 py-2 text-xs transition hover:border-[#00EC97]/40"
              >
                <span className="h-2 w-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                <span className="font-mono font-medium text-white">
                  {shortenAccount(accountId, 16)}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    ownedSeats.length > 0
                      ? "border border-[#00EC97]/40 bg-[#00EC97]/15 text-[#00EC97]"
                      : "border border-white/10 bg-white/5 text-slate-400"
                  }`}
                >
                  {ownedSeats.length > 0
                    ? `${ownedSeats.length} Seat (${ownedSeats[0].split(".")[0]})`
                    : "0 Seat"}
                </span>
              </Link>
              <button
                type="button"
                onClick={signOutWallet}
                className="rounded-xl border border-white/10 bg-[#0B0F1A] p-2 text-slate-400 transition hover:border-[#EF4444]/50 hover:text-[#EF4444]"
                title={isId ? "Putuskan Dompet" : "Disconnect Wallet"}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_RELIC}
              onClick={openWalletModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00EC97] px-4 py-2.5 text-xs font-bold text-[#06080D] shadow-jade transition hover:brightness-110"
            >
              <Wallet className="h-3.5 w-3.5" />
              {isId ? "Connect NEAR Wallet" : "Connect NEAR Wallet"}
            </motion.button>
          )}
        </div>
      </div>

      {/* Responsive Tablet/Mobile Nav Strip */}
      <div className="flex overflow-x-auto border-t border-white/[0.05] bg-[#0B0F1A]/60 px-3 py-2 xl:hidden">
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
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border border-[#00EC97]/40 bg-[#00EC97]/15 text-[#00EC97]"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
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
