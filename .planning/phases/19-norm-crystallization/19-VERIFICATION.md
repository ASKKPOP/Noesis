---
phase: 19-norm-crystallization
verified: 2026-05-16T23:30:00Z
status: gaps_found
score: 7/8 invariants verified
overrides_applied: 0
gaps:
  - truth: "compute_norm_fingerprint() exists in brain/src/noesis_brain/learning/rules.py AND is wired into RuleStore.add()"
    status: partial
    reason: "compute_norm_fingerprint() exists at rules.py:32 but is not called anywhere in production brain code — not in RuleStore.add(), not in handler.py, not in the nous.self_model_revised emission path. There is no active emitter for nous.self_model_revised in either grid or brain source. NormDetector observes an event that is never emitted in practice."
    artifacts:
      - path: "brain/src/noesis_brain/learning/rules.py"
        issue: "compute_norm_fingerprint defined at line 32 but never called in RuleStore.add() or any production code path"
    missing:
      - "Wire compute_norm_fingerprint(content) into RuleStore.add() so that each rule addition computes the 6-char hex fingerprint"
      - "Emit nous.self_model_revised via an appendNousSelfModelRevised sole-producer emitter with payload {nous_did, tick, revision_hash} where revision_hash = compute_norm_fingerprint(rule_content)"
      - "Wire the emitter call into the NousRunner RULE_STORE action dispatch path in grid/src/ so the Brain RULE_STORE action produces the audit event"
---

# Phase 19: Norm Crystallization Verification Report

**Phase Goal:** Implement `NormDetector` — a pure-observer Grid-side component that clusters rule fingerprints across Nous and emits two new allowlist events, growing the broadcast allowlist from 39 to 41 events.
**Verified:** 2026-05-16T23:30:00Z
**Status:** BLOCKED (1 gap)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NormDetector observes nous.self_model_revised (pos 29), emits norm.candidate when N≥3 Nous share fingerprint within W=10 ticks | ✓ VERIFIED | NormDetector.ts:39 filters on eventType; types.ts confirms threshold=3, windowTicks=10; appendNormCandidate.ts is sole producer |
| 2 | convergence_type classified as emergent vs coincidental using RelationshipListener.getEdge() weight>0 | ✓ VERIFIED | NormDetector.ts:134-146 — classifyConvergence iterates pairs, calls getEdge (O(1) Map lookup at listener.ts:53-61), returns emergent if weight>0 edge found |
| 3 | norm.crystallized emitted after K=20 adoption ticks; queryable via GET /api/v1/grid/norms | ✓ VERIFIED | types.ts:39 adoptionTicks=20; server.ts:356-373 — route registered, returns {norms: [...]}; 5 API tests pass |
| 4 | ALLOWLIST_MEMBERS.length === 41 | ✓ VERIFIED | broadcast-allowlist.ts: 41 entries confirmed by programmatic count; norm.candidate at pos 40, norm.crystallized at pos 41 |
| 5 | FORBIDDEN_KEY_PATTERN includes norm-specific forbidden keys | ✓ VERIFIED | broadcast-allowlist.ts:314-382 — NORM_FORBIDDEN_KEYS exports [norm_text, fingerprint_text, rule_content]; FORBIDDEN_KEY_PATTERN at line 382 includes all three |
| 6 | NormDetector has zero audit.append calls (pure observer) | ✓ VERIFIED | NormDetector.ts: grep confirms only the sole-producer files (appendNormCandidate.ts, appendNormCrystallized.ts) call audit.append with norm events; NormDetector delegates 100% |
| 7 | rebuildFromChain uses applyEntry path (no emitters) | ✓ VERIFIED | NormDetector.ts:109-117 — rebuildFromChain calls private applyEntry (lines 92-105); applyEntry does NOT call appendNormCandidate or appendNormCrystallized; startup-rebuild test (2 tests) confirms zero chain growth |
| 8 | compute_norm_fingerprint() exists in brain/src/noesis_brain/learning/rules.py AND is wired into RuleStore.add() | ✗ PARTIAL | Function exists at rules.py:32 with correct algorithm; NOT called in RuleStore.add() or any production brain code; no active emitter for nous.self_model_revised exists anywhere in grid or brain source |

**Score:** 7/8 truths verified (invariant 8 is partial fail)

### Deferred Items

None identified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/norms/NormDetector.ts` | Pure-observer listener on nous.self_model_revised | ✓ VERIFIED | 147 lines; zero audit.append calls; handleEntry (live) + applyEntry (rebuild) split |
| `grid/src/norms/appendNormCandidate.ts` | Sole producer for norm.candidate (pos 40) | ✓ VERIFIED | 10-step validation; actorDid === 'did:noesis:grid' enforced at step 2 |
| `grid/src/norms/appendNormCrystallized.ts` | Sole producer for norm.crystallized (pos 41) | ✓ VERIFIED | 10-step validation; actorDid === 'did:noesis:grid' enforced at step 2; evidence_tick_range validated |
| `grid/src/norms/storage.ts` | NormStorage — MySQL persistence for norm_candidates/norm_registry | ✓ VERIFIED | 104 lines; upsertCandidate, deleteCandidate, insertRegistry, loadNorms |
| `grid/src/norms/types.ts` | NormCandidatePayload, NormCrystallizedPayload, NormConfig, DEFAULT_NORM_CONFIG | ✓ VERIFIED | threshold=3, windowTicks=10, adoptionTicks=20; locked key tuples |
| `grid/src/audit/broadcast-allowlist.ts` | ALLOWLIST 39→41, NORM_FORBIDDEN_KEYS, FORBIDDEN_KEY_PATTERN extended | ✓ VERIFIED | 41 entries confirmed; NORM_FORBIDDEN_KEYS at line 314; pattern extended at line 382 |
| `grid/src/db/schema.ts` | Migration v7 with norm_candidates + norm_registry tables | ✓ VERIFIED | schema.ts:143-174 — version 7, both tables with correct column definitions |
| `grid/src/api/server.ts` | GET /api/v1/grid/norms returning {norms: [...]} | ✓ VERIFIED | server.ts:356-373 — route registered when services.norms provided; returns {norms: rows.map(...)} |
| `brain/src/noesis_brain/learning/rules.py` | compute_norm_fingerprint() wired into RuleStore.add() | ✗ PARTIAL | Function exists at line 32 with correct algorithm; NOT called in RuleStore.add() or any production code |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| NormDetector.ts | appendNormCandidate.ts | handleEntry → appendNormCandidate() when threshold crossed | ✓ WIRED | NormDetector.ts:65 calls appendNormCandidate(this.audit, 'did:noesis:grid', ...) |
| NormDetector.ts | appendNormCrystallized.ts | handleEntry → appendNormCrystallized() when adoptionTicks elapsed | ✓ WIRED | NormDetector.ts:78 calls appendNormCrystallized(this.audit, 'did:noesis:grid', ...) |
| NormDetector.ts | RelationshipListener.getEdge | classifyConvergence → getEdge() O(1) Map lookup | ✓ WIRED | NormDetector.ts:139; RelationshipListener.ts:53-61 — simple Map.get(sortedPairKey) |
| GenesisLauncher | NormDetector | Constructor + bootstrap() + rebuildFromChain | ✓ WIRED | launcher.ts:19 imports NormDetector; line 84 readonly field; constructed after RelationshipListener |
| NormStorage | GET /api/v1/grid/norms | server.ts services.norms.loadNorms() | ✓ WIRED | server.ts:360 calls services.norms.loadNorms(services.gridName) |
| brain/src/learning/rules.py | nous.self_model_revised via revision_hash | compute_norm_fingerprint() → RuleStore.add() → emitter | ✗ NOT_WIRED | compute_norm_fingerprint() defined but never called; no RULE_STORE action produces nous.self_model_revised event |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| NormDetector.ts | candidate.dids (Map<string,number>) | AuditChain onAppend listener | Only if nous.self_model_revised events are emitted | ✗ HOLLOW — wired correctly to audit chain, but the upstream emitter for nous.self_model_revised does not exist in production code |
| GET /api/v1/grid/norms | rows from norm_registry | NormStorage.loadNorms → MySQL SELECT | Yes, reads norm_registry table | ✓ FLOWING (will return empty rows until NormDetector crystallizes norms) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All norms tests pass | cd grid && npx vitest run test/norms/ | 8 test files, 68 tests, 68 passed, 0 failed | ✓ PASS |
| appendNormCandidate enforces actorDid='did:noesis:grid' | test/norms/appendNormCandidate.test.ts — 18 tests | All passing | ✓ PASS |
| appendNormCrystallized enforces actorDid='did:noesis:grid' | test/norms/appendNormCrystallized.test.ts — 14 tests | All passing | ✓ PASS |
| rebuildFromChain emits nothing | test/norms/norm-startup-rebuild.test.ts — 2 tests | chain.all().length unchanged after rebuild | ✓ PASS |
| Sole-producer boundary enforced | test/norms/norm-producer-boundary.test.ts — 4 tests | grep gate: norm.candidate only in appendNormCandidate.ts+allowlist | ✓ PASS |
| GET /api/v1/grid/norms returns {norms:[...]} | test/norms/norms-api.test.ts — 5 tests | 200 + correct shape; evidence_tick_range=[first_seen, crystallized] | ✓ PASS |
| compute_norm_fingerprint wired in brain | grep -rn "compute_norm_fingerprint" brain/src/ --include="*.py" | Only definition found; no call sites | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| NORM-01 | 19-01, 19-03 | NormDetector observes nous.self_model_revised; N≥3 distinct Nous fingerprint → norm.candidate | ✓ SATISFIED | NormDetector.ts + appendNormCandidate.ts; 11 detector tests pass; sole-producer boundary test passes |
| NORM-02 | 19-03 | convergence_type classified using RelationshipListener.getEdge() weight>0; O(1) lookup | ✓ SATISFIED | NormDetector.ts:134-146; classifyConvergence uses getEdge (O(1) Map.get); reviewed in 19-REVIEW.md invariant 2 |
| NORM-03 | 19-03, 19-04 | norm.crystallized after K=20 adoption ticks; queryable via GET /api/v1/grid/norms | ✓ SATISFIED | NormDetector.ts:74-87; server.ts:356-373; 5 API tests pass |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| brain/src/noesis_brain/learning/rules.py | 32 | compute_norm_fingerprint() defined but never called in production | ⚠️ Warning | NormDetector can never observe real fingerprints; end-to-end norm detection pipeline is incomplete |

### Human Verification Required

None required — all testable behaviors verified programmatically.

### Gaps Summary

**1 gap blocks full goal achievement:**

The NormDetector infrastructure is complete and correct on the Grid side. All 68 norms tests pass. The allowlist is at 41. The sole-producer pattern, pure-observer invariant, startup rebuild, convergence classification, and REST API are all correctly implemented and tested.

However, the end-to-end pipeline is broken at the Brain-Grid boundary: `compute_norm_fingerprint()` was added to `rules.py` but was never wired into `RuleStore.add()`, and there is no active emitter for `nous.self_model_revised` anywhere in the codebase. The NormDetector waits for events that will never arrive in a running system.

**Root cause:** Plan 01 explicitly deferred the Brain-side emitter wiring ("ready to be called from the `nous.self_model_revised` emitter when it lands in a later plan"), but none of Plans 02-05 delivered the emitter. The CONTEXT.md and RESEARCH.md both identify this wiring as required for Phase 19.

**What needs to be added:**

1. Wire `compute_norm_fingerprint(content)` inside `RuleStore.add()` so that each rule addition produces a 6-char hex fingerprint.
2. Create a sole-producer emitter `appendNousSelfModelRevised.ts` in `grid/src/reflexion/` (or wherever the sole-producer lives) that calls `audit.append('nous.self_model_revised', actorDid, {nous_did, tick, revision_hash})`.
3. Wire the emitter into the NousRunner RULE_STORE action dispatch path so Brain RULE_STORE actions produce the `nous.self_model_revised` audit event with the `revision_hash` computed by `compute_norm_fingerprint`.

---

_Verified: 2026-05-16T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
