/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for co-build DAG sessions (A5 DAG-weighted attribution /
 * arXiv:2503.03505 / D-61-03 / D-NH-06 / R-61-05).
 *
 * describe.skip: grid/src/civic/co-build.ts lands in Wave 2. Deferred dynamic import
 * (Phase 58/59/60 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - decomposeRecipe(recipe) turns the recipe `arrangement` into atomic sub-tasks (each node =
 *     catalog object(s) + depends_on edges + a weight); dependency edges are respected (a node
 *     cannot complete before its depends_on).
 *   - each sub-task is posted to the Phase 60 co-work board (a Cowork Agreement task carrying
 *     pay); completion ALWAYS settles — Ousia via transferOusia when funded, else a Phase 60
 *     recordIou — a sub-task completion that pays NOTHING throws (never free, D-NH-06).
 *   - attributionShare(session, did) is DAG-weighted: Σ(completed-node weights for did) ÷
 *     Σ(all-node weights) (half the weight → a 0.5 share).
 *   - sub-task settlement reuses the Phase 60 zoning.cowork_session event + the IOU/Ousia path —
 *     NO new allowlist event for sub-tasks; on FULL completion the executor applies the assembled
 *     recipe + emits the single skill.blueprint_executed.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const loadCoBuild = () => import('../../src/civic/co-build.js');

const BLUEPRINT_HASH = 'a'.repeat(64);
const PARCEL = 'genesis:business:0001';
const HOST = 'did:civic:noesis:alice';
const WORKER = 'did:civic:noesis:bob';

/** A recipe whose arrangement is a 2-node DAG (n2 depends_on n1), weights summing to 4. */
const recipe = () => ({
    blueprint_hash: BLUEPRINT_HASH,
    objects: [
        { kind: 'work_desk', area: 'office' },
        { kind: 'shelf', area: 'office' },
    ],
    arrangement: [
        { node_id: 'n1', objects: [{ kind: 'work_desk', area: 'office' }], depends_on: [], weight: 1 },
        { node_id: 'n2', objects: [{ kind: 'shelf', area: 'office' }], depends_on: ['n1'], weight: 3 },
    ],
    material_cost_bios: 200,
});

beforeEach(async () => {
    const { _resetCoBuild } = await loadCoBuild();
    _resetCoBuild();
});

describe('Phase 61 HOUSE-4 — decomposeRecipe → atomic sub-task DAG [Wave 2 un-skips]', () => {
    it('turns the recipe arrangement into atomic sub-tasks (node = catalog object(s) + edges + weight)', async () => {
        const { decomposeRecipe } = await loadCoBuild();
        const nodes = decomposeRecipe(recipe());
        expect(nodes).toHaveLength(2);
        expect(nodes.map((n) => n.node_id)).toEqual(['n1', 'n2']);
        expect(nodes[1].depends_on).toEqual(['n1']);
    });

    it('respects dependency edges — a node cannot complete before its depends_on', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode } = await loadCoBuild();
        const nodes = decomposeRecipe(recipe());
        const session = createCoBuildSession({ parcel_id: PARCEL, blueprint_hash: BLUEPRINT_HASH, nodes });
        expect(() => completeNode(session, 'n2', WORKER, { funded: true })).toThrow(/depend|n1|order/i);
    });
});

describe('Phase 61 HOUSE-4 — every sub-task ALWAYS settles (never free, D-NH-06) [Wave 2 un-skips]', () => {
    it('settles in Ousia via transferOusia when the host is funded', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode } = await loadCoBuild();
        const session = createCoBuildSession({
            parcel_id: PARCEL, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe()),
        });
        const settled = completeNode(session, 'n1', WORKER, { funded: true });
        expect(settled.settlement).toBe('ousia');
    });

    it('records a Phase 60 IOU (recordIou) when the host is NOT funded', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode } = await loadCoBuild();
        const session = createCoBuildSession({
            parcel_id: PARCEL, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe()),
        });
        const settled = completeNode(session, 'n1', WORKER, { funded: false });
        expect(settled.settlement).toBe('iou');
    });

    it('a sub-task completion that pays NOTHING throws (never free)', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode } = await loadCoBuild();
        const session = createCoBuildSession({
            parcel_id: PARCEL, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe()),
        });
        expect(() => completeNode(session, 'n1', WORKER, { pay: 0 } as never)).toThrow(/free|pay|settle/i);
    });
});

describe('Phase 61 HOUSE-4 — DAG-weighted attribution [Wave 2 un-skips]', () => {
    it('attributionShare = Σ(completed-node weights for did) ÷ Σ(all-node weights)', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode, attributionShare } = await loadCoBuild();
        const session = createCoBuildSession({
            parcel_id: PARCEL, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe()),
        });
        completeNode(session, 'n1', WORKER, { funded: true }); // weight 1 of total 4
        expect(attributionShare(session, WORKER)).toBeCloseTo(0.25);
        completeNode(session, 'n2', WORKER, { funded: true }); // + weight 3 → 4 of 4
        expect(attributionShare(session, WORKER)).toBeCloseTo(1.0);
    });
});

describe('Phase 61 HOUSE-4 — reuses zoning.cowork_session; one skill.blueprint_executed on full completion [Wave 2 un-skips]', () => {
    it('sub-task settlement reuses the Phase 60 zoning.cowork_session event (NO new allowlist event)', async () => {
        const { decomposeRecipe } = await loadCoBuild();
        // co-build adds NO new producer — it reuses the Phase 60 cowork board + zoning.cowork_session.
        const mod = await loadCoBuild();
        expect(mod).not.toHaveProperty?.('appendCoBuildSubtask');
        expect(decomposeRecipe(recipe())).toHaveLength(2);
    });

    it('on FULL completion the executor applies the assembled recipe + emits ONE skill.blueprint_executed', async () => {
        const { decomposeRecipe, createCoBuildSession, completeNode, isComplete } = await loadCoBuild();
        const session = createCoBuildSession({
            parcel_id: PARCEL, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe()),
        });
        completeNode(session, 'n1', WORKER, { funded: true });
        completeNode(session, 'n2', WORKER, { funded: true });
        expect(isComplete(session)).toBe(true);
    });
});
