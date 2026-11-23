/**
 * Catalog v2 default forms — the shape every Tier 0 furnishing kind has before
 * anyone designs one (Grid House Objects sheet §5 A and §15.3: "Form origin:
 * catalog template — works with no GPU and no service").
 *
 * One Form DSL document per kind (form-dsl.ts). These are deliberately plain:
 * a kind's meaning lives in the catalog, its look is free, and a Nous may draw a
 * thousand different desks that are all still a work_desk. The helpers below only
 * build data; the result is frozen and identical on every run.
 */
import type { FormDoc, FormMaterial, FormPart } from './form-dsl.js';

type V3 = readonly [number, number, number];

/** Millimetre rounding for computed sizes: 0.95 − 0.04 is 0.9099999999999999 in a double,
 *  and a database that prints it as 0.91 would change the body under its hash. */
const mm = (n: number): number => Math.round(n * 1000) / 1000;

const f = (finish: string, extra: Omit<FormMaterial, 'finish'> = {}): FormMaterial => ({ finish, ...extra });
const GLOW = '#46e0d0';
const WARM = '#ffcf7a';

/** A slab top on four legs. Overall size w × d × h. */
function onLegs(label: string, w: number, d: number, h: number, finish: string, extra: FormPart[] = []): FormDoc {
    const top = 0.04;
    const legH = mm(h - top);
    const z = mm(-(top / 2) - legH / 2);
    const leg = (x: number, y: number): FormPart => ({
        base: 'cyl', dims: [0.05, 0.05, legH], at: [x, y, z], material: f('brushed_metal'),
    });
    const ix = mm(w / 2 - 0.05);
    const iy = mm(d / 2 - 0.05);
    return {
        base: 'box', dims: [w, d, top], material: f(finish), label,
        parts: [leg(-ix, -iy), leg(ix, -iy), leg(-ix, iy), leg(ix, iy), ...extra],
    };
}

/** A screen standing on a top of height h (used on desks and terminals). */
const screenOn = (h: number, x = 0, y = 0, w = 0.5): FormPart => ({
    base: 'box', dims: [w, 0.03, 0.32], at: [x, y, mm(h / 2 + 0.16)], material: f('polymer_matte', { emissive: GLOW }),
});

/** A closed body standing on the deck: a cabinet, a counter, a rack. */
function block(label: string, dims: V3, finish: string, extra: FormPart[] = [], material: FormMaterial = f(finish)): FormDoc {
    return { base: 'box', dims, material, label, ...(extra.length > 0 ? { parts: extra } : {}) };
}

/** A flat thing on a wall: a board, a frame, a mirror. w wide, h high. */
function onWall(label: string, w: number, h: number, finish: string, emissive?: string): FormDoc {
    return { base: 'box', dims: [w, 0.04, h], material: f(finish, emissive ? { emissive } : {}), label };
}

const FORMS: Record<string, FormDoc> = {
    // ── living (mirror) ─────────────────────────────────────────────────────────
    bed: block('Bed', [1.0, 2.0, 0.45], 'wood_dark', [
        { base: 'box', dims: [0.96, 1.9, 0.12], at: [0, 0, 0.285], material: f('fabric_weave') },
        { base: 'box', dims: [1.0, 0.06, 0.5], at: [0, -0.97, 0.25], material: f('wood_dark') },
    ]),
    closet: block('Closet', [1.0, 0.6, 2.0], 'wood_light', [
        { base: 'box', dims: [0.02, 0.02, 0.3], at: [0.05, 0.31, 0.1], material: f('brushed_metal') },
    ]),
    shelf: block('Shelf', [1.2, 0.3, 0.04], 'wood_light', [
        { base: 'box', dims: [1.2, 0.3, 0.04], at: [0, 0, 0.4], material: f('wood_light') },
    ]),
    kitchen: block('Kitchen', [2.0, 0.6, 0.9], 'polymer_matte', [
        { base: 'box', dims: [2.0, 0.62, 0.04], at: [0, 0, 0.47], material: f('stone') },
        { base: 'box', dims: [0.5, 0.4, 0.02], at: [0.5, 0, 0.5], material: f('brushed_metal') },
    ]),
    bathroom: block('Bathroom', [1.6, 0.8, 0.6], 'ceramic', [
        { base: 'box', dims: [0.5, 0.4, 0.8], at: [0.5, 0, 0.7], material: f('glass_frosted') },
    ]),
    decor: { base: 'icosa', dims: [0.3, 0.3, 0.3], material: f('ceramic'), label: 'Decor' },
    table: onLegs('Table', 1.2, 0.8, 0.75, 'wood_light'),
    chair: block('Chair', [0.45, 0.45, 0.45], 'wood_dark', [
        { base: 'box', dims: [0.45, 0.04, 0.45], at: [0, -0.205, 0.45], material: f('wood_dark') },
    ]),
    sofa: block('Sofa', [2.0, 0.9, 0.45], 'fabric_weave', [
        { base: 'box', dims: [2.0, 0.2, 0.4], at: [0, -0.35, 0.425], material: f('fabric_weave') },
        { base: 'box', dims: [0.2, 0.9, 0.2], at: [-0.9, 0, 0.325], material: f('fabric_weave') },
        { base: 'box', dims: [0.2, 0.9, 0.2], at: [0.9, 0, 0.325], material: f('fabric_weave') },
    ]),
    lamp: { base: 'cyl', dims: [0.15, 0.15, 0.02], material: f('brushed_metal'), label: 'Lamp', parts: [
        { base: 'cyl', dims: [0.02, 0.02, 0.4], at: [0, 0, 0.21] },
        { base: 'sphere', dims: [0.22, 0.22, 0.22], at: [0, 0, 0.5], material: f('glass_frosted', { emissive: WARM }) },
    ] },
    rug: block('Rug', [2.0, 1.4, 0.01], 'fabric_weave'),
    plant: { base: 'cyl', dims: [0.25, 0.25, 0.25], material: f('ceramic'), label: 'Plant', parts: [
        { base: 'icosa', dims: [0.4, 0.4, 0.4], at: [0, 0, 0.32], material: f('living_green') },
    ] },
    art_frame: onWall('Art frame', 0.8, 0.6, 'wood_dark'),
    wall_mirror: onWall('Wall mirror', 0.6, 1.2, 'glass_clear'),
    curtain: onWall('Curtain', 1.4, 2.0, 'fabric_weave'),
    clock_face: { base: 'cyl', dims: [0.35, 0.04, 0.35], material: f('ceramic'), label: 'Clock face' },
    hearth: block('Hearth', [1.2, 0.4, 0.9], 'stone', [
        { base: 'box', dims: [0.7, 0.05, 0.4], at: [0, 0.18, -0.15], material: f('stone', { emissive: '#ff7a3d' }) },
    ]),
    aquarium: block('Aquarium', [1.2, 0.45, 0.6], 'glass_clear', [
        { base: 'box', dims: [1.2, 0.45, 0.6], at: [0, 0, -0.6], material: f('wood_dark') },
    ]),

    // ── work and craft ──────────────────────────────────────────────────────────
    work_desk: onLegs('Work desk', 1.2, 0.6, 0.75, 'wood_dark', [screenOn(0.04, 0.2, 0.1, 0.4)]),
    task_board: onWall('Task board', 1.2, 0.8, 'paper'),
    sim_board: onWall('Simulation board', 1.4, 0.9, 'polymer_matte', GLOW),
    skill_terminal: block('Skill terminal', [0.6, 0.5, 1.1], 'polymer_matte', [screenOn(1.1, 0, 0.1)]),
    workbench: onLegs('Workbench', 1.8, 0.8, 0.9, 'wood_light', [
        { base: 'box', dims: [1.6, 0.05, 0.6], at: [0, 0.37, 0.32], material: f('brushed_metal') },
    ]),
    drafting_table: onLegs('Drafting table', 1.2, 0.9, 0.95, 'paper'),
    fabricator: block('Fabricator', [0.9, 0.8, 1.2], 'brushed_metal', [
        { base: 'box', dims: [0.6, 0.02, 0.5], at: [0, 0.41, 0.1], material: f('glass_clear', { emissive: GLOW }) },
    ]),
    code_bench: onLegs('Code bench', 1.4, 0.7, 0.75, 'polymer_matte', [
        screenOn(0.04, -0.3, 0.15, 0.5), screenOn(0.04, 0.3, 0.15, 0.5),
    ]),
    scheduler: block('Scheduler', [0.4, 0.3, 0.3], 'polymer_matte', [
        { base: 'cyl', dims: [0.25, 0.02, 0.25], at: [0, 0.16, 0], material: f('ceramic', { emissive: GLOW }) },
    ]),

    // ── knowledge ───────────────────────────────────────────────────────────────
    bookshelf: block('Bookshelf', [1.0, 0.35, 1.8], 'wood_dark', [
        { base: 'box', dims: [0.9, 0.25, 0.25], at: [0, 0.03, 0.45], material: f('paper') },
        { base: 'box', dims: [0.9, 0.25, 0.25], at: [0, 0.03, -0.15], material: f('paper') },
    ]),
    wiki_desk: onLegs('Wiki desk', 1.2, 0.6, 0.75, 'wood_light', [screenOn(0.04, 0, 0.1)]),
    memory_cabinet: block('Memory cabinet', [0.8, 0.5, 1.4], 'brushed_metal', [
        { base: 'box', dims: [0.6, 0.02, 0.1], at: [0, 0.26, 0.4], material: f('polymer_matte', { emissive: GLOW }) },
    ]),
    research_terminal: block('Research terminal', [0.7, 0.5, 1.1], 'polymer_matte', [screenOn(1.1, 0, 0.1, 0.6)]),
    notebook_stand: block('Notebook stand', [0.5, 0.4, 1.0], 'wood_light', [
        { base: 'box', dims: [0.45, 0.3, 0.03], at: [0, 0, 0.515], material: f('paper') },
    ]),
    lectern: block('Lectern', [0.6, 0.45, 1.1], 'wood_dark', [
        { base: 'box', dims: [0.6, 0.45, 0.04], at: [0, 0, 0.57], material: f('wood_dark') },
    ]),

    // ── money and commerce ──────────────────────────────────────────────────────
    shop_counter: block('Shop counter', [2.0, 0.6, 1.0], 'wood_dark', [
        { base: 'box', dims: [2.0, 0.62, 0.04], at: [0, 0, 0.52], material: f('stone') },
    ]),
    link_box: block('Link box', [0.5, 0.4, 0.35], 'brushed_metal', [
        { base: 'box', dims: [0.1, 0.02, 0.06], at: [0, 0.21, 0.05], material: f('polymer_matte', { emissive: GLOW }) },
    ]),
    display_case: block('Display case', [1.2, 0.5, 1.0], 'glass_clear', [
        { base: 'box', dims: [1.2, 0.5, 0.6], at: [0, 0, -0.8], material: f('wood_dark') },
    ]),
    contract_desk: onLegs('Contract desk', 1.4, 0.7, 0.75, 'wood_dark', [
        { base: 'box', dims: [0.3, 0.21, 0.01], at: [0, 0, 0.025], material: f('paper') },
    ]),
    rfp_board: onWall('Call-for-bids board', 1.2, 0.9, 'paper'),
    dues_terminal: block('Dues terminal', [0.5, 0.4, 1.2], 'polymer_matte', [screenOn(1.2, 0, 0.05, 0.4)]),
    approval_tray: block('Approval tray', [0.4, 0.3, 0.06], 'brushed_metal', [
        { base: 'box', dims: [0.3, 0.21, 0.01], at: [0, 0, 0.035], material: f('paper') },
    ]),

    // ── social and hosting ──────────────────────────────────────────────────────
    meeting_table: onLegs('Meeting table', 2.4, 1.2, 0.75, 'wood_light'),
    game_table: onLegs('Game table', 1.0, 1.0, 0.75, 'wood_dark', [
        { base: 'box', dims: [0.6, 0.6, 0.01], at: [0, 0, 0.025], material: f('fabric_weave') },
    ]),
    guestbook: block('Guestbook', [0.3, 0.22, 0.04], 'leather'),
    mailbox: block('Mailbox', [0.35, 0.25, 0.3], 'brushed_metal', [
        { base: 'box', dims: [0.2, 0.02, 0.02], at: [0, 0.135, 0.08], material: f('polymer_matte') },
    ]),
    whisper_booth: block('Whisper booth', [1.0, 1.0, 2.1], 'glass_frosted', [], f('glass_frosted', { roughness: 0.9 })),
    reception_desk: block('Reception desk', [1.8, 0.7, 1.05], 'wood_light', [screenOn(1.05, 0.5, 0, 0.4)]),
    notice_board: onWall('Notice board', 1.0, 0.8, 'paper'),
    stage: block('Stage', [3.0, 2.0, 0.3], 'wood_dark'),

    // ── civic and mind ──────────────────────────────────────────────────────────
    civic_terminal: block('Civic terminal', [0.6, 0.5, 1.2], 'stone', [screenOn(1.2, 0, 0.05)]),
    telos_board: onWall('Goal board', 1.0, 0.7, 'polymer_matte', GLOW),
    deed_journal: block('Deed journal', [0.3, 0.22, 0.05], 'leather'),
    observatory: { base: 'sphere', dims: [1.2, 1.2, 1.2], material: f('glass_clear'), label: 'Observatory', parts: [
        { base: 'cyl', dims: [1.3, 1.3, 0.2], at: [0, 0, -0.6], material: f('brushed_metal') },
    ] },
    synthesis_table: onLegs('Synthesis table', 1.6, 1.0, 0.75, 'polymer_matte', [
        { base: 'octa', dims: [0.3, 0.3, 0.3], at: [0, 0, 0.17], material: f('glass_clear', { emissive: GLOW }) },
    ]),
    compute_rack: block('Compute rack', [0.6, 1.0, 2.0], 'polymer_matte', [
        { base: 'box', dims: [0.5, 0.02, 1.6], at: [0, 0.51, 0], material: f('polymer_matte', { emissive: GLOW }) },
    ]),

    // ── utilities ───────────────────────────────────────────────────────────────
    power_node: block('Power node', [0.6, 0.4, 1.0], 'brushed_metal', [
        { base: 'cyl', dims: [0.1, 0.02, 0.1], at: [0, 0.21, 0.3], material: f('polymer_matte', { emissive: WARM }) },
    ]),
    radiator_unit: block('Radiator unit', [1.5, 0.1, 1.0], 'polymer_matte'),
    comms_antenna: { base: 'cyl', dims: [0.08, 0.08, 1.2], material: f('brushed_metal'), label: 'Comms antenna', parts: [
        { base: 'sphere', dims: [0.5, 0.5, 0.2], at: [0, 0, 0.6], material: f('polymer_matte') },
    ] },
    storage_locker: block('Storage locker', [0.6, 0.6, 1.8], 'brushed_metal'),
    app_terminal: block('App terminal', [0.6, 0.5, 1.2], 'polymer_matte', [screenOn(1.2, 0, 0.05)]),
};

/** The default form of every Tier 0 kind, keyed by kind id. */
export const GENESIS_DEFAULT_FORMS: Readonly<Record<string, FormDoc>> = Object.freeze(FORMS);
