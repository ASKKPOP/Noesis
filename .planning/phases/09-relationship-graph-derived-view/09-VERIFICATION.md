---
phase: 09-relationship-graph-derived-view
verified: 2026-04-22T04:25:05Z
re_verified: 2026-04-21T22:05:00Z
status: verified
score: 4/4 requirements verified (10/10 invariants verified)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "3/4 requirements verified (REL-02 PARTIAL; 9/10 invariants live)"
  gaps_closed:
    - "REL-02 — MySQL materialization unreachable in production (HI-01) — closed by Plan 09-07 attachRelationshipStorage + main.ts wiring + launcher-snapshot.test.ts E2E gate"
    - "ME-01 — scheduleSnapshot iterator consumed post-setImmediate — closed by Plan 09-07 synchronous Array.from(edges) materialization + storage.test.ts regression"
    - "ME-02 — H5 edge_key prefix ambiguity / silent wrong-edge resolution — closed by Plan 09-08 regex tighten to /^[a-f0-9]{64}$/i + strict-equality resolver + 3 regression tests (shortened reject + 63-char reject + full-hash target_did≠counterparty invariant)"
  gaps_remaining: []
  regressions: []
gaps: []
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
**Verified:** 2026-04-22T04:25:05Z (initial) — **Re-verified:** 2026-04-21T22:05:00Z (after 09-07 + 09-08 gap closure)
**Status:** ✅ **VERIFIED** (all 4 requirements achieved, all 10 invariants live, human verification items remain as known-unautomatable)
**Re-verification:** Yes — after 09-07 (HI-01 + ME-01) and 09-08 (ME-02) gap closure

## Re-Verification Summary

| Gap | Previous Status | Plan | Current Status |
|-----|----------------|------|----------------|
| **HI-01** — `RelationshipStorage` unreachable; `private readonly relationshipStorage = null` in launcher; snapshot branch dead code in production | ✗ FAILED | 09-07 | ✓ **CLOSED** — `readonly` removed; `attachRelationshipStorage(pool)` added (launcher.ts:112); `main.ts:90` calls `launcher.attachRelationshipStorage(dbConn.getPool())` after migrations; `launcher-snapshot.test.ts` (3 cases) proves tick-driven `pool.query('REPLACE INTO relationships …')` fires end-to-end |
| **ME-01** — `scheduleSnapshot` consumes iterator post-setImmediate; Map mutations between tick and flush can leak | ⚠️ WARNING | 09-07 | ✓ **CLOSED** — `Array.from(edges)` materialization on tick thread BEFORE `setImmediate` (storage.ts:130); regression test pins captured params reflect pre-mutation state |
| **ME-02** — H5 `edge_key` accepts 16–64 hex, resolves via `startsWith()`; prefix collision silently returns wrong edge; 0 tests | ✗ FAILED | 09-08 | ✓ **CLOSED** — regex tightened to `/^[a-f0-9]{64}$/i` (relationships.ts:344); resolver uses strict equality `edgeHash(e) === normalizedKey` (relationships.ts:373); dead `||` clause removed; 3 regression tests + fixture update (5 ME-02 markers in privacy tests) |

**Regressions:** None. Full grid suite 744/744 passing (up from 740 → +4 new tests). All 10 invariant gates green. Allowlist unchanged at 18. Zero-diff chain unbroken. Producer-boundary gates unchanged.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | Pure-observer `RelationshipListener` ingests `nous.spoke`/`trade.settled` + materializes edge table in **derived MySQL table**; rebuilding from audit chain produces byte-identical edges (idempotent-rebuild test) | ✓ **VERIFIED** | Listener ✓ (`grid/src/relationships/listener.ts` 303 lines, pure-observer, idempotent-rebuild.test.ts 3/3 pass byte-identical via `canonicalEdge` + `toFixed(3)`). **MySQL table materialization NOW LIVE** — `launcher.attachRelationshipStorage(pool)` wired at `main.ts:90` after migrations; tick-driven `scheduleSnapshot` proven end-to-end via `launcher-snapshot.test.ts` asserting `pool.query('REPLACE INTO relationships …')`. |
| 2 | Edge decay `weight × exp(-Δtick / τ)` deterministic; no audit event for decay; zero-diff preserved | ✓ VERIFIED | `decayedWeight()` in canonical.ts applies lazy exponential decay at read. `zero-diff.test.ts` (2/2) asserts byte-identical chain hashes across 500-event fixture with vs. without listener. `no-audit-emit.test.ts` (2/2) asserts chain length unchanged + spy on `audit.append` records 0 listener-initiated calls. |
| 3 | Inspector renders per-Nous relationship panel (top-N); full graph view at H1+ (warmth only); H5 inspects per-edge raw dialogue turns via tier-gated RPC | ✓ VERIFIED | `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` with H1/H2/H5 branches (H1 warmth-only, H2 numeric, H5 EdgeEventsModal). `/grid/relationships/relationship-graph.tsx` SVG consumer. `relationships-privacy.test.ts` 19/19 exact-key-set matrix validates H1 returns no numeric, H2 returns valence/weight, H5 returns edge events — now with ME-02 full-hash-only hardening. |
| 4 | Load test: 10K-edge graph responds at p95 <100ms; computation O(edges_touched_this_tick), never O(N²) | ✓ VERIFIED | `perf-10k.test.ts` measures `getTopNFor` p95 over 1000 iterations on 10K-edge fixture at tick=2000 (decay path exercised). **Actual: p95=0.27ms** — 370× under the 100ms budget. |
| 5 | Zero new allowlist members; `broadcast-allowlist.ts` stays at 18; `scripts/check-state-doc-sync.mjs` unchanged | ✓ VERIFIED | `grid/src/audit/broadcast-allowlist.ts`: 18 members (grep `^\s*'` → 18, re-verified 2026-04-21). `allowlist-frozen.test.ts` (4/4) asserts `ALLOWLIST.size === 18` + no `relationship.*` kinds. `check-relationship-graph-deps.mjs` CI gate + file-structure baseline 147 lines. |

**Score:** 5/5 Success Criteria verified (SC#1 was partial, NOW complete post-09-07)

### Per-Requirement Verdict

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| **REL-01** | Derived-view pure-observer listener over `nous.spoke`/`trade.settled`; zero allowlist growth; O(edges_touched_this_tick) | ✓ ACHIEVED | RelationshipListener is sole Map writer (producer-boundary.test.ts Gate 1), subscribes to `AuditChain.onAppend`, never calls `audit.append` (grep → 0 in listener.ts). Allowlist frozen at 18. perf-10k proves O(edges) scan. |
| **REL-02** | Edge primitive `{from_did,to_did,valence,weight,recency_tick,last_event_hash}` **stored in derived MySQL table** rebuildable from audit chain (idempotent rebuild) | ✓ **ACHIEVED** (was PARTIAL) | Edge primitive ✓ (types.ts matches ROADMAP shape exactly). Canonical serialization ✓ (D-9-10 6-key order + toFixed(3)). Idempotent rebuild ✓ (3/3 tests byte-identical). **MySQL table materialization ✓ LIVE** — Plan 09-07 wired `attachRelationshipStorage` at `main.ts:90`; `launcher-snapshot.test.ts` proves `pool.query('REPLACE INTO relationships …')` fires on cadence boundary; ME-01 iterator race closed via synchronous `Array.from(edges)` at storage.ts:130. |
| **REL-03** | Decay `weight × exp(-Δtick / τ)` deterministic; same seed+τ+chain → same graph at any replay tick | ✓ ACHIEVED | `decayedWeight()` lazy-applied at read; `getTopNFor` exercises decay path; idempotent-rebuild gate enforces determinism. No audit event emitted for decay (zero-diff preserved, no-audit-emit.test.ts). |
| **REL-04** | 10K-edge graph p95 <100ms; computation O(edges_touched_this_tick) | ✓ ACHIEVED | perf-10k.test.ts: p95=0.27ms at 10K edges over 1000 iterations. 370× budget headroom. |

**Requirements verified: 4/4 (was 3/4 full + 1/4 partial)**

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
| `grid/src/relationships/storage.ts` | Sole SQL writer of `relationships` table | ✓ **VERIFIED** (was ORPHANED) | Class exists, test-covered (7 tests incl. ME-01 regression), AND reachable in production via `main.ts:90` → `launcher.attachRelationshipStorage(dbConn.getPool())`. `constructor(public readonly pool: Pool)` exposes pool for launcher idempotency check. `scheduleSnapshot` materializes iterator synchronously (ME-01). |
| `grid/src/relationships/index.ts` | Barrel export | ✓ VERIFIED | RelationshipListener + RelationshipStorage exported |
| `grid/src/genesis/launcher.ts` | Wired listener + storage, rebuildFromChain on bootstrap | ✓ **VERIFIED** (was PARTIAL) | Listener ✓ wired (line 87, after aggregator per D-9-04). Storage ✓ — `private relationshipStorage` (readonly REMOVED, launcher.ts:55); `attachRelationshipStorage(pool: Pool): void` method at line 112 (idempotent-by-reference, throws on pool-switch). Snapshot branch at lines 220-226 is now LIVE when pool is attached. rebuildFromChain ✓ called at end of bootstrap (line 233). |
| `grid/src/api/operator/relationships.ts` | Four tier-graded endpoints (H1/H2/H5/graph) | ✓ VERIFIED | 4 endpoints, privacy matrix 19/19 green. H5 hardened per ME-02: `/^[a-f0-9]{64}$/i` regex (line 344), strict-equality resolver `edgeHash(e) === normalizedKey` (line 373), dead `||` clause removed. |
| `grid/src/api/operator/index.ts` | relationshipsRoutes registered | ✓ VERIFIED | |
| `grid/src/api/server.ts` | GridServices.relationships + config fields | ✓ VERIFIED | |
| `grid/src/main.ts` | Production wiring of `attachRelationshipStorage` | ✓ **VERIFIED** (new) | `dbConn` hoisted out of migrations `if`-block; `launcher.attachRelationshipStorage(dbConn.getPool())` at line 90 (AFTER `runner.run()`, AFTER `launcher.bootstrap`); `relationships: launcher.relationships` + `config: { relationship: config.genesisConfig.relationship }` passed to buildServer. |
| `grid/src/db/connection.ts` | `getPool()` accessor for single-pool sharing | ✓ **VERIFIED** (new) | `getPool(): mysql.Pool` added to DatabaseConnection; single pool serves both GridStore and RelationshipStorage. |
| `sql/009_relationships.sql` | Migration for derived table | ✓ **VERIFIED** (was ORPHANED) | Migration applied via `runner.run()` in `main.ts:76` BEFORE `attachRelationshipStorage` at `main.ts:90` — schema is in place before first snapshot fires. |
| `dashboard/src/lib/api/relationships.ts` | Typed fetchers for 4 endpoints | ✓ VERIFIED | Plan 05, commit 0e87515 |
| `dashboard/src/lib/hooks/use-relationships.ts` | SWR hooks with 100-tick batching key | ✓ VERIFIED | `Math.floor(currentTick / 100)` literal (grep → 7) + BATCH_WINDOW_TICKS=100 constant |
| `dashboard/src/app/grid/components/inspector-sections/relationships.tsx` | Tier-graded RelationshipsSection | ✓ VERIFIED | H1/H2/H5 branches; 9 tests green |
| `dashboard/src/app/grid/components/inspector-sections/edge-events-modal.tsx` | H5 edge-events dialog | ✓ VERIFIED | 6 tests green |
| `dashboard/src/app/grid/relationships/page.tsx` | /grid/relationships route | ✓ VERIFIED | Verbatim UI-SPEC copy |
| `dashboard/src/app/grid/relationships/relationship-graph.tsx` | Static SVG, no force libraries | ✓ VERIFIED | D-9-08 grep gate: d3-force/cytoscape/graphology → 0 |
| `scripts/check-relationship-graph-deps.mjs` | CI gate for runtime deps + file-structure baseline | ✓ VERIFIED | `npm run pretest` exit 0 |
| `grid/test/relationships/launcher-snapshot.test.ts` | E2E regression gate preventing re-regression to dormant-null state | ✓ **VERIFIED** (new) | 3 it() cases: no-pool no-op, pool-attached snapshot-fires-on-cadence-boundary with REPLACE INTO assertion, idempotency (same-pool no-op + different-pool throws) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AuditChain.onAppend` | `RelationshipListener.handleEntry` | constructor subscribe | ✓ WIRED | listener.ts:44 |
| `RelationshipListener` | `GenesisLauncher.relationships` | constructed after aggregator | ✓ WIRED | launcher.ts:87 (D-9-04 order verified by listener-launcher-order.test.ts) |
| `RelationshipStorage` | `GenesisLauncher.relationshipStorage` | pool injection via `attachRelationshipStorage` | ✓ **WIRED** (was NOT_WIRED) | `main.ts:90` → `launcher.attachRelationshipStorage(dbConn.getPool())`. Setter idempotent-by-reference; throws on pool-switch. Field no longer `readonly`. |
| `WorldClock.onTick` | `RelationshipStorage.scheduleSnapshot` | tick % snapshotCadence | ✓ **WIRED** (was NOT_WIRED) | launcher.ts:220-226 branch now live when pool attached. Proven by launcher-snapshot.test.ts case 2 assertion on `pool.query('REPLACE INTO relationships …')`. |
| `RelationshipListener` | Fastify H1/H2/H5/graph endpoints | services.relationships closure | ✓ WIRED | relationships.ts + server.ts GridServices |
| Dashboard SWR hooks | Grid API endpoints | fetchers + 100-tick batching key | ✓ WIRED | use-relationships.ts |
| `<RelationshipsSection>` | Inspector tab | mounted on Relationships tab | ✓ WIRED | inspector.tsx |
| `rebuildFromChain` | `GenesisLauncher.bootstrap` end | called before clock.start | ✓ WIRED | launcher.ts:233 |
| `Object.keys(payload).sort()` | relationships-privacy.test.ts | exact-key-set assertions | ✓ WIRED | 19 tests (16 original + 3 ME-02) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RelationshipListener.edges` | Map<string,Edge> | `handleEntry()` on each AuditChain append | ✓ Real — driven by live audit events + rebuildFromChain | ✓ FLOWING |
| `/api/v1/nous/:did/relationships` H1 | `topN` array | `listener.getTopNFor(did, N, tick)` | ✓ Real — decayed weight sort over in-memory Map | ✓ FLOWING |
| `/api/v1/nous/:did/relationships/inspect` H2 | numeric valence/weight | `listener.getEdge()` | ✓ Real | ✓ FLOWING |
| `/api/v1/operator/relationships/:edge_key/events` H5 | audit-chain filtered turns | `audit.all()` + `involvesEdge` filter — full-hash strict lookup only (ME-02) | ✓ Real | ✓ FLOWING |
| `/api/v1/grid/relationships/graph` | nodes[] + edges[] | `listener.allEdges()` + SHA-256 seeded positions | ✓ Real | ✓ FLOWING |
| `<RelationshipsSection>` | SWR data | fetchRelationships → grid H1 endpoint | ✓ Real | ✓ FLOWING |
| `<RelationshipGraph>` SVG | nodes/edges with {x,y} | useGraph SWR hook → graph endpoint | ✓ Real | ✓ FLOWING |
| **`relationships` MySQL table** | rows | `RelationshipStorage.snapshot()` via scheduleSnapshot, fired on `tick % snapshotCadenceTicks === 0` | ✓ **Real — launcher.attachRelationshipStorage(dbConn.getPool()) at main.ts:90** | ✓ **FLOWING** (was DISCONNECTED) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full grid suite passes | `cd grid && npm test` | 82 files, 744/744 tests | ✓ PASS |
| perf-10k p95 under 100ms | embedded in perf-10k.test.ts | p50=0.09ms p95=0.27ms p99=0.38ms | ✓ PASS |
| pretest CI gate passes | `npm run pretest` | exit 0 (state-doc-sync OK; check-relationship-graph-deps OK) | ✓ PASS |
| Allowlist at 18 | `grep -c "^\s*'" src/audit/broadcast-allowlist.ts` | 18 | ✓ PASS |
| Listener pure-observer | grep `this.audit.append` in listener.ts | 0 matches | ✓ PASS |
| No wall-clock in relationships/** | determinism-source.test.ts | 1/1 pass | ✓ PASS |
| Storage sole SQL writer | producer-boundary.test.ts Gate 2 | 0 offenders | ✓ PASS |
| Listener sole Map writer | producer-boundary.test.ts Gate 1 | 0 offenders | ✓ PASS |
| No banned graph libraries | producer-boundary.test.ts Gate 3 + CI script | 0 matches | ✓ PASS |
| **Storage reachable in production** (HI-01) | `grep -n "attachRelationshipStorage" grid/src/main.ts` | 1 match at line 90 | ✓ PASS |
| **ME-01 iterator materialization** | `grep -n "Array.from(edges)" grid/src/relationships/storage.ts` | 1 match at line 130 | ✓ PASS |
| **ME-02 full-hash-only H5** | `grep -n "startsWith\|16,64" grid/src/api/operator/relationships.ts` | 0 matches | ✓ PASS |
| **ME-02 regression tests** | `grep -c "ME-02" grid/test/api/relationships-privacy.test.ts` | 5 markers | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REL-01 | 09-01..02..06 | Pure-observer derived view, zero allowlist growth, O(edges) | ✓ SATISFIED | listener.ts + allowlist-frozen + producer-boundary gates |
| REL-02 | 09-01..03..04..06..07 | Edge primitive stored in derived MySQL table, rebuildable from audit chain | ✓ **SATISFIED** (was PARTIAL) | Edge primitive + idempotent rebuild + MySQL persistence all live; launcher-snapshot.test.ts E2E gate |
| REL-03 | 09-01..02..06 | Deterministic decay, no audit event | ✓ SATISFIED | decayedWeight + zero-diff.test.ts + no-audit-emit.test.ts |
| REL-04 | 09-05..06 | 10K-edge p95 <100ms | ✓ SATISFIED | perf-10k.test.ts p95=0.27ms |

### Per-Invariant Verdict

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Pure-observer (listener never calls audit.append) | ✓ VERIFIED | producer-boundary.test.ts Gate 1; grep `audit.append` in listener.ts → 0; no-audit-emit.test.ts spy confirms 0 append calls during 500-event fixture. |
| Zero-diff (N listeners → byte-identical chain hashes) | ✓ VERIFIED | zero-diff.test.ts (2/2 pass) — chain head identical with vs. without RelationshipListener across 500 events. Re-verified post-09-07/09-08: unchanged. |
| Sole-producer Map write (only listener.ts mutates edges Map) | ✓ VERIFIED | producer-boundary.test.ts Gate 1 — 0 offenders across all `grid/src/**`. |
| Sole-producer SQL write (only storage.ts writes `relationships` table) | ✓ **VERIFIED (LIVE)** | producer-boundary.test.ts Gate 2 — 0 offenders. **Now actually runs in production post-09-07** — previously structurally correct but moot; now source-level gate AND runtime path are both verified. |
| Idempotent rebuild (byte-identical via canonicalEdge + toFixed(3)) | ✓ VERIFIED | idempotent-rebuild.test.ts (3/3) — string-equality on canonical snapshot, absorbs sub-3-decimal float drift. |
| Canonical sort (sortedPairKey did_a<did_b, 6-key order, toFixed(3)) | ✓ VERIFIED | canonical.test.ts (18/18) locks D-9-10. Self-loop throw at sortedPairKey boundary. |
| Self-loop reject (from_did === to_did silently dropped) | ✓ VERIFIED | self-edge-rejection.test.ts (2/2) — listener silent-return; getEdge returns undefined; no throw. |
| Wall-clock ban (no Date.now/performance.now/setInterval/setTimeout/Math.random in grid/src/relationships/**) | ✓ VERIFIED | determinism-source.test.ts grep-walk. NOTE: `setImmediate` in storage.ts is explicitly allowed (not in D-9-12 forbidden list). `Array.from` (ME-01 fix) introduces no forbidden calls. |
| Allowlist frozen (18 events, no `relationship.*`) | ✓ VERIFIED | allowlist-frozen.test.ts (4/4) + check-relationship-graph-deps.mjs file-structure baseline (147 lines). Three-layer SC#5 gate (runtime spy + source constant + CI script). Re-verified 2026-04-21: grep count still 18. |
| Launcher construction order (listener after aggregator, D-9-04) | ✓ VERIFIED | listener-launcher-order.test.ts (5/5). aggregator at line 80, listener at line 87 (post-09-07 line shift for new comments + attachRelationshipStorage method). Order unchanged. |

**Invariants verified: 10/10 at source level AND runtime level post-09-07.** Previously, sole-producer SQL write was a structural gate that did not exercise production; it is now fully live.

### Perf Gate Verification

- **Gate:** 10K-edge rebuild / getTopNFor p95 <100ms
- **Measured:** p50=0.09ms, **p95=0.27ms**, p99=0.38ms (1000 iterations at tick=2000, 10K edges, decay path exercised)
- **Headroom:** 370× under budget
- **Status:** ✓ **PASS**

### Anti-Patterns Found (post-09-07/09-08)

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `sql/009_relationships.sql` | 9-13 | VARCHAR(80) DID columns assume 76-char cap not enforced by DID_REGEX (ME-03) | ⚠️ Warning | Data-integrity risk if long-slug DIDs appear. Not a Phase 9 blocker — DID_REGEX invariant lives cross-phase. |
| `grid/src/relationships/storage.ts` | 100 | `Number(row['recency_tick'])` loses precision >2^53 (LO-01) | ℹ️ Info | ~8.6 billion years at 30s tick; not a practical concern. |

**Closed anti-patterns** (gap closure):
- ~~launcher.ts `private readonly` dead guard~~ — CLOSED by 09-07 (`readonly` removed, setter added)
- ~~relationships.ts dead `||` clause~~ — CLOSED by 09-08 (removed)
- ~~relationships.ts untested prefix-match path~~ — CLOSED by 09-08 (prefix acceptance dropped; regex tightened; 3 regression tests)
- ~~storage.ts scheduleSnapshot iterator race~~ — CLOSED by 09-07 (synchronous Array.from)

No TODO/FIXME/PLACEHOLDER comments found in Phase 9 source. No `return null`/`return []` stub patterns flowing to user-visible state.

### Human Verification Required

Carried over from initial verification — none of these became automatable post-gap-closure.

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

**All Phase 9 gaps closed.** Plan 09-07 wired `RelationshipStorage` into `GenesisLauncher` via `attachRelationshipStorage(pool)` and `main.ts:90` production call; `launcher-snapshot.test.ts` locks the end-to-end path. ME-01 iterator race closed in the same plan via synchronous `Array.from(edges)` materialization. Plan 09-08 tightened H5 `edge_key` validation from `{16,64}` prefix to `{64}` full-hash-only with strict-equality resolution, plus 3 regression tests pinning the 16-char reject + 63-char reject + full-hash `target_did ≠ counterparty_did` invariant.

**Full grid suite:** 744/744 (82 files) passing. Zero regressions. All 10 invariants verified at both source level and runtime level. SC#1 and REL-02 now fully achieved — the derived MySQL table is materialized in production, not just in-memory.

**Three human verification items remain** (carried forward) — all visual/UX flows that cannot be automated in jsdom. These are the bounded unautomatable surface and are expected to stay on the checklist for operator smoke-test.

## Overall Verdict

**Status:** ✅ **VERIFIED** (was ⚠️ FAIL) — all 4 requirements achieved, all 10 invariants live at runtime, all 3 gap-closure plans shipped and green, 744/744 grid tests passing. Three human verification items remain as known-unautomatable smoke checks. Phase 9 is complete at the code level.

---

*Verified: 2026-04-22T04:25:05Z (initial, gaps_found)*
*Re-verified: 2026-04-21T22:05:00Z (verified, after 09-07 + 09-08 gap closure)*
*Verifier: Claude (gsd-verifier)*
