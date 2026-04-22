/**
 * Phase 10a DRIVE-03 integration: NousRunner.executeActions case 'drive_crossed'.
 *
 * Covers 10a-CONTEXT D-10a-03 (5-key closed payload), D-10a-04 (3-keys-not-5
 * invariant — Grid injects did+tick, Brain cannot forge them), and the
 * T-10a-18 batch-resilience requirement (one malformed action does NOT
 * abort sibling actions in the same tick).
 *
 * Scenarios:
 *   1. Valid drive_crossed → exactly one ananke.drive_crossed entry with
 *      Grid-injected did+tick and Brain-sourced {drive, level, direction}.
 *   2. Multiple drive_crossed actions in one tick → N entries in order.
 *   3. Enum-mismatch metadata → logged as ananke.dispatch.rejected + dropped.
 *   4. Non-drive_crossed action (speak) → ananke producer not invoked; the
 *      speak path runs normally.
 *   5. Mixed batch (valid drive_crossed + bad drive_crossed + valid) → bad
 *      rejected, two valid landed (T-10a-18 sibling-resilience).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import { Reviewer } from '../../src/review/index.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
    MemoryEntry,
} from '../../src/integration/types.js';

const NOUS_DID = 'did:noesis:alpha';

function makeBridge(queue: BrainAction[][]): IBrainBridge {
    let i = 0;
    return {
        connected: true,
        sendTick: (_p: TickParams) =>
            Promise.resolve(i < queue.length ? queue[i++] : []),
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
        queryMemory: (_p: { query: string; limit?: number }) =>
            Promise.resolve({ entries: [] as MemoryEntry[] }),
        forceTelos: (_t: Record<string, unknown>) =>
            Promise.resolve({ telos_hash_before: '0'.repeat(64), telos_hash_after: '0'.repeat(64) }),
    };
}

interface Env {
    registry: NousRegistry;
    audit: AuditChain;
    space: SpatialMap;
    economy: EconomyManager;
    reviewer: Reviewer;
}

function seedEnv(): Env {
    const registry = new NousRegistry();
    const audit = new AuditChain();
    const space = new SpatialMap();
    const economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });

    space.addRegion({
        id: 'agora', name: 'Agora', description: 'x',
        regionType: 'public', capacity: 10, properties: {},
    });
    registry.spawn(
        { name: 'Alpha', did: NOUS_DID, publicKey: 'pk-a', region: 'agora' },
        'test.noesis', 0, 100,
    );
    Reviewer.resetForTesting();
    const reviewer = new Reviewer(audit, registry);
    return { registry, audit, space, economy, reviewer };
}

function makeDriveCrossedAction(
    overrides: Partial<{ drive: string; level: string; direction: string }> = {},
): BrainAction {
    // `as any` to let us feed intentionally bogus enum values (enum-mismatch test).
    return {
        action_type: 'drive_crossed',
        channel: '',
        text: '',
        metadata: {
            drive: overrides.drive ?? 'hunger',
            level: overrides.level ?? 'med',
            direction: overrides.direction ?? 'rising',
        },
    } as unknown as BrainAction;
}

function makeRunner(env: Env, actions: BrainAction[]): NousRunner {
    return new NousRunner({
        nousDid: NOUS_DID,
        nousName: 'Alpha',
        bridge: makeBridge([actions]),
        space: env.space,
        audit: env.audit,
        registry: env.registry,
        economy: env.economy,
        reviewer: env.reviewer,
    });
}

describe('NousRunner — case drive_crossed (Phase 10a DRIVE-03 / D-10a-03, D-10a-04)', () => {
    let env: Env;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        env = seedEnv();
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('valid drive_crossed action → appends exactly one ananke.drive_crossed entry with injected did+tick', async () => {
        const runner = makeRunner(env, [makeDriveCrossedAction()]);

        await runner.tick(100, 0);

        const entries = env.audit.query({ eventType: 'ananke.drive_crossed' });
        expect(entries).toHaveLength(1);
        expect(entries[0].actorDid).toBe(NOUS_DID);
        expect(entries[0].payload).toEqual({
            did: NOUS_DID,
            tick: 100,
            drive: 'hunger',
            level: 'med',
            direction: 'rising',
        });
        // Sanity: no rejection logged for the happy path.
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('multiple drive_crossed actions in one tick → multiple audit entries in order', async () => {
        const a1 = makeDriveCrossedAction({ drive: 'hunger', level: 'med', direction: 'rising' });
        const a2 = makeDriveCrossedAction({ drive: 'curiosity', level: 'high', direction: 'rising' });
        const a3 = makeDriveCrossedAction({ drive: 'safety', level: 'low', direction: 'falling' });

        const runner = makeRunner(env, [a1, a2, a3]);
        await runner.tick(42, 0);

        const entries = env.audit.query({ eventType: 'ananke.drive_crossed' });
        expect(entries).toHaveLength(3);
        expect(entries.map((e) => e.payload.drive)).toEqual(['hunger', 'curiosity', 'safety']);
        // All three share the tick value from the single tick call.
        expect(entries.every((e) => e.payload.tick === 42)).toBe(true);
        // All three are self-reported by the runner's own DID.
        expect(entries.every((e) => e.payload.did === NOUS_DID)).toBe(true);
    });

    it('enum-mismatch metadata (drive="energy") → logs ananke.dispatch.rejected and drops', async () => {
        const bad = makeDriveCrossedAction({ drive: 'energy' });
        const runner = makeRunner(env, [bad]);

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'ananke.drive_crossed' })).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        // The dispatcher emits a JSON-stringified structured log.
        const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
        expect(logged.event).toBe('ananke.dispatch.rejected');
        expect(logged.did).toBe(NOUS_DID);
        expect(typeof logged.reason).toBe('string');
        expect(logged.reason).toContain('energy');
    });

    it('non-drive_crossed action (speak) does NOT produce ananke entries', async () => {
        const speak: BrainAction = {
            action_type: 'speak',
            channel: 'agora',
            text: 'hello',
            metadata: {},
        };
        const runner = makeRunner(env, [speak]);

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'ananke.drive_crossed' })).toHaveLength(0);
        // The speak path writes nous.spoke; sanity-check the runner still dispatched.
        expect(env.audit.query({ eventType: 'nous.spoke' })).toHaveLength(1);
    });

    it('mixed batch (good + bad + good) — bad dropped, good siblings still dispatch (T-10a-18)', async () => {
        const good1 = makeDriveCrossedAction({ drive: 'hunger', level: 'med', direction: 'rising' });
        const bad = makeDriveCrossedAction({ drive: 'energy' }); // unknown enum
        const good2 = makeDriveCrossedAction({ drive: 'boredom', level: 'high', direction: 'rising' });

        const runner = makeRunner(env, [good1, bad, good2]);
        await runner.tick(7, 0);

        const entries = env.audit.query({ eventType: 'ananke.drive_crossed' });
        expect(entries).toHaveLength(2);
        expect(entries.map((e) => e.payload.drive)).toEqual(['hunger', 'boredom']);
        // Exactly one warn for the single bad action.
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('did is self-reported from runner context — Brain metadata cannot forge it', async () => {
        // Attempt to smuggle a did + tick into metadata. The TypeScript shape
        // rejects this at compile time, but at runtime a malicious Brain could
        // add them. The dispatcher ignores extra metadata keys — it reads only
        // drive/level/direction. The closed-tuple check in
        // appendAnankeDriveCrossed guarantees only the 5 canonical keys land.
        const smuggled = {
            action_type: 'drive_crossed',
            channel: '',
            text: '',
            metadata: {
                drive: 'hunger',
                level: 'med',
                direction: 'rising',
                // These must NOT override the runner-injected did+tick.
                did: 'did:noesis:attacker',
                tick: 9999,
            },
        } as unknown as BrainAction;

        const runner = makeRunner(env, [smuggled]);
        await runner.tick(5, 0);

        const entries = env.audit.query({ eventType: 'ananke.drive_crossed' });
        expect(entries).toHaveLength(1);
        expect(entries[0].payload.did).toBe(NOUS_DID);  // runner's, not attacker's
        expect(entries[0].payload.tick).toBe(5);        // tick param, not smuggled 9999
        // And no extra keys leaked through.
        expect(Object.keys(entries[0].payload).sort()).toEqual(
            ['did', 'direction', 'drive', 'level', 'tick'],
        );
    });
});
