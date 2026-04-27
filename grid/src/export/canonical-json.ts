/**
 * canonicalStringify — deterministic JSON serializer.
 *
 * Sorts object keys recursively at every nesting depth. Arrays preserve
 * their input order (arrays are intrinsically ordered). No whitespace.
 * Throws on undefined, function, symbol, BigInt, or cyclic references.
 *
 * REPLAY-01 byte-determinism: this IS the canonical-JSON contract for
 * tarball-embedded JSON files. Bumping the algorithm requires bumping
 * `ExportManifest.canonical_json_version`.
 *
 * The hand-roll is intentional (see 13-RESEARCH.md §Don't Hand-Roll):
 * no existing npm package satisfies all three constraints simultaneously:
 *   1. Recursive sorted-key serialization at every depth.
 *   2. Cycle detection with a clear error message.
 *   3. Throws on non-portable types (undefined, function, symbol, BigInt).
 *
 * Implementation target: ≤30 lines of executable code (plus header docblock).
 *
 * See: 13-RESEARCH.md §Pattern 7, §Don't Hand-Roll.
 */
export function canonicalStringify(value: unknown): string {
    const seen = new WeakSet<object>();
    return walk(value, seen);
}

function walk(value: unknown, seen: WeakSet<object>): string {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
        // Numbers: rely on JSON.stringify for IEEE-754 canonical formatting.
        // Strings: rely on JSON.stringify for proper escaping.
        return JSON.stringify(value);
    }
    if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') {
        throw new TypeError(`canonicalStringify: unsupported type ${t}`);
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new TypeError('canonicalStringify: cycle detected (array)');
        seen.add(value);
        const parts = (value as unknown[]).map((v) => walk(v, seen));
        seen.delete(value);
        return `[${parts.join(',')}]`;
    }
    // Plain object branch.
    if (t !== 'object') throw new TypeError(`canonicalStringify: unexpected type ${t}`);
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) throw new TypeError('canonicalStringify: cycle detected (object)');
    seen.add(obj);
    const keys = Object.keys(obj).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${walk(obj[k], seen)}`);
    seen.delete(obj);
    return `{${parts.join(',')}}`;
}
