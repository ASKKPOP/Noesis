/**
 * Phase 37b Type B Registry — Plan 1 (TYPE-B-01/02): Polis-α charter + Polis-β sponsor.
 *
 *   POST /api/v1/registry/type-b/charter                 — Foundation files a charter (government_only)
 *   POST /api/v1/registry/type-b/charter/:id/approve     — Foundation approves after ≥7-day review
 *   POST /api/v1/registry/type-b/sponsor                 — sponsor posts bond → 7-day comment window
 *   POST /api/v1/registry/type-b/sponsor/:id/finalize    — issue after no-objection window
 *
 * Deliberate latency throughout: no instant Type B birth.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { TypeBRegistryStore } from '../../typeb/type-b-registry-store.js';
import { requiredBond } from '../../typeb/registry-types.js';

export const TREASURY_DID = 'did:noesis:system:treasury';
const DID_RE = /^did:(?:civic:)?noesis:[a-z0-9_:\-]+$/i;

export function registerRegistryTypeBRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    // Polis-α: file a charter (Foundation reviewer panel).
    app.post<{ Body: { purpose?: unknown; sponsor_did?: unknown } }>(
        '/api/v1/registry/type-b/charter',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'registry_unavailable' });
            const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : '';
            const sponsor = typeof req.body?.sponsor_did === 'string' ? req.body.sponsor_did.trim() : '';
            if (!purpose) return reply.code(400).send({ error: 'empty_purpose' });
            if (!DID_RE.test(sponsor)) return reply.code(400).send({ error: 'invalid_sponsor_did' });
            const r = await new TypeBRegistryStore(pool, audit).fileCharter({ gridName: grid, sponsorDid: sponsor, purpose, tick: tick() });
            if (!r) return reply.code(429).send({ error: 'quarter_charter_limit' });
            return reply.code(201).send({ status: 'pending_review', request_id: r.requestId, type_b_did: r.typeBDid, eligible_tick: r.eligibleTick });
        },
    );

    // Polis-α: approve after the review window.
    app.post<{ Params: { requestId: string } }>(
        '/api/v1/registry/type-b/charter/:requestId/approve',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'registry_unavailable' });
            const r = await new TypeBRegistryStore(pool, audit).approveCharter({ gridName: grid, requestId: req.params.requestId, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'too_early' ? 425 : r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            return reply.code(201).send({ status: 'chartered', type_b_did: r.typeBDid });
        },
    );

    // Polis-β: post bond → comment window.
    app.post<{ Body: { purpose?: unknown; bond_amount?: unknown } }>(
        '/api/v1/registry/type-b/sponsor',
        async (req, reply) => {
            const sponsor = req.didContext?.did;
            if (req.didContext?.tier !== 'civic_member' || !sponsor) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit; const registry = services.registry;
            if (!pool || !audit || !registry) return reply.code(503).send({ error: 'registry_unavailable' });
            const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : '';
            const bond = typeof req.body?.bond_amount === 'number' ? Math.floor(req.body.bond_amount) : NaN;
            if (!purpose) return reply.code(400).send({ error: 'empty_purpose' });
            if (!Number.isInteger(bond) || bond <= 0) return reply.code(400).send({ error: 'invalid_bond' });

            const store = new TypeBRegistryStore(pool, audit);
            const activeCount = await store.activeTypeBCount(grid);
            const required = requiredBond(activeCount);
            if (bond < required) return reply.code(400).send({ error: 'insufficient_bond', required });

            // Charge the refundable bond: sponsor → treasury escrow. 402 on insufficient Bios.
            const moved = registry.transferOusia(sponsor, TREASURY_DID, bond);
            if (!moved.success) {
                if (moved.error === 'insufficient') return reply.code(402).send({ error: 'insufficient_bios', required });
                return reply.code(400).send({ error: moved.error });
            }
            const r = await store.postSponsorBond({ gridName: grid, sponsorDid: sponsor, purpose, bondAmount: bond, activeTypeBCount: activeCount, tick: tick() });
            if (!r) return reply.code(400).send({ error: 'insufficient_bond', required });
            return reply.code(201).send({ status: 'comment_window', request_id: r.requestId, type_b_did: r.typeBDid, eligible_tick: r.eligibleTick });
        },
    );

    // Polis-β: finalize after the comment window.
    app.post<{ Params: { requestId: string } }>(
        '/api/v1/registry/type-b/sponsor/:requestId/finalize',
        async (req, reply) => {
            if (!req.didContext?.did) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'registry_unavailable' });
            const r = await new TypeBRegistryStore(pool, audit).finalizeSponsorship({ gridName: grid, requestId: req.params.requestId, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'too_early' ? 425 : r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            return reply.code(201).send({ status: 'sponsored', type_b_did: r.typeBDid });
        },
    );

    // Bond refund — sponsor reclaims the bond after 12mo of civic minimums (treasury → sponsor).
    app.post<{ Params: { requestId: string }; Body: { meets_minimums?: unknown } }>(
        '/api/v1/registry/type-b/:requestId/bond-refund',
        async (req, reply) => {
            if (!req.didContext?.did) return reply.code(401).send({ error: 'civic_did_required' });
            const pool = services.pool; const audit = services.audit; const registry = services.registry;
            if (!pool || !audit || !registry) return reply.code(503).send({ error: 'registry_unavailable' });
            const meets = req.body?.meets_minimums !== false; // default: minimums met unless explicitly false
            const r = await new TypeBRegistryStore(pool, audit).refundBond({ gridName: grid, requestId: req.params.requestId, meetsMinimums: meets, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'too_early' ? 425 : r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            registry.transferOusia(TREASURY_DID, r.sponsorDid, r.amount); // settle the refund
            return reply.code(201).send({ status: 'bond_refunded', amount: r.amount });
        },
    );

    // Bond slash — forfeit a bond on a sybil/spam Police sanction (→ civic treasury).
    app.post<{ Params: { requestId: string } }>(
        '/api/v1/registry/type-b/:requestId/bond-slash',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'registry_unavailable' });
            const r = await new TypeBRegistryStore(pool, audit).slashBond({ gridName: grid, requestId: req.params.requestId, tick: tick() });
            if (!r.ok) return reply.code(r.reason === 'not_found' ? 404 : 409).send({ error: r.reason });
            return reply.code(201).send({ status: 'bond_slashed', amount: r.amount });
        },
    );

    // Polis-γ parent-spawn — GATED to v3.1+ (D-V3-28: child-spawning is a sybil vector).
    app.post(
        '/api/v1/registry/type-b/spawn',
        async (req, reply) => {
            if (!req.didContext?.did) return reply.code(401).send({ error: 'civic_did_required' });
            return reply.code(403).send({ error: 'forbidden_in_v3.0', detail: 'Polis-γ parent-spawn unlocks in v3.1+' });
        },
    );
}
