//! Ticket revenue split (Pool Anggota / Kas Klub / Organizer), frozen per event.

use crate::{error::CoreError, math::apply_bps, Balance, BPS_DENOMINATOR};

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bps {
    /// Member pool, shared equally by every minted seat (default 40%).
    pub pool: u16,
    /// Club treasury ledger (default 50%). Also absorbs rounding dust.
    pub kas: u16,
    /// Organizer ledger (default 10%).
    pub organizer: u16,
}

impl Default for Bps {
    fn default() -> Self {
        Bps { pool: 4_000, kas: 5_000, organizer: 1_000 }
    }
}

/// Result of splitting one payment.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Split {
    pub pool: Balance,
    pub kas: Balance,
    pub organizer: Balance,
}

impl Bps {
    pub fn validate(&self) -> Result<(), CoreError> {
        let sum = self.pool as u32 + self.kas as u32 + self.organizer as u32;
        if sum != BPS_DENOMINATOR as u32 {
            return Err(CoreError::InvalidBps);
        }
        Ok(())
    }

    /// Splits `amount`; the three parts always sum to exactly `amount` (dust goes to Kas Klub).
    pub fn split(&self, amount: Balance) -> Split {
        let pool = apply_bps(amount, self.pool);
        let organizer = apply_bps(amount, self.organizer);
        let kas = amount - pool - organizer;
        Split { pool, kas, organizer }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_valid_and_conserves() {
        let b = Bps::default();
        b.validate().unwrap();
        for amount in [0u128, 1, 3, 7, 10_000, 999_999_999_999, 10u128.pow(24), u128::MAX] {
            let s = b.split(amount);
            assert_eq!(s.pool + s.kas + s.organizer, amount);
            assert!(s.pool <= amount && s.organizer <= s.pool);
        }
    }

    #[test]
    fn rejects_bad_bps() {
        assert_eq!(Bps { pool: 5_000, kas: 5_000, organizer: 1 }.validate(), Err(CoreError::InvalidBps));
        assert_eq!(Bps { pool: 0, kas: 0, organizer: 0 }.validate(), Err(CoreError::InvalidBps));
    }
}
