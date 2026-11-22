//! The bucket vocabulary shared by drives (Ananke) and needs (Bios).

/// `exp(-1/500)`, as the Python Brain computes it once at load (`math.exp(-1.0 / TAU)`).
/// Embedded as a literal: the per-tick path never calls `exp`, and every platform must
/// use the same double.
pub const DECAY_FACTOR: f64 = 0.9980019986673331;

pub const THRESHOLD_LOW: f64 = 0.33;
pub const THRESHOLD_HIGH: f64 = 0.66;
pub const HYSTERESIS_BAND: f64 = 0.02;
/// Baseline relaxation time-constant, in ticks.
pub const TAU: u32 = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Level {
    Low,
    Med,
    High,
}

impl Level {
    pub const ALL: [Level; 3] = [Level::Low, Level::Med, Level::High];

    pub fn as_str(self) -> &'static str {
        match self {
            Level::Low => "low",
            Level::Med => "med",
            Level::High => "high",
        }
    }

    pub fn parse(s: &str) -> Option<Level> {
        Level::ALL.into_iter().find(|l| l.as_str() == s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Rising,
    Falling,
}

impl Direction {
    pub fn as_str(self) -> &'static str {
        match self {
            Direction::Rising => "rising",
            Direction::Falling => "falling",
        }
    }
}

/// Hysteresis-guarded bucketing: a level is left only when the value crosses the outer
/// edge of the guard band, so a value hovering at a threshold does not flap.
pub fn bucket(value: f64, prev: Level) -> Level {
    match prev {
        Level::Low => {
            if value > THRESHOLD_LOW + HYSTERESIS_BAND {
                if value > THRESHOLD_HIGH + HYSTERESIS_BAND {
                    Level::High
                } else {
                    Level::Med
                }
            } else {
                Level::Low
            }
        }
        Level::Med => {
            if value < THRESHOLD_LOW - HYSTERESIS_BAND {
                Level::Low
            } else if value > THRESHOLD_HIGH + HYSTERESIS_BAND {
                Level::High
            } else {
                Level::Med
            }
        }
        Level::High => {
            if value < THRESHOLD_HIGH - HYSTERESIS_BAND {
                if value < THRESHOLD_LOW - HYSTERESIS_BAND {
                    Level::Low
                } else {
                    Level::Med
                }
            } else {
                Level::High
            }
        }
    }
}

/// One tick of the piecewise recurrence: below baseline the value relaxes up toward it;
/// at or above baseline it rises by `rise_rate`. Clamped to [0, 1].
pub(crate) fn step_value(prev: f64, baseline: f64, rise_rate: f64) -> f64 {
    let next = if prev < baseline {
        baseline + (prev - baseline) * DECAY_FACTOR
    } else {
        prev + rise_rate
    };
    next.clamp(0.0, 1.0)
}

/// Direction of a bucket change, from the ordinal transition — never from the float.
pub(crate) fn direction(old: Level, new: Level) -> Direction {
    let going_up = (old == Level::Low && new != Level::Low) || (old == Level::Med && new == Level::High);
    if going_up {
        Direction::Rising
    } else {
        Direction::Falling
    }
}
