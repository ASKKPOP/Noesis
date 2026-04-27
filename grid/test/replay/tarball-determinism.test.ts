/**
 * RED tests for buildExportTarball (REPLAY-01 — deterministic tarball).
 *
 * These tests encode the acceptance criteria for Wave 2 (Plan 13-03).
 * They MUST fail until grid/src/replay/tarball.ts is created.
 *
 * REPLAY-01: The tarball must be bit-deterministic — same inputs always
 * produce the same SHA-256 hash, regardless of machine, time, or run order.
 * Disciplines (Pattern 7 from 13-RESEARCH.md):
 *   1. Sorted entry order
 *   2. Fixed mtime (new Date(0))
 *   3. Fixed mode (0o644)
 *   4. Fixed uid/gid (0/0 via portable: true)
 *   5. Canonical JSON (sorted keys)
 *   6. LF line endings
 *   7. No PAX headers (noPax: true)
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
// RED until Wave 2 (Plan 13-03) creates grid/src/replay/tarball.ts
import { buildExportTarball } from '../../src/replay/tarball.js';
import type { AuditEntry } from '../../src/audit/types.js';

const GENESIS = '0'.repeat(64);

/** Fixture entries — 5 entries with known deterministic values. */
function makeFixtureEntries(): AuditEntry[] {
    const h = (n: number) => n.toString(16).padStart(64, '0');
    return [
        {
            id: 1,
            eventType: 'grid.started',
            actorDid: 'system',
            payload: { gridName: 'test-grid' },
            prevHash: GENESIS,
            eventHash: h(1),
            createdAt: 1714435200000,
        },
        {
            id: 2,
            eventType: 'nous.spawned',
            actorDid: 'did:noesis:sophia',
            payload: { did: 'did:noesis:sophia', name: 'sophia', region: 'agora' },
            prevHash: h(1),
            eventHash: h(2),
            createdAt: 1714435201000,
        },
        {
            id: 3,
            eventType: 'nous.spoke',
            actorDid: 'did:noesis:sophia',
            payload: { body: 'hello world', channel: 'agora' },
            prevHash: h(2),
            eventHash: h(3),
            createdAt: 1714435202000,
        },
        {
            id: 4,
            eventType: 'tick',
            actorDid: 'system',
            payload: { tick: 1 },
            prevHash: h(3),
            eventHash: h(4),
            createdAt: 1714435203000,
        },
        {
            id: 5,
            eventType: 'grid.stopped',
            actorDid: 'system',
            payload: { gridName: 'test-grid', finalTick: 1 },
            prevHash: h(4),
            eventHash: h(5),
            createdAt: 1714435204000,
        },
    ];
}

function sha256(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
}

describe('buildExportTarball', () => {
    it('produces identical SHA-256 across 3 builds with same input', async () => {
        const entries = makeFixtureEntries();
        const opts = {
            entries,
            startTick: 0,
            endTick: 5,
            gridName: 'test-grid',
        };

        const buf1 = await buildExportTarball(opts);
        const buf2 = await buildExportTarball(opts);
        const buf3 = await buildExportTarball(opts);

        const hash1 = sha256(buf1);
        const hash2 = sha256(buf2);
        const hash3 = sha256(buf3);

        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);

        // Sanity: output is non-empty
        expect(buf1.length).toBeGreaterThan(0);
    });
    // RED until Wave 2 (Plan 13-03) creates grid/src/replay/tarball.ts

    it('manifest contains chain-tail hash matching last entry eventHash', async () => {
        const entries = makeFixtureEntries();
        const buf = await buildExportTarball({
            entries,
            startTick: 0,
            endTick: 5,
            gridName: 'test-grid',
        });

        // Extract manifest from tarball — the manifest file is named 'manifest.json'
        // Wave 2 will define the exact structure, but the chain_tail_hash MUST equal
        // the last entry's eventHash.
        const tar = await import('tar');
        const manifests: string[] = [];
        await new Promise<void>((resolve, reject) => {
            const extract = tar.t({
                onentry: (entry: { path: string; on: Function; resume: Function }) => {
                    if (entry.path.endsWith('manifest.json')) {
                        const chunks: Buffer[] = [];
                        entry.on('data', (chunk: Buffer) => chunks.push(chunk));
                        entry.on('end', () => {
                            manifests.push(Buffer.concat(chunks).toString('utf8'));
                        });
                    } else {
                        entry.resume();
                    }
                },
            });
            extract.on('finish', () => resolve());
            extract.on('error', reject);
            const { Readable } = require('node:stream');
            Readable.from(buf).pipe(extract);
        });

        expect(manifests.length).toBe(1);
        const manifest = JSON.parse(manifests[0]);
        const lastEntry = entries[entries.length - 1];
        expect(manifest.chain_tail_hash).toBe(lastEntry.eventHash);
    });
    // RED until Wave 2 (Plan 13-03) creates grid/src/replay/tarball.ts
});
