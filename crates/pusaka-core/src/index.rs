//! Registry index rules (design decisions K2 and K8) and the third-party pair check (§9.5).
//!
//! The registry keeps an *index* (owner + seq + listing mirror) for NEP-171 views. The vault is
//! canonical. The index may lag behind the vault but must never get ahead of it, and it can only
//! move forward: every update is gated on a strictly larger `rotation_seq`.

use crate::{vault::Listing, Balance, Timestamp};

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListingMirror {
    pub price: Balance,
    pub min_balance: Balance,
    pub expires_at: Timestamp,
    pub nonce: u64,
    pub seller: String,
}

impl ListingMirror {
    pub fn from_listing(l: &Listing, seller: &str) -> Self {
        ListingMirror {
            price: l.price,
            min_balance: l.min_balance,
            expires_at: l.expires_at,
            nonce: l.nonce,
            seller: seller.to_string(),
        }
    }
}

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndexEntry {
    pub owner: String,
    pub seq: u64,
    pub listing: Option<ListingMirror>,
}

/// What the registry reads from `vault_state()` during `sync`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultSnapshot {
    pub owner: String,
    pub rotation_seq: u64,
    pub listing: Option<Listing>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncOutcome {
    /// Vault was ahead: index moved forward to the vault's owner and seq.
    Advanced { from_owner: String, to_owner: String },
    /// Same epoch; listing mirror refreshed (e.g. listing callback was lost or listing expired).
    Refreshed,
    Unchanged,
    /// Vault is *behind* the index or disagrees at the same seq. Impossible by construction;
    /// the index is left untouched and the anomaly is reported.
    Divergent,
}

impl IndexEntry {
    pub fn new(owner: impl Into<String>) -> Self {
        IndexEntry { owner: owner.into(), seq: 0, listing: None }
    }

    /// Callback path after a successful `v_rotate` / `v_settle_sale`.
    /// Returns false (no-op) if the index already reached or passed `new_seq`.
    pub fn apply_rotation(&mut self, new_owner: &str, new_seq: u64) -> bool {
        if new_seq <= self.seq {
            return false;
        }
        self.owner = new_owner.to_string();
        self.seq = new_seq;
        self.listing = None;
        true
    }

    /// Live listing mirror at `now`.
    pub fn live_listing(&self, now: Timestamp) -> Option<&ListingMirror> {
        self.listing.as_ref().filter(|l| now < l.expires_at)
    }

    /// Permissionless, idempotent reconciliation (`registry.sync`).
    pub fn reconcile(&mut self, snap: &VaultSnapshot, now: Timestamp) -> SyncOutcome {
        let live = snap.listing.as_ref().filter(|l| now < l.expires_at);
        let mirror = live.map(|l| ListingMirror::from_listing(l, &snap.owner));
        if snap.rotation_seq > self.seq {
            let from_owner = core::mem::replace(&mut self.owner, snap.owner.clone());
            self.seq = snap.rotation_seq;
            self.listing = mirror;
            return SyncOutcome::Advanced { from_owner, to_owner: snap.owner.clone() };
        }
        if snap.rotation_seq < self.seq || snap.owner != self.owner {
            return SyncOutcome::Divergent;
        }
        if self.listing != mirror {
            self.listing = mirror;
            SyncOutcome::Refreshed
        } else {
            SyncOutcome::Unchanged
        }
    }
}

/// Decision table for consumers comparing `registry.nft_token` with `vault.nft_item_info`
/// read at the **same final block** (tier T2 in the Sharded NFT Items draft).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PairCheck {
    /// Both agree: trust the owner.
    Consistent,
    /// Vault is ahead (a transfer is finalising). Retry briefly or call `sync`; never trust the index.
    IndexBehind,
    /// Vault behind the index, or same seq but different owner. Reject without retry.
    Invalid,
}

pub fn pair_check(index_owner: &str, index_seq: u64, vault_owner: &str, vault_seq: u64) -> PairCheck {
    if vault_seq > index_seq {
        PairCheck::IndexBehind
    } else if vault_seq < index_seq || vault_owner != index_owner {
        PairCheck::Invalid
    } else {
        PairCheck::Consistent
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap(owner: &str, seq: u64) -> VaultSnapshot {
        VaultSnapshot { owner: owner.into(), rotation_seq: seq, listing: None }
    }

    #[test]
    fn index_only_moves_forward() {
        let mut e = IndexEntry::new("alice");
        assert!(e.apply_rotation("bob", 1));
        assert!(!e.apply_rotation("alice", 1));
        assert!(!e.apply_rotation("alice", 0));
        assert_eq!(e.owner, "bob");
    }

    #[test]
    fn sync_advances_lagging_index() {
        let mut e = IndexEntry::new("alice");
        let out = e.reconcile(&snap("carol", 2), 0);
        assert_eq!(out, SyncOutcome::Advanced { from_owner: "alice".into(), to_owner: "carol".into() });
        assert_eq!((e.owner.as_str(), e.seq), ("carol", 2));
        assert_eq!(e.reconcile(&snap("carol", 2), 0), SyncOutcome::Unchanged);
    }

    #[test]
    fn sync_never_rolls_back() {
        let mut e = IndexEntry { owner: "bob".into(), seq: 3, listing: None };
        assert_eq!(e.reconcile(&snap("alice", 2), 0), SyncOutcome::Divergent);
        assert_eq!(e.reconcile(&snap("mallory", 3), 0), SyncOutcome::Divergent);
        assert_eq!((e.owner.as_str(), e.seq), ("bob", 3));
    }

    #[test]
    fn sync_refreshes_listing_mirror() {
        let mut e = IndexEntry::new("alice");
        let l = Listing { price: 5, min_balance: 1, expires_at: 100, proceeds_to: "alice".into(), nonce: 1 };
        let s = VaultSnapshot { owner: "alice".into(), rotation_seq: 0, listing: Some(l) };
        assert_eq!(e.reconcile(&s, 10), SyncOutcome::Refreshed);
        assert_eq!(e.listing.as_ref().unwrap().nonce, 1);
        // after expiry the mirror is dropped
        assert_eq!(e.reconcile(&s, 100), SyncOutcome::Refreshed);
        assert!(e.listing.is_none());
    }

    #[test]
    fn pair_check_table() {
        assert_eq!(pair_check("a", 1, "a", 1), PairCheck::Consistent);
        assert_eq!(pair_check("a", 1, "b", 2), PairCheck::IndexBehind);
        assert_eq!(pair_check("a", 2, "a", 1), PairCheck::Invalid);
        assert_eq!(pair_check("a", 1, "b", 1), PairCheck::Invalid);
    }
}
