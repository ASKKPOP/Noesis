/**
 * Phase 61 HOUSE-4 (NH4-02 / D-61-01 / D-61-02 / R-61-02 / R-61-03) — blueprint skills.
 *
 * A `blueprint_hash` IS a Phase 18 skill hash; it diffuses via the EXISTING
 * `skill.taught` / `skill.inferred` machinery (ZERO new diffusion code). The Grid-side
 * recipe BODY — {objects:[{kind, area}], arrangement (the sub-task DAG), material_cost_bios}
 * — lives in the civic_blueprints table (migration v41) keyed by blueprint_hash and is
 * mirrored into the in-memory cache below. Recipe kinds are restricted to the Phase 59
 * closed furniture catalog (furniture.ts); a non-catalog kind is rejected by the existing
 * gate. The civic_blueprints row write emits NO chain event (Grid-side recipe storage,
 * mirroring the Phase 58 world-creation discipline).
 *
 * builderHoldsSkill verifies a builder HOLDS a blueprint by reading the EXISTING
 * skill-event history (a skill.taught/skill.inferred with learner_did === builder for
 * blueprint_hash in the audit chain — the same lineage query culture.ts uses). The Brain
 * attests, the Grid confirms. No new skill store, no new event.
 */
import type { AuditEntry } from '../audit/types.js';
import { FURNITURE_CATALOG } from './furniture.js';

const HEX64 = /^[0-9a-f]{64}$/;

/** A single recipe object — `kind` MUST be a Phase 59 furniture-catalog kind. */
export interface BlueprintObject {
    kind: string;
    area: string;
}

/** An arrangement DAG node (sub-task) — used by co-build in Wave 2. */
export interface BlueprintNode {
    node_id: string;
    objects: BlueprintObject[];
    depends_on: string[];
    weight: number;
}

/** A blueprint recipe — the Grid-side body the build executor applies. */
export interface BlueprintRecipe {
    blueprint_hash: string;
    objects: BlueprintObject[];
    arrangement: BlueprintNode[];
    material_cost_bios: number;
}

/** In-memory recipe cache (hydrated on boot from civic_blueprints). */
const blueprints = new Map<string, BlueprintRecipe>();

/** Optional DB-first writer (Phase 58/59/60 write-through). storeBlueprint persists, then mirrors. */
export interface BlueprintStoreDeps {
    store: { persistBlueprint(recipe: BlueprintRecipe, tick: number): Promise<void> };
    tick: number;
}

/**
 * Validate a recipe: reject a non-HEX64 blueprint_hash and any object whose `kind` is not
 * in the Phase 59 closed furniture catalog (delegating to the EXISTING furniture gate —
 * NO new furniture kinds). Throws on rejection; returns void on success.
 */
export function validateRecipe(recipe: BlueprintRecipe): void {
    if (!HEX64.test(recipe.blueprint_hash)) {
        throw new Error('blueprint_hash_not_hex64');
    }
    // A recipe kind must be a member of the Phase 59 closed furniture catalog (a recipe is
    // a declarative arrangement of catalog kinds — mirror OR functional). Per-structure rules
    // (mirror-only-in-home via isValidFurniture) are applied by the build executor at
    // extendInterior time, not here — a recipe is structure-agnostic until it is built.
    const kinds = new Set<string>();
    for (const node of recipe.arrangement) {
        for (const o of node.objects) kinds.add(o.kind);
    }
    for (const o of recipe.objects) kinds.add(o.kind);
    for (const kind of kinds) {
        if (FURNITURE_CATALOG[kind] === undefined) {
            throw new Error('recipe_kind_not_in_catalog');
        }
    }
}

/**
 * Store a blueprint recipe: validate (throws synchronously on a bad kind / hash),
 * write-through DB-first when a store dep is given, then mirror into the in-memory cache.
 * Emits NOTHING on chain (Grid-side recipe storage). Validation runs synchronously so a
 * non-catalog kind rejects before any DB write; when no store dep is given the mirror is
 * synchronous (returns void), otherwise it returns the persist+mirror promise.
 */
export function storeBlueprint(recipe: BlueprintRecipe): void;
export function storeBlueprint(recipe: BlueprintRecipe, deps: BlueprintStoreDeps): Promise<void>;
export function storeBlueprint(recipe: BlueprintRecipe, deps?: BlueprintStoreDeps): void | Promise<void> {
    validateRecipe(recipe);
    if (deps) {
        return deps.store.persistBlueprint(recipe, deps.tick).then(() => {
            blueprints.set(recipe.blueprint_hash, recipe);
        });
    }
    blueprints.set(recipe.blueprint_hash, recipe);
}

/** Read a blueprint recipe from the in-memory cache (hydrated on boot). */
export function getBlueprint(blueprint_hash: string): BlueprintRecipe | null {
    return blueprints.get(blueprint_hash) ?? null;
}

/** The in-memory recipe cache (for hydrate-on-boot to populate). */
export function blueprintCache(): Map<string, BlueprintRecipe> {
    return blueprints;
}

/** Test helper — clear the in-memory recipe cache between cases. */
export function _resetBlueprints(): void {
    blueprints.clear();
}

/* ───────────────── skill-held verification (D-61-02 / R-61-03) ─────────────────
 * No new skill store: the check reads the EXISTING skill-event history (the audit
 * chain) — the same lineage surface culture.ts queries (audit.all() filtered to
 * skill.taught / skill.inferred). The Brain attests it learned the blueprint; the
 * Grid confirms a matching event exists.
 */

/** Deps for builderHoldsSkill — the existing chain-iteration surface culture.ts uses. */
export interface SkillHeldDeps {
    audit: { all(): AuditEntry[] };
}

/**
 * Return true iff a skill.taught OR skill.inferred audit entry exists with
 * payload.learner_did === builderDid AND payload.skill_hash === blueprint_hash (the
 * blueprint hash IS the skill hash). Mirrors the culture.ts lineage query. Returns
 * false when no such event exists (the build route maps this to skill_not_held).
 */
export function builderHoldsSkill(
    blueprint_hash: string,
    builderDid: string,
    deps: SkillHeldDeps,
): boolean {
    return deps.audit
        .all()
        .filter((e) => e.eventType === 'skill.taught' || e.eventType === 'skill.inferred')
        .some((e) => {
            const p = e.payload as { learner_did?: string; skill_hash?: string };
            return p.learner_did === builderDid && p.skill_hash === blueprint_hash;
        });
}
