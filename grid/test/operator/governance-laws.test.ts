/**
 * Regression tests for registerGovernanceOperatorRoutes — header-auth contract.
 *
 * Phase 25b Wave 0 (D-25b-NEW-1): tier and operator_id are now derived from
 * server-trusted request headers (x-operator-tier, x-operator-id), NOT from
 * the request body. This file pins that contract for all three governance
 * operator endpoints:
 *   POST   /api/v1/operator/governance/laws       (add law)
 *   PUT    /api/v1/operator/governance/laws/:id   (amend law)
 *   DELETE /api/v1/operator/governance/laws/:id   (repeal law)
 *
 * Structure mirrors grid/test/operator/cognitive-snapshot.test.ts:
 * - Uses Fastify inject (no real server, no WebSocket)
 * - One describe('header-auth contract') section per endpoint (4 cases each)
 * - Audit payload sourcing verified on success path
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerGovernanceOperatorRoutes } from '../../src/api/operator/governance-laws.js';
import type { GridServices } from '../../src/api/server.js';
import type { Law } from '../../src/logos/types.js';
import { LogosEngine } from '../../src/logos/engine.js';

// Valid operator_id matching OPERATOR_ID_REGEX
const VALID_OPERATOR_ID = 'op:12345678-1234-4abc-89ab-123456789012';
const VALID_HEADERS = {
    'x-operator-tier': '3',
    'x-operator-id': VALID_OPERATOR_ID,
};

const FIXTURE_LAW: Law = {
    id: 'law.test.header.001',
    title: 'Header Auth Test Law',
    description: 'For header-auth contract testing only',
    ruleLogic: {
        condition: { type: 'true' },
        action: 'allow',
        sanction_on_violation: 'warning',
    },
    severity: 'minor',
    status: 'active',
};

function buildTestApp(
    services: Partial<GridServices> & { audit: AuditChain },
) {
    const app = Fastify({ logger: false });
    registerGovernanceOperatorRoutes(app, services as GridServices);
    return app;
}

function makeServices(): Partial<GridServices> & { audit: AuditChain } {
    return {
        audit: new AuditChain(),
        logos: new LogosEngine(),
    } as unknown as Partial<GridServices> & { audit: AuditChain };
}

// ── POST /api/v1/operator/governance/laws — add law ─────────────────────────

describe('POST /api/v1/operator/governance/laws — header-auth contract', () => {
    let services: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        services = makeServices();
    });

    it('no headers + body {tier:"H5"} → 401 tier_missing (body tier ignored)', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            // No x-operator-tier header — body claims tier but must be ignored
            payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID, law: FIXTURE_LAW },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('header x-operator-tier:"2" → 403 tier_too_low', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
            payload: { law: FIXTURE_LAW },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('header x-operator-tier:"3", missing/bad x-operator-id → 400 invalid_operator_id', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'op:steward:default' },
            payload: { law: FIXTURE_LAW },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('header x-operator-tier:"3" + valid x-operator-id + body claiming tier:"H1" → 200; body tier IGNORED, audit sources operator_id from header', async () => {
        const app = buildTestApp(services);
        const bodyOpId = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';  // attacker value
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            headers: VALID_HEADERS,
            payload: { tier: 'H1', operator_id: bodyOpId, law: FIXTURE_LAW },
        });
        expect(resp.statusCode).toBe(200);
        const { audit } = services;
        const entries = audit!.query({ eventType: 'operator.law_changed' });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        // operator_id must come from header, not body
        expect((entry.payload as { operator_id: string }).operator_id).toBe(VALID_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        // tier must be H3 (header-derived), not H1 (body claim)
        expect(entry.payload['tier']).toBe('H3');
        expect(entry.payload['action']).toBe('add');
    });
});

// ── PUT /api/v1/operator/governance/laws/:id — amend law ────────────────────

describe('PUT /api/v1/operator/governance/laws/:id — header-auth contract', () => {
    let services: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        services = makeServices();
        // Pre-seed the law so amend doesn't hit 404
        (services.logos as LogosEngine).addLaw(FIXTURE_LAW);
    });

    it('no headers + body {tier:"H5"} → 401 tier_missing (body tier ignored)', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID, updates: { title: 'Changed' } },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('header x-operator-tier:"2" → 403 tier_too_low', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
            payload: { updates: { title: 'Changed' } },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('header x-operator-tier:"3", missing/bad x-operator-id → 400 invalid_operator_id', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: { 'x-operator-tier': '3' },  // missing x-operator-id
            payload: { updates: { title: 'Changed' } },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('header x-operator-tier:"3" + valid x-operator-id + body claiming tier:"H1" → 200; body tier IGNORED, audit sources operator_id from header', async () => {
        const app = buildTestApp(services);
        const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';  // attacker value
        const resp = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: VALID_HEADERS,
            payload: { tier: 'H1', operator_id: bodyOpId, updates: { title: 'Amended' } },
        });
        expect(resp.statusCode).toBe(200);
        const { audit } = services;
        const entries = audit!.query({ eventType: 'operator.law_changed' });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect((entry.payload as { operator_id: string }).operator_id).toBe(VALID_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        expect(entry.payload['tier']).toBe('H3');
        expect(entry.payload['action']).toBe('amend');
    });
});

// ── DELETE /api/v1/operator/governance/laws/:id — repeal law ────────────────

describe('DELETE /api/v1/operator/governance/laws/:id — header-auth contract', () => {
    let services: Partial<GridServices> & { audit: AuditChain };

    beforeEach(() => {
        services = makeServices();
        // Pre-seed the law so repeal doesn't hit 404
        (services.logos as LogosEngine).addLaw(FIXTURE_LAW);
    });

    it('no headers + body {tier:"H5"} → 401 tier_missing (body tier ignored)', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            payload: { tier: 'H5', operator_id: VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(401);
        expect(JSON.parse(resp.body).error).toBe('tier_missing');
    });

    it('header x-operator-tier:"2" → 403 tier_too_low', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('header x-operator-tier:"3", missing/bad x-operator-id → 400 invalid_operator_id', async () => {
        const app = buildTestApp(services);
        const resp = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: { 'x-operator-tier': '3', 'x-operator-id': 'invalid-format' },
        });
        expect(resp.statusCode).toBe(400);
        expect(JSON.parse(resp.body).error).toBe('invalid_operator_id');
    });

    it('header x-operator-tier:"3" + valid x-operator-id + body claiming tier:"H1" → 200; body tier IGNORED, audit sources operator_id from header', async () => {
        const app = buildTestApp(services);
        const bodyOpId = 'op:bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';  // attacker value
        const resp = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            headers: VALID_HEADERS,
            payload: { tier: 'H1', operator_id: bodyOpId },
        });
        expect(resp.statusCode).toBe(200);
        const { audit } = services;
        const entries = audit!.query({ eventType: 'operator.law_changed' });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect((entry.payload as { operator_id: string }).operator_id).toBe(VALID_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        expect(entry.payload['tier']).toBe('H3');
        expect(entry.payload['action']).toBe('repeal');
    });
});
