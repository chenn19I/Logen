"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Flame,
  Coins,
  Store,
  Snowflake,
  Terminal,
  ExternalLink,
  PlusCircle,
  Send,
  Download,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import {
  BentoCard,
  SeatArtifact3D,
  SPRING_RELIC,
} from "@/components/TactileBento";
import { KratonDivider } from "@/components/KawungOrnament";
import {
  EXPLORER_URL,
  getListings,
  getNftTokens,
  getSeat,
  getVaultOutflows,
  getVaultState,
} from "@/lib/near/rpc";
import type {
  ListingView,
  SeatView,
  VaultOutflow,
  VaultStateView,
} from "@/lib/near/types";
import {
  formatTimestampMs,
  formatYocto,
  parseNearToYocto,
  splitTicketRevenue,
} from "@/lib/near/format";

interface LiveSeatBundle {
  tokenId: string;
  seat: SeatView | null;
  vault: VaultStateView | null;
}

interface EnrichedListing {
  listing: ListingView;
  vault: VaultStateView | null;
}

interface AttackScenarioItem {
  id: string;
  badge: "BLOCKED" | "AMAN";
  titleId: string;
  titleEn: string;
  descId: string;
  descEn: string;
  errorCode: string;
  txHash: string;
  receiptLogs: string[];
}

const JUDGE_ATTACK_SCENARIOS: AttackScenarioItem[] = [
  {
    id: "S1",
    badge: "BLOCKED",
    titleId: "Skenario 1: Penjual Menguras Saldo Saat Seat Sedang Di-Listing",
    titleEn: "Scenario 1: Seller Drains Balance While Seat is Listed",
    descId:
      "Penjual memasang Seat di pasar lalu mengirim transaksi vault.withdraw() tepat sebelum pembeli membayar.",
    descEn:
      "Seller lists the Seat on the market, then races a vault.withdraw() call right before the buyer settles.",
    errorCode: "E_FROZEN (Status Vault: Listed / Frozen)",
    txHash: "9mq2Yod1M652vNKTHNHEpBzZ6iKjYpcU4GSnesDvoqFi",
    receiptLogs: [
      "[Receipt #1] alice -> registry.list_seat({ token_id: 's001', price: '2.4 N', min_balance: '1.9 N' }) => OK",
      "[Receipt #2] registry -> s001.v_list(...) => status = Frozen, listing_nonce = #1",
      "[ATTACK TX ] alice -> s001.withdraw({ amount: '1.9 N' })",
      "[VAULT GUARD] authorize_withdraw() checks self.status == Idle -> FAILED!",
      "[RESULT    ] [BLOCKED] SmartContractPanic: E_FROZEN — Saldo tetap utuh di dalam vault.",
    ],
  },
  {
    id: "S2",
    badge: "BLOCKED",
    titleId: "Skenario 2: Penjual Menyisakan Access Key Sebelum Menjual",
    titleEn: "Scenario 2: Seller Plants a Backdoor Access Key Before Selling",
    descId:
      "Penjual mencoba menyimpan FullAccess atau FunctionCall key cadangan di akun sub-account kursi.",
    descEn:
      "Seller attempts to retain a FullAccess or FunctionCall key on the seat sub-account.",
    errorCode: "0_ACCESS_KEYS (view_access_key_list == [])",
    txHash: "FUCMGkn9yuqBuRF5Xt9sFTWbVdsUkJBou3KcUkyjXTFG",
    receiptLogs: [
      "[Receipt #1] registry.mint_seat() dispatches Atomic Batch Receipt to s001:",
      "             Action 1: CreateAccount",
      "             Action 2: Transfer(2.00 NEAR)",
      "             Action 3: DeployContract(sha256=DFuv6MrV...PLmwSg)",
      "             Action 4: FunctionCall('init')  <-- NO AddKey Action!",
      "[RPC AUDIT ] query view_access_key_list('s001') => keys: [] (0 Keys)",
      "[RESULT    ] [BLOCKED] Sub-account lahir tanpa kunci; kontrak vault tidak memiliki host call add_key.",
    ],
  },
  {
    id: "S3",
    badge: "AMAN",
    titleId: "Skenario 3: Penjualan Terjadi Tepat di Tengah Pembagian Payout Tiket",
    titleEn: "Scenario 3: Sale Lands Right in the Middle of a Ticket Payout",
    descId:
      "Pembelian tiket event, klaim bagi hasil, dan penyelesaian jual-beli berlangsung bersamaan lintas blok (diuji di 75.600 urutan receipt).",
    descEn:
      "Ticket purchase, pool claim, and market settlement interleave across blocks (proven across 75,600 receipt schedules).",
    errorCode: "INVARIANT_HELD (Dana Melekat pada Sub-Account Seat)",
    txHash: "3GnFKFSqqBLhoWjhmwcuRXKsWEh14HbzjFUh8iKkQAqo",
    receiptLogs: [
      "[Receipt #1] fan -> registry.buy_ticket({ event_id: 0 }) => acc += 0.16 NEAR/seat",
      "[Receipt #2] bob -> registry.buy_seat({ token_id: 's001', nonce: 1, min_balance: '1.9 N' })",
      "[Receipt #3] s001.v_settle_sale() => owner_id = bob, rotation_seq = #1, status = Idle",
      "[Receipt #4] anyone -> registry.claim({ token_id: 's001' }) => Transfer(0.16 N) -> Promise::new('s001')",
      "[RESULT    ] [AMAN] Payout mendarat langsung di vault s001 dan 100% dimiliki pemegang saat itu (Bob).",
    ],
  },
  {
    id: "S4",
    badge: "BLOCKED",
    titleId: "Skenario 4: Mantan Pemilik Memakai Delegate Lama atau Sesi Web Lama",
    titleEn: "Scenario 4: Former Owner Uses Stale Delegate or Old Lounge Session",
    descId:
      "Setelah menjual Seat ke Bob, Alice mencoba menarik dana lewat delegate lama atau membuka Member Lounge memakai cookie lama.",
    descEn:
      "After selling the Seat to Bob, Alice invokes delegate_withdraw or reuses her old Member Lounge session cookie.",
    errorCode: "E_NOT_OWNER / E_NO_DELEGATE / 403 SEQ_ROTATED",
    txHash: "27UqeoVoe6FYnMb8AbL73M64mMppZqY7Nepb8jZgBaP9",
    receiptLogs: [
      "[Vault Rot ] v_settle_sale() rotated owner: alice -> bob | rotation_seq: #0 -> #1 | delegate = None",
      "[ATTACK #4A] accomplice -> s001.delegate_withdraw() => PANIC: E_NO_DELEGATE",
      "[ATTACK #4B] alice -> s001.withdraw() => PANIC: E_NOT_OWNER",
      "[ATTACK #4C] alice -> GET /api/gate/content (cookie seq=#0 vs chain seq=#1) => HTTP 403 SEQ_ROTATED",
      "[RESULT    ] [BLOCKED] Seluruh akses on-chain & sesi web lama gugur pada blok rotasi yang sama.",
    ],
  },
];

export default function HomePage() {
  const router = useRouter();
  const {
    lang,
    accountId,
    registryId,
    config,
    stats,
    openWalletModal,
    callContractMethod,
  } = useNear();

  const isId = lang === "id";

  // Showcase vs Live On-Chain Switcher for 3D Artifact Card
  const [artifactMode, setArtifactMode] = useState<"showcase007" | "live">("showcase007");
  const [mintModalOpen, setMintModalOpen] = useState<boolean>(false);
  const [mintHandle, setMintHandle] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Live Chain Data
  const [liveSeats, setLiveSeats] = useState<LiveSeatBundle[]>([]);
  const [listings, setListings] = useState<EnrichedListing[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string>("");
  const [outflows, setOutflows] = useState<VaultOutflow[]>([]);
  const [loadingChainData, setLoadingChainData] = useState<boolean>(true);

  // Module C: Accumulator Simulator
  const [simTicketNear, setSimTicketNear] = useState<string>("10");

  // Module D: Vault Control Tabs ("claim" | "withdraw" | "delegate" | "move")
  const [vaultTab, setVaultTab] = useState<"claim" | "withdraw" | "delegate" | "move">("claim");
  const [withdrawNearInput, setWithdrawNearInput] = useState<string>("0.1");
  const [delegateAccountInput, setDelegateAccountInput] = useState<string>("");
  const [delegateCapInput, setDelegateCapInput] = useState<string>("0.5");
  const [listPriceInput, setListPriceInput] = useState<string>("3.0");
  const [listMinBalInput, setListMinBalInput] = useState<string>("1.9");
  const [transferToInput, setTransferToInput] = useState<string>("");
  const [isExecutingVault, setIsExecutingVault] = useState<boolean>(false);

  // Module F: Attack Lab Console
  const [activeScenarioId, setActiveScenarioId] = useState<string>("S1");

  const loadAllLiveBentoData = useCallback(async () => {
    setLoadingChainData(true);
    try {
      const [tokens, rawListings] = await Promise.all([
        getNftTokens(registryId, "0", 12),
        getListings(registryId),
      ]);

      const seatBundles = await Promise.all(
        tokens.map(async (t) => {
          const [seat, vault] = await Promise.all([
            getSeat(t.token_id, registryId),
            getVaultState(t.token_id),
          ]);
          return { tokenId: t.token_id, seat, vault };
        })
      );

      const enrichedListings = await Promise.all(
        rawListings.map(async (l) => {
          const vault = await getVaultState(l.token_id);
          return { listing: l, vault };
        })
      );

      setLiveSeats(seatBundles);
      setListings(enrichedListings);

      if (seatBundles.length > 0) {
        const chosen =
          seatBundles.find(
            (b) => accountId && (b.vault?.owner_id === accountId || b.seat?.owner_id === accountId)
          )?.tokenId || seatBundles[0].tokenId;
        setSelectedVaultId((prev) => prev || chosen);
      }
    } finally {
      setLoadingChainData(false);
    }
  }, [registryId, accountId]);

  useEffect(() => {
    loadAllLiveBentoData();
  }, [loadAllLiveBentoData]);

  useEffect(() => {
    let cancelled = false;
    async function loadSelectedOutflows() {
      if (!selectedVaultId) return;
      try {
        const rows = await getVaultOutflows(selectedVaultId);
        if (!cancelled) setOutflows(rows);
      } catch {
        if (!cancelled) setOutflows([]);
      }
    }
    loadSelectedOutflows();
    return () => {
      cancelled = true;
    };
  }, [selectedVaultId]);

  const activeSeatBundle =
    liveSeats.find((s) => s.tokenId === selectedVaultId) || liveSeats[0] || null;

  const activeScenario =
    JUDGE_ATTACK_SCENARIOS.find((s) => s.id === activeScenarioId) ||
    JUDGE_ATTACK_SCENARIOS[0];

  const seatPriceYocto = config?.seat_price || "2200000000000000000000000";

  // Revenue Split Math
  const seatsCountForCalc = stats?.seats_minted && stats.seats_minted > 0 ? stats.seats_minted : 7;
  let splitPreview = splitTicketRevenue(
    "10000000000000000000000000",
    config?.default_bps || { pool: 4000, kas: 5000, organizer: 1000 },
    seatsCountForCalc
  );
  try {
    splitPreview = splitTicketRevenue(
      parseNearToYocto(simTicketNear || "0"),
      config?.default_bps || { pool: 4000, kas: 5000, organizer: 1000 },
      seatsCountForCalc
    );
  } catch {
    // ignore invalid decimal input
  }

  // Handlers for Real On-Chain Interactions
  const handleMintSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsMinting(true);
    setActionToast(null);
    try {
      const args: Record<string, unknown> = { receiver_id: accountId };
      if (mintHandle.trim()) {
        args.handle = mintHandle.trim().toLowerCase();
      }
      await callContractMethod({
        receiverId: registryId,
        methodName: "mint_seat",
        args,
        gas: "220000000000000",
        deposit: seatPriceYocto,
      });
      setMintHandle("");
      setMintModalOpen(false);
      setActionToast(
        isId
          ? "Seat baru berhasil dicetak dengan 0 Access Keys!"
          : "New Keyless Seat minted with 0 Access Keys!"
      );
      await loadAllLiveBentoData();
    } catch (err) {
      setActionToast(err instanceof Error ? err.message : String(err));
    } finally {
      setIsMinting(false);
    }
  };

  const handleAtomicBuyListing = async (item: EnrichedListing) => {
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsExecutingVault(true);
    setActionToast(null);
    try {
      await callContractMethod({
        receiverId: registryId,
        methodName: "buy_seat",
        args: {
          token_id: item.listing.token_id,
          expected_nonce: item.listing.nonce,
          min_vault_balance: item.listing.min_balance,
        },
        gas: "150000000000000",
        deposit: item.listing.price,
      });
      setActionToast(
        isId
          ? `Berhasil membeli ${item.listing.token_id} beserta isi vault-nya!`
          : `Atomically bought ${item.listing.token_id} and its vault!`
      );
      await loadAllLiveBentoData();
    } catch (err) {
      setActionToast(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecutingVault(false);
    }
  };

  const handleVaultCommand = async (kind: "claim" | "withdraw" | "delegate" | "list" | "transfer" | "kas") => {
    if (!accountId) {
      openWalletModal();
      return;
    }
    const targetTokenId = activeSeatBundle?.tokenId || `s001.${registryId}`;
    setIsExecutingVault(true);
    setActionToast(null);
    try {
      if (kind === "claim") {
        await callContractMethod({
          receiverId: registryId,
          methodName: "claim",
          args: { token_id: targetTokenId },
          gas: "80000000000000",
          deposit: "0",
        });
        setActionToast(`Claimed pool revenue into vault ${targetTokenId}!`);
      } else if (kind === "kas") {
        await callContractMethod({
          receiverId: registryId,
          methodName: "release_kas_klub",
          args: {},
          gas: "40000000000000",
          deposit: "0",
        });
        setActionToast("Released Kas Klub pull ledger!");
      } else if (kind === "withdraw") {
        await callContractMethod({
          receiverId: targetTokenId,
          methodName: "withdraw",
          args: {
            amount: parseNearToYocto(withdrawNearInput),
            to: accountId,
          },
          gas: "60000000000000",
          deposit: "1",
        });
        setActionToast(`Withdrew ${withdrawNearInput} NEAR from ${targetTokenId}!`);
      } else if (kind === "delegate") {
        await callContractMethod({
          receiverId: targetTokenId,
          methodName: "set_delegate",
          args: {
            delegate_id: delegateAccountInput.trim(),
            allowance: parseNearToYocto(delegateCapInput),
            ttl_sec: 3600,
          },
          gas: "40000000000000",
          deposit: "1",
        });
        setActionToast(`Bound epoch delegate on ${targetTokenId}!`);
      } else if (kind === "list") {
        await callContractMethod({
          receiverId: registryId,
          methodName: "list_seat",
          args: {
            token_id: targetTokenId,
            price: parseNearToYocto(listPriceInput),
            min_balance: parseNearToYocto(listMinBalInput),
            ttl_sec: 86400,
          },
          gas: "100000000000000",
          deposit: "1",
        });
        setActionToast(`Listed & froze ${targetTokenId} for Safe Sale!`);
      } else if (kind === "transfer") {
        await callContractMethod({
          receiverId: registryId,
          methodName: "nft_transfer",
          args: {
            receiver_id: transferToInput.trim(),
            token_id: targetTokenId,
          },
          gas: "100000000000000",
          deposit: "1",
        });
        setActionToast(`Rotated ${targetTokenId} atomically to ${transferToInput.trim()}!`);
      }
      await loadAllLiveBentoData();
    } catch (err) {
      setActionToast(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecutingVault(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Global Toast Notification */}
      <AnimatePresence>
        {actionToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={SPRING_RELIC}
            className="flex items-center justify-between rounded-2xl border border-[#00EC97]/40 bg-[#0B0F1A]/95 px-4 py-3 font-mono text-xs text-[#00EC97] shadow-jade backdrop-blur-2xl"
          >
            <span>{actionToast}</span>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              className="ml-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          MODULE B: HERO & KARTU ARTEFAK 3D INTERAKTIF (SEAT SHOWCASE)
         ===================================================================== */}
      <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Hero Typography & Tactile Actions */}
        <div className="space-y-6 lg:col-span-7">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border-t border-white/15 border-x border-b border-white/[0.06] bg-[#0B0F1A]/80 px-3.5 py-1.5 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-[#00EC97] shadow-[0_0_10px_#00EC97]" />
            <span className="font-mono text-[11px] font-semibold text-[#00EC97]">
              TACTILE CRYPTOGRAPHIC RELIC
            </span>
            <span className="text-white/20">·</span>
            <span className="font-mono text-[11px] text-slate-300">
              NEAR Track 10: NFTs That Do Something
            </span>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#00EC97]">
              &ldquo;Keanggotaan yang diwariskan bersama isinya&rdquo;
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.06] tracking-[-0.035em] text-white sm:text-5xl lg:text-[56px]">
              {isId ? (
                <>
                  Membership NFT yang Membawa{" "}
                  <span className="bg-gradient-to-r from-[#00EC97] via-[#5CFFB8] to-white bg-clip-text text-transparent">
                    Brankas Tanpa Kunci.
                  </span>
                </>
              ) : (
                <>
                  The Membership NFT That Carries{" "}
                  <span className="bg-gradient-to-r from-[#00EC97] via-[#5CFFB8] to-white bg-clip-text text-transparent">
                    Its Own Keyless Vault.
                  </span>
                </>
              )}
            </h1>
          </div>

          <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {isId ? (
              <>
                Setiap Seat Pusaka adalah token <code className="font-mono text-[#00EC97]">NEP-171</code>{" "}
                sekaligus sub-account NEAR asli (<code className="font-mono text-white">sNNN.{registryId}</code>)
                yang lahir dengan <strong className="text-[#00EC97]">0 Access Keys</strong>. Ia
                menyimpan saldo NEAR, menerima <strong className="text-white">40% bagi hasil tiket event</strong>{" "}
                secara otomatis, dan membekukan pengeluaran saat di-listing agar penjual
                mustahil menyisakan kunci belakang atau menguras dompet.
              </>
            ) : (
              <>
                Every Pusaka Seat is both an <code className="font-mono text-[#00EC97]">NEP-171</code>{" "}
                token and its own NEAR sub-account (<code className="font-mono text-white">sNNN.{registryId}</code>)
                born with <strong className="text-[#00EC97]">0 Access Keys</strong>. It holds
                liquid NEAR, accrues <strong className="text-white">40% of club event ticket sales</strong>{" "}
                in O(1), and settles secondary trades atomically inside the vault so the former
                owner keeps zero access.
              </>
            )}
          </p>

          {/* Hero CTA Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_RELIC}
              onClick={() => setMintModalOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#00EC97] px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider text-[#06080D] shadow-jade transition hover:brightness-110"
            >
              <PlusCircle className="h-4 w-4" />
              {isId ? "Mint Vault Seat Baru" : "Mint Keyless Seat"}
            </motion.button>

            <Link
              href="/market"
              className="inline-flex items-center gap-2 rounded-2xl border-t border-white/15 border-x border-b border-white/[0.07] bg-[#0B0F1A]/90 px-5 py-3.5 text-xs font-bold text-white backdrop-blur-xl transition hover:border-[#F59E0B]/50 hover:text-[#FBBF24]"
            >
              <Snowflake className="h-4 w-4 text-[#F59E0B]" />
              Safe Sale Market
            </Link>

            <Link
              href="/lounge"
              className="inline-flex items-center gap-2 rounded-2xl border-t border-white/15 border-x border-b border-white/[0.07] bg-[#0B0F1A]/90 px-4 py-3.5 text-xs font-semibold text-slate-200 backdrop-blur-xl transition hover:border-[#00EC97]/50 hover:text-[#00EC97]"
            >
              <Lock className="h-4 w-4 text-[#00EC97]" />
              Member Lounge
            </Link>

            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/10 px-4 py-3.5 text-xs font-semibold text-[#F87171] transition hover:bg-[#EF4444]/20"
            >
              <Flame className="h-4 w-4" />
              Attack Lab
            </Link>
          </div>

          {/* Expandable Mint Drawer */}
          <AnimatePresence>
            {mintModalOpen && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING_RELIC}
                onSubmit={handleMintSeat}
                className="overflow-hidden rounded-2xl border-t border-white/15 border-x border-b border-[#00EC97]/30 bg-[#0B0F1A]/95 p-4 backdrop-blur-2xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-[#06080D] px-3 py-2.5">
                    <input
                      type="text"
                      value={mintHandle}
                      onChange={(e) => setMintHandle(e.target.value)}
                      placeholder={isId ? "handle-opsional (mis. s007)" : "optional-handle (e.g. s007)"}
                      className="w-full bg-transparent font-mono text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <span className="font-mono text-xs text-[#00EC97]">.{registryId}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isMinting}
                    className="rounded-xl bg-[#00EC97] px-4 py-2.5 font-mono text-xs font-bold text-[#06080D] shadow-jade-sm disabled:opacity-50"
                  >
                    {isMinting
                      ? "Minting..."
                      : `Mint (${formatYocto(seatPriceYocto)} NEAR)`}
                  </button>
                </div>
                <p className="mt-2 font-mono text-[11px] text-slate-400">
                  Batch 1-Receipt: CreateAccount → Transfer(2.0 N) → DeployContract → init (0 Access Keys)
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Interactive 3D Monument Card (Seat #007 Showcase + Live Testnet Toggle) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[11px] text-slate-400">
              {isId ? "Gerakkan kursor di atas artefak:" : "Hover cursor to tilt 3D relic:"}
            </span>
            <div className="inline-flex rounded-full border border-white/10 bg-[#0B0F1A] p-0.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setArtifactMode("showcase007")}
                className={`rounded-full px-2.5 py-1 font-semibold transition ${
                  artifactMode === "showcase007"
                    ? "bg-[#00EC97] text-[#06080D]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Seat #007 Relic
              </button>
              <button
                type="button"
                onClick={() => setArtifactMode("live")}
                className={`rounded-full px-2.5 py-1 font-semibold transition ${
                  artifactMode === "live"
                    ? "bg-[#00EC97] text-[#06080D]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Live s001 Testnet
              </button>
            </div>
          </div>

          {artifactMode === "showcase007" ? (
            <SeatArtifact3D
              seatLabel="PUSAKA RELIC MONUMENT · SEAT #007"
              tokenId="s007.pusaka.testnet"
              ownerId="aria.near"
              vaultBalanceNear="45.80"
              claimableNear="4.20"
              rotationSeq={4}
              status="Idle"
              codeHash={
                config?.vault_code_hash ||
                "DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg"
              }
              isId={isId}
              onInspectClick={() =>
                router.push(`/seat/${activeSeatBundle?.tokenId || `s001.${registryId}`}`)
              }
            />
          ) : (
            <SeatArtifact3D
              seatLabel={`LIVE TESTNET RELIC · ${registryId.toUpperCase()}`}
              tokenId={activeSeatBundle?.tokenId || `s001.${registryId}`}
              ownerId={
                activeSeatBundle?.vault?.owner_id ||
                activeSeatBundle?.seat?.owner_id ||
                "bob-c10747.testnet"
              }
              vaultBalanceNear={formatYocto(
                activeSeatBundle?.vault?.balance || "2160000000000000000000000",
                2
              )}
              claimableNear={formatYocto(
                activeSeatBundle?.seat?.claimable || "0",
                2
              )}
              rotationSeq={
                activeSeatBundle?.vault?.rotation_seq ??
                activeSeatBundle?.seat?.rotation_seq ??
                1
              }
              status={activeSeatBundle?.vault?.status || "Idle"}
              codeHash={
                config?.vault_code_hash ||
                "DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg"
              }
              isId={isId}
              onInspectClick={() =>
                router.push(`/seat/${activeSeatBundle?.tokenId || `s001.${registryId}`}`)
              }
            />
          )}
        </div>
      </section>

      <KratonDivider
        label={
          isId
            ? "MODUL C · BENTO GRID PASAR SEKUNDER (SAFE SALE) & AKUMULATOR TIKET"
            : "MODULE C · SAFE SALE BENTO MARKET & O(1) TICKET ACCUMULATOR"
        }
      />

      {/* =====================================================================
          MODULE C: BENTO GRID PASAR SEKUNDER (SAFE SALE) + AKUMULATOR TIKET
         ===================================================================== */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Left Bento (7 Cols): Frozen Glass Safe Sale Market */}
        <BentoCard variant="frozen" className="p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F59E0B]/20 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FBBF24]">
                <Snowflake className="h-3.5 w-3.5" />
                FROZEN GLASS · ATOMIC SAFE SALE MARKET
              </div>
              <h2 className="mt-1 text-2xl font-extrabold text-white">
                {isId
                  ? "Beli Seat Beserta Isi Brankasnya dalam 1 Receipt"
                  : "Buy the Seat & Its Locked Vault Balance Atomically"}
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                {isId
                  ? "Saat di-listing, seluruh pengeluaran vault & delegate dibekukan (Frozen). v_settle_sale memverifikasi listing_nonce dan min_balance tepat di receipt perpindahan owner."
                  : "Listing freezes all vault outflows & delegates. v_settle_sale verifies listing_nonce and min_balance in the exact receipt that rotates ownership."}
              </p>
            </div>
            <Link
              href="/market"
              className="inline-flex items-center gap-1 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-3 py-1.5 font-mono text-xs font-bold text-[#FBBF24] transition hover:bg-[#F59E0B]/25"
            >
              {isId ? "Pasar Penuh" : "Full Market"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {loadingChainData ? (
              <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#06080D]/70 p-6 text-center text-xs text-slate-400">
                {isId
                  ? "Tidak ada seat yang sedang dibekukan di pasar saat ini."
                  : "No active frozen listings right now."}
              </div>
            ) : (
              listings.map((item) => (
                <div
                  key={item.listing.token_id}
                  className="rounded-2xl border border-[#F59E0B]/35 bg-[#06080D]/80 p-4 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-base font-bold text-white">
                        {item.listing.token_id}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        seller: {item.listing.seller}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#F59E0B]/50 bg-[#F59E0B]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#FBBF24]">
                      <Snowflake className="h-3 w-3" />
                      LISTED · FROZEN (NONCE #{item.listing.nonce})
                    </span>
                  </div>

                  {/* Side-by-Side Price vs Locked Min Balance */}
                  <div className="my-3.5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.07] bg-[#0B0F1A] p-3">
                      <span className="block font-mono text-[10px] text-slate-400">
                        {isId ? "HARGA JUAL SEAT" : "LISTING PRICE"}
                      </span>
                      <span className="mt-0.5 block font-mono text-lg font-bold text-white">
                        {formatYocto(item.listing.price, 2)} NEAR
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.07] p-3">
                      <span className="block font-mono text-[10px] text-[#FBBF24]">
                        {isId ? "JAMINAN SALDO TERKUNCI" : "LOCKED MIN_BALANCE"}
                      </span>
                      <span className="mt-0.5 block font-mono text-lg font-bold text-[#FBBF24]">
                        ≥ {formatYocto(item.listing.min_balance, 2)} NEAR
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#00EC97]/25 bg-[#00EC97]/[0.06] p-3">
                      <span className="block font-mono text-[10px] text-[#00EC97]">
                        {isId ? "SALDO AKTUAL VAULT" : "ACTUAL VAULT BALANCE"}
                      </span>
                      <span className="mt-0.5 block font-mono text-lg font-bold text-[#00EC97]">
                        {formatYocto(item.vault?.balance || item.listing.min_balance, 2)} NEAR
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      0 Access Keys · Delegate Wiped · Atomic{" "}
                      <code className="text-[#00EC97]">v_settle_sale</code>
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_RELIC}
                      disabled={isExecutingVault}
                      onClick={() => handleAtomicBuyListing(item)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#00EC97] px-4 py-2.5 text-xs font-extrabold text-[#06080D] shadow-jade-sm transition hover:brightness-110 disabled:opacity-50"
                    >
                      <Store className="h-3.5 w-3.5" />
                      {isId ? "Beli Seat & Dompet" : "Buy Seat & Vault"} (
                      {formatYocto(item.listing.price, 2)} N)
                    </motion.button>
                  </div>
                </div>
              ))
            )}
          </div>
        </BentoCard>

        {/* Right Bento (5 Cols): Panel Akumulator Tiket & Kas Klub */}
        <BentoCard variant="jade" className="flex flex-col justify-between p-6 lg:col-span-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00EC97]">
                  O(1) REVENUE ACCUMULATOR · PULL LEDGERS
                </span>
                <h3 className="mt-1 text-xl font-extrabold text-white">
                  {isId ? "Akumulator Tiket & Kas Klub" : "Ticket Pool & Club Treasury"}
                </h3>
              </div>
              <Coins className="h-5 w-5 text-[#00EC97]" />
            </div>

            {/* 40 / 50 / 10 Segmented Bar */}
            <div className="space-y-2">
              <div className="flex h-7 w-full overflow-hidden rounded-xl border border-white/10 bg-[#06080D] p-1 font-mono text-[10px] font-bold">
                <div
                  style={{ width: "40%" }}
                  className="flex items-center justify-center rounded-l-lg bg-[#00EC97] text-[#06080D]"
                >
                  40% Pool
                </div>
                <div
                  style={{ width: "50%" }}
                  className="flex items-center justify-center bg-[#10B981]/35 text-white"
                >
                  50% Kas Klub
                </div>
                <div
                  style={{ width: "10%" }}
                  className="flex items-center justify-center rounded-r-lg bg-white/15 text-slate-200"
                >
                  10%
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-400">
                  {isId ? "Simulasi Harga Tiket (NEAR):" : "Simulate Ticket Sale (NEAR):"}
                </span>
                <input
                  type="text"
                  value={simTicketNear}
                  onChange={(e) => setSimTicketNear(e.target.value)}
                  className="w-24 rounded-lg border border-white/15 bg-[#06080D] px-2.5 py-1 text-right font-mono text-xs text-[#00EC97] focus:border-[#00EC97] focus:outline-none"
                />
              </div>
            </div>

            {/* Live Acc & Ledger Telemetry */}
            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              <div className="rounded-2xl border border-white/[0.07] bg-[#06080D]/80 p-3">
                <span className="block text-[10px] text-slate-400">
                  40% POOL (+/SEAT)
                </span>
                <span className="mt-1 block text-base font-bold text-[#00EC97]">
                  +{formatYocto(splitPreview.perSeat, 4)} N
                </span>
                <span className="block text-[10px] text-slate-500">
                  acc: {formatYocto(stats?.acc || "0", 3)} N
                </span>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#06080D]/80 p-3">
                <span className="block text-[10px] text-slate-400">
                  50% KAS KLUB LEDGER
                </span>
                <span className="mt-1 block text-base font-bold text-white">
                  {formatYocto(stats?.kas_klub_owed || "0", 3)} N
                </span>
                <span className="block text-[10px] text-slate-500">
                  +{formatYocto(splitPreview.kas, 2)} N / tx
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              disabled={isExecutingVault}
              onClick={() => handleVaultCommand("claim")}
              className="flex-1 rounded-xl bg-[#00EC97]/15 border border-[#00EC97]/40 px-3 py-2.5 font-mono text-xs font-bold text-[#00EC97] transition hover:bg-[#00EC97] hover:text-[#06080D]"
            >
              {isId ? "Klaim Pool → Vault" : "Claim Pool → Vault"}
            </button>
            <button
              type="button"
              disabled={isExecutingVault}
              onClick={() => handleVaultCommand("kas")}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              {isId ? "Rilis Kas Klub" : "Release Kas"}
            </button>
            <Link
              href="/events"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-slate-300 hover:text-[#00EC97]"
            >
              Events →
            </Link>
          </div>
        </BentoCard>
      </section>

      <KratonDivider
        label={
          isId
            ? "MODUL D · DASHBOARD KENDALI VAULT (SPEND DI VAULT, MOVE DI REGISTRY)"
            : "MODULE D · VAULT CONTROL DECK (SPEND AT VAULT, MOVE AT REGISTRY)"
        }
      />

      {/* =====================================================================
          MODULE D: DASHBOARD KENDALI VAULT & 64-ENTRY RING BUFFER
         ===================================================================== */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Left Control Deck (7 Cols) */}
        <BentoCard className="p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00EC97]">
                CANONICAL VAULT CONTROLLER
              </span>
              <h2 className="mt-1 text-2xl font-extrabold text-white">
                {isId
                  ? "Kendali Pemegang Sah Seat"
                  : "Seat Holder Vault Operations"}
              </h2>
            </div>

            {/* Seat Selector Dropdown */}
            <div className="flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5 text-[#00EC97]" />
              <select
                value={selectedVaultId}
                onChange={(e) => setSelectedVaultId(e.target.value)}
                className="rounded-xl border border-white/15 bg-[#06080D] px-3 py-2 font-mono text-xs text-white focus:border-[#00EC97] focus:outline-none"
              >
                {liveSeats.map((s) => (
                  <option key={s.tokenId} value={s.tokenId}>
                    {s.tokenId} (seq #{s.vault?.rotation_seq ?? 0})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 Spring Action Tabs */}
          <div className="my-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.06] bg-[#06080D] p-1 sm:grid-cols-4">
            {[
              { id: "claim" as const, label: isId ? "1. Klaim Tiket" : "1. Claim Pool" },
              { id: "withdraw" as const, label: isId ? "2. Withdraw NEAR" : "2. Withdraw" },
              { id: "delegate" as const, label: isId ? "3. Set Delegate" : "3. Delegate" },
              { id: "move" as const, label: isId ? "4. List / Transfer" : "4. List / Move" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setVaultTab(t.id)}
                className={`relative rounded-xl py-2 font-mono text-xs font-bold transition ${
                  vaultTab === t.id ? "text-[#06080D]" : "text-slate-400 hover:text-white"
                }`}
              >
                {vaultTab === t.id && (
                  <motion.span
                    layoutId="vault-deck-pill"
                    transition={SPRING_RELIC}
                    className="absolute inset-0 rounded-xl bg-[#00EC97]"
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Active Vault Summary Strip */}
          <div className="mb-4 grid grid-cols-3 gap-2.5 rounded-2xl border border-white/[0.07] bg-[#06080D]/80 p-3.5 font-mono text-xs">
            <div>
              <span className="block text-[10px] text-slate-400">OWNER SAH</span>
              <span className="truncate block font-bold text-white">
                {activeSeatBundle?.vault?.owner_id || "—"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">WITHDRAWABLE</span>
              <span className="font-bold text-[#00EC97]">
                {formatYocto(activeSeatBundle?.vault?.withdrawable || "0", 4)} NEAR
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">STATUS VAULT</span>
              <span
                className={`font-bold ${
                  activeSeatBundle?.vault?.status === "Listed"
                    ? "text-[#F59E0B]"
                    : "text-[#10B981]"
                }`}
              >
                {activeSeatBundle?.vault?.status || "Idle"} (seq #
                {activeSeatBundle?.vault?.rotation_seq ?? 0})
              </span>
            </div>
          </div>

          {/* Tab Panels */}
          {vaultTab === "claim" && (
            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#06080D]/60 p-4">
              <p className="text-xs text-slate-300">
                {isId
                  ? "Menarik jatah bagi hasil tiket dari akumulator registry langsung masuk ke sub-account vault kursi (bukan ke dompet pribadi pemanggil)."
                  : "Pulls accrued ticket revenue from the registry O(1) accumulator directly into the seat vault sub-account."}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[#00EC97]">
                  Claimable: +{formatYocto(activeSeatBundle?.seat?.claimable || "0", 4)} NEAR
                </span>
                <button
                  type="button"
                  disabled={isExecutingVault}
                  onClick={() => handleVaultCommand("claim")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00EC97] px-4 py-2.5 text-xs font-extrabold text-[#06080D] shadow-jade-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isId ? "Klaim Bagi Hasil Tiket" : "Claim Ticket Pool"}
                </button>
              </div>
            </div>
          )}

          {vaultTab === "withdraw" && (
            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#06080D]/60 p-4">
              <p className="text-xs text-slate-300">
                {isId
                  ? "Hanya owner_id kanonik di vault saat status == Idle yang dapat menarik dana keluar."
                  : "Only canonical vault owner_id while status == Idle can withdraw funds."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={withdrawNearInput}
                  onChange={(e) => setWithdrawNearInput(e.target.value)}
                  className="w-36 rounded-xl border border-white/15 bg-[#0B0F1A] px-3 py-2 font-mono text-xs text-white"
                  placeholder="0.10"
                />
                <button
                  type="button"
                  disabled={isExecutingVault}
                  onClick={() => handleVaultCommand("withdraw")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#00EC97] px-4 py-2.5 text-xs font-extrabold text-[#06080D]"
                >
                  {isId ? "Tarik Dana (Withdraw NEAR)" : "Withdraw NEAR"}
                </button>
              </div>
            </div>
          )}

          {vaultTab === "delegate" && (
            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-[#06080D]/60 p-4">
              <p className="text-xs text-slate-300">
                {isId
                  ? "Beri izin pengeluaran terbatas (cap + TTL) ke akun/agen lain. Otomatis hangus begitu rotation_seq naik saat seat dijual/ditransfer."
                  : "Grant bounded spending allowance + TTL to an agent/account. Automatically wiped on rotation_seq increment."}
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  value={delegateAccountInput}
                  onChange={(e) => setDelegateAccountInput(e.target.value)}
                  placeholder="agent.testnet"
                  className="rounded-xl border border-white/15 bg-[#0B0F1A] px-3 py-2 font-mono text-xs text-white sm:col-span-2"
                />
                <input
                  type="text"
                  value={delegateCapInput}
                  onChange={(e) => setDelegateCapInput(e.target.value)}
                  placeholder="0.5 NEAR"
                  className="rounded-xl border border-white/15 bg-[#0B0F1A] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <button
                type="button"
                disabled={isExecutingVault || !delegateAccountInput.trim()}
                onClick={() => handleVaultCommand("delegate")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00EC97] px-4 py-2 text-xs font-extrabold text-[#06080D] disabled:opacity-40"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {isId ? "Aktifkan Delegate Terbatas" : "Set Bounded Delegate"}
              </button>
            </div>
          )}

          {vaultTab === "move" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2.5 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.05] p-3.5">
                <span className="font-mono text-[10px] font-bold text-[#FBBF24]">
                  SAFE SALE (FREEZE VAULT)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={listPriceInput}
                    onChange={(e) => setListPriceInput(e.target.value)}
                    placeholder="Price (N)"
                    className="w-1/2 rounded-lg border border-white/15 bg-[#06080D] px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                  <input
                    type="text"
                    value={listMinBalInput}
                    onChange={(e) => setListMinBalInput(e.target.value)}
                    placeholder="Min Bal (N)"
                    className="w-1/2 rounded-lg border border-white/15 bg-[#06080D] px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={isExecutingVault}
                  onClick={() => handleVaultCommand("list")}
                  className="w-full rounded-xl bg-[#F59E0B] py-2 text-xs font-extrabold text-[#06080D]"
                >
                  {isId ? "Jual Aman (List Seat)" : "List Seat (Freeze)"}
                </button>
              </div>

              <div className="space-y-2.5 rounded-2xl border border-white/10 bg-[#06080D]/70 p-3.5">
                <span className="font-mono text-[10px] font-bold text-[#00EC97]">
                  ATOMIC ROTATION (NEP-171)
                </span>
                <input
                  type="text"
                  value={transferToInput}
                  onChange={(e) => setTransferToInput(e.target.value)}
                  placeholder="receiver.testnet"
                  className="w-full rounded-lg border border-white/15 bg-[#0B0F1A] px-2.5 py-1.5 font-mono text-xs text-white"
                />
                <button
                  type="button"
                  disabled={isExecutingVault || !transferToInput.trim()}
                  onClick={() => handleVaultCommand("transfer")}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00EC97]/50 bg-[#00EC97]/15 py-2 text-xs font-bold text-[#00EC97] hover:bg-[#00EC97] hover:text-[#06080D] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  Transfer Seat (`nft_transfer`)
                </button>
              </div>
            </div>
          )}
        </BentoCard>

        {/* Right Bento (5 Cols): 64-Entry Outflow Ring Buffer Table */}
        <BentoCard className="flex flex-col justify-between p-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#00EC97]">
                  RING BUFFER AUDIT · MAX 64 ENTRIES
                </span>
                <h3 className="mt-1 text-xl font-extrabold text-white">
                  {isId
                    ? "Riwayat Pengeluaran Vault"
                    : "Vault Outflow Ring Buffer"}
                </h3>
              </div>
              <Link
                href={`/seat/${activeSeatBundle?.tokenId || `s001.${registryId}`}`}
                className="font-mono text-xs text-[#00EC97] hover:underline"
              >
                {isId ? "Detail Penuh →" : "Full View →"}
              </Link>
            </div>

            <div className="mt-4 max-h-[250px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#06080D]/90">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-[10px] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">SEQ</th>
                    <th className="px-3 py-2">KIND</th>
                    <th className="px-3 py-2">AMOUNT</th>
                    <th className="px-3 py-2">TO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {outflows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                        {isId
                          ? "0 pengeluaran tercatat — seluruh dana masih utuh di dalam vault."
                          : "0 outflows recorded — 100% of funds remain inside the vault."}
                      </td>
                    </tr>
                  ) : (
                    outflows.map((o, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-[#00EC97]">#{o.seq}</td>
                        <td className="px-3 py-2 text-slate-300">{o.kind}</td>
                        <td className="px-3 py-2 font-bold text-white">
                          -{formatYocto(o.amount, 3)} N
                        </td>
                        <td className="px-3 py-2 truncate max-w-[100px] text-slate-400">
                          {o.to}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#06080D]/60 px-3.5 py-2.5 font-mono text-[11px] text-slate-400">
            <span>get_outflows(limit=64)</span>
            <span className="text-[#10B981]">Anti-Silent-Drain Audit</span>
          </div>
        </BentoCard>
      </section>

      <KratonDivider
        label={
          isId
            ? "MODUL F · KONSOL ATTACK LAB (STASIUN PENGUJIAN JURI & AI SCREENER)"
            : "MODULE F · ATTACK LAB CYBER CONSOLE (1-CLICK JUDGE VERIFICATION)"
        }
      />

      {/* =====================================================================
          MODULE F: KONSOL "ATTACK LAB" + RECEIPT TERMINAL LOGS
         ===================================================================== */}
      <section className="space-y-5">
        <BentoCard className="p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#EF4444]">
                <Flame className="h-3.5 w-3.5" />
                CYBERSECURITY VERIFICATION STATION · 80,620 RECEIPT INTERLEAVINGS
              </span>
              <h2 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                {isId
                  ? "Konsol Attack Lab — Buktikan Ketahanan Transfer dalam 1 Klik"
                  : "Attack Lab Console — Prove Transfer Resilience in One Click"}
              </h2>
            </div>

            <Link
              href="/lab"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#06080D] px-4 py-2.5 font-mono text-xs font-bold text-[#00EC97] transition hover:border-[#00EC97]/50"
            >
              {isId ? "Buka Simulator 12 Vektor (A1–A12) →" : "Open Full A1–A12 Lab →"}
            </Link>
          </div>

          {/* 4 Interactive Judge Scenario Cards */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {JUDGE_ATTACK_SCENARIOS.map((sc) => {
              const selected = sc.id === activeScenario.id;
              const isBlocked = sc.badge === "BLOCKED";
              return (
                <motion.button
                  key={sc.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  transition={SPRING_RELIC}
                  onClick={() => setActiveScenarioId(sc.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? isBlocked
                        ? "border-[#EF4444]/60 bg-[#EF4444]/[0.08] shadow-blocked"
                        : "border-[#00EC97]/60 bg-[#00EC97]/[0.08] shadow-jade-sm"
                      : "border-white/[0.07] bg-[#06080D]/70 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      [{sc.id}]
                    </span>
                    <span
                      className={`rounded-md px-2.5 py-0.5 font-mono text-[11px] font-extrabold ${
                        isBlocked
                          ? "border border-[#EF4444]/50 bg-[#EF4444]/20 text-[#F87171]"
                          : "border border-[#10B981]/50 bg-[#10B981]/20 text-[#00EC97]"
                      }`}
                    >
                      [{sc.badge}]
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-white">
                    {isId ? sc.titleId : sc.titleEn}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {isId ? sc.descId : sc.descEn}
                  </p>
                  <div className="mt-3 font-mono text-[11px] text-slate-300">
                    Outcome:{" "}
                    <span
                      className={isBlocked ? "text-[#F87171]" : "text-[#00EC97]"}
                    >
                      {sc.errorCode}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Bottom Receipt Simulation & Live Tx Terminal */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#04060A]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-[#0B0F1A] px-4 py-2.5 font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Terminal className="h-4 w-4 text-[#00EC97]" />
                <span>pusaka-receipt-trace :: {activeScenario.id}</span>
              </div>
              <a
                href={`${EXPLORER_URL}/txns/${activeScenario.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#00EC97] hover:underline"
              >
                NearBlocks Live Tx: {activeScenario.txHash.slice(0, 12)}...
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-1.5 p-4 font-mono text-xs leading-relaxed">
              {activeScenario.receiptLogs.map((line, idx) => {
                const isErr = line.includes("[BLOCKED]") || line.includes("FAILED") || line.includes("PANIC");
                const isSafe = line.includes("[AMAN]") || line.includes("=> OK");
                return (
                  <motion.div
                    key={`${activeScenario.id}-${idx}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING_RELIC, delay: idx * 0.04 }}
                    className={
                      isErr
                        ? "font-semibold text-[#F87171]"
                        : isSafe
                        ? "font-semibold text-[#00EC97]"
                        : "text-slate-300"
                    }
                  >
                    {line}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </BentoCard>
      </section>
    </div>
  );
}
