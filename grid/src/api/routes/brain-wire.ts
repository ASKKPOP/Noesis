/**
 * Phase 38 WIRE-01 / WIRE-02 — Brain → Grid action dispatch route.
 *
 * POST /api/v1/brain/actions
 *
 * Auth: civic_did_required (policy table entry; enforced by global onRequest hook).
 * The JWT subject is a Civic-DID; the issuer is the existence-DID (Brain DID).
 * Both are verified in tryDid before this handler is reached.
 *
 * Dispatch path: NousRunner.executeActions() — the SOLE emitter of audit events
 * per R-31-01 (zero-diff invariant). Do NOT call audit.append directly here.
 *
 * Body: { tick: number, actions: BrainAction[] }
 *   - tick: integer ≥ 0
 *   - actions: array (max 500 per Pitfall 3 — DoS protection)
 *
 * Responses:
 *   200 { ok: true, accepted: number }       — dispatch succeeded
 *   400 { error: 'invalid_request' }         — malformed body
 *   401 { error: 'unauthorized' }            — no Civic-DID tier (defensive; policy should fire first)
 *   404 { error: 'nous_runner_not_found', civic_did }  — no active NousRunner for the Civic-DID
 *   413 { error: 'batch_too_large', max: 500 }         — actions.length > 500
 *   500 { error: 'dispatch_failed' }         — NousRunner.executeActions threw
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { BrainAction } from '../../integration/types.js';

const MAX_BATCH_SIZE = 500; // Pitfall 3: DoS protection

/** Minimal NousRunner surface consumed by the route (decoupled from full NousRunner). */
export interface WireRunner {
    executeActions(actions: BrainAction[], tick: number): Promise<void>;
}

/** Minimal coordinator surface consumed by the route. */
export interface WireCoordinator {
    getRunnerByCivicDid(civicDid: string): WireRunner | undefined;
}

export function registerBrainWireRoutes(
    app: FastifyInstance,
    services: GridServices & { coordinator?: WireCoordinator },
): void {
    // POST /api/v1/brain/actions
    app.post<{
        Body: { tick: unknown; actions: unknown };
    }>('/api/v1/brain/actions', async (req, reply) => {
        // Defensive: policy table enforces civic_did_required before this fires.
        const ctx = req.didContext;
        if (!ctx || ctx.tier !== 'civic_member') {
            return reply.code(401).send({ error: 'unauthorized' });
        }

        const civicDid = ctx.did;

        // Body validation
        const body = req.body as Record<string, unknown>;
        const tick = body['tick'];
        const actions = body['actions'];

        if (
            typeof tick !== 'number' ||
            !Number.isInteger(tick) ||
            tick < 0 ||
            !Array.isArray(actions)
        ) {
            return reply.code(400).send({ error: 'invalid_request' });
        }

        // Batch size cap (Pitfall 3 — DoS protection)
        if (actions.length > MAX_BATCH_SIZE) {
            return reply.code(413).send({ error: 'batch_too_large', max: MAX_BATCH_SIZE });
        }

        // Runner lookup by Civic-DID
        const coordinator = services.coordinator;
        if (!coordinator) {
            req.log.error({ event: 'brain_wire.no_coordinator', civic_did: civicDid }, 'coordinator not wired');
            return reply.code(503).send({ error: 'coordinator_unavailable' });
        }

        const runner = coordinator.getRunnerByCivicDid(civicDid);
        if (!runner) {
            return reply.code(404).send({ error: 'nous_runner_not_found', civic_did: civicDid });
        }

        // Dispatch through the sole-producer path (R-31-01 invariant)
        try {
            await runner.executeActions(actions as BrainAction[], tick);
        } catch (err) {
            req.log.error(
                { event: 'brain_wire.dispatch_failed', civic_did: civicDid, tick, reason: String(err) },
                'NousRunner.executeActions threw',
            );
            return reply.code(500).send({ error: 'dispatch_failed' });
        }

        return reply.code(200).send({ ok: true, accepted: actions.length });
    });
}
