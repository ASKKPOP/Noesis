---
phase: 09-relationship-graph-derived-view
verified: 2026-04-22T04:25:05Z
status: gaps_found
score: 3/4 requirements verified (7/9 invariants verified)
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "REL-02 — Relationship edges are stored in a derived MySQL table (REL-02 + SC#1 literal text)"
    status: partial
    reason: "RelationshipStorage class exists and is test-covered, but GenesisLauncher hardcodes `this.relationshipStorage = null` as a `private readonly` field with no setter. No production code path injects a mysql2 pool, so the tick-driven snapshot branch at launcher.ts:182-188 is dead code. In production, the `relationships` MySQL table is never written to — the derived view lives only in the in-memory Map. SC#1 literally requires 'materializes an edge table ... in a derived MySQL table' — this is currently dormant."
    artifacts:
      - path: "grid/src/genesis/launcher.ts"
        issue: "Line 45 declares `private readonly relationshipStorage: RelationshipStorage | null`; line 85 assigns `null`; `readonly` prevents post-construction assignment; no setter exists; no `GenesisConfig.pool` field accepts a pool. The `if (this.relationshipStorage && ...)` guard at line 183 short-circuits always in production."
      - path: "sql/009_relationships.sql"
        issue: "Migration ships but is never exercised by any production code path because RelationshipStorage is never instantiated with a real pool."
    missing:
      - "Remove `readonly` modifier from `relationshipStorage` field and add `attachRelationshipStorage(pool: Pool): void` method on GenesisLauncher"
      - "Add end-to-end launcher-level test that exercises the snapshot branch with a real or in-memory pool (existing storage.test.ts bypasses the launcher entirely)"
      - "Wire GridStore (or whichever owner holds the mysql2 pool) to call `launcher.attachRelationshipStorage(pool)` during bootstrap"
      - "Alternatively, accept the option described in 09-REVIEW.md HI-01 Option 2: take optional pool via GenesisConfig and construct storage conditionally"
  - truth: "H5 edge_key prefix resolution is unambiguous and tested (T-09-08 / ME-02)"
    status: partial
    reason: "H5 endpoint accepts 16–64 hex `edge_key` and resolves via `find(e => edgeHash(e).startsWith(edgeKey) || edgeHash(e) === edgeKey)`. The `||` clause is dead (startsWith covers equality). On truncated prefixes, `find()` returns the first match in Map insertion order — deterministic within a run but not across restarts, and silently returns the wrong edge on prefix collision. No test exercises a shortened edge_key. The H5 route emits `operator.inspected` with `target_did` set to whichever edge matched first, so a collision yields a wrong-DID audit entry."
    artifacts:
      - path: "grid/src/api/operator/relationships.ts"
        issue: "Lines 342 (regex) + 366-368 (resolution). Prefix-matching branch is completely untested; dead `||` clause adds no safety."
    missing:
      - "Either require full 64-char hash and drop prefix matching, OR implement ambiguous-prefix rejection with 409 Conflict response"
      - "Add test case for shortened edge_key with multiple candidate matches (relationships-privacy.test.ts line 106 currently only tests full 64-char hash)"
      - "Remove dead `|| edgeHash(e) === edgeKey` clause"
deferred:
  - truth: "Optional `relationship.warmed`/`.cooled` threshold-crossing events"
    addressed_in: "REL-EMIT-01 (v2.3 future requirement)"
    evidence: "REQUIREMENTS.md line 110: 'REL-EMIT-01: Optional relationship.warmed / .cooled threshold-crossing events — deferred unless derived-view performance forces event-sourcing.' Phase 9 scope correctly excludes these per ROADMAP line 41 Out of Scope."
human_verification:
  - test: "Dashboard /grid/relationships SVG graph visual smoke"
    expected: "Route loads without error; nodes render at deterministic SHA-256-seeded positions; warmth colors (#9ca3af cold / #f59e0b warm / #e11d48 hot) visible; no console errors on empty-graph state"
    why_human: "Visual rendering correctness and layout determinism across browsers cannot be asserted by jsdom/vitest — force-library-free SVG layout with WARMTH_COLOR map needs a real browser render"
  - test: "Inspector Relationships tab tier-escalation flow"
    expected: "H1 view shows bucketed warmth only (no numeric weights visible anywhere); H2 escalation via useElevatedAction shows 3-decimal valence/weight; H5 click opens EdgeEventsModal with dialogue turns; copy matches UI-SPEC verbatim"
    why_human: "T-09-21 DOM-level enforcement is unit-tested, but operator UX flow (click → elevation dialog → data appears) spans the full StoresProvider and is only reliably verifiable by clicking through the real dashboard"
  - test: "10K-edge /grid/relationships payload size + render smoke"
    expected: "Response payload renders without noticeable lag; 10k edges + ~200 nodes doesn't exceed reasonable size (<500KB uncompressed); LO-03 cap is absent but unit p95 is 0.27ms so CPU is not the bottleneck — visual feel is what matters"
    why_human: "LO-03 notes the graph endpoint has no response-size cap and no pagination. Unit benchmark confirms getTopNFor p95 < 100ms but the full graph serialize/render loop at 10k edges needs a human check in the browser"
---

# Phase 9: Relationship Graph (Derived View) Verification Report

**Phase Goal:** Ship a relationship graph derived view computed by a pure-observer listener, with idempotent rebuild, zero-diff audit chain, sole-producer boundaries, tier-graded operator API, dashboard inspector integration, and perf gates (10k-edge rebuild)
**Verified:** 2026-04-22T04:25:05Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Pure-observer `RelationshipListener` ingests `nous.spoke`/`trade.settled` + materializes edge table in **derived MySQL table**; rebuilding from audit chain produces byte-identical edges (idempotent-rebuild test) | ⚠️ PARTIAL | Listener ✓ (`grid/src/relationships/listener.ts` 303 lines, pure-observer, idempotent-rebuild.test.ts 3/3 pass byte-identical via `canonicalEdge` + `toFixed(3)`). MySQL table materialization ✗ — `relationshipStorage = null` in launcher; snapshot branch dead code. See HI-01. |
| 2 | Edge decay `weight × exp(-Δtick / τ)` deterministic; no audit event for decay; zero-diff preserved | ✓ VERIFIED | `decayedWeight()` in canonical.ts applies lazy exponential decay at read. `zero-diff.test.ts` (2/2) asserts byte-identical chain hashes across 500-event fixture with vs. without listener. `no-audit-emit.test.ts` (2/2) asserts chain length unchanged + spy on `audit.append` records 0 listener-initiated calls. |
| 3 | Inspector renders per-Nous relationship panel (top-N); full graph view at H1+ (warmth only); H5 inspects per-edge raw dialogue turns via tier-gated RPC | ✓ VERIFIED | `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` with H1/H2/H5 branches (H1 warmth-only, H2 numeric, H5 EdgeEventsModal). `/grid/relationships/relationship-graph.tsx` SVG consumer. `relationships-privacy.test.ts` 16/16 exact-key-set matrix validates H1 returns no numeric, H2 returns valence/weight, H5 returns edge events. |
| 4 | Load test: 10K-edge graph responds at p95 <100ms; computation O(edges_touched_this_tick), never O(N²) | ✓ VERIFIED | `perf-10k.test.ts` measures `getTopNFor` p95 over 1000 iterations on 10K-edge fixture at tick=2000 (decay path exercised). **Actual: p95=0.27ms** — 370× under the 100ms budget. |
| 5 | Zero new allowlist members; `broadcast-allowlist.ts` stays at 18; `scripts/check-state-doc-sync.mjs` unchanged | ✓ VERIFIED | `grid/src/audit/broadcast-allowlist.ts`: 18 members (grep `^\s*'` → 18). `allowlist-frozen.test.ts` (4/4) asserts `ALLOWLIST.size === 18` + no `relationship.*` kinds. `check-relationship-graph-deps.mjs` CI gate + file-structure baseline 147 lines. |

**Score:** 4/5 Success Criteria verified (SC#1 partial — idempotent rebuild ✓, MySQL persistence ✗)

### Per-Requirement Verdict

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| **REL-01** | Derived-view pure-observer listener over `nous.spoke`/`trade.settled`; zero allowlist growth; O(edges_touched_this_tick) | ✓ ACHIEVED | RelationshipListener is sole Map writer (producer-boundary.test.ts Gate 1), subscribes to `AuditChain.onAppend`, never calls `audit.append` (grep → 0 in listener.ts). Allowlist frozen at 18. perf-10k proves O(edges) scan. |
| **REL-02** | Edge primitive `{from_did,to_did,valence,weight,recency_tick,last_event_hash}` **stored in derived MySQL table** rebuildable from audit chain (idempotent rebuild) | ⚠️ PARTIAL | Edge primitive ✓ (types.ts matches ROADMAP shape exactly). Canonical serialization ✓ (D-9-10 6-key order + toFixed(3)). Idempotent rebuild ✓ (3/3 tests byte-identical). **MySQL table materialization ✗** — storage class exists but is never instantiated with a real pool in production (HI-01). |
| **REL-03** | Decay `weight × exp(-Δtick / τ)` deterministic; same seed+τ+chain → same graph at any replay tick | ✓ ACHIEVED | `decayedWeight()` lazy-applied at read; `getTopNFor` exercises decay path; idempotent-rebuild gate enforces determinism. No audit event emitted for decay (zero-diff preserved, no-audit-emit.test.ts). |
| **REL-04** | 10K-edge graph p95 <100ms; computation O(edges_touched_this_tick) | ✓ ACHIEVED | perf-10k.test.ts: p95=0.27ms at 10K edges over 1000 iterations. 370× budget headroom. |

**Requirements verified: 3/4 full + 1/4 partial**

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | `relationship.warmed`/`.cooled` threshold-crossing events | REL-EMIT-01 (v2.3 future) | REQUIREMENTS.md line 110 explicitly defers. ROADMAP line 41 Out of Scope for Phase 9. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/relationships/types.ts` | Edge/RelationshipConfig/WarmthBucket | ✓ VERIFIED | Plan 01, commit 0a581d5 |
| `grid/src/relationships/config.ts` | DEFAULT_RELATIONSHIP_CONFIG frozen | ✓ VERIFIED | Plan 01 |
| `grid/src/relationships/canonical.ts` | canonicalEdge/edgeHash/decayedWeight/warmthBucket/sortedPairKey | ✓ VERIFIED | Plan 01, 18 tests |
| `grid/src/relationships/listener.ts` | Sole Map writer, pure observer | ✓ VERIFIED | Plan 02, 303 lines, 17 tests, producer-boundary Gate 1 green |
| `grid/src/relationships/storage.ts` | Sole SQL writer of `relationships` table | ⚠️ ORPHANED | Class exists and is test-covered (6 tests) but is never instantiated with a real pool in production — launcher hardcodes `null`. HI-01. |
| `grid/src/relationships/index.ts` | Barrel export | ✓ VERIFIED | RelationshipListener + RelationshipStorage exported |
| `grid/src/genesis/launcher.ts` | Wired listener + storage, rebuildFromChain on bootstrap | ⚠️ PARTIAL | Listener ✓ wired (line 77, after aggregator per D-9-04). Storage ✗ — `null` in constructor (line 85), `readonly` prevents setter. Snapshot branch (lines 182-188) dead code. rebuildFromChain ✓ called at end of bootstrap. |
| `grid/src/api/operator/relationships.ts` | Four tier-graded endpoints (H1/H2/H5/graph) | ✓ VERIFIED | 307 lines, 4 endpoints, privacy matrix 16/16 green |
| `grid/src/api/operator/index.ts` | relationshipsRoutes registered | ✓ VERIFIED | |
| `grid/src/api/server.ts` | GridServices.relationships + config fields | ✓ VERIFIED | |
| `sql/009_relationships.sql` | Migration for derived table | ⚠️ ORPHANED | File exists but never executed by any code path because storage is never instantiated in production. |
| `dashboard/src/lib/api/relationships.ts` | Typed fetchers for 4 endpoints | ✓ VERIFIED | Plan 05, commit 0e87515 |
| `dashboard/src/lib/hooks/use-relationships.ts` | SWR hooks with 100-tick batching key | ✓ VERIFIED | `Math.floor(currentTick / 100)` literal (grep → 7) + BATCH_WINDOW_TICKS=100 constant |
| `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` | Tier-graded RelationshipsSection | ✓ VERIFIED | H1/H2/H5 branches; 9 tests green |
| `dashboard/src/app/grid/components/inspector-sections/edge-events-modal.tsx` | H5 edge-events dialog | ✓ VERIFIED | 6 tests green |
| `dashboard/src/app/grid/relationships/page.tsx` | /grid/relationships route | ✓ VERIFIED | Verbatim UI-SPEC copy |
| `dashboard/src/app/grid/relationships/relationship-graph.tsx` | Static SVG, no force libraries | ✓ VERIFIED | D-9-08 grep gate: d3-force/cytoscape/graphology → 0 |
| `scripts/check-relationship-graph-deps.mjs` | CI gate for runtime deps + file-structure baseline | ✓ VERIFIED | `npm run pretest` exit 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AuditChain.onAppend` | `RelationshipListener.handleEntry` | constructor subscribe | ✓ WIRED | listener.ts:44 |
| `RelationshipListener` | `GenesisLauncher.relationships` | constructed after aggregator | ✓ WIRED | launcher.ts:77 (D-9-04 order verified by listener-launcher-order.test.ts) |
| `RelationshipStorage` | `GenesisLauncher.relationshipStorage` | pool injection | ✗ NOT_WIRED | launcher.ts:85 hardcodes `null`; `readonly` field blocks setter; no production path injects a pool. HI-01. |
| `WorldClock.onTick` | `RelationshipStorage.scheduleSnapshot` | tick % snapshotCadence | ✗ NOT_WIRED | launcher.ts:182-188 branch exists but is guarded by `this.relationshipStorage && ...` which is always false in production |
| `RelationshipListener` | Fastify H1/H2/H5/graph endpoints | services.relationships closure | ✓ WIRED | relationships.ts + server.ts GridServices |
| Dashboard SWR hooks | Grid API endpoints | fetchers + 100-tick batching key | ✓ WIRED | use-relationships.ts |
| `<RelationshipsSection>` | Inspector tab | mounted on Relationships tab | ✓ WIRED | inspector.tsx |
| `rebuildFromChain` | `GenesisLauncher.bootstrap` end | called before clock.start | ✓ WIRED | launcher.ts:195 |
| `Object.keys(payload).sort()` | relationships-privacy.test.ts | exact-key-set assertions | ✓ WIRED | 5 matrix assertions, 16 tests |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RelationshipListener.edges` | Map<string,Edge> | `handleEntry()` on each AuditChain append | ✓ Real — driven by live audit events + rebuildFromChain | ✓ FLOWING |
| `/api/v1/nous/:did/relationships` H1 | `topN` array | `listener.getTopNFor(did, N, tick)` | ✓ Real — decayed weight sort over in-memory Map | ✓ FLOWING |
| `/api/v1/nous/:did/relationships/inspect` H2 | numeric valence/weight | `listener.getEdge()` | ✓ Real | ✓ FLOWING |
| `/api/v1/operator/relationships/:edge_key/events` H5 | audit-chain filtered turns | `audit.all()` + `involvesEdge` filter | ✓ Real | ✓ FLOWING |
| `/api/v1/grid/relationships/graph` | nodes[] + edges[] | `listener.allEdges()` + SHA-256 seeded positions | ✓ Real | ✓ FLOWING |
| `<RelationshipsSection>` | SWR data | fetchRelationships → grid H1 endpoint | ✓ Real | ✓ FLOWING |
| `<RelationshipGraph>` SVG | nodes/edges with {x,y} | useGraph SWR hook → graph endpoint | ✓ Real | ✓ FLOWING |
| **`relationships` MySQL table** | rows | `RelationshipStorage.snapshot()` via scheduleSnapshot | ✗ **DISCONNECTED — `relationshipStorage = null` in production** | ✗ **DISCONNECTED** |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All relationship tests pass | `cd grid && npm test -- --run test/relationships/` | 65/65 tests, 12 files | ✓ PASS |
| perf-10k p95 under 100ms | embedded in perf-10k.test.ts | p50=0.09ms p95=0.27ms p99=0.38ms | ✓ PASS |
| pretest CI gate passes | `npm run pretest` | exit 0 (state-doc-sync OK; check-relationship-graph-deps OK) | ✓ PASS |
| Allowlist at 18 | count `^\s*'` in broadcast-allowlist.ts | 18 members | ✓ PASS |
| Listener pure-observer | grep `this.audit.append` in listener.ts | 0 matches | ✓ PASS |
| No wall-clock in relationships/** | determinism-source.test.ts | 1/1 pass | ✓ PASS |
| Storage sole SQL writer | producer-boundary.test.ts Gate 2 | 0 offenders | ✓ PASS |
| Listener sole Map writer | producer-boundary.test.ts Gate 1 | 0 offenders | ✓ PASS |
| No banned graph libraries | producer-boundary.test.ts Gate 3 + CI script | 0 matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REL-01 | 09-01..02..06 | Pure-observer derived view, zero allowlist growth, O(edges) | ✓ SATISFIED | listener.ts + allowlist-frozen + producer-boundary gates |
| REL-02 | 09-01..03..04..06 | Edge primitive stored in derived MySQL table, rebuildable from audit chain | ⚠️ PARTIAL | Edge primitive + idempotent rebuild ✓; MySQL persistence ✗ (HI-01) |
| REL-03 | 09-01..02..06 | Deterministic decay, no audit event | ✓ SATISFIED | decayedWeight + zero-diff.test.ts + no-audit-emit.test.ts |
| REL-04 | 09-05..06 | 10K-edge p95 <100ms | ✓ SATISFIED | perf-10k.test.ts p95=0.27ms |

### Per-Invariant Verdict

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Pure-observer (listener never calls audit.append) | ✓ VERIFIED | producer-boundary.test.ts Gate 1; grep `audit.append` in listener.ts → 0; no-audit-emit.test.ts spy confirms 0 append calls during 500-event fixture. |
| Zero-diff (N listeners → byte-identical chain hashes) | ✓ VERIFIED | zero-diff.test.ts (2/2 pass) — chain head identical with vs. without RelationshipListener across 500 events. |
| Sole-producer Map write (only listener.ts mutates edges Map) | ✓ VERIFIED | producer-boundary.test.ts Gate 1 — 0 offenders across all `grid/src/**`. |
| Sole-producer SQL write (only storage.ts writes `relationships` table) | ✓ VERIFIED (at source level) | producer-boundary.test.ts Gate 2 — 0 offenders. NOTE: gate asserts no other file could write; it does not assert storage.ts actually runs in production (see HI-01). |
| Idempotent rebuild (byte-identical via canonicalEdge + toFixed(3)) | ✓ VERIFIED | idempotent-rebuild.test.ts (3/3) — string-equality on canonical snapshot, absorbs sub-3-decimal float drift. |
| Canonical sort (sortedPairKey did_a<did_b, 6-key order, toFixed(3)) | ✓ VERIFIED | canonical.test.ts (18/18) locks D-9-10. Self-loop throw at sortedPairKey boundary. |
| Self-loop reject (from_did === to_did silently dropped) | ✓ VERIFIED | self-edge-rejection.test.ts (2/2) — listener silent-return; getEdge returns undefined; no throw. |
| Wall-clock ban (no Date.now/performance.now/setInterval/setTimeout/Math.random in grid/src/relationships/**) | ✓ VERIFIED | determinism-source.test.ts grep-walk. NOTE: `setImmediate` in storage.ts is explicitly allowed (not in D-9-12 forbidden list). |
| Allowlist frozen (18 events, no `relationship.*`) | ✓ VERIFIED | allowlist-frozen.test.ts (4/4) + check-relationship-graph-deps.mjs file-structure baseline (147 lines). Three-layer SC#5 gate (runtime spy + source constant + CI script). |
| Launcher construction order (listener after aggregator, D-9-04) | ✓ VERIFIED | listener-launcher-order.test.ts (5/5). aggregator at line 70, listener at line 77. |

**Invariants verified: 10/10 at source-level. 1 invariant (sole-producer SQL write) is structurally correct but practically moot because storage never runs in production.**

### Perf Gate Verification

- **Gate:** 10K-edge rebuild / getTopNFor p95 <100ms
- **Measured:** p50=0.09ms, **p95=0.27ms**, p99=0.38ms (1000 iterations at tick=2000, 10K edges, decay path exercised)
- **Headroom:** 370× under budget
- **Status:** ✓ **PASS**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/genesis/launcher.ts` | 45, 85 | `private readonly ... = null` with no setter → dead guard at 182-188 | 🛑 Blocker for SC#1 | REL-02 MySQL persistence never runs in production |
| `grid/src/api/operator/relationships.ts` | 367 | Dead `|| edgeHash(e) === edgeKey` clause (startsWith covers equality) | ℹ️ Info | Redundant but not incorrect |
| `grid/src/api/operator/relationships.ts` | 366-368 | Untested prefix-match path with silent wrong-edge resolution on collision | ⚠️ Warning | H5 `operator.inspected` could log wrong target_did; see ME-02 |
| `grid/src/relationships/storage.ts` | 116-123 | `scheduleSnapshot` iterator consumed post-setImmediate — potential mutation race (ME-01) | ⚠️ Warning | Correctness only matters if HI-01 is fixed; currently dormant |
| `sql/009_relationships.sql` | 9-13 | VARCHAR(80) DID columns assume 76-char cap not enforced by DID_REGEX (ME-03) | ⚠️ Warning | Data-integrity risk if HI-01 is fixed AND long-slug DIDs appear |
| `grid/src/relationships/storage.ts` | 100 | `Number(row['recency_tick'])` loses precision >2^53 (LO-01) | ℹ️ Info | ~8.6 billion years at 30s tick; not a practical concern |

No TODO/FIXME/PLACEHOLDER comments found in Phase 9 source. No `return null`/`return []` stub patterns flowing to user-visible state.

### Human Verification Required

#### 1. Dashboard /grid/relationships SVG graph visual smoke

**Test:** Navigate to `/grid/relationships`; observe SVG renders with deterministic positions and warmth colors
**Expected:** Nodes at SHA-256-seeded positions; warmth colors #9ca3af/#f59e0b/#e11d48 visible; no console errors on empty state
**Why human:** Visual rendering correctness + cross-browser SVG layout cannot be asserted by jsdom; force-library-free layout needs a real browser render

#### 2. Inspector Relationships tab tier-escalation flow

**Test:** Select a Nous → open Relationships tab at H1 (numeric hidden) → elevate to H2 (numeric visible) → elevate to H5 (click edge → EdgeEventsModal opens)
**Expected:** H1 shows zero numeric values; H2 shows 3-decimal valence/weight; H5 opens modal with dialogue turns; copy matches UI-SPEC verbatim
**Why human:** Full StoresProvider/agency-store/elevation-dialog flow integration is end-to-end UX

#### 3. 10K-edge /grid/relationships payload size + render smoke

**Test:** Stage 10K-edge fixture; load /grid/relationships; observe render time and payload size
**Expected:** Renders without noticeable lag; payload reasonable (<500KB uncompressed)
**Why human:** LO-03 notes no response-size cap; unit perf bench measures getTopNFor alone, not full serialize+render pipeline

### Gaps Summary

Phase 9 is **overwhelmingly complete** at the source level: the pure-observer listener, idempotent rebuild, canonical serialization, producer-boundary gates, tier-graded API, dashboard UI, and 10K-edge perf bench are all present, tested, and green (65/65 relationship tests; 723/723 full grid; 432/432 dashboard). All nine invariants verify at source level. The allowlist is frozen at 18; no `relationship.*` events exist.

**However, one material goal gap remains:** ROADMAP SC#1 and REL-02 literally require the edge table to be "materialized in a derived MySQL table" — not just in-memory. The `RelationshipStorage` class is implemented and test-covered, but `GenesisLauncher.relationshipStorage` is hardcoded to `null` as a `private readonly` field with no setter and no `GenesisConfig.pool` intake. In production, the snapshot cadence branch at `launcher.ts:182-188` is dead code. The audit chain remains the source of truth (so correctness is intact), but the "fast-boot from MySQL" path the phase contract promised is dormant.

A second gap (ME-02, medium severity) concerns the H5 `edge_key` prefix-match path: it is completely untested and silently resolves to the first-matching edge on prefix collision, potentially emitting `operator.inspected` with a wrong `target_did` in the audit chain. While prefix collision at 16+ hex is astronomically unlikely, the code is written as if it expects prefixes to be valid — no ambiguity check, no test coverage — so the behavior under collision is latent UB rather than a designed-for path.

Other review findings (ME-01 iterator-race, ME-03 DID column width, LO-01..04) are conditional on HI-01 being fixed or are defensive hardening — they do not block goal achievement.

**Recommended gap-closure plans:**

1. **`09-07-PLAN.md — Launcher storage injection + end-to-end snapshot gate`**
   - Remove `readonly` from `relationshipStorage` field; add `attachRelationshipStorage(pool: Pool): void`
   - Wire GridStore (owner of the mysql2 pool) to call the setter during bootstrap; OR accept pool via `GenesisConfig.relationshipPool?: Pool`
   - Add end-to-end test in `grid/test/relationships/launcher-snapshot.test.ts` exercising the full tick → scheduleSnapshot → mysql2 mock path (existing storage.test.ts bypasses launcher)
   - Fold in ME-01 fix (materialize iterator synchronously) + ME-03 fix (tighten DID_REGEX to bounded slug OR widen VARCHAR) in the same plan to close the storage-path correctness ring

2. **`09-08-PLAN.md — H5 edge_key prefix resolution hardening`** (OR fold into 09-07)
   - Either require full 64-char hash (drop prefix), OR implement 409 Conflict on ambiguous prefixes
   - Remove dead `|| edgeHash(e) === edgeKey` clause
   - Add test case for shortened edge_key + multiple-match ambiguity
   - Rename/document `counterparty_did` payload key per IN-01 (Phase 6 D-11 doc-sync)

## Overall Verdict

**Status:** ⚠️ **FAIL (gaps_found)** — 3 of 4 requirements fully achieved; REL-02 MySQL materialization dormant. Recommend one focused gap-closure plan (09-07) to wire `RelationshipStorage` into the launcher and add the end-to-end snapshot gate. Phase 9's source-level invariants and performance contract are all solid; the gap is narrowly about one missing wire.

---

*Verified: 2026-04-22T04:25:05Z*
*Verifier: Claude (gsd-verifier)*
