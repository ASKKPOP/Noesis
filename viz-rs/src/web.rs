//! The page's handle on the Bevy scene (wasm-bindgen). One app per page: winit can build
//! its event loop only once, so `start` runs the app the first time and later calls only
//! swap the callbacks (a remount of the React map). `dashboard/src/components/worldmap/
//! orbital-bevy.ts` wraps this into the same `OrbitalHandle` the three.js scene returns.

use crate::scene::{self, Cmd, Host};
use js_sys::{Function, Reflect, Uint8Array};
use std::cell::{Cell, RefCell};
use wasm_bindgen::prelude::*;

#[derive(Default)]
struct Callbacks {
    on_pick: Option<Function>,
    on_focus_label: Option<Function>,
    on_focus_grid: Option<Function>,
    render_sign: Option<Function>,
    on_ready: Option<Function>,
    on_fatal: Option<Function>,
}

thread_local! {
    static CB: RefCell<Callbacks> = RefCell::new(Callbacks::default());
    static STARTED: Cell<bool> = const { Cell::new(false) };
    static READY: Cell<bool> = const { Cell::new(false) };
    static FATAL: Cell<bool> = const { Cell::new(false) };
}

fn call1(f: &Option<Function>, arg: JsValue) {
    if let Some(f) = f {
        let _ = f.call1(&JsValue::NULL, &arg);
    }
}

struct WebHost;

impl Host for WebHost {
    fn pick(&self, json: Option<&str>) {
        let arg = json.and_then(|j| js_sys::JSON::parse(j).ok()).unwrap_or(JsValue::NULL);
        CB.with(|c| call1(&c.borrow().on_pick, arg));
    }
    fn focus_label(&self, label: &str) {
        CB.with(|c| call1(&c.borrow().on_focus_label, label.into()));
    }
    fn focus_grid(&self, name: &str) {
        CB.with(|c| call1(&c.borrow().on_focus_grid, name.into()));
    }
    fn sign(&self, text: &str, hex: u32) -> (u32, u32, Vec<u8>) {
        CB.with(|c| {
            let Some(f) = c.borrow().render_sign.clone() else { return (1, 1, vec![0; 4]) };
            let Ok(img) = f.call2(&JsValue::NULL, &text.into(), &JsValue::from(hex)) else { return (1, 1, vec![0; 4]) };
            let num = |k: &str| Reflect::get(&img, &k.into()).ok().and_then(|v| v.as_f64()).unwrap_or(1.0) as u32;
            let data = Reflect::get(&img, &"data".into()).map(|d| Uint8Array::new(&d).to_vec()).unwrap_or_default();
            (num("width"), num("height"), data)
        })
    }
    fn ready(&self) {
        READY.with(|r| r.set(true));
        CB.with(|c| call1(&c.borrow().on_ready, JsValue::TRUE));
    }
}

/// Start the scene in the canvas matching `selector` (first call), or re-attach the
/// callbacks (later calls). `callbacks` = { onPick, onFocusLabel, onFocusGrid, renderSign, onReady, onFatal }.
#[wasm_bindgen]
pub fn start(selector: String, callbacks: JsValue) {
    let get = |k: &str| Reflect::get(&callbacks, &k.into()).ok().and_then(|v| v.dyn_into::<Function>().ok());
    CB.with(|c| {
        *c.borrow_mut() = Callbacks { on_pick: get("onPick"), on_focus_label: get("onFocusLabel"), on_focus_grid: get("onFocusGrid"), render_sign: get("renderSign"), on_ready: get("onReady"), on_fatal: get("onFatal") };
    });
    if FATAL.with(|f| f.get()) {
        CB.with(|c| call1(&c.borrow().on_fatal, "the Bevy scene stopped earlier on this page".into()));
        return;
    }
    if STARTED.with(|s| s.replace(true)) {
        scene::push(Cmd::Paused(false));
        if READY.with(|r| r.get()) {
            CB.with(|c| call1(&c.borrow().on_ready, JsValue::TRUE));
        }
        return;
    }
    // A panic stops the app for good: tell the page, so it can put the three.js scene back.
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        prev(info);
        FATAL.with(|f| f.set(true));
        CB.with(|c| {
            if let Ok(c) = c.try_borrow() {
                call1(&c.on_fatal, info.to_string().into());
            }
        });
    }));
    scene::build_app(Box::new(WebHost), Some(selector)).run();
}

#[wasm_bindgen]
pub fn set_parcels(json: String) {
    scene::push(Cmd::Parcels(json));
}
#[wasm_bindgen]
pub fn set_zones(json: String) {
    scene::push(Cmd::Zones(json));
}
#[wasm_bindgen]
pub fn set_objects(json: String) {
    scene::push(Cmd::Objects(json));
}
#[wasm_bindgen]
pub fn focus_grid(name: String) {
    scene::push(Cmd::Focus(name));
}
#[wasm_bindgen]
pub fn pulse(parcel_id: Option<String>) {
    scene::push(Cmd::Pulse(parcel_id));
}
#[wasm_bindgen]
pub fn set_earth(width: u32, height: u32, rgba: Vec<u8>) {
    scene::push(Cmd::Earth(width, height, rgba));
}
/// Stop drawing (the map was unmounted) or start again.
#[wasm_bindgen]
pub fn set_paused(paused: bool) {
    if paused {
        CB.with(|c| *c.borrow_mut() = Callbacks::default());
    }
    scene::push(Cmd::Paused(paused));
}

/// Counts for checks: `{ parcels, modules, pickables, frames }`.
#[wasm_bindgen]
pub fn stats() -> String {
    scene::STATS.with(|s| {
        let (parcels, modules, pickables, frames) = *s.borrow();
        format!(r#"{{"parcels":{parcels},"modules":{modules},"pickables":{pickables},"frames":{frames}}}"#)
    })
}
