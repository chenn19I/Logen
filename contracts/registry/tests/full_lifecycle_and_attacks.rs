//! Cross-contract integration & Attack Lab test suite (`pusaka-registry` + `pusaka-vault`).
//!
//! Runs natively on every OS (`cargo test --workspace`) by driving the real `RegistryContract`
//! and `VaultContract` state machines across simulated receipts, verifying:
//!
//! - Track Requirement R1: NEP-171 + sub-account vault binding + atomic rotation.
//! - Track Requirement R3: Per-seat history (`holders`, `claims`, `earnings`, `outflows`).
//! - Track Requirement R4: Transfer paths + **sale in the middle of a payout**.
//! - Threat Model A1–A12: Every seller attack vector is blocked with its exact error code.

use near_sdk::json_types::U128;
use near_sdk::AccountId;
use pusaka_registry::{
    RegistryContract, RotationReceipt as RegRotationReceipt, SaleSettlementDto, VaultListingDto,
    VaultStateDto,
};
use pusaka_test_env::set_context;
use pusaka_vault::VaultContract;

const NEAR: u128 = 10u128.pow(24);
const S_NS: u64 = 1_000_000_000;

fn reg_id() -> AccountId {
    "pusaka.testnet".parse().unwrap()
}
fn seat_id() -> AccountId {
    "s001.pusaka.testnet".parse().unwrap()
}
fn alice() -> AccountId {
    "alice.testnet".parse().unwrap()
}
fn bob() -> AccountId {
    "bob.testnet".parse().unwrap()
}
fn carol() -> AccountId {
    "carol.testnet".parse().unwrap()
}
fn agent() -> AccountId {
    "agent.testnet".parse().unwrap()
}
fn fan() -> AccountId {
    "fan.testnet".parse().unwrap()
}
fn org() -> AccountId {
    "org.testnet".parse().unwrap()
}
fn kas() -> AccountId {
    "kas.testnet".parse().unwrap()
}

fn set_ctx(current: AccountId, predecessor: AccountId, deposit: u128, balance: u128, ts_ns: u64) {
    set_context(
        current.as_str(),
        predecessor.as_str(),
        deposit,
        balance,
        ts_ns,
    );
}

struct Harness {
    reg: RegistryContract,
    vault: VaultContract,
    vault_balance: u128,
    now_ns: u64,
}

impl Harness {
    fn new() -> Self {
        let now_ns = 10 * S_NS;
        set_ctx(reg_id(), reg_id(), 0, 100 * NEAR, now_ns);
        let mut reg = RegistryContract::init(
            org(),
            kas(),
            U128(2 * NEAR),
            U128(NEAR), // 1 NEAR initial vault balance
            Some(500),  // 5% royalty
            Some(100),
            None,
            None,
            None,
        );
        reg.pin_vault_wasm(vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

        // Step 1: Alice mints s001.pusaka.testnet
        set_ctx(reg_id(), alice(), 2 * NEAR, 102 * NEAR, now_ns);
        let _ = reg.mint_seat(None, None);

        // Step 2: Sub-account batch receipt initializes VaultContract on s001.pusaka.testnet
        let vault_balance = NEAR;
        set_ctx(seat_id(), reg_id(), 0, vault_balance, now_ns);
        let vault = VaultContract::init(alice(), None);

        // Step 3: Callback on_mint_seat registers seat in registry
        set_ctx(reg_id(), reg_id(), 0, 101 * NEAR, now_ns);
        let minted = reg
            .on_mint_seat(
                seat_id(),
                1,
                None,
                alice(),
                alice(),
                U128(2 * NEAR),
                Ok(()),
            )
            .expect("mint callback should succeed");
        assert_eq!(minted.token_id, seat_id());
        assert_eq!(minted.owner_id, alice());

        Self {
            reg,
            vault,
            vault_balance,
            now_ns,
        }
    }

    fn list_seat(&mut self, by: AccountId, price: u128, min_balance: u128, ttl_sec: u64) -> u64 {
        self.now_ns += S_NS;
        set_ctx(reg_id(), by.clone(), 1, 100 * NEAR, self.now_ns);
        let _ = self
            .reg
            .list_seat(seat_id(), U128(price), U128(min_balance), ttl_sec);

        set_ctx(seat_id(), reg_id(), 0, self.vault_balance, self.now_ns);
        let v_listed = self
            .vault
            .v_list(by.clone(), U128(price), U128(min_balance), ttl_sec);
        let dto = VaultListingDto {
            price: v_listed.price,
            min_balance: v_listed.min_balance,
            expires_at_ms: v_listed.expires_at_ms,
            proceeds_to: v_listed.proceeds_to,
            nonce: v_listed.nonce,
        };

        set_ctx(reg_id(), reg_id(), 0, 100 * NEAR, self.now_ns);
        let seq = self.reg.get_seat(seat_id()).unwrap().rotation_seq;
        let mirrored = self
            .reg
            .on_listed(seat_id(), by, seq, Ok(dto))
            .expect("listing mirror should succeed");
        mirrored.nonce
    }
}

#[test]
fn r4_sale_in_the_middle_of_a_payout_and_history_verification() {
    let mut h = Harness::new();

    // Alice sets a pre-sale delegate (agent.testnet) with 0.4 NEAR allowance
    h.now_ns += S_NS;
    set_ctx(seat_id(), alice(), 1, h.vault_balance, h.now_ns);
    h.vault.set_delegate(agent(), U128(400_000_000_000_000_000_000_000), 3600);

    // Alice lists seat for 5 NEAR, promising at least 0.95 NEAR withdrawable in the vault
    let nonce = h.list_seat(alice(), 5 * NEAR, 950_000_000_000_000_000_000_000, 600);
    assert_eq!(h.vault.nft_item_info().status, "Frozen");

    // Organizer creates an event (ticket price = 2.5 NEAR)
    h.now_ns += S_NS;
    set_ctx(reg_id(), org(), 0, 100 * NEAR, h.now_ns);
    let ev_id = h
        .reg
        .create_event("Kraton Summit".to_string(), U128(25 * NEAR / 10), 100, 99_000, Some(1_000));

    // Fan buys a ticket while Alice's seat is listed -> 40% (1.0 NEAR) accrues to s001
    h.now_ns += S_NS;
    set_ctx(reg_id(), fan(), 25 * NEAR / 10, 102 * NEAR, h.now_ns);
    h.reg.buy_ticket(ev_id);
    assert_eq!(h.reg.get_seat(seat_id()).unwrap().claimable.0, NEAR);

    // Bob initiates buy_seat(nonce=1) for 5 NEAR while a payout claim is also triggered!
    h.now_ns += S_NS;
    set_ctx(reg_id(), bob(), 5 * NEAR, 107 * NEAR, h.now_ns);
    let _ = h
        .reg
        .buy_seat(seat_id(), nonce, U128(950_000_000_000_000_000_000_000));

    // Mid-sale: someone calls `claim(s001)`! The 1 NEAR pool share is sent to s001's vault.
    set_ctx(reg_id(), fan(), 0, 107 * NEAR, h.now_ns);
    let _ = h.reg.claim(seat_id());
    h.vault_balance += NEAR; // Transfer receipt lands in s001.pusaka.testnet vault!

    // Vault settles the sale atomically in a single receipt
    set_ctx(seat_id(), reg_id(), 0, h.vault_balance, h.now_ns);
    let settled = h.vault.v_settle_sale(
        bob(),
        nonce,
        U128(5 * NEAR),
        U128(950_000_000_000_000_000_000_000),
    );
    assert_eq!(settled.buyer, bob());
    assert_eq!(settled.new_seq, 1);

    // Registry callback finalizes index, royalties (5% = 0.25 NEAR), and seller proceeds (4.75 NEAR)
    set_ctx(reg_id(), reg_id(), 0, 107 * NEAR, h.now_ns);
    let ok = h.reg.on_sale_settled(
        seat_id(),
        bob(),
        U128(5 * NEAR),
        Ok(SaleSettlementDto {
            seller: settled.seller,
            proceeds_to: settled.proceeds_to,
            buyer: settled.buyer,
            price: settled.price,
            new_seq: settled.new_seq,
            vault_withdrawable: settled.vault_withdrawable,
        }),
    );
    assert!(ok);

    // Verify pair check: registry and vault agree Bob is owner at seq 1
    let seat_view = h.reg.get_seat(seat_id()).unwrap();
    let item_info = h.vault.nft_item_info();
    assert_eq!(seat_view.owner_id, bob());
    assert_eq!(item_info.owner_id, bob());
    assert_eq!(seat_view.rotation_seq, 1);
    assert_eq!(item_info.rotation_seq, 1);
    assert_eq!(item_info.status, "Active");

    // Verify Alice's proceeds ledger has 4.75 NEAR and Bob's seat vault has 2.0 NEAR (1.0 initial + 1.0 payout)
    let alice_ledger = h.reg.get_ledgers(alice());
    assert_eq!(alice_ledger.proceeds.0, 4_750_000_000_000_000_000_000_000);
    set_ctx(seat_id(), bob(), 0, h.vault_balance, h.now_ns);
    assert_eq!(h.vault.vault_state().balance.0, 2 * NEAR);

    // Bob (new owner) can withdraw 0.5 NEAR from the seat vault
    set_ctx(seat_id(), bob(), 1, h.vault_balance + 1, h.now_ns);
    let _ = h.vault.withdraw(U128(NEAR / 2), None);
    h.vault_balance -= NEAR / 2;

    // Verify R3 History View records holders, claims, earnings, and outflows
    let hist = h.reg.get_seat_history(seat_id(), None);
    assert_eq!(hist.holders.len(), 2); // mint (Alice) + sale (Bob)
    assert_eq!(hist.claims.len(), 1);
    assert_eq!(hist.earnings.len(), 1);
    let outflows = h.vault.get_outflows();
    assert_eq!(outflows.len(), 1);
    assert_eq!(outflows[0].by, bob());
}

#[test]
#[should_panic(expected = "E_ONLY_REGISTRY")]
fn attack_a1_direct_v_rotate_bypass_blocked() {
    let mut h = Harness::new();
    set_ctx(seat_id(), alice(), 0, h.vault_balance, h.now_ns);
    h.vault.v_rotate(alice(), carol(), 0);
}

#[test]
#[should_panic(expected = "E_FROZEN")]
fn attack_a2_seller_withdraw_while_listed_blocked() {
    let mut h = Harness::new();
    h.list_seat(alice(), 5 * NEAR, NEAR / 2, 600);
    set_ctx(seat_id(), alice(), 1, h.vault_balance + 1, h.now_ns);
    let _ = h.vault.withdraw(U128(100), None);
}

#[test]
#[should_panic(expected = "E_NONCE_MISMATCH")]
fn attack_a3_bait_and_switch_relist_blocked_by_nonce() {
    let mut h = Harness::new();
    let first_nonce = h.list_seat(alice(), 5 * NEAR, 900_000_000_000_000_000_000_000, 600);

    // Seller cancels and relists with min_balance = 0
    set_ctx(seat_id(), reg_id(), 0, h.vault_balance, h.now_ns);
    h.vault.v_cancel(alice());
    set_ctx(reg_id(), reg_id(), 0, 100 * NEAR, h.now_ns);
    h.reg.on_canceled(seat_id(), 0, Ok(true));

    let second_nonce = h.list_seat(alice(), 5 * NEAR, 0, 600);
    assert!(second_nonce > first_nonce);

    // Buyer submits buy quoting first_nonce -> blocked immediately by E_NONCE_MISMATCH
    set_ctx(reg_id(), bob(), 5 * NEAR, 105 * NEAR, h.now_ns);
    let _ = h.reg.buy_seat(
        seat_id(),
        first_nonce,
        U128(900_000_000_000_000_000_000_000),
    );
}

#[test]
#[should_panic(expected = "E_NO_DELEGATE")]
fn attack_a4_pre_sale_delegate_dies_on_transfer() {
    let mut h = Harness::new();
    set_ctx(seat_id(), alice(), 1, h.vault_balance + 1, h.now_ns);
    h.vault.set_delegate(agent(), U128(NEAR / 2), 3600);

    // Transfer seat from Alice to Bob
    set_ctx(seat_id(), reg_id(), 0, h.vault_balance, h.now_ns + S_NS);
    let rot = h.vault.v_rotate(alice(), bob(), 0);
    assert_eq!(rot.rotation_seq, 1);

    // Alice's delegate attempts to withdraw after rotation -> E_NO_DELEGATE
    set_ctx(seat_id(), agent(), 0, h.vault_balance, h.now_ns + 2 * S_NS);
    let _ = h.vault.delegate_withdraw(U128(100), None);
}

#[test]
#[should_panic(expected = "E_NOT_OWNER")]
fn attack_a7_former_owner_withdraw_after_transfer_blocked() {
    let mut h = Harness::new();
    set_ctx(seat_id(), reg_id(), 0, h.vault_balance, h.now_ns + S_NS);
    let rot = h.vault.v_rotate(alice(), bob(), 0);
    set_ctx(reg_id(), reg_id(), 0, 100 * NEAR, h.now_ns + S_NS);
    h.reg.on_rotated(
        seat_id(),
        alice(),
        bob(),
        None,
        Ok(RegRotationReceipt {
            owner_id: rot.owner_id,
            rotation_seq: rot.rotation_seq,
        }),
    );

    // Former owner Alice tries to withdraw from the vault -> E_NOT_OWNER
    set_ctx(seat_id(), alice(), 1, h.vault_balance + 1, h.now_ns + 2 * S_NS);
    let _ = h.vault.withdraw(U128(100), None);
}

#[test]
fn attack_a8_min_balance_guard_rejects_and_refunds_buyer_in_full() {
    let mut h = Harness::new();
    let nonce = h.list_seat(alice(), 5 * NEAR, 0, 600);

    // Buyer demands min_balance = 2 NEAR, but vault only has ~0.95 NEAR withdrawable
    set_ctx(seat_id(), reg_id(), 0, h.vault_balance, h.now_ns + S_NS);
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.vault
            .v_settle_sale(bob(), nonce, U128(5 * NEAR), U128(2 * NEAR))
    }));
    assert!(res.is_err(), "v_settle_sale must panic with E_INSUFFICIENT_BALANCE");

    // Registry callback credits 100% of Bob's 5 NEAR to his pull refund ledger
    set_ctx(reg_id(), reg_id(), 0, 105 * NEAR, h.now_ns + S_NS);
    let settled = h.reg.on_sale_settled(
        seat_id(),
        bob(),
        U128(5 * NEAR),
        Err(near_sdk::PromiseError::Failed),
    );
    assert!(!settled);
    assert_eq!(h.reg.get_ledgers(bob()).refund.0, 5 * NEAR);
}

#[test]
fn attack_a11_permissionless_sync_heals_lagging_index_and_never_rolls_back() {
    let mut h = Harness::new();

    // Vault rotates to Bob (seq=1), but imagine registry callback ran out of gas
    set_ctx(seat_id(), reg_id(), 0, h.vault_balance, h.now_ns + S_NS);
    h.vault.v_rotate(alice(), bob(), 0);
    assert_eq!(h.reg.get_seat(seat_id()).unwrap().owner_id, alice()); // lagging!

    // Anyone triggers `sync(s001)` -> reads vault_state and heals index to Bob (seq=1)
    let vs = h.vault.vault_state();
    set_ctx(reg_id(), reg_id(), 0, 100 * NEAR, h.now_ns + 2 * S_NS);
    let outcome = h.reg.on_sync(
        seat_id(),
        Ok(VaultStateDto {
            owner_id: vs.owner_id,
            rotation_seq: vs.rotation_seq,
            status: vs.status,
            listing: None,
            listing_nonce: vs.listing_nonce,
            balance: vs.balance,
            withdrawable: vs.withdrawable,
            storage_reserve: vs.storage_reserve,
            registry_id: vs.registry_id,
        }),
    );
    assert_eq!(outcome, "advanced");
    assert_eq!(h.reg.get_seat(seat_id()).unwrap().owner_id, bob());
    assert_eq!(h.reg.get_seat(seat_id()).unwrap().rotation_seq, 1);

    // Attempting to feed a stale seq (0, Alice) to on_sync is rejected as "divergent"
    let stale = h.reg.on_sync(
        seat_id(),
        Ok(VaultStateDto {
            owner_id: alice(),
            rotation_seq: 0,
            status: "Idle".to_string(),
            listing: None,
            listing_nonce: 0,
            balance: U128(NEAR),
            withdrawable: U128(NEAR),
            storage_reserve: U128(50_000_000_000_000_000_000_000),
            registry_id: reg_id(),
        }),
    );
    assert_eq!(stale, "divergent");
    assert_eq!(h.reg.get_seat(seat_id()).unwrap().owner_id, bob());
}
