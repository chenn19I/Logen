//! Vault state machine: the canonical owner of a seat (design decision K2).
//!
//! The vault lives on the seat's own account. Ownership, rotation sequence, listing state and
//! the delegate are all decided here, inside a single receipt, so the question "who owns this
//! seat and how much may leave it?" never depends on receipt ordering across contracts.
//!
//! ```text
//!            v_list (owner, Idle)             v_settle_sale (nonce, price, balance ok)
//!   Idle ───────────────────────────▶ Listed ─────────────────────────────────▶ Idle (owner = buyer, seq+1)
//!    ▲  ◀─── v_cancel / expiry ───────┘
//!    └── v_rotate (owner, Idle, expected_seq) ──▶ Idle (owner = to, seq+1)
//! ```

use crate::{error::CoreError, Balance, Timestamp, MAX_LISTING_TTL_NS};

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Listing {
    pub price: Balance,
    /// Seller-promised minimum withdrawable balance at settlement.
    pub min_balance: Balance,
    pub expires_at: Timestamp,
    /// Recorded at listing time; always the seller who listed.
    pub proceeds_to: String,
    pub nonce: u64,
}

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Status {
    Idle,
    Listed(Listing),
}

/// A bounded spender (e.g. an AI agent or a friend) bound to one ownership epoch.
#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Delegate {
    pub account: String,
    pub remaining: Balance,
    pub expires_at: Timestamp,
    /// `rotation_seq` at creation. Any rotation invalidates the delegate.
    pub seq: u64,
}

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultCore {
    pub owner: String,
    pub rotation_seq: u64,
    pub status: Status,
    /// Monotonic listing counter; a buyer must quote the exact nonce they saw.
    pub listing_nonce: u64,
    pub delegate: Option<Delegate>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SaleOutcome {
    pub seller: String,
    pub proceeds_to: String,
    pub price: Balance,
    pub new_seq: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Spender {
    Owner,
    Delegate,
}

impl VaultCore {
    pub fn new(owner: impl Into<String>) -> Self {
        VaultCore { owner: owner.into(), rotation_seq: 0, status: Status::Idle, listing_nonce: 0, delegate: None }
    }

    /// The listing if it is live at `now` (expired listings count as Idle, lazily).
    pub fn live_listing(&self, now: Timestamp) -> Option<&Listing> {
        match &self.status {
            Status::Listed(l) if now < l.expires_at => Some(l),
            _ => None,
        }
    }

    pub fn is_frozen(&self, now: Timestamp) -> bool {
        self.live_listing(now).is_some()
    }

    /// Materialises lazy expiry.
    fn normalize(&mut self, now: Timestamp) {
        if let Status::Listed(l) = &self.status {
            if now >= l.expires_at {
                self.status = Status::Idle;
            }
        }
    }

    /// Plain transfer. Only from Idle, only by the current owner, only at the expected seq.
    pub fn rotate(&mut self, from: &str, to: &str, expected_seq: u64, now: Timestamp) -> Result<u64, CoreError> {
        self.normalize(now);
        if self.owner != from {
            return Err(CoreError::NotOwner);
        }
        if from == to {
            return Err(CoreError::SelfTransfer);
        }
        if !matches!(self.status, Status::Idle) {
            return Err(CoreError::NotIdle);
        }
        if self.rotation_seq != expected_seq {
            return Err(CoreError::WrongSeq { expected: expected_seq, actual: self.rotation_seq });
        }
        self.apply_rotation(to);
        Ok(self.rotation_seq)
    }

    fn apply_rotation(&mut self, to: &str) {
        self.owner = to.to_string();
        self.rotation_seq += 1;
        self.status = Status::Idle;
        // A delegate never survives a change of hands.
        self.delegate = None;
    }

    /// Lists the seat. From here until cancel/expiry/settlement, **no value can leave the vault**.
    pub fn list(
        &mut self,
        by: &str,
        price: Balance,
        min_balance: Balance,
        ttl_ns: Timestamp,
        now: Timestamp,
    ) -> Result<Listing, CoreError> {
        self.normalize(now);
        if self.owner != by {
            return Err(CoreError::NotOwner);
        }
        if !matches!(self.status, Status::Idle) {
            return Err(CoreError::NotIdle);
        }
        if price == 0 {
            return Err(CoreError::InvalidAmount);
        }
        if ttl_ns < 1_000_000_000 || ttl_ns > MAX_LISTING_TTL_NS {
            return Err(CoreError::TtlOutOfRange);
        }
        self.listing_nonce += 1;
        let listing = Listing {
            price,
            min_balance,
            expires_at: now.saturating_add(ttl_ns),
            proceeds_to: by.to_string(),
            nonce: self.listing_nonce,
        };
        self.status = Status::Listed(listing.clone());
        Ok(listing)
    }

    pub fn cancel(&mut self, by: &str, now: Timestamp) -> Result<(), CoreError> {
        self.normalize(now);
        if self.owner != by {
            return Err(CoreError::NotOwner);
        }
        if !matches!(self.status, Status::Listed(_)) {
            return Err(CoreError::NotListed);
        }
        self.status = Status::Idle;
        Ok(())
    }

    /// Atomic settlement: every check and the ownership change happen in the same receipt.
    /// `withdrawable` is the vault's spendable balance measured inside that receipt.
    pub fn settle_sale(
        &mut self,
        buyer: &str,
        nonce: u64,
        price: Balance,
        buyer_min_balance: Balance,
        withdrawable: Balance,
        now: Timestamp,
    ) -> Result<SaleOutcome, CoreError> {
        let listing = match &self.status {
            Status::Idle => return Err(CoreError::NotListed),
            Status::Listed(l) if now >= l.expires_at => return Err(CoreError::ListingExpired),
            Status::Listed(l) => l.clone(),
        };
        if listing.nonce != nonce {
            return Err(CoreError::NonceMismatch { expected: nonce, actual: listing.nonce });
        }
        if listing.price != price {
            return Err(CoreError::PriceMismatch);
        }
        if buyer == self.owner {
            return Err(CoreError::BuyerIsSeller);
        }
        let required = listing.min_balance.max(buyer_min_balance);
        if withdrawable < required {
            return Err(CoreError::InsufficientBalance { available: withdrawable, required });
        }
        let seller = self.owner.clone();
        self.apply_rotation(buyer);
        Ok(SaleOutcome { seller, proceeds_to: listing.proceeds_to, price, new_seq: self.rotation_seq })
    }

    /// Authorises an outflow of `amount`. Mutates delegate allowance on success.
    pub fn authorize_withdraw(
        &mut self,
        caller: &str,
        amount: Balance,
        withdrawable: Balance,
        now: Timestamp,
    ) -> Result<Spender, CoreError> {
        self.normalize(now);
        let is_owner = caller == self.owner;
        let is_delegate = self.delegate.as_ref().map(|d| d.account == caller).unwrap_or(false);
        if !is_owner && !is_delegate {
            return Err(CoreError::NotOwner);
        }
        if self.is_frozen(now) {
            return Err(CoreError::Frozen);
        }
        if amount == 0 || amount > withdrawable {
            return Err(CoreError::InvalidAmount);
        }
        if is_owner {
            return Ok(Spender::Owner);
        }
        let seq = self.rotation_seq;
        let d = self.delegate.as_mut().ok_or(CoreError::NoDelegate)?;
        if d.seq != seq {
            return Err(CoreError::StaleDelegate);
        }
        if now >= d.expires_at {
            return Err(CoreError::DelegateExpired);
        }
        if d.remaining < amount {
            return Err(CoreError::AllowanceExceeded);
        }
        d.remaining -= amount;
        Ok(Spender::Delegate)
    }

    pub fn set_delegate(
        &mut self,
        caller: &str,
        account: &str,
        allowance: Balance,
        ttl_ns: Timestamp,
        now: Timestamp,
    ) -> Result<(), CoreError> {
        self.normalize(now);
        if caller != self.owner {
            return Err(CoreError::NotOwner);
        }
        if self.is_frozen(now) {
            return Err(CoreError::Frozen);
        }
        if account == self.owner {
            return Err(CoreError::SelfTransfer);
        }
        if allowance == 0 {
            return Err(CoreError::InvalidAmount);
        }
        if ttl_ns < 1_000_000_000 || ttl_ns > MAX_LISTING_TTL_NS {
            return Err(CoreError::TtlOutOfRange);
        }
        self.delegate = Some(Delegate {
            account: account.to_string(),
            remaining: allowance,
            expires_at: now.saturating_add(ttl_ns),
            seq: self.rotation_seq,
        });
        Ok(())
    }

    pub fn revoke_delegate(&mut self, caller: &str) -> Result<(), CoreError> {
        if caller != self.owner {
            return Err(CoreError::NotOwner);
        }
        if self.delegate.is_none() {
            return Err(CoreError::NoDelegate);
        }
        self.delegate = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const S: u64 = 1_000_000_000;
    const NEAR: u128 = 10u128.pow(24);

    fn v() -> VaultCore {
        VaultCore::new("alice")
    }

    #[test]
    fn rotate_happy_path_and_old_owner_locked_out() {
        let mut v = v();
        assert_eq!(v.rotate("alice", "bob", 0, 0), Ok(1));
        assert_eq!(v.owner, "bob");
        assert_eq!(v.authorize_withdraw("alice", 1, 10, 0), Err(CoreError::NotOwner));
        assert_eq!(v.rotate("alice", "carol", 1, 0), Err(CoreError::NotOwner));
        assert_eq!(v.list("alice", 1, 0, 60 * S, 0).unwrap_err(), CoreError::NotOwner);
    }

    #[test]
    fn rotate_rejects_wrong_seq_self_and_listed() {
        let mut v = v();
        assert_eq!(v.rotate("alice", "bob", 7, 0), Err(CoreError::WrongSeq { expected: 7, actual: 0 }));
        assert_eq!(v.rotate("alice", "alice", 0, 0), Err(CoreError::SelfTransfer));
        v.list("alice", NEAR, 0, 60 * S, 0).unwrap();
        assert_eq!(v.rotate("alice", "bob", 0, 0), Err(CoreError::NotIdle));
        // after expiry the listing counts as Idle
        assert_eq!(v.rotate("alice", "bob", 0, 61 * S), Ok(1));
    }

    #[test]
    fn listing_freezes_every_outflow() {
        let mut v = v();
        v.set_delegate("alice", "agent", NEAR, 3600 * S, 0).unwrap();
        v.list("alice", NEAR, 0, 60 * S, 0).unwrap();
        assert_eq!(v.authorize_withdraw("alice", 1, NEAR, 1), Err(CoreError::Frozen));
        assert_eq!(v.authorize_withdraw("agent", 1, NEAR, 1), Err(CoreError::Frozen));
        assert_eq!(v.set_delegate("alice", "agent2", 1, 60 * S, 1), Err(CoreError::Frozen));
        v.cancel("alice", 2).unwrap();
        assert_eq!(v.authorize_withdraw("alice", 1, NEAR, 3), Ok(Spender::Owner));
    }

    #[test]
    fn settle_checks_everything_in_one_step() {
        let mut v = v();
        let l = v.list("alice", 5 * NEAR, 2 * NEAR, 60 * S, 0).unwrap();
        assert_eq!(v.settle_sale("bob", l.nonce + 1, 5 * NEAR, 0, 3 * NEAR, 1).unwrap_err().code(), "E_NONCE_MISMATCH");
        assert_eq!(v.settle_sale("bob", l.nonce, 4 * NEAR, 0, 3 * NEAR, 1), Err(CoreError::PriceMismatch));
        assert_eq!(v.settle_sale("alice", l.nonce, 5 * NEAR, 0, 3 * NEAR, 1), Err(CoreError::BuyerIsSeller));
        assert_eq!(
            v.settle_sale("bob", l.nonce, 5 * NEAR, 0, NEAR, 1),
            Err(CoreError::InsufficientBalance { available: NEAR, required: 2 * NEAR })
        );
        // buyer's own guard is stricter than the seller's promise
        assert_eq!(
            v.settle_sale("bob", l.nonce, 5 * NEAR, 4 * NEAR, 3 * NEAR, 1),
            Err(CoreError::InsufficientBalance { available: 3 * NEAR, required: 4 * NEAR })
        );
        assert_eq!(v.settle_sale("bob", l.nonce, 5 * NEAR, 0, 3 * NEAR, 61 * S), Err(CoreError::ListingExpired));
        let out = v.settle_sale("bob", l.nonce, 5 * NEAR, 3 * NEAR, 3 * NEAR, 1).unwrap();
        assert_eq!(out.seller, "alice");
        assert_eq!(out.proceeds_to, "alice");
        assert_eq!(out.new_seq, 1);
        assert_eq!(v.owner, "bob");
        assert_eq!(v.status, Status::Idle);
    }

    #[test]
    fn relist_bumps_nonce_so_bait_and_switch_fails() {
        let mut v = v();
        let first = v.list("alice", NEAR, NEAR, 60 * S, 0).unwrap();
        v.cancel("alice", 1).unwrap();
        let second = v.list("alice", NEAR, 0, 60 * S, 2).unwrap();
        assert!(second.nonce > first.nonce);
        assert!(matches!(v.settle_sale("bob", first.nonce, NEAR, 0, 0, 3), Err(CoreError::NonceMismatch { .. })));
    }

    #[test]
    fn delegate_is_bounded_and_dies_on_rotation() {
        let mut v = v();
        v.set_delegate("alice", "agent", 3 * NEAR, 60 * S, 0).unwrap();
        assert_eq!(v.authorize_withdraw("agent", 2 * NEAR, 10 * NEAR, 1), Ok(Spender::Delegate));
        assert_eq!(v.authorize_withdraw("agent", 2 * NEAR, 10 * NEAR, 1), Err(CoreError::AllowanceExceeded));
        assert_eq!(v.authorize_withdraw("agent", NEAR, 10 * NEAR, 61 * S), Err(CoreError::DelegateExpired));
        v.rotate("alice", "bob", 0, 2).unwrap();
        assert!(v.delegate.is_none());
        assert_eq!(v.authorize_withdraw("agent", 1, 10 * NEAR, 3), Err(CoreError::NotOwner));
    }

    #[test]
    fn withdraw_amount_bounds() {
        let mut v = v();
        assert_eq!(v.authorize_withdraw("alice", 0, 10, 0), Err(CoreError::InvalidAmount));
        assert_eq!(v.authorize_withdraw("alice", 11, 10, 0), Err(CoreError::InvalidAmount));
        assert_eq!(v.authorize_withdraw("mallory", 1, 10, 0), Err(CoreError::NotOwner));
    }

    #[test]
    fn ttl_bounds() {
        let mut v = v();
        assert_eq!(v.list("alice", 1, 0, 0, 0).unwrap_err(), CoreError::TtlOutOfRange);
        assert_eq!(v.list("alice", 1, 0, MAX_LISTING_TTL_NS + 1, 0).unwrap_err(), CoreError::TtlOutOfRange);
        assert_eq!(v.list("alice", 0, 0, 60 * S, 0).unwrap_err(), CoreError::InvalidAmount);
    }
}
