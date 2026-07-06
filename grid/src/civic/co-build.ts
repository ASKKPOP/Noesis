/**
 * Phase 61 HOUSE-4 (A5 DAG-weighted attribution / arXiv:2503.03505 / D-61-03 / D-NH-06 / R-61-05)
 * — co-build DAG sessions.
 *
 * A build decomposes into atomic sub-tasks: the recipe `arrangement` is a DAG, each node =
 * one or more catalog objects + dependency edges + a weight. A co-build session reuses the
 * Phase 60 co-work board (cowork.ts postTask/claimTask) — each claimed sub-task is a board
 * task carrying pay. Completion ALWAYS settles (D-NH-06): Ousia via transferWei when funded,
 * else a Phase 60 mutual-credit IOU (credit-ledger.recordIou) — NEVER free; a sub-task that
 * would pay NOTHING throws `cobuild_must_pay`.
 *
 * Attribution is DAG-WEIGHTED (A5 contribution split): a participant's share =
 * Σ(completed-node weights claimed by them) ÷ Σ(all-node weights) — computed Grid-side from
 * metered completion, objective, not renegotiated. On FULL completion the build executor
 * (blueprint.ts) applies the assembled recipe + emits the single skill.blueprint_executed.
 *
 * Sub-task settlement reuses the Phase 60 `zoning.cowork_session` event + the IOU/Ousia path
 * — NO new allowlist event for sub-tasks. Request-driven — no clock.onTick (single-onTick).
 */

import type { BlueprintNode, BlueprintRecipe } from './blueprint.js';
import { postTask, claimTask } from './cowork.js';
import { recordIou } from './credit-ledger.js';

/** A co-build session: the sub-task DAG + completion + claim bookkeeping (Grid-side). */
export interface CoBuildSession {
    session_id: string;
    parcel_id: string;
    blueprint_hash: string;
    /** Host (parcel owner) — the debtor when a sub-task settles via an IOU. */
    host_did: string;
    nodes: BlueprintNode[];
    /** Completed node_ids. */
    completed: Set<string>;
    /** node_id → worker_did (the Nous credited with the node weight on completion). */
    claims: Map<string, string>;
}

/** The settlement record a completed sub-task returns (Ousia move OR a recorded IOU). */
export interface SubTaskSettlement {
    settlement: 'wei' | 'iou';
    node_id: string;
    worker_did: string;
    amount_wei: number;
}

/** Deps for a sub-task settlement — defaults wire the real ledger + a no-op Ousia seam. */
export interface CoBuildDeps {
    /** True when the host can settle in Ousia NOW; false → record an IOU instead. */
    funded?: boolean;
    /** Explicit pay override; defaults to the node weight. A pay of 0 throws cobuild_must_pay. */
    pay?: number;
    tick?: number;
    /** Move Ousia host → worker (registry.transferWei). Defaults to a no-op spy seam. */
    transferWei?: (from: string, to: string, amount: number) => void;
    /** Record the IOU when unfunded (credit-ledger.recordIou). Defaults to the real ledger. */
    recordIou?: (creditor: string, debtor: string, amount: number, reasonRef: string, tick: number) => void;
}

/** Module-level session store (Grid-side). DB-first persistence is out of this wave's scope. */
const sessions = new Map<string, CoBuildSession>();
let seq = 0;

/** Reset the session store (test isolation helper — production never calls this). */
export function _resetCoBuild(): void {
    sessions.clear();
    seq = 0;
}

/**
 * Decompose a recipe into atomic sub-tasks: the recipe `arrangement` DAG nodes (each =
 * catalog object(s) + `depends_on` edges + `weight`). The DAG is returned verbatim; a node
 * is claimable/completable only when its `depends_on` are all completed (enforced at
 * completeNode time). No mutation — the recipe arrangement IS the sub-task DAG.
 */
export function decomposeRecipe(recipe: BlueprintRecipe): BlueprintNode[] {
    return recipe.arrangement.map((n) => ({
        node_id: n.node_id,
        objects: n.objects.map((o) => ({ ...o })),
        depends_on: [...n.depends_on],
        weight: n.weight,
    }));
}

/** Create a co-build session from a decomposed DAG. host_did defaults to a session-scoped host. */
export function createCoBuildSession(input: {
    parcel_id: string;
    blueprint_hash: string;
    nodes: BlueprintNode[];
    host_did?: string;
}): CoBuildSession {
    const session: CoBuildSession = {
        session_id: `cobuild:${seq++}`,
        parcel_id: input.parcel_id,
        blueprint_hash: input.blueprint_hash,
        host_did: input.host_did ?? `${input.parcel_id}:host`,
        nodes: input.nodes,
        completed: new Set<string>(),
        claims: new Map<string, string>(),
    };
    sessions.set(session.session_id, session);
    return session;
}

/** Look up a node in the session DAG (throws on an unknown node_id). */
function nodeOf(session: CoBuildSession, node_id: string): BlueprintNode {
    const node = session.nodes.find((n) => n.node_id === node_id);
    if (!node) throw new Error(`cobuild_node_not_found: ${node_id}`);
    return node;
}

/** True iff every `depends_on` of the node is already completed (dependency edges respected). */
function depsMet(session: CoBuildSession, node: BlueprintNode): boolean {
    return node.depends_on.every((d) => session.completed.has(d));
}

/**
 * Claim a sub-task: post + claim it as a Phase 60 co-work board task (reuse cowork postTask/
 * claimTask) carrying the node's pay. Rejects claiming a node whose `depends_on` are unmet.
 * Records the claim (node_id → worker) so attribution credits the worker on completion.
 */
export function claimSubTask(
    session: CoBuildSession,
    node_id: string,
    workerDid: string,
    deps: CoBuildDeps = {},
): void {
    const node = nodeOf(session, node_id);
    if (!depsMet(session, node)) {
        throw new Error(`cobuild_deps_unmet: ${node_id} depends_on ${JSON.stringify(node.depends_on)} not yet completed`);
    }
    const pay = deps.pay ?? node.weight;
    // Each sub-task is a Phase 60 board task carrying pay (reuse the cowork board verbatim).
    const posted = postTask({
        parcel_id: session.parcel_id,
        parties: [session.host_did, workerDid],
        scope_ref: `cobuild:${session.session_id}:${node_id}`,
        settlement_amount_wei: pay,
        term_ticks: 0,
    });
    claimTask(posted.agreement_id, workerDid);
    session.claims.set(node_id, workerDid);
}

/**
 * Complete a sub-task. **ALWAYS settles (D-NH-06):** transferWei(host → worker) when funded,
 * else recordIou(worker=creditor, host=debtor, amount, session_id, tick). A completion that
 * would pay NOTHING throws `cobuild_must_pay` (never free). Rejects completing a node whose
 * `depends_on` are unmet (dependency edges respected). Marks the node completed + credits the
 * worker for the node weight (attributionShare).
 */
export function completeSubTask(
    session: CoBuildSession,
    node_id: string,
    workerDid: string,
    deps: CoBuildDeps = {},
): SubTaskSettlement {
    const node = nodeOf(session, node_id);
    if (!depsMet(session, node)) {
        throw new Error(`cobuild_deps_unmet: ${node_id} depends_on ${JSON.stringify(node.depends_on)} not yet completed`);
    }
    const amount = deps.pay ?? node.weight;
    // D-NH-06: ALWAYS settle — a pay-nothing completion is forbidden (never free).
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('cobuild_must_pay: a completed co-build sub-task is never free (D-NH-06)');
    }
    const tick = deps.tick ?? 0;
    let settlement: 'wei' | 'iou';
    if (deps.funded) {
        // Ousia-moving settlement rides the existing transfer path (host → worker).
        (deps.transferWei ?? (() => {}))(session.host_did, workerDid, amount);
        settlement = 'wei';
    } else {
        // Unfunded → record a Phase 60 IOU: worker is the creditor (owed), host the debtor.
        (deps.recordIou ?? recordIou)(workerDid, session.host_did, amount, session.session_id, tick);
        settlement = 'iou';
    }
    session.claims.set(node_id, workerDid);
    session.completed.add(node_id);
    return { settlement, node_id, worker_did: workerDid, amount_wei: amount };
}

/**
 * Complete a node (test-facing alias). Same contract as completeSubTask — the worker is
 * credited for the node weight + the sub-task settles (Ousia or IOU, never free).
 */
export const completeNode = completeSubTask;

/**
 * DAG-weighted attribution (A5): a participant's share =
 *   Σ(completed-node weights claimed by `did`) ÷ Σ(all-node weights).
 * Computed Grid-side from metered completion — objective, not renegotiated. Returns 0 when
 * the total weight is 0 (an empty DAG).
 */
export function attributionShare(session: CoBuildSession, did: string): number {
    const total = session.nodes.reduce((sum, n) => sum + n.weight, 0);
    if (total <= 0) return 0;
    const earned = session.nodes
        .filter((n) => session.completed.has(n.node_id) && session.claims.get(n.node_id) === did)
        .reduce((sum, n) => sum + n.weight, 0);
    return earned / total;
}

/** True iff every node in the DAG is completed (the executor then assembles + emits once). */
export function isComplete(session: CoBuildSession): boolean {
    return session.nodes.every((n) => session.completed.has(n.node_id));
}

/**
 * The set of Nous in an active co-build session for a parcel who are eligible to build on its
 * behalf (the build executor's co-build authorization read). A worker who has claimed any
 * sub-task in an in-progress session for `addr` is co-build staff for that parcel.
 */
export function coBuildStaffOf(addr: string, did: string): boolean {
    for (const session of sessions.values()) {
        if (session.parcel_id !== addr || isComplete(session)) continue;
        for (const worker of session.claims.values()) {
            if (worker === did) return true;
        }
    }
    return false;
}
