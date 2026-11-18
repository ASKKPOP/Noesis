//! JSON as the Python Brain reads and writes it.
//!
//! Reading model replies and hashing state both depend on details of Python's `json`
//! module that standard Rust JSON crates do not share, so both directions live here:
//!
//! - `parse` accepts what `json.loads` accepts: `NaN` / `Infinity` / `-Infinity`,
//!   duplicate keys (last value wins, first position kept), integers of any size.
//! - `dumps_canonical` writes what `json.dumps(sort_keys=True, separators=(",", ":"))`
//!   writes, including Python's float text (`1e-07`, `1e+21`, `2.0`).

/// An object keeps its keys in insertion order, like a Python dict.
pub type Object = Vec<(String, Value)>;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Int(i64),
    /// An integer outside the i64 range, as its decimal text.
    BigInt(String),
    Float(f64),
    Str(String),
    List(Vec<Value>),
    Object(Object),
}

/// `dict.get(key)`.
pub fn get<'a>(object: &'a Object, key: &str) -> Option<&'a Value> {
    object.iter().find(|(k, _)| k == key).map(|(_, v)| v)
}

/// Nesting deeper than this is refused rather than risking the stack on a hostile reply.
const MAX_DEPTH: usize = 512;

/// Parse one JSON document. `None` wherever `json.loads` would raise.
pub fn parse(text: &str) -> Option<Value> {
    let mut p = Parser { s: text.as_bytes(), i: 0 };
    p.skip_ws();
    let value = p.value(0)?;
    p.skip_ws();
    (p.i == p.s.len()).then_some(value)
}

struct Parser<'a> {
    s: &'a [u8],
    i: usize,
}

impl Parser<'_> {
    fn peek(&self) -> Option<u8> {
        self.s.get(self.i).copied()
    }

    fn skip_ws(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.i += 1;
        }
    }

    fn eat(&mut self, literal: &str) -> bool {
        let hit = self.s[self.i..].starts_with(literal.as_bytes());
        if hit {
            self.i += literal.len();
        }
        hit
    }

    fn value(&mut self, depth: usize) -> Option<Value> {
        if depth > MAX_DEPTH {
            return None;
        }
        match self.peek()? {
            b'"' => self.string().map(Value::Str),
            b'{' => self.object(depth),
            b'[' => self.list(depth),
            b'n' => self.eat("null").then_some(Value::Null),
            b't' => self.eat("true").then_some(Value::Bool(true)),
            b'f' => self.eat("false").then_some(Value::Bool(false)),
            b'N' => self.eat("NaN").then_some(Value::Float(f64::NAN)),
            b'I' => self.eat("Infinity").then_some(Value::Float(f64::INFINITY)),
            b'-' if self.s[self.i..].starts_with(b"-Infinity") => {
                self.i += "-Infinity".len();
                Some(Value::Float(f64::NEG_INFINITY))
            }
            _ => self.number(),
        }
    }

    fn object(&mut self, depth: usize) -> Option<Value> {
        self.i += 1; // {
        let mut object: Object = Vec::new();
        self.skip_ws();
        if self.peek()? == b'}' {
            self.i += 1;
            return Some(Value::Object(object));
        }
        loop {
            if self.peek()? != b'"' {
                return None;
            }
            let key = self.string()?;
            self.skip_ws();
            if self.peek()? != b':' {
                return None;
            }
            self.i += 1;
            self.skip_ws();
            let value = self.value(depth + 1)?;
            match object.iter_mut().find(|(k, _)| *k == key) {
                Some(slot) => slot.1 = value,
                None => object.push((key, value)),
            }
            self.skip_ws();
            match self.peek()? {
                b',' => {
                    self.i += 1;
                    self.skip_ws();
                }
                b'}' => {
                    self.i += 1;
                    return Some(Value::Object(object));
                }
                _ => return None,
            }
        }
    }

    fn list(&mut self, depth: usize) -> Option<Value> {
        self.i += 1; // [
        let mut list = Vec::new();
        self.skip_ws();
        if self.peek()? == b']' {
            self.i += 1;
            return Some(Value::List(list));
        }
        loop {
            list.push(self.value(depth + 1)?);
            self.skip_ws();
            match self.peek()? {
                b',' => {
                    self.i += 1;
                    self.skip_ws();
                }
                b']' => {
                    self.i += 1;
                    return Some(Value::List(list));
                }
                _ => return None,
            }
        }
    }

    fn hex4(&mut self) -> Option<u32> {
        let digits = self.s.get(self.i..self.i + 4)?;
        if !digits.iter().all(u8::is_ascii_hexdigit) {
            return None;
        }
        self.i += 4;
        u32::from_str_radix(std::str::from_utf8(digits).ok()?, 16).ok()
    }

    fn string(&mut self) -> Option<String> {
        self.i += 1; // opening quote
        let mut out: Vec<u8> = Vec::new();
        loop {
            let c = self.peek()?;
            self.i += 1;
            match c {
                b'"' => return String::from_utf8(out).ok(),
                0x00..=0x1f => return None, // raw control characters are not allowed
                b'\\' => {
                    let esc = self.peek()?;
                    self.i += 1;
                    let ch = match esc {
                        b'"' => '"',
                        b'\\' => '\\',
                        b'/' => '/',
                        b'b' => '\u{8}',
                        b'f' => '\u{c}',
                        b'n' => '\n',
                        b'r' => '\r',
                        b't' => '\t',
                        b'u' => {
                            let mut code = self.hex4()?;
                            if (0xD800..0xDC00).contains(&code) && self.s[self.i..].starts_with(b"\\u") {
                                let rewind = self.i;
                                self.i += 2;
                                match self.hex4() {
                                    Some(low) if (0xDC00..0xE000).contains(&low) => {
                                        code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
                                    }
                                    _ => self.i = rewind,
                                }
                            }
                            // A lone surrogate cannot live in a Rust string; Python keeps it.
                            char::from_u32(code).unwrap_or('\u{FFFD}')
                        }
                        _ => return None,
                    };
                    out.extend_from_slice(ch.encode_utf8(&mut [0; 4]).as_bytes());
                }
                _ => out.push(c),
            }
        }
    }

    /// `-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?` — an integer unless it has a fraction or exponent.
    fn number(&mut self) -> Option<Value> {
        let start = self.i;
        if self.peek() == Some(b'-') {
            self.i += 1;
        }
        match self.peek()? {
            b'0' => self.i += 1,
            b'1'..=b'9' => self.digits(),
            _ => return None,
        }
        let mut is_float = false;
        if self.peek() == Some(b'.') && self.s.get(self.i + 1).is_some_and(u8::is_ascii_digit) {
            self.i += 1;
            self.digits();
            is_float = true;
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            let mut j = self.i + 1;
            if matches!(self.s.get(j), Some(b'+' | b'-')) {
                j += 1;
            }
            if self.s.get(j).is_some_and(u8::is_ascii_digit) {
                self.i = j;
                self.digits();
                is_float = true;
            }
        }
        let text = std::str::from_utf8(&self.s[start..self.i]).ok()?;
        if is_float {
            text.parse().ok().map(Value::Float)
        } else {
            Some(text.parse().map(Value::Int).unwrap_or_else(|_| Value::BigInt(text.to_string())))
        }
    }

    fn digits(&mut self) {
        while self.peek().is_some_and(|c| c.is_ascii_digit()) {
            self.i += 1;
        }
    }
}

/// `repr(float)` as Python writes it into JSON: shortest round-trip digits, fixed
/// notation for exponents in [-4, 16), otherwise `d.ddde±XX`.
pub fn float_repr(x: f64) -> String {
    if x.is_nan() {
        return "NaN".to_string();
    }
    if x.is_infinite() {
        return if x > 0.0 { "Infinity" } else { "-Infinity" }.to_string();
    }
    let sign = if x.is_sign_negative() { "-" } else { "" };
    if x == 0.0 {
        return format!("{sign}0.0");
    }
    // Rust's `{:e}` gives the shortest round-trip digits: "1.2345e-7", "1e21".
    let sci = format!("{:e}", x.abs());
    let (mantissa, exponent) = sci.split_once('e').expect("LowerExp always has an exponent");
    let digits: String = mantissa.chars().filter(|c| *c != '.').collect();
    let exp10: i32 = exponent.parse().expect("LowerExp exponent is an integer");
    let point = exp10 + 1; // digits before the decimal point

    let body = if -4 < point && point <= 16 {
        let n = digits.len() as i32;
        if point <= 0 {
            format!("0.{}{}", "0".repeat((-point) as usize), digits)
        } else if n <= point {
            format!("{}{}.0", digits, "0".repeat((point - n) as usize))
        } else {
            format!("{}.{}", &digits[..point as usize], &digits[point as usize..])
        }
    } else {
        let (first, rest) = digits.split_at(1);
        let frac = if rest.is_empty() { String::new() } else { format!(".{rest}") };
        let exp_sign = if exp10 < 0 { '-' } else { '+' };
        format!("{first}{frac}e{exp_sign}{:02}", exp10.abs())
    };
    format!("{sign}{body}")
}

/// `json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=…)`.
pub fn dumps_canonical(value: &Value, ensure_ascii: bool) -> String {
    let mut out = String::new();
    write_value(value, ensure_ascii, &mut out);
    out
}

fn write_value(value: &Value, ensure_ascii: bool, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Int(n) => out.push_str(&n.to_string()),
        Value::BigInt(text) => out.push_str(text),
        Value::Float(x) => out.push_str(&float_repr(*x)),
        Value::Str(s) => write_string(s, ensure_ascii, out),
        Value::List(items) => {
            out.push('[');
            for (n, item) in items.iter().enumerate() {
                if n > 0 {
                    out.push(',');
                }
                write_value(item, ensure_ascii, out);
            }
            out.push(']');
        }
        Value::Object(object) => {
            let mut entries: Vec<&(String, Value)> = object.iter().collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0)); // byte order of UTF-8 = code-point order
            out.push('{');
            for (n, (key, item)) in entries.into_iter().enumerate() {
                if n > 0 {
                    out.push(',');
                }
                write_string(key, ensure_ascii, out);
                out.push(':');
                write_value(item, ensure_ascii, out);
            }
            out.push('}');
        }
    }
}

fn write_string(s: &str, ensure_ascii: bool, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 || (ensure_ascii && (c as u32) > 0x7e) => {
                for unit in c.encode_utf16(&mut [0; 2]) {
                    out.push_str(&format!("\\u{unit:04x}"));
                }
            }
            c => out.push(c),
        }
    }
    out.push('"');
}
