"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Landmark,
  RefreshCw,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { EXPLORER_URL, getSales } from "@/lib/near/rpc";
import type { Sale } from "@/lib/near/types";
import { formatTimestampMs, formatYocto } from "@/lib/near/format";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";

export default function TreasuryPage() {
  const {
    accountId,
    registryId,
    config,
    stats,
    refreshChainState,
    openWalletModal,
    callContractMethod,
  } = useNear();
  const { demo } = useDemo();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await refreshChainState();
      const s = await getSales(registryId, 0, 50);
      setSales(s);
    } finally {
      setLoading(false);
    }
  }, [registryId, refreshChainState]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRelease = async (
    method: "release_kas_klub" | "release_organizer"
  ) => {
    if (demo) {
      setIsBusy(true);
      await new Promise((r) => window.setTimeout(r, 600));
      setStatusMsg(`Simulated ${method}() executed.`);
      setIsBusy(false);
      return;
    }

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
        args: {},
        gas: "30000000000000",
        deposit: "0",
      });
      setStatusMsg(`Executed ${method}() successfully!`);
      await loadData();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="bracket-label">[ TREASURY / PULL LEDGERS ]</span>
          <h1 className="mt-2 text-40 font-semibold text-paper">
            Club treasury & ledgers.
          </h1>
          <p className="mt-2 max-w-[58ch] text-14 leading-relaxed text-paper-muted">
            To prevent failed cross-contract pushes from ever blocking a ticket sale or
            seat handoff, all outgoing protocol splits in{" "}
            <span className="font-mono text-paper">{registryId}</span> use permissionless
            pull ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Chip tone={demo ? "caution" : "accent"} dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {statusMsg ? (
        <div
          role="status"
          className="rounded border border-[rgba(123,216,143,0.3)] bg-positive-soft px-4 py-3 font-mono text-12 text-positive"
        >
          {statusMsg}
        </div>
      ) : null}

      {/* Three Core Treasury Books */}
      <Reveal>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 1. Kas Klub Ledger */}
          <Panel className="flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="bracket-label">[ 01 / KAS KLUB ]</span>
              <Landmark className="h-4 w-4 text-positive" />
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-24 font-semibold text-paper">Club Treasury</h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                  50% ticket cut + 5% secondary royalties
                </p>
              </div>

              <dl className="divide-y divide-line border-y border-line font-mono text-12">
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Recipient</dt>
                  <dd className="truncate max-w-[180px] text-paper">
                    {config?.kas_klub_id || "kas.logen.testnet"}
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Owed (kas_klub_owed)</dt>
                  <dd className="text-positive tabular">
                    {formatYocto(stats?.kas_klub_owed ?? "0")} NEAR
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Total released</dt>
                  <dd className="text-paper tabular">
                    {formatYocto(stats?.kas_klub_released ?? "0")} NEAR
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Royalties accrued</dt>
                  <dd className="text-signal tabular">
                    {formatYocto(stats?.royalties_total ?? "0")} NEAR
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-line p-4">
              <Button
                fullWidth
                disabled={
                  isBusy || (!demo && BigInt(stats?.kas_klub_owed || "0") === 0n)
                }
                onClick={() => void handleRelease("release_kas_klub")}
              >
                Trigger release_kas_klub()
              </Button>
            </div>
          </Panel>

          {/* 2. Organizer Ledger */}
          <Panel className="flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="bracket-label">[ 02 / ORGANIZER ]</span>
              <Coins className="h-4 w-4 text-signal" />
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-24 font-semibold text-paper">Organizer Ledger</h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                  10% primary ticket cut
                </p>
              </div>

              <dl className="divide-y divide-line border-y border-line font-mono text-12">
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Recipient</dt>
                  <dd className="truncate max-w-[180px] text-paper">
                    {config?.organizer_id || "organizer.logen.testnet"}
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Owed (organizer_owed)</dt>
                  <dd className="text-signal tabular">
                    {formatYocto(stats?.organizer_owed ?? "0")} NEAR
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Total released</dt>
                  <dd className="text-paper tabular">
                    {formatYocto(stats?.organizer_released ?? "0")} NEAR
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Events created</dt>
                  <dd className="text-paper tabular">{stats?.events_count ?? 0}</dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-line p-4">
              <Button
                variant="secondary"
                fullWidth
                disabled={
                  isBusy || (!demo && BigInt(stats?.organizer_owed || "0") === 0n)
                }
                onClick={() => void handleRelease("release_organizer")}
              >
                Trigger release_organizer()
              </Button>
            </div>
          </Panel>

          {/* 3. Member Pool Accumulator Book */}
          <Panel className="flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="bracket-label">[ 03 / MEMBER POOL ]</span>
              <CheckCircle2 className="h-4 w-4 text-positive" />
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-24 font-semibold text-paper">Seat Holders</h2>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-paper-muted">
                  40% primary ticket cut · O(1) accrual
                </p>
              </div>

              <dl className="divide-y divide-line border-y border-line font-mono text-12">
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Accumulator (acc)</dt>
                  <dd className="text-positive tabular">
                    {formatYocto(stats?.acc ?? "0")} NEAR/seat
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Total distributed</dt>
                  <dd className="text-paper tabular">
                    {formatYocto(stats?.total_pool_distributed ?? "0")} NEAR
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Claimed to vaults</dt>
                  <dd className="text-positive tabular">
                    {formatYocto(stats?.total_claimed ?? "0")} NEAR
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-paper-muted">Remainder carry</dt>
                  <dd className="text-paper-muted tabular">
                    {stats?.carry ?? "0"} yocto
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-line p-4">
              <a
                href={`${EXPLORER_URL}/address/${registryId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded border border-line bg-surface-sunken px-4 font-mono text-12 text-paper transition-colors hover:border-line-strong"
              >
                Inspect {registryId}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Panel>
        </div>
      </Reveal>

      {/* Secondary Sales Table */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <span className="bracket-label">[ SECONDARY SALES & 5% ROYALTY LOG ]</span>
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
            Total volume: {formatYocto(stats?.sales_volume ?? "0")} NEAR
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {sales.length === 0 ? (
            <p className="font-mono text-12 text-paper-muted">
              No secondary sales recorded on {registryId} yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-12">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-label text-paper-muted">
                    <th className="pb-2">Seat</th>
                    <th className="pb-2">Seller</th>
                    <th className="pb-2">Buyer</th>
                    <th className="pb-2">Sale price</th>
                    <th className="pb-2">Club royalty</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sales.map((s, idx) => (
                    <tr key={`${s.token_id}-${s.at_ms}-${idx}`}>
                      <td className="py-2.5 text-paper">{s.token_id}</td>
                      <td className="py-2.5 text-paper-muted">{s.seller}</td>
                      <td className="py-2.5 text-positive">{s.buyer}</td>
                      <td className="py-2.5 text-paper tabular">
                        {formatYocto(s.price)} NEAR
                      </td>
                      <td className="py-2.5 text-signal tabular">
                        {formatYocto(s.royalty)} NEAR
                      </td>
                      <td className="py-2.5 text-paper-muted">
                        {formatTimestampMs(s.at_ms)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
