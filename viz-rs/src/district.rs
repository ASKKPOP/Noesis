//! The district level of the Grid Station View (D-V3-44) in Bevy — a port of
//! `dashboard/src/components/worldmap/district-scene.ts` (three.js, kept as the fallback).
//!
//! One zone drawn as a city along the inside of its ring: the floor is the ring's outer
//! wall, every building stands with its roof toward the centre where the government core
//! hangs overhead, and the street follows the ring's curve. The lots are laid out by the
//! page (`district-layout.ts`) and arrive here already placed.
//!
//! It lives in the same app as the station (winit allows one event loop per page): its own
//! camera on render layer 1, its own ambient light and fog, its world far from the station's
//! so neither scene's lights reach the other. Opening it switches cameras; closing it
//! despawns everything it made.

use crate::scene::{basic, hex, lin, lines, points, Billboard, Blend, Cmd, HostRes, Kit, MainCam};
use bevy::asset::RenderAssetUsages;
use bevy::camera::visibility::RenderLayers;
use bevy::camera::Exposure;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy::light::AmbientLight;
use bevy::mesh::{Indices, PrimitiveTopology};
use bevy::pbr::{DistanceFog, FogFalloff};
use bevy::prelude::*;
use bevy::render::render_resource::{Extent3d, Face, TextureDimension, TextureFormat};
use bevy::window::PrimaryWindow;
use serde::Deserialize;
use std::collections::HashMap;
use std::f32::consts::PI;

/// Radius of the ring's floor (district-layout.ts FLOOR_RADIUS).
pub const FLOOR_RADIUS: f32 = 170.0;
/// Distance between neighbouring lots along the street (LOT_PITCH).
pub const LOT_PITCH: f32 = 17.0;
/// How far each row of lots stands from the middle of the street (ROW_OFFSET).
pub const ROW_OFFSET: f32 = 17.0;
const STREET_HALF: f32 = 6.0;
const FLOOR_HALF: f32 = 34.0;
/// Where the district's world sits, far from the station's (lights have finite range there).
const ORIGIN: Vec3 = Vec3::new(0.0, 0.0, -30000.0);
const LAYER: usize = 1;

/// A lot as `district-layout.ts` places it.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct DistrictLot {
    pub id: String,
    /// Position along the street, as an angle around the ring; 0 is the district's middle.
    pub angle: f32,
    /// Which side of the street: -1 or 1.
    pub side: i8,
    pub kind: String,
    pub condition: String,
    pub occupied: bool,
}

#[derive(Debug, Clone, Deserialize)]
struct DistrictNous {
    did: String,
    name: String,
    color: u32,
    asleep: bool,
}

/// How much of the ring the district covers, as an angle (at least one lot's width).
/// (`districtSpan` in district-layout.ts.)
pub fn district_span(lots: &[DistrictLot]) -> f32 {
    if lots.is_empty() {
        return LOT_PITCH / FLOOR_RADIUS;
    }
    let max = lots.iter().map(|l| l.angle).fold(f32::NEG_INFINITY, f32::max);
    let min = lots.iter().map(|l| l.angle).fold(f32::INFINITY, f32::min);
    max - min + LOT_PITCH / FLOOR_RADIUS
}

/// A point on the floor at `angle` around the ring and `z` across the street, raised `up`
/// toward the centre (district-local coordinates).
pub fn on_floor(angle: f32, z: f32, up: f32) -> Vec3 {
    Vec3::new(angle.sin() * (FLOOR_RADIUS - up), -angle.cos() * (FLOOR_RADIUS - up), z)
}

/// Which end of the street a Nous walks in from / out to (same rule as the TypeScript).
fn street_end(did: &str, span: f32) -> f32 {
    let last = did.encode_utf16().last().unwrap_or(0);
    (span / 2.0 + 0.09) * if last % 2 == 1 { 1.0 } else { -1.0 }
}

// ── state ─────────────────────────────────────────────────────────────────────

/// District commands handed over by the station's command drain.
#[derive(Resource, Default)]
pub(crate) struct DistrictInbox(pub(crate) Vec<Cmd>);

struct Figure {
    group: Entity,
    label: Entity,
    body: Handle<StandardMaterial>,
    angle: f32,
    z: f32,
    to_angle: f32,
    to_z: f32,
    leaving: bool,
    sign: Option<(Entity, Entity)>,
    sign_born: f32,
}

#[derive(Resource)]
struct District {
    open: bool,
    accent: u32,
    root: Option<Entity>,
    lots_root: Option<Entity>,
    span: f32,
    along: f32,
    zoom: f32,
    places: HashMap<String, Vec3>,
    figures: HashMap<String, Figure>,
    frame: f32,
    drag: bool,
    last_x: f32,
}

impl Default for District {
    fn default() -> Self {
        District { open: false, accent: 0x5a84c4, root: None, lots_root: None, span: 0.1, along: 0.0, zoom: 1.0, places: HashMap::new(), figures: HashMap::new(), frame: 0.0, drag: false, last_x: 0.0 }
    }
}

/// Everything the district put at the top level (root, billboards, flashes): despawned on close.
#[derive(Component)]
struct DistrictTag;
#[derive(Component)]
struct DistrictCam;
#[derive(Component)]
struct Halo;
#[derive(Component)]
struct Flash {
    born: f32,
}

thread_local! {
    /// Counts the page can read (`district_stats()`): open?, lots placed, Nous figures.
    pub static DSTATS: std::cell::RefCell<(bool, usize, usize)> = const { std::cell::RefCell::new((false, 0, 0)) };
}

/// Is the district's camera the one drawing? (for tests)
pub fn camera_active(world: &mut World) -> bool {
    let mut q = world.query_filtered::<&Camera, With<DistrictCam>>();
    q.iter(world).any(|c| c.is_active)
}

pub(crate) fn install(app: &mut App) {
    app.init_resource::<DistrictInbox>().init_resource::<District>().add_systems(Startup, spawn_camera);
}

/// The district systems, to run after the station's command drain.
pub(crate) fn systems() -> impl IntoScheduleConfigs<bevy::ecs::system::ScheduleSystem, ()> {
    (commands, frame).chain()
}

fn spawn_camera(mut cmd: Commands) {
    cmd.spawn((
        Camera3d::default(),
        Camera { is_active: false, order: 1, clear_color: ClearColorConfig::Custom(hex(0x020610)), ..default() },
        Projection::Perspective(PerspectiveProjection { fov: 46f32.to_radians(), near: 1.0, far: 1400.0, ..default() }),
        Tonemapping::None,
        Exposure { ev100: -(1.2f32).log2() },
        AmbientLight { color: hex(0x8fa6c8), brightness: 0.75 / PI, affects_lightmapped_meshes: true },
        DistanceFog { color: hex(0x020610), falloff: FogFalloff::Linear { start: 260.0, end: 620.0 }, ..default() },
        Transform::from_translation(ORIGIN + on_floor(0.0, 86.0, 52.0)),
        DistrictCam,
        RenderLayers::layer(LAYER),
    ));
}

// ── geometry ──────────────────────────────────────────────────────────────────

/// A strip of the ring's inner surface between two angles (normals toward the centre).
fn strip(a0: f32, a1: f32, half: f32, lift: f32) -> Mesh {
    let steps = (((a1 - a0) * FLOOR_RADIUS) / 6.0).ceil().max(8.0) as u32;
    let mut pos = Vec::new();
    let mut nor = Vec::new();
    let mut idx: Vec<u32> = Vec::new();
    for i in 0..=steps {
        let a = a0 + (a1 - a0) * i as f32 / steps as f32;
        for z in [-half, half] {
            pos.push(on_floor(a, z, lift).to_array());
            nor.push([-a.sin(), a.cos(), 0.0]);
        }
        if i < steps {
            let k = i * 2;
            idx.extend_from_slice(&[k, k + 1, k + 2, k + 1, k + 3, k + 2]);
        }
    }
    Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default())
        .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, pos)
        .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, nor)
        .with_inserted_indices(Indices::U32(idx))
}

fn floor_mat(color: u32, opacity: f32) -> StandardMaterial {
    StandardMaterial {
        base_color: hex(color).with_alpha(opacity),
        perceptual_roughness: 0.9,
        cull_mode: None,
        double_sided: true,
        alpha_mode: if opacity < 1.0 { AlphaMode::Blend } else { AlphaMode::Opaque },
        ..default()
    }
}

/// The 12 edges of a box (three's EdgesGeometry of a BoxGeometry).
fn box_edges(w: f32, h: f32, d: f32) -> Mesh {
    let (x, y, z) = (w / 2.0, h / 2.0, d / 2.0);
    let c = |sx: f32, sy: f32, sz: f32| [sx * x, sy * y, sz * z];
    let mut out = Vec::new();
    for (a, b) in [
        (c(-1., -1., -1.), c(1., -1., -1.)), (c(1., -1., -1.), c(1., -1., 1.)), (c(1., -1., 1.), c(-1., -1., 1.)), (c(-1., -1., 1.), c(-1., -1., -1.)),
        (c(-1., 1., -1.), c(1., 1., -1.)), (c(1., 1., -1.), c(1., 1., 1.)), (c(1., 1., 1.), c(-1., 1., 1.)), (c(-1., 1., 1.), c(-1., 1., -1.)),
        (c(-1., -1., -1.), c(-1., 1., -1.)), (c(1., -1., -1.), c(1., 1., -1.)), (c(1., -1., 1.), c(1., 1., 1.)), (c(-1., -1., 1.), c(-1., 1., 1.)),
    ] {
        out.push(a);
        out.push(b);
    }
    lines(out)
}

fn glow(color: u32, strength: f32) -> StandardMaterial {
    StandardMaterial { base_color: hex(color), emissive: lin(color, strength), perceptual_roughness: 0.6, ..default() }
}

/// One lot: its pad and what stands on it, by kind and condition.
fn building(k: &mut Kit, parent: Entity, lot: &DistrictLot, accent: u32) {
    let lit = lot.condition != "derelict";
    let body_color = match lot.condition.as_str() {
        "worn" => 0x8d9099,
        "derelict" => 0x4b4d55,
        _ => 0xcfd6e4,
    };
    let body = StandardMaterial { base_color: hex(body_color), perceptual_roughness: 0.75, emissive: if lit { lin(0x141c2c, 1.0) } else { LinearRgba::BLACK }, ..default() };
    let at = |x: f32, y: f32, z: f32| Transform::from_xyz(x, y, z);
    // A band of windows: warm when someone is inside, cool when empty, none when derelict.
    let windows = |k: &mut Kit, w: f32, d: f32, y: f32| {
        if lit {
            let (c, s) = if lot.occupied { (0xffd9a0, 1.5) } else { (0x5f93b3, 0.5) };
            k.mesh(Some(parent), Cuboid::new(w + 0.25, 1.1, d + 0.25).mesh().build(), glow(c, s), at(0.0, y, 0.0));
        }
    };
    k.mesh(Some(parent), Cuboid::new(12.0, 0.5, 12.0).mesh().build(), StandardMaterial { base_color: hex(0x1b2333), perceptual_roughness: 1.0, ..default() }, at(0.0, 0.25, 0.0));
    match lot.kind.as_str() {
        "empty" => {
            k.mesh(Some(parent), box_edges(11.5, 0.6, 11.5), basic(accent, 0.45, Blend::Normal, None), at(0.0, 0.3, 0.0));
        }
        "owned" => {
            for (x, z) in [(-5.0, -5.0), (5.0, -5.0), (-5.0, 5.0), (5.0, 5.0)] {
                k.mesh(Some(parent), Cylinder::new(0.3, 3.0).mesh().resolution(6).build(), glow(accent, 1.1), at(x, 2.0, z));
            }
        }
        "home" => {
            k.mesh(Some(parent), Cuboid::new(7.5, 5.5, 7.5).mesh().build(), body.clone(), at(0.0, 3.25, 0.0));
            windows(k, 7.5, 7.5, 3.4);
            let roof = StandardMaterial { base_color: hex(if lit { 0x7a5a4a } else { 0x3a3536 }), perceptual_roughness: 0.9, ..default() };
            k.mesh(Some(parent), Cone { radius: 6.1, height: 3.6 }.mesh().resolution(4).build(), roof, at(0.0, 7.8, 0.0).with_rotation(Quat::from_rotation_y(PI / 4.0)));
        }
        "shop" => {
            k.mesh(Some(parent), Cuboid::new(10.0, 5.0, 8.0).mesh().build(), body.clone(), at(0.0, 3.0, 0.0));
            windows(k, 10.0, 8.0, 2.4);
            k.mesh(Some(parent), Cuboid::new(8.5, 1.4, 0.5).mesh().build(), if lit { glow(accent, 1.4) } else { body.clone() }, at(0.0, 6.3, 4.0));
        }
        "workshop" => {
            k.mesh(Some(parent), Cuboid::new(10.0, 7.0, 9.0).mesh().build(), body.clone(), at(0.0, 4.0, 0.0));
            windows(k, 10.0, 9.0, 4.6);
            k.mesh(Some(parent), ConicalFrustum { radius_top: 1.0, radius_bottom: 1.2, height: 6.0 }.mesh().resolution(10).build(), body.clone(), at(3.0, 10.2, -2.5));
            k.mesh(Some(parent), Cuboid::new(4.5, 3.4, 9.0).mesh().build(), body.clone(), at(-2.5, 9.2, 0.0));
        }
        "venue" => {
            k.mesh(Some(parent), ConicalFrustum { radius_top: 5.2, radius_bottom: 5.6, height: 5.5 }.mesh().resolution(20).build(), body.clone(), at(0.0, 3.25, 0.0));
            if lit {
                let (c, s) = if lot.occupied { (0xffd9a0, 1.5) } else { (0x5f93b3, 0.5) };
                k.mesh(Some(parent), Cylinder::new(5.55, 1.1).mesh().resolution(20).build(), glow(c, s), at(0.0, 3.2, 0.0));
            }
            // A dome (its lower half sits hidden inside the drum).
            k.mesh(Some(parent), Sphere::new(5.2).mesh().uv(20, 10), if lit { glow(accent, 0.55) } else { body.clone() }, at(0.0, 6.0, 0.0));
        }
        _ => {
            k.mesh(Some(parent), Cuboid::new(8.0, 8.0, 8.0).mesh().build(), body.clone(), at(0.0, 4.5, 0.0));
            windows(k, 8.0, 8.0, 3.2);
            windows(k, 8.0, 8.0, 6.2);
        }
    }
}

/// A camera-facing label drawn by the page (name or act sign), anchored to `anchor`.
fn label(k: &mut Kit, host: &dyn crate::scene::Host, anchor: Entity, text: &str, size: u32, css: &str) -> Entity {
    let (w, h, data) = host.label(text, size, css);
    let (w, h) = (w.max(1), h.max(1));
    let data = if data.len() == (w * h * 4) as usize { data } else { vec![0; (w * h * 4) as usize] };
    let img = Image::new(Extent3d { width: w, height: h, depth_or_array_layers: 1 }, TextureDimension::D2, data, TextureFormat::Rgba8UnormSrgb, RenderAssetUsages::default());
    let tex = k.images.add(img);
    let mat = k.mats.add(StandardMaterial { base_color_texture: Some(tex), unlit: true, fog_enabled: false, alpha_mode: AlphaMode::Blend, cull_mode: None, ..default() });
    let quad = k.meshes.add(Rectangle::new(1.0, 1.0));
    let scale = Vec3::new((w as f32 / h as f32) * 2.6, 2.6, 1.0);
    k.cmd.spawn((Mesh3d(quad), MeshMaterial3d(mat), Transform::from_scale(scale), Billboard { anchor }, RenderLayers::layer(LAYER), DistrictTag)).id()
}

// ── systems ───────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
fn commands(
    mut inbox: ResMut<DistrictInbox>,
    mut d: ResMut<District>,
    mut cmd: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut mats: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
    host: NonSend<HostRes>,
    tagged: Query<Entity, With<DistrictTag>>,
    mut cams: ParamSet<(Query<&mut Camera, With<MainCam>>, Query<&mut Camera, With<DistrictCam>>)>,
) {
    if inbox.0.is_empty() {
        return;
    }
    let host = host.0.as_ref();
    let queued = std::mem::take(&mut inbox.0);
    let mut k = Kit { cmd: &mut cmd, meshes: &mut meshes, mats: &mut mats, images: &mut images, layers: RenderLayers::layer(LAYER) };
    // Which camera draws once these commands are done: Some(true) = the district's.
    let mut show_district: Option<bool> = None;
    for c in queued {
        match c {
            Cmd::DistrictOpen(accent) => {
                for e in tagged.iter() {
                    k.cmd.entity(e).despawn();
                }
                *d = District { open: true, accent, ..District::default() };
                open_world(&mut k, &mut d);
                show_district = Some(true);
            }
            Cmd::DistrictClose => {
                for e in tagged.iter() {
                    k.cmd.entity(e).despawn();
                }
                *d = District::default();
                show_district = Some(false);
            }
            Cmd::DistrictLots(json) => {
                if !d.open {
                    continue;
                }
                if let Ok(lots) = serde_json::from_str::<Vec<DistrictLot>>(&json) {
                    set_lots(&mut k, &mut d, &lots);
                }
            }
            Cmd::DistrictNous(json) => {
                if !d.open {
                    continue;
                }
                if let Ok(list) = serde_json::from_str::<Vec<DistrictNous>>(&json) {
                    set_nous(&mut k, host, &mut d, &list);
                }
            }
            Cmd::DistrictAct(did, sign) => {
                let frame = d.frame;
                let Some(f) = d.figures.get_mut(&did) else { continue };
                if let Some((a, s)) = f.sign.take() {
                    k.cmd.entity(a).despawn();
                    k.cmd.entity(s).despawn();
                }
                let anchor = k.group(Some(f.group), Transform::from_xyz(0.0, 10.6, 0.0));
                let s = label(&mut k, host, anchor, &sign, 56, "#ffd9a0");
                f.sign = Some((anchor, s));
                f.sign_born = frame;
            }
            Cmd::DistrictPulse(id) => {
                // Not in this district: the station view shows it.
                let Some(at) = id.and_then(|id| d.places.get(&id).copied()) else { continue };
                let m = k.meshes.add(Sphere::new(3.0).mesh().uv(16, 12));
                let mt = k.mats.add(basic(0xffd9a0, 0.9, Blend::Add, Some(Face::Back)));
                let born = d.frame;
                k.cmd.spawn((Mesh3d(m), MeshMaterial3d(mt), Transform::from_translation(ORIGIN + at), Flash { born }, RenderLayers::layer(LAYER), DistrictTag));
            }
            _ => {}
        }
    }
    if let Some(district) = show_district {
        for mut c in cams.p0().iter_mut() {
            c.is_active = !district;
        }
        for mut c in cams.p1().iter_mut() {
            c.is_active = district;
        }
    }
}

/// The district's fixed surroundings: stars, the government core overhead, the ring's edges.
fn open_world(k: &mut Kit, d: &mut District) {
    let root = k.cmd.spawn((Transform::from_translation(ORIGIN), Visibility::default(), RenderLayers::layer(LAYER), DistrictTag)).id();
    d.root = Some(root);
    let mut rng = crate::layout::Rng::new(0x51ed270b);
    let mut stars = Vec::with_capacity(900);
    for _ in 0..900 {
        let z = 2.0 * rng.next_f64() - 1.0;
        let t = rng.next_f64() * std::f64::consts::TAU;
        let r = (1.0 - z * z).sqrt();
        stars.push([(900.0 * r * t.cos()) as f32, (900.0 * r * t.sin()) as f32, (900.0 * z) as f32]);
    }
    let mut star_mat = basic(0xcfe0ff, 1.0, Blend::Normal, None);
    star_mat.fog_enabled = false;
    k.mesh(Some(root), points(stars), star_mat, Transform::default());
    let mut core = basic(0xbf00ff, 1.0, Blend::Normal, Some(Face::Back));
    core.fog_enabled = false;
    k.mesh(Some(root), Sphere::new(13.0).mesh().uv(28, 20), core, Transform::default());
    let mut halo = basic(0xbf00ff, 0.16, Blend::Add, Some(Face::Back));
    halo.fog_enabled = false;
    let h = k.mesh(Some(root), Sphere::new(21.0).mesh().uv(28, 20), halo, Transform::default());
    k.cmd.entity(h).insert(Halo);
    // The rest of the ring arching overhead: its two edges drawn all the way round.
    for z in [-FLOOR_HALF, FLOOR_HALF] {
        let pts: Vec<Vec3> = (0..=180).map(|i| on_floor(i as f32 / 180.0 * PI * 2.0, z, 0.0)).collect();
        let segs: Vec<[f32; 3]> = pts.windows(2).flat_map(|w| [w[0].to_array(), w[1].to_array()]).collect();
        let mut m = basic(d.accent, 0.32, Blend::Normal, None);
        m.fog_enabled = false;
        k.mesh(Some(root), lines(segs), m, Transform::default());
    }
    // The core's light. three.js uses decay 0.25 (1.6 → ~0.44 at the floor), which Bevy cannot
    // express (inverse square only); set so the floor reads the same, by eye against three.js.
    let cd = 0.22 * FLOOR_RADIUS * FLOOR_RADIUS;
    let l = k.cmd.spawn((PointLight { color: hex(0xbf80ff), intensity: cd * 4.0 * PI, range: 1000.0, shadow_maps_enabled: false, ..default() }, Transform::default(), RenderLayers::layer(LAYER))).id();
    k.cmd.entity(root).add_child(l);
    let lots = k.group(Some(root), Transform::default());
    d.lots_root = Some(lots);
}

fn set_lots(k: &mut Kit, d: &mut District, lots: &[DistrictLot]) {
    let (Some(root), Some(old)) = (d.root, d.lots_root) else { return };
    k.cmd.entity(old).despawn();
    let group = k.group(Some(root), Transform::default());
    d.lots_root = Some(group);
    d.places.clear();
    d.span = district_span(lots);
    let edge = d.span / 2.0 + 0.07;
    k.mesh(Some(group), strip(-edge - 0.5, edge + 0.5, FLOOR_HALF, 0.0), floor_mat(0x0d1524, 1.0), Transform::default());
    k.mesh(Some(group), strip(-edge, edge, STREET_HALF, 0.15), floor_mat(0x26324a, 1.0), Transform::default());
    k.mesh(Some(group), strip(-edge, edge, 0.35, 0.3), floor_mat(d.accent, 0.7), Transform::default());
    for lot in lots {
        let side = if lot.side < 0 { -1.0 } else { 1.0 };
        let mut rot = Quat::from_rotation_z(lot.angle); // local "up" points at the centre
        if side < 0.0 {
            rot *= Quat::from_rotation_y(PI); // fronts face the street
        }
        let b = k.group(Some(group), Transform::from_translation(on_floor(lot.angle, side * ROW_OFFSET, 0.0)).with_rotation(rot));
        building(k, b, lot, d.accent);
        d.places.insert(lot.id.clone(), on_floor(lot.angle, side * ROW_OFFSET, 9.0));
    }
    d.along = d.along.clamp(-d.span / 2.0, d.span / 2.0);
}

fn set_nous(k: &mut Kit, host: &dyn crate::scene::Host, d: &mut District, list: &[DistrictNous]) {
    let span = d.span;
    for (did, f) in d.figures.iter_mut() {
        if !list.iter().any(|n| &n.did == did) && !f.leaving {
            f.leaving = true;
            f.to_angle = street_end(did, span);
        }
    }
    let n = list.len() as f32;
    for (i, nous) in list.iter().enumerate() {
        if !d.figures.contains_key(&nous.did) {
            let Some(root) = d.root else { return };
            let g = k.group(Some(root), Transform::default());
            let body = k.mats.add(StandardMaterial { base_color: hex(nous.color), emissive: lin(nous.color, 0.55), perceptual_roughness: 0.5, ..default() });
            let torso = k.meshes.add(Capsule3d::new(1.05, 2.0).mesh().longitudes(12).latitudes(6).build());
            let head = k.meshes.add(Sphere::new(0.95).mesh().uv(16, 12));
            for (mesh, y) in [(torso, 2.1), (head, 4.6)] {
                let e = k.cmd.spawn((Mesh3d(mesh), MeshMaterial3d(body.clone()), Transform::from_xyz(0.0, y, 0.0), RenderLayers::layer(LAYER))).id();
                k.cmd.entity(g).add_child(e);
            }
            let anchor = k.group(Some(g), Transform::from_xyz(0.0, 7.4, 0.0));
            let name = label(k, host, anchor, &nous.name, 44, "#f5f0ea");
            let start = street_end(&nous.did, span);
            d.figures.insert(nous.did.clone(), Figure { group: g, label: name, body, angle: start, z: 0.0, to_angle: 0.0, to_z: 0.0, leaving: false, sign: None, sign_born: 0.0 });
        }
        let f = d.figures.get_mut(&nous.did).expect("just inserted");
        f.leaving = false;
        f.to_angle = ((i as f32 - (n - 1.0) / 2.0) * 8.0) / FLOOR_RADIUS; // spread along the middle of the street
        f.to_z = if i % 2 == 1 { 2.6 } else { -2.6 };
        if let Some(mut m) = k.mats.get_mut(&f.body) {
            m.emissive = lin(nous.color, if nous.asleep { 0.08 } else { 0.55 });
        }
    }
}

#[allow(clippy::too_many_arguments, clippy::type_complexity)]
fn frame(
    time: Res<Time>,
    mut d: ResMut<District>,
    mut cmd: Commands,
    buttons: Res<ButtonInput<MouseButton>>,
    touches: Option<Res<Touches>>,
    mut wheel: MessageReader<bevy::input::mouse::MouseWheel>,
    window: Query<&Window, With<PrimaryWindow>>,
    mut q: ParamSet<(
        Query<&mut Transform, With<DistrictCam>>,
        Query<&mut Transform, With<Halo>>,
        Query<(Entity, &Flash, &mut Transform, &MeshMaterial3d<StandardMaterial>)>,
        Query<&mut Transform>,
    )>,
    mut mats: ResMut<Assets<StandardMaterial>>,
) {
    DSTATS.with(|s| *s.borrow_mut() = (d.open, d.places.len(), d.figures.len()));
    if !d.open {
        wheel.clear();
        return;
    }
    let k = (time.delta_secs() * 60.0).min(6.0);
    d.frame += k;
    let frame = d.frame;

    // Input: drag moves along the ring, the wheel moves closer or further.
    let touches = touches.as_deref();
    let pointer = touches.and_then(|t| t.iter().next()).map(|t| t.position()).or_else(|| window.single().ok().and_then(|w| w.cursor_position()));
    if buttons.just_pressed(MouseButton::Left) || touches.is_some_and(|t| t.any_just_pressed()) {
        if let Some(p) = pointer {
            d.drag = true;
            d.last_x = p.x;
        }
    }
    if buttons.just_released(MouseButton::Left) || touches.is_some_and(|t| t.any_just_released()) {
        d.drag = false;
    }
    if d.drag {
        if let Some(p) = pointer {
            let half = d.span / 2.0;
            d.along = (d.along - (p.x - d.last_x) * 0.0016).clamp(-half, half);
            d.last_x = p.x;
        }
    }
    for ev in wheel.read() {
        if ev.y != 0.0 {
            d.zoom = (d.zoom * if ev.y < 0.0 { 1.08 } else { 0.93 }).clamp(0.45, 2.2);
        }
    }

    // Camera: above the street and off to one side, looking down on the city.
    let (along, zoom) = (d.along, d.zoom);
    if let Ok(mut cam) = q.p0().single_mut() {
        let up = Vec3::new(-along.sin(), along.cos(), 0.0); // toward the centre from here
        cam.translation = ORIGIN + on_floor(along, 86.0 * zoom, 52.0 * zoom);
        cam.look_at(ORIGIN + on_floor(along, -4.0, 5.0), up);
    }
    for mut h in q.p1().iter_mut() {
        h.scale = Vec3::splat(1.0 + (frame * 0.02).sin() * 0.05);
    }
    for (e, f, mut tf, mat) in q.p2().iter_mut() {
        let u = (frame - f.born) / 110.0;
        if u >= 1.0 {
            cmd.entity(e).despawn();
            continue;
        }
        tf.scale = Vec3::splat(1.0 + u * 5.0);
        if let Some(mut m) = mats.get_mut(&mat.0) {
            m.base_color.set_alpha(0.9 * (1.0 - u));
        }
    }

    // The Nous walk toward their places; one leaving walks off the end of the street.
    let a = 1.0 - (1.0 - 0.03f32).powf(k);
    let mut gone = Vec::new();
    let mut moves = Vec::new();
    for (did, f) in d.figures.iter_mut() {
        f.angle += (f.to_angle - f.angle) * a;
        f.z += (f.to_z - f.z) * a;
        if f.leaving && (f.to_angle - f.angle).abs() < 0.004 {
            gone.push(did.clone());
            continue;
        }
        moves.push((f.group, Transform::from_translation(on_floor(f.angle, f.z, 0.4)).with_rotation(Quat::from_rotation_z(f.angle))));
        if f.sign.is_some() && frame - f.sign_born > 260.0 {
            if let Some((anchor, s)) = f.sign.take() {
                cmd.entity(anchor).despawn();
                cmd.entity(s).despawn();
            }
        }
    }
    let mut tfs = q.p3();
    for (e, t) in moves {
        if let Ok(mut tf) = tfs.get_mut(e) {
            *tf = t;
        }
    }
    for did in gone {
        if let Some(f) = d.figures.remove(&did) {
            cmd.entity(f.group).despawn();
            cmd.entity(f.label).despawn();
            if let Some((_, s)) = f.sign {
                cmd.entity(s).despawn();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lot(angle: f32) -> DistrictLot {
        DistrictLot { id: format!("l{angle}"), angle, side: 1, kind: "empty".into(), condition: "maintained".into(), occupied: false }
    }

    #[test]
    fn span_is_at_least_one_lot() {
        assert!((district_span(&[]) - LOT_PITCH / FLOOR_RADIUS).abs() < 1e-6);
        assert!((district_span(&[lot(-0.1), lot(0.2)]) - (0.3 + LOT_PITCH / FLOOR_RADIUS)).abs() < 1e-6);
    }

    #[test]
    fn floor_is_below_the_centre() {
        let p = on_floor(0.0, 0.0, 0.0);
        assert!((p.y + FLOOR_RADIUS).abs() < 1e-4 && p.x.abs() < 1e-4);
        // Raising toward the centre shortens the radius.
        assert!((on_floor(0.0, 0.0, 9.0).y + (FLOOR_RADIUS - 9.0)).abs() < 1e-4);
    }

    #[test]
    fn walk_in_end_follows_the_last_character() {
        assert_eq!(street_end("x1", 0.2).signum(), 1.0); // '1' = 49, odd
        assert_eq!(street_end("x2", 0.2).signum(), -1.0); // '2' = 50, even
    }
}
