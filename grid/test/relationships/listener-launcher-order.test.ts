/**
 * Phase 9 Plan 04 Task 1 — D-9-04 construction-order regression test.
 *
 * Asserts that GenesisLauncher constructs RelationshipListener AFTER
 * DialogueAggregator, sharing the SAME AuditChain instance. This is the
 * zero-diff safety gate: if a future refactor moves the RelationshipListener
 * construction before the aggregator, this test fails, signaling a potential
 * Phase 7 zero-diff invariant break.
 *
 * Two assertions form the D-9-04 gate:
 *   1. Both this.aggregator and this.relationships share the same AuditChain
 *      as this.audit (pointer equality via append-count tracking).
 *   2. The relationships listener is wired AFTER the aggregator — verified by
 *      a static source scan of the launcher file (Option B — simpler than spy).
 *
 * Additional assertions:
 *   - relationships survive pause (drainDialogueOnPause resets aggregator but NOT relationships)
 *   - rebuildFromChain() is idempotent
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { TEST_CONFIG } from '../../src/genesis/presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function makeLauncher(): GenesisLauncher {
    return new GenesisLauncher({
        ...TEST_CONFIG,
        tickRateMs: 100_000,  // slow clock — never auto-fires in tests
    });
}

// Helper: append a nous.spoke event with an explicit to_did so the
// RelationshipListener can form an edge pair. Mirrors listener.test.ts fixture.
function appendSpoke(launcher: GenesisLauncher, fromDid: string, toDid: string): void {
    launcher.audit.append('nous.spoke', fromDid, {
        name: fromDid.split(':').pop(),
        channel: 'agora',
        text: 'hello',
        tick: launcher.clock.currentTick,
        to_did: toDid,
    });
}

describe('D-9-04: RelationshipListener construction order', () => {
    let launcher: GenesisLauncher | undefined;

    afterEach(() => {
        launcher?.stop();
        launcher = undefined;
    });

    it('launcher has both aggregator and relationships fields', () => {
        launcher = makeLauncher();
        expect(launcher.aggregator).toBeDefined();
        expect(launcher.relationships).toBeDefined();
    });

    it('relationships listener uses the same AuditChain as launcher.audit', () => {
        launcher = makeLauncher();

        const DID_A = 'did:noesis:alpha';
        const DID_B = 'did:noesis:beta';

        // Before any events: no edges
        expect(launcher.relationships.size).toBe(0);

        // Append an event directly to launcher.audit — the listener's onAppend
        // fires synchronously from the same chain.
        appendSpoke(launcher, DID_A, DID_B);

        // If relationships uses the same audit chain, it will have processed the event.
        expect(launcher.relationships.size).toBe(1);
        const edge = launcher.relationships.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
    });

    it('RelationshipListener line > DialogueAggregator line in source (D-9-04 static gate)', () => {
        // Static source-scan gate — verifies construction order is preserved in the file.
        // If a future refactor moves RelationshipListener before the aggregator,
        // this test fails, alerting maintainers to the D-9-04 invariant.
        const src = readFileSync(
            resolve(__dirname, '../../src/genesis/launcher.ts'),
            'utf8',
        );

        const lines = src.split('\n');
        const aggregatorLine = lines.findIndex(l => l.includes('new DialogueAggregator(this.audit'));
        const listenerLine = lines.findIndex(l => l.includes('new RelationshipListener(this.audit'));

        expect(aggregatorLine).toBeGreaterThan(-1);  // aggregator wiring exists
        expect(listenerLine).toBeGreaterThan(-1);     // listener wiring exists
        // D-9-04: listener MUST be constructed AFTER aggregator
        expect(listenerLine).toBeGreaterThan(aggregatorLine);
    });

    it('relationships Map is NOT reset when drainDialogueOnPause is called', () => {
        launcher = makeLauncher();

        const DID_A = 'did:noesis:alpha';
        const DID_B = 'did:noesis:beta';

        // Seed an edge
        appendSpoke(launcher, DID_A, DID_B);
        expect(launcher.relationships.size).toBe(1);

        // Simulate clock pause (drainDialogueOnPause resets aggregator only)
        launcher.drainDialogueOnPause();

        // Edge must still be present — relationship warmth survives pauses
        expect(launcher.relationships.size).toBe(1);
        const edge = launcher.relationships.getEdge(DID_A, DID_B);
        expect(edge).toBeDefined();
    });

    it('rebuildFromChain() is idempotent: calling it again produces same edge Map', () => {
        launcher = makeLauncher();
        launcher.bootstrap();

        const DID_A = 'did:noesis:alpha';
        const DID_B = 'did:noesis:beta';
        const DID_C = 'did:noesis:gamma';

        // Seed multiple edges via audit
        appendSpoke(launcher, DID_A, DID_B);
        appendSpoke(launcher, DID_B, DID_C);
        appendSpoke(launcher, DID_A, DID_C);

        const sizeAfterEvents = launcher.relationships.size;
        expect(sizeAfterEvents).toBeGreaterThan(0);

        // Snapshot edge fingerprints before rebuild
        const edgesBeforeRebuild = Array.from(launcher.relationships.allEdges())
            .map(e => `${e.did_a}|${e.did_b}:${e.valence.toFixed(3)}:${e.weight.toFixed(3)}`)
            .sort()
            .join('\n');

        // Call rebuildFromChain() explicitly — must produce identical Map
        launcher.relationships.rebuildFromChain();

        const sizeAfterRebuild = launcher.relationships.size;
        expect(sizeAfterRebuild).toBe(sizeAfterEvents);

        const edgesAfterRebuild = Array.from(launcher.relationships.allEdges())
            .map(e => `${e.did_a}|${e.did_b}:${e.valence.toFixed(3)}:${e.weight.toFixed(3)}`)
            .sort()
            .join('\n');

        expect(edgesAfterRebuild).toBe(edgesBeforeRebuild);
    });
});
