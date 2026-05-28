/**
 * ForkManifest — schema + factory for the manifest.json file embedded in
 * every FORK-02 .tar.gz archive package.
 *
 * The manifest anchors the logical file content hash (export_hash) and the
 * audit chain tail hash (chain_tail_hash) at export time. It is human-readable
 * and MUST NOT contain any secret substrings (T-43-secrets gate).
 *
 * Privacy invariant: manifest.json must NEVER include env vars or credentials
 * matching /MYSQL_URL|DATABASE_URL|SECRET|KEY|TOKEN|PASSWORD/i.
 *
 * See: FORK-02, D-43-02, T-43-secrets.
 */

/** 64-hex SHA-256 — same pattern as grid/src/audit/append-operator-nous-forked.ts HEX64_RE. */
const HEX64_RE = /^[0-9a-f]{64}$/;

export interface ForkManifest {
    readonly format_version: '1.0';
    readonly exported_at: string;           // ISO timestamp
    readonly exported_at_tick: number;
    readonly nous_civic_did: string;
    readonly nous_existence_did: string;
    readonly grid_id: string;
    readonly export_hash: string;           // HEX64_RE — logical content hash (sorted paths+contents)
    readonly chain_tail_hash: string;       // HEX64_RE — audit chain tail at export time
    readonly memory_files: string[];        // List of .db files included
    readonly note: string;                  // Human-readable extraction instructions
}

export interface CreateForkManifestInput {
    readonly exportedAt: string;
    readonly exportedAtTick: number;
    readonly nousCivicDid: string;
    readonly nousExistenceDid: string;
    readonly gridId: string;
    readonly exportHash: string;
    readonly chainTailHash: string;
    readonly memoryFiles: string[];
}

/**
 * Create a ForkManifest with validated inputs.
 *
 * @throws TypeError if chainTailHash or exportHash do not match HEX64_RE,
 *   or if memoryFiles is not an array of strings.
 */
export function createForkManifest(input: CreateForkManifestInput): ForkManifest {
    if (typeof input.chainTailHash !== 'string' || !HEX64_RE.test(input.chainTailHash)) {
        throw new TypeError('createForkManifest: chainTailHash must match HEX64_RE (64 lowercase hex chars)');
    }
    if (typeof input.exportHash !== 'string' || !HEX64_RE.test(input.exportHash)) {
        throw new TypeError('createForkManifest: exportHash must match HEX64_RE (64 lowercase hex chars)');
    }
    if (!Array.isArray(input.memoryFiles) || !input.memoryFiles.every(f => typeof f === 'string')) {
        throw new TypeError('createForkManifest: memoryFiles must be an array of strings');
    }
    return {
        format_version: '1.0',
        exported_at: input.exportedAt,
        exported_at_tick: input.exportedAtTick,
        nous_civic_did: input.nousCivicDid,
        nous_existence_did: input.nousExistenceDid,
        grid_id: input.gridId,
        export_hash: input.exportHash,
        chain_tail_hash: input.chainTailHash,
        memory_files: [...input.memoryFiles],
        note: 'FORK-02: This archive is human-readable. Extract with `tar -xzf <file.tar.gz>` and read manifest.json. Memory files are SQLite databases — open with `sqlite3 <file.db>`. Civic credentials are W3C VCs — JWS-signed JSON. The archive contains the complete Nous state at export time.',
    };
}
