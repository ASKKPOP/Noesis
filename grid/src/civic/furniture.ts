/**
 * Phase 59 HOUSE-2 (NH2-02 / D-59-04 / R-59-02) — closed v1 furniture catalog.
 *
 * The frozen, closed v1 catalog of furniture kinds a Nous may place inside a
 * structure interior (D-NH-02). Two classes:
 *
 *   - mirror     render-only, near-zero cost, valid ONLY in the owner's own home
 *                (bed, closet, shelf, kitchen, bathroom, decor). No affordances.
 *   - functional declares affordances usable per role (work_desk, sim_board,
 *                meeting_table, game_table, task_board, skill_terminal,
 *                shop_counter). Valid in any structure it fits.
 *
 * `isValidFurniture(kind, structureType)` is the SINGLE validation point — the
 * registry (extendInterior) and the Wave 2 route both call THIS and nothing else.
 * Affordance EXECUTION (working a task_board, billing at a work_desk) is HOUSE-3;
 * Phase 59 only models the affordance DECLARATIONS.
 */

/** The closed class union for catalog entries. */
export type FurnitureClass = 'mirror' | 'functional';

/** A single catalog entry. `kind` always equals its key in FURNITURE_CATALOG. */
export interface FurnitureEntry {
    readonly kind: string;
    readonly class: FurnitureClass;
    /** Affordances declared by functional furniture; mirror furniture has none. */
    readonly affordances: readonly string[];
}

/**
 * FURNITURE_CATALOG — frozen closed v1: exactly 6 mirror + 7 functional = 13 kinds.
 * New kinds are a later phase; runtime mutation throws (Object.freeze).
 */
export const FURNITURE_CATALOG: Readonly<Record<string, FurnitureEntry>> = Object.freeze({
    // ── mirror (render-only, home-only) ────────────────────────────────────────
    bed:      Object.freeze({ kind: 'bed',      class: 'mirror', affordances: Object.freeze([]) }),
    closet:   Object.freeze({ kind: 'closet',   class: 'mirror', affordances: Object.freeze([]) }),
    shelf:    Object.freeze({ kind: 'shelf',    class: 'mirror', affordances: Object.freeze([]) }),
    kitchen:  Object.freeze({ kind: 'kitchen',  class: 'mirror', affordances: Object.freeze([]) }),
    bathroom: Object.freeze({ kind: 'bathroom', class: 'mirror', affordances: Object.freeze([]) }),
    decor:    Object.freeze({ kind: 'decor',    class: 'mirror', affordances: Object.freeze([]) }),
    // ── functional (declares affordances) ──────────────────────────────────────
    work_desk:      Object.freeze({ kind: 'work_desk',      class: 'functional', affordances: Object.freeze(['billing', 'accounting']) }),
    sim_board:      Object.freeze({ kind: 'sim_board',      class: 'functional', affordances: Object.freeze(['simulation']) }),
    meeting_table:  Object.freeze({ kind: 'meeting_table',  class: 'functional', affordances: Object.freeze(['meeting']) }),
    game_table:     Object.freeze({ kind: 'game_table',     class: 'functional', affordances: Object.freeze(['play']) }),
    task_board:     Object.freeze({ kind: 'task_board',     class: 'functional', affordances: Object.freeze(['task_tracking']) }),
    skill_terminal: Object.freeze({ kind: 'skill_terminal', class: 'functional', affordances: Object.freeze(['skill_practice']) }),
    shop_counter:   Object.freeze({ kind: 'shop_counter',   class: 'functional', affordances: Object.freeze(['sales']) }),
});

/**
 * The SINGLE furniture-validation gate (reused by ParcelRegistry.extendInterior and
 * the Wave 2 route). Returns:
 *   - false for an unknown kind;
 *   - for a mirror kind: true ONLY when structureType === 'home' (mirror-only-in-home);
 *   - for a functional kind: true in any structure (a home may host a functional desk).
 */
export function isValidFurniture(kind: string, structureType: string): boolean {
    const entry = FURNITURE_CATALOG[kind];
    if (entry === undefined) return false;
    if (entry.class === 'mirror') return structureType === 'home';
    return true;
}
