export type SeatStatus = "active" | "listed" | "pending" | "cooldown";

export interface Seat {
  tokenId: string;
  number: number;
  ownerId: string;
  balanceYocto: string;
  withdrawableYocto: string;
  status: SeatStatus;
  listedPriceYocto: string | null;
  holderSinceMs: number;
  holdersCount: number;
  earnedYocto: string;
  paidOutYocto: string;
  eventsAttended: number;
  /** Number of inner glyph dots that are lit, 0-9. */
  innerDots: number;
  cooldownUntilMs?: number | null;
  privateBuyer?: string | null;
}

export type HistoryKind = "earned" | "paid_out" | "holder" | "credit";

export interface HistoryEntry {
  id: string;
  atMs: number;
  kind: HistoryKind;
  label: string;
  detail?: string;
  amountYocto?: string | null;
  holderId: string;
  holderSeq: number;
  txHash?: string | null;
}

export interface SeatHolder {
  ownerId: string;
  sinceMs: number;
  untilMs: number | null;
  seq: number;
  via: "mint" | "transfer" | "sale" | "sync";
  priceYocto?: string | null;
}

export interface SeatHistory {
  seatId: string;
  items: HistoryEntry[];
  holders: SeatHolder[];
  earnedYocto: string;
  paidOutYocto: string;
  holdersCount: number;
}

export interface ClubEvent {
  id: number;
  title: string;
  startsAtMs: number;
  ticketPriceYocto: string;
  sold: number;
  capacity: number;
  status: "upcoming" | "settled";
}

export interface SeatListing {
  tokenId: string;
  seller: string;
  priceYocto: string;
  insideYocto: string;
  minBalanceYocto: string;
  nonce: number;
  expiresAtMs: number;
  seat: Seat;
}

export interface ProofRow {
  id: "keys" | "code" | "identity" | "holder" | "build";
  label: string;
  value: string;
  detail: string;
  status: "ok" | "warn";
  recheckable: boolean;
}

export interface ProofSnapshot {
  seatId: string;
  rows: ProofRow[];
  blockHeight: number | null;
  blockHash: string | null;
  allOk: boolean;
  checkedAtMs: number;
}

export interface ChainPort {
  getSeats(ownerId?: string | null): Promise<Seat[]>;
  getSeat(tokenId: string): Promise<Seat | null>;
  getHistory(tokenId: string): Promise<SeatHistory>;
  getEvents(): Promise<ClubEvent[]>;
  getListings(): Promise<SeatListing[]>;
  getProof(tokenId: string): Promise<ProofSnapshot>;
  subscribe(listener: () => void): () => void;
}

export const DEMO_ACCOUNT = "demo.logen.testnet";
