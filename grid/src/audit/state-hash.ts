/**
 * state-hash — canonical composer for the pre_deletion_state_hash field
 * of the operator.nous_deleted audit payload (AGENCY-05).
 *
 * Grid is the SOLE authority on this composition (D-03). The Brain
 * computes the 4 component hashes (psyche, thymos, telos, memory_stream)
 * and returns them over RPC; Grid deterministically combines them here.
 * A compromised Brain cannot forge a consistent deletion record because
 * the combination algorithm lives outside its trust boundary.
 *
 * Canonical key order (D-07, LOCKED):
 *     psyche_hash → thymos_hash → telos_hash → memory_stream_hash
 * This order is "ancient" — psyche (soul) before thymos (spirit) before
 * telos (purpose) before memory_stream (episodic record). Reordering
 * breaks forensic re-derivation from archived Brain hashes.
 *
 * See: 08-CONTEXT D-03, D-05, D-06, D-07.
 */
import { createHash } from 'node:crypto';

/** 64-hex SHA-256 digest — matches grid/src/api/operator/_validation.ts. */
export const HEX64_RE = /^[0-9a-f]{64}$/;

/**
 * The 4 Brain component hashes. Key order in this interface is the
 * canonical order enforced by combineStateHash — do NOT reorder.
 */
export interface StateHashComponents {
    readonly psyche_hash: string;
    readonly thymos_hash: string;
    readonly telos_hash: string;
    readonly memory_stream_hash: string;
}

/** The LOCKED canonical key order (D-07). Used for serialization AND for
 *  the closed-tuple structural check. Changing this array is a breaking
 *  contract change — the pinned-hash test in state-hash.test.ts fails. */
const LOCKED_KEY_ORDER = ['psyche_hash', 'thymos_hash', 'telos_hash', 'memory_stream_hash'] as const;

function canonicalSerialize(components: StateHashComponents): string {
    // Manually build the JSON string in locked key order — DO NOT use
    // JSON.stringify with Object.keys() because insertion order of the
    // caller's literal is not guaranteed across JS engines.
    return '{'
        + `"psyche_hash":${JSON.stringify(components.psyche_hash)},`
        + `"thymos_hash":${JSON.stringify(components.thymos_hash)},`
        + `"telos_hash":${JSON.stringify(components.telos_hash)},`
        + `"memory_stream_hash":${JSON.stringify(components.memory_stream_hash)}`
        + '}';
}

/**
 * Combine 4 Brain component hashes into the canonical
 * pre_deletion_state_hash (64-hex SHA-256).
 *
 * @throws TypeError on malformed input, missing/extra keys, or non-64-hex values.
 */
export function combineStateHash(components: StateHashComponents): string {
    // 1. Type guard — reject non-objects.
    if (components === null || typeof components !== 'object' || Array.isArray(components)) {
        throw new TypeError(`combineStateHash: expected plain object, got ${typeof components}`);
    }

    // 2. Closed-tuple structural check (D-06).
    const actualKeys = Object.keys(components).sort();
    const expectedKeys = [...LOCKED_KEY_ORDER].sort();
    if (actualKeys.length !== expectedKeys.length
        || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new TypeError(
            `combineStateHash: unexpected key set — expected keys ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)} (missing or extra key rejected per D-06 closed-tuple)`,
        );
    }

    // 3. Per-component 64-hex regex guard (D-05).
    for (const key of LOCKED_KEY_ORDER) {
        const v = (components as Record<string, unknown>)[key];
        if (typeof v !== 'string' || !HEX64_RE.test(v)) {
            throw new TypeError(`combineStateHash: ${key} must match HEX64_RE (64 lowercase hex chars), got ${JSON.stringify(v)}`);
        }
    }

    // 4. Canonical serialization (D-07 locked key order).
    const canonical = canonicalSerialize(components);

    // 5. SHA-256 → 64-hex.
    return createHash('sha256').update(canonical).digest('hex');
}
