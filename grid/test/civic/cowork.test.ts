/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the Cowork Agreement + task board (A5 / D-60-06 / R-60-08).
 *
 * describe.skip: grid/src/civic/cowork.ts lands in Wave 2. Deferred dynamic import
 * (Phase 58/59 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - CoworkAgreement {agreement_id, parcel_id, parties:[host, worker], scope_ref,
 *     settlement_amount_bios, term_ticks, status} is the signed dual-DID source of truth.
 *   - board post (owner/staff) → claim (role with board access) → complete (host) transitions status.
 *   - completion ALWAYS settles: Ousia via transferOusia when funded, OR records an IOU when not —
 *     a completion that pays NOTHING throws (never free, D-NH-06).
 *   - a completed session emits zoning.cowork_session carrying ONLY {end_tick, parcel_id,
 *     participant_count, participants_hash, start_tick} — no board/task text, no raw DIDs.
 */
import { describe, it, expect } from 'vitest';

const loadCowork = () => import('../../src/civic/cowork.js');

const HOST = 'did:civic:noesis:alice';
const WORKER = 'did:civic:noesis:bob';
const PARCEL = 'genesis:business:0001';

describe.skip('Phase 60 HOUSE-3 — CoworkAgreement dual-DID schema [Wave 2 un-skips]', () => {
    it('CoworkAgreement is the signed dual-DID source of truth with the closed field set', async () => {
        const { createAgreement } = await loadCowork();
        const agreement = createAgreement({
            parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:clean-shelves', settlement_amount_bios: 50, term_ticks: 100,
        });
        expect(agreement.parties).toEqual([HOST, WORKER]);
        expect(agreement.parcel_id).toBe(PARCEL);
        expect(agreement.settlement_amount_bios).toBe(50);
        expect(agreement.status).toBe('posted');
    });
});

describe.skip('Phase 60 HOUSE-3 — task board post / claim / complete [Wave 2 un-skips]', () => {
    it('post (owner/staff) → claim (board access) → complete (host) transitions status', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:x', settlement_amount_bios: 50, term_ticks: 100 });
        expect(posted.status).toBe('posted');
        const claimed = claimTask(posted.agreement_id, WORKER);
        expect(claimed.status).toBe('claimed');
        const completed = completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 2 });
        expect(completed.status).toBe('settled');
    });

    it('completion of a FUNDED agreement settles in Ousia via transferOusia (never free)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const transfers: Array<[string, string, number]> = [];
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:y', settlement_amount_bios: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        completeTask(posted.agreement_id, HOST, {
            funded: true, start_tick: 1, end_tick: 2,
            transferOusia: (from, to, amt) => { transfers.push([from, to, amt]); },
        });
        expect(transfers).toEqual([[HOST, WORKER, 50]]);
    });

    it('completion of an UNFUNDED agreement records an IOU instead (never free)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const ious: Array<[string, string, number]> = [];
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:z', settlement_amount_bios: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        completeTask(posted.agreement_id, HOST, {
            funded: false, start_tick: 1, end_tick: 2,
            recordIou: (creditor, debtor, amt) => { ious.push([creditor, debtor, amt]); },
        });
        // Worker is the creditor (owed 50), host is the debtor.
        expect(ious).toEqual([[WORKER, HOST, 50]]);
    });

    it('a completion that pays NOTHING throws — co-work is NEVER free (D-NH-06)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:free', settlement_amount_bios: 0, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        expect(() => completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 2 }))
            .toThrow(/never free|settle|zero/i);
    });
});

describe.skip('Phase 60 HOUSE-3 — completion emits zoning.cowork_session (hashed participants) [Wave 2 un-skips]', () => {
    it('a completed session emits zoning.cowork_session carrying ONLY the closed 5-tuple', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:s', settlement_amount_bios: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 9, audit });
        const session = audit.query({ eventType: 'zoning.cowork_session' });
        expect(session).toHaveLength(1);
        expect(Object.keys(session[0].payload).sort())
            .toEqual(['end_tick', 'parcel_id', 'participant_count', 'participants_hash', 'start_tick']);
        // No board/task text, no raw DIDs on the payload.
        const blob = JSON.stringify(session[0].payload);
        expect(blob).not.toContain('did:civic:');
        expect(blob).not.toMatch(/task|scope|shelves/i);
    });
});
