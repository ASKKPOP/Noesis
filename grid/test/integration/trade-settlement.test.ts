/**
 * End-to-end test: NousRunner trade_request pipeline.
 *
 * Updated for Phase 5 Plan 03 (reviewer integration — D-01, D-02, D-05):
 *   - Buyer/Seller DIDs switched from `did:noesis:*` to `did:noesis:*` so they pass
 *     the reviewer's Phase-1-frozen DID regex /^did:noesis:[a-z0-9_\-]+$/i.
 *   - Metadata fixtures include the REQUIRED memoryRefs + telosHash.
 *   - Seed env constructs a Reviewer and injects it into the NousRunner.
 *   - Success case still asserts the trade.settled payload shape {counterparty, amount, nonce}
 *     (privacy contract from D8 / Pitfall 4) — the settled payload shape DID NOT change; the
 *     reviewer adds trade.proposed + trade.reviewed{pass} BEFORE settled.
 *   - Insufficient-funds case now asserts trade.reviewed{fail, insufficient_balance} and NO
 *     trade.settled — the reviewer intercepts insufficient balance BEFORE transferOusia, so the
 *     old `trade.rejected{reason:insufficient}` path from transferOusia is now unreachable in
 *     Phase 5 (the defensive transferOusia branch is kept for library-level callers that bypass
 *     the reviewer).
 *   - Malformed metadata case UNCHANGED in shape — transport-layer error that pre-empts the
 *     reviewer entirely.
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
} from '../../src/integration/types.js';

const BUYER_DID = 'did:noesis:sophia';
const SELLER_DID = 'did:noesis:hermes';
const TELOS_HASH_FIXTURE = 'a'.repeat(64);

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
        { name: 'Sophia', did: BUYER_DID, publicKey: 'pk-s', region: 'agora' },
        'test.noesis', 0, 100,
    );
    registry.spawn(
        { name: 'Hermes', did: SELLER_DID, publicKey: 'pk-h', region: 'agora' },
        'test.noesis', 0, 50,
    );
    // Singleton — tests must reset before constructing a fresh reviewer.
    Reviewer.resetForTesting();
    const reviewer = new Reviewer(audit, registry);
    return { registry, audit, space, economy, reviewer };
}

describe('Plan 04-01 + 05-03 — trade_request settlement with reviewer gate', () => {
    let env: Env;

    beforeEach(() => {
        env = seedEnv();
    });

    it('success case: debits buyer, credits seller, emits exactly one trade.settled with privacy-safe payload', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            metadata: {
                counterparty: SELLER_DID,
                amount: 42,
                nonce: 'nonce-1',
                memoryRefs: ['mem:1'],
                telosHash: TELOS_HASH_FIXTURE,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[action]]),
            space: env.space,
            audit: env.audit,
            registry: env.registry,
            economy: env.economy,
            reviewer: env.reviewer,
        });

        await runner.tick(1, 0);

        const proposed = env.audit.query({ eventType: 'trade.proposed' });
        const reviewed = env.audit.query({ eventType: 'trade.reviewed' });
        const settled = env.audit.query({ eventType: 'trade.settled' });
        const rejected = env.audit.query({ eventType: 'trade.rejected' });

        // Phase 5: 3-event flow on success.
        expect(proposed).toHaveLength(1);
        expect(reviewed).toHaveLength(1);
        expect(settled).toHaveLength(1);
        expect(rejected).toHaveLength(0);

        // reviewed{pass} payload shape (D-03).
        expect((reviewed[0].payload as Record<string, unknown>)['verdict']).toBe('pass');

        const entry = settled[0];
        // EXACT payload shape — privacy contract from D8 / Pitfall 4 (unchanged in Phase 5).
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

    it('insufficient funds: reviewer intercepts — trade.proposed + trade.reviewed{fail, insufficient_balance}, NO trade.settled, balances unchanged', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            metadata: {
                counterparty: SELLER_DID,
                amount: 500,
                nonce: 'nonce-2',
                memoryRefs: ['mem:1'],
                telosHash: TELOS_HASH_FIXTURE,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[action]]),
            space: env.space,
            audit: env.audit,
            registry: env.registry,
            economy: env.economy,
            reviewer: env.reviewer,
        });

        await runner.tick(1, 0);

        const proposed = env.audit.query({ eventType: 'trade.proposed' });
        const reviewed = env.audit.query({ eventType: 'trade.reviewed' });
        const settled = env.audit.query({ eventType: 'trade.settled' });
        const rejected = env.audit.query({ eventType: 'trade.rejected' });

        expect(proposed).toHaveLength(1);
        expect(reviewed).toHaveLength(1);
        expect(settled).toHaveLength(0);
        // Reviewer fail path does NOT emit trade.rejected (D-01: fail ends at trade.reviewed).
        expect(rejected).toHaveLength(0);

        const rp = reviewed[0].payload as Record<string, unknown>;
        expect(rp['verdict']).toBe('fail');
        expect(rp['failed_check']).toBe('insufficient_balance');
        expect(rp['failure_reason']).toBe('insufficient_balance');
        expect(rp['trade_id']).toBe('nonce-2');
        expect(reviewed[0].actorDid).toBe(Reviewer.DID);

        expect(env.registry.get(BUYER_DID)?.ousia).toBe(100);
        expect(env.registry.get(SELLER_DID)?.ousia).toBe(50);
    });

    it('malformed metadata: one trade.rejected(reason=malformed_metadata), NO trade.proposed, NO trade.reviewed, balances unchanged', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            // amount is a string — malformed; memoryRefs + telosHash provided but doesn't matter.
            metadata: {
                counterparty: SELLER_DID,
                amount: 'forty-two' as unknown as number,
                nonce: 'nonce-3',
                memoryRefs: ['mem:1'],
                telosHash: TELOS_HASH_FIXTURE,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[action]]),
            space: env.space,
            audit: env.audit,
            registry: env.registry,
            economy: env.economy,
            reviewer: env.reviewer,
        });

        await runner.tick(1, 0);

        // Transport-layer error pre-empts the reviewer entirely.
        expect(env.audit.query({ eventType: 'trade.proposed' })).toHaveLength(0);
        expect(env.audit.query({ eventType: 'trade.reviewed' })).toHaveLength(0);

        const settled = env.audit.query({ eventType: 'trade.settled' });
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(settled).toHaveLength(0);
        expect(rejected).toHaveLength(1);
        expect(rejected[0].payload).toEqual({ reason: 'malformed_metadata', nonce: 'nonce-3' });

        expect(env.registry.get(BUYER_DID)?.ousia).toBe(100);
        expect(env.registry.get(SELLER_DID)?.ousia).toBe(50);
    });
});
