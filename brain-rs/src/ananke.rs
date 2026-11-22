//! Ananke — the five drives. Pure and deterministic: no clock, no randomness.

use crate::level::{bucket, direction, step_value, Direction, Level};

pub const DRIVE_COUNT: usize = 5;

/// Closed five-drive set. Discriminant = canonical iteration order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Drive {
    Hunger = 0,
    Curiosity = 1,
    Safety = 2,
    Boredom = 3,
    Loneliness = 4,
}

impl Drive {
    pub const ALL: [Drive; DRIVE_COUNT] =
        [Drive::Hunger, Drive::Curiosity, Drive::Safety, Drive::Boredom, Drive::Loneliness];

    pub fn as_str(self) -> &'static str {
        match self {
            Drive::Hunger => "hunger",
            Drive::Curiosity => "curiosity",
            Drive::Safety => "safety",
            Drive::Boredom => "boredom",
            Drive::Loneliness => "loneliness",
        }
    }

    /// The elastic floor the drive relaxes toward when below it.
    pub fn baseline(self) -> f64 {
        match self {
            Drive::Hunger => 0.3,
            Drive::Curiosity => 0.5,
            Drive::Safety => 0.2,
            Drive::Boredom => 0.4,
            Drive::Loneliness => 0.4,
        }
    }

    /// Per-tick growth at or above baseline.
    pub fn rise_rate(self) -> f64 {
        match self {
            Drive::Hunger => 0.0003,
            Drive::Curiosity => 0.0002,
            Drive::Safety => 0.0001,
            Drive::Boredom => 0.0002,
            Drive::Loneliness => 0.0002,
        }
    }
}

/// Drive values and their last-committed buckets, indexed by `Drive as usize`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DriveState {
    pub values: [f64; DRIVE_COUNT],
    pub levels: [Level; DRIVE_COUNT],
}

/// Emitted only when a drive's bucket changes. `level` is the new level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Crossing {
    pub drive: Drive,
    pub level: Level,
    pub direction: Direction,
}

/// First-life vector: every drive at its baseline, bucketed from LOW.
pub fn initial_state() -> DriveState {
    DriveState {
        values: Drive::ALL.map(Drive::baseline),
        levels: Drive::ALL.map(|d| bucket(d.baseline(), Level::Low)),
    }
}

/// Per-tick update of the values; levels carry forward unchanged. `seed` and `tick` are
/// reserved by the contract — the update does not depend on them.
pub fn step(state: &DriveState, _seed: u64, _tick: u64) -> DriveState {
    DriveState {
        values: Drive::ALL.map(|d| step_value(state.values[d as usize], d.baseline(), d.rise_rate())),
        levels: state.levels,
    }
}

/// Re-bucket the current values; one crossing per drive whose bucket changed.
pub fn detect_crossing(state: &DriveState) -> (DriveState, Vec<Crossing>) {
    let mut levels = state.levels;
    let mut crossings = Vec::new();
    for d in Drive::ALL {
        let old = state.levels[d as usize];
        let new = bucket(state.values[d as usize], old);
        levels[d as usize] = new;
        if new != old {
            crossings.push(Crossing { drive: d, level: new, direction: direction(old, new) });
        }
    }
    (DriveState { values: state.values, levels }, crossings)
}
