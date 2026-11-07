"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Ticket,
  Users,
} from "lucide-react";
import { useNear } from "@/components/NearProvider";
import { useDemo } from "@/lib/demo/DemoProvider";
import { useEvents as useDemoEvents } from "@/lib/chain/hooks";
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
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { Reveal } from "@/components/ui/Reveal";

export default function ClubEventsPage() {
  const {
    accountId,
    registryId,
    config,
    stats,
    openWalletModal,
    callContractMethod,
  } = useNear();
  const { demo } = useDemo();
  const demoEventsQuery = useDemoEvents();

  const [events, setEvents] = useState<EventView[]>([]);
  const [userTickets, setUserTickets] = useState<Record<number, number>>({});
  const [memberPrices, setMemberPrices] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Organizer Create Event Form
  const [eventName, setEventName] = useState<string>(
    "Logen Night Session · Keyless Vaults"
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
      if (evs.length > 0) {
        setEvents(evs);
      } else if (demo && demoEventsQuery.data) {
        setEvents(
          demoEventsQuery.data.map((d, idx) => ({
            id: idx + 1,
            name: d.title,
            price: d.ticketPriceYocto,
            capacity: d.capacity,
            sold: d.sold,
            starts_at_ms: d.startsAtMs,
            created_at_ms: d.startsAtMs - 86_400_000,
            member_discount_bps: 2000,
            bps: { pool: 4000, kas: 5000, organizer: 1000 },
          }))
        );
      } else {
        setEvents([]);
      }

      if (accountId && evs.length > 0) {
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
  }, [registryId, accountId, demo, demoEventsQuery.data]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const handleBuyTicket = async (ev: EventView) => {
    if (demo) {
      setIsBusy(true);
      setStatusMsg(null);
      await new Promise((r) => window.setTimeout(r, 700));
      setUserTickets((prev) => ({ ...prev, [ev.id]: (prev[ev.id] || 0) + 1 }));
      setEvents((prev) =>
        prev.map((item) =>
          item.id === ev.id ? { ...item, sold: item.sold + 1 } : item
        )
      );
      setStatusMsg(
        `Simulated ticket purchased for "${ev.name}". 40% credited to the Member Pool accumulator.`
      );
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
    if (demo) {
      setIsBusy(true);
      await new Promise((r) => window.setTimeout(r, 600));
      const priceYocto = parseNearToYocto(eventPriceNear);
      const nextId = events.length + 1;
      setEvents((prev) => [
        ...prev,
        {
          id: nextId,
          name: eventName.trim() || `Club Event #${nextId}`,
          price: priceYocto,
          capacity: Number(eventCapacity) || 100,
          sold: 0,
          starts_at_ms: Date.now() + 7 * 24 * 3600 * 1000,
          created_at_ms: Date.now(),
          member_discount_bps: Number(eventDiscountBps) || 2000,
          bps: { pool: 4000, kas: 5000, organizer: 1000 },
        },
      ]);
      setStatusMsg(`Simulated event "${eventName}" created.`);
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

  const seatsCount = stats?.seats_minted || 12;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="bracket-label">[ EVENTS / O(1) REVENUE SPLIT ]</span>
          <h1 className="mt-2 text-40 font-semibold text-paper">
            Club events & member pool.
          </h1>
          <p className="mt-2 max-w-[58ch] text-14 leading-relaxed text-paper-muted">
            Every ticket sold via <span className="font-mono text-paper">registry.buy_ticket</span>{" "}
            splits revenue in O(1) gas: <span className="font-mono text-positive">40% Member Pool</span>{" "}
            (shared across all {seatsCount} seats), <span className="font-mono text-signal">50% Kas Klub</span>,
            and <span className="font-mono text-paper">10% Organizer</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Chip tone={demo ? "caution" : "accent"} dot>
            {demo ? "Simulated" : "NEAR Testnet"}
          </Chip>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadEvents()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ASCII O(1) Revenue Split Diagram */}
      <Reveal>
        <div className="overflow-hidden rounded border border-line bg-ink-deep p-4 font-mono text-[11px] leading-relaxed text-paper-muted sm:p-5">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-2 text-[10px] uppercase tracking-label">
            <span className="text-signal">[ O(1) ACCUMULATOR PIPELINE ]</span>
            <span className="text-positive">CONSTANT GAS · NO LOOPS</span>
          </div>
          <pre className="overflow-x-auto no-scrollbar text-[11px] leading-[1.45] text-paper-dim">
{`buy_ticket(event_id) ══► [ 40% MEMBER POOL ] ──► acc += floor((pool + carry) / ${seatsCount} seats)
                     ╠═► [ 50% KAS KLUB    ] ──► kas_klub_owed += kas_cut (pull ledger)
                     ╚═► [ 10% ORGANIZER   ] ──► organizer_owed += org_cut (pull ledger)`}
          </pre>
        </div>
      </Reveal>

      {statusMsg ? (
        <div
          role="status"
          className="rounded border border-[rgba(123,216,143,0.3)] bg-positive-soft px-4 py-3 font-mono text-12 text-positive"
        >
          {statusMsg}
        </div>
      ) : null}

      {/* Events List */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-24 font-semibold text-paper">
            Scheduled events ({events.length})
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
            Automatic 20% holder discount via ticket_price_for
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-64 animate-skeleton rounded border border-line bg-surface"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Panel className="p-10 text-center">
            <Ticket className="mx-auto h-6 w-6 text-paper-muted" />
            <h3 className="mt-3 text-24 font-semibold text-paper">
              No events on {registryId} yet.
            </h3>
            <p className="mx-auto mt-2 max-w-[44ch] text-14 text-paper-muted">
              Use the organizer panel below to schedule an event and test live{" "}
              <span className="font-mono text-paper">buy_ticket</span> revenue splits.
            </p>
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {events.map((ev) => {
              const effectivePrice = memberPrices[ev.id] || ev.price;
              const hasDiscount = BigInt(effectivePrice) < BigInt(ev.price);
              const myCount = userTickets[ev.id] || 0;
              const split = splitTicketRevenue(
                effectivePrice,
                ev.bps,
                seatsCount
              );
              const soldOut = ev.sold >= ev.capacity;

              return (
                <Panel key={ev.id} className="flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
                    <span className="bracket-label">
                      [ EVENT #{String(ev.id).padStart(2, "0")} · {ev.bps.pool / 100}/{ev.bps.kas / 100}/{ev.bps.organizer / 100} ]
                    </span>
                    {myCount > 0 ? (
                      <Chip tone="positive" icon={<CheckCircle2 className="h-3 w-3" />}>
                        You hold {myCount}×
                      </Chip>
                    ) : (
                      <Chip tone={soldOut ? "caution" : "neutral"} dot>
                        {soldOut ? "Sold out" : "Open"}
                      </Chip>
                    )}
                  </div>

                  <div className="space-y-4 p-4 sm:p-5">
                    <div>
                      <h3 className="text-24 font-semibold text-paper">{ev.name}</h3>
                      <p className="mt-1 flex items-center gap-2 font-mono text-12 text-paper-muted">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatTimestampMs(ev.starts_at_ms)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded border border-line bg-surface-sunken p-3">
                        <div className="mono-label">Ticket price</div>
                        <div className="mt-1 font-mono text-24 tabular text-paper">
                          {formatYocto(effectivePrice)}{" "}
                          <span className="text-12 text-paper-muted">NEAR</span>
                        </div>
                        {hasDiscount ? (
                          <div className="mt-1 font-mono text-[10px] uppercase tracking-label text-positive">
                            Holder discount (−{ev.member_discount_bps / 100}%)
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded border border-line bg-surface-sunken p-3">
                        <div className="mono-label">Capacity</div>
                        <div className="mt-1 flex items-center gap-1.5 font-mono text-24 tabular text-paper">
                          <Users className="h-4 w-4 text-paper-muted" />
                          {ev.sold} / {ev.capacity}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 rounded border border-line bg-ink-deep p-3 font-mono text-12">
                      <div className="flex justify-between">
                        <span className="text-paper-muted">
                          → Member Pool ({ev.bps.pool / 100}%):
                        </span>
                        <span className="text-positive tabular">
                          +{formatYocto(split.pool)} NEAR (+{formatYocto(split.perSeat, 4)}/seat)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-paper-muted">
                          → Kas Klub ({ev.bps.kas / 100}%):
                        </span>
                        <span className="text-signal tabular">
                          +{formatYocto(split.kas)} NEAR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-paper-muted">
                          → Organizer ({ev.bps.organizer / 100}%):
                        </span>
                        <span className="text-paper tabular">
                          +{formatYocto(split.organizer)} NEAR
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line p-4">
                    <Button
                      fullWidth
                      disabled={isBusy || soldOut}
                      onClick={() => void handleBuyTicket(ev)}
                    >
                      {soldOut
                        ? "Sold Out (E_SOLD_OUT)"
                        : `Buy Ticket (${formatYocto(effectivePrice)} NEAR)`}
                    </Button>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>

      {/* Organizer Panel */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-signal" />
            <span className="bracket-label">[ ORGANIZER / CREATE EVENT ]</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-label text-paper-muted">
            Organizer: {config?.organizer_id || "organizer.logen.testnet"}
            {isOrganizer ? " · Connected" : ""}
          </span>
        </div>

        <form onSubmit={handleCreateEvent} className="grid gap-4 p-4 sm:grid-cols-4 sm:p-5">
          <div className="sm:col-span-2">
            <label htmlFor="event-name" className="mono-label block">
              Event name
            </label>
            <input
              id="event-name"
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="mt-2 min-h-11 w-full rounded border border-line bg-surface-sunken px-3 font-mono text-14 text-paper outline-none focus:border-signal"
            />
          </div>
          <div>
            <label htmlFor="event-price" className="mono-label block">
              Ticket price (NEAR)
            </label>
            <input
              id="event-price"
              type="text"
              value={eventPriceNear}
              onChange={(e) => setEventPriceNear(e.target.value)}
              className="mt-2 min-h-11 w-full rounded border border-line bg-surface-sunken px-3 font-mono text-14 text-paper outline-none focus:border-signal tabular"
            />
          </div>
          <div>
            <span className="mono-label block">Capacity & discount (bps)</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                aria-label="Capacity"
                value={eventCapacity}
                onChange={(e) => setEventCapacity(e.target.value)}
                placeholder="100"
                className="min-h-11 rounded border border-line bg-surface-sunken px-2.5 font-mono text-14 text-paper outline-none focus:border-signal tabular"
              />
              <input
                type="number"
                aria-label="Member discount in basis points"
                value={eventDiscountBps}
                onChange={(e) => setEventDiscountBps(e.target.value)}
                placeholder="2000"
                className="min-h-11 rounded border border-line bg-surface-sunken px-2.5 font-mono text-14 text-paper outline-none focus:border-signal tabular"
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <Button type="submit" variant="secondary" disabled={isBusy}>
              {isBusy ? "Submitting create_event…" : "Create event (30 TGas)"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
