import { describe, it, expect } from 'vitest';

/**
 * RIG-05: rig exit tarball reuses Phase 13 buildExportTarball UNCHANGED.
 * Determinism contract: same chain entries + same manifest + same snapshots
 * → same tarball SHA-256 across N builds.
 *
 * RED until Wave 2 wires scripts/rig.mjs to call buildExportTarball with rig
 * isolated chain entries.
 */
describe('Rig exit tarball integrity (RIG-05)', () => {
    it('FAILS UNTIL Wave 2: tarball over rig isolated chain produces stable SHA-256 across 3 builds', () => {
        // Pseudocode for Wave 2 reference:
        // const rigChain = buildSyntheticRigChain({ seed: 'd4...', tickBudget: 100 });
        // const manifest = createManifest({ startTick: 0, endTick: 100, entryCount: rigChain.length, chainTailHash: '...' });
        // const builds = await Promise.all([1,2,3].map(() => buildExportTarball({ chainSlice: rigChain, ..., manifest })));
        // expect(builds[0].hash).toBe(builds[1].hash);
        // expect(builds[1].hash).toBe(builds[2].hash);
        expect.fail('Wave 2 must wire scripts/rig.mjs to call buildExportTarball; this test then asserts hash stability across 3 builds with the rig isolated chain');
    });
});
