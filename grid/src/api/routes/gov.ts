/**
 * Phase 46 (CIVGOV-01..06) — Government v3 legislative routes.
 *
 * Nous-only legislation (D-V3-21): a Civic-DID holder drafts a bill → N≥2 distinct
 * Civic-DID holders co-sponsor → the Speaker (government_only) opens a debate session →
 * close advances to a VOTE-05 vote (the EXISTING /governance/* commit-reveal pipeline —
 * NOT re-implemented here) → a passed bill enters the civic law book.
 *
 * VOTE-05 invariant (CIVGOV-04): this file introduces NO propose/commit/reveal affordance.
 * Operators do not vote; the only bridge to voting is gov_bills.proposal_id, set on
 * session close, which references a proposal opened via the existing civic governance routes.
 *
 * Privacy (hash-only, mirrors Phase 12 T-09-12): bill body_text lives Grid-side (gov_bills)
 * and is visitor-readable over HTTP, but ONLY title_hash + content_hash enter the audit chain.
 * D-46-01: the body-hash audit key is `content_hash` (not body_hash) and the session-id audit
 * key is `gov_session_id` (not session_id) to satisfy the frozen FORBIDDEN_KEY_PATTERN walker.
 *
 * government_only speaker hash: mirrors Phase 45 — sha256(GOV_SESSION_ISSUER_DID). The producers
 * HASH the DID (HEX64), so there is no CIVIC_DID_RE trap (D-45-06 does not recur here).
 *
 * Wall-clock ban: every tick comes from services.currentTick(); no Date.now / Math.random
 * except randomUUID for opaque ids (allowed — not a timing source).
 */
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { createHash, randomUUID } from 'node:crypto';
import type { GridServices } from '../server.js';
import { appendGovBillDrafted } from '../../audit/append-gov-bill-drafted.js';
import { appendGovBillCosponsored } from '../../audit/append-gov-bill-cosponsored.js';
import { appendGovSessionOpened } from '../../audit/append-gov-session-opened.js';
import { appendGovSessionClosed } from '../../audit/append-gov-session-closed.js';
import { appendGovLawEnacted } from '../../audit/append-gov-law-enacted.js';
import { appendGovLawRepealed } from '../../audit/append-gov-law-repealed.js';
import { GOV_SESSION_ISSUER_DID } from '../../civic-registry/government-session.js';
import { MySqlGovBillStore, type GovBillStore } from '../../gov/gov-bill-store.js';
import type { SessionOutcome } from '../../gov/types.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_RE = /^[a-z0-9_-]{1,63}$/i;
const MAX_BODY_BYTES = 32 * 1024; // 32 KiB (mirrors Phase 12 MAX_BODY_TEXT_BYTES)
const MAX_ARGUMENT_BYTES = 8 * 1024;
const DEFAULT_COSPONSOR_THRESHOLD = 2;   // CIVGOV-02 N≥2
const DEFAULT_DEBATE_WINDOW_TICKS = 10080; // CIVGOV-03 default (1 week @ 1 tick/min)
const VALID_OUTCOMES = new Set<SessionOutcome>(['advanced_to_vote', 'withdrawn']);

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex');
}

function extractCivicDid(req: { didContext?: { did?: string; tier?: string } | null }): string | null {
    const ctx = req.didContext;
    if (!ctx || typeof ctx.did !== 'string' || !CIVIC_DID_RE.test(ctx.did)) return null;
    if (ctx.tier !== 'civic_member') return null;
    return ctx.did;
}

/** Prefer an injected store (tests); otherwise build a MySQL-backed one. */
function resolveStore(services: GridServices): GovBillStore | null {
    if (services.govStore) return services.govStore;
    if (services.pool) return new MySqlGovBillStore(services.pool, services.gridName);
    return null;
}

/** Read an integer grid_config value; falls back to dflt when pool/config is absent. */
async function readConfigInt(services: GridServices, key: string, dflt: number): Promise<number> {
    const pool = services.pool;
    if (!pool) return dflt;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = ?`,
        [services.gridName, key],
    );
    const raw = rows[0]?.config_value;
    const n = raw != null ? Number.parseInt(String(raw), 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : dflt;
}

export async function registerGovRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {

    // ── POST /api/v1/gov/bill/draft (civic_did_required) ───────────────────────
    app.post<{ Body: { title?: unknown; body?: unknown; category?: unknown } }>(
        '/api/v1/gov/bill/draft', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!store || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });

        const body = req.body ?? {};
        if (typeof body.title !== 'string' || body.title.length === 0 || body.title.length > 255) {
            return reply.code(400).send({ error: 'invalid_title' });
        }
        if (typeof body.body !== 'string' || body.body.length === 0 || Buffer.byteLength(body.body, 'utf8') > MAX_BODY_BYTES) {
            return reply.code(400).send({ error: 'invalid_body' });
        }
        if (typeof body.category !== 'string' || !CATEGORY_RE.test(body.category)) {
            return reply.code(400).send({ error: 'invalid_category' });
        }

        const billId = randomUUID();
        const titleHash = sha256Hex(body.title);
        const contentHash = sha256Hex(body.body);
        const currentTick = tickFn();

        await store.insertBill({
            bill_id: billId,
            author_civic_did: civicDid,
            title_hash: titleHash,
            body_text: body.body,
            body_hash: contentHash,
            category: body.category,
            created_at_tick: currentTick,
        });

        appendGovBillDrafted(audit, {
            author_civic_did_hash: sha256Hex(civicDid),
            bill_id: billId,
            category: body.category,
            content_hash: contentHash,
            tick: currentTick,
            title_hash: titleHash,
        });

        return reply.code(201).send({ bill_id: billId, title_hash: titleHash, content_hash: contentHash });
    });

    // ── POST /api/v1/gov/bill/:id/cosponsor (civic_did_required) ────────────────
    app.post<{ Params: { id: string } }>(
        '/api/v1/gov/bill/:id/cosponsor', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!store || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });

        const bill = await store.getBill(req.params.id);
        if (!bill) return reply.code(404).send({ error: 'bill_not_found' });
        if (bill.author_civic_did === civicDid) return reply.code(422).send({ error: 'self_cosponsor' });

        const currentTick = tickFn();
        let count: number;
        try {
            count = await store.addCosponsor({
                bill_id: req.params.id,
                cosponsor_civic_did: civicDid,
                cosponsored_at_tick: currentTick,
            });
        } catch (err) {
            if (err instanceof Error && err.message === 'duplicate_cosponsor') {
                return reply.code(409).send({ error: 'duplicate_cosponsor' });
            }
            throw err;
        }

        appendGovBillCosponsored(audit, {
            bill_id: req.params.id,
            cosponsor_civic_did_hash: sha256Hex(civicDid),
            cosponsor_count: count,
            tick: currentTick,
        });

        const threshold = await readConfigInt(services, 'gov_cosponsor_threshold', DEFAULT_COSPONSOR_THRESHOLD);
        const eligible = count >= threshold;
        if (eligible && bill.status === 'drafted') {
            await store.setBillStatus(req.params.id, 'cosponsored');
        }

        return reply.code(201).send({ bill_id: req.params.id, cosponsor_count: count, eligible });
    });

    // ── POST /api/v1/gov/session/open (government_only) ─────────────────────────
    app.post<{ Body: { bill_id?: unknown } }>(
        '/api/v1/gov/session/open', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!store || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const body = req.body ?? {};
        if (typeof body.bill_id !== 'string' || !UUID_RE.test(body.bill_id)) {
            return reply.code(400).send({ error: 'invalid_bill_id' });
        }
        const bill = await store.getBill(body.bill_id);
        if (!bill) return reply.code(404).send({ error: 'bill_not_found' });
        if (bill.status !== 'cosponsored') return reply.code(422).send({ error: 'bill_not_cosponsored' });

        const currentTick = tickFn();
        const window = await readConfigInt(services, 'gov_debate_window_ticks', DEFAULT_DEBATE_WINDOW_TICKS);
        const deadline = currentTick + window;
        const sessionId = randomUUID();

        await store.openSession({
            session_id: sessionId,
            bill_id: body.bill_id,
            speaker_civic_did: GOV_SESSION_ISSUER_DID,
            debate_deadline_tick: deadline,
            opened_at_tick: currentTick,
        });
        await store.setBillStatus(body.bill_id, 'in_session');

        appendGovSessionOpened(audit, {
            bill_id: body.bill_id,
            debate_deadline_tick: deadline,
            gov_session_id: sessionId,
            speaker_civic_did_hash: sha256Hex(GOV_SESSION_ISSUER_DID),
            tick: currentTick,
        });

        return reply.code(201).send({ session_id: sessionId, bill_id: body.bill_id, debate_deadline_tick: deadline });
    });

    // ── POST /api/v1/gov/session/:id/argument (civic_did_required) ──────────────
    // Public hearing: visitors (no DID) are 401'd by the policy hook; only Civic-DID
    // holders speak. Arguments are Grid-side debate text — NOT audit-chained.
    app.post<{ Params: { id: string }; Body: { argument?: unknown } }>(
        '/api/v1/gov/session/:id/argument', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        if (!store || !tickFn) return reply.code(503).send({ error: 'service_unavailable' });

        const civicDid = extractCivicDid(req);
        if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });

        const session = await store.getSession(req.params.id);
        if (!session) return reply.code(404).send({ error: 'session_not_found' });

        const currentTick = tickFn();
        if (session.status !== 'open' || currentTick > session.debate_deadline_tick) {
            return reply.code(422).send({ error: 'debate_closed' });
        }

        const body = req.body ?? {};
        if (typeof body.argument !== 'string' || body.argument.length === 0 || Buffer.byteLength(body.argument, 'utf8') > MAX_ARGUMENT_BYTES) {
            return reply.code(400).send({ error: 'invalid_argument' });
        }

        await store.addArgument({
            session_id: req.params.id,
            author_civic_did: civicDid,
            argument_text: body.argument,
            posted_at_tick: currentTick,
        });

        return reply.code(201).send({ posted: true });
    });

    // ── POST /api/v1/gov/session/close (government_only) ────────────────────────
    app.post<{ Body: { session_id?: unknown; outcome?: unknown; proposal_id?: unknown } }>(
        '/api/v1/gov/session/close', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!store || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const body = req.body ?? {};
        if (typeof body.session_id !== 'string' || !UUID_RE.test(body.session_id)) {
            return reply.code(400).send({ error: 'invalid_session_id' });
        }
        if (typeof body.outcome !== 'string' || !VALID_OUTCOMES.has(body.outcome as SessionOutcome)) {
            return reply.code(400).send({ error: 'invalid_outcome' });
        }
        const session = await store.getSession(body.session_id);
        if (!session) return reply.code(404).send({ error: 'session_not_found' });
        if (session.status !== 'open') return reply.code(422).send({ error: 'session_not_open' });

        const outcome = body.outcome as SessionOutcome;
        const currentTick = tickFn();
        await store.closeSession({ session_id: body.session_id, outcome, closed_at_tick: currentTick });

        // advanced_to_vote: link the bill to an EXISTING VOTE-05 proposal (vote runs via /governance/*).
        if (outcome === 'advanced_to_vote' && typeof body.proposal_id === 'string' && UUID_RE.test(body.proposal_id)) {
            await store.setBillProposalId(session.bill_id, body.proposal_id);
        }

        appendGovSessionClosed(audit, {
            bill_id: session.bill_id,
            gov_session_id: body.session_id,
            outcome,
            speaker_civic_did_hash: sha256Hex(GOV_SESSION_ISSUER_DID),
            tick: currentTick,
        });

        return reply.code(200).send({ closed: true, outcome });
    });

    // ── POST /api/v1/gov/law/enact (government_only) ────────────────────────────
    app.post<{ Body: { bill_id?: unknown; supersedes_law_id?: unknown } }>(
        '/api/v1/gov/law/enact', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!store || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const body = req.body ?? {};
        if (typeof body.bill_id !== 'string' || !UUID_RE.test(body.bill_id)) {
            return reply.code(400).send({ error: 'invalid_bill_id' });
        }
        let supersedes: string | null = null;
        if (body.supersedes_law_id !== undefined && body.supersedes_law_id !== null) {
            if (typeof body.supersedes_law_id !== 'string' || !UUID_RE.test(body.supersedes_law_id)) {
                return reply.code(400).send({ error: 'invalid_supersedes_law_id' });
            }
            supersedes = body.supersedes_law_id;
        }
        const bill = await store.getBill(body.bill_id);
        if (!bill) return reply.code(404).send({ error: 'bill_not_found' });

        const lawId = randomUUID();
        const currentTick = tickFn();
        await store.enactLaw({ law_id: lawId, bill_id: body.bill_id, enacted_at_tick: currentTick, supersedes_law_id: supersedes });
        await store.setBillStatus(body.bill_id, 'enacted');

        appendGovLawEnacted(audit, {
            bill_id: body.bill_id,
            enacted_at_tick: currentTick,
            law_id: lawId,
            supersedes_law_id: supersedes,
        });

        return reply.code(201).send({ law_id: lawId, bill_id: body.bill_id });
    });

    // ── POST /api/v1/gov/law/:id/repeal (government_only) ───────────────────────
    app.post<{ Params: { id: string }; Body: { repealing_bill_id?: unknown } }>(
        '/api/v1/gov/law/:id/repeal', async (req, reply) => {
        const store = resolveStore(services);
        const tickFn = services.currentTick;
        const audit = services.audit;
        if (!store || !tickFn || !audit) return reply.code(503).send({ error: 'service_unavailable' });

        const body = req.body ?? {};
        if (typeof body.repealing_bill_id !== 'string' || !UUID_RE.test(body.repealing_bill_id)) {
            return reply.code(400).send({ error: 'invalid_repealing_bill_id' });
        }
        const law = await store.getLaw(req.params.id);
        if (!law) return reply.code(404).send({ error: 'law_not_found' });
        if (law.status !== 'active') return reply.code(422).send({ error: 'law_not_active' });

        const currentTick = tickFn();
        await store.repealLaw({ law_id: req.params.id, repealing_bill_id: body.repealing_bill_id, repealed_at_tick: currentTick });

        appendGovLawRepealed(audit, {
            law_id: req.params.id,
            repealing_bill_id: body.repealing_bill_id,
            tick: currentTick,
        });

        return reply.code(200).send({ repealed: true });
    });

    // ── GET /api/v1/gov/law/active (public) ────────────────────────────────────
    app.get('/api/v1/gov/law/active', async (_req, reply) => {
        const store = resolveStore(services);
        if (!store) return reply.code(503).send({ error: 'service_unavailable' });
        const laws = await store.getActiveLaws();
        void reply.header('Cache-Control', 'public, max-age=10');
        return reply.code(200).send({ laws });
    });

    // ── GET /api/v1/gov/bill/:id (public — visitor-readable per Phase 36) ───────
    app.get<{ Params: { id: string } }>(
        '/api/v1/gov/bill/:id', async (req, reply) => {
        const store = resolveStore(services);
        if (!store) return reply.code(503).send({ error: 'service_unavailable' });
        const bill = await store.getBill(req.params.id);
        if (!bill) return reply.code(404).send({ error: 'bill_not_found' });
        return reply.code(200).send({
            bill_id: bill.bill_id,
            title_hash: bill.title_hash,
            content_hash: bill.body_hash,
            category: bill.category,
            status: bill.status,
            cosponsor_count: bill.cosponsor_count,
            body_text: bill.body_text,
            proposal_id: bill.proposal_id,
            created_at_tick: bill.created_at_tick,
        });
    });
}
