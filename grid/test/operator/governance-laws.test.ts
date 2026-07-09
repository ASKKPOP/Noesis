/**
 * Regression tests for registerGovernanceOperatorRoutes.
 *
 * SECURITY 2026-07-09: tier and operator_id are derived from the server-trusted
 * operator_only gate (req.didContext.operatorTier/operatorId), simulated here by
 * withOperatorContext. The pure header-gate cases (tier_missing / invalid_operator_id)
 * moved to grid/test/api/operator-gate.test.ts. This file pins the per-route min-tier
 * gate + the audit payload sourcing for all three governance operator endpoints:
 *   POST   /api/v1/operator/governance/laws       (add law)
 *   PUT    /api/v1/operator/governance/laws/:id   (amend law)
 *   DELETE /api/v1/operator/governance/laws/:id   (repeal law)
 *
 * Structure mirrors grid/test/operator/cognitive-snapshot.test.ts:
 * - Uses Fastify inject (no real server, no WebSocket)
 * - One describe section per endpoint (min-tier + success cases)
 * - Audit payload sourcing verified on success path
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerGovernanceOperatorRoutes } from '../../src/api/operator/governance-laws.js';
import { withOperatorContext, TEST_OPERATOR_ID } from '../helpers/operator-session.js';
import type { GridServices } from '../../src/api/server.js';
import type { Law } from '../../src/logos/types.js';
import { LogosEngine } from '../../src/logos/engine.js';

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
    opts?: { tier?: number },
) {
    const app = Fastify({ logger: false });
    // Simulate the operator_only gate (server-trusted identity/tier).
    withOperatorContext(app, opts?.tier !== undefined ? { tier: opts.tier } : undefined);
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

    it('operator tier 2 (< 3) → 403 tier_too_low', async () => {
        const app = buildTestApp(services, { tier: 2 });
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            payload: { law: FIXTURE_LAW },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('valid operator context + body claiming tier:"H1" → 200; body tier IGNORED, audit sources operator_id from context', async () => {
        const app = buildTestApp(services);
        const bodyOpId = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';  // attacker value
        const resp = await app.inject({
            method: 'POST',
            url: '/api/v1/operator/governance/laws',
            payload: { tier: 'H1', operator_id: bodyOpId, law: FIXTURE_LAW },
        });
        expect(resp.statusCode).toBe(200);
        const { audit } = services;
        const entries = audit!.query({ eventType: 'operator.law_changed' });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        // operator_id must come from operator context, not body
        expect((entry.payload as { operator_id: string }).operator_id).toBe(TEST_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        // tier must be H3 (context-derived), not H1 (body claim)
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

    it('operator tier 2 (< 3) → 403 tier_too_low', async () => {
        const app = buildTestApp(services, { tier: 2 });
        const resp = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            payload: { updates: { title: 'Changed' } },
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('valid operator context + body claiming tier:"H1" → 200; body tier IGNORED, audit sources operator_id from context', async () => {
        const app = buildTestApp(services);
        const bodyOpId = 'op:11111111-2222-4333-8444-555555555555';  // attacker value
        const resp = await app.inject({
            method: 'PUT',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            payload: { tier: 'H1', operator_id: bodyOpId, updates: { title: 'Amended' } },
        });
        expect(resp.statusCode).toBe(200);
        const { audit } = services;
        const entries = audit!.query({ eventType: 'operator.law_changed' });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect((entry.payload as { operator_id: string }).operator_id).toBe(TEST_OPERATOR_ID);
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

    it('operator tier 2 (< 3) → 403 tier_too_low', async () => {
        const app = buildTestApp(services, { tier: 2 });
        const resp = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
        });
        expect(resp.statusCode).toBe(403);
        expect(JSON.parse(resp.body).error).toBe('tier_too_low');
    });

    it('valid operator context + body claiming tier:"H1" → 200; body tier IGNORED, audit sources operator_id from context', async () => {
        const app = buildTestApp(services);
        const bodyOpId = 'op:bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';  // attacker value
        const resp = await app.inject({
            method: 'DELETE',
            url: `/api/v1/operator/governance/laws/${FIXTURE_LAW.id}`,
            payload: { tier: 'H1', operator_id: bodyOpId },
        });
        expect(resp.statusCode).toBe(200);
        const { audit } = services;
        const entries = audit!.query({ eventType: 'operator.law_changed' });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        expect((entry.payload as { operator_id: string }).operator_id).toBe(TEST_OPERATOR_ID);
        expect((entry.payload as { operator_id: string }).operator_id).not.toBe(bodyOpId);
        expect(entry.payload['tier']).toBe('H3');
        expect(entry.payload['action']).toBe('repeal');
    });
});
