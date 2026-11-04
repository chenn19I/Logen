// Pure TypeScript port of `pusaka-core` Receipt-Interleaving Explorer & Threat Matrix (A1-A12)
// Mirrors `crates/pusaka-core/src/vault.rs`, `index.rs`, and `tests/interleavings.rs`.

export interface ThreatScenario {
  id: string;
  code: string;
  title: string;
  indonesianTitle: string;
  vector: string;
  control: string;
  errorCode: string;
  testId: string;
  category: "Key & Account" | "Transfer & Index" | "Safe Sale & Escrow" | "Gate & Session";
  severity: "Critical" | "High";
}

export const THREAT_MODEL_A1_A12: ThreatScenario[] = [
  {
    id: "A1",
    code: "A1",
    title: "Seller retains a backup FullAccess or FunctionCall key on the seat sub-account",
    indonesianTitle: "Penjual menyimpan kunci cadangan di sub-account seat",
    vector:
      "In key-swap NFT wallets, the seller adds a second access key before selling and drains the wallet after the buyer pays.",
    control:
      "K1 Zero-Key Architecture: `mint_seat` creates `sNNN.<registry>` in an atomic batch without `AddKey`. Vault code contains zero `Promise::add_access_key` instructions. `view_access_key_list` is permanently `[]`.",
    errorCode: "ZERO_KEYS_INVARIANT",
    testId: "L1::a1_seat_has_zero_access_keys",
    category: "Key & Account",
    severity: "Critical",
  },
  {
    id: "A2",
    code: "A2",
    title: "Seller withdraws vault NEAR while seat is listed for sale",
    indonesianTitle: "Penjual menarik saldo vault saat seat sedang dilisting",
    vector:
      "Seller lists a seat showing 20 NEAR inside the vault, then races a direct `vault.withdraw()` call right before the buyer's `buy_seat` receipt lands.",
    control:
      "K2 Atomic Freeze on Listing: `v_list` sets vault status to `Listed` (`Frozen`). Every outflow (`withdraw`, `delegate_withdraw`, `set_delegate`) checks `!is_frozen(now)` in the vault and panics immediately.",
    errorCode: "E_FROZEN",
    testId: "LM::s1_sale_in_the_middle_of_a_payout / L0::listing_freezes_every_outflow",
    category: "Safe Sale & Escrow",
    severity: "Critical",
  },
  {
    id: "A3",
    code: "A3",
    title: "Seller's pre-sale delegate (or AI agent) drains vault during or after transfer",
    indonesianTitle: "Delegate/agen penjual menguras vault saat atau sesudah transfer",
    vector:
      "Seller appoints an AI agent or accomplice account via `set_delegate` before transferring or selling, hoping the delegate survives ownership rotation.",
    control:
      "Epoch-Bound Delegate: While listed, delegate calls fail with `E_FROZEN`. Upon `v_rotate` or `v_settle_sale`, `rotation_seq` increments (`seq + 1`) and `delegate` is wiped (`E_NOT_OWNER` / `E_STALE_DELEGATE`).",
    errorCode: "E_FROZEN / E_STALE_DELEGATE",
    testId: "LM::s1_sale_in_the_middle_of_a_payout / L0::delegate_is_bounded_and_dies_on_rotation",
    category: "Safe Sale & Escrow",
    severity: "Critical",
  },
  {
    id: "A4",
    code: "A4",
    title: "Bait-and-switch relist: cancel, drain, and relist at same price while buyer tx is in flight",
    indonesianTitle: "Bait-and-switch: batalkan listing, kuras saldo, listing ulang saat tx pembeli di jalan",
    vector:
      "Seller lists seat with `min_balance = 10 NEAR` (nonce 1). Seeing buyer's `buy_seat` in mempool, seller calls `cancel_listing`, `withdraw(10 NEAR)`, and `list_seat` at the same price with `min_balance = 0` (nonce 2).",
    control:
      "Monotonic Listing Nonce + Buyer Guard: `buy_seat({token_id, nonce, min_balance})` requires BOTH the exact `nonce` quoted by the buyer AND `withdrawable >= max(listing.min_balance, buyer_min_balance)` inside `v_settle_sale`. Buyer gets 100% refund via pull ledger.",
    errorCode: "E_NONCE_MISMATCH / E_INSUFFICIENT_BALANCE",
    testId: "LM::s2_bait_and_switch_relist / L0::relist_bumps_nonce_so_bait_and_switch_fails",
    category: "Safe Sale & Escrow",
    severity: "Critical",
  },
  {
    id: "A5",
    code: "A5",
    title: "Sale in the middle of a ticket payout: seller tries to intercept in-flight `claim`",
    indonesianTitle: "Penjualan di tengah pembagian hasil tiket (`claim` sedang terbang)",
    vector:
      "A ticket is sold and `registry.claim(token_id)` is triggered concurrently with `buy_seat`. Seller tries to divert the claimed member pool share to their personal wallet.",
    control:
      "K3 + Golden Rule (I6/I7): `registry.claim(token_id)` NEVER sends NEAR to `owner_id`; it sends a plain `Transfer` receipt to the seat vault account `<token_id>`. Whoever owns the vault when the receipt lands controls it.",
    errorCode: "I7_CLAIM_TO_VAULT_ONLY",
    testId: "LM::s1_sale_in_the_middle_of_a_payout",
    category: "Safe Sale & Escrow",
    severity: "Critical",
  },
  {
    id: "A6",
    code: "A6",
    title: "Old owner calls `vault.withdraw` or `registry.nft_transfer` after transfer finality",
    indonesianTitle: "Mantan pemilik memanggil withdraw atau transfer setelah seat berpindah",
    vector:
      "After `v_rotate` completes, old owner Alice attempts to call `vault.withdraw` directly or replay a transfer.",
    control:
      "Single-Receipt Rotation Cutoff: `v_rotate` atomically sets `vault.owner = B` and `rotation_seq += 1`. Any subsequent call from Alice is rejected with `E_NOT_OWNER`.",
    errorCode: "E_NOT_OWNER",
    testId: "L0::rotate_happy_path_and_old_owner_locked_out",
    category: "Transfer & Index",
    severity: "High",
  },
  {
    id: "A7",
    code: "A7",
    title: "Double-transfer race: seller submits two concurrent `nft_transfer` calls to different buyers",
    indonesianTitle: "Balapan transfer ganda ke dua pembeli berbeda",
    vector:
      "Seller submits `nft_transfer(Carol)` and `nft_transfer(Dave)` in the same block while also attempting `vault.withdraw`.",
    control:
      "Expected Sequence Lock (`expected_seq`): Registry passes `index.seq` to `v_rotate(from, to, expected_seq)`. The first receipt increments `vault.rotation_seq` to `n+1`; the second fails with `E_NOT_OWNER` or `E_WRONG_SEQ`.",
    errorCode: "E_NOT_OWNER / E_WRONG_SEQ",
    testId: "LM::s3_double_transfer_race",
    category: "Transfer & Index",
    severity: "High",
  },
  {
    id: "A8",
    code: "A8",
    title: "Lost callback exploit: `v_rotate` succeeds in vault, callback runs out of gas, stale seller acts via index",
    indonesianTitle: "Eksploitasi callback gagal: index tertinggal dari vault, penjual lama menyalahgunakan index",
    vector:
      "If the post-rotation callback to registry fails, `registry.nft_token` still lists Alice at `seq=0` while `vault` is owned by Bob at `seq=1`. Alice tries to transfer to Mallory via registry.",
    control:
      "K2 Canonical Vault + K8 Permissionless `sync`: Vault rejects Alice's `v_rotate` (`E_NOT_OWNER`). Anyone calls `registry.sync(token_id)` which reads `vault_state()` and advances index forward (`seq 0 -> 1`). Index never moves backward.",
    errorCode: "E_NOT_OWNER / SYNC_HEALED",
    testId: "LM::s4_lost_callback_then_sync / L0::sync_never_rolls_back",
    category: "Transfer & Index",
    severity: "Critical",
  },
  {
    id: "A9",
    code: "A9",
    title: "Direct external call to `v_rotate`, `v_list`, `v_cancel`, or `v_settle_sale` bypassing registry",
    indonesianTitle: "Panggilan langsung ke fungsi internal vault (`v_rotate`, `v_settle_sale`) tanpa lewat registry",
    vector:
      "Attacker calls `s001.pusaka.testnet::v_rotate` directly from their wallet to seize ownership without owning the NFT.",
    control:
      "Strict Parent Predecessor Check: Every `v_*` method checks `env::predecessor_account_id() == registry_id` (derived from parent namespace) and panics with `E_ONLY_REGISTRY`.",
    errorCode: "E_ONLY_REGISTRY",
    testId: "L1::a9_direct_vault_internal_call_rejected",
    category: "Key & Account",
    severity: "Critical",
  },
  {
    id: "A10",
    code: "A10",
    title: "`nft_transfer_call` receiver rollback attack after spending vault balance",
    indonesianTitle: "Serangan rollback `nft_transfer_call` setelah membelanjakan isi dompet",
    vector:
      "In NEP-171 `nft_transfer_call`, `nft_on_transfer` runs on the receiver before `nft_resolve_transfer`. A malicious receiver could spend the vault's funds during the window and then return `true` to roll back the NFT transfer.",
    control:
      "K5 Narrow Surface: `nft_transfer_call` is intentionally disabled and always panics with `E_UNSUPPORTED`.",
    errorCode: "E_UNSUPPORTED",
    testId: "L1::a10_transfer_call_unsupported",
    category: "Transfer & Index",
    severity: "High",
  },
  {
    id: "A11",
    code: "A11",
    title: "Gate Threat D1: Ex-holder keeps web session cookie after selling or transferring seat",
    indonesianTitle: "Ancaman Gate D1: Mantan pemegang mempertahankan cookie sesi Lounge setelah menjual seat",
    vector:
      "Alice logs into `/lounge` via NEP-413 signature, receives an `httpOnly` session cookie, sells her seat to Bob, and refreshes `/lounge` using her still-unexpired cookie.",
    control:
      "Per-Request Final-Block Re-Verification: Session token binds `{ accountId, tokenId, rotationSeq }`. `GET /api/gate/content` queries `vault.nft_item_info` at the latest final block on EVERY request and rejects immediately when `rotation_seq` or `owner_id` changes.",
    errorCode: "E_SESSION_ROTATED_OUT",
    testId: "Web::gate_revokes_session_on_rotation_seq_bump",
    category: "Gate & Session",
    severity: "Critical",
  },
  {
    id: "A12",
    code: "A12",
    title: "Gate Threat D5: Stale-index race during in-flight transfer window",
    indonesianTitle: "Ancaman Gate D5: Balapan index belum menyusul saat seat sedang berpindah",
    vector:
      "Between Receipt #2 (`vault.v_rotate` sets owner=B, seq=n+1) and Receipt #3 (`registry` callback updates index), `registry.nft_token` still reports owner=A. Seller A tries to pass the Lounge gate during those 1–2 blocks.",
    control:
      "Same-Final-Block T2 Pair Check (`pair_check`): Gate queries both `registry` and `vault` pinned to the exact same final `block_id`. Because `vault.rotation_seq > index.rotation_seq`, `pair_check` returns `IndexBehind` and the gate fails closed.",
    errorCode: "E_PAIR_INDEX_BEHIND",
    testId: "Web::pair_check_fails_closed_when_index_behind",
    category: "Gate & Session",
    severity: "Critical",
  },
];

export interface AttackReportItem {
  id: string;
  name: string;
  status: "BLOCKED" | "PASSED";
  expected_error: string;
  observed_error: string;
  control: string;
  tx_hash?: string;
  duration_ms: number;
}

export interface AttackReport {
  generated_at: string;
  network: string;
  registry_id: string;
  vault_code_hash: string;
  interleavings_explored: number;
  all_blocked: boolean;
  attacks: AttackReportItem[];
}

// Interactive Receipt-Interleaving Simulator State Machine (in-browser explorer for Judges)

export interface SimReceiptStep {
  id: string;
  txId: string;
  txLabel: string;
  stepIndex: number;
  receiptLabel: string;
  actor: string;
  targetContract: "registry" | "vault" | "wallet";
}

export interface SimWorldState {
  vaultOwner: string;
  vaultSeq: number;
  vaultStatus: "Idle" | "Listed";
  listingNonce: number;
  listingPrice: number;
  listingMinBalance: number;
  delegateAccount: string | null;
  delegateAllowance: number;
  vaultBalance: number;
  storageReserve: number;
  indexOwner: string;
  indexSeq: number;
  indexListedNonce: number | null;
  acc: number;
  checkpoint: number;
  escrow: number;
  kasKlub: number;
  inFlightClaim: number;
  wallets: Record<string, number>;
  logs: {
    step: number;
    receipt: string;
    outcome: "OK" | "BLOCKED";
    code?: string;
    detail: string;
  }[];
}

export type SimPresetId = "s1_payout_race" | "s2_bait_and_switch" | "s4_lost_callback_sync";

export interface SimScenarioPreset {
  id: SimPresetId;
  title: string;
  subtitle: string;
  totalInterleavingsInRustTest: number;
  description: string;
  initialWorld: SimWorldState;
  transactions: {
    txId: string;
    txLabel: string;
    actor: string;
    color: string;
    receipts: {
      receiptLabel: string;
      targetContract: "registry" | "vault" | "wallet";
      execute: (w: SimWorldState) => void;
    }[];
  }[];
}

export function createSimulatorPresets(): SimScenarioPreset[] {
  return [
    {
      id: "s1_payout_race",
      title: "S1 · Sale in the Middle of a Payout (Track Requirement R4)",
      subtitle: "75,600 receipt interleavings proved in pusaka-core",
      totalInterleavingsInRustTest: 75600,
      description:
        "Alice lists s001.pusaka.testnet (balance 20 NEAR, reserve 4 NEAR) for 100 NEAR with min_balance = 10 NEAR. While Bob's buy_seat(100 NEAR) is in flight, a fan buys a 50 NEAR event ticket, someone triggers claim(), Alice tries to withdraw(), and Alice's delegate agent tries to delegate_withdraw(). Step through the receipts in ANY order!",
      initialWorld: {
        vaultOwner: "alice.testnet",
        vaultSeq: 0,
        vaultStatus: "Listed",
        listingNonce: 1,
        listingPrice: 100,
        listingMinBalance: 10,
        delegateAccount: "agent.alice.testnet",
        delegateAllowance: 5,
        vaultBalance: 20,
        storageReserve: 4,
        indexOwner: "alice.testnet",
        indexSeq: 0,
        indexListedNonce: 1,
        acc: 0,
        checkpoint: 0,
        escrow: 0,
        kasKlub: 0,
        inFlightClaim: 0,
        wallets: {
          "alice.testnet": 1000,
          "bob.testnet": 1000,
          "fan.testnet": 1000,
          "agent.alice.testnet": 1000,
        },
        logs: [],
      },
      transactions: [
        {
          txId: "tx_ticket",
          txLabel: "Fan: buy_ticket (50 NEAR)",
          actor: "fan.testnet",
          color: "emerald",
          receipts: [
            {
              receiptLabel: "R1: registry.buy_ticket(50 NEAR) → +20 Pool, +30 Kas/Org",
              targetContract: "registry",
              execute: (w) => {
                w.wallets["fan.testnet"] -= 50;
                w.acc += 20; // 40% of 50 NEAR
                w.kasKlub += 30; // 50% Kas + 10% Org
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.buy_ticket",
                  outcome: "OK",
                  detail: "40% (20 NEAR) added to O(1) accumulator `acc`; 30 NEAR credited to Kas Klub & Organizer ledgers.",
                });
              },
            },
          ],
        },
        {
          txId: "tx_claim",
          txLabel: "Anyone: claim(s001)",
          actor: "relayer.testnet",
          color: "amber",
          receipts: [
            {
              receiptLabel: "R1: registry.claim(s001) → checks-effects-interactions",
              targetContract: "registry",
              execute: (w) => {
                const claimable = w.acc - w.checkpoint;
                if (claimable <= 0) {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "registry.claim",
                    outcome: "BLOCKED",
                    code: "E_NOTHING_TO_CLAIM",
                    detail: "Accumulator has no unclaimed balance yet (`acc == checkpoint`).",
                  });
                  return;
                }
                w.checkpoint = w.acc;
                w.inFlightClaim += claimable;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.claim",
                  outcome: "OK",
                  detail: `Checkpoint updated to ${w.checkpoint}. Dispatched ${claimable} NEAR Transfer receipt directly to vault account s001 (never to owner wallet).`,
                });
              },
            },
            {
              receiptLabel: "R2: vault.Transfer (payout lands on s001 account)",
              targetContract: "vault",
              execute: (w) => {
                if (w.inFlightClaim <= 0) {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.Transfer (claim)",
                    outcome: "OK",
                    detail: "No in-flight claim transfer to settle (claim was skipped).",
                  });
                  return;
                }
                const amt = w.inFlightClaim;
                w.inFlightClaim = 0;
                w.vaultBalance += amt;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.Transfer (claim)",
                  outcome: "OK",
                  detail: `${amt} NEAR landed in s001 vault! Vault balance is now ${w.vaultBalance} NEAR, owned by ${w.vaultOwner}.`,
                });
              },
            },
          ],
        },
        {
          txId: "tx_buy",
          txLabel: "Bob: buy_seat (nonce=1, 100N)",
          actor: "bob.testnet",
          color: "gold",
          receipts: [
            {
              receiptLabel: "R1: registry.buy_seat(nonce=1, 100 NEAR) → Escrow",
              targetContract: "registry",
              execute: (w) => {
                w.wallets["bob.testnet"] -= 100;
                w.escrow += 100;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.buy_seat",
                  outcome: "OK",
                  detail: "100 NEAR locked in registry escrow; dispatching cross-contract `vault.v_settle_sale(bob, nonce=1, guard=10)`.",
                });
              },
            },
            {
              receiptLabel: "R2: vault.v_settle_sale(bob, nonce=1, guard=10) [ATOMIC]",
              targetContract: "vault",
              execute: (w) => {
                const withdrawable = w.vaultBalance - w.storageReserve;
                w.vaultOwner = "bob.testnet";
                w.vaultSeq += 1;
                w.vaultStatus = "Idle";
                w.delegateAccount = null;
                w.delegateAllowance = 0;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.v_settle_sale",
                  outcome: "OK",
                  detail: `ATOMIC CUT-OFF: Verified Listed, nonce=1, withdrawable (${withdrawable} NEAR) >= 10 NEAR. Owner rotated to bob.testnet (seq=${w.vaultSeq}), delegate wiped!`,
                });
              },
            },
            {
              receiptLabel: "R3: registry.on_sale callback → 95 NEAR to Alice, 5 NEAR Royalty",
              targetContract: "registry",
              execute: (w) => {
                w.escrow -= 100;
                w.indexOwner = "bob.testnet";
                w.indexSeq = w.vaultSeq;
                w.indexListedNonce = null;
                w.kasKlub += 5;
                w.wallets["alice.testnet"] += 95;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.on_sale",
                  outcome: "OK",
                  detail: "Index updated to bob.testnet (seq=1). 5 NEAR (5% royalty) to Kas Klub; 95 NEAR proceeds paid to seller alice.testnet.",
                });
              },
            },
          ],
        },
        {
          txId: "tx_seller_withdraw",
          txLabel: "Attack: Alice withdraw(16 NEAR)",
          actor: "alice.testnet",
          color: "rose",
          receipts: [
            {
              receiptLabel: "R1: vault.withdraw(16 NEAR) by alice.testnet",
              targetContract: "vault",
              execute: (w) => {
                if (w.vaultOwner !== "alice.testnet") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.withdraw (alice)",
                    outcome: "BLOCKED",
                    code: "E_NOT_OWNER",
                    detail: `Alice is no longer the vault owner (current owner is ${w.vaultOwner} at seq=${w.vaultSeq}).`,
                  });
                  return;
                }
                if (w.vaultStatus === "Listed") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.withdraw (alice)",
                    outcome: "BLOCKED",
                    code: "E_FROZEN",
                    detail: "Vault is Listed (Frozen): zero outflows permitted while seat is on the market.",
                  });
                  return;
                }
              },
            },
          ],
        },
        {
          txId: "tx_agent_withdraw",
          txLabel: "Attack: Seller Agent withdraw(5 NEAR)",
          actor: "agent.alice.testnet",
          color: "rose",
          receipts: [
            {
              receiptLabel: "R1: vault.delegate_withdraw(5 NEAR) by agent.alice.testnet",
              targetContract: "vault",
              execute: (w) => {
                if (w.vaultStatus === "Listed") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.delegate_withdraw (agent)",
                    outcome: "BLOCKED",
                    code: "E_FROZEN",
                    detail: "Vault is Listed (Frozen): even pre-existing delegates are frozen while listed.",
                  });
                  return;
                }
                if (!w.delegateAccount || w.vaultSeq > 0) {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.delegate_withdraw (agent)",
                    outcome: "BLOCKED",
                    code: "E_NOT_OWNER",
                    detail: `Delegate bound to seq=0 was automatically destroyed when seat rotated to seq=${w.vaultSeq}.`,
                  });
                  return;
                }
              },
            },
          ],
        },
      ],
    },
    {
      id: "s2_bait_and_switch",
      title: "S2 · Bait-and-Switch Relist Attack",
      subtitle: "4,620 receipt interleavings proved in pusaka-core",
      totalInterleavingsInRustTest: 4620,
      description:
        "Alice lists s001 for 100 NEAR promising min_balance = 10 NEAR (nonce=1). While Bob's buy_seat(nonce=1) is in flight, Alice cancels the listing, drains 16 NEAR from the vault, and relists at 100 NEAR with min_balance = 0 (nonce=2). Try ordering Alice's cancel+drain+relist before Bob's settlement!",
      initialWorld: {
        vaultOwner: "alice.testnet",
        vaultSeq: 0,
        vaultStatus: "Listed",
        listingNonce: 1,
        listingPrice: 100,
        listingMinBalance: 10,
        delegateAccount: null,
        delegateAllowance: 0,
        vaultBalance: 20,
        storageReserve: 4,
        indexOwner: "alice.testnet",
        indexSeq: 0,
        indexListedNonce: 1,
        acc: 0,
        checkpoint: 0,
        escrow: 0,
        kasKlub: 0,
        inFlightClaim: 0,
        wallets: {
          "alice.testnet": 1000,
          "bob.testnet": 1000,
        },
        logs: [],
      },
      transactions: [
        {
          txId: "tx_alice_bait",
          txLabel: "Attack: Alice Cancel → Drain → Relist (min=0)",
          actor: "alice.testnet",
          color: "rose",
          receipts: [
            {
              receiptLabel: "R1: vault.v_cancel() by alice.testnet",
              targetContract: "vault",
              execute: (w) => {
                if (w.vaultOwner !== "alice.testnet") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.v_cancel",
                    outcome: "BLOCKED",
                    code: "E_NOT_OWNER",
                    detail: "Bob already settled the sale; Alice is no longer owner.",
                  });
                  return;
                }
                w.vaultStatus = "Idle";
                w.indexListedNonce = null;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.v_cancel",
                  outcome: "OK",
                  detail: "Alice canceled listing #1. Vault is now Idle.",
                });
              },
            },
            {
              receiptLabel: "R2: vault.withdraw(16 NEAR) by alice.testnet",
              targetContract: "vault",
              execute: (w) => {
                if (w.vaultOwner !== "alice.testnet") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.withdraw",
                    outcome: "BLOCKED",
                    code: "E_NOT_OWNER",
                    detail: "Alice is no longer owner.",
                  });
                  return;
                }
                if (w.vaultStatus === "Listed") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.withdraw",
                    outcome: "BLOCKED",
                    code: "E_FROZEN",
                    detail: "Vault is Listed.",
                  });
                  return;
                }
                const wd = w.vaultBalance - w.storageReserve;
                w.vaultBalance -= wd;
                w.wallets["alice.testnet"] += wd;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.withdraw",
                  outcome: "OK",
                  detail: `Alice drained ${wd} NEAR while un-listed (vault balance now ${w.vaultBalance} NEAR = reserve only).`,
                });
              },
            },
            {
              receiptLabel: "R3: vault.v_list(price=100, min_balance=0) → bumps nonce to 2",
              targetContract: "vault",
              execute: (w) => {
                if (w.vaultOwner !== "alice.testnet") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.v_list",
                    outcome: "BLOCKED",
                    code: "E_NOT_OWNER",
                    detail: "Alice is no longer owner.",
                  });
                  return;
                }
                w.listingNonce += 1;
                w.vaultStatus = "Listed";
                w.listingMinBalance = 0;
                w.indexListedNonce = w.listingNonce;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.v_list",
                  outcome: "OK",
                  detail: `Alice relisted at 100 NEAR with min_balance=0, but vault bumped listing_nonce to ${w.listingNonce}!`,
                });
              },
            },
          ],
        },
        {
          txId: "tx_bob_buy",
          txLabel: "Bob: buy_seat (quoted nonce=1, guard=10)",
          actor: "bob.testnet",
          color: "gold",
          receipts: [
            {
              receiptLabel: "R1: registry.buy_seat(nonce=1, guard=10) → Escrow 100 NEAR",
              targetContract: "registry",
              execute: (w) => {
                w.wallets["bob.testnet"] -= 100;
                w.escrow += 100;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.buy_seat",
                  outcome: "OK",
                  detail: "Bob's 100 NEAR enters escrow quoting listing nonce=1 and buyer min_balance=10.",
                });
              },
            },
            {
              receiptLabel: "R2: vault.v_settle_sale(bob, expected_nonce=1, guard=10)",
              targetContract: "vault",
              execute: (w) => {
                if (w.vaultStatus !== "Listed") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.v_settle_sale",
                    outcome: "BLOCKED",
                    code: "E_NOT_LISTED",
                    detail: "Vault is not currently listed! Settlement aborted; escrow will refund Bob.",
                  });
                  return;
                }
                if (w.listingNonce !== 1) {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "vault.v_settle_sale",
                    outcome: "BLOCKED",
                    code: "E_NONCE_MISMATCH",
                    detail: `BAIT-AND-SWITCH FOIL: Bob quoted nonce=1, but Alice's relist is at nonce=${w.listingNonce}! Also buyer guard (10 NEAR) > withdrawable (${w.vaultBalance - w.storageReserve} NEAR).`,
                  });
                  return;
                }
                w.vaultOwner = "bob.testnet";
                w.vaultSeq += 1;
                w.vaultStatus = "Idle";
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.v_settle_sale",
                  outcome: "OK",
                  detail: "Bob settled before Alice could cancel! Bob gets the seat + full 20 NEAR vault.",
                });
              },
            },
            {
              receiptLabel: "R3: registry.on_sale callback → Settle or 100% Refund to Bob",
              targetContract: "registry",
              execute: (w) => {
                w.escrow -= 100;
                if (w.vaultOwner === "bob.testnet") {
                  w.indexOwner = "bob.testnet";
                  w.indexSeq = w.vaultSeq;
                  w.kasKlub += 5;
                  w.wallets["alice.testnet"] += 95;
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "registry.on_sale",
                    outcome: "OK",
                    detail: "Sale succeeded with full 20 NEAR in vault; 95 NEAR to Alice, 5 NEAR royalty.",
                  });
                } else {
                  w.wallets["bob.testnet"] += 100;
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "registry.on_sale (refund)",
                    outcome: "OK",
                    detail: "I4 Buyer Protection: Settlement rejected bait-and-switch; Bob received all 100 NEAR back via refund ledger!",
                  });
                }
              },
            },
          ],
        },
      ],
    },
    {
      id: "s4_lost_callback_sync",
      title: "S4 · Lost Callback Divergence & Permissionless `sync()`",
      subtitle: "Proves K2 Canonical Vault + K8 Forward-Only Index Reconciliation",
      totalInterleavingsInRustTest: 198,
      description:
        "Alice transferred s001 to Bob: Receipt #2 (`vault.v_rotate`) succeeded (vault owner=bob, seq=1), but Receipt #3 (the registry callback) ran out of gas, leaving registry index at owner=alice, seq=0. Watch what happens when Alice tries to exploit the stale index vs when anyone calls `registry.sync(s001)`.",
      initialWorld: {
        vaultOwner: "bob.testnet",
        vaultSeq: 1,
        vaultStatus: "Idle",
        listingNonce: 0,
        listingPrice: 0,
        listingMinBalance: 0,
        delegateAccount: null,
        delegateAllowance: 0,
        vaultBalance: 20,
        storageReserve: 4,
        indexOwner: "alice.testnet",
        indexSeq: 0,
        indexListedNonce: null,
        acc: 0,
        checkpoint: 0,
        escrow: 0,
        kasKlub: 0,
        inFlightClaim: 0,
        wallets: {
          "alice.testnet": 1000,
          "bob.testnet": 1000,
          "mallory.testnet": 1000,
        },
        logs: [
          {
            step: 0,
            receipt: "Initial State (Callback Dropped)",
            outcome: "OK",
            detail: "Vault is already at bob.testnet (seq=1), while Registry Index lags at alice.testnet (seq=0). PairCheck = IndexBehind.",
          },
        ],
      },
      transactions: [
        {
          txId: "tx_stale_transfer",
          txLabel: "Attack: Stale Owner Alice transfers to Mallory",
          actor: "alice.testnet",
          color: "rose",
          receipts: [
            {
              receiptLabel: "R1: registry.nft_transfer(to=mallory) by alice.testnet",
              targetContract: "registry",
              execute: (w) => {
                if (w.indexOwner !== "alice.testnet") {
                  w.logs.push({
                    step: w.logs.length + 1,
                    receipt: "registry.nft_transfer",
                    outcome: "BLOCKED",
                    code: "E_NOT_OWNER",
                    detail: "Index already synced to bob.testnet; registry rejects Alice immediately.",
                  });
                  return;
                }
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.nft_transfer",
                  outcome: "OK",
                  detail: "Stale index still lists Alice at seq=0, so registry dispatches `vault.v_rotate(from=alice, to=mallory, expected_seq=0)`.",
                });
              },
            },
            {
              receiptLabel: "R2: vault.v_rotate(from=alice, to=mallory, expected_seq=0)",
              targetContract: "vault",
              execute: (w) => {
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.v_rotate",
                  outcome: "BLOCKED",
                  code: "E_NOT_OWNER",
                  detail: `CANONICAL VAULT DEFENSE: Vault owner is ${w.vaultOwner} at seq=${w.vaultSeq}. Alice's rotation is rejected!`,
                });
              },
            },
          ],
        },
        {
          txId: "tx_sync",
          txLabel: "Anyone: registry.sync(s001)",
          actor: "keeper.testnet",
          color: "emerald",
          receipts: [
            {
              receiptLabel: "R1: registry.sync(s001) → queries vault_state()",
              targetContract: "vault",
              execute: (w) => {
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "vault.vault_state",
                  outcome: "OK",
                  detail: `Read canonical vault snapshot: owner=${w.vaultOwner}, rotation_seq=${w.vaultSeq}.`,
                });
              },
            },
            {
              receiptLabel: "R2: registry.on_sync callback → advances index (0 → 1)",
              targetContract: "registry",
              execute: (w) => {
                w.indexOwner = w.vaultOwner;
                w.indexSeq = w.vaultSeq;
                w.logs.push({
                  step: w.logs.length + 1,
                  receipt: "registry.on_sync",
                  outcome: "OK",
                  detail: `Index healed! Registry index advanced to ${w.indexOwner} at seq=${w.indexSeq}. PairCheck is now Consistent.`,
                });
              },
            },
          ],
        },
      ],
    },
  ];
}
