/**
 * Grid API Server — Fastify-based REST API for Grid services.
 *
 * Provides endpoints for health, grid status, domain management,
 * region queries, law inspection, and audit trail access.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import type { WorldClock } from '../clock/ticker.js';
import type { SpatialMap } from '../space/map.js';
import type { LogosEngine } from '../logos/engine.js';
import type { AuditChain } from '../audit/chain.js';
import type { GridStatus } from './types.js';

export interface GridServices {
    clock: WorldClock;
    space: SpatialMap;
    logos: LogosEngine;
    audit: AuditChain;
    gridName: string;
}

export function buildServer(services: GridServices): FastifyInstance {
    const app = Fastify({ logger: false });
    const startedAt = Date.now();

    // --- Health ---

    app.get('/health', async () => {
        return { status: 'ok', timestamp: Date.now() };
    });

    // --- Grid Status ---

    app.get('/api/v1/grid/status', async (): Promise<GridStatus> => {
        const clockState = services.clock.state;
        return {
            name: services.gridName,
            tick: clockState.tick,
            epoch: clockState.epoch,
            nousCount: services.space.nousCount,
            regionCount: services.space.allRegions().length,
            activeLaws: services.logos.activeLaws().length,
            auditEntries: services.audit.length,
            uptime: Date.now() - startedAt,
        };
    });

    app.get('/api/v1/grid/clock', async () => {
        return services.clock.state;
    });

    // --- Regions ---

    app.get('/api/v1/grid/regions', async () => {
        return { regions: services.space.allRegions() };
    });

    app.get<{ Params: { id: string } }>('/api/v1/grid/regions/:id', async (req, reply) => {
        const region = services.space.getRegion(req.params.id);
        if (!region) {
            reply.code(404);
            return { error: 'Region not found', code: 404 };
        }
        return region;
    });

    // --- Laws ---

    app.get('/api/v1/governance/laws', async () => {
        return { laws: services.logos.activeLaws() };
    });

    app.get<{ Params: { id: string } }>('/api/v1/governance/laws/:id', async (req, reply) => {
        const law = services.logos.getLaw(req.params.id);
        if (!law) {
            reply.code(404);
            return { error: 'Law not found', code: 404 };
        }
        return law;
    });

    // --- Audit ---

    app.get<{ Querystring: { type?: string; actor?: string; limit?: string; offset?: string } }>(
        '/api/v1/audit/trail',
        async (req) => {
            const entries = services.audit.query({
                eventType: req.query.type,
                actorDid: req.query.actor,
                limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
                offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
            });
            return { entries, total: services.audit.length };
        },
    );

    app.get('/api/v1/audit/verify', async () => {
        const result = services.audit.verify();
        return result;
    });

    return app;
}
