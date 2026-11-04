//! Member-pool accumulator (design decision K3).
//!
//! Every ticket adds `pool / seats` yocto to `acc` (O(1), no loop over members). A seat's
//! claimable amount is `acc - checkpoint`, where the checkpoint is set to `acc` at mint and
//! at every claim. There is **no scaling factor**: a 10^24 factor on u128 overflows for
//! amounts above ~3.4 * 10^14 yocto. Instead the division remainder is carried into the next
//! ticket, so not a single yocto is lost or created.

use crate::{error::CoreError, Balance};

#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Accumulator {
    /// Cumulative yocto credited per seat since genesis.
    pub acc: Balance,
    /// Undistributed remainder carried to the next distribution.
    pub carry: Balance,
    /// Total yocto credited to seats (sum over distributions of `per_seat * seats`).
    pub total_distributed: Balance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Distribution {
    pub per_seat: Balance,
    pub seats: u64,
    /// Amount that could not go to seats (no seat minted yet) and is redirected to Kas Klub.
    pub to_treasury: Balance,
    pub acc_after: Balance,
}

impl Accumulator {
    /// Distributes `pool` across `seats` minted seats.
    pub fn distribute(&mut self, pool: Balance, seats: u64) -> Result<Distribution, CoreError> {
        if seats == 0 {
            return Ok(Distribution { per_seat: 0, seats: 0, to_treasury: pool, acc_after: self.acc });
        }
        let total = self.carry.checked_add(pool).ok_or(CoreError::Overflow)?;
        let n = seats as u128;
        let per_seat = total / n;
        let carry = total % n;
        let acc = self.acc.checked_add(per_seat).ok_or(CoreError::Overflow)?;
        let dist = per_seat.checked_mul(n).ok_or(CoreError::Overflow)?;
        self.total_distributed = self.total_distributed.checked_add(dist).ok_or(CoreError::Overflow)?;
        self.acc = acc;
        self.carry = carry;
        Ok(Distribution { per_seat, seats, to_treasury: 0, acc_after: acc })
    }

    /// Amount a seat with `checkpoint` may claim right now.
    pub fn claimable(&self, checkpoint: Balance) -> Balance {
        self.acc.saturating_sub(checkpoint)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tiny deterministic PRNG so the crate stays dependency-free.
    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
    }

    #[test]
    fn zero_seats_goes_to_treasury() {
        let mut a = Accumulator::default();
        let d = a.distribute(1_000, 0).unwrap();
        assert_eq!(d.to_treasury, 1_000);
        assert_eq!(a.acc, 0);
        assert_eq!(a.carry, 0);
    }

    #[test]
    fn remainder_is_carried() {
        let mut a = Accumulator::default();
        a.distribute(10, 3).unwrap(); // 3 each, carry 1
        assert_eq!((a.acc, a.carry), (3, 1));
        a.distribute(2, 3).unwrap(); // (1 + 2) / 3 = 1 each, carry 0
        assert_eq!((a.acc, a.carry), (4, 0));
    }

    #[test]
    fn huge_amounts_do_not_overflow() {
        let mut a = Accumulator::default();
        // 1 billion NEAR in one ticket, 1 seat.
        a.distribute(10u128.pow(33), 1).unwrap();
        assert_eq!(a.claimable(0), 10u128.pow(33));
    }

    /// Property: with seats minted at arbitrary times and claims at arbitrary times,
    /// sum(claimed) + sum(outstanding claimable) + carry + to_treasury == sum(pools).
    #[test]
    fn conservation_property_randomized() {
        for seed in 1..200u64 {
            let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15));
            let mut a = Accumulator::default();
            let mut checkpoints: Vec<Balance> = Vec::new();
            let mut claimed: Balance = 0;
            let mut treasury: Balance = 0;
            let mut paid_in: Balance = 0;
            for _ in 0..300 {
                match rng.next() % 4 {
                    0 => checkpoints.push(a.acc), // mint: checkpoint = acc
                    1 | 2 => {
                        let pool = (rng.next() % 1_000_000_007) as u128 * 10u128.pow(rng.next() as u32 % 12);
                        paid_in += pool;
                        let d = a.distribute(pool, checkpoints.len() as u64).unwrap();
                        treasury += d.to_treasury;
                    }
                    _ => {
                        if !checkpoints.is_empty() {
                            let i = (rng.next() as usize) % checkpoints.len();
                            claimed += a.claimable(checkpoints[i]);
                            checkpoints[i] = a.acc;
                        }
                    }
                }
                let outstanding: Balance = checkpoints.iter().map(|c| a.claimable(*c)).sum();
                assert_eq!(claimed + outstanding + a.carry + treasury, paid_in, "seed {seed}");
                assert!(a.carry < (checkpoints.len().max(1) as u128));
            }
        }
    }
}
