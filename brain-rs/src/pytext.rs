//! Text handling the way Python's `str` does it, where the difference changes a result.

use crate::json::{dumps_canonical, float_repr, Value};

/// `str.isspace()` for one character: Unicode whitespace plus the separators 0x1C–0x1F.
pub fn is_space(c: char) -> bool {
    c.is_whitespace() || ('\u{1c}'..='\u{1f}').contains(&c)
}

/// `str.strip()`.
pub fn strip(s: &str) -> &str {
    s.trim_matches(is_space)
}

/// `str.split()` with no argument: runs of whitespace separate words, no empty words.
pub fn split_words(s: &str) -> impl Iterator<Item = &str> {
    s.split(is_space).filter(|w| !w.is_empty())
}

/// `str(value)` as an f-string renders a value read from JSON. A missing key renders as
/// `None`, like `dict.get`. Lists and objects are written as canonical JSON, which is NOT
/// Python's `repr`; the prompts only ever interpolate ids and amounts.
pub fn py_str(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => "None".to_string(),
        Some(Value::Bool(true)) => "True".to_string(),
        Some(Value::Bool(false)) => "False".to_string(),
        Some(Value::Int(n)) => n.to_string(),
        Some(Value::BigInt(text)) => text.clone(),
        Some(Value::Float(x)) if x.is_nan() => "nan".to_string(),
        Some(Value::Float(x)) if x.is_infinite() => if *x > 0.0 { "inf" } else { "-inf" }.to_string(),
        Some(Value::Float(x)) => float_repr(*x),
        Some(Value::Str(s)) => s.clone(),
        Some(other) => dumps_canonical(other, false),
    }
}
