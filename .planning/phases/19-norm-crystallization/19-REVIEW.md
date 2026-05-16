---
phase: 19-norm-crystallization
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - grid/src/norms/types.ts
  - grid/src/norms/NormDetector.ts
  - grid/src/norms/appendNormCandidate.ts
  - grid/src/norms/appendNormCrystallized.ts
  - grid/src/norms/storage.ts
  - grid/src/norms/index.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/genesis/types.ts
  - grid/src/genesis/launcher.ts
  - grid/src/api/server.ts
  - grid/src/db/schema.ts
  - brain/src/noesis_brain/learning/rules.py
  - grid/test/norms/zero-diff.test.ts
  - grid/test/norms/norm-producer-boundary.test.ts
  - grid/test/norms/norm-migration.test.ts
  - grid/test/norms/appendNormCandidate.test.ts
  - grid/test/norms/appendNormCrystallized.test.ts
  - grid/test/norms/norm-detector.test.ts
  - grid/test/norms/norms-api.test.ts
  - grid/test/norms/norm-startup-rebuild.test.ts
  - brain/test/learning/test_rules.py
  - grid/test/norms/cryst-debug.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 22 (18 source + 4 test extras)
**Status:** issues_found (no HIGH invariant violations; 2 MEDIUM, 3 LOW)

## Summary

Phase 19 implements norm crystallization: a pure-observer `NormDetector` that watches `nous.self_model_revised` events across the audit chain and, when N distinct Nous DIDs converge on the same 6-char fingerprint within a sliding window, fires `norm.candidate` and eventually `norm.crystallized` events via strictly-enforced sole-producer emitters.

**All 8 critical invariants PASS:**

1. **Pure-observer**: `NormDetector.ts` has zero `audit.append` / `chain.append` calls. Confirmed by grep and by the structure of the class.
2. **rebuildFromChain/applyEntry split**: `rebuildFromChain` calls `applyEntry` (private, no emitters). `handleEntry` (which calls emitters) is only wired to the live `onAppend` callback.
3. **actorDid system gate**: Both emitter files enforce `actorDid === 'did:noesis:grid'` at step 2 and throw `TypeError` on violation.
4. **Sole-producer boundary**: `norm.candidate` appears in exactly two source files (`appendNormCandidate.ts`, `broadcast-allowlist.ts`). `norm.crystallized` appears in exactly two source files (`appendNormCrystallized.ts`, `broadcast-allowlist.ts`). No other file calls `audit.append` with either event name.
5. **FORBIDDEN_KEY_PATTERN**: `norm_text|fingerprint_text|rule_content` are present in `NORM_FORBIDDEN_KEYS` and appended to `FORBIDDEN_KEY_PATTERN` at line 382.
6. **Single-Nous inflation prevention**: `CandidateEntry.dids` is a `Map<string, number>` (DID → latestTick). `Map.set` is idempotent for repeated DID keys, so a single Nous contributing the same fingerprint N times counts as 1. `candidate.dids.size` gives unique-DID count. Functionally equivalent to `Set<string>` with the additional benefit of enabling tick-based window eviction.
7. **Candidate-not-exposed**: `NormStorage.loadNorms` queries `norm_registry` only (`SELECT * FROM norm_registry WHERE grid_name = ?`). The `norm_candidates` table is never read by the API path.
8. **Startup self-eviction fix**: In `handleEntry`, `candidate.dids.set(nousDid, tick)` executes BEFORE `evictStale(tick)`. Since `evictStale` evicts DIDs whose `lastTick < cutoff = tick - windowTicks`, and the contributing DID's tick is now `tick`, it cannot self-evict. Correct.

REVIEW PASSED on all critical invariants. The findings below are code quality issues only.

---

## Warnings

### WR-01: `upsertCandidate` and `deleteCandidate` are dead code — never called in production

**File:** `grid/src/norms/storage.ts:21-57`
**Issue:** `NormStorage.upsertCandidate` and `NormStorage.deleteCandidate` are fully implemented and tested-against in the schema migration, but are never called from any production code path. The `launcher.ts` wires only `insertRegistry` (for crystallized events). The `norm_candidates` table is created by migration version 7 but never written to at runtime. This means the table accumulates no data, which could confuse operators running `SELECT * FROM norm_candidates` expecting to see in-flight candidates.

**Fix:** Either wire the candidate upsert/delete calls from `NormDetector.handleEntry` (via the storage onAppend path already established in `launcher.ts`), or remove the methods and mark the table as reserved-for-future-use with a comment in the schema. If the intent is to defer candidate persistence, document it explicitly in the migration comment and in `storage.ts`.

---

### WR-02: `insertRegistry` receives `entry.eventHash` as both `normId` and `eventHash` arguments

**File:** `grid/src/genesis/launcher.ts:369-378`
**Issue:** The call `storage.insertRegistry(entry.eventHash, ..., entry.eventHash, ...)` passes the same SHA-256 hash for both the `normId` and `eventHash` parameters. The `norm_registry` schema stores both columns separately (`norm_id VARCHAR(64)`, `event_hash VARCHAR(64)`), making them redundant. This is confusing to future maintainers who may wonder why the primary key and the `event_hash` column always hold the same value. If `norm_id` is ever intended to be something other than the event hash (e.g., a UUID, or a content-addressed ID derived from the fingerprint), the current wiring silently makes that impossible.

**Fix:** If `norm_id` is intentionally defined as the crystallization event hash, add a comment at the call site and in the schema explaining this invariant. If `norm_id` is meant to be independent (e.g., a stable fingerprint-based ID across multiple crystallizations of the same norm), use a different value — for instance, the fingerprint itself or a UUID. Currently the schema `PRIMARY KEY (norm_id)` means the same fingerprint can only crystallize once (if norm_id = event_hash, a second crystallization of the same fingerprint would have a different event_hash and succeed; this is fine, but the column naming is confusing).

---

## Info

### IN-01: `cryst-debug.test.ts` is a debug artifact not cleaned up

**File:** `grid/test/norms/cryst-debug.test.ts:1-33`
**Issue:** This file is a debug scaffold left in the test directory. It has three issues:
- `appendSMR` function parameters (`chain`, `nousDid`, `fingerprint`, `tick`) are untyped (implicit `any`)
- The test imports `expect` and `describe` but never uses them (no assertions in the test body)
- The test body uses `console.log` for debugging output instead of `expect` assertions

It will run as part of the test suite and produce noisy console output, but will always pass (no assertions to fail).

**Fix:** Delete the file or replace with a proper test with assertions.

---

### IN-02: `appendNormCandidate.ts` does not export a `NORM_CANDIDATE_EVENT` constant

**File:** `grid/src/norms/appendNormCandidate.ts`
**Issue:** `appendNormCrystallized.ts` exports `NORM_CRYSTALLIZED_EVENT = 'norm.crystallized' as const`, which is used in `launcher.ts` to avoid a raw string literal. `appendNormCandidate.ts` exports no equivalent constant. While this causes no current bug (the `norm.candidate` event is not currently referenced by string literal outside its sole-producer file), the asymmetry is a future hazard: if a new consumer needs to reference `'norm.candidate'` by string, they will have no typed constant to import and may introduce a string literal.

**Fix:** Add `export const NORM_CANDIDATE_EVENT = 'norm.candidate' as const;` to `appendNormCandidate.ts` and re-export it from `grid/src/norms/index.ts`.

---

### IN-03: `ALLOWLIST_MEMBERS` doc comment says "exactly these 39 event types" but now has 41

**File:** `grid/src/audit/broadcast-allowlist.ts:24`
**Issue:** The top-of-file JSDoc says "Locked allowlist ... exactly these 39 event types" but Phase 19 adds 2 more (positions 40-41), making it 41. The inline comment at line 164 (`// Assert: ALLOWLIST_MEMBERS.length === 39 before these two lines`) is technically correct (39 before Phase 19's additions), but the outer description ("exactly these 39 event types") is stale and will mislead future maintainers counting events.

**Fix:** Update the opening sentence from "exactly these 39 event types" to "exactly these 41 event types" and note `(v1 → Phase 18 = 39; Phase 19 = +2)` in the version line.

---

_Reviewed: 2026-05-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
