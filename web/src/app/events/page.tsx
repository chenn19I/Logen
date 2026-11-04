"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Ticket,
  Sparkles,
  RefreshCw,
  Calendar,
  Users,
  PlusCircle,
  Coins,
  CheckCircle2,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { KratonDivider } from "@/components/KawungOrnament";
import {
  getEvents,
  getTicketPriceFor,
  getTicketsForAccount,
} from "@/lib/near/rpc";
import type { EventView, TicketCount } from "@/lib/near/types";
import {
  formatTimestampMs,
  formatYocto,
  parseNearToYocto,
  splitTicketRevenue,
} from "@/lib/near/format";

export default function ClubEventsPage() {
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

  const [events, setEvents] = useState<EventView[]>([]);
  const [userTickets, setUserTickets] = useState<Record<number, number>>({});
  const [memberPrices, setMemberPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Organizer Create Event Form
  const [eventName, setEventName] = useState<string>(
    "Gamelan Nocturne · Kraton Residency"
  );
  const [eventPriceNear, setEventPriceNear] = useState<string>("5");
  const [eventCapacity, setEventCapacity] = useState<string>("100");
  const [eventDiscountBps, setEventDiscountBps] = useState<string>("2000"); // 20%

  const isOrganizer = Boolean(
    accountId && config?.organizer_id && accountId === config.organizer_id
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const evs = await getEvents(registryId, 0, 50);
      setEvents(evs);

      if (accountId) {
        const [tks, pricesEntries] = await Promise.all([
          getTicketsForAccount(accountId, registryId),
          Promise.all(
            evs.map(async (ev) => {
              const p = await getTicketPriceFor(ev.id, accountId, registryId);
              return [ev.id, p || ev.price] as const;
            })
          ),
        ]);
        const ticketMap: Record<number, number> = {};
        for (const t of tks as TicketCount[]) {
          ticketMap[t.event_id] = t.count;
        }
        setUserTickets(ticketMap);
        setMemberPrices(Object.fromEntries(pricesEntries));
      } else {
        setUserTickets({});
        setMemberPrices({});
      }
    } finally {
      setLoading(false);
    }
  }, [registryId, accountId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleBuyTicket = async (ev: EventView) => {
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsBusy(true);
    setStatusMsg(null);
    try {
      const priceToAttach = memberPrices[ev.id] || ev.price;
      await callContractMethod({
        receiverId: registryId,
        methodName: "buy_ticket",
        args: { event_id: ev.id },
        gas: "30000000000000", // 30 Tgas
        deposit: priceToAttach,
      });
      setStatusMsg(
        `Ticket purchased for "${ev.name}"! 40% credited to Member Pool accumulator.`
      );
      await loadEvents();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      openWalletModal();
      return;
    }
    setIsBusy(true);
    setStatusMsg(null);
    try {
      const priceYocto = parseNearToYocto(eventPriceNear);
      const startsAtMs = Date.now() + 7 * 24 * 3600 * 1000;
      await callContractMethod({
        receiverId: registryId,
        methodName: "create_event",
        args: {
          name: eventName.trim(),
          price: priceYocto,
          capacity: Number(eventCapacity),
          starts_at_ms: startsAtMs,
          member_discount_bps: Number(eventDiscountBps),
        },
        gas: "30000000000000",
        deposit: "0",
      });
      setStatusMsg(`Created event "${eventName}"!`);
      await loadEvents();
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
              ? "Syarat R1 & R3 · Akrual Bagi Hasil Tiket O(1)"
              : "Requirement R1 & R3 · O(1) Ticket Revenue Accrual"}
          </span>
          <h1 className="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">
            {isId
              ? "Acara Klub & Bagi Hasil Anggota (40% / 50% / 10%)"
              : "Club Events & Member Pool Accrual"}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-300">
            {isId ? (
              <>
                Setiap tiket yang terjual lewat{" "}
                <span className="font-mono text-gold-300">registry.buy_ticket</span> langsung
                membagi pendapatan: <strong className="text-gold-300">40% Pool Anggota</strong>{" "}
                (dibagi rata ke {stats?.seats_minted ?? 0} brankas kursi),{" "}
                <strong className="text-segel-400">50% Kas Klub</strong>, dan{" "}
                <strong className="text-indigo-300">10% Organizer</strong>. Pemegang kursi
                juga mendapat diskon otomatis lewat <span className="font-mono">ticket_price_for</span>.
              </>
            ) : (
              <>
                Every ticket sold via <span className="font-mono text-gold-300">registry.buy_ticket</span>{" "}
                splits revenue according to the event&apos;s frozen basis points: default{" "}
                <strong className="text-gold-300">40% Pool Anggota</strong> (shared equally by all{" "}
                {stats?.seats_minted ?? 0} minted seats),{" "}
                <strong className="text-segel-400">50% Kas Klub</strong>, and{" "}
                <strong className="text-indigo-300">10% Organizer</strong>. Seat holders also
                receive automatic discounts via <span className="font-mono">ticket_price_for</span>.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={loadEvents}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-obsidian-900 px-4 py-2 text-xs text-slate-300 hover:border-gold-500/40 hover:text-gold-300"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {isId ? "Segarkan Acara" : "Refresh Events"}
        </button>
      </div>

      {statusMsg && (
        <div className="rounded-2xl border border-gold-500/40 bg-obsidian-800 p-4 font-mono text-xs text-gold-300">
          {statusMsg}
        </div>
      )}

      {/* Events List */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-bold text-white">
          On-Chain Club Events ({events.length})
        </h2>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-gold-500/20 bg-obsidian-800/50"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border border-gold-500/20 bg-obsidian-900/70 p-10 text-center">
            <Ticket className="mx-auto h-10 w-10 text-gold-400" />
            <h3 className="mt-3 font-serif text-2xl font-bold text-white">
              No Events Created Yet on `{registryId}`
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-xs text-slate-400">
              Use the Organizer Panel below to create an event and test live{" "}
              <span className="font-mono text-gold-300">buy_ticket</span> revenue splits.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {events.map((ev) => {
              const effectivePrice = memberPrices[ev.id] || ev.price;
              const hasDiscount =
                BigInt(effectivePrice) < BigInt(ev.price);
              const myCount = userTickets[ev.id] || 0;
              const split = splitTicketRevenue(
                effectivePrice,
                ev.bps,
                stats?.seats_minted ?? 1
              );
              const soldOut = ev.sold >= ev.capacity;

              return (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between rounded-2xl border border-gold-500/30 bg-obsidian-800/90 p-6 shadow-lg"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] text-gold-400">
                          EVENT #{ev.id} · SPLIT {ev.bps.pool / 100}% / {ev.bps.kas / 100}% /{" "}
                          {ev.bps.organizer / 100}%
                        </span>
                        <h3 className="mt-0.5 font-serif text-2xl font-bold text-white">
                          {ev.name}
                        </h3>
                      </div>
                      {myCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-segel-500/40 bg-segel-500/15 px-3 py-1 font-mono text-xs font-bold text-segel-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          You Own {myCount}x
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3">
                        <span className="block text-[10px] text-slate-400">
                          TICKET PRICE (`ticket_price_for`)
                        </span>
                        <span className="text-base font-bold text-gold-300">
                          {formatYocto(effectivePrice)} NEAR
                        </span>
                        {hasDiscount && (
                          <span className="block text-[10px] text-segel-400">
                            Member Discount (-{ev.member_discount_bps / 100}% off{" "}
                            {formatYocto(ev.price)} N)
                          </span>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-3">
                        <span className="block text-[10px] text-slate-400">
                          CAPACITY & STARTS
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                          <Users className="h-3.5 w-3.5 text-gold-400" />
                          {ev.sold} / {ev.capacity} sold
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          <Calendar className="mr-1 inline h-3 w-3" />
                          {formatTimestampMs(ev.starts_at_ms)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/90 bg-obsidian-950/70 p-3 font-mono text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          → Pool Anggota ({ev.bps.pool / 100}%):
                        </span>
                        <span className="text-gold-300">
                          +{formatYocto(split.pool)} NEAR (+
                          {formatYocto(split.perSeat, 6)} NEAR/seat)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          → Kas Klub ({ev.bps.kas / 100}%):
                        </span>
                        <span className="text-segel-400">
                          +{formatYocto(split.kas)} NEAR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          → Organizer ({ev.bps.organizer / 100}%):
                        </span>
                        <span className="text-indigo-300">
                          +{formatYocto(split.organizer)} NEAR
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy || soldOut}
                    onClick={() => handleBuyTicket(ev)}
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-3 text-xs font-bold text-obsidian-950 shadow transition hover:brightness-110 disabled:opacity-40"
                  >
                    {soldOut
                      ? "Sold Out (E_SOLD_OUT)"
                      : `Buy Ticket (${formatYocto(effectivePrice)} NEAR)`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <KratonDivider label="Organizer Event Creation (`registry.create_event`)" />

      {/* Organizer Panel */}
      <section className="rounded-3xl border border-gold-500/25 bg-obsidian-800/70 p-6 lg:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PlusCircle className="h-5 w-5 text-gold-400" />
            <div>
              <h3 className="font-serif text-2xl font-bold text-white">
                Create Club Event
              </h3>
              <p className="font-mono text-xs text-slate-400">
                Authorized Organizer: {config?.organizer_id || "—"}
                {isOrganizer ? " (Connected!)" : " (E_ONLY_ORGANIZER enforced on-chain)"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateEvent} className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-slate-300">Event Name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300">
              Ticket Price (NEAR)
            </label>
            <input
              type="text"
              value={eventPriceNear}
              onChange={(e) => setEventPriceNear(e.target.value)}
              className="w-full rounded-xl border border-gold-500/30 bg-obsidian-950 px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300">
              Capacity & Discount (bps)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={eventCapacity}
                onChange={(e) => setEventCapacity(e.target.value)}
                placeholder="100"
                className="rounded-xl border border-gold-500/30 bg-obsidian-950 px-2.5 py-2 font-mono text-xs text-white"
              />
              <input
                type="number"
                value={eventDiscountBps}
                onChange={(e) => setEventDiscountBps(e.target.value)}
                placeholder="2000"
                className="rounded-xl border border-gold-500/30 bg-obsidian-950 px-2.5 py-2 font-mono text-xs text-white"
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-xl border border-gold-500/50 bg-gold-500/15 px-5 py-2.5 text-xs font-bold text-gold-300 transition hover:bg-gold-500 hover:text-obsidian-950"
            >
              {isBusy ? "Submitting create_event..." : "Create Event (30 Tgas)"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
