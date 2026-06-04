/**
 * Phase 46 (CIVGOV-01..06) — Government v3 route integration tests.
 *
 * Routes under test (registerGovRoutes):
 *   POST /api/v1/gov/bill/draft              civic_did_required
 *   POST /api/v1/gov/bill/:id/cosponsor      civic_did_required
 *   POST /api/v1/gov/session/open            government_only
 *   POST /api/v1/gov/session/:id/argument    civic_did_required
 *   POST /api/v1/gov/session/close           government_only
 *   POST /api/v1/gov/law/enact               government_only
 *   POST /api/v1/gov/law/:id/repeal          government_only
 *   GET  /api/v1/gov/law/active              public
 *   GET  /api/v1/gov/bill/:id                public
 *
 * The harness replicates the production policy hook's CONTRACT (server.ts onRequest):
 *   - government_only → real verifyGovernmentSession(Authorization) → didContext{government}
 *   - civic_did_required → x-test-civic-did header → didContext{civic_member} or 401
 *   - public → didContext from header if present, else null
 * (The real requireDid/tryDid verification is covered by Phase 36/37 tests; here we test
 *  the gov route logic against the policy contract.)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SignJWT, type KeyLike } from 'jose';

const CIVIC_RE = /^did:civic:noesis:[a-z0-9-]+$/;
const UUID = '33333333-3333-4333-8333-333333333333';
const ALICE = 'did:civic:noesis:alice';
const BOB = 'did:civic:noesis:bob';
const CAROL = 'did:civic:noesis:carol';

describe('Government v3 routes — Phase 46 integration', () => {
    let registerGovRoutes: (app: FastifyInstance, services: unknown) => Promise<void>;
    let AuditChainCtor: new () => { all(): { eventType: string }[] };
    let InMemoryGovBillStore: new (g?: string) => unknown;
    let lookupPolicy: (m: string, p: string) => string;
    let verifyGovernmentSession: (h: string | undefined) => Promise<{ ok: boolean }>;
    let GOV_ISSUER: string;
    let govPrivateKey: KeyLike;

    beforeAll(async () => {
        registerGovRoutes = (await import('../src/api/routes/gov.js')).registerGovRoutes;
        AuditChainCtor = (await import('../src/audit/chain.js')).AuditChain as typeof AuditChainCtor;
        InMemoryGovBillStore = (await import('../src/gov/gov-bill-store.js')).InMemoryGovBillStore as typeof InMemoryGovBillStore;
        lookupPolicy = (await import('../src/api/policy.js')).lookupPolicy;
        const govMod = await import('../src/civic-registry/government-session.js');
        verifyGovernmentSession = govMod.verifyGovernmentSession;
        GOV_ISSUER = govMod.GOV_SESSION_ISSUER_DID;
        govPrivateKey = (await (await import('../src/api/portal/auth.js')).keyPairPromise).privateKey;
    });

    async function mintGovJwt(): Promise<string> {
        // D-46-02: legislative government_only routes reuse the Phase 37 Government-session
        // gate; court_conviction_ref is the bootstrap stub's required session-ref claim.
        return await new SignJWT({ court_conviction_ref: 'session-ref-1' })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuer(GOV_ISSUER)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(govPrivateKey);
    }

    async function buildApp() {
        const audit = new AuditChainCtor();
        const govStore = new InMemoryGovBillStore('genesis');
        let tick = 100;
        const services = { audit, gridName: 'genesis', currentTick: () => tick, govStore };
        const app = Fastify({ logger: false });
        void app.addHook('onRequest', async (req, reply) => {
            const routePath = (req as { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0];
            const policy = lookupPolicy(req.method, routePath);
            if (policy === 'government_only') {
                const r = await verifyGovernmentSession(req.headers.authorization);
                if (!r.ok) return reply.code(403).send({ error: 'gov_required' });
                (req as { didContext?: unknown }).didContext = { did: GOV_ISSUER, tier: 'government' };
                return;
            }
            const testDid = req.headers['x-test-civic-did'];
            const ctx = typeof testDid === 'string' && CIVIC_RE.test(testDid) ? { did: testDid, tier: 'civic_member' } : null;
            if (policy === 'civic_did_required' && !ctx) return reply.code(401).send({ error: 'did_required' });
            (req as { didContext?: unknown }).didContext = ctx;
        });
        await registerGovRoutes(app, services);
        await app.ready();
        return { app, audit, setTick: (t: number) => { tick = t; } };
    }

    const civic = (did: string) => ({ 'x-test-civic-did': did, 'content-type': 'application/json' });
    const gov = (jwt: string) => ({ authorization: `Bearer ${jwt}`, 'content-type': 'application/json' });

    it('full lifecycle: draft → cosponsor×2 → session → argument → close → enact → law book → repeal', async () => {
        const { app, audit } = await buildApp();
        const jwt = await mintGovJwt();

        // 1. Alice drafts a bill.
        const draft = await app.inject({ method: 'POST', url: '/api/v1/gov/bill/draft', headers: civic(ALICE),
            payload: { title: 'Carbon Levy Act', body: 'A bill to levy carbon.', category: 'tax' } });
        expect(draft.statusCode).toBe(201);
        const billId = draft.json().bill_id as string;
        expect(billId).toMatch(/^[0-9a-f-]{36}$/);

        // 2. Self-cosponsor rejected.
        const self = await app.inject({ method: 'POST', url: `/api/v1/gov/bill/${billId}/cosponsor`, headers: civic(ALICE), payload: {} });
        expect(self.statusCode).toBe(422);
        expect(self.json().error).toBe('self_cosponsor');

        // 3. Bob co-sponsors → count 1, not yet eligible (threshold 2).
        const bob = await app.inject({ method: 'POST', url: `/api/v1/gov/bill/${billId}/cosponsor`, headers: civic(BOB), payload: {} });
        expect(bob.statusCode).toBe(201);
        expect(bob.json().cosponsor_count).toBe(1);
        expect(bob.json().eligible).toBe(false);

        // 4. Bob duplicate → 409.
        const dup = await app.inject({ method: 'POST', url: `/api/v1/gov/bill/${billId}/cosponsor`, headers: civic(BOB), payload: {} });
        expect(dup.statusCode).toBe(409);

        // 5. Carol co-sponsors → count 2, eligible.
        const carol = await app.inject({ method: 'POST', url: `/api/v1/gov/bill/${billId}/cosponsor`, headers: civic(CAROL), payload: {} });
        expect(carol.statusCode).toBe(201);
        expect(carol.json().cosponsor_count).toBe(2);
        expect(carol.json().eligible).toBe(true);

        // 6. Open a session (Speaker / government_only).
        const open = await app.inject({ method: 'POST', url: '/api/v1/gov/session/open', headers: gov(jwt), payload: { bill_id: billId } });
        expect(open.statusCode).toBe(201);
        const sessionId = open.json().session_id as string;

        // 7. Alice posts a debate argument.
        const arg = await app.inject({ method: 'POST', url: `/api/v1/gov/session/${sessionId}/argument`, headers: civic(ALICE), payload: { argument: 'I support this.' } });
        expect(arg.statusCode).toBe(201);

        // 8. Speaker closes session → advanced_to_vote (links an existing VOTE-05 proposal).
        const close = await app.inject({ method: 'POST', url: '/api/v1/gov/session/close', headers: gov(jwt),
            payload: { session_id: sessionId, outcome: 'advanced_to_vote', proposal_id: UUID } });
        expect(close.statusCode).toBe(200);
        expect(close.json().outcome).toBe('advanced_to_vote');

        // 9. Enact the law.
        const enact = await app.inject({ method: 'POST', url: '/api/v1/gov/law/enact', headers: gov(jwt), payload: { bill_id: billId } });
        expect(enact.statusCode).toBe(201);
        const lawId = enact.json().law_id as string;

        // 10. Law book (public) shows the active law.
        const active1 = await app.inject({ method: 'GET', url: '/api/v1/gov/law/active' });
        expect(active1.statusCode).toBe(200);
        expect((active1.json().laws as { law_id: string }[]).some(l => l.law_id === lawId)).toBe(true);

        // 11. Repeal it.
        const repeal = await app.inject({ method: 'POST', url: `/api/v1/gov/law/${lawId}/repeal`, headers: gov(jwt), payload: { repealing_bill_id: UUID } });
        expect(repeal.statusCode).toBe(200);

        // 12. Law book no longer lists it.
        const active2 = await app.inject({ method: 'GET', url: '/api/v1/gov/law/active' });
        expect((active2.json().laws as { law_id: string }[]).some(l => l.law_id === lawId)).toBe(false);

        // 13. Public bill view exposes body_text (visitor-readable per Phase 36).
        const view = await app.inject({ method: 'GET', url: `/api/v1/gov/bill/${billId}` });
        expect(view.statusCode).toBe(200);
        expect(view.json().body_text).toBe('A bill to levy carbon.');

        // 14. Audit event ordering across the full lifecycle.
        const types = audit.all().map(e => e.eventType);
        const idx = (t: string) => types.indexOf(t);
        expect(idx('gov.bill_drafted')).toBeGreaterThanOrEqual(0);
        expect(idx('gov.bill_drafted')).toBeLessThan(idx('gov.bill_cosponsored'));
        expect(idx('gov.bill_cosponsored')).toBeLessThan(idx('gov.session_opened'));
        expect(idx('gov.session_opened')).toBeLessThan(idx('gov.session_closed'));
        expect(idx('gov.session_closed')).toBeLessThan(idx('gov.law_enacted'));
        expect(idx('gov.law_enacted')).toBeLessThan(idx('gov.law_repealed'));
        // Exactly 2 co-sponsorship events emitted.
        expect(types.filter(t => t === 'gov.bill_cosponsored').length).toBe(2);
    });

    it('visitor (no DID) cannot draft a bill — 401', async () => {
        const { app } = await buildApp();
        const r = await app.inject({ method: 'POST', url: '/api/v1/gov/bill/draft', headers: { 'content-type': 'application/json' },
            payload: { title: 't', body: 'b', category: 'tax' } });
        expect(r.statusCode).toBe(401);
    });

    it('non-government caller cannot open a session — 403', async () => {
        const { app } = await buildApp();
        const r = await app.inject({ method: 'POST', url: '/api/v1/gov/session/open', headers: civic(ALICE), payload: { bill_id: UUID } });
        expect(r.statusCode).toBe(403);
    });

    it('opening a session on a non-cosponsored bill — 422 bill_not_cosponsored', async () => {
        const { app } = await buildApp();
        const jwt = await mintGovJwt();
        const draft = await app.inject({ method: 'POST', url: '/api/v1/gov/bill/draft', headers: civic(ALICE),
            payload: { title: 't', body: 'b', category: 'tax' } });
        const billId = draft.json().bill_id as string;
        const open = await app.inject({ method: 'POST', url: '/api/v1/gov/session/open', headers: gov(jwt), payload: { bill_id: billId } });
        expect(open.statusCode).toBe(422);
        expect(open.json().error).toBe('bill_not_cosponsored');
    });

    it('rejects invalid draft input (bad category, empty body)', async () => {
        const { app } = await buildApp();
        const bad1 = await app.inject({ method: 'POST', url: '/api/v1/gov/bill/draft', headers: civic(ALICE), payload: { title: 't', body: 'b', category: 'BAD CATEGORY!' } });
        expect(bad1.statusCode).toBe(400);
        const bad2 = await app.inject({ method: 'POST', url: '/api/v1/gov/bill/draft', headers: civic(ALICE), payload: { title: 't', body: '', category: 'tax' } });
        expect(bad2.statusCode).toBe(400);
    });

    // CIVGOV-04 / VOTE-05 invariant: gov routes introduce NO propose/commit/reveal affordance.
    it('VOTE-05 invariant — gov route source contains no propose/commit/reveal and no operator-events import', () => {
        const src = readFileSync(fileURLToPath(new URL('../src/api/routes/gov.ts', import.meta.url)), 'utf8');
        // The only allowed mention is the explanatory comment; assert no route paths or imports.
        expect(/['"`][^'"`]*\/(propose|commit|reveal)\b/.test(src)).toBe(false);
        expect(src.includes('operator-events')).toBe(false);
        expect(/appendProposal|appendBallot/.test(src)).toBe(false);
    });
});
