/**
 * Phase 61 HOUSE-4 (NH4-02 / D-61-01 / D-61-02 / R-61-02 / R-61-03) — blueprint skills.
 *
 * A `blueprint_hash` IS a Phase 18 skill hash; it diffuses via the EXISTING
 * `skill.taught` / `skill.inferred` machinery (ZERO new diffusion code). The Grid-side
 * recipe BODY — {objects:[{kind, area}], arrangement (the sub-task DAG), material_cost_wei}
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
import { createHash } from 'node:crypto';
import type { AuditEntry } from '../audit/types.js';
import { FURNITURE_CATALOG } from './furniture.js';
import { isHumanDid } from './roles.js';
import type { ParcelRegistry } from './parcel-registry.js';
import type { Structure } from './types.js';

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * The Polis treasury DID that material_cost_wei is debited to (D-NH-03/05). Defined
 * locally so the civic blueprint executor never depends on the API routes layer — the
 * same string the registry / civic-parcels route use (`api/routes/registry.ts`).
 */
const TREASURY_DID = 'did:noesis:system:treasury';

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
    material_cost_wei: number;
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

/* ───────────────── build executor (A10 BUILD lifecycle / D-61-02 / R-61-04) ─────────────────
 * buildFromBlueprint is the SINGLE recipe-apply caller: it verifies skill-held, debits the
 * material cost to TREASURY_DID, then replays ParcelRegistry.extendInterior once per recipe
 * object (the interior tree mutation is Grid-side — no per-object chain event). The whole
 * build emits ONE skill.blueprint_executed via the injected emit SEAM (Wave 3 attaches the
 * real sole producer; this wave constructs the call site + the closed 4-tuple payload).
 */

/** sha256 hex — the HEX64 hashed-DID discipline the skill.* producers expect. */
function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

/** The closed skill.blueprint_executed payload (keys ALPHABETICAL) — Wave 3 emits it. */
export interface BlueprintExecutedPayload {
    blueprint_hash: string;
    builder_civic_did_hash: string;
    parcel_id: string;
    tick: number;
}

/**
 * Deps for buildFromBlueprint:
 *  - `registry` is the SINGLE recipe-apply surface (extendInterior + roleOf authorization).
 *  - `transferWei` moves the material cost builder → TREASURY_DID; `{success:false}` (the
 *     builder cannot cover it) maps to insufficient_funds (402).
 *  - `audit` is the existing skill-event history surface for the skill-held check.
 *  - `coBuildStaffOf?` is the co-build authorization read (a staff Nous in an active session
 *     for this parcel); absent ⇒ owner-only authorization.
 *  - `emitBlueprintExecuted?` is the Wave-3 emit SEAM — the executor constructs the payload
 *     and calls it; Wave 3 attaches the real sole producer.
 */
export interface BuildDeps {
    registry: ParcelRegistry;
    transferWei(from: string, to: string, amount: number): { success: boolean };
    audit: { all(): AuditEntry[] };
    /** True iff `did` is a staff Nous in an active co-build session for `addr` (co-build authz). */
    coBuildStaffOf?(addr: string, did: string): boolean;
    /**
     * The builder's EXISTENCE-DID (`did:noesis:nous:*`) for the skill-held check ONLY.
     * Skills are attested under the existence-DID (`skill.taught.learner_did`, nous-runner),
     * while land ownership / Ousia / the human check / the emitted `builder_civic_did_hash`
     * are keyed by the civic-DID (`builderDid`). For a Brain-signed request the route reads
     * this from `req.didContext.operatorDid` (= the JWT `iss`). Defaults to `builderDid` when
     * absent (e.g. tests/ES256 tokens where the two DID forms coincide).
     */
    skillHolderDid?: string;
    /** Wave-3 emit seam — the real sole producer attaches here. */
    emitBlueprintExecuted?(payload: BlueprintExecutedPayload): void;
}

/**
 * Execute a build from a held blueprint skill (D-61-02 / R-61-04):
 *   1. reject a human builder (VOTE-05 / D-NH-07) — builder_forbidden_human.
 *   2. authorize: the builder is the parcel owner OR a staff Nous in an active co-build
 *      session for this parcel; else not_authorized (403).
 *   3. getBlueprint → blueprint_not_found when absent.
 *   4. builderHoldsSkill (existing skill-event history) → skill_not_held when false.
 *   5. debit recipe.material_cost_wei builder → TREASURY_DID via transferWei; a failed
 *      transfer (cannot cover) → insufficient_funds (402).
 *   6. apply the recipe: extendInterior(addr, builderDid, {area, kind}) once per recipe
 *      object (the SINGLE caller; the interior mutation emits NO per-object chain event).
 *   7. construct the skill.blueprint_executed payload (hashed builder, no recipe body) and
 *      call the Wave-3 emit seam.
 *   8. return the updated Structure.
 */
export function buildFromBlueprint(
    addr: string,
    builderDid: string,
    blueprint_hash: string,
    tick: number,
    deps: BuildDeps,
): Structure {
    // 1. Humans NEVER build (VOTE-05 / D-NH-07).
    if (isHumanDid(builderDid)) {
        throw new Error(`builder_forbidden_human: ${builderDid} may not build`);
    }
    // 2. Authorize: owner OR staff Nous in an active co-build session for this parcel.
    const isOwner = deps.registry.roleOf(addr, builderDid) === 'owner';
    const isCoBuildStaff = deps.coBuildStaffOf?.(addr, builderDid) === true;
    if (!isOwner && !isCoBuildStaff) {
        throw new Error('not_authorized: builder is neither owner nor co-build staff (403)');
    }
    // 3. Resolve the recipe.
    const recipe = getBlueprint(blueprint_hash);
    if (!recipe) {
        throw new Error(`blueprint_not_found: ${blueprint_hash}`);
    }
    // 4. Confirm the builder HOLDS the skill (existing skill-event history; Brain attests).
    //    Skills are attested under the builder's EXISTENCE-DID (skill.taught.learner_did,
    //    nous-runner), while the route identifies the builder by its civic-DID. A Brain-signed
    //    request carries the existence identity as skillHolderDid (req.didContext.operatorDid =
    //    JWT iss). Match EITHER identity so the check works whichever namespace the skill landed
    //    in — without coupling to a single DID format.
    const skillIdentities = deps.skillHolderDid
        ? [builderDid, deps.skillHolderDid]
        : [builderDid];
    const holdsSkill = skillIdentities.some((did) =>
        builderHoldsSkill(blueprint_hash, did, { audit: deps.audit }),
    );
    if (!holdsSkill) {
        throw new Error(`skill_not_held: ${skillIdentities.join('/')} does not hold ${blueprint_hash}`);
    }
    // 5. Debit the material cost builder → TREASURY_DID (insufficient → 402).
    if (recipe.material_cost_wei > 0) {
        const moved = deps.transferWei(builderDid, TREASURY_DID, recipe.material_cost_wei);
        if (!moved.success) {
            throw new Error('insufficient_funds: builder cannot cover material_cost_wei (402)');
        }
    }
    // 6. Apply the recipe — the SINGLE recipe-apply caller; no per-object chain event.
    //    extendInterior mutates the OWNER's interior tree (a co-build staff builds on behalf
    //    of the owner), so resolve the parcel owner for the recipe-apply DID.
    const ownerDid = deps.registry.get(addr)?.ownerDid ?? builderDid;
    let structure: Structure | undefined;
    for (const object of recipe.objects) {
        structure = deps.registry.extendInterior(addr, ownerDid, {
            area: object.area,
            kind: object.kind,
        });
    }
    // 7. Construct the closed skill.blueprint_executed payload + call the Wave-3 emit seam.
    const payload: BlueprintExecutedPayload = {
        blueprint_hash,
        builder_civic_did_hash: sha256Hex(builderDid),
        parcel_id: addr,
        tick,
    };
    deps.emitBlueprintExecuted?.(payload);
    // 8. Return the updated structure. A recipe always carries ≥1 object (validated at store
    //    time), so `structure` is set after the loop; the fallback reads the existing structure.
    const existing = deps.registry.get(addr)?.structure;
    if (structure) return structure;
    if (existing) return existing;
    throw new Error('blueprint_empty_recipe: recipe applied no objects');
}
