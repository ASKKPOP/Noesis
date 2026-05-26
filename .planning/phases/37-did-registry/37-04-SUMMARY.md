---
phase: 37-did-registry
plan: "04"
subsystem: ci-gates
tags: [ci, constitutional, d-v3-33, portal-gating, registry, sole-producer, tdd]
dependency_graph:
  requires:
    - "37-02 (append-registry-* producers)"
    - "37-03 (registry.ts sole production importer)"
  provides:
    - scripts/check-civic-did-issuance-path.mjs (D-V3-33 constitutional CI gate)
    - OBS-37-01 (GitHub Actions workflow step)
  affects:
    - .github/workflows/rig-invariants.yml
    - scripts/ (6th Phase 37-era CI gate)
tech_stack:
  added: []
  patterns:
    - Node.js ESM file-walker (clone of check-sole-producer-discipline.mjs)
    - Per-line comment stripping to avoid false-positives from doc comments
    - APPROVED_IMPORTERS set + PRODUCER_FILES set for two-tier exclusion
key_files:
  created:
    - scripts/check-civic-did-issuance-path.mjs
    - grid/test/scripts/check-civic-did-issuance-path.test.ts
  modified:
    - .github/workflows/rig-invariants.yml
decisions:
  - "Per-line comment stripping added to scanFile() — broadcast-allowlist.ts has Phase 37 doc comments that textually mention all 4 append-registry-* module paths. A bare text.includes() check would falsely flag it. The fix: skip lines whose first non-whitespace is //, *, or /*. Ensures the gate only flags real import statements."
  - "APPROVED_IMPORTERS includes 3 entries (registry.ts + 2 forward-compat civic-registry store paths per plan spec) — the 2 store paths are not yet real importers but are enumerated for Phase 37b forward-compatibility."
  - "Test uses process.cwd() + '..' for REPO_ROOT (consistent with existing test/rig/*.test.ts pattern) — not __dirname — since vitest runs from grid/ directory."
metrics:
  duration: "5m"
  completed: "2026-05-26"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 37 Plan 04: D-V3-33 Constitutional CI Gate Summary

D-V3-33 Portal-gating invariant enforced at build time via `scripts/check-civic-did-issuance-path.mjs`. 6 CI gates now ride in `rig-invariants.yml` (Phases 33 + 36×4 + 37×1). REG-06 fully closed.

## What Was Built

### Task 1: CI Gate Script + Workflow Step

**`scripts/check-civic-did-issuance-path.mjs`** (executable, Node ESM)
- Walks `grid/src/` recursively, skipping `node_modules/`, `dist/`, `build/`, `.next/`
- Excludes `*.test.ts` and `*.d.ts` files (test files may import producers directly)
- FORBIDDEN_IMPORT_TOKENS: 4 tokens (`append-registry-civic-did-issued`, `append-registry-civic-did-revoked`, `append-registry-business-did-registered`, `append-registry-business-did-dissolved`)
- APPROVED_IMPORTERS: `grid/src/api/routes/registry.ts` + 2 forward-compat civic-registry store paths
- PRODUCER_FILES: 4 `grid/src/audit/append-registry-*.ts` paths (excluded from scanning)
- Per-line comment stripping (lines starting with `//`, `*`, `/*` are skipped) prevents false-positives from broadcast-allowlist.ts doc comments
- Exit 0 with scan summary + APPROVED_IMPORTERS + PRODUCER_FILES counts
- Exit 1 with violation list + D-V3-33 constitutional rationale + approved importer list + fix guidance
- 242 files scanned on current repo; exits 0

**`.github/workflows/rig-invariants.yml`** — added step:
```yaml
- name: OBS-37-01 civic-DID issuance path gate (Phase 37 D-V3-33)
  run: node scripts/check-civic-did-issuance-path.mjs
```
Inserted immediately after OBS-36-04 (line 49→51). YAML validated with `python3 yaml.safe_load`.

### Task 2: Vitest Test (4 cases)

**`grid/test/scripts/check-civic-did-issuance-path.test.ts`**
- **Case A:** Real repo exits 0 — registry.ts is sole production importer
- **Case B:** Non-test violator importing `appendRegistryCivicDidIssued` → exits 1 + VIOLATIONS FOUND + D-V3-33 in stderr
- **Case C:** Non-test violator importing `appendRegistryBusinessDidDissolved` → exits 1 + correct token in stderr
- **Case D:** `*.test.ts` violator → gate stays exit 0 (test files exempt)
- `afterEach` cleanup removes synthetic `__test_violator_civic_issuance__*` files
- All 4 tests pass

## Test Results

- `node scripts/check-civic-did-issuance-path.mjs` exits 0 on current repo
- `cd grid && npx vitest run test/scripts/check-civic-did-issuance-path.test.ts` → 4/4 pass
- All 6 Phase 37-era CI gates pass together (sole-producer + did-policy-coverage + admin-policy-isolation + ws-redaction-zero-diff + no-did-exception-count + **civic-did-issuance-path**)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 113bb3e | feat | D-V3-33 CI gate script + OBS-37-01 workflow step |
| b28a8f6 | test | Vitest gate test — pass + fail + test-file-exemption |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment references in broadcast-allowlist.ts would trigger bare text.includes() match**
- **Found during:** Task 1 verification (`node scripts/check-civic-did-issuance-path.mjs` against current repo)
- **Issue:** `broadcast-allowlist.ts` contains Phase 37 doc comments like `// Emitted ONLY via appendRegistryCivicDidIssued (grid/src/audit/append-registry-civic-did-issued.ts)`. A naive `text.includes('append-registry-civic-did-issued')` would flag this file as an unauthorized importer.
- **Plan assumption:** "Path tokens are specific enough that incidental textual matches are unlikely." — This turned out to be incorrect for `broadcast-allowlist.ts`.
- **Fix:** Added per-line comment stripping in `fileHasNonCommentToken()` — lines starting with `//`, `*`, or `/*` are excluded from token search. Only real import statement lines are checked.
- **Files modified:** `scripts/check-civic-did-issuance-path.mjs`
- **Impact:** Gate exits 0 correctly; no constitutional scope creep; APPROVED_IMPORTERS list remains exactly as specified in the plan.

## Phase 37 CI Gate Inventory

After Plan 04, `rig-invariants.yml` runs 6 named steps:

| Step | Gate | Enforces |
|------|------|---------|
| Phase 31 | check-rig-invariants.mjs | T-10-12 / T-10-13 |
| Phase 31 | check-no-silent-catch.mjs | OBS-03 |
| Phase 32 | check-observability-no-todo.mjs | OBS-R-32-01 |
| Phase 32 | check-interval-lifecycle.mjs | OBS-R-32-02 |
| Phase 33 | check-sole-producer-discipline.mjs | OBS-09 D-33-D1 |
| Phase 36 | check-did-policy-coverage.mjs | OBS-36-01 VIS-04 |
| Phase 36 | check-admin-policy-isolation.mjs | OBS-36-02 D-36-10 |
| Phase 36 | check-ws-redaction-zero-diff.mjs | OBS-36-03 R-31-01 |
| Phase 36 | check-no-did-exception-count.mjs | OBS-36-04 D-V3-15 |
| **Phase 37** | **check-civic-did-issuance-path.mjs** | **OBS-37-01 D-V3-33** |

## REG-06 Closed

REG-06 is fully addressed across Plans 02 and 04:
- Plan 02: 4 sole-producer files + allowlist 60→64 + triad CI gate covers them (check-sole-producer-discipline)
- Plan 04: importer set gated — only approved registry service files may call the producers (check-civic-did-issuance-path)

## Known Stubs

None. All functionality is implemented and operational.

## Threat Flags

None new beyond what was declared in the plan's threat model. T-37-21 (elevation of privilege via direct append-registry-* import) is mitigated by this plan.

## Self-Check: PASSED

Files verified to exist:
- `scripts/check-civic-did-issuance-path.mjs` — FOUND (executable, 151 lines)
- `grid/test/scripts/check-civic-did-issuance-path.test.ts` — FOUND (4 test cases)
- `.github/workflows/rig-invariants.yml` (OBS-37-01 step) — FOUND

Commits verified:
- `113bb3e` — FOUND
- `b28a8f6` — FOUND

Gate verification: `node scripts/check-civic-did-issuance-path.mjs` → exits 0, scans 242 files
