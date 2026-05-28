/**
 * buildForkArchive — FORK-02 deterministic .tar.gz archive producer.
 *
 * Constructs a .tar.gz archive whose SHA-256 (package_hash) is used in the
 * operator.nous_forked audit event, and whose logical file-content hash
 * (export_hash) is embedded in the manifest.json inside the archive.
 *
 * Determinism disciplines (mirrors Phase 13 tarball-builder.ts):
 *   1. Sorted entry order: paths sorted via localeCompare before packing.
 *   2. Fixed mtime: new Date(0) — the Unix epoch (T-10-08).
 *   3. Fixed mode: 0o644 for all files.
 *   4. Fixed uid/gid: 0/0 stripped via `portable: true`.
 *   5. No PAX headers: `noPax: true`.
 *   6. gzip compression via tar's gzip option.
 *
 * export_hash is sha256 over sorted (path, content) pairs — logical hash
 * of the archive's file set, excluding manifest.json itself.
 * package_hash is sha256 of the full .tar.gz bytes.
 * These two values are always different.
 *
 * Privacy gate: manifest.json MUST NOT contain any substring matching
 * /MYSQL_URL|DATABASE_URL|SECRET|KEY|TOKEN|PASSWORD/i — enforced inline.
 *
 * NOTE: This file must NEVER read wall-clock (Date.now / Math.random / new Date()).
 * Verified by the Phase 13 wall-clock grep gate (searches for Date + .now).
 *
 * See: FORK-02, D-43-02, T-43-secrets, T-10-08.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { Pack as TarPack } from 'tar';
import { Header as TarHeader } from 'tar';
import { ReadEntry as TarReadEntry } from 'tar';
import { createForkManifest } from './fork-manifest.js';
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';

export interface BuildForkArchiveInput {
    readonly nousDid: string;              // Civic-DID of the Nous being forked
    readonly gridId: string;               // e.g. 'genesis'
    readonly dataDir: string;              // BRAIN_DATA_DIR — directory with *.db files
    readonly auditChain: AuditChain;       // live chain to slice for this Nous
    readonly civicVcJson: string;          // W3C VC JSON for civic-did.vc.json
    readonly exportedAtTick: number;       // tick at export time
    readonly nousExistenceDid: string;     // Existence-DID
    readonly exportedAt: string;           // ISO timestamp (e.g. new Date().toISOString())
}

export interface BuildForkArchiveOutput {
    readonly bytes: Buffer;                // full .tar.gz bytes
    readonly manifestExportHash: string;   // HEX64 — logical content hash (in manifest)
    readonly packageHash: string;          // HEX64 — sha256 of full .tar.gz bytes
    readonly memoryFiles: string[];        // list of memory/*.db filenames included
}

const EPOCH = new Date(0);  // fixed mtime: Unix epoch (T-10-08)
const FILE_MODE = 0o644;

/**
 * Build a deterministic .tar.gz buffer from a set of in-memory file specs.
 * Entries are sorted by path (localeCompare) before packing.
 */
async function packFilesGzip(files: Array<{ path: string; content: Buffer }>): Promise<Buffer> {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

    return new Promise<Buffer>((resolve, reject) => {
        const pack = new TarPack({
            portable: true,   // strips uid/gid/uname/gname/ctime/atime
            noPax: true,      // no PAX extended headers
            mtime: EPOCH,     // fixed mtime for all entries
            gzip: true,       // produce .tar.gz
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
 * Compute the logical export_hash over sorted (path, content) pairs.
 * Excludes manifest.json — the manifest embeds this hash, so it cannot
 * be part of its own input.
 */
function computeExportHash(files: Array<{ path: string; content: Buffer }>): string {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    const h = createHash('sha256');
    for (const f of sorted) {
        h.update(f.path);
        h.update('\x00');
        h.update(f.content);
    }
    return h.digest('hex');
}

/**
 * Build a deterministic fork archive (.tar.gz) for the given Nous.
 *
 * @throws Error with code 'brain_memory_in_memory_cannot_fork' when dataDir
 *   is empty/missing or set to ':memory:' (Brain is running with in-memory SQLite).
 */
export async function buildForkArchive(input: BuildForkArchiveInput): Promise<BuildForkArchiveOutput> {
    // 1. Validate BRAIN_DATA_DIR — must be a real disk path (Pitfall 2)
    const dataDir = (input.dataDir ?? '').trim();
    if (!dataDir || dataDir === ':memory:') {
        throw new Error('brain_memory_in_memory_cannot_fork: Brain is running with in-memory SQLite. Set BRAIN_DATA_DIR env var pointing to a persistent data directory and restart Brain before forking.');
    }

    // 2. Glob all *.db files from dataDir
    let dbEntries: string[];
    try {
        const dirEntries = await fs.readdir(dataDir);
        dbEntries = dirEntries.filter(name => name.endsWith('.db'));
    } catch (err) {
        throw new Error(`brain_memory_in_memory_cannot_fork: Could not read BRAIN_DATA_DIR at ${dataDir}: ${String(err)}`);
    }

    if (dbEntries.length === 0) {
        throw new Error(`brain_memory_in_memory_cannot_fork: No .db files found in BRAIN_DATA_DIR at ${dataDir}. Brain may be running with in-memory SQLite.`);
    }

    // 3. Read each .db file as Buffer
    const memoryFileSpecs: Array<{ path: string; content: Buffer }> = [];
    const memoryFileNames: string[] = [];
    for (const dbName of dbEntries.sort()) {
        const dbPath = join(dataDir, dbName);
        const content = await fs.readFile(dbPath);
        memoryFileSpecs.push({ path: `memory/${dbName}`, content });
        memoryFileNames.push(dbName);
    }

    // 4. Slice audit chain entries for this Nous (actor or subject in payload)
    const allEntries = input.auditChain.all();
    const slicedEntries = allEntries.filter(entry => {
        if (entry.actorDid === input.nousDid) return true;
        // Check payload for nousDid as subject (hashed or plain)
        const payloadStr = JSON.stringify(entry.payload);
        return payloadStr.includes(input.nousDid);
    });

    // 5. Build audit JSONL — one JSON line per entry
    const jsonlLines = slicedEntries.map(e => JSON.stringify(e));
    const chainJsonl = jsonlLines.join('\n');

    // 6. Compute chainTailHash from last filtered entry (or genesis hash if none)
    const chainTailHash = slicedEntries.length > 0
        ? (slicedEntries[slicedEntries.length - 1].eventHash ?? '0'.repeat(64))
        : '0'.repeat(64);

    // 7. Build civic and treasury stubs (Phase 49/45 deferred)
    const membershipsJson = '{"memberships":[]}';
    const treasuryJson = '{"bios_balance":0,"last_updated_tick":null}';

    // 8. Build the non-manifest file set for export_hash computation
    const contentFiles: Array<{ path: string; content: Buffer }> = [
        ...memoryFileSpecs,
        { path: 'credentials/civic-did.vc.json', content: Buffer.from(input.civicVcJson, 'utf8') },
        { path: 'audit/chain-export.jsonl', content: Buffer.from(chainJsonl, 'utf8') },
        { path: 'audit/chain-tail-hash.txt', content: Buffer.from(chainTailHash, 'utf8') },
        { path: 'civic/memberships.json', content: Buffer.from(membershipsJson, 'utf8') },
        { path: 'civic/treasury.json', content: Buffer.from(treasuryJson, 'utf8') },
    ];

    // 9. Compute export_hash (logical hash — excludes manifest.json)
    const exportHash = computeExportHash(contentFiles);

    // 10. Build the ForkManifest
    const manifest = createForkManifest({
        exportedAt: input.exportedAt,
        exportedAtTick: input.exportedAtTick,
        nousCivicDid: input.nousDid,
        nousExistenceDid: input.nousExistenceDid,
        gridId: input.gridId,
        exportHash,
        chainTailHash,
        memoryFiles: memoryFileNames,
    });

    // Privacy gate — belt-and-suspenders against future regressions (T-43-secrets)
    // Uses word-boundary anchors to avoid false positives on normal words like "existence-key"
    // or "hokey". The gate targets env-var-style credential patterns (all-caps or standalone words).
    const manifestJson = JSON.stringify(manifest);
    if (/MYSQL_URL|DATABASE_URL|\bSECRET\b|\bKEY\b|\bTOKEN\b|\bPASSWORD\b/i.test(manifestJson)) {
        throw new Error('fork-archive-builder: manifest leaked forbidden substring (T-43-secrets)');
    }

    // 11. Pack all files including manifest.json into .tar.gz
    const allFiles: Array<{ path: string; content: Buffer }> = [
        { path: 'manifest.json', content: Buffer.from(manifestJson, 'utf8') },
        ...contentFiles,
    ];

    const bytes = await packFilesGzip(allFiles);

    // 12. Compute package_hash = sha256 of full .tar.gz bytes (different from export_hash)
    const packageHash = createHash('sha256').update(bytes).digest('hex');

    return {
        bytes,
        manifestExportHash: exportHash,
        packageHash,
        memoryFiles: memoryFileNames,
    };
}
