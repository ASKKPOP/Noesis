//! The body runtime: drives and needs stepped once per Grid tick, in the Brain's order.

use crate::ananke::{self, DriveState};
use crate::bios::{self, NeedState};
use crate::level::Level;

#[derive(Debug, Clone, PartialEq)]
pub struct Body {
    pub drives: DriveState,
    pub needs: NeedState,
    /// Grid tick at which this Nous was spawned.
    pub birth_tick: i64,
    /// Whether a need crossing lifts its drive one bucket. The live Brain runs with this
    /// OFF (its needs runtime is built without the link); the linked form exists and is
    /// frozen by the fixtures too.
    pub needs_lift_drives: bool,
}

/// What one tick produced.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct TickEvents {
    pub drive_crossings: Vec<ananke::Crossing>,
    pub need_crossings: Vec<bios::Crossing>,
    /// A need is at its maximum: starvation.
    pub starved: bool,
}

impl Body {
    pub fn new(birth_tick: i64, needs_lift_drives: bool) -> Self {
        Body { drives: ananke::initial_state(), needs: bios::initial_state(), birth_tick, needs_lift_drives }
    }

    /// Drives step first, then needs.
    pub fn on_tick(&mut self, tick: i64) -> TickEvents {
        let (drives, drive_crossings) = ananke::detect_crossing(&ananke::step(&self.drives, 0, tick as u64));
        self.drives = drives;
        let (needs, need_crossings) = bios::step(&self.needs, tick as u64);
        self.needs = needs;
        if self.needs_lift_drives {
            for crossing in &need_crossings {
                let level = &mut self.drives.levels[crossing.need.drive() as usize];
                *level = match *level {
                    Level::Low => Level::Med,
                    Level::Med | Level::High => Level::High,
                };
            }
        }
        TickEvents { drive_crossings, need_crossings, starved: bios::is_terminal(&self.needs) }
    }

    /// Age in ticks.
    pub fn epoch_since_spawn(&self, current_tick: i64) -> i64 {
        current_tick - self.birth_tick
    }
}
