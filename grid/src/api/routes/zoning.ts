/**
 * Phase 57 Grid Zoning — Plan 1 (ZONE-01): read the 6 zones + Polis amend a zone tax modifier.
 *
 *   GET  /api/v1/zoning/zones          — public: the 6 zones + current tax modifiers
 *   POST /api/v1/zoning/:zoneId/amend   — Polis (government_only): amend a zone's tax modifier
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ZoneRegistry } from '../../zoning/zone-registry.js';
import { ResidenceStore } from '../../zoning/residence-store.js';
import { isZoneType } from '../../zoning/zone-types.js';

const CIVIC_DID_RE = /^did:(?:civic:)?noesis:[a-z0-9_:\-]+$/i;

export function registerZoningRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    app.get('/api/v1/zoning/zones', async (_req, reply) => {
        const pool = services.pool; const audit = services.audit;
        if (!pool || !audit) return reply.code(503).send({ error: 'zoning_unavailable' });
        const zones = await new ZoneRegistry(pool, audit).listZones(grid);
        return reply.code(200).send({ grid: grid, zones });
    });

    app.post<{ Params: { zoneId: string }; Body: { tax_modifier_bps?: unknown } }>(
        '/api/v1/zoning/:zoneId/amend',
        async (req, reply) => {
            const amender = req.didContext?.did;
            if (req.didContext?.tier !== 'government' || !amender) return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'zoning_unavailable' });
            if (!isZoneType(req.params.zoneId)) return reply.code(404).send({ error: 'unknown_zone' });
            const bps = typeof req.body?.tax_modifier_bps === 'number' ? Math.floor(req.body.tax_modifier_bps) : NaN;
            if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return reply.code(400).send({ error: 'invalid_tax_modifier' });
            await new ZoneRegistry(pool, audit).amendZone({ gridName: grid, zoneId: req.params.zoneId, taxModifierBps: bps, amendedByDid: amender, tick: tick() });
            return reply.code(201).send({ status: 'amended', zone_id: req.params.zoneId, tax_modifier_bps: bps });
        },
    );

    // Residence assignment — a system/Polis action on Civic-DID issuance (Phase 54 wires it).
    app.post<{ Body: { civic_did?: unknown } }>(
        '/api/v1/zoning/residence/assign',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'zoning_unavailable' });
            const civic = typeof req.body?.civic_did === 'string' ? req.body.civic_did.trim() : '';
            if (!CIVIC_DID_RE.test(civic)) return reply.code(400).send({ error: 'invalid_civic_did' });
            const r = await new ResidenceStore(pool, audit).assignResidence({ gridName: grid, civicDid: civic, tick: tick() });
            return reply.code(201).send({ status: 'residence_assigned', residence_id: r.residenceId });
        },
    );
}
