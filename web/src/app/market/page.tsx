"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  Lock,
  RefreshCw,
  ArrowUpRight,
  Coins,
  CheckCircle2,
  X,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import {
  getAccountLedgers,
  getListings,
  getSales,
  getVaultState,
} from "@/lib/near/rpc";
import type {
  AccountLedgers,
  ListingView,
  Sale,
  VaultStateView,
} from "@/lib/near/types";
import {
  applyBps,
  formatTimestampMs,
  formatYocto,
  parseNearToYocto,
} from "@/lib/near/format";

interface EnrichedListing {
  listing: ListingView;
  vault: VaultStateView | null;
}

export default function SafeMarketPage() {
  const {
    lang,
    accountId,
    registryId,
    config,
    openWalletModal,
    callContractMethod,
  } = useNear();
  const isId = lang === "id";

  const [listings, setListings] = useState<EnrichedListing[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ledgers, setLedgers] = useState<AccountLedgers>({
    refund: "0",
    proceeds: "0",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedListing, setSelectedListing] =
    useState<EnrichedListing | null>(null);
  const [buyerGuardNear, setBuyerGuardNear] = useState<string>("0");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const royaltyBps = config?.royalty_bps ?? 500; // default 5%

  const loadMarket = useCallback(async () => {
    setLoading(true);
    try {
      const [rawListings, rawSales, acctLedgers] = await Promise.all([
        getListings(registryId),
        getSales(registryId, 0, 25),
        accountId
          ? getAccountLedgers(accountId, registryId)
          : Promise.resolve({ refund: "0", proceeds: "0" }),
      ]);

      const enriched = await Promise.all(
        rawListings.map(async (listing) => {
          const vault = await getVaultState(listing.token_id);
          return { listing, vault };
        })
      );

      setListings(enriched);
      setSales(rawSales);
      setLedgers(acctLedgers);
    } finally {
      setLoading(false);
    }
  }, [registryId, accountId]);

  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  const openBuyModal = (item: EnrichedListing) => {
    setSelectedListing(item);
    const liveWithdrawable = item.vault?.withdrawable || item.listing.min_balance;
    setBuyerGuardNear(formatYocto(liveWithdrawable, 4).replace(/,/g, ""));
    setStatusMsg(null);
  };

  const handleBuySeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsBusy(true);
    setStatusMsg(null);
    try {
      const minBalYocto = parseNearToYocto(buyerGuardNear || "0");
      await callContractMethod({
        receiverId: registryId,
        methodName: "buy_seat",
        args: {
          token_id: selectedListing.listing.token_id,
          nonce: selectedListing.listing.nonce,
          min_balance: minBalYocto,
        },
        gas: "150000000000000", // 150 Tgas per docs/API.md
        deposit: selectedListing.listing.price,
      });
      setStatusMsg(
        `Purchased ${selectedListing.listing.token_id}! Vault settled atomically.`
      );
      setSelectedListing(null);
      await loadMarket();
    } catch (err) {
      setStatusMsg(
        err instanceof Error ? err.message : "Purchase failed or cancelled"
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handlePullClaim = async (method: "claim_refund" | "claim_proceeds") => {
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsBusy(true);
    setStatusMsg(null);
    try {
      await callContractMethod({
        receiverId: registryId,
        methodName: method,
        args: { account_id: accountId },
        gas: "30000000000000",
        deposit: "0",
      });
      setStatusMsg(`Successfully executed ${method} for ${accountId}`);
      await loadMarket();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-gold-500/25 bg-obsidian-800/80 p-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
            {isId
              ? "Syarat R4 · Penyelesaian Brankas Atomik & Pelindung Saldo Pembeli"
              : "Requirement R4 · Atomic Vault Settlement & Buyer Guard"}
          </span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">
            {isId ? "Pasar Sekunder Aman (Safe Market)" : "Safe Secondary Market"}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-300">
            {isId ? (
              <>
                Saat kursi dipasang di pasar, seluruh penarikan uang di dalam brankasnya
                otomatis dibekukan (<span className="font-mono text-threat-400">E_FROZEN</span>).
                Saat Anda membeli, <span className="font-mono text-gold-300">vault.v_settle_sale</span>{" "}
                memastikan <span className="font-mono">listing_nonce</span> dan{" "}
                <span className="font-mono">saldo &gt;= jaminan minimal</span> dalam satu
                receipt yang sama saat memindahkan kepemilikan—sehingga penjual mustahil
                menguras isi brankas sebelum transaksi selesai.
              </>
            ) : (
              <>
                Listing a seat freezes all vault outflows (<span className="font-mono text-threat-400">E_FROZEN</span>).
                When you buy, <span className="font-mono text-gold-300">vault.v_settle_sale</span>{" "}
                verifies the exact <span className="font-mono">listing_nonce</span> and{" "}
                <span className="font-mono">withdrawable &gt;= max(seller_min, buyer_min)</span>{" "}
                in the same receipt that rotates ownership—making drain-before-settle and
                bait-and-switch relisting mathematically impossible.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={loadMarket}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-obsidian-900 px-4 py-2 text-xs text-slate-300 hover:border-gold-500/40 hover:text-gold-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {isId ? "Segarkan Pasar" : "Refresh Market"}
        </button>
      </div>

      {/* Pull Ledger Panel (K10: All Outgoing Registry Payments Are Pull) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-gold-500/30 bg-obsidian-900/90 p-5">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-gold-400">
              Pull Ledger · Seller Proceeds (`get_ledgers.proceeds`)
            </span>
            <p className="mt-1 font-mono text-2xl font-bold text-white">
              {formatYocto(ledgers.proceeds)} NEAR
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {accountId
                ? `Claimable proceeds for ${accountId}`
                : "Connect wallet to view your pull proceeds ledger"}
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy || BigInt(ledgers.proceeds || "0") === 0n}
            onClick={() => handlePullClaim("claim_proceeds")}
            className="rounded-xl bg-gold-500 px-4 py-2.5 text-xs font-bold text-obsidian-950 transition hover:bg-gold-400 disabled:opacity-40"
          >
            Claim Proceeds
          </button>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-segel-500/30 bg-obsidian-900/90 p-5">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-segel-400">
              Pull Ledger · Buyer Escrow Refund (`get_ledgers.refund`)
            </span>
            <p className="mt-1 font-mono text-2xl font-bold text-white">
              {formatYocto(ledgers.refund)} NEAR
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              100% refund if a settlement failed guard/nonce checks (Invariant I4)
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy || BigInt(ledgers.refund || "0") === 0n}
            onClick={() => handlePullClaim("claim_refund")}
            className="rounded-xl bg-segel-500 px-4 py-2.5 text-xs font-bold text-obsidian-950 transition hover:bg-segel-400 disabled:opacity-40"
          >
            Claim Refund
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-2xl border border-gold-500/40 bg-obsidian-800 p-4 font-mono text-xs text-gold-300">
          {statusMsg}
        </div>
      )}

      {/* Active Listings Grid */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-bold text-white">
          Live Frozen Seat Listings ({listings.length})
        </h2>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-gold-500/20 bg-obsidian-800/50"
              />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-3xl border border-gold-500/20 bg-obsidian-900/70 p-10 text-center">
            <Store className="mx-auto h-10 w-10 text-gold-400" />
            <h3 className="mt-3 font-serif text-2xl font-bold text-white">
              No Active Seat Listings Right Now
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-xs text-slate-400">
              Seat owners can list their seat from its{" "}
              <Link href="/seats" className="text-gold-300 underline">
                Seat Vault Detail Page
              </Link>{" "}
              (`registry.list_seat`), which atomically freezes vault outflows and mirrors
              the listing here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map(({ listing, vault }) => {
              const liveWithdrawable = vault?.withdrawable ?? listing.min_balance;
              const guardSatisfied =
                BigInt(liveWithdrawable || "0") >=
                BigInt(listing.min_balance || "0");

              return (
                <div
                  key={`${listing.token_id}-${listing.nonce}`}
                  className="flex flex-col justify-between rounded-2xl border border-gold-500/30 bg-obsidian-800/90 p-5 shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/seat/${encodeURIComponent(listing.token_id)}`}
                        className="inline-flex items-center gap-1 font-mono text-base font-bold text-white hover:text-gold-300"
                      >
                        {listing.token_id}
                        <ArrowUpRight className="h-4 w-4 text-gold-400" />
                      </Link>
                      <span className="inline-flex items-center gap-1 rounded-full border border-threat-500/40 bg-threat-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-threat-400">
                        <Lock className="h-3 w-3" />
                        NONCE #{listing.nonce} · FROZEN
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3 font-mono text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ask Price:</span>
                        <span className="text-base font-bold text-gold-300">
                          {formatYocto(listing.price)} NEAR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Seller Promised Min:</span>
                        <span className="text-slate-200">
                          {formatYocto(listing.min_balance)} NEAR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Live Vault Withdrawable:</span>
                        <span
                          className={
                            guardSatisfied
                              ? "font-bold text-segel-400"
                              : "font-bold text-threat-400"
                          }
                        >
                          {formatYocto(liveWithdrawable)} NEAR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Seller:</span>
                        <span className="text-slate-300">{listing.seller}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Expires:</span>
                        <span className="text-slate-400">
                          {formatTimestampMs(listing.expires_at_ms)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openBuyModal({ listing, vault })}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-2.5 text-xs font-bold text-obsidian-950 shadow transition hover:brightness-110"
                  >
                    Buy Seat & Vault ({formatYocto(listing.price)} NEAR)
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <KratonDivider label="Recent Atomic Secondary Sales Log (`get_sales`)" />

      {/* Sales History Table */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6">
        <h3 className="mb-4 font-serif text-2xl font-bold text-white">
          Completed Safe Sales
        </h3>
        {sales.length === 0 ? (
          <p className="font-mono text-xs text-slate-400">
            No secondary sales recorded on `{registryId}` yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2">Seat (`token_id`)</th>
                  <th className="pb-2">Seller</th>
                  <th className="pb-2">Buyer</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Kas Klub Royalty (5%)</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sales.map((s, idx) => (
                  <tr key={`${s.token_id}-${s.at_ms}-${idx}`}>
                    <td className="py-2.5 font-bold text-gold-300">{s.token_id}</td>
                    <td className="py-2.5 text-slate-300">{s.seller}</td>
                    <td className="py-2.5 text-segel-400">{s.buyer}</td>
                    <td className="py-2.5 text-white">{formatYocto(s.price)} NEAR</td>
                    <td className="py-2.5 text-gold-400">
                      {formatYocto(s.royalty)} NEAR
                    </td>
                    <td className="py-2.5 text-slate-400">
                      {formatTimestampMs(s.at_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Buy Seat Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-gold-500/40 bg-obsidian-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-gold-400">
                  Atomic Vault Settlement · v_settle_sale
                </span>
                <h3 className="font-serif text-2xl font-bold text-white">
                  Buy {selectedListing.listing.token_id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-obsidian-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBuySeat} className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-obsidian-950 p-4 font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Quoted Listing Nonce:</span>
                  <span className="font-bold text-gold-300">
                    #{selectedListing.listing.nonce}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Purchase Price:</span>
                  <span className="font-bold text-white">
                    {formatYocto(selectedListing.listing.price)} NEAR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Kas Klub Royalty ({royaltyBps / 100}%):
                  </span>
                  <span className="text-gold-400">
                    {formatYocto(
                      applyBps(selectedListing.listing.price, royaltyBps)
                    )}{" "}
                    NEAR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Net Seller Proceeds (95%):</span>
                  <span className="text-slate-200">
                    {formatYocto(
                      BigInt(selectedListing.listing.price) -
                        applyBps(selectedListing.listing.price, royaltyBps)
                    )}{" "}
                    NEAR
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">Live Vault Withdrawable:</span>
                  <span className="font-bold text-segel-400">
                    {formatYocto(
                      selectedListing.vault?.withdrawable ??
                        selectedListing.listing.min_balance
                    )}{" "}
                    NEAR
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-white">
                  Your Buyer `min_balance` Guard (NEAR)
                </label>
                <input
                  type="text"
                  value={buyerGuardNear}
                  onChange={(e) => setBuyerGuardNear(e.target.value)}
                  className="w-full rounded-xl border border-gold-500/40 bg-obsidian-950 px-3 py-2 font-mono text-sm text-white focus:border-gold-400 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-segel-400" />
                  Inside Receipt #2 (<span className="font-mono">vault.v_settle_sale</span>),
                  the vault enforces{" "}
                  <span className="font-mono text-gold-300">
                    withdrawable &gt;= max(seller_min, buyer_min)
                  </span>{" "}
                  and <span className="font-mono text-gold-300">nonce == #{selectedListing.listing.nonce}</span>.
                  If the seller canceled or drained a single yocto, settlement aborts and
                  your full payment goes to your refund ledger.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedListing(null)}
                  className="flex-1 rounded-xl border border-slate-700 bg-obsidian-800 py-2.5 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="flex-1 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-2.5 text-xs font-bold text-obsidian-950 shadow"
                >
                  {isBusy
                    ? "Signing buy_seat..."
                    : `Confirm Buy (${formatYocto(selectedListing.listing.price)} NEAR)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
