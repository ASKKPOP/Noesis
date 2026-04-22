/**
 * Phase 10a DRIVE-03 end-to-end: Brain → NousRunner dispatcher → AuditChain.
 *
 * Exercises the full stream against a real AuditChain: feeds the runner a
 * sequence of drive_crossed actions across 10 distinct ticks and asserts
 * the resulting chain entries carry the correct per-tick values. Also
 * verifies that `ananke.drive_crossed` is on the broadcast allowlist so the
 * entries would propagate to subscribers unchanged.
 *
 * Covers:
 *   - D-10a-03 (5-key closed payload, Grid-injected did+tick)
 *   - D-10a-04 (3-keys-not-5 invariant end-to-end)
 *   - Chain-arrival order preserved across ticks
 *   - Allowlist membership verified for the end-to-end path
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import { Reviewer } from '../../src/review/index.js';
import { isAllowlisted } from '../../src/audit/broadcast-allowlist.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
    MemoryEntry,
} from '../../src/integration/types.js';

const NOUS_DID = 'did:noesis:alpha';

/**
 * Deterministic brain bridge: each sendTick pops the next queued batch.
 * Stream ordering reflects dispatch ordering.
 */
function streamBridge(stream: BrainAction[][]): IBrainBridge {
    let i = 0;
    return {
        connected: true,
        sendTick: (_p: TickParams) =>
            Promise.resolve(i < stream.length ? stream[i++] : []),
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
        queryMemory: (_p: { query: string; limit?: number }) =>
            Promise.resolve({ entries: [] as MemoryEntry[] }),
        forceTelos: (_t: Record<string, unknown>) =>
            Promise.resolve({ telos_hash_before: '0'.repeat(64), telos_hash_after: '0'.repeat(64) }),
    };
}

function drive(drive: string, level: string, direction: string): BrainAction {
    return {
        action_type: 'drive_crossed',
        channel: '',
        text: '',
        metadata: { drive, level, direction },
    } as unknown as BrainAction;
}

describe('Brain drive_crossed stream → NousRunner dispatcher → AuditChain (E2E)', () => {
    let registry: NousRegistry;
    let audit: AuditChain;
    let space: SpatialMap;
    let economy: EconomyManager;
    let reviewer: Reviewer;

    beforeEach(() => {
        registry = new NousRegistry();
        audit = new AuditChain();
        space = new SpatialMap();
        economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });
        space.addRegion({
            id: 'agora', name: 'Agora', description: 'x',
            regionType: 'public', capacity: 10, properties: {},
        });
        registry.spawn(
            { name: 'Alpha', did: NOUS_DID, publicKey: 'pk-a', region: 'agora' },
            'test.noesis', 0, 100,
        );
        Reviewer.resetForTesting();
        reviewer = new Reviewer(audit, registry);
    });

    it('10 ticks × 1 drive_crossed each → 10 audit entries, tick values 1..10 preserved', async () => {
        // One action per tick, 10 ticks. Cycle through enum values so we also
        // assert payload fields survived the Brain→Grid→chain journey intact.
        const drives = ['hunger', 'curiosity', 'safety', 'boredom', 'loneliness'] as const;
        const levels = ['low', 'med', 'high'] as const;
        const directions = ['rising', 'falling'] as const;

        const stream: BrainAction[][] = [];
        for (let t = 1; t <= 10; t++) {
            stream.push([drive(drives[(t - 1) % drives.length], levels[(t - 1) % levels.length], directions[(t - 1) % directions.length])]);
        }

        const runner = new NousRunner({
            nousDid: NOUS_DID,
            nousName: 'Alpha',
            bridge: streamBridge(stream),
            space, audit, registry, economy, reviewer,
        });

        for (let t = 1; t <= 10; t++) {
            await runner.tick(t, 0);
        }

        const entries = audit.query({ eventType: 'ananke.drive_crossed' });
        expect(entries).toHaveLength(10);
        for (let i = 0; i < 10; i++) {
            const payload = entries[i].payload as Record<string, unknown>;
            expect(payload.tick).toBe(i + 1);
            expect(payload.did).toBe(NOUS_DID);
            expect(payload.drive).toBe(drives[i % drives.length]);
            expect(payload.level).toBe(levels[i % levels.length]);
            expect(payload.direction).toBe(directions[i % directions.length]);
            // 5-key closed tuple — nothing else snuck in.
            expect(Object.keys(payload).sort()).toEqual(
                ['did', 'direction', 'drive', 'level', 'tick'],
            );
        }
    });

    it('ananke.drive_crossed is on the broadcast allowlist (entries would propagate to subscribers)', () => {
        expect(isAllowlisted('ananke.drive_crossed')).toBe(true);
    });

    it('regression: no non-ananke entry types appear in the chain for a pure drive_crossed stream', async () => {
        const stream: BrainAction[][] = [
            [drive('hunger', 'med', 'rising')],
            [drive('curiosity', 'high', 'rising')],
            [drive('safety', 'low', 'falling')],
        ];

        const runner = new NousRunner({
            nousDid: NOUS_DID,
            nousName: 'Alpha',
            bridge: streamBridge(stream),
            space, audit, registry, economy, reviewer,
        });

        for (let t = 1; t <= 3; t++) {
            await runner.tick(t, 0);
        }

        const all = audit.query({});
        // Every entry must be ananke.drive_crossed; no stray speak / move / noop.
        expect(all.length).toBe(3);
        expect(all.every((e) => e.eventType === 'ananke.drive_crossed')).toBe(true);
    });

    it('multiple actions in a single tick batch preserve intra-tick arrival order', async () => {
        const stream: BrainAction[][] = [[
            drive('hunger', 'med', 'rising'),
            drive('curiosity', 'high', 'rising'),
            drive('safety', 'low', 'falling'),
        ]];

        const runner = new NousRunner({
            nousDid: NOUS_DID,
            nousName: 'Alpha',
            bridge: streamBridge(stream),
            space, audit, registry, economy, reviewer,
        });

        await runner.tick(99, 0);

        const entries = audit.query({ eventType: 'ananke.drive_crossed' });
        expect(entries).toHaveLength(3);
        expect(entries.map((e) => e.payload.drive)).toEqual(['hunger', 'curiosity', 'safety']);
        // All three share the tick — 99 — which came from the single tick call.
        expect(entries.every((e) => e.payload.tick === 99)).toBe(true);
    });
});
