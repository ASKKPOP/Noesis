/**
 * Join-a-Grid S2 + S3 — pairing + recommendation routes.
 *
 *   POST /api/v1/portal/nous/:nousId/claim   — a signed-in human claims/owns a Nous (S2)
 *   GET  /api/v1/portal/nous                 — the Nous a human owns
 *   POST /api/v1/portal/grid-recommendations — recommend a Grid to your owned Nous (S3)
 *   GET  /api/v1/civic/grid-recommendations  — a Nous reads its pending recommendations (S3)
 *
 * The User-side routes auth via the Portal session cookie (→ humanDid). The Nous-read
 * route auths as the Nous (Civic-DID, civic_member tier) and maps civic→existence via
 * the civic registry, so a Nous only ever sees recommendations addressed to ITSELF.
 * Land is Nous-only (D-NH-07): a person joins a Grid THROUGH the Nous it owns.
 *
 * Both stores are PRIVATE portal records (no audit events, allowlist +0).
 */
import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from '../portal/auth.js';
import { NousSponsorStore } from '../../economy/nous-sponsor-store.js';
import { GridRecommendationStore } from '../../economy/grid-recommendation-store.js';

const NOUS_DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;
const GRID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;

/** Resolve the human DID from the Portal session cookie, or send 401 and return null. */
async function humanFromSession(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) { await reply.code(401).send({ error: 'not_authenticated' }); return null; }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !did.startsWith('did:noesis:')) { await reply.code(401).send({ error: 'invalid_token' }); return null; }
        return did;
    } catch { await reply.code(401).send({ error: 'invalid_token' }); return null; }
}

export function registerPortalJoinGridRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);

    // ── S2: claim/own a Nous (Type A pairing) ──────────────────────────────────
    app.post<{ Params: { nousId: string } }>(
        '/api/v1/portal/nous/:nousId/claim',
        async (req, reply) => {
            const humanDid = await humanFromSession(req, reply);
            if (!humanDid) return;
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const nousId = req.params.nousId;
            if (!NOUS_DID_RE.test(nousId)) return reply.code(404).send({ error: 'unknown_nous' });
            await new NousSponsorStore(pool).claim(grid, humanDid, nousId, tick());
            return reply.send({ ok: true, human_did: humanDid, nous_did: nousId });
        },
    );

    app.get('/api/v1/portal/nous', async (req, reply) => {
        const humanDid = await humanFromSession(req, reply);
        if (!humanDid) return;
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
        const nous = await new NousSponsorStore(pool).sponsorsOf(grid, humanDid);
        return reply.send({ nous, count: nous.length });
    });

    // ── S3: recommend a Grid to your owned Nous (advisory) ──────────────────────
    app.post<{ Body: { grid_id?: unknown; nous_did?: unknown } }>(
        '/api/v1/portal/grid-recommendations',
        async (req, reply) => {
            const humanDid = await humanFromSession(req, reply);
            if (!humanDid) return;
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
            const targetGridId = typeof req.body?.grid_id === 'string' ? req.body.grid_id.trim() : '';
            if (!GRID_ID_RE.test(targetGridId)) return reply.code(400).send({ error: 'invalid_grid_id' });

            const sponsors = new NousSponsorStore(pool);
            const recs = new GridRecommendationStore(pool);

            // Explicit nous_did → must be owned; omitted → recommend to ALL owned Nous.
            const explicit = typeof req.body?.nous_did === 'string' ? req.body.nous_did.trim() : '';
            let targets: string[];
            if (explicit) {
                if (!NOUS_DID_RE.test(explicit)) return reply.code(400).send({ error: 'invalid_nous_did' });
                if (!(await sponsors.owns(grid, humanDid, explicit))) return reply.code(403).send({ error: 'not_your_nous' });
                targets = [explicit];
            } else {
                targets = await sponsors.sponsorsOf(grid, humanDid);
                if (targets.length === 0) return reply.code(400).send({ error: 'no_owned_nous' });
            }

            const ids: string[] = [];
            for (const nousDid of targets) {
                ids.push(await recs.recommend({ gridName: grid, humanDid, nousDid, targetGridId, tick: tick() }));
            }
            return reply.send({ ok: true, recommended_to: targets.length, grid_id: targetGridId, recommendation_ids: ids });
        },
    );

    // ── S3: a Nous reads its own pending recommendations (Brain) ────────────────
    app.get('/api/v1/civic/grid-recommendations', async (req, reply) => {
        const civicDid = req.didContext?.did;
        if (!civicDid || req.didContext?.tier !== 'civic_member') return reply.code(401).send({ error: 'not_authenticated' });
        const pool = services.pool;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });

        // Map the authenticated Civic-DID → the Nous's stable existence-DID (what the
        // pairing + recommendations are keyed by). No registry → no recommendations.
        const rec = services.civicDidStore ? await services.civicDidStore.get(grid, civicDid) : null;
        const existenceDid = rec?.existenceDid;
        if (!existenceDid) return reply.send({ recommendations: [], grid_ids: [], count: 0 });

        const pending = await new GridRecommendationStore(pool).pendingForNous(grid, existenceDid);
        const gridIds = [...new Set(pending.map((r) => r.target_grid_id))];
        return reply.send({ recommendations: pending, grid_ids: gridIds, count: pending.length });
    });
}
