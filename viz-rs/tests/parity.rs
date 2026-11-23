//! Replays fixtures/layout-parity.json (recorded from the TypeScript by the dashboard's
//! test/orbital-layout-parity.test.ts) against the Rust layout.

use noesis_viz::layout::*;
use serde_json::Value;

fn fixture() -> Value {
    serde_json::from_str(include_str!("../fixtures/layout-parity.json")).unwrap()
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() <= 1e-9 * (1.0 + a.abs().max(b.abs()))
}

fn parcels(f: &Value) -> Vec<Parcel> {
    serde_json::from_value(f["parcels"].clone()).unwrap()
}

#[test]
fn layout_matches_typescript() {
    let f = fixture();
    let ps = parcels(&f);
    let got = layout_parcels(&ps);
    let want = f["layout"].as_array().unwrap();
    assert_eq!(got.len(), want.len(), "module count");
    for ((k, place), w) in got.iter().zip(want) {
        let id = w["id"].as_str().unwrap();
        assert_eq!(ps[*k].id, id);
        assert_eq!(place.parent.as_str(), w["parent"].as_str().unwrap(), "{id} parent");
        assert!(close(place.ring, w["ring"].as_f64().unwrap()), "{id} ring");
        assert!(close(place.size, w["size"].as_f64().unwrap()), "{id} size");
        for i in 0..3 {
            assert!(close(place.pos[i], w["pos"][i].as_f64().unwrap()), "{id} pos[{i}]: {} vs {}", place.pos[i], w["pos"][i]);
        }
    }
}

#[test]
fn status_matches_typescript() {
    let f = fixture();
    let ps = parcels(&f);
    let custom: Vec<ZoneView> = serde_json::from_value(f["custom_zones"].clone()).unwrap();
    let tpl = template_zones();
    for (i, p) in ps.iter().enumerate() {
        assert_eq!(render_status(p, &tpl).as_str(), f["status_template"][i].as_str().unwrap(), "{} template", p.id);
        assert_eq!(render_status(p, &custom).as_str(), f["status_custom"][i].as_str().unwrap(), "{} custom", p.id);
    }
}

#[test]
fn colors_and_signs_match_typescript() {
    let f = fixture();
    for c in f["colors"].as_array().unwrap() {
        let id = c["id"].as_str().unwrap();
        assert_eq!(zone_color(id) as u64, c["color"].as_u64().unwrap(), "colour of {id:?}");
    }
    let tpl = template_zones();
    for (z, s) in tpl.iter().zip(f["signs_template"].as_array().unwrap()) {
        assert_eq!(zone_sign(z), s.as_str().unwrap());
    }
    let custom: Vec<ZoneView> = serde_json::from_value(f["custom_zones"].clone()).unwrap();
    for (z, s) in custom.iter().zip(f["signs_custom"].as_array().unwrap()) {
        assert_eq!(zone_sign(z), s.as_str().unwrap());
    }
}

#[test]
fn fit_distance_matches_typescript() {
    let f = fixture();
    for c in f["fit"].as_array().unwrap() {
        let d = fit_distance(c["radius"].as_f64().unwrap(), c["fov"].as_f64().unwrap(), c["aspect"].as_f64().unwrap());
        assert!(close(d, c["distance"].as_f64().unwrap()), "{c}");
    }
}
