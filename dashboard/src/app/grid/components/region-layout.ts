/**
 * Pure, framework-agnostic region layout math for the Phase-3 region map.
 *
 * Extracted from region-map.tsx (Plan 03-06 Task 1) so it can be imported
 * from Playwright E2E specs WITHOUT pulling in React, `'use client'`, or the
 * usePresence hook. Both region-map.tsx and tests/e2e/grid-page.spec.ts
 * import `computeRegionLayout` from here and therefore produce identical
 * coordinates — the E2E spec never hardcodes pixel positions.
 *
 * Contract (resolves 03-RESEARCH Open Question Q1b):
 *   - Hashes region.id (FNV-1a 32-bit, `Math.imul`-based so 32-bit math is
 *     identical across Node and any browser) into a GRID_CELLS × GRID_CELLS
 *     bucket, then rescales the cell center into [PADDING, 1 - PADDING]².
 *   - Linear-probes on collision so two regions never overlap exactly.
 *   - Deterministic: same input → same output, forever.
 */

import type { Region } from '@/lib/protocol/region-types';

export const VIEWPORT_W = 720;
export const VIEWPORT_H = 480;
export const REGION_R = 16;
export const MARKER_R = 5;
export const PADDING = 0.05;
export const GRID_CELLS = 5;

/**
 * FNV-1a 32-bit hash of a string.
 *
 * Chosen for zero dependencies and perfectly stable cross-runtime bucketing;
 * cryptographic properties are irrelevant to this use.
 */
export function hashId(id: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * Deterministic normalized coordinates in [PADDING, 1 - PADDING]² for each
 * region.id. The RegionMap component multiplies each (x, y) by
 * (VIEWPORT_W, VIEWPORT_H) to get pixel positions.
 */
export function computeRegionLayout(
    regions: readonly Region[],
): Map<string, { x: number; y: number }> {
    const taken = new Set<number>();
    const out = new Map<string, { x: number; y: number }>();
    const totalCells = GRID_CELLS * GRID_CELLS;
    for (const r of regions) {
        const h = hashId(r.id);
        let cell = h % totalCells;
        while (taken.has(cell)) cell = (cell + 1) % totalCells;
        taken.add(cell);
        const cx = cell % GRID_CELLS;
        const cy = Math.floor(cell / GRID_CELLS);
        const x = PADDING + ((cx + 0.5) / GRID_CELLS) * (1 - 2 * PADDING);
        const y = PADDING + ((cy + 0.5) / GRID_CELLS) * (1 - 2 * PADDING);
        out.set(r.id, { x, y });
    }
    return out;
}
