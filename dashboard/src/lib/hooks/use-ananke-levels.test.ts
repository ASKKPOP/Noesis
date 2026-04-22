/**
 * Plan 10a-05 Task 1 — useAnankeLevels hook tests.
 *
 * Mirrors the pattern of use-refined-telos-history.test.ts: derived selector
 * over useFirehose(). Zero new RPC, zero new WebSocket.
 *
 * Behavior contract:
 *   - returns baseline map for null DID (all drives at DRIVE_BASELINE_LEVEL)
 *   - returns baseline map for empty firehose
 *   - applies the most recent ananke.drive_crossed entry per drive
 *   - ignores entries for other DIDs
 *   - ignores non-ananke entry types
 *
 * Hysteresis-aware baselines (locked per 10a-UI-SPEC §Baseline):
 *   hunger=low, curiosity=med, safety=low, boredom=med, loneliness=med.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { FirehoseSnapshot } from '@/lib/stores/firehose-store';
import type { AuditEntry } from '@/lib/protocol/audit-types';

// Mutable snapshot the test body rewrites per-case.
let mockSnapshot: FirehoseSnapshot = {
    entries: [],
    filteredEntries: [],
    filter: null,
    size: 0,
};

vi.mock('@/app/grid/hooks', () => ({
    useFirehose: () => mockSnapshot,
}));

import { useAnankeLevels } from './use-ananke-levels';
import {
    DRIVE_ORDER,
    DRIVE_BASELINE_LEVEL,
} from '@/lib/protocol/ananke-types';

function makeSnapshot(entries: readonly AuditEntry[]): FirehoseSnapshot {
    return {
        entries,
        filteredEntries: entries,
        filter: null,
        size: entries.length,
    };
}

function makeEntry(
    eventType: string,
    actorDid: string,
    payload: Record<string, unknown>,
    id: number,
): AuditEntry {
    return {
        id,
        eventType,
        actorDid,
        payload,
        prevHash: `prev${id}`,
        eventHash: `hash${id}`,
        createdAt: 1_700_000_000_000 + id * 1000,
    };
}

const ALPHA = 'did:noesis:alpha';
const BETA = 'did:noesis:beta';

describe('useAnankeLevels', () => {
    beforeEach(() => {
        mockSnapshot = makeSnapshot([]);
    });

    it('returns_baseline_for_null_did — map of 5 drives at baseline, direction null', () => {
        const { result } = renderHook(() => useAnankeLevels(null));
        expect(result.current.size).toBe(5);
        for (const drive of DRIVE_ORDER) {
            const entry = result.current.get(drive);
            expect(entry).toBeDefined();
            expect(entry!.level).toBe(DRIVE_BASELINE_LEVEL[drive]);
            expect(entry!.direction).toBeNull();
        }
    });

    it('returns_baseline_for_empty_store', () => {
        const { result } = renderHook(() => useAnankeLevels(ALPHA));
        expect(result.current.size).toBe(5);
        for (const drive of DRIVE_ORDER) {
            const entry = result.current.get(drive);
            expect(entry!.level).toBe(DRIVE_BASELINE_LEVEL[drive]);
            expect(entry!.direction).toBeNull();
        }
    });

    it('applies_single_crossing — hunger low→med rising', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'ananke.drive_crossed',
                ALPHA,
                {
                    did: ALPHA,
                    tick: 100,
                    drive: 'hunger',
                    level: 'med',
                    direction: 'rising',
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useAnankeLevels(ALPHA));
        const hunger = result.current.get('hunger');
        expect(hunger).toEqual({ level: 'med', direction: 'rising' });
        // Unchanged drives stay at baseline.
        expect(result.current.get('curiosity')).toEqual({
            level: DRIVE_BASELINE_LEVEL.curiosity,
            direction: null,
        });
        expect(result.current.get('safety')).toEqual({
            level: DRIVE_BASELINE_LEVEL.safety,
            direction: null,
        });
    });

    it('newer_crossing_overrides_older — same drive overwritten', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'ananke.drive_crossed',
                ALPHA,
                {
                    did: ALPHA,
                    tick: 100,
                    drive: 'curiosity',
                    level: 'med',
                    direction: 'rising',
                },
                1,
            ),
            makeEntry(
                'ananke.drive_crossed',
                ALPHA,
                {
                    did: ALPHA,
                    tick: 500,
                    drive: 'curiosity',
                    level: 'high',
                    direction: 'rising',
                },
                2,
            ),
        ]);
        const { result } = renderHook(() => useAnankeLevels(ALPHA));
        expect(result.current.get('curiosity')).toEqual({
            level: 'high',
            direction: 'rising',
        });
    });

    it('ignores_entries_for_other_dids', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'ananke.drive_crossed',
                BETA,
                {
                    did: BETA,
                    tick: 100,
                    drive: 'hunger',
                    level: 'high',
                    direction: 'rising',
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useAnankeLevels(ALPHA));
        // ALPHA view — BETA's crossing must not bleed in.
        expect(result.current.get('hunger')).toEqual({
            level: DRIVE_BASELINE_LEVEL.hunger,
            direction: null,
        });
    });

    it('ignores_non_ananke_entry_types', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'telos.refined',
                ALPHA,
                { some: 'payload' },
                1,
            ),
            makeEntry(
                'nous.spawned',
                ALPHA,
                { drive: 'hunger', level: 'high' },
                2,
            ),
        ]);
        const { result } = renderHook(() => useAnankeLevels(ALPHA));
        // All drives still at baseline — foreign event types contain drive
        // names in their payload but the hook filters by eventType first.
        for (const drive of DRIVE_ORDER) {
            expect(result.current.get(drive)!.level).toBe(
                DRIVE_BASELINE_LEVEL[drive],
            );
            expect(result.current.get(drive)!.direction).toBeNull();
        }
    });

    it('falling direction glyph is preserved through hook', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'ananke.drive_crossed',
                ALPHA,
                {
                    did: ALPHA,
                    tick: 800,
                    drive: 'safety',
                    level: 'med',
                    direction: 'falling',
                },
                3,
            ),
        ]);
        const { result } = renderHook(() => useAnankeLevels(ALPHA));
        expect(result.current.get('safety')).toEqual({
            level: 'med',
            direction: 'falling',
        });
    });

    it('null did returns map even when firehose has entries', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'ananke.drive_crossed',
                ALPHA,
                {
                    did: ALPHA,
                    tick: 100,
                    drive: 'hunger',
                    level: 'high',
                    direction: 'rising',
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useAnankeLevels(null));
        // null DID → pure baselines, no entries applied.
        for (const drive of DRIVE_ORDER) {
            expect(result.current.get(drive)!.level).toBe(
                DRIVE_BASELINE_LEVEL[drive],
            );
            expect(result.current.get(drive)!.direction).toBeNull();
        }
    });
});
