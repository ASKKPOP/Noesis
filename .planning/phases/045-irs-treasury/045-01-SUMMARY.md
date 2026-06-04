---
phase: 045-irs-treasury
plan: 01
status: complete
completed: 2026-06-03
---

# Phase 45 — Plan 01 Summary (Wave 0 RED Gates)

## Outcome

Wave 0 RED gates established. 1 test file modified + 2 new RED skeleton test files created. **Zero production code modified** (as specified).

## Task 1 — broadcast-allowlist.test.ts count gates 72 → 75

All count assertions updated to the new locked count of 75:

- `expect(ALLOWLIST.size).toBe(72)` → `toBe(75)` — 2 sites (lines 12, 95)
- `expect(ALLOWLIST_MEMBERS.length).toBe(72)` → `toBe(75)` — 4 sites (lines 16, 225, 243, 258)
- **Total: 6 `.toBe(72)` sites updated; `grep -c "toBe(72)"` now returns 0.**
- Description strings updated: line 11 (`72 locked … +Phase 44` → `75 locked … +Phase 44+Phase 45`), line 15 (`72-member` → `75-member`).
- Two stale Phase 42/43 test names ("has count 72 after Phase 44") corrected to "count 75 after Phase 45" to keep names consistent with their now-75 assertions (own-change cleanup).
- New `describe('ALLOWLIST_MEMBERS Phase 45 (IRS-04)')` block appended at EOF with 5 it-blocks: count-grows-to-75, positions 73/74/75 (indices 72/73/74), and ordering-after-market.disputed.

## Task 2 — new RED skeleton test files

| File | Lines | RED reason |
|------|-------|------------|
| `grid/test/append-irs-disbursement-authorized.test.ts` | 123 | `Cannot find module ../src/audit/append-irs-disbursement-authorized.js` (Plan 02 creates producer) |
| `grid/test/irs-routes.test.ts` | 140 | `Cannot find module ../src/api/routes/irs.js` (Plan 03 creates routes) |

- `append-irs-disbursement-authorized.test.ts`: 10 it-blocks covering 9-step guard discipline (type guard, HEX64 ×2, non-empty grid_name, positive-int amount_bios, non-negative tick boundary, closed-tuple extra/missing key, alphabetical reconstruction, actorDid).
- `irs-routes.test.ts`: 3 describe blocks (treasury GET, disburse POST, audit GET) — 7 it-blocks total.

## RED State Confirmed (all exit NON-ZERO)

| Test file | vitest exit | Failure signature |
|-----------|-------------|-------------------|
| broadcast-allowlist.test.ts | 1 | `expected 72 to be 75` (count + position + ordering gates) |
| append-irs-disbursement-authorized.test.ts | 1 | Cannot find module (producer absent) |
| irs-routes.test.ts | 1 | Cannot find module (routes absent) |

## Dynamic-import workarounds (Vitest 2.x non-existent-module)

- `append-irs-disbursement-authorized.test.ts`: 1 `await import(...)` in `beforeAll`.
- `irs-routes.test.ts`: 2 `await import(...)` in `beforeAll` (routes module + chain module).

## Deviations from spec

- None functional. The plan's "4 existing `.toBe(72)` sites" was actually **6** in the current file (2× `ALLOWLIST.size`, 4× `ALLOWLIST_MEMBERS.length`); all 6 were updated to satisfy the `grep -c "toBe(72)" == 0` acceptance criterion.
- Additionally corrected two stale Phase 42/43 `it(...)` test **names** that still said "count 72" so they would not contradict their updated `.toBe(75)` assertions (not required by acceptance criteria; surgical own-change cleanup).

## Carry-forward flag for Plan 02

VALIDATION.md (row 45-02-03) and the Plan 02 objective assume `grid/test/append-irs-disbursement-executed.test.ts` already exists ("Phase 41 created", marked ✅). **It does not exist on disk.** Plan 02 task 45-02-03 ("`irs.disbursement_executed` promoted") must be checked against this — the test file may need to be created rather than just turned green.
