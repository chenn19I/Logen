//! # pusaka-core
//!
//! Pure, dependency-free state machines and arithmetic for Pusaka (design decision K9).
//!
//! The NEAR contracts in `contracts/` are thin adapters around this crate: every rule that
//! decides *who owns a seat*, *who may spend from it*, and *how ticket revenue is split*
//! lives here, so the exact same code runs in
//!
//! * the on-chain contracts (`pusaka-vault`, `pusaka-registry`),
//! * the unit/property tests (`cargo test -p pusaka-core`), and
//! * the receipt-interleaving explorer (`tests/interleavings.rs`), which exhaustively
//!   reorders cross-contract receipts to prove a seller can never keep the money.
#![forbid(unsafe_code)]

pub mod accrual;
pub mod error;
pub mod index;
pub mod math;
pub mod split;
pub mod vault;

pub use accrual::{Accumulator, Distribution};
pub use error::CoreError;
pub use index::{pair_check, IndexEntry, ListingMirror, PairCheck, SyncOutcome, VaultSnapshot};
pub use split::Bps;
pub use vault::{Delegate, Listing, SaleOutcome, Spender, Status, VaultCore};

/// Amounts in yoctoNEAR.
pub type Balance = u128;
/// Block timestamps in nanoseconds.
pub type Timestamp = u64;

/// String pinned by the Sharded NFT Items draft (`nft_item_info().spec`).
pub const ITEM_SPEC: &str = "sharded-item-1.0.0";
/// Basis-point denominator.
pub const BPS_DENOMINATOR: u16 = 10_000;
/// Upper bound for listing TTL (30 days).
pub const MAX_LISTING_TTL_NS: Timestamp = 30 * 24 * 60 * 60 * 1_000_000_000;
