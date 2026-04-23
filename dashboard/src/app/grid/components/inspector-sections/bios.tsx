'use client';
/**
 * BiosSection — 2-row Needs panel, BIOS render-surface enforcement.
 *
 * Phase 10b BIOS-01 LOCKED contract (per 10b-UI-SPEC):
 *   - 2 rows: energy (⚡ U+26A1) and sustenance (⬡ U+2B21)
 *   - Each row encodes level via BOTH a colored dot AND the level enum text
 *     (color-not-sole-channel WCAG discipline)
 *   - NO numeric need value appears in any visible DOM text, title, aria-
 *     label, or data-* attribute (enforced by the privacy grep test)
 *   - Empty state (did === null): "—" placeholder, aria-label="{need} pending"
 *   - When a new ananke.drive_crossed entry for hunger/safety lands, the
 *     matching row updates level + color + direction arrow with no animation
 *   - Aria-label grammar: `{need} {level}` or `{need} {level} {direction}`
 *     (18-case matrix: 2 needs × 3 levels × 3 direction states)
 *
 * Source-of-truth: useBiosLevels(did) reads from the existing firehose
 * store. No new HTTP fetch, no new RPC, no addition to NousStateResponse.
 *
 * Zero wall-clock reads. Zero timers. Zero animation.
 */

import { useBiosLevels } from '@/lib/hooks/use-bios-levels';
import {
    NEED_ORDER,
    NEED_GLYPH,
    type NeedName,
    type NeedLevel,
    type BiosLevelEntry,
} from '@/lib/protocol/bios-types';

/** Level palette — mirrors Ananke LEVEL_STYLE (LOCKED per 10b-UI-SPEC §Level Bucket Color Encoding). */
const LEVEL_STYLE: Record<NeedLevel, { dotClass: string; textClass: string }> = {
    low:  { dotClass: 'bg-neutral-400', textClass: 'text-neutral-400' },
    med:  { dotClass: 'bg-amber-400',   textClass: 'text-amber-400' },
    high: { dotClass: 'bg-rose-400',    textClass: 'text-rose-400' },
};

/** Direction glyph map — LOCKED. Stable = no glyph rendered. */
const DIRECTION_GLYPH = {
    rising: '\u2191',  // ↑
    falling: '\u2193', // ↓
} as const;

export interface BiosSectionProps {
    readonly did: string | null;
}

export function BiosSection({ did }: BiosSectionProps): React.ReactElement {
    const levels = useBiosLevels(did);
    return (
        <section
            data-testid="section-bios"
            aria-labelledby="section-bios-title"
            className="mb-4"
        >
            <h3
                id="section-bios-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Bios
            </h3>
            <ul
                role="list"
                aria-label="Current need pressure levels"
                className="flex flex-col gap-1"
            >
                {NEED_ORDER.map((need) => {
                    const entry = levels.get(need) as BiosLevelEntry | undefined;
                    const isPending = did === null || !entry;
                    const ariaLabel = isPending
                        ? `${need} pending`
                        : entry.direction
                            ? `${need} ${entry.level} ${entry.direction}`
                            : `${need} ${entry.level}`;
                    return (
                        <li
                            key={need}
                            data-testid={`need-row-${need}`}
                            data-need={need}
                            data-level={isPending ? 'pending' : entry!.level}
                            data-direction={isPending ? 'pending' : (entry!.direction ?? 'stable')}
                            aria-label={ariaLabel}
                            className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                        >
                            {isPending ? (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className="text-sm leading-none text-neutral-200"
                                    >
                                        {NEED_GLYPH[need as NeedName]}
                                    </span>
                                    <span className="flex-1 text-xs text-neutral-200">
                                        {need}
                                    </span>
                                    <span className="text-xs text-neutral-600">—</span>
                                </>
                            ) : (
                                <>
                                    <span
                                        data-testid={`need-dot-${need}`}
                                        aria-hidden="true"
                                        className={`inline-block h-2 w-2 rounded-full ${LEVEL_STYLE[entry!.level].dotClass}`}
                                    />
                                    <span
                                        data-testid={`need-glyph-${need}`}
                                        aria-hidden="true"
                                        className="text-sm leading-none text-neutral-200"
                                    >
                                        {NEED_GLYPH[need as NeedName]}
                                    </span>
                                    <span className="flex-1 text-xs text-neutral-200">
                                        {need}
                                    </span>
                                    <span
                                        data-testid={`need-level-${need}`}
                                        className={`text-xs ${LEVEL_STYLE[entry!.level].textClass}`}
                                    >
                                        {entry!.level}
                                    </span>
                                    {entry!.direction && (
                                        <span
                                            data-testid={`need-direction-${need}`}
                                            aria-hidden="true"
                                            className={`text-xs tabular-nums ${LEVEL_STYLE[entry!.level].textClass}`}
                                        >
                                            {DIRECTION_GLYPH[entry!.direction as keyof typeof DIRECTION_GLYPH]}
                                        </span>
                                    )}
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
