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
import type { NousRegistry } from '../registry/registry.js';
import type { ShopRegistry } from '../economy/shop-registry.js';
import type {
    GridStatus,
    NousRosterEntry,
    NousRosterResponse,
    ApiError,
    TradeRecord,
    TradesResponse,
    ShopsResponse,
} from './types.js';
import { WsHub } from './ws-hub.js';
import { registerOperatorRoutes } from './operator/index.js';

/**
 * Phase 6 AGENCY-02: normalized memory entry shape crossing the RPC boundary.
 *
 * Duplicated locally from `grid/src/integration/types.ts` so the API layer has
 * no direct dependency on integration types (keeps buildServer testable with a
 * stub runner that doesn't depend on the full IBrainBridge surface).
 */
export interface InspectorMemoryEntry {
    timestamp: string;
    kind: string;
    summary: string;
}

/**
 * Inspector runner accessor — returns an object that can report connection
 * state and fetch the brain's get_state dict. NousRunner satisfies this shape;
 * tests pass a fake. The accessor returns undefined when no runner exists for
 * the given DID.
 *
 * Phase 6 AGENCY-02 extensions: `queryMemory` (H2 Reviewer) and `forceTelos`
 * (H4 Driver). Both are optional on the interface so legacy test fakes that
 * only wire `getState` still compile — handlers must null-check at runtime.
 */
export interface InspectorRunner {
    connected: boolean;
    getState(): Promise<Record<string, unknown>>;
    queryMemory?(
        params: { query: string; limit?: number },
    ): Promise<{ entries: InspectorMemoryEntry[] }>;
    forceTelos?(
        newTelos: Record<string, unknown>,
    ): Promise<{ telos_hash_before: string; telos_hash_after: string }>;
}

export interface GridServices {
    clock: WorldClock;
    space: SpatialMap;
    logos: LogosEngine;
    audit: AuditChain;
    gridName: string;
    /** NousRegistry — required by Plan 04-03 roster endpoint. Optional for
     *  legacy tests that don't exercise the new routes. */
    registry?: NousRegistry;
    /** ShopRegistry — required by Plan 04-03 shops endpoint. */
    shops?: ShopRegistry;
    /** Runner lookup for the inspector proxy. Returns undefined if no runner
     *  is registered for the DID (→ 404 unknown_nous). */
    getRunner?: (did: string) => InspectorRunner | undefined;
    /**
     * Phase 7 DIALOG-01 (D-04): invoked by the clock-pause handler AFTER
     * WorldClock.pause() to drain the dialogue aggregator so windows cannot
     * span the pause boundary. Optional so legacy tests without a
     * DialogueAggregator wiring still compile.
     */
    drainDialogueOnPause?: () => void;
}

/**
 * DID regex used by /api/v1/nous/:did/state.
 * Matches `did:noesis:<slug>` where slug is alphanumeric + underscore + hyphen.
 * Case-insensitive. Exposed as a shared constant for Plan 04-06 to reuse.
 */
export const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

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
        return {
            regions: services.space.allRegions(),
            connections: services.space.allConnections(),
        };
    });

    app.get<{ Params: { id: string } }>('/api/v1/grid/regions/:id', async (req, reply) => {
        const region = services.space.getRegion(req.params.id);
        if (!region) {
            reply.code(404);
            return { error: 'Region not found', code: 404 };
        }
        return region;
    });

    // --- Plan 04-03: Nous roster + Inspector proxy ---

    app.get('/api/v1/grid/nous', async (): Promise<NousRosterResponse> => {
        const registry = services.registry;
        if (!registry) {
            // Legacy test harness path — no registry wired. Treat as empty roster.
            return { nous: [] };
        }
        const nous: NousRosterEntry[] = registry.active().map((r) => ({
            did: r.did,
            name: r.name,
            region: r.region,
            ousia: r.ousia,
            lifecyclePhase: r.lifecyclePhase,
            reputation: r.reputation,
            status: r.status,
        }));
        return { nous };
    });

    app.get<{ Params: { did: string } }>(
        '/api/v1/nous/:did/state',
        async (request, reply) => {
            const { did } = request.params;
            if (!DID_REGEX.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }
            const getRunner = services.getRunner;
            const runner = getRunner ? getRunner(did) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }
            if (!runner.connected) {
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }
            try {
                const state = await runner.getState();
                return state;
            } catch (err) {
                // Privacy invariant (T-04-12): never leak raw err.message.
                // Log server-side only, return fixed error shape.
                request.log.warn({ err, did }, 'brain get_state failed');
                reply.code(503);
                return { error: 'brain_unavailable' } satisfies ApiError;
            }
        },
    );

    // --- Plan 04-03: Economy endpoints ---

    app.get<{ Querystring: { limit?: string; offset?: string } }>(
        '/api/v1/economy/trades',
        async (request): Promise<TradesResponse> => {
            // Limit: default 20, clamp max 100, NaN/invalid → default.
            const limitRaw = Number.parseInt(request.query.limit ?? '', 10);
            const limit = Number.isFinite(limitRaw) && limitRaw > 0
                ? Math.min(limitRaw, 100)
                : 20;
            // Offset: default 0, min 0, NaN/invalid → 0.
            const offsetRaw = Number.parseInt(request.query.offset ?? '', 10);
            const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

            // Total count of matching entries in the chain (pre-pagination).
            // AuditChain.query() does not expose a separate total, so we
            // compute it by running the filter without pagination.
            const allMatching = services.audit?.query({ eventType: 'trade.settled' }) ?? [];
            const total = allMatching.length;

            const page = services.audit?.query({
                eventType: 'trade.settled',
                limit,
                offset,
            }) ?? [];

            // W2 timestamp contract: AuditEntry.createdAt is Date.now() (ms).
            // Emit Unix SECONDS (integer) per the contract locked in api/types.ts.
            // Any value ≥ 10_000_000_000 would be ms — asserted by the test.
            const trades: TradeRecord[] = page.map((e) => ({
                actorDid: e.actorDid,
                counterparty: String(e.payload['counterparty'] ?? ''),
                amount: Number(e.payload['amount'] ?? 0),
                nonce: String(e.payload['nonce'] ?? ''),
                timestamp: Math.floor(e.createdAt / 1000),
            }));

            return { trades, total };
        },
    );

    app.get('/api/v1/economy/shops', async (): Promise<ShopsResponse> => {
        const shops = services.shops;
        if (!shops) return { shops: [] };
        // Defensive copy: frozen listings from ShopRegistry are not safe to
        // hand to callers (mutating would throw). Spread each level to emit
        // plain serializable objects.
        const out = shops.list().map((s) => ({
            ownerDid: s.ownerDid,
            name: s.name,
            listings: s.listings.map((l) => ({
                sku: l.sku,
                label: l.label,
                priceOusia: l.priceOusia,
            })),
        }));
        return { shops: out };
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

    // --- Phase 6 Plan 04: Operator routes (AGENCY-02 H3 + AGENCY-03) ---
    // All operator.* audit writes inside this registrar go through
    // appendOperatorEvent — enforces tier-required + payload-privacy at the
    // single producer boundary.
    registerOperatorRoutes(app, services);

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
