/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the zoning.cowork_session sole producer
 * (D-60-09.4 / R-60-08/11). Allowlist position 99.
 *
 * describe.skip: grid/src/audit/append-zoning-cowork-session.ts lands in Wave 4 (clones the
 * append-treasury-parcel-revenue triad). Deferred dynamic import (Phase 58/59 Wave-0 pattern)
 * defers module resolution until the suite is un-skipped.
 *
 * Closed 5-tuple {end_tick, parcel_id, participant_count, participants_hash, start_tick}:
 *   - participants_hash HEX64 (a single hash over the sorted participant DID set — NO raw DIDs,
 *     NO board/task text); participant_count positive int; parcel_id PARCEL_ID_RE;
 *   - start_tick/end_tick non-negative ints; actorDid = parcel_id;
 *   - a 6th key throws (closed tuple); no FORBIDDEN_KEY_PATTERN key.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-zoning-cowork-session.js');
const loadChain = () => import('../../src/audit/chain.js');

const PARCEL = 'genesis:business:0001';
const valid = {
    end_tick: 9,
    parcel_id: PARCEL,
    participant_count: 2,
    participants_hash: 'a'.repeat(64),
    start_tick: 1,
};

describe('Phase 60 — appendZoningCoworkSession sole producer [Wave 4 un-skips]', () => {
    it('lands a valid event with the parcel_id as actor', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningCoworkSession(new AuditChain(), valid);
        expect(entry.eventType).toBe('zoning.cowork_session');
        expect(entry.actorDid).toBe(PARCEL);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 5-tuple {end_tick, parcel_id, participant_count, participants_hash, start_tick}', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningCoworkSession(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['end_tick', 'parcel_id', 'participant_count', 'participants_hash', 'start_tick']);
    });

    it('rejects a non-HEX64 participants_hash (single hash over the sorted DID set)', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningCoworkSession(new AuditChain(), { ...valid, participants_hash: 'not-a-hash' }))
            .toThrow(/hash|HEX/i);
    });

    it('rejects a non-positive participant_count', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningCoworkSession(new AuditChain(), { ...valid, participant_count: 0 }))
            .toThrow(/participant_count/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningCoworkSession(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/PARCEL_ID/);
    });

    it('rejects a negative start_tick / end_tick', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendZoningCoworkSession(new AuditChain(), { ...valid, start_tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 6th key (closed-tuple) — raw participant DIDs must NEVER be on the payload', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendZoningCoworkSession(new AuditChain(), { ...valid, participants: ['did:civic:noesis:alice'] }))
            .toThrow(/closed-tuple/);
    });

    it('carries no raw DID, no board/task text, and no FORBIDDEN_KEY_PATTERN key (privacy walker)', async () => {
        const { appendZoningCoworkSession } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendZoningCoworkSession(new AuditChain(), valid);
        const serialized = JSON.stringify(entry.payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/task|scope|board|content|body|text/i);
    });
});
