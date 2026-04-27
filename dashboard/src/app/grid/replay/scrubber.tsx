'use client';
/**
 * Scrubber — range slider + numeric input for replay tick navigation.
 *
 * Phase 13 (REPLAY-05 / D-13-04 / D-13-05).
 *
 * Pure presentational + lifted state via prop `value` + `onChange`.
 * NO setInterval, NO setTimeout, NO Date.now — CI gate enforces this.
 * (scripts/check-wallclock-forbidden.mjs / D-13-04 no-auto-play discipline)
 *
 * Numeric input clamping: Math.max(startTick, Math.min(endTick, parsed))
 * before calling onChange.
 */

export interface ScrubberProps {
    value: number;
    startTick: number;
    endTick: number;
    onChange: (tick: number) => void;
}

export function Scrubber({ value, startTick, endTick, onChange }: ScrubberProps) {
    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value, 10);
        if (!isNaN(parsed)) {
            onChange(parsed);
        }
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value, 10);
        if (!isNaN(parsed)) {
            // Clamp to [startTick, endTick]
            const clamped = Math.max(startTick, Math.min(endTick, parsed));
            onChange(clamped);
        }
    };

    return (
        <div className="flex items-center gap-3 px-4 py-2" data-testid="replay-scrubber">
            <input
                type="range"
                min={startTick}
                max={endTick}
                value={value}
                onChange={handleRangeChange}
                className="flex-1 accent-amber-400"
                data-testid="scrubber-range"
                aria-label="Replay tick slider"
            />
            <input
                type="number"
                min={startTick}
                max={endTick}
                value={value}
                onChange={handleNumberChange}
                className="w-20 border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 font-mono focus:border-neutral-500 focus:outline-none"
                data-testid="scrubber-number"
                aria-label="Replay tick value"
            />
        </div>
    );
}
