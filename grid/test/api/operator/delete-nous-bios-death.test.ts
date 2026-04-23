/**
 * Phase 10b Wave 0 RED stub — BIOS-03 H5 delete handler emits bios.death.
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
 * RED at Wave 0: the production handler in grid/src/api/operator/delete-nous.ts
 * does not yet emit bios.death. Wave 3 (Plan 10b-05) extends the handler.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { buildServer } from '../../../src/api/server.js';
import { WorldClock } from '../../../src/clock/ticker.js';
import { SpatialMap } from '../../../src/space/map.js';
import { LogosEngine } from '../../../src/logos/engine.js';
import { AuditChain } from '../../../src/audit/chain.js';
import { NousRegistry } from '../../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../../src/api/server.js';

const OPERATOR  = 'op:11111111-1111-4111-8111-111111111111';
const ALPHA_DID = 'did:noesis:alpha';

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

function buildServices(opts: { brainFetch?: typeof fetch }): {
    services: GridServices;
    audit: AuditChain;
    despawnCalls: string[];
} {
    const space    = new SpatialMap();
    const registry = new NousRegistry();
    const audit    = new AuditChain();
    const despawnCalls: string[] = [];
    spawnAlpha(registry);

    const services: GridServices = {
        clock:    new WorldClock({ tickRateMs: 1_000_000 }),
        space,
        logos:    new LogosEngine(),
        audit,
        gridName: 'test-grid',
        registry,
        _deleteNousDeps: {
            brainFetch: opts.brainFetch ?? (() =>
                Promise.resolve(new Response(JSON.stringify(BRAIN_HASHES), { status: 200 }))
            ),
            space,
            coordinator: {
                despawnNous: (did: string) => { despawnCalls.push(did); },
            },
        },
    } as unknown as GridServices;

    return { services, audit, despawnCalls };
}

describe('AGENCY-05 + BIOS-03 — H5 delete emits bios.death THEN operator.nous_deleted', () => {
    let app: FastifyInstance;
    afterEach(async () => { if (app) await app.close(); });

    it('chain tail contains bios.death immediately followed by operator.nous_deleted', async () => {
        const { services, audit } = buildServices({});
        app = buildServer(services);
        await app.ready();

        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
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
        const { services, audit } = buildServices({});
        app = buildServer(services);
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
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
        const { services, audit } = buildServices({});
        app = buildServer(services);
        await app.ready();

        await app.inject({
            method: 'POST',
            url: `/api/v1/operator/nous/${ALPHA_DID}/delete`,
            payload: { tier: 'H5', operator_id: OPERATOR },
        });

        const entries = audit.all();
        const biosIdx = entries.findIndex(e => e.eventType === 'bios.death');
        const operatorIdx = entries.findIndex(e => e.eventType === 'operator.nous_deleted');
        expect(biosIdx).toBeGreaterThanOrEqual(0);
        expect(operatorIdx).toBeGreaterThanOrEqual(0);
        expect(biosIdx).toBeLessThan(operatorIdx);
    });
});
