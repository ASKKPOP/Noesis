/**
 * Mock Grid server for Playwright E2E (Plan 03-06 Task 3).
 *
 * Boots a Fastify instance on 127.0.0.1:<port> that speaks enough of the
 * Grid's HTTP + WebSocket contract to exercise the dashboard end-to-end
 * without a real Grid/Brain pair.
 *
 * Endpoints served:
 *   GET  /api/v1/grid/regions   → {regions, connections} — shape mirrors
 *                                  grid/src/space/types.ts (no x/y on Region;
 *                                  client computes layout via
 *                                  computeRegionLayout()).
 *   WS   /ws/events             → hello → wait for subscribe → 1 spawn,
 *                                  3 ticks, 1 nous.moved (spaced 400ms).
 *
 * CORS:
 *   Allows http://localhost:3001 (dashboard dev server). No credentials.
 *
 * Security posture:
 *   Bound to 127.0.0.1 only (T-03-24 mitigation) — never exposed externally.
 *   This is test-only code; not shipped in any production bundle.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import type WebSocket from 'ws';

// ── REAL shapes from grid/src/space/types.ts (no x/y on Region) ──────────
export interface Region {
    id: string;
    name: string;
    description: string;
    regionType: 'public' | 'restricted' | 'private';
    capacity: number;
    properties: Record<string, unknown>;
}
export interface RegionConnection {
    fromRegion: string; // authoritative field name — NOT `from`
    toRegion: string;
    travelCost: number;
    bidirectional: boolean;
}

export const MOCK_REGIONS: Region[] = [
    {
        id: 'region-a',
        name: 'Atrium',
        description: 'A',
        regionType: 'public',
        capacity: 10,
        properties: {},
    },
    {
        id: 'region-b',
        name: 'Belfry',
        description: 'B',
        regionType: 'public',
        capacity: 10,
        properties: {},
    },
    {
        id: 'region-c',
        name: 'Cloister',
        description: 'C',
        regionType: 'restricted',
        capacity: 5,
        properties: {},
    },
];

export const MOCK_CONNECTIONS: RegionConnection[] = [
    { fromRegion: 'region-a', toRegion: 'region-b', travelCost: 1, bidirectional: true },
    { fromRegion: 'region-b', toRegion: 'region-c', travelCost: 2, bidirectional: true },
];

// Deterministic hash-filler for prev/event hashes (64 hex chars).
const ZERO_HASH = '0'.repeat(64);
const hex = (n: number): string => n.toString(16).padStart(64, '0');

export interface MockGridHandle {
    url: string;
    stop: () => Promise<void>;
}

export async function startMockGrid(port = 8080): Promise<MockGridHandle> {
    const app: FastifyInstance = Fastify({ logger: false });
    await app.register(websocketPlugin);

    // CORS parity with Plan 01 — dashboard dev runs at :3001. We write the
    // headers manually (rather than depending on @fastify/cors) so the test
    // fixture has one fewer transitive dep. Preflight is not exercised by
    // this suite; dashboard fetches are same-origin from its Next.js server.
    app.addHook('onRequest', async (_req, reply) => {
        reply.header('access-control-allow-origin', 'http://localhost:3001');
        reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
        reply.header('access-control-allow-headers', 'content-type');
    });

    app.get('/api/v1/grid/regions', async () => ({
        regions: MOCK_REGIONS,
        connections: MOCK_CONNECTIONS,
    }));

    // ── Phase 6 operator endpoints — minimal stubs (Plan 06-06 Task 1) ────
    // These satisfy the HTTP contract for dashboard E2E flow only. Audit
    // invariants + privacy checks live in grid vitest suites (Plan 05 Task 2,
    // Plan 04 Tasks 1–3). The dashboard never reads the response body deeply;
    // it only needs a 200-shaped response to unblock the UI.
    //
    // Route shapes mirror the REAL Grid (grid/src/api/operator/*):
    //   memory-query   → POST /api/v1/operator/nous/:did/memory/query
    //   telos-force    → POST /api/v1/operator/nous/:did/telos/force
    //   clock-pause    → POST /api/v1/operator/clock/pause
    //   clock-resume   → POST /api/v1/operator/clock/resume
    app.post<{ Params: { did: string } }>(
        '/api/v1/operator/nous/:did/memory/query',
        async (_req, reply) => {
            reply.code(200);
            return { entries: [] };
        },
    );

    app.post<{ Params: { did: string } }>(
        '/api/v1/operator/nous/:did/telos/force',
        async (_req, reply) => {
            reply.code(200);
            // Distinct hashes — exercises the diff-display branch if UI
            // ever renders it. Shape mirrors Plan 05 `telos-force.ts`.
            return {
                telos_hash_before: 'a'.repeat(64),
                telos_hash_after: 'b'.repeat(64),
            };
        },
    );

    app.post('/api/v1/operator/clock/pause', async (_req, reply) => {
        reply.code(200);
        return { paused: true };
    });

    app.post('/api/v1/operator/clock/resume', async (_req, reply) => {
        reply.code(200);
        return { paused: false };
    });

    const sockets = new Set<WebSocket>();

    app.get('/ws/events', { websocket: true }, (conn) => {
        // @fastify/websocket v11 passes a WebSocket directly (conn IS the
        // socket). Older versions nested it under .socket. Defensive check
        // covers both shapes so this fixture is not pinned to a single minor.
        const socket = (conn as unknown as { socket?: WebSocket }).socket ?? (conn as unknown as WebSocket);
        sockets.add(socket);

        const send = (obj: unknown): void => {
            try {
                socket.send(JSON.stringify(obj));
            } catch {
                // Client hung up — let the close handler clean up.
            }
        };

        // HelloFrame per grid/src/api/ws-protocol.ts. Mirrors the real Grid
        // so WsClient transitions 'connecting' → 'open' as it does in prod.
        send({
            type: 'hello',
            serverTime: Date.now(),
            gridName: 'mock-grid',
            lastEntryId: 0,
        });

        // Wait for the client's `subscribe` frame before streaming events,
        // matching the Phase-2 protocol contract.
        socket.on('message', (raw: Buffer | string) => {
            let msg: { type?: string };
            try {
                msg = JSON.parse(String(raw));
            } catch {
                return;
            }
            if (msg.type !== 'subscribe') return;

            let id = 0;
            const emit = (partial: {
                eventType: string;
                actorDid: string;
                payload: Record<string, unknown>;
            }): void => {
                id += 1;
                send({
                    type: 'event',
                    entry: {
                        id,
                        eventType: partial.eventType,
                        actorDid: partial.actorDid,
                        payload: partial.payload,
                        prevHash: id === 1 ? ZERO_HASH : hex(id - 1),
                        eventHash: hex(id),
                        createdAt: Date.now(),
                    },
                });
            };

            // 1 spawn → 3 ticks → 1 move, spaced so the dashboard settles
            // between frames (ingest cadence + flushSync timing tolerant).
            //
            // DID format: `did:noesis:alice` (Plan 06-06 correction). Earlier
            // Phase-3 fixtures used `did:example:alice`, which passes broadcast
            // + presence stores (neither validates DID shape) but FAILS
            // SelectionStore's DID_REGEX (`/^did:noesis:[a-z0-9_-]+$/i`, T-04-17
            // tampering mitigation). Without matching the regex, clicking the
            // Nous marker silently falls through to null and Inspector never
            // opens — breaking SC#5. `did:noesis:alice` is the canonical test
            // DID used by grid-page.spec.ts + agency.spec.ts going forward.
            setTimeout(() => {
                emit({
                    eventType: 'nous.spawned',
                    actorDid: 'did:noesis:alice',
                    // nous.spawned payload uses singular `region` per
                    // grid/src/genesis/launcher.ts:89 — NOT regionId.
                    payload: { name: 'Alice', region: 'region-a', ndsAddress: 'nds://mock/alice' },
                });
            }, 100);

            for (let t = 1; t <= 3; t++) {
                setTimeout(() => {
                    emit({
                        eventType: 'tick',
                        actorDid: 'system',
                        payload: { tick: t, epoch: 0, tickRateMs: 1000, timestamp: Date.now() },
                    });
                }, 100 + t * 400);
            }

            setTimeout(() => {
                emit({
                    eventType: 'nous.moved',
                    actorDid: 'did:noesis:alice',
                    // nous.moved payload uses fromRegion/toRegion per
                    // grid/src/integration/nous-runner.ts:138 — NOT {x,y}.
                    payload: {
                        name: 'Alice',
                        fromRegion: 'region-a',
                        toRegion: 'region-b',
                        travelCost: 1,
                        tick: 4,
                    },
                });
            }, 1800);
        });

        socket.on('close', () => {
            sockets.delete(socket);
        });
    });

    await app.listen({ port, host: '127.0.0.1' });

    return {
        url: `http://127.0.0.1:${port}`,
        stop: async () => {
            for (const s of sockets) {
                try {
                    s.close();
                } catch {
                    // ignore
                }
            }
            sockets.clear();
            await app.close();
        },
    };
}
