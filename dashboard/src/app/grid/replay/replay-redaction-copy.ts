/**
 * Single-source verbatim copy for tier-restricted payload redaction in the
 * replay surface (D-13-06 / gap-closure 13-07).
 *
 * Tests assert these literals appear in the DOM. Do NOT paraphrase. Do NOT
 * inline these strings elsewhere — import from here.
 *
 * Wall-clock gate: this file lives under dashboard/src/app/grid/replay/ which
 * is scanned by scripts/check-wallclock-forbidden.mjs. Pure constants only —
 * no setInterval / setTimeout / Date.now / Math.random.
 */

export const H4_PLACEHOLDER = '— Requires H4';
export const H5_PLACEHOLDER = '— Requires H5';

/** Event types whose payload detail requires H4+ to view. */
export const H4_RESTRICTED: ReadonlySet<string> = new Set([
    'telos.refined',
    'operator.telos_forced',
]);

/** Event types whose payload detail requires H5+ to view. */
export const H5_RESTRICTED: ReadonlySet<string> = new Set([
    'nous.whispered',
    'operator.nous_deleted',
]);
