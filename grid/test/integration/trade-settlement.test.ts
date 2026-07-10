/**
 * End-to-end test: NousRunner trade_request settlement on Ledger A (Phase 62.6-04).
 *
 * Phase 62.6-04 (D-7 / D-13) retarget — agent-trade settlement now moves money via
 * NousAccountStore.transfer between the RESOLVED civic-DIDs of the proposer and the
 * counterparty (nous_accounts), NOT via the legacy in-memory NousRegistry.transferWei.
 *
 *   - Balances live in `nous_accounts` (civic-DID keyed) — seeded via makeAccountsPool()
 *     and asserted with balanceOf(civicDid) conservation checks (the old registry-balance
 *     asserts are gone).
 *   - The proposer/counterparty existence-DIDs are resolved to civic-DIDs through a stub
 *     CivicDidStore.getByExistenceDid; a null resolution (pre-citizen) means the trade does
 *     NOT settle — trade.rejected{reason:'not_found'} (D-13 citizens-only, existing reason).
 *   - The reviewer's proposerBalance is read from the SAME resolved civic account, so the
 *     review gate and the settle transfer agree on one ledger.
 *   - Account-store throws map to the EXISTING reason enum (insufficient_balance→'insufficient').
 *   - The reviewer-fail path and the malformed-metadata path are unchanged in shape.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';
import { AuditChain } from '../../src/audit/chain.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import { Reviewer } from '../../src/review/index.js';
import { makeAccountsPool, type AccountsPool } from '../helpers/accounts-pool.js';
import type { NousRegistry } from '../../src/registry/registry.js';
import type { CivicDidStore } from '../../src/civic-registry/civic-did-store.js';
import type { CivicDidRecord } from '../../src/civic-registry/types.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
} from '../../src/integration/types.js';

const GRID = 'genesis';

// Brain runtime identity = existence-DID (what the runner holds).
const BUYER_DID = 'did:noesis:sophia';
const SELLER_DID = 'did:noesis:hermes';

// Naturalized civic-DIDs (what nous_accounts is keyed by).
const BUYER_CIVIC = 'did:noesis:civic-sophia';
const SELLER_CIVIC = 'did:noesis:civic-hermes';

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

/** Minimal registry stub — trade settlement no longer reads registry balances. tick() only
 *  consults get() for the tombstone guard and touch() for last-seen. */
function makeRegistry(): NousRegistry {
    return {
        get: () => undefined,
        touch: () => { /* no-op */ },
    } as unknown as NousRegistry;
}

/** Stub CivicDidStore: existence-DID → civic-DID map; unmapped existence-DIDs resolve null
 *  (a pre-citizen Nous). NousRunner only ever calls getByExistenceDid on it. */
function makeCivicStore(map: Record<string, string>): CivicDidStore {
    return {
        getByExistenceDid: async (_grid: string, existenceDid: string): Promise<CivicDidRecord | null> => {
            const civicDid = map[existenceDid];
            return civicDid ? ({ civicDid, existenceDid, gridName: GRID } as CivicDidRecord) : null;
        },
    } as unknown as CivicDidStore;
}

interface Env {
    audit: AuditChain;
    space: SpatialMap;
    economy: EconomyManager;
    accounts: AccountsPool;
    accountStore: NousAccountStore;
}

function seedEnv(): Env {
    const audit = new AuditChain();
    const space = new SpatialMap();
    const economy = new EconomyManager({ initialSupply: 100, minTransfer: 1, maxTransfer: 1_000 });
    const accounts = makeAccountsPool();
    const accountStore = new NousAccountStore(accounts.pool);
    // Singleton — reset before each fresh reviewer construction.
    Reviewer.resetForTesting();
    return { audit, space, economy, accounts, accountStore };
}

function tradeAction(counterparty: string, amount: number, nonce: string): BrainAction {
    return {
        action_type: 'trade_request',
        channel: '',
        text: '',
        metadata: { counterparty, amount, nonce, memoryRefs: ['mem:1'], telosHash: TELOS_HASH_FIXTURE },
    };
}

describe('Phase 62.6-04 — trade_request settlement on Ledger A (nous_accounts, D-13 gate)', () => {
    let env: Env;

    beforeEach(() => {
        env = seedEnv();
    });

    it('both citizens funded: debits proposer civic account, credits counterparty civic account, one trade.settled', async () => {
        env.accounts.seedAccount(BUYER_CIVIC, 100n);
        env.accounts.seedAccount(SELLER_CIVIC, 50n);
        const reviewer = new Reviewer(env.audit, makeRegistry());

        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[tradeAction(SELLER_DID, 42, 'nonce-1')]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            reviewer,
            accountStore: env.accountStore,
            civicDidStore: makeCivicStore({ [BUYER_DID]: BUYER_CIVIC, [SELLER_DID]: SELLER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'trade.proposed' })).toHaveLength(1);
        expect(env.audit.query({ eventType: 'trade.reviewed' })).toHaveLength(1);
        const settled = env.audit.query({ eventType: 'trade.settled' });
        expect(settled).toHaveLength(1);
        expect(env.audit.query({ eventType: 'trade.rejected' })).toHaveLength(0);

        // D-10 hash-only boundary: settled payload keeps the EXISTENCE-DID counterparty + id.
        expect(Object.keys(settled[0].payload).sort()).toEqual(['amount', 'counterparty', 'nonce']);
        expect(settled[0].payload).toEqual({ counterparty: SELLER_DID, amount: 42, nonce: 'nonce-1' });
        expect(settled[0].actorDid).toBe(BUYER_DID);

        // Conservation on the unified Ledger A (civic-DID keyed).
        expect(env.accounts.balanceOf(BUYER_CIVIC)).toBe(58n);
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(92n);
    });

    it('counterparty NOT naturalized: reviewer passes, settle gate rejects trade.rejected{not_found}, no settle, no money moved', async () => {
        env.accounts.seedAccount(BUYER_CIVIC, 100n);
        const reviewer = new Reviewer(env.audit, makeRegistry());

        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[tradeAction(SELLER_DID, 42, 'nonce-2')]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            reviewer,
            accountStore: env.accountStore,
            // SELLER_DID has NO civic mapping → getByExistenceDid resolves null.
            civicDidStore: makeCivicStore({ [BUYER_DID]: BUYER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        // Reviewer passes (proposer funded + resolvable, counterparty DID well-formed).
        expect(env.audit.query({ eventType: 'trade.reviewed' })).toHaveLength(1);
        expect(env.audit.query({ eventType: 'trade.settled' })).toHaveLength(0);
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(rejected).toHaveLength(1);
        expect(rejected[0].payload).toEqual({ reason: 'not_found', nonce: 'nonce-2' });

        // No money moved.
        expect(env.accounts.balanceOf(BUYER_CIVIC)).toBe(100n);
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(0n);
    });

    it('proposer NOT naturalized (reviewer present): reads balance 0 → trade.reviewed{fail}, NO settlement (symmetric D-13)', async () => {
        env.accounts.seedAccount(SELLER_CIVIC, 50n);
        const reviewer = new Reviewer(env.audit, makeRegistry());

        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[tradeAction(SELLER_DID, 42, 'nonce-3')]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            reviewer,
            accountStore: env.accountStore,
            // BUYER_DID has NO civic mapping → proposer unresolvable → proposerBalance = 0.
            civicDidStore: makeCivicStore({ [SELLER_DID]: SELLER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        // Non-citizen proposer reads 0 → the reviewer's insufficient_balance check fails first.
        const reviewed = env.audit.query({ eventType: 'trade.reviewed' });
        expect(reviewed).toHaveLength(1);
        expect((reviewed[0].payload as Record<string, unknown>)['verdict']).toBe('fail');
        expect((reviewed[0].payload as Record<string, unknown>)['failure_reason']).toBe('insufficient_balance');
        // No settlement occurs either way (D-13 symmetric — a non-citizen proposer cannot move money).
        expect(env.audit.query({ eventType: 'trade.settled' })).toHaveLength(0);
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(50n);
    });

    it('proposer NOT naturalized (reviewer bypassed): settle gate proposer-null branch → trade.rejected{not_found}, no settlement', async () => {
        env.accounts.seedAccount(SELLER_CIVIC, 50n);

        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[tradeAction(SELLER_DID, 42, 'nonce-4')]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            // reviewer intentionally omitted (zero-diff bypass affordance) so the settle gate runs.
            accountStore: env.accountStore,
            civicDidStore: makeCivicStore({ [SELLER_DID]: SELLER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'trade.reviewed' })).toHaveLength(0);
        expect(env.audit.query({ eventType: 'trade.settled' })).toHaveLength(0);
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(rejected).toHaveLength(1);
        expect(rejected[0].payload).toEqual({ reason: 'not_found', nonce: 'nonce-4' });
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(50n);
    });

    it('underfunded proposer (reviewer bypassed): transfer throws insufficient_balance → trade.rejected{insufficient}, balances rolled back', async () => {
        env.accounts.seedAccount(BUYER_CIVIC, 10n);
        env.accounts.seedAccount(SELLER_CIVIC, 50n);

        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[tradeAction(SELLER_DID, 42, 'nonce-5')]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            // reviewer omitted so the settle transfer runs and throws insufficient_balance.
            accountStore: env.accountStore,
            civicDidStore: makeCivicStore({ [BUYER_DID]: BUYER_CIVIC, [SELLER_DID]: SELLER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'trade.settled' })).toHaveLength(0);
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(rejected).toHaveLength(1);
        // Store throw maps to the EXISTING reason enum — NOT the raw 'insufficient_balance' string.
        expect(rejected[0].payload).toEqual({ reason: 'insufficient', nonce: 'nonce-5' });
        // Atomic rollback — no partial debit/credit.
        expect(env.accounts.balanceOf(BUYER_CIVIC)).toBe(10n);
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(50n);
    });

    it('reviewer-fail path unchanged: trade.reviewed{fail, insufficient_balance}, NO trade.settled, NO trade.rejected', async () => {
        env.accounts.seedAccount(BUYER_CIVIC, 100n);
        env.accounts.seedAccount(SELLER_CIVIC, 50n);
        const reviewer = new Reviewer(env.audit, makeRegistry());

        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[tradeAction(SELLER_DID, 500, 'nonce-6')]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            reviewer,
            accountStore: env.accountStore,
            civicDidStore: makeCivicStore({ [BUYER_DID]: BUYER_CIVIC, [SELLER_DID]: SELLER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'trade.proposed' })).toHaveLength(1);
        const reviewed = env.audit.query({ eventType: 'trade.reviewed' });
        expect(reviewed).toHaveLength(1);
        expect(env.audit.query({ eventType: 'trade.settled' })).toHaveLength(0);
        // Reviewer fail path does NOT emit trade.rejected (fail ends at trade.reviewed).
        expect(env.audit.query({ eventType: 'trade.rejected' })).toHaveLength(0);

        const rp = reviewed[0].payload as Record<string, unknown>;
        expect(rp['verdict']).toBe('fail');
        expect(rp['failed_check']).toBe('insufficient_balance');
        expect(rp['failure_reason']).toBe('insufficient_balance');
        expect(rp['trade_id']).toBe('nonce-6');
        expect(reviewed[0].actorDid).toBe(Reviewer.DID);

        // No money moved.
        expect(env.accounts.balanceOf(BUYER_CIVIC)).toBe(100n);
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(50n);
    });

    it('malformed metadata: one trade.rejected(reason=malformed_metadata), NO trade.proposed/reviewed, no money moved', async () => {
        env.accounts.seedAccount(BUYER_CIVIC, 100n);
        env.accounts.seedAccount(SELLER_CIVIC, 50n);
        const reviewer = new Reviewer(env.audit, makeRegistry());

        const badAction: BrainAction = {
            action_type: 'trade_request',
            channel: '',
            text: '',
            metadata: {
                counterparty: SELLER_DID,
                amount: 'forty-two' as unknown as number,
                nonce: 'nonce-7',
                memoryRefs: ['mem:1'],
                telosHash: TELOS_HASH_FIXTURE,
            },
        };
        const runner = new NousRunner({
            nousDid: BUYER_DID,
            nousName: 'Sophia',
            bridge: makeBridge([[badAction]]),
            space: env.space,
            audit: env.audit,
            registry: makeRegistry(),
            economy: env.economy,
            reviewer,
            accountStore: env.accountStore,
            civicDidStore: makeCivicStore({ [BUYER_DID]: BUYER_CIVIC, [SELLER_DID]: SELLER_CIVIC }),
            gridName: GRID,
        });

        await runner.tick(1, 0);

        expect(env.audit.query({ eventType: 'trade.proposed' })).toHaveLength(0);
        expect(env.audit.query({ eventType: 'trade.reviewed' })).toHaveLength(0);
        expect(env.audit.query({ eventType: 'trade.settled' })).toHaveLength(0);
        const rejected = env.audit.query({ eventType: 'trade.rejected' });
        expect(rejected).toHaveLength(1);
        expect(rejected[0].payload).toEqual({ reason: 'malformed_metadata', nonce: 'nonce-7' });

        expect(env.accounts.balanceOf(BUYER_CIVIC)).toBe(100n);
        expect(env.accounts.balanceOf(SELLER_CIVIC)).toBe(50n);
    });
});
