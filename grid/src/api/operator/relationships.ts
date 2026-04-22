/**
 * Phase 9 Plan 04 Task 2 — Relationships REST endpoints.
 *
 * Registers four tier-graded Fastify routes per D-9-06:
 *
 *   H1  GET  /api/v1/nous/:did/relationships
 *         → {edges: [{counterparty_did, warmth_bucket, recency_tick, edge_hash}]}
 *         No numeric weight/valence; privacy-safe bucket only (T-09-07 mitigation).
 *
 *   H2  POST /api/v1/nous/:did/relationships/inspect
 *         → {edges: [{counterparty_did, valence, weight, recency_tick, last_event_hash}]}
 *         Requires validateTierBody + tombstoneCheck; emits operator.inspected.
 *
 *   H5  GET  /api/v1/operator/relationships/:edge_key/events
 *         Query params: tier=H5&operator_id=...
 *         → {edge_key, events: [{tick, event_type, payload, entry_hash}]}
 *         Full chain scan (OQ-4 approved: <1/day at H5); emits operator.inspected.
 *
 *   H1  GET  /api/v1/grid/relationships/graph
 *         → {nodes: [{did, x, y}], edges: [{did_a, did_b, warmth_bucket, edge_hash}]}
 *         Server-computed SHA-256-seeded deterministic node positions (OQ-5).
 *
 * Privacy invariants (T-09-07):
 *   - H1 response NEVER contains valence or weight keys (exact key-set enforced by
 *     grid/test/api/relationships-privacy.test.ts).
 *   - H2/H5 emit operator.inspected via Phase 6 appendOperatorEvent (zero new
 *     allowlist members, D-9-13).
 *   - Graph endpoint is H1: no floats, no valence/weight.
 *
 * Clone pattern: grid/src/api/operator/memory-query.ts (verbatim tier-validation
 * scaffold; only read-side services and response shape differ).
 */

import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { validateTierBody } from './_validation.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import {
    edgeHash,
    decayedWeight,
    warmthBucket,
} from '../../relationships/canonical.js';
import type { Edge, RelationshipConfig } from '../../relationships/types.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../relationships/config.js';
import type { AuditEntry } from '../../audit/types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Node position computation — RESEARCH.md §Graph Layout Algorithm lines 491-510
// ──────────────────────────────────────────────────────────────────────────────

interface LayoutConfig {
    readonly radius: number;
    readonly centerX: number;
    readonly centerY: number;
    readonly jitterRadius: number;
}

interface NodePosition {
    readonly did: string;
    readonly x: number;
    readonly y: number;
}

const DEFAULT_LAYOUT: LayoutConfig = {
    radius: 400,
    centerX: 500,
    centerY: 500,
    jitterRadius: 50,
};

function computeNodePosition(did: string, cfg: LayoutConfig = DEFAULT_LAYOUT): NodePosition {
    const hash = createHash('sha256').update(did).digest();
    const angleRaw = hash.readUInt32LE(0) / 0x1_0000_0000;
    const angle = angleRaw * 2 * Math.PI;
    const jitterRaw = hash.readUInt32LE(4) / 0x1_0000_0000;
    const jitter = (jitterRaw - 0.5) * 2 * cfg.jitterRadius;
    const r = cfg.radius + jitter;
    return { did, x: cfg.centerX + r * Math.cos(angle), y: cfg.centerY + r * Math.sin(angle) };
}

// ──────────────────────────────────────────────────────────────────────────────
// Edge event decoder — determines if an audit entry involves a DID pair
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the audit entry links didA and didB per the four relationship
 * event types the listener handles (D-9-02 bump table). Used by H5 chain scan.
 */
function involvesEdge(entry: AuditEntry, didA: string, didB: string): boolean {
    const { eventType, actorDid, payload } = entry;

    switch (eventType) {
        case 'nous.spoke': {
            const fromDid = actorDid;
            const toDid = typeof payload['to_did'] === 'string'
                ? (payload['to_did'] as string)
                : typeof entry.targetDid === 'string' ? entry.targetDid : null;
            if (!toDid) return false;
            return (fromDid === didA && toDid === didB) || (fromDid === didB && toDid === didA);
        }
        case 'trade.settled': {
            const proposer = actorDid;
            const counterparty = typeof payload['counterparty'] === 'string'
                ? (payload['counterparty'] as string) : null;
            if (!counterparty) return false;
            return (proposer === didA && counterparty === didB) ||
                   (proposer === didB && counterparty === didA);
        }
        case 'trade.reviewed': {
            const verdict = payload['verdict'];
            if (verdict !== 'fail' && verdict !== 'reject') return false;
            const pA = typeof payload['proposer_did'] === 'string'
                ? (payload['proposer_did'] as string)
                : typeof payload['subject_did'] === 'string'
                    ? (payload['subject_did'] as string) : null;
            const pB = typeof payload['counterparty_did'] === 'string'
                ? (payload['counterparty_did'] as string)
                : typeof entry.targetDid === 'string' ? entry.targetDid : null;
            if (!pA || !pB) return false;
            return (pA === didA && pB === didB) || (pA === didB && pB === didA);
        }
        case 'telos.refined': {
            const nousDid = typeof payload['did'] === 'string'
                ? (payload['did'] as string) : actorDid;
            const partnerDid = typeof payload['partner_did'] === 'string'
                ? (payload['partner_did'] as string)
                : typeof entry.targetDid === 'string' ? entry.targetDid : null;
            if (!partnerDid) return false;
            return (nousDid === didA && partnerDid === didB) ||
                   (nousDid === didB && partnerDid === didA);
        }
        default:
            return false;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: reconstruct a full Edge from a getTopNFor result row + queried DID
// ──────────────────────────────────────────────────────────────────────────────

function reconstructEdge(
    queriedDid: string,
    row: {
        counterpartyDid: string;
        valence: number;
        weight: number;
        recency_tick: number;
        last_event_hash: string;
    },
): Edge {
    // Canonical DID ordering: did_a < did_b lexicographically
    const [did_a, did_b] = queriedDid < row.counterpartyDid
        ? [queriedDid, row.counterpartyDid]
        : [row.counterpartyDid, queriedDid];
    return {
        did_a,
        did_b,
        valence: row.valence,
        weight: row.weight,
        recency_tick: row.recency_tick,
        last_event_hash: row.last_event_hash,
    };
}

// ──────────────────────────────────────────────────────────────────────────────
// Route registration — same direct-function pattern as other operator routes
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Register the four tier-graded relationship endpoints.
 *
 * Called by registerOperatorRoutes (operator/index.ts) exactly once, with the
 * same services object used by all other operator routes. Routes are prefixed
 * with /api/v1 per D-9-06 canonical paths.
 *
 * Exported as `relationshipsRoutes` (name required by acceptance criteria and
 * Task 3 test imports).
 */
export function relationshipsRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    const relCfg: RelationshipConfig = services.config?.relationship ?? DEFAULT_RELATIONSHIP_CONFIG;

    // ── Route 1: H1 GET /api/v1/nous/:did/relationships ─────────────────────

    app.get<{ Params: { did: string }; Querystring: { top?: string } }>(
        '/api/v1/nous/:did/relationships',
        async (req, reply) => {
            const { did } = req.params;

            // 1. DID shape gate
            if (!DID_REGEX.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // 2. Tombstone check — 410 if DID deleted (D-28)
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, did);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
                    }
                    throw err;
                }
            }

            // 3. Clamp top parameter (D-9-07)
            const topRaw = Number(req.query.top ?? relCfg.topNDefault);
            const top = Number.isInteger(topRaw) && topRaw >= 1 && topRaw <= relCfg.topNMax
                ? topRaw
                : relCfg.topNDefault;

            const currentTick = services.clock.currentTick;
            const relationships = services.relationships;

            if (!relationships) {
                return { edges: [] };
            }

            const raw = relationships.getTopNFor(did, top, currentTick);

            // H1 response: EXACTLY 4 keys — no numeric valence/weight (T-09-07)
            return {
                edges: raw.map(e => {
                    const edge = reconstructEdge(did, e);
                    const decayed = decayedWeight(edge, currentTick, relCfg.tau);
                    return {
                        counterparty_did: e.counterpartyDid,
                        warmth_bucket: warmthBucket(decayed, relCfg),
                        recency_tick: e.recency_tick,
                        edge_hash: edgeHash(edge),
                    };
                }),
            };
        },
    );

    // ── Route 2: H2 POST /api/v1/nous/:did/relationships/inspect ────────────

    app.post<{
        Params: { did: string };
        Body: { tier?: unknown; operator_id?: unknown; top?: unknown };
    }>(
        '/api/v1/nous/:did/relationships/inspect',
        async (req, reply) => {
            const body = req.body ?? {};

            // 1. Tier + operator_id gate (validateTierBody enforces strict equality, D-13)
            const v = validateTierBody(body, 'H2');
            if (!v.ok) {
                reply.code(400);
                return { error: v.error } satisfies ApiError;
            }

            const { did } = req.params;

            // 2. DID shape gate
            if (!DID_REGEX.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            // 3. Tombstone check
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, did);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
                    }
                    throw err;
                }
            }

            // 4. Clamp top from body (D-9-07)
            const topRaw = Number(body.top ?? relCfg.topNDefault);
            const top = Number.isInteger(topRaw) && topRaw >= 1 && topRaw <= relCfg.topNMax
                ? topRaw
                : relCfg.topNDefault;

            const currentTick = services.clock.currentTick;
            const relationships = services.relationships;

            if (!relationships) {
                return { edges: [] };
            }

            const raw = relationships.getTopNFor(did, top, currentTick);

            // 5. Emit operator.inspected (D-9-13 — Phase 6 reuse, zero new allowlist members)
            appendOperatorEvent(
                services.audit,
                'operator.inspected',
                v.operator_id,
                {
                    tier: v.tier,
                    action: 'inspect_relationships',
                    operator_id: v.operator_id,
                    target_did: did,
                },
                did,
            );

            // H2 response: numeric valence + decayed weight (full inspector shape)
            return {
                edges: raw.map(e => {
                    const edge = reconstructEdge(did, e);
                    const decayed = decayedWeight(edge, currentTick, relCfg.tau);
                    return {
                        counterparty_did: e.counterpartyDid,
                        valence: e.valence,
                        weight: decayed,
                        recency_tick: e.recency_tick,
                        last_event_hash: e.last_event_hash,
                    };
                }),
            };
        },
    );

    // ── Route 3: H5 GET /api/v1/operator/relationships/:edge_key/events ─────
    // Tier + operator_id arrive as query params because GET has no body (D-9-06).

    app.get<{
        Params: { edge_key: string };
        Querystring: { tier?: string; operator_id?: string };
    }>(
        '/api/v1/operator/relationships/:edge_key/events',
        async (req, reply) => {
            const { edge_key: edgeKey } = req.params;

            // 1. Validate edge_key format — hex string 16-64 chars (D-9-10 hash prefix)
            if (!/^[a-f0-9]{16,64}$/i.test(edgeKey)) {
                reply.code(400);
                return { error: 'invalid_edge_key' } satisfies ApiError;
            }

            // 2. Validate tier from query params (strict equality, T-09-14 mitigation)
            const tier = String(req.query.tier ?? '');
            const operatorId = String(req.query.operator_id ?? '');
            if (tier !== 'H5') {
                reply.code(400);
                return { error: 'tier_mismatch' } satisfies ApiError;
            }
            if (!operatorId) {
                reply.code(400);
                return { error: 'missing_operator_id' } satisfies ApiError;
            }

            // 3. Edge resolution by hash prefix (D-9-10)
            const relationships = services.relationships;
            if (!relationships) {
                reply.code(404);
                return { error: 'edge_not_found' } satisfies ApiError;
            }

            const edge = Array.from(relationships.allEdges()).find(
                e => edgeHash(e).startsWith(edgeKey) || edgeHash(e) === edgeKey,
            );

            if (!edge) {
                reply.code(404);
                return { error: 'edge_not_found' } satisfies ApiError;
            }

            const { did_a, did_b } = edge;

            // 4. Defensive self-loop guard (canonical edges enforce did_a < did_b per D-9-11)
            if (did_a === did_b) {
                reply.code(400);
                return { error: 'invalid_edge_key' } satisfies ApiError;
            }

            // 5. Tombstone-check both resolved DIDs
            if (services.registry) {
                try {
                    tombstoneCheck(services.registry, did_a);
                    tombstoneCheck(services.registry, did_b);
                } catch (err) {
                    if (err instanceof TombstonedDidError) {
                        reply.code(410);
                        return { error: 'gone', deleted_at_tick: err.deletedAtTick } as ApiError & { deleted_at_tick: number };
                    }
                    throw err;
                }
            }

            // 6. Full audit chain scan (OQ-4 approved: <1/day at H5, ~10ms at 100K)
            const entries = services.audit.all();
            const events = entries
                .filter(entry => involvesEdge(entry, did_a, did_b))
                .map(entry => ({
                    tick: typeof entry.payload['tick'] === 'number' ? entry.payload['tick'] as number : 0,
                    event_type: entry.eventType,
                    payload: entry.payload,
                    entry_hash: entry.eventHash,
                }));

            // 7. Emit operator.inspected (D-9-13 — Phase 6 reuse, zero new allowlist members)
            appendOperatorEvent(
                services.audit,
                'operator.inspected',
                operatorId,
                {
                    tier: 'H5',
                    action: 'inspect_edge_events',
                    operator_id: operatorId,
                    target_did: did_a,
                    counterparty_did: did_b,
                },
                did_b,
            );

            return { edge_key: edgeKey, events };
        },
    );

    // ── Route 4: H1 GET /api/v1/grid/relationships/graph ────────────────────

    app.get<{ Querystring: { minWarmth?: string } }>(
        '/api/v1/grid/relationships/graph',
        async (req) => {
            const currentTick = services.clock.currentTick;
            const relationships = services.relationships;

            if (!relationships) {
                return { nodes: [], edges: [] };
            }

            const minWarmthParam = req.query.minWarmth ?? 'cold';
            const WARMTH_ORDER = { cold: 0, warm: 1, hot: 2 } as const;
            const minWarmthLevel =
                (minWarmthParam in WARMTH_ORDER)
                    ? WARMTH_ORDER[minWarmthParam as keyof typeof WARMTH_ORDER]
                    : 0;

            // Filter edges by minimum warmth bucket
            const filteredEdges: Edge[] = [];
            for (const e of relationships.allEdges()) {
                const decayed = decayedWeight(e, currentTick, relCfg.tau);
                const bucket = warmthBucket(decayed, relCfg);
                if (WARMTH_ORDER[bucket] >= minWarmthLevel) {
                    filteredEdges.push(e);
                }
            }

            // Collect unique DIDs
            const didSet = new Set<string>();
            for (const e of filteredEdges) {
                didSet.add(e.did_a);
                didSet.add(e.did_b);
            }

            // Server-computed deterministic node positions via SHA-256(did) (OQ-5)
            const nodes = Array.from(didSet).map(did => computeNodePosition(did));

            // H1 graph edges — no valence/weight, warmth bucket only (T-09-07)
            const edges = filteredEdges.map(e => {
                const decayed = decayedWeight(e, currentTick, relCfg.tau);
                return {
                    did_a: e.did_a,
                    did_b: e.did_b,
                    warmth_bucket: warmthBucket(decayed, relCfg),
                    edge_hash: edgeHash(e),
                };
            });

            // NO audit emit — graph is H1 public read
            return { nodes, edges };
        },
    );
}
