import { parseNearToYocto } from "@/lib/near/format";
import {
  type ChainPort,
  type ClubEvent,
  type HistoryEntry,
  type MintSeatInput,
  type ProofSnapshot,
  type Seat,
  type SeatHistory,
  type SeatHolder,
  type SeatListing,
  DEMO_ACCOUNT,
} from "./types";

const near = (value: number): string => parseNearToYocto(value.toFixed(2));
const sum = (values: Array<string | null | undefined>): bigint =>
  values.reduce((total, value) => total + BigInt(value || "0"), 0n);
const add = (a: string, b: string): string => (BigInt(a) + BigInt(b)).toString();

const DAY = 86_400_000;
const AUG_12 = Date.UTC(2026, 7, 12, 18, 0);
const AUG_30 = Date.UTC(2026, 7, 30, 12, 0);
const SEP_19 = Date.UTC(2026, 8, 19, 20, 0);
const OCT_10 = Date.UTC(2026, 9, 10, 11, 0);
const OCT_12 = Date.UTC(2026, 9, 12, 16, 30);
const OCT_24 = Date.UTC(2026, 9, 24, 19, 0);
const NOV_02 = Date.UTC(2026, 10, 2, 9, 0);

interface Seed {
  n: number;
  owner: string;
  balance: number;
  earned: number;
  paidOut: number;
  holders: number;
  dots: number;
  since: number;
  status?: "active" | "listed";
  listedPrice?: number;
  previousOwner?: string;
}

const SEEDS: Seed[] = [
  { n: 1, owner: "ana.near", balance: 2.1, earned: 1.8, paidOut: 0.4, holders: 3, dots: 4, since: Date.UTC(2025, 10, 2) },
  { n: 2, owner: "bima.near", balance: 0.8, earned: 0.9, paidOut: 0.1, holders: 2, dots: 2, since: Date.UTC(2026, 0, 14) },
  { n: 3, owner: "nadia.near", balance: 3.2, earned: 2.6, paidOut: 0.8, holders: 2, dots: 6, since: Date.UTC(2026, 8, 2), status: "listed", listedPrice: 6.4, previousOwner: "theo.near" },
  { n: 4, owner: "chen.near", balance: 1.6, earned: 1.4, paidOut: 0.2, holders: 2, dots: 3, since: Date.UTC(2026, 3, 8) },
  { n: 5, owner: "dara.near", balance: 4.7, earned: 3.1, paidOut: 0.5, holders: 4, dots: 7, since: Date.UTC(2025, 8, 21) },
  { n: 6, owner: "eli.near", balance: 0.4, earned: 0.6, paidOut: 0.2, holders: 1, dots: 1, since: Date.UTC(2026, 5, 2) },
  { n: 7, owner: DEMO_ACCOUNT, balance: 3.2, earned: 2.4, paidOut: 1.0, holders: 2, dots: 6, since: OCT_12, previousOwner: "alice.near" },
  { n: 8, owner: "omar.near", balance: 2.6, earned: 1.9, paidOut: 0.3, holders: 3, dots: 5, since: Date.UTC(2026, 2, 11), status: "listed", listedPrice: 4.1, previousOwner: "lena.near" },
  { n: 9, owner: DEMO_ACCOUNT, balance: 1.4, earned: 1.1, paidOut: 0.2, holders: 1, dots: 3, since: Date.UTC(2026, 6, 4) },
  { n: 10, owner: "fatima.near", balance: 2.8, earned: 2.0, paidOut: 0.6, holders: 2, dots: 4, since: Date.UTC(2026, 1, 19) },
  { n: 11, owner: "gus.near", balance: 4.6, earned: 3.4, paidOut: 0.7, holders: 3, dots: 8, since: Date.UTC(2025, 9, 30), status: "listed", listedPrice: 5.0, previousOwner: "mira.near" },
  { n: 12, owner: "hana.near", balance: 0.9, earned: 0.8, paidOut: 0.1, holders: 1, dots: 2, since: Date.UTC(2026, 4, 16) },
];

const EVENTS: ClubEvent[] = [
  {
    id: 4,
    title: "Rooftop Screening",
    startsAtMs: Date.UTC(2026, 10, 14, 12, 30),
    ticketPriceYocto: near(2),
    sold: 28,
    capacity: 40,
    status: "upcoming",
  },
  {
    id: 3,
    title: "Supper Club No. 4",
    startsAtMs: OCT_24,
    ticketPriceYocto: near(2.4),
    sold: 40,
    capacity: 40,
    status: "settled",
  },
  {
    id: 2,
    title: "Listening Room",
    startsAtMs: SEP_19,
    ticketPriceYocto: near(1.8),
    sold: 32,
    capacity: 40,
    status: "settled",
  },
];

const PINNED_HASH = "DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg";

function tokenIdFor(n: number): string {
  return `s${String(n).padStart(3, "0")}.logen.testnet`;
}

function holderTimeline(seed: Seed): SeatHolder[] {
  if (seed.previousOwner) {
    return [
      {
        ownerId: seed.previousOwner,
        sinceMs: seed.since - 48 * DAY,
        untilMs: seed.since,
        seq: 0,
        via: "mint",
      },
      {
        ownerId: seed.owner,
        sinceMs: seed.since,
        untilMs: null,
        seq: 1,
        via: "sale",
        priceYocto: seed.listedPrice ? near(seed.listedPrice * 1.25) : null,
      },
    ];
  }
  if (seed.holders > 1) {
    return [
      {
        ownerId: `prev${seed.n}.near`,
        sinceMs: seed.since - 90 * DAY,
        untilMs: seed.since,
        seq: 0,
        via: "mint",
      },
      {
        ownerId: seed.owner,
        sinceMs: seed.since,
        untilMs: null,
        seq: seed.holders - 1,
        via: "transfer",
      },
    ];
  }
  return [
    {
      ownerId: seed.owner,
      sinceMs: seed.since,
      untilMs: null,
      seq: 0,
      via: "mint",
    },
  ];
}

function seedHistory(seed: Seed): HistoryEntry[] {
  const holders = holderTimeline(seed);
  const currentHolder = seed.owner;
  const previousHolder = holders[0]?.ownerId ?? currentHolder;
  const items: HistoryEntry[] = [];

  holders.forEach((holder, index) => {
    items.push({
      id: `${seed.n}-holder-${index}`,
      atMs: holder.sinceMs,
      kind: "holder",
      label:
        holder.via === "sale"
          ? "Seat sold"
          : holder.via === "mint"
            ? "Seat minted"
            : "Seat changed hands",
      detail:
        holder.via === "sale"
          ? `Handoff to ${holder.ownerId}`
          : `Holder since ${new Date(holder.sinceMs).toLocaleDateString("en-US")}`,
      amountYocto: holder.priceYocto ?? null,
      holderId: holder.ownerId,
      holderSeq: holder.seq,
      txHash: null,
    });
  });

  if (seed.n === 7) {
    items.push(
      {
        id: "7-earned-3",
        atMs: OCT_24,
        kind: "earned",
        label: "Event share: Supper Club No. 4",
        detail: "Member pool, 12 seats",
        amountYocto: near(0.42),
        holderId: DEMO_ACCOUNT,
        holderSeq: 1,
        txHash: null,
      },
      {
        id: "7-credit-2",
        atMs: NOV_02,
        kind: "credit",
        label: "Club treasury share",
        detail: "Rooftop Screening ticket sales",
        amountYocto: near(0.18),
        holderId: DEMO_ACCOUNT,
        holderSeq: 1,
        txHash: null,
      },
      {
        id: "7-paid-1",
        atMs: OCT_10,
        kind: "paid_out",
        label: "Withdrawal to alice.near",
        detail: "Authorised by the holder at the time",
        amountYocto: near(1),
        holderId: previousHolder,
        holderSeq: 0,
        txHash: null,
      },
      {
        id: "7-earned-2",
        atMs: SEP_19,
        kind: "earned",
        label: "Event share: Listening Room",
        detail: "Member pool, 12 seats",
        amountYocto: near(0.38),
        holderId: previousHolder,
        holderSeq: 0,
        txHash: null,
      },
      {
        id: "7-credit-1",
        atMs: AUG_30,
        kind: "credit",
        label: "Club treasury share",
        detail: "Listening Room ticket sales",
        amountYocto: near(0.8),
        holderId: previousHolder,
        holderSeq: 0,
        txHash: null,
      }
    );
  } else if (seed.n === 9) {
    items.push(
      {
        id: "9-earned-3",
        atMs: OCT_24,
        kind: "earned",
        label: "Event share: Supper Club No. 4",
        detail: "Member pool, 12 seats",
        amountYocto: near(0.18),
        holderId: DEMO_ACCOUNT,
        holderSeq: 0,
        txHash: null,
      },
      {
        id: "9-paid-1",
        atMs: Date.UTC(2026, 9, 20, 10, 0),
        kind: "paid_out",
        label: "Withdrawal to demo.logen.testnet",
        detail: "Authorised by the holder",
        amountYocto: near(0.5),
        holderId: DEMO_ACCOUNT,
        holderSeq: 0,
        txHash: null,
      },
      {
        id: "9-earned-2",
        atMs: SEP_19,
        kind: "earned",
        label: "Event share: Listening Room",
        detail: "Member pool, 12 seats",
        amountYocto: near(0.22),
        holderId: DEMO_ACCOUNT,
        holderSeq: 0,
        txHash: null,
      }
    );
  } else {
    items.push(
      {
        id: `${seed.n}-earned-2`,
        atMs: OCT_24,
        kind: "earned",
        label: "Event share: Supper Club No. 4",
        detail: "Member pool, 12 seats",
        amountYocto: near(Math.max(0.08, seed.earned * 0.18)),
        holderId: currentHolder,
        holderSeq: Math.max(0, seed.holders - 1),
        txHash: null,
      },
      {
        id: `${seed.n}-earned-1`,
        atMs: SEP_19,
        kind: "earned",
        label: "Event share: Listening Room",
        detail: "Member pool, 12 seats",
        amountYocto: near(Math.max(0.06, seed.earned * 0.14)),
        holderId: currentHolder,
        holderSeq: Math.max(0, seed.holders - 1),
        txHash: null,
      },
      {
        id: `${seed.n}-paid-1`,
        atMs: OCT_10,
        kind: "paid_out",
        label: `Withdrawal to ${currentHolder}`,
        detail: "Authorised by the holder",
        amountYocto: near(seed.paidOut),
        holderId: currentHolder,
        holderSeq: Math.max(0, seed.holders - 1),
        txHash: null,
      }
    );
  }

  return items.sort((a, b) => b.atMs - a.atMs);
}

function seatFromSeed(seed: Seed): Seat {
  const balance = near(seed.balance);
  const rotationSeq = Math.max(0, seed.holders - 1);
  return {
    tokenId: tokenIdFor(seed.n),
    number: seed.n,
    ownerId: seed.owner,
    balanceYocto: balance,
    withdrawableYocto: balance,
    status: seed.status ?? "active",
    listedPriceYocto: seed.listedPrice ? near(seed.listedPrice) : null,
    holderSinceMs: seed.since,
    holdersCount: seed.holders,
    earnedYocto: near(seed.earned),
    paidOutYocto: near(seed.paidOut),
    eventsAttended: Math.min(12, Math.max(1, Math.round(seed.earned / 0.42))),
    innerDots: seed.dots,
    cooldownUntilMs: null,
    privateBuyer: null,
    rotationSeq,
    delegate:
      seed.n === 7
        ? {
            accountId: "agent.demo.testnet",
            remainingYocto: near(0.8),
            expiresAtMs: Date.UTC(2026, 11, 31, 23, 59),
            seq: rotationSeq,
          }
        : null,
  };
}

export class MockChain implements ChainPort {
  private seats: Map<string, Seat>;
  private histories: Map<string, HistoryEntry[]>;
  private holders: Map<string, SeatHolder[]>;
  private listings: Map<string, SeatListing>;
  private listeners = new Set<() => void>();
  private initialSeats: Map<string, Seat>;
  private initialHistories: Map<string, HistoryEntry[]>;
  private initialHolders: Map<string, SeatHolder[]>;

  constructor() {
    this.seats = new Map();
    this.histories = new Map();
    this.holders = new Map();
    this.listings = new Map();

    for (const seed of SEEDS) {
      const seat = seatFromSeed(seed);
      this.seats.set(seat.tokenId, seat);
      this.histories.set(seat.tokenId, seedHistory(seed));
      this.holders.set(seat.tokenId, holderTimeline(seed));
      if (seat.status === "listed" && seat.listedPriceYocto) {
        this.listings.set(seat.tokenId, {
          tokenId: seat.tokenId,
          seller: seat.ownerId,
          priceYocto: seat.listedPriceYocto,
          insideYocto: seat.withdrawableYocto,
          minBalanceYocto: seat.withdrawableYocto,
          nonce: (seed.n % 3) + 1,
          expiresAtMs: Date.UTC(2026, 10, 20, 18, 0),
          seat,
        });
      }
    }

    this.initialSeats = new Map(
      Array.from(this.seats.entries()).map(([key, value]) => [key, { ...value }])
    );
    this.initialHistories = new Map(
      Array.from(this.histories.entries()).map(([key, value]) => [key, [...value]])
    );
    this.initialHolders = new Map(
      Array.from(this.holders.entries()).map(([key, value]) => [key, [...value]])
    );
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private normalizeSeat(seat: Seat): Seat {
    if (
      seat.status === "cooldown" &&
      seat.cooldownUntilMs &&
      seat.cooldownUntilMs <= Date.now()
    ) {
      const updated: Seat = {
        ...seat,
        status: "active",
        cooldownUntilMs: null,
      };
      this.seats.set(seat.tokenId, updated);
      return updated;
    }
    return seat;
  }

  async getSeats(ownerId?: string | null): Promise<Seat[]> {
    const all = Array.from(this.seats.values())
      .map((seat) => this.normalizeSeat(seat))
      .sort((a, b) => a.number - b.number);
    return ownerId ? all.filter((seat) => seat.ownerId === ownerId) : all;
  }

  async getSeat(tokenId: string): Promise<Seat | null> {
    const seat = this.seats.get(tokenId);
    return seat ? this.normalizeSeat(seat) : null;
  }

  async getEvents(): Promise<ClubEvent[]> {
    return [...EVENTS].sort((a, b) => b.startsAtMs - a.startsAtMs);
  }

  async getListings(): Promise<SeatListing[]> {
    return Array.from(this.listings.values())
      .map((listing) => ({
        ...listing,
        seat: this.seats.get(listing.tokenId) ?? listing.seat,
      }))
      .sort((a, b) => a.seat.number - b.seat.number);
  }

  async getHistory(tokenId: string): Promise<SeatHistory> {
    const items = [...(this.histories.get(tokenId) ?? [])].sort(
      (a, b) => b.atMs - a.atMs
    );
    const holders = [...(this.holders.get(tokenId) ?? [])];
    const earned = sum(
      items
        .filter((item) => item.kind === "earned" || item.kind === "credit")
        .map((item) => item.amountYocto)
    );
    const paidOut = sum(
      items.filter((item) => item.kind === "paid_out").map((item) => item.amountYocto)
    );
    return {
      seatId: tokenId,
      items,
      holders,
      earnedYocto: earned.toString(),
      paidOutYocto: paidOut.toString(),
      holdersCount: holders.length,
    };
  }

  async getProof(tokenId: string): Promise<ProofSnapshot> {
    const seat = this.seats.get(tokenId);
    return {
      seatId: tokenId,
      rows: [
        {
          id: "keys",
          label: "Access keys",
          value: "None",
          detail: "view_access_key_list returns 0 keys. Nothing can sign for this seat.",
          status: "ok",
          recheckable: true,
        },
        {
          id: "code",
          label: "Code",
          value: `${PINNED_HASH.slice(0, 6)}...${PINNED_HASH.slice(-6)}`,
          detail: `Pinned hash ${PINNED_HASH}. The club cannot swap it.`,
          status: "ok",
          recheckable: true,
        },
        {
          id: "identity",
          label: "Identity",
          value: "Club and seat agree",
          detail: "Owner and sequence match at the same final block.",
          status: "ok",
          recheckable: true,
        },
        {
          id: "holder",
          label: "Holder",
          value: seat?.ownerId ?? "—",
          detail: "Only this account can open the seat. It changes with the seat.",
          status: "ok",
          recheckable: true,
        },
        {
          id: "build",
          label: "Build",
          value: "SEALED (0 KEYS)",
          detail: "Parent registry sealed (0 access keys, matching logen-84b273.testnet tx BETN1taR…4ek).",
          status: "ok",
          recheckable: true,
        },
      ],
      blockHeight: 214_889_771,
      blockHash: "8mF3kPzqH7vN2sC5xL9dR4tY6wB1aE0uJ8gQ3nK5pV2c",
      allOk: true,
      checkedAtMs: Date.now(),
    };
  }

  async withdraw(tokenId: string, amountYocto: string): Promise<Seat> {
    const found = this.seats.get(tokenId);
    if (!found) throw new Error("Seat not found");
    const seat = this.normalizeSeat(found);
    if (seat.status === "listed") throw new Error("E_FROZEN");
    if (seat.status === "cooldown") throw new Error("E_COOLDOWN");
    if (BigInt(amountYocto) > BigInt(seat.withdrawableYocto)) {
      throw new Error("E_INSUFFICIENT_BALANCE");
    }
    const now = Date.now();
    const updated: Seat = {
      ...seat,
      balanceYocto: (BigInt(seat.balanceYocto) - BigInt(amountYocto)).toString(),
      withdrawableYocto: (
        BigInt(seat.withdrawableYocto) - BigInt(amountYocto)
      ).toString(),
      paidOutYocto: add(seat.paidOutYocto, amountYocto),
    };
    this.seats.set(tokenId, updated);
    this.pushHistory(tokenId, {
      id: `${tokenId}-paid-${now}`,
      atMs: now,
      kind: "paid_out",
      label: `Withdrawal to ${seat.ownerId}`,
      detail: "Authorised by the holder",
      amountYocto,
      holderId: seat.ownerId,
      holderSeq: Math.max(0, seat.holdersCount - 1),
      txHash: null,
    });
    this.emit();
    return updated;
  }

  async listSeat(
    tokenId: string,
    priceYocto: string,
    privateBuyer?: string | null
  ): Promise<Seat> {
    const seat = this.seats.get(tokenId);
    if (!seat) throw new Error("Seat not found");
    if (seat.status !== "active") throw new Error("E_ALREADY_LISTED");
    const updated: Seat = {
      ...seat,
      status: "listed",
      listedPriceYocto: priceYocto,
      privateBuyer: privateBuyer || null,
    };
    this.seats.set(tokenId, updated);
    this.listings.set(tokenId, {
      tokenId,
      seller: seat.ownerId,
      priceYocto,
      insideYocto: seat.withdrawableYocto,
      minBalanceYocto: seat.withdrawableYocto,
      nonce: Date.now() % 1000,
      expiresAtMs: Date.now() + 7 * DAY,
      seat: updated,
    });
    this.emit();
    return updated;
  }

  async delistSeat(tokenId: string): Promise<Seat> {
    const seat = this.seats.get(tokenId);
    if (!seat) throw new Error("Seat not found");
    const updated: Seat = {
      ...seat,
      status: "cooldown",
      listedPriceYocto: null,
      cooldownUntilMs: Date.now() + 120_000,
      privateBuyer: null,
    };
    this.seats.set(tokenId, updated);
    this.listings.delete(tokenId);
    this.emit();
    return updated;
  }

  async buySeat(tokenId: string): Promise<Seat> {
    const seat = this.seats.get(tokenId);
    const listing = this.listings.get(tokenId);
    if (!seat || !listing) throw new Error("Seat is not for sale");
    if (seat.ownerId === DEMO_ACCOUNT) throw new Error("You already hold this seat");
    const now = Date.now();
    const nextSeq = (seat.rotationSeq ?? Math.max(0, seat.holdersCount - 1)) + 1;
    const updated: Seat = {
      ...seat,
      ownerId: DEMO_ACCOUNT,
      status: "active",
      listedPriceYocto: null,
      holderSinceMs: now,
      holdersCount: seat.holdersCount + 1,
      privateBuyer: null,
      rotationSeq: nextSeq,
      delegate: null,
    };
    this.seats.set(tokenId, updated);
    this.listings.delete(tokenId);
    this.holders.set(tokenId, [
      ...(this.holders.get(tokenId) ?? []).map((holder) =>
        holder.untilMs === null ? { ...holder, untilMs: now } : holder
      ),
      {
        ownerId: DEMO_ACCOUNT,
        sinceMs: now,
        untilMs: null,
        seq: seat.holdersCount,
        via: "sale",
        priceYocto: listing.priceYocto,
      },
    ]);
    this.pushHistory(tokenId, {
      id: `${tokenId}-holder-${now}`,
      atMs: now,
      kind: "holder",
      label: "Seat sold",
      detail: `Handoff to ${DEMO_ACCOUNT}`,
      amountYocto: listing.priceYocto,
      holderId: DEMO_ACCOUNT,
      holderSeq: seat.holdersCount,
      txHash: null,
    });
    this.emit();
    return updated;
  }

  async setDelegate(
    tokenId: string,
    delegateAccountId: string,
    allowanceYocto: string,
    ttlSec: number
  ): Promise<Seat> {
    const found = this.seats.get(tokenId);
    if (!found) throw new Error("Seat not found");
    const seat = this.normalizeSeat(found);
    if (seat.status === "listed") throw new Error("E_FROZEN");
    const trimmed = delegateAccountId.trim().toLowerCase();
    if (!trimmed) throw new Error("Delegate account ID is required");
    const seq = seat.rotationSeq ?? Math.max(0, seat.holdersCount - 1);
    const updated: Seat = {
      ...seat,
      delegate: {
        accountId: trimmed,
        remainingYocto: allowanceYocto,
        expiresAtMs: Date.now() + Math.max(60, ttlSec) * 1000,
        seq,
      },
    };
    this.seats.set(tokenId, updated);
    this.emit();
    return updated;
  }

  async clearDelegate(tokenId: string): Promise<Seat> {
    const found = this.seats.get(tokenId);
    if (!found) throw new Error("Seat not found");
    const updated: Seat = {
      ...found,
      delegate: null,
    };
    this.seats.set(tokenId, updated);
    this.emit();
    return updated;
  }

  async mintSeat(input: MintSeatInput): Promise<Seat> {
    const ownerId = input.ownerId ?? DEMO_ACCOUNT;
    const handle = input.handle?.trim().toLowerCase() || null;
    const number =
      Math.max(0, ...Array.from(this.seats.values()).map((seat) => seat.number)) + 1;
    const tokenId = handle ? `${handle}.logen.testnet` : tokenIdFor(number);
    if (this.seats.has(tokenId)) {
      throw new Error("That handle is already taken");
    }

    const now = Date.now();
    const seat: Seat = {
      tokenId,
      number,
      ownerId,
      balanceYocto: "0",
      withdrawableYocto: "0",
      status: "active",
      listedPriceYocto: null,
      holderSinceMs: now,
      holdersCount: 1,
      earnedYocto: "0",
      paidOutYocto: "0",
      eventsAttended: 0,
      innerDots: 1,
      cooldownUntilMs: null,
      privateBuyer: null,
      name: input.name?.trim() || `Seat ${String(number).padStart(2, "0")}`,
      description: input.description?.trim() || null,
      imageUrl: input.imageUrl ?? null,
      handle,
      rotationSeq: 0,
      delegate: null,
    };

    this.seats.set(tokenId, seat);
    this.histories.set(tokenId, [
      {
        id: `${tokenId}-mint-${now}`,
        atMs: now,
        kind: "holder",
        label: "Seat minted",
        detail: input.imageUrl
          ? "Minted with a custom portrait"
          : `Minted by ${ownerId}`,
        amountYocto: null,
        holderId: ownerId,
        holderSeq: 0,
        txHash: null,
      },
    ]);
    this.holders.set(tokenId, [
      {
        ownerId,
        sinceMs: now,
        untilMs: null,
        seq: 0,
        via: "mint",
        priceYocto: null,
      },
    ]);

    this.emit();
    return seat;
  }

  async simulateHandoff(tokenId = tokenIdFor(7)): Promise<Seat | null> {
    const seat = this.seats.get(tokenId);
    if (!seat || seat.ownerId !== DEMO_ACCOUNT) return null;
    const now = Date.now();
    const nextSeq = (seat.rotationSeq ?? Math.max(0, seat.holdersCount - 1)) + 1;
    const updated: Seat = {
      ...seat,
      ownerId: "mara.near",
      status: "active",
      listedPriceYocto: null,
      holderSinceMs: now,
      holdersCount: seat.holdersCount + 1,
      rotationSeq: nextSeq,
      delegate: null,
    };
    this.seats.set(tokenId, updated);
    this.listings.delete(tokenId);
    this.holders.set(tokenId, [
      ...(this.holders.get(tokenId) ?? []).map((holder) =>
        holder.untilMs === null ? { ...holder, untilMs: now } : holder
      ),
      {
        ownerId: "mara.near",
        sinceMs: now,
        untilMs: null,
        seq: seat.holdersCount,
        via: "sale",
        priceYocto: near(8.2),
      },
    ]);
    this.pushHistory(tokenId, {
      id: `${tokenId}-holder-${now}`,
      atMs: now,
      kind: "holder",
      label: "Seat sold",
      detail: "Handoff to mara.near",
      amountYocto: near(8.2),
      holderId: "mara.near",
      holderSeq: seat.holdersCount,
      txHash: null,
    });
    this.emit();
    return updated;
  }

  async reset(): Promise<void> {
    this.seats = new Map(
      Array.from(this.initialSeats.entries()).map(([key, value]) => [key, { ...value }])
    );
    this.histories = new Map(
      Array.from(this.initialHistories.entries()).map(([key, value]) => [key, [...value]])
    );
    this.holders = new Map(
      Array.from(this.initialHolders.entries()).map(([key, value]) => [key, [...value]])
    );
    this.listings.clear();
    for (const seat of this.seats.values()) {
      if (seat.status === "listed" && seat.listedPriceYocto) {
        this.listings.set(seat.tokenId, {
          tokenId: seat.tokenId,
          seller: seat.ownerId,
          priceYocto: seat.listedPriceYocto,
          insideYocto: seat.withdrawableYocto,
          minBalanceYocto: seat.withdrawableYocto,
          nonce: (seat.number % 3) + 1,
          expiresAtMs: Date.UTC(2026, 10, 20, 18, 0),
          seat,
        });
      }
    }
    this.emit();
  }

  private pushHistory(tokenId: string, entry: HistoryEntry): void {
    const existing = this.histories.get(tokenId) ?? [];
    this.histories.set(tokenId, [entry, ...existing]);
  }
}

export const MOCK_NEXT_EVENT = EVENTS[0];
