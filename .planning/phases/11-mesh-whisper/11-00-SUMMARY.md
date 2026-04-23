---
phase: 11
plan: "00"
plan_slug: 00-setup
subsystem: whisper
tags: [allowlist, types, RED-stubs, CI-gates, doc-sync]
dependency_graph:
  requires: [Phase 10b shipped, bios.birth/bios.death at positions 20-21]
  provides: [allowlist-22, nous.whispered-allowlisted, WHISPERED_KEYS-tuple, whisper-type-trio, four-RED-stubs, wall-clock-gate-extended, doc-sync-22-events]
  affects: [grid/src/audit/broadcast-allowlist.ts, grid/src/whisper/, dashboard/src/lib/protocol/whisper-types.ts, brain/src/noesis_brain/whisper/, scripts/check-wallclock-forbidden.mjs, scripts/check-state-doc-sync.mjs, .planning/STATE.md, .planning/ROADMAP.md, PHILOSOPHY.md]
tech_stack:
  added: []
  patterns: [closed-tuple-payload, sole-producer-boundary, SYNC-header-mirror, TDD-RED-stub, wall-clock-ban-extension, atomic-doc-sync]
key_files:
  created:
    - grid/src/whisper/types.ts
    - grid/src/whisper/config.ts
    - dashboard/src/lib/protocol/whisper-types.ts
    - brain/src/noesis_brain/whisper/types.py
    - brain/src/noesis_brain/whisper/__init__.py
    - grid/test/whisper/whisper-producer-boundary.test.ts
    - grid/test/whisper/whisper-crypto.test.ts
    - grid/test/whisper/whisper-wire-format.test.ts
    - grid/test/whisper/whisper-rate-limit.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/test/audit/broadcast-allowlist.test.ts
    - scripts/check-wallclock-forbidden.mjs
    - scripts/check-state-doc-sync.mjs
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - PHILOSOPHY.md
decisions:
  - "WHISPER_FORBIDDEN_KEYS (13 keys) exported but only 8 added to global FORBIDDEN_KEY_PATTERN — trade-compatible keys (offer/amount/ousia/price/value) excluded to preserve existing trade payload tests"
  - "whisper/types.ts added to KNOWN_CONSUMERS_WHISPERED because it references 'nous.whispered' in its SYNC docblock (legitimate type documentation, not emission)"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-23"
  tasks_completed: 5
  tasks_total: 5
  files_created: 9
  files_modified: 8
---

# Phase 11 Plan 00: Setup Summary

## One-liner

Phase 11 Wave 0 foundation: allowlist 21→22 with `nous.whispered` at index 21; closed 4-tuple type trio across Grid/Dashboard/Brain; four RED test stubs for Wave 1/2 activation; wall-clock and doc-sync CI gates extended to whisper trees.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 11-W0-01 | Bump allowlist 21→22 + WHISPER_FORBIDDEN_KEYS | 8eb3919 | GREEN |
| 11-W0-02 | Ship closed-tuple type trio + grid config | ae78acb | GREEN |
| 11-W0-03 | Land four RED stubs in grid/test/whisper/ | 6bf5533 | RED (intended) |
| 11-W0-04 | Extend wall-clock-forbidden gate to whisper trees | 2ca562d | GREEN |
| 11-W0-05 | Atomic doc-sync (STATE + ROADMAP + PHILOSOPHY + check-state-doc-sync.mjs) | 0f5f3e5 | GREEN |

## Task Outcomes

### Task 11-W0-01: Allowlist bump

- `ALLOWLIST_MEMBERS` length: 21 → 22
- `ALLOWLIST_MEMBERS[21]` === `'nous.whispered'`
- Indices 0..20 byte-identical (no reordering)
- `WHISPER_FORBIDDEN_KEYS` exported (13 keys, `Object.freeze`)
- `FORBIDDEN_KEY_PATTERN` extended with 8 whisper-only keys
- `broadcast-allowlist.test.ts`: 49/49 tests pass at length 22

### Task 11-W0-02: Type trio

- `grid/src/whisper/types.ts`: `NousWhisperedPayload` (4 readonly keys alphabetical) + `WHISPERED_KEYS` + `Envelope` (8 keys including opaque base64 fields)
- `grid/src/whisper/config.ts`: `WHISPER_CONFIG = Object.freeze({rateBudget:10, rateWindowTicks:100, envelopeVersion:1})` with env override; negative/NaN rejected with `console.warn`
- `dashboard/src/lib/protocol/whisper-types.ts`: fourth protocol mirror with TWO SYNC-pointer comments (grid + brain); PRIVACY header per WHISPER-02
- `brain/src/noesis_brain/whisper/types.py`: `@dataclass(frozen=True) NousWhisperedPayload` + `WHISPERED_KEYS` tuple
- `brain/src/noesis_brain/whisper/__init__.py`: package re-exports types only (Wave 0 scope)
- All three typecheckers pass; Python assertion passes; no wall-clock literals

### Task 11-W0-03: RED test stubs

Four files in `grid/test/whisper/` — all RED for module-resolution reasons as intended:

| File | RED reason | Turns GREEN |
|------|-----------|-------------|
| `whisper-producer-boundary.test.ts` | `appendNousWhispered.ts` missing; literal grep mismatch | Wave 2 |
| `whisper-crypto.test.ts` | `grid/src/whisper/crypto.ts` missing | Wave 1 |
| `whisper-wire-format.test.ts` | `grid/src/whisper/appendNousWhispered.ts` missing | Wave 2 |
| `whisper-rate-limit.test.ts` | `grid/src/whisper/rate-limit.ts` missing | Wave 2 |

Test summary: 13 failed / 13 passed (26 total). Failures are import/module-resolution errors as required.

### Task 11-W0-04: Wall-clock gate extension

- `TIER_A_ROOTS` extended with `'brain/src/noesis_brain/whisper'`
- `TIER_B_TS_ROOTS` extended with `'grid/src/whisper'`
- Dashboard whisper tree excluded (render-only counts)
- `node scripts/check-wallclock-forbidden.mjs` exits 0

### Task 11-W0-05: Atomic doc-sync

- `scripts/check-state-doc-sync.mjs`: literal 21→22 events; `nous.whispered` in `required` array
- `.planning/STATE.md`: allowlist block heading → Phase 11; 22 events enumerated; entry #22 with D-11-01 reference; hash-only-whisper-boundary invariant added; Session Continuity updated
- `.planning/ROADMAP.md`: Phase 11 bullet annotated with allowlist 21→22 Wave 0 shipped
- `PHILOSOPHY.md`: 22-event broadcast allowlist block with full enumeration + whisper hash-only sentence (WHISPER-02/03 / D-11-04)
- `node scripts/check-state-doc-sync.mjs` exits 0

## Verification Results

```
grid/test/audit/broadcast-allowlist.test.ts — 49/49 GREEN (length 22, index-21=nous.whispered)
grid/test/whisper/ — 4 files, 13 failed / 13 passed (RED as intended)
grid tsc --noEmit — GREEN
dashboard tsc --noEmit — GREEN
brain python assertion — WHISPERED_KEYS == ('ciphertext_hash','from_did','tick','to_did') OK
node scripts/check-state-doc-sync.mjs — OK (22-event allowlist)
node scripts/check-wallclock-forbidden.mjs — OK (whisper roots added)
grep nous.whispered grid/src/audit/broadcast-allowlist.ts — 2 hits (comment + member)
grep "22 events" scripts/check-state-doc-sync.mjs — 2 hits
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FORBIDDEN_KEY_PATTERN exclusion of trade-compatible keys**
- **Found during:** Task 11-W0-01
- **Issue:** Plan specified all 13 `WHISPER_FORBIDDEN_KEYS` be added to `FORBIDDEN_KEY_PATTERN`. Adding `amount`, `ousia`, `price`, `value`, `offer` caused 2 existing tests to fail: `passes benign numeric/currency payload` (`{amount: 10, currency: 'ousia'}` → ok: false) and `passes null-valued allowed key` (`{amount: null}` → ok: false). These test legitimate trade payloads that carry `amount`.
- **Fix:** Only added the 8 whisper-exclusive keys to `FORBIDDEN_KEY_PATTERN` (`text|body|content|message|utterance|plaintext|decrypted|payload_plain`). `WHISPER_FORBIDDEN_KEYS` const still exports all 13 keys for use at the whisper emitter boundary. Document in source comment.
- **Files modified:** `grid/src/audit/broadcast-allowlist.ts`
- **Commit:** 8eb3919

**2. [Rule 2 - Missing critical functionality] KNOWN_CONSUMERS_WHISPERED needed whisper/types.ts**
- **Found during:** Task 11-W0-03
- **Issue:** `whisper/types.ts` references `'nous.whispered'` in its SYNC docblock. The producer-boundary grep test was finding it as a hit and expecting `appendNousWhispered.ts` instead.
- **Fix:** Added `'whisper/types.ts'` to `KNOWN_CONSUMERS_WHISPERED` with an explanatory comment about docblock references vs. emission.
- **Files modified:** `grid/test/whisper/whisper-producer-boundary.test.ts`
- **Commit:** 6bf5533

## Known Stubs

The four RED test stubs are intentional — they are designed to become GREEN when Wave 1/2 ships the missing modules. No stubs exist that prevent the plan's goal (allowlist bump + type foundation + CI gates) from being achieved.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced in Wave 0. All files are type definitions, config constants, CI scripts, and planning docs. No new threat surface.

Wave 0 ships zero runtime behavior change — only types, constants, tests (RED), and CI gate extensions. T-11-W0-01 through T-11-W0-04 mitigations are structural (allowlist enforcement, SYNC pointers, wall-clock ban, doc-sync gate).

## STATE.md Diff Summary (for Wave 1 reference)

Key STATE.md changes in this plan:
- Allowlist block: `Phase 10b` → `Phase 11`; `21 events` → `22 events`; entry 22 = `nous.whispered` at D-11-01
- New invariant: hash-only whisper boundary (Brain-local plaintext, Grid sees only ciphertext_hash, keyring Brain-side only, wall-clock ban on whisper trees)
- Session Continuity: Wave 0 shipped; next = Wave 1 crypto core

## Self-Check: PASSED

All 12 files verified present. All 5 commits verified in git log.

| Check | Result |
|-------|--------|
| grid/src/audit/broadcast-allowlist.ts | FOUND |
| grid/src/whisper/types.ts | FOUND |
| grid/src/whisper/config.ts | FOUND |
| dashboard/src/lib/protocol/whisper-types.ts | FOUND |
| brain/src/noesis_brain/whisper/types.py | FOUND |
| brain/src/noesis_brain/whisper/__init__.py | FOUND |
| grid/test/whisper/whisper-producer-boundary.test.ts | FOUND |
| grid/test/whisper/whisper-crypto.test.ts | FOUND |
| grid/test/whisper/whisper-wire-format.test.ts | FOUND |
| grid/test/whisper/whisper-rate-limit.test.ts | FOUND |
| scripts/check-state-doc-sync.mjs | FOUND |
| scripts/check-wallclock-forbidden.mjs | FOUND |
| Commit 8eb3919 | FOUND |
| Commit ae78acb | FOUND |
| Commit 6bf5533 | FOUND |
| Commit 2ca562d | FOUND |
| Commit 0f5f3e5 | FOUND |
