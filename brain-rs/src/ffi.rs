//! The C interface the Mac app calls. Text in, JSON text out.

use std::ffi::{c_char, CStr, CString};

use crate::json::{dumps_canonical, Value};
use crate::view::nous_view;

/// A Nous view as JSON: `{"ok": {...}}`, or `{"error": "..."}`.
///
/// # Safety
/// `yaml` must be a valid NUL-terminated string. The result must be released with
/// [`noesis_string_free`].
#[no_mangle]
pub unsafe extern "C" fn noesis_nous_view(yaml: *const c_char, tick: i64) -> *mut c_char {
    let result = if yaml.is_null() {
        Err("no configuration given".to_string())
    } else {
        match CStr::from_ptr(yaml).to_str() {
            Ok(text) => nous_view(text, tick),
            Err(_) => Err("configuration is not valid UTF-8".to_string()),
        }
    };
    let (key, value) = match result {
        Ok(view) => ("ok", view),
        Err(message) => ("error", Value::Str(message)),
    };
    let json = dumps_canonical(&Value::Object(vec![(key.to_string(), value)]), false);
    // Interior NULs cannot occur: the JSON writer escapes control characters.
    CString::new(json).map_or(std::ptr::null_mut(), CString::into_raw)
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
