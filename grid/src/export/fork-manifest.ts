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
import { HEX64_RE } from '../util/id-patterns.js';

export interface ForkManifest {
    readonly format_version: '2.0';
    readonly exported_at: string;           // ISO timestamp
    readonly exported_at_tick: number;
    readonly nous_civic_did: string;
    readonly nous_existence_did: string;
    readonly grid_id: string;
    readonly export_hash: string;           // HEX64_RE — logical content hash (sorted paths+contents)
    readonly chain_tail_hash: string;       // HEX64_RE — audit chain tail at export time
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
}

/**
 * Create a ForkManifest with validated inputs.
 *
 * @throws TypeError if chainTailHash or exportHash do not match HEX64_RE.
 */
export function createForkManifest(input: CreateForkManifestInput): ForkManifest {
    if (typeof input.chainTailHash !== 'string' || !HEX64_RE.test(input.chainTailHash)) {
        throw new TypeError('createForkManifest: chainTailHash must match HEX64_RE (64 lowercase hex chars)');
    }
    if (typeof input.exportHash !== 'string' || !HEX64_RE.test(input.exportHash)) {
        throw new TypeError('createForkManifest: exportHash must match HEX64_RE (64 lowercase hex chars)');
    }
    return {
        format_version: '2.0',
        exported_at: input.exportedAt,
        exported_at_tick: input.exportedAtTick,
        nous_civic_did: input.nousCivicDid,
        nous_existence_did: input.nousExistenceDid,
        grid_id: input.gridId,
        export_hash: input.exportHash,
        chain_tail_hash: input.chainTailHash,
        note: 'FORK-02: The Grid half of this Nous. Extract with `tar -xzf <file.tar.gz>` and read manifest.json. It holds the civic credential (a W3C VC) and every audit entry that names this Nous. The Brain\'s memory lives on the owner\'s machine and is added there, not by the Grid.',
    };
}
