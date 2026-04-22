---
phase: 09-relationship-graph-derived-view
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - grid/src/relationships/types.ts
  - grid/src/relationships/config.ts
  - grid/src/relationships/canonical.ts
  - grid/src/relationships/index.ts
  - grid/src/relationships/listener.ts
  - grid/src/relationships/storage.ts
  - grid/src/api/operator/relationships.ts
  - grid/src/api/operator/index.ts
  - grid/src/api/server.ts
  - grid/src/genesis/launcher.ts
  - grid/src/genesis/types.ts
  - grid/test/api/relationships-privacy.test.ts
  - grid/test/relationships/allowlist-frozen.test.ts
  - grid/test/relationships/canonical.test.ts
  - grid/test/relationships/determinism-source.test.ts
  - grid/test/relationships/idempotent-rebuild.test.ts
  - grid/test/relationships/listener-launcher-order.test.ts
  - grid/test/relationships/listener.test.ts
  - grid/test/relationships/no-audit-emit.test.ts
  - grid/test/relationships/perf-10k.test.ts
  - grid/test/relationships/producer-boundary.test.ts
  - grid/test/relationships/self-edge-rejection.test.ts
  - grid/test/relationships/storage.test.ts
  - grid/test/relationships/zero-diff.test.ts
  - scripts/check-relationship-graph-deps.mjs
  - sql/009_relationships.sql
  - dashboard/package.json
findings:
  critical: 0
  high: 1
  medium: 3
  low: 4
  info: 2
  total: 10
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-04-21
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 09 (relationship-graph-derived-view) is a well-structured, heavily-gated implementation of a pure-observer derived view. The core invariants — pure observation, zero-diff audit chain, sole-producer boundaries (D-9-05), self-loop silent-reject (D-9-11), wall-clock ban (D-9-12), canonical serialization (D-9-10) — are all enforced by both code structure AND regression tests. The broadcast allowlist remains frozen (18 events, no `relationship.*`). Privacy tiering (H1/H2/H5) correctly gates numeric valence/weight behind operator authentication and emits `operator.inspected` where required.

However, one significant wiring gap exists: the MySQL snapshot path (D-9-03) is wired in source but never activated in production because `relationshipStorage` is hardcoded to `null` in `GenesisLauncher`. The tick-driven `scheduleSnapshot` branch is dead code as currently wired. Additionally, `scheduleSnapshot` has a subtle iterator-consistency hazard, and a few defensive-coding gaps in the H5 endpoint and storage column widths warrant attention.

No Critical findings. One High, three Medium, four Low, two Info.

## High Issues

### HI-01: Relationship storage snapshot path is unreachable in production launcher

**File:** `grid/src/genesis/launcher.ts:85` (declaration); `grid/src/genesis/launcher.ts:182-188` (dead guard)
**Issue:** `GenesisLauncher` declares `private readonly relationshipStorage: RelationshipStorage | null` and unconditionally assigns `null` in the constructor (line 85). The tick listener guards on `if (this.relationshipStorage && ...)` so the D-9-03 snapshot cadence path never fires in practice. The inline comment claims "production wiring via GridStore injects storage after construction if needed," but because the field is `private readonly`, no post-construction assignment is possible without reflection. Result: REL-03 (periodic MySQL snapshot) is implemented but dormant — the audit chain remains truth, but the fast-boot / rebuild-verification path has no actual snapshot to load.

This may be intentional for Wave-complete state (pool lives in `GridStore`), but as written there is no code path connecting the pool to the launcher's storage field. Tests that exercise `RelationshipStorage` (storage.test.ts) pass a mock pool directly and never go through the launcher, so the wiring gap is invisible to the existing suite.

**Fix:** Either:
1. Drop the `readonly` modifier and expose a `setRelationshipStorage(pool: Pool): void` method that `GridStore` calls during production wiring, and add a launcher-level test that exercises the tick-snapshot branch end-to-end; OR
2. Accept the optional pool via `GenesisConfig`/constructor arg, construct `RelationshipStorage` conditionally, and document that tests opt in by passing a pool; OR
3. If snapshots are deferred to a later phase, remove the dead tick branch and the `relationshipStorage` field so the code does not advertise a feature that isn't live.

```typescript
// Option 1 (minimal change):
private relationshipStorage: RelationshipStorage | null = null;

public attachRelationshipStorage(pool: Pool): void {
    this.relationshipStorage = new RelationshipStorage(pool);
}
```

## Medium Issues

### ME-01: `RelationshipStorage.scheduleSnapshot` consumes iterator after deferral — risk of inconsistent snapshot

**File:** `grid/src/relationships/storage.ts:116-123`
**Issue:** `scheduleSnapshot(edges: IterableIterator<Edge>, snapshotTick)` captures the live `Map.values()` iterator and defers consumption via `setImmediate`. Between the call site (synchronous on tick fire) and the deferred iteration, the `RelationshipListener.applyBump()` may mutate `this.edges` via `.set()`. JavaScript `Map` iterators observe mutations made during iteration: newly-added keys become visible, and the iterator is single-pass. The snapshot may therefore capture a mix of pre- and post-mutation edge state (or skip an edge that was updated in-place, since `.set()` on an existing key updates the value but does not re-position the key — actually safe for in-place value updates, but risky for any future refactor that re-keys edges).

More concretely, the combined risk: if the snapshot iteration blocks briefly (GC, microtask pressure) and the event loop processes a new audit entry in between, that new entry's `applyBump` mutates the same Map the iterator is traversing, and the snapshot row for that edge will reflect the post-mutation state — not the state at `snapshotTick`. The `snapshot_tick` column would then mis-describe the `recency_tick` / `valence` / `weight` values written.

**Fix:** Materialize the iterator into a snapshot array synchronously at the call site (before `setImmediate`), and pass the array to the async path:

```typescript
scheduleSnapshot(edges: IterableIterator<Edge>, snapshotTick: number): void {
    // Materialize synchronously so later Map mutations do not leak into this snapshot.
    const frozen: Edge[] = Array.from(edges).map(e => ({ ...e }));  // shallow clone per edge
    setImmediate(() => {
        this.snapshot(frozen[Symbol.iterator](), snapshotTick).catch(() => {
            // defense-in-depth
        });
    });
}
```

(The snapshot() signature already accepts an IterableIterator, so wrapping the array preserves the API.)

### ME-02: H5 edge_key prefix matching can resolve to wrong edge on collision

**File:** `grid/src/api/operator/relationships.ts:342` (regex), `grid/src/api/operator/relationships.ts:366-368` (resolution)
**Issue:** The H5 route accepts `edge_key` of 16–64 hex chars and resolves it via `Array.from(...).find(e => edgeHash(e).startsWith(edgeKey) || edgeHash(e) === edgeKey)`. With the minimum 16-char prefix (2^64 space), collision is astronomically unlikely, but:
1. The `|| edgeHash(e) === edgeKey` clause is dead: `startsWith` returns true whenever equal, so this is pure redundancy.
2. On any truncation below 64 chars, `find()` returns the first match in Map iteration order — nondeterministic across runs (though deterministic within a run because Map iteration is insertion-order). There is no check that the prefix is unambiguous across the current edge set.
3. More importantly, no test exercises a shortened edge_key — the privacy-matrix test (`relationships-privacy.test.ts:106`) always passes the full 64-char hash. The prefix-matching code is untested.

The H5 endpoint emits `operator.inspected` with `target_did` set to whichever edge matched first, potentially linking the wrong DIDs in the audit chain if a collision occurs.

**Fix:**
1. Remove the dead `|| edgeHash(e) === edgeKey` clause.
2. Either require a full 64-char hash (match `^[a-f0-9]{64}$`) and drop prefix matching — or, if prefix matching is required by UX, reject ambiguous prefixes with 409 conflict:

```typescript
const matches = Array.from(relationships.allEdges()).filter(
    e => edgeHash(e).startsWith(edgeKey),
);
if (matches.length === 0) {
    reply.code(404);
    return { error: 'edge_not_found' } satisfies ApiError;
}
if (matches.length > 1) {
    reply.code(409);
    return { error: 'ambiguous_edge_key' } satisfies ApiError;
}
const edge = matches[0];
```

Also add a test case for shortened edge_keys with multiple candidate matches.

### ME-03: `sql/009_relationships.sql` DID column width assumes bounded DID length not enforced by validator

**File:** `sql/009_relationships.sql:9-13`, cross-ref `grid/src/api/server.ts:115` (DID_REGEX)
**Issue:** The migration reserves `VARCHAR(80)` for `did_a` / `did_b` with the comment "Max DID length = 76 chars per DID_REGEX (did:noesis: + 64 alphanum). 80 is safe." However, `DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i` has no upper bound on the slug portion. A DID with a 200-character slug would pass the validator but fail to insert into VARCHAR(80), causing a MySQL "Data too long for column" error (or silent truncation depending on `sql_mode`). Since the listener is downstream of the registry, which accepts arbitrary-slug DIDs, this is a production-time data-integrity risk: a Nous spawned with a long DID can create edges that fail to snapshot (fire-and-forget swallows the error per HI-01's dormant path, but if HI-01 is fixed, silent snapshot failures follow).

Similarly, `edge_key VARCHAR(160)` assumes `DID_A|DID_B` fits in 160 chars, which depends on the same unverified DID length cap.

**Fix:** Either
1. Enforce a DID-length cap at the registry/validator boundary (e.g., `DID_REGEX = /^did:noesis:[a-z0-9_\-]{1,64}$/i`) and document the 76-char upper bound as an invariant; OR
2. Expand column widths to accommodate realistic worst cases (`VARCHAR(256)` for DIDs, `VARCHAR(520)` for edge_key), accepting larger indexes.

Option 1 is preferred — tighter DID spec is a Phase-level invariant worth documenting in PHILOSOPHY.md.

## Low Issues

### LO-01: `Number(row['recency_tick'])` coercion loses precision on BIGINT > 2^53

**File:** `grid/src/relationships/storage.ts:100`
**Issue:** `recency_tick` is `BIGINT UNSIGNED` in SQL. Depending on the mysql2 pool configuration (`supportBigNumbers`, `bigNumberStrings`), it may return as `number`, `string`, or `BigInt`. The current code does `Number(row['recency_tick'])`, which loses precision for ticks > 2^53 (≈ 9 × 10^15). At 30-second tick cadence, 2^53 ticks is ~8.6 billion years, so this is not a practical concern today — but the comment "safe up to 2^53" acknowledges the ceiling without documenting the failure mode if mysql2 returns a BigInt string like "90071992547409930".

**Fix:** Add a BigInt-safe guard with a runtime assertion:

```typescript
const raw = row['recency_tick'];
const tick = typeof raw === 'bigint' ? Number(raw) : Number(raw);
if (tick > Number.MAX_SAFE_INTEGER) {
    console.warn('relationships_tick_precision_loss', { raw });
}
```

Or, document the bound explicitly in the file header so future refactors preserve the invariant.

### LO-02: `relationships.ts` route 3 dead `|| edgeHash(e) === edgeKey` clause

**File:** `grid/src/api/operator/relationships.ts:367`
**Issue:** `find(e => edgeHash(e).startsWith(edgeKey) || edgeHash(e) === edgeKey)` — the `||` branch is unreachable: `startsWith` returns true whenever the strings are equal. Confirms redundant logic (see ME-02). Also, `edgeHash(e)` is computed up to twice per edge in the short-circuit evaluation, and again on a separate line for the matched edge.

**Fix:** `find(e => edgeHash(e).startsWith(edgeKey))`. Cache the computed hash:

```typescript
const allEdges = Array.from(relationships.allEdges());
const withHash = allEdges.map(e => ({ e, h: edgeHash(e) }));
const hit = withHash.find(({ h }) => h.startsWith(edgeKey));
if (!hit) { reply.code(404); return { error: 'edge_not_found' } satisfies ApiError; }
const edge = hit.e;
```

### LO-03: `GET /api/v1/grid/relationships/graph` has no response-size cap

**File:** `grid/src/api/operator/relationships.ts:429-480`
**Issue:** The graph endpoint returns every node and every edge whose warmth bucket meets the minimum threshold. At 10k edges (the perf-10k.test.ts fixture), that is a response payload with ~10k edge objects plus ~200 node objects — on the order of hundreds of KB uncompressed. No `limit`, `offset`, or server-side top-K parameter exists. While this is H1 public data (no privacy concern), a denial-of-service shaped by a curious client hitting the endpoint in a loop at high QPS could push the API server to CPU saturation on the `edgeHash` calls.

**Fix:** Add a `limit` query param (default e.g. 500, cap e.g. 2000) and return a `total` count alongside `edges` so the dashboard can paginate:

```typescript
const limitRaw = Number(req.query.limit ?? 500);
const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 2000 ? limitRaw : 500;
// ... apply after filtering
const cappedEdges = filteredEdges.slice(0, limit);
```

This is out of v1 correctness scope but worth capturing for the dashboard N+1 mitigation work.

### LO-04: `listener.ts` implicit dependence on Map iteration order for deterministic snapshots

**File:** `grid/src/relationships/listener.ts:89-113` (getTopNFor), `grid/src/relationships/listener.ts:121-123` (allEdges)
**Issue:** The file header comment (line 13) promises "Deterministic iteration: Array.from(map.keys()).sort() before iterating (Pitfall 2 in RESEARCH.md)." However, neither `getTopNFor` nor `allEdges` actually sorts before iterating. `getTopNFor` sorts by decayed weight at the end, but `allEdges` returns `this.edges.values()` directly — consumers (e.g., `storage.ts` snapshot, `relationships.ts` graph endpoint) receive insertion-order iteration. JavaScript Map iteration IS insertion-order-deterministic within a single process, but across processes / restarts, rebuilds happen in audit-chain order (also deterministic), so in practice the snapshot is reproducible. The pitfall is a latent footgun, not an active bug.

**Fix:** Either honor the comment by sorting in `allEdges` before returning, or update the comment to clarify that consumers must sort downstream if they need cross-process determinism. The `idempotent-rebuild.test.ts` snapshotCanonical helper already sorts — good. For consistency, `storage.ts` snapshot batching should also sort (making REPLACE INTO order deterministic makes binary-identical backups possible):

```typescript
// storage.ts snapshot():
rows.sort((a, b) => sortedPairKey(a.did_a, a.did_b).localeCompare(sortedPairKey(b.did_a, b.did_b)));
```

## Info

### IN-01: Operator-event payload includes `counterparty_did` key not enumerated in Phase 6 operator payload shape

**File:** `grid/src/api/operator/relationships.ts:418`
**Issue:** The H5 route emits `operator.inspected` with payload `{tier, action, operator_id, target_did, counterparty_did}`. The Phase 6 `OperatorEventPayload` interface (`grid/src/audit/operator-events.ts:35-41`) allows `[key: string]: unknown` so this passes TS typing and the payload-privacy check (no banned keys). However, `counterparty_did` is a new payload key not documented in Phase 6's D-11 payload shape schema. This is not an allowlist violation (the allowlist is per-event-type, and `operator.inspected` is already admitted), but if downstream WebSocket firehose consumers or dashboard parsers assume the Phase 6 documented payload shape, the extra key could be unexpectedly ignored or surface as `undefined` in typed consumers.

**Fix:** Either document `counterparty_did` as a new optional key in Phase 6's payload contract (update `06-CONTEXT.md` D-11 per CLAUDE.md doc-sync rule), or rename to `target_counterparty_did` to signal it's contextual metadata. No code change required if documentation is updated.

### IN-02: `storage.ts` snapshot error uses structured JSON in console.warn — inconsistent with other warn sites

**File:** `grid/src/relationships/storage.ts:75`
**Issue:** `console.warn(JSON.stringify({ msg: 'relationships_snapshot_failed', tick: snapshotTick, err: msg }))` uses embedded JSON in a warn message. Other warn sites in the codebase (e.g., `launcher.ts:158` `[genesis] skipping shop for unknown owner`) use plain strings. If a log aggregator parses JSON log lines, this format is an improvement; if it expects text, this will be stringified again. Minor consistency concern — not a bug.

**Fix:** Align with project logging convention. If structured logging is the target, migrate other sites; if plain strings, unwrap:

```typescript
console.warn(`relationships snapshot failed at tick ${snapshotTick}: ${msg}`);
```

---

_Reviewed: 2026-04-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
