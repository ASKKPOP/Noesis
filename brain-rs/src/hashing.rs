//! The hashes the Grid compares against: canonical-JSON SHA-256 and the active-Telos hash.
//! Any change to the canonical form breaks hash compatibility with the audit chain.

use sha2::{Digest, Sha256};

use crate::json::{dumps_canonical, Value};

pub(crate) fn sha256_hex(text: &str) -> String {
    Sha256::digest(text.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

/// SHA-256 over canonical JSON: sorted keys, no whitespace, non-ASCII as raw UTF-8.
pub fn sha256_canonical(value: &Value) -> String {
    sha256_hex(&dumps_canonical(value, false))
}

pub use crate::telos::{Goal, GoalStatus, GoalType};

/// SHA-256 over the active goals only, in the order given. Canonical JSON with sorted
/// keys and non-ASCII written as `\uXXXX` escapes (unlike `sha256_canonical`).
pub fn active_telos_hash(goals: &[Goal]) -> String {
    let active = goals
        .iter()
        .filter(|g| g.is_active())
        .map(|g| {
            Value::Object(vec![
                ("description".to_string(), Value::Str(g.description.clone())),
                ("goal_type".to_string(), Value::Str(g.goal_type.as_str().to_string())),
                ("status".to_string(), Value::Str(g.status.as_str().to_string())),
                ("priority".to_string(), Value::Float(g.priority)),
                ("progress".to_string(), Value::Float(g.progress)),
            ])
        })
        .collect();
    sha256_hex(&dumps_canonical(&Value::List(active), true))
}
