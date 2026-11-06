import {
  getEvents as rpcGetEvents,
  getListings as rpcGetListings,
  getNftToken,
  getNftTokens,
  getNftTokensForOwner,
  getSeat as rpcGetSeat,
  getSeatHistory,
  getVaultOutflows,
  getVaultState,
  verifyKeylessProofOnChain,
} from "@/lib/near/rpc";
import type {
  SeatHistory as RpcSeatHistory,
  SeatView,
  VaultStateView,
} from "@/lib/near/types";
import { getPortrait } from "@/lib/portraits";
import {
  type ChainPort,
  type ClubEvent,
  type HistoryEntry,
  type ProofSnapshot,
  type Seat,
  type SeatHistory,
  type SeatHolder,
  type SeatListing,
} from "./types";

function dotsFor(earnedYocto: string, holders: number): number {
  const nearValue = Number(earnedYocto) / 1e24;
  return Math.max(1, Math.min(9, Math.round(nearValue) + Math.min(3, holders)));
}

function holderAt(
  holders: SeatHolder[],
  atMs: number
): { ownerId: string; seq: number } {
  const sorted = [...holders].sort((a, b) => a.sinceMs - b.sinceMs);
  let current = sorted[0];
  for (const holder of sorted) {
    if (holder.sinceMs <= atMs) current = holder;
  }
  return {
    ownerId: current?.ownerId ?? "—",
    seq: current?.seq ?? 0,
  };
}

function mapSeat(
  tokenId: string,
  seat: SeatView | null,
  vault: VaultStateView | null
): Seat {
  const ownerId = vault?.owner_id || seat?.owner_id || "—";
  const status = vault?.status === "Listed" || seat?.listing ? "listed" : "active";
  const balance = vault?.balance || "0";
  const withdrawable = vault?.withdrawable || "0";
  const earned = (
    BigInt(seat?.total_claimed || "0") + BigInt(seat?.claimable || "0")
  ).toString();
  const numberFromId = Number((tokenId.split(".")[0] || "").replace(/\D/g, "")) || 0;
  const portrait = getPortrait(tokenId);
  return {
    tokenId,
    number: seat?.number || numberFromId || 1,
    ownerId,
    balanceYocto: balance,
    withdrawableYocto: withdrawable,
    status,
    listedPriceYocto: vault?.listing?.price || seat?.listing?.price || null,
    holderSinceMs: seat?.minted_at_ms || Date.now(),
    holdersCount: seat?.holders_count || 1,
    earnedYocto: earned,
    paidOutYocto: "0",
    eventsAttended: 0,
    innerDots: dotsFor(earned, seat?.holders_count || 1),
    cooldownUntilMs: null,
    privateBuyer: null,
    name: portrait?.name || (seat?.handle ? `Seat ${seat.number} · ${seat.handle}` : null),
    description: portrait?.description ?? null,
    imageUrl: portrait?.dataUrl ?? null,
    handle: seat?.handle ?? null,
  };
}

export class NearChain implements ChainPort {
  constructor(
    private readonly registryId: string,
    private readonly accountId?: string | null
  ) {}

  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  async getSeats(ownerId?: string | null): Promise<Seat[]> {
    const tokens = ownerId
      ? await getNftTokensForOwner(ownerId, this.registryId)
      : await getNftTokens(this.registryId, "0", 50);
    const seats = await Promise.all(
      tokens.map(async (token) => {
        const [seat, vault] = await Promise.all([
          rpcGetSeat(token.token_id, this.registryId),
          getVaultState(token.token_id),
        ]);
        return mapSeat(token.token_id, seat, vault);
      })
    );
    return seats.sort((a, b) => a.number - b.number);
  }

  async getSeat(tokenId: string): Promise<Seat | null> {
    const [seat, vault] = await Promise.all([
      rpcGetSeat(tokenId, this.registryId),
      getVaultState(tokenId),
    ]);
    if (!seat && !vault) return null;
    return mapSeat(tokenId, seat, vault);
  }

  async getEvents(): Promise<ClubEvent[]> {
    const events = await rpcGetEvents(this.registryId, 0, 50);
    return events
      .map((event) => ({
        id: event.id,
        title: event.name,
        startsAtMs: event.starts_at_ms,
        ticketPriceYocto: event.price,
        sold: event.sold,
        capacity: event.capacity,
        status:
          event.starts_at_ms > Date.now()
            ? ("upcoming" as const)
            : ("settled" as const),
      }))
      .sort((a, b) => b.startsAtMs - a.startsAtMs);
  }

  async getListings(): Promise<SeatListing[]> {
    const raw = await rpcGetListings(this.registryId);
    const listings = await Promise.all(
      raw.map(async (listing) => {
        const [vault, seat] = await Promise.all([
          getVaultState(listing.token_id),
          this.getSeat(listing.token_id),
        ]);
        if (!seat) return null;
        return {
          tokenId: listing.token_id,
          seller: listing.seller || seat.ownerId,
          priceYocto: listing.price,
          insideYocto: vault?.withdrawable || listing.min_balance,
          minBalanceYocto: listing.min_balance,
          nonce: listing.nonce,
          expiresAtMs: listing.expires_at_ms,
          seat,
        } satisfies SeatListing;
      })
    );
    return listings.filter((listing): listing is SeatListing => Boolean(listing));
  }

  async getHistory(tokenId: string): Promise<SeatHistory> {
    const [history, outflows, events] = await Promise.all([
      getSeatHistory(tokenId, this.registryId, 100),
      getVaultOutflows(tokenId),
      this.getEvents(),
    ]);
    const holders: SeatHolder[] = history.holders
      .slice()
      .sort((a, b) => a.since_ms - b.since_ms)
      .map((holder, index, all) => ({
        ownerId: holder.owner_id,
        sinceMs: holder.since_ms,
        untilMs: all[index + 1]?.since_ms ?? null,
        seq: holder.seq,
        via: holder.via,
        priceYocto: holder.price,
      }));

    const items: HistoryEntry[] = [];
    holders.forEach((holder, index) => {
      items.push({
        id: `${tokenId}-holder-${index}`,
        atMs: holder.sinceMs,
        kind: "holder",
        label:
          holder.via === "sale"
            ? "Seat sold"
            : holder.via === "mint"
              ? "Seat minted"
              : "Seat changed hands",
        detail: `Handoff to ${holder.ownerId}`,
        amountYocto: holder.priceYocto ?? null,
        holderId: holder.ownerId,
        holderSeq: holder.seq,
        txHash: null,
      });
    });

    const eventName = (eventId: number): string =>
      events.find((event) => event.id === eventId)?.title ?? `Event #${eventId}`;

    if (history.claims.length > 0) {
      history.claims.forEach((claim, index) => {
        const holder = holderAt(holders, claim.at_ms);
        items.push({
          id: `${tokenId}-claim-${index}`,
          atMs: claim.at_ms,
          kind: "earned",
          label: "Event share credited",
          detail: "Member pool, paid to the seat",
          amountYocto: claim.amount,
          holderId: holder.ownerId,
          holderSeq: holder.seq,
          txHash: null,
        });
      });
    } else {
      history.earnings.forEach((earning, index) => {
        const holder = holderAt(holders, earning.at_ms);
        items.push({
          id: `${tokenId}-earning-${index}`,
          atMs: earning.at_ms,
          kind: "earned",
          label: `Event share: ${eventName(earning.event_id)}`,
          detail: `Member pool, ${earning.seats} seats`,
          amountYocto: earning.per_seat,
          holderId: holder.ownerId,
          holderSeq: holder.seq,
          txHash: null,
        });
      });
    }

    outflows.forEach((outflow, index) => {
      const holder = holderAt(holders, outflow.at_ms);
      items.push({
        id: `${tokenId}-outflow-${index}`,
        atMs: outflow.at_ms,
        kind: "paid_out",
        label: `Withdrawal to ${outflow.to}`,
        detail: `Authorised by ${outflow.by}`,
        amountYocto: outflow.amount,
        holderId: holder.ownerId,
        holderSeq: holder.seq,
        txHash: null,
      });
    });

    items.sort((a, b) => b.atMs - a.atMs);
    const earned = items
      .filter((item) => item.kind === "earned" || item.kind === "credit")
      .reduce((total, item) => total + BigInt(item.amountYocto || "0"), 0n);
    const paidOut = items
      .filter((item) => item.kind === "paid_out")
      .reduce((total, item) => total + BigInt(item.amountYocto || "0"), 0n);

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
    const proof = await verifyKeylessProofOnChain(tokenId, this.registryId);
    return {
      seatId: tokenId,
      rows: [
        {
          id: "keys",
          label: "Access keys",
          value: proof.seatZeroKeysOk ? "None" : `${proof.seatKeysCount} found`,
          detail: proof.seatZeroKeysOk
            ? "view_access_key_list returns 0 keys. Nothing can sign for this seat."
            : "A key was found. Do not trust this seat.",
          status: proof.seatZeroKeysOk ? "ok" : "warn",
          recheckable: true,
        },
        {
          id: "code",
          label: "Code",
          value: proof.actualCodeHash
            ? `${proof.actualCodeHash.slice(0, 6)}...${proof.actualCodeHash.slice(-6)}`
            : "—",
          detail: proof.vaultCodeHashOk
            ? `Matches the pinned hash ${proof.expectedCodeHash}.`
            : "The deployed code does not match the pinned hash.",
          status: proof.vaultCodeHashOk ? "ok" : "warn",
          recheckable: true,
        },
        {
          id: "identity",
          label: "Identity",
          value:
            proof.pairStatus === "Consistent"
              ? "Club and seat agree"
              : proof.pairStatus,
          detail: proof.pairDetail,
          status: proof.pairStatus === "Consistent" ? "ok" : "warn",
          recheckable: true,
        },
        {
          id: "holder",
          label: "Holder",
          value: proof.vaultOwner || "—",
          detail: "Only this account can open the seat. It changes with the seat.",
          status: proof.vaultOwner ? "ok" : "warn",
          recheckable: true,
        },
        {
          id: "build",
          label: "Build",
          value: "UNSEALED",
          detail: "Testnet build. A sealed build is required before mainnet.",
          status: "warn",
          recheckable: true,
        },
      ],
      blockHeight: proof.blockHeight,
      blockHash: proof.blockHash,
      allOk: proof.allVerified,
      checkedAtMs: Date.now(),
    };
  }
}

export type { RpcSeatHistory };
