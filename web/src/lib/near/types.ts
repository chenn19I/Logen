// Exact contract interface types from docs/API.md

export interface Nep177Metadata {
  spec: string;
  name: string;
  symbol: string;
  icon: string | null;
  base_uri: string | null;
  reference: string | null;
  reference_hash: string | null;
}

export interface TokenMetadata {
  title: string | null;
  description: string | null;
  media: string | null; // on-chain SVG data URI, dynamic
  issued_at: string | null;
  extra: string | null; // JSON string
}

export interface Nep171Token {
  token_id: string;
  owner_id: string;
  metadata?: TokenMetadata;
}

export interface SplitBps {
  pool: number;
  kas: number;
  organizer: number;
}

export interface RegistryConfig {
  registry_id: string;
  organizer_id: string;
  kas_klub_id: string;
  vault_code_hash: string; // base58
  seat_price: string; // yoctoNEAR decimal string
  vault_initial_balance: string; // yoctoNEAR decimal string
  royalty_bps: number;
  max_seats: number;
  max_listing_ttl_sec: number;
  default_bps: SplitBps;
}

export interface RegistryStats {
  seats_minted: number;
  acc: string;
  carry: string;
  total_pool_distributed: string;
  total_claimed: string;
  tickets_sold: number;
  events_count: number;
  kas_klub_owed: string;
  organizer_owed: string;
  kas_klub_released: string;
  organizer_released: string;
  sales_count: number;
  sales_volume: string;
  royalties_total: string;
}

export interface ListingView {
  token_id: string;
  price: string;
  min_balance: string;
  expires_at_ms: number;
  nonce: number;
  seller: string;
}

export interface SeatView {
  token_id: string;
  number: number;
  handle: string | null;
  owner_id: string;
  rotation_seq: number;
  checkpoint: string;
  claimable: string;
  total_claimed: string;
  minted_at_ms: number;
  holders_count: number;
  listing: ListingView | null;
}

export interface Holder {
  owner_id: string;
  since_ms: number;
  seq: number;
  via: "mint" | "transfer" | "sale" | "sync";
  price: string | null;
}

export interface Claim {
  at_ms: number;
  amount: string;
  by: string;
}

export interface Earning {
  at_ms: number;
  event_id: number;
  per_seat: string;
  seats: number;
}

export interface SeatHistory {
  holders: Holder[];
  claims: Claim[];
  earnings: Earning[];
}

export interface EventView {
  id: number;
  name: string;
  price: string;
  member_discount_bps: number;
  capacity: number;
  sold: number;
  starts_at_ms: number;
  created_at_ms: number;
  bps: SplitBps;
}

export interface TicketCount {
  event_id: number;
  count: number;
}

export interface AccountLedgers {
  refund: string;
  proceeds: string;
}

export interface Sale {
  token_id: string;
  seller: string;
  buyer: string;
  price: string;
  royalty: string;
  at_ms: number;
}

// Vault views (<token_id>)

export interface NftItemInfo {
  spec: string; // "sharded-item-1.0.0"
  init: boolean;
  status: "Active" | "Frozen";
  collection_id: string;
  token_id: string;
  owner_id: string;
  rotation_seq: number;
  rotation_epoch: number;
}

export interface VaultDelegateView {
  account_id?: string;
  account?: string;
  remaining: string;
  expires_at_ms?: number;
  expires_at?: number;
  seq: number;
}

export interface VaultListingView {
  price: string;
  min_balance: string;
  expires_at_ms?: number;
  expires_at?: number;
  proceeds_to: string;
  nonce: number;
}

export interface VaultStateView {
  owner_id: string;
  rotation_seq: number;
  status: "Idle" | "Listed";
  listing: VaultListingView | null;
  listing_nonce: number;
  delegate: VaultDelegateView | null;
  balance: string;
  withdrawable: string;
  storage_reserve: string;
  registry_id: string;
}

export interface VaultOutflow {
  at_ms: number;
  kind: "withdraw" | "delegate_withdraw";
  amount: string;
  to: string;
  by: string;
  seq: number;
}

export interface AccessKeyInfo {
  public_key: string;
  access_key: {
    nonce: number;
    permission:
      | "FullAccess"
      | {
          FunctionCall: {
            allowance: string | null;
            receiver_id: string;
            method_names: string[];
          };
        };
  };
}

export interface AccessKeyListResult {
  keys: AccessKeyInfo[];
  block_height: number;
  block_hash: string;
}

export interface AccountViewResult {
  amount: string;
  locked: string;
  code_hash: string;
  storage_usage: number;
  storage_paid_at: number;
  block_height: number;
  block_hash: string;
}

export interface KeylessProofCheck {
  blockHeight: number;
  blockHash: string;
  t0NamespaceOk: boolean;
  t0Detail: string;
  pairStatus: "Consistent" | "IndexBehind" | "Invalid";
  pairDetail: string;
  registryOwner: string | null;
  registrySeq: number | null;
  vaultOwner: string | null;
  vaultSeq: number | null;
  vaultSpecOk: boolean;
  seatZeroKeysOk: boolean;
  seatKeysCount: number;
  parentSegelOk: boolean;
  parentKeysCount: number;
  vaultCodeHashOk: boolean;
  actualCodeHash: string;
  expectedCodeHash: string;
  allVerified: boolean;
}
