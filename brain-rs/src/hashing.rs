//! The hashes the Grid compares against: canonical-JSON SHA-256 and the active-Telos hash.
//! Any change to the canonical form breaks hash compatibility with the audit chain.

use sha2::{Digest, Sha256};

use crate::json::{dumps_canonical, Value};

fn sha256_hex(text: &str) -> String {
    Sha256::digest(text.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

/// SHA-256 over canonical JSON: sorted keys, no whitespace, non-ASCII as raw UTF-8.
pub fn sha256_canonical(value: &Value) -> String {
    sha256_hex(&dumps_canonical(value, false))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalType {
    ShortTerm,
    MediumTerm,
    LongTerm,
}

impl GoalType {
    pub const ALL: [GoalType; 3] = [GoalType::ShortTerm, GoalType::MediumTerm, GoalType::LongTerm];

    pub fn as_str(self) -> &'static str {
        match self {
            GoalType::ShortTerm => "short_term",
            GoalType::MediumTerm => "medium_term",
            GoalType::LongTerm => "long_term",
        }
    }

    pub fn parse(s: &str) -> Option<GoalType> {
        GoalType::ALL.into_iter().find(|t| t.as_str() == s)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalStatus {
    Active,
    Completed,
    Abandoned,
    Blocked,
}

impl GoalStatus {
    pub const ALL: [GoalStatus; 4] =
        [GoalStatus::Active, GoalStatus::Completed, GoalStatus::Abandoned, GoalStatus::Blocked];

    pub fn as_str(self) -> &'static str {
        match self {
            GoalStatus::Active => "active",
            GoalStatus::Completed => "completed",
            GoalStatus::Abandoned => "abandoned",
            GoalStatus::Blocked => "blocked",
        }
    }

    pub fn parse(s: &str) -> Option<GoalStatus> {
        GoalStatus::ALL.into_iter().find(|t| t.as_str() == s)
    }
}

/// The hashed fields of a goal. What a goal carries beyond these does not shape the hash.
#[derive(Debug, Clone, PartialEq)]
pub struct Goal {
    pub description: String,
    pub goal_type: GoalType,
    pub status: GoalStatus,
    pub priority: f64,
    pub progress: f64,
}

/// SHA-256 over the active goals only, in the order given. Canonical JSON with sorted
/// keys and non-ASCII written as `\uXXXX` escapes (unlike `sha256_canonical`).
pub fn active_telos_hash(goals: &[Goal]) -> String {
    let active = goals
        .iter()
        .filter(|g| g.status == GoalStatus::Active)
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
