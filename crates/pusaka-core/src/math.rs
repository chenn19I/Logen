//! Overflow-safe arithmetic helpers.

use crate::{error::CoreError, Balance, BPS_DENOMINATOR};

/// `amount * bps / 10_000`, exact floor, without overflowing u128 for any `amount`.
///
/// Writes `amount = q * 10_000 + r`; then `amount * bps / 10_000 = q * bps + (r * bps) / 10_000`
/// exactly, because `q * bps` is an integer.
pub fn apply_bps(amount: Balance, bps: u16) -> Balance {
    let d = BPS_DENOMINATOR as u128;
    let b = bps as u128;
    let q = amount / d;
    let r = amount % d;
    q * b + (r * b) / d
}

pub fn add(a: Balance, b: Balance) -> Result<Balance, CoreError> {
    a.checked_add(b).ok_or(CoreError::Overflow)
}

pub fn sub(a: Balance, b: Balance) -> Result<Balance, CoreError> {
    a.checked_sub(b).ok_or(CoreError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_bps_matches_naive_when_no_overflow() {
        for amount in [0u128, 1, 9_999, 10_000, 10_001, 123_456_789, 10u128.pow(24) + 7] {
            for bps in [0u16, 1, 1_000, 4_000, 5_000, 9_999, 10_000] {
                assert_eq!(apply_bps(amount, bps), amount * bps as u128 / 10_000);
            }
        }
    }

    #[test]
    fn apply_bps_never_overflows() {
        assert_eq!(apply_bps(u128::MAX, 10_000), u128::MAX);
        let half = apply_bps(u128::MAX, 5_000);
        assert!(half <= u128::MAX / 2 + 1);
    }
}
