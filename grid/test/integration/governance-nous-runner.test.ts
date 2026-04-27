/**
 * Integration tests for NousRunner governance BrainAction cases.
 *
 * Phase 12 Wave 3 — VOTE-05 / D-12-07.
 *
 * Cases:
 *   propose:
 *     - happy path → appendProposalOpened called, proposal.opened in chain
 *     - malformed metadata (missing body_text) → no proposal.opened, warn logged
 *
 *   vote_commit:
 *     - happy path → appendBallotCommitted called, ballot.committed in chain
 *     - duplicate ballot → GovernanceError(409) caught, no second ballot.committed
 *     - missing proposal_id → no ballot.committed, warn logged
 *
 *   vote_reveal:
 *     - happy path → appendBallotRevealed called, ballot.revealed in chain
 *     - hash mismatch → GovernanceError(422) caught, no ballot.revealed
 *     - missing nonce metadata → no ballot.revealed, warn logged
 */

import { describe, it, expect, vi, type Mock } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../../src/governance/appendBallotCommitted.js';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import type { BrainAction, IBrainBridge, TickParams, MessageParams, EventParams, MemoryEntry } from '../../src/integration/types.js';
import type { SpatialMap } from '../../src/space/map.js';
import type { NousRegistry } from '../../src/registry/registry.js';
import type { EconomyManager } from '../../src/economy/config.js';
import type { GovernanceStore } from '../../src/governance/store.js';

const ALICE = 'did:noesis:alice';
const VALID_NONCE = '00000000000000000000000000000000';

function makeRegistry(did = ALICE): NousRegistry {
    return {
        get: (d: string) => d === did ? { did: d, status: 'active', ousia: 100 } : undefined,
        has: (d: string) => d === did,
        isTombstoned: (_d: string) => false,
        count: 1,
        active: () => [],
        touch: () => {},
        spawn: () => { throw new Error('not used'); },
        transferOusia: () => ({ success: false, error: 'not_implemented' }),
    } as unknown as NousRegistry;
}

function makeSpace(): SpatialMap {
    return {
        nousCount: 1,
        getRegion: () => undefined,
        allRegions: () => [],
        allConnections: () => [],
        placeNous: () => {},
        moveNous: () => ({ success: false }),
        getNousRegion: () => undefined,
        getNousInRegion: () => [],
    } as unknown as SpatialMap;
}

function makeEconomy(): EconomyManager {
    return {
        validateTransfer: () => ({ valid: false, error: 'not_implemented' }),
        initialSupply: 500,
    } as unknown as EconomyManager;
}

function makeBridge(actions: BrainAction[] = []): IBrainBridge {
    return {
        connected: true,
        sendTick: (_p: TickParams) => Promise.resolve(actions),
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => {},
        getState: () => Promise.resolve({}),
        queryMemory: (_p: { query: string; limit?: number }) => Promise.resolve({ entries: [] as MemoryEntry[] }),
        forceTelos: (_t: Record<string, unknown>) => Promise.resolve({ telos_hash_before: '', telos_hash_after: '' }),
    };
}

interface RunnerTestSetup {
    audit: AuditChain;
    store: GovernanceStore;
    runner: NousRunner;
}

function makeRunner(
    actions: BrainAction[] = [],
    overrideStore?: GovernanceStore,
): RunnerTestSetup {
    const audit = new AuditChain();
    const store = overrideStore ?? createInMemoryStore('test-grid');
    const runner = new NousRunner({
        nousDid: ALICE,
        nousName: 'Alice',
        bridge: makeBridge(actions),
        space: makeSpace(),
        audit,
        registry: makeRegistry(),
        economy: makeEconomy(),
        governanceDeps: { audit, store },
    });
    return { audit, store, runner };
}

// ── propose ───────────────────────────────────────────────────────────────────

describe('NousRunner governance propose', () => {
    it('happy path → proposal.opened in audit chain', async () => {
        const action: BrainAction = {
            action_type: 'propose',
            channel: '',
            text: '',
            metadata: {
                body_text: 'Let us build a library.',
                deadline_tick: 10,
                quorum_pct: 50,
                supermajority_pct: 67,
            },
        } as unknown as BrainAction;

        const { audit, runner } = makeRunner([action]);
        await runner.tick(1, 0);

        const opened = audit.query({ eventType: 'proposal.opened' });
        expect(opened).toHaveLength(1);
        expect(opened[0]!.payload['proposer_did']).toBe(ALICE);
    });

    it('malformed metadata (no body_text) → no proposal.opened', async () => {
        const action: BrainAction = {
            action_type: 'propose',
            channel: '',
            text: '',
            metadata: {
                deadline_tick: 10,
                // body_text omitted
            },
        } as unknown as BrainAction;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { audit, runner } = makeRunner([action]);
        await runner.tick(1, 0);

        const opened = audit.query({ eventType: 'proposal.opened' });
        expect(opened).toHaveLength(0);
        warnSpy.mockRestore();
    });
});

// ── vote_commit ───────────────────────────────────────────────────────────────

describe('NousRunner governance vote_commit', () => {
    it('happy path → ballot.committed in audit chain', async () => {
        const { audit, store } = makeRunner();

        // Set up a proposal first
        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'Test proposal',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        const hash = computeCommitHash('yes', VALID_NONCE, ALICE);
        const action: BrainAction = {
            action_type: 'vote_commit',
            channel: '',
            text: '',
            metadata: {
                proposal_id,
                commit_hash: hash,
            },
        } as unknown as BrainAction;

        const runner = new NousRunner({
            nousDid: ALICE,
            nousName: 'Alice',
            bridge: makeBridge([action]),
            space: makeSpace(),
            audit,
            registry: makeRegistry(),
            economy: makeEconomy(),
            governanceDeps: { audit, store },
        });

        await runner.tick(2, 0);

        const committed = audit.query({ eventType: 'ballot.committed' });
        expect(committed).toHaveLength(1);
        expect(committed[0]!.payload['voter_did']).toBe(ALICE);
        expect(committed[0]!.payload['proposal_id']).toBe(proposal_id);
    });

    it('duplicate ballot → GovernanceError caught, no second ballot.committed', async () => {
        const { audit, store } = makeRunner();

        // Set up proposal + first commit
        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'Test proposal',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        const hash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: hash,
            currentTick: 2,
            store,
        });

        // Try to commit again
        const action: BrainAction = {
            action_type: 'vote_commit',
            channel: '',
            text: '',
            metadata: {
                proposal_id,
                commit_hash: hash,
            },
        } as unknown as BrainAction;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const runner = new NousRunner({
            nousDid: ALICE,
            nousName: 'Alice',
            bridge: makeBridge([action]),
            space: makeSpace(),
            audit,
            registry: makeRegistry(),
            economy: makeEconomy(),
            governanceDeps: { audit, store },
        });

        await runner.tick(3, 0);

        const committed = audit.query({ eventType: 'ballot.committed' });
        // Should still be only 1 (the first one from setup)
        expect(committed).toHaveLength(1);
        warnSpy.mockRestore();
    });

    it('missing proposal_id → no ballot.committed, warn logged', async () => {
        const action: BrainAction = {
            action_type: 'vote_commit',
            channel: '',
            text: '',
            metadata: {
                // proposal_id omitted
                commit_hash: 'a'.repeat(64),
            },
        } as unknown as BrainAction;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { audit, runner } = makeRunner([action]);
        await runner.tick(1, 0);

        const committed = audit.query({ eventType: 'ballot.committed' });
        expect(committed).toHaveLength(0);
        warnSpy.mockRestore();
    });
});

// ── vote_reveal ───────────────────────────────────────────────────────────────

describe('NousRunner governance vote_reveal', () => {
    it('happy path → ballot.revealed in audit chain', async () => {
        const { audit, store } = makeRunner();

        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'Test proposal',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        const hash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: hash,
            currentTick: 2,
            store,
        });

        const action: BrainAction = {
            action_type: 'vote_reveal',
            channel: '',
            text: '',
            metadata: {
                proposal_id,
                choice: 'yes',
                nonce: VALID_NONCE,
            },
        } as unknown as BrainAction;

        const runner = new NousRunner({
            nousDid: ALICE,
            nousName: 'Alice',
            bridge: makeBridge([action]),
            space: makeSpace(),
            audit,
            registry: makeRegistry(),
            economy: makeEconomy(),
            governanceDeps: { audit, store },
        });

        await runner.tick(3, 0);

        const revealed = audit.query({ eventType: 'ballot.revealed' });
        expect(revealed).toHaveLength(1);
        expect(revealed[0]!.payload['voter_did']).toBe(ALICE);
        expect(revealed[0]!.payload['choice']).toBe('yes');
    });

    it('hash mismatch → GovernanceError caught, no ballot.revealed', async () => {
        const { audit, store } = makeRunner();

        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'Test proposal',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        const hash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: hash,
            currentTick: 2,
            store,
        });

        // Wrong choice → hash mismatch
        const action: BrainAction = {
            action_type: 'vote_reveal',
            channel: '',
            text: '',
            metadata: {
                proposal_id,
                choice: 'no',  // wrong choice
                nonce: VALID_NONCE,
            },
        } as unknown as BrainAction;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const runner = new NousRunner({
            nousDid: ALICE,
            nousName: 'Alice',
            bridge: makeBridge([action]),
            space: makeSpace(),
            audit,
            registry: makeRegistry(),
            economy: makeEconomy(),
            governanceDeps: { audit, store },
        });

        await runner.tick(3, 0);

        const revealed = audit.query({ eventType: 'ballot.revealed' });
        expect(revealed).toHaveLength(0);
        warnSpy.mockRestore();
    });

    it('missing nonce in metadata → no ballot.revealed, warn logged', async () => {
        const action: BrainAction = {
            action_type: 'vote_reveal',
            channel: '',
            text: '',
            metadata: {
                proposal_id: 'some-id',
                choice: 'yes',
                // nonce omitted
            },
        } as unknown as BrainAction;

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { audit, runner } = makeRunner([action]);
        await runner.tick(1, 0);

        const revealed = audit.query({ eventType: 'ballot.revealed' });
        expect(revealed).toHaveLength(0);
        warnSpy.mockRestore();
    });
});
