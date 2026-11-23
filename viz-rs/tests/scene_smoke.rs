//! Runs the real Bevy scene systems headless (no window, no GPU): catches system-parameter
//! conflicts (Bevy error B0001 only fires when an app runs) and panics in setup or in the
//! command handlers, and checks what the feed builds.
#![cfg(feature = "render")]

use bevy::prelude::*;
use noesis_viz::scene::{self, Cmd, Host};
use serde_json::Value;
use std::cell::RefCell;
use std::rc::Rc;

#[derive(Default)]
struct Seen {
    signs: Vec<String>,
    ready: bool,
}

struct TestHost(Rc<RefCell<Seen>>);
impl Host for TestHost {
    fn pick(&self, _json: Option<&str>) {}
    fn focus_label(&self, _label: &str) {}
    fn focus_grid(&self, _name: &str) {}
    fn sign(&self, text: &str, _hex: u32) -> (u32, u32, Vec<u8>) {
        self.0.borrow_mut().signs.push(text.into());
        (4, 1, vec![255; 16])
    }
    fn label(&self, text: &str, _size: u32, _css: &str) -> (u32, u32, Vec<u8>) {
        self.0.borrow_mut().signs.push(format!("label:{text}"));
        (3, 1, vec![255; 12])
    }
    fn ready(&self) {
        self.0.borrow_mut().ready = true;
    }
}

fn headless(seen: Rc<RefCell<Seen>>) -> App {
    let mut app = App::new();
    app.add_plugins((
        MinimalPlugins,
        AssetPlugin::default(),
        TransformPlugin,
        bevy::input::InputPlugin,
        WindowPlugin { primary_window: Some(Window::default()), exit_condition: bevy::window::ExitCondition::DontExit, close_when_requested: false, ..default() },
    ));
    app.init_asset::<Mesh>().init_asset::<StandardMaterial>().init_asset::<Image>();
    scene::install(&mut app, Box::new(TestHost(seen)));
    app
}

fn fixture() -> Value {
    serde_json::from_str(include_str!("../fixtures/layout-parity.json")).unwrap()
}

#[test]
fn scene_runs_and_builds_the_feed() {
    let seen = Rc::new(RefCell::new(Seen::default()));
    let mut app = headless(seen.clone());
    for _ in 0..4 {
        app.update();
    }
    assert!(seen.borrow().ready, "ready is reported after a few frames");
    // Before any feed: the core egg and the two forming Grids can be picked.
    assert_eq!(scene::pickable_ids(app.world_mut()), vec!["genesis:government_quarter:0001", "mars:grid:empty", "moon:grid:empty"]);

    let f = fixture();
    let parcels = f["parcels"].to_string();
    let modules = f["layout"].as_array().unwrap().len();
    scene::push(Cmd::Parcels(parcels.clone()));
    app.update();
    app.update();
    assert_eq!(scene::pickable_ids(app.world_mut()).len(), modules + 3, "one pickable module per placed parcel");
    app.update();
    let stats = scene::STATS.with(|s| *s.borrow());
    assert_eq!((stats.0, stats.1), (f["parcels"].as_array().unwrap().len(), modules), "stats: parcels held, modules built");

    // A second feed replaces the modules (no duplicates).
    scene::push(Cmd::Parcels(parcels));
    app.update();
    app.update();
    assert_eq!(scene::pickable_ids(app.world_mut()).len(), modules + 3);

    // Objects, zones, focus, pulses, pause/resume, Earth pixels: none may panic.
    scene::push(Cmd::Objects(r#"[{"object_id":"obj-1","function_type":"energy","physics_spec":{"altitude_km":400}},{"object_id":"obj-2"}]"#.into()));
    scene::push(Cmd::Zones(r#"[{"zone_id":"government_quarter","label":"Senate Hill","kind":"civic"},{"zone_id":"residential","label":"Residential","kind":"home"},{"zone_id":"harbor","label":"Harbor","kind":"business"}]"#.into()));
    scene::push(Cmd::Focus("Moon".into()));
    scene::push(Cmd::Pulse(Some("obj-1".into())));
    scene::push(Cmd::Pulse(None));
    scene::push(Cmd::Earth(2, 1, vec![9; 8]));
    scene::push(Cmd::Paused(true));
    scene::push(Cmd::Paused(false));
    for _ in 0..5 {
        app.update();
    }
    let ids = scene::pickable_ids(app.world_mut());
    assert!(ids.contains(&"obj-1".to_string()) && ids.contains(&"obj-2".to_string()));
    assert!(seen.borrow().signs.iter().any(|s| s == "SENATE HILL"), "a relabelled zone gets a new sign");
    // Zones dropped by the Polis (infrastructure, business, shopping, manufacture) hide their signs.
    let shown = scene::visible_signs(app.world_mut());
    assert!(shown > 0);

    // Bad input is ignored, not fatal.
    scene::push(Cmd::Parcels("not json".into()));
    scene::push(Cmd::Zones("[1,2]".into()));
    scene::push(Cmd::Earth(10, 10, vec![0; 3]));
    app.update();
    assert_eq!(scene::pickable_ids(app.world_mut()).len(), modules + 3 + 2);
}

fn district_lots(f: &Value, zone: &str) -> String {
    f["district"]["zones"].as_array().unwrap().iter().find(|z| z["zone"] == zone).unwrap()["lots"].to_string()
}

fn dstats() -> (bool, usize, usize) {
    noesis_viz::district::DSTATS.with(|s| *s.borrow())
}

fn active_cameras(app: &mut App) -> usize {
    let mut q = app.world_mut().query::<&Camera>();
    q.iter(app.world()).filter(|c| c.is_active).count()
}

#[test]
fn district_opens_draws_and_closes() {
    let seen = Rc::new(RefCell::new(Seen::default()));
    let mut app = headless(seen.clone());
    for _ in 0..3 {
        app.update();
    }
    let f = fixture();
    let harbor = district_lots(&f, "harbor");
    let n = serde_json::from_str::<Vec<Value>>(&harbor).unwrap().len();

    scene::push(Cmd::DistrictOpen(0x3fa6bd));
    scene::push(Cmd::DistrictLots(harbor.clone()));
    scene::push(Cmd::DistrictNous(r#"[{"did":"did:noesis:a1","name":"Hermes","color":16737095,"asleep":false},{"did":"did:noesis:b2","name":"Sophia","color":13434726,"asleep":true}]"#.into()));
    app.update();
    app.update();
    assert_eq!(dstats(), (true, n, 2), "open, every lot placed, two Nous");
    assert_eq!(active_cameras(&mut app), 1, "one camera draws");
    assert!(noesis_viz::district::camera_active(app.world_mut()), "and it is the district's");
    assert!(seen.borrow().signs.iter().any(|s| s == "label:Hermes"), "names are drawn by the page");

    // A Nous acts, a lot flashes, one Nous leaves (it walks off, then is gone).
    scene::push(Cmd::DistrictAct("did:noesis:a1".into(), "⇄".into()));
    scene::push(Cmd::DistrictPulse(Some("x:home".into())));
    scene::push(Cmd::DistrictPulse(Some("not-here".into())));
    scene::push(Cmd::DistrictNous(r#"[{"did":"did:noesis:a1","name":"Hermes","color":16737095,"asleep":false}]"#.into()));
    for _ in 0..400 {
        app.update();
    }
    assert!(seen.borrow().signs.iter().any(|s| s == "label:⇄"));
    // Time in the headless app barely moves, so the leaver may still be walking; it must not have duplicated.
    assert!(dstats().2 <= 2);

    // New lots replace the old ones; bad input is ignored.
    scene::push(Cmd::DistrictLots(district_lots(&f, "residential")));
    scene::push(Cmd::DistrictLots("nope".into()));
    scene::push(Cmd::DistrictNous("[1]".into()));
    app.update();
    app.update();
    let residential = serde_json::from_str::<Vec<Value>>(&district_lots(&f, "residential")).unwrap().len();
    assert_eq!(dstats().1, residential);

    // Closing puts the station's camera back and leaves nothing of the district.
    scene::push(Cmd::DistrictClose);
    app.update();
    app.update();
    assert_eq!(dstats(), (false, 0, 0));
    assert_eq!(active_cameras(&mut app), 1, "one camera draws");
    assert!(!noesis_viz::district::camera_active(app.world_mut()), "and it is the station's");
    // Reopening works, and district commands while closed do nothing.
    scene::push(Cmd::DistrictLots(harbor.clone()));
    app.update();
    assert_eq!(dstats().1, 0);
    scene::push(Cmd::DistrictOpen(0x5a84c4));
    scene::push(Cmd::DistrictLots(harbor));
    app.update();
    app.update();
    assert_eq!(dstats(), (true, n, 0));
}
