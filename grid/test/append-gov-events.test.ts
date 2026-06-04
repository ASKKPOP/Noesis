/**
 * Phase 46 (CIVGOV-06) — sole-producer tests for the 6 gov.* audit events.
 *
 * Each producer enforces the 9-step guard discipline (type guard → per-field regex/int
 * checks → closed-tuple → explicit reconstruction → payloadPrivacyCheck → audit.append).
 * Conventions mirror append-irs-disbursement-authorized.test.ts:
 *   - missing *validated* key → generic TypeError (per-field guard trips first)
 *   - extra key → /closed-tuple/
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const HEX64 = 'a'.repeat(64);
const UUID = '11111111-1111-4111-8111-111111111111';
const UUID2 = '22222222-2222-4222-8222-222222222222';

function mockAudit() {
    return {
        append: vi.fn((event_type: string, actor_did: string, payload: unknown) => ({
            id: 1n, tick: 0, event_type, actor_did, payload, prev_hash: '', this_hash: '',
        })),
    };
}

describe('appendGovBillDrafted', () => {
    let fn: (a: unknown, p: unknown) => unknown;
    beforeAll(async () => { fn = (await import('../src/audit/append-gov-bill-drafted.js')).appendGovBillDrafted; });
    const valid = () => ({ author_civic_did_hash: HEX64, bill_id: UUID, category: 'tax', content_hash: HEX64, tick: 5, title_hash: HEX64 });

    it('accepts valid 6-key payload; actorDid = author_civic_did_hash', () => {
        const a = mockAudit();
        fn(a, valid());
        expect(a.append.mock.calls[0][0]).toBe('gov.bill_drafted');
        expect(a.append.mock.calls[0][1]).toBe(HEX64);
    });
    it('rejects non-object (TypeError)', () => { const a = mockAudit(); expect(() => fn(a, null)).toThrow(TypeError); expect(() => fn(a, [])).toThrow(TypeError); });
    it('rejects bad author hash', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), author_civic_did_hash: 'nope' })).toThrow(/author_civic_did_hash/); });
    it('rejects bad bill_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), bill_id: 'not-uuid' })).toThrow(/bill_id/); });
    it('rejects empty category and oversized category', () => {
        const a = mockAudit();
        expect(() => fn(a, { ...valid(), category: '' })).toThrow(/category/);
        expect(() => fn(a, { ...valid(), category: 'x'.repeat(64) })).toThrow(/category/);
    });
    it('rejects negative tick; accepts 0', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), tick: -1 })).toThrow(/tick/); expect(() => fn(a, { ...valid(), tick: 0 })).not.toThrow(); });
    it('rejects extra key (/closed-tuple/)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), extra: 1 })).toThrow(/closed-tuple/); });
    it('rejects missing key (TypeError)', () => { const a = mockAudit(); const p = { ...valid() } as Record<string, unknown>; delete p.title_hash; expect(() => fn(a, p)).toThrow(TypeError); });
    it('sends explicit alphabetical reconstruction', () => {
        const a = mockAudit(); fn(a, valid());
        expect(Object.keys(a.append.mock.calls[0][2] as object).sort()).toEqual(['author_civic_did_hash', 'bill_id', 'category', 'content_hash', 'tick', 'title_hash']);
    });
});

describe('appendGovBillCosponsored', () => {
    let fn: (a: unknown, p: unknown) => unknown;
    beforeAll(async () => { fn = (await import('../src/audit/append-gov-bill-cosponsored.js')).appendGovBillCosponsored; });
    const valid = () => ({ bill_id: UUID, cosponsor_civic_did_hash: HEX64, cosponsor_count: 2, tick: 7 });

    it('accepts valid 4-key payload; actorDid = cosponsor hash', () => {
        const a = mockAudit(); fn(a, valid());
        expect(a.append.mock.calls[0][0]).toBe('gov.bill_cosponsored');
        expect(a.append.mock.calls[0][1]).toBe(HEX64);
    });
    it('rejects non-object', () => { const a = mockAudit(); expect(() => fn(a, 5)).toThrow(TypeError); });
    it('rejects bad cosponsor hash', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), cosponsor_civic_did_hash: 'x' })).toThrow(/cosponsor_civic_did_hash/); });
    it('rejects non-positive cosponsor_count (0, -1)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), cosponsor_count: 0 })).toThrow(/cosponsor_count/); expect(() => fn(a, { ...valid(), cosponsor_count: -1 })).toThrow(/cosponsor_count/); });
    it('rejects extra key (/closed-tuple/)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), extra: 1 })).toThrow(/closed-tuple/); });
    it('rejects missing key (TypeError)', () => { const a = mockAudit(); const p = { ...valid() } as Record<string, unknown>; delete p.tick; expect(() => fn(a, p)).toThrow(TypeError); });
});

describe('appendGovSessionOpened', () => {
    let fn: (a: unknown, p: unknown) => unknown;
    beforeAll(async () => { fn = (await import('../src/audit/append-gov-session-opened.js')).appendGovSessionOpened; });
    const valid = () => ({ bill_id: UUID, debate_deadline_tick: 100, gov_session_id: UUID2, speaker_civic_did_hash: HEX64, tick: 10 });

    it('accepts valid 5-key payload; actorDid = speaker hash', () => {
        const a = mockAudit(); fn(a, valid());
        expect(a.append.mock.calls[0][0]).toBe('gov.session_opened');
        expect(a.append.mock.calls[0][1]).toBe(HEX64);
    });
    it('rejects bad gov_session_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), gov_session_id: 'x' })).toThrow(/gov_session_id/); });
    it('rejects non-positive debate_deadline_tick', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), debate_deadline_tick: 0 })).toThrow(/debate_deadline_tick/); });
    it('rejects bad speaker hash', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), speaker_civic_did_hash: 'x' })).toThrow(/speaker_civic_did_hash/); });
    it('rejects extra key (/closed-tuple/)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), extra: 1 })).toThrow(/closed-tuple/); });
});

describe('appendGovSessionClosed', () => {
    let fn: (a: unknown, p: unknown) => unknown;
    beforeAll(async () => { fn = (await import('../src/audit/append-gov-session-closed.js')).appendGovSessionClosed; });
    const valid = () => ({ bill_id: UUID, gov_session_id: UUID2, outcome: 'advanced_to_vote', speaker_civic_did_hash: HEX64, tick: 12 });

    it('accepts both valid outcomes', () => {
        const a = mockAudit();
        expect(() => fn(a, valid())).not.toThrow();
        expect(() => fn(a, { ...valid(), outcome: 'withdrawn' })).not.toThrow();
        expect(a.append.mock.calls[0][0]).toBe('gov.session_closed');
    });
    it('rejects invalid outcome', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), outcome: 'maybe' })).toThrow(/outcome/); });
    it('rejects bad bill_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), bill_id: 'x' })).toThrow(/bill_id/); });
    it('rejects extra key (/closed-tuple/)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), extra: 1 })).toThrow(/closed-tuple/); });
});

describe('appendGovLawEnacted', () => {
    let fn: (a: unknown, p: unknown) => unknown;
    beforeAll(async () => { fn = (await import('../src/audit/append-gov-law-enacted.js')).appendGovLawEnacted; });
    const valid = () => ({ bill_id: UUID, enacted_at_tick: 20, law_id: UUID2, supersedes_law_id: null });

    it('accepts null supersedes_law_id; actorDid = law_id', () => {
        const a = mockAudit(); fn(a, valid());
        expect(a.append.mock.calls[0][0]).toBe('gov.law_enacted');
        expect(a.append.mock.calls[0][1]).toBe(UUID2);
    });
    it('accepts UUID supersedes_law_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), supersedes_law_id: UUID })).not.toThrow(); });
    it('rejects non-UUID, non-null supersedes_law_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), supersedes_law_id: 'x' })).toThrow(/supersedes_law_id/); });
    it('rejects bad law_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), law_id: 'x' })).toThrow(/law_id/); });
    it('rejects negative enacted_at_tick', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), enacted_at_tick: -1 })).toThrow(/enacted_at_tick/); });
    it('rejects extra key (/closed-tuple/)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), extra: 1 })).toThrow(/closed-tuple/); });
});

describe('appendGovLawRepealed', () => {
    let fn: (a: unknown, p: unknown) => unknown;
    beforeAll(async () => { fn = (await import('../src/audit/append-gov-law-repealed.js')).appendGovLawRepealed; });
    const valid = () => ({ law_id: UUID, repealing_bill_id: UUID2, tick: 30 });

    it('accepts valid 3-key payload; actorDid = law_id', () => {
        const a = mockAudit(); fn(a, valid());
        expect(a.append.mock.calls[0][0]).toBe('gov.law_repealed');
        expect(a.append.mock.calls[0][1]).toBe(UUID);
    });
    it('rejects bad repealing_bill_id', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), repealing_bill_id: 'x' })).toThrow(/repealing_bill_id/); });
    it('rejects negative tick', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), tick: -1 })).toThrow(/tick/); });
    it('rejects extra key (/closed-tuple/)', () => { const a = mockAudit(); expect(() => fn(a, { ...valid(), extra: 1 })).toThrow(/closed-tuple/); });
    it('rejects missing key (TypeError)', () => { const a = mockAudit(); const p = { ...valid() } as Record<string, unknown>; delete p.tick; expect(() => fn(a, p)).toThrow(TypeError); });
});
