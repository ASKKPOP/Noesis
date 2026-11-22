//! Tolerant parsing of model replies (D-MIND-04 / D-MIND-07).
//!
//! Small models wrap their JSON in prose. Every parser pulls one object out of the reply
//! and validates it; anything unexpected is `None` and nothing is executed.
//!
//! Two extraction strategies exist and are both part of the contract:
//! the general parsers take the text from the first `{` to the last `}`; the economic
//! parser scans for the first balanced object. They disagree on replies holding two objects.

use crate::json::{self, get, Object, Value};
use crate::pytext::strip as py_strip;

pub const DECISION_ACTIONS: [&str; 4] = ["move", "rest", "speak", "work_task"];
pub const SOCIAL_ACTIONS: [&str; 6] =
    ["contribute_lore", "join_group", "message_peer", "none", "share_skill", "vote"];
pub const ECONOMIC_ACTIONS: [&str; 4] = ["bid_rfp", "none", "pay_due", "pay_iou"];
pub const ECONOMIC_KEYS: [&str; 7] =
    ["action", "method", "iou_id", "notice_id", "price_wei", "artifact_spec", "reason"];
pub const MAX_TASKS: usize = 4;
const MAX_SKILL_TRIGGERS: usize = 5;

/// The object spanning the first `{` to the last `}` of the reply, if that text is one.
fn first_json_object(text: &str) -> Option<Object> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end < start {
        return None;
    }
    match json::parse(&text[start..=end])? {
        Value::Object(object) => Some(object),
        _ => None,
    }
}

/// The first balanced `{…}` that parses as an object. Braces inside strings are counted,
/// as in the Python Brain.
fn first_balanced_object(text: &str) -> Option<Object> {
    let bytes = text.as_bytes();
    let mut start = text.find('{');
    while let Some(s) = start {
        let mut depth = 0usize;
        for (i, c) in bytes.iter().enumerate().skip(s) {
            match c {
                b'{' => depth += 1,
                b'}' => {
                    depth -= 1;
                    if depth == 0 {
                        match json::parse(&text[s..=i]) {
                            Some(Value::Object(object)) => return Some(object),
                            _ => break, // malformed — try the next "{"
                        }
                    }
                }
                _ => {}
            }
        }
        start = text[s + 1..].find('{').map(|n| s + 1 + n);
    }
    None
}

fn action_in(object: &Object, allowed: &[&str]) -> bool {
    matches!(get(object, "action"), Some(Value::Str(a)) if allowed.contains(&a.as_str()))
}

fn stripped_strings(items: &[Value]) -> impl Iterator<Item = String> + '_ {
    items.iter().filter_map(|v| match v {
        Value::Str(s) if !py_strip(s).is_empty() => Some(py_strip(s).to_string()),
        _ => None,
    })
}

/// A fast-actor decision: the whole object, if its action is one the actor may take.
pub fn parse_decision(text: &str) -> Option<Object> {
    first_json_object(text).filter(|o| action_in(o, &DECISION_ACTIONS))
}

/// A social / civic act: the whole object, if its action is a known one.
pub fn parse_social_decision(text: &str) -> Option<Object> {
    first_json_object(text).filter(|o| action_in(o, &SOCIAL_ACTIONS))
}

/// `{"tasks": [...]}` → up to four non-empty task strings.
pub fn parse_task_list(text: &str) -> Option<Vec<String>> {
    let object = first_json_object(text)?;
    let Some(Value::List(tasks)) = get(&object, "tasks") else { return None };
    let cleaned: Vec<String> = stripped_strings(tasks).take(MAX_TASKS).collect();
    (!cleaned.is_empty()).then_some(cleaned)
}

#[derive(Debug, Clone, PartialEq)]
pub struct Skill {
    /// Lower-case slug of letters, digits and single underscores.
    pub name: String,
    pub description: String,
    pub instructions: String,
    pub triggers: Vec<String>,
}

/// A distilled skill. Requires a name and instructions; the name becomes a slug.
pub fn parse_skill(text: &str) -> Option<Skill> {
    let object = first_json_object(text)?;
    let Some(Value::Str(name)) = get(&object, "name") else { return None };
    let Some(Value::Str(instructions)) = get(&object, "instructions") else { return None };
    if py_strip(name).is_empty() || py_strip(instructions).is_empty() {
        return None;
    }
    let slug = py_strip(name)
        .to_lowercase()
        .split(|c: char| !(c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'))
        .flat_map(|run| run.split('_'))
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("_");
    if slug.is_empty() {
        return None;
    }
    let description = match get(&object, "description") {
        Some(Value::Str(d)) => py_strip(d).to_string(),
        _ => slug.clone(),
    };
    let triggers = match get(&object, "triggers") {
        Some(Value::List(items)) => stripped_strings(items).take(MAX_SKILL_TRIGGERS).collect(),
        _ => Vec::new(),
    };
    Some(Skill { name: slug, description, instructions: py_strip(instructions).to_string(), triggers })
}

/// An economic decision, normalized to the seven fixed keys (missing → null).
pub fn parse_economic_decision(text: &str) -> Option<Object> {
    let object = first_balanced_object(text).filter(|o| action_in(o, &ECONOMIC_ACTIONS))?;
    Some(
        ECONOMIC_KEYS
            .iter()
            .map(|key| (key.to_string(), get(&object, key).cloned().unwrap_or(Value::Null)))
            .collect(),
    )
}
