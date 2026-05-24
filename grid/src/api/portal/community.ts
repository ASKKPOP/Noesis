/**
 * Community portal routes — Phase 29 COM-01 through COM-05.
 *
 * Routes:
 *   GET    /api/v1/portal/community/users                 — COM-01 user directory
 *   GET    /api/v1/portal/community/posts                 — COM-02 board listing
 *   POST   /api/v1/portal/community/posts                 — COM-02 create post
 *   GET    /api/v1/portal/community/posts/:id/replies     — COM-02 fetch replies
 *   POST   /api/v1/portal/community/posts/:id/replies     — COM-02 create reply
 *   GET    /api/v1/portal/community/leaderboard           — COM-03 leaderboard
 *   POST   /api/v1/portal/community/follow/:did           — COM-04 follow user
 *   DELETE /api/v1/portal/community/follow/:did           — COM-04 unfollow user
 *   GET    /api/v1/portal/community/following             — COM-04 my follows
 *   GET    /api/v1/portal/activity                        — COM-05 activity feed
 *
 * IMPORTANT: No audit.append() calls in this file — community actions are DB-only.
 * Allowlist stays at 53.
 */

import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';

/** Verify JWT cookie → return humanDid, or null if invalid/missing. */
async function getHumanDid(req: FastifyRequest): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) return null;
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'] as string | undefined;
        return typeof did === 'string' ? did : null;
    } catch {
        return null;
    }
}

export function registerCommunityRoutes(
    app: FastifyInstance,
    services: Pick<GridServices, 'humanPool' | 'audit' | 'gridName'>,
): void {
    const gridName = services.gridName;

    // ── COM-01: User Directory ──────────────────────────────────────────────

    // GET /api/v1/portal/community/users
    // Returns up to 100 human users sorted by ousia DESC.
    // Each row: did, eth_address, ousia, created_at, nous_name (nullable).
    app.get('/api/v1/portal/community/users', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const [rows] = await pool.query(
            `SELECT hu.did, hu.eth_address, hu.ousia, hu.created_at,
                    nr.name AS nous_name
             FROM human_users hu
             LEFT JOIN nous_registry nr ON nr.human_owner = hu.did AND nr.grid_name = hu.grid_name
             WHERE hu.grid_name = ?
             ORDER BY hu.ousia DESC
             LIMIT 100`,
            [gridName],
        );
        reply.send({ users: rows });
    });

    // ── COM-02: Community Board ─────────────────────────────────────────────

    // GET /api/v1/portal/community/posts
    // Returns last 50 posts with reply_count, newest first.
    app.get('/api/v1/portal/community/posts', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const [rows] = await pool.query(
            `SELECT cp.id, cp.author_did, cp.content, cp.created_at,
                    COUNT(cr.id) AS reply_count
             FROM community_posts cp
             LEFT JOIN community_replies cr ON cr.post_id = cp.id AND cr.grid_name = cp.grid_name
             WHERE cp.grid_name = ?
             GROUP BY cp.id
             ORDER BY cp.created_at DESC
             LIMIT 50`,
            [gridName],
        );
        reply.send({ posts: rows });
    });

    // POST /api/v1/portal/community/posts
    // Body: { content: string } — max 500 chars. Frozen gate via PORTAL_ACTION_PATTERNS.
    app.post('/api/v1/portal/community/posts', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const body = req.body as { content?: unknown };
        if (typeof body.content !== 'string' || body.content.trim().length === 0) {
            reply.code(400).send({ error: 'content_required' }); return;
        }
        if (body.content.length > 500) {
            reply.code(400).send({ error: 'content_too_long', max: 500 }); return;
        }
        const content = body.content.trim();
        const [result] = await pool.query(
            `INSERT INTO community_posts (grid_name, author_did, content) VALUES (?, ?, ?)`,
            [gridName, humanDid, content],
        );
        const header = result as { insertId: number };
        reply.code(201).send({ post_id: header.insertId });
    });

    // GET /api/v1/portal/community/posts/:id/replies
    app.get('/api/v1/portal/community/posts/:id/replies', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const { id } = req.params as { id: string };
        const postId = parseInt(id, 10);
        if (!Number.isInteger(postId) || postId <= 0) {
            reply.code(400).send({ error: 'invalid_post_id' }); return;
        }
        const [rows] = await pool.query(
            `SELECT id, author_did, content, created_at
             FROM community_replies
             WHERE grid_name = ? AND post_id = ?
             ORDER BY created_at ASC`,
            [gridName, postId],
        );
        reply.send({ replies: rows });
    });

    // POST /api/v1/portal/community/posts/:id/replies
    // Body: { content: string } — max 280 chars. Frozen gate via PORTAL_ACTION_PATTERNS.
    app.post('/api/v1/portal/community/posts/:id/replies', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const { id } = req.params as { id: string };
        const postId = parseInt(id, 10);
        if (!Number.isInteger(postId) || postId <= 0) {
            reply.code(400).send({ error: 'invalid_post_id' }); return;
        }
        // Verify post exists in this grid
        const [postRows] = await pool.query(
            `SELECT id FROM community_posts WHERE grid_name = ? AND id = ? LIMIT 1`,
            [gridName, postId],
        );
        if ((postRows as unknown[]).length === 0) {
            reply.code(404).send({ error: 'post_not_found' }); return;
        }
        const body = req.body as { content?: unknown };
        if (typeof body.content !== 'string' || body.content.trim().length === 0) {
            reply.code(400).send({ error: 'content_required' }); return;
        }
        if (body.content.length > 280) {
            reply.code(400).send({ error: 'content_too_long', max: 280 }); return;
        }
        const content = body.content.trim();
        const [result] = await pool.query(
            `INSERT INTO community_replies (grid_name, post_id, author_did, content) VALUES (?, ?, ?, ?)`,
            [gridName, postId, humanDid, content],
        );
        const header = result as { insertId: number };
        reply.code(201).send({ reply_id: header.insertId });
    });

    // ── COM-03: Leaderboard ─────────────────────────────────────────────────

    // GET /api/v1/portal/community/leaderboard
    // Returns top 50 humans by ousia, with secondary Nous contribution score.
    app.get('/api/v1/portal/community/leaderboard', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        // nous_score = count of nous.spoke + lore.contributed events for owned Nous.
        const [rows] = await pool.query(
            `SELECT hu.did, hu.eth_address, hu.ousia, hu.created_at,
                    nr.name AS nous_name, nr.did AS nous_did,
                    COALESCE(contrib.score, 0) AS nous_score
             FROM human_users hu
             LEFT JOIN nous_registry nr
               ON nr.human_owner = hu.did AND nr.grid_name = hu.grid_name
             LEFT JOIN (
                 SELECT actor_did, COUNT(*) AS score
                 FROM audit_trail
                 WHERE grid_name = ?
                   AND event_type IN ('nous.spoke', 'lore.contributed')
                 GROUP BY actor_did
             ) contrib ON contrib.actor_did = nr.did
             WHERE hu.grid_name = ?
             ORDER BY hu.ousia DESC, nous_score DESC
             LIMIT 50`,
            [gridName, gridName],
        );
        reply.send({ entries: rows });
    });

    // ── COM-04: Follow Users ────────────────────────────────────────────────

    // POST /api/v1/portal/community/follow/:did — follow another human.
    // Frozen gate via PORTAL_ACTION_PATTERNS.
    app.post('/api/v1/portal/community/follow/:did', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const { did } = req.params as { did: string };
        if (did === humanDid) {
            reply.code(400).send({ error: 'cannot_follow_self' }); return;
        }
        // Verify target exists in this grid
        const [targetRows] = await pool.query(
            `SELECT did FROM human_users WHERE grid_name = ? AND did = ? LIMIT 1`,
            [gridName, did],
        );
        if ((targetRows as unknown[]).length === 0) {
            reply.code(404).send({ error: 'user_not_found' }); return;
        }
        // INSERT IGNORE handles duplicate follows gracefully (idempotent)
        await pool.query(
            `INSERT IGNORE INTO user_follows (grid_name, follower_did, following_did) VALUES (?, ?, ?)`,
            [gridName, humanDid, did],
        );
        reply.code(201).send({ following: did });
    });

    // DELETE /api/v1/portal/community/follow/:did — unfollow.
    // Frozen gate via PORTAL_ACTION_PATTERNS.
    app.delete('/api/v1/portal/community/follow/:did', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const { did } = req.params as { did: string };
        await pool.query(
            `DELETE FROM user_follows WHERE grid_name = ? AND follower_did = ? AND following_did = ?`,
            [gridName, humanDid, did],
        );
        reply.code(200).send({ unfollowed: did });
    });

    // GET /api/v1/portal/community/following — list of DIDs I follow
    app.get('/api/v1/portal/community/following', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const [rows] = await pool.query(
            `SELECT following_did, created_at
             FROM user_follows
             WHERE grid_name = ? AND follower_did = ?
             ORDER BY created_at DESC`,
            [gridName, humanDid],
        );
        reply.send({ following: (rows as Array<{ following_did: string }>).map(r => r.following_did) });
    });

    // ── COM-05: Activity Feed ───────────────────────────────────────────────

    // GET /api/v1/portal/activity
    // Returns last 50 audit events of community-relevant types (read-only from audit_trail).
    app.get('/api/v1/portal/activity', async (req, reply) => {
        const humanDid = await getHumanDid(req);
        if (!humanDid) { reply.code(401).send({ error: 'unauthorized' }); return; }
        const pool = services.humanPool;
        if (!pool) { reply.code(503).send({ error: 'portal_unavailable' }); return; }
        const [rows] = await pool.query(
            `SELECT event_type, actor_did, target_did, payload, created_at
             FROM audit_trail
             WHERE grid_name = ?
               AND event_type IN (
                   'nous.spoke', 'human.spoke', 'nous.spawned_by_human',
                   'lore.contributed', 'human.joined', 'nous.spawned'
               )
             ORDER BY created_at DESC
             LIMIT 50`,
            [gridName],
        );
        reply.send({ events: rows });
    });
}
