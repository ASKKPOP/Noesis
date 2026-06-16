/**
 * Agent visibility (spec §1) — NousRunner.executeActions case 'set_visibility'.
 * A Nous's own set_visibility action hides/shows it from peer-discovery and
 * emits exactly one nous.visibility_changed audit entry (mode only, no plaintext).
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

function makeBridge(actions: BrainAction[]): IBrainBridge {
    let sent = false;
    return {
        connected: true,
        sendTick: (_p: TickParams) => {
            const out = sent ? [] : actions;
            sent = true;
            return Promise.resolve(out);
        },
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
        queryMemory: (_p: { query: string; limit?: number }) =>
            Promise.resolve({ entries: [] as MemoryEntry[] }),
        forceTelos: (_t: Record<string, unknown>) =>
            Promise.resolve({ telos_hash_before: '0'.repeat(64), telos_hash_after: '0'.repeat(64) }),
    };
}

function seedEnv() {
    const registry = new NousRegistry();
    const audit = new AuditChain();
    const space = new SpatialMap();
    const economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });
    space.addRegion({ id: 'agora', name: 'Agora', description: 'x', regionType: 'public', capacity: 10, properties: {} });
    registry.spawn({ name: 'Alpha', did: NOUS_DID, publicKey: 'pk-a', region: 'agora' }, 'test.noesis', 0, 100);
    Reviewer.resetForTesting();
    const reviewer = new Reviewer(audit, registry);
    return { registry, audit, space, economy, reviewer };
}

function visibilityAction(hidden: boolean): BrainAction {
    return { action_type: 'set_visibility', channel: '', text: '', metadata: { hidden } } as unknown as BrainAction;
}

function makeRunner(env: ReturnType<typeof seedEnv>, actions: BrainAction[]): NousRunner {
    return new NousRunner({
        nousDid: NOUS_DID, nousName: 'Alpha', bridge: makeBridge(actions),
        space: env.space, audit: env.audit, registry: env.registry,
        economy: env.economy, reviewer: env.reviewer,
    });
}

describe('NousRunner — case set_visibility (spec §1)', () => {
    let env: ReturnType<typeof seedEnv>;
    beforeEach(() => { env = seedEnv(); });

    it('hidden=true hides from peer-discovery and emits nous.visibility_changed', async () => {
        const runner = makeRunner(env, [visibilityAction(true)]);
        await runner.tick(100, 0);

        expect(env.registry.inRegion('agora')).toHaveLength(0);   // peers can't see
        expect(env.registry.active()).toHaveLength(1);            // operator still sees
        const entries = env.audit.query({ eventType: 'nous.visibility_changed' });
        expect(entries).toHaveLength(1);
        expect(entries[0].actorDid).toBe(NOUS_DID);
        expect(entries[0].payload.mode).toBe('hidden');
    });

    it('hidden=false makes it visible again with mode=visible', async () => {
        env.registry.setVisibility(NOUS_DID, true);
        const runner = makeRunner(env, [visibilityAction(false)]);
        await runner.tick(7, 0);

        expect(env.registry.inRegion('agora')).toHaveLength(1);
        const entries = env.audit.query({ eventType: 'nous.visibility_changed' });
        expect(entries[0].payload.mode).toBe('visible');
    });
});
