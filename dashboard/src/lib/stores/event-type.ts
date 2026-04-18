/**
 * Event-type categorization — classifies an AuditEntry.eventType string into
 * one of the 6 UI filter categories used by the firehose filter chips.
 *
 * Mapping rules (per 03-UI-SPEC.md §Event Type Filter):
 *   - 'trade' — any eventType starting with 'trade.' (prefix match)
 *   - 'message' — exactly 'nous.spoke' or 'nous.direct_message'
 *   - 'movement' — exactly 'nous.moved'
 *   - 'law' — exactly 'law.triggered'
 *   - 'lifecycle' — one of {'nous.spawned', 'grid.started', 'grid.stopped', 'tick'}
 *   - 'other' — any unknown / future / empty string (fall-through)
 *
 * The helper is intentionally pure (no side effects, no I/O). Adding a new
 * category requires one edit here — the filter UI in Plan 05 reads
 * ALL_CATEGORIES and does not hard-code the union anywhere else.
 *
 * Cross-reference: grid/src/audit/broadcast-allowlist.ts — the 10 allowlisted
 * server-side event types. Every allowlisted type maps to a non-'other' UI
 * category by the rules above.
 */

export type EventCategory = 'trade' | 'message' | 'movement' | 'law' | 'lifecycle' | 'other';

const MESSAGE_TYPES: ReadonlySet<string> = new Set(['nous.spoke', 'nous.direct_message']);
const LIFECYCLE_TYPES: ReadonlySet<string> = new Set([
    'nous.spawned',
    'grid.started',
    'grid.stopped',
    'tick',
]);

export function categorizeEventType(eventType: string): EventCategory {
    if (eventType.startsWith('trade.')) return 'trade';
    if (MESSAGE_TYPES.has(eventType)) return 'message';
    if (eventType === 'nous.moved') return 'movement';
    if (eventType === 'law.triggered') return 'law';
    if (LIFECYCLE_TYPES.has(eventType)) return 'lifecycle';
    return 'other';
}

/**
 * The five filter categories exposed as chips in the UI. 'other' is omitted
 * from the filter UX by design — it's a fall-through for future/unknown types,
 * not a user-selectable filter.
 */
export const ALL_CATEGORIES: readonly EventCategory[] = Object.freeze([
    'trade',
    'message',
    'movement',
    'law',
    'lifecycle',
] as const);
