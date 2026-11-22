//! Reading and changing a Nous configuration file for the settings screen.
//!
//! The file is read into a tree, a patch is merged into it, and the tree is written
//! back as YAML. Key order is kept; comments are not.

use crate::config::parse_yaml;
use crate::json::{self, float_repr, write_string, Object, Value};
use crate::psyche::{Dimension, COMMUNICATION_STYLES};
use crate::thymos::Emotion;

fn strings<'a>(items: impl IntoIterator<Item = &'a str>) -> Value {
    Value::List(items.into_iter().map(|s| Value::Str(s.to_string())).collect())
}

/// The configuration as a tree, with the closed sets a settings screen offers.
pub fn config_json(yaml_text: &str) -> Result<Value, String> {
    let choices = vec![
        ("communication_styles".to_string(), strings(COMMUNICATION_STYLES)),
        ("emotions".to_string(), strings(Emotion::ALL.map(Emotion::as_str))),
        ("levels".to_string(), strings(["low", "medium", "high"])),
        ("personality".to_string(), strings(Dimension::ALL.map(Dimension::as_str))),
    ];
    Ok(Value::Object(vec![
        ("choices".to_string(), Value::Object(choices)),
        ("config".to_string(), Value::Object(parse_yaml(yaml_text)?)),
    ]))
}

/// JSON merge patch (RFC 7386): objects merge key by key, `null` removes a key,
/// anything else replaces. New keys go at the end.
fn merge(target: &mut Object, patch: Object) {
    for (key, value) in patch {
        let at = target.iter().position(|(k, _)| *k == key);
        match (value, at) {
            (Value::Null, Some(i)) => {
                target.remove(i);
            }
            (Value::Null, None) => {}
            (Value::Object(inner), Some(i)) if matches!(target[i].1, Value::Object(_)) => {
                if let Value::Object(existing) = &mut target[i].1 {
                    merge(existing, inner);
                }
            }
            (Value::Object(inner), at) => {
                let mut fresh = Vec::new();
                merge(&mut fresh, inner);
                match at {
                    Some(i) => target[i].1 = Value::Object(fresh),
                    None => target.push((key, Value::Object(fresh))),
                }
            }
            (value, Some(i)) => target[i].1 = value,
            (value, None) => target.push((key, value)),
        }
    }
}

/// Merge a JSON patch into configuration text and return the new YAML.
pub fn apply_patch(yaml_text: &str, patch_json: &str) -> Result<String, String> {
    let mut config = parse_yaml(yaml_text)?;
    match json::parse(patch_json) {
        Some(Value::Object(patch)) => merge(&mut config, patch),
        _ => return Err("the change is not a JSON object".to_string()),
    }
    Ok(to_yaml(&config))
}

/// Write a mapping as YAML. Every string is double-quoted, so no word can be re-read
/// as a boolean, number or date by either YAML 1.1 or 1.2.
pub fn to_yaml(config: &Object) -> String {
    let mut out = String::new();
    for (n, entry) in config.iter().enumerate() {
        if n > 0 {
            out.push('\n');
        }
        write_block(std::slice::from_ref(entry), 0, &mut out);
    }
    out
}

fn is_block(value: &Value) -> bool {
    match value {
        Value::Object(object) => !object.is_empty(),
        Value::List(items) => !items.is_empty(),
        _ => false,
    }
}

fn write_key(key: &str, out: &mut String) {
    let plain = key.chars().next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        && !matches!(key.to_ascii_lowercase().as_str(), "y" | "n" | "yes" | "no" | "on" | "off" | "true" | "false" | "null");
    if plain {
        out.push_str(key);
    } else {
        write_string(key, false, out);
    }
}

fn write_block(object: &[(String, Value)], indent: usize, out: &mut String) {
    for (key, value) in object {
        out.push_str(&" ".repeat(indent));
        write_key(key, out);
        out.push(':');
        match value {
            Value::Object(inner) if is_block(value) => {
                out.push('\n');
                write_block(inner, indent + 2, out);
            }
            Value::List(items) if is_block(value) => {
                out.push('\n');
                for item in items {
                    out.push_str(&" ".repeat(indent + 2));
                    out.push_str("- ");
                    write_flow(item, out);
                    out.push('\n');
                }
            }
            _ => {
                out.push(' ');
                write_flow(value, out);
                out.push('\n');
            }
        }
    }
}

/// A value on one line. Collections inside a list are written in flow style.
fn write_flow(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Int(n) => out.push_str(&n.to_string()),
        Value::BigInt(text) => out.push_str(text),
        Value::Float(x) if x.is_nan() => out.push_str(".nan"),
        Value::Float(x) if x.is_infinite() => out.push_str(if *x > 0.0 { ".inf" } else { "-.inf" }),
        Value::Float(x) => out.push_str(&float_repr(*x)),
        Value::Str(s) => write_string(s, false, out),
        Value::List(items) => {
            out.push('[');
            for (n, item) in items.iter().enumerate() {
                if n > 0 {
                    out.push_str(", ");
                }
                write_flow(item, out);
            }
            out.push(']');
        }
        Value::Object(object) => {
            out.push('{');
            for (n, (key, item)) in object.iter().enumerate() {
                if n > 0 {
                    out.push_str(", ");
                }
                write_key(key, out);
                out.push_str(": ");
                write_flow(item, out);
            }
            out.push('}');
        }
    }
}
