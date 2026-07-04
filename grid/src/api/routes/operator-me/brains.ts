/**
 * Phase 39 — POST /api/v1/operator/me/brains
 * Claim ownership of a registered Brain-DID (D-39-01 two-step claim model).
 * Policy: portal_session_required (D-39-05).
 * Quota: DB-authoritative COUNT check (D-39-06). Atomic UPDATE WHERE IS NULL (anti-race).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../server.js';
import { operatorScope } from '../../preHandlers/operatorScope.js';
import { setOwner, countActiveByOperator } from '../../../operator/data/operator-brain-store.js';
import { getQuotaLimit } from '../../../operator/data/operator-quota-store.js';

// Standard nous: form + the three founding legacy DIDs (BLOCKER-01) so an operator
// can claim a founding Nous's Brain.
const BRAIN_DID_RE = /^did:noesis:(nous:[a-z0-9_\-]+|sophia|hermes|themis)$/i;

export async function registerOperatorMeBrainsRoute(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
    app.post<{ Body: Record<string, unknown> }>('/api/v1/operator/me/brains', async (req, reply) => {
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return; // 403 already sent

        const { pool, gridName, brainTokenStore } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        const body = (req.body ?? {}) as Record<string, unknown>;
        const brainDid = body['brain_did'];

        if (typeof brainDid !== 'string' || !BRAIN_DID_RE.test(brainDid)) {
            return reply.code(400).send({ error: 'invalid_request', field: 'brain_did' });
        }

        // Verify Brain is registered (Phase 38 step 1 must be complete first)
        if (brainTokenStore) {
            const rec = await brainTokenStore.getByDid(brainDid);
            if (!rec) return reply.code(404).send({ error: 'unknown_brain_did' });
        }

        // DB-authoritative quota check (D-39-06) — cannot be gamed by concurrency
        const currentCount = await countActiveByOperator(pool, gridName, operatorDid);
        const limit = await getQuotaLimit(pool, gridName, operatorDid);
        if (currentCount >= limit) {
            return reply.code(429).send({
                error: 'quota_exceeded',
                resource: 'brain_processes',
                current: currentCount,
                limit,
            });
        }

        // Atomic claim — UPDATE WHERE operator_did IS NULL
        // If affectedRows === 0, someone else already claimed this brain_did
        const claimed = await setOwner(pool, gridName, operatorDid, brainDid);
        if (!claimed) {
            return reply.code(409).send({ error: 'already_claimed', brain_did: brainDid });
        }

        req.log.info({ event: 'operator_me.brain_claimed', operator_did: operatorDid, brain_did: brainDid });
        return reply.code(200).send({ ok: true, brain_did: brainDid, operator_did: operatorDid });
    });
}
