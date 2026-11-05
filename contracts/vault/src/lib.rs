//! # logen-vault
//!
//! Deployed onto every seat sub-account (`sNNN.<registry>` or `<handle>.<registry>`), with **zero**
//! access keys on the sub-account. The vault is the canonical source of truth for:
//!
//! 1. Who owns the seat right now (`owner_id` + `rotation_seq`).
//! 2. Whether outflows are frozen by an active listing (`Idle` vs `Listed`).
//! 3. Optional bounded delegate (`Delegate`) scoped to a single `rotation_seq` epoch.
//! 4. On-chain ring buffer of outflows (`get_outflows`) for the seat history view.
//! 5. `nft_item_info()` conforming to the Sharded NFT Items draft (`sharded-item-1.0.0`).
//!
//! Because `token_id` and `collection_id` are derived directly from `env::current_account_id()`
//! (and never stored or configurable), a vault cannot spoof which collection it belongs to, and
//! only its parent registry account can invoke `v_rotate`, `v_list`, `v_cancel`, or `v_settle_sale`.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, NearToken, PanicOnDefault, Promise};
use logen_core::{
    CoreError, Delegate, Listing, Spender, VaultCore, ITEM_SPEC,
};

#[cfg(not(target_arch = "wasm32"))]
use logen_test_env as _;

/// Default reserve kept on the seat sub-account to cover state storage (0.05 NEAR).
pub const DEFAULT_STORAGE_RESERVE: u128 = 50_000_000_000_000_000_000_000;
/// Maximum number of outflow records retained in the on-chain ring buffer (PRD K6: 64 entries).
pub const MAX_OUTFLOWS: usize = 64;

fn abort_with(msg: impl AsRef<str>) -> ! {
    #[cfg(target_arch = "wasm32")]
    env::panic_str(msg.as_ref());
    #[cfg(not(target_arch = "wasm32"))]
    panic!("{}", msg.as_ref());
}

fn abort_core(err: CoreError) -> ! {
    abort_with(err.to_string())
}

fn require_one_yocto() {
    if env::attached_deposit().as_yoctonear() != 1 {
        abort_with("E_DEPOSIT: requires attached deposit of exactly 1 yoctoNEAR");
    }
}

/// Derives the parent registry account ID from the seat's own account ID (`<label>.<registry>`).
pub fn derive_registry_id(current: &AccountId) -> AccountId {
    let s = current.as_str();
    let (_, parent) = s
        .split_once('.')
        .unwrap_or_else(|| abort_with("E_ONLY_REGISTRY: seat account must be a sub-account"));
    parent
        .parse()
        .unwrap_or_else(|_| abort_with("E_ONLY_REGISTRY: invalid parent account id"))
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct OutflowEntry {
    pub at_ms: u64,
    pub kind: String,
    pub amount: U128,
    pub to: AccountId,
    pub by: AccountId,
    pub seq: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct NftItemInfo {
    pub spec: String,
    pub init: bool,
    pub status: String,
    pub collection_id: AccountId,
    pub token_id: AccountId,
    pub owner_id: AccountId,
    pub rotation_seq: u64,
    pub rotation_epoch: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultListingView {
    pub price: U128,
    pub min_balance: U128,
    pub expires_at_ms: u64,
    pub proceeds_to: AccountId,
    pub nonce: u64,
}

impl VaultListingView {
    pub fn from_core(l: &Listing) -> Self {
        Self {
            price: U128(l.price),
            min_balance: U128(l.min_balance),
            expires_at_ms: l.expires_at / 1_000_000,
            proceeds_to: l.proceeds_to.parse().unwrap(),
            nonce: l.nonce,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct DelegateView {
    pub account_id: AccountId,
    pub remaining: U128,
    pub expires_at_ms: u64,
    pub seq: u64,
}

impl DelegateView {
    pub fn from_core(d: &Delegate) -> Self {
        Self {
            account_id: d.account.parse().unwrap(),
            remaining: U128(d.remaining),
            expires_at_ms: d.expires_at / 1_000_000,
            seq: d.seq,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultStateView {
    pub owner_id: AccountId,
    pub rotation_seq: u64,
    pub status: String,
    pub listing: Option<VaultListingView>,
    pub listing_nonce: u64,
    pub delegate: Option<DelegateView>,
    pub balance: U128,
    pub withdrawable: U128,
    pub storage_reserve: U128,
    pub registry_id: AccountId,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct RotationReceipt {
    pub owner_id: AccountId,
    pub rotation_seq: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SaleSettlement {
    pub seller: AccountId,
    pub proceeds_to: AccountId,
    pub buyer: AccountId,
    pub price: U128,
    pub new_seq: u64,
    pub vault_withdrawable: U128,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
pub struct VaultContract {
    core: VaultCore,
    storage_reserve: u128,
    outflows: Vec<OutflowEntry>,
    outflow_cursor: u64,
}

#[near_bindgen]
impl VaultContract {
    /// Initialises the vault in the same atomic batch receipt that creates the seat sub-account.
    /// Only the parent registry account may call `init`.
    #[init]
    pub fn init(owner_id: AccountId, storage_reserve: Option<U128>) -> Self {
        let current = env::current_account_id();
        let registry = derive_registry_id(&current);
        if env::predecessor_account_id() != registry {
            abort_with("E_ONLY_REGISTRY: only parent registry may initialize vault");
        }
        Self {
            core: VaultCore::new(owner_id.as_str()),
            storage_reserve: storage_reserve
                .map(|x| x.0)
                .unwrap_or(DEFAULT_STORAGE_RESERVE),
            outflows: Vec::new(),
            outflow_cursor: 0,
        }
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// Sharded NFT Items draft (`sharded-item-1.0.0`) item view used for T2 pair-checks.
    pub fn nft_item_info(&self) -> NftItemInfo {
        let current = env::current_account_id();
        let registry = derive_registry_id(&current);
        let frozen = self.core.is_frozen(env::block_timestamp());
        NftItemInfo {
            spec: ITEM_SPEC.to_string(),
            init: true,
            status: if frozen { "Frozen" } else { "Active" }.to_string(),
            collection_id: registry,
            token_id: current,
            owner_id: self.core.owner.parse().unwrap(),
            rotation_seq: self.core.rotation_seq,
            rotation_epoch: 0,
        }
    }

    /// Detailed state of the seat vault.
    pub fn vault_state(&self) -> VaultStateView {
        let now = env::block_timestamp();
        let current = env::current_account_id();
        let registry = derive_registry_id(&current);
        let live_listing = self.core.live_listing(now).map(VaultListingView::from_core);
        let status = if live_listing.is_some() {
            "Listed"
        } else {
            "Idle"
        };
        let delegate = self.core.delegate.as_ref().and_then(|d| {
            if d.seq == self.core.rotation_seq && now < d.expires_at {
                Some(DelegateView::from_core(d))
            } else {
                None
            }
        });
        let bal = self.effective_balance();
        let wd = bal.saturating_sub(self.storage_reserve);
        VaultStateView {
            owner_id: self.core.owner.parse().unwrap(),
            rotation_seq: self.core.rotation_seq,
            status: status.to_string(),
            listing: live_listing,
            listing_nonce: self.core.listing_nonce,
            delegate,
            balance: U128(bal),
            withdrawable: U128(wd),
            storage_reserve: U128(self.storage_reserve),
            registry_id: registry,
        }
    }

    /// Returns the outflow ring buffer in chronological order (oldest to newest, up to 64 entries).
    pub fn get_outflows(&self) -> Vec<OutflowEntry> {
        let len = self.outflows.len();
        if len < MAX_OUTFLOWS {
            return self.outflows.clone();
        }
        let start = (self.outflow_cursor as usize) % MAX_OUTFLOWS;
        let mut out = Vec::with_capacity(len);
        out.extend_from_slice(&self.outflows[start..]);
        out.extend_from_slice(&self.outflows[..start]);
        out
    }

    // -------------------------------------------------------------------------
    // Owner & Delegate spending methods
    // -------------------------------------------------------------------------

    /// Owner withdraws `amount` yoctoNEAR from the vault to `to` (defaults to owner).
    /// Blocked while the seat is listed (`E_FROZEN`). Requires 1 yoctoNEAR attached.
    #[payable]
    pub fn withdraw(&mut self, amount: U128, to: Option<AccountId>) -> Promise {
        require_one_yocto();
        let caller = env::predecessor_account_id();
        if caller.as_str() != self.core.owner {
            abort_core(CoreError::NotOwner);
        }
        let wd = self.withdrawable_raw();
        let now = env::block_timestamp();
        match self
            .core
            .authorize_withdraw(caller.as_str(), amount.0, wd, now)
        {
            Ok(Spender::Owner) => {}
            Ok(Spender::Delegate) => abort_core(CoreError::NotOwner),
            Err(e) => abort_core(e),
        }
        let recipient = to.unwrap_or_else(|| caller.clone());
        self.record_outflow("withdraw", amount.0, &recipient, &caller);
        // Return the 1 yocto security deposit along with the withdrawal so the vault balance
        // decreases by exactly `amount`.
        Promise::new(recipient).transfer(NearToken::from_yoctonear(amount.0.saturating_add(1)))
    }

    /// Bounded delegate withdrawal. Does not require 1 yoctoNEAR, and immediately fails if the
    /// seat was rotated (`E_NOT_OWNER` / `E_STALE_DELEGATE`), listed (`E_FROZEN`), expired
    /// (`E_DELEGATE_EXPIRED`), or over allowance (`E_ALLOWANCE_EXCEEDED`).
    pub fn delegate_withdraw(&mut self, amount: U128, to: Option<AccountId>) -> Promise {
        let caller = env::predecessor_account_id();
        let is_delegate = self
            .core
            .delegate
            .as_ref()
            .map(|d| d.account == caller.as_str())
            .unwrap_or(false);
        if !is_delegate {
            abort_core(CoreError::NoDelegate);
        }
        let wd = self.withdrawable_raw();
        let now = env::block_timestamp();
        if let Err(e) = self
            .core
            .authorize_withdraw(caller.as_str(), amount.0, wd, now)
        {
            abort_core(e);
        }
        let recipient = to.unwrap_or_else(|| caller.clone());
        self.record_outflow("delegate_withdraw", amount.0, &recipient, &caller);
        Promise::new(recipient).transfer(NearToken::from_yoctonear(amount.0))
    }

    /// Sets or replaces the bounded delegate for the current ownership epoch (`rotation_seq`).
    /// Any transfer or sale automatically wipes the delegate.
    #[payable]
    pub fn set_delegate(&mut self, account_id: AccountId, allowance: U128, ttl_sec: u64) {
        require_one_yocto();
        let caller = env::predecessor_account_id();
        let ttl_ns = ttl_sec.saturating_mul(1_000_000_000);
        if let Err(e) = self.core.set_delegate(
            caller.as_str(),
            account_id.as_str(),
            allowance.0,
            ttl_ns,
            env::block_timestamp(),
        ) {
            abort_core(e);
        }
    }

    /// Revokes the active delegate.
    #[payable]
    pub fn revoke_delegate(&mut self) {
        require_one_yocto();
        let caller = env::predecessor_account_id();
        if let Err(e) = self.core.revoke_delegate(caller.as_str()) {
            abort_core(e);
        }
    }

    /// Payable top-up method so anyone can deposit NEAR into the seat vault via function call.
    #[payable]
    pub fn deposit(&mut self) -> U128 {
        U128(self.withdrawable_raw())
    }

    // -------------------------------------------------------------------------
    // Registry-only control plane (`v_*`)
    // -------------------------------------------------------------------------

    /// Atomically rotates the canonical owner in a single receipt.
    pub fn v_rotate(
        &mut self,
        from: AccountId,
        to: AccountId,
        expected_seq: u64,
    ) -> RotationReceipt {
        self.assert_registry();
        match self.core.rotate(
            from.as_str(),
            to.as_str(),
            expected_seq,
            env::block_timestamp(),
        ) {
            Ok(new_seq) => RotationReceipt {
                owner_id: to,
                rotation_seq: new_seq,
            },
            Err(e) => abort_core(e),
        }
    }

    /// Freezes all outflows and records a new listing with a monotonic `nonce`.
    pub fn v_list(
        &mut self,
        by: AccountId,
        price: U128,
        min_balance: U128,
        ttl_sec: u64,
    ) -> VaultListingView {
        self.assert_registry();
        let ttl_ns = ttl_sec.saturating_mul(1_000_000_000);
        match self.core.list(
            by.as_str(),
            price.0,
            min_balance.0,
            ttl_ns,
            env::block_timestamp(),
        ) {
            Ok(l) => VaultListingView::from_core(&l),
            Err(e) => abort_core(e),
        }
    }

    /// Cancels an active listing and unfreezes the vault.
    pub fn v_cancel(&mut self, by: AccountId) -> bool {
        self.assert_registry();
        if let Err(e) = self.core.cancel(by.as_str(), env::block_timestamp()) {
            abort_core(e);
        }
        true
    }

    /// Settles a secondary-market sale atomically in a single receipt: verifies listing liveness,
    /// `nonce`, `price`, and `withdrawable >= max(seller_min_balance, buyer_min_balance)`, then
    /// rotates ownership to `buyer` and clears the delegate.
    pub fn v_settle_sale(
        &mut self,
        buyer: AccountId,
        nonce: u64,
        price: U128,
        min_balance: U128,
    ) -> SaleSettlement {
        self.assert_registry();
        let wd = self.withdrawable_raw();
        match self.core.settle_sale(
            buyer.as_str(),
            nonce,
            price.0,
            min_balance.0,
            wd,
            env::block_timestamp(),
        ) {
            Ok(out) => SaleSettlement {
                seller: out.seller.parse().unwrap(),
                proceeds_to: out.proceeds_to.parse().unwrap(),
                buyer,
                price,
                new_seq: out.new_seq,
                vault_withdrawable: U128(wd),
            },
            Err(e) => abort_core(e),
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    fn assert_registry(&self) {
        let current = env::current_account_id();
        let registry = derive_registry_id(&current);
        if env::predecessor_account_id() != registry {
            abort_with("E_ONLY_REGISTRY: caller is not the parent registry contract");
        }
    }

    fn effective_balance(&self) -> u128 {
        let bal = env::account_balance().as_yoctonear();
        let dep = env::attached_deposit().as_yoctonear();
        // When a 1-yocto guard deposit is attached to a change method, exclude that 1 yocto so
        // withdrawable matches the view before the call; for `deposit()` include the deposit.
        if dep == 1 {
            bal.saturating_sub(1)
        } else {
            bal
        }
    }

    fn withdrawable_raw(&self) -> u128 {
        self.effective_balance().saturating_sub(self.storage_reserve)
    }

    fn record_outflow(&mut self, kind: &str, amount: u128, to: &AccountId, by: &AccountId) {
        let entry = OutflowEntry {
            at_ms: env::block_timestamp_ms(),
            kind: kind.to_string(),
            amount: U128(amount),
            to: to.clone(),
            by: by.clone(),
            seq: self.core.rotation_seq,
        };
        if self.outflows.len() < MAX_OUTFLOWS {
            self.outflows.push(entry);
        } else {
            let idx = (self.outflow_cursor as usize) % MAX_OUTFLOWS;
            self.outflows[idx] = entry;
        }
        self.outflow_cursor = self.outflow_cursor.wrapping_add(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use logen_test_env::set_context;

    const NEAR: u128 = 10u128.pow(24);
    const S_NS: u64 = 1_000_000_000;

    fn ctx(predecessor: &str, deposit: u128, balance: u128, ts_ns: u64) {
        set_context("s001.logen.testnet", predecessor, deposit, balance, ts_ns);
    }

    #[test]
    fn unit_init_and_item_info_derives_parent() {
        ctx("logen.testnet", 0, 2 * NEAR, 10 * S_NS);
        let v = VaultContract::init("alice.testnet".parse().unwrap(), None);
        let info = v.nft_item_info();
        assert_eq!(info.spec, "sharded-item-1.0.0");
        assert_eq!(info.collection_id.as_str(), "logen.testnet");
        assert_eq!(info.token_id.as_str(), "s001.logen.testnet");
        assert_eq!(info.owner_id.as_str(), "alice.testnet");
        assert_eq!(info.status, "Active");
        assert_eq!(info.rotation_seq, 0);
    }

    #[test]
    #[should_panic(expected = "E_ONLY_REGISTRY")]
    fn unit_rejects_direct_v_rotate_from_attacker() {
        ctx("logen.testnet", 0, 2 * NEAR, 10 * S_NS);
        let mut v = VaultContract::init("alice.testnet".parse().unwrap(), None);
        ctx("mallory.testnet", 0, 2 * NEAR, 11 * S_NS);
        v.v_rotate(
            "alice.testnet".parse().unwrap(),
            "mallory.testnet".parse().unwrap(),
            0,
        );
    }

    #[test]
    #[should_panic(expected = "E_FROZEN")]
    fn unit_listing_freezes_owner_withdraw() {
        ctx("logen.testnet", 0, 2 * NEAR, 10 * S_NS);
        let mut v = VaultContract::init("alice.testnet".parse().unwrap(), None);
        v.v_list(
            "alice.testnet".parse().unwrap(),
            U128(5 * NEAR),
            U128(NEAR),
            600,
        );
        assert_eq!(v.nft_item_info().status, "Frozen");
        ctx("alice.testnet", 1, 2 * NEAR, 11 * S_NS);
        let _ = v.withdraw(U128(NEAR / 2), None);
    }

    #[test]
    fn unit_settle_sale_rotates_and_kills_delegate() {
        ctx("logen.testnet", 0, 3 * NEAR, 10 * S_NS);
        let mut v = VaultContract::init("alice.testnet".parse().unwrap(), None);

        ctx("alice.testnet", 1, 3 * NEAR, 11 * S_NS);
        v.set_delegate("bot.testnet".parse().unwrap(), U128(NEAR), 600);

        ctx("logen.testnet", 0, 3 * NEAR, 12 * S_NS);
        let listed = v.v_list(
            "alice.testnet".parse().unwrap(),
            U128(5 * NEAR),
            U128(2 * NEAR),
            600,
        );
        let settled = v.v_settle_sale(
            "bob.testnet".parse().unwrap(),
            listed.nonce,
            U128(5 * NEAR),
            U128(2 * NEAR),
        );
        assert_eq!(settled.new_seq, 1);
        assert_eq!(v.vault_state().owner_id.as_str(), "bob.testnet");
        assert!(v.vault_state().delegate.is_none());
    }
}
