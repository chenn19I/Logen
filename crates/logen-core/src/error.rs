use core::fmt;

/// Every rejection in Logen maps to one stable code. Contracts panic with
/// `"<CODE>: <detail>"`, the Attack Lab matches on the code, and the README's threat
/// table names the same codes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoreError {
    NotOwner,
    WrongSeq { expected: u64, actual: u64 },
    NotIdle,
    NotListed,
    Frozen,
    NonceMismatch { expected: u64, actual: u64 },
    ListingExpired,
    PriceMismatch,
    InsufficientBalance { available: u128, required: u128 },
    SelfTransfer,
    InvalidAmount,
    NoDelegate,
    DelegateExpired,
    StaleDelegate,
    AllowanceExceeded,
    InvalidBps,
    TtlOutOfRange,
    BuyerIsSeller,
    Overflow,
}

impl CoreError {
    pub fn code(&self) -> &'static str {
        match self {
            CoreError::NotOwner => "E_NOT_OWNER",
            CoreError::WrongSeq { .. } => "E_WRONG_SEQ",
            CoreError::NotIdle => "E_NOT_IDLE",
            CoreError::NotListed => "E_NOT_LISTED",
            CoreError::Frozen => "E_FROZEN",
            CoreError::NonceMismatch { .. } => "E_NONCE_MISMATCH",
            CoreError::ListingExpired => "E_LISTING_EXPIRED",
            CoreError::PriceMismatch => "E_PRICE_MISMATCH",
            CoreError::InsufficientBalance { .. } => "E_INSUFFICIENT_BALANCE",
            CoreError::SelfTransfer => "E_SELF_TRANSFER",
            CoreError::InvalidAmount => "E_INVALID_AMOUNT",
            CoreError::NoDelegate => "E_NO_DELEGATE",
            CoreError::DelegateExpired => "E_DELEGATE_EXPIRED",
            CoreError::StaleDelegate => "E_STALE_DELEGATE",
            CoreError::AllowanceExceeded => "E_ALLOWANCE_EXCEEDED",
            CoreError::InvalidBps => "E_INVALID_BPS",
            CoreError::TtlOutOfRange => "E_TTL_OUT_OF_RANGE",
            CoreError::BuyerIsSeller => "E_BUYER_IS_SELLER",
            CoreError::Overflow => "E_OVERFLOW",
        }
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let code = self.code();
        match self {
            CoreError::NotOwner => write!(f, "{code}: caller is not the current seat owner"),
            CoreError::WrongSeq { expected, actual } => {
                write!(f, "{code}: expected rotation_seq {expected}, vault is at {actual}")
            }
            CoreError::NotIdle => write!(f, "{code}: seat is listed; cancel the listing first"),
            CoreError::NotListed => write!(f, "{code}: seat is not listed"),
            CoreError::Frozen => write!(f, "{code}: vault outflows are frozen while listed"),
            CoreError::NonceMismatch { expected, actual } => {
                write!(f, "{code}: listing nonce {actual} does not match expected {expected}")
            }
            CoreError::ListingExpired => write!(f, "{code}: listing has expired"),
            CoreError::PriceMismatch => write!(f, "{code}: price does not match the listing"),
            CoreError::InsufficientBalance { available, required } => write!(
                f,
                "{code}: vault withdrawable {available} is below required {required}"
            ),
            CoreError::SelfTransfer => write!(f, "{code}: receiver is already the owner"),
            CoreError::InvalidAmount => write!(f, "{code}: amount must be positive and available"),
            CoreError::NoDelegate => write!(f, "{code}: caller is neither owner nor delegate"),
            CoreError::DelegateExpired => write!(f, "{code}: delegate has expired"),
            CoreError::StaleDelegate => write!(f, "{code}: delegate belongs to a previous owner"),
            CoreError::AllowanceExceeded => write!(f, "{code}: delegate allowance exceeded"),
            CoreError::InvalidBps => write!(f, "{code}: basis points must sum to 10000"),
            CoreError::TtlOutOfRange => write!(f, "{code}: ttl must be between 1s and 30 days"),
            CoreError::BuyerIsSeller => write!(f, "{code}: seller cannot buy their own seat"),
            CoreError::Overflow => write!(f, "{code}: arithmetic overflow"),
        }
    }
}

pub type CoreResult<T> = Result<T, CoreError>;
