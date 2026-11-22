//! The four component hashes of a Nous's state. The Grid composes them into the
//! pre-deletion state hash; the Brain never composes a fifth.

use crate::hashing::{sha256_canonical, sha256_hex};
use crate::json::Value;
use crate::psyche::{Dimension, Psyche};
use crate::thymos::{Emotion, EMOTION_COUNT};

fn text(s: &str) -> Value {
    Value::Str(s.to_string())
}

fn object(entries: Vec<(&str, Value)>) -> Value {
    Value::Object(entries.into_iter().map(|(k, v)| (k.to_string(), v)).collect())
}

/// Identity: archetype, communication style, the six personality levels, sorted values.
pub fn hash_psyche(psyche: &Psyche) -> String {
    let mut values = psyche.values.clone();
    values.sort();
    sha256_canonical(&object(vec![
        ("archetype", text(&psyche.archetype)),
        ("communication_style", text(&psyche.communication_style)),
        ("personality", object(Dimension::ALL.iter().map(|d| (d.as_str(), text(psyche.level(*d)))).collect())),
        ("values", Value::List(values.iter().map(|v| text(v)).collect())),
    ]))
}

/// Affect: the baseline mood and all six emotion intensities.
pub fn hash_thymos(baseline_mood: &str, intensities: &[f64; EMOTION_COUNT]) -> String {
    sha256_canonical(&object(vec![
        ("baseline_mood", text(baseline_mood)),
        ("emotions", object(Emotion::ALL.iter().map(|e| (e.as_str(), Value::Float(intensities[*e as usize]))).collect())),
    ]))
}

/// Purpose: the active goals as `(description, priority)`, ordered by description.
pub fn hash_telos(active_goals: &[(&str, f64)]) -> String {
    let mut goals = active_goals.to_vec();
    goals.sort_by(|a, b| a.0.cmp(b.0)); // stable: equal descriptions keep their order
    let goals = goals
        .into_iter()
        .map(|(description, priority)| object(vec![("description", text(description)), ("priority", Value::Float(priority))]))
        .collect();
    sha256_canonical(&object(vec![("active_goals", Value::List(goals))]))
}

/// Memory: each entry's id and a digest of its content, oldest first. An entry not yet
/// stored (no id) is identified by its position. `None` = a Brain without memory, which
/// hashes like an empty stream.
pub fn hash_memory_stream(entries_oldest_first: Option<&[(Option<i64>, &str)]>) -> String {
    let entries = entries_oldest_first
        .unwrap_or(&[])
        .iter()
        .enumerate()
        .map(|(index, (id, content))| {
            object(vec![("id", Value::Int(id.unwrap_or(index as i64))), ("content_hash", text(&sha256_hex(content)))])
        })
        .collect();
    sha256_canonical(&object(vec![("entries", Value::List(entries))]))
}
