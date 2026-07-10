/**
 * End-to-end integration test — Phase 5 REV-02 fail path.
 *
 * For each of the 5 ReviewFailureCode members, constructs a trade that fails exactly that check,
 * then asserts:
 *   - exactly 1 trade.proposed emitted
 *   - exactly 1 trade.reviewed{verdict:'fail', failed_check:<code>, failure_reason:<code>} emitted
 *   - exactly 0 trade.settled emitted
 *   - payload.failed_check and payload.failure_reason are both members of VALID_REVIEW_FAILURE_CODES
 *
 * Plus: malformed-metadata (missing memoryRefs) routes to trade.rejected{malformed_metadata} without
 * ever emitting trade.proposed / trade.reviewed (transport-layer pre-empt).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { EconomyManager } from '../../src/economy/config.js';
import { SpatialMap } from '../../src/space/map.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';
import { Reviewer } from '../../src/review/index.js';
import { VALID_REVIEW_FAILURE_CODES, type ReviewFailureCode } from '../../src/review/types.js';
import { makeAccountsPool, type AccountsPool } from '../helpers/accounts-pool.js';
import type { CivicDidStore } from '../../src/civic-registry/civic-did-store.js';
import type { CivicDidRecord } from '../../src/civic-registry/types.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
} from '../../src/integration/types.js';

const BUYER_DID = 'did:noesis:alpha';
const SELLER_DID = 'did:noesis:beta';
// Naturalized civic-DIDs (nous_accounts keying, Phase 62.6-04 D-13).
const BUYER_CIVIC = 'did:noesis:civic-alpha';
const SELLER_CIVIC = 'did:noesis:civic-beta';
const GRID = 'genesis';
const VALID_TELOS = 'a'.repeat(64);

/** Stub CivicDidStore: existence-DID → civic-DID map; unmapped resolves null (pre-citizen). */
function makeCivicStore(map: Record<string, string>): CivicDidStore {
    return {
        getByExistenceDid: async (_grid: string, existenceDid: string): Promise<CivicDidRecord | null> => {
            const civicDid = map[existenceDid];
            return civicDid ? ({ civicDid, existenceDid, gridName: GRID } as CivicDidRecord) : null;
        },
    } as unknown as CivicDidStore;
}

function mkBridge(actions: BrainAction[]): IBrainBridge {
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

describe('REV-02 integration: reviewer fail path — no trade.settled emitted', () => {
    let audit: AuditChain;
    let registry: NousRegistry;
    let space: SpatialMap;
    let economy: EconomyManager;
    let reviewer: Reviewer;
    let accounts: AccountsPool;
    let accountStore: NousAccountStore;
    let civicStore: CivicDidStore;

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
            'test.noesis', 0, 5,
        );
        registry.spawn(
            { name: 'Beta', did: SELLER_DID, publicKey: 'pk-b', region: 'agora' },
            'test.noesis', 0, 50,
        );
        reviewer = new Reviewer(audit, registry);
        // Phase 62.6-04: the reviewer balance gate now reads nous_accounts (resolved civic-DID).
        // BUYER_CIVIC starts with 5 wei — exercises insufficient_balance naturally; the
        // non-balance fail cases use amount 1 (5 >= 1 passes the balance check, the intended
        // check fails first).
        accounts = makeAccountsPool();
        accountStore = new NousAccountStore(accounts.pool);
        accounts.seedAccount(BUYER_CIVIC, 5n);
        accounts.seedAccount(SELLER_CIVIC, 50n);
        civicStore = makeCivicStore({ [BUYER_DID]: BUYER_CIVIC, [SELLER_DID]: SELLER_CIVIC });
    });

    // One case per ReviewFailureCode member — must stay in 1:1 sync with VALID_REVIEW_FAILURE_CODES.
    // memoryRefs + telosHash are set to VALID values for non-malformed-* cases so the intended
    // failure check triggers first (first-fail-wins per Reviewer.review iteration order).
    const cases: Array<[ReviewFailureCode, BrainAction['metadata']]> = [
        [
            'insufficient_balance',
            { counterparty: SELLER_DID, amount: 100, nonce: 'n-1', memoryRefs: ['mem:1'], telosHash: VALID_TELOS },
        ],
        [
            'invalid_counterparty_did',
            { counterparty: 'not-a-did', amount: 1, nonce: 'n-2', memoryRefs: ['mem:1'], telosHash: VALID_TELOS },
        ],
        [
            'non_positive_amount',
            { counterparty: SELLER_DID, amount: 0, nonce: 'n-3', memoryRefs: ['mem:1'], telosHash: VALID_TELOS },
        ],
        [
            'malformed_memory_refs',
            { counterparty: SELLER_DID, amount: 1, nonce: 'n-4', memoryRefs: [], telosHash: VALID_TELOS },
        ],
        [
            'malformed_telos_hash',
            { counterparty: SELLER_DID, amount: 1, nonce: 'n-5', memoryRefs: ['mem:1'], telosHash: 'bad' },
        ],
    ];

    it.each(cases)(
        'fail code %s emits proposed + reviewed{fail} and NO settled',
        async (expectedCode, metadata) => {
            const action: BrainAction = {
                action_type: 'trade_request',
                channel: '',
                text: '',
                metadata,
            };
            const runner = new NousRunner({
                nousDid: BUYER_DID, nousName: 'Alpha',
                bridge: mkBridge([action]),
                space, audit, registry, economy, reviewer,
                accountStore, civicDidStore: civicStore, gridName: GRID,
            });

            await runner.tick(1, 0);

            const proposed = audit.query({ eventType: 'trade.proposed' });
            const reviewed = audit.query({ eventType: 'trade.reviewed' });
            const settled = audit.query({ eventType: 'trade.settled' });
            const rejected = audit.query({ eventType: 'trade.rejected' });

            expect(proposed).toHaveLength(1);
            expect(reviewed).toHaveLength(1);
            expect(settled).toHaveLength(0);    // ← critical: no settlement on fail
            expect(rejected).toHaveLength(0);   // reviewer fail ≠ trade.rejected (D-01)

            // Strict id ordering for the 2-event fail flow (subset of T-5-06).
            expect(proposed[0].id).toBeLessThan(reviewed[0].id);

            const rp = reviewed[0].payload as Record<string, unknown>;
            expect(rp['verdict']).toBe('fail');
            expect(rp['failed_check']).toBe(expectedCode);
            expect(rp['failure_reason']).toBe(expectedCode);
            expect(rp['trade_id']).toBe(metadata['nonce']);
            expect(reviewed[0].actorDid).toBe(Reviewer.DID);

            // T-5-02 enum invariant at runtime.
            expect(VALID_REVIEW_FAILURE_CODES.has(rp['failure_reason'] as ReviewFailureCode)).toBe(true);
            expect(VALID_REVIEW_FAILURE_CODES.has(rp['failed_check'] as ReviewFailureCode)).toBe(true);

            // Balances unchanged on reviewer fail — asserted on nous_accounts (the ledger
            // the settle transfer moves, Phase 62.6-04). No reviewer-fail case moves money.
            expect(accounts.balanceOf(BUYER_CIVIC)).toBe(5n);
            expect(accounts.balanceOf(SELLER_CIVIC)).toBe(50n);
        },
    );

    it('parity: coverage includes every ReviewFailureCode in VALID_REVIEW_FAILURE_CODES', () => {
        // Guard against a new failure code being added to the union without an abort-test case.
        const covered = new Set(cases.map(([code]) => code));
        for (const code of VALID_REVIEW_FAILURE_CODES) {
            expect(covered.has(code)).toBe(true);
        }
        expect(covered.size).toBe(VALID_REVIEW_FAILURE_CODES.size);
    });

    it('malformed metadata (missing memoryRefs) routes to trade.rejected — NOT trade.proposed', async () => {
        // Transport-layer malformed: metadata missing memoryRefs entirely (cast through unknown).
        const action = {
            action_type: 'trade_request' as const,
            channel: '',
            text: '',
            metadata: { counterparty: SELLER_DID, amount: 1, nonce: 'n-mal' } as unknown as BrainAction['metadata'],
        } as unknown as BrainAction;

        const runner = new NousRunner({
            nousDid: BUYER_DID, nousName: 'Alpha',
            bridge: mkBridge([action]),
            space, audit, registry, economy, reviewer,
        });
        await runner.tick(1, 0);

        expect(audit.query({ eventType: 'trade.proposed' })).toHaveLength(0);
        expect(audit.query({ eventType: 'trade.reviewed' })).toHaveLength(0);

        const rejected = audit.query({ eventType: 'trade.rejected' });
        expect(rejected).toHaveLength(1);
        expect((rejected[0].payload as Record<string, unknown>)['reason']).toBe('malformed_metadata');
    });

    it('malformed metadata (missing telosHash) routes to trade.rejected — NOT trade.proposed', async () => {
        const action = {
            action_type: 'trade_request' as const,
            channel: '',
            text: '',
            metadata: {
                counterparty: SELLER_DID, amount: 1, nonce: 'n-mal-2', memoryRefs: ['mem:1'],
            } as unknown as BrainAction['metadata'],
        } as unknown as BrainAction;

        const runner = new NousRunner({
            nousDid: BUYER_DID, nousName: 'Alpha',
            bridge: mkBridge([action]),
            space, audit, registry, economy, reviewer,
        });
        await runner.tick(1, 0);

        expect(audit.query({ eventType: 'trade.proposed' })).toHaveLength(0);
        expect(audit.query({ eventType: 'trade.reviewed' })).toHaveLength(0);
        expect(audit.query({ eventType: 'trade.rejected' })).toHaveLength(1);
    });
});
