# Pusaka — The Membership NFT That Carries Its Own Wallet

**NEAR Hackathon 2026 · Track 10: `nfts` (NFTs That Do Something)**  
*Keanggotaan yang diwariskan bersama isinya — Sell the seat, the wallet goes with it, and the seller cannot keep a single key.*

---

## 1. The Problem & What Pusaka Builds

Most "NFT wallets" transfer control by adding a new access key for the buyer and deleting the seller's key. On NEAR, that pattern has a fatal flaw for secondary sales: **a smart contract cannot enumerate the access keys on its own account**, so a seller can plant an extra `FullAccess` or `FunctionCall` key before listing, or drain the wallet in a racing receipt right as the buyer pays.

**Pusaka** solves this by removing access keys from the equation altogether:

1. **Every Seat is both an NEP-171 NFT and a real NEAR sub-account** (`s001.<registry>` or `<handle>.<registry>`).
2. **Zero Access Keys (`K1`)**: The registry creates each seat sub-account in a single atomic batch receipt (`CreateAccount` → `Transfer` → `DeployContract` → `FunctionCall("init")`) with **no `AddKey` action**. The parent registry account is also sealed (`DeleteKey`) after setup.
3. **Vault is Canonical (`K2`)**: Each seat sub-account runs `pusaka-vault`, which holds the canonical `owner_id`, monotonic `rotation_seq`, listing freeze state, bounded delegate, and NEAR balance, and exposes `nft_item_info()` following the Sharded NFT Items draft (`sharded-item-1.0.0`).
4. **O(1) Revenue Sharing (`K3`)**: Every event ticket sold on the registry splits revenue (default **40% Pool Anggota / Member Pool**, **50% Kas Klub / Club Treasury**, **10% Organizer**). The Member Pool updates a global accumulator `acc` in $O(1)$ without scaling-factor overflow (carrying division dust forward). Calling `claim(token_id)` is permissionless and **always transfers the payout to the seat sub-account**, never to a person's wallet.
5. **Safe Secondary Market (`§9.4`)**: Listing a seat (`list_seat`) freezes all outflows inside the vault (`status = Listed / Frozen`) and assigns a monotonic `listing_nonce`. Buying (`buy_seat`) escrows the buyer's payment in the registry and settles inside the vault in a **single atomic receipt** (`v_settle_sale`) that checks liveness, `nonce`, `price`, and `withdrawable >= max(listing.min_balance, buyer.min_balance)` at the exact moment ownership rotates.

---

## 2. Live NEAR Testnet Deployment (`pusaka-c10747.testnet`)

Pusaka is deployed and verified live on **NEAR Testnet** (configured by default in `web/` and [`docs/deployment.testnet.json`](./docs/deployment.testnet.json)):

| Role | Account ID | On-Chain Status |
| --- | --- | --- |
| **Registry Contract (`pusaka-registry`)** | [`pusaka-c10747.testnet`](https://testnet.nearblocks.io/address/pusaka-c10747.testnet) | **0 Access Keys (`[]` — Sealed / Segel Induk)** · Code Hash `HnMPZdTuyDZmGLd7ZHBbvutM9dQ2ZLmVHBxuzHw8zbeU` · Pinned Vault Hash `DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg` |
| **Seat #001 Vault (`pusaka-vault`)** | [`s001.pusaka-c10747.testnet`](https://testnet.nearblocks.io/address/s001.pusaka-c10747.testnet) | **0 Access Keys (`[]`)** · Sold on market (`alice` → `bob`, `rotation_seq = 1`) · Holds `2.16 NEAR` (`2.0` initial + `0.16` claimed from Event #0) |
| **Seat #002 Vault (`pusaka-vault`)** | [`garuda.pusaka-c10747.testnet`](https://testnet.nearblocks.io/address/garuda.pusaka-c10747.testnet) | **0 Access Keys (`[]`)** · Listed on market (`status = Listed`, `nonce = 1`, `price = 2.5 NEAR`, `min_balance = 1.9 NEAR`) |
| **Organizer / Kas Klub / Seller** | [`alice-c10747.testnet`](https://testnet.nearblocks.io/address/alice-c10747.testnet) | Created Event #0 (*"Kraton Genesis Summit"*), minted both seats, sold `s001` to Bob |
| **Buyer / Current Owner of `s001`** | [`bob-c10747.testnet`](https://testnet.nearblocks.io/address/bob-c10747.testnet) | Bought ticket to Event #0, bought `s001.pusaka-c10747.testnet` via atomic `buy_seat` + `v_settle_sale` |

### Verified Live Lifecycle & Attack Lab Transactions on NEAR Testnet

| Action / Scenario | Transaction Hash | Outcome |
| --- | --- | --- |
| Deploy & Initialize `pusaka-registry` | [`2xPVefuJS55qSrkwDVM2MQCU4zdbSQkrkbd62MCxK1h9`](https://testnet.nearblocks.io/txns/2xPVefuJS55qSrkwDVM2MQCU4zdbSQkrkbd62MCxK1h9) | Initialized `pusaka-c10747.testnet` |
| Pin `pusaka_vault.wasm` (`pin_vault_wasm`) | [`BvSdmQFEKvEPJxEQ4fCxxk5oVaMsGrBcv87Q5cHUMhdM`](https://testnet.nearblocks.io/txns/BvSdmQFEKvEPJxEQ4fCxxk5oVaMsGrBcv87Q5cHUMhdM) | Locked SHA-256 `DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg` |
| Mint Seat #001 (`s001.pusaka-c10747.testnet`) | [`FUCMGkn9yuqBuRF5Xt9sFTWbVdsUkJBou3KcUkyjXTFG`](https://testnet.nearblocks.io/txns/FUCMGkn9yuqBuRF5Xt9sFTWbVdsUkJBou3KcUkyjXTFG) | Keyless sub-account created (`keys = []`) with `2.0 NEAR` |
| Mint Seat #002 (`garuda.pusaka-c10747.testnet`) | [`6yH3UAxjiApiPviMr8cCnvvtLPfS4fuTeVtrhH5kua1G`](https://testnet.nearblocks.io/txns/6yH3UAxjiApiPviMr8cCnvvtLPfS4fuTeVtrhH5kua1G) | Keyless sub-account created (`keys = []`) with `2.0 NEAR` |
| Create Event #0 (*Kraton Genesis Summit*) | [`2ANAh5uj2u7uFg2Y7cYQXYCpzwrLkbVmgTk9ar6PWLZ1`](https://testnet.nearblocks.io/txns/2ANAh5uj2u7uFg2Y7cYQXYCpzwrLkbVmgTk9ar6PWLZ1) | Frozen split: `40%` Member Pool, `50%` Kas Klub, `10%` Organizer |
| Buy Event Ticket (`0.8 NEAR`) | [`7Bux5qc333q8f7zsv3dviAB7r9AFQZrYwwftqjSnWqu3`](https://testnet.nearblocks.io/txns/7Bux5qc333q8f7zsv3dviAB7r9AFQZrYwwftqjSnWqu3) | `0.32 NEAR` (`0.16 NEAR` per seat) accrued to O(1) accumulator |
| Claim Pool Share to `s001` Vault (`claim`) | [`3GnFKFSqqBLhoWjhmwcuRXKsWEh14HbzjFUh8iKkQAqo`](https://testnet.nearblocks.io/txns/3GnFKFSqqBLhoWjhmwcuRXKsWEh14HbzjFUh8iKkQAqo) | `0.16 NEAR` transferred directly into `s001.pusaka-c10747.testnet` |
| List `s001` on Safe Market (`list_seat`) | [`7hq1QRywFgN1pSs6Eie4TDWUguAzzoCDhAN7FrGv9HX5`](https://testnet.nearblocks.io/txns/7hq1QRywFgN1pSs6Eie4TDWUguAzzoCDhAN7FrGv9HX5) | Vault frozen (`status = Listed`, `nonce = 1`, `min_balance = 1.9 NEAR`) |
| **Attack A1 (Live)**: Direct `vault.v_rotate` bypass | [`A4JQKpkswwho4k84m66PMSWrGtX3Hmo2da4aiyurUgTq`](https://testnet.nearblocks.io/txns/A4JQKpkswwho4k84m66PMSWrGtX3Hmo2da4aiyurUgTq) | **BLOCKED (`E_ONLY_REGISTRY`)** |
| **Attack A2 (Live)**: Seller `withdraw` while listed | [`9mq2Yod1M652vNKTHNHEpBzZ6iKjYpcU4GSnesDvoqFi`](https://testnet.nearblocks.io/txns/9mq2Yod1M652vNKTHNHEpBzZ6iKjYpcU4GSnesDvoqFi) | **BLOCKED (`E_FROZEN`)** |
| **Attack A3 (Live)**: `buy_seat` with stale/wrong `nonce` | [`Fy3E1eUtNyvTAQdku4CE8HySZd46v3Sf4fy26DXzy5TY`](https://testnet.nearblocks.io/txns/Fy3E1eUtNyvTAQdku4CE8HySZd46v3Sf4fy26DXzy5TY) | **BLOCKED (`E_NONCE_MISMATCH`)** |
| Safe Market Settlement (`buy_seat` → `v_settle_sale`) | [`2hnQNzxXe49Zjww8Ri78kYnTFgBPbt1zPMbiSuRNoNrZ`](https://testnet.nearblocks.io/txns/2hnQNzxXe49Zjww8Ri78kYnTFgBPbt1zPMbiSuRNoNrZ) | Atomic rotation `alice` → `bob` (`seq = 1`), `min_balance` verified |
| **Attack A7 (Live)**: Former owner `withdraw` post-sale | [`27UqeoVoe6FYnMb8AbL73M64mMppZqY7Nepb8jZgBaP9`](https://testnet.nearblocks.io/txns/27UqeoVoe6FYnMb8AbL73M64mMppZqY7Nepb8jZgBaP9) | **BLOCKED (`E_NOT_OWNER`)** |
| List `garuda` on Safe Market (`list_seat`) | [`ATW3ZEGf5fJjEM2HURTmoHTwhFNEGapCHo9JRrFMj9Xe`](https://testnet.nearblocks.io/txns/ATW3ZEGf5fJjEM2HURTmoHTwhFNEGapCHo9JRrFMj9Xe) | Active listing on `/market` (`nonce = 1`, `price = 2.5 NEAR`) |
| Seal Parent Registry (`DeleteKey` — *Segel Induk*) | [`6fUpPgrJFEDvmaV8sxoUHBnBabLzpoTFSkhVtSpNCXLr`](https://testnet.nearblocks.io/txns/6fUpPgrJFEDvmaV8sxoUHBnBabLzpoTFSkhVtSpNCXLr) | Deleted last `FullAccess` key on `pusaka-c10747.testnet` (`keys = []`) |

---

## 3. Reproduce in One Command ("Do X — See Y")

Pusaka is structured so AI screeners (Claude Code & Codex) and human judges can verify every claim from a clean clone, both on-chain and in interactive demo mode.

### Prerequisites
- **Rust `1.86.0`** with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- **Node.js `>= 20`** and **pnpm `>= 9`**

### Do X → See Y

| Step | Command | Expected Output ("See Y") |
| --- | --- | --- |
| **1. Full Judge Suite** | `node scripts/pusaka-cli.mjs judge` *(or `make judge`)* | Runs **41 Rust tests** (including **80,620** cross-contract receipt interleavings), compiles `pusaka_vault.wasm` & `pusaka_registry.wasm`, prints their SHA-256 Base58 code hashes, generates `web/public/attack-report.json`, and runs the **Vitest NEP-413 & Pair-Check test suite**. |
| **2. Run Attack Lab** | `node scripts/pusaka-cli.mjs attack` *(or `make attack`)* | Runs seller & gate exploit scenarios **A1–A12**; every attack finishes `BLOCKED` with its deterministic error code (`E_ONLY_REGISTRY`, `E_FROZEN`, `E_NONCE_MISMATCH`, `E_NO_DELEGATE`, `E_NOT_OWNER`, `E_INSUFFICIENT_BALANCE`, `E_UNSUPPORTED`). |
| **3. Explore Receipt Interleavings** | `cargo test -p pusaka-core --test interleavings -- --nocapture` | Exhaustively explores **75,600** receipt orderings of a *sale in the middle of a payout* (`s1_sale_in_the_middle_of_a_payout`), **4,620** orderings of a *bait-and-switch relist* (`s2_bait_and_switch_relist`), double-transfer races, lost callbacks + `sync`, expiry races, and 400 randomized schedules. |
| **4. Start Web App** | `cd web && pnpm install && pnpm dev` | Opens Pusaka at `http://localhost:3000`. Connect a NEAR Testnet wallet or click **"Preview with demo data"** (`Demo` toggle in the navbar) to test the Seat Wallet (`/`), Holder Lounge (`/lounge`), Safe Market (`/market`), Per-Seat History (`/seat/[id]`), 5-Row On-Chain Proof Verifier (`/verify`), and Attack Lab (`/lab`). |
| **5. Linux Sandbox (Optional)** | `make docker-judge` | Builds the pinned `rust:1.86-bookworm` container and runs L0 + LM + L1 `near-workspaces` local validator node tests (`tests/sandbox`). |

### Web Application Routes (`web/src/app`)

| Route | Purpose |
| --- | --- |
| `/` | **Seat Wallet**: View seat balance & withdrawable NEAR, open the 5-row on-chain proof drawer (`VerifyDrawer`), withdraw funds, list/delist seat with confirmation sheets, or simulate a live sale handoff (`HandoffOverlay`). |
| `/lounge` | **Holder-Only Lounge (Track Requirement R2)**: Gated by NEP-413 challenge signature + RPC `FullAccess` check + per-request same-final-block T2 pair check (`/api/gate/{challenge,verify,content}`). |
| `/market` | **Safe Secondary Market**: Browse listed seats with inside-balance vs. asking-price comparison bars (`CompareBar`) and atomic `buy_seat` settlement. |
| `/seat/[id]` | **Per-Seat History (Track Requirement R3)**: Monthly ledger of **All**, **Earned** (event pool shares), **Paid out** (vault outflows), and **Holders** (ownership timeline with `rotation_seq` & acquisition type). |
| `/verify` | **On-Chain Proof Verifier**: Interactive 5-row verification table checking `Access keys (0)`, `Pinned code hash`, `Same-block identity pair-check`, `Canonical holder`, and `Registry seal status`. |
| `/lab` | **Interactive Attack Lab**: Run and inspect all 12 seller & gate exploit scenarios (`A1–A12`) grouped by *Before the sale*, *During the sale*, *After the sale*, and *Keys and signatures*, linked to automated tests and live Testnet transactions. |
| `/events` · `/seats` · `/treasury` · `/kit` | Club event ticket sales, full seat directory, O(1) accumulator & treasury split inspector, and UI component/token kit. |

---

## 4. How Control Passes on Transfer & Why the Old Owner Cannot Keep Access (Track Requirement R1)

### 4.1 Step-by-Step Receipt Flow on Transfer (`nft_transfer`)

```text
Owner A                     Registry (pusaka.<net>)                Seat Vault (s001.pusaka.<net>)
   │                                  │                                          │
   ├─ 1. nft_transfer(to=B, s001) ───►│                                          │
   │     (1 yoctoNEAR, checks A is    │                                          │
   │      index owner & seat Idle)    ├─ 2. v_rotate(from=A, to=B, seq=n) ──────►│
   │                                  │                                          ├─ 3. ATOMIC CUT-OFF RECEIPT:
   │                                  │                                          │     - Verify predecessor == registry
   │                                  │                                          │     - Verify owner == A, status == Idle
   │                                  │                                          │     - Verify rotation_seq == n
   │                                  │                                          │     - Set owner = B, rotation_seq = n + 1
   │                                  │                                          │     - Wipe delegate = None
   │                                  │◄─ 4. on_rotated({owner_id: B, seq: n+1}) ┤
   │                                  ├─ 5. Advance index to (B, n+1),           │
   │                                  │     record holder history, emit NEP-297  │
```

1. **Receipt 1 (`registry.nft_transfer`)**: Owner `A` calls `registry.nft_transfer(receiver_id = B, token_id)` attaching `1 yoctoNEAR`. The registry verifies that `A` is the current index owner, `B != A` (`E_SELF_TRANSFER`), and the seat has no live listing (`E_NOT_IDLE`).
2. **Receipt 2 (`vault.v_rotate`) — The Atomic Cut-Off**: The registry calls `vault.v_rotate(from = A, to = B, expected_seq = n)` on the seat sub-account. Inside this **single receipt**, the vault verifies:
   - `env::predecessor_account_id()` is its parent registry account derived from `env::current_account_id()` (`E_ONLY_REGISTRY`),
   - `vault.owner == A` (`E_NOT_OWNER`),
   - `vault.status` is `Idle` (expired listings are lazily normalized to `Idle`; active listings reject with `E_NOT_IDLE`), and
   - `vault.rotation_seq == n` (`E_WRONG_SEQ`).
   It then sets `vault.owner = B`, increments `vault.rotation_seq = n + 1`, and clears `vault.delegate = None`. **Control moves at this exact receipt.** Any subsequent call by `A` or `A`'s former delegate to the vault fails immediately.
3. **Receipt 3 (`registry.on_rotated` & `sync` healing)**: The callback updates the registry's NEP-171 index to `(B, n + 1)`, appends to the seat's holder timeline, and emits the NEP-297 `nft_transfer` event. If the callback ever runs out of gas, the vault is already at `(B, n + 1)` while the index is at `(A, n)`. Anyone can call `registry.sync(token_id)` (design decision `K8`), which reads `vault.vault_state()` and advances the index only when `vault.rotation_seq > index.seq` (never rolling backwards).

### 4.2 Six Controls That Stop a Former Owner from Keeping Access

| Vector Attempted by Seller | Why It Fails in Pusaka |
| --- | --- |
| **1. Keep a backup access key on the seat sub-account** | **Zero keys exist (`K1`)**: `mint_seat` creates the sub-account without `AddKey`, and `pusaka-vault` contains no `add_key` host call. `view_access_key_list` on every seat account is permanently `[]`. |
| **2. Use a parent `FullAccess` key to redeploy or drain** | **Sealed parent (`Segel`, `K1`/`K7`)**: The parent registry account has no upgrade/admin withdrawal methods and its access keys are deleted after setup. |
| **3. Appoint a pre-sale delegate (`set_delegate`) before transferring** | **Epoch-bound delegate**: Every `Delegate` stores the `rotation_seq` at which it was created, and `apply_rotation` sets `delegate = None`. Even if checked before clearing, `d.seq != self.rotation_seq` aborts with `E_STALE_DELEGATE` / `E_NO_DELEGATE`. |
| **4. Drain the vault while a buyer is purchasing (`buy_seat`)** | **Listing freeze (`E_FROZEN`) + Atomic Settlement**: Calling `list_seat` sets the vault to `Listed`, blocking all `withdraw`, `delegate_withdraw`, and `set_delegate` calls until canceled or expired. Furthermore, `v_settle_sale` verifies `withdrawable >= max(listing.min_balance, buyer.min_balance)` in the same receipt that transfers ownership. |
| **5. Cancel listing, drain vault, and relist at same price (`Bait-and-Switch`)** | **Monotonic `listing_nonce` (`E_NONCE_MISMATCH`)**: Every `v_list` increments `listing_nonce`. A buyer's `buy_seat(token_id, nonce, min_balance)` quotes the exact `nonce` they inspected; relisting increments the nonce and causes the in-flight buy to abort and refund the buyer. |
| **6. Keep an open web session to `/lounge` after selling** | **Per-request same-final-block Pair Check (`D1`/`D5`)**: The lounge session cookie embeds `{ accountId, tokenId, rotationSeq }`. Every `GET /api/gate/content` queries `registry.nft_token` and `vault.nft_item_info` at the **same final `block_id`** and rejects with `403` the moment `owner_id` or `rotation_seq` changes or diverges. |

---

## 5. Threat Model & Attack Lab Matrix (R0 & R4)

Every threat documented in [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) is mapped to an invariant, an error code, and an automated test executed by `make judge` and `make attack`:

| ID | Attack Scenario | Architectural Control | Error Code / Outcome | Automated Test |
| --- | --- | --- | --- | --- |
| **A1** | Attacker or seller calls `vault.v_rotate` directly on seat sub-account | Vault derives parent registry from `env::current_account_id()` and checks `predecessor == registry` | `E_ONLY_REGISTRY` | `attack_a1_direct_v_rotate_bypass_blocked` |
| **A2** | Seller calls `vault.withdraw` while seat is listed on market | `v_list` freezes all vault outflows while listing is live | `E_FROZEN` | `attack_a2_seller_withdraw_while_listed_blocked` |
| **A3** | Seller cancels listing, drains vault, and relists with `min_balance = 0` | Monotonic `listing_nonce` checked in both `buy_seat` and `v_settle_sale` | `E_NONCE_MISMATCH` | `attack_a3_bait_and_switch_relist_blocked_by_nonce` & `s2_bait_and_switch_relist` (4,620 paths) |
| **A4** | Seller appoints an accomplice/bot via `set_delegate` before transfer/sale | Rotation wipes `delegate = None` and increments `rotation_seq` | `E_NO_DELEGATE` | `attack_a4_pre_sale_delegate_dies_on_transfer` |
| **A5** | Seller calls `registry.claim` hoping pool share goes to seller's wallet | `claim` always sends `Transfer` to `Promise::new(token_id)` (the seat vault) | `CREDITED_TO_VAULT_ONLY` | `unit_mint_event_ticket_and_claim_to_seat_vault` |
| **A6** | **Sale in the middle of a payout** (ticket + claim + buy + seller drain race) | Vault frozen during listing; payout lands in seat vault; buyer owns post-settlement balance | `E_FROZEN` / Buyer owns payout | `s1_sale_in_the_middle_of_a_payout` (75,600 paths) & `r4_sale_in_the_middle_of_a_payout_and_history_verification` |
| **A7** | Former owner calls `withdraw`, `set_delegate`, or `list_seat` after transfer | Canonical `owner_id` updated atomically in `v_rotate` / `v_settle_sale` | `E_NOT_OWNER` | `attack_a7_former_owner_withdraw_after_transfer_blocked` |
| **A8** | Vault balance is below seller's or buyer's `min_balance` guard at settlement | `v_settle_sale` checks `withdrawable >= max(seller_min, buyer_min)` and reverts; callback credits 100% pull refund | `E_INSUFFICIENT_BALANCE` | `attack_a8_min_balance_guard_rejects_and_refunds_buyer_in_full` |
| **A9** | Attacker calls `vault.init` again or tries to overwrite pinned `vault_wasm` | `#[init]` + parent check on vault; `pin_vault_wasm` locks permanently after first call | `E_UNSUPPORTED` / `E_ONLY_REGISTRY` | `unit_rejects_direct_v_rotate_from_attacker` |
| **A10** | Seller fires two concurrent `nft_transfer` calls (`double-transfer race`) | `v_rotate` checks `expected_seq == rotation_seq`; second receipt aborts | `E_WRONG_SEQ` | `s3_double_transfer_race` (180 paths) |
| **A11** | Callback runs out of gas leaving index behind vault; stale owner tries to act | `registry.sync(token_id)` heals index forward-only; gate fails closed while `vault.seq > index.seq` | `DIVERGENT_IGNORED` / Healed | `attack_a11_permissionless_sync_heals_lagging_index_and_never_rolls_back` & `s4_lost_callback_then_sync` |
| **A12** | `nft_transfer_call` rollback drain or seller buying own listing | `nft_transfer_call` is disabled (`K5`); self-buy rejected | `E_UNSUPPORTED` / `E_BUYER_IS_SELLER` | `unit_nft_transfer_call_is_disabled` |
| **D1–D5** | Web gate replay, forged key, stale session, or mid-transfer race on `/lounge` | Server-issued HMAC nonce challenge + Ed25519 NEP-413 verify + RPC `FullAccess` check + per-request same-final-block T2 pair check | `401` / `403` Fail-Closed | `web/src/lib/__tests__/pusaka.test.ts` |

---

## 6. Architecture & Repository Layout

```text
pusaka/
├── crates/
│   ├── pusaka-core/          # Pure, dependency-free state machines & overflow-safe math (#![forbid(unsafe_code)])
│   │   ├── src/
│   │   │   ├── accrual.rs    # O(1) member pool accumulator with carry (no scaling-factor overflow)
│   │   │   ├── index.rs      # Forward-only registry index, listing mirror, sync & T2 pair_check()
│   │   │   ├── math.rs       # Overflow-safe apply_bps(u128, u16) for all u128 values
│   │   │   ├── split.rs      # Per-event frozen revenue split (40% Pool, 50% Kas Klub, 10% Organizer)
│   │   │   └── vault.rs      # Canonical VaultCore state machine (Idle/Listed, nonce, delegate, rotate, settle)
│   │   └── tests/
│   │       └── interleavings.rs # Exhaustive receipt-interleaving explorer (80,620 schedules)
│   └── pusaka-test-env/      # Cross-platform in-memory NEAR host runtime for native cargo test on Windows/macOS/Linux
├── contracts/
│   ├── vault/                # Per-seat sub-account smart contract (sharded-item-1.0.0 + outflows ring buffer)
│   └── registry/             # Parent NEP-171 collection, keyless sub-account factory, accrual, safe market & pull ledgers
├── tests/
│   └── sandbox/              # Level L1 near-workspaces local validator sandbox tests (Linux / Docker)
├── scripts/
│   ├── pusaka-cli.mjs        # One-command judge runner (`make judge`, `make attack`, `verify-live`)
│   └── deploy-testnet.mjs    # Pure-Node Ed25519 + Borsh NEAR Testnet provisioner, deployer & live attack runner
├── docs/
│   ├── API.md                # Complete contract JSON interface & error code reference
│   ├── THREAT_MODEL.md       # Formal invariants (I1-I7) and Threat Model (A1-A12, D1-D5)
│   └── deployment.testnet.json # Live NEAR Testnet account IDs, code hashes & transaction hashes
└── web/                      # Next.js 16 App Router UI (Seat Wallet, Lounge, Safe Market, History, Proof Verifier, Attack Lab)
    ├── screenshots/          # Captured desktop & mobile UI states across all routes
    ├── scripts/capture.mjs   # Automated screenshot capture script
    └── src/
        ├── app/              # App Router pages (/, /lounge, /market, /seat/[id], /verify, /lab, /events, /seats, /treasury, /kit)
        ├── components/       # Seat cards, glyphs, proof drawer, confirmation sheets, handoff overlay & primitive UI
        └── lib/              # Chain hooks, DemoProvider, NEP-413 verifier, T2 pair-check, NEAR RPC client & Vitest suite
```

### Compiled WASM Artifacts (`Rust 1.86.0`, `wasm32-unknown-unknown`, `opt-level = "z"`, `lto = true`, `strip = "symbols"`)

| Contract | Binary Path | Size | SHA-256 Code Hash (Base58) |
| --- | --- | --- | --- |
| **`pusaka-vault`** | `target/wasm32-unknown-unknown/release/pusaka_vault.wasm` | `175,843 B` | `DFuv6MrVh9yz62uvRxYbZhAEewiWeqUKdYvb3kPLmwSg` |
| **`pusaka-registry`** | `target/wasm32-unknown-unknown/release/pusaka_registry.wasm` | `440,135 B` | `HnMPZdTuyDZmGLd7ZHBbvutM9dQ2ZLmVHBxuzHw8zbeU` |

---

## 7. Third-Party Verification Ladder (`sharded-item-1.0.0`)

Pusaka implements the four-tier verification ladder from the [Sharded NFT Items draft](https://github.com/houseofstake/tla-contracts/blob/main/docs/sharded-nft-items.md):

- **T0 (Namespace)**: A seat ID `<label>.<registry>` is a direct sub-account of `<registry>`, which only `<registry>` could create.
- **T1 (Index)**: `registry.nft_token({ token_id })` reports the collection's view of `owner_id`.
- **T2 (Pair Check)**: At a single `final` `block_id`, a consumer reads both `registry.get_seat({ token_id })` and `vault.nft_item_info()` on `<token_id>`. Both must agree on `owner_id` and `rotation_seq` (and `collection_id` is pinned from the consumer's config, never trusted from the item).
- **T3 (Keyless & Provenance Proof — *Bukti Tanpa Kunci*)**: RPC `view_access_key_list` on `<token_id>` has `keys.length === 0`, `view_account` matches `get_config().vault_code_hash`, and the parent `<registry>` is sealed.

---

## 8. Disclosure of Libraries, Templates & AI Tooling (HACKATHON.md Q-005)

All Pusaka smart contracts (`pusaka-core`, `pusaka-vault`, `pusaka-registry`), the receipt-interleaving explorer, the NEP-413 + T2 pair-check gate, and the web application were built from scratch during the NEAR Hackathon window (Nov 2026).

- **Open-source libraries used**:
  - Rust: `near-sdk` (`5.9.0`), `borsh` (`1.x`), `serde` (`1.x`), `serde_json` (`1.x`), `near-workspaces` (`0.16`, dev/sandbox).
  - Web / TypeScript: `next` (`16.4.5`), `react` (`19.3.1`), `@tanstack/react-query` (`5.106.0`), `@near-wallet-selector/*` (`8.9.15`), `near-api-js` (`5.0.1`), `@radix-ui/react-dialog` (`1.3.1`), `@radix-ui/react-switch` (`1.4.1`), `@radix-ui/react-tabs` (`1.2.1`), `framer-motion` (`14.9.1`), `tweetnacl` (`1.0.3`, Ed25519 verification), `lucide-react` (`0.460.0`), `tailwindcss` (`3.4.17`), `vitest` (`2.1.8`).
- **Design reference**: The `nft_item_info()` view structure (`spec: "sharded-item-1.0.0"`) and T0–T3 verification ladder follow the public [Sharded NFT Items draft](https://github.com/houseofstake/tla-contracts/blob/main/docs/sharded-nft-items.md) linked in Track 10 (`10-nfts.md`). No code was copied from `tla-contracts`.
- **AI coding tools**: Built with assistance from Claude / Gemini in Antigravity IDE for pair-programming, test generation, and UI implementation.

---

## 9. License

Released under the [MIT License](./LICENSE).
