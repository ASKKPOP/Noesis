/**
 * Humans REST routes — Phase 25a-04 OBS-HUMANS.
 *
 * GET /api/v1/humans/:did        — profile (HumanRecord + derived counts)
 * GET /api/v1/humans/:did/history — transaction history (4 arrays, server-side payload filter)
 *
 * Read-only: zero audit emissions. Payload-level filtering for human.transferred and
 * nous.whispered is done server-side because AuditChain.query() does not support payload
 * field predicates (RESEARCH Pitfall 3).
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { HUMAN_DID_RE } from '../../human/HumanRegistry.js';

const MAX_HISTORY = 20;

export function registerHumansRoutes(app: FastifyInstance, services: GridServices): void {
    // --- GET /api/v1/humans/:did ---

    app.get<{ Params: { did: string } }>(
        '/api/v1/humans/:did',
        async (req, reply) => {
            const { did } = req.params;

            if (!HUMAN_DID_RE.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            const humanRegistry = services.humanRegistry;
            const record = humanRegistry?.findByDid(services.gridName, did);
            if (!record) {
                reply.code(404);
                return { error: 'unknown_human' } satisfies ApiError;
            }

            const audit = services.audit;

            // last_active: createdAt of the most recent audit entry where actorDid === did
            // query() returns entries in insertion order (oldest-first); take the last.
            const actorEntries = audit.query({ actorDid: did });
            const last_active = actorEntries.length > 0
                ? actorEntries[actorEntries.length - 1]!.createdAt
                : null;

            // nous_count: number of Nous with humanOwner === did
            const registry = services.registry;
            const nous_count = registry
                ? registry.active().filter(r => r.humanOwner === did).length
                : 0;

            // transfer_count: human.transferred entries where payload.human_did === did
            const allTransfers = audit.query({ eventType: 'human.transferred' });
            const transfer_count = allTransfers.filter(
                e => (e.payload as Record<string, unknown>)['human_did'] === did,
            ).length;

            return {
                did: record.did,
                eth_address: record.eth_address,
                grid_name: record.grid_name,
                region: record.region,
                created_at: record.created_at instanceof Date
                    ? record.created_at.getTime()
                    : record.created_at,
                last_active,
                nous_count,
                transfer_count,
            };
        },
    );

    // --- GET /api/v1/humans/:did/history ---

    app.get<{ Params: { did: string } }>(
        '/api/v1/humans/:did/history',
        async (req, reply) => {
            const { did } = req.params;

            if (!HUMAN_DID_RE.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            const humanRegistry = services.humanRegistry;
            const record = humanRegistry?.findByDid(services.gridName, did);
            if (!record) {
                reply.code(404);
                return { error: 'unknown_human' } satisfies ApiError;
            }

            const audit = services.audit;

            // siwe_sessions: portal.auth.login + portal.auth.register, merged, newest-first, max 20
            const loginEntries = audit.query({ eventType: 'portal.auth.login', actorDid: did });
            const registerEntries = audit.query({ eventType: 'portal.auth.register', actorDid: did });
            const siwe_sessions = [...loginEntries, ...registerEntries]
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, MAX_HISTORY)
                .map(e => ({
                    tick: (e.payload as Record<string, unknown>)['tick'] as number | undefined,
                    createdAt: e.createdAt,
                    eventType: e.eventType,
                }));

            // transfers: human.transferred filtered by payload.human_did === did, newest-first, max 20
            const allTransfers = audit.query({ eventType: 'human.transferred' });
            const transfers = allTransfers
                .filter(e => (e.payload as Record<string, unknown>)['human_did'] === did)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, MAX_HISTORY)
                .map(e => {
                    const p = e.payload as Record<string, unknown>;
                    return {
                        tick: p['tick'] as number | undefined,
                        createdAt: e.createdAt,
                        asset: String(p['asset'] ?? ''),
                        grid_name: String(p['grid_name'] ?? ''),
                    };
                });

            // whispers_sent: nous.whispered filtered by payload.from_did === did, newest-first, max 20
            const allWhispers = audit.query({ eventType: 'nous.whispered' });
            const whispers_sent = allWhispers
                .filter(e => (e.payload as Record<string, unknown>)['from_did'] === did)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, MAX_HISTORY)
                .map(e => {
                    const p = e.payload as Record<string, unknown>;
                    return {
                        tick: p['tick'] as number | undefined,
                        createdAt: e.createdAt,
                        to_did: String(p['to_did'] ?? ''),
                        ciphertext_hash: String(p['ciphertext_hash'] ?? ''),
                    };
                });

            // regions_visited: nous.moved for Nous DIDs owned by this human, newest-first, max 20
            const registry = services.registry;
            const ownedNousDids = registry
                ? new Set(registry.active().filter(r => r.humanOwner === did).map(r => r.did))
                : new Set<string>();

            let regions_visited: Array<{ tick: number | undefined; createdAt: number; region: string }> = [];
            if (ownedNousDids.size > 0) {
                const allMoves = audit.query({ eventType: 'nous.moved' });
                regions_visited = allMoves
                    .filter(e => ownedNousDids.has(e.actorDid))
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, MAX_HISTORY)
                    .map(e => {
                        const p = e.payload as Record<string, unknown>;
                        return {
                            tick: p['tick'] as number | undefined,
                            createdAt: e.createdAt,
                            region: String(p['toRegion'] ?? ''),
                        };
                    });
            }

            return {
                siwe_sessions,
                transfers,
                whispers_sent,
                regions_visited,
            };
        },
    );
}
