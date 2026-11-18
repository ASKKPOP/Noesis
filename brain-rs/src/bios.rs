//! Bios — the two bodily needs. Same dynamics as the drives, applied to energy and
//! sustenance. Pure and deterministic.

use crate::ananke::Drive;
use crate::level::{bucket, direction, step_value, Direction, Level};

pub const NEED_COUNT: usize = 2;

/// Closed two-need set. Discriminant = canonical iteration order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Need {
    Energy = 0,
    Sustenance = 1,
}

impl Need {
    pub const ALL: [Need; NEED_COUNT] = [Need::Energy, Need::Sustenance];

    pub fn as_str(self) -> &'static str {
        match self {
            Need::Energy => "energy",
            Need::Sustenance => "sustenance",
        }
    }

    pub fn baseline(self) -> f64 {
        0.3
    }

    pub fn rise_rate(self) -> f64 {
        match self {
            Need::Energy => 0.0003,
            Need::Sustenance => 0.0001,
        }
    }

    /// The one drive this need elevates.
    pub fn drive(self) -> Drive {
        match self {
            Need::Energy => Drive::Hunger,
            Need::Sustenance => Drive::Safety,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct NeedState {
    pub values: [f64; NEED_COUNT],
    pub levels: [Level; NEED_COUNT],
}

/// Emitted only when a need's bucket changes. `level` is the new level.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Crossing {
    pub need: Need,
    pub level: Level,
    pub direction: Direction,
}

/// First-life vector: both needs at baseline, bucketed from LOW.
pub fn initial_state() -> NeedState {
    NeedState {
        values: Need::ALL.map(Need::baseline),
        levels: Need::ALL.map(|n| bucket(n.baseline(), Level::Low)),
    }
}

/// Re-bucket the current values; one crossing per need whose bucket changed.
pub fn detect_crossing(state: &NeedState) -> (NeedState, Vec<Crossing>) {
    let mut levels = state.levels;
    let mut crossings = Vec::new();
    for n in Need::ALL {
        let old = state.levels[n as usize];
        let new = bucket(state.values[n as usize], old);
        levels[n as usize] = new;
        if new != old {
            crossings.push(Crossing { need: n, level: new, direction: direction(old, new) });
        }
    }
    (NeedState { values: state.values, levels }, crossings)
}

/// Per-tick update plus crossing detection. `tick` is reserved by the contract.
pub fn step(state: &NeedState, _tick: u64) -> (NeedState, Vec<Crossing>) {
    detect_crossing(&NeedState {
        values: Need::ALL.map(|n| step_value(state.values[n as usize], n.baseline(), n.rise_rate())),
        levels: state.levels,
    })
}

/// Starvation: any need at 1.0.
pub fn is_terminal(state: &NeedState) -> bool {
    state.values.iter().any(|v| *v >= 1.0)
}
