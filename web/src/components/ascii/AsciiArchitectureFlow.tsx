"use client";

import React, { useEffect, useState } from "react";
import { Check, Cpu, Lock, ShieldCheck, Terminal, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";

interface FlowSpec {
  id: "mint" | "accrual" | "resale";
  code: string;
  title: string;
  subtitle: string;
  method: string;
  invariant: string;
  gas: string;
  asciiLines: string[];
  steps: Array<{
    tag: string;
    label: string;
    detail: string;
  }>;
}

const FLOWS: FlowSpec[] = [
  {
    id: "mint",
    code: "01 / KEYLESS VAULT",
    title: "Mint Seat & Delete All Keys",
    subtitle:
      "Each seat is deployed as a direct NEAR sub-account with its own contract code and zero access keys.",
    method: "registry.mint_seat({ handle })",
    invariant: "view_access_key_list() == [] (0 keys)",
    gas: "220 TGas · 1 Cross-Contract Receipt",
    asciiLines: [
      "┌──────────────────┐    mint_seat()     ┌────────────────────────┐",
      "│   holder.near    │ ═════════════════► │ registry.logen.testnet │",
      "└──────────────────┘                    └───────────┬────────────┘",
      "                                                    │",
      "                                     CreateAccount + DeployContract",
      "                                     + init() + DeleteKey(all)",
      "                                                    ▼",
      "┌────────────────────────────────────────────────────────────────┐",
      "│ VAULT: s007.logen.testnet  [KEYS: 0]  [CODE: PINNED SHA-256]   │",
      "│ ├─ owner_id: holder.near   ├─ rotation_seq: 0   ├─ status: OK  │",
      "└────────────────────────────────────────────────────────────────┘",
    ],
    steps: [
      {
        tag: "STEP 01",
        label: "Sub-account creation",
        detail: "Registry creates <handle>.logen.testnet and deploys the pinned vault WASM.",
      },
      {
        tag: "STEP 02",
        label: "Cryptographic key lock",
        detail: "All full & function-call keys are deleted on creation. Nobody can sign as the vault.",
      },
      {
        tag: "STEP 03",
        label: "Portrait & NEP-171 bind",
        detail: "The NFT and the keyless vault are bound 1:1. Whoever holds the NFT commands the vault.",
      },
    ],
  },
  {
    id: "accrual",
    code: "02 / O(1) REVENUE SPLIT",
    title: "Event Ticket Revenue Accrual",
    subtitle:
      "Every ticket sold splits NEAR in O(1) gas using a global accumulator—never looping over seats.",
    method: "registry.buy_ticket({ event_id })",
    invariant: "acc += (pool_cut + carry) / seats_minted",
    gas: "30 TGas · O(1) Constant Time",
    asciiLines: [
      "┌──────────────────┐   buy_ticket()     ┌────────────────────────┐",
      "│  attendee.near   │ ═════════════════► │ registry.logen.testnet │",
      "└──────────────────┘   (attach NEAR)    └───┬───────────┬────────┘",
      "                                            │           │",
      "              ┌─────────────────────────────┘           └────────────┐",
      "              ▼ 40% Member Pool                  50% Kas / 10% Org   ▼",
      "┌───────────────────────────────┐        ┌───────────────────────────┐",
      "│ GLOBAL ACCUMULATOR (O(1))     │        │ PERMISSIONLESS PULL LEDGER│",
      "│ acc += floor(pool / N_seats)  │        │ kas_klub_owed += 50%      │",
      "│ claimable = acc - seat_debt   │        │ organizer_owed += 10%     │",
      "└───────────────────────────────┘        └───────────────────────────┘",
    ],
    steps: [
      {
        tag: "40% POOL",
        label: "Member Pool Accumulator",
        detail: "40% of every ticket immediately increases every minted seat's withdrawable balance in O(1).",
      },
      {
        tag: "50% KAS",
        label: "Kas Klub Treasury Ledger",
        detail: "50% accrues to the immutable club treasury via pull-ledger so transfers never block sales.",
      },
      {
        tag: "10% ORG",
        label: "Organizer Pull Ledger",
        detail: "10% accrues to the event organizer. Remainder yoctoNEAR is preserved in `carry`.",
      },
    ],
  },
  {
    id: "resale",
    code: "03 / SAFE ATOMIC SALE",
    title: "Escrow-Locked Seat & Wallet Handoff",
    subtitle:
      "While listed, vault withdrawals are locked. Buyer verifies minimum inside balance at settlement.",
    method: "registry.buy_seat({ token_id, nonce, min_balance })",
    invariant: "vault.balance >= listing.min_balance && seq++",
    gas: "300 TGas · Atomic Two-Phase Commit",
    asciiLines: [
      "┌──────────────────┐  1. list_seat()    ┌────────────────────────┐",
      "│   seller.near    │ ─────────────────► │ Vault status = LISTED  │",
      "└──────────────────┘  (withdraw paused) │ min_balance = 3.20 N   │",
      "                                        └───────────┬────────────┘",
      "┌──────────────────┐  2. buy_seat()                 │",
      "│    buyer.near    │ ═══════════════════════════════╬════════════►",
      "└──────────────────┘  assert(inside >= min_balance) ▼",
      "┌────────────────────────────────────────────────────────────────┐",
      "│ HANDOFF SETTLED: owner_id = buyer.near · rotation_seq += 1     │",
      "│ ├─ Seller receives 95% price  ├─ Kas Klub 5%  ├─ Old session X │",
      "└────────────────────────────────────────────────────────────────┘",
    ],
    steps: [
      {
        tag: "GUARD A2",
        label: "Withdrawal freeze on list",
        detail: "Listing locks the vault (`E_WITHDRAW_LOCKED`). Seller cannot front-run and drain the seat.",
      },
      {
        tag: "GUARD A4",
        label: "Minimum balance assertion",
        detail: "Buyer's tx asserts `min_balance` and `nonce` on-chain. If balance dropped, buyer gets 100% refund.",
      },
      {
        tag: "GUARD A11",
        label: "Session rotation (`rotation_seq`)",
        detail: "Transfer increments `rotation_seq`, instantly invalidating the old holder's Lounge session.",
      },
    ],
  },
];

export function AsciiArchitectureFlow({ className }: { className?: string }) {
  const [activeId, setActiveId] = useState<FlowSpec["id"]>("mint");
  const [pulseStep, setPulseStep] = useState(0);

  const current = FLOWS.find((f) => f.id === activeId) ?? FLOWS[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulseStep((prev) => (prev + 1) % 3);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [activeId]);

  return (
    <section
      className={cn(
        "overflow-hidden rounded border border-line bg-surface",
        className
      )}
      aria-label="Interactive NEAR Protocol Architecture Blueprint"
    >
      {/* Top terminal header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-signal" aria-hidden="true" />
          <span className="bracket-label">[ ARCHITECTURE / ON-CHAIN MECHANICS ]</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FLOWS.map((flow) => {
            const active = flow.id === activeId;
            return (
              <button
                key={flow.id}
                type="button"
                onClick={() => {
                  setActiveId(flow.id);
                  setPulseStep(0);
                }}
                aria-pressed={active}
                className={cn(
                  "rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-label transition-colors",
                  active
                    ? "border-signal bg-signal-soft text-paper"
                    : "border-line bg-surface text-paper-muted hover:border-line-strong hover:text-paper"
                )}
              >
                {flow.code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left: Animated ASCII Blueprint */}
        <div className="flex flex-col justify-between border-b border-line bg-ink-deep p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
            <div>
              <h3 className="text-16 font-semibold text-paper">{current.title}</h3>
              <p className="mt-1 max-w-[54ch] text-12 leading-relaxed text-paper-muted">
                {current.subtitle}
              </p>
            </div>
            <Chip tone="positive" dot>
              Verified
            </Chip>
          </div>

          <div className="relative overflow-x-auto rounded border border-line bg-[#080a07] p-4 no-scrollbar">
            <pre
              className="font-mono text-[11px] leading-[1.45] text-paper-dim sm:text-[12px]"
              aria-label={`ASCII diagram for ${current.title}`}
            >
              {current.asciiLines.map((line, idx) => {
                const isHighlight =
                  (pulseStep === 0 && idx <= 2) ||
                  (pulseStep === 1 && idx >= 3 && idx <= 6) ||
                  (pulseStep === 2 && idx >= 7);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "transition-colors duration-300",
                      isHighlight ? "text-paper" : "text-paper-muted"
                    )}
                  >
                    {line.split(/(═+►|──►|▼|\[KEYS: 0\]|\[CODE: PINNED SHA-256\]|status: OK|40% Member Pool|rotation_seq \+= 1)/g).map((part, pIdx) => {
                      if (
                        part.includes("►") ||
                        part === "▼" ||
                        part === "40% Member Pool"
                      ) {
                        return (
                          <span key={pIdx} className="text-signal">
                            {part}
                          </span>
                        );
                      }
                      if (
                        part === "[KEYS: 0]" ||
                        part === "[CODE: PINNED SHA-256]" ||
                        part === "status: OK" ||
                        part === "rotation_seq += 1"
                      ) {
                        return (
                          <span key={pIdx} className="text-positive">
                            {part}
                          </span>
                        );
                      }
                      return <React.Fragment key={pIdx}>{part}</React.Fragment>;
                    })}
                  </div>
                );
              })}
            </pre>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-label">
            <span className="inline-flex items-center gap-1.5 text-signal">
              <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
              Call: {current.method}
            </span>
            <span className="text-paper-muted">{current.gas}</span>
          </div>
        </div>

        {/* Right: Step-by-step protocol breakdown & invariant */}
        <div className="flex flex-col justify-between p-4 sm:p-6">
          <div className="space-y-3">
            <div className="mono-label">Protocol execution steps</div>
            <div className="space-y-2.5">
              {current.steps.map((step, index) => {
                const active = pulseStep === index;
                return (
                  <div
                    key={step.tag}
                    onMouseEnter={() => setPulseStep(index)}
                    className={cn(
                      "cursor-default rounded border p-3 transition-colors",
                      active
                        ? "border-signal bg-signal-soft"
                        : "border-line bg-surface-sunken hover:border-line-strong"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-label text-signal">
                        [ {step.tag} ]
                      </span>
                      {active ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-label text-positive">
                          <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                          Active stage
                        </span>
                      ) : (
                        <Check className="h-3 w-3 text-paper-muted" aria-hidden="true" />
                      )}
                    </div>
                    <div className="mt-1.5 text-14 font-medium text-paper">
                      {step.label}
                    </div>
                    <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                      {step.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded border border-line bg-ink-deep px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-label text-paper-muted">
              <span className="inline-flex items-center gap-1 text-positive">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Enforced Invariant
              </span>
              <span className="inline-flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                Rust Contract
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-12 text-paper">
              {current.invariant}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
