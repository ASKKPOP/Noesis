'use client';
/**
 * AnankeSection — 5-row Drives panel, DRIVE-05 render-surface enforcement.
 *
 * Plan 10a-05 LOCKED contract (per 10a-UI-SPEC):
 *   - LOCKED order: hunger, curiosity, safety, boredom, loneliness
 *   - Each row encodes level via BOTH a colored dot AND the level enum text
 *     (color-not-sole-channel WCAG discipline)
 *   - NO numeric drive value appears in any visible DOM text, title, aria-
 *     label, or data-* attribute (enforced by the privacy grep test)
 *   - Baseline first-paint renders each row with DRIVE_BASELINE_LEVEL and no
 *     direction arrow
 *   - When a new ananke.drive_crossed entry lands, the matching row updates
 *     level + color + direction arrow with no animation
 *   - 45-state aria-label matrix: `{drive} level {level}` or
 *     `{drive} level {level}, {direction}` — no other variants
 *
 * Source-of-truth: useAnankeLevels(did) reads from the existing firehose
 * store. No new HTTP fetch, no new RPC, no addition to NousStateResponse.
 *
 * Zero wall-clock reads. Zero timers. Zero animation.
 */

import { useAnankeLevels } from '@/lib/hooks/use-ananke-levels';
import {
    DRIVE_ORDER,
    type DriveName,
    type DriveLevel,
} from '@/lib/protocol/ananke-types';

/** Drive glyph map — LOCKED per 10a-UI-SPEC §Drive Glyph Matrix. */
const DRIVE_GLYPH: Record<DriveName, string> = {
    hunger: '\u2298',       // ⊘ CIRCLED DIVISION SLASH
    curiosity: '\u2726',    // ✦ BLACK FOUR POINTED STAR
    safety: '\u25C6',       // ◆ BLACK DIAMOND
    boredom: '\u25EF',      // ◯ LARGE CIRCLE
    loneliness: '\u274D',   // ❍ SHADOWED WHITE CIRCLE
};

/** Level palette — LOCKED per 10a-UI-SPEC §Level Bucket Color Encoding. */
const LEVEL_STYLE: Record<DriveLevel, { dotClass: string; textClass: string }> = {
    low:  { dotClass: 'bg-neutral-400', textClass: 'text-neutral-400' },
    med:  { dotClass: 'bg-amber-400',   textClass: 'text-amber-400' },
    high: { dotClass: 'bg-rose-400',    textClass: 'text-rose-400' },
};

/** Direction glyph map — LOCKED. Stable = no glyph rendered. */
const DIRECTION_GLYPH = {
    rising: '\u2191',  // ↑
    falling: '\u2193', // ↓
} as const;

export interface AnankeSectionProps {
    readonly did: string | null;
}

export function AnankeSection({ did }: AnankeSectionProps): React.ReactElement {
    const levels = useAnankeLevels(did);
    return (
        <section
            data-testid="section-ananke"
            aria-labelledby="section-ananke-title"
            className="mb-4"
        >
            <h3
                id="section-ananke-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Drives
            </h3>
            <ul
                role="list"
                aria-label="Current drive pressure levels"
                className="flex flex-col gap-1"
            >
                {DRIVE_ORDER.map((drive) => {
                    const entry = levels.get(drive)!;
                    const { level, direction } = entry;
                    const ariaLabel = direction
                        ? `${drive} level ${level}, ${direction}`
                        : `${drive} level ${level}`;
                    return (
                        <li
                            key={drive}
                            data-testid={`drive-row-${drive}`}
                            data-drive={drive}
                            data-level={level}
                            data-direction={direction ?? 'stable'}
                            className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                        >
                            <span
                                data-testid={`drive-dot-${drive}`}
                                aria-hidden="true"
                                className={`inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[level].dotClass}`}
                            />
                            <span
                                data-testid={`drive-glyph-${drive}`}
                                aria-hidden="true"
                                className="text-sm leading-none text-neutral-200"
                            >
                                {DRIVE_GLYPH[drive]}
                            </span>
                            <span className="flex-1 text-xs text-neutral-200">
                                {drive}
                            </span>
                            <span
                                data-testid={`drive-level-${drive}`}
                                className={`text-xs ${LEVEL_STYLE[level].textClass}`}
                                aria-label={ariaLabel}
                            >
                                {level}
                            </span>
                            {direction && (
                                <span
                                    data-testid={`drive-direction-${drive}`}
                                    aria-hidden="true"
                                    className={`text-xs tabular-nums ${LEVEL_STYLE[level].textClass}`}
                                >
                                    {DIRECTION_GLYPH[direction]}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
