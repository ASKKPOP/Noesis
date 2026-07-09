import { describe, it, expect } from 'vitest';
import { normalizeAuditEntry } from './audit-types';
import { categorizeEventType } from '../stores/event-type';

/**
 * Regression: ISSUE-010 — /grid Steward Console white-screened.
 * Found by /qa on 2026-07-09.
 * Report: .gstack/qa-reports/qa-report-authenticated-writesurfaces-2026-07-09.md
 *
 * The REST GET /api/v1/audit/trail and the WS visitor firehose return a snake_case
 * projection ({tick, event_type, actor_did, payload}); refill.ts / ws-client.ts cast
 * it straight to AuditEntry (camelCase) without mapping, so entry.eventType was
 * undefined and categorizeEventType(undefined) threw
 * "Cannot read properties of undefined (reading 'startsWith')".
 *
 * The fix: normalizeAuditEntry() maps either shape into AuditEntry with safe
 * defaults, applied at both ingestion boundaries; categorizeEventType guards
 * non-string input.
 */

describe('ISSUE-010 — normalizeAuditEntry maps the snake_case projection', () => {
    it('maps the exact projection that crashed /grid to a string eventType', () => {
        const raw = { tick: 15538, event_type: 'tick', actor_did: 'tick', payload: {} };
        const entry = normalizeAuditEntry(raw);
        expect(entry.eventType).toBe('tick');
        expect(entry.actorDid).toBe('tick');
        expect(entry.payload).toEqual({});
        // The crashing call must now be safe and correct.
        expect(() => categorizeEventType(entry.eventType)).not.toThrow();
        expect(categorizeEventType(entry.eventType)).toBe('lifecycle');
    });

    it('maps a richer snake_case entry (actor + target + hashes)', () => {
        const raw = {
            id: 42,
            event_type: 'trade.settled',
            actor_did: 'did:noesis:hermes',
            target_did: 'did:noesis:sophia',
            payload: { amount: 100 },
            prev_hash: 'aaa',
            event_hash: 'bbb',
            created_at: 1783563449205,
        };
        const entry = normalizeAuditEntry(raw);
        expect(entry).toEqual({
            id: 42,
            eventType: 'trade.settled',
            actorDid: 'did:noesis:hermes',
            targetDid: 'did:noesis:sophia',
            payload: { amount: 100 },
            prevHash: 'aaa',
            eventHash: 'bbb',
            createdAt: 1783563449205,
        });
        expect(categorizeEventType(entry.eventType)).toBe('trade');
    });

    it('is idempotent on an already-camelCase full entry (operator frame)', () => {
        const camel = {
            id: 7,
            eventType: 'nous.spoke',
            actorDid: 'did:noesis:themis',
            payload: {},
            prevHash: 'x',
            eventHash: 'y',
            createdAt: 123,
        };
        expect(normalizeAuditEntry(camel)).toEqual({
            id: 7,
            eventType: 'nous.spoke',
            actorDid: 'did:noesis:themis',
            targetDid: undefined,
            payload: {},
            prevHash: 'x',
            eventHash: 'y',
            createdAt: 123,
        });
    });

    it('fills safe defaults for missing fields (never undefined strings)', () => {
        const entry = normalizeAuditEntry({});
        expect(entry.eventType).toBe('');
        expect(entry.actorDid).toBe('');
        expect(entry.payload).toEqual({});
        expect(entry.createdAt).toBe(0);
    });
});

describe('ISSUE-010 — categorizeEventType guards malformed input', () => {
    it('returns "other" for undefined / non-string / empty (no throw)', () => {
        expect(() => categorizeEventType(undefined as unknown as string)).not.toThrow();
        expect(categorizeEventType(undefined as unknown as string)).toBe('other');
        expect(categorizeEventType(null as unknown as string)).toBe('other');
        expect(categorizeEventType('')).toBe('other');
    });
});
