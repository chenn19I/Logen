"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  ArrowUpRight,
  Lock,
  Sparkles,
  Coins,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { DefaultSeatSvgCard } from "@/components/KawungOrnament";
import {
  getNftTokens,
  getSeat,
  getVaultState,
} from "@/lib/near/rpc";
import type { Nep171Token, SeatView, VaultStateView } from "@/lib/near/types";
import { formatYocto } from "@/lib/near/format";

interface EnrichedSeat {
  token: Nep171Token;
  seat: SeatView | null;
  vault: VaultStateView | null;
}

export default function SeatsGalleryPage() {
  const router = useRouter();
  const {
    lang,
    accountId,
    registryId,
    config,
    openWalletModal,
    callContractMethod,
  } = useNear();
  const isId = lang === "id";

  const [seats, setSeats] = useState<EnrichedSeat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterMine, setFilterMine] = useState<boolean>(false);
  const [lookupId, setLookupId] = useState<string>("");
  const [mintHandle, setMintHandle] = useState<string>("");
  const [isMinting, setIsMinting] = useState<boolean>(false);

  const loadSeats = useCallback(async () => {
    setLoading(true);
    try {
      const tokens = await getNftTokens(registryId, "0", 50);
      const enriched = await Promise.all(
        tokens.map(async (token) => {
          const [seat, vault] = await Promise.all([
            getSeat(token.token_id, registryId),
            getVaultState(token.token_id),
          ]);
          return { token, seat, vault };
        })
      );
      setSeats(enriched);
    } finally {
      setLoading(false);
    }
  }, [registryId]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  const handleDirectLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = lookupId.trim().toLowerCase();
    if (!raw) return;
    const fullId = raw.includes(".") ? raw : `${raw}.${registryId}`;
    router.push(`/seat/${encodeURIComponent(fullId)}`);
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsMinting(true);
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
        deposit: config?.seat_price || "2200000000000000000000000",
      });
      setMintHandle("");
      await loadSeats();
    } finally {
      setIsMinting(false);
    }
  };

  const displayedSeats = filterMine && accountId
    ? seats.filter(
        (s) =>
          (s.vault?.owner_id || s.seat?.owner_id || s.token.owner_id) ===
          accountId
      )
    : seats;

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-gold-500/25 bg-obsidian-800/80 p-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
            {isId
              ? "Koleksi NEP-171 + Brankas Sub-Akun Tanpa Kunci"
              : "NEP-171 Collection + Keyless Sub-Account Vaults"}
          </span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">
            {isId ? "Galeri Kursi & Brankas Pusaka" : "Pusaka Seat Vaults"}
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            {isId ? (
              <>
                Setiap kursi di <span className="font-mono text-gold-300">{registryId}</span> adalah
                sub-akun NEAR tersendiri yang menyimpan uang dan berjalan dengan{" "}
                <strong className="text-segel-400">0 kunci akses (Zero Access Keys)</strong>.
              </>
            ) : (
              <>
                Each token in <span className="font-mono text-gold-300">{registryId}</span> is its
                own NEAR account running the immutable vault contract with{" "}
                <strong className="text-segel-400">0 access keys</strong>.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleDirectLookup} className="flex items-center gap-1.5">
            <div className="flex items-center rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2">
              <Search className="mr-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder={`s001.${registryId}`}
                className="w-44 bg-transparent font-mono text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl border border-gold-500/40 bg-obsidian-900 px-3 py-2 text-xs font-semibold text-gold-300 hover:bg-obsidian-700"
            >
              {isId ? "Buka Brankas" : "Inspect Vault"}
            </button>
          </form>

          {accountId && (
            <button
              type="button"
              onClick={() => setFilterMine((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                filterMine
                  ? "border-gold-400 bg-gold-500/20 text-gold-300"
                  : "border-slate-700 bg-obsidian-900 text-slate-300"
              }`}
            >
              {isId ? "Kursi Saya Saja" : "My Seats Only"}
            </button>
          )}

          <button
            type="button"
            onClick={loadSeats}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-obsidian-900 px-3 py-2 text-xs text-slate-300 hover:border-gold-500/40 hover:text-gold-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {isId ? "Segarkan" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Quick Mint Bar */}
      <form
        onSubmit={handleMint}
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-500/30 bg-obsidian-900/90 px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-gold-400" />
          <div>
            <p className="text-sm font-semibold text-white">
              {isId
                ? "Cetak Sub-Akun Kursi Baru Tanpa Kunci (Mint)"
                : "Mint a New Keyless Seat Sub-Account"}
            </p>
            <p className="font-mono text-xs text-slate-400">
              {isId
                ? `Membuat <handle>.${registryId} dengan 0 kunci akses + saldo awal brankas`
                : `Creates <handle>.${registryId} with 0 access keys + pinned vault code`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2">
            <input
              type="text"
              value={mintHandle}
              onChange={(e) => setMintHandle(e.target.value)}
              placeholder={isId ? "nama-opsional" : "optional-handle"}
              className="w-36 bg-transparent font-mono text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <span className="font-mono text-xs text-gold-400">.{registryId}</span>
          </div>
          <button
            type="submit"
            disabled={isMinting}
            className="rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 px-4 py-2 text-xs font-bold text-obsidian-950 shadow transition hover:brightness-110 disabled:opacity-50"
          >
            {isMinting
              ? isId
                ? "Mencetak..."
                : "Minting..."
              : `${isId ? "Cetak Kursi" : "Mint Seat"} (${formatYocto(
                  config?.seat_price || "2200000000000000000000000"
                )} NEAR)`}
          </button>
        </div>
      </form>

      {/* Gallery Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-80 animate-pulse rounded-2xl border border-gold-500/20 bg-obsidian-800/50 p-5"
            />
          ))}
        </div>
      ) : displayedSeats.length === 0 ? (
        <div className="rounded-3xl border border-gold-500/25 bg-obsidian-900/70 p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-gold-400" />
          <h2 className="mt-3 font-serif text-2xl font-bold text-white">
            No Seats Found on `{registryId}`
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-xs text-slate-400">
            Either no seats have been minted yet on <span className="font-mono">{registryId}</span>,
            or you can inspect a specific seat account directly (e.g.,{" "}
            <Link
              href={`/seat/s001.${registryId}`}
              className="font-mono text-gold-300 underline"
            >
              s001.{registryId}
            </Link>
            ).
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayedSeats.map(({ token, seat, vault }) => {
            const ownerId = vault?.owner_id || seat?.owner_id || token.owner_id;
            const seq = vault?.rotation_seq ?? seat?.rotation_seq ?? 0;
            const isListed =
              vault?.status === "Listed" || Boolean(seat?.listing);
            const vaultBal = formatYocto(vault?.balance ?? "0");
            const claimable = formatYocto(seat?.claimable ?? "0");
            const mediaUri = token.metadata?.media;

            return (
              <Link
                key={token.token_id}
                href={`/seat/${encodeURIComponent(token.token_id)}`}
                className="group flex flex-col justify-between rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5 shadow-lg transition hover:-translate-y-1 hover:border-gold-400/70 hover:shadow-[0_12px_35px_rgba(212,166,74,0.18)]"
              >
                <div>
                  {/* On-chain Dynamic SVG Media */}
                  <div className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-xl border border-gold-500/20 bg-obsidian-950">
                    {mediaUri && mediaUri.startsWith("data:image/svg+xml") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUri}
                        alt={token.token_id}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <DefaultSeatSvgCard
                        tokenId={token.token_id}
                        ownerId={ownerId}
                        rotationSeq={seq}
                        status={isListed ? "Listed" : "Active"}
                        balanceNear={vaultBal}
                      />
                    )}
                  </div>

                  {/* Header & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-mono text-base font-bold text-white group-hover:text-gold-300">
                        {token.token_id}
                      </h3>
                      <p className="font-mono text-xs text-slate-400">
                        Owner: <span className="text-slate-200">{ownerId}</span>
                      </p>
                    </div>
                    {isListed ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-threat-500/40 bg-threat-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-threat-400">
                        <Lock className="h-3 w-3" />
                        FROZEN · LISTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-segel-500/40 bg-segel-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-segel-400">
                        <ShieldCheck className="h-3 w-3" />
                        ACTIVE · SEQ #{seq}
                      </span>
                    )}
                  </div>
                </div>

                {/* Balances Footer */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 font-mono text-xs">
                  <div className="rounded-lg bg-obsidian-950/80 p-2">
                    <span className="block text-[10px] text-slate-400">
                      VAULT BALANCE
                    </span>
                    <span className="font-bold text-gold-300">
                      {vaultBal} NEAR
                    </span>
                  </div>
                  <div className="rounded-lg bg-obsidian-950/80 p-2">
                    <span className="block text-[10px] text-slate-400">
                      UNCLAIMED POOL
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-segel-400">
                      <Coins className="h-3 w-3" />
                      {claimable} NEAR
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-medium text-gold-400">
                  <span>Open Vault & Keyless Proof</span>
                  <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
