/**
 * Phase 36 Wave 0 — ROUTE_DID_POLICY coverage test.
 *
 * VIS-04: Every registered Fastify route under /api/v1/ and /portal/ MUST be
 * present in the ROUTE_DID_POLICY table.
 *
 * Also asserts the policy enum is exactly the 6 values defined in D-36-17.
 *
 * Tests fail RED because:
 * 1. grid/src/api/policy.ts does not exist yet (Plan 02 creates it).
 * 2. The route-coverage assertion will fail until Plan 02 wires the policy preHandler.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { ROUTE_DID_POLICY, ROUTE_DID_POLICY_VALUES } from '../../src/api/policy.js';
import type { FastifyInstance } from 'fastify';

const GRID_NAME = 'genesis';

function buildTestServer(): FastifyInstance {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    return buildServer({ clock, space, logos, audit, gridName: GRID_NAME });
}

describe('ROUTE_DID_POLICY — enum shape', () => {
    it('ROUTE_DID_POLICY_VALUES contains exactly the 7 policy strings (D-36-17 + operator_only)', () => {
        const expected = [
            'public',
            'portal_session_required',
            'civic_did_required',
            'business_did_required',
            'government_only',
            'police_only',
            'operator_only', // SECURITY 2026-07-09 — server-trusted operator gate
        ];
        expect([...ROUTE_DID_POLICY_VALUES].sort()).toEqual(expected.sort());
        expect(ROUTE_DID_POLICY_VALUES.length).toBe(7);
    });
});

describe('ROUTE_DID_POLICY — coverage gate', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildTestServer();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('every registered /api/v1/ and /portal/ route has a policy entry', () => {
        // Parse registered routes from app.printRoutes()
        const routeTree = app.printRoutes();
        const lines = routeTree.split('\n');

        // Extract METHOD + path lines (Fastify v5 format: "GET /path" or similar)
        const routePattern = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b.*?(\/(?:api\/v1|portal)\/[^\s]*)/;
        const violations: string[] = [];

        for (const line of lines) {
            const match = line.match(routePattern);
            if (!match) continue;
            const method = match[1];
            const path = match[2].trim();
            const key = `${method} ${path}`;
            if (!(key in ROUTE_DID_POLICY)) {
                violations.push(key);
            }
        }

        if (violations.length > 0) {
            throw new Error(
                `Routes missing from ROUTE_DID_POLICY (add them in grid/src/api/policy.ts):\n${violations.join('\n')}`,
            );
        }
        expect(violations.length).toBe(0);
    });
});
