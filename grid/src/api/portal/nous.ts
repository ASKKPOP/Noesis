/**
 * Portal Nous profile routes.
 *
 * Phase 27 CHAT-06 + D-07/D-08a/D-09/D-15/D-16.
 *
 * Routes:
 *   GET /api/v1/portal/nous/:nousId/skills — skill list with Brain-resolved names
 *   GET /api/v1/portal/nous/:nousId/lore   — lore metadata (no body text)
 *   GET /api/v1/portal/nous/:nousId/norms  — norm entries where Nous participates
 *
 * All three routes require JWT auth (same guard as wallet.ts).
 *
 * D-08a (locked override): lore endpoint returns metadata only.
 * "lore body never crosses wire" — lore_commons has no body column.
 *
 * Brain proxy (D-07/D-15): skill hash → name resolved via GET /skills/:hash.
 * Fallback to truncated hash display when Brain is unavailable.
 */

import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';

// ── Brain proxy helper ──────────────────────────────────────────────────────
// Follows cognitive-snapshot-client.ts pattern: AbortController, X-Brain-Secret,
// closed-key validation, null on error (fallback).

async function fetchSkillFromBrain(
    hash: string,
): Promise<{ name: string; description: string } | null> {
    const brainBase = process.env['BRAIN_HTTP_BASE_URL'] ?? 'http://brain:8090';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
        const res = await fetch(`${brainBase}/skills/${encodeURIComponent(hash)}`, {
            signal: controller.signal,
            headers: { 'X-Brain-Secret': process.env['BRAIN_HTTP_SECRET'] ?? '' },
        });
        if (!res.ok) return null;
        const body = await res.json() as Record<string, unknown>;
        // Closed-key validation: exactly 2 keys: 'description', 'name' (alphabetical)
        const actualKeys = Object.keys(body).sort();
        const EXPECTED_SKILL_KEYS = ['description', 'name'];
        if (
            actualKeys.length !== 2 ||
            !actualKeys.every((k, i) => k === EXPECTED_SKILL_KEYS[i])
        ) {
            return null;
        }
        return { name: body['name'] as string, description: body['description'] as string };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ── JWT auth helper ─────────────────────────────────────────────────────────

async function requireAuth(
    req: FastifyRequest,
    reply: FastifyReply,
): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) {
        await reply.status(401).send({ error: 'not_authenticated' });
        return null;
    }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'] as string;
        if (typeof did !== 'string' || !did.startsWith('did:noesis:')) {
            await reply.status(401).send({ error: 'invalid_token' });
            return null;
        }
        return did;
    } catch {
        await reply.status(401).send({ error: 'invalid_token' });
        return null;
    }
}

// ── Route registration ──────────────────────────────────────────────────────

export function registerPortalNousRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // ── GET /api/v1/portal/nous/:nousId/skills ──────────────────────────────
    // Queries audit_trail for skill events by actor_did (nous DID),
    // then proxies Brain for name+description per skill_hash.
    // D-07/CHAT-06: fallback to truncated hash if Brain lookup fails.
    app.get<{ Params: { nousId: string }; Querystring: Record<string, string> }>(
        '/api/v1/portal/nous/:nousId/skills',
        async (req, reply) => {
            const auth = await requireAuth(req, reply);
            if (!auth) return;

            const { nousId } = req.params;
            const nousDidFull = `did:noesis:${nousId}`;
            const pool = services.humanPool;

            let rows: Array<{
                skill_hash: string;
                source: string;
                teacher_did: string | null;
                created_at: number;
            }> = [];

            if (pool) {
                const [result] = await pool.query(
                    `SELECT
                        JSON_UNQUOTE(JSON_EXTRACT(payload, '$.skill_hash')) AS skill_hash,
                        event_type AS source,
                        JSON_UNQUOTE(JSON_EXTRACT(payload, '$.teacher_did')) AS teacher_did,
                        created_at
                    FROM audit_trail
                    WHERE grid_name = ? AND actor_did = ?
                      AND event_type IN ('skill.taught', 'skill.inferred')
                    ORDER BY created_at DESC
                    LIMIT 50`,
                    [services.gridName, nousDidFull],
                ) as [Array<{
                    skill_hash: string;
                    source: string;
                    teacher_did: string | null;
                    created_at: number;
                }>, unknown];
                rows = result;
            }

            // Resolve names from Brain in parallel (with fallback)
            const skills = await Promise.all(rows.map(async (row) => {
                const resolved = await fetchSkillFromBrain(row.skill_hash);
                return {
                    skill_hash: row.skill_hash,
                    name: resolved?.name ?? `${row.skill_hash.slice(0, 16)}...`,
                    description: resolved?.description ?? '',
                    source: row.source === 'skill.taught' ? 'taught' : 'inferred',
                    teacher_did: row.teacher_did ?? null,
                    tick: row.created_at,
                };
            }));

            return reply.send({ skills });
        },
    );

    // ── GET /api/v1/portal/nous/:nousId/lore ───────────────────────────────
    // D-08a (locked override): lore tab shows metadata only — no body text.
    // lore_commons has NO prose body column (STATE.md invariant preserved).
    // Cursor-based pagination: ?cursor=<contributed_tick> → contributed_tick < cursor.
    // D-16: paginate at >20 entries (fetch 21, return 20 + cursor if 21st exists).
    app.get<{ Params: { nousId: string }; Querystring: { cursor?: string } }>(
        '/api/v1/portal/nous/:nousId/lore',
        async (req, reply) => {
            const auth = await requireAuth(req, reply);
            if (!auth) return;

            const { nousId } = req.params;
            const nousDidFull = `did:noesis:${nousId}`;
            const pool = services.humanPool;
            const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;

            let rows: Array<{
                content_hash: string;
                category_tag: string;
                contributed_tick: number;
                citation_count: number;
            }> = [];

            if (pool) {
                const baseQuery = `SELECT content_hash, category_tag, contributed_tick, citation_count
                    FROM lore_commons
                    WHERE grid_name = ? AND contributor_did = ?
                    ${cursor !== null ? 'AND contributed_tick < ?' : ''}
                    ORDER BY contributed_tick DESC
                    LIMIT 21`;

                const params = cursor !== null
                    ? [services.gridName, nousDidFull, cursor]
                    : [services.gridName, nousDidFull];

                const [result] = await pool.query(baseQuery, params) as [Array<{
                    content_hash: string;
                    category_tag: string;
                    contributed_tick: number;
                    citation_count: number;
                }>, unknown];
                rows = result;
            }

            const hasMore = rows.length > 20;
            const entries = rows.slice(0, 20);
            const nextCursor = hasMore ? (entries[entries.length - 1]?.contributed_tick ?? null) : null;

            return reply.send({ entries, cursor: nextCursor });
        },
    );

    // ── GET /api/v1/portal/nous/:nousId/norms ──────────────────────────────
    // Returns norms where Nous DID appears in norm_candidates.participant_dids.
    // Merges with norm_registry to determine CRYSTALLIZED vs CANDIDATE status.
    // D-09: row format — fingerprint, convergence_type, status, participating_count, tick_start, tick_end
    app.get<{ Params: { nousId: string } }>(
        '/api/v1/portal/nous/:nousId/norms',
        async (req, reply) => {
            const auth = await requireAuth(req, reply);
            if (!auth) return;

            const { nousId } = req.params;
            const nousDidFull = `did:noesis:${nousId}`;
            const pool = services.humanPool;

            if (!pool) {
                return reply.send({ norms: [] });
            }

            // participant_dids is a JSON string: '["did:noesis:sophia","did:noesis:hermes"]'
            // Use JSON_CONTAINS to search within the JSON array (T-27-09 mitigation: parameterized)
            const [candidates] = await pool.query(
                `SELECT fingerprint, participant_dids, first_seen_tick, last_updated_tick
                FROM norm_candidates
                WHERE grid_name = ? AND JSON_CONTAINS(participant_dids, JSON_QUOTE(?))
                ORDER BY last_updated_tick DESC
                LIMIT 50`,
                [services.gridName, nousDidFull],
            ) as [Array<{
                fingerprint: string;
                participant_dids: string;
                first_seen_tick: number;
                last_updated_tick: number;
            }>, unknown];

            if (candidates.length === 0) {
                return reply.send({ norms: [] });
            }

            // Check which candidates are crystallized
            const fingerprints = candidates.map(c => c.fingerprint);
            const placeholders = fingerprints.map(() => '?').join(', ');
            const [crystallized] = await pool.query(
                `SELECT fingerprint, convergence_type, participant_count
                FROM norm_registry
                WHERE grid_name = ? AND fingerprint IN (${placeholders})`,
                [services.gridName, ...fingerprints],
            ) as [Array<{
                fingerprint: string;
                convergence_type: string;
                participant_count: number;
            }>, unknown];

            const crystallizedMap = new Map(crystallized.map(r => [r.fingerprint, r]));

            const norms = candidates.map((c) => {
                const crystallizedEntry = crystallizedMap.get(c.fingerprint);
                const participantDids = JSON.parse(c.participant_dids) as string[];
                return {
                    fingerprint: c.fingerprint,
                    convergence_type: crystallizedEntry?.convergence_type ?? 'unknown',
                    status: crystallizedEntry ? 'crystallized' : 'candidate',
                    participating_count: crystallizedEntry?.participant_count ?? participantDids.length,
                    tick_start: c.first_seen_tick,
                    tick_end: c.last_updated_tick,
                };
            });

            return reply.send({ norms });
        },
    );
}
