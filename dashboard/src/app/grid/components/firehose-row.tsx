'use client';
/**
 * FirehoseRow — a single 28px row in the firehose panel.
 *
 * Renders: timestamp (HH:MM:SS, mono) · event-type badge (category color) ·
 * actor name (resolved from PresenceStore.nameOf, falling back to a truncated
 * did) · payload preview (first 3 k=v pairs joined with spaces).
 *
 * Per 03-UI-SPEC.md:
 *   - Row height: 28px exception (documented in spec §Spacing)
 *   - Micro typography: 12px JetBrains Mono, line-height 1.3
 *   - Event-type colors per §Color §Event-type color coding
 *   - No click handlers in Phase 3 (observer-only)
 *
 * Security: payloadPreview returns a plain string (React JSX escapes it), never
 * dangerouslySetInnerHTML. Truncation at 24 chars per string value limits how
 * much arbitrary content a single row can display (T-03-17 mitigation).
 */

import { usePresence } from '../hooks';
import { categorizeEventType, type EventCategory } from '@/lib/stores/event-type';
import type { AuditEntry } from '@/lib/protocol/audit-types';
import { H4_PLACEHOLDER, H5_PLACEHOLDER, H4_RESTRICTED, H5_RESTRICTED } from '@/app/grid/replay/replay-redaction-copy';

/**
 * Category → Tailwind classes for the event-type badge.
 * Colors sourced from 03-UI-SPEC.md §Color §Event-type color coding.
 * Each entry produces a small pill with a tinted background and lighter text.
 */
const CATEGORY_BADGE: Record<EventCategory, string> = {
    movement: 'bg-blue-400/10 text-blue-300',
    message: 'bg-violet-400/10 text-violet-300',
    trade: 'bg-amber-400/10 text-amber-300',
    law: 'bg-pink-400/10 text-pink-300',
    lifecycle: 'bg-neutral-500/10 text-neutral-300',
    other: 'bg-neutral-700/20 text-neutral-400',
};

function formatTimestamp(ms: number): string {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function truncateDid(did: string): string {
    // Strip the did scheme prefix if present, then cap length to keep the
    // actor column width predictable (120px at 12px mono ≈ 20ch).
    const stripped = did.replace(/^did:[^:]+:/, '');
    return stripped.length > 18 ? `${stripped.slice(0, 15)}…` : stripped;
}

/**
 * Render the first three payload entries as "k=v" tokens. String values are
 * truncated to 24 characters to prevent one runaway string from blowing out
 * the row. Non-string values go through JSON.stringify (safe for React
 * children — it returns a string).
 */
function payloadPreview(payload: Record<string, unknown>): string {
    const keys = Object.keys(payload);
    if (keys.length === 0) return '';
    const chunks: string[] = [];
    for (let i = 0; i < Math.min(3, keys.length); i += 1) {
        const k = keys[i];
        const v = payload[k];
        let repr: string;
        if (typeof v === 'string') {
            repr = v.length > 24 ? `${v.slice(0, 24)}…` : v;
        } else if (v === null || v === undefined) {
            repr = String(v);
        } else if (typeof v === 'number' || typeof v === 'boolean') {
            repr = String(v);
        } else {
            try {
                repr = JSON.stringify(v);
            } catch {
                repr = '[unserializable]';
            }
            if (repr.length > 24) repr = `${repr.slice(0, 24)}…`;
        }
        chunks.push(`${k}=${repr}`);
    }
    return chunks.join(' ');
}

export interface FirehoseRowProps {
    readonly entry: AuditEntry;
    /**
     * Phase 7 (Plan 07-04 Task 3): optional dialogue_id filter. When non-null,
     * rows that do NOT match receive `opacity-40 pointer-events-none` — the
     * dim-not-hide invariant (AC-4-3-3). When null or undefined, row renders
     * identically to pre-Phase-7 (zero-diff, AC-4-3-4).
     *
     * Match predicate: entry.eventType === 'telos.refined' AND
     *                  entry.payload.triggered_by_dialogue_id === filter.value
     */
    readonly dialogueFilter?: { key: 'dialogue_id'; value: string } | null;
    /**
     * Phase 13 (REPLAY-05 / D-13-06 / gap-closure 13-07): operator tier for
     * inline payload redaction. When undefined, no redaction is applied
     * (live /grid behavior unchanged — backward-compatible default).
     * Format: 'H1' | 'H2' | 'H3' | 'H4' | 'H5'.
     */
    readonly operatorTier?: string;
}

export function FirehoseRow({
    entry,
    dialogueFilter = null,
    operatorTier,
}: FirehoseRowProps): React.ReactElement {
    const presence = usePresence();
    const category = categorizeEventType(entry.eventType);
    const resolvedName = presence.nameOf(entry.actorDid);
    const actorDisplay =
        resolvedName ?? (entry.actorDid === 'system' ? 'system' : truncateDid(entry.actorDid));

    // Phase 7: dim-not-hide when dialogue_id filter active and row doesn't
    // match. Row is a match iff it's a telos.refined event whose
    // triggered_by_dialogue_id equals the filter value.
    const isMatch =
        dialogueFilter === null ||
        (entry.eventType === 'telos.refined' &&
            typeof entry.payload === 'object' &&
            entry.payload !== null &&
            (entry.payload as { triggered_by_dialogue_id?: string })
                .triggered_by_dialogue_id === dialogueFilter.value);
    const dimClass = isMatch ? '' : ' opacity-40 pointer-events-none';

    // Phase 8: destructive visual treatment for operator.nous_deleted rows (UI-SPEC §Firehose).
    // Red left border accent, rose badge, red strikethrough actor name.
    const isDeleted = entry.eventType === 'operator.nous_deleted';
    const rowBorderClass = isDeleted ? ' border-l-2 border-rose-900' : '';
    const badgeClass = isDeleted
        ? 'bg-rose-900/20 text-rose-300'
        : CATEGORY_BADGE[category];
    const actorClass = isDeleted
        ? 'text-red-400 line-through w-[132px] shrink-0 truncate'
        : 'text-neutral-200 w-[132px] shrink-0 truncate';

    return (
        <li
            role="listitem"
            data-testid="firehose-row"
            data-event-id={entry.id ?? ''}
            className={`flex items-center gap-2 h-[28px] px-3 border-b border-neutral-800/60 font-mono text-[12px] leading-[1.3] hover:bg-neutral-900/50 hover:border-l hover:border-l-sky-300${dimClass}${rowBorderClass}`}
        >
            <span className="text-neutral-500 w-[72px] shrink-0 tabular-nums">
                {formatTimestamp(entry.createdAt)}
            </span>
            <span
                data-testid="event-type-badge"
                data-category={category}
                className={`text-[10px] uppercase tracking-wide px-1.5 py-[1px] rounded-sm shrink-0 ${badgeClass}`}
            >
                {entry.eventType}
            </span>
            <span
                data-testid="firehose-actor"
                className={actorClass}
                title={entry.actorDid}
            >
                {actorDisplay}
            </span>
            <span className="text-neutral-400 flex-1 truncate">
                {(() => {
                    // Phase 13 (D-13-06 / gap-closure 13-07): tier-aware payload redaction.
                    // When operatorTier is undefined (live /grid — no tier plumbed), tierNum
                    // is 99 so neither restriction branch fires — backward-compat preserved.
                    const tierNum = operatorTier ? parseInt(operatorTier.replace('H', ''), 10) : 99;
                    if (H5_RESTRICTED.has(entry.eventType) && tierNum < 5) {
                        return H5_PLACEHOLDER;
                    }
                    if (H4_RESTRICTED.has(entry.eventType) && tierNum < 4) {
                        return H4_PLACEHOLDER;
                    }
                    return payloadPreview(entry.payload);
                })()}
            </span>
        </li>
    );
}
