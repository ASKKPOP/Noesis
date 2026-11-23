/**
 * The Genesis catalog — Tier 0, the core every Grid is initialized with
 * (Grid House Objects sheet §14–§15: "pre-designed by the system").
 *
 * 18 structural materials · 12 finishes · 14 shell elements · 59 furnishing kinds
 * (18 mirror + 41 functional) · 20 algorithms · 4 starter sets. The App Link
 * provider registry starts empty.
 *
 * This file is the source of truth for Tier 0. It was produced from the reviewed
 * draft docs/plans/2026-11-21-genesis-catalog-seed.draft.yaml, and the two must not
 * drift (grid/test/civic/genesis-catalog.test.ts compares them). CatalogStore seeds
 * it into `civic_catalog_entries` at every boot, idempotently.
 *
 * Rules carried from the sheet:
 *   - kinds are closed per catalog version; forms are open (a Nous may draw any
 *     form under a kind, and it stays that kind to every other mind and to the law);
 *   - Tier 0 entries are immutable within a version — a change is a new version;
 *   - mirror kinds are valid only in a home, functional kinds in any structure;
 *   - no entry carries a secret, a price, or executable code. Unit prices are the
 *     operator's to set (Q14) and are not here.
 *
 * Placement. A kind can be placed only when it is placeable. Every mirror kind is
 * (it only renders). A functional kind whose subsystem does not exist yet is seeded,
 * so every mind shares its meaning, but cannot be placed until that subsystem is
 * built; the same rule keeps it out of the starter sets (§14.6).
 */
import { createHash } from 'node:crypto';
import type { StructureType } from './types.js';
import { formBounds, validateFormDoc, type FormBounds, type FormDoc } from './form-dsl.js';
import { GENESIS_DEFAULT_FORMS } from './genesis-forms.js';

/** The catalog version every Tier 0 entry and every manifest pins. */
export const GENESIS_CATALOG_VERSION = '1.0.0';

export type CatalogEnvironment = 'earth_orbit' | 'moon' | 'mars';
export type SubsystemStatus = 'exists' | 'partial' | 'new';
export type KindClass = 'mirror' | 'functional';
export type KindGroup = 'living' | 'work' | 'knowledge' | 'commerce' | 'social' | 'civic' | 'mind' | 'utility';
export type Anchor = 'deck' | 'wall' | 'surface' | 'hull';
export type Layer = 'F' | 'L' | 'Fn' | 'G';

export interface MaterialEntry {
    readonly id: string;
    readonly name: string;
    readonly group: string;
    readonly density: string;
    readonly performance: string;
    readonly role: string;
    readonly sourceGrade: 'primary' | 'secondary' | 'handbook_unverified';
    readonly note: string;
    readonly environments: readonly CatalogEnvironment[];
}

export interface FinishEntry {
    readonly id: string;
    readonly name: string;
    readonly color: string;
    readonly roughness: number;
    readonly metalness: number;
}

export interface ShellElementEntry {
    readonly id: string;
    readonly name: string;
    readonly purpose: string;
    readonly defaultMaterials: readonly string[];
    readonly class: 'physical' | 'layout' | 'view';
    readonly bindsTo: string;
}

interface KindRow {
    readonly id: string;
    readonly class: KindClass;
    readonly group: KindGroup;
    readonly affordances: readonly string[];
    readonly bindsTo: string;
    readonly subsystemStatus: SubsystemStatus;
    readonly layers: readonly Layer[];
    readonly anchor: Anchor;
    readonly since: 'v1' | 'v2';
}

export interface KindEntry extends KindRow {
    /** May a Nous place it today (see the file header). */
    readonly placeable: boolean;
    /** The catalog v2 default form, used until someone designs another. */
    readonly form: FormDoc;
    /** The default form's size [x, y, z] in metres. */
    readonly bounds: FormBounds;
}

export interface AlgorithmEntry {
    readonly id: string;
    readonly runs: 'grid' | 'brain' | 'grid+brain';
    readonly kind: string;
    readonly status: SubsystemStatus;
}

export interface StarterSetEntry {
    readonly structure: StructureType;
    /** The set as designed. */
    readonly kinds: readonly string[];
    /** What an owner can be offered today: the placeable part of the set. */
    readonly offered: readonly string[];
}

export const MATERIALS: readonly MaterialEntry[] = [
    { id: "al_6061", name: "Aluminium 6061-T6", group: "metal", density: "2.70–2.71 g/cm³", performance: "yield ≈ 255–276 MPa", role: "frames; debris bumpers", sourceGrade: "secondary", note: "ISS shield bumpers are typically 6061-T6 (NASA HVIT)", environments: ["earth_orbit", "moon", "mars"] },
    { id: "al_2219", name: "Aluminium 2219-T87", group: "metal", density: "2.84 g/cm³", performance: "yield ≈ 393 MPa · UTS ≈ 476 MPa (typical)", role: "pressure wall; rear wall of the shield", sourceGrade: "secondary", note: "ISS rear walls are typically 2219-T87 / T851 (NASA HVIT)", environments: ["earth_orbit", "moon", "mars"] },
    { id: "ti_6al4v", name: "Titanium Ti-6Al-4V", group: "metal", density: "4.42–4.43 g/cm³", performance: "yield ≥ 828 MPa · UTS ≥ 895 MPa (annealed minimums)", role: "fittings; hatches; fasteners", sourceGrade: "secondary", note: "Timet datasheet minimums; typical runs 830–900 MPa", environments: ["earth_orbit", "moon", "mars"] },
    { id: "steel_304", name: "Stainless steel 304", group: "metal", density: "≈ 8.0 g/cm³", performance: "yield ≈ 215 MPa", role: "interior hardware", sourceGrade: "handbook_unverified", note: "not verified in this pass", environments: ["earth_orbit", "moon", "mars"] },
    { id: "copper", name: "Copper", group: "metal", density: "8.96 g/cm³", performance: "conductor", role: "power bus; data conduit", sourceGrade: "handbook_unverified", note: "not verified in this pass", environments: ["earth_orbit", "moon", "mars"] },
    { id: "cfrp", name: "Carbon-fibre composite", group: "composite", density: "≈ 1.6 g/cm³", performance: "depends on the laminate", role: "trusses; panels; decks", sourceGrade: "handbook_unverified", note: "not verified in this pass", environments: ["earth_orbit", "moon", "mars"] },
    { id: "vectran_webbing", name: "Vectran webbing", group: "soft_goods", density: "—", performance: "restraint layer carries the pressure load", role: "inflatable shell", sourceGrade: "primary", note: "creep is the life-limiting factor (NASA)", environments: ["earth_orbit", "moon", "mars"] },
    { id: "kevlar_fabric", name: "Kevlar fabric", group: "soft_goods", density: "—", performance: "6 layers in the ISS stuffed shield", role: "debris blanket", sourceGrade: "primary", note: "also measured as radiation shielding in Columbus", environments: ["earth_orbit", "moon", "mars"] },
    { id: "nextel_fabric", name: "Nextel ceramic fabric", group: "soft_goods", density: "—", performance: "6 layers of AF62 in the ISS stuffed shield", role: "debris blanket", sourceGrade: "primary", note: "breaks up the projectile ahead of the Kevlar", environments: ["earth_orbit", "moon", "mars"] },
    { id: "fused_silica", name: "Fused silica glass", group: "glazing", density: "—", performance: "two 25 mm pressure panes plus a debris pane (Cupola)", role: "viewport panes", sourceGrade: "secondary", note: "pane detail from Wikipedia; ESA confirms the glass types", environments: ["earth_orbit", "moon", "mars"] },
    { id: "borosilicate", name: "Borosilicate glass", group: "glazing", density: "—", performance: "listed by ESA for the Cupola windows", role: "viewport pane", sourceGrade: "primary", note: "ESA does not say which pane", environments: ["earth_orbit", "moon", "mars"] },
    { id: "mli_kapton", name: "Multi-layer insulation (Kapton)", group: "thermal", density: "≈ 0.45 kg/m² (conservative-low flight figure)", performance: "stacked low-emittance films", role: "insulation blanket", sourceGrade: "secondary", note: "stops working where gas is present", environments: ["earth_orbit", "moon", "mars"] },
    { id: "white_coating", name: "White thermal coating (Z-93 class)", group: "thermal", density: "—", performance: "solar absorptance ≈ 0.14–0.15 on LDEF / MISSE", role: "radiator finish", sourceGrade: "primary", note: "emittance not confirmed in this pass", environments: ["earth_orbit", "moon", "mars"] },
    { id: "polyethylene", name: "Polyethylene", group: "radiation", density: "—", performance: "hydrogen-rich; the benchmark shield material", role: "radiation liner", sourceGrade: "primary", note: "ALTEA-shield, ISS Columbus, 2012", environments: ["earth_orbit", "moon", "mars"] },
    { id: "water", name: "Water", group: "radiation", density: "1.0 g/cm³", performance: "water wall around crew quarters", role: "radiation liner; store", sourceGrade: "primary", note: "NASA RadWorks storm-shelter concept", environments: ["earth_orbit", "moon", "mars"] },
    { id: "pv_triple_junction", name: "Triple-junction solar cell", group: "power", density: "—", performance: "≈ 30% at beginning of life (AM0, 28 °C)", role: "solar skin", sourceGrade: "primary", note: "end-of-life efficiency is lower", environments: ["earth_orbit", "moon", "mars"] },
    { id: "sintered_regolith", name: "Sintered regolith", group: "in_situ", density: "≈ 2.4 g/cm³ (one simulant result)", performance: "17–230 MPa compressive, by process", role: "bulk shielding; masonry", sourceGrade: "primary", note: "simulants, not real regolith; Stanford torus used 1.7 m of lunar soil", environments: ["moon", "mars"] },
    { id: "sulfur_concrete", name: "Sulfur concrete", group: "in_situ", density: "—", performance: "> 50 MPa claimed; later work did not reproduce it", role: "masonry", sourceGrade: "primary", note: "contested; Mars sulfur must be extracted first", environments: ["mars"] },
];

export const FINISHES: readonly FinishEntry[] = [
    { id: "wood_light", name: "Light wood", color: "#c9a36b", roughness: 0.7, metalness: 0.0 },
    { id: "wood_dark", name: "Dark wood", color: "#5b4636", roughness: 0.7, metalness: 0.0 },
    { id: "fabric_weave", name: "Woven fabric", color: "#7d8ca3", roughness: 0.95, metalness: 0.0 },
    { id: "leather", name: "Leather", color: "#6b4a3a", roughness: 0.55, metalness: 0.0 },
    { id: "stone", name: "Stone", color: "#8c8f94", roughness: 0.85, metalness: 0.0 },
    { id: "ceramic", name: "Ceramic", color: "#e9e6df", roughness: 0.3, metalness: 0.0 },
    { id: "glass_clear", name: "Clear glass", color: "#cfe8f5", roughness: 0.05, metalness: 0.0 },
    { id: "glass_frosted", name: "Frosted glass", color: "#dfeaf0", roughness: 0.45, metalness: 0.0 },
    { id: "brushed_metal", name: "Brushed metal", color: "#a9b0b8", roughness: 0.35, metalness: 0.9 },
    { id: "polymer_matte", name: "Matte polymer", color: "#e4e6ea", roughness: 0.6, metalness: 0.0 },
    { id: "paper", name: "Paper", color: "#f2ecd9", roughness: 0.9, metalness: 0.0 },
    { id: "living_green", name: "Living green", color: "#4f9d5d", roughness: 0.8, metalness: 0.0 },
];

export const SHELL_ELEMENTS: readonly ShellElementEntry[] = [
    { id: "frame_truss", name: "Frame / truss", purpose: "carries every load", defaultMaterials: ["al_6061", "cfrp", "ti_6al4v"], class: "physical", bindsTo: "structure gate · structural law" },
    { id: "hull_panel", name: "Hull panel", purpose: "encloses the volume", defaultMaterials: ["al_2219", "vectran_webbing"], class: "physical", bindsTo: "structure gate · mass" },
    { id: "debris_shield", name: "Debris shield", purpose: "stops small impacts", defaultMaterials: ["al_6061", "nextel_fabric", "kevlar_fabric"], class: "physical", bindsTo: "structure gate · mass" },
    { id: "radiation_liner", name: "Radiation liner", purpose: "protects electronics and visitors", defaultMaterials: ["polyethylene", "water", "sintered_regolith"], class: "physical", bindsTo: "structure gate · mass" },
    { id: "insulation_blanket", name: "Insulation blanket", purpose: "holds heat in or out", defaultMaterials: ["mli_kapton"], class: "physical", bindsTo: "structure gate · thermal law" },
    { id: "radiator_panel", name: "Radiator panel", purpose: "rejects waste heat", defaultMaterials: ["al_6061", "white_coating"], class: "physical", bindsTo: "structure gate · thermal law" },
    { id: "solar_skin", name: "Solar skin", purpose: "generates power", defaultMaterials: ["pv_triple_junction"], class: "physical", bindsTo: "structure gate · power law" },
    { id: "power_bus", name: "Power bus", purpose: "distributes power", defaultMaterials: ["copper"], class: "physical", bindsTo: "power_node furnishing" },
    { id: "data_conduit", name: "Data conduit", purpose: "carries signals", defaultMaterials: ["copper"], class: "physical", bindsTo: "comms_antenna furnishing" },
    { id: "hatch", name: "Hatch", purpose: "the door of the Holding", defaultMaterials: ["ti_6al4v", "al_2219"], class: "physical", bindsTo: "entry policy (open | allowlist)" },
    { id: "dock_port", name: "Dock port", purpose: "where visitors arrive", defaultMaterials: ["al_2219", "ti_6al4v"], class: "physical", bindsTo: "join / leave, occupant count" },
    { id: "partition", name: "Partition", purpose: "divides the interior", defaultMaterials: ["cfrp"], class: "layout", bindsTo: "one InteriorArea per enclosed space" },
    { id: "deck", name: "Deck", purpose: "an interior floor", defaultMaterials: ["al_6061", "cfrp"], class: "layout", bindsTo: "floors inside the parcel's one purchased level" },
    { id: "viewport", name: "Viewport", purpose: "a window", defaultMaterials: ["fused_silica", "borosilicate"], class: "view", bindsTo: "the human's view in (D-NH-01)" },
];

const KIND_ROWS: readonly KindRow[] = [
    { id: "bed", class: "mirror", group: "living", affordances: [], bindsTo: "render only; may show the Nous asleep or away", subsystemStatus: "exists", layers: ["F"], anchor: "deck", since: "v1" },
    { id: "closet", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "exists", layers: ["F"], anchor: "wall", since: "v1" },
    { id: "shelf", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "exists", layers: ["F"], anchor: "wall", since: "v1" },
    { id: "kitchen", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "exists", layers: ["F"], anchor: "deck", since: "v1" },
    { id: "bathroom", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "exists", layers: ["F"], anchor: "deck", since: "v1" },
    { id: "decor", class: "mirror", group: "living", affordances: [], bindsTo: "render only; the generic slot for a custom form", subsystemStatus: "exists", layers: ["F"], anchor: "deck", since: "v1" },
    { id: "table", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "deck", since: "v2" },
    { id: "chair", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "deck", since: "v2" },
    { id: "sofa", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "deck", since: "v2" },
    { id: "lamp", class: "mirror", group: "living", affordances: [], bindsTo: "render only; emissive finish", subsystemStatus: "new", layers: ["F"], anchor: "surface", since: "v2" },
    { id: "rug", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "deck", since: "v2" },
    { id: "plant", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "surface", since: "v2" },
    { id: "art_frame", class: "mirror", group: "living", affordances: [], bindsTo: "render only; shows an image by hash", subsystemStatus: "new", layers: ["F"], anchor: "wall", since: "v2" },
    { id: "wall_mirror", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "wall", since: "v2" },
    { id: "curtain", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "wall", since: "v2" },
    { id: "clock_face", class: "mirror", group: "living", affordances: [], bindsTo: "render only; shows the NY calendar at the display boundary", subsystemStatus: "new", layers: ["F"], anchor: "wall", since: "v2" },
    { id: "hearth", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "wall", since: "v2" },
    { id: "aquarium", class: "mirror", group: "living", affordances: [], bindsTo: "render only", subsystemStatus: "new", layers: ["F"], anchor: "deck", since: "v2" },
    { id: "work_desk", class: "functional", group: "work", affordances: ["billing", "accounting"], bindsTo: "nous_accounts, IOU ledger", subsystemStatus: "partial", layers: ["F", "Fn", "G"], anchor: "deck", since: "v1" },
    { id: "task_board", class: "functional", group: "work", affordances: ["task_tracking"], bindsTo: "cowork.ts board post / claim / complete", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "wall", since: "v1" },
    { id: "sim_board", class: "functional", group: "work", affordances: ["simulation"], bindsTo: "zone energy simulation (browser only today)", subsystemStatus: "partial", layers: ["F", "Fn"], anchor: "deck", since: "v1" },
    { id: "skill_terminal", class: "functional", group: "knowledge", affordances: ["skill_practice"], bindsTo: "blueprint skills, skill.taught", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v1" },
    { id: "meeting_table", class: "functional", group: "social", affordances: ["meeting"], bindsTo: "co-work sessions", subsystemStatus: "partial", layers: ["F", "Fn", "G"], anchor: "deck", since: "v1" },
    { id: "game_table", class: "functional", group: "social", affordances: ["play"], bindsTo: "no engine yet", subsystemStatus: "partial", layers: ["F", "Fn"], anchor: "deck", since: "v1" },
    { id: "shop_counter", class: "functional", group: "commerce", affordances: ["sales"], bindsTo: "shop binding, zone tax, market settle", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "deck", since: "v1" },
    { id: "workbench", class: "functional", group: "work", affordances: ["craft", "co_build"], bindsTo: "co-build.ts task DAG", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "drafting_table", class: "functional", group: "work", affordances: ["blueprint_author", "blueprint_browse"], bindsTo: "blueprint store; authoring does not exist", subsystemStatus: "partial", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "fabricator", class: "functional", group: "work", affordances: ["render_form"], bindsTo: "Form DSL compiler, local text-to-3D, paid render", subsystemStatus: "new", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "code_bench", class: "functional", group: "work", affordances: ["run_code"], bindsTo: "Brain sandbox (Docker, no network)", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "scheduler", class: "functional", group: "work", affordances: ["schedule_task", "remind"], bindsTo: "brain.scheduleTask (remember, reminder)", subsystemStatus: "partial", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "bookshelf", class: "functional", group: "knowledge", affordances: ["store_lore", "read"], bindsTo: "lore and library routes", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "wiki_desk", class: "functional", group: "knowledge", affordances: ["personal_wiki"], bindsTo: "Brain episteme wiki", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "memory_cabinet", class: "functional", group: "knowledge", affordances: ["recall", "export_view"], bindsTo: "memory stream; fork archive", subsystemStatus: "partial", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "research_terminal", class: "functional", group: "knowledge", affordances: ["web_search", "web_fetch"], bindsTo: "Brain tool registry", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "notebook_stand", class: "functional", group: "knowledge", affordances: ["read_real_docs"], bindsTo: "operator bridge notebook, Type A only", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "link_box", class: "functional", group: "commerce", affordances: ["lease_issue", "lease_revoke", "lease_rotate"], bindsTo: "Brain vault, capability tokens", subsystemStatus: "new", layers: ["F", "L", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "display_case", class: "functional", group: "commerce", affordances: ["list_design", "list_instance"], bindsTo: "marketplace listings", subsystemStatus: "partial", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "contract_desk", class: "functional", group: "commerce", affordances: ["agreement_sign", "sever"], bindsTo: "Cowork Agreements, severance FSM", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "rfp_board", class: "functional", group: "commerce", affordances: ["view_notice", "bid"], bindsTo: "procurement store", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "wall", since: "v2" },
    { id: "dues_terminal", class: "functional", group: "commerce", affordances: ["view_due", "pay_due"], bindsTo: "civic dues store", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "approval_tray", class: "functional", group: "commerce", affordances: ["request_approval", "show_pending"], bindsTo: "approval store, human.approval events", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "surface", since: "v2" },
    { id: "guestbook", class: "functional", group: "social", affordances: ["visit_log"], bindsTo: "occupant join / leave data; no log view yet", subsystemStatus: "partial", layers: ["F", "Fn", "G"], anchor: "surface", since: "v2" },
    { id: "mailbox", class: "functional", group: "social", affordances: ["inbox_read", "reply"], bindsTo: "civic inbox, conversation inbox", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "surface", since: "v2" },
    { id: "whisper_booth", class: "functional", group: "social", affordances: ["whisper"], bindsTo: "Whisper messages", subsystemStatus: "partial", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "reception_desk", class: "functional", group: "social", affordances: ["admit_guest", "set_entry"], bindsTo: "roles, entry policy", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "notice_board", class: "functional", group: "social", affordances: ["post_notice", "alert_route"], bindsTo: "alert policy and router", subsystemStatus: "new", layers: ["F", "Fn", "G"], anchor: "wall", since: "v2" },
    { id: "stage", class: "functional", group: "social", affordances: ["host_event", "announce"], bindsTo: "community posts", subsystemStatus: "partial", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "lectern", class: "functional", group: "knowledge", affordances: ["teach"], bindsTo: "location-aware teaching", subsystemStatus: "exists", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "civic_terminal", class: "functional", group: "civic", affordances: ["view_law", "file_complaint", "view_ballot"], bindsTo: "gov, polis-bills and police routes", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "telos_board", class: "functional", group: "mind", affordances: ["show_goal_digest"], bindsTo: "Telos; the Grid sees a hash only", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "wall", since: "v2" },
    { id: "deed_journal", class: "functional", group: "mind", affordances: ["show_deeds"], bindsTo: "praxis journal", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "surface", since: "v2" },
    { id: "observatory", class: "functional", group: "mind", affordances: ["percept_feed"], bindsTo: "aisthesis; camera bridge is Type A only", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "hull", since: "v2" },
    { id: "synthesis_table", class: "functional", group: "mind", affordances: ["synopsis"], bindsTo: "synopsis faculty", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "compute_rack", class: "functional", group: "mind", affordances: ["show_ai_power", "model_status"], bindsTo: "local model status; pledged compute", subsystemStatus: "partial", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "power_node", class: "functional", group: "utility", affordances: ["power_budget"], bindsTo: "structure gate, power law", subsystemStatus: "new", layers: ["F", "Fn"], anchor: "deck", since: "v2" },
    { id: "radiator_unit", class: "functional", group: "utility", affordances: ["thermal_budget"], bindsTo: "structure gate, thermal law", subsystemStatus: "new", layers: ["F", "Fn"], anchor: "hull", since: "v2" },
    { id: "comms_antenna", class: "functional", group: "utility", affordances: ["peer_announce"], bindsTo: "P2P announce", subsystemStatus: "exists", layers: ["F", "Fn"], anchor: "hull", since: "v2" },
    { id: "storage_locker", class: "functional", group: "utility", affordances: ["store", "retrieve"], bindsTo: "inventory; does not exist", subsystemStatus: "new", layers: ["F", "Fn", "G"], anchor: "deck", since: "v2" },
    { id: "app_terminal", class: "functional", group: "utility", affordances: ["app_link"], bindsTo: "provider registry, consent gate", subsystemStatus: "new", layers: ["F", "L", "Fn", "G"], anchor: "deck", since: "v2" },
];

export const ALGORITHMS: readonly AlgorithmEntry[] = [
    { id: "ledger_view", runs: "grid", kind: "work_desk", status: "partial" },
    { id: "invoice_draft", runs: "brain", kind: "work_desk", status: "new" },
    { id: "board_post", runs: "grid", kind: "task_board", status: "exists" },
    { id: "board_claim", runs: "grid", kind: "task_board", status: "exists" },
    { id: "board_complete", runs: "grid", kind: "task_board", status: "exists" },
    { id: "listing_bind", runs: "grid", kind: "shop_counter", status: "exists" },
    { id: "price_table", runs: "grid", kind: "shop_counter", status: "exists" },
    { id: "zone_energy_sim", runs: "grid", kind: "sim_board", status: "partial" },
    { id: "agenda_queue", runs: "grid", kind: "meeting_table", status: "new" },
    { id: "minutes_digest", runs: "brain", kind: "meeting_table", status: "new" },
    { id: "blueprint_browse", runs: "grid", kind: "drafting_table", status: "partial" },
    { id: "turn_game", runs: "grid", kind: "game_table", status: "new" },
    { id: "schedule_task", runs: "brain", kind: "scheduler", status: "partial" },
    { id: "visit_log", runs: "grid", kind: "guestbook", status: "new" },
    { id: "alert_route", runs: "grid", kind: "notice_board", status: "new" },
    { id: "lease_issue", runs: "grid+brain", kind: "link_box", status: "new" },
    { id: "lease_revoke", runs: "grid+brain", kind: "link_box", status: "new" },
    { id: "lease_rotate", runs: "brain", kind: "link_box", status: "new" },
    { id: "power_budget", runs: "grid", kind: "power_node", status: "new" },
    { id: "thermal_budget", runs: "grid", kind: "radiator_unit", status: "new" },
];

const STARTER_SET_ROWS: readonly { structure: StructureType; kinds: readonly string[] }[] = [
    { structure: "home", kinds: ["bed", "table", "chair", "lamp", "work_desk", "bookshelf", "mailbox", "guestbook"] },
    { structure: "shop", kinds: ["shop_counter", "display_case", "reception_desk", "mailbox", "notice_board"] },
    { structure: "workshop", kinds: ["workbench", "drafting_table", "task_board", "skill_terminal", "storage_locker"] },
    { structure: "venue", kinds: ["meeting_table", "stage", "lectern", "notice_board", "guestbook", "game_table"] },
];

/**
 * Functional kinds seeded for their meaning but not placeable yet: the seven whose
 * subsystem is new, and display_case, whose design and instance listings wait for
 * the share-and-sell phase (§14.6).
 */
export const NOT_YET_PLACEABLE: ReadonlySet<string> = new Set([
    'fabricator', 'link_box', 'notice_board', 'power_node', 'radiator_unit',
    'storage_locker', 'app_terminal', 'display_case',
]);

const FINISH_IDS: ReadonlySet<string> = new Set(FINISHES.map((f) => f.id));

function deepFreeze<T>(v: T): T {
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
        for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
        Object.freeze(v);
    }
    return v;
}

deepFreeze(MATERIALS);
deepFreeze(FINISHES);
deepFreeze(SHELL_ELEMENTS);
deepFreeze(ALGORITHMS);

function buildKinds(): readonly KindEntry[] {
    return KIND_ROWS.map((row) => {
        const form = GENESIS_DEFAULT_FORMS[row.id];
        if (form === undefined) throw new Error(`genesis catalog: kind ${row.id} has no default form`);
        const errors = validateFormDoc(form, FINISH_IDS);
        if (errors.length > 0) throw new Error(`genesis catalog: default form of ${row.id} fails the gate: ${errors.join('; ')}`);
        return { ...row, placeable: !NOT_YET_PLACEABLE.has(row.id), form, bounds: formBounds(form) };
    });
}

export const KINDS: readonly KindEntry[] = deepFreeze(buildKinds());

const KIND_BY_ID: ReadonlyMap<string, KindEntry> = new Map(KINDS.map((k) => [k.id, k]));

export const STARTER_SETS: readonly StarterSetEntry[] = deepFreeze(STARTER_SET_ROWS.map((s) => ({
    structure: s.structure,
    kinds: s.kinds,
    offered: s.kinds.filter((k) => KIND_BY_ID.get(k)?.placeable === true),
})));

/** A Tier 0 kind by id, or undefined. */
export function genesisKind(id: string): KindEntry | undefined {
    return KIND_BY_ID.get(id);
}

/** The catalog environment a Grid environment name maps to (GRID_ENVIRONMENTS keys). */
export function catalogEnvironment(gridEnvironmentName: string): CatalogEnvironment {
    if (gridEnvironmentName === 'Moon') return 'moon';
    if (gridEnvironmentName === 'Mars') return 'mars';
    return 'earth_orbit';
}

export type CatalogEntryType = 'material' | 'finish' | 'shell_element' | 'kind' | 'algorithm' | 'starter_set';

/** One row of civic_catalog_entries. */
export interface CatalogEntry {
    /** core:<id> for Tier 0 (starter sets: core:starter_set:<structure>). */
    readonly entryId: string;
    readonly tier: 0 | 1 | 2;
    readonly type: CatalogEntryType;
    readonly version: string;
    readonly level: 'new' | 'proven' | 'standard' | 'retired';
    readonly body: unknown;
    /** sha256 of the body as canonical JSON (sorted keys). */
    readonly bodyHash: string;
}

/** JSON with object keys sorted at every depth, so a body has one hash. */
export function canonicalJson(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
    if (v !== null && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined)
            .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
    }
    return JSON.stringify(v);
}

const entry = (type: CatalogEntryType, id: string, body: unknown): CatalogEntry => ({
    entryId: `core:${id}`,
    tier: 0,
    type,
    version: GENESIS_CATALOG_VERSION,
    level: 'standard',
    body,
    bodyHash: createHash('sha256').update(canonicalJson(body)).digest('hex'),
});

/**
 * The Tier 0 rows a Grid in this environment is initialized with. In-situ materials
 * appear only where they exist (sintered regolith on the Moon and Mars, sulfur
 * concrete on Mars); everything else is the same in every Grid.
 */
export function genesisCatalogEntries(environment: CatalogEnvironment): readonly CatalogEntry[] {
    return [
        ...MATERIALS.filter((m) => m.environments.includes(environment)).map((m) => entry('material', m.id, m)),
        ...FINISHES.map((x) => entry('finish', x.id, x)),
        ...SHELL_ELEMENTS.map((x) => entry('shell_element', x.id, x)),
        ...KINDS.map((x) => entry('kind', x.id, x)),
        ...ALGORITHMS.map((x) => entry('algorithm', x.id, x)),
        ...STARTER_SETS.map((x) => entry('starter_set', `starter_set:${x.structure}`, x)),
    ];
}
