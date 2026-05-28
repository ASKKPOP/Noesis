# Phase 43 Plan 01 — Deferred Items

## Pre-existing test failures (out of scope for Plan 01)

These test files were already failing before Phase 43 began (confirmed by checking
commit 55c2aa0 — the pre-Phase-43 state). They assert historical allowlist snapshot
counts (56, 45, 43) that Phase 42 had already invalidated.

Not caused by Plan 01 changes. Deferred to a cleanup phase.

| File | Assertion | Status |
|------|-----------|--------|
| `grid/test/audit/skill-allowlist.test.ts` | `.toBe(56)` (allowlist now 68) | pre-existing |
| `grid/test/audit/allowlist-forty-five.test.ts` | `.toBe(56)` | pre-existing |
| `grid/test/audit/allowlist-twenty-six.test.ts` | `.toBe(56)` | pre-existing |
| `grid/test/audit/allowlist-twenty-two.test.ts` | `.toBe(56)` | pre-existing |
| `grid/test/audit/append-human-spoke.test.ts` | `.toBe(56)` | pre-existing |
| `grid/test/audit/firehose-hub.test.ts` | position assertion on index 1 | pre-existing |
| `grid/test/audit/operator-exported-allowlist.test.ts` | `.toBe(56)` | pre-existing |
