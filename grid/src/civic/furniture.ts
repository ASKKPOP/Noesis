/**
 * Phase 59 HOUSE-2 (NH2-02 / D-59-04 / R-59-02) — the furniture catalog, now read
 * from the Genesis catalog v2 (genesis-catalog.ts).
 *
 * The closed catalog of furniture kinds a Nous may place inside a structure
 * interior (D-NH-02). Two classes:
 *
 *   - mirror     render-only, near-zero cost, valid ONLY in the owner's own home
 *                (bed, table, lamp, ...). No affordances.
 *   - functional declares affordances usable per role (work_desk, task_board,
 *                shop_counter, ...). Valid in any structure it fits.
 *
 * `isValidFurniture(kind, structureType)` is the SINGLE validation point — the
 * registry (extendInterior) and the Wave 2 route both call THIS and nothing else.
 * Affordance EXECUTION (working a task_board, billing at a work_desk) is HOUSE-3;
 * Phase 59 only models the affordance DECLARATIONS.
 */

import { KINDS } from './genesis-catalog.js';

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
 * FURNITURE_CATALOG — the placeable kinds of the Genesis catalog (genesis-catalog.ts).
 *
 * v1 froze 13 kinds here (6 mirror + 7 functional). Catalog v2 seeds 59 Tier 0 kinds;
 * this map holds the ones a Nous may place today, so every reader of this constant
 * (the extend route, the registry, the blueprint validator) reads the new catalog.
 * The 13 v1 kinds are unchanged: same class, same affordances. Runtime mutation throws.
 */
export const FURNITURE_CATALOG: Readonly<Record<string, FurnitureEntry>> = Object.freeze(
    Object.fromEntries(
        KINDS.filter((k) => k.placeable).map((k) => [
            k.id,
            Object.freeze({ kind: k.id, class: k.class, affordances: k.affordances }),
        ]),
    ),
);

/**
 * The SINGLE furniture-validation gate (reused by ParcelRegistry.extendInterior and
 * the Wave 2 route). Returns:
 *   - false for an unknown kind;
 *   - for a mirror kind: true ONLY when structureType === 'home' (mirror-only-in-home);
 *   - for a functional kind: true in any structure (a home may host a functional desk).
 */
export function isValidFurniture(kind: string, structureType: string): boolean {
    // Own keys only: 'constructor' or 'toString' is not a kind (the map has a prototype).
    if (!Object.hasOwn(FURNITURE_CATALOG, kind)) return false;
    const entry = FURNITURE_CATALOG[kind];
    if (entry.class === 'mirror') return structureType === 'home';
    return true;
}
