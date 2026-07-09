/**
 * Phase 6 Plan 04 Task 2 — POST /api/v1/operator/clock/{pause,resume}.
 *
 * AGENCY-02 H3 + AGENCY-03. Contract:
 *   1. Allowlisted operator (Portal-session cookie) → 200 + idempotent side effects
 *   2. Operator tier < 3 → 403 tier_too_low (NO audit event)
 *   3. Idempotency: already-paused pause still 200 but does NOT re-emit audit
 *   4. Every emitted operator.paused / operator.resumed passes appendOperatorEvent's
 *      tier-required + payload-privacy gates from Plan 01
 *   5. WsHub broadcasts the new operator.* events over the firehose (D-10 allowlist
 *      entries from Plan 01)
 *   6. Tier + operator_id in the audit payload are server-trusted (resolved by the
 *      operator_only gate from the session DID, SECURITY 2026-07-09) — never from body.
 *
 * SECURITY 2026-07-09: pure header-gate cases (tier_missing / invalid_operator_id)
 * are covered centrally by grid/test/api/operator-gate.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer, buildServerWithHub } from '../../../src/api/server.js';
import { WorldClock } from '../../../src/clock/ticker.js';
import { SpatialMap } from '../../../src/space/map.js';
import { LogosEngine } from '../../../src/logos/engine.js';
import { AuditChain } from '../../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../../src/api/portal/auth.js';
import type { OperatorGrant } from '../../../src/api/preHandlers/operatorAuth.js';
import type { FastifyInstance } from 'fastify';
import type { ServerSocket } from '../../../src/api/ws-hub.js';

const VALID_OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const OPERATOR_DID = 'did:noesis:human:0xoperator';
// Server-trusted operator identity is resolved from the Portal-session cookie's DID
// against this allowlist (mirrors grid/test/api/operator-gate.test.ts).
const ALLOW = new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: VALID_OP_ID, tier: 5 }]]);
const ALLOW_TIER2 = new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: VALID_OP_ID, tier: 2 }]]);

async function cookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, grid_name: 'test-grid' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

function seedServices(): {
    clock: WorldClock;
    space: SpatialMap;
    logos: LogosEngine;
    audit: AuditChain;
    gridName: string;
} {
    return {
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'test-grid',
    };
}

// FakeSocket for WsHub assertions (mirrors grid/test/ws-hub.test.ts pattern).
class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;
    private listeners: {
        message: Array<(data: unknown) => void>;
        close: Array<() => void>;
        error: Array<(err: Error) => void>;
    } = { message: [], close: [], error: [] };

    send(data: string): void { this.sent.push(data); }
    close(): void { this.closed = true; }
    on(event: 'message' | 'close' | 'error', cb: (...args: unknown[]) => void): void {
        (this.listeners[event] as Array<(...args: unknown[]) => void>).push(cb);
    }
}

describe('POST /api/v1/operator/clock/pause — AGENCY-02 H3', () => {
    let services: ReturnType<typeof seedServices>;
    let app: FastifyInstance;

    beforeEach(async () => {
        services = seedServices();
        // WorldClock.pause() short-circuits when there's no interval to clear
        // (ticker-pause-resume Test 3). Production pause semantics only make
        // sense on a running clock, so seed each pause-scoped test with start().
        services.clock.start();
        app = buildServer({ ...services, operatorAllowlist: ALLOW });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('Test 1: happy path — pauses clock, returns 200, emits exactly one operator.paused', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true, paused: true });
        expect(services.clock.isPaused).toBe(true);

        const entries = services.audit.query({ eventType: 'operator.paused' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload).toEqual({
            tier: 'H3', action: 'pause', operator_id: VALID_OP_ID,
        });
    });

    it('Test 4: 403 tier_too_low when operator tier < 3 (endpoint is H3-only per D-09)', async () => {
        await app.close();
        app = buildServer({ ...services, operatorAllowlist: ALLOW_TIER2 });
        await app.ready();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: 'tier_too_low' });
        expect(services.audit.query({ eventType: 'operator.paused' }).length).toBe(0);
    });

    it('Test 7: idempotent — second pause call still 200 but emits only ONE audit event', async () => {
        const r1 = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        const r2 = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(r1.statusCode).toBe(200);
        expect(r2.statusCode).toBe(200);
        expect(services.clock.isPaused).toBe(true);
        // Only the first call should have emitted — the second is a no-op.
        const entries = services.audit.query({ eventType: 'operator.paused' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload.operator_id).toBe(VALID_OP_ID);
    });

    it('Test 9: tier stamp in audit payload is the server-trusted H3 — no server-side substitution to another tier', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        const entry = services.audit.query({ eventType: 'operator.paused' })[0];
        expect(entry.payload.tier).toBe('H3');
        // Defensive: no H1/H2/H4 leaked in from a server default path.
        expect(entry.payload.tier).not.toBe('H1');
        expect(entry.payload.tier).not.toBe('H2');
        expect(entry.payload.tier).not.toBe('H4');
    });
});

describe('POST /api/v1/operator/clock/resume — AGENCY-02 H3', () => {
    let services: ReturnType<typeof seedServices>;
    let app: FastifyInstance;

    beforeEach(async () => {
        services = seedServices();
        app = buildServer({ ...services, operatorAllowlist: ALLOW });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('Test 2: happy path — after a prior pause, resume returns 200 + emits operator.resumed', async () => {
        // Seed a pause first.
        services.clock.start();
        services.clock.pause();
        expect(services.clock.isPaused).toBe(true);

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true, paused: false });
        expect(services.clock.isPaused).toBe(false);

        const entries = services.audit.query({ eventType: 'operator.resumed' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload).toEqual({
            tier: 'H3', action: 'resume', operator_id: VALID_OP_ID,
        });
    });

    it('resume when not paused is idempotent — 200 but NO audit event emitted', async () => {
        expect(services.clock.isPaused).toBe(false);
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/resume',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(200);
        expect(services.audit.query({ eventType: 'operator.resumed' }).length).toBe(0);
    });
});

describe('operator.paused broadcast over WsHub — D-10 allowlist integration (Test 8)', () => {
    it('operator.paused audit entry is fanned out over the broadcast firehose', async () => {
        const services = seedServices();
        services.clock.start(); // see beforeEach comment above
        const { app, wsHub } = buildServerWithHub({ ...services, operatorAllowlist: ALLOW });
        await app.ready();

        const sock = new FakeSocket();
        wsHub.onConnect(sock);
        // Drop the hello frame.
        expect(sock.sent.length).toBe(1);
        const hello = JSON.parse(sock.sent[0]);
        expect(hello.type).toBe('hello');

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/clock/pause',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(200);

        // hello + event
        expect(sock.sent.length).toBe(2);
        const frame = JSON.parse(sock.sent[1]);
        expect(frame.type).toBe('event');
        expect(frame.entry.eventType).toBe('operator.paused');
        expect(frame.entry.payload).toEqual({
            tier: 'H3', action: 'pause', operator_id: VALID_OP_ID,
        });

        await app.close();
        services.clock.stop();
    });
});
