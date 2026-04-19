/**
 * End-to-end test: NousRunner trade_request pipeline.
 *
 * Plan 04-01 Task 2 — asserts:
 *   - Success: audit sees exactly one `trade.settled` with payload
 *     `{counterparty, amount, nonce}` (no text, no name); balances transfer;
 *     no `trade.rejected` event.
 *   - Insufficient funds: zero `trade.settled`, one `trade.rejected` with
 *     reason `insufficient`; balances unchanged.
 *   - Malformed metadata: one `trade.rejected` with reason
 *     `malformed_metadata`; balances unchanged.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
} from '../../src/integration/types.js';

const BUYER_DID = 'did:key:sophia';
const SELLER_DID = 'did:key:hermes';

function makeBridge(queue: BrainAction[][]): IBrainBridge {
    let i = 0;
    return {
        connected: true,
        sendTick: (_p: TickParams) =>
            Promise.resolve(i < queue.length ? queue[i++] : []),
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
    };
}

interface Env {
    registry: NousRegistry;
    audit: AuditChain;
    space: SpatialMap;
    economy: EconomyManager;
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
        { name: 'Sophia', did: BUYER_DID, publicKey: 'pk-s', region: 'agora' },
        'test.noesis', 0, 100,
    );
    registry.spawn(
        { name: 'Hermes', did: SELLER_DID, publicKey: 'pk-h', region: 'agora' },
        'test.noesis', 0, 50,
    );
    return { registry, audit, space, economy };
}

describe('Plan 04-01 — trade_request settlement', () => {
    let env: Env;

    beforeEach(() => {
        env = seedEnv();
    });

    it('success case: debits buyer, credits seller, emits exactly one trade.settled with privacy-safe payload', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            metadata: { counterparty: SELLER_DID, amount: 42, nonce: 'nonce-1' },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[action]]),
            space: env.space,
            audit: env.audit,
            registry: env.registry,
            economy: env.economy,
        });

        await runner.tick(1, 0);

        const settled = env.audit.query({ eventType: 'trade.settled' });
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(settled).toHaveLength(1);
        expect(rejected).toHaveLength(0);

        const entry = settled[0];
        // EXACT payload shape — privacy contract from D8 / Pitfall 4.
        expect(Object.keys(entry.payload).sort()).toEqual(['amount', 'counterparty', 'nonce']);
        expect(entry.payload).toEqual({
            counterparty: SELLER_DID,
            amount: 42,
            nonce: 'nonce-1',
        });
        expect(entry.actorDid).toBe(BUYER_DID);

        // No leaking text/name/tick keys.
        expect((entry.payload as Record<string, unknown>)['text']).toBeUndefined();
        expect((entry.payload as Record<string, unknown>)['name']).toBeUndefined();
        expect((entry.payload as Record<string, unknown>)['tick']).toBeUndefined();

        // Balances moved atomically.
        expect(env.registry.get(BUYER_DID)?.ousia).toBe(100 - 42);
        expect(env.registry.get(SELLER_DID)?.ousia).toBe(50 + 42);
    });

    it('insufficient funds: no trade.settled, one trade.rejected(reason=insufficient), balances unchanged', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            metadata: { counterparty: SELLER_DID, amount: 500, nonce: 'nonce-2' },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[action]]),
            space: env.space,
            audit: env.audit,
            registry: env.registry,
            economy: env.economy,
        });

        await runner.tick(1, 0);

        const settled = env.audit.query({ eventType: 'trade.settled' });
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(settled).toHaveLength(0);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].payload).toEqual({ reason: 'insufficient', nonce: 'nonce-2' });

        expect(env.registry.get(BUYER_DID)?.ousia).toBe(100);
        expect(env.registry.get(SELLER_DID)?.ousia).toBe(50);
    });

    it('malformed metadata: one trade.rejected(reason=malformed_metadata), balances unchanged', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            // amount is a string — malformed
            metadata: { counterparty: SELLER_DID, amount: 'forty-two' as unknown as number, nonce: 'nonce-3' },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[action]]),
            space: env.space,
            audit: env.audit,
            registry: env.registry,
            economy: env.economy,
        });

        await runner.tick(1, 0);

        const settled = env.audit.query({ eventType: 'trade.settled' });
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(settled).toHaveLength(0);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].payload).toEqual({ reason: 'malformed_metadata', nonce: 'nonce-3' });

        expect(env.registry.get(BUYER_DID)?.ousia).toBe(100);
        expect(env.registry.get(SELLER_DID)?.ousia).toBe(50);
    });
});
