# Pusaka contract API

All balances are yoctoNEAR encoded as decimal **strings**. All timestamps exposed by views are
**milliseconds since epoch as JSON numbers** (`*_ms`). Sequence numbers / nonces are JSON numbers.
Seat ids (`token_id`) are full NEAR account ids, e.g. `s007.pusaka.testnet`.

## Registry (`<registry>`, e.g. `pusaka.testnet`) — sealed, no access keys, no upgrade path

### NEP-171 / 177 / 181 views

| Method | Args | Returns |
| --- | --- | --- |
| `nft_metadata` | – | NEP-177 contract metadata `{spec, name, symbol, icon, base_uri, reference, reference_hash}` |
| `nft_token` | `{token_id}` | `{token_id, owner_id, metadata: {title, description, media (on-chain SVG data URI, dynamic), issued_at, extra (JSON string)}}` or `null` |
| `nft_total_supply` | – | `"12"` |
| `nft_tokens` | `{from_index?: "0", limit?: 50}` | `Token[]` |
| `nft_supply_for_owner` | `{account_id}` | `"1"` |
| `nft_tokens_for_owner` | `{account_id, from_index?, limit?}` | `Token[]` |

### Pusaka views

| Method | Args | Returns |
| --- | --- | --- |
| `get_config` | – | `{registry_id, organizer_id, kas_klub_id, vault_code_hash (base58), seat_price, vault_initial_balance, royalty_bps, max_seats, max_listing_ttl_sec, default_bps: {pool, kas, organizer}}` |
| `get_stats` | – | `{seats_minted, acc, carry, total_pool_distributed, total_claimed, tickets_sold, events_count, kas_klub_owed, organizer_owed, kas_klub_released, organizer_released, sales_count, sales_volume, royalties_total}` |
| `get_seat` | `{token_id}` | `SeatView` or `null` (see below) |
| `get_seat_history` | `{token_id, limit?: 100}` | `{holders: Holder[], claims: Claim[], earnings: Earning[]}` |
| `get_listings` | – | `ListingView[]` (only live, non-expired listings) |
| `get_events` | `{from_index?: 0, limit?: 50}` | `EventView[]` |
| `get_tickets` | `{account_id}` | `[{event_id, count}]` |
| `get_ledgers` | `{account_id}` | `{refund, proceeds}` |
| `get_sales` | `{from_index?: 0, limit?: 50}` | `Sale[]` (newest first) |
| `ticket_price_for` | `{event_id, account_id}` | `"..."` price after member discount |

```ts
type SeatView = {
  token_id: string; number: number; handle: string | null; owner_id: string;
  rotation_seq: number; checkpoint: string; claimable: string; total_claimed: string;
  minted_at_ms: number; holders_count: number;
  listing: null | ListingView;
};
type ListingView = { token_id: string; price: string; min_balance: string; expires_at_ms: number; nonce: number; seller: string };
type Holder = { owner_id: string; since_ms: number; seq: number; via: "mint" | "transfer" | "sale" | "sync"; price: string | null };
type Claim = { at_ms: number; amount: string; by: string };
type Earning = { at_ms: number; event_id: number; per_seat: string; seats: number };
type EventView = { id: number; name: string; price: string; member_discount_bps: number; capacity: number; sold: number;
                   starts_at_ms: number; created_at_ms: number; bps: { pool: number; kas: number; organizer: number } };
type Sale = { token_id: string; seller: string; buyer: string; price: string; royalty: string; at_ms: number };
```

### Registry change methods

| Method | Who | Deposit | Gas (suggested) | Effect |
| --- | --- | --- | --- | --- |
| `mint_seat` `{receiver_id?, handle?}` | anyone | `seat_price` | 150 Tgas | Creates `sNNN.<registry>` (or `<handle>.<registry>`) with **no access key**, binds the vault global contract by hash, calls `init` in the same batch receipt. |
| `nft_transfer` `{receiver_id, token_id, approval_id?, memo?}` | index owner | 1 yocto | 100 Tgas | Rotates owner inside the vault, then updates the index. |
| `nft_transfer_call` | – | – | – | Always panics (`E_UNSUPPORTED`, design decision K5). |
| `list_seat` `{token_id, price, min_balance, ttl_sec}` | index owner | 1 yocto | 100 Tgas | Freezes the vault and mirrors the listing. |
| `cancel_listing` `{token_id}` | index owner | 1 yocto | 100 Tgas | Unfreezes. |
| `buy_seat` `{token_id, nonce, min_balance}` | anyone but seller | exactly `price` | 150 Tgas | Escrow → vault settles atomically → callback pays seller (minus royalty) or refunds buyer. |
| `sync` `{token_id}` | anyone | 0 | 100 Tgas | Pulls `vault_state()` and advances the index if the vault is ahead. Never moves backwards. |
| `claim` `{token_id}` | anyone | 0 | 30 Tgas | Sends the seat's accrued pool share **to the seat account** (never to a person). |
| `create_event` `{name, price, capacity, starts_at_ms, member_discount_bps?}` | organizer | 0 | 30 Tgas | Freezes the current split bps into the event. |
| `buy_ticket` `{event_id}` | anyone | `ticket_price_for(event, you)` | 30 Tgas | 40% → member pool accumulator, 50% → Kas Klub ledger, 10% → organizer ledger. |
| `claim_refund` / `claim_proceeds` `{account_id?}` | anyone | 0 | 30 Tgas | Pull payments, always sent to `account_id` (default caller). |
| `release_kas_klub` / `release_organizer` | anyone | 0 | 30 Tgas | Sends the ledger to the fixed address set at deploy. |

## Vault (`<token_id>`, one per seat; global contract by hash, immutable)

| Method | Kind | Who | Args | Notes |
| --- | --- | --- | --- | --- |
| `nft_item_info` | view | – | – | `{spec: "sharded-item-1.0.0", init: true, status: "Active"\|"Frozen", collection_id, token_id, owner_id, rotation_seq, rotation_epoch: 0}` |
| `vault_state` | view | – | – | `{owner_id, rotation_seq, status: "Idle"\|"Listed", listing, listing_nonce, delegate, balance, withdrawable, storage_reserve, registry_id}` |
| `get_outflows` | view | – | – | `[{at_ms, kind: "withdraw"\|"delegate_withdraw", amount, to, by, seq}]` ring buffer (32) |
| `withdraw` | call | owner | `{amount, to?}` | 1 yocto. Blocked while listed. |
| `set_delegate` | call | owner | `{account_id, allowance, ttl_sec}` | 1 yocto. Delegate dies on any rotation. |
| `revoke_delegate` | call | owner | – | 1 yocto. |
| `delegate_withdraw` | call | delegate | `{amount, to?}` | Bounded by allowance, expiry, and rotation seq. |
| `deposit` | call | anyone | – | Payable top-up. |
| `v_rotate`, `v_list`, `v_cancel`, `v_settle_sale` | call | registry only | – | Internal. |

## Error codes (panic messages start with the code)

`E_NOT_OWNER`, `E_WRONG_SEQ`, `E_NOT_IDLE`, `E_NOT_LISTED`, `E_FROZEN`, `E_NONCE_MISMATCH`,
`E_LISTING_EXPIRED`, `E_PRICE_MISMATCH`, `E_INSUFFICIENT_BALANCE`, `E_SELF_TRANSFER`,
`E_INVALID_AMOUNT`, `E_NO_DELEGATE`, `E_DELEGATE_EXPIRED`, `E_STALE_DELEGATE`,
`E_ALLOWANCE_EXCEEDED`, `E_INVALID_BPS`, `E_TTL_OUT_OF_RANGE`, `E_BUYER_IS_SELLER`,
`E_ONLY_REGISTRY`, `E_ONLY_ORGANIZER`, `E_DEPOSIT`, `E_UNKNOWN_TOKEN`, `E_UNSUPPORTED`,
`E_SOLD_OUT`, `E_NOTHING_TO_CLAIM`, `E_MAX_SEATS`, `E_BAD_HANDLE`.
