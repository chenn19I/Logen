//! # pusaka-registry
//!
//! Deployed onto the parent account (e.g. `pusaka.testnet`), which is then sealed (all access keys
//! deleted). Implements:
//!
//! - **NEP-171 / NEP-177 / NEP-181 / NEP-297** non-fungible token views, transfers, and events
//!   with dynamic on-chain SVG artwork (`metadata.media`).
//! - **Zero-key seat factory (`mint_seat`)**: creates `<seat>.<registry>` in a single atomic batch
//!   receipt (`CreateAccount` + `Transfer` + `DeployContract` + `FunctionCall("init")`) with **no
//!   `AddKey` action**.
//! - **Atomic control rotation (`nft_transfer`)**: routes ownership changes through
//!   `vault.v_rotate` so the vault is always canonical; `nft_transfer_call` is explicitly disabled
//!   (design decision K5).
//! - **Permissionless reconciliation (`sync`)**: heals the registry index from `vault.vault_state()`
//!   if a callback ever runs out of gas, moving only forward in `rotation_seq` (design decision K8).
//! - **Safe secondary market (`list_seat`, `cancel_listing`, `buy_seat`)**: freezes the vault on
//!   list, escrows buyer funds, settles atomically in the vault with both seller and buyer minimum
//!   balance guards, and credits pull ledgers for proceeds, royalties, or buyer refunds.
//! - **O(1) event revenue accumulator (`create_event`, `buy_ticket`, `claim`)**: splits every
//!   ticket (default 40% Pool Anggota, 50% Kas Klub, 10% Organizer) without looping over seats,
//!   and always sends claimed pool shares to the **seat vault sub-account**, never to a person.

use std::collections::BTreeMap;

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, ext_contract, near_bindgen, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError,
};
use pusaka_core::math::apply_bps;
use pusaka_core::{
    Accumulator, Bps, CoreError, IndexEntry, Listing, ListingMirror, SyncOutcome, VaultSnapshot,
    BPS_DENOMINATOR,
};

#[cfg(not(target_arch = "wasm32"))]
use pusaka_test_env as _;

const GAS_VAULT_CALL: Gas = Gas::from_tgas(35);
const GAS_CALLBACK: Gas = Gas::from_tgas(35);
const GAS_MINT_INIT: Gas = Gas::from_tgas(40);
const DEFAULT_STORAGE_RESERVE: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR

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

fn emit_nep297(standard: &str, version: &str, event: &str, data: serde_json::Value) {
    let payload = serde_json::json!({
        "standard": standard,
        "version": version,
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{payload}"));
}

#[allow(dead_code)]
#[ext_contract(ext_vault)]
pub trait ExtVault {
    fn init(owner_id: AccountId, storage_reserve: Option<U128>);
    fn v_rotate(from: AccountId, to: AccountId, expected_seq: u64) -> RotationReceipt;
    fn v_list(by: AccountId, price: U128, min_balance: U128, ttl_sec: u64) -> VaultListingDto;
    fn v_cancel(by: AccountId) -> bool;
    fn v_settle_sale(
        buyer: AccountId,
        nonce: u64,
        price: U128,
        min_balance: U128,
    ) -> SaleSettlementDto;
    fn vault_state() -> VaultStateDto;
}

// -----------------------------------------------------------------------------
// Cross-contract DTOs & View types
// -----------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct RotationReceipt {
    pub owner_id: AccountId,
    pub rotation_seq: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultListingDto {
    pub price: U128,
    pub min_balance: U128,
    pub expires_at_ms: u64,
    pub proceeds_to: AccountId,
    pub nonce: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct SaleSettlementDto {
    pub seller: AccountId,
    pub proceeds_to: AccountId,
    pub buyer: AccountId,
    pub price: U128,
    pub new_seq: u64,
    pub vault_withdrawable: U128,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct VaultStateDto {
    pub owner_id: AccountId,
    pub rotation_seq: u64,
    pub status: String,
    pub listing: Option<VaultListingDto>,
    pub listing_nonce: u64,
    pub balance: U128,
    pub withdrawable: U128,
    pub storage_reserve: U128,
    pub registry_id: AccountId,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct NftContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct BpsView {
    pub pool: u16,
    pub kas: u16,
    pub organizer: u16,
}

impl From<Bps> for BpsView {
    fn from(b: Bps) -> Self {
        Self {
            pool: b.pool,
            kas: b.kas,
            organizer: b.organizer,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct ConfigView {
    pub registry_id: AccountId,
    pub organizer_id: AccountId,
    pub kas_klub_id: AccountId,
    pub vault_code_hash: String,
    pub seat_price: U128,
    pub vault_initial_balance: U128,
    pub royalty_bps: u16,
    pub max_seats: u64,
    pub max_listing_ttl_sec: u64,
    pub default_bps: BpsView,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct StatsView {
    pub seats_minted: u64,
    pub acc: U128,
    pub carry: U128,
    pub total_pool_distributed: U128,
    pub total_claimed: U128,
    pub tickets_sold: u64,
    pub events_count: u64,
    pub kas_klub_owed: U128,
    pub organizer_owed: U128,
    pub kas_klub_released: U128,
    pub organizer_released: U128,
    pub sales_count: u64,
    pub sales_volume: U128,
    pub royalties_total: U128,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct ListingView {
    pub token_id: AccountId,
    pub price: U128,
    pub min_balance: U128,
    pub expires_at_ms: u64,
    pub nonce: u64,
    pub seller: AccountId,
}

impl ListingView {
    fn from_mirror(token_id: &AccountId, m: &ListingMirror) -> Self {
        Self {
            token_id: token_id.clone(),
            price: U128(m.price),
            min_balance: U128(m.min_balance),
            expires_at_ms: m.expires_at / 1_000_000,
            nonce: m.nonce,
            seller: m.seller.parse().unwrap(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SeatView {
    pub token_id: AccountId,
    pub number: u64,
    pub handle: Option<String>,
    pub owner_id: AccountId,
    pub rotation_seq: u64,
    pub checkpoint: U128,
    pub claimable: U128,
    pub total_claimed: U128,
    pub minted_at_ms: u64,
    pub holders_count: u64,
    pub listing: Option<ListingView>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct HolderRecord {
    pub owner_id: AccountId,
    pub since_ms: u64,
    pub seq: u64,
    pub via: String,
    pub price: Option<U128>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct ClaimRecord {
    pub at_ms: u64,
    pub amount: U128,
    pub by: AccountId,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct EarningRecord {
    pub at_ms: u64,
    pub event_id: u64,
    pub per_seat: U128,
    pub seats: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SeatHistoryView {
    pub holders: Vec<HolderRecord>,
    pub claims: Vec<ClaimRecord>,
    pub earnings: Vec<EarningRecord>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct EventView {
    pub id: u64,
    pub name: String,
    pub price: U128,
    pub member_discount_bps: u16,
    pub capacity: u64,
    pub sold: u64,
    pub starts_at_ms: u64,
    pub created_at_ms: u64,
    pub bps: BpsView,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct TicketHoldingView {
    pub event_id: u64,
    pub count: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct LedgerView {
    pub refund: U128,
    pub proceeds: U128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SaleRecord {
    pub token_id: AccountId,
    pub seller: AccountId,
    pub buyer: AccountId,
    pub price: U128,
    pub royalty: U128,
    pub at_ms: u64,
}

// -----------------------------------------------------------------------------
// Stored structures
// -----------------------------------------------------------------------------

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
struct SeatRecord {
    token_id: AccountId,
    number: u64,
    handle: Option<String>,
    index: IndexEntry,
    checkpoint: u128,
    total_claimed: u128,
    minted_at_ms: u64,
    mint_accrual_index: u64,
    holders: Vec<HolderRecord>,
    claims: Vec<ClaimRecord>,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
struct EventRecord {
    id: u64,
    name: String,
    price: u128,
    member_discount_bps: u16,
    capacity: u64,
    sold: u64,
    starts_at_ms: u64,
    created_at_ms: u64,
    bps: Bps,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[borsh(crate = "near_sdk::borsh")]
pub struct RegistryContract {
    organizer_id: AccountId,
    kas_klub_id: AccountId,
    vault_code_hash: String,
    vault_wasm: Vec<u8>,
    seat_price: u128,
    vault_initial_balance: u128,
    royalty_bps: u16,
    max_seats: u64,
    max_listing_ttl_sec: u64,
    default_bps: Bps,

    acc: Accumulator,
    total_claimed: u128,
    tickets_sold: u64,

    kas_klub_owed: u128,
    organizer_owed: u128,
    kas_klub_released: u128,
    organizer_released: u128,

    sales_count: u64,
    sales_volume: u128,
    royalties_total: u128,

    next_seat_number: u64,
    seat_order: Vec<AccountId>,
    seats: BTreeMap<AccountId, SeatRecord>,
    pending_mints: BTreeMap<AccountId, bool>,

    events: Vec<EventRecord>,
    accrual_log: Vec<EarningRecord>,
    tickets_by_account: BTreeMap<AccountId, BTreeMap<u64, u64>>,

    refunds: BTreeMap<AccountId, u128>,
    proceeds: BTreeMap<AccountId, u128>,
    sales_log: Vec<SaleRecord>,
}

#[near_bindgen]
impl RegistryContract {
    /// Initialises the Pusaka registry.
    /// `vault_wasm_base64` may be provided at init or uploaded once before sealing via
    /// `set_vault_wasm` (which locks forever once set).
    #[init]
    pub fn init(
        organizer_id: AccountId,
        kas_klub_id: AccountId,
        seat_price: U128,
        vault_initial_balance: U128,
        royalty_bps: Option<u16>,
        max_seats: Option<u64>,
        max_listing_ttl_sec: Option<u64>,
        default_bps: Option<BpsView>,
        vault_code_hash: Option<String>,
    ) -> Self {
        let royalty = royalty_bps.unwrap_or(500); // 5% default royalty to Kas Klub
        if royalty > 5_000 {
            abort_core(CoreError::InvalidBps);
        }
        if vault_initial_balance.0 < DEFAULT_STORAGE_RESERVE
            || seat_price.0 < vault_initial_balance.0
        {
            abort_core(CoreError::InvalidAmount);
        }
        let bps = default_bps
            .map(|b| Bps {
                pool: b.pool,
                kas: b.kas,
                organizer: b.organizer,
            })
            .unwrap_or_default();
        if let Err(e) = bps.validate() {
            abort_core(e);
        }
        Self {
            organizer_id,
            kas_klub_id,
            vault_code_hash: vault_code_hash.unwrap_or_default(),
            vault_wasm: Vec::new(),
            seat_price: seat_price.0,
            vault_initial_balance: vault_initial_balance.0,
            royalty_bps: royalty,
            max_seats: max_seats.unwrap_or(1_000),
            max_listing_ttl_sec: max_listing_ttl_sec.unwrap_or(30 * 24 * 60 * 60),
            default_bps: bps,
            acc: Accumulator::default(),
            total_claimed: 0,
            tickets_sold: 0,
            kas_klub_owed: 0,
            organizer_owed: 0,
            kas_klub_released: 0,
            organizer_released: 0,
            sales_count: 0,
            sales_volume: 0,
            royalties_total: 0,
            next_seat_number: 0,
            seat_order: Vec::new(),
            seats: BTreeMap::new(),
            pending_mints: BTreeMap::new(),
            events: Vec::new(),
            accrual_log: Vec::new(),
            tickets_by_account: BTreeMap::new(),
            refunds: BTreeMap::new(),
            proceeds: BTreeMap::new(),
            sales_log: Vec::new(),
        }
    }

    /// One-time setup call during deployment (before parent keys are deleted / sealed):
    /// pins the compiled `pusaka-vault` WASM bytes and computes its SHA-256 `vault_code_hash`
    /// (Base58) on-chain so it can never be forged or replaced once set.
    pub fn pin_vault_wasm(&mut self, #[serializer(borsh)] wasm_bytes: Vec<u8>) -> String {
        if env::predecessor_account_id() != env::current_account_id()
            && env::predecessor_account_id() != self.organizer_id
        {
            abort_with("E_ONLY_ORGANIZER: only deployer/organizer may pin vault wasm");
        }
        if !self.vault_wasm.is_empty() {
            abort_with("E_UNSUPPORTED: vault wasm is already pinned and immutable");
        }
        if wasm_bytes.is_empty() {
            abort_core(CoreError::InvalidAmount);
        }
        let digest = env::sha256(&wasm_bytes);
        let hash_b58 = near_sdk::bs58::encode(&digest).into_string();
        self.vault_code_hash = hash_b58.clone();
        self.vault_wasm = wasm_bytes;
        hash_b58
    }

    // -------------------------------------------------------------------------
    // NEP-171 / NEP-177 / NEP-181 Views
    // -------------------------------------------------------------------------

    pub fn nft_metadata(&self) -> NftContractMetadata {
        NftContractMetadata {
            spec: "nft-2.0.0".to_string(),
            name: "Pusaka Membership".to_string(),
            symbol: "PUSAKA".to_string(),
            icon: Some(
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%230B0E1A'/><path d='M32 8L42 24L32 56L22 24Z' fill='none' stroke='%23D4A64A' stroke-width='3'/><circle cx='32' cy='24' r='4' fill='%23F3C969'/></svg>".to_string(),
            ),
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    pub fn nft_token(&self, token_id: AccountId) -> Option<JsonToken> {
        self.seats.get(&token_id).map(|s| self.to_json_token(s))
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.seats.len() as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let start = from_index.map(|x| x.0 as usize).unwrap_or(0);
        let lim = limit.unwrap_or(50).min(100) as usize;
        self.seat_order
            .iter()
            .skip(start)
            .take(lim)
            .filter_map(|id| self.seats.get(id))
            .map(|s| self.to_json_token(s))
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        let count = self
            .seats
            .values()
            .filter(|s| s.index.owner == account_id.as_str())
            .count();
        U128(count as u128)
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let start = from_index.map(|x| x.0 as usize).unwrap_or(0);
        let lim = limit.unwrap_or(50).min(100) as usize;
        self.seat_order
            .iter()
            .filter_map(|id| self.seats.get(id))
            .filter(|s| s.index.owner == account_id.as_str())
            .skip(start)
            .take(lim)
            .map(|s| self.to_json_token(s))
            .collect()
    }

    // -------------------------------------------------------------------------
    // Pusaka Views (docs/API.md)
    // -------------------------------------------------------------------------

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            registry_id: env::current_account_id(),
            organizer_id: self.organizer_id.clone(),
            kas_klub_id: self.kas_klub_id.clone(),
            vault_code_hash: self.vault_code_hash.clone(),
            seat_price: U128(self.seat_price),
            vault_initial_balance: U128(self.vault_initial_balance),
            royalty_bps: self.royalty_bps,
            max_seats: self.max_seats,
            max_listing_ttl_sec: self.max_listing_ttl_sec,
            default_bps: self.default_bps.into(),
        }
    }

    pub fn get_stats(&self) -> StatsView {
        StatsView {
            seats_minted: self.seats.len() as u64,
            acc: U128(self.acc.acc),
            carry: U128(self.acc.carry),
            total_pool_distributed: U128(self.acc.total_distributed),
            total_claimed: U128(self.total_claimed),
            tickets_sold: self.tickets_sold,
            events_count: self.events.len() as u64,
            kas_klub_owed: U128(self.kas_klub_owed),
            organizer_owed: U128(self.organizer_owed),
            kas_klub_released: U128(self.kas_klub_released),
            organizer_released: U128(self.organizer_released),
            sales_count: self.sales_count,
            sales_volume: U128(self.sales_volume),
            royalties_total: U128(self.royalties_total),
        }
    }

    pub fn get_seat(&self, token_id: AccountId) -> Option<SeatView> {
        let s = self.seats.get(&token_id)?;
        Some(self.to_seat_view(s))
    }

    pub fn get_seat_history(&self, token_id: AccountId, limit: Option<u64>) -> SeatHistoryView {
        let Some(s) = self.seats.get(&token_id) else {
            return SeatHistoryView {
                holders: Vec::new(),
                claims: Vec::new(),
                earnings: Vec::new(),
            };
        };
        let lim = limit.unwrap_or(100).min(200) as usize;
        let start_idx = (s.mint_accrual_index as usize).min(self.accrual_log.len());
        let earnings: Vec<EarningRecord> = self.accrual_log[start_idx..]
            .iter()
            .rev()
            .take(lim)
            .cloned()
            .collect();
        SeatHistoryView {
            holders: s.holders.iter().rev().take(lim).cloned().collect(),
            claims: s.claims.iter().rev().take(lim).cloned().collect(),
            earnings,
        }
    }

    pub fn get_listings(&self) -> Vec<ListingView> {
        let now = env::block_timestamp();
        self.seat_order
            .iter()
            .filter_map(|id| self.seats.get(id))
            .filter_map(|s| {
                s.index
                    .live_listing(now)
                    .map(|m| ListingView::from_mirror(&s.token_id, m))
            })
            .collect()
    }

    pub fn get_events(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<EventView> {
        let start = from_index.unwrap_or(0) as usize;
        let lim = limit.unwrap_or(50).min(100) as usize;
        self.events
            .iter()
            .skip(start)
            .take(lim)
            .map(|e| EventView {
                id: e.id,
                name: e.name.clone(),
                price: U128(e.price),
                member_discount_bps: e.member_discount_bps,
                capacity: e.capacity,
                sold: e.sold,
                starts_at_ms: e.starts_at_ms,
                created_at_ms: e.created_at_ms,
                bps: e.bps.into(),
            })
            .collect()
    }

    pub fn get_tickets(&self, account_id: AccountId) -> Vec<TicketHoldingView> {
        self.tickets_by_account
            .get(&account_id)
            .map(|m| {
                m.iter()
                    .map(|(&event_id, &count)| TicketHoldingView { event_id, count })
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_ledgers(&self, account_id: AccountId) -> LedgerView {
        LedgerView {
            refund: U128(self.refunds.get(&account_id).copied().unwrap_or(0)),
            proceeds: U128(self.proceeds.get(&account_id).copied().unwrap_or(0)),
        }
    }

    pub fn get_sales(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<SaleRecord> {
        let start = from_index.unwrap_or(0) as usize;
        let lim = limit.unwrap_or(50).min(100) as usize;
        self.sales_log
            .iter()
            .rev()
            .skip(start)
            .take(lim)
            .cloned()
            .collect()
    }

    pub fn ticket_price_for(&self, event_id: u64, account_id: AccountId) -> U128 {
        let ev = self
            .events
            .get(event_id as usize)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: unknown event_id"));
        let is_holder = self
            .seats
            .values()
            .any(|s| s.index.owner == account_id.as_str());
        if is_holder && ev.member_discount_bps > 0 {
            let discount = apply_bps(ev.price, ev.member_discount_bps);
            U128(ev.price.saturating_sub(discount))
        } else {
            U128(ev.price)
        }
    }

    // -------------------------------------------------------------------------
    // Minting & NEP-171 Transfers
    // -------------------------------------------------------------------------

    /// Mints a new seat NFT and creates its keyless vault sub-account (`sNNN.<registry>` or
    /// `<handle>.<registry>`) in a single atomic batch receipt.
    #[payable]
    pub fn mint_seat(
        &mut self,
        receiver_id: Option<AccountId>,
        handle: Option<String>,
    ) -> Promise {
        if self.vault_wasm.is_empty() {
            abort_with("E_UNSUPPORTED: vault wasm has not been pinned yet");
        }
        let paid = env::attached_deposit().as_yoctonear();
        if paid != self.seat_price {
            abort_with("E_DEPOSIT: attached deposit must equal seat_price");
        }
        let active_plus_pending = (self.seats.len() + self.pending_mints.len()) as u64;
        if active_plus_pending >= self.max_seats {
            abort_with("E_MAX_SEATS: maximum number of seats reached");
        }

        let caller = env::predecessor_account_id();
        let owner = receiver_id.unwrap_or_else(|| caller.clone());
        self.next_seat_number += 1;
        let number = self.next_seat_number;

        let clean_handle = handle.and_then(|h| {
            let trimmed = h.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });
        let label = match &clean_handle {
            Some(h) => {
                validate_handle(h);
                h.clone()
            }
            None => format!("s{number:03}"),
        };

        let seat_account: AccountId = format!("{label}.{}", env::current_account_id())
            .parse()
            .unwrap_or_else(|_| abort_with("E_BAD_HANDLE: invalid sub-account id"));
        if self.seats.contains_key(&seat_account)
            || self.pending_mints.contains_key(&seat_account)
        {
            abort_with("E_BAD_HANDLE: seat sub-account already exists");
        }
        self.pending_mints.insert(seat_account.clone(), true);

        let init_args = serde_json::to_vec(&serde_json::json!({
            "owner_id": owner,
            "storage_reserve": U128(DEFAULT_STORAGE_RESERVE),
        }))
        .unwrap();

        // K1: Single atomic batch receipt on the sub-account — CreateAccount, Transfer,
        // DeployContract, FunctionCall("init"). Zero AddKey actions!
        Promise::new(seat_account.clone())
            .create_account()
            .transfer(NearToken::from_yoctonear(self.vault_initial_balance))
            .deploy_contract(self.vault_wasm.clone())
            .function_call(
                "init".to_string(),
                init_args,
                NearToken::from_yoctonear(0),
                GAS_MINT_INIT,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_mint_seat(seat_account, number, clean_handle, owner, caller, U128(paid)),
            )
    }

    #[private]
    pub fn on_mint_seat(
        &mut self,
        seat_account: AccountId,
        number: u64,
        handle: Option<String>,
        owner: AccountId,
        payer: AccountId,
        paid: U128,
        #[callback_result] res: Result<(), PromiseError>,
    ) -> Option<SeatView> {
        self.pending_mints.remove(&seat_account);
        if res.is_err() {
            // Sub-account creation failed; full paid deposit returns to payer via pull refund.
            *self.refunds.entry(payer).or_insert(0) += paid.0;
            return None;
        }
        // Net mint revenue above the vault's initial balance goes to Kas Klub (80%) and Organizer (20%).
        let net_mint = paid.0.saturating_sub(self.vault_initial_balance);
        let org_cut = apply_bps(net_mint, 2_000);
        let kas_cut = net_mint.saturating_sub(org_cut);
        self.kas_klub_owed += kas_cut;
        self.organizer_owed += org_cut;

        let now_ms = env::block_timestamp_ms();
        let rec = SeatRecord {
            token_id: seat_account.clone(),
            number,
            handle,
            index: IndexEntry::new(owner.as_str()),
            checkpoint: self.acc.acc,
            total_claimed: 0,
            minted_at_ms: now_ms,
            mint_accrual_index: self.accrual_log.len() as u64,
            holders: vec![HolderRecord {
                owner_id: owner.clone(),
                since_ms: now_ms,
                seq: 0,
                via: "mint".to_string(),
                price: Some(paid),
            }],
            claims: Vec::new(),
        };
        let view = self.to_seat_view(&rec);
        self.seat_order.push(seat_account.clone());
        self.seats.insert(seat_account.clone(), rec);

        emit_nep297(
            "nep171",
            "1.0.0",
            "nft_mint",
            serde_json::json!({
                "owner_id": owner,
                "token_ids": [seat_account],
            }),
        );
        Some(view)
    }

    /// Standard NEP-171 transfer. Routes through `vault.v_rotate` so ownership moves atomically
    /// inside the seat vault first, then updates the registry index in the callback.
    #[payable]
    #[allow(unused_variables)]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: AccountId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) -> Promise {
        require_one_yocto();
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp();
        let seat = self
            .seats
            .get(&token_id)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: seat does not exist"));

        if seat.index.owner != caller.as_str() {
            abort_core(CoreError::NotOwner);
        }
        if receiver_id == caller {
            abort_core(CoreError::SelfTransfer);
        }
        if seat.index.live_listing(now).is_some() {
            abort_core(CoreError::NotIdle);
        }
        let expected_seq = seat.index.seq;

        ext_vault::ext(token_id.clone())
            .with_static_gas(GAS_VAULT_CALL)
            .v_rotate(caller.clone(), receiver_id.clone(), expected_seq)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_rotated(token_id, caller, receiver_id, memo),
            )
    }

    #[private]
    pub fn on_rotated(
        &mut self,
        token_id: AccountId,
        from: AccountId,
        to: AccountId,
        memo: Option<String>,
        #[callback_result] res: Result<RotationReceipt, PromiseError>,
    ) -> bool {
        let Ok(receipt) = res else {
            return false;
        };
        let Some(seat) = self.seats.get_mut(&token_id) else {
            return false;
        };
        if seat
            .index
            .apply_rotation(receipt.owner_id.as_str(), receipt.rotation_seq)
        {
            seat.holders.push(HolderRecord {
                owner_id: receipt.owner_id.clone(),
                since_ms: env::block_timestamp_ms(),
                seq: receipt.rotation_seq,
                via: "transfer".to_string(),
                price: None,
            });
            emit_nep297(
                "nep171",
                "1.0.0",
                "nft_transfer",
                serde_json::json!({
                    "old_owner_id": from,
                    "new_owner_id": to,
                    "token_ids": [token_id],
                    "memo": memo,
                }),
            );
            true
        } else {
            false
        }
    }

    /// Explicitly disabled (design decision K5): a receiver callback (`nft_on_transfer`) could
    /// spend from the seat vault and then request a rollback of the NFT transfer.
    #[payable]
    #[allow(unused_variables)]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: AccountId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) {
        abort_with("E_UNSUPPORTED: nft_transfer_call is disabled by design (K5)");
    }

    // -------------------------------------------------------------------------
    // Safe Secondary Market (list_seat, cancel_listing, buy_seat, sync)
    // -------------------------------------------------------------------------

    #[payable]
    pub fn list_seat(
        &mut self,
        token_id: AccountId,
        price: U128,
        min_balance: U128,
        ttl_sec: u64,
    ) -> Promise {
        require_one_yocto();
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp();
        let seat = self
            .seats
            .get(&token_id)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: seat does not exist"));

        if seat.index.owner != caller.as_str() {
            abort_core(CoreError::NotOwner);
        }
        if seat.index.live_listing(now).is_some() {
            abort_core(CoreError::NotIdle);
        }
        if price.0 == 0 {
            abort_core(CoreError::InvalidAmount);
        }
        if ttl_sec == 0 || ttl_sec > self.max_listing_ttl_sec {
            abort_core(CoreError::TtlOutOfRange);
        }
        let expected_seq = seat.index.seq;

        ext_vault::ext(token_id.clone())
            .with_static_gas(GAS_VAULT_CALL)
            .v_list(caller.clone(), price, min_balance, ttl_sec)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_listed(token_id, caller, expected_seq),
            )
    }

    #[private]
    pub fn on_listed(
        &mut self,
        token_id: AccountId,
        seller: AccountId,
        expected_seq: u64,
        #[callback_result] res: Result<VaultListingDto, PromiseError>,
    ) -> Option<ListingView> {
        let Ok(dto) = res else {
            return None;
        };
        let seat = self.seats.get_mut(&token_id)?;
        if seat.index.seq != expected_seq || seat.index.owner != seller.as_str() {
            return None;
        }
        let mirror = ListingMirror {
            price: dto.price.0,
            min_balance: dto.min_balance.0,
            expires_at: dto.expires_at_ms.saturating_mul(1_000_000),
            nonce: dto.nonce,
            seller: seller.to_string(),
        };
        let view = ListingView::from_mirror(&token_id, &mirror);
        seat.index.listing = Some(mirror);
        emit_nep297(
            "pusaka",
            "1.0.0",
            "seat_listed",
            serde_json::json!({
                "token_id": token_id,
                "seller": seller,
                "price": dto.price,
                "min_balance": dto.min_balance,
                "nonce": dto.nonce,
                "expires_at_ms": dto.expires_at_ms,
            }),
        );
        Some(view)
    }

    #[payable]
    pub fn cancel_listing(&mut self, token_id: AccountId) -> Promise {
        require_one_yocto();
        let caller = env::predecessor_account_id();
        let seat = self
            .seats
            .get(&token_id)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: seat does not exist"));
        if seat.index.owner != caller.as_str() {
            abort_core(CoreError::NotOwner);
        }
        let expected_seq = seat.index.seq;

        ext_vault::ext(token_id.clone())
            .with_static_gas(GAS_VAULT_CALL)
            .v_cancel(caller)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_canceled(token_id, expected_seq),
            )
    }

    #[private]
    pub fn on_canceled(
        &mut self,
        token_id: AccountId,
        expected_seq: u64,
        #[callback_result] res: Result<bool, PromiseError>,
    ) -> bool {
        if !matches!(res, Ok(true)) {
            return false;
        }
        let Some(seat) = self.seats.get_mut(&token_id) else {
            return false;
        };
        if seat.index.seq == expected_seq {
            seat.index.listing = None;
            emit_nep297(
                "pusaka",
                "1.0.0",
                "seat_unlisted",
                serde_json::json!({ "token_id": token_id }),
            );
            true
        } else {
            false
        }
    }

    /// Escrows the purchase price and invokes `vault.v_settle_sale` to verify `nonce`, liveness,
    /// and `withdrawable >= max(listing.min_balance, buyer.min_balance)` in the same receipt that
    /// rotates vault ownership to `buyer`.
    #[payable]
    pub fn buy_seat(&mut self, token_id: AccountId, nonce: u64, min_balance: U128) -> Promise {
        let buyer = env::predecessor_account_id();
        let paid = env::attached_deposit().as_yoctonear();
        let now = env::block_timestamp();
        let seat = self
            .seats
            .get(&token_id)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: seat does not exist"));

        let Some(mirror) = seat.index.live_listing(now) else {
            abort_core(CoreError::NotListed);
        };
        if mirror.nonce != nonce {
            abort_core(CoreError::NonceMismatch {
                expected: nonce,
                actual: mirror.nonce,
            });
        }
        if paid != mirror.price {
            abort_core(CoreError::PriceMismatch);
        }
        if buyer.as_str() == mirror.seller {
            abort_core(CoreError::BuyerIsSeller);
        }

        ext_vault::ext(token_id.clone())
            .with_static_gas(GAS_VAULT_CALL)
            .v_settle_sale(buyer.clone(), nonce, U128(paid), min_balance)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_sale_settled(token_id, buyer, U128(paid)),
            )
    }

    #[private]
    pub fn on_sale_settled(
        &mut self,
        token_id: AccountId,
        buyer: AccountId,
        paid: U128,
        #[callback_result] res: Result<SaleSettlementDto, PromiseError>,
    ) -> bool {
        match res {
            Ok(settled) => {
                let royalty = apply_bps(paid.0, self.royalty_bps);
                let net = paid.0.saturating_sub(royalty);
                self.kas_klub_owed += royalty;
                *self.proceeds.entry(settled.proceeds_to.clone()).or_insert(0) += net;

                self.sales_count += 1;
                self.sales_volume = self.sales_volume.saturating_add(paid.0);
                self.royalties_total = self.royalties_total.saturating_add(royalty);

                let now_ms = env::block_timestamp_ms();
                if let Some(seat) = self.seats.get_mut(&token_id) {
                    seat.index.apply_rotation(buyer.as_str(), settled.new_seq);
                    seat.holders.push(HolderRecord {
                        owner_id: buyer.clone(),
                        since_ms: now_ms,
                        seq: settled.new_seq,
                        via: "sale".to_string(),
                        price: Some(paid),
                    });
                }
                self.sales_log.push(SaleRecord {
                    token_id: token_id.clone(),
                    seller: settled.seller.clone(),
                    buyer: buyer.clone(),
                    price: paid,
                    royalty: U128(royalty),
                    at_ms: now_ms,
                });
                emit_nep297(
                    "nep171",
                    "1.0.0",
                    "nft_transfer",
                    serde_json::json!({
                        "old_owner_id": settled.seller,
                        "new_owner_id": buyer,
                        "token_ids": [token_id],
                        "memo": format!("safe_sale:price={},royalty={}", paid.0, royalty),
                    }),
                );
                true
            }
            Err(_) => {
                // Settlement rejected in vault (e.g. balance below guard, expired, or race lost):
                // 100% of buyer's deposit is credited to their pull refund ledger.
                *self.refunds.entry(buyer.clone()).or_insert(0) += paid.0;
                emit_nep297(
                    "pusaka",
                    "1.0.0",
                    "sale_refunded",
                    serde_json::json!({
                        "token_id": token_id,
                        "buyer": buyer,
                        "amount": paid,
                    }),
                );
                false
            }
        }
    }

    /// Permissionless reconciliation (`K8`): reads `vault_state()` and advances the index if the
    /// vault's `rotation_seq` is ahead. Never rolls ownership backwards.
    pub fn sync(&mut self, token_id: AccountId) -> Promise {
        if !self.seats.contains_key(&token_id) {
            abort_with("E_UNKNOWN_TOKEN: seat does not exist");
        }
        ext_vault::ext(token_id.clone())
            .with_static_gas(GAS_VAULT_CALL)
            .vault_state()
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_sync(token_id),
            )
    }

    #[private]
    pub fn on_sync(
        &mut self,
        token_id: AccountId,
        #[callback_result] res: Result<VaultStateDto, PromiseError>,
    ) -> String {
        let Ok(state) = res else {
            return "error".to_string();
        };
        let Some(seat) = self.seats.get_mut(&token_id) else {
            return "missing".to_string();
        };
        let snap = VaultSnapshot {
            owner: state.owner_id.to_string(),
            rotation_seq: state.rotation_seq,
            listing: state.listing.map(|l| Listing {
                price: l.price.0,
                min_balance: l.min_balance.0,
                expires_at: l.expires_at_ms.saturating_mul(1_000_000),
                proceeds_to: l.proceeds_to.to_string(),
                nonce: l.nonce,
            }),
        };
        match seat.index.reconcile(&snap, env::block_timestamp()) {
            SyncOutcome::Advanced {
                from_owner,
                to_owner,
            } => {
                seat.holders.push(HolderRecord {
                    owner_id: to_owner.parse().unwrap(),
                    since_ms: env::block_timestamp_ms(),
                    seq: state.rotation_seq,
                    via: "sync".to_string(),
                    price: None,
                });
                emit_nep297(
                    "nep171",
                    "1.0.0",
                    "nft_transfer",
                    serde_json::json!({
                        "old_owner_id": from_owner,
                        "new_owner_id": to_owner,
                        "token_ids": [token_id],
                        "memo": "sync",
                    }),
                );
                "advanced".to_string()
            }
            SyncOutcome::Refreshed => "refreshed".to_string(),
            SyncOutcome::Unchanged => "unchanged".to_string(),
            SyncOutcome::Divergent => "divergent".to_string(),
        }
    }

    // -------------------------------------------------------------------------
    // Events, Ticket Sales & Member Pool Claims
    // -------------------------------------------------------------------------

    pub fn create_event(
        &mut self,
        name: String,
        price: U128,
        capacity: u64,
        starts_at_ms: u64,
        member_discount_bps: Option<u16>,
    ) -> u64 {
        if env::predecessor_account_id() != self.organizer_id {
            abort_with("E_ONLY_ORGANIZER: only organizer may create events");
        }
        let clean = name.trim().to_string();
        if clean.is_empty() || price.0 == 0 || capacity == 0 {
            abort_core(CoreError::InvalidAmount);
        }
        let discount = member_discount_bps.unwrap_or(1_000); // default 10% member discount
        if discount > BPS_DENOMINATOR {
            abort_core(CoreError::InvalidBps);
        }
        let id = self.events.len() as u64;
        self.events.push(EventRecord {
            id,
            name: clean.clone(),
            price: price.0,
            member_discount_bps: discount,
            capacity,
            sold: 0,
            starts_at_ms,
            created_at_ms: env::block_timestamp_ms(),
            bps: self.default_bps,
        });
        emit_nep297(
            "pusaka",
            "1.0.0",
            "event_created",
            serde_json::json!({
                "event_id": id,
                "name": clean,
                "price": price,
                "capacity": capacity,
            }),
        );
        id
    }

    #[payable]
    pub fn buy_ticket(&mut self, event_id: u64) -> u64 {
        let buyer = env::predecessor_account_id();
        let paid = env::attached_deposit().as_yoctonear();
        let expected = self.ticket_price_for(event_id, buyer.clone()).0;
        let seats_minted = self.seats.len() as u64;

        let ev = self
            .events
            .get_mut(event_id as usize)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: unknown event_id"));
        if ev.sold >= ev.capacity {
            abort_with("E_SOLD_OUT: event is sold out");
        }
        if paid != expected {
            abort_core(CoreError::PriceMismatch);
        }
        ev.sold += 1;
        let split = ev.bps.split(paid);

        let dist = match self.acc.distribute(split.pool, seats_minted) {
            Ok(d) => d,
            Err(e) => abort_core(e),
        };
        self.kas_klub_owed += split.kas + dist.to_treasury;
        self.organizer_owed += split.organizer;
        self.tickets_sold += 1;

        if dist.per_seat > 0 {
            self.accrual_log.push(EarningRecord {
                at_ms: env::block_timestamp_ms(),
                event_id,
                per_seat: U128(dist.per_seat),
                seats: dist.seats,
            });
        }

        let user_tickets = self.tickets_by_account.entry(buyer.clone()).or_default();
        let count = user_tickets.entry(event_id).or_insert(0);
        *count += 1;
        let out_count = *count;

        emit_nep297(
            "pusaka",
            "1.0.0",
            "ticket_bought",
            serde_json::json!({
                "event_id": event_id,
                "buyer": buyer,
                "paid": U128(paid),
                "per_seat": U128(dist.per_seat),
                "seats": dist.seats,
            }),
        );
        out_count
    }

    /// Claims a seat's accrued share of the Member Pool and transfers it **directly to the seat
    /// sub-account** (`token_id`), never to any personal wallet. Callable by anyone.
    pub fn claim(&mut self, token_id: AccountId) -> Promise {
        let caller = env::predecessor_account_id();
        let seat = self
            .seats
            .get_mut(&token_id)
            .unwrap_or_else(|| abort_with("E_UNKNOWN_TOKEN: seat does not exist"));
        let amt = self.acc.claimable(seat.checkpoint);
        if amt == 0 {
            abort_with("E_NOTHING_TO_CLAIM: no accrued pool share to claim");
        }
        // Checks-effects-interactions: advance checkpoint before dispatching the Transfer receipt.
        seat.checkpoint = self.acc.acc;
        seat.total_claimed = seat.total_claimed.saturating_add(amt);
        self.total_claimed = self.total_claimed.saturating_add(amt);
        seat.claims.push(ClaimRecord {
            at_ms: env::block_timestamp_ms(),
            amount: U128(amt),
            by: caller.clone(),
        });

        emit_nep297(
            "pusaka",
            "1.0.0",
            "pool_claimed",
            serde_json::json!({
                "token_id": token_id,
                "amount": U128(amt),
                "by": caller,
            }),
        );
        Promise::new(token_id).transfer(NearToken::from_yoctonear(amt))
    }

    // -------------------------------------------------------------------------
    // Pull Ledgers (K10: all outbound payments from registry are pull)
    // -------------------------------------------------------------------------

    pub fn claim_refund(&mut self, account_id: Option<AccountId>) -> Promise {
        let target = account_id.unwrap_or_else(env::predecessor_account_id);
        let amt = self.refunds.remove(&target).unwrap_or(0);
        if amt == 0 {
            abort_with("E_NOTHING_TO_CLAIM: no refund owed");
        }
        Promise::new(target).transfer(NearToken::from_yoctonear(amt))
    }

    pub fn claim_proceeds(&mut self, account_id: Option<AccountId>) -> Promise {
        let target = account_id.unwrap_or_else(env::predecessor_account_id);
        let amt = self.proceeds.remove(&target).unwrap_or(0);
        if amt == 0 {
            abort_with("E_NOTHING_TO_CLAIM: no sale proceeds owed");
        }
        Promise::new(target).transfer(NearToken::from_yoctonear(amt))
    }

    pub fn release_kas_klub(&mut self) -> Promise {
        let amt = self.kas_klub_owed;
        if amt == 0 {
            abort_with("E_NOTHING_TO_CLAIM: Kas Klub ledger is zero");
        }
        self.kas_klub_owed = 0;
        self.kas_klub_released = self.kas_klub_released.saturating_add(amt);
        Promise::new(self.kas_klub_id.clone()).transfer(NearToken::from_yoctonear(amt))
    }

    pub fn release_organizer(&mut self) -> Promise {
        let amt = self.organizer_owed;
        if amt == 0 {
            abort_with("E_NOTHING_TO_CLAIM: organizer ledger is zero");
        }
        self.organizer_owed = 0;
        self.organizer_released = self.organizer_released.saturating_add(amt);
        Promise::new(self.organizer_id.clone()).transfer(NearToken::from_yoctonear(amt))
    }

    // -------------------------------------------------------------------------
    // Internal presentation helpers
    // -------------------------------------------------------------------------

    fn to_seat_view(&self, s: &SeatRecord) -> SeatView {
        let now = env::block_timestamp();
        let listing = s
            .index
            .live_listing(now)
            .map(|m| ListingView::from_mirror(&s.token_id, m));
        SeatView {
            token_id: s.token_id.clone(),
            number: s.number,
            handle: s.handle.clone(),
            owner_id: s.index.owner.parse().unwrap(),
            rotation_seq: s.index.seq,
            checkpoint: U128(s.checkpoint),
            claimable: U128(self.acc.claimable(s.checkpoint)),
            total_claimed: U128(s.total_claimed),
            minted_at_ms: s.minted_at_ms,
            holders_count: s.holders.len() as u64,
            listing,
        }
    }

    fn to_json_token(&self, s: &SeatRecord) -> JsonToken {
        let now = env::block_timestamp();
        let is_listed = s.index.live_listing(now).is_some();
        let status_label = if is_listed { "FROZEN (LISTED)" } else { "ACTIVE" };
        let claimable = self.acc.claimable(s.checkpoint);
        let svg = render_seat_svg(
            s.number,
            s.token_id.as_str(),
            &s.index.owner,
            s.index.seq,
            status_label,
            claimable,
        );
        let extra = serde_json::json!({
            "number": s.number,
            "handle": s.handle,
            "rotation_seq": s.index.seq,
            "status": if is_listed { "Frozen" } else { "Active" },
            "claimable": U128(claimable),
            "total_claimed": U128(s.total_claimed),
            "vault_code_hash": self.vault_code_hash,
        })
        .to_string();

        JsonToken {
            token_id: s.token_id.to_string(),
            owner_id: s.index.owner.parse().unwrap(),
            metadata: TokenMetadata {
                title: Some(format!("Pusaka Seat #{:03} ({})", s.number, s.token_id)),
                description: Some(
                    "Keyless NEAR membership seat that carries its own sub-account wallet, treasury pool share, and safe-sale vault.".to_string(),
                ),
                media: Some(svg),
                media_hash: None,
                copies: Some(1),
                issued_at: Some(s.minted_at_ms.to_string()),
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: Some(extra),
                reference: None,
                reference_hash: None,
            },
        }
    }
}

fn validate_handle(h: &str) {
    if h.len() < 2 || h.len() > 20 {
        abort_with("E_BAD_HANDLE: handle must be 2..=20 characters");
    }
    if h.starts_with('-') || h.ends_with('-') {
        abort_with("E_BAD_HANDLE: handle cannot start or end with '-'");
    }
    if !h
        .bytes()
        .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
    {
        abort_with("E_BAD_HANDLE: handle must contain only [a-z0-9-]");
    }
    // Disallow `s` followed only by digits so custom handles never collide with numbered `sNNN`.
    if h.starts_with('s') && h[1..].bytes().all(|b| b.is_ascii_digit()) {
        abort_with("E_BAD_HANDLE: handle prefix s<digits> is reserved for numbered seats");
    }
}

fn format_near_short(yocto: u128) -> String {
    let whole = yocto / 10u128.pow(24);
    let frac = (yocto % 10u128.pow(24)) / 10u128.pow(22);
    format!("{whole}.{frac:02} N")
}

fn render_seat_svg(
    number: u64,
    token_id: &str,
    owner: &str,
    seq: u64,
    status: &str,
    claimable: u128,
) -> String {
    let claim_str = format_near_short(claimable);
    format!(
        "data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 260'>\
<defs>\
<linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>\
<stop offset='0%' stop-color='%23090B14'/>\
<stop offset='100%' stop-color='%2313182E'/>\
</linearGradient>\
</defs>\
<rect width='420' height='260' rx='18' fill='url(%23bg)' stroke='%23D4A64A' stroke-width='2'/>\
<rect x='14' y='14' width='392' height='232' rx='12' fill='none' stroke='%23D4A64A' stroke-opacity='0.35' stroke-dasharray='4 4'/>\
<text x='30' y='46' fill='%23F3C969' font-family='serif' font-size='20' font-weight='bold'>PUSAKA SEAT %23{number:03}</text>\
<text x='390' y='44' text-anchor='end' fill='%2310B981' font-family='monospace' font-size='11'>BUKTI TANPA KUNCI</text>\
<text x='30' y='74' fill='%23E2E8F0' font-family='monospace' font-size='13'>{token_id}</text>\
<line x1='30' y1='92' x2='390' y2='92' stroke='%23D4A64A' stroke-opacity='0.25'/>\
<text x='30' y='122' fill='%2394A3B8' font-family='sans-serif' font-size='11'>CANONICAL OWNER</text>\
<text x='30' y='142' fill='%23F8FAFC' font-family='monospace' font-size='13'>{owner}</text>\
<text x='30' y='178' fill='%2394A3B8' font-family='sans-serif' font-size='11'>ROTATION SEQ</text>\
<text x='30' y='198' fill='%23F3C969' font-family='monospace' font-size='14'>#{seq}</text>\
<text x='170' y='178' fill='%2394A3B8' font-family='sans-serif' font-size='11'>UNCLAIMED POOL</text>\
<text x='170' y='198' fill='%2310B981' font-family='monospace' font-size='14'>{claim_str}</text>\
<text x='310' y='178' fill='%2394A3B8' font-family='sans-serif' font-size='11'>VAULT STATUS</text>\
<text x='310' y='198' fill='%23F8FAFC' font-family='monospace' font-size='12'>{status}</text>\
<text x='30' y='232' fill='%2364748B' font-family='monospace' font-size='10'>sharded-item-1.0.0 · 0 access keys · atomic vault rotation</text>\
</svg>"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use pusaka_test_env::set_context;

    const NEAR: u128 = 10u128.pow(24);

    fn ctx(predecessor: &str, deposit: u128, ts_ns: u64) {
        set_context("pusaka.testnet", predecessor, deposit, 50 * NEAR, ts_ns);
    }

    fn setup_registry() -> RegistryContract {
        ctx("pusaka.testnet", 0, 1_000_000_000);
        let mut reg = RegistryContract::init(
            "org.testnet".parse().unwrap(),
            "kas.testnet".parse().unwrap(),
            U128(NEAR),
            U128(500_000_000_000_000_000_000_000), // 0.5 NEAR
            Some(500),
            Some(100),
            None,
            None,
            None,
        );
        reg.pin_vault_wasm(vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
        reg
    }

    #[test]
    fn unit_mint_event_ticket_and_claim_to_seat_vault() {
        let mut reg = setup_registry();
        let seat_id: AccountId = "s001.pusaka.testnet".parse().unwrap();
        reg.pending_mints.insert(seat_id.clone(), true);
        let view = reg
            .on_mint_seat(
                seat_id.clone(),
                1,
                None,
                "alice.testnet".parse().unwrap(),
                "alice.testnet".parse().unwrap(),
                U128(NEAR),
                Ok(()),
            )
            .unwrap();
        assert_eq!(view.owner_id.as_str(), "alice.testnet");

        // Organizer creates event for 2 NEAR
        ctx("org.testnet", 0, 2_000_000_000);
        let ev_id = reg.create_event("Batik Genesis Night".to_string(), U128(2 * NEAR), 50, 5_000, Some(1_000));

        // Non-member buys a ticket for 2 NEAR -> 40% (0.8 NEAR) goes to Pool Anggota
        ctx("fan.testnet", 2 * NEAR, 3_000_000_000);
        reg.buy_ticket(ev_id);

        let seat = reg.get_seat(seat_id.clone()).unwrap();
        assert_eq!(seat.claimable.0, 800_000_000_000_000_000_000_000);

        // Anyone triggers claim -> checkpoint advances and total_claimed updates
        ctx("stranger.testnet", 0, 4_000_000_000);
        let _ = reg.claim(seat_id.clone());
        let seat_after = reg.get_seat(seat_id.clone()).unwrap();
        assert_eq!(seat_after.claimable.0, 0);
        assert_eq!(seat_after.total_claimed.0, 800_000_000_000_000_000_000_000);
    }

    #[test]
    #[should_panic(expected = "E_UNSUPPORTED")]
    fn unit_nft_transfer_call_is_disabled() {
        let mut reg = setup_registry();
        ctx("alice.testnet", 1, 2_000_000_000);
        reg.nft_transfer_call(
            "bob.testnet".parse().unwrap(),
            "s001.pusaka.testnet".parse().unwrap(),
            None,
            None,
            "".to_string(),
        );
    }
}
