/**
 * Phase 54 Portal Nous Approval (NOUS track) — NousRegistrationStore.
 * request → pre-screen (forward/reject) → Polis review (approve+residence / reject).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { NousRegistrationStore } from '../../src/portal-workflows/nous-registration-store.js';
import { AuditChain } from '../../src/audit/chain.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const OPERATOR = 'did:noesis:human:op';
const NOUS = 'did:civic:noesis:nous:sophia';
const RID = '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9'; // UUID format (polis.registration_pending requires it)
const requested = (status = 'requested') => [{ request_id: RID, nous_type: 'A', registrant_did: OPERATOR, nous_did: NOUS, target_grid: 'genesis', status }];

describe('NousRegistrationStore.request', () => {
    it('files a request + emits nous.registration_requested (hashed registrant, UUID id)', async () => {
        const p = pool(); const audit = new AuditChain();
        const r = await new NousRegistrationStore(p, audit).request({ type: 'A', registrantDid: OPERATOR, nousDid: NOUS, targetGrid: 'genesis', tick: 5 });
        expect(r.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        const ev = audit.query({ eventType: 'nous.registration_requested' });
        expect(ev).toHaveLength(1);
        expect((ev[0].payload as Record<string, unknown>).type).toBe('A');
        expect(JSON.stringify(ev[0].payload)).not.toContain(OPERATOR);
    });
});

describe('NousRegistrationStore.preScreen', () => {
    it('pass → forwards to Polis (polis.registration_pending)', async () => {
        const audit = new AuditChain();
        const r = await new NousRegistrationStore(pool(requested()), audit).preScreen({ requestId: RID, pass: true, tick: 6 });
        expect(r).toEqual({ ok: true, forwarded: true });
        expect(audit.query({ eventType: 'polis.registration_pending' })).toHaveLength(1);
    });
    it('fail → nous.registration_rejected with a closed-enum reason', async () => {
        const audit = new AuditChain();
        const r = await new NousRegistrationStore(pool(requested()), audit).preScreen({ requestId: RID, pass: false, reason: 'prescreen_sybil', tick: 6 });
        expect(r).toEqual({ ok: true, forwarded: false });
        const ev = audit.query({ eventType: 'nous.registration_rejected' });
        expect((ev[0].payload as Record<string, unknown>).reason_code).toBe('prescreen_sybil');
    });
});

describe('NousRegistrationStore.polisReview', () => {
    it('approve → nous.registration_approved + zoning.residence_assigned', async () => {
        const audit = new AuditChain();
        const r = await new NousRegistrationStore(pool(requested('polis_pending')), audit).polisReview({ requestId: RID, decision: 'approve', tick: 7 });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.residenceId).toMatch(/^res-/);
        expect(audit.query({ eventType: 'nous.registration_approved' })).toHaveLength(1);
        expect(audit.query({ eventType: 'zoning.residence_assigned' })).toHaveLength(1);
    });
    it('reject → nous.registration_rejected', async () => {
        const audit = new AuditChain();
        const r = await new NousRegistrationStore(pool(requested('polis_pending')), audit).polisReview({ requestId: RID, decision: 'reject', reason: 'charter_incompatible', tick: 7 });
        expect(r.ok).toBe(true);
        expect(audit.query({ eventType: 'nous.registration_rejected' })).toHaveLength(1);
    });
    it('bad_state when not polis_pending', async () => {
        const r = await new NousRegistrationStore(pool(requested('requested')), new AuditChain()).polisReview({ requestId: RID, decision: 'approve', tick: 7 });
        expect(r).toEqual({ ok: false, reason: 'bad_state' });
    });
});
