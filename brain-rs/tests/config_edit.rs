//! Rewriting a configuration keeps what it says, for the repository's real Nous files.

use noesis_brain::config::parse_yaml;
use noesis_brain::config_edit::{apply_patch, to_yaml};
use noesis_brain::json::{get, Value};

fn config(name: &str) -> String {
    std::fs::read_to_string(format!("{}/../brain/data/nous/{name}.yaml", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

#[test]
fn rewriting_changes_nothing() {
    for name in ["sophia", "hermes", "themis"] {
        let before = parse_yaml(&config(name)).unwrap();
        assert_eq!(parse_yaml(&to_yaml(&before)).unwrap(), before, "{name}");
    }
}

#[test]
fn an_empty_patch_changes_nothing() {
    let before = parse_yaml(&config("sophia")).unwrap();
    assert_eq!(parse_yaml(&apply_patch(&config("sophia"), "{}").unwrap()).unwrap(), before);
}

#[test]
fn a_patch_changes_only_what_it_names() {
    let patch = r#"{"identity":{"name":"Sofia"},"telos":{"earn_money":false,"long_term":null},"new":{"a":[1,"yes"]}}"#;
    let after = parse_yaml(&apply_patch(&config("sophia"), patch).unwrap()).unwrap();
    let before = parse_yaml(&config("sophia")).unwrap();
    let section = |tree: &Vec<(String, Value)>, key: &str| match get(tree, key) {
        Some(Value::Object(o)) => o.clone(),
        _ => panic!("no {key}"),
    };
    let identity = section(&after, "identity");
    assert_eq!(get(&identity, "name"), Some(&Value::Str("Sofia".into())));
    assert_eq!(get(&identity, "archetype"), Some(&Value::Str("The Philosopher".into())));
    let telos = section(&after, "telos");
    assert_eq!(get(&telos, "earn_money"), Some(&Value::Bool(false)));
    assert_eq!(get(&telos, "long_term"), None);
    assert_eq!(get(&telos, "short_term"), get(&section(&before, "telos"), "short_term"));
    assert_eq!(get(&section(&after, "new"), "a"), Some(&Value::List(vec![Value::Int(1), Value::Str("yes".into())])));
    // Sections the patch does not name are untouched and keep their order.
    assert_eq!(get(&after, "psyche"), get(&before, "psyche"));
    let keys: Vec<&str> = after.iter().map(|(k, _)| k.as_str()).collect();
    let mut expected: Vec<&str> = before.iter().map(|(k, _)| k.as_str()).collect();
    expected.push("new");
    assert_eq!(keys, expected);
}

#[test]
fn a_patch_that_is_not_an_object_is_refused() {
    assert!(apply_patch(&config("sophia"), "[1]").is_err());
    assert!(apply_patch("- a\n- b\n", "{}").is_err());
}
