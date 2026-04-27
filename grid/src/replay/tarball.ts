/**
 * Replay-layer tarball adapter.
 *
 * Bridges the high-level replay API (entries + tick range + gridName) to the
 * export-layer buildExportTarball function (grid/src/export/tarball-builder.ts).
 *
 * REPLAY-01: the resulting Buffer is byte-identical across machines and runs
 * for the same input entries — same SHA-256, always.
 *
 * The manifest embedded inside contains:
 *   - chain_tail_hash: last entry's eventHash (cross-reference to chain head).
 *   - start_tick / end_tick: the tick range provided by the caller.
 *   - entry_count: entries.length.
 *   - canonical_json_version: 1.
 *   - tar_format_version: 1.
 *   - tarball_hash: sha256 of the outer tar bytes (self-referencing).
 *
 * T-10-07: this file never appends to the audit chain.
 * T-10-08: no wall-clock reads — mtime is fixed at the Unix epoch via the
 *          export-layer disciplines.
 *
 * See: REPLAY-01, grid/src/export/tarball-builder.ts, 13-RESEARCH.md §Pattern 7.
 */

import { buildExportTarball as buildExportTarballCore } from '../export/tarball-builder.js';
import { createManifest } from '../export/manifest.js';
import { buildStateAtTick } from './state-builder.js';
import { ReplayGrid } from './replay-grid.js';
import type { AuditEntry } from '../audit/types.js';

const GENESIS = '0'.repeat(64);

export interface ReplayTarballOptions {
    readonly entries: ReadonlyArray<AuditEntry>;
    readonly startTick: number;
    readonly endTick: number;
    readonly gridName: string;
}

/**
 * Build a deterministic export tarball from a replay slice.
 *
 * Returns the raw tar bytes as a Buffer (REPLAY-01).
 * The SHA-256 of the returned buffer is stable across any number of calls
 * with byte-identical inputs.
 *
 * @param opts - Replay tarball options (entries, tick range, gridName).
 * @returns Promise<Buffer> — the raw tar archive bytes.
 */
export async function buildExportTarball(opts: ReplayTarballOptions): Promise<Buffer> {
    const { entries, startTick, endTick, gridName } = opts;

    // Determine chain_tail_hash: last entry's eventHash, or genesis zero if no entries.
    const sortedEntries = [...entries].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    const chainTailHash = sortedEntries.length > 0
        ? (sortedEntries[sortedEntries.length - 1].eventHash ?? GENESIS)
        : GENESIS;

    // Build state snapshots using the replay grid.
    const startReplay = new ReplayGrid(sortedEntries.slice(0, startTick), gridName);
    const startSnapshot = buildStateAtTick(startReplay, startTick);

    const endReplay = new ReplayGrid(sortedEntries, gridName);
    const endSnapshot = buildStateAtTick(endReplay, endTick);

    // Build manifest (tarball_hash populated post-build by the two-pass scheme).
    const manifest = createManifest({
        startTick,
        endTick,
        entryCount: sortedEntries.length,
        chainTailHash,
    });

    // Build and return the tarball bytes.
    const result = await buildExportTarballCore({
        chainSlice: sortedEntries,
        startSnapshot,
        endSnapshot,
        manifest,
    });

    return result.bytes;
}
