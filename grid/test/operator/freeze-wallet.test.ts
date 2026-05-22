/**
 * Phase 25b SANCTION-06 (D-25b-08, D-25b-NEW-4) — tests for POST /api/v1/operator/humans/:did/freeze.
 *
 * Test matrix:
 *   Header-auth contract (H5 gate):
 *   - No x-operator-tier header → 401 tier_missing
 *   - Non-numeric tier header → 401 tier_missing
 *   - tier '4' (< 5) → 403 tier_too_low
 *   - tier '5' + invalid x-operator-id → 400 invalid_operator_id
 *   - Invalid DID shape → 400 invalid_did
 *   - No human_users row for DID → 404 unknown_human
 *   - Success: 200 ok + human_users.frozen=1 + operator.human_frozen in audit + sanction_reasons row
 *   - human_users.banned remains 0 (distinct column, not touched by freeze)
 *   - Zero-custody: no wagmi/ethers/web3 imports in route file
 *   - Reason discipline: plaintext not in audit payload; audit has reason_hash only
 *   - Payload uses human_did field, not target_did
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { AuditChain } from '../../src/audit/chain.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { registerFreezeWalletRoute } from '../../src/api/operator/freeze-wallet.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';
import { createHash } from 'node:crypto';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const HUMAN_DID = 'did:noesis:human:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** Stub humanSanctionStore — tracks frozen and banned state independently. */
function makeHumanSanctionStore(existingDids: string[] = [HUMAN_DID]): {
    frozenFlags: Map<string, boolean>;
    bannedFlags: Map<string, boolean>;
    humanSanctionStore: GridServices['humanSanctionStore'];
} {
    const frozenFlags = new Map<string, boolean>(
        existingDids.map(did => [did, false]),
    );
    const bannedFlags = new Map<string, boolean>(
        existingDids.map(did => [did, false]),
    );

    const humanSanctionStore: GridServices['humanSanctionStore'] = {
        existsByDid: async (did: string) => frozenFlags.has(did),
        setBanned: async (did: string) => {
            if (bannedFlags.has(did)) bannedFlags.set(did, true);
        },
        setFrozen: async (did: string) => {
            if (frozenFlags.has(did)) frozenFlags.set(did, true);
        },
    } as unknown as GridServices['humanSanctionStore'];

    return { frozenFlags, bannedFlags, humanSanctionStore };
}

function buildTestApp(opts: {
    humanExists?: boolean;
    sanctionReasonStore?: GridServices['sanctionReasonStore'];
}): {
    app: FastifyInstance;
    audit: AuditChain;
    frozenFlags: Map<string, boolean>;
    bannedFlags: Map<string, boolean>;
    insertCalls: Array<Record<string, unknown>>;
} {
    const audit = new AuditChain();
    const insertCalls: Array<Record<string, unknown>> = [];

    const existingDids = opts.humanExists === false ? [] : [HUMAN_DID];
    const { frozenFlags, bannedFlags, humanSanctionStore } = makeHumanSanctionStore(existingDids);

    const sanctionReasonStore = opts.sanctionReasonStore ?? {
        insert: async (row: Record<string, unknown>) => {
            insertCalls.push(row);
        },
    };

    const services: Partial<GridServices> = {
        clock: new WorldClock({ tickRateMs: 1_000_000 }),
        audit,
        gridName: 'test-grid',
        humanSanctionStore,
        sanctionReasonStore,
    };

    const app = Fastify({ logger: false });
    registerFreezeWalletRoute(app, services as GridServices);

    return { app, audit, frozenFlags, bannedFlags, insertCalls };
}

describe('POST /api/v1/operator/humans/:did/freeze — header-auth contract', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 401 tier_missing when x-operator-tier header is absent', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 401 tier_missing when x-operator-tier is non-numeric', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': 'H5', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json().error).toBe('tier_missing');
    });

    it('returns 403 tier_too_low when x-operator-tier is 4 (< 5)', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '4', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('tier_too_low');
    });

    it('returns 400 invalid_operator_id when x-operator-id header is badly formatted', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': 'not-an-op-id' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_operator_id');
    });

    it('returns 400 invalid_did when DID URL param is malformed', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/humans/not-a-did/freeze',
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid_did');
    });

    it('returns 404 unknown_human when no human_users row exists for DID', async () => {
        ({ app } = buildTestApp({ humanExists: false }));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json().error).toBe('unknown_human');
    });
});

describe('POST /api/v1/operator/humans/:did/freeze — success path', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('returns 200 ok on valid H5 request', async () => {
        ({ app } = buildTestApp({}));
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
            payload: { reason: 'suspicious activity' },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });

    it('sets human_users.frozen = true (and banned remains false) after successful freeze', async () => {
        let frozenFlags: Map<string, boolean>;
        let bannedFlags: Map<string, boolean>;
        ({ app, frozenFlags, bannedFlags } = buildTestApp({}));
        await app.ready();

        expect(frozenFlags.get(HUMAN_DID)).toBe(false);
        expect(bannedFlags.get(HUMAN_DID)).toBe(false);

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
        });

        // frozen flag is set; banned is still untouched (D-25b-NEW-5: distinct columns)
        expect(frozenFlags.get(HUMAN_DID)).toBe(true);
        expect(bannedFlags.get(HUMAN_DID)).toBe(false);
    });

    it('emits operator.human_frozen with human_did field (not target_did)', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
            payload: { reason: 'frozen for review' },
        });

        const entries = audit.query({ eventType: 'operator.human_frozen' });
        expect(entries).toHaveLength(1);
        const payload = entries[0].payload as Record<string, unknown>;
        expect(payload.tier).toBe('H5');
        expect(payload.action).toBe('freeze_wallet');
        expect(payload.operator_id).toBe(OPERATOR);
        expect(payload.human_did).toBe(HUMAN_DID);
        expect(payload).not.toHaveProperty('target_did');
        expect(payload.reason_hash).toBe(sha256('frozen for review'));
        // Reason plaintext must NOT appear in audit payload
        expect(JSON.stringify(payload)).not.toContain('frozen for review');
    });

    it('does NOT emit audit events on error paths (sole-producer invariant)', async () => {
        let audit: AuditChain;
        ({ app, audit } = buildTestApp({}));
        await app.ready();

        // Trigger 401
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
        });

        expect(audit.query({ eventType: 'operator.human_frozen' })).toHaveLength(0);
    });
});

describe('POST /api/v1/operator/humans/:did/freeze — zero-custody invariant (D-25b-NEW-4)', () => {
    it('route file contains no wagmi, ethers, or web3 imports', () => {
        const source = readFileSync(
            new URL('../../src/api/operator/freeze-wallet.ts', import.meta.url),
        ).toString();

        expect(source).not.toMatch(/wagmi/i);
        expect(source).not.toMatch(/ethers/i);
        expect(source).not.toMatch(/web3/i);
    });
});

describe('POST /api/v1/operator/humans/:did/freeze — reason discipline', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        if (app) await app.close();
    });

    it('reason plaintext goes to sanction_reasons; audit payload has only reason_hash', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        const reason = 'detailed freeze reason for operator log';
        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
            payload: { reason },
        });

        // Audit payload must not contain plaintext
        const frozen = audit.query({ eventType: 'operator.human_frozen' });
        expect(frozen).toHaveLength(1);
        expect(JSON.stringify(frozen[0].payload)).not.toContain(reason);
        expect((frozen[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(reason));

        // sanction_reasons must have been called with plaintext
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0]?.plaintext).toBe(reason);
        expect(insertCalls[0]?.reason_hash).toBe(sha256(reason));
        expect(insertCalls[0]?.event_type).toBe('operator.human_frozen');
        expect(insertCalls[0]?.target_did).toBe(HUMAN_DID);
        expect(insertCalls[0]?.operator_id).toBe(OPERATOR);
    });

    it('uses empty-string reason and SHA-256 of empty when reason is absent', async () => {
        let audit: AuditChain;
        let insertCalls: Array<Record<string, unknown>>;

        ({ app, audit, insertCalls } = buildTestApp({}));
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/humans/${HUMAN_DID}/freeze`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR },
            // No body.reason
        });

        const frozen = audit.query({ eventType: 'operator.human_frozen' });
        expect((frozen[0].payload as Record<string, unknown>).reason_hash).toBe(sha256(''));
        expect(insertCalls[0]?.plaintext).toBe('');
    });
});
