//! What the Local Nous Manager shows about one Nous: who it is, what it wants, and the
//! state of its body at a given tick. Everything is computed by the same code a running
//! Nous uses; nothing here is illustrative.

use crate::body::Body;
use crate::chronos::compute_multiplier;
use crate::config::spawn;
use crate::json::Value;
use crate::psyche::{level_description, Dimension};
use crate::system_prompt::{build_system_prompt, SystemPromptInput};
use crate::{ananke::Drive, bios::Need};

fn text(s: &str) -> Value {
    Value::Str(s.to_string())
}

fn object(entries: Vec<(&str, Value)>) -> Value {
    Value::Object(entries.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
}

/// Longest life the viewer will simulate, in ticks.
pub const MAX_TICK: i64 = 100_000;

/// A Nous as configured by `yaml_text`, with its body advanced from birth to `tick` with
/// nothing happening to it (no food, no rest, no events). Drive and need values are
/// reported as buckets only, never as raw numbers (DRIVE-05).
pub fn nous_view(yaml_text: &str, tick: i64) -> Result<Value, String> {
    if !(0..=MAX_TICK).contains(&tick) {
        return Err(format!("tick must be between 0 and {MAX_TICK}"));
    }
    let nous = spawn(yaml_text)?;

    let mut body = Body::new(0, false); // as the live Brain builds it
    let mut events = Vec::new();
    let mut starved_at = None;
    for t in 1..=tick {
        let tick_events = body.on_tick(t);
        for x in tick_events.drive_crossings {
            events.push(object(vec![
                ("tick", Value::Int(t)),
                ("kind", text("drive")),
                ("name", text(x.drive.as_str())),
                ("level", text(x.level.as_str())),
                ("direction", text(x.direction.as_str())),
            ]));
        }
        for x in tick_events.need_crossings {
            events.push(object(vec![
                ("tick", Value::Int(t)),
                ("kind", text("need")),
                ("name", text(x.need.as_str())),
                ("level", text(x.level.as_str())),
                ("direction", text(x.direction.as_str())),
            ]));
        }
        if tick_events.starved && starved_at.is_none() {
            starved_at = Some(t);
        }
    }

    let multiplier =
        compute_multiplier(body.drives.levels[Drive::Curiosity as usize], body.drives.levels[Drive::Boredom as usize]);
    let mut prompt_input = SystemPromptInput::new(&nous.psyche, &nous.thymos, &nous.telos);
    prompt_input.bios_levels =
        Some((Some(body.needs.levels[Need::Energy as usize]), Some(body.needs.levels[Need::Sustenance as usize])));
    prompt_input.epoch_since_spawn = Some(body.epoch_since_spawn(tick));
    prompt_input.subjective_multiplier = Some(multiplier);

    Ok(object(vec![
        ("name", text(&nous.psyche.name)),
        ("archetype", text(&nous.psyche.archetype)),
        ("birth_date", text(&nous.psyche.birth_date)),
        ("communication_style", text(&nous.psyche.communication_style)),
        ("values", Value::List(nous.psyche.values.iter().map(|v| text(v)).collect())),
        (
            "personality",
            Value::List(
                Dimension::ALL
                    .iter()
                    .map(|d| {
                        let level = nous.psyche.level(*d);
                        object(vec![
                            ("dimension", text(d.as_str())),
                            ("level", text(level)),
                            ("description", text(level_description(*d, level))),
                        ])
                    })
                    .collect(),
            ),
        ),
        ("mood", text(nous.thymos.current_mood())),
        ("emotional_intensity", text(&nous.thymos.emotional_intensity)),
        (
            "triggers",
            Value::List(
                nous.thymos
                    .triggers()
                    .iter()
                    .map(|(emotion, words)| {
                        object(vec![("emotion", text(emotion)), ("words", Value::List(words.iter().map(|w| text(w)).collect()))])
                    })
                    .collect(),
            ),
        ),
        (
            "goals",
            Value::List(
                nous.telos
                    .goals
                    .iter()
                    .map(|g| {
                        object(vec![
                            ("description", text(&g.description)),
                            ("horizon", text(g.goal_type.as_str())),
                            ("domain", text(g.domain.as_str())),
                            ("status", text(g.status.as_str())),
                            ("priority", Value::Float(g.priority)),
                            ("progress", Value::Float(g.progress)),
                        ])
                    })
                    .collect(),
            ),
        ),
        ("tick", Value::Int(tick)),
        (
            "drives",
            Value::List(
                Drive::ALL
                    .iter()
                    .map(|d| object(vec![("name", text(d.as_str())), ("level", text(body.drives.levels[*d as usize].as_str()))]))
                    .collect(),
            ),
        ),
        (
            "needs",
            Value::List(
                Need::ALL
                    .iter()
                    .map(|n| object(vec![("name", text(n.as_str())), ("level", text(body.needs.levels[*n as usize].as_str()))]))
                    .collect(),
            ),
        ),
        ("events", Value::List(events)),
        ("starved_at", starved_at.map_or(Value::Null, Value::Int)),
        ("subjective_multiplier", Value::Float(multiplier)),
        ("system_prompt", text(&build_system_prompt(&prompt_input))),
    ]))
}
