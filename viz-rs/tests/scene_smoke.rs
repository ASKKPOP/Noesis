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
