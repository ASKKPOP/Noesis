/**
 * Grid Zoning routes. D-V3-40: the zone set belongs to each Grid — it starts from the
 * six-zone template and its Polis may add, relabel and remove zones.
 *
 *   GET  /api/v1/zoning/zones            — public: this Grid's zones + current tax modifiers
 *   POST /api/v1/zoning/:zoneId/amend    — Polis (government_only): amend a zone's tax modifier
 *   POST /api/v1/zoning/zones            — Polis: add a zone {zone_id, label, kind, allowed_activities?, tax_modifier_bps?}
 *   POST /api/v1/zoning/:zoneId/relabel  — Polis: rename a zone {label}
 *   POST /api/v1/zoning/:zoneId/remove   — Polis: remove a zone (409 while it holds land or residents)
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ZoneRegistry, ZoneError, type ZoneErrorCode } from '../../zoning/zone-registry.js';
import { ResidenceStore } from '../../zoning/residence-store.js';
import type { ZoneKind } from '../../zoning/zone-types.js';

/** HTTP status for each zone-law refusal. */
const ZONE_ERROR_STATUS: Readonly<Record<ZoneErrorCode, number>> = {
    unknown_zone: 404, zone_exists: 409, zone_occupied: 409, last_zone: 409,
    invalid_zone_id: 400, invalid_label: 400, invalid_kind: 400, invalid_activities: 400, invalid_tax_modifier: 400,
};

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
            const bps = typeof req.body?.tax_modifier_bps === 'number' ? Math.floor(req.body.tax_modifier_bps) : NaN;
            if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return reply.code(400).send({ error: 'invalid_tax_modifier' });
            try {
                await new ZoneRegistry(pool, audit).amendZone({ gridName: grid, zoneId: req.params.zoneId, taxModifierBps: bps, amendedByDid: amender, tick: tick() });
            } catch (err) {
                if (err instanceof ZoneError) return reply.code(ZONE_ERROR_STATUS[err.code]).send({ error: err.code });
                throw err;
            }
            return reply.code(201).send({ status: 'amended', zone_id: req.params.zoneId, tax_modifier_bps: bps });
        },
    );

    // D-V3-40 — the Polis legislates its Grid's zone set.
    type ZoneLawBody = { zone_id?: unknown; label?: unknown; kind?: unknown; allowed_activities?: unknown; tax_modifier_bps?: unknown };
    const zoneLaw = (
        path: string,
        act: (reg: ZoneRegistry, zoneId: string, body: ZoneLawBody, by: string) => Promise<string>,
    ): void => {
        app.post<{ Params: { zoneId?: string }; Body: ZoneLawBody }>(path, async (req, reply) => {
            const by = req.didContext?.did;
            if (req.didContext?.tier !== 'government' || !by) return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'zoning_unavailable' });
            const body = req.body ?? {};
            const zoneId = req.params.zoneId ?? (typeof body.zone_id === 'string' ? body.zone_id : '');
            try {
                const status = await act(new ZoneRegistry(pool, audit), zoneId, body, by);
                return reply.code(201).send({ status, zone_id: zoneId });
            } catch (err) {
                if (err instanceof ZoneError) return reply.code(ZONE_ERROR_STATUS[err.code]).send({ error: err.code });
                throw err;
            }
        });
    };
    zoneLaw('/api/v1/zoning/zones', async (reg, zoneId, body, by) => {
        await reg.addZone({
            gridName: grid, zoneId, label: body.label as string, kind: body.kind as ZoneKind,
            allowedActivities: (body.allowed_activities ?? []) as string[],
            taxModifierBps: body.tax_modifier_bps === undefined ? 0 : (body.tax_modifier_bps as number),
            changedByDid: by, tick: tick(),
        });
        return 'zone_added';
    });
    zoneLaw('/api/v1/zoning/:zoneId/relabel', async (reg, zoneId, body, by) => {
        await reg.relabelZone({ gridName: grid, zoneId, label: body.label as string, changedByDid: by, tick: tick() });
        return 'zone_relabeled';
    });
    zoneLaw('/api/v1/zoning/:zoneId/remove', async (reg, zoneId, _body, by) => {
        await reg.removeZone({ gridName: grid, zoneId, changedByDid: by, tick: tick() });
        return 'zone_removed';
    });

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
