---
phase: 9
name: "Relationship Graph (Derived View)"
mode: auto
created: 2026-04-21
---

# Phase 9 — Discussion Audit Trail (--auto)

Running `/gsd-discuss-phase 9 --auto`. Gray areas identified by analyzing REL-01..04 against the v2.1 architectural vocabulary and ROADMAP Phase 9 entry. All areas auto-selected; the recommended option (first / research-backed) chosen for each.

## Gray areas identified

1. Decay time constant τ default (ROADMAP Open Question #1)
2. Valence derivation formula
3. Storage shape (in-memory vs MySQL vs hybrid)
4. Listener construction order in GenesisLauncher
5. Sole-producer boundary enforcement
6. Tier-graded privacy surface (T-09-07)
7. Top-N default + N+1 mitigation (T-09-11)
8. Dashboard graph-view library
9. Performance bound for 10K-edge load
10. Canonical edge serialization
11. Self-loop handling (T-09-08)
12. Wall-clock discipline (T-09-09 port)
13. Allowlist growth confirmation

All 13 auto-selected. No deferrals to user. One-pass cap honored.

---

## Q1 — Decay time constant τ default value?

**Options**
- (a) **τ = 1000 ticks** — half-life ≈ 693 ticks; 3τ cool-down ≈ 3000 ticks. Balances "cools over realistic horizon" with replay determinism.  ← recommended
- (b) τ = 500 ticks — aggressive cooling, better for short rigs but drowns slow relationships
- (c) τ = 5000 ticks — too slow; edges never visibly cool in researcher rigs of 10K ticks
- (d) Defer to runtime config with no default — violates "sensible default" requirement from ROADMAP

**Chosen: (a) τ = 1000 ticks** as default on `relationship.decay_tau_ticks`; per-Grid overridable. Resolves ROADMAP Open Question #1.

---

## Q2 — Valence derivation: where does `valence ∈ [-1, +1]` come from?

**Options**
- (a) **Deterministic event-class mapping** (closed bump table over `nous.spoke` / `trade.settled` / `trade.reviewed` verdict / `telos.refined` participant match), no plaintext.  ← recommended
- (b) Sentiment analysis of utterance text — **rejected**: violates hash-only cross-boundary invariant (I-5); plaintext touched at Grid layer
- (c) Binary success/failure only — too low resolution; loses dialogue and refinement signal
- (d) Brain-side valence attestation — **rejected**: moves authoritative state Brain-side, breaks Grid-authoritative-derived-view discipline

**Chosen: (a)**. Bump table per D-9-02: `trade.settled +0.10`, `trade.reviewed(rejected) -0.10`, `nous.spoke (bidirectional) +0.01`, `telos.refined (matching participants) +0.05`. Clamped to `[-1, +1]` after each bump. Constants frozen in `config.ts`, per-Grid overridable.

---

## Q3 — Storage shape?

**Options**
- (a) **In-memory Map + periodic MySQL snapshot + rebuild-from-chain** on restart. Snapshot every 100 ticks.  ← recommended
- (b) Write-through MySQL on each edge mutation — high write volume, no benefit; adds per-event I/O to pure-observer hot path
- (c) Pure in-memory, no MySQL — rebuild from chain on every restart; fine at MVP scale but wastes Phase 1 snapshot infrastructure
- (d) New relational model — over-engineered; derived view wants simplest idempotent surface

**Chosen: (a)**. Matches `grid/src/db/persistent-chain.ts` snapshot cadence pattern. Idempotent rebuild gives correctness; snapshot gives fast restart. See D-9-03.

---

## Q4 — Listener construction point in `GenesisLauncher`?

**Options**
- (a) **Construct after `this.aggregator`**, same phase as every listener addition since Phase 5.  ← recommended
- (b) Construct before aggregator — no reason; order must be deterministic but chosen by dependency
- (c) Construct lazily on first `/relationships` request — breaks zero-diff (listener missing for initial chain entries)

**Chosen: (a)**. See D-9-04. Zero-diff test clones `grid/test/dialogue/zero-diff.test.ts`.

---

## Q5 — Sole-producer enforcement?

**Options**
- (a) **Grep gate + two-file authoritative writer** (`listener.ts` for Map, `storage.ts` for MySQL).  ← recommended
- (b) Runtime assertion only — misses compile-time drift; v2.1 Phase 6 D-13 precedent is grep gate
- (c) Single-file writer (no storage.ts) — couples MySQL I/O to observer hot path; harder to test in isolation

**Chosen: (a)**. Clones `grid/test/audit/nous-deleted-producer-boundary.test.ts`. T-09-06 mitigation.

---

## Q6 — Tier-graded privacy surface?

**Options**
- (a) **Three endpoint variants — H1 bucketed, H2 numeric, H5 edge-events** — matches ROADMAP risk mitigation language exactly.  ← recommended
- (b) Two-tier only (H1 hash-only, H5 full) — loses the partner-tier intermediate that Phase 6 precedent supports
- (c) Single endpoint, client-side redaction — fails privacy-by-construction; audit of what crossed wire still leaks

**Chosen: (a)**. See D-9-06. Reuses `operator.inspected` audit event (no allowlist growth). T-09-07 mitigation.

---

## Q7 — Top-N default?

**Options**
- (a) **N = 5**, cap 20, `useSWR` batching.  ← recommended (ROADMAP success criterion #4 says `top=5`)
- (b) N = 10 — more data, bigger payload, no UX benefit at MVP
- (c) Paginated listing — premature; N=5 satisfies Inspector panel

**Chosen: (a)**. See D-9-07. T-09-11 mitigation.

---

## Q8 — Graph view rendering library?

**Options**
- (a) **Vanilla SVG, deterministic seeded layout**.  ← recommended (zero new dep; matches v2.1 stack discipline)
- (b) d3-force — force-directed, but adds dep and non-determinism in layout convergence
- (c) react-force-graph — adds React-layer 3D/2D wrapper; overkill for aggregate warmth
- (d) cytoscape — heavy; breaks "no new runtime deps" v2.2 discipline

**Chosen: (a)**. See D-9-08. Grep gate forbids `d3-force|react-force-graph|cytoscape|graphology` imports.

---

## Q9 — Performance enforcement for 10K-edge target?

**Options**
- (a) **Lazy decay at read + weekly CI load test**.  ← recommended
- (b) Per-tick decay sweep — breaks O(edges_touched_this_tick) budget at scale
- (c) Index-backed MySQL read — adds DB roundtrip to hot path; in-memory is faster for v2.2 scale

**Chosen: (a)**. See D-9-09. `load-10k.test.ts` runs weekly in CI matching Phase 8 perf-bench cadence.

---

## Q10 — Canonical edge serialization?

**Options**
- (a) **Locked 6-key order, 3-decimal fixed-point floats, SHA-256 hash**.  ← recommended (Phase 8 D-07 pattern)
- (b) Plain `JSON.stringify(edge)` — key order platform-dependent; hash drifts
- (c) MessagePack — adds dep; no benefit over locked JSON

**Chosen: (a)**. See D-9-10.

---

## Q11 — Self-loop handling?

**Options**
- (a) **Silent reject at listener boundary + grep assertion**.  ← recommended (T-09-08 mitigation)
- (b) Allow but mark with flag — pollutes edge math and graph views
- (c) Reject with throw — louder but listener is pure-observer; silent drop matches Phase 7 D-21 discipline

**Chosen: (a)**. See D-9-11. Test: `self-edge-rejection.test.ts`.

---

## Q12 — Wall-clock discipline?

**Options**
- (a) **Grep gate forbidding `Date.now|performance.now|setInterval|setTimeout|Math.random` in `grid/src/relationships/**`**.  ← recommended (clones Phase 7 `dialogue-determinism-source.test.ts`)
- (b) Runtime-only check — too late; drift found in production
- (c) Convention-only — no enforcement; regresses

**Chosen: (a)**. See D-9-12. T-09-09 port mitigation.

---

## Q13 — Allowlist growth?

**Options**
- (a) **Zero**. Confirmed by ROADMAP success criterion #5.  ← recommended and mandatory
- (b) Add `relationship.warmed` / `.cooled` — violates Phase 9 scope; deferred to REL-EMIT-01
- (c) Add `relationship.edge_computed` — per-tick emission; T-09-01 bloat pattern; rejected

**Chosen: (a)**. Hard invariant. `scripts/check-state-doc-sync.mjs` unchanged. Test `no-audit-emit.test.ts` asserts chain length unchanged by listener.

---

## Summary

13/13 gray areas resolved in single pass. Zero items deferred to user. CONTEXT.md written. Proceeding to commit + state record + auto-advance to plan-phase.
