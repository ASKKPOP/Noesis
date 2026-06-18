/**
 * Phase 72b — NousRunner.executeActions case 'tool_used'.
 * A Nous's tool_used action emits exactly one tool.invoked audit entry (digest only),
 * and a malformed event is dropped without crashing the tick.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import { Reviewer } from '../../src/review/index.js';
import type {
    BrainAction, IBrainBridge, TickParams, MessageParams, EventParams, MemoryEntry,
} from '../../src/integration/types.js';

const NOUS_DID = 'did:noesis:alpha';
const HASH = 'a'.repeat(64);

function makeBridge(actions: BrainAction[]): IBrainBridge {
    let sent = false;
    return {
        connected: true,
        sendTick: (_p: TickParams) => { const out = sent ? [] : actions; sent = true; return Promise.resolve(out); },
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
        queryMemory: (_p: { query: string; limit?: number }) => Promise.resolve({ entries: [] as MemoryEntry[] }),
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
    return { registry, audit, space, economy, reviewer: new Reviewer(audit, registry) };
}

function toolAction(metadata: Record<string, unknown>): BrainAction {
    return { action_type: 'tool_used', channel: '', text: '', metadata } as unknown as BrainAction;
}

function makeRunner(env: ReturnType<typeof seedEnv>, actions: BrainAction[]): NousRunner {
    return new NousRunner({
        nousDid: NOUS_DID, nousName: 'Alpha', bridge: makeBridge(actions),
        space: env.space, audit: env.audit, registry: env.registry,
        economy: env.economy, reviewer: env.reviewer,
    });
}

describe('NousRunner — case tool_used (Phase 72b)', () => {
    let env: ReturnType<typeof seedEnv>;
    beforeEach(() => { env = seedEnv(); });

    it('emits one tool.invoked entry (digest only) with injected did', async () => {
        const runner = makeRunner(env, [toolAction({ tool_name: 'web_search', output_sha256: HASH, is_error: false })]);
        await runner.tick(100, 0);

        const entries = env.audit.query({ eventType: 'tool.invoked' });
        expect(entries).toHaveLength(1);
        expect(entries[0].actorDid).toBe(NOUS_DID);
        expect(entries[0].payload).toEqual({ did: NOUS_DID, tool_name: 'web_search', output_sha256: HASH, is_error: false });
    });

    it('drops a malformed tool event without crashing the tick', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const runner = makeRunner(env, [toolAction({ tool_name: 'BAD NAME', output_sha256: 'nope', is_error: false })]);
        await runner.tick(1, 0);
        expect(env.audit.query({ eventType: 'tool.invoked' })).toHaveLength(0);
        warn.mockRestore();
    });
});
