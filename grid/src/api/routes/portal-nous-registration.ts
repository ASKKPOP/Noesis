/**
 * Nous registration through the Portal (D-V3-33 pipeline, NOUS track, D-V3-39).
 *
 *   POST /api/v1/portal/nous/:nousId/registration — a citizen files for a Nous they own
 *   GET  /api/v1/portal/nous/registrations         — the caller's own filings
 *   GET  /api/v1/portal-reviewer/nous-registrations[?status=]            — reviewer queue
 *   POST /api/v1/portal-reviewer/nous-registrations/:requestId/prescreen — reviewer decision
 *
 * Stages, in order:
 *   1. FILING (Portal session). The filer must own the Nous (nous_sponsors), hold an
 *      active Civic-DID, and — for a founding Nous (sophia|hermes|themis) — be on the
 *      operator allowlist. One live registration per Nous. The filing carries the
 *      public key of the Brain that will run the Nous; issuance is bound to it.
 *   2. PORTAL PRE-SCREEN (Tier-3 Portal Manager reviewer panel, D-V3-36). A human
 *      decision: pass or reject. This is a Portal function, not governance.
 *   3. POLIS CHARTER REVIEW. On a pass the Genesis Polis charter rules are applied
 *      automatically (reviewNousRegistration) — rule evaluation, not a ballot, and
 *      never an operator acting as the Polis (D-V3-18, VOTE-05).
 *   4. REGISTRY ISSUANCE is NOT here: the Nous requests its Civic-DID with its own
 *      signed oath at POST /api/v1/registry/civic-did/request, which refuses unless
 *      stage 3 approved. No Civic-DID is issued by this module.
 *
 * Audit: every stage transition emits through NousRegistrationStore (existing
 * nous.registration_* + polis.registration_pending events) — allowlist +0.
 * Privacy: the reviewer queue returns the registrant as a SHA-256 hash.
 */
import { createHash } from 'node:crypto';
import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from '../portal/auth.js';
import { resolveOperator } from '../preHandlers/operatorAuth.js';
import { NousSponsorStore } from '../../economy/nous-sponsor-store.js';
import { NousRegistrationStore, type NousRegListRow, type NousRegStatus } from '../../portal-workflows/nous-registration-store.js';
import { NOUS_REJECT_REASONS, type NousRejectReason } from '../../portal-workflows/nous-registration-types.js';
import { reviewNousRegistration } from '../../civic-registry/nous-charter-review.js';

/** Same existence-DID shape the issuance route accepts (registry.ts EXISTENCE_DID_RE). */
const NOUS_DID_RE = /^did:noesis:(nous:[a-z0-9_:\-]+|sophia|hermes|themis)$/i;
const FOUNDING_NOUS_RE = /^did:noesis:(sophia|hermes|themis)$/i;
/** A 32-byte Ed25519 public key, base64url without padding (JWK `x`). */
const ED25519_X_RE = /^[A-Za-z0-9_-]{43}$/;
const HUMAN_DID_RE = /^did:noesis:human:[a-z0-9_:\-]+$/i;
const VALID_STATUS: readonly NousRegStatus[] = ['requested', 'polis_pending', 'approved', 'rejected'];

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Resolve the human DID from the Portal session cookie, or send 401 and return null. */
async function humanFromSession(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
    if (!token) { await reply.code(401).send({ error: 'not_authenticated' }); return null; }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'];
        if (typeof did !== 'string' || !HUMAN_DID_RE.test(did)) { await reply.code(401).send({ error: 'invalid_token' }); return null; }
        return did;
    } catch { await reply.code(401).send({ error: 'invalid_token' }); return null; }
}

function publicRow(r: NousRegListRow): Record<string, unknown> {
    return { request_id: r.request_id, nous_did: r.nous_did, type: r.nous_type, status: r.status, reason_code: r.reason_code, filed_tick: r.filed_tick };
}

export function registerPortalNousRegistrationRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);
    const allowlist = () => services.operatorAllowlist ?? new Map();

    // ── 1. Filing ─────────────────────────────────────────────────────────────
    app.post<{ Params: { nousId: string }; Body: { brain_public_key_x?: unknown } }>(
        '/api/v1/portal/nous/:nousId/registration',
        async (req, reply) => {
            const humanDid = await humanFromSession(req, reply);
            if (!humanDid) return;
            const pool = services.pool; const audit = services.audit; const civic = services.civicDidStore;
            if (!pool || !audit || !civic) return reply.code(503).send({ error: 'portal_unavailable' });

            const nousDid = req.params.nousId;
            if (!NOUS_DID_RE.test(nousDid)) return reply.code(404).send({ error: 'unknown_nous' });
            if (services.registry && !services.registry.get(nousDid)) return reply.code(404).send({ error: 'unknown_nous' });

            // The Ed25519 public key of the Brain that will run this Nous. Issuance is
            // bound to it, so an approval cannot be redeemed by anyone else.
            const brainKeyX = req.body?.brain_public_key_x;
            if (typeof brainKeyX !== 'string' || !ED25519_X_RE.test(brainKeyX)) {
                return reply.code(400).send({ error: 'invalid_brain_public_key' });
            }

            if (!(await new NousSponsorStore(pool).owns(grid, humanDid, nousDid))) {
                return reply.code(403).send({ error: 'not_owner' });
            }
            if (FOUNDING_NOUS_RE.test(nousDid) && !resolveOperator(humanDid, allowlist())) {
                return reply.code(403).send({ error: 'founding_nous_operator_only' });
            }
            const sponsorCivic = await civic.getByExistenceDid(grid, humanDid);
            if (!sponsorCivic || sponsorCivic.status !== 'active') {
                return reply.code(403).send({ error: 'civic_did_required' });
            }
            const nousCivic = await civic.getByExistenceDid(grid, nousDid);
            if (nousCivic) return reply.code(409).send({ error: 'already_registered' });

            const store = new NousRegistrationStore(pool, audit);
            const live = await store.liveForNous(grid, nousDid);
            if (live) return reply.code(409).send({ error: 'registration_exists', status: live.status, request_id: live.request_id });

            const r = await store.request({ type: 'A', registrantDid: humanDid, nousDid, targetGrid: grid, tick: tick(), brainKeyX });
            return reply.code(201).send({ status: 'requested', request_id: r.requestId });
        },
    );

    app.get('/api/v1/portal/nous/registrations', async (req, reply) => {
        const humanDid = await humanFromSession(req, reply);
        if (!humanDid) return;
        const pool = services.pool; const audit = services.audit;
        if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
        const rows = await new NousRegistrationStore(pool, audit).listByRegistrant(grid, humanDid);
        return reply.send({ registrations: rows.map(publicRow) });
    });

    // ── 2 + 3. Reviewer panel (Tier-3 Portal Manager) ─────────────────────────
    // Same attack-surface flag as the Portal Manager monitoring routes.
    const reviewerEnabled = process.env.GRID_PORTAL_MANAGER_ENABLED === 'true';

    /** operator_only policy already proved an allowlisted operator; require tier 5. */
    const isReviewer = (req: FastifyRequest): boolean => (req.didContext?.operatorTier ?? 0) >= 5;

    app.get<{ Querystring: { status?: string } }>(
        '/api/v1/portal-reviewer/nous-registrations',
        async (req, reply) => {
            if (!reviewerEnabled) return reply.code(503).send({ error: 'portal_manager_disabled' });
            if (!isReviewer(req)) return reply.code(403).send({ error: 'not_operator' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'portal_unavailable' });
            const status = req.query.status;
            if (status !== undefined && !VALID_STATUS.includes(status as NousRegStatus)) {
                return reply.code(400).send({ error: 'invalid_status' });
            }
            const rows = await new NousRegistrationStore(pool, audit).listForReview(grid, status as NousRegStatus | undefined);
            return reply.send({
                registrations: rows.map((r) => ({
                    ...publicRow(r),
                    registrant_did_hash: sha256Hex(r.registrant_did),
                    registrant_is_operator: resolveOperator(r.registrant_did, allowlist()) !== null,
                    founding_nous: FOUNDING_NOUS_RE.test(r.nous_did),
                })),
            });
        },
    );

    app.post<{ Params: { requestId: string }; Body: { pass?: unknown; reason?: unknown } }>(
        '/api/v1/portal-reviewer/nous-registrations/:requestId/prescreen',
        async (req, reply) => {
            if (!reviewerEnabled) return reply.code(503).send({ error: 'portal_manager_disabled' });
            if (!isReviewer(req)) return reply.code(403).send({ error: 'not_operator' });
            const pool = services.pool; const audit = services.audit; const civic = services.civicDidStore;
            if (!pool || !audit || !civic) return reply.code(503).send({ error: 'portal_unavailable' });
            if (typeof req.body?.pass !== 'boolean') return reply.code(400).send({ error: 'invalid_decision' });

            const store = new NousRegistrationStore(pool, audit);
            const reason: NousRejectReason = NOUS_REJECT_REASONS.includes(req.body.reason as NousRejectReason)
                ? (req.body.reason as NousRejectReason) : 'other';
            const screened = await store.preScreen({ requestId: req.params.requestId, pass: req.body.pass, reason, tick: tick() });
            if (!screened.ok) return reply.code(screened.reason === 'not_found' ? 404 : 409).send({ error: screened.reason });
            if (!screened.forwarded) return reply.code(201).send({ status: 'rejected', reason_code: reason });

            // Stage 3 — the Polis charter rules, applied automatically to the forwarded filing.
            const row = await store.get(req.params.requestId);
            if (!row) return reply.code(404).send({ error: 'not_found' });
            const sponsorCivic = await civic.getByExistenceDid(grid, row.registrant_did);
            const [userRows] = await pool.query(
                'SELECT frozen, banned FROM human_users WHERE did = ? LIMIT 1',
                [row.registrant_did],
            ) as [Array<{ frozen: 0 | 1; banned: 0 | 1 }>, unknown];
            const verdict = reviewNousRegistration({
                targetsThisGrid: row.target_grid === grid,
                sponsorIsActiveCitizen: sponsorCivic?.status === 'active',
                sponsorFrozen: userRows[0]?.frozen === 1,
                sponsorBanned: userRows[0]?.banned === 1,
                nousAlreadyCitizen: (await civic.getByExistenceDid(grid, row.nous_did)) !== null,
            });
            const decided = await store.polisReview({
                requestId: req.params.requestId,
                decision: verdict.approved ? 'approve' : 'reject',
                reason: verdict.approved ? undefined : verdict.reasonCode,
                tick: tick(),
            });
            if (!decided.ok) return reply.code(decided.reason === 'not_found' ? 404 : 409).send({ error: decided.reason });
            return reply.code(201).send(
                verdict.approved
                    ? { status: 'approved', residence_id: decided.residenceId }
                    : { status: 'rejected', reason_code: verdict.reasonCode },
            );
        },
    );
}
