/**
 * Phase 28 SPAWN-04 — bootstrapPsycheHash personalitySeed extension.
 *
 * Validates that spawnNous accepts an optional personalitySeed and
 * forwards it to bootstrapPsycheHash, producing a deterministically
 * distinct bios.birth psyche_hash compared to the seedless case.
 *
 * Note: bootstrapPsycheHash is a module-private function; we test it
 * indirectly via the bios.birth audit entry emitted during spawnNous.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { TEST_CONFIG } from '../../src/genesis/presets.js';

function makeLauncher(): GenesisLauncher {
    return new GenesisLauncher({ ...TEST_CONFIG, tickRateMs: 100_000 });
}

/** Expected bootstrapPsycheHash without seed: SHA-256(did|pk|tick) */
function expectedHash(did: string, pk: string, tick: number, seed?: string): string {
    const input = seed ? `${did}|${pk}|${tick}|${seed}` : `${did}|${pk}|${tick}`;
    return createHash('sha256').update(input).digest('hex');
}

describe('bootstrapPsycheHash — personalitySeed extension', () => {
    it('spawnNous without personalitySeed emits bios.birth with hash matching SHA-256(did|pk|tick)', () => {
        const launcher = makeLauncher();
        launcher.bootstrap();
        const tick = launcher.clock.currentTick;

        const did = 'did:noesis:test-no-seed-a';
        const pk = 'pubkey-no-seed-a';
        launcher.spawnNous('TestNousA', did, pk, 'alpha');

        const entries = launcher.audit.query({ eventType: 'bios.birth' });
        const entry = entries.find(e => e.actorDid === did);
        expect(entry).toBeDefined();
        const payload = entry!.payload as Record<string, unknown>;
        expect(payload.psyche_hash).toBe(expectedHash(did, pk, tick));
    });

    it('spawnNous with personalitySeed emits bios.birth with hash matching SHA-256(did|pk|tick|seed)', () => {
        const launcher = makeLauncher();
        launcher.bootstrap();
        const tick = launcher.clock.currentTick;

        const did = 'did:noesis:test-with-seed-b';
        const pk = 'pubkey-with-seed-b';
        launcher.spawnNous('TestNousB', did, pk, 'alpha', undefined, 'Explorer');

        const entries = launcher.audit.query({ eventType: 'bios.birth' });
        const entry = entries.find(e => e.actorDid === did);
        expect(entry).toBeDefined();
        const payload = entry!.payload as Record<string, unknown>;
        expect(payload.psyche_hash).toBe(expectedHash(did, pk, tick, 'Explorer'));
    });

    it('Explorer and Scholar seeds produce different hashes for same DID/key/tick', () => {
        const did = 'did:noesis:test-seed-compare';
        const pk = 'pubkey-compare';
        const tick = 0;
        const explorerHash = expectedHash(did, pk, tick, 'Explorer');
        const scholarHash = expectedHash(did, pk, tick, 'Scholar');
        expect(explorerHash).not.toBe(scholarHash);
    });

    it('spawnNous with humanOwner but no seed still works (both new params optional)', () => {
        const launcher = makeLauncher();
        launcher.bootstrap();

        const did = 'did:noesis:test-owner-no-seed-c';
        const pk = 'pubkey-owner-no-seed-c';
        expect(() =>
            launcher.spawnNous('TestNousC', did, pk, 'alpha', 'did:noesis:human-owner'),
        ).not.toThrow();
    });
});
