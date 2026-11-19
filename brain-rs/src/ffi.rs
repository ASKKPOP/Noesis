//! The C interface the Mac app calls. Text in, JSON text out.

use std::ffi::{c_char, CStr, CString};

use crate::config_edit::{apply_patch, config_json};
use crate::json::{dumps_canonical, Value};
use crate::view::nous_view;

/// Read a C string argument.
unsafe fn text<'a>(pointer: *const c_char, what: &str) -> Result<&'a str, String> {
    if pointer.is_null() {
        return Err(format!("no {what} given"));
    }
    CStr::from_ptr(pointer).to_str().map_err(|_| format!("{what} is not valid UTF-8"))
}

/// `{"ok": value}` or `{"error": "..."}` as a C string.
fn reply(result: Result<Value, String>) -> *mut c_char {
    let (key, value) = match result {
        Ok(value) => ("ok", value),
        Err(message) => ("error", Value::Str(message)),
    };
    let json = dumps_canonical(&Value::Object(vec![(key.to_string(), value)]), false);
    // Interior NULs cannot occur: the JSON writer escapes control characters.
    CString::new(json).map_or(std::ptr::null_mut(), CString::into_raw)
}

/// A Nous view as JSON: `{"ok": {...}}`, or `{"error": "..."}`.
///
/// # Safety
/// `yaml` must be a valid NUL-terminated string. The result must be released with
/// [`noesis_string_free`].
#[no_mangle]
pub unsafe extern "C" fn noesis_nous_view(yaml: *const c_char, tick: i64) -> *mut c_char {
    reply(text(yaml, "configuration").and_then(|yaml| nous_view(yaml, tick)))
}

/// A configuration as a tree plus the choices a settings screen offers:
/// `{"ok": {"config": {...}, "choices": {...}}}`.
///
/// # Safety
/// As [`noesis_nous_view`].
#[no_mangle]
pub unsafe extern "C" fn noesis_config_json(yaml: *const c_char) -> *mut c_char {
    reply(text(yaml, "configuration").and_then(config_json))
}

/// Merge a JSON patch into a configuration: `{"ok": "<new YAML text>"}`.
///
/// # Safety
/// Both arguments must be valid NUL-terminated strings. Release the result with
/// [`noesis_string_free`].
#[no_mangle]
pub unsafe extern "C" fn noesis_config_patch(yaml: *const c_char, patch: *const c_char) -> *mut c_char {
    reply(text(yaml, "configuration").and_then(|yaml| Ok(Value::Str(apply_patch(yaml, text(patch, "change")?)?))))
}

/// Release a string returned by this library.
///
/// # Safety
/// `text` must have come from this library and not been freed already.
#[no_mangle]
pub unsafe extern "C" fn noesis_string_free(text: *mut c_char) {
    if !text.is_null() {
        drop(CString::from_raw(text));
    }
}
