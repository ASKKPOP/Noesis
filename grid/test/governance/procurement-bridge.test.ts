/**
 * procurement-bridge.test.ts
 *
 * Governance → RFP bridge: an enacted Polis `procurement` bill triggers
 * ProcurementStore.issueNotice via the VOTE-05 pipeline. VOTE-05 / D-V3-21 preserved —
 * issuance is ONLY via an enacted bill (never self-issued).
 *
 * Tests:
 *   1. Enacted procurement bill → ProcurementStore.issueNotice called (INSERT INTO procurement_notices)
 *   2. Malformed body_text (bad JSON procurement fields) → no throw, no issuance (log+skip)
 *   3. Non-procurement bill enacted → issueNotice NOT called (existing behaviour unchanged)
 *
 * Pattern mirrors governance-engine.test.ts ring-expansion tests (billBody helper +
 * enactYes + attachXxx late-wire).
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { GovernanceEngine } from '../../src/governance/engine.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function freshDeps() {
    const audit = new AuditChain();
    const store = createInMemoryStore('test-grid');
    const registry = new NousRegistry();
    for (let i = 0; i < 5; i++) {
        try {
            registry.spawn(
                { did: `did:noesis:eng-${i}`, name: `eng-${i}`, publicKey: 'pk', region: 'genesis' },
                'test.grid', 0, 0,
            );
        } catch { /* ignore duplicate */ }
    }
    const logos = new LogosEngine();
    const engine = new GovernanceEngine(audit, store, registry, logos);
    return { audit, store, registry, logos, engine };
}

/** A bill body that is both a valid JSON Law AND carries procurement-bridge fields. */
function procurementBill(procFields: Record<string, unknown>): string {
    return JSON.stringify({
        id: 'law-procurement-test',
        title: 'Procurement Bill',
        description: 'Polis commissions a build',
        ruleLogic: { condition: { type: 'true' }, action: 'allow', sanction_on_violation: 'none' },
        severity: 'info',
        status: 'active',
        // bridge: category tag + procurement payload
        category: 'procurement',
        ...procFields,
    });
}

/** A normal (non-procurement) bill body. */
const NORMAL_BODY = JSON.stringify({
    id: 'law-normal-test',
    title: 'Normal Law',
    description: 'Nothing to do with procurement',
    ruleLogic: { condition: { type: 'true' }, action: 'allow', sanction_on_violation: 'none' },
    severity: 'info',
    status: 'active',
});

/** Commit + reveal 'yes' for the first N registered Nous so the proposal passes. */
async function enactYes(
    store: ReturnType<typeof createInMemoryStore>,
    proposalId: string,
    count: number,
) {
    for (let i = 0; i < count; i++) {
        const voter = `did:noesis:eng-${i}`;
        await store.insertBallotCommit({
            proposal_id: proposalId,
            voter_did: voter,
            commit_hash: `hash-${i}`,
            committed_tick: 2,
        });
        await store.updateBallotReveal({
            proposal_id: proposalId,
            voter_did: voter,
            choice: 'yes',
            nonce: `nonce-${i}`,
            revealed_tick: 3,
        });
    }
}

/** Build a mock mysql2 Pool that records INSERT SQL calls. */
function makeMockPool(): { pool: Pool; insertCalls: () => string[] } {
    const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => {
        sql.push(String(q));
        return Promise.resolve([{}, {}]);
    });
    const conn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
        query,
    } as unknown as PoolConnection;
    const pool = {
        query,
        getConnection: vi.fn().mockResolvedValue(conn),
    } as unknown as Pool;
    return { pool, insertCalls: () => sql };
}

// ── tests ──────────────────────────────────────────────────────────────────────

describe('Governance → RFP bridge (procurement bill enactment)', () => {
    it('enacted procurement bill → issueNotice called (INSERT INTO procurement_notices)', async () => {
        const { audit, store, engine } = freshDeps();
        const { pool, insertCalls } = makeMockPool();

        engine.attachProcurementBridge({ pool, audit });

        await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:eng-0',
            body_text: procurementBill({
                title: 'Energy module',
                spec: 'A solar panel array for ring 1',
                budget_wei: '5000000000000000000',
                zone: 'infrastructure',
                function_type: 'power',
                deadline_offset_ticks: 50,
            }),
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-procurement-1',
        });
        await enactYes(store, 'prop-procurement-1', 4);

        await engine.onTickClosed(100);

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied).toHaveLength(1);
        expect(tallied[0].payload.outcome).toBe('passed');

        // issueNotice should have triggered an INSERT INTO procurement_notices
        const inserts = insertCalls().filter(q => q.includes('INSERT INTO procurement_notices'));
        expect(inserts).toHaveLength(1);
    });

    it('malformed procurement body (non-digit budget_wei) → no throw, no issuance', async () => {
        const { audit, store, engine } = freshDeps();
        const { pool, insertCalls } = makeMockPool();

        engine.attachProcurementBridge({ pool, audit });

        await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:eng-0',
            body_text: procurementBill({
                title: 'Bad Bill',
                spec: 'spec',
                budget_wei: 'NOT_A_NUMBER',   // invalid
                zone: 'infrastructure',
                function_type: 'power',
                deadline_offset_ticks: 50,
            }),
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-bad-budget',
        });
        await enactYes(store, 'prop-bad-budget', 4);

        // Must not throw
        await expect(engine.onTickClosed(100)).resolves.toBeUndefined();

        // Bill still enacted (tally passes) but no procurement insert
        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied[0].payload.outcome).toBe('passed');

        const inserts = insertCalls().filter(q => q.includes('INSERT INTO procurement_notices'));
        expect(inserts).toHaveLength(0);
    });

    it('missing required field (no zone) → no throw, no issuance', async () => {
        const { audit, store, engine } = freshDeps();
        const { pool, insertCalls } = makeMockPool();

        engine.attachProcurementBridge({ pool, audit });

        await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:eng-0',
            body_text: procurementBill({
                title: 'Missing Zone Bill',
                spec: 'spec',
                budget_wei: '1000',
                // zone missing
                function_type: 'power',
                deadline_offset_ticks: 10,
            }),
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-no-zone',
        });
        await enactYes(store, 'prop-no-zone', 4);

        await expect(engine.onTickClosed(100)).resolves.toBeUndefined();

        const inserts = insertCalls().filter(q => q.includes('INSERT INTO procurement_notices'));
        expect(inserts).toHaveLength(0);
    });

    it('non-procurement enacted bill → issueNotice NOT called (existing behaviour unchanged)', async () => {
        const { audit, store, engine } = freshDeps();
        const { pool, insertCalls } = makeMockPool();

        engine.attachProcurementBridge({ pool, audit });

        await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:eng-0',
            body_text: NORMAL_BODY,
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-normal',
        });
        await enactYes(store, 'prop-normal', 4);

        await engine.onTickClosed(100);

        expect(audit.query({ eventType: 'proposal.tallied' })[0].payload.outcome).toBe('passed');

        const inserts = insertCalls().filter(q => q.includes('INSERT INTO procurement_notices'));
        expect(inserts).toHaveLength(0);
    });

    it('no procurement deps wired → procurement bill enacted without throw (graceful no-op)', async () => {
        const { audit, store, engine } = freshDeps();

        // Deliberately do NOT call engine.attachProcurementBridge

        await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:eng-0',
            body_text: procurementBill({
                title: 'Energy module',
                spec: 'spec',
                budget_wei: '5000',
                zone: 'infrastructure',
                function_type: 'power',
                deadline_offset_ticks: 50,
            }),
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-no-deps',
        });
        await enactYes(store, 'prop-no-deps', 4);

        await expect(engine.onTickClosed(100)).resolves.toBeUndefined();

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied[0].payload.outcome).toBe('passed');
    });
});
