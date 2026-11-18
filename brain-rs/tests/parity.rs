//! Replays `brain/parity/fixtures/*.json` — what the Python Brain computes — against the
//! Rust port. Every number is compared as an exact double, every hash as exact text.

use noesis_brain::json::{self, Value};
use noesis_brain::level::{self, Level};
use noesis_brain::{ananke, bios, body, chronos, config, hashing, memory, parsing, prompts, psyche, state_hash, system_prompt, telos, thymos};
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
                domain: telos::GoalDomain::General,
                last_advanced_tick: g["last_advanced_tick"].as_i64().unwrap(),
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

fn psyche_of(v: &J) -> psyche::Psyche {
    psyche::Psyche {
        name: s(&v["name"]).to_string(),
        archetype: s(&v["archetype"]).to_string(),
        personality: psyche::Dimension::ALL.map(|d| v["personality"].get(d.as_str()).map(s).unwrap_or("medium").to_string()),
        values: names(&v["values"]).into_iter().map(String::from).collect(),
        communication_style: s(&v["communication_style"]).to_string(),
        birth_date: v.get("birth_date").map(s).unwrap_or("").to_string(),
    }
}

#[test]
fn psyche_matches_python() {
    let doc = fixture("psyche");
    let c = &doc["constants"];
    assert_eq!(names(&c["dimension_order"]), psyche::Dimension::ALL.map(psyche::Dimension::as_str));
    assert_eq!(names(&c["communication_styles"]), psyche::COMMUNICATION_STYLES);
    for (level, value) in c["level_map"].as_object().unwrap() {
        same(psyche::level_numeric(level), value, level);
    }
    for d in psyche::Dimension::ALL {
        let table = c["level_descriptions"][d.as_str()].as_object().unwrap();
        assert_eq!(table.len(), 3);
        for (level, text) in table {
            assert_eq!(psyche::level_description(d, level), s(text));
        }
    }
    let cases = doc["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 3);
    for case in cases {
        let p = psyche_of(&case["psyche"]);
        for d in psyche::Dimension::ALL {
            assert_eq!(p.level(d), s(&case["levels"][d.as_str()]));
            same(p.numeric(d), &case["numeric"][d.as_str()], d.as_str());
        }
        assert_eq!(p.describe_personality(), s(&case["describe_personality"]), "{}", case["name"]);
        assert_eq!(p.describe_values(), s(&case["describe_values"]), "{}", case["name"]);
    }
}

#[test]
fn state_hash_matches_python() {
    let doc = fixture("state_hash");
    assert_eq!(names(&doc["hash_keys"]), ["psyche_hash", "thymos_hash", "telos_hash", "memory_stream_hash"]);
    let states = doc["states"].as_array().unwrap();
    assert_eq!(states.len(), 4);
    for state in states {
        let (name, want) = (s(&state["name"]), &state["hashes"]);
        assert_eq!(want.as_object().unwrap().len(), 4);
        assert_eq!(state_hash::hash_psyche(&psyche_of(&state["psyche"])), s(&want["psyche_hash"]), "{name}: psyche");

        let intensities = thymos::Emotion::ALL.map(|e| f(&state["emotions"][e.as_str()]));
        assert_eq!(state_hash::hash_thymos(s(&state["baseline_mood"]), &intensities), s(&want["thymos_hash"]), "{name}: thymos");

        let goals: Vec<(&str, f64)> =
            state["active_goals"].as_array().unwrap().iter().map(|g| (s(&g["description"]), f(&g["priority"]))).collect();
        assert_eq!(state_hash::hash_telos(&goals), s(&want["telos_hash"]), "{name}: telos");

        let entries: Option<Vec<(Option<i64>, &str)>> =
            state["memory"].as_array().map(|list| list.iter().map(|e| (e["id"].as_i64(), s(&e["content"]))).collect());
        assert_eq!(state_hash::hash_memory_stream(entries.as_deref()), s(&want["memory_stream_hash"]), "{name}: memory");
    }
}

#[test]
fn retrieval_matches_python() {
    let doc = fixture("retrieval");
    same(chronos::DEFAULT_DECAY_RATE, &doc["decay_rate"], "decay_rate");
    let pool: Vec<memory::Memory> = doc["memories"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| memory::Memory { content: s(&m["content"]).to_string(), importance: f(&m["importance"]), tick: m["tick"].as_i64().unwrap() })
        .collect();
    let scores = doc["scores"].as_array().unwrap();
    assert_eq!(scores.len(), 216);
    for case in scores {
        let m = &pool[case["memory"].as_u64().unwrap() as usize];
        let query = s(&case["query"]);
        let at = case.to_string();
        same(memory::importance_score(m), &case["importance_score"], &at);
        same(memory::relevance_score(m, query), &case["relevance_score"], &at);
        let got = memory::score_with_chronos(m, query, case["current_tick"].as_i64().unwrap(), f(&case["multiplier"]));
        same(got, &case["score"], &at);
    }
    for case in doc["ranked"].as_array().unwrap() {
        let got = memory::ranked_memories(
            &pool, s(&case["query"]), case["tick"].as_i64().unwrap(), case["k"].as_u64().unwrap() as usize, case["prefix"].as_str(),
        );
        assert_eq!(got, names(&case["contents"]), "ranked {}", case["query"]);
    }
}

fn refs(v: &[String]) -> Vec<&str> {
    v.iter().map(String::as_str).collect()
}

#[test]
fn prompts_match_python() {
    let doc = fixture("prompts");
    let strs = |v: &J| -> Vec<String> { v.as_array().map(|a| a.iter().map(|x| s(x).to_string()).collect()).unwrap_or_default() };
    let object = |v: &J| -> json::Object {
        match to_value(v) {
            Value::Object(o) => o,
            other => panic!("not an object: {other:?}"),
        }
    };
    let objects = |v: &J| -> Vec<json::Object> { v.as_array().map(|a| a.iter().map(object).collect()).unwrap_or_default() };

    let cases = doc["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 16);
    for (n, case) in cases.iter().enumerate() {
        let a = &case["args"];
        let got = match s(&case["builder"]) {
            "build_planning_prompt" => prompts::build_planning_prompt(s(&a[0]), s(&a[1]), &refs(&strs(&a[2]))),
            "build_decision_prompt" => prompts::build_decision_prompt(s(&a[0]), a[1].as_str(), &refs(&strs(&a[2]))),
            "build_skill_distill_prompt" => prompts::build_skill_distill_prompt(s(&a[0]), &refs(&strs(&a[1]))),
            "build_social_prompt" => {
                prompts::build_social_prompt(&refs(&strs(&a[0])), &refs(&strs(&a[1])), &objects(&a[2]), &objects(&a[3]))
            }
            "build_economic_decision_prompt" => {
                let due = (!a[1].is_null()).then(|| object(&a[1]));
                prompts::build_economic_decision_prompt(&object(&a[0]), due.as_ref(), &objects(&a[2]))
            }
            other => panic!("unknown builder {other}"),
        };
        assert_eq!(got, s(&case["prompt"]), "case {n}: {}", case["builder"]);
    }
}

#[test]
fn telos_matches_python() {
    let doc = fixture("telos");
    let c = &doc["constants"];
    assert_eq!(s(&c["economic_goal_text"]), telos::ECONOMIC_GOAL_TEXT);
    same(telos::ECONOMIC_GOAL_PRIORITY, &c["economic_goal_priority"], "economic priority");
    assert_eq!(names(&c["goal_domains"]), telos::GoalDomain::ALL.map(telos::GoalDomain::as_str));

    let descriptions = |goals: Vec<&telos::Goal>| -> Vec<String> { goals.iter().map(|g| g.description.clone()).collect() };
    for (r, run) in doc["runs"].as_array().unwrap().iter().enumerate() {
        let list = |key: &str| -> Vec<String> { run["from_yaml"].get(key).map(|v| names(v).into_iter().map(String::from).collect()).unwrap_or_default() };
        let (short, medium, long) = (list("short_term"), list("medium_term"), list("long_term"));
        let mut m = telos::TelosManager::from_config(&refs(&short), &refs(&medium), &refs(&long));
        for (n, step) in run["steps"].as_array().unwrap().iter().enumerate() {
            let op = &step["op"];
            let at = format!("run {r} step {n} {op}");
            let index = || op["index"].as_u64().unwrap() as usize;
            match s(&op["do"]) {
                "start" => {}
                "add_goal" => {
                    m.add_goal(
                        s(&op["description"]),
                        telos::GoalType::parse(s(&op["goal_type"])).unwrap(),
                        op.get("priority").map(f).unwrap_or(0.5),
                        telos::GoalDomain::parse(op.get("domain").map(s).unwrap_or("general")).unwrap(),
                        op.get("tick").and_then(J::as_i64).unwrap_or(0),
                    );
                }
                "seed_economic_goal" => {
                    m.seed_economic_goal();
                }
                "evolve" => {
                    let changed = m.evolve(
                        op["current_tick"].as_i64().unwrap(),
                        op.get("stale_ticks").and_then(J::as_i64).unwrap_or(telos::DEFAULT_STALE_TICKS),
                        op.get("floor").map(f).unwrap_or(telos::DEFAULT_PRIORITY_FLOOR),
                    );
                    assert_eq!(changed, step["changed"].as_bool().unwrap(), "{at}: changed");
                }
                "advance" => m.goals[index()].advance(f(&op["amount"]), op.get("tick").and_then(J::as_i64)),
                "abandon" => m.goals[index()].abandon(),
                "block" => m.goals[index()].block(),
                "unblock" => m.goals[index()].unblock(),
                other => panic!("unknown op {other}"),
            }
            let want = step["goals"].as_array().unwrap();
            assert_eq!(m.goals.len(), want.len(), "{at}: goal count");
            for (g, w) in m.goals.iter().zip(want) {
                assert_eq!(g.description, s(&w["description"]), "{at}");
                assert_eq!(g.goal_type.as_str(), s(&w["goal_type"]), "{at}");
                assert_eq!(g.status.as_str(), s(&w["status"]), "{at}");
                assert_eq!(g.domain.as_str(), s(&w["domain"]), "{at}");
                assert_eq!(g.last_advanced_tick, w["last_advanced_tick"].as_i64().unwrap(), "{at}");
                same(g.priority, &w["priority"], &format!("{at}: priority of {}", g.description));
                same(g.progress, &w["progress"], &format!("{at}: progress of {}", g.description));
            }
            assert_eq!(m.describe(), s(&step["describe"]), "{at}: describe");
            assert_eq!(descriptions(m.top_priority(3)), names(&step["top_priority_3"]), "{at}: top 3");
            assert_eq!(descriptions(m.top_priority(1)), names(&step["top_priority_1"]), "{at}: top 1");
            assert_eq!(descriptions(m.economic_goals()), names(&step["economic_goals"]), "{at}: economic");
            assert_eq!(hashing::active_telos_hash(&m.goals), s(&step["active_telos_hash"]), "{at}: hash");
        }
    }
}

fn pair_refs(v: &[(String, String)]) -> Vec<(&str, &str)> {
    v.iter().map(|(a, b)| (a.as_str(), b.as_str())).collect()
}

#[test]
fn system_prompt_matches_python() {
    let doc = fixture("system_prompt");
    let cases = doc["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 7);
    for case in cases {
        let (name, i) = (s(&case["name"]), &case["input"]);
        let psyche = psyche_of(&i["psyche"]);
        let mut mood = thymos::ThymosTracker::new(s(&i["mood"]["baseline_mood"]), "medium", Vec::new());
        mood.intensities = thymos::Emotion::ALL.map(|e| f(&i["mood"]["intensities"][e.as_str()]));
        let mut goals = telos::TelosManager::default();
        for g in i["goals"].as_array().unwrap() {
            let goal = goals.add_goal(
                s(&g["description"]),
                telos::GoalType::parse(s(&g["goal_type"])).unwrap(),
                f(&g["priority"]),
                telos::GoalDomain::parse(g.get("domain").map(s).unwrap_or("general")).unwrap(),
                0,
            );
            goal.progress = g.get("progress").map(f).unwrap_or(0.0);
            goal.status = telos::GoalStatus::parse(g.get("status").map(s).unwrap_or("active")).unwrap();
        }

        let strings = |key: &str| -> Vec<String> { i.get(key).map(|v| names(v).into_iter().map(String::from).collect()).unwrap_or_default() };
        let pairs = |key: &str, a: &str, b: &str| -> Vec<(String, String)> {
            i.get(key).and_then(J::as_array).map(|l| l.iter().map(|x| (s(&x[a]).to_string(), s(&x[b]).to_string())).collect()).unwrap_or_default()
        };
        let object = |key: &str| -> Option<json::Object> {
            match i.get(key).map(to_value) {
                Some(Value::Object(o)) => Some(o),
                _ => None,
            }
        };
        let list = |key: &str| -> Vec<Value> {
            match i.get(key).map(to_value) {
                Some(Value::List(l)) => l,
                _ => Vec::new(),
            }
        };

        let (rules, reflections, ltm) = (strings("rules"), strings("reflections"), strings("ltm_memories"));
        let skills = pairs("skills", "name", "instructions");
        let voices: Vec<(String, String)> = i.get("peer_voices").and_then(J::as_array)
            .map(|l| l.iter().map(|x| (s(&x[0]).to_string(), s(&x[1]).to_string())).collect()).unwrap_or_default();
        let tom: Vec<system_prompt::PeerBeliefs> = i.get("tom_context").and_then(J::as_array).map(|l| l.iter().map(|c| system_prompt::PeerBeliefs {
            target_did: s(&c["target_did"]).to_string(),
            beliefs: c["beliefs"].as_array().unwrap().iter().map(|b| system_prompt::Belief {
                dimension: s(&b["dimension"]).to_string(), content: s(&b["content"]).to_string(), confidence: f(&b["confidence"]),
            }).collect(),
        }).collect()).unwrap_or_default();
        let lore: Vec<system_prompt::LoreEntry> = i.get("lore_entries").and_then(J::as_array).map(|l| l.iter().map(|e| system_prompt::LoreEntry {
            category_tag: s(&e["category_tag"]).to_string(), title: s(&e["title"]).to_string(), content: s(&e["content"]).to_string(),
        }).collect()).unwrap_or_default();
        let places = list("my_places");
        let grids: Vec<json::Object> = list("grids_in_reach").into_iter().map(|v| match v { Value::Object(o) => o, other => panic!("{other:?}") }).collect();
        let (economic, world) = (object("economic_state"), object("world_state"));
        let (rules_r, reflections_r, ltm_r) = (refs(&rules), refs(&reflections), refs(&ltm));
        let (skills_r, voices_r) = (pair_refs(&skills), pair_refs(&voices));

        let mut input = system_prompt::SystemPromptInput::new(&psyche, &mood, &goals);
        if let Some(grid) = i.get("grid_name") { input.grid_name = s(grid); }
        if let Some(location) = i.get("location") { input.location = s(location); }
        input.bios_levels = i.get("bios_levels").filter(|b| !b.is_null()).map(|b| (b.get("energy").map(lvl), b.get("sustenance").map(lvl)));
        input.epoch_since_spawn = i.get("epoch_since_spawn").and_then(J::as_i64);
        input.subjective_multiplier = i.get("subjective_multiplier").map(f);
        input.rules = &rules_r;
        input.reflections = &reflections_r;
        input.skills = &skills_r;
        input.ltm_memories = &ltm_r;
        input.peer_voices = &voices_r;
        input.tom_context = &tom;
        input.lore_entries = &lore;
        input.my_places = &places;
        input.economic_state = economic.as_ref();
        input.grids_in_reach = &grids;
        input.world_state = world.as_ref();
        input.intent = i.get("intent").map(s).unwrap_or("");

        let got = system_prompt::build_system_prompt(&input);
        let want = s(&case["prompt"]);
        if got != want {
            let line = got.lines().zip(want.lines()).position(|(a, b)| a != b).unwrap_or(0);
            panic!("{name}: first difference at line {}\n  got : {:?}\n  want: {:?}", line + 1, got.lines().nth(line), want.lines().nth(line));
        }
    }
}

#[test]
fn spawn_matches_python() {
    let doc = fixture("spawn");
    let configs = doc["configs"].as_array().unwrap();
    assert!(configs.len() >= 7);
    for case in configs {
        let name = s(&case["name"]);
        let nous = config::spawn(s(&case["yaml"])).unwrap_or_else(|e| panic!("{name}: {e}"));
        let p = &case["psyche"];
        assert_eq!(nous.psyche.name, s(&p["name"]), "{name}");
        assert_eq!(nous.psyche.archetype, s(&p["archetype"]), "{name}");
        assert_eq!(nous.psyche.birth_date, s(&p["birth_date"]), "{name}");
        assert_eq!(nous.psyche.communication_style, s(&p["communication_style"]), "{name}");
        assert_eq!(nous.psyche.values, names(&p["values"]), "{name}");
        for d in psyche::Dimension::ALL {
            assert_eq!(nous.psyche.level(d), s(&p["personality"][d.as_str()]), "{name} {}", d.as_str());
        }
        let t = &case["thymos"];
        assert_eq!(nous.thymos.baseline_mood, s(&t["baseline_mood"]), "{name}");
        assert_eq!(nous.thymos.emotional_intensity, s(&t["emotional_intensity"]), "{name}");
        same(thymos::intensity_multiplier(&nous.thymos.emotional_intensity), &t["multiplier"], name);
        let want_triggers: Vec<(String, Vec<String>)> = t["triggers"].as_object().unwrap().iter()
            .map(|(k, v)| (k.clone(), names(v).into_iter().map(String::from).collect())).collect();
        assert_eq!(nous.thymos.triggers(), want_triggers.as_slice(), "{name}: triggers");
        let want_goals = case["goals"].as_array().unwrap();
        assert_eq!(nous.telos.goals.len(), want_goals.len(), "{name}: goal count");
        for (g, w) in nous.telos.goals.iter().zip(want_goals) {
            assert_eq!(g.description, s(&w["description"]), "{name}");
            assert_eq!(g.goal_type.as_str(), s(&w["goal_type"]), "{name}");
            assert_eq!(g.domain.as_str(), s(&w["domain"]), "{name}");
            same(g.priority, &w["priority"], name);
        }
        let prompt = system_prompt::build_system_prompt(&system_prompt::SystemPromptInput::new(&nous.psyche, &nous.thymos, &nous.telos));
        assert_eq!(prompt, s(&case["system_prompt"]), "{name}: system prompt");
    }
}

#[test]
fn body_matches_python() {
    let doc = fixture("body");
    let runs = doc["runs"].as_array().unwrap();
    assert_eq!(runs.len(), 2);
    for run in runs {
        let linked = run["needs_lift_drives"].as_bool().unwrap();
        let mut b = body::Body::new(0, linked);
        let mut samples = run["samples"].as_array().unwrap().iter().peekable();
        let (mut drive_x, mut need_x, mut death) = (Vec::new(), Vec::new(), None);
        for tick in 1..=run["ticks"].as_i64().unwrap() {
            let events = b.on_tick(tick);
            for x in events.drive_crossings {
                drive_x.push(serde_json::json!({"tick": tick, "drive": x.drive.as_str(), "level": x.level.as_str(), "direction": x.direction.as_str()}));
            }
            for x in events.need_crossings {
                need_x.push(serde_json::json!({"tick": tick, "need": x.need.as_str(), "level": x.level.as_str(), "direction": x.direction.as_str()}));
            }
            if events.starved && death.is_none() {
                death = Some(tick);
            }
            if samples.peek().is_some_and(|w| w["tick"] == tick) {
                let want = samples.next().unwrap();
                let at = format!("linked={linked} tick {tick}");
                for d in ananke::Drive::ALL {
                    same(b.drives.values[d as usize], &want["drive_values"][d.as_str()], &at);
                    assert_eq!(b.drives.levels[d as usize].as_str(), s(&want["drive_levels"][d.as_str()]), "{at} {}", d.as_str());
                }
                for n in bios::Need::ALL {
                    same(b.needs.values[n as usize], &want["need_values"][n.as_str()], &at);
                    assert_eq!(b.needs.levels[n as usize].as_str(), s(&want["need_levels"][n.as_str()]), "{at} {}", n.as_str());
                }
                assert_eq!(b.epoch_since_spawn(tick), want["epoch_since_spawn"].as_i64().unwrap());
            }
        }
        assert!(samples.next().is_none(), "unreplayed samples");
        assert_eq!(J::Array(drive_x), run["drive_crossings"], "linked={linked}: drive crossings");
        assert_eq!(J::Array(need_x), run["need_crossings"], "linked={linked}: need crossings");
        assert_eq!(death, run["first_death_tick"].as_i64(), "linked={linked}: death tick");
    }
}
