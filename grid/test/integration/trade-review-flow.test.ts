/**
 * End-to-end integration test — Phase 5 REV-01/REV-02 pass path.
 *
 * Asserts the 3-event flow with strict id ordering (T-5-06 mitigation):
 *     trade.proposed (actor=proposer) → trade.reviewed{pass} (actor=reviewer) → trade.settled (actor=proposer)
 *
 * Correlation key: nonce (D-04). Pass payload shape: 3 keys exactly (D-03).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { EconomyManager } from '../../src/economy/config.js';
import { SpatialMap } from '../../src/space/map.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { Reviewer } from '../../src/review/index.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
} from '../../src/integration/types.js';

const BUYER_DID = 'did:noesis:alpha';
const SELLER_DID = 'did:noesis:beta';
const TELOS_HASH_A = 'a'.repeat(64);
const TELOS_HASH_B = 'b'.repeat(64);

function makeBridge(actions: BrainAction[]): IBrainBridge {
    let delivered = false;
    return {
        connected: true,
        sendTick: (_p: TickParams) =>
            Promise.resolve(delivered ? [] : (delivered = true, actions)),
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
    };
}

describe('REV-01/REV-02 integration: 3-event trade-review flow (pass path)', () => {
    let audit: AuditChain;
    let registry: NousRegistry;
    let space: SpatialMap;
    let economy: EconomyManager;
    let reviewer: Reviewer;

    beforeEach(() => {
        Reviewer.resetForTesting();
        audit = new AuditChain();
        registry = new NousRegistry();
        space = new SpatialMap();
        economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });
        space.addRegion({
            id: 'agora', name: 'Agora', description: 'x',
            regionType: 'public', capacity: 10, properties: {},
        });
        registry.spawn(
            { name: 'Alpha', did: BUYER_DID, publicKey: 'pk-a', region: 'agora' },
            'test.noesis', 0, 100,
        );
        registry.spawn(
            { name: 'Beta', did: SELLER_DID, publicKey: 'pk-b', region: 'agora' },
            'test.noesis', 0, 50,
        );
        reviewer = new Reviewer(audit, registry);
    });

    it('emits proposed → reviewed{pass} → settled in strict id order', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            metadata: {
                counterparty: SELLER_DID,
                amount: 10,
                nonce: 'nonce-flow-1',
                memoryRefs: ['mem:1', 'mem:2'],
                telosHash: TELOS_HASH_A,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID, nousName: 'Alpha',
            bridge: makeBridge([action]),
            space, audit, registry, economy, reviewer,
        });

        await runner.tick(1, 0);

        const proposed = audit.query({ eventType: 'trade.proposed' });
        const reviewed = audit.query({ eventType: 'trade.reviewed' });
        const settled = audit.query({ eventType: 'trade.settled' });

        expect(proposed).toHaveLength(1);
        expect(reviewed).toHaveLength(1);
        expect(settled).toHaveLength(1);

        // T-5-06 mitigation — strict id ordering. AuditChain ids are monotonically increasing.
        expect(proposed[0].id).toBeLessThan(reviewed[0].id);
        expect(reviewed[0].id).toBeLessThan(settled[0].id);

        // Actor DIDs (D-01).
        expect(proposed[0].actorDid).toBe(BUYER_DID);
        expect(reviewed[0].actorDid).toBe(Reviewer.DID);
        expect(settled[0].actorDid).toBe(BUYER_DID);

        // Correlation via nonce (D-04).
        expect((proposed[0].payload as Record<string, unknown>)['nonce']).toBe('nonce-flow-1');
        expect((reviewed[0].payload as Record<string, unknown>)['trade_id']).toBe('nonce-flow-1');
        expect((reviewed[0].payload as Record<string, unknown>)['verdict']).toBe('pass');
        expect((settled[0].payload as Record<string, unknown>)['nonce']).toBe('nonce-flow-1');

        // Pass payload has EXACTLY 3 keys (D-03: no failed_check / failure_reason on pass).
        expect(Object.keys(reviewed[0].payload as object).sort()).toEqual([
            'reviewer_did',
            'trade_id',
            'verdict',
        ]);
        expect((reviewed[0].payload as Record<string, unknown>)['reviewer_did']).toBe(Reviewer.DID);

        // Settled payload privacy (unchanged from v2.0).
        expect(Object.keys(settled[0].payload as object).sort()).toEqual(['amount', 'counterparty', 'nonce']);
    });

    it('proposed payload carries memoryRefs and telosHash (Phase 5 D-05 schema)', async () => {
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '', text: '',
            metadata: {
                counterparty: SELLER_DID, amount: 5, nonce: 'nonce-flow-2',
                memoryRefs: ['mem:42'], telosHash: TELOS_HASH_B,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID, nousName: 'Alpha',
            bridge: makeBridge([action]),
            space, audit, registry, economy, reviewer,
        });
        await runner.tick(1, 0);

        const proposed = audit.query({ eventType: 'trade.proposed' });
        expect(proposed).toHaveLength(1);
        const p = proposed[0].payload as Record<string, unknown>;
        expect(p['memoryRefs']).toEqual(['mem:42']);
        expect(p['telosHash']).toBe(TELOS_HASH_B);
        expect(p['counterparty']).toBe(SELLER_DID);
        expect(p['amount']).toBe(5);
        expect(p['nonce']).toBe('nonce-flow-2');
    });

    it('AuditChain integrity preserved across the 3-event flow', async () => {
        // Zero-diff invariant sanity: chain.verify() stays green through a reviewer-gated trade.
        const action: BrainAction = {
            action_type: 'trade_request',
            channel: '', text: '',
            metadata: {
                counterparty: SELLER_DID, amount: 7, nonce: 'nonce-flow-3',
                memoryRefs: ['mem:1'], telosHash: TELOS_HASH_A,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID, nousName: 'Alpha',
            bridge: makeBridge([action]),
            space, audit, registry, economy, reviewer,
        });
        await runner.tick(1, 0);

        const result = audit.verify();
        expect(result.valid).toBe(true);
    });
});
