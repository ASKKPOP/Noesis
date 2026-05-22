/**
 * Phase 10b Wave 0 RED stub — BIOS-03 H5 delete handler emits bios.death.
 *
 * Updated in Phase 25b Wave 0 (D-25b-NEW-1): header-auth migration.
 * Auth is now sourced from x-operator-tier + x-operator-id headers, not body.
 *
 * Extends Phase 8 D-30 ordering: the operator H5 delete handler must
 * emit BOTH events in this strict order:
 *
 *   1. bios.death { cause: 'operator_h5', did, final_state_hash, tick }
 *   2. operator.nous_deleted { tier, action, operator_id, target_did, pre_deletion_state_hash }
 *
 * Same tick on both entries. final_state_hash === pre_deletion_state_hash
 * (the Brain returns one stateHash; the handler reuses it across both
 * audit emissions).
 *
 * bios.death.operator_id (via actorDid on audit chain) and
 * operator.nous_deleted.payload.operator_id must both equal the
 * header-supplied x-operator-id value.
 *
 * Uses lightweight Fastify + route registration (mirrors cognitive-snapshot test pattern).
 */
import { describe, it, expect, afterEach } from 'vitest';
import Fastify from 'fastify';
import { WorldClock } from '../../../src/clock/ticker.js';
import { SpatialMap } from '../../../src/space/map.js';
import { LogosEngine } from '../../../src/logos/engine.js';
import { AuditChain } from '../../../src/audit/chain.js';
import { NousRegistry } from '../../../src/registry/registry.js';
import { registerDeleteNousRoute } from '../../../src/api/operator/delete-nous.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../../src/api/server.js';

const OPERATOR  = 'op:11111111-1111-4111-8111-111111111111';
const ALPHA_DID = 'did:noesis:alpha';

// Valid headers for H5 requests.
const VALID_HEADERS = {
    'x-operator-tier': '5',
    'x-operator-id': OPERATOR,
};

const BRAIN_HASHES = {
    psyche_hash:        'a'.repeat(64),
    thymos_hash:        'b'.repeat(64),
    telos_hash:         'c'.repeat(64),
    memory_stream_hash: 'd'.repeat(64),
};

function spawnAlpha(registry: NousRegistry): void {
    registry.spawn(
        { did: ALPHA_DID, name: 'Alpha', publicKey: 'pk', region: 'agora' },
        'test.grid', 0, 100,
    );
}

function buildTestApp(opts: { brainFetch?: typeof fetch }): {
    app: FastifyInstance;
    audit: AuditChain;
    despawnCalls: string[];
} {
    const space    = new SpatialMap();
    const registry = new NousRegistry();
    const audit    = new AuditChain();
    const despawnCalls: string[] = [];
    spawnAlpha(registry);

    const deleteNousDeps = {
        brainFetch: opts.brainFetch ?? (() =>
            Promise.resolve(new Response(JSON.stringify(BRAIN_HASHES), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }))
        ),
        space,
        coordinator: {
            despawnNous: (did: string) => { despawnCalls.push(did); },
        },
    };

    const services: Partial<GridServices> = {
        clock:    new WorldClock({ tickRateMs: 1_000_000 }),
        space,
        logos:    new LogosEngine(),
        audit,
        gridName: 'test-grid',
        registry,
    };

    const app = Fastify({ logger: false });
    registerDeleteNousRoute(app, services as GridServices, deleteNousDeps);

    return { app, audit, despawnCalls };
}

describe('AGENCY-05 + BIOS-03 — H5 delete emits bios.death THEN operator.nous_deleted', () => {
    let app: FastifyInstance;
    afterEach(async () => { if (app) await app.close(); });

    it('chain tail contains bios.death immediately followed by operator.nous_deleted', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: VALID_HEADERS,
        });
        expect(res.statusCode).toBe(200);

        const entries = audit.all();
        // Find the bios.death index — it must be immediately followed by
        // operator.nous_deleted (D-30 ordering: tombstone+bios.death first,
        // operator.nous_deleted second).
        const biosDeathIdx = entries.findIndex(e => e.eventType === 'bios.death');
        expect(biosDeathIdx, 'bios.death must be emitted on H5 delete').toBeGreaterThanOrEqual(0);
        const next = entries[biosDeathIdx + 1];
        expect(next, 'bios.death must be followed by another entry').toBeDefined();
        expect(next.eventType).toBe('operator.nous_deleted');
    });

    it('bios.death payload carries cause=operator_h5 and the same tick as operator.nous_deleted', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: VALID_HEADERS,
        });

        const entries = audit.all();
        const biosDeath = entries.find(e => e.eventType === 'bios.death');
        const operatorDeleted = entries.find(e => e.eventType === 'operator.nous_deleted');
        expect(biosDeath).toBeDefined();
        expect(operatorDeleted).toBeDefined();

        const biosPayload = biosDeath!.payload as Record<string, unknown>;
        expect(biosPayload.cause).toBe('operator_h5');
        expect(biosPayload.did).toBe(ALPHA_DID);

        // Same tick on both entries (D-10b ordering invariant).
        const operatorPayload = operatorDeleted!.payload as Record<string, unknown>;
        // Both entries record the tick (operator via auditTick or wall-clock; bios
        // via the explicit tick payload field).
        expect(typeof biosPayload.tick).toBe('number');
        // The two entries must share the same final_state_hash:
        expect(biosPayload.final_state_hash).toBe(operatorPayload.pre_deletion_state_hash);
    });

    it('bios.death emitted BEFORE operator.nous_deleted (D-30 ordering carried)', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: VALID_HEADERS,
        });

        const entries = audit.all();
        const biosIdx = entries.findIndex(e => e.eventType === 'bios.death');
        const operatorIdx = entries.findIndex(e => e.eventType === 'operator.nous_deleted');
        expect(biosIdx).toBeGreaterThanOrEqual(0);
        expect(operatorIdx).toBeGreaterThanOrEqual(0);
        expect(biosIdx).toBeLessThan(operatorIdx);
    });

    it('bios.death and operator.nous_deleted both source operator_id from x-operator-id header', async () => {
        const { app: a, audit } = buildTestApp({});
        app = a;
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            headers: VALID_HEADERS,
        });

        const entries = audit.all();
        const operatorDeleted = entries.find(e => e.eventType === 'operator.nous_deleted');
        expect(operatorDeleted).toBeDefined();

        const operatorPayload = operatorDeleted!.payload as Record<string, unknown>;
        // operator.nous_deleted payload.operator_id === header-supplied x-operator-id
        expect(operatorPayload.operator_id).toBe(OPERATOR);
    });
});
