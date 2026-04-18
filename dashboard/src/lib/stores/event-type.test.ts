import { describe, it, expect } from 'vitest';
import { categorizeEventType, ALL_CATEGORIES, type EventCategory } from './event-type';

/**
 * Event-type categorization — Plan 03-04 Task 1.
 *
 * Maps the 10 allowlisted AuditEntry eventType strings (and any future or
 * unknown type) into the 5 UI filter categories defined in 03-UI-SPEC.md
 * §Event Type Filter. Each row below is a canonical mapping the UI filter
 * relies on; see grid/src/audit/broadcast-allowlist.ts for the full
 * server-side allowlist.
 */

const cases: ReadonlyArray<{ input: string; expected: EventCategory }> = [
    // trade — prefix match on 'trade.'
    { input: 'trade.proposed', expected: 'trade' },
    { input: 'trade.settled', expected: 'trade' },
    { input: 'trade.anything.else', expected: 'trade' },

    // message — two exact strings
    { input: 'nous.spoke', expected: 'message' },
    { input: 'nous.direct_message', expected: 'message' },

    // movement — exact 'nous.moved'
    { input: 'nous.moved', expected: 'movement' },

    // law — exact 'law.triggered'
    { input: 'law.triggered', expected: 'law' },

    // lifecycle — 4 exact strings (spawn + start/stop + tick)
    { input: 'nous.spawned', expected: 'lifecycle' },
    { input: 'grid.started', expected: 'lifecycle' },
    { input: 'grid.stopped', expected: 'lifecycle' },
    { input: 'tick', expected: 'lifecycle' },

    // other — fall-through (unknown future types, empty string)
    { input: 'something.unknown', expected: 'other' },
    { input: '', expected: 'other' },
];

describe('categorizeEventType', () => {
    it.each(cases)('maps $input → $expected', ({ input, expected }) => {
        expect(categorizeEventType(input)).toBe(expected);
    });

    it('is a pure function — same input always returns same output', () => {
        expect(categorizeEventType('trade.proposed')).toBe(categorizeEventType('trade.proposed'));
    });

    it('exposes ALL_CATEGORIES as the 5 filterable UI categories', () => {
        expect([...ALL_CATEGORIES]).toEqual(['trade', 'message', 'movement', 'law', 'lifecycle']);
    });

    it('ALL_CATEGORIES is frozen (immutable at runtime)', () => {
        expect(Object.isFrozen(ALL_CATEGORIES)).toBe(true);
    });
});
