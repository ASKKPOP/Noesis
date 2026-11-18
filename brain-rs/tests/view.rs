//! The viewer's output, checked against the repository's real Nous configurations.

use noesis_brain::json::{self, get, Value};
use noesis_brain::view::{nous_view, MAX_TICK};

fn sophia() -> String {
    std::fs::read_to_string(format!("{}/../brain/data/nous/sophia.yaml", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

fn field<'a>(view: &'a Value, key: &str) -> &'a Value {
    match view {
        Value::Object(o) => get(o, key).unwrap_or_else(|| panic!("no {key}")),
        _ => panic!("not an object"),
    }
}

fn level_of(view: &Value, list: &str, name: &str) -> String {
    let Value::List(items) = field(view, list) else { panic!() };
    let item = items.iter().find(|i| field(i, "name") == &Value::Str(name.into())).unwrap();
    match field(item, "level") {
        Value::Str(s) => s.clone(),
        _ => panic!(),
    }
}

#[test]
fn a_newborn_and_an_unfed_nous() {
    let born = nous_view(&sophia(), 0).unwrap();
    assert_eq!(field(&born, "name"), &Value::Str("Sophia".into()));
    assert_eq!(field(&born, "mood"), &Value::Str("curious".into()));
    assert_eq!(level_of(&born, "needs", "energy"), "low");
    assert_eq!(level_of(&born, "drives", "curiosity"), "med");
    assert_eq!(field(&born, "starved_at"), &Value::Null);
    let Value::List(goals) = field(&born, "goals") else { panic!() };
    assert_eq!(goals.len(), 7); // six configured + the standing economic goal

    // Left alone, energy rises until starvation at tick 2334 (the body fixture's death tick).
    let later = nous_view(&sophia(), 3000).unwrap();
    assert_eq!(level_of(&later, "needs", "energy"), "high");
    assert_eq!(field(&later, "starved_at"), &Value::Int(2334));
    let Value::Str(prompt) = field(&later, "system_prompt") else { panic!() };
    assert!(prompt.contains("- energy: high") && prompt.contains("- ticks since your birth: 3000"));
    // Buckets only: no raw drive or need number leaves the core.
    let text = json::dumps_canonical(&later, false);
    assert!(!text.contains("\"value\""));
    assert_eq!(json::parse(&text).map(|v| json::dumps_canonical(&v, false)), Some(text));
}

#[test]
fn bad_input_is_an_error_not_a_crash() {
    assert!(nous_view("identity: [unclosed", 0).is_err());
    assert!(nous_view("- just\n- a list\n", 0).is_err());
    assert!(nous_view(&sophia(), -1).is_err());
    assert!(nous_view(&sophia(), MAX_TICK + 1).is_err());
    assert!(nous_view("", 0).is_ok()); // an empty configuration is a default Nous
}
