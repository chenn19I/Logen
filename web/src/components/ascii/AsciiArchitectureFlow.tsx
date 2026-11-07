"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FlowSpec {
  id: "mint" | "accrual" | "resale";
  code: string;
  title: string;
  subtitle: string;
  method: string;
  invariant: string;
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
    code: "Keyless Vault",
    title: "Mint Seat & Delete All Keys",
    subtitle:
      "Each seat is deployed as a NEAR sub-account with its own contract code and zero access keys.",
    method: "registry.mint_seat({ handle })",
    invariant: "view_access_key_list() == []",
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
        tag: "01",
        label: "Sub-account creation",
        detail: "Registry creates <handle>.logen.testnet and deploys the vault WASM.",
      },
      {
        tag: "02",
        label: "Key deletion",
        detail: "All access keys are deleted on creation. Nobody can sign as the vault.",
      },
      {
        tag: "03",
        label: "NFT & vault bind",
        detail: "Whoever holds the NEP-171 seat NFT controls the vault.",
      },
    ],
  },
  {
    id: "accrual",
    code: "Revenue Split",
    title: "Event Ticket Revenue Accrual",
    subtitle:
      "Ticket sales split NEAR in O(1) gas using a global accumulator.",
    method: "registry.buy_ticket({ event_id })",
    invariant: "acc += (pool_cut + carry) / seats_minted",
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
        tag: "40%",
        label: "Member Pool",
        detail: "40% of every ticket increases every minted seat's withdrawable balance.",
      },
      {
        tag: "50%",
        label: "Kas Klub Treasury",
        detail: "50% accrues to the club treasury via pull-ledger.",
      },
      {
        tag: "10%",
        label: "Event Organizer",
        detail: "10% accrues to the organizer. Remainder yoctoNEAR is kept in carry.",
      },
    ],
  },
  {
    id: "resale",
    code: "Safe Resale",
    title: "Escrow-Locked Seat & Wallet Handoff",
    subtitle:
      "While listed, vault withdrawals are locked and the buyer verifies the balance at settlement.",
    method: "registry.buy_seat({ token_id, nonce, min_balance })",
    invariant: "vault.balance >= listing.min_balance && seq++",
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
        tag: "A2",
        label: "Withdrawal freeze",
        detail: "Listing locks the vault so the seller cannot drain the seat before sale.",
      },
      {
        tag: "A4",
        label: "Balance assertion",
        detail: "Buyer's transaction asserts min_balance and nonce on-chain.",
      },
      {
        tag: "A11",
        label: "Session rotation",
        detail: "Transfer increments rotation_seq, invalidating the previous holder's session.",
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
      aria-label="On-chain architecture"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-2.5 sm:px-6">
        <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
          On-chain flow
        </span>
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
        <div className="flex flex-col justify-between border-b border-line bg-ink-deep p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="pb-4">
            <h3 className="text-16 font-semibold text-paper">{current.title}</h3>
            <p className="mt-1 max-w-[54ch] text-12 leading-relaxed text-paper-muted">
              {current.subtitle}
            </p>
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 font-mono text-[10px] text-paper-muted">
            <span className="text-signal">{current.method}</span>
            <span>{current.invariant}</span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2.5 p-4 sm:p-6">
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
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-label text-signal">
                    {step.tag}
                  </span>
                  <span className="text-14 font-medium text-paper">
                    {step.label}
                  </span>
                </div>
                <p className="mt-1 text-12 leading-relaxed text-paper-muted">
                  {step.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
