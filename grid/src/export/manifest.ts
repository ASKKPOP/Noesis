/**
 * ExportManifest — schema + factory for the manifest.json file embedded in
 * every REPLAY-01 export tarball.
 *
 * The manifest is part of the byte-determinism contract. Bumping any field
 * semantics requires bumping `canonical_json_version` or `tar_format_version`
 * so that replay-verify and downstream consumers can detect the change.
 *
 * Forensic provenance fields (T-13-03-04):
 *   - chain_tail_hash: cross-reference to the live audit chain at export time.
 *   - start_tick / end_tick / entry_count: slice provenance.
 *   - tarball_hash: sha256 of the outer tar bytes; populated post-build.
 *
 * See: REPLAY-01, 13-RESEARCH.md §Pattern 7, 13-VALIDATION.md.
 */

export interface ExportManifest {
    readonly canonical_json_version: 1;
    readonly tar_format_version: 1;
    readonly start_tick: number;
    readonly end_tick: number;
    readonly entry_count: number;
    readonly chain_tail_hash: string;   // HEX64_RE — AuditChain.head at end_tick
    readonly tarball_hash: string;      // HEX64_RE — sha256 of the tar bytes; '' before build
}

export interface CreateManifestInput {
    readonly startTick: number;
    readonly endTick: number;
    readonly entryCount: number;
    readonly chainTailHash: string;     // HEX64_RE
}

const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * Create an ExportManifest with tarball_hash placeholder ('').
 *
 * The tarball-builder performs a two-pass build: pass 1 uses tarball_hash=''
 * to compute the outer SHA-256; pass 2 embeds the hash and re-builds.
 *
 * @throws TypeError if any input field is invalid.
 */
export function createManifest(input: CreateManifestInput): ExportManifest {
    if (!Number.isInteger(input.startTick) || input.startTick < 0) {
        throw new TypeError(
            `createManifest: startTick must be a non-negative integer, got ${input.startTick}`
        );
    }
    if (!Number.isInteger(input.endTick) || input.endTick < input.startTick) {
        throw new TypeError(
            `createManifest: endTick must be ≥ startTick, got start=${input.startTick} end=${input.endTick}`
        );
    }
    if (!Number.isInteger(input.entryCount) || input.entryCount < 0) {
        throw new TypeError('createManifest: entryCount must be a non-negative integer');
    }
    if (!HEX64_RE.test(input.chainTailHash)) {
        throw new TypeError(
            `createManifest: chainTailHash must match HEX64_RE, got: ${input.chainTailHash}`
        );
    }
    return {
        canonical_json_version: 1,
        tar_format_version: 1,
        start_tick: input.startTick,
        end_tick: input.endTick,
        entry_count: input.entryCount,
        chain_tail_hash: input.chainTailHash,
        tarball_hash: '',  // placeholder; patched by tarball-builder in pass 2
    };
}
