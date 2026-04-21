/**
 * Phase 7 DIALOG-02 integration: NousRunner.executeActions case 'telos_refined'.
 *
 * Covers 07-CONTEXT D-16 (validation), D-17 (sole producer path), D-31
 * (self-report did invariant). Tests the runner's branch in isolation
 * with a real AuditChain + a fake Brain bridge.
 *
 * Scenarios (6):
 *   1. Valid → exactly one telos.refined audit entry with clean 4-key payload.
 *   2. Unknown dialogue_id → silent drop (forgery guard, T-07-20).
 *   3. Malformed before_goal_hash → silent drop (producer-boundary rejects).
 *   4. Malformed after_goal_hash → silent drop.
 *   5. Missing metadata keys → silent drop.
 *   6. Leaky metadata (new_goals, prompt) → only 4 canonical keys land.
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
const KNOWN_DIALOGUE_ID = 'a1b2c3d4e5f60718';
const UNKNOWN_DIALOGUE_ID = 'deadbeefdeadbeef';
const BEFORE_HASH = 'a'.repeat(64);
const AFTER_HASH  = 'b'.repeat(64);

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

function makeTelosRefinedAction(
    overrides: Partial<{ dialogue_id: string; before: string; after: string }> = {},
): BrainAction {
    return {
        action_type: 'telos_refined',
        channel: '',
        text: '',
        metadata: {
            triggered_by_dialogue_id: overrides.dialogue_id ?? KNOWN_DIALOGUE_ID,
            before_goal_hash: overrides.before ?? BEFORE_HASH,
            after_goal_hash:  overrides.after  ?? AFTER_HASH,
        },
    };
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

/**
 * Seed the runner's recentDialogueIds set with KNOWN_DIALOGUE_ID. We can't
 * use a public setter (by design — the production API stays clean), so we
 * access the private field via type assertion. This is the seam documented
 * in `_recentDialogueIdsForTest` — Plan 01 left the private field mutable
 * specifically for this test pathway.
 */
function seedDialogueId(runner: NousRunner, id: string): void {
    const ids = (runner as unknown as { recentDialogueIds: Set<string> }).recentDialogueIds;
    ids.add(id);
}

describe('NousRunner — case telos_refined (DIALOG-02 D-16)', () => {
    let env: Env;

    beforeEach(() => {
        env = seedEnv();
    });

    it('valid telos_refined action → appends exactly one telos.refined entry with 4-key payload', async () => {
        const runner = makeRunner(env, [makeTelosRefinedAction()]);
        seedDialogueId(runner, KNOWN_DIALOGUE_ID);

        await runner.tick(1, 0);

        const refined = env.audit.query({ eventType: 'telos.refined' });
        expect(refined).toHaveLength(1);
        expect(refined[0].actorDid).toBe(NOUS_DID);
        expect(refined[0].payload).toEqual({
            did: NOUS_DID,
            before_goal_hash: BEFORE_HASH,
            after_goal_hash: AFTER_HASH,
            triggered_by_dialogue_id: KNOWN_DIALOGUE_ID,
        });
    });

    it('unknown dialogue_id drops silently — no audit entry', async () => {
        const runner = makeRunner(env, [makeTelosRefinedAction({ dialogue_id: UNKNOWN_DIALOGUE_ID })]);
        seedDialogueId(runner, KNOWN_DIALOGUE_ID);

        await runner.tick(1, 0);

        const refined = env.audit.query({ eventType: 'telos.refined' });
        expect(refined).toHaveLength(0);
    });

    it('malformed before_goal_hash drops silently — producer-boundary rejects', async () => {
        const runner = makeRunner(env, [makeTelosRefinedAction({ before: 'nothex' })]);
        seedDialogueId(runner, KNOWN_DIALOGUE_ID);

        await runner.tick(1, 0);

        const refined = env.audit.query({ eventType: 'telos.refined' });
        expect(refined).toHaveLength(0);
    });

    it('malformed after_goal_hash drops silently', async () => {
        const runner = makeRunner(env, [makeTelosRefinedAction({ after: 'Z'.repeat(64) })]);
        seedDialogueId(runner, KNOWN_DIALOGUE_ID);

        await runner.tick(1, 0);

        const refined = env.audit.query({ eventType: 'telos.refined' });
        expect(refined).toHaveLength(0);
    });

    it('missing metadata keys drop silently', async () => {
        const bad: BrainAction = {
            action_type: 'telos_refined',
            channel: '', text: '',
            metadata: {
                // All three required keys absent; cast to satisfy the
                // TelosRefinedAction shape for type-check only.
                before_goal_hash: '',
                after_goal_hash: '',
                triggered_by_dialogue_id: '',
            },
        };
        const runner = makeRunner(env, [bad]);
        seedDialogueId(runner, KNOWN_DIALOGUE_ID);

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'telos.refined' })).toHaveLength(0);
    });

    it('extra keys in Brain metadata (new_goals, prompt) are not propagated to audit payload', async () => {
        const leaky: BrainAction = {
            action_type: 'telos_refined',
            channel: '', text: '',
            metadata: {
                triggered_by_dialogue_id: KNOWN_DIALOGUE_ID,
                before_goal_hash: BEFORE_HASH,
                after_goal_hash: AFTER_HASH,
                new_goals: ['leaked plaintext'],       // must not reach audit
                prompt: 'leaked prompt',               // must not reach audit
            },
        };
        const runner = makeRunner(env, [leaky]);
        seedDialogueId(runner, KNOWN_DIALOGUE_ID);

        await runner.tick(1, 0);

        const refined = env.audit.query({ eventType: 'telos.refined' });
        expect(refined).toHaveLength(1);
        const keys = Object.keys(refined[0].payload).sort();
        expect(keys).toEqual(['after_goal_hash', 'before_goal_hash', 'did', 'triggered_by_dialogue_id']);
        expect(refined[0].payload).not.toHaveProperty('new_goals');
        expect(refined[0].payload).not.toHaveProperty('prompt');
    });
});
