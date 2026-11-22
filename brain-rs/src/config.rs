//! A Nous built from its YAML configuration, as the Brain does at spawn.

use yaml_rust2::{Yaml, YamlLoader};

use crate::json::{Object, Value};
use crate::psyche::{Dimension, Psyche, COMMUNICATION_STYLES};
use crate::pytext::py_str;
use crate::telos::{GoalDomain, GoalType, TelosManager};
use crate::thymos::ThymosTracker;

/// The parts of a Nous that come from its configuration.
#[derive(Debug, Clone)]
pub struct Nous {
    pub psyche: Psyche,
    pub thymos: ThymosTracker,
    pub telos: TelosManager,
}

fn to_value(yaml: &Yaml) -> Value {
    match yaml {
        Yaml::Real(text) => text.parse().map(Value::Float).unwrap_or_else(|_| Value::Str(text.clone())),
        Yaml::Integer(n) => Value::Int(*n),
        Yaml::String(s) => Value::Str(s.clone()),
        Yaml::Boolean(b) => Value::Bool(*b),
        Yaml::Array(items) => Value::List(items.iter().map(to_value).collect()),
        Yaml::Hash(map) => Value::Object(map.iter().map(|(k, v)| (py_str(Some(&to_value(k))), to_value(v))).collect()),
        Yaml::Alias(_) | Yaml::Null | Yaml::BadValue => Value::Null,
    }
}

/// Read a YAML document whose top level is a mapping. An empty document is an empty mapping.
pub fn parse_yaml(text: &str) -> Result<Object, String> {
    let docs = YamlLoader::load_from_str(text).map_err(|e| format!("not valid YAML: {e}"))?;
    match docs.first().map(to_value) {
        None | Some(Value::Null) => Ok(Vec::new()),
        Some(Value::Object(object)) => Ok(object),
        Some(_) => Err("a Nous configuration must be a mapping at the top level".to_string()),
    }
}

fn section<'a>(data: &'a [(String, Value)], key: &str) -> &'a [(String, Value)] {
    match data.iter().find(|(k, _)| k == key) {
        Some((_, Value::Object(object))) => object,
        _ => &[],
    }
}

fn text_or(object: &[(String, Value)], key: &str, default: &str) -> String {
    match object.iter().find(|(k, _)| k == key) {
        Some((_, value)) => py_str(Some(value)),
        None => default.to_string(),
    }
}

fn texts(object: &[(String, Value)], key: &str) -> Vec<String> {
    match object.iter().find(|(k, _)| k == key) {
        Some((_, Value::List(items))) => items.iter().map(|v| py_str(Some(v))).collect(),
        _ => Vec::new(),
    }
}

/// Build a Nous from its configuration text: identity and personality, emotional
/// make-up, configured goals (short 0.8 · medium 0.5 · long 0.3), and the standing
/// economic goal unless `telos.earn_money` is false.
pub fn spawn(yaml_text: &str) -> Result<Nous, String> {
    let data = parse_yaml(yaml_text)?;
    let (identity, psyche_data) = (section(&data, "identity"), section(&data, "psyche"));
    let (thymos_data, telos_data) = (section(&data, "thymos"), section(&data, "telos"));

    let levels = section(psyche_data, "personality");
    let style = text_or(psyche_data, "communication_style", "thoughtful");
    let psyche = Psyche {
        name: text_or(identity, "name", "Unknown"),
        archetype: text_or(identity, "archetype", ""),
        personality: Dimension::ALL.map(|d| text_or(levels, d.as_str(), "medium")),
        values: texts(psyche_data, "values"),
        communication_style: if COMMUNICATION_STYLES.contains(&style.as_str()) { style } else { "thoughtful".to_string() },
        birth_date: text_or(identity, "birth_date", ""),
    };

    let trigger_data = section(thymos_data, "triggers");
    let triggers = trigger_data.iter().map(|(emotion, _)| (emotion.clone(), texts(trigger_data, emotion))).collect();
    let thymos = ThymosTracker::new(
        &text_or(thymos_data, "baseline_mood", "neutral"),
        &text_or(thymos_data, "emotional_intensity", "medium"),
        triggers,
    );

    let mut telos = TelosManager::default();
    for (goal_type, key, priority) in [
        (GoalType::ShortTerm, "short_term", 0.8),
        (GoalType::MediumTerm, "medium_term", 0.5),
        (GoalType::LongTerm, "long_term", 0.3),
    ] {
        for description in texts(telos_data, key) {
            telos.add_goal(&description, goal_type, priority, GoalDomain::General, 0);
        }
    }
    let earn_money = telos_data.iter().find(|(k, _)| k == "earn_money").map(|(_, v)| v);
    if earn_money.is_none() || crate::pytext::truthy(earn_money) {
        telos.seed_economic_goal();
    }

    Ok(Nous { psyche, thymos, telos })
}
