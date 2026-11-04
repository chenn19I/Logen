"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Flame,
  KeyRound,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Store,
  Play,
  RotateCcw,
  ShieldAlert,
  ExternalLink,
  Eye,
  PlusCircle,
  UserCheck,
  HelpCircle,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import {
  EXPLORER_URL,
  getNftTokens,
  getSeat,
  getVaultState,
} from "@/lib/near/rpc";
import type { SeatView, VaultStateView } from "@/lib/near/types";
import {
  formatYocto,
  parseNearToYocto,
  splitTicketRevenue,
} from "@/lib/near/format";

interface LiveSeatCardData {
  tokenId: string;
  seat: SeatView | null;
  vault: VaultStateView | null;
}

export default function HomePage() {
  const {
    lang,
    accountId,
    registryId,
    config,
    stats,
    parentKeysCount,
    contractDeployed,
    openWalletModal,
    callContractMethod,
  } = useNear();

  const isId = lang === "id";

  // Hero card tab: "visual" (Interactive Heirloom Card) vs "mint" (Mint Form)
  const [heroTab, setHeroTab] = useState<"visual" | "mint">("visual");
  const [xrayMode, setXrayMode] = useState<boolean>(false);

  // Interactive 4-Step Story Simulator state
  const [simStep, setSimStep] = useState<1 | 2 | 3 | 4>(1);
  const [simVaultNear, setSimVaultNear] = useState<number>(2.0);
  const [simTicketsBought, setSimTicketsBought] = useState<number>(1);
  const [simAttackToast, setSimAttackToast] = useState<{
    code: string;
    msgId: string;
    msgEn: string;
    txHash: string;
  } | null>(null);

  // Receipt diagram step
  const [activeReceiptStep, setActiveReceiptStep] = useState<number>(2);

  // Mint form state
  const [handleInput, setHandleInput] = useState<string>("");
  const [mintStatus, setMintStatus] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState<boolean>(false);

  // Live seats fetched from NEAR Testnet
  const [liveSeats, setLiveSeats] = useState<LiveSeatCardData[]>([]);
  const [loadingSeats, setLoadingSeats] = useState<boolean>(true);

  // Interactive Revenue Split Calculator state
  const [calcTicketNear, setCalcTicketNear] = useState<string>("10");
  const [calcSeatsCount, setCalcSeatsCount] = useState<number>(2);

  useEffect(() => {
    if (stats?.seats_minted && stats.seats_minted > 0) {
      setCalcSeatsCount(stats.seats_minted);
    }
  }, [stats?.seats_minted]);

  useEffect(() => {
    let cancelled = false;
    async function loadLiveSeats() {
      setLoadingSeats(true);
      try {
        const tokens = await getNftTokens(registryId, "0", 6);
        const enriched = await Promise.all(
          tokens.map(async (t) => {
            const [seat, vault] = await Promise.all([
              getSeat(t.token_id, registryId),
              getVaultState(t.token_id),
            ]);
            return { tokenId: t.token_id, seat, vault };
          })
        );
        if (!cancelled) {
          setLiveSeats(enriched);
        }
      } catch {
        if (!cancelled) setLiveSeats([]);
      } finally {
        if (!cancelled) setLoadingSeats(false);
      }
    }
    loadLiveSeats();
    return () => {
      cancelled = true;
    };
  }, [registryId]);

  const seatPriceYocto = config?.seat_price || "2200000000000000000000000"; // 2.2 NEAR default
  const previewAccountId = handleInput.trim()
    ? `${handleInput.trim().toLowerCase()}.${registryId}`
    : `s${String((stats?.seats_minted ?? 0) + 1).padStart(3, "0")}.${registryId}`;

  const handleMintSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    setMintStatus(null);
    if (!accountId) {
      openWalletModal();
      return;
    }
    const cleanHandle = handleInput.trim().toLowerCase();
    if (cleanHandle && !/^[a-z0-9_-]{2,20}$/.test(cleanHandle)) {
      setMintStatus(
        isId
          ? "Error: Nama handle harus 2–20 karakter huruf kecil/angka/strip (E_BAD_HANDLE)."
          : "Error: Handle must be 2–20 lowercase alphanumeric/dash characters (E_BAD_HANDLE)."
      );
      return;
    }
    setIsMinting(true);
    try {
      const args: Record<string, unknown> = {
        receiver_id: accountId,
      };
      if (cleanHandle) {
        args.handle = cleanHandle;
      }
      await callContractMethod({
        receiverId: registryId,
        methodName: "mint_seat",
        args,
        gas: "220000000000000",
        deposit: seatPriceYocto,
      });
      setMintStatus(
        isId
          ? `Berhasil mencetak ${previewAccountId} dengan 0 kunci akses!`
          : `Minted ${previewAccountId} with 0 access keys!`
      );
      setHandleInput("");
    } catch (err) {
      setMintStatus(
        err instanceof Error ? err.message : "Transaction cancelled or failed"
      );
    } finally {
      setIsMinting(false);
    }
  };

  let calcSplitResult = splitTicketRevenue(
    "10000000000000000000000000",
    config?.default_bps || { pool: 4000, kas: 5000, organizer: 1000 },
    calcSeatsCount
  );
  try {
    const yocto = parseNearToYocto(calcTicketNear || "0");
    calcSplitResult = splitTicketRevenue(
      yocto,
      config?.default_bps || { pool: 4000, kas: 5000, organizer: 1000 },
      calcSeatsCount
    );
  } catch {
    // fallback if invalid input
  }

  const receiptSteps = [
    {
      step: 1,
      badge: isId ? "Receipt #1 · Kontrak Induk" : "Receipt #1 · Registry",
      title: isId
        ? "1. Pemilik Memanggil registry.nft_transfer(B, token_id)"
        : "1. Caller Invokes registry.nft_transfer(B, token_id)",
      code: `registry.nft_transfer({ receiver_id: "bob-c10747.testnet", token_id: "s001.${registryId}" })`,
      summary: isId
        ? "Kontrak induk memeriksa pemanggil adalah pemilik saat ini (Alice), penerima bukan diri sendiri, dan kursi sedang tidak dijual (Idle). Lalu mengirim perintah lintas-kontrak `vault.v_rotate(from=Alice, to=Bob, expected_seq=n)`."
        : "Registry verifies caller is current owner A, receiver B != A, and seat is Idle. Dispatches cross-contract call `vault.v_rotate(from=A, to=B, expected_seq=n)`.",
      oldOwnerAccess: isId
        ? "Masih aktif sampai Receipt #2 dieksekusi"
        : "Active until Receipt #2 executes",
      vaultState: "owner = alice, rotation_seq = 0, status = Idle",
      indexState: "owner = alice, seq = 0",
    },
    {
      step: 2,
      badge: isId
        ? "Receipt #2 · Brankas Kursi [TITIK PUTUS ATOMIK]"
        : "Receipt #2 · Seat Vault [ATOMIC CUT-OFF]",
      title: isId
        ? "2. Brankas Mengeksekusi v_rotate(Alice → Bob) dalam 1 Receipt"
        : "2. Vault Executes v_rotate(from=A, to=B, expected_seq=n)",
      code: `vault.v_rotate({ from: "alice-c10747.testnet", to: "bob-c10747.testnet", expected_seq: 0 })`,
      summary: isId
        ? "Di dalam sub-akun kursi itu sendiri, dalam SATU receipt atomik: brankas mengubah `owner = Bob`, menaikkan `rotation_seq = 1`, dan menghapus `delegate = None`. Detik ini juga Alice kehilangan 100% akses ke brankas."
        : "Inside the seat sub-account itself, in a SINGLE atomic receipt: sets owner = B, increments rotation_seq = n + 1, and wipes any delegate. Old owner is locked out immediately.",
      oldOwnerAccess: isId
        ? "DIBLOKIR DETIK INI JUGA (E_NOT_OWNER)"
        : "BLOCKED IMMEDIATELY (E_NOT_OWNER)",
      vaultState: "owner = bob, rotation_seq = 1, delegate = None",
      indexState: "owner = alice, seq = 0 (jeda callback 1 blok)",
    },
    {
      step: 3,
      badge: isId
        ? "Receipt #3 · Callback & sync() Tanpa Izin"
        : "Receipt #3 · Callback & Permissionless sync()",
      title: isId
        ? "3. Indeks Diperbarui & Riwayat Pemilik Dicatat"
        : "3. Registry Callback (or Anyone's sync) Advances Index",
      code: `registry.on_rotated() // atau siapa saja panggil registry.sync({ token_id })`,
      summary: isId
        ? "Callback memperbarui indeks NFT ke Bob pada `seq = 1`. Bahkan jika callback kehabisan gas, brankas sudah sah milik Bob, pintu Lounge otomatis menolak sesi lama (Pair Check T2), dan siapa pun bisa memanggil `sync()` untuk menyamakan indeks."
        : "Callback advances registry index to B at seq = 1. Even if callback runs out of gas, the vault is already owned by B, the Lounge gate fails closed on T2 pair_check, and anyone can call `sync()`.",
      oldOwnerAccess: isId
        ? "0% AKSES SELAMANYA (0 Kunci Akses + Seq Naik)"
        : "PERMANENTLY ZERO (0 Access Keys + Seq Advanced)",
      vaultState: "owner = bob, rotation_seq = 1",
      indexState: "owner = bob, seq = 1 (PairCheck = COCOK)",
    },
  ];

  // Interactive Story Simulator Computed Values
  const totalSimBalance = (2.0 + simTicketsBought * 0.16).toFixed(2);
  const simOwner =
    simStep < 4 ? "alice-c10747.testnet" : "bob-c10747.testnet";
  const simSeq = simStep < 4 ? 0 : 1;
  const simStatus = simStep === 3 ? "FROZEN (Listed · Nonce #1)" : "ACTIVE (Idle)";

  return (
    <div className="space-y-12">
      {/* =====================================================================
          1. BILINGUAL HERO SECTION WITH INTERACTIVE HEIRLOOM VAULT CARD
         ===================================================================== */}
      <section className="relative overflow-hidden rounded-3xl border border-gold-500/35 bg-gradient-to-br from-obsidian-800/95 via-obsidian-900 to-obsidian-950 p-6 shadow-[0_25px_70px_rgba(0,0,0,0.7)] sm:p-8 lg:p-11">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Value Proposition */}
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-3.5 py-1.5 text-xs font-medium text-gold-300">
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              <span>NEAR Hackathon 2026 · Track 10: NFTs That Do Something</span>
              <span className="text-gold-500/60">·</span>
              <span className="rounded bg-segel-500/20 px-1.5 py-0.5 font-mono text-[11px] text-segel-400">
                LIVE ON TESTNET
              </span>
            </div>

            <div className="space-y-3">
              <p className="font-serif text-lg italic tracking-wide text-gold-300/90">
                &ldquo;Keanggotaan yang diwariskan bersama isinya&rdquo;
              </p>
              <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {isId ? (
                  <>
                    Jual Kursinya.{" "}
                    <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">
                      Brankas Uangnya Ikut Berpindah.
                    </span>
                  </>
                ) : (
                  <>
                    Sell the seat.{" "}
                    <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">
                      The wallet goes with it.
                    </span>
                  </>
                )}
              </h1>
            </div>

            {/* Plain-Language Analogy Box */}
            <div className="rounded-2xl border border-gold-500/25 bg-obsidian-950/75 p-4 text-sm leading-relaxed text-slate-200">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400">
                <HelpCircle className="h-4 w-4" />
                {isId
                  ? "Apa itu Pusaka dalam Bahasa Sederhana?"
                  : "What is Pusaka in Plain Language?"}
              </div>
              {isId ? (
                <p>
                  Bayangkan sebuah <strong>Kartu Anggota Klub VIP (NFT)</strong> yang
                  memiliki <strong>Rekening Bank / Brankas NEAR sendiri</strong> (
                  <code className="text-gold-300">s001.{registryId}</code>). Setiap ada
                  orang membeli tiket acara klub, <strong>40% uang tiket otomatis masuk ke brankas kartu ini</strong>.
                  Saat pemilik lama menjual kartunya ke orang baru,{" "}
                  <strong className="text-segel-400">
                    kartu beserta seluruh uang di dalam brankasnya langsung berpindah tangan
                  </strong>{" "}
                  — dan karena rekening tersebut diciptakan dengan{" "}
                  <strong className="text-gold-300">0 Kunci Akses (Zero Keys)</strong>,
                  pemilik lama <strong>mustahil menyimpan kunci cadangan</strong> atau
                  menguras uangnya saat transaksi berlangsung.
                </p>
              ) : (
                <p>
                  Think of a <strong>VIP Club Membership Card (NEP-171 NFT)</strong> that
                  owns its own <strong>real NEAR bank vault sub-account</strong> (
                  <code className="text-gold-300">s001.{registryId}</code>). Every time an
                  event ticket is sold, <strong>40% of ticket revenue flows directly into the card&apos;s vault</strong>.
                  When you sell the card on the secondary market,{" "}
                  <strong className="text-segel-400">
                    the card and all the money inside its vault move together in one atomic receipt
                  </strong>{" "}
                  — and because the vault has{" "}
                  <strong className="text-gold-300">0 Access Keys</strong>, the seller can
                  never keep a backdoor key or drain the wallet mid-sale.
                </p>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/seats"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 px-5 py-3 text-sm font-semibold text-obsidian-950 shadow-[0_0_25px_rgba(212,166,74,0.3)] transition hover:brightness-110"
              >
                {isId ? "Lihat Kursi & Brankas Live" : "Explore Live Seat Vaults"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/market"
                className="inline-flex items-center gap-2 rounded-xl border border-gold-500/40 bg-obsidian-800/90 px-5 py-3 text-sm font-medium text-gold-300 transition hover:bg-obsidian-700"
              >
                <Store className="h-4 w-4" />
                {isId ? "Pasar Sekunder Aman" : "Safe Secondary Market"}
              </Link>
              <Link
                href="/lab"
                className="inline-flex items-center gap-2 rounded-xl border border-threat-500/40 bg-threat-500/10 px-4 py-3 text-sm font-medium text-threat-400 transition hover:bg-threat-500/20"
              >
                <Flame className="h-4 w-4" />
                {isId ? "Lab Serangan (80.620 Uji)" : "Attack Lab (80,620 Proofs)"}
              </Link>
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 rounded-xl border border-segel-500/40 bg-segel-500/10 px-4 py-3 text-sm font-medium text-segel-400 transition hover:bg-segel-500/20"
              >
                <ShieldCheck className="h-4 w-4" />
                {isId ? "Cek Bukti 0 Kunci" : "Verify 0-Key Proof"}
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Heirloom Card + Mint Switcher */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-gold-500/40 bg-obsidian-950/95 p-5 shadow-2xl">
              {/* Mode Switcher Tabs */}
              <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-obsidian-900 p-1">
                <button
                  type="button"
                  onClick={() => setHeroTab("visual")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                    heroTab === "visual"
                      ? "bg-gold-500 text-obsidian-950 shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {isId ? "✨ Kartu & X-Ray Brankas" : "✨ Interactive Vault Card"}
                </button>
                <button
                  type="button"
                  onClick={() => setHeroTab("mint")}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                    heroTab === "mint"
                      ? "bg-gold-500 text-obsidian-950 shadow"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {isId ? "➕ Cetak Kursi Baru (Mint)" : "➕ Mint New Seat"}
                </button>
              </div>

              {heroTab === "visual" ? (
                <div className="space-y-4">
                  {/* Interactive Heirloom Card */}
                  <div
                    onClick={() => setXrayMode(!xrayMode)}
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gold-400/50 bg-gradient-to-br from-[#171c30] via-[#0d111f] to-[#070911] p-5 shadow-[0_15px_40px_rgba(212,166,74,0.18)] transition hover:border-gold-300"
                  >
                    <div className="flex items-center justify-between border-b border-gold-500/20 pb-3">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-gold-400">
                          {xrayMode
                            ? "MODE X-RAY: SUB-AKUN ON-CHAIN"
                            : "PUSAKA HEIRLOOM SEAT #001"}
                        </span>
                        <h3 className="font-mono text-sm font-bold text-white">
                          s001.{registryId}
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-segel-500/50 bg-segel-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-segel-400">
                        <Lock className="h-3 w-3" />0 Access Keys
                      </span>
                    </div>

                    {!xrayMode ? (
                      <div className="my-5 space-y-4">
                        <div className="flex items-center justify-between rounded-xl border border-gold-500/30 bg-obsidian-950/80 p-4">
                          <div>
                            <span className="text-xs text-slate-400">
                              {isId
                                ? "Saldo Brankas Kursi (Ikut Terjual)"
                                : "Seat Vault Balance (Travels with NFT)"}
                            </span>
                            <p className="mt-0.5 font-mono text-3xl font-bold text-gold-300">
                              2.1600 <span className="text-base">NEAR</span>
                            </p>
                            <span className="font-mono text-[11px] text-segel-400">
                              2.00 NEAR {isId ? "awal" : "initial"} + 0.16 NEAR{" "}
                              {isId ? "bagi hasil tiket" : "ticket pool"}
                            </span>
                          </div>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold-500/40 bg-gold-500/10 text-gold-300">
                            <Coins className="h-6 w-6" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                          <div className="rounded-xl border border-slate-800 bg-obsidian-900/80 p-3">
                            <span className="block text-[10px] text-slate-400">
                              {isId ? "PEMILIK SAAT INI" : "CURRENT OWNER"}
                            </span>
                            <span className="mt-0.5 block truncate font-bold text-white">
                              bob-c10747.testnet
                            </span>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-obsidian-900/80 p-3">
                            <span className="block text-[10px] text-slate-400">
                              {isId ? "EPOCH ROTASI" : "ROTATION SEQ"}
                            </span>
                            <span className="mt-0.5 block font-bold text-segel-400">
                              seq #1 ({isId ? "Sudah Berpindah" : "Rotated"})
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="my-4 space-y-2 rounded-xl border border-segel-500/30 bg-obsidian-950 p-3.5 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">RPC view_access_key_list:</span>
                          <span className="font-bold text-segel-400">keys: [] (0 Keys)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Spec (nft_item_info):</span>
                          <span className="text-gold-300">sharded-item-1.0.0</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Parent Collection:</span>
                          <span className="text-white">{registryId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Vault Code Hash:</span>
                          <span className="text-slate-300">DFuv6MrV...PLmwSg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Mantan Pemilik (Alice):</span>
                          <span className="font-bold text-threat-400">
                            DIBLOKIR (E_NOT_OWNER)
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 text-xs text-gold-300">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Eye className="h-3.5 w-3.5" />
                        {xrayMode
                          ? isId
                            ? "Klik untuk kembali ke tampilan kartu"
                            : "Click to return to card view"
                          : isId
                          ? "Klik kartu untuk melihat X-Ray Bukti 0 Kunci"
                          : "Click card to toggle 0-Key On-Chain X-Ray"}
                      </span>
                      <Link
                        href={`/seat/s001.${registryId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border border-gold-500/40 bg-gold-500/15 px-2.5 py-1 font-mono text-[11px] text-gold-200 hover:bg-gold-500/30"
                      >
                        {isId ? "Buka Brankas →" : "Open Vault →"}
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-obsidian-900/70 px-3.5 py-2.5 text-xs text-slate-300">
                    <span>
                      {isId
                        ? "Ingin mencetak kursi brankas Anda sendiri?"
                        : "Want to mint your own keyless seat vault?"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHeroTab("mint")}
                      className="inline-flex items-center gap-1 font-semibold text-gold-300 hover:text-gold-200"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      {isId ? "Cetak Sekarang" : "Mint Seat"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Mint Form Tab */
                <form onSubmit={handleMintSeat} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-300">
                      {isId
                        ? "Nama Sub-Akun Pilihan (opsional, kosongkan untuk otomatis sNNN)"
                        : "Optional Custom Handle (or leave blank for auto sNNN)"}
                    </label>
                    <div className="flex items-center rounded-xl border border-gold-500/30 bg-obsidian-900 px-3 py-2.5 focus-within:border-gold-400">
                      <input
                        type="text"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value)}
                        placeholder="wijaya"
                        className="w-full bg-transparent font-mono text-sm text-white placeholder-slate-500 focus:outline-none"
                      />
                      <span className="shrink-0 font-mono text-xs text-gold-400">
                        .{registryId}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-slate-800 bg-obsidian-900/70 p-3.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {isId ? "Sub-akun yang dibuat:" : "Sub-account created:"}
                      </span>
                      <span className="text-gold-300">{previewAccountId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {isId ? "Harga Cetak (seat_price):" : "Mint Price:"}
                      </span>
                      <span className="text-white">{formatYocto(seatPriceYocto)} NEAR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {isId ? "Saldo Awal Brankas:" : "Initial Vault Reserve:"}
                      </span>
                      <span className="text-segel-400">
                        {formatYocto(
                          config?.vault_initial_balance || "2000000000000000000000000"
                        )}{" "}
                        NEAR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        {isId ? "Kunci Akses Sub-Akun:" : "Sub-Account Access Keys:"}
                      </span>
                      <span className="font-bold text-segel-400">0 Keys (Tanpa Kunci)</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isMinting}
                    className="w-full rounded-xl bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500 py-3 text-sm font-bold text-obsidian-950 shadow-[0_0_25px_rgba(212,166,74,0.25)] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {isMinting
                      ? isId
                        ? "Menandatangani mint_seat..."
                        : "Signing mint_seat..."
                      : accountId
                      ? `${isId ? "Cetak" : "Mint"} ${previewAccountId} (${formatYocto(
                          seatPriceYocto
                        )} NEAR)`
                      : isId
                      ? "Hubungkan Dompet NEAR untuk Mencetak"
                      : "Connect Wallet to Mint Seat"}
                  </button>

                  {mintStatus && (
                    <div className="rounded-lg border border-gold-500/30 bg-obsidian-800 p-2.5 font-mono text-xs text-gold-300">
                      {mintStatus}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. INTERACTIVE 4-STEP STORY SIMULATOR (EASY TO UNDERSTAND & PLAYABLE)
         ===================================================================== */}
      <section className="rounded-3xl border border-gold-500/30 bg-obsidian-800/80 p-6 shadow-xl lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-segel-400">
              <Play className="h-3.5 w-3.5" />
              {isId
                ? "Simulasi Interaktif · Pahami Cara Kerja Pusaka dalam 30 Detik"
                : "Interactive Playground · Experience How Pusaka Works in 30 Seconds"}
            </span>
            <h2 className="mt-1 font-serif text-3xl font-bold text-white">
              {isId
                ? "Klik Setiap Tahap & Coba Bobol Brankasnya"
                : "Step Through a Seat's Lifecycle & Try to Break It"}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {isId
                ? "Tanpa perlu konek dompet, Anda bisa mencoba membeli tiket, membekukan kursi di pasar, mencoba serangan penjual nakal, hingga memindahkan kepemilikan."
                : "No wallet required — simulate ticket payouts, freeze-on-list, seller drain attacks, and atomic ownership transfer."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSimStep(1);
              setSimVaultNear(2.0);
              setSimTicketsBought(1);
              setSimAttackToast(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-obsidian-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-gold-500/40 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isId ? "Ulangi Simulasi" : "Reset Simulation"}
          </button>
        </div>

        {/* 4 Step Selector Pills */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: 1 as const,
              titleId: "1. Kursi & Brankas Lahir",
              titleEn: "1. Mint Keyless Seat",
              subId: "0 Kunci Akses · Saldo 2.00 NEAR",
              subEn: "0 Access Keys · 2.00 NEAR Reserve",
            },
            {
              step: 2 as const,
              titleId: "2. Bagi Hasil Tiket (40%)",
              titleEn: "2. Ticket Revenue (40%)",
              subId: "Otomatis masuk ke brankas kursi",
              subEn: "Flows directly into seat vault",
            },
            {
              step: 3 as const,
              titleId: "3. Dijual di Pasar (Beku)",
              titleEn: "3. Listed on Market (Frozen)",
              subId: "Penjual tidak bisa menguras isi",
              subEn: "Seller cannot drain while listed",
            },
            {
              step: 4 as const,
              titleId: "4. Dibeli Bob (Pindah Utuh)",
              titleEn: "4. Bought by Bob (Atomic)",
              subId: "Kursi + uang pindah dalam 1 receipt",
              subEn: "Seat + funds move in 1 receipt",
            },
          ].map((item) => {
            const active = simStep === item.step;
            const passed = simStep > item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => {
                  setSimStep(item.step);
                  setSimAttackToast(null);
                }}
                className={` rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-gold-400 bg-gold-500/15 shadow-[0_0_25px_rgba(212,166,74,0.2)]"
                    : passed
                    ? "border-segel-500/40 bg-segel-500/10"
                    : "border-slate-800 bg-obsidian-950/70 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-xs font-bold ${
                      active
                        ? "text-gold-300"
                        : passed
                        ? "text-segel-400"
                        : "text-slate-400"
                    }`}
                  >
                    {isId ? `TAHAP ${item.step}` : `STEP ${item.step}`}
                  </span>
                  {passed && <CheckCircle2 className="h-4 w-4 text-segel-400" />}
                </div>
                <p className="mt-1 font-serif text-lg font-bold text-white">
                  {isId ? item.titleId : item.titleEn}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {isId ? item.subId : item.subEn}
                </p>
              </button>
            );
          })}
        </div>

        {/* Simulator Stage Body */}
        <div className="grid gap-6 rounded-2xl border border-slate-800 bg-obsidian-950/90 p-5 lg:grid-cols-12 lg:p-6">
          {/* Left: Live Simulated Vault State */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-gold-500/35 bg-obsidian-900 p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="font-mono text-[10px] uppercase text-gold-400">
                    {isId ? "STATE BRANKAS ON-CHAIN" : "ON-CHAIN VAULT STATE"}
                  </span>
                  <h4 className="font-mono text-sm font-bold text-white">
                    s001.{registryId}
                  </h4>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${
                    simStep === 3
                      ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border border-segel-500/40 bg-segel-500/15 text-segel-400"
                  }`}
                >
                  {simStatus}
                </span>
              </div>

              <div className="my-4 rounded-xl border border-gold-500/25 bg-obsidian-950 p-3.5">
                <span className="text-xs text-slate-400">
                  {isId ? "Total Uang di Dalam Kursi:" : "Total Funds Inside Seat:"}
                </span>
                <p className="font-mono text-3xl font-bold text-gold-300">
                  {totalSimBalance} NEAR
                </p>
                <span className="font-mono text-[11px] text-slate-400">
                  2.00 NEAR {isId ? "awal" : "base"} + {(simTicketsBought * 0.16).toFixed(2)}{" "}
                  NEAR ({simTicketsBought} {isId ? "tiket acara" : "event tickets"})
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {isId ? "Pemilik Sah (owner_id):" : "Canonical Owner:"}
                  </span>
                  <span className="font-bold text-white">{simOwner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {isId ? "Nomor Urut Rotasi (seq):" : "Rotation Sequence:"}
                  </span>
                  <span className="font-bold text-gold-300">#{simSeq}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {isId ? "Jumlah Kunci Akses (Keys):" : "Access Keys on Account:"}
                  </span>
                  <span className="font-bold text-segel-400">0 (keys: [])</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Interactive Controls & Attack Tester for Current Step */}
          <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
            {simStep === 1 && (
              <div className="space-y-4">
                <h3 className="font-serif text-2xl font-bold text-white">
                  {isId
                    ? "Tahap 1: Alice Mencetak Kursi s001 Tanpa Kunci Akses"
                    : "Step 1: Alice Mints Seat s001 With Zero Access Keys"}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {isId
                    ? "Saat Alice mencetak kursi, kontrak induk membuat sub-akun `s001.pusaka-c10747.testnet`, mengisi saldo 2.00 NEAR, dan memasang kode brankas — TANPA menambahkan Access Key apa pun. Artinya tidak ada seorang pun (termasuk Alice) yang punya kunci rahasia ke akun tersebut."
                    : "When Alice mints a seat, the registry creates sub-account `s001.pusaka-c10747.testnet`, funds it with 2.00 NEAR, and deploys the vault code — WITHOUT any `AddKey` action. Neither Alice nor anyone else holds a private key to the seat account."}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimStep(2);
                      setSimAttackToast(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-xs font-bold text-obsidian-950 hover:bg-gold-400"
                  >
                    {isId
                      ? "Lanjut ke Tahap 2: Simulasi Bagi Hasil Tiket →"
                      : "Next Step 2: Simulate Ticket Revenue Split →"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSimAttackToast({
                        code: "E_ONLY_REGISTRY",
                        msgId:
                          "Serangan A1 Diblokir! Penyerang mencoba memanggil `vault.v_rotate` langsung ke sub-akun kursi tanpa lewat kontrak induk. Brankas memeriksa `predecessor == registry` dan langsung menolak!",
                        msgEn:
                          "Attack A1 Blocked! Attacker tried calling `vault.v_rotate` directly on the seat sub-account. Vault verifies `predecessor == registry` and aborts immediately!",
                        txHash: "A4JQKpkswwho4k84m66PMSWrGtX3Hmo2da4aiyurUgTq",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-threat-500/40 bg-threat-500/10 px-4 py-2.5 text-xs font-semibold text-threat-400 hover:bg-threat-500/20"
                  >
                    <Flame className="h-4 w-4" />
                    {isId
                      ? "Coba Bobol A1: Panggil v_rotate Langsung"
                      : "Try Attack A1: Direct v_rotate Bypass"}
                  </button>
                </div>
              </div>
            )}

            {simStep === 2 && (
              <div className="space-y-4">
                <h3 className="font-serif text-2xl font-bold text-white">
                  {isId
                    ? "Tahap 2: Tiket Acara Terjual → 40% Masuk ke Brankas Kursi"
                    : "Step 2: Event Tickets Sell → 40% Flows Into Seat Vault"}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {isId
                    ? "Setiap pembelian tiket acara (0.8 NEAR) otomatis dibagi: 40% untuk Pool Anggota (+0.16 NEAR per kursi), 50% untuk Kas Klub, dan 10% untuk Organizer. Klik tombol di bawah untuk menambah penjualan tiket dan lihat saldo di dalam kursi naik secara instan!"
                    : "Every event ticket sold (0.8 NEAR) automatically splits 40% to the Member Pool (+0.16 NEAR/seat), 50% to Kas Klub, and 10% to Organizer. Click below to simulate more ticket sales and watch the seat vault balance grow!"}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimTicketsBought((n) => n + 1);
                      setSimVaultNear((v) => +(v + 0.16).toFixed(2));
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-segel-500/50 bg-segel-500/20 px-4 py-2.5 text-xs font-bold text-segel-400 hover:bg-segel-500/30"
                  >
                    <PlusCircle className="h-4 w-4" />
                    {isId
                      ? "+ Simulasikan Beli 1 Tiket Acara (+0.16 NEAR ke Kursi)"
                      : "+ Simulate 1 Ticket Sale (+0.16 NEAR to Seat)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimStep(3);
                      setSimAttackToast(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-xs font-bold text-obsidian-950 hover:bg-gold-400"
                  >
                    {isId
                      ? "Lanjut ke Tahap 3: Alice Jual Kursi di Pasar →"
                      : "Next Step 3: Alice Lists Seat on Market →"}
                  </button>
                </div>
              </div>
            )}

            {simStep === 3 && (
              <div className="space-y-4">
                <h3 className="font-serif text-2xl font-bold text-white">
                  {isId
                    ? "Tahap 3: Kursi Dipasang di Pasar → Brankas Otomatis Dibekukan!"
                    : "Step 3: Seat is Listed on Market → Vault Automatically Freezes!"}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {isId
                    ? `Alice memasang kursinya di pasar seharga 2.4 NEAR dengan jaminan saldo minimal (min_balance = 1.9 NEAR). Detik itu juga brankas terkunci (status = FROZEN, Nonce #1). Jika Alice mencoba menarik uang ${totalSimBalance} NEAR di dalamnya saat pembeli hendak membayar, brankas langsung menolak!`
                    : `Alice lists her seat for 2.4 NEAR with a minimum balance guarantee (min_balance = 1.9 NEAR). The vault immediately locks (status = FROZEN, Nonce #1). If Alice tries to drain the ${totalSimBalance} NEAR while a buyer is purchasing, the vault rejects her call!`}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSimAttackToast({
                        code: "E_FROZEN",
                        msgId:
                          "Serangan A2 Diblokir! Penjual (Alice) mencoba memanggil `vault.withdraw` saat kursi sedang terpasang di pasar. Karena status brankas = FROZEN, uang di dalam kursi aman 100%!",
                        msgEn:
                          "Attack A2 Blocked! Seller (Alice) tried calling `vault.withdraw` while the seat is listed on the market. Because vault status = FROZEN, the funds cannot be drained!",
                        txHash: "9mq2Yod1M652vNKTHNHEpBzZ6iKjYpcU4GSnesDvoqFi",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-threat-500/50 bg-threat-500/15 px-4 py-2.5 text-xs font-bold text-threat-400 hover:bg-threat-500/25"
                  >
                    <Flame className="h-4 w-4" />
                    {isId
                      ? "🔥 Coba Kuras Brankas sebagai Penjual (Attack A2)"
                      : "🔥 Try Seller Drain While Listed (Attack A2)"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSimAttackToast({
                        code: "E_NONCE_MISMATCH",
                        msgId:
                          "Serangan A3 (Bait-and-Switch) Diblokir! Penjual membatalkan iklan, menguras uang, lalu memasang iklan baru yang kosong. Karena `listing_nonce` naik ke #2, transaksi pembeli yang mengutip `nonce #1` otomatis ditolak & uang pembeli dikembalikan 100%!",
                        msgEn:
                          "Attack A3 (Bait-and-Switch) Blocked! Seller cancelled, drained, and relisted with 0 balance. Because `listing_nonce` incremented to #2, buyer's tx quoting `nonce #1` aborts and refunds 100%!",
                        txHash: "Fy3E1eUtNyvTAQdku4CE8HySZd46v3Sf4fy26DXzy5TY",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-threat-500/40 bg-threat-500/10 px-4 py-2.5 text-xs font-semibold text-threat-400 hover:bg-threat-500/20"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    {isId
                      ? "🔥 Coba Tipu Ganti Iklan Kosong (Attack A3)"
                      : "🔥 Try Bait-and-Switch Relist (Attack A3)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSimStep(4);
                      setSimAttackToast(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-xs font-bold text-obsidian-950 hover:bg-gold-400"
                  >
                    {isId
                      ? "Lanjut ke Tahap 4: Bob Membeli Kursi →"
                      : "Next Step 4: Bob Buys the Seat →"}
                  </button>
                </div>
              </div>
            )}

            {simStep === 4 && (
              <div className="space-y-4">
                <h3 className="font-serif text-2xl font-bold text-segel-400">
                  {isId
                    ? `Tahap 4: Selesai! Bob Kini Memiliki Kursi s001 Beserta ${totalSimBalance} NEAR`
                    : `Step 4: Settled! Bob Now Owns Seat s001 and Its ${totalSimBalance} NEAR`}
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {isId
                    ? `Dalam satu receipt atomik (v_settle_sale), brankas memastikan saldo >= 1.9 NEAR, mengubah owner_id menjadi bob-c10747.testnet, menaikkan rotation_seq menjadi #1, dan menghapus delegate lama. Jika Alice mencoba menarik uang setelah penjualan, brankas langsung menolak!`
                    : `In a single atomic receipt (v_settle_sale), the vault verified withdrawable >= 1.9 NEAR, rotated owner_id to bob-c10747.testnet, incremented rotation_seq to #1, and wiped any delegate. If Alice tries to withdraw after the sale, she is immediately blocked!`}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSimAttackToast({
                        code: "E_NOT_OWNER",
                        msgId:
                          "Serangan A7 Diblokir! Mantan pemilik (Alice) mencoba memanggil `vault.withdraw` setelah kursi dibeli Bob. Brankas memeriksa `owner_id == bob-c10747.testnet` dan menolak panggilan Alice!",
                        msgEn:
                          "Attack A7 Blocked! Former owner (Alice) tried calling `vault.withdraw` after selling to Bob. Vault checks `owner_id == bob-c10747.testnet` and rejects Alice immediately!",
                        txHash: "27UqeoVoe6FYnMb8AbL73M64mMppZqY7Nepb8jZgBaP9",
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-threat-500/50 bg-threat-500/15 px-4 py-2.5 text-xs font-bold text-threat-400 hover:bg-threat-500/25"
                  >
                    <Flame className="h-4 w-4" />
                    {isId
                      ? "🔥 Coba Tarik Uang sebagai Mantan Pemilik (Attack A7)"
                      : "🔥 Try Post-Sale Withdraw as Old Owner (Attack A7)"}
                  </button>
                  <Link
                    href={`/seat/s001.${registryId}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-segel-500 px-5 py-2.5 text-xs font-bold text-obsidian-950 hover:brightness-110"
                  >
                    <UserCheck className="h-4 w-4" />
                    {isId
                      ? "Lihat Kursi s001 Asli di NEAR Testnet →"
                      : "Inspect Real s001 Seat on NEAR Testnet →"}
                  </Link>
                </div>
              </div>
            )}

            {/* Attack Blocked Toast Proof */}
            {simAttackToast && (
              <div className="rounded-2xl border border-threat-500/50 bg-threat-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-threat-400">
                    <ShieldCheck className="h-4 w-4 text-segel-400" />
                    BLOCKED ON-CHAIN · {simAttackToast.code}
                  </span>
                  <a
                    href={`${EXPLORER_URL}/txns/${simAttackToast.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-gold-300 underline hover:text-gold-200"
                  >
                    {isId ? "Lihat Bukti Transaksi di NearBlocks" : "View Live Tx on NearBlocks"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  {isId ? simAttackToast.msgId : simAttackToast.msgEn}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. LIVE ON-CHAIN SEATS SHOWCASE (DIRECT FROM NEAR TESTNET)
         ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              {isId
                ? `Data Langsung dari NEAR Testnet · ${registryId}`
                : `Live On-Chain Data from NEAR Testnet · ${registryId}`}
            </span>
            <h2 className="mt-1 font-serif text-3xl font-bold text-white">
              {isId
                ? "Kursi & Brankas yang Aktif di Blockchain Saat Ini"
                : "Live Keyless Seat Vaults on Testnet Right Now"}
            </h2>
          </div>
          <Link
            href="/seats"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-300 hover:text-gold-200"
          >
            {isId ? "Lihat Semua Kursi & Filter" : "View All Seats & Filters"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingSeats ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-gold-500/20 bg-obsidian-800/50 p-6"
              />
            ))}
          </div>
        ) : liveSeats.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-obsidian-900/70 p-6 text-center text-sm text-slate-400">
            {isId
              ? "Belum ada kursi pada kontrak ini."
              : "No seats minted on this registry yet."}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {liveSeats.map(({ tokenId, seat, vault }) => {
              const isListed = vault?.status === "Listed" || Boolean(seat?.listing);
              return (
                <div
                  key={tokenId}
                  className="flex flex-col justify-between rounded-2xl border border-gold-500/30 bg-obsidian-800/85 p-5 shadow-lg transition hover:border-gold-400"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-gold-400">
                          {isId ? "SUB-AKUN BRANKAS NFT" : "KEYLESS NFT VAULT SUB-ACCOUNT"}
                        </span>
                        <h3 className="font-mono text-base font-bold text-white">
                          {tokenId}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-segel-500/40 bg-segel-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-segel-400">
                          0 Keys
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                            isListed
                              ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                              : "border border-segel-500/40 bg-segel-500/15 text-segel-400"
                          }`}
                        >
                          {isListed
                            ? isId
                              ? "DIJUAL (BEKU)"
                              : "LISTED (FROZEN)"
                            : isId
                            ? "AKTIF (IDLE)"
                            : "ACTIVE (IDLE)"}
                        </span>
                      </div>
                    </div>

                    <div className="my-4 grid grid-cols-3 gap-2.5 font-mono text-xs">
                      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3">
                        <span className="block text-[10px] text-slate-400">
                          {isId ? "SALDO BRANKAS" : "VAULT BALANCE"}
                        </span>
                        <span className="mt-1 block text-sm font-bold text-gold-300">
                          {formatYocto(vault?.balance ?? "0")} NEAR
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3">
                        <span className="block text-[10px] text-slate-400">
                          {isId ? "BISA DITARIK" : "WITHDRAWABLE"}
                        </span>
                        <span className="mt-1 block text-sm font-bold text-segel-400">
                          {formatYocto(vault?.withdrawable ?? "0")} NEAR
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3">
                        <span className="block text-[10px] text-slate-400">
                          {isId ? "PEMILIK & SEQ" : "OWNER & SEQ"}
                        </span>
                        <span className="mt-1 block truncate text-xs font-bold text-white">
                          {vault?.owner_id ?? seat?.owner_id ?? "—"} (#
                          {vault?.rotation_seq ?? seat?.rotation_seq ?? 0})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Link
                      href={`/seat/${tokenId}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gold-500/20 px-4 py-2 text-xs font-semibold text-gold-300 transition hover:bg-gold-500 hover:text-obsidian-950"
                    >
                      {isId ? "Buka Detail & Kontrol Brankas" : "Inspect & Manage Vault"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {isListed && (
                      <Link
                        href="/market"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
                      >
                        <Store className="h-3.5 w-3.5" />
                        {isId ? "Lihat di Pasar Aman" : "View on Safe Market"}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          4. LIVE PROTOCOL TELEMETRY METRICS
         ===================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white">
              {isId ? "Statistik Protokol Live" : "Live Protocol Telemetry"} ·{" "}
              <span className="font-mono text-gold-400">{registryId}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {isId
                ? "Diambil langsung dari RPC NEAR Testnet (`get_stats`, `get_config`, `view_access_key_list`)"
                : "Queried directly from NEAR Testnet RPC (`get_stats` + `get_config` + `view_access_key_list`)"}
            </p>
          </div>
          {!contractDeployed && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {isId
                ? `Kontrak ${registryId} belum ditemukan di testnet.`
                : `Contract ${registryId} not yet deployed on testnet.`}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{isId ? "Kursi Tercetak / Maks" : "Seats Minted / Max"}</span>
              <ShieldCheck className="h-4 w-4 text-gold-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {stats ? `${stats.seats_minted} / ${config?.max_seats ?? "—"}` : "0 / —"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-segel-400">
              {isId ? "Kunci Akun Induk:" : "Parent Segel Keys:"}{" "}
              {parentKeysCount !== null ? `${parentKeysCount} (Tersegel)` : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {isId ? "Akumulator Bagi Hasil (`acc`)" : "O(1) Accumulator (`acc`)"}
              </span>
              <Coins className="h-4 w-4 text-gold-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-gold-300">
              {formatYocto(stats?.acc ?? "0")}{" "}
              <span className="text-sm">{isId ? "NEAR/kursi" : "NEAR/seat"}</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {isId ? "Total Pool Dibagikan:" : "Pool Distributed:"}{" "}
              {formatYocto(stats?.total_pool_distributed ?? "0")} NEAR
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {isId ? "Acara Klub & Tiket Terjual" : "Club Events & Tickets Sold"}
              </span>
              <Layers className="h-4 w-4 text-segel-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {stats?.tickets_sold ?? 0}{" "}
              <span className="text-sm font-normal text-slate-400">
                {isId
                  ? `tiket (${stats?.events_count ?? 0} acara)`
                  : `tickets (${stats?.events_count ?? 0} events)`}
              </span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              Kas Klub: {formatYocto(stats?.kas_klub_owed ?? "0")} NEAR
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {isId ? "Volume Pasar Sekunder Aman" : "Safe Secondary Volume"}
              </span>
              <Store className="h-4 w-4 text-gold-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {formatYocto(stats?.sales_volume ?? "0")}{" "}
              <span className="text-sm font-normal text-slate-400">NEAR</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {stats?.sales_count ?? 0} {isId ? "penjualan atomik" : "atomic sales"} · Royalti:{" "}
              {formatYocto(stats?.royalties_total ?? "0")} NEAR
            </p>
          </div>
        </div>
      </section>

      <KratonDivider
        label={
          isId
            ? "Syarat Utama Track 10 (R1) · Bagaimana Kontrol Berpindah Tanpa Kunci"
            : "Requirement R1 · How Control Moves in One Receipt"
        }
      />

      {/* =====================================================================
          5. INTERACTIVE 3-STEP RECEIPT DIAGRAM
         ===================================================================== */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              {isId
                ? "Bukti Arsitektur · K1 Tanpa Kunci + K2 Brankas Kanonik"
                : "Architectural Proof · K1 Zero Keys + K2 Canonical Vault"}
            </span>
            <h2 className="mt-1 font-serif text-3xl font-bold text-white">
              {isId
                ? "Bagaimana Kepemilikan Berpindah Tanpa Menyentuh Access Key"
                : "How Ownership Rotates Atomically Without Touching Access Keys"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {receiptSteps.map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveReceiptStep(s.step)}
                className={`rounded-xl px-4 py-2 font-mono text-xs font-semibold transition ${
                  activeReceiptStep === s.step
                    ? "border border-gold-400 bg-gold-500 text-obsidian-950 shadow-[0_0_15px_rgba(212,166,74,0.3)]"
                    : "border border-slate-700 bg-obsidian-900 text-slate-300 hover:border-gold-500/40"
                }`}
              >
                Receipt #{s.step}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {receiptSteps.map((s) => {
            const active = activeReceiptStep === s.step;
            return (
              <div
                key={s.step}
                onClick={() => setActiveReceiptStep(s.step)}
                className={`cursor-pointer rounded-2xl border p-5 transition ${
                  active
                    ? "border-gold-400 bg-obsidian-900/95 shadow-[0_0_25px_rgba(212,166,74,0.15)]"
                    : "border-slate-800 bg-obsidian-950/60 opacity-75 hover:opacity-100"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-md border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 font-mono text-[11px] text-gold-300">
                    {s.badge}
                  </span>
                  {s.step === 2 && (
                    <span className="rounded-md bg-segel-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-segel-400">
                      {isId ? "TITIK PUTUS AKSES" : "MOMENT OF CUT-OFF"}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl font-bold text-white">
                  {s.title}
                </h3>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-obsidian-950 p-2.5 font-mono text-[11px] text-gold-300">
                  {s.code}
                </pre>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {s.summary}
                </p>
                <div className="mt-4 space-y-1.5 border-t border-slate-800 pt-3 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vault State:</span>
                    <span className="text-segel-400">{s.vaultState}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Index State:</span>
                    <span className="text-slate-200">{s.indexState}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      {isId ? "Akses Pemilik Lama:" : "Old Owner Access:"}
                    </span>
                    <span
                      className={
                        s.step >= 2 ? "font-bold text-threat-400" : "text-amber-300"
                      }
                    >
                      {s.oldOwnerAccess}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contrast Table: Naive Key-Swap vs Pusaka Zero-Key */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-threat-500/30 bg-threat-500/5 p-5">
            <div className="flex items-center gap-2 text-threat-400">
              <KeyRound className="h-4 w-4" />
              <h4 className="font-serif text-lg font-bold">
                {isId
                  ? "Mengapa NFT Dompet Biasa (Tukar Kunci) Berbahaya?"
                  : "Why Key-Swap NFT Wallets Fail"}
              </h4>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>
                •{" "}
                {isId ? (
                  <>
                    <strong>Kunci Pintu Belakang (Backdoor):</strong> Kontrak pintar NEAR
                    tidak bisa melihat daftar kunci akses di akunnya sendiri. Penjual
                    nakal bisa menyimpan kunci cadangan sebelum menjual NFT.
                  </>
                ) : (
                  <>
                    <strong>Backdoor keys:</strong> A NEAR smart contract cannot
                    enumerate its own access keys on-chain. A seller can plant a backup
                    key before selling.
                  </>
                )}
              </li>
              <li>
                •{" "}
                {isId ? (
                  <>
                    <strong>Kuras Saldo Saat Transaksi:</strong> Pembeli melihat saldo 10
                    NEAR, namun tepat sebelum transaksi beli selesai, penjual menarik
                    habis uangnya.
                  </>
                ) : (
                  <>
                    <strong>Drain before settle:</strong> Buyer sees 10 NEAR in block N,
                    signs a buy tx, and the seller drains the wallet in block N+1.
                  </>
                )}
              </li>
              <li>
                •{" "}
                {isId ? (
                  <>
                    <strong>Sesi Web Masih Terbuka:</strong> Cookie login lama biasanya
                    tetap aktif meskipun NFT sudah dijual ke orang lain.
                  </>
                ) : (
                  <>
                    <strong>Stale web sessions:</strong> Traditional JWT gates stay valid
                    until expiry even after the holder sells the NFT.
                  </>
                )}
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-segel-500/30 bg-segel-500/5 p-5">
            <div className="flex items-center gap-2 text-segel-400">
              <CheckCircle2 className="h-4 w-4" />
              <h4 className="font-serif text-lg font-bold">
                {isId
                  ? "Bagaimana Pusaka Menutup Semua Celah Tersebut?"
                  : "How Pusaka Eliminates Every Seller Vector"}
              </h4>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>
                •{" "}
                {isId ? (
                  <>
                    <strong>0 Kunci Sejak Lahir (K1):</strong> Sub-akun kursi dibuat tanpa
                    `AddKey`. Baik akun induk (`{registryId}`) maupun setiap kursi memiliki
                    `keys.length === 0`.
                  </>
                ) : (
                  <>
                    <strong>Zero keys from birth (K1):</strong> Seat sub-account is
                    created without `AddKey`. Both parent (`{registryId}`) and seat have
                    `keys.length === 0`.
                  </>
                )}
              </li>
              <li>
                •{" "}
                {isId ? (
                  <>
                    <strong>Beku Saat Dijual & Penyelesaian Atomik (K2):</strong>{" "}
                    `list_seat` membekukan penarikan (`E_FROZEN`), dan `v_settle_sale`
                    memverifikasi `nonce` serta `min_balance` tepat di receipt perpindahan
                    pemilik.
                  </>
                ) : (
                  <>
                    <strong>Atomic Vault Settlement (K2):</strong> `list_seat` freezes all
                    outflows (`E_FROZEN`). `v_settle_sale` verifies `nonce` and
                    `min_balance` in the exact receipt that rotates `owner_id`.
                  </>
                )}
              </li>
              <li>
                •{" "}
                {isId ? (
                  <>
                    <strong>Sesi & Delegate Terikat Epoch:</strong> Delegate dan sesi
                    `/lounge` mengikat `rotation_seq` sehingga otomatis gugur detik itu
                    juga saat kursi berpindah.
                  </>
                ) : (
                  <>
                    <strong>Epoch-bound sessions & delegates:</strong> Delegates and
                    `/lounge` cookies bind to `rotation_seq` and die automatically the
                    block a transfer lands.
                  </>
                )}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <KratonDivider
        label={
          isId
            ? "Kalkulator Interaktif Bagi Hasil Tiket O(1) · 40% / 50% / 10%"
            : "O(1) Revenue Split & Remainder Carry Calculator"
        }
      />

      {/* =====================================================================
          6. REVENUE SPLIT VISUALIZER
         ===================================================================== */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-5">
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              {isId
                ? "Keputusan Desain K3 · Akumulator O(1) Bebas Overflow"
                : "Design Decision K3 · Overflow-Safe O(1) Accumulator"}
            </span>
            <h2 className="font-serif text-3xl font-bold text-white">
              40% Pool Anggota · 50% Kas Klub · 10% Organizer
            </h2>
            <p className="text-xs leading-relaxed text-slate-300">
              {isId
                ? "Setiap pembelian tiket acara otomatis membagi pendapatan. Porsi 40% Pool Anggota memperbarui akumulator global (`acc += (pool + carry) / seats`) dalam gas O(1) yang konstan meskipun ada ribuan anggota. Sisa pembagian yoctoNEAR disimpan di `carry` sehingga tidak ada 1 yoctoNEAR pun yang hilang."
                : "Every event ticket purchase splits payment automatically. The 40% Pool Anggota updates a global per-seat accumulator (`acc += (pool + carry) / seats`) in O(1) gas without looping over members. Any integer division remainder is carried into the next ticket."}
            </p>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {["0.8", "10", "25", "100"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCalcTicketNear(val)}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${
                    calcTicketNear === val
                      ? "border-gold-400 bg-gold-500/20 text-gold-300"
                      : "border-slate-700 bg-obsidian-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {val} NEAR
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {isId ? "Harga Tiket (NEAR)" : "Ticket Payment (NEAR)"}
                </label>
                <input
                  type="text"
                  value={calcTicketNear}
                  onChange={(e) => setCalcTicketNear(e.target.value)}
                  className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2 font-mono text-sm text-white focus:border-gold-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  {isId ? "Jumlah Kursi (seats_minted)" : "Minted Seats"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={calcSeatsCount}
                  onChange={(e) =>
                    setCalcSeatsCount(Math.max(0, Number(e.target.value)))
                  }
                  className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2 font-mono text-sm text-white focus:border-gold-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-obsidian-950 p-2">
              <div className="flex h-8 w-full overflow-hidden rounded-lg font-mono text-xs font-bold">
                <div
                  style={{ width: "40%" }}
                  className="flex items-center justify-center bg-gradient-to-r from-gold-500 to-gold-400 text-obsidian-950"
                >
                  40% Pool Anggota
                </div>
                <div
                  style={{ width: "50%" }}
                  className="flex items-center justify-center bg-segel-500/80 text-obsidian-950"
                >
                  50% Kas Klub
                </div>
                <div
                  style={{ width: "10%" }}
                  className="flex items-center justify-center bg-indigo-500 text-white"
                >
                  10%
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-gold-500/30 bg-obsidian-950 p-4">
                <span className="font-mono text-[11px] text-gold-400">
                  40% POOL ANGGOTA
                </span>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {formatYocto(calcSplitResult.pool)} NEAR
                </p>
                <p className="mt-1 font-mono text-[11px] text-gold-300">
                  +{formatYocto(calcSplitResult.perSeat, 6)}{" "}
                  {isId ? "NEAR / kursi" : "NEAR / seat"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  Carry: {calcSplitResult.carry.toString()} yocto
                </p>
              </div>

              <div className="rounded-2xl border border-segel-500/30 bg-obsidian-950 p-4">
                <span className="font-mono text-[11px] text-segel-400">
                  50% KAS KLUB (TREASURY)
                </span>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {formatYocto(calcSplitResult.kas)} NEAR
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {calcSplitResult.redirectedToKas > 0n
                    ? isId
                      ? "Termasuk 40% pool (jika 0 kursi)"
                      : "Includes 40% pool (0 seats minted)"
                    : isId
                    ? "Masuk ke buku besar Kas Klub"
                    : "Pull ledger to Kas Klub account"}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-500/30 bg-obsidian-950 p-4">
                <span className="font-mono text-[11px] text-indigo-300">
                  10% ORGANIZER
                </span>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {formatYocto(calcSplitResult.organizer)} NEAR
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {isId
                    ? "Ditarik via release_organizer()"
                    : "Pull ledger via release_organizer()"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
