#!/usr/bin/env node
/**
 * scripts/replay-verify.mjs
 *
 * REPLAY-01 verification CLI.
 *
 * Given a tarball produced by `grid/src/export/tarball-builder.ts`, this
 * tool reads the file, extracts its embedded `manifest.json`, rebuilds the
 * canonical pass-1 tarball (identical to what the producer hashed during its
 * first pass), recomputes the SHA-256, and compares it to `manifest.tarball_hash`.
 *
 * Verification protocol (mirrors the two-pass producer scheme):
 *   - Producer pass 1: build tarball with tarball_hash='', compute sha256 → h1
 *   - Producer pass 2: build tarball with tarball_hash=h1 → this is the exported file
 *   - Verifier: extract entries → rebuild pass-1 tarball (tarball_hash='')
 *               → sha256 of rebuilt bytes == manifest.tarball_hash ✓
 *
 * This protocol is stronger than raw-byte hashing because:
 *   (a) It confirms the tarball was produced by the canonical pipeline (same options).
 *   (b) Any mutation of the actual content (slice.jsonl, snapshots) will change the
 *       rebuilt pass-1 hash and cause a mismatch.
 *   (c) Platform-specific tar metadata differences are neutralized by rebuilding with
 *       the same deterministic options.
 *
 * Exit codes:
 *   0  — verified; rebuild hash matches manifest.tarball_hash.
 *   1  — verification failed; hashes differ (tampering or non-canonical producer).
 *   2  — tarball is missing one of the four expected entries.
 *   3  — manifest.json could not be parsed as JSON.
 *   4  — manifest.tarball_hash does not match HEX64_RE.
 *   64 — usage error (no path provided or file not found).
 *
 * Expected tarball entries (sorted canonical order):
 *   manifest.json
 *   slice.jsonl
 *   snapshot.end.json
 *   snapshot.start.json
 *
 * See: REPLAY-01, 13-RESEARCH.md §Pattern 7, 13-VALIDATION.md (manual
 *      verification entry), grid/src/export/tarball-builder.ts (producer).
 */

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { Parser as TarParser, Pack as TarPack, Header as TarHeader, ReadEntry as TarReadEntry } from 'tar';

const HEX64_RE = /^[0-9a-f]{64}$/;
const REQUIRED_ENTRIES = new Set([
    'manifest.json',
    'slice.jsonl',
    'snapshot.end.json',
    'snapshot.start.json',
]);
const EPOCH = new Date(0);
const FILE_MODE = 0o644;

// ── Inline canonical JSON serializer (mirrors grid/src/export/canonical-json.ts) ──
// Must stay byte-for-byte identical to the TypeScript implementation.
function csWalk(value, seen) {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return JSON.stringify(value);
    if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') {
        throw new TypeError(`canonicalStringify: unsupported type ${t}`);
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new TypeError('canonicalStringify: cycle detected (array)');
        seen.add(value);
        const parts = value.map(v => csWalk(v, seen));
        seen.delete(value);
        return `[${parts.join(',')}]`;
    }
    if (seen.has(value)) throw new TypeError('canonicalStringify: cycle detected (object)');
    seen.add(value);
    const keys = Object.keys(value).sort();
    const parts = keys.map(k => `${JSON.stringify(k)}:${csWalk(value[k], seen)}`);
    seen.delete(value);
    return `{${parts.join(',')}}`;
}
function canonicalStringify(value) {
    return csWalk(value, new WeakSet());
}

// ── Pack files into a deterministic in-memory tarball ──────────────────────────
function packFiles(files) {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    return new Promise((resolve, reject) => {
        const pack = new TarPack({ portable: true, noPax: true, mtime: EPOCH });
        const chunks = [];
        pack.on('data', c => chunks.push(c));
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

async function main() {
    const args = process.argv.slice(2);

    if (args.length !== 1) {
        console.error('Usage: node scripts/replay-verify.mjs <path-to-tarball>');
        process.exit(64);
    }

    const tarPath = resolve(args[0]);

    // Verify the file exists and is a regular file.
    let stat;
    try {
        stat = statSync(tarPath);
    } catch (err) {
        console.error(`replay-verify: cannot stat ${tarPath}: ${err.message}`);
        process.exit(64);
    }
    if (!stat.isFile()) {
        console.error(`replay-verify: not a regular file: ${tarPath}`);
        process.exit(64);
    }

    // Read all bytes into memory.
    const bytes = readFileSync(tarPath);

    // Parse tar entries in-memory using tar.Parser.
    const found = new Map(); // path → Buffer
    await new Promise((resolveP, rejectP) => {
        const parser = new TarParser({
            onReadEntry: (entry) => {
                const entryPath = entry.path;
                if (REQUIRED_ENTRIES.has(entryPath)) {
                    const chunks = [];
                    entry.on('data', chunk => chunks.push(chunk));
                    entry.on('end', () => found.set(entryPath, Buffer.concat(chunks)));
                    entry.on('error', rejectP);
                } else {
                    entry.resume();
                }
            },
        });
        parser.on('finish', resolveP);
        parser.on('error', rejectP);
        Readable.from(bytes).pipe(parser);
    });

    // Verify all required entries are present.
    for (const required of REQUIRED_ENTRIES) {
        if (!found.has(required)) {
            console.error(`replay-verify: tarball missing required entry: ${required}`);
            console.error(`  found entries: ${[...found.keys()].sort().join(', ') || '(none)'}`);
            process.exit(2);
        }
    }

    // Parse manifest.json.
    let manifest;
    try {
        manifest = JSON.parse(found.get('manifest.json').toString('utf8'));
    } catch (err) {
        console.error(`replay-verify: manifest.json parse failed: ${err.message}`);
        process.exit(3);
    }

    // Validate manifest.tarball_hash field.
    if (typeof manifest.tarball_hash !== 'string' || !HEX64_RE.test(manifest.tarball_hash)) {
        console.error(
            `replay-verify: manifest.tarball_hash is not a valid HEX64 string: ${manifest.tarball_hash}`
        );
        process.exit(4);
    }

    // Rebuild pass-1 tarball (manifest with tarball_hash='') and recompute hash.
    // This mirrors the producer's two-pass scheme: the stored tarball_hash is the
    // sha256 of the pass-1 tarball (tarball_hash=''), not of the final exported bytes.
    const manifest0 = { ...manifest, tarball_hash: '' };
    const manifestJson0 = canonicalStringify(manifest0);
    const pass1Bytes = await packFiles([
        { path: 'manifest.json', content: Buffer.from(manifestJson0, 'utf8') },
        { path: 'slice.jsonl', content: found.get('slice.jsonl') },
        { path: 'snapshot.end.json', content: found.get('snapshot.end.json') },
        { path: 'snapshot.start.json', content: found.get('snapshot.start.json') },
    ]);
    const recomputedHash = createHash('sha256').update(pass1Bytes).digest('hex');

    // Compare hashes.
    if (recomputedHash !== manifest.tarball_hash) {
        console.error('replay-verify: HASH MISMATCH — tarball may have been tampered with or corrupted.');
        console.error(`  recomputed: ${recomputedHash}`);
        console.error(`  manifest:   ${manifest.tarball_hash}`);
        console.error(
            '  A difference here indicates either (a) byte-level mutation of an entry since export,\n' +
            '  (b) a re-pack that used non-canonical options, or (c) a version mismatch\n' +
            '  between the producer and this verifier (check canonical_json_version and tar_format_version).'
        );
        process.exit(1);
    }

    // All checks passed.
    console.log(`replay-verify: ${tarPath}`);
    console.log(`  status:      VERIFIED`);
    console.log(`  hash:        ${manifest.tarball_hash}`);
    console.log(`  ticks:       ${manifest.start_tick}–${manifest.end_tick}`);
    console.log(`  entries:     ${manifest.entry_count}`);
    console.log(`  chain_tail:  ${manifest.chain_tail_hash}`);
    console.log(`  json_ver:    ${manifest.canonical_json_version}`);
    console.log(`  tar_ver:     ${manifest.tar_format_version}`);
    process.exit(0);
}

main().catch((err) => {
    console.error(
        `replay-verify: unexpected failure: ${err && err.stack ? err.stack : String(err)}`
    );
    process.exit(1);
});
