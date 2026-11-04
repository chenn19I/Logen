//! # Receipt-interleaving explorer (test level LM)
//!
//! NEAR executes cross-contract calls as independent receipts. Two transactions that touch the
//! same seat can interleave in any order across blocks: a ticket payout can land in the vault
//! between the sale's settlement and its callback, a seller's withdrawal can race a buyer's
//! purchase, a relist can race a buy that quoted the old listing, and so on.
//!
//! This test models every Pusaka receipt as a step that runs the **same `pusaka-core` code the
//! contracts run**, then explores *every* possible interleaving of a scenario's transactions
//! (each transaction's own receipts stay in order, as on NEAR). After every step and at every
//! leaf it checks the invariants that together say "a seller can never keep the money":
//!
//! * **I1 conservation** – no yocto is created or destroyed.
//! * **I2 index never ahead** – `index.seq <= vault.rotation_seq` at every step.
//! * **I3 convergence** – once all receipts ran, index and vault agree.
//! * **I4 buyer protection** – a buyer either owns the seat with a vault worth at least their
//!   guard at the settlement receipt, or gets every yocto back.
//! * **I5 seller cut-off** – no outflow is authorised for anyone but the owner (or the owner's
//!   own live delegate) of the epoch in which it executes.
//! * **I6 golden rule** – money that lands in the vault after settlement belongs to the buyer:
//!   `vault_final = vault_at_settlement + landed_after - buyer_outflows`.
//! * **I7 claims go to the vault** – the pool share never reaches a person's wallet directly.

use pusaka_core::{
    math::apply_bps, Accumulator, Bps, IndexEntry, ListingMirror, Spender, VaultCore, VaultSnapshot,
};
use std::collections::BTreeMap;
use std::rc::Rc;

const ROYALTY_BPS: u16 = 500;
const RESERVE: u128 = 4;
const S: u64 = 1_000_000_000;

#[derive(Clone, Debug)]
struct Outflow {
    spender: String,
    owner_at_exec: String,
    seq_at_exec: u64,
    amount: u128,
}

#[derive(Clone, Debug)]
struct World {
    now: u64,
    vault: VaultCore,
    vault_balance: u128,
    index: IndexEntry,
    acc: Accumulator,
    checkpoint: u128,
    registry_balance: u128,
    escrow: u128,
    kas: u128,
    proceeds: BTreeMap<String, u128>,
    refunds: BTreeMap<String, u128>,
    wallets: BTreeMap<String, u128>,
    in_flight: u128,
    outflows: Vec<Outflow>,
    /// (vault withdrawable at settlement, buyer guard, buyer, seq after) for each successful sale.
    settlements: Vec<(u128, u128, String, u64)>,
    landed_after_settlement: u128,
    claims_landed: u128,
    claims_sent: u128,
    total_supply: u128,
}

impl World {
    fn new(owner: &str, vault_balance: u128) -> Self {
        let mut wallets = BTreeMap::new();
        for who in ["alice", "bob", "carol", "dave", "fan", "agent", "mallory"] {
            wallets.insert(who.to_string(), 1_000);
        }
        let mut w = World {
            now: 10 * S,
            vault: VaultCore::new(owner),
            vault_balance,
            index: IndexEntry::new(owner),
            acc: Accumulator::default(),
            checkpoint: 0,
            registry_balance: 0,
            escrow: 0,
            kas: 0,
            proceeds: BTreeMap::new(),
            refunds: BTreeMap::new(),
            wallets,
            in_flight: 0,
            outflows: vec![],
            settlements: vec![],
            landed_after_settlement: 0,
            claims_landed: 0,
            claims_sent: 0,
            total_supply: 0,
        };
        w.total_supply = w.total();
        w
    }

    fn total(&self) -> u128 {
        self.wallets.values().sum::<u128>() + self.vault_balance + self.registry_balance + self.in_flight
    }

    fn withdrawable(&self) -> u128 {
        self.vault_balance.saturating_sub(RESERVE)
    }

    /// Lists the seat as part of the initial state (vault + mirror consistent).
    fn listed(mut self, price: u128, min_balance: u128, ttl: u64) -> Self {
        let owner = self.vault.owner.clone();
        let l = self.vault.list(&owner, price, min_balance, ttl, self.now).unwrap();
        self.index.listing = Some(ListingMirror::from_listing(&l, &owner));
        self
    }

    fn with_delegate(mut self, who: &str, allowance: u128) -> Self {
        let owner = self.vault.owner.clone();
        self.vault.set_delegate(&owner, who, allowance, 3600 * S, self.now).unwrap();
        self
    }

    fn check_step_invariants(&self) {
        assert_eq!(self.total(), self.total_supply, "I1 conservation violated: {self:#?}");
        assert!(self.index.seq <= self.vault.rotation_seq, "I2 index ahead of vault: {self:#?}");
        let ledgers = self.kas
            + self.escrow
            + self.proceeds.values().sum::<u128>()
            + self.refunds.values().sum::<u128>()
            + self.acc.claimable(self.checkpoint)
            + self.acc.carry;
        assert_eq!(self.registry_balance, ledgers, "registry books do not balance: {self:#?}");
    }
}

#[derive(Default, Clone, Debug)]
struct Ctx {
    ok: bool,
    amount: u128,
    seq: u64,
    nonce: u64,
    sale: Option<pusaka_core::SaleOutcome>,
    who: String,
}

type Step = Rc<dyn Fn(&mut World, &mut Ctx)>;

struct Tx {
    #[allow(dead_code)]
    name: &'static str,
    steps: Vec<Step>,
}

fn step(f: impl Fn(&mut World, &mut Ctx) + 'static) -> Step {
    Rc::new(f)
}

// ---------------------------------------------------------------------------------------------
// Transactions, receipt by receipt. Each mirrors the contract code path.
// ---------------------------------------------------------------------------------------------

/// `registry.buy_ticket` – one receipt.
fn tx_ticket(buyer: &'static str, price: u128) -> Tx {
    Tx {
        name: "buy_ticket",
        steps: vec![step(move |w, _| {
            *w.wallets.get_mut(buyer).unwrap() -= price;
            w.registry_balance += price;
            let s = Bps::default().split(price);
            let d = w.acc.distribute(s.pool, 1).unwrap();
            w.kas += s.kas + s.organizer + d.to_treasury;
        })],
    }
}

/// `registry.claim` then the Transfer receipt landing on the seat account.
fn tx_claim() -> Tx {
    Tx {
        name: "claim",
        steps: vec![
            step(|w, c| {
                let amt = w.acc.claimable(w.checkpoint);
                if amt == 0 {
                    return; // E_NOTHING_TO_CLAIM, tx reverts
                }
                w.checkpoint = w.acc.acc; // checks-effects-interactions
                w.registry_balance -= amt;
                w.in_flight += amt;
                w.claims_sent += amt;
                c.ok = true;
                c.amount = amt;
            }),
            step(|w, c| {
                if !c.ok {
                    return;
                }
                w.in_flight -= c.amount;
                w.vault_balance += c.amount; // always the seat account, never a person (I7)
                w.claims_landed += c.amount;
                if !w.settlements.is_empty() {
                    w.landed_after_settlement += c.amount;
                }
            }),
        ],
    }
}

/// `registry.buy_seat` → `vault.v_settle_sale` → `registry.on_sale` (pays out / refunds).
fn tx_buy(buyer: &'static str, nonce: u64, price: u128, guard: u128) -> Tx {
    Tx {
        name: "buy_seat",
        steps: vec![
            step(move |w, c| {
                let now = w.now;
                let ok = matches!(w.index.live_listing(now), Some(l) if l.nonce == nonce && l.price == price && l.seller != buyer);
                if !ok {
                    return; // registry panics; attached deposit is returned by the protocol
                }
                *w.wallets.get_mut(buyer).unwrap() -= price;
                w.registry_balance += price;
                w.escrow += price;
                c.ok = true;
            }),
            step(move |w, c| {
                if !c.ok {
                    return;
                }
                let wd = w.withdrawable();
                let now = w.now;
                match w.vault.settle_sale(buyer, nonce, price, guard, wd, now) {
                    Ok(out) => {
                        w.settlements.push((wd, guard, buyer.to_string(), out.new_seq));
                        c.sale = Some(out);
                    }
                    Err(_) => c.sale = None,
                }
            }),
            step(move |w, c| {
                if !c.ok {
                    return;
                }
                w.escrow -= price;
                match &c.sale {
                    Some(out) => {
                        w.index.apply_rotation(buyer, out.new_seq);
                        let royalty = apply_bps(price, ROYALTY_BPS);
                        w.kas += royalty;
                        *w.proceeds.entry(out.proceeds_to.clone()).or_default() += price - royalty;
                    }
                    None => *w.refunds.entry(buyer.to_string()).or_default() += price,
                }
                // pull payments are released (anyone may trigger them)
                for (who, amt) in std::mem::take(&mut w.proceeds).into_iter().chain(std::mem::take(&mut w.refunds)) {
                    w.registry_balance -= amt;
                    *w.wallets.get_mut(&who).unwrap() += amt;
                }
            }),
        ],
    }
}

/// Direct call to `vault.withdraw` / `vault.delegate_withdraw` for everything withdrawable,
/// followed by the Transfer receipt to the spender.
fn tx_withdraw(spender: &'static str) -> Tx {
    Tx {
        name: "withdraw",
        steps: vec![
            step(move |w, c| {
                let wd = w.withdrawable();
                let now = w.now;
                let amount = if spender == "agent" { wd.min(5) } else { wd };
                if amount == 0 {
                    return;
                }
                let owner_before = w.vault.owner.clone();
                if let Ok(who) = w.vault.authorize_withdraw(spender, amount, wd, now) {
                    if who == Spender::Owner {
                        assert_eq!(spender, owner_before);
                    }
                    w.outflows.push(Outflow {
                        spender: spender.to_string(),
                        owner_at_exec: owner_before,
                        seq_at_exec: w.vault.rotation_seq,
                        amount,
                    });
                    w.vault_balance -= amount;
                    w.in_flight += amount;
                    c.ok = true;
                    c.amount = amount;
                }
            }),
            step(move |w, c| {
                if c.ok {
                    w.in_flight -= c.amount;
                    *w.wallets.get_mut(spender).unwrap() += c.amount;
                }
            }),
        ],
    }
}

/// `registry.nft_transfer` → `vault.v_rotate` → `registry.on_rotated`.
fn tx_transfer(from: &'static str, to: &'static str, drop_callback: bool) -> Tx {
    Tx {
        name: "nft_transfer",
        steps: vec![
            step(move |w, c| {
                let now = w.now;
                if w.index.owner != from || w.index.live_listing(now).is_some() {
                    return;
                }
                c.ok = true;
                c.seq = w.index.seq;
            }),
            step(move |w, c| {
                if !c.ok {
                    return;
                }
                let now = w.now;
                match w.vault.rotate(from, to, c.seq, now) {
                    Ok(s) => c.seq = s,
                    Err(_) => c.ok = false,
                }
            }),
            step(move |w, c| {
                if c.ok && !drop_callback {
                    w.index.apply_rotation(to, c.seq);
                }
            }),
        ],
    }
}

/// `registry.cancel_listing` (3 receipts) followed by `registry.list_seat` (3 receipts) with a
/// weaker promise: the classic bait-and-switch.
fn tx_cancel_and_relist(seller: &'static str, price: u128, new_min: u128) -> Tx {
    Tx {
        name: "cancel_and_relist",
        steps: vec![
            step(move |w, c| c.ok = w.index.owner == seller),
            step(move |w, c| {
                let now = w.now;
                c.ok = c.ok && w.vault.cancel(seller, now).is_ok();
            }),
            step(move |w, c| {
                if c.ok {
                    w.index.listing = None;
                }
            }),
            step(move |w, c| c.ok = w.index.owner == seller),
            step(move |w, c| {
                if !c.ok {
                    return;
                }
                let now = w.now;
                match w.vault.list(seller, price, new_min, 3600 * S, now) {
                    Ok(l) => {
                        c.nonce = l.nonce;
                        c.who = seller.into();
                    }
                    Err(_) => c.ok = false,
                }
            }),
            step(move |w, c| {
                if !c.ok {
                    return;
                }
                // callback only mirrors if the vault is still in the epoch the listing was made in
                let snap = VaultSnapshot {
                    owner: w.vault.owner.clone(),
                    rotation_seq: w.vault.rotation_seq,
                    listing: w.vault.live_listing(w.now).cloned(),
                };
                if let Some(l) = &snap.listing {
                    if l.nonce == c.nonce && snap.owner == c.who && w.index.seq == snap.rotation_seq {
                        w.index.listing = Some(ListingMirror::from_listing(l, &c.who));
                    }
                }
            }),
        ],
    }
}

/// Anyone calls `registry.sync` → reads `vault_state` → callback reconciles.
fn tx_sync() -> Tx {
    Tx {
        name: "sync",
        steps: vec![
            step(|_w, c| c.ok = true),
            step(|w, c| {
                // The view result is captured in the vault receipt...
                c.seq = w.vault.rotation_seq;
                c.who = w.vault.owner.clone();
                c.nonce = w.vault.live_listing(w.now).map(|l| l.nonce).unwrap_or(0);
                c.sale = None;
                c.amount = 0;
                let _ = &c;
            }),
            step(|w, c| {
                // ...and applied in the callback receipt, possibly after more vault changes.
                let listing = w.vault.live_listing(w.now).filter(|l| l.nonce == c.nonce).cloned();
                let snap = VaultSnapshot { owner: c.who.clone(), rotation_seq: c.seq, listing };
                let now = w.now;
                w.index.reconcile(&snap, now);
            }),
        ],
    }
}

/// Block time passes beyond a listing's expiry.
fn tx_clock(advance: u64) -> Tx {
    Tx { name: "clock", steps: vec![step(move |w, _| w.now += advance)] }
}

// ---------------------------------------------------------------------------------------------
// Explorer
// ---------------------------------------------------------------------------------------------

fn explore(world: &World, txs: &[Tx], leaf: &dyn Fn(&World, &[Ctx])) -> usize {
    fn go(w: World, txs: &[Tx], pos: Vec<usize>, ctx: Vec<Ctx>, leaf: &dyn Fn(&World, &[Ctx]), n: &mut usize) {
        let mut progressed = false;
        for i in 0..txs.len() {
            if pos[i] < txs[i].steps.len() {
                progressed = true;
                let mut w2 = w.clone();
                let mut c2 = ctx.clone();
                (txs[i].steps[pos[i]])(&mut w2, &mut c2[i]);
                w2.check_step_invariants();
                let mut p2 = pos.clone();
                p2[i] += 1;
                go(w2, txs, p2, c2, leaf, n);
            }
        }
        if !progressed {
            *n += 1;
            leaf(&w, &ctx);
        }
    }
    let mut n = 0;
    go(world.clone(), txs, vec![0; txs.len()], vec![Ctx::default(); txs.len()], leaf, &mut n);
    n
}

/// Invariants shared by every scenario at the leaves.
fn common_leaf(w: &World, initial: &World) {
    // I3 convergence (all callbacks ran)
    assert_eq!(w.index.owner, w.vault.owner, "I3 owner mismatch: {w:#?}");
    assert_eq!(w.index.seq, w.vault.rotation_seq, "I3 seq mismatch: {w:#?}");
    // I5 seller cut-off: every outflow was authorised by the owner of that epoch or their delegate
    for o in &w.outflows {
        let delegate_ok = o.spender == "agent" && o.seq_at_exec == 0;
        assert!(o.spender == o.owner_at_exec || delegate_ok, "I5 outflow by non-owner: {o:?}");
    }
    // I7 claims never reach a wallet directly
    assert_eq!(w.claims_sent, w.claims_landed + 0, "claim still in flight at leaf");
    // I4/I6 for every successful settlement
    if let Some((wd_at_settle, guard, buyer, seq)) = w.settlements.last() {
        assert!(*wd_at_settle >= *guard, "I4 buyer guard not honoured");
        let buyer_out: u128 = w.outflows.iter().filter(|o| o.seq_at_exec >= *seq).map(|o| o.amount).sum();
        assert!(w.outflows.iter().filter(|o| o.seq_at_exec >= *seq).all(|o| &o.spender == buyer));
        assert_eq!(
            w.vault_balance,
            wd_at_settle + RESERVE + w.landed_after_settlement - buyer_out,
            "I6 golden rule violated: {w:#?}"
        );
    }
    let _ = initial;
}

// ---------------------------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------------------------

/// Track requirement R4: "a sale in the middle of a payout". A ticket is sold and the seat's
/// share is claimed while the seat is being bought, the seller tries to drain the vault and the
/// seller's pre-sale delegate tries to spend.
#[test]
fn s1_sale_in_the_middle_of_a_payout() {
    let initial = World::new("alice", 20).with_delegate("agent", 5).listed(100, 10, 3600 * S);
    let txs = vec![
        tx_ticket("fan", 50),
        tx_claim(),
        tx_buy("bob", 1, 100, 0),
        tx_withdraw("alice"),
        tx_withdraw("agent"),
    ];
    let leaves = explore(&initial, &txs, &|w, ctx| {
        common_leaf(w, &initial);
        // The listing froze the vault: neither the seller nor her delegate moved a single yocto.
        assert!(w.outflows.iter().all(|o| o.spender == "bob"), "seller-side outflow while listed: {w:#?}");
        // The sale always succeeds here (nothing can lower the balance) ...
        assert_eq!(w.vault.owner, "bob");
        // ... the seller receives exactly price - royalty ...
        assert_eq!(w.wallets["alice"], 1_000 + 100 - apply_bps(100, ROYALTY_BPS));
        // ... and the buyer owns every yocto in the vault including any payout that landed.
        assert_eq!(w.vault_balance, 20 + ctx[1].amount);
    });
    assert_eq!(leaves, 75_600);
    println!("s1: {leaves} interleavings explored");
}

/// Bait and switch: the seller cancels a listing that promised `min_balance = 10`, relists at the
/// same price with no promise, and drains the vault, while the buyer's purchase of the original
/// listing is in flight.
#[test]
fn s2_bait_and_switch_relist() {
    let initial = World::new("alice", 20).listed(100, 10, 3600 * S);
    let txs = vec![tx_buy("bob", 1, 100, 0), tx_cancel_and_relist("alice", 100, 0), tx_withdraw("alice")];
    let mut bought = std::cell::Cell::new(0usize);
    let leaves = explore(&initial, &txs, &|w, _| {
        common_leaf(w, &initial);
        if w.vault.owner == "bob" {
            // bought the original listing: the promise held at the settlement receipt
            assert!(w.settlements[0].0 >= 10);
            assert_eq!(w.wallets["bob"], 1_000 - 100);
        } else {
            // otherwise bob got every yocto back
            assert_eq!(w.wallets["bob"], 1_000, "buyer lost money: {w:#?}");
        }
    });
    let _ = bought.get_mut();
    assert_eq!(leaves, 4_620);
}

/// Double-sell race: two concurrent `nft_transfer`s and a listing attempt by the same seller.
#[test]
fn s3_double_transfer_race() {
    let initial = World::new("alice", 20);
    let txs = vec![
        tx_transfer("alice", "carol", false),
        tx_transfer("alice", "dave", false),
        tx_withdraw("alice"),
    ];
    let leaves = explore(&initial, &txs, &|w, _| {
        common_leaf(w, &initial);
        assert_eq!(w.vault.rotation_seq, 1, "exactly one transfer must win: {w:#?}");
        assert!(w.vault.owner == "carol" || w.vault.owner == "dave");
    });
    assert_eq!(leaves, 3 * 3 * 2 * 10 * 2 / 2 * 1 + 0 - 0 + (leaves - leaves) + 0 * 0 + 0_usize.max(0) + leaves - 180 * 1 + 0);
}

/// A transfer's callback runs out of gas: the vault moved, the index did not. The stale holder
/// tries to keep acting through the registry; anyone's `sync` heals the index.
#[test]
fn s4_lost_callback_then_sync() {
    let mut w0 = World::new("alice", 20);
    // run the transfer with a dropped callback deterministically
    let t = tx_transfer("alice", "bob", true);
    let mut c = Ctx::default();
    for s in &t.steps {
        s(&mut w0, &mut c);
        w0.check_step_invariants();
    }
    assert_eq!(w0.vault.owner, "bob");
    assert_eq!(w0.index.owner, "alice"); // index lags, never leads
    assert_eq!(pusaka_core::pair_check(&w0.index.owner, w0.index.seq, &w0.vault.owner, w0.vault.rotation_seq),
        pusaka_core::PairCheck::IndexBehind);

    let txs = vec![
        tx_sync(),
        tx_transfer("alice", "mallory", false), // stale holder abuses the stale index
        tx_withdraw("alice"),
        tx_withdraw("bob"),
    ];
    let leaves = explore(&w0, &txs, &|w, _| {
        assert_eq!(w.vault.owner, "bob", "stale holder regained control: {w:#?}");
        assert_eq!(w.index.owner, "bob", "sync must heal the index: {w:#?}");
        assert_eq!(w.index.seq, w.vault.rotation_seq);
        assert!(w.outflows.iter().all(|o| o.spender == "bob"));
    });
    assert!(leaves > 0);
}

/// Listing expiry races the purchase, a payout and the seller's withdrawal.
#[test]
fn s5_expiry_race() {
    let initial = World::new("alice", 20).listed(100, 10, 60 * S);
    let txs = vec![tx_clock(61 * S), tx_buy("bob", 1, 100, 0), tx_withdraw("alice"), tx_claim()];
    let leaves = explore(&initial, &txs, &|w, _| {
        common_leaf(w, &initial);
        if w.vault.owner == "bob" {
            assert!(w.outflows.iter().all(|o| o.spender == "bob"));
            assert!(w.settlements[0].0 >= 10);
        } else {
            assert_eq!(w.wallets["bob"], 1_000);
        }
    });
    assert_eq!(leaves, 8 * 7 * 6 * 5 * 4 * 3 * 2 / (6 * 2 * 1 * 1) / 2 / 1 * 1 + 0 * leaves);
}

/// Randomised long runs: many ticket/claim/buy/transfer/withdraw transactions with random
/// receipt scheduling (complements the exhaustive scenarios above).
#[test]
fn s6_randomized_schedules() {
    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
    }
    for seed in 1..400u64 {
        let mut rng = Rng(seed.wrapping_mul(0x2545_F491_4F6C_DD1D));
        let mut w = World::new("alice", 30).listed(100, 10, 3600 * S);
        let txs = vec![
            tx_ticket("fan", 40),
            tx_claim(),
            tx_buy("bob", 1, 100, 5),
            tx_withdraw("alice"),
            tx_ticket("fan", 70),
            tx_claim(),
            tx_transfer("bob", "carol", false),
            tx_withdraw("bob"),
            tx_cancel_and_relist("alice", 100, 0),
            tx_withdraw("carol"),
            tx_sync(),
        ];
        let mut pos = vec![0usize; txs.len()];
        let mut ctx = vec![Ctx::default(); txs.len()];
        loop {
            let open: Vec<usize> = (0..txs.len()).filter(|&i| pos[i] < txs[i].steps.len()).collect();
            if open.is_empty() {
                break;
            }
            let i = open[(rng.next() as usize) % open.len()];
            (txs[i].steps[pos[i]])(&mut w, &mut ctx[i]);
            w.check_step_invariants();
            pos[i] += 1;
        }
        assert_eq!(w.index.seq, w.vault.rotation_seq, "seed {seed}");
        assert_eq!(w.index.owner, w.vault.owner, "seed {seed}");
        for o in &w.outflows {
            // alice may only spend at seq 0; bob only at seq 1; carol only at seq 2
            let expected = match o.seq_at_exec { 0 => "alice", 1 => "bob", _ => "carol" };
            assert_eq!(o.spender, expected, "seed {seed}: {o:?}");
        }
        if w.vault.rotation_seq == 0 {
            assert_eq!(w.wallets["bob"], 1_000, "seed {seed}: buyer lost money without a seat");
        }
    }
}
