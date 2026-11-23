//! The orbital Genesis station in Bevy — a port of
//! `dashboard/src/components/worldmap/orbital-station-scene.ts` (the three.js renderer,
//! kept as the fallback). Genesis Core above Earth (Earth never transforms), its rings of
//! parcel modules, Moon & Mars as separate forming Grids, built orbital objects, event
//! pulses, the focus camera and click picking.
//!
//! The page talks to the running app through a command queue ([`push`]) and hears back
//! through a [`Host`] (pick, focus label, focus Grid, sign rendering).

use crate::layout::{self, Parcel, ParcelParent, RenderStatus, ZoneView, INCL};
use bevy::asset::RenderAssetUsages;
use bevy::camera::Exposure;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy::light::GlobalAmbientLight;
use bevy::mesh::{Indices, PrimitiveTopology, TorusMeshBuilder};
use bevy::prelude::*;
use bevy::render::render_resource::{Extent3d, Face, TextureDimension, TextureFormat};
use bevy::window::{PrimaryWindow, WindowResolution};
use bevy::winit::{EventLoopProxyWrapper, UpdateMode, WinitSettings, WinitUserEvent};
use std::cell::RefCell;
use std::f32::consts::PI;
use std::time::Duration;

// ── bridge ────────────────────────────────────────────────────────────────────

/// What the scene tells the page.
pub trait Host: 'static {
    /// A module, the core, a forming Grid or an object was clicked (its feed JSON), or nothing.
    fn pick(&self, json: Option<&str>);
    fn focus_label(&self, label: &str);
    /// A Grid was clicked and the camera is zooming to it.
    fn focus_grid(&self, name: &str);
    /// Draw a neon sign: (width, height, RGBA8 bytes).
    fn sign(&self, text: &str, hex: u32) -> (u32, u32, Vec<u8>);
    /// The first frames have rendered (the page may now hide its fallback).
    fn ready(&self);
}

/// What the page tells the scene.
pub enum Cmd {
    Parcels(String),
    Zones(String),
    Objects(String),
    Focus(String),
    Pulse(Option<String>),
    /// Earth's texture as RGBA8 pixels (the browser decodes the JPEG).
    Earth(u32, u32, Vec<u8>),
    Paused(bool),
}

thread_local! {
    /// Counts the page can read (`stats()`): feed parcels held, modules built, pickables, frames.
    pub static STATS: RefCell<(usize, usize, usize, u32)> = const { RefCell::new((0, 0, 0, 0)) };
    static QUEUE: RefCell<Vec<Cmd>> = const { RefCell::new(Vec::new()) };
    static WAKE: RefCell<Option<Box<dyn Fn()>>> = const { RefCell::new(None) };
}

/// Queue a command for the next frame, and wake the loop if it is idle (paused).
pub fn push(cmd: Cmd) {
    QUEUE.with(|q| q.borrow_mut().push(cmd));
    WAKE.with(|w| {
        if let Some(f) = w.borrow().as_ref() {
            f();
        }
    });
}

struct HostRes(Box<dyn Host>);

// ── components & state ────────────────────────────────────────────────────────

/// Euler rotation (three.js order XYZ) advanced every frame by `rate` (per 60 Hz frame).
#[derive(Component)]
struct Spin {
    euler: Vec3,
    rate: Vec3,
}

#[derive(Clone)]
enum Shape {
    Sphere(f32),
    /// Radius and half-length of the straight part, along the entity's local Y.
    Capsule(f32, f32),
}

#[derive(Component, Clone)]
struct Pickable {
    id: String,
    json: String,
    shape: Shape,
    /// A forming Grid's body name (Moon / Mars): a click flies there.
    future_body: Option<String>,
}

/// Rebuilt on every parcel / zone update.
#[derive(Component)]
struct ModuleTag;
/// The pickable body of a parcel module.
#[derive(Component)]
struct ModuleBody;
#[derive(Component)]
struct ObjectTag;

/// A sign quad kept facing the camera, placed at its anchor's world position.
#[derive(Component)]
struct Billboard {
    anchor: Entity,
}

#[derive(Component)]
struct PulseFx {
    pts: [[f64; 3]; 3],
    born: f32,
}

#[derive(Component)]
struct Beacon;
#[derive(Component)]
struct BeaconLight;
#[derive(Component)]
struct CoreLight;
#[derive(Component)]
struct Planet;
#[derive(Component)]
struct MainCam;

struct ZoneSign {
    anchor: Entity,
    sign: Entity,
    hex: u32,
    text: String,
}

#[derive(Resource)]
struct World3 {
    station: Entity,
    r3spin: Entity,
    r3tilt: Entity,
    objects_root: Entity,
    zones: Vec<ZoneView>,
    zone_signs: Vec<(String, ZoneSign)>,
    parcels: Vec<(Parcel, String)>,
    scaffold_done: bool,
    planet_mat: Handle<StandardMaterial>,
    beacon_mat: Handle<StandardMaterial>,
    /// Frames since start (60 Hz units, like the three.js loop's `t`).
    t: f32,
}

struct Focus {
    pos: Vec3,
    radius: f32,
    label: String,
}

#[derive(Resource)]
struct CamState {
    rx: f32,
    ry: f32,
    dist: f32,
    dist_goal: f32,
    focus: Vec3,
    focus_goal: Vec3,
    focused: Option<String>,
    drag: bool,
    last: Vec2,
    down: Vec2,
    grids: Vec<(String, Focus)>,
}

const FOV_DEG: f32 = 50.0;
const PULSE_FRAMES: f32 = 150.0;

// ── app ───────────────────────────────────────────────────────────────────────

/// Build the app. `canvas` = CSS selector of the canvas Bevy renders into (web).
pub fn build_app(host: Box<dyn Host>, canvas: Option<String>) -> App {
    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(WindowPlugin {
        primary_window: Some(Window {
            title: "Noēsis — Genesis Core".into(),
            canvas,
            fit_canvas_to_parent: true,
            prevent_default_event_handling: false,
            resolution: WindowResolution::new(1280, 720),
            ..default()
        }),
        ..default()
    }));
    install(&mut app, host);
    app
}

/// Add the scene (resources + systems) to an app that already has the engine plugins.
/// Tests install it on a headless app.
pub fn install(app: &mut App, host: Box<dyn Host>) {
    app.insert_resource(ClearColor(hex(0x010409)))
        .insert_resource(GlobalAmbientLight { color: hex(0x2a3a52), brightness: 0.85 / PI, affects_lightmapped_meshes: true })
        .insert_resource(WinitSettings::continuous())
        .insert_non_send(HostRes(host))
        .add_systems(Startup, (setup, capture_wake))
        .add_systems(Update, ((drain_commands, animate, camera_input, pulses).chain(), report_ready))
        .add_systems(PostUpdate, billboards.after(bevy::transform::TransformSystems::Propagate));
}

/// The ids of everything a click can pick, sorted (for tests).
pub fn pickable_ids(world: &mut World) -> Vec<String> {
    let mut q = world.query::<&Pickable>();
    let mut ids: Vec<String> = q.iter(world).map(|p| p.id.clone()).collect();
    ids.sort();
    ids
}

/// How many signs are showing (for tests).
pub fn visible_signs(world: &mut World) -> usize {
    let mut q = world.query_filtered::<&Visibility, With<Billboard>>();
    q.iter(world).filter(|v| **v != Visibility::Hidden).count()
}

/// Tell the page once the renderer has produced a few frames; keep the counts current.
fn report_ready(frames: Res<bevy::diagnostic::FrameCount>, host: NonSend<HostRes>, mut done: Local<bool>, w: Option<Res<World3>>, modules: Query<(), With<ModuleBody>>, modules_any: Query<&Pickable>) {
    let held = w.map(|w| w.parcels.len()).unwrap_or(0);
    STATS.with(|s| *s.borrow_mut() = (held, modules.iter().count(), modules_any.iter().count(), frames.0));
    if !*done && frames.0 >= 3 {
        *done = true;
        host.0.ready();
    }
}

fn capture_wake(proxy: Option<Res<EventLoopProxyWrapper>>) {
    if let Some(p) = proxy {
        let p = (**p).clone();
        WAKE.with(|w| *w.borrow_mut() = Some(Box::new(move || {
            let _ = p.send_event(WinitUserEvent::WakeUp);
        })));
    }
}

// ── colour & material helpers ─────────────────────────────────────────────────

fn hex(h: u32) -> Color {
    Color::srgb_u8((h >> 16) as u8, (h >> 8) as u8, h as u8)
}
fn lin(h: u32, k: f32) -> LinearRgba {
    let c = hex(h).to_linear();
    LinearRgba::rgb(c.red * k, c.green * k, c.blue * k)
}

/// three's MeshStandardMaterial.
fn std_mat(color: u32, emissive: u32, ei: f32, metal: f32, rough: f32, opacity: f32) -> StandardMaterial {
    StandardMaterial {
        base_color: hex(color).with_alpha(opacity),
        emissive: lin(emissive, ei),
        metallic: metal,
        perceptual_roughness: rough,
        alpha_mode: if opacity < 1.0 { AlphaMode::Blend } else { AlphaMode::Opaque },
        ..default()
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Blend {
    Normal,
    Add,
}

/// three's MeshBasicMaterial (unlit).
fn basic(color: u32, opacity: f32, blend: Blend, cull: Option<Face>) -> StandardMaterial {
    StandardMaterial {
        base_color: hex(color).with_alpha(opacity),
        unlit: true,
        cull_mode: cull,
        alpha_mode: match blend {
            Blend::Add => AlphaMode::Add,
            Blend::Normal if opacity < 1.0 => AlphaMode::Blend,
            Blend::Normal => AlphaMode::Opaque,
        },
        ..default()
    }
}

// ── geometry helpers ──────────────────────────────────────────────────────────

fn v(a: [f64; 3]) -> Vec3 {
    Vec3::new(a[0] as f32, a[1] as f32, a[2] as f32)
}

/// A three.js TorusGeometry: in the XY plane (Bevy's torus lies in XZ), `arc` radians.
fn torus(radius: f32, tube: f32, radial: usize, tubular: usize, arc: f32) -> Mesh {
    let mut m = TorusMeshBuilder {
        torus: Torus::new(radius - tube, radius + tube),
        minor_resolution: radial,
        major_resolution: tubular,
        angle_range: 0.0..=arc,
    }
    .build();
    m.rotate_by(Quat::from_rotation_x(PI / 2.0));
    m
}

/// The unique edges of a triangle mesh, as a line list (WebGL2 has no wireframe mode).
fn wire(mesh: &Mesh) -> Mesh {
    let pos: Vec<[f32; 3]> = mesh.attribute(Mesh::ATTRIBUTE_POSITION).and_then(|a| a.as_float3()).map(|p| p.to_vec()).unwrap_or_default();
    let idx: Vec<u32> = match mesh.indices() {
        Some(Indices::U16(i)) => i.iter().map(|&x| x as u32).collect(),
        Some(Indices::U32(i)) => i.clone(),
        None => (0..pos.len() as u32).collect(),
    };
    // Vertices at the same place (UV seams) count as one, so seams draw once.
    let key = |p: [f32; 3]| [(p[0] * 1e4).round() as i64, (p[1] * 1e4).round() as i64, (p[2] * 1e4).round() as i64];
    let mut seen = std::collections::HashSet::new();
    let mut out: Vec<[f32; 3]> = Vec::new();
    for tri in idx.as_chunks::<3>().0 {
        for (a, b) in [(tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])] {
            let (pa, pb) = (pos[a as usize], pos[b as usize]);
            let (ka, kb) = (key(pa), key(pb));
            if ka == kb {
                continue;
            }
            let e = if ka < kb { (ka, kb) } else { (kb, ka) };
            if seen.insert(e) {
                out.push(pa);
                out.push(pb);
            }
        }
    }
    lines(out)
}

fn lines(pts: Vec<[f32; 3]>) -> Mesh {
    Mesh::new(PrimitiveTopology::LineList, RenderAssetUsages::default()).with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, pts)
}
fn points(pts: Vec<[f32; 3]>) -> Mesh {
    Mesh::new(PrimitiveTopology::PointList, RenderAssetUsages::default()).with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, pts)
}

/// Flat-shaded octahedron (three's OctahedronGeometry detail 0).
fn octahedron(r: f32) -> Mesh {
    let v = [[r, 0., 0.], [-r, 0., 0.], [0., r, 0.], [0., -r, 0.], [0., 0., r], [0., 0., -r]];
    let faces = [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 3], [1, 3, 4], [1, 4, 2]];
    let mut pos = Vec::new();
    let mut nor = Vec::new();
    for f in faces {
        let (a, b, c) = (Vec3::from(v[f[0]]), Vec3::from(v[f[1]]), Vec3::from(v[f[2]]));
        let n = (b - a).cross(c - a).normalize();
        for p in [a, b, c] {
            pos.push(p.to_array());
            nor.push(n.to_array());
        }
    }
    Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default())
        .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, pos)
        .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, nor)
}

/// A flat ring sector (three's RingGeometry), as a wireframe line list in the XY plane.
fn ring_wire(inner: f32, outer: f32, theta: usize, phi: usize, arc: f32) -> Mesh {
    let mut out = Vec::new();
    let at = |r: f32, a: f32| [r * a.cos(), r * a.sin(), 0.0];
    for j in 0..=phi {
        let r = inner + (outer - inner) * j as f32 / phi as f32;
        for i in 0..theta {
            let (a0, a1) = (arc * i as f32 / theta as f32, arc * (i + 1) as f32 / theta as f32);
            out.push(at(r, a0));
            out.push(at(r, a1));
        }
    }
    for i in 0..=theta {
        let a = arc * i as f32 / theta as f32;
        for j in 0..phi {
            out.push(at(inner + (outer - inner) * j as f32 / phi as f32, a));
            out.push(at(inner + (outer - inner) * (j + 1) as f32 / phi as f32, a));
        }
    }
    lines(out)
}

/// Rotation taking +Y to `dir` (three's setFromUnitVectors).
fn y_to(dir: Vec3) -> Quat {
    if dir.length_squared() == 0.0 {
        Quat::IDENTITY
    } else {
        Quat::from_rotation_arc(Vec3::Y, dir.normalize())
    }
}

/// Spawn helpers bundle the asset stores.
struct Kit<'a, 'w, 's> {
    cmd: &'a mut Commands<'w, 's>,
    meshes: &'a mut Assets<Mesh>,
    mats: &'a mut Assets<StandardMaterial>,
    images: &'a mut Assets<Image>,
}

impl Kit<'_, '_, '_> {
    fn mesh(&mut self, parent: Option<Entity>, mesh: Mesh, mat: StandardMaterial, tf: Transform) -> Entity {
        let m = self.meshes.add(mesh);
        let mt = self.mats.add(mat);
        let e = self.cmd.spawn((Mesh3d(m), MeshMaterial3d(mt), tf)).id();
        if let Some(p) = parent {
            self.cmd.entity(p).add_child(e);
        }
        e
    }
    fn group(&mut self, parent: Option<Entity>, tf: Transform) -> Entity {
        let e = self.cmd.spawn((tf, Visibility::default())).id();
        if let Some(p) = parent {
            self.cmd.entity(p).add_child(e);
        }
        e
    }
    /// A truss between two points (three's CylinderGeometry(0.5, 0.5, len, 6)), unlit.
    fn truss(&mut self, parent: Entity, a: Vec3, b: Vec3, hex: u32, op: f32, radius: f32) {
        let d = b - a;
        let len = d.length().max(0.001);
        let tf = Transform::from_translation(a + d * 0.5).with_rotation(y_to(d));
        self.mesh(Some(parent), Cylinder::new(radius, len).mesh().resolution(6).build(), basic(hex, op, Blend::Normal, Some(Face::Back)), tf);
    }
    /// A neon sign quad (drawn by the page's canvas), kept facing the camera.
    #[allow(clippy::too_many_arguments)]
    fn sign(&mut self, host: &dyn Host, parent: Entity, text: &str, hexc: u32, at: Vec3, scale: Vec2, extra: impl Bundle) -> (Entity, Entity) {
        let anchor = self.group(Some(parent), Transform::from_translation(at));
        let (w, h, data) = host.sign(text, hexc);
        let img = Image::new(Extent3d { width: w.max(1), height: h.max(1), depth_or_array_layers: 1 }, TextureDimension::D2, if data.is_empty() { vec![0; 4] } else { data }, TextureFormat::Rgba8UnormSrgb, RenderAssetUsages::default());
        let tex = self.images.add(img);
        let mat = self.mats.add(StandardMaterial { base_color_texture: Some(tex), unlit: true, alpha_mode: AlphaMode::Blend, cull_mode: None, ..default() });
        let quad = self.meshes.add(Rectangle::new(1.0, 1.0));
        let sign = self.cmd.spawn((Mesh3d(quad), MeshMaterial3d(mat), Transform::from_scale(scale.extend(1.0)), Billboard { anchor }, extra)).id();
        (anchor, sign)
    }
}

// ── setup ─────────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn setup(mut cmd: Commands, mut meshes: ResMut<Assets<Mesh>>, mut mats: ResMut<Assets<StandardMaterial>>, mut images: ResMut<Assets<Image>>, host: NonSend<HostRes>) {
    let host = host.0.as_ref();
    let mut k = Kit { cmd: &mut cmd, meshes: &mut meshes, mats: &mut mats, images: &mut images };

    // camera — exposure 1 and no tonemapping, like three's default renderer; lights below use
    // three's physical values (ambient ÷ π for its Lambert term, point lights in lumens = cd · 4π).
    k.cmd.spawn((
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection { fov: FOV_DEG.to_radians(), near: 0.1, far: 4000.0, ..default() }),
        Tonemapping::None,
        // Bevy scales light by 1 / (1.2 · 2^ev100): this ev100 makes that 1, as in three.js.
        Exposure { ev100: -(1.2f32).log2() },
        Transform::from_xyz(0.0, 100.0, 235.0).looking_at(Vec3::new(0.0, 2.0, 0.0), Vec3::Y),
        MainCam,
    ));

    // stars (deterministic)
    {
        let mut rng = layout::Rng::new(0x9e3779b9);
        let mut pts = Vec::with_capacity(1800);
        for _ in 0..1800 {
            let r = 650.0 + rng.next_f64() * 650.0;
            let th = rng.next_f64() * std::f64::consts::TAU;
            let ph = (2.0 * rng.next_f64() - 1.0).acos();
            pts.push([(r * ph.sin() * th.cos()) as f32, (r * ph.cos()) as f32, (r * ph.sin() * th.sin()) as f32]);
        }
        k.mesh(None, points(pts), basic(0x9fb8d8, 1.0, Blend::Normal, None), Transform::default());
    }

    // Earth below (D-NH-12) — Genesis stays near Earth; Earth never transforms.
    let planet_pos = Vec3::new(80.0, -450.0, -150.0);
    let planet_mat = k.mats.add(std_mat(0x123a5c, 0x0a1c30, 0.6, 0.0, 1.0, 1.0));
    {
        let m = k.meshes.add(Sphere::new(340.0).mesh().uv(96, 96));
        k.cmd.spawn((Mesh3d(m), MeshMaterial3d(planet_mat.clone()), Transform::from_translation(planet_pos), Spin { euler: Vec3::new(0.0, 0.0, 0.41), rate: Vec3::new(0.0, 0.00035, 0.0) }, Planet));
        k.mesh(None, Sphere::new(354.0).mesh().uv(48, 48), basic(0x3a8bd5, 0.18, Blend::Add, Some(Face::Front)), Transform::from_translation(planet_pos));
    }

    // lights (three: PointLight 0xda7a4e 1.8 cd range 320; directional 1.0; beacon 1.0 range 80)
    k.cmd.spawn((PointLight { color: hex(0xda7a4e), intensity: 1.8 * 4.0 * PI, range: 320.0, shadow_maps_enabled: false, ..default() }, Transform::default(), CoreLight));
    k.cmd.spawn((DirectionalLight { color: hex(0xbfd9ff), illuminance: 1.0, shadow_maps_enabled: false, ..default() }, Transform::from_xyz(180.0, 140.0, 90.0).looking_at(Vec3::ZERO, Vec3::Y)));

    let station = k.cmd.spawn((Transform::default(), Visibility::default(), Spin { euler: Vec3::ZERO, rate: Vec3::new(0.0, 0.00055, 0.0) })).id();

    // ── Government Core — glass egg + lattice + sail + podium town ──
    let core = k.group(Some(station), Transform::default());
    const OV: f32 = 1.16;
    let egg_scale = Transform::from_scale(Vec3::new(1.0, OV, 1.0));
    let egg = k.mesh(Some(core), Sphere::new(9.0).mesh().uv(44, 32), std_mat(0x29373a, 0x5d6e52, 0.14, 0.4, 0.22, 0.5), egg_scale);
    let core_json = r#"{"id":"genesis:government_quarter:0001","zone":"government_quarter","ring":0,"sector":0,"level":0,"status":"civic","price_bios":0,"owner_civic_did_hash":null,"structure":null,"occupant_count":0}"#;
    k.cmd.entity(egg).insert(Pickable { id: "genesis:government_quarter:0001".into(), json: core_json.into(), shape: Shape::Capsule(9.0, 9.0 * (OV - 1.0)), future_body: None });
    if let Ok(ico) = Sphere::new(9.18).mesh().ico(3) {
        k.mesh(Some(core), wire(&ico), basic(0xbac4ce, 0.30, Blend::Normal, None), egg_scale);
    }
    k.mesh(Some(core), Sphere::new(7.3).mesh().uv(24, 18), basic(0xc2a878, 0.15, Blend::Add, Some(Face::Back)), egg_scale);
    k.mesh(Some(core), Sphere::new(11.0).mesh().uv(28, 24), basic(0x4a5a52, 0.07, Blend::Add, Some(Face::Back)), Transform::default());
    {
        let base_y = -9.0 * OV - 1.0;
        k.mesh(Some(core), ConicalFrustum { radius_top: 12.5, radius_bottom: 14.0, height: 2.2 }.mesh().resolution(44).build(), std_mat(0x2b323b, 0x3b4a5a, 0.08, 0.6, 0.5, 1.0), Transform::from_xyz(0.0, base_y, 0.0));
        for i in 0..18 {
            let a = i as f32 / 18.0 * PI * 2.0;
            let h = 1.6 + (i % 4) as f32;
            let p = Vec3::new(a.cos() * 11.6, base_y + 1.1 + h / 2.0, a.sin() * 11.6);
            let tf = Transform::from_translation(p).looking_at(Vec3::new(0.0, base_y, 0.0), Vec3::Y);
            k.mesh(Some(core), Cuboid::new(1.1, h, 1.1).mesh().build(), std_mat(0x39434f, 0x4a5e72, 0.14, 0.5, 0.5, 1.0), tf);
        }
    }
    k.mesh(Some(core), ConicalFrustum { radius_top: 0.18, radius_bottom: 0.32, height: 6.0 }.mesh().resolution(8).build(), std_mat(0x9aa4b0, 0x000000, 0.0, 0.8, 0.3, 1.0), Transform::from_xyz(0.0, 9.0 * OV + 3.0, 0.0));
    let beacon_mat = k.mats.add(basic(0xcdd6df, 0.9, Blend::Add, Some(Face::Back)));
    {
        let m = k.meshes.add(Sphere::new(0.7).mesh().uv(12, 12));
        let b = k.cmd.spawn((Mesh3d(m), MeshMaterial3d(beacon_mat.clone()), Transform::from_xyz(0.0, 9.0 * OV + 6.0, 0.0), Beacon)).id();
        k.cmd.entity(core).add_child(b);
        let l = k.cmd.spawn((PointLight { color: hex(0x9ab4c4), intensity: 4.0 * PI, range: 80.0, shadow_maps_enabled: false, ..default() }, Transform::from_xyz(0.0, 9.0 * OV + 6.0, 0.0), BeaconLight)).id();
        k.cmd.entity(core).add_child(l);
    }
    {
        let council = k.cmd.spawn((Transform::default(), Visibility::default(), Spin { euler: Vec3::ZERO, rate: Vec3::new(0.0, -0.0028, 0.0) })).id();
        k.cmd.entity(core).add_child(council);
        let sail = k.group(Some(council), Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, 0.2, 0.0, -0.5)));
        let arc = PI * 1.3;
        let tube = std_mat(0xc6ced8, 0x5a6a7a, 0.1, 0.85, 0.32, 1.0);
        k.mesh(Some(sail), torus(13.2, 0.5, 6, 72, arc), tube.clone(), Transform::default());
        k.mesh(Some(sail), torus(10.8, 0.42, 6, 72, arc), tube, Transform::default());
        k.mesh(Some(sail), ring_wire(10.8, 13.2, 54, 2, arc), basic(0xaab4c0, 0.32, Blend::Normal, None), Transform::default());
    }

    // ── ring guides ──
    let flat = Transform::from_rotation(Quat::from_rotation_x(PI / 2.0));
    k.mesh(Some(station), torus(layout::ring_r(1) as f32, 0.45, 10, 160, 2.0 * PI), basic(0x8a98ac, 0.24, Blend::Normal, Some(Face::Back)), flat);
    k.mesh(Some(station), torus(layout::ring_r(2) as f32, 0.45, 10, 160, 2.0 * PI), basic(0x3fa6bd, 0.26, Blend::Normal, Some(Face::Back)), flat);
    let r3tilt = k.group(Some(station), Transform::from_rotation(Quat::from_rotation_x(INCL as f32)));
    let r3spin = k.cmd.spawn((Transform::default(), Visibility::default(), Spin { euler: Vec3::ZERO, rate: Vec3::new(0.0, 0.0, 0.0009) })).id();
    k.cmd.entity(r3tilt).add_child(r3spin);
    k.mesh(Some(r3spin), torus(layout::ring_r(3) as f32, 0.45, 10, 200, 2.0 * PI), basic(0x5a84c4, 0.28, Blend::Normal, Some(Face::Back)), flat);
    k.mesh(Some(station), torus(42.0, 0.3, 8, 120, 2.0 * PI), basic(0xda7a4e, 0.22, Blend::Normal, Some(Face::Back)), Transform::from_rotation(Quat::from_rotation_y(PI / 2.0)));

    // ── Moon & Mars — SEPARATE forming Grids on their own bodies ──
    let mut grids = vec![("Genesis".to_string(), Focus { pos: Vec3::new(0.0, 2.0, 0.0), radius: layout::ring_r(3) as f32 + 8.0, label: "Genesis · near Earth".into() })];
    let preview = [
        ("Moon", Vec3::new(-300.0, 72.0, -210.0), Vec3::new(-14.0, -62.0, -24.0), 30.0, 0x8f8f93, 0x33352f, None, 0x9aa6c0),
        ("Mars", Vec3::new(-540.0, 106.0, -415.0), Vec3::new(-18.0, -66.0, -28.0), 26.0, 0x9c4a2f, 0x3a1c12, Some((0xc78a5a, 0.12)), 0xc88a5a),
    ];
    for (name, grid_pos, body_off, body_r, body_c, body_e, atmo, sign) in preview {
        let grp = k.cmd.spawn((Transform::from_translation(grid_pos), Visibility::default(), Spin { euler: Vec3::ZERO, rate: Vec3::new(0.0004, 0.0012, 0.0) })).id();
        let body = k.cmd.spawn((Transform::from_translation(grid_pos + body_off), Visibility::default(), Spin { euler: Vec3::ZERO, rate: Vec3::new(0.0, 0.0016, 0.0) })).id();
        k.mesh(Some(body), Sphere::new(body_r).mesh().uv(64, 64), std_mat(body_c, body_e, 0.5, 0.0, 1.0, 1.0), Transform::default());
        if let Some((ac, ao)) = atmo {
            k.mesh(Some(body), Sphere::new(body_r * 1.04).mesh().uv(40, 40), basic(ac, ao, Blend::Add, Some(Face::Front)), Transform::default());
        }
        // forming land-shell: a deformed sphere, drawn as wireframe + points
        let mut land = Sphere::new(body_r * 1.08).mesh().uv(26, 18);
        if let Some(bevy::mesh::VertexAttributeValues::Float32x3(ps)) = land.attribute_mut(Mesh::ATTRIBUTE_POSITION) {
            for p in ps.iter_mut() {
                let lv = Vec3::from(*p);
                let nn = (lv.x * 0.21).sin() + (lv.y * 0.17).cos() * 1.3 + (lv.z * 0.23).sin() * 1.1;
                *p = (lv * (1.0 + nn * 0.05)).to_array();
            }
        }
        let land_pts: Vec<[f32; 3]> = land.attribute(Mesh::ATTRIBUTE_POSITION).and_then(|a| a.as_float3()).map(|p| p.to_vec()).unwrap_or_default();
        k.mesh(Some(body), wire(&land), basic(sign, 0.42, Blend::Normal, None), Transform::default());
        k.mesh(Some(body), points(land_pts), basic(sign, 0.7, Blend::Normal, None), Transform::default());
        // empty 6-zone grid skeleton hovering above the forming body
        k.mesh(Some(grp), Sphere::new(3.4).mesh().uv(22, 16), std_mat(0x2b333b, sign, 0.16, 0.4, 0.4, 0.55), Transform::default());
        if let Ok(ico) = Sphere::new(3.6).mesh().ico(2) {
            k.mesh(Some(grp), wire(&ico), basic(sign, 0.28, Blend::Normal, None), Transform::default());
        }
        for rr in [9.0, 16.0] {
            k.mesh(Some(grp), torus(rr, 0.26, 8, 100, 2.0 * PI), basic(sign, 0.34, Blend::Normal, Some(Face::Back)), flat);
        }
        let tilt = k.group(Some(grp), Transform::from_rotation(Quat::from_rotation_x(INCL as f32)));
        k.mesh(Some(tilt), torus(23.0, 0.26, 8, 100, 2.0 * PI), basic(0x5a84c4, 0.32, Blend::Normal, Some(Face::Back)), flat);
        for i in 0..12 {
            let a = i as f32 / 12.0 * PI * 2.0;
            k.mesh(Some(grp), Sphere::new(0.55).mesh().uv(8, 8), basic(sign, 0.45, Blend::Normal, Some(Face::Back)), Transform::from_xyz(a.cos() * 16.0, 0.0, a.sin() * 16.0));
        }
        let json = serde_json::json!({ "id": format!("{}:grid:empty", name.to_lowercase()), "name": format!("{name} Grid"), "body": name, "zone": "frontier_grid", "ring": -1, "sector": 0, "level": 0, "status": "empty", "price_bios": 0, "owner_civic_did_hash": null, "structure": null, "occupant_count": 0, "future": true });
        let hit = k.group(Some(grp), Transform::from_xyz(0.0, body_off.y / 2.0, 0.0));
        k.cmd.entity(hit).insert(Pickable { id: format!("{}:grid:empty", name.to_lowercase()), json: json.to_string(), shape: Shape::Sphere(55.0), future_body: Some(name.into()) });
        k.sign(host, grp, &format!("{} GRID", name.to_uppercase()), sign, Vec3::new(0.0, 44.0, 0.0), Vec2::new(30.0, 7.5), ());
        k.sign(host, grp, "EMPTY · AWAITING CHARTER", 0x6a7686, Vec3::new(0.0, 35.0, 0.0), Vec2::new(20.0, 5.0), ());
        grids.push((name.into(), Focus { pos: grid_pos, radius: 58.0, label: format!("{name} Grid · empty · awaiting charter") }));
    }

    // survey corridor Genesis → Moon → Mars (dashed: dash 3, gap 4)
    {
        let ctrl = [[0.0, 2.0, 0.0], [-150.0, 34.0, -105.0], [-300.0, 72.0, -210.0], [-410.0, 74.0, -300.0], [-540.0, 106.0, -415.0]];
        let samples: Vec<Vec3> = (0..=96).map(|i| v(layout::catmull_rom(&ctrl, i as f64 / 96.0))).collect();
        let mut out = Vec::new();
        let mut run = 0.0f32;
        for w in samples.windows(2) {
            let (a, b) = (w[0], w[1]);
            let len = a.distance(b);
            let mid = run + len * 0.5;
            if mid % 7.0 < 3.0 {
                out.push(a.to_array());
                out.push(b.to_array());
            }
            run += len;
        }
        k.mesh(None, lines(out), basic(0x3fa6bd, 0.30, Blend::Normal, None), Transform::default());
    }

    let objects_root = k.cmd.spawn((Transform::default(), Visibility::default(), Spin { euler: Vec3::ZERO, rate: Vec3::new(0.0, 0.0007, 0.0) })).id();

    let zones = layout::template_zones();
    let mut w = World3 { station, r3spin, r3tilt, objects_root, zones, zone_signs: Vec::new(), parcels: Vec::new(), scaffold_done: false, planet_mat, beacon_mat, t: 0.0 };
    zone_sign_at(&mut k, host, &mut w, "government_quarter", 0x9aa6c0, station, Vec3::new(0.0, 24.0, 0.0));
    cmd.insert_resource(w);
    cmd.insert_resource(CamState { rx: 0.42, ry: 0.92, dist: 235.0, dist_goal: 235.0, focus: Vec3::new(0.0, 2.0, 0.0), focus_goal: Vec3::new(0.0, 2.0, 0.0), focused: None, drag: false, last: Vec2::ZERO, down: Vec2::ZERO, grids });
}

/// One sign per zone; re-lettered when the Polis relabels it, hidden when removed.
fn zone_sign_at(k: &mut Kit, host: &dyn Host, w: &mut World3, zone_id: &str, hexc: u32, parent: Entity, at: Vec3) {
    let zone = w.zones.iter().find(|z| z.zone_id == zone_id).cloned();
    let text = zone.as_ref().map(layout::zone_sign).unwrap_or_else(|| layout::id_sign(zone_id));
    let vis = if zone.is_some() { Visibility::Inherited } else { Visibility::Hidden };
    let (anchor, sign) = k.sign(host, parent, &text, hexc, at, Vec2::new(30.0, 7.5), vis);
    w.zone_signs.push((zone_id.into(), ZoneSign { anchor, sign, hex: hexc, text }));
}

fn refresh_zone_signs(k: &mut Kit, host: &dyn Host, w: &mut World3) {
    for (zone_id, s) in w.zone_signs.iter_mut() {
        let zone = w.zones.iter().find(|z| &z.zone_id == zone_id);
        k.cmd.entity(s.sign).insert(if zone.is_some() { Visibility::Inherited } else { Visibility::Hidden });
        let Some(zone) = zone else { continue };
        let text = layout::zone_sign(zone);
        if text == s.text {
            continue;
        }
        k.cmd.entity(s.sign).despawn();
        let anchor = s.anchor;
        let (w_, h_, data) = host.sign(&text, s.hex);
        let img = Image::new(Extent3d { width: w_.max(1), height: h_.max(1), depth_or_array_layers: 1 }, TextureDimension::D2, if data.is_empty() { vec![0; 4] } else { data }, TextureFormat::Rgba8UnormSrgb, RenderAssetUsages::default());
        let tex = k.images.add(img);
        let mat = k.mats.add(StandardMaterial { base_color_texture: Some(tex), unlit: true, alpha_mode: AlphaMode::Blend, cull_mode: None, ..default() });
        let quad = k.meshes.add(Rectangle::new(1.0, 1.0));
        s.sign = k.cmd.spawn((Mesh3d(quad), MeshMaterial3d(mat), Transform::from_scale(Vec3::new(30.0, 7.5, 1.0)), Billboard { anchor })).id();
        s.text = text;
    }
}

/// The static scaffold — trusses and zone signs at canonical positions, built once from the seed.
fn scaffold(k: &mut Kit, host: &dyn Host, w: &mut World3) {
    let (station, r3spin) = (w.station, w.r3spin);
    let seed: Vec<Parcel> = w.parcels.iter().map(|(p, _)| p.clone()).collect();
    for p in seed.iter().filter(|p| p.ring == 1.0) {
        if let Some(pl) = layout::parcel_place(1.0, p.sector, 0) {
            k.truss(station, Vec3::ZERO, v(pl.pos), 0x7d8da1, 0.5, 0.5);
        }
    }
    let r1 = layout::ring_r(1) as f32;
    zone_sign_at(k, host, w, "infrastructure", 0x9fb0c4, station, Vec3::new(r1 * 0.7, 14.0, r1 * 0.7));
    let r2 = layout::ring_r(2) as f32;
    for p in seed.iter().filter(|p| p.ring == 2.0) {
        if let Some(pl) = layout::parcel_place(2.0, p.sector, 0) {
            let pos = v(pl.pos);
            k.truss(station, Vec3::new(pos.x, 0.0, pos.z), pos, layout::zone_color(&p.zone), 0.5, 0.5);
        }
    }
    for (zone_id, deg) in [("business", 60.0f32), ("shopping", 180.0), ("manufacture", 300.0)] {
        let th = deg.to_radians();
        zone_sign_at(k, host, w, zone_id, layout::zone_color(zone_id), station, Vec3::new(th.cos() * (r2 + 2.0), 17.0, th.sin() * (r2 + 2.0)));
    }
    for deg in [30.0f32, 120.0, 210.0, 300.0] {
        let th = deg.to_radians();
        k.truss(station, Vec3::ZERO, Vec3::new(th.cos() * r2, 0.0, th.sin() * r2), 0x46e0d0, 0.30, 0.5);
    }
    for p in seed.iter().filter(|p| p.ring == 3.0) {
        if let Some(pl) = layout::parcel_place(3.0, p.sector, 0) {
            let pos = v(pl.pos);
            k.truss(r3spin, Vec3::new(pos.x, 0.0, pos.z), pos, 0x4488ff, 0.5, 0.4);
        }
    }
    zone_sign_at(k, host, w, "residential", layout::zone_color("residential"), w.r3tilt, Vec3::new(0.0, 20.0, layout::ring_r(3) as f32));
}

/// One parcel's capsule module (ghost when unsold), its straps, cap, and presence figure.
fn module(k: &mut Kit, w: &World3, p: &Parcel, json: &str, size: f32, parent: Entity, pos: Vec3) {
    let col = layout::zone_color(&p.zone);
    let status = layout::render_status(p, &w.zones);
    let ghost = status == RenderStatus::Unsold;
    let rr = size * 0.58;
    let l = size * 1.15;
    let grp = k.cmd.spawn((Transform::from_translation(pos).with_rotation(y_to(pos)), Visibility::default(), ModuleTag)).id();
    k.cmd.entity(parent).add_child(grp);
    let body_mat = if ghost { std_mat(0x7a8696, col, 0.06, 0.3, 0.72, 0.18) } else { std_mat(0xdde4ec, col, 0.26, 0.45, 0.48, 1.0) };
    let body = k.mesh(Some(grp), Capsule3d::new(rr, l).mesh().longitudes(18).latitudes(12).build(), body_mat, Transform::default());
    k.cmd.entity(body).insert((Pickable { id: p.id.clone(), json: json.into(), shape: Shape::Capsule(rr, l / 2.0), future_body: None }, ModuleBody));
    let strap = std_mat(col, col, if ghost { 0.14 } else { 0.5 }, 0.35, 0.55, if ghost { 0.38 } else { 1.0 });
    for ty in [-l * 0.34, 0.0, l * 0.34] {
        k.mesh(Some(grp), torus(rr * 1.04, rr * 0.11, 8, 20, 2.0 * PI), strap.clone(), Transform::from_xyz(0.0, ty, 0.0).with_rotation(Quat::from_rotation_x(PI / 2.0)));
    }
    if ghost {
        k.mesh(Some(grp), wire(&Capsule3d::new(rr, l).mesh().longitudes(12).latitudes(6).build()), basic(col, 0.4, Blend::Normal, None), Transform::default());
    } else {
        k.mesh(Some(grp), Cylinder::new(rr * 0.52, rr * 0.32).mesh().resolution(16).build(), std_mat(0xe7c878, 0x8a6a3b, 0.45, 0.8, 0.3, 1.0), Transform::from_xyz(0.0, -(l / 2.0 + rr * 0.95), 0.0));
    }
    // presence — a figure stands on a lot only while someone is inside it
    if p.occupant_count.unwrap_or(0.0) > 0.0 && status == RenderStatus::Owned {
        let av = k.group(Some(grp), Transform::from_xyz(0.0, l / 2.0 + rr * 1.6, 0.0));
        k.mesh(Some(av), Sphere::new(rr * 0.34).mesh().uv(14, 12), std_mat(0xeaf6ff, 0x6fd4ff, 0.7, 0.2, 0.4, 1.0), Transform::from_xyz(0.0, rr * 0.5, 0.0));
        k.mesh(Some(av), Cone { radius: rr * 0.34, height: rr * 0.7 }.mesh().resolution(12).build(), std_mat(0xbfe8ff, 0x3fa6bd, 0.4, 0.2, 0.5, 1.0), Transform::from_xyz(0.0, -rr * 0.05, 0.0));
        k.mesh(Some(av), Sphere::new(rr * 0.9).mesh().uv(16, 12), basic(0x6fd4ff, 0.10, Blend::Add, Some(Face::Back)), Transform::default());
    }
}

fn render_modules(k: &mut Kit, host: &dyn Host, w: &World3, old: &Query<Entity, With<ModuleTag>>) {
    for e in old.iter() {
        k.cmd.entity(e).despawn();
    }
    let ps: Vec<Parcel> = w.parcels.iter().map(|(p, _)| p.clone()).collect();
    let placed = layout::layout_parcels(&ps);
    // outer rings a Polis opened by law: each its own shell, tilted the other way from its neighbour
    let mut shells: Vec<(f64, Entity)> = Vec::new();
    let mut signed: Vec<(f64, String)> = Vec::new();
    for (i, pl) in &placed {
        let (p, json) = &w.parcels[*i];
        let parent = match pl.parent {
            ParcelParent::Station => w.station,
            ParcelParent::R3Spin => w.r3spin,
            ParcelParent::Shell => {
                if let Some((_, e)) = shells.iter().find(|(r, _)| *r == pl.ring) {
                    *e
                } else {
                    let tilt = if pl.ring % 2.0 != 0.0 { 1.0 } else { -1.0 } * INCL as f32 * 0.6;
                    let shell = k.cmd.spawn((Transform::from_rotation(Quat::from_rotation_x(tilt)), Visibility::default(), ModuleTag)).id();
                    k.cmd.entity(w.station).add_child(shell);
                    let rad = layout::outer_radius(pl.ring) as f32;
                    k.mesh(Some(shell), torus(rad, 0.45, 10, 220, 2.0 * PI), basic(layout::zone_color(&p.zone), 0.28, Blend::Normal, Some(Face::Back)), Transform::from_rotation(Quat::from_rotation_x(PI / 2.0)));
                    shells.push((pl.ring, shell));
                    shell
                }
            }
        };
        module(k, w, p, json, pl.size as f32, parent, v(pl.pos));
        if pl.parent == ParcelParent::Shell && !signed.iter().any(|(r, z)| *r == pl.ring && *z == p.zone) {
            signed.push((pl.ring, p.zone.clone()));
            let zone = w.zones.iter().find(|z| z.zone_id == p.zone);
            let text = zone.map(layout::zone_sign).unwrap_or_else(|| layout::id_sign(p.zone_label.as_deref().unwrap_or(&p.zone)));
            let th = (p.sector * std::f64::consts::PI / 180.0) as f32;
            let rad = layout::outer_radius(pl.ring) as f32;
            k.sign(host, parent, &text, layout::zone_color(&p.zone), Vec3::new(th.cos() * rad, 18.0, th.sin() * rad), Vec2::new(30.0, 7.5), ModuleTag);
        }
    }
}

#[derive(serde::Deserialize)]
struct ObjectEntry {
    object_id: String,
    #[serde(default)]
    function_type: Option<String>,
    #[serde(default)]
    zone: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    physics_spec: Option<PhysicsSpec>,
}
#[derive(serde::Deserialize)]
struct PhysicsSpec {
    #[serde(default)]
    altitude_km: Option<f64>,
}

fn render_objects(k: &mut Kit, w: &World3, raw: &[serde_json::Value], old: &Query<Entity, With<ObjectTag>>) {
    for e in old.iter() {
        k.cmd.entity(e).despawn();
    }
    let n = raw.len().max(1) as f32;
    for (i, val) in raw.iter().enumerate() {
        let Ok(o) = serde_json::from_value::<ObjectEntry>(val.clone()) else { continue };
        let col = match o.function_type.as_deref() {
            Some("energy") => 0xe7c878,
            Some("compute") => 0x6fd4ff,
            Some("comms") => 0x9a7ad8,
            Some("sensing") => 0x7fe0a0,
            Some("manufacture") => 0x9a5a44,
            _ => 0x3fa6bd,
        };
        let th = (i as f32 / n) * PI * 2.0 + 0.3;
        let alt = o.physics_spec.as_ref().and_then(|s| s.altitude_km).map(|a| a.min(800.0) as f32 / 40.0).unwrap_or(0.0);
        let rad = 100.0 + (i % 3) as f32 * 9.0 + alt;
        let y = 12.0 + if i % 2 == 1 { 7.0 } else { -7.0 };
        let sat = k.cmd.spawn((Transform::from_xyz(th.cos() * rad, y, th.sin() * rad), Visibility::default(), ObjectTag)).id();
        k.cmd.entity(w.objects_root).add_child(sat);
        let core = k.mesh(Some(sat), octahedron(2.1), std_mat(0xeef4ff, col, 0.7, 0.5, 0.35, 1.0), Transform::default());
        let mut json = val.clone();
        if let Some(m) = json.as_object_mut() {
            m.insert("id".into(), o.object_id.clone().into());
            m.insert("zone".into(), o.zone.clone().unwrap_or_else(|| "orbital".into()).into());
            m.insert("status".into(), o.status.clone().unwrap_or_else(|| "active".into()).into());
            m.insert("isObject".into(), true.into());
        }
        k.cmd.entity(core).insert(Pickable { id: o.object_id.clone(), json: json.to_string(), shape: Shape::Sphere(2.1), future_body: None });
        k.mesh(Some(sat), Sphere::new(3.4).mesh().uv(12, 10), basic(col, 0.16, Blend::Add, Some(Face::Back)), Transform::default());
        for sgn in [-1.0f32, 1.0] {
            k.mesh(Some(sat), Cuboid::new(3.4, 0.18, 1.5).mesh().build(), std_mat(0x2b3a52, col, 0.25, 0.6, 0.4, 1.0), Transform::from_xyz(sgn * 3.0, 0.0, 0.0));
        }
    }
}

// ── per-frame systems ─────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn drain_commands(
    mut cmd: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
    mut w: ResMut<World3>,
    mut cam: ResMut<CamState>,
    mut winit: ResMut<WinitSettings>,
    host: NonSend<HostRes>,
    modules: Query<Entity, With<ModuleTag>>,
    objects: Query<Entity, With<ObjectTag>>,
    picks: Query<(&Pickable, &GlobalTransform)>,
    window: Query<&Window, With<PrimaryWindow>>,
) {
    let queued: Vec<Cmd> = QUEUE.with(|q| std::mem::take(&mut *q.borrow_mut()));
    if queued.is_empty() {
        return;
    }
    let host = host.0.as_ref();
    let mut k = Kit { cmd: &mut cmd, meshes: &mut meshes, mats: &mut mats, images: &mut images };
    let mut rebuild = false;
    for c in queued {
        match c {
            Cmd::Parcels(json) => {
                let Ok(vals) = serde_json::from_str::<Vec<serde_json::Value>>(&json) else { continue };
                w.parcels = vals.into_iter().filter_map(|val| serde_json::from_value::<Parcel>(val.clone()).ok().map(|p| (p, val.to_string()))).collect();
                if !w.scaffold_done {
                    scaffold(&mut k, host, &mut w);
                    w.scaffold_done = true;
                }
                rebuild = true;
            }
            Cmd::Zones(json) => {
                if let Ok(z) = serde_json::from_str::<Vec<ZoneView>>(&json) {
                    w.zones = z;
                    refresh_zone_signs(&mut k, host, &mut w);
                    rebuild = w.scaffold_done;
                }
            }
            Cmd::Objects(json) => {
                if let Ok(vals) = serde_json::from_str::<Vec<serde_json::Value>>(&json) {
                    render_objects(&mut k, &w, &vals, &objects);
                }
            }
            Cmd::Focus(name) => {
                let aspect = window.single().map(|w| w.width() / w.height().max(1.0)).unwrap_or(16.0 / 9.0);
                focus_grid(&mut cam, host, &name, aspect);
            }
            Cmd::Pulse(id) => {
                let from = if id.is_some() { [0.0, 2.0, 0.0] } else { [0.0, 30.0, 0.0] };
                let target = id
                    .as_deref()
                    .and_then(|id| picks.iter().find(|(pk, _)| pk.id == id))
                    .map(|(_, g)| g.translation())
                    .map(|t| [t.x as f64, t.y as f64, t.z as f64])
                    .unwrap_or([0.0, 2.0, 0.0]);
                let from = if id.is_some() && target == [0.0, 2.0, 0.0] { [0.0, 30.0, 0.0] } else { from };
                let mid = [(from[0] + target[0]) * 0.5, from[1].max(target[1]) + 16.0, (from[2] + target[2]) * 0.5];
                let m = k.meshes.add(Sphere::new(1.4).mesh().uv(10, 10));
                let mt = k.mats.add(basic(0xffd9a0, 0.95, Blend::Add, Some(Face::Back)));
                let t = w.t;
                k.cmd.spawn((Mesh3d(m), MeshMaterial3d(mt), Transform::from_translation(v(from)), PulseFx { pts: [from, mid, target], born: t }));
            }
            Cmd::Earth(width, height, rgba) => {
                if width > 0 && height > 0 && rgba.len() == (width * height * 4) as usize {
                    let img = Image::new(Extent3d { width, height, depth_or_array_layers: 1 }, TextureDimension::D2, rgba, TextureFormat::Rgba8UnormSrgb, RenderAssetUsages::default());
                    let tex = k.images.add(img);
                    if let Some(mut m) = k.mats.get_mut(&w.planet_mat) {
                        m.base_color = Color::WHITE;
                        m.base_color_texture = Some(tex.clone());
                        m.emissive_texture = Some(tex);
                        m.emissive = lin(0x223a55, 0.22);
                    }
                }
            }
            Cmd::Paused(p) => {
                *winit = if p { WinitSettings { focused_mode: UpdateMode::reactive_low_power(Duration::from_secs(3600)), unfocused_mode: UpdateMode::reactive_low_power(Duration::from_secs(3600)) } } else { WinitSettings::continuous() };
            }
        }
    }
    if rebuild {
        render_modules(&mut k, host, &w, &modules);
    }
}

fn focus_grid(cam: &mut CamState, host: &dyn Host, name: &str, aspect: f32) {
    let key = if cam.grids.iter().any(|(n, _)| n == name) { name } else { "Genesis" };
    let Some((_, f)) = cam.grids.iter().find(|(n, _)| n == key) else { return };
    let (pos, radius, label) = (f.pos, f.radius, f.label.clone());
    cam.focused = Some(key.into());
    cam.focus_goal = pos;
    cam.dist_goal = layout::fit_distance(radius as f64, FOV_DEG as f64, aspect as f64) as f32;
    host.focus_label(&label);
}

#[allow(clippy::type_complexity)]
fn animate(
    time: Res<Time>,
    mut w: ResMut<World3>,
    mut spins: Query<(&mut Spin, &mut Transform)>,
    mut lights: ParamSet<(Query<&mut PointLight, With<CoreLight>>, Query<&mut PointLight, With<BeaconLight>>)>,
    mut mats: ResMut<Assets<StandardMaterial>>,
) {
    let k = (time.delta_secs() * 60.0).min(6.0);
    w.t += k;
    for (mut s, mut tf) in spins.iter_mut() {
        let r = s.rate;
        s.euler += r * k;
        tf.rotation = Quat::from_euler(EulerRot::XYZ, s.euler.x, s.euler.y, s.euler.z);
    }
    let t = w.t;
    let bp = 0.4 + (t * 0.045).sin().abs() * 0.35;
    if let Some(mut m) = mats.get_mut(&w.beacon_mat) {
        m.base_color.set_alpha(bp);
    }
    for mut l in lights.p1().iter_mut() {
        l.intensity = (0.55 + bp * 0.8) * 4.0 * PI;
    }
    for mut l in lights.p0().iter_mut() {
        l.intensity = (1.6 + (t * 0.02).sin() * 0.3) * 4.0 * PI;
    }
}

#[allow(clippy::too_many_arguments)]
fn camera_input(
    time: Res<Time>,
    mut cam: ResMut<CamState>,
    buttons: Res<ButtonInput<MouseButton>>,
    touches: Option<Res<Touches>>,
    mut wheel: MessageReader<bevy::input::mouse::MouseWheel>,
    window: Query<&Window, With<PrimaryWindow>>,
    mut cams: Query<(&Camera, &GlobalTransform, &mut Transform), With<MainCam>>,
    picks: Query<(&Pickable, &GlobalTransform)>,
    host: NonSend<HostRes>,
) {
    let Ok(win) = window.single() else { return };
    let aspect = win.width() / win.height().max(1.0);
    // one pointer: the mouse, or the first finger
    let touches = touches.as_deref();
    let finger = touches.and_then(|t| t.iter().next()).map(|t| t.position());
    let pointer = finger.or_else(|| win.cursor_position());
    let pressed_now = buttons.just_pressed(MouseButton::Left) || touches.is_some_and(|t| t.any_just_pressed());
    let released_now = buttons.just_released(MouseButton::Left) || touches.is_some_and(|t| t.any_just_released());
    let up_pos = touches.and_then(|t| t.iter_just_released().next()).map(|t| t.position()).or(pointer);
    if pressed_now {
        if let Some(p) = pointer {
            cam.drag = true;
            cam.last = p;
            cam.down = p;
        }
    }
    if cam.drag {
        if let Some(p) = pointer {
            let d = p - cam.last;
            cam.ry -= d.x * 0.006;
            cam.rx = (cam.rx + d.y * 0.006).clamp(-0.5, 1.45);
            cam.last = p;
        }
    }
    for ev in wheel.read() {
        let dy = match ev.unit {
            bevy::input::mouse::MouseScrollUnit::Line => -ev.y * 40.0,
            bevy::input::mouse::MouseScrollUnit::Pixel => -ev.y,
        };
        cam.dist = (cam.dist + dy * 0.14).clamp(70.0, 680.0);
        cam.dist_goal = cam.dist;
    }
    let mut click: Option<Vec2> = None;
    if released_now && cam.drag {
        cam.drag = false;
        if let Some(p) = up_pos {
            if p.distance(cam.down) <= 5.0 {
                click = Some(p);
            }
        }
    }

    // ease toward the focus goal (0.07 per 60 Hz frame)
    let k = (time.delta_secs() * 60.0).min(6.0);
    let a = 1.0 - (1.0 - 0.07f32).powf(k);
    let goal = cam.focus_goal;
    cam.focus = cam.focus.lerp(goal, a);
    cam.dist += (cam.dist_goal - cam.dist) * a;
    let Ok((camera, cam_gt, mut tf)) = cams.single_mut() else { return };
    let f = cam.focus;
    tf.translation = Vec3::new(f.x + cam.ry.sin() * cam.rx.cos() * cam.dist, f.y + cam.rx.sin() * cam.dist + 6.0, f.z + cam.ry.cos() * cam.rx.cos() * cam.dist);
    tf.look_at(f, Vec3::Y);

    let Some(at) = click else { return };
    let Ok(ray) = camera.viewport_to_world(cam_gt, at) else { return };
    let o = [ray.origin.x as f64, ray.origin.y as f64, ray.origin.z as f64];
    let d3 = ray.direction.as_vec3();
    let d = [d3.x as f64, d3.y as f64, d3.z as f64];
    let mut best: Option<(f64, &Pickable)> = None;
    for (pk, gt) in picks.iter() {
        let (_, rot, c) = gt.to_scale_rotation_translation();
        let scale = gt.compute_transform().scale.max_element();
        let c64 = [c.x as f64, c.y as f64, c.z as f64];
        let hit = match pk.shape {
            Shape::Sphere(r) => layout::ray_sphere(o, d, c64, (r * scale) as f64),
            Shape::Capsule(r, half) => {
                let ax = rot * Vec3::Y * half * scale;
                let (a, b) = (c - ax, c + ax);
                layout::ray_capsule(o, d, [a.x as f64, a.y as f64, a.z as f64], [b.x as f64, b.y as f64, b.z as f64], (r * scale) as f64)
            }
        };
        if let Some(t) = hit {
            if best.as_ref().is_none_or(|(bt, _)| t < *bt) {
                best = Some((t, pk));
            }
        }
    }
    let host = host.0.as_ref();
    host.pick(best.as_ref().map(|(_, pk)| pk.json.as_str()));
    // A click on a Grid the camera is not on zooms in to it; on the Grid in focus it stays put.
    let genesis = cam.grids.iter().find(|(n, _)| n == "Genesis").map(|(_, f)| (f.pos, f.radius));
    let grid: Option<String> = match &best {
        Some((_, pk)) => Some(pk.future_body.clone().unwrap_or_else(|| "Genesis".into())),
        None => genesis.and_then(|(p, r)| layout::ray_sphere(o, d, [p.x as f64, p.y as f64, p.z as f64], r as f64)).map(|_| "Genesis".into()),
    };
    if let Some(g) = grid {
        if cam.focused.as_deref() != Some(g.as_str()) {
            focus_grid(&mut cam, host, &g, aspect);
            host.focus_grid(&g);
        }
    }
}

fn pulses(mut cmd: Commands, w: Res<World3>, mut q: Query<(Entity, &PulseFx, &mut Transform, &MeshMaterial3d<StandardMaterial>)>, mut mats: ResMut<Assets<StandardMaterial>>) {
    for (e, p, mut tf, mat) in q.iter_mut() {
        let u = (w.t - p.born) / PULSE_FRAMES;
        if u >= 1.0 {
            cmd.entity(e).despawn();
            continue;
        }
        tf.translation = v(layout::catmull_rom(&p.pts, u as f64));
        tf.scale = Vec3::splat(if u > 0.85 { 1.0 + (u - 0.85) * 20.0 } else { 1.0 });
        if let Some(mut m) = mats.get_mut(&mat.0) {
            m.base_color.set_alpha(if u < 0.08 { u / 0.08 } else if u > 0.85 { (1.0 - u) / 0.15 } else { 0.95 });
        }
    }
}

/// Signs face the camera, at their anchor's world position.
fn billboards(cams: Query<&GlobalTransform, (With<MainCam>, Without<Billboard>)>, anchors: Query<&GlobalTransform, Without<Billboard>>, mut signs: Query<(&Billboard, &mut Transform, &mut GlobalTransform)>) {
    let Ok(cam) = cams.single() else { return };
    let rot = cam.rotation();
    for (b, mut tf, mut gt) in signs.iter_mut() {
        let Ok(a) = anchors.get(b.anchor) else { continue };
        tf.translation = a.translation();
        tf.rotation = rot;
        *gt = GlobalTransform::from(*tf);
    }
}
