# Pusaka Threat Model & Formal Invariants

**Specification Version:** `2.0` · **Item Standard:** `sharded-item-1.0.0` · **Collection Standard:** `NEP-171 / NEP-177 / NEP-181 / NEP-297`

---

## 1. Security Thesis

A membership NFT that carries its own wallet must guarantee one property above all else:

> **Atomic Cut-Off:** When a seat changes hands—whether by direct transfer (`nft_transfer`) or secondary sale (`buy_seat`)—the previous holder must lose every avenue to spend from, configure, or authenticate as that seat in the **exact same receipt** in which ownership moves, and the buyer must receive at least the balance they were promised or be refunded in full.

On NEAR Protocol, cross-contract calls execute asynchronously across multiple blocks and receipts, and a smart contract **cannot enumerate the access keys on its own account**. Therefore, key-rotation wallets cannot prove to a secondary buyer that no backup key was left behind.

**Pusaka** eliminates access keys entirely:
- Every seat sub-account (`sNNN.<registry>` or `<handle>.<registry>`) is created in a single atomic batch receipt (`CreateAccount` → `Transfer` → `DeployContract` → `FunctionCall("init")`) with **zero `AddKey` actions** (`K1`).
- The parent registry account is sealed after deployment (`K1`, `K7`).
- Authority lives exclusively in `VaultCore` on the seat sub-account (`K2`), guarded by a monotonic `rotation_seq` and `listing_nonce`.

---

## 2. Formal Invariants Verified Across 80,620 Receipt Interleavings

The receipt-interleaving explorer ([`crates/pusaka-core/tests/interleavings.rs`](../crates/pusaka-core/tests/interleavings.rs)) models every cross-contract receipt and checks seven invariants after every step and at every terminal leaf:

| Invariant | Statement |
| --- | --- |
| **I1 — Conservation of Value** | $\sum \text{wallets} + \text{vault\_balance} + \text{registry\_balance} + \text{in\_flight} = \text{total\_supply}$. Not a single yoctoNEAR is created, lost, or trapped. |
| **I2 — Index Never Leads Vault** | At every intermediate step, $\text{index.seq} \le \text{vault.rotation\_seq}$. The canonical state is always the seat vault. |
| **I3 — Convergence** | Once in-flight callbacks complete (or after a permissionless `sync`), $\text{index.owner} = \text{vault.owner}$ and $\text{index.seq} = \text{vault.rotation\_seq}$. |
| **I4 — Buyer Protection** | In every secondary sale, either the buyer becomes `vault.owner` in a receipt where $\text{withdrawable} \ge \max(\text{listing.min\_balance}, \text{buyer.min\_balance})$, or $100\%$ of the buyer's attached deposit is credited to `refunds[buyer]`. |
| **I5 — Immediate Seller Cut-Off** | Every outflow from the vault is authorized by the canonical `owner` (or a live `Delegate` whose `seq == vault.rotation_seq`) at the receipt of execution. No outflow by a seller or seller's delegate ever succeeds while listed (`E_FROZEN`) or after settlement (`E_NOT_OWNER` / `E_NO_DELEGATE`). |
| **I6 — Golden Money Rule** | Whoever owns the seat when funds land in the vault owns those funds: $\text{vault\_final} = \text{vault\_at\_settlement} + \text{landed\_after\_settlement} - \text{buyer\_outflows}$. |
| **I7 — Vault-Only Accrual Claims** | `registry.claim(token_id)` updates `seat.checkpoint = acc.acc` before dispatching `Promise::new(token_id).transfer(amount)`. Pool shares never transfer to a user wallet. |

---

## 3. Seller & Protocol Threat Matrix (A1–A12)

| ID | Threat / Attack Vector | Mechanism Attempted | Defense in Pusaka | Error Code | Test Coverage |
| --- | --- | --- | --- | --- | --- |
| **A1** | **Direct `v_rotate` Bypass** | Seller or attacker calls `v_rotate`, `v_list`, `v_cancel`, or `v_settle_sale` directly on `s001.<registry>`. | `assert_registry()` derives the parent account ID from `env::current_account_id()` and requires `env::predecessor_account_id() == registry`. | `E_ONLY_REGISTRY` | `attack_a1_direct_v_rotate_bypass_blocked` |
| **A2** | **Drain Vault While Listed** | Seller lists seat with 2 NEAR in vault, then calls `vault.withdraw` or `set_delegate` while a buyer's transaction is in flight. | `v_list` transitions vault to `Status::Listed`. `authorize_withdraw` and `set_delegate` reject all calls while `is_frozen(now)` is true. | `E_FROZEN` | `attack_a2_seller_withdraw_while_listed_blocked`, `s1_sale_in_the_middle_of_a_payout` |
| **A3** | **Bait-and-Switch Relist** | Seller cancels a listing that promised `min_balance = 1 NEAR`, drains the vault, and immediately relists at the same price with `min_balance = 0`. | Every `v_list` increments `listing_nonce`. `buy_seat` and `v_settle_sale` require `listing.nonce == buyer_expected_nonce`. | `E_NONCE_MISMATCH` | `attack_a3_bait_and_switch_relist_blocked_by_nonce`, `s2_bait_and_switch_relist` |
| **A4** | **Pre-Sale Delegate Backdoor** | Seller appoints an accomplice or bot via `set_delegate` before transferring or selling, then calls `delegate_withdraw` afterwards. | `Delegate` stores `seq: rotation_seq`, and `apply_rotation` sets `delegate = None`. | `E_NO_DELEGATE` / `E_STALE_DELEGATE` | `attack_a4_pre_sale_delegate_dies_on_transfer` |
| **A5** | **Divert Unclaimed Pool Share** | Seller calls `registry.claim(token_id)` hoping accrued ticket revenue is paid to their personal account before selling. | `claim` transfers exclusively to `Promise::new(token_id)` (the seat vault sub-account), increasing the vault balance protected by the listing freeze. | `CREDITED_TO_VAULT_ONLY` | `unit_mint_event_ticket_and_claim_to_seat_vault` |
| **A6** | **Sale in the Middle of a Payout** | Event ticket sale (`buy_ticket`), pool `claim`, buyer's `buy_seat`, and seller's `withdraw` receipts interleave in arbitrary order across blocks. | Listing freezes seller outflows; `claim` credits the seat vault; settlement rotates ownership atomically. Explored across all **75,600** receipt orderings. | `E_FROZEN` | `s1_sale_in_the_middle_of_a_payout`, `r4_sale_in_the_middle_of_a_payout_and_history_verification` |
| **A7** | **Post-Transfer Spend by Former Owner** | Former owner calls `vault.withdraw`, `vault.set_delegate`, or `registry.list_seat` after transfer or sale. | `vault.owner` and `index.owner` are updated; former owner fails authorization at both contracts. | `E_NOT_OWNER` | `attack_a7_former_owner_withdraw_after_transfer_blocked` |
| **A8** | **Under-Collateralized Vault at Settlement** | Buyer attempts to purchase a seat whose vault `withdrawable` is below `max(listing.min_balance, buyer.min_balance)`. | `v_settle_sale` aborts in the vault receipt; `on_sale_settled` catches the failed promise and credits $100\%$ of `paid` to `refunds[buyer]`. | `E_INSUFFICIENT_BALANCE` | `attack_a8_min_balance_guard_rejects_and_refunds_buyer_in_full` |
| **A9** | **Vault Re-Initialization or Code Swap** | Attacker calls `vault.init` on an existing seat or attempts to call `pin_vault_wasm` on the registry a second time. | NEAR `#[init]` rejects existing state, `vault.init` checks `predecessor == registry`, and `pin_vault_wasm` permanently locks once `vault_wasm` is non-empty. | `E_UNSUPPORTED` / `E_ONLY_REGISTRY` | `unit_rejects_direct_v_rotate_from_attacker` |
| **A10** | **Double-Transfer Race** | Seller submits two concurrent `nft_transfer` transactions to different recipients. | Both carry `expected_seq = n`. The first to reach the vault advances `rotation_seq` to `n + 1`; the second fails `expected_seq == rotation_seq`. | `E_WRONG_SEQ` | `s3_double_transfer_race` |
| **A11** | **Lagging Index / Rollback `sync`** | A callback runs out of gas so `index` lags behind `vault`, or an attacker tries to roll `index` backwards. | `registry.sync(token_id)` reads `vault_state()` and advances only when `vault.rotation_seq > index.seq`. Equal/lower divergent seqs are ignored. | `DIVERGENT_IGNORED` | `attack_a11_permissionless_sync_heals_lagging_index_and_never_rolls_back`, `s4_lost_callback_then_sync` |
| **A12** | **`nft_transfer_call` Receiver Drain & Self-Buy** | Malicious receiver contract drains the seat vault inside `nft_on_transfer` and then returns `false` to roll back the NFT transfer. | `nft_transfer_call` is unconditionally disabled (`K5`), and `buy_seat` rejects `buyer == seller`. | `E_UNSUPPORTED` / `E_BUYER_IS_SELLER` | `unit_nft_transfer_call_is_disabled` |

---

## 4. Web Gate Threat Model (D1–D5)

The holder-only lounge (`/lounge` and `/api/gate/*`) enforces five server-side controls:

- **D1 — Stale Session After Transfer:** Session cookies bind `{ accountId, tokenId, rotationSeq, exp }`. Every `GET /api/gate/content` re-queries `registry.get_seat` and `vault.nft_item_info` at `finality: "final"` and immediately returns `403` if `rotation_seq` or `owner_id` changed.
- **D2 — Signature Replay:** `POST /api/gate/challenge` generates a fresh 32-byte random nonce bound to an HMAC-signed short-lived challenge cookie. NEP-413 verification hashes the exact Borsh payload (`tag = 2^31 + 413`, `message`, `nonce`, `recipient = "pusaka-lounge"`, `callbackUrl = None`).
- **D3 — Unbound / Revoked Key:** `POST /api/gate/verify` calls NEAR RPC `view_access_key` at `finality: "final"` to confirm the Ed25519 public key that signed the NEP-413 challenge is currently an active `FullAccess` key on `accountId`.
- **D4 — Spoofed Collection Item:** The gate pins `REGISTRY_ID` from server configuration and verifies Tier T0 namespace (`<label>.<REGISTRY_ID>`) before querying the seat vault.
- **D5 — Mid-Transfer Race Window (`IndexBehind`):** Between `vault.v_rotate` (Receipt 2) and `registry.on_rotated` (Receipt 3), `vault.rotation_seq > index.rotation_seq`. `evaluateGatePairCheck` **fails closed** whenever `pairCheck != Consistent`, instructing the client to wait for finality or invoke `sync(token_id)`.
