//! Pure layout of the orbital Genesis station — no renderer.
//!
//! A port of `dashboard/src/components/worldmap/orbital-layout.ts`, `zone-view.ts` and
//! `grid-focus.ts`. The answers must match the TypeScript: `fixtures/layout-parity.json`
//! is recorded from the TypeScript (dashboard `test/orbital-layout-parity.test.ts`) and
//! replayed in `tests/parity.rs`.

use serde::Deserialize;
use std::f64::consts::PI;

/// A parcel as the Grid feed sends it (`GET /api/v1/civic/parcels`). Only the fields
/// the scene draws from; the whole JSON object is kept by the scene for `onPick`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Parcel {
    pub id: String,
    pub zone: String,
    #[serde(default)]
    pub zone_kind: Option<String>,
    #[serde(default)]
    pub zone_label: Option<String>,
    pub ring: f64,
    pub sector: f64,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub owner_civic_did_hash: Option<String>,
    #[serde(default)]
    pub occupant_count: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ZoneKind {
    Home,
    Business,
    Civic,
}

/// One zone of a Grid (D-V3-40): its id, the Polis's label, and what it is for.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct ZoneView {
    pub zone_id: String,
    pub label: String,
    pub kind: ZoneKind,
}

/// The six-zone template every Grid starts from.
pub fn template_zones() -> Vec<ZoneView> {
    [
        ("government_quarter", "Government Quarter", ZoneKind::Civic),
        ("infrastructure", "Infrastructure", ZoneKind::Civic),
        ("business", "Business", ZoneKind::Business),
        ("shopping", "Shopping", ZoneKind::Business),
        ("manufacture", "Manufacture", ZoneKind::Business),
        ("residential", "Residential", ZoneKind::Home),
    ]
    .into_iter()
    .map(|(id, label, kind)| ZoneView { zone_id: id.into(), label: label.into(), kind })
    .collect()
}

fn template_color(zone_id: &str) -> Option<u32> {
    Some(match zone_id {
        "government_quarter" => 0x8e54b8,
        "infrastructure" => 0x8a98ac,
        "business" => 0xc2a878,
        "shopping" => 0x3fa6bd,
        "manufacture" => 0x9a5a44,
        "residential" => 0x5a84c4,
        _ => return None,
    })
}

fn template_label(zone_id: &str) -> Option<&'static str> {
    Some(match zone_id {
        "government_quarter" => "Government Quarter",
        "infrastructure" => "Infrastructure",
        "business" => "Business",
        "shopping" => "Shopping",
        "manufacture" => "Manufacture",
        "residential" => "Residential",
        _ => return None,
    })
}

fn template_sign(zone_id: &str) -> Option<&'static str> {
    match zone_id {
        "government_quarter" => Some("GOVERNMENT CORE"),
        "infrastructure" => Some("COMMONS"),
        _ => None,
    }
}

/// JavaScript's `Math.round` (halves round toward +∞).
pub fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

/// JavaScript truthiness of a number (0 and NaN are false).
fn truthy(x: f64) -> bool {
    x != 0.0 && !x.is_nan()
}

fn hsl_to_hex(h: f64, s: f64, l: f64) -> u32 {
    let a = s * l.min(1.0 - l);
    let ch = |n: f64| -> u32 {
        let k = (n + h / 30.0) % 12.0;
        js_round(255.0 * (l - a * (-1.0f64).max((k - 3.0).min(9.0 - k).min(1.0)))) as u32
    };
    (ch(0.0) << 16) | (ch(8.0) << 8) | ch(4.0)
}

/// A zone's colour: the template palette, or a stable colour derived from an added zone's id.
pub fn zone_color(zone_id: &str) -> u32 {
    if let Some(c) = template_color(zone_id) {
        return c;
    }
    let mut h: u32 = 0;
    for u in zone_id.encode_utf16() {
        h = (h * 31 + u as u32) % 360;
    }
    hsl_to_hex(h as f64, 0.5, 0.6)
}

/// The neon sign over a zone: its label, in the station's signage style.
pub fn zone_sign(z: &ZoneView) -> String {
    if Some(z.label.as_str()) == template_label(&z.zone_id) {
        if let Some(s) = template_sign(&z.zone_id) {
            return s.into();
        }
    }
    z.label.to_uppercase()
}

/// The sign of a zone no longer in the Grid's set (or not known): its id, spaced and upper-cased.
pub fn id_sign(zone_id: &str) -> String {
    zone_id.replace('_', " ").to_uppercase()
}

/// The kind of the zone a parcel sits in — from the feed, else the Grid's zone set.
pub fn parcel_zone_kind(p: &Parcel, zones: &[ZoneView]) -> Option<ZoneKind> {
    match p.zone_kind.as_deref() {
        Some("home") => Some(ZoneKind::Home),
        Some("business") => Some(ZoneKind::Business),
        Some("civic") => Some(ZoneKind::Civic),
        _ => zones.iter().find(|z| z.zone_id == p.zone).map(|z| z.kind),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderStatus {
    Civic,
    Commons,
    Owned,
    Unsold,
}

impl RenderStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            RenderStatus::Civic => "civic",
            RenderStatus::Commons => "commons",
            RenderStatus::Owned => "owned",
            RenderStatus::Unsold => "unsold",
        }
    }
}

/// Map a live feed parcel to the canonical render status (zone KIND + ownership).
pub fn render_status(p: &Parcel, zones: &[ZoneView]) -> RenderStatus {
    if parcel_zone_kind(p, zones) == Some(ZoneKind::Civic) {
        return if p.ring == 0.0 { RenderStatus::Civic } else { RenderStatus::Commons };
    }
    // JS: `p.status === 'owned' || p.owner_civic_did_hash` (an empty string is falsy).
    let has_owner = p.owner_civic_did_hash.as_deref().is_some_and(|h| !h.is_empty());
    if p.status == "owned" || has_owner { RenderStatus::Owned } else { RenderStatus::Unsold }
}

/// Radius of each Genesis Core ring (1, 2, 3).
pub fn ring_r(ring: u8) -> f64 {
    match ring {
        1 => 30.0,
        2 => 56.0,
        _ => 84.0,
    }
}
/// Tilt of the residential (ring 3) orbit.
pub const INCL: f64 = 0.42;

/// Radius of a ring a Polis opened beyond the Genesis Core (ring 4+).
pub fn outer_radius(ring: f64) -> f64 {
    ring_r(3) + 24.0 * (ring - 3.0)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParcelParent {
    Station,
    R3Spin,
    Shell,
}

impl ParcelParent {
    pub fn as_str(self) -> &'static str {
        match self {
            ParcelParent::Station => "station",
            ParcelParent::R3Spin => "r3spin",
            ParcelParent::Shell => "shell",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ParcelPlace {
    pub parent: ParcelParent,
    pub ring: f64,
    pub pos: [f64; 3],
    pub size: f64,
}

/// Where a parcel's module goes (see `parcelPlace` in orbital-layout.ts).
pub fn parcel_place(ring: f64, sector: f64, index_in_ring: usize) -> Option<ParcelPlace> {
    let th = sector * PI / 180.0;
    let (c, s) = (th.cos(), th.sin());
    if ring == 1.0 {
        let y = if truthy((sector / 90.0) % 2.0) { 5.0 } else { -5.0 };
        return Some(ParcelPlace { parent: ParcelParent::Station, ring, size: 4.2, pos: [c * ring_r(1), y, s * ring_r(1)] });
    }
    if ring == 2.0 {
        let y = if truthy(js_round(sector) % 2.0) { 6.0 } else { -6.0 };
        return Some(ParcelPlace { parent: ParcelParent::Station, ring, size: 3.6, pos: [c * ring_r(2), y, s * ring_r(2)] });
    }
    if ring == 3.0 {
        let y = if truthy(js_round(sector * 24.0 / 360.0) % 2.0) { 4.0 } else { -4.0 };
        return Some(ParcelPlace { parent: ParcelParent::R3Spin, ring, size: 3.0, pos: [c * ring_r(3), y, s * ring_r(3)] });
    }
    if ring > 3.0 {
        let rad = outer_radius(ring);
        let y = if index_in_ring % 2 == 1 { 4.0 } else { -4.0 };
        return Some(ParcelPlace { parent: ParcelParent::Shell, ring, size: 3.0, pos: [c * rad, y, s * rad] });
    }
    None
}

/// Every module of a feed, in feed order: (index into `parcels`, place).
pub fn layout_parcels(parcels: &[Parcel]) -> Vec<(usize, ParcelPlace)> {
    let mut seen: Vec<(f64, usize)> = Vec::new();
    let mut out = Vec::new();
    for (k, p) in parcels.iter().enumerate() {
        let mut i = 0;
        if p.ring > 3.0 {
            match seen.iter_mut().find(|(r, _)| *r == p.ring) {
                Some((_, n)) => {
                    i = *n;
                    *n += 1;
                }
                None => seen.push((p.ring, 1)),
            }
        }
        if let Some(place) = parcel_place(p.ring, p.sector, i) {
            out.push((k, place));
        }
    }
    out
}

/// How far the camera stands from a Grid so it fills the view (grid-focus.ts).
pub fn fit_distance(radius: f64, fov_deg: f64, aspect: f64) -> f64 {
    const MARGIN: f64 = 1.08;
    const FLATTEN: f64 = 0.6;
    let tan_v = (fov_deg * PI / 360.0).tan();
    let tan_h = tan_v * aspect;
    ((radius * MARGIN) / tan_h).max((radius * MARGIN * FLATTEN) / tan_v)
}

// ── picking geometry ──────────────────────────────────────────────────────────

fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// Distance along a ray (origin `o`, unit direction `d`) to its first hit on a sphere.
pub fn ray_sphere(o: [f64; 3], d: [f64; 3], center: [f64; 3], r: f64) -> Option<f64> {
    let oc = sub(o, center);
    let b = dot(oc, d);
    let c = dot(oc, oc) - r * r;
    let disc = b * b - c;
    if disc < 0.0 {
        return None;
    }
    let sq = disc.sqrt();
    let t0 = -b - sq;
    let t1 = -b + sq;
    if t0 >= 0.0 {
        Some(t0)
    } else if t1 >= 0.0 {
        Some(0.0) // the ray starts inside
    } else {
        None
    }
}

/// Distance along a ray to a capsule (segment `a`–`b`, radius `r`), or None.
/// Sampled against the segment's end spheres and its closest point — exact enough for a click.
pub fn ray_capsule(o: [f64; 3], d: [f64; 3], a: [f64; 3], b: [f64; 3], r: f64) -> Option<f64> {
    // Closest points between the ray and the segment.
    let u = sub(b, a);
    let w = sub(o, a);
    let (aa, bb, cc, dd, ee) = (dot(u, u), dot(u, d), dot(d, d), dot(u, w), dot(d, w));
    let den = aa * cc - bb * bb;
    let mut sc = if den.abs() < 1e-12 { 0.0 } else { (bb * ee - cc * dd) / -den };
    sc = sc.clamp(0.0, 1.0);
    let p = [a[0] + u[0] * sc, a[1] + u[1] * sc, a[2] + u[2] * sc];
    ray_sphere(o, d, p, r)
        .or_else(|| ray_sphere(o, d, a, r))
        .or_else(|| ray_sphere(o, d, b, r))
}

/// A point on a uniform Catmull-Rom curve through `pts` (ends extrapolated, like three's
/// CatmullRomCurve3 with open ends), `u` in 0..=1.
pub fn catmull_rom(pts: &[[f64; 3]], u: f64) -> [f64; 3] {
    let n = pts.len();
    if n == 0 {
        return [0.0; 3];
    }
    if n == 1 {
        return pts[0];
    }
    let segs = (n - 1) as f64;
    let x = (u.clamp(0.0, 1.0) * segs).min(segs - 1e-9);
    let i = x.floor() as usize;
    let t = x - i as f64;
    let get = |k: isize| -> [f64; 3] {
        if k < 0 {
            let (a, b) = (pts[0], pts[1]);
            [2.0 * a[0] - b[0], 2.0 * a[1] - b[1], 2.0 * a[2] - b[2]]
        } else if k as usize >= n {
            let (a, b) = (pts[n - 1], pts[n - 2]);
            [2.0 * a[0] - b[0], 2.0 * a[1] - b[1], 2.0 * a[2] - b[2]]
        } else {
            pts[k as usize]
        }
    };
    let (p0, p1, p2, p3) = (get(i as isize - 1), get(i as isize), get(i as isize + 1), get(i as isize + 2));
    let (t2, t3) = (t * t, t * t * t);
    let mut out = [0.0; 3];
    for k in 0..3 {
        out[k] = 0.5
            * ((2.0 * p1[k])
                + (-p0[k] + p2[k]) * t
                + (2.0 * p0[k] - 5.0 * p1[k] + 4.0 * p2[k] - p3[k]) * t2
                + (-p0[k] + 3.0 * p1[k] - 3.0 * p2[k] + p3[k]) * t3);
    }
    out
}

/// A small deterministic PRNG (xorshift32) — the star field is the same on every load,
/// and the WASM build needs no OS randomness.
pub struct Rng(u32);
impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng(seed.max(1))
    }
    pub fn next_f64(&mut self) -> f64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        x as f64 / u32::MAX as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parcel(ring: f64, sector: f64, zone: &str) -> Parcel {
        Parcel { id: format!("{zone}:{ring}:{sector}"), zone: zone.into(), zone_kind: None, zone_label: None, ring, sector, status: "available".into(), owner_civic_did_hash: None, occupant_count: None }
    }

    #[test]
    fn template_signs_and_relabels() {
        let mut z = template_zones();
        assert_eq!(zone_sign(&z[0]), "GOVERNMENT CORE");
        assert_eq!(zone_sign(&z[2]), "BUSINESS");
        z[0].label = "Senate Hill".into();
        assert_eq!(zone_sign(&z[0]), "SENATE HILL");
    }

    #[test]
    fn status_keys_on_kind_not_name() {
        let zones = template_zones();
        let mut p = parcel(1.0, 0.0, "infrastructure");
        assert_eq!(render_status(&p, &zones), RenderStatus::Commons);
        p.ring = 0.0;
        assert_eq!(render_status(&p, &zones), RenderStatus::Civic);
        let mut q = parcel(2.0, 10.0, "harbor");
        q.zone_kind = Some("business".into());
        assert_eq!(render_status(&q, &zones), RenderStatus::Unsold);
        q.owner_civic_did_hash = Some("ab".repeat(32));
        assert_eq!(render_status(&q, &zones), RenderStatus::Owned);
        q.owner_civic_did_hash = Some(String::new());
        assert_eq!(render_status(&q, &zones), RenderStatus::Unsold);
    }

    #[test]
    fn outer_rings_alternate_lift_per_ring() {
        let ps = vec![parcel(4.0, 0.0, "a"), parcel(5.0, 0.0, "b"), parcel(4.0, 90.0, "a"), parcel(0.0, 0.0, "gq")];
        let l = layout_parcels(&ps);
        assert_eq!(l.len(), 3);
        assert_eq!(l[0].1.pos[1], -4.0);
        assert_eq!(l[1].1.pos[1], -4.0);
        assert_eq!(l[2].1.pos[1], 4.0);
        assert_eq!(l[2].1.parent, ParcelParent::Shell);
    }

    #[test]
    fn pick_hits_and_misses() {
        let o = [0.0, 0.0, -10.0];
        let d = [0.0, 0.0, 1.0];
        assert!((ray_sphere(o, d, [0.0, 0.0, 0.0], 1.0).unwrap() - 9.0).abs() < 1e-9);
        assert!(ray_sphere(o, d, [3.0, 0.0, 0.0], 1.0).is_none());
        // A capsule lying across the ray's path, off its ends.
        assert!(ray_capsule(o, d, [-5.0, 0.5, 0.0], [5.0, 0.5, 0.0], 1.0).is_some());
        assert!(ray_capsule(o, d, [2.0, 0.0, 0.0], [5.0, 0.0, 0.0], 1.0).is_none());
    }

    #[test]
    fn catmull_rom_passes_through_its_points() {
        let pts = [[0.0, 0.0, 0.0], [5.0, 10.0, 0.0], [10.0, 0.0, 0.0]];
        let a = catmull_rom(&pts, 0.0);
        let m = catmull_rom(&pts, 0.5);
        let b = catmull_rom(&pts, 1.0);
        for k in 0..3 {
            assert!((a[k] - pts[0][k]).abs() < 1e-6);
            assert!((m[k] - pts[1][k]).abs() < 1e-6);
            assert!((b[k] - pts[2][k]).abs() < 1e-6);
        }
    }
}
