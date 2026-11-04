"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  Send,
  Coins,
  UserCheck,
  History,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { DefaultSeatSvgCard, KratonDivider } from "@/components/KawungOrnament";
import {
  EXPLORER_URL,
  getNftToken,
  getSeat,
  getSeatHistory,
  getVaultItemInfo,
  getVaultOutflows,
  getVaultState,
  verifyKeylessProofOnChain,
} from "@/lib/near/rpc";
import type {
  KeylessProofCheck,
  Nep171Token,
  NftItemInfo,
  SeatHistory,
  SeatView,
  VaultOutflow,
  VaultStateView,
} from "@/lib/near/types";
import {
  formatTimestampMs,
  formatYocto,
  parseNearToYocto,
} from "@/lib/near/format";

export default function SeatDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = decodeURIComponent(params?.id || "");
  const {
    accountId,
    registryId,
    config,
    openWalletModal,
    callContractMethod,
  } = useNear();

  const tokenId = rawId.includes(".") ? rawId : `${rawId}.${registryId}`;

  const [token, setToken] = useState<Nep171Token | null>(null);
  const [seat, setSeat] = useState<SeatView | null>(null);
  const [vault, setVault] = useState<VaultStateView | null>(null);
  const [itemInfo, setItemInfo] = useState<NftItemInfo | null>(null);
  const [history, setHistory] = useState<SeatHistory>({
    holders: [],
    claims: [],
    earnings: [],
  });
  const [outflows, setOutflows] = useState<VaultOutflow[]>([]);
  const [proof, setProof] = useState<KeylessProofCheck | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Action Form States
  const [withdrawNear, setWithdrawNear] = useState<string>("0.5");
  const [withdrawTo, setWithdrawTo] = useState<string>("");
  const [delegateAccount, setDelegateAccount] = useState<string>("");
  const [delegateAllowance, setDelegateAllowance] = useState<string>("1");
  const [delegateTtlSec, setDelegateTtlSec] = useState<string>("3600");
  const [listPriceNear, setListPriceNear] = useState<string>("10");
  const [listMinBalNear, setListMinBalNear] = useState<string>("1");
  const [listTtlSec, setListTtlSec] = useState<string>("86400");
  const [transferTo, setTransferTo] = useState<string>("");
  const [delegateWithdrawNear, setDelegateWithdrawNear] = useState<string>("0.2");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tk, st, vt, ii, hist, out, prf] = await Promise.all([
        getNftToken(tokenId, registryId),
        getSeat(tokenId, registryId),
        getVaultState(tokenId),
        getVaultItemInfo(tokenId),
        getSeatHistory(tokenId, registryId, 100),
        getVaultOutflows(tokenId),
        verifyKeylessProofOnChain(tokenId, registryId),
      ]);
      setToken(tk);
      setSeat(st);
      setVault(vt);
      setItemInfo(ii);
      setHistory(hist);
      setOutflows(out);
      setProof(prf);
    } finally {
      setLoading(false);
    }
  }, [tokenId, registryId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const canonicalOwner = vault?.owner_id || itemInfo?.owner_id || seat?.owner_id || "—";
  const canonicalSeq = vault?.rotation_seq ?? itemInfo?.rotation_seq ?? seat?.rotation_seq ?? 0;
  const isOwner = Boolean(accountId && accountId === canonicalOwner);
  const activeDelegateId =
    vault?.delegate?.account_id || vault?.delegate?.account || null;
  const isDelegate = Boolean(accountId && activeDelegateId === accountId);
  const isListed =
    vault?.status === "Listed" || itemInfo?.status === "Frozen";

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setActionStatus(null);
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsBusy(true);
    try {
      await fn();
      setActionStatus(`Success: ${label}`);
      await loadAll();
    } catch (err) {
      setActionStatus(
        `${label} failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  // Merge timeline events for R3 Seat History View + Cumulative Balance SVG Chart
  const mergedTimeline = useMemo(() => {
    type TimelineEvent = {
      at_ms: number;
      kind: "holder" | "earning" | "claim" | "outflow";
      badge: string;
      title: string;
      subtitle: string;
      deltaYocto: bigint; // impact on seat vault balance
    };
    const items: TimelineEvent[] = [];

    const initialReserve = BigInt(
      vault?.storage_reserve || config?.vault_initial_balance || "0"
    );

    for (const h of history.holders) {
      items.push({
        at_ms: h.since_ms,
        kind: "holder",
        badge: `SEQ #${h.seq} · ${h.via.toUpperCase()}`,
        title: `Owner → ${h.owner_id}`,
        subtitle: h.price
          ? `Settled via Safe Sale for ${formatYocto(h.price)} NEAR`
          : `Control rotated to ${h.owner_id} at seq=${h.seq}`,
        deltaYocto: h.seq === 0 ? initialReserve : 0n,
      });
    }

    for (const e of history.earnings) {
      items.push({
        at_ms: e.at_ms,
        kind: "earning",
        badge: `EVENT #${e.event_id} ACCRUAL`,
        title: `+${formatYocto(e.per_seat)} NEAR accrued to seat checkpoint`,
        subtitle: `40% member pool shared across ${e.seats} minted seats`,
        deltaYocto: 0n, // enters vault upon claim
      });
    }

    for (const c of history.claims) {
      items.push({
        at_ms: c.at_ms,
        kind: "claim",
        badge: "POOL CLAIM TO VAULT",
        title: `+${formatYocto(c.amount)} NEAR landed in ${tokenId}`,
        subtitle: `Triggered by ${c.by} (credited directly to seat account)`,
        deltaYocto: BigInt(c.amount || "0"),
      });
    }

    for (const o of outflows) {
      items.push({
        at_ms: o.at_ms,
        kind: "outflow",
        badge: `${o.kind.toUpperCase()} (SEQ #${o.seq})`,
        title: `-${formatYocto(o.amount)} NEAR → ${o.to}`,
        subtitle: `Authorized by ${o.by} during ownership epoch #${o.seq}`,
        deltaYocto: -BigInt(o.amount || "0"),
      });
    }

    items.sort((a, b) => a.at_ms - b.at_ms);

    let running = 0n;
    return items.map((item) => {
      running = running + item.deltaYocto;
      if (running < 0n) running = 0n;
      return { ...item, cumulativeYocto: running };
    });
  }, [history, outflows, vault?.storage_reserve, config?.vault_initial_balance, tokenId]);

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/seats"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-gold-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Seat Vaults
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`${EXPLORER_URL}/address/${tokenId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/30 bg-obsidian-800 px-3 py-1.5 font-mono text-xs text-gold-300 hover:bg-obsidian-700"
          >
            NearBlocks: {tokenId}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-obsidian-800 px-3 py-1.5 text-xs text-slate-300 hover:text-gold-300"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-Verify at Final Block
          </button>
        </div>
      </div>

      {/* Seat Hero + Bukti Tanpa Kunci (Keyless Proof) Live Verifier */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Seat Card & Vault State Summary */}
        <div className="space-y-4 rounded-3xl border border-gold-500/30 bg-obsidian-800/80 p-6 lg:col-span-5">
          <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl border border-gold-500/20 bg-obsidian-950">
            {token?.metadata?.media &&
            token.metadata.media.startsWith("data:image/svg+xml") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={token.metadata.media}
                alt={tokenId}
                className="h-full w-full object-cover"
              />
            ) : (
              <DefaultSeatSvgCard
                tokenId={tokenId}
                ownerId={canonicalOwner}
                rotationSeq={canonicalSeq}
                status={isListed ? "Frozen" : "Active"}
                balanceNear={formatYocto(vault?.balance ?? "0")}
              />
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-800 bg-obsidian-950/90 p-4 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Seat Account (`token_id`):</span>
              <span className="font-bold text-gold-300">{tokenId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Canonical Vault Owner:</span>
              <span className="text-white">{canonicalOwner}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rotation Sequence (`seq`):</span>
              <span className="text-segel-400">#{canonicalSeq}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vault Status:</span>
              <span
                className={
                  isListed ? "font-bold text-threat-400" : "font-bold text-segel-400"
                }
              >
                {vault?.status || itemInfo?.status || "Idle"}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2">
              <span className="text-slate-400">Total Vault Balance:</span>
              <span className="font-bold text-white">
                {formatYocto(vault?.balance ?? "0")} NEAR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Spendable (`withdrawable`):</span>
              <span className="font-bold text-gold-300">
                {formatYocto(vault?.withdrawable ?? "0")} NEAR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Storage Reserve (Locked):</span>
              <span className="text-slate-300">
                {formatYocto(vault?.storage_reserve ?? "0")} NEAR
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Unclaimed Member Pool:</span>
              <span className="font-bold text-segel-400">
                +{formatYocto(seat?.claimable ?? "0")} NEAR
              </span>
            </div>
          </div>
        </div>

        {/* Right: Bukti Tanpa Kunci (Keyless Proof) Live Verifier Panel */}
        <div className="rounded-3xl border border-gold-500/35 bg-obsidian-900/90 p-6 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gold-500/15 pb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
                Sharded NFT Items Draft 1.0.0 · T0–T3 Verification Ladder
              </span>
              <h2 className="font-serif text-2xl font-bold text-white">
                Bukti Tanpa Kunci (Live Keyless Proof Verifier)
              </h2>
            </div>
            {proof?.allVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-segel-500 bg-segel-500/15 px-3 py-1 font-mono text-xs font-bold text-segel-400">
                <ShieldCheck className="h-4 w-4" />
                VERIFIED KEYLESS & CONSISTENT
              </span>
            ) : proof?.pairStatus === "IndexBehind" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500 bg-amber-500/15 px-3 py-1 font-mono text-xs font-bold text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                TRANSFERRING · INDEX BEHIND
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-obsidian-800 px-3 py-1 font-mono text-xs text-slate-300">
                Pinned Block #{proof?.blockHeight ?? "—"}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* Check 1: T0 Namespace */}
            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-obsidian-950/80 p-3.5">
              <div>
                <p className="font-mono text-xs font-bold text-white">
                  1. Tier T0 Namespace Check
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {proof?.t0Detail || `Checking ${tokenId} under ${registryId}`}
                </p>
              </div>
              {proof?.t0NamespaceOk ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-segel-400" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-threat-400" />
              )}
            </div>

            {/* Check 2: T1/T2 Same-Final-Block Pair Check */}
            <div className="rounded-xl border border-slate-800 bg-obsidian-950/80 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-white">
                    2. Tier T1/T2 Same-Final-Block Pair Check (`pair_check`)
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {proof?.pairDetail}
                  </p>
                </div>
                {proof?.pairStatus === "Consistent" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-segel-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                )}
              </div>

              {proof?.pairStatus === "IndexBehind" && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
                  <span className="text-xs text-amber-200">
                    Vault rotated to seq #{proof.vaultSeq} while Registry Index is at seq #{proof.registrySeq}.
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      runAction("Permissionless sync()", () =>
                        callContractMethod({
                          receiverId: registryId,
                          methodName: "sync",
                          args: { token_id: tokenId },
                          gas: "100000000000000",
                          deposit: "0",
                        })
                      )
                    }
                    className="rounded-lg bg-amber-400 px-3 py-1 font-mono text-xs font-bold text-obsidian-950 hover:bg-amber-300"
                  >
                    Heal Index: sync(&ldquo;{tokenId}&rdquo;)
                  </button>
                </div>
              )}
            </div>

            {/* Check 3: Seat Zero-Key Proof */}
            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-obsidian-950/80 p-3.5">
              <div>
                <p className="font-mono text-xs font-bold text-white">
                  3. Seat Zero-Key Proof (`view_access_key_list({tokenId})`)
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  Access keys on seat sub-account:{" "}
                  <strong className="text-segel-400">
                    {proof ? `${proof.seatKeysCount} keys` : "—"}
                  </strong>{" "}
                  (Seller cannot keep a backup key because 0 keys exist)
                </p>
              </div>
              {proof?.seatZeroKeysOk ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-segel-400" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-slate-500" />
              )}
            </div>

            {/* Check 4: Parent Segel Status */}
            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-obsidian-950/80 p-3.5">
              <div>
                <p className="font-mono text-xs font-bold text-white">
                  4. Tier T3 Parent Segel (`view_access_key_list({registryId})`)
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  Parent registry access keys:{" "}
                  <strong className="text-gold-300">
                    {proof ? `${proof.parentKeysCount} keys` : "—"}
                  </strong>{" "}
                  (Sealed parent cannot redeploy or inject keys into child seats)
                </p>
              </div>
              {proof?.parentSegelOk ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-segel-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              )}
            </div>

            {/* Check 5: Vault Code Hash */}
            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-obsidian-950/80 p-3.5">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-white">
                  5. Immutable Vault Code Hash (`view_account.code_hash`)
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                  Actual: {proof?.actualCodeHash} · Expected: {proof?.expectedCodeHash}
                </p>
              </div>
              {proof?.vaultCodeHashOk ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-segel-400" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-slate-500" />
              )}
            </div>
          </div>
        </div>
      </div>

      {actionStatus && (
        <div className="rounded-2xl border border-gold-500/40 bg-obsidian-800 p-4 font-mono text-xs text-gold-300">
          {actionStatus}
        </div>
      )}

      <KratonDivider label="Vault Money & Ownership Controls" />

      {/* Money & Actions Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Card 1: Permissionless Pool Claim & Sync */}
        <div className="space-y-4 rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-segel-400">
              Permissionless · Anyone May Call
            </span>
            <Coins className="h-4 w-4 text-segel-400" />
          </div>
          <h3 className="font-serif text-xl font-bold text-white">
            Claim Member Pool to Vault
          </h3>
          <p className="text-xs text-slate-300">
            Calls <span className="font-mono text-gold-300">registry.claim({`{ token_id }`})</span>.
            Follows Golden Rule I7: sends accrued NEAR strictly to{" "}
            <span className="font-mono text-gold-300">{tokenId}</span>, never to a personal wallet.
          </p>

          <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Accrued Claimable:</span>
              <span className="font-bold text-segel-400">
                {formatYocto(seat?.claimable ?? "0")} NEAR
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-400">Total Claimed Lifetime:</span>
              <span className="text-slate-200">
                {formatYocto(seat?.total_claimed ?? "0")} NEAR
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              runAction(`claim(${tokenId})`, () =>
                callContractMethod({
                  receiverId: registryId,
                  methodName: "claim",
                  args: { token_id: tokenId },
                  gas: "30000000000000", // 30 Tgas
                  deposit: "0",
                })
              )
            }
            className="w-full rounded-xl bg-gradient-to-r from-segel-500 to-segel-400 py-2.5 text-xs font-bold text-obsidian-950 transition hover:brightness-110 disabled:opacity-50"
          >
            Claim Pool Share to Vault (30 Tgas)
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              runAction(`sync(${tokenId})`, () =>
                callContractMethod({
                  receiverId: registryId,
                  methodName: "sync",
                  args: { token_id: tokenId },
                  gas: "100000000000000",
                  deposit: "0",
                })
              )
            }
            className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 py-2 text-xs font-medium text-gold-300 hover:bg-obsidian-900"
          >
            Run Permissionless Index `sync()`
          </button>
        </div>

        {/* Card 2: Owner Withdraw & Transfer */}
        <div className="space-y-4 rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-gold-400">
              {isOwner ? "You Are Canonical Owner" : `Owner Only (${canonicalOwner})`}
            </span>
            <Send className="h-4 w-4 text-gold-400" />
          </div>
          <h3 className="font-serif text-xl font-bold text-white">
            Withdraw NEAR & Transfer Seat
          </h3>

          {/* Withdraw Form */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-obsidian-950 p-3">
            <p className="font-mono text-[11px] font-semibold text-gold-300">
              Direct Call: `{tokenId}::withdraw` (1 yocto)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={withdrawNear}
                onChange={(e) => setWithdrawNear(e.target.value)}
                placeholder="Amount (NEAR)"
                className="rounded-lg border border-slate-700 bg-obsidian-900 px-2.5 py-1.5 font-mono text-xs text-white"
              />
              <input
                type="text"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                placeholder={accountId || "receiver.testnet"}
                className="rounded-lg border border-slate-700 bg-obsidian-900 px-2.5 py-1.5 font-mono text-xs text-white"
              />
            </div>
            <button
              type="button"
              disabled={isBusy || isListed}
              onClick={() =>
                runAction("vault.withdraw", () => {
                  const amount = parseNearToYocto(withdrawNear);
                  const args: Record<string, unknown> = { amount };
                  if (withdrawTo.trim()) args.to = withdrawTo.trim();
                  return callContractMethod({
                    receiverId: tokenId,
                    methodName: "withdraw",
                    args,
                    gas: "30000000000000",
                    deposit: "1",
                  });
                })
              }
              className="w-full rounded-lg bg-gold-500 py-2 text-xs font-bold text-obsidian-950 hover:bg-gold-400 disabled:opacity-40"
            >
              {isListed
                ? "Blocked While Listed (E_FROZEN)"
                : `Withdraw ${withdrawNear} NEAR from Vault`}
            </button>
          </div>

          {/* Transfer Form */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-obsidian-950 p-3">
            <p className="font-mono text-[11px] font-semibold text-slate-300">
              Atomic Transfer: `registry.nft_transfer` (1 yocto)
            </p>
            <input
              type="text"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              placeholder="new-owner.testnet"
              className="w-full rounded-lg border border-slate-700 bg-obsidian-900 px-2.5 py-1.5 font-mono text-xs text-white"
            />
            <button
              type="button"
              disabled={isBusy || isListed}
              onClick={() =>
                runAction("registry.nft_transfer", () =>
                  callContractMethod({
                    receiverId: registryId,
                    methodName: "nft_transfer",
                    args: {
                      receiver_id: transferTo.trim(),
                      token_id: tokenId,
                    },
                    gas: "100000000000000",
                    deposit: "1",
                  })
                )
              }
              className="w-full rounded-lg border border-gold-500/40 bg-obsidian-800 py-2 text-xs font-semibold text-gold-300 hover:bg-obsidian-700 disabled:opacity-40"
            >
              Rotate Seat & Vault Ownership
            </button>
          </div>
        </div>

        {/* Card 3: Safe Sale Listing & Epoch-Bound Delegate */}
        <div className="space-y-4 rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-gold-400">
              Safe Sale Freeze & Epoch Delegate
            </span>
            {isListed ? (
              <Lock className="h-4 w-4 text-threat-400" />
            ) : (
              <Unlock className="h-4 w-4 text-segel-400" />
            )}
          </div>
          <h3 className="font-serif text-xl font-bold text-white">
            Market Listing & Delegate
          </h3>

          {/* Safe Sale Listing */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-obsidian-950 p-3">
            <p className="font-mono text-[11px] font-semibold text-gold-300">
              Safe Sale: Freezes All Outflows (`E_FROZEN`)
            </p>
            {!isListed ? (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-[10px] text-slate-400">Price (N)</label>
                    <input
                      type="text"
                      value={listPriceNear}
                      onChange={(e) => setListPriceNear(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-obsidian-900 px-2 py-1 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">
                      Min Bal (N)
                    </label>
                    <input
                      type="text"
                      value={listMinBalNear}
                      onChange={(e) => setListMinBalNear(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-obsidian-900 px-2 py-1 font-mono text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">TTL (sec)</label>
                    <input
                      type="number"
                      value={listTtlSec}
                      onChange={(e) => setListTtlSec(e.target.value)}
                      className="w-full rounded border border-slate-700 bg-obsidian-900 px-2 py-1 font-mono text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    runAction("registry.list_seat", () =>
                      callContractMethod({
                        receiverId: registryId,
                        methodName: "list_seat",
                        args: {
                          token_id: tokenId,
                          price: parseNearToYocto(listPriceNear),
                          min_balance: parseNearToYocto(listMinBalNear || "0"),
                          ttl_sec: Number(listTtlSec),
                        },
                        gas: "100000000000000",
                        deposit: "1",
                      })
                    )
                  }
                  className="w-full rounded-lg bg-gold-500 py-2 text-xs font-bold text-obsidian-950 hover:bg-gold-400"
                >
                  Freeze Vault & List Seat
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="font-mono text-xs text-threat-400">
                  Listed at {formatYocto(vault?.listing?.price ?? seat?.listing?.price ?? "0")} NEAR
                  (Nonce #{vault?.listing?.nonce ?? seat?.listing?.nonce ?? 1})
                </p>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    runAction("registry.cancel_listing", () =>
                      callContractMethod({
                        receiverId: registryId,
                        methodName: "cancel_listing",
                        args: { token_id: tokenId },
                        gas: "100000000000000",
                        deposit: "1",
                      })
                    )
                  }
                  className="w-full rounded-lg border border-threat-500/50 bg-threat-500/15 py-2 text-xs font-bold text-threat-400 hover:bg-threat-500/25"
                >
                  Cancel Listing & Unfreeze Vault
                </button>
              </div>
            )}
          </div>

          {/* Delegate Controls */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-obsidian-950 p-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-semibold text-slate-300">
                Delegate (Bound to seq #{canonicalSeq}; dies on transfer)
              </p>
              <UserCheck className="h-3.5 w-3.5 text-gold-400" />
            </div>
            {vault?.delegate ? (
              <div className="space-y-2 font-mono text-xs">
                <p className="text-segel-400">
                  Active: {activeDelegateId} (Remaining:{" "}
                  {formatYocto(vault.delegate.remaining)} NEAR, seq #{vault.delegate.seq})
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      runAction("vault.revoke_delegate", () =>
                        callContractMethod({
                          receiverId: tokenId,
                          methodName: "revoke_delegate",
                          args: {},
                          gas: "30000000000000",
                          deposit: "1",
                        })
                      )
                    }
                    className="flex-1 rounded-lg border border-threat-500/40 bg-threat-500/10 py-1.5 text-xs text-threat-400"
                  >
                    Revoke Delegate
                  </button>
                  {isDelegate && (
                    <button
                      type="button"
                      disabled={isBusy || isListed}
                      onClick={() =>
                        runAction("vault.delegate_withdraw", () =>
                          callContractMethod({
                            receiverId: tokenId,
                            methodName: "delegate_withdraw",
                            args: {
                              amount: parseNearToYocto(delegateWithdrawNear),
                            },
                            gas: "30000000000000",
                            deposit: "0",
                          })
                        )
                      }
                      className="flex-1 rounded-lg bg-segel-500 py-1.5 text-xs font-bold text-obsidian-950"
                    >
                      Delegate Spend ({delegateWithdrawNear}N)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={delegateAccount}
                  onChange={(e) => setDelegateAccount(e.target.value)}
                  placeholder="agent.testnet"
                  className="w-full rounded border border-slate-700 bg-obsidian-900 px-2 py-1 font-mono text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={delegateAllowance}
                    onChange={(e) => setDelegateAllowance(e.target.value)}
                    placeholder="Allowance (NEAR)"
                    className="rounded border border-slate-700 bg-obsidian-900 px-2 py-1 font-mono text-xs text-white"
                  />
                  <input
                    type="number"
                    value={delegateTtlSec}
                    onChange={(e) => setDelegateTtlSec(e.target.value)}
                    placeholder="TTL sec"
                    className="rounded border border-slate-700 bg-obsidian-900 px-2 py-1 font-mono text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={isBusy || isListed}
                  onClick={() =>
                    runAction("vault.set_delegate", () =>
                      callContractMethod({
                        receiverId: tokenId,
                        methodName: "set_delegate",
                        args: {
                          account_id: delegateAccount.trim(),
                          allowance: parseNearToYocto(delegateAllowance),
                          ttl_sec: Number(delegateTtlSec),
                        },
                        gas: "30000000000000",
                        deposit: "1",
                      })
                    )
                  }
                  className="w-full rounded-lg border border-gold-500/40 bg-obsidian-800 py-1.5 text-xs font-semibold text-gold-300 hover:bg-obsidian-700 disabled:opacity-40"
                >
                  Appoint Epoch-Bound Delegate
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <KratonDivider label="Requirement R3 · Complete On-Chain Seat History & Cumulative Balance" />

      {/* Seat History View (R3) */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-gold-400" />
            <div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Seat Provenance, Earnings, Claims & Vault Outflows
              </h2>
              <p className="text-xs text-slate-400">
                Merged live from `registry.get_seat_history(&ldquo;{tokenId}&rdquo;)` and
                `{tokenId}::get_outflows()` ring buffer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="rounded-lg border border-gold-500/30 bg-obsidian-950 px-3 py-1 text-gold-300">
              Holders: {history.holders.length}
            </span>
            <span className="rounded-lg border border-segel-500/30 bg-obsidian-950 px-3 py-1 text-segel-400">
              Claims: {history.claims.length}
            </span>
            <span className="rounded-lg border border-threat-500/30 bg-obsidian-950 px-3 py-1 text-threat-400">
              Outflows: {outflows.length}
            </span>
          </div>
        </div>

        {mergedTimeline.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-obsidian-950/70 p-8 text-center font-mono text-xs text-slate-400">
            No on-chain history events recorded yet for `{tokenId}`.
          </div>
        ) : (
          <div className="space-y-4">
            {mergedTimeline.map((item, idx) => (
              <div
                key={`${item.at_ms}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-obsidian-950/85 p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                        item.kind === "holder"
                          ? "bg-gold-500/20 text-gold-300"
                          : item.kind === "claim"
                          ? "bg-segel-500/20 text-segel-400"
                          : item.kind === "earning"
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-threat-500/20 text-threat-400"
                      }`}
                    >
                      {item.badge}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatTimestampMs(item.at_ms)}
                    </span>
                  </div>
                  <p className="font-mono text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-400">{item.subtitle}</p>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className="block text-[10px] text-slate-500">
                    CUMULATIVE VAULT
                  </span>
                  <span className="font-bold text-gold-300">
                    {formatYocto(item.cumulativeYocto)} NEAR
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
