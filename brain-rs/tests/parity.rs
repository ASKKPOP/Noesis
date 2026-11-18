//! Replays `brain/parity/fixtures/*.json` — what the Python Brain computes — against the
//! Rust port. Every number is compared as an exact double, every hash as exact text.

use noesis_brain::json::{self, Value};
use noesis_brain::level::{self, Level};
use noesis_brain::{ananke, bios, chronos, hashing, parsing, thymos};
use serde_json::Value as J;

fn fixture(name: &str) -> J {
    let path = format!("{}/../brain/parity/fixtures/{name}.json", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let doc: J = serde_json::from_str(&text).unwrap();
    assert_eq!(doc["fixture"], name);
    assert_eq!(doc["version"], 1, "fixture version changed — the port must be re-checked");
    doc
}

fn f(v: &J) -> f64 {
    v.as_f64().unwrap_or_else(|| panic!("not a number: {v}"))
}

fn s(v: &J) -> &str {
    v.as_str().unwrap_or_else(|| panic!("not a string: {v}"))
}

fn lvl(v: &J) -> Level {
    Level::parse(s(v)).unwrap()
}

/// Exact double equality, with the bit patterns in the failure message.
fn same(got: f64, want: &J, what: &str) {
    let want = f(want);
    assert!(got == want, "{what}: got {got:?} ({:#x}), want {want:?} ({:#x})", got.to_bits(), want.to_bits());
}

fn names(v: &J) -> Vec<&str> {
    v.as_array().unwrap().iter().map(s).collect()
}

fn check_shared_constants(c: &J) {
    same(level::THRESHOLD_LOW, &c["threshold_low"], "threshold_low");
    same(level::THRESHOLD_HIGH, &c["threshold_high"], "threshold_high");
    same(level::HYSTERESIS_BAND, &c["hysteresis_band"], "hysteresis_band");
    same(level::DECAY_FACTOR, &c["decay_factor"], "decay_factor");
    assert_eq!(c["tau"], level::TAU);
}

fn check_buckets(cases: &J) {
    for case in cases.as_array().unwrap() {
        let got = level::bucket(f(&case["value"]), lvl(&case["prev_level"]));
        assert_eq!(got.as_str(), s(&case["level"]), "bucket {case}");
    }
}

#[test]
fn bios_matches_python() {
    let doc = fixture("bios");
    let c = &doc["constants"];
    check_shared_constants(c);
    assert_eq!(names(&c["need_order"]), bios::Need::ALL.map(bios::Need::as_str));
    for n in bios::Need::ALL {
        same(n.baseline(), &c["baselines"][n.as_str()], "baseline");
        same(n.rise_rate(), &c["rise_rates"][n.as_str()], "rise_rate");
        assert_eq!(n.drive().as_str(), s(&c["need_to_drive"][n.as_str()]));
    }
    assert_eq!(c["baselines"].as_object().unwrap().len(), bios::NEED_COUNT);
    check_buckets(&doc["bucket"]);

    let state_of = |v: &J| bios::NeedState {
        values: bios::Need::ALL.map(|n| f(&v["values"][n.as_str()])),
        levels: bios::Need::ALL.map(|n| lvl(&v["levels"][n.as_str()])),
    };
    assert_eq!(bios::initial_state(), state_of(&doc["initial_state"]));

    for t in doc["trajectories"].as_array().unwrap() {
        let name = s(&t["name"]);
        let mut state = state_of(&t["start"]);
        let mut samples = t["samples"].as_array().unwrap().iter();
        let mut crossings = Vec::new();
        for tick in 1..=8000u64 {
            let (next, crossed) = bios::step(&state, tick);
            state = next;
            for x in crossed {
                crossings.push(serde_json::json!({
                    "tick": tick, "need": x.need.as_str(), "level": x.level.as_str(), "direction": x.direction.as_str(),
                }));
            }
            if tick % 400 == 0 {
                let want = samples.next().unwrap_or_else(|| panic!("{name}: no sample at {tick}"));
                assert_eq!(want["tick"], tick);
                for n in bios::Need::ALL {
                    same(state.values[n as usize], &want["values"][n.as_str()], &format!("{name} tick {tick} {}", n.as_str()));
                    assert_eq!(state.levels[n as usize].as_str(), s(&want["levels"][n.as_str()]), "{name} tick {tick}");
                }
            }
        }
        assert!(samples.next().is_none(), "{name}: unreplayed samples");
        assert_eq!(J::Array(crossings), t["crossings"], "{name}: crossings");
        assert_eq!(bios::is_terminal(&state), t["terminal"].as_bool().unwrap(), "{name}: terminal");
    }
}

#[test]
fn ananke_matches_python() {
    let doc = fixture("ananke");
    let c = &doc["constants"];
    check_shared_constants(c);
    assert_eq!(names(&c["drive_order"]), ananke::Drive::ALL.map(ananke::Drive::as_str));
    for d in ananke::Drive::ALL {
        same(d.baseline(), &c["baselines"][d.as_str()], "baseline");
        same(d.rise_rate(), &c["rise_rates"][d.as_str()], "rise_rate");
    }
    check_buckets(&doc["bucket"]);

    let state_of = |v: &J| ananke::DriveState {
        values: ananke::Drive::ALL.map(|d| f(&v["values"][d.as_str()])),
        levels: ananke::Drive::ALL.map(|d| lvl(&v["levels"][d.as_str()])),
    };
    assert_eq!(ananke::initial_state(), state_of(&doc["initial_state"]));

    for t in doc["trajectories"].as_array().unwrap() {
        let name = s(&t["name"]);
        let seed = t["seed"].as_u64().unwrap();
        let mut state = state_of(&t["start"]);
        let mut samples = t["samples"].as_array().unwrap().iter();
        let mut crossings = Vec::new();
        for tick in 1..=8000u64 {
            let (next, crossed) = ananke::detect_crossing(&ananke::step(&state, seed, tick));
            state = next;
            for x in crossed {
                crossings.push(serde_json::json!({
                    "tick": tick, "drive": x.drive.as_str(), "level": x.level.as_str(), "direction": x.direction.as_str(),
                }));
            }
            if tick % 400 == 0 {
                let want = samples.next().unwrap_or_else(|| panic!("{name}: no sample at {tick}"));
                assert_eq!(want["tick"], tick);
                for d in ananke::Drive::ALL {
                    same(state.values[d as usize], &want["values"][d.as_str()], &format!("{name} tick {tick} {}", d.as_str()));
                    assert_eq!(state.levels[d as usize].as_str(), s(&want["levels"][d.as_str()]), "{name} tick {tick}");
                }
            }
        }
        assert!(samples.next().is_none(), "{name}: unreplayed samples");
        assert_eq!(J::Array(crossings), t["crossings"], "{name}: crossings");
    }
}

#[test]
fn chronos_matches_python() {
    let doc = fixture("chronos");
    let c = &doc["constants"];
    same(chronos::MULTIPLIER_MIN, &c["multiplier_min"], "multiplier_min");
    same(chronos::MULTIPLIER_MAX, &c["multiplier_max"], "multiplier_max");
    for l in Level::ALL {
        same(chronos::curiosity_boost(l), &c["curiosity_boost"][l.as_str()], "curiosity_boost");
        same(chronos::boredom_penalty(l), &c["boredom_penalty"][l.as_str()], "boredom_penalty");
    }
    let cases = doc["compute_multiplier"].as_array().unwrap();
    assert_eq!(cases.len(), 9);
    for case in cases {
        let got = chronos::compute_multiplier(lvl(&case["curiosity_level"]), lvl(&case["boredom_level"]));
        same(got, &case["multiplier"], &case.to_string());
    }
    let tick = |v: &J| v.as_i64().unwrap();
    for case in doc["recency_score_by_tick"].as_array().unwrap() {
        let got = chronos::recency_score_by_tick(tick(&case["memory_tick"]), tick(&case["current_tick"]), f(&case["decay_rate"]));
        same(got, &case["score"], &case.to_string());
    }
    for case in doc["score_with_chronos"].as_array().unwrap() {
        let got = chronos::score_with_chronos(
            tick(&case["memory_tick"]), tick(&case["current_tick"]), f(&case["multiplier"]), f(&case["decay_rate"]),
        );
        same(got, &case["score"], &case.to_string());
    }
}

/// A fixture value as the port's own JSON value (ints stay ints, floats stay floats).
fn to_value(v: &J) -> Value {
    match v {
        J::Null => Value::Null,
        J::Bool(b) => Value::Bool(*b),
        J::Number(n) => n.as_i64().map(Value::Int).unwrap_or_else(|| Value::Float(n.as_f64().unwrap())),
        J::String(t) => Value::Str(t.clone()),
        J::Array(items) => Value::List(items.iter().map(to_value).collect()),
        J::Object(map) => Value::Object(map.iter().map(|(k, v)| (k.clone(), to_value(v))).collect()),
    }
}

#[test]
fn hashing_matches_python() {
    let doc = fixture("hashing");
    assert_eq!(names(&doc["telos_goal_types"]), hashing::GoalType::ALL.map(hashing::GoalType::as_str));
    assert_eq!(names(&doc["telos_goal_statuses"]), hashing::GoalStatus::ALL.map(hashing::GoalStatus::as_str));

    for case in doc["active_telos_hash"].as_array().unwrap() {
        let goals: Vec<hashing::Goal> = case["goals"]
            .as_array()
            .unwrap()
            .iter()
            .map(|g| hashing::Goal {
                description: s(&g["description"]).to_string(),
                goal_type: hashing::GoalType::parse(s(&g["goal_type"])).unwrap(),
                status: hashing::GoalStatus::parse(s(&g["status"])).unwrap(),
                priority: f(&g["priority"]),
                progress: f(&g["progress"]),
            })
            .collect();
        assert_eq!(hashing::active_telos_hash(&goals), s(&case["hash"]), "telos hash {}", case["name"]);
    }

    for case in doc["sha256_canonical"].as_array().unwrap() {
        let value = to_value(&case["input"]);
        assert_eq!(json::dumps_canonical(&value, false), s(&case["canonical_json"]), "canonical text {}", case["name"]);
        assert_eq!(hashing::sha256_canonical(&value), s(&case["hash"]), "hash {}", case["name"]);
        // The canonical text read back is the same value: reader and writer agree.
        assert_eq!(json::dumps_canonical(&json::parse(s(&case["canonical_json"])).unwrap(), false), s(&case["canonical_json"]));
    }
}

#[test]
fn thymos_matches_python() {
    let doc = fixture("thymos");
    let c = &doc["constants"];
    assert_eq!(names(&c["emotion_order"]), thymos::Emotion::ALL.map(thymos::Emotion::as_str));
    same(thymos::DECAY_RATE, &c["decay_rate"], "decay_rate");
    for (setting, mult) in c["intensity_multiplier"].as_object().unwrap() {
        same(thymos::intensity_multiplier(setting), mult, setting);
    }

    for run in doc["runs"].as_array().unwrap() {
        let setting = s(&run["emotional_intensity"]);
        let triggers = run["triggers"]
            .as_object()
            .unwrap()
            .iter()
            .map(|(name, words)| (name.clone(), names(words).into_iter().map(String::from).collect()))
            .collect();
        let mut t = thymos::ThymosTracker::new("calm", setting, triggers);
        for (n, step) in run["steps"].as_array().unwrap().iter().enumerate() {
            let op = &step["op"];
            let at = format!("{setting} step {n}");
            match s(&op["do"]) {
                "feel" => t.feel(
                    thymos::Emotion::parse(s(&op["emotion"])).unwrap(),
                    f(&op["intensity"]),
                    op.get("trigger").map(s).unwrap_or(""),
                ),
                "decay" => (0..op.get("times").and_then(J::as_u64).unwrap_or(1)).for_each(|_| t.decay()),
                "apply_triggers" => {
                    let matched = t.apply_triggers(s(&op["text"]), op.get("base_intensity").map(f).unwrap_or(0.4));
                    let got: Vec<J> = matched.iter().map(|(e, w)| serde_json::json!([e.as_str(), w])).collect();
                    assert_eq!(J::Array(got), step["matched"], "{at}: matched");
                }
                other => panic!("unknown op {other}"),
            }
            for e in thymos::Emotion::ALL {
                same(t.intensities[e as usize], &step["intensities"][e.as_str()], &format!("{at} {}", e.as_str()));
            }
            assert_eq!(t.dominant().0.as_str(), s(&step["dominant"]), "{at}: dominant");
            assert_eq!(t.current_mood(), s(&step["mood"]), "{at}: mood");
        }
    }
}

/// The port's value in the fixture's encoding (NaN / Infinity as tagged strings).
fn to_fixture(v: &Value) -> J {
    match v {
        Value::Null => J::Null,
        Value::Bool(b) => J::Bool(*b),
        Value::Int(n) => J::from(*n),
        Value::BigInt(text) => serde_json::from_str(text).unwrap(),
        Value::Float(x) if x.is_nan() => J::from("<<NaN>>"),
        Value::Float(x) if x.is_infinite() => J::from(if *x > 0.0 { "<<Infinity>>" } else { "<<-Infinity>>" }),
        Value::Float(x) => J::from(*x),
        Value::Str(t) => J::from(t.as_str()),
        Value::List(items) => J::Array(items.iter().map(to_fixture).collect()),
        Value::Object(object) => J::Object(object.iter().map(|(k, v)| (k.clone(), to_fixture(v))).collect()),
    }
}

#[test]
fn parsing_matches_python() {
    let doc = fixture("parsing");
    let v = &doc["vocabulary"];
    assert_eq!(names(&v["decision_actions"]), parsing::DECISION_ACTIONS);
    assert_eq!(names(&v["social_actions"]), parsing::SOCIAL_ACTIONS);
    assert_eq!(names(&v["economic_actions"]), parsing::ECONOMIC_ACTIONS);
    assert_eq!(names(&v["economic_keys"]), parsing::ECONOMIC_KEYS);
    assert_eq!(v["max_tasks"], parsing::MAX_TASKS);

    let object = |o: Option<json::Object>| o.map(|o| to_fixture(&Value::Object(o))).unwrap_or(J::Null);
    let cases = doc["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 35);
    for case in cases {
        let (name, reply, want) = (s(&case["name"]), s(&case["reply"]), &case["parsed"]);
        let got = serde_json::json!({
            "parse_decision": object(parsing::parse_decision(reply)),
            "parse_social_decision": object(parsing::parse_social_decision(reply)),
            "parse_task_list": parsing::parse_task_list(reply),
            "parse_skill": parsing::parse_skill(reply).map(|k| serde_json::json!({
                "name": k.name, "description": k.description, "instructions": k.instructions, "triggers": k.triggers,
            })),
            "parse_economic_decision": object(parsing::parse_economic_decision(reply)),
        });
        // Compared as text: key order is part of the contract, and it is what a caller sees.
        for parser in want.as_object().unwrap().keys() {
            assert_eq!(got[parser].to_string(), want[parser].to_string(), "{name} · {parser}");
        }
        assert_eq!(got.as_object().unwrap().len(), want.as_object().unwrap().len(), "{name}: parser set");
    }
}

#[test]
fn float_text_follows_python_repr() {
    for (x, want) in [
        (0.1, "0.1"), (1.0, "1.0"), (-0.0, "-0.0"), (1e-7, "1e-07"), (1e21, "1e+21"), (1e16, "1e+16"),
        (1e15, "1000000000000000.0"), (0.0001, "0.0001"), (0.00001, "1e-05"), (123.456, "123.456"),
        (1.0 / 3.0, "0.3333333333333333"), (1.2345678901234568e17, "1.2345678901234568e+17"),
        (5e-324, "5e-324"), (1.7976931348623157e308, "1.7976931348623157e+308"), (f64::NAN, "NaN"),
        (f64::NEG_INFINITY, "-Infinity"),
    ] {
        assert_eq!(json::float_repr(x), want);
    }
}

#[test]
fn reader_follows_python_json_loads() {
    // Accepted by Python, refused by strict readers.
    assert!(matches!(json::parse("NaN"), Some(Value::Float(x)) if x.is_nan()));
    assert_eq!(json::parse(" -Infinity "), Some(Value::Float(f64::NEG_INFINITY)));
    assert_eq!(json::parse(r#"{"a":1,"b":2,"a":3}"#), Some(Value::Object(vec![("a".into(), Value::Int(3)), ("b".into(), Value::Int(2))])));
    assert_eq!(json::parse("123456789012345678901234567890"), Some(Value::BigInt("123456789012345678901234567890".into())));
    assert_eq!(json::parse(r#""😀""#), Some(Value::Str("😀".into())));
    assert_eq!(json::parse("1E2"), Some(Value::Float(100.0)));
    assert_eq!(json::parse("-0"), Some(Value::Int(0)));
    // Refused by Python too.
    for bad in ["", "{", "[1,]", r#"{"a":1,}"#, "{'a':1}", "01", "1.", ".5", "+1", "1e", "nan", "\"tab\there\"", r#""\x""#, "1 2", "tru"] {
        assert_eq!(json::parse(bad), None, "{bad:?} must not parse");
    }
    // Deep nesting is refused, not a stack overflow.
    assert_eq!(json::parse(&"[".repeat(100_000)), None);
}
