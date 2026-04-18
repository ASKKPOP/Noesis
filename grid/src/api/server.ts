/**
 * Grid API Server — Fastify-based REST API for Grid services.
 *
 * Provides endpoints for health, grid status, domain management,
 * region queries, law inspection, and audit trail access.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import type { WorldClock } from '../clock/ticker.js';
import type { SpatialMap } from '../space/map.js';
import type { LogosEngine } from '../logos/engine.js';
import type { AuditChain } from '../audit/chain.js';
import type { GridStatus } from './types.js';
import { WsHub } from './ws-hub.js';

export interface GridServices {
    clock: WorldClock;
    space: SpatialMap;
    logos: LogosEngine;
    audit: AuditChain;
    gridName: string;
}

export interface WsHubOverrides {
    bufferCapacity?: number;
    watermarkBytes?: number;
}

export function buildServer(services: GridServices): FastifyInstance {
    return buildServerWithHub(services).app;
}

export function buildServerWithHub(
    services: GridServices,
    wsHubOptions?: WsHubOverrides,
): { app: FastifyInstance; wsHub: WsHub } {
    const app = Fastify({ logger: false });
    const startedAt = Date.now();

    // Dashboard CORS (dev): Next.js dev server runs on :3001 per 03-VALIDATION.md.
    // :3000 is included because `next dev` falls back to :3000 when :3001 is taken
    // and we must not surprise-break that path in a hot-reload loop.
    // Production hardening (0.0.0.0 bind, stricter origin list) is Phase 4.
    void app.register(cors, {
        origin: ['http://localhost:3001', 'http://localhost:3000'],
        credentials: false,
        methods: ['GET', 'OPTIONS'],
    });

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

    // --- WebSocket: /ws/events ---

    void app.register(fastifyWebsocket, {
        options: { maxPayload: 1_048_576 },
    });

    const wsHub = new WsHub({
        audit: services.audit,
        gridName: services.gridName,
        bufferCapacity: wsHubOptions?.bufferCapacity,
        watermarkBytes: wsHubOptions?.watermarkBytes,
    });

    // M5: Origin check deferred — v1 binds 127.0.0.1. See Phase 4 for 0.0.0.0 hardening.
    // When binding 0.0.0.0 behind a reverse proxy, pair GRID_WS_SECRET with an origin
    // allowlist check here. See PITFALLS.md §M5 for the deployment-time checklist.
    //
    // Local-dev auth posture (02-CONTEXT.md §Local-dev auth posture):
    //   - If GRID_WS_SECRET env is set: require Authorization: Bearer <secret>
    //     header OR ?token=<secret> query param. Missing/mismatch → 1008 close.
    //   - If unset: permissive (developer default, 127.0.0.1 bind).
    app.register(async (instance) => {
        instance.get('/ws/events', { websocket: true }, (socket, req) => {
            const secret = process.env.GRID_WS_SECRET;
            if (secret) {
                const headerAuth = (req.headers['authorization'] as string | undefined) ?? '';
                const bearer = headerAuth.startsWith('Bearer ')
                    ? headerAuth.substring('Bearer '.length)
                    : null;
                const q = req.query as { token?: unknown } | undefined;
                const queryToken = typeof q?.token === 'string' ? q.token : null;
                const presented = bearer ?? queryToken;
                if (presented !== secret) {
                    try {
                        socket.close(1008, 'unauthorized');
                    } catch {
                        /* swallow */
                    }
                    return;
                }
            }
            // Adapter: fastify/ws socket → ServerSocket shape expected by WsHub.
            const adapter = {
                get bufferedAmount() {
                    return socket.bufferedAmount;
                },
                send: (data: string) => socket.send(data),
                close: (code?: number, reason?: string) => socket.close(code, reason),
                on: (event: 'message' | 'close' | 'error', cb: (arg: never) => void) => {
                    if (event === 'message') {
                        socket.on('message', (data: Buffer) =>
                            (cb as (d: unknown) => void)(data.toString('utf8')),
                        );
                    } else if (event === 'close') {
                        socket.on('close', () => (cb as () => void)());
                    } else {
                        socket.on('error', (err: Error) =>
                            (cb as (e: Error) => void)(err),
                        );
                    }
                },
            };
            wsHub.onConnect(adapter, { headers: req.headers as Record<string, unknown> });
        });
    });

    // Lifecycle: drain hub before @fastify/websocket tears down sockets.
    // We use `preClose` so ByeFrame writes complete while sockets are still
    // OPEN — onClose fires AFTER the websocket plugin has already moved every
    // socket to CLOSING (readyState=2), at which point send() is a no-op.
    //
    // NOTE: callers who use graceful-shutdown signals (SIGTERM, etc.) should
    // also invoke `wsHub.close()` explicitly if they call `app.close()` after
    // other teardown steps that might race with @fastify/websocket.
    app.addHook('preClose', async () => {
        await wsHub.close();
    });

    return { app, wsHub };
}
