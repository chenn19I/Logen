"use client";

import React, { useState } from "react";
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
  RefreshCw,
  Coins,
  Store,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import {
  formatYocto,
  parseNearToYocto,
  splitTicketRevenue,
} from "@/lib/near/format";

const RECEIPT_STEPS = [
  {
    step: 1,
    badge: "Receipt #1 · Registry",
    title: "1. Caller Invokes registry.nft_transfer(B, token_id)",
    code: "registry.nft_transfer({ receiver_id: 'bob.testnet', token_id: 's001.pusaka.testnet' })",
    summary:
      "Registry verifies caller is current index owner A, receiver B != A, and seat is not Listed in the mirror. Dispatches cross-contract call `vault.v_rotate(from=A, to=B, expected_seq=n)`.",
    oldOwnerAccess: "Active until Receipt #2 executes",
    vaultState: "owner = alice.testnet, rotation_seq = n, status = Idle",
    indexState: "owner = alice.testnet, seq = n",
  },
  {
    step: 2,
    badge: "Receipt #2 · Vault [ATOMIC CUT-OFF]",
    title: "2. Vault Executes v_rotate(from=A, to=B, expected_seq=n)",
    code: "vault.v_rotate({ from: 'alice.testnet', to: 'bob.testnet', expected_seq: n })",
    summary:
      "Inside the seat sub-account itself, in a SINGLE atomic receipt: verifies owner == A, status == Idle, and rotation_seq == n. Immediately sets owner = B, rotation_seq = n + 1, and wipes any delegate.",
    oldOwnerAccess: "BLOCKED (E_NOT_OWNER / E_STALE_DELEGATE)",
    vaultState: "owner = bob.testnet, rotation_seq = n + 1, delegate = None",
    indexState: "owner = alice.testnet, seq = n (1-block callback window)",
  },
  {
    step: 3,
    badge: "Receipt #3 · Callback & Permissionless sync()",
    title: "3. Registry Callback (or Anyone's sync) Advances Index",
    code: "registry.on_rotated() // or permissionless registry.sync({ token_id })",
    summary:
      "Callback advances registry index to B at seq = n + 1 and records holder history. Even if the callback runs out of gas, the vault is already owned by B, the Lounge gate fails closed on T2 pair_check, and anyone can call `sync(token_id)` to heal the index.",
    oldOwnerAccess: "PERMANENTLY ZERO (0 Access Keys + Seq Advanced)",
    vaultState: "owner = bob.testnet, rotation_seq = n + 1",
    indexState: "owner = bob.testnet, seq = n + 1 (PairCheck = Consistent)",
  },
];

export default function HomePage() {
  const {
    accountId,
    registryId,
    config,
    stats,
    parentKeysCount,
    contractDeployed,
    openWalletModal,
    callContractMethod,
  } = useNear();

  const [activeReceiptStep, setActiveReceiptStep] = useState<number>(1);
  const [handleInput, setHandleInput] = useState<string>("");
  const [mintStatus, setMintStatus] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState<boolean>(false);

  // Interactive Revenue Split Calculator state
  const [calcTicketNear, setCalcTicketNear] = useState<string>("25");
  const [calcSeatsCount, setCalcSeatsCount] = useState<number>(
    stats?.seats_minted && stats.seats_minted > 0 ? stats.seats_minted : 7
  );

  const seatPriceYocto = config?.seat_price || "5000000000000000000000000"; // default 5 NEAR
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
      setMintStatus("Error: Handle must be 2–20 lowercase alphanumeric/dash characters (E_BAD_HANDLE).");
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
        gas: "150000000000000", // 150 Tgas per docs/API.md
        deposit: seatPriceYocto,
      });
      setMintStatus(`Minted ${previewAccountId} with 0 access keys!`);
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
    "25000000000000000000000000",
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

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-gold-500/30 bg-gradient-to-br from-obsidian-800/95 via-obsidian-900 to-obsidian-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.65)] lg:p-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-3.5 py-1 text-xs font-medium text-gold-300">
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              <span>NEAR Hackathon · Track 10: NFTs That Do Something</span>
              <span className="text-gold-500/60">·</span>
              <span className="font-mono text-[11px] text-segel-400">
                sharded-item-1.0.0
              </span>
            </div>

            <div className="space-y-3">
              <p className="font-serif text-lg italic tracking-wide text-gold-300/90">
                &ldquo;Keanggotaan yang diwariskan bersama isinya&rdquo;
              </p>
              <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Sell the seat.{" "}
                <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 bg-clip-text text-transparent">
                  The wallet goes with it.
                </span>
              </h1>
            </div>

            <p className="max-w-2xl text-base leading-relaxed text-slate-300">
              Every <strong className="text-white">Pusaka Seat</strong> is both an{" "}
              <span className="font-mono text-gold-300">NEP-171</span> token and a real
              NEAR sub-account (<span className="font-mono text-gold-300">s001.{registryId}</span>)
              created with <strong className="text-segel-400">zero access keys</strong>.
              It holds NEAR, earns <strong className="text-white">40%</strong> of every club
              event ticket sold via an <span className="font-mono text-gold-300">O(1)</span>{" "}
              accumulator, and settles secondary sales atomically inside the vault so a
              seller can never leave a backdoor key or drain the balance.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/seats"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 px-5 py-3 text-sm font-semibold text-obsidian-950 shadow-[0_0_25px_rgba(212,166,74,0.3)] transition hover:brightness-110"
              >
                Explore Seat Vaults
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/market"
                className="inline-flex items-center gap-2 rounded-xl border border-gold-500/40 bg-obsidian-800/90 px-5 py-3 text-sm font-medium text-gold-300 transition hover:bg-obsidian-700"
              >
                <Store className="h-4 w-4" />
                Safe Secondary Market
              </Link>
              <Link
                href="/lab"
                className="inline-flex items-center gap-2 rounded-xl border border-threat-500/40 bg-threat-500/10 px-4 py-3 text-sm font-medium text-threat-400 transition hover:bg-threat-500/20"
              >
                <Flame className="h-4 w-4" />
                Attack Lab (80,418 Schedules)
              </Link>
              <Link
                href="/lounge"
                className="inline-flex items-center gap-2 rounded-xl border border-segel-500/40 bg-segel-500/10 px-4 py-3 text-sm font-medium text-segel-400 transition hover:bg-segel-500/20"
              >
                <Lock className="h-4 w-4" />
                NEP-413 Holder Lounge
              </Link>
            </div>
          </div>

          {/* Quick Mint Seat CTA Card */}
          <div className="rounded-2xl border border-gold-500/35 bg-obsidian-950/90 p-6 shadow-2xl lg:col-span-5">
            <div className="mb-4 flex items-center justify-between border-b border-gold-500/15 pb-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
                  Atomic Factory Batch (K1)
                </span>
                <h2 className="font-serif text-2xl font-bold text-white">
                  Mint a Keyless Seat Vault
                </h2>
              </div>
              <span className="rounded-lg border border-segel-500/40 bg-segel-500/10 px-2.5 py-1 font-mono text-xs text-segel-400">
                0 Access Keys
              </span>
            </div>

            <form onSubmit={handleMintSeat} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Optional Custom Handle (or leave blank for auto{" "}
                  <span className="font-mono text-gold-300">sNNN</span>)
                </label>
                <div className="flex items-center rounded-xl border border-gold-500/30 bg-obsidian-900 px-3 py-2.5 focus-within:border-gold-400">
                  <input
                    type="text"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    placeholder="garuda"
                    className="w-full bg-transparent font-mono text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                  <span className="shrink-0 font-mono text-xs text-gold-400">
                    .{registryId}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-obsidian-900/70 p-3.5 font-mono text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sub-account created:</span>
                  <span className="text-gold-300">{previewAccountId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mint Price (`seat_price`):</span>
                  <span className="text-white">{formatYocto(seatPriceYocto)} NEAR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Initial Vault Reserve:</span>
                  <span className="text-segel-400">
                    {formatYocto(
                      config?.vault_initial_balance || "150000000000000000000000"
                    )}{" "}
                    NEAR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Batch Actions (1 Receipt):</span>
                  <span className="text-slate-200">
                    CreateAccount → Transfer → UseGlobalContract → init
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isMinting}
                className="w-full rounded-xl bg-gradient-to-r from-gold-500 via-gold-400 to-gold-500 py-3 text-sm font-bold text-obsidian-950 shadow-[0_0_25px_rgba(212,166,74,0.25)] transition hover:brightness-110 disabled:opacity-50"
              >
                {isMinting
                  ? "Signing mint_seat (150 Tgas)..."
                  : accountId
                  ? `Mint ${previewAccountId} (${formatYocto(seatPriceYocto)} NEAR)`
                  : "Connect Wallet to Mint Seat"}
              </button>

              {mintStatus && (
                <div className="rounded-lg border border-gold-500/30 bg-obsidian-800 p-2.5 font-mono text-xs text-gold-300">
                  {mintStatus}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Live Protocol Telemetry Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white">
              Live Protocol State · <span className="font-mono text-gold-400">{registryId}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Queried directly from NEAR Testnet RPC (`get_stats` + `get_config` + `view_access_key_list`)
            </p>
          </div>
          {!contractDeployed && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Contract `{registryId}` not yet deployed or initialized on testnet — use{" "}
              <strong className="font-mono">Switch</strong> in the top bar to inspect any live registry.
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Seats Minted / Max</span>
              <ShieldCheck className="h-4 w-4 text-gold-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {stats ? `${stats.seats_minted} / ${config?.max_seats ?? "—"}` : "0 / —"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-segel-400">
              Parent Segel Keys: {parentKeysCount !== null ? parentKeysCount : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>O(1) Accumulator (`acc`)</span>
              <Coins className="h-4 w-4 text-gold-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-gold-300">
              {formatYocto(stats?.acc ?? "0")} <span className="text-sm">NEAR/seat</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              Pool Distributed: {formatYocto(stats?.total_pool_distributed ?? "0")} NEAR (carry:{" "}
              {stats?.carry ?? "0"} yocto)
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Club Events & Tickets Sold</span>
              <Layers className="h-4 w-4 text-segel-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {stats?.tickets_sold ?? 0}{" "}
              <span className="text-sm font-normal text-slate-400">
                tickets ({stats?.events_count ?? 0} events)
              </span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              Kas Klub Owed: {formatYocto(stats?.kas_klub_owed ?? "0")} NEAR
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/25 bg-obsidian-800/80 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Safe Secondary Volume</span>
              <Store className="h-4 w-4 text-gold-400" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-white">
              {formatYocto(stats?.sales_volume ?? "0")}{" "}
              <span className="text-sm font-normal text-slate-400">NEAR</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {stats?.sales_count ?? 0} atomic sales · Royalties:{" "}
              {formatYocto(stats?.royalties_total ?? "0")} NEAR
            </p>
          </div>
        </div>
      </section>

      <KratonDivider label="Requirement R1 · How Control Moves in One Receipt" />

      {/* Interactive 3-Step Receipt Diagram */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              Architectural Proof · K1 Zero Keys + K2 Canonical Vault
            </span>
            <h2 className="mt-1 font-serif text-3xl font-bold text-white">
              How Ownership Rotates Atomically Without Touching Access Keys
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {RECEIPT_STEPS.map((s) => (
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

        {/* Step Cards */}
        <div className="grid gap-4 lg:grid-cols-3">
          {RECEIPT_STEPS.map((s) => {
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
                      MOMENT OF CUT-OFF
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
                    <span className="text-slate-400">Old Owner Access:</span>
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
                Why Key-Swap NFT Wallets Fail
              </h4>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>
                • <strong>Backdoor keys:</strong> A NEAR smart contract cannot enumerate its own access keys on-chain (`view_access_key_list` is RPC-only). A seller can plant a backup `FullAccess` or `FunctionCall` key before selling.
              </li>
              <li>
                • <strong>Drain before settle:</strong> Buyer checks the wallet balance in block N, signs a buy tx, and the seller drains the wallet in block N+1 before ownership switches.
              </li>
              <li>
                • <strong>Stale web sessions:</strong> Traditional JWT gates stay valid until expiry even after the holder sells the NFT.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-segel-500/30 bg-segel-500/5 p-5">
            <div className="flex items-center gap-2 text-segel-400">
              <CheckCircle2 className="h-4 w-4" />
              <h4 className="font-serif text-lg font-bold">
                How Pusaka Eliminates Every Seller Vector
              </h4>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-300">
              <li>
                • <strong>Zero keys from birth (K1):</strong> Seat sub-account is created in an atomic batch without `AddKey`. Both parent (`{registryId}`) and seat have `keys.length === 0`.
              </li>
              <li>
                • <strong>Atomic Vault Settlement (K2):</strong> `list_seat` freezes all vault outflows (`E_FROZEN`). `v_settle_sale` verifies `nonce` and `withdrawable &gt;= max(seller_min, buyer_min)` in the exact receipt that rotates `owner_id`.
              </li>
              <li>
                • <strong>Epoch-bound sessions & delegates:</strong> Delegates and `/lounge` cookies bind to `rotation_seq` and die automatically the block a transfer lands.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <KratonDivider label="O(1) Revenue Split & Remainder Carry Calculator" />

      {/* Revenue Split Visualizer */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-5">
            <span className="font-mono text-xs uppercase tracking-widest text-gold-400">
              Design Decision K3 · Overflow-Safe O(1) Accumulator
            </span>
            <h2 className="font-serif text-3xl font-bold text-white">
              40% Member Pool · 50% Kas Klub · 10% Organizer
            </h2>
            <p className="text-xs leading-relaxed text-slate-300">
              Every event ticket purchase splits payment automatically. The{" "}
              <strong className="text-gold-300">40% Pool Anggota</strong> updates a global
              per-seat accumulator (<span className="font-mono">acc += (pool + carry) / seats</span>)
              in <span className="font-mono">O(1)</span> gas without looping over members or
              multiplying by a <span className="font-mono">10^24</span> scaling factor that
              would overflow <span className="font-mono">u128</span>. Any integer division
              remainder is carried into the next ticket so not a single yoctoNEAR is ever lost.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Simulated Ticket Payment (NEAR)
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
                  Minted Seats (`seats_minted`)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={calcSeatsCount}
                  onChange={(e) => setCalcSeatsCount(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2 font-mono text-sm text-white focus:border-gold-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:col-span-7">
            {/* Visual Bar */}
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
                  +{formatYocto(calcSplitResult.perSeat, 6)} NEAR / seat
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  Carry remainder: {calcSplitResult.carry.toString()} yocto
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
                    ? "Includes 40% pool (0 seats minted)"
                    : "Pull ledger to fixed Kas Klub account"}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-500/30 bg-obsidian-950 p-4">
                <span className="font-mono text-[11px] text-indigo-300">
                  10% ORGANIZER LEDGER
                </span>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {formatYocto(calcSplitResult.organizer)} NEAR
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  Pull ledger via release_organizer()
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
