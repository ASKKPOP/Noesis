/**
 * buildExportTarball — REPLAY-01 deterministic tarball producer.
 *
 * Constructs a raw (uncompressed) tar archive whose SHA-256 hash is
 * byte-identical across machines and invocations, given the same inputs.
 *
 * Determinism disciplines (see 13-RESEARCH.md §Pattern 7, §Pitfall 3):
 *   1. Sorted entry order: paths sorted via localeCompare before packing.
 *   2. Fixed mtime: new Date(0) — the Unix epoch, NOT the wall clock (T-10-08).
 *   3. Fixed mode: 0o644 for all files.
 *   4. Fixed uid/gid: 0/0 stripped via `portable: true`.
 *   5. Canonical JSON: canonicalStringify for all embedded JSON files.
 *   6. LF line endings: '\n' separator in slice.jsonl.
 *   7. No PAX headers: `noPax: true`.
 *   8. Raw tar: no gzip — minimises format variables.
 *
 * Two-pass self-referencing build:
 *   Pass 1: build with tarball_hash='' → compute sha256(bytes1).
 *   Pass 2: build with tarball_hash=sha256(bytes1) → compute sha256(bytes2).
 *   sha256(bytes2) is the final answer. The manifest INSIDE the tarball
 *   contains its own outer hash — the self-referencing invariant.
 *
 * NOTE: This file must NEVER import Date.now(), Math.random(), or any
 * wall-clock source. Verified by the Phase 13 wall-clock grep gate.
 *
 * See: REPLAY-01, T-10-08, 13-RESEARCH.md §Pattern 7, 13-VALIDATION.md.
 */

import { createHash } from 'node:crypto';
import { Pack as TarPack } from 'tar';
import { Header as TarHeader } from 'tar';
import { ReadEntry as TarReadEntry } from 'tar';
import { canonicalStringify } from './canonical-json.js';
import type { ExportManifest } from './manifest.js';
import type { AuditEntry } from '../audit/types.js';
import type { ReplayState } from '../replay/state-builder.js';

export interface ExportTarballInputs {
    readonly chainSlice: ReadonlyArray<AuditEntry>;
    readonly startSnapshot: ReplayState;
    readonly endSnapshot: ReplayState;
    readonly manifest: ExportManifest;   // tarball_hash should be '' on input; patched internally
}

export interface ExportTarballOutput {
    readonly bytes: Buffer;
    readonly hash: string;   // HEX64_RE
}

const EPOCH = new Date(0);  // fixed mtime: Unix epoch (T-10-08)
const FILE_MODE = 0o644;

/**
 * Build a single deterministic tar buffer from a set of in-memory file specs.
 * Entries are sorted by path (localeCompare) before packing.
 */
async function packFiles(files: Array<{ path: string; content: Buffer }>): Promise<Buffer> {
    // Sort entries by path for deterministic ordering.
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

    return new Promise<Buffer>((resolve, reject) => {
        const pack = new TarPack({
            portable: true,   // strips uid/gid/uname/gname/ctime/atime
            noPax: true,      // no PAX extended headers
            mtime: EPOCH,     // fixed mtime for all entries
        });

        const chunks: Buffer[] = [];
        pack.on('data', (chunk: Buffer) => chunks.push(chunk));
        pack.on('end', () => resolve(Buffer.concat(chunks)));
        pack.on('error', reject);

        for (const file of sorted) {
            const header = new TarHeader({
                path: file.path,
                size: file.content.length,
                mode: FILE_MODE,
                mtime: EPOCH,
                type: 'File',
                uid: 0,
                gid: 0,
                uname: '',
                gname: '',
            });

            const entry = new TarReadEntry(header);
            pack.add(entry);
            entry.end(file.content);
        }

        pack.end();
    });
}

/**
 * Build a deterministic export tarball (REPLAY-01).
 *
 * Returns `{bytes, hash}` where:
 *   - `bytes` is the raw tar buffer.
 *   - `hash` is the sha256 hex of `bytes`.
 *   - The manifest embedded inside the tarball has its own `tarball_hash`
 *     field set to `hash` (the self-referencing invariant).
 *
 * T-10-08: wall-clock is never read inside this function.
 */
export async function buildExportTarball(input: ExportTarballInputs): Promise<ExportTarballOutput> {
    // Sort chain slice: tick ascending, then id ascending within tick.
    const sortedEntries = [...input.chainSlice].sort(
        (a, b) => (a.id ?? 0) - (b.id ?? 0)
    );

    // Build JSONL: one canonical-JSON line per entry, LF-separated, no trailing newline.
    const jsonl = sortedEntries.map((e) => canonicalStringify(e)).join('\n');

    // Build snapshot JSON files.
    const snapshotStartJson = canonicalStringify(input.startSnapshot);
    const snapshotEndJson = canonicalStringify(input.endSnapshot);

    // ---- PASS 1: build with tarball_hash = '' ----
    const manifest1 = { ...input.manifest, tarball_hash: '' };
    const manifestJson1 = canonicalStringify(manifest1);

    const files1 = [
        { path: 'manifest.json', content: Buffer.from(manifestJson1, 'utf8') },
        { path: 'slice.jsonl', content: Buffer.from(jsonl, 'utf8') },
        { path: 'snapshot.end.json', content: Buffer.from(snapshotEndJson, 'utf8') },
        { path: 'snapshot.start.json', content: Buffer.from(snapshotStartJson, 'utf8') },
    ];
    const bytes1 = await packFiles(files1);
    const hash1 = createHash('sha256').update(bytes1).digest('hex');

    // ---- PASS 2: build with tarball_hash = hash from pass 1 ----
    const manifest2 = { ...input.manifest, tarball_hash: hash1 };
    const manifestJson2 = canonicalStringify(manifest2);

    const files2 = [
        { path: 'manifest.json', content: Buffer.from(manifestJson2, 'utf8') },
        { path: 'slice.jsonl', content: Buffer.from(jsonl, 'utf8') },
        { path: 'snapshot.end.json', content: Buffer.from(snapshotEndJson, 'utf8') },
        { path: 'snapshot.start.json', content: Buffer.from(snapshotStartJson, 'utf8') },
    ];
    const bytes2 = await packFiles(files2);
    const hash2 = createHash('sha256').update(bytes2).digest('hex');

    return { bytes: bytes2, hash: hash2 };
}
