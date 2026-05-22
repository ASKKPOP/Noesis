/**
 * Phase 6 Plan 04 Task 3 — POST / PUT / DELETE /api/v1/operator/governance/laws.
 *
 * AGENCY-02 H3 + AGENCY-03. D-11 payload privacy: operator.law_changed
 * payload keys are a closed tuple {tier, action, operator_id, law_id,
 * change_type} — law body NEVER appears in the broadcast payload (T-6-06).
 * Law body remains accessible through GET /api/v1/governance/laws/:id
 * (existing Phase 4 endpoint, not broadcast-scoped).
 *
 * Updated Phase 25b (D-25b-NEW-1): tier and operator_id now sourced from
 * server-trusted x-operator-tier / x-operator-id headers, not request body.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../../src/api/server.js';
import { WorldClock } from '../../../src/clock/ticker.js';
import { SpatialMap } from '../../../src/space/map.js';
import { LogosEngine } from '../../../src/logos/engine.js';
import { AuditChain } from '../../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';
import type { Law } from '../../../src/logos/types.js';

const VALID_OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const VALID_HEADERS = {
    'x-operator-tier': '3',
    'x-operator-id': VALID_OP_ID,
};

const FIXTURE_LAW: Law = {
    id: 'law.test.001',
    title: 'Test Law',
    description: 'For testing only',
    ruleLogic: {
        condition: { type: 'true' },
        action: 'allow',
        sanction_on_violation: 'warning',
    },
    severity: 'minor',
    status: 'active',
};

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

describe('Operator governance CRUD — AGENCY-02 H3 + D-11 privacy', () => {
    let services: ReturnType<typeof seedServices>;
    let app: FastifyInstance;

    beforeEach(async () => {
        services = seedServices();
        app = buildServer(services);
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
        services.clock.stop();
    });

    it('Test 1: POST add — adds law, returns 200+law_id, emits one operator.law_changed {change_type:added}', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: VALID_HEADERS,
            payload: { law: FIXTURE_LAW },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true, law_id: FIXTURE_LAW.id });
        expect(services.logos.getLaw(FIXTURE_LAW.id)?.title).toBe('Test Law');

        const entries = services.audit.query({ eventType: 'operator.law_changed' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload).toEqual({
            tier: 'H3',
            action: 'add',
            operator_id: VALID_OP_ID,
            law_id: FIXTURE_LAW.id,
            change_type: 'added',
        });
    });

    it('Test 2: PUT amend — replaces in place, emits change_type:amended', async () => {
        services.logos.addLaw(FIXTURE_LAW);
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: VALID_HEADERS,
            payload: {
                updates: { title: 'Amended' },
            },
        });
        expect(res.statusCode).toBe(200);
        expect(services.logos.getLaw(FIXTURE_LAW.id)?.title).toBe('Amended');

        const entries = services.audit.query({ eventType: 'operator.law_changed' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload.change_type).toBe('amended');
        expect(entries[0].payload.action).toBe('amend');
    });

    it('Test 3: DELETE repeal — removes law, emits change_type:repealed', async () => {
        services.logos.addLaw(FIXTURE_LAW);
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: VALID_HEADERS,
        });
        expect(res.statusCode).toBe(200);
        expect(services.logos.getLaw(FIXTURE_LAW.id)).toBeUndefined();

        const entries = services.audit.query({ eventType: 'operator.law_changed' });
        expect(entries.length).toBe(1);
        expect(entries[0].payload.change_type).toBe('repealed');
    });

    it('Test 4: PUT amend on missing law returns 404 + no audit event', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/api/v1/operator/governance/laws/law.nonexistent',
            headers: VALID_HEADERS,
            payload: {
                updates: { title: 'x' },
            },
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'law_not_found' });
        expect(services.audit.query({ eventType: 'operator.law_changed' }).length).toBe(0);
    });

    it('Test 5: DELETE on missing law returns 404 + no audit event', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/api/v1/operator/governance/laws/law.nonexistent',
            headers: VALID_HEADERS,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'law_not_found' });
        expect(services.audit.query({ eventType: 'operator.law_changed' }).length).toBe(0);
    });

    it('Test 6: 403 tier_too_low on POST — no audit event, law NOT added', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OP_ID },
            payload: { law: FIXTURE_LAW },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: 'tier_too_low' });
        expect(services.logos.getLaw(FIXTURE_LAW.id)).toBeUndefined();
        expect(services.audit.query({ eventType: 'operator.law_changed' }).length).toBe(0);
    });

    it('Test 6b: 401 tier_missing on PUT — no audit event, law not amended', async () => {
        services.logos.addLaw(FIXTURE_LAW);
        const res = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            payload: { updates: { title: 'X' } },
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ error: 'tier_missing' });
        expect(services.logos.getLaw(FIXTURE_LAW.id)?.title).toBe('Test Law');
        expect(services.audit.query({ eventType: 'operator.law_changed' }).length).toBe(0);
    });

    it('Test 6c: 401 tier_missing on DELETE — no audit event, law not removed', async () => {
        services.logos.addLaw(FIXTURE_LAW);
        const res = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
        });
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ error: 'tier_missing' });
        expect(services.logos.getLaw(FIXTURE_LAW.id)).toBeDefined();
        expect(services.audit.query({ eventType: 'operator.law_changed' }).length).toBe(0);
    });

    it('Test 7: 400 invalid_operator_id on any endpoint — no audit event', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'bogus' },
            payload: { law: FIXTURE_LAW },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid_operator_id' });
        expect(services.audit.query({ eventType: 'operator.law_changed' }).length).toBe(0);
    });

    it('Test 8 (THE PRIVACY TEST — D-11 / T-6-06 closure): operator.law_changed payload keys are exactly {tier, action, operator_id, law_id, change_type} — no law body fields leak', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: VALID_HEADERS,
            payload: { law: FIXTURE_LAW },
        });
        const entry = services.audit.query({ eventType: 'operator.law_changed' })[0];
        expect(entry).toBeDefined();
        // Structural assertion: the exact tuple, nothing more.
        expect(Object.keys(entry.payload).sort()).toEqual(
            ['action', 'change_type', 'law_id', 'operator_id', 'tier'],
        );
        // Defensive: explicit absence checks for each forbidden law-body field.
        expect(entry.payload).not.toHaveProperty('law');
        expect(entry.payload).not.toHaveProperty('title');
        expect(entry.payload).not.toHaveProperty('description');
        expect(entry.payload).not.toHaveProperty('ruleLogic');
        expect(entry.payload).not.toHaveProperty('severity');
        expect(entry.payload).not.toHaveProperty('status');
    });

    it('Test 9: tier literal survives through the wire — no substitution', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: VALID_HEADERS,
            payload: { law: FIXTURE_LAW },
        });
        const entry = services.audit.query({ eventType: 'operator.law_changed' })[0];
        expect(entry.payload.tier).toBe('H3');
    });
});
