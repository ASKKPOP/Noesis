//! Chronos — subjective time. Brain-local: it biases memory recency and never crosses
//! the wire.

use crate::level::Level;

pub const MULTIPLIER_MIN: f64 = 0.25;
pub const MULTIPLIER_MAX: f64 = 4.0;
pub const DEFAULT_DECAY_RATE: f64 = 0.99;

pub fn curiosity_boost(level: Level) -> f64 {
    match level {
        Level::Low => 0.0,
        Level::Med => 1.0,
        Level::High => 3.0,
    }
}

pub fn boredom_penalty(level: Level) -> f64 {
    match level {
        Level::Low => 0.0,
        Level::Med => 0.3,
        Level::High => 0.75,
    }
}

/// Curiosity stretches time, boredom compresses it: `clamp(1 + boost − penalty)`.
pub fn compute_multiplier(curiosity: Level, boredom: Level) -> f64 {
    let raw = 1.0 + curiosity_boost(curiosity) - boredom_penalty(boredom);
    MULTIPLIER_MIN.max(MULTIPLIER_MAX.min(raw))
}

/// Tick-based recency: `decay_rate ^ max(0, current_tick − memory_tick)`.
/// `powf` (libm `pow`), matching Python's float `**`; `powi` multiplies repeatedly and
/// can differ in the last bit.
pub fn recency_score_by_tick(memory_tick: i64, current_tick: i64, decay_rate: f64) -> f64 {
    let ticks_ago = (current_tick - memory_tick).max(0);
    decay_rate.powf(ticks_ago as f64)
}

/// Recency scaled by the subjective multiplier, clamped to [0, 1].
pub fn score_with_chronos(memory_tick: i64, current_tick: i64, multiplier: f64, decay_rate: f64) -> f64 {
    let recency = recency_score_by_tick(memory_tick, current_tick, decay_rate);
    0.0_f64.max(1.0_f64.min(recency * multiplier))
}
