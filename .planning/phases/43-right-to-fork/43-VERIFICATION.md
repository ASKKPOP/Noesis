---
phase: 43-right-to-fork
verified: 2026-05-28T03:09:16Z
status: passed
score: 8/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "ROADMAP Allowlist Growth Ledger row for Phase 43 still shows 0 / 67 (not updated to +1 / 68)"
    status: failed
    reason: "The Allowlist Growth Ledger table in ROADMAP.md still reads '| 43 | *(none — fork uses existing operator.* family)* | 0 | 67 |'. The Phase 43 detailed section correctly says +1/68 and the code ships 68 entries. The ledger row was not updated during the 5-file atomic sync."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Ledger row | 43 | still shows 0 | 67 — should read | 43 | operator.nous_forked | +1 | 68 |; downstream rows (44-50) now under-count by 1"
    missing:
      - "Update ROADMAP.md Allowlist Growth Ledger row 43 to: | 43 | `operator.nous_forked` | +1 | 68 |"
      - "Bump downstream ledger running totals: Phase 44 71→72, 45 74→75, 46 80→81, 47 84→85, 48 86→87, 49 90→91, 50 90→91"
      - "Update 'Total v3.0 allowlist growth' footer from '+34 (56 → 90)' to '+35 (56 → 91)'"
  - truth: "REQUIREMENTS.md traceability table updated to reflect Phase 43 completion (FORK-01..04 Validated)"
    status: failed
    reason: "REQUIREMENTS.md Traceability section still shows FORK-01 through FORK-04 as 'Pending'. All four plans are marked complete in ROADMAP. The traceability table was not updated post-phase."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "FORK-01, FORK-02, FORK-03, FORK-04 traceability rows all still read 'Pending'; Phase 43 shipped."
    missing:
      - "Update REQUIREMENTS.md traceability rows for FORK-01..04 from 'Pending' to 'Complete'"
  - truth: "SC4 (FORK-04): Fork operation recorded in BOTH Grid audit chain AND the exported package; public verification endpoint POST /api/v1/operator/fork/verify exists"
    status: failed
    reason: "SC4 requires the operator.nous_forked audit event to appear in BOTH the Grid chain AND the exported package, plus a public /fork/verify endpoint. The D-30 order discipline (archive build precedes audit append) means the fork event itself is NOT in the package's chain-export.jsonl. Additionally, POST /api/v1/operator/fork/verify is not implemented anywhere in grid/src/. The package_hash is recorded in the Grid audit event, and the chain-export.jsonl contains all prior events — cross-reference is possible but the fork event is absent from the package."
    artifacts:
      - path: "grid/src/api/operator/fork-nous.ts"
        issue: "Order: archive build → audit append → token. The fork audit event is appended after the archive is packed; it cannot appear in chain-export.jsonl inside the same package."
      - path: "grid/src/api/"
        issue: "POST /api/v1/operator/fork/verify does not exist. No route in grid/src/api/ implements the public verification endpoint described in ROADMAP SC4."
    missing:
      - "Implement POST /api/v1/operator/fork/verify endpoint returning {found: bool, forked_at_tick: N, civic_did: <did>}"
      - "OR: document the SC4 deviation formally (REQUIREMENTS says 'Public verification of fork history possible' — the chain audit covers history, but the specific endpoint is missing)"

human_verification:
  - test: "Verify SC2 — Standalone Brain Steward Console memory inspector"
    expected: "After running 'python -m noesis_brain standalone --import <pkg.tar.gz>', opening Steward Console at the standalone Brain's local address renders the same memory inspector views (Karpathy/Hypnos/Pneuma) as before the fork. Memory contents from pre-fork state are visible."
    why_human: "Requires running a full Brain process + Steward Console. The standalone factory wires BRAIN_DATA_DIR to the imported memory/ directory and constructs BrainApp without Grid wire — whether the memory inspector HTTP endpoint and Steward Console UI actually render the imported memory requires a live integration test."
  - test: "Verify SC3 — civic_features_unavailable_in_standalone error shape"
    expected: "ROADMAP SC3 specifies the error code 'civic_features_unavailable_in_standalone'. Implementation returns 'grid_unavailable'. Confirm whether the operator-facing error code deviation (from ROADMAP SC3) is intentional and acceptable, OR whether CIVIC_ACTION_PATHS needs populating."
    why_human: "CIVIC_ACTION_PATHS is currently empty (set()) — the civic-action gate is wired but never fires for any path. Brain HTTP today has NO civic-action endpoints. The gate is forward-compatible infrastructure but SC3's stated behavior cannot be exercised yet. Whether this is acceptable given forward-compat wiring requires product judgment."
  - test: "Verify SC1 — archive file structure matches ROADMAP exact specification"
    expected: "ROADMAP SC1 specifies: brain/memory/karpathy.json, brain/memory/hypnos.sqlite, brain/memory/pneuma.json, civic/civic-did.jws, civic/business-did.jws, civic/audit-history.jsonl, civic/community-memberships.json, civic/treasury-balance.json. Implementation ships: memory/*.db, credentials/civic-did.vc.json, audit/chain-export.jsonl, audit/chain-tail-hash.txt, civic/memberships.json (stub), civic/treasury.json (stub). Confirm whether the structural deviation (path prefixes, format names, missing business-did) is acceptable for Phase 43 or needs documentation."
    why_human: "The implementation passes all Plan 02 tests (which used the implemented structure, not the ROADMAP structure). Whether the ROADMAP SC1 file names were aspirational vs contractual, and whether the deviation is acceptable, requires product decision."
---

# Phase 43: Right-to-Fork Export Tooling — Verification Report

**Phase Goal:** Constitutional enforcement of D-V3-18 — operator must be able to walk away with their Nous at any time. Export package is portable, human-readable JSON; standalone forked Nous retains full Brain cognition + memory + audit history but cannot participate in civic life until Civic-DID is re-registered.
**Verified:** 2026-05-28T03:09:16Z
**Status:** human_needed (3 gaps + 3 human items; 8/11 truths verified)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | operator.nous_forked sole-producer exists at position 68 in ALLOWLIST | VERIFIED | `grid/src/audit/broadcast-allowlist.ts` line 286: `'operator.nous_forked'` at index 67 (position 68); `grid/test/audit/broadcast-allowlist.test.ts` line 12: `expect(ALLOWLIST.size).toBe(68)` — passes |
| 2 | All Wave 0 test stubs from Plan 01 have been removed (.skip → implementations) | VERIFIED | grep for `it.skip` across fork-nous.test.ts, fork-archive-builder.test.ts, fork-manifest.test.ts, fork-irreversibility-dialog.test.tsx returns 0 matches |
| 3 | BRAIN_DATA_DIR env var threads through MemoryStore construction in __main__.py | VERIFIED | `brain/src/noesis_brain/__main__.py`: 6 occurrences of BRAIN_DATA_DIR, BRAIN_DATA_DIR_ENV + BRAIN_STANDALONE_ENV constants present, `:memory:` default preserved (4 occurrences) |
| 4 | POST /api/v1/operator/fork/:nousDid endpoint exists with H4+ auth + audit order discipline | VERIFIED | `grid/src/api/operator/fork-nous.ts` exists; imports appendOperatorNousForked, buildForkArchive, forkTokenStore; D-30 order: archive → audit → token → response; registered in server.ts line 703; policy.ts lines 256-257 set to 'public' |
| 5 | Deterministic .tar.gz archive builder exists with EPOCH mtime + portable + noPax | VERIFIED | `grid/src/export/fork-archive-builder.ts`: EPOCH=new Date(0), portable:true, noPax:true, sorted by localeCompare; exports buildForkArchive; imports createForkManifest |
| 6 | Brain standalone CLI (python -m noesis_brain standalone --import) is implemented | VERIFIED | `brain/src/noesis_brain/__main__.py` lines 613-636: argparse subcommand 'standalone' with --import; `_run_standalone` coroutine; main_entry() dispatches; default mode preserved |
| 7 | standalone/importer.py has path-traversal guard and manifest hash verification | VERIFIED | `brain/src/noesis_brain/standalone/importer.py`: `target.relative_to(data_dir_resolved)` check raises `ValueError("Path traversal detected...")`, hash mismatch raises `ValueError("export_hash mismatch...")`, symlink rejection present |
| 8 | standalone/factory.py unsets GRID_URL + CIVIC_DID and sets BRAIN_STANDALONE=1 | VERIFIED | `brain/src/noesis_brain/standalone/factory.py` lines 31-34: `os.environ["BRAIN_STANDALONE"] = "1"`, `os.environ.pop("GRID_URL")`, `os.environ.pop("CIVIC_DID")` |
| 9 | ForkIrreversibilityDialog with D-43-03 verbatim copy + paste/Enter discipline wired into /system/local-ai | VERIFIED | `steward/src/components/fork-irreversibility-dialog.tsx`: TITLE_COPY='Fork Nous from Grid', WARNING_COPY (verbatim), CONFIRM_LABEL='Fork forever', CANCEL_LABEL='Keep on Grid', onPaste preventDefault, capturedDidRef, autoFocus on cancel; `/system/local-ai/page.tsx` imports ForkIrreversibilityDialog, has operator/fork POST fetch + download_url trigger |
| 10 | ROADMAP.md Allowlist Growth Ledger row for Phase 43 updated (0/67 → +1/68) | FAILED | Ledger table still reads `| 43 | *(none — fork uses existing operator.* family)* | 0 | 67 |`. The Phase 43 detailed section correctly says "+1 / 68" but the ledger table row and downstream running totals (44-50) are stale |
| 11 | REQUIREMENTS.md FORK-01..04 traceability rows updated to Complete | FAILED | All four FORK rows still read "Pending" in the traceability table; Phase 43 is marked Complete in ROADMAP |

**Score:** 9/11 truths verified (2 failed docs gaps + 3 human-needed items in SC-level truths)

---

### Deferred Items

No items deferred to later phases. The SC4 fork/verify endpoint gap and SC3 civic gate gap are confirmed not addressed in any later milestone phase roadmap section.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/append-operator-nous-forked.ts` | Sole-producer for operator.nous_forked (9-step discipline) | VERIFIED | 6285 bytes; exports appendOperatorNousForked; 9-step guards: operatorId RE, payload type, FORK_REASONS enum, HEX64 regex, closed-tuple, reconstruction, payloadPrivacyCheck, audit.append |
| `grid/src/audit/broadcast-allowlist.ts` | operator.nous_forked at position 68 | VERIFIED | Position 68 confirmed (index 67); ALLOWLIST.size===68 test passes |
| `grid/test/audit/broadcast-allowlist.test.ts` | count=68 + positional assertion | VERIFIED | Lines 12+16: toBe(68); positional block for Phase 43 present |
| `grid/test/audit/append-operator-nous-forked.test.ts` | 9-step guard tests (10+) | VERIFIED | File exists; all .skip removed; produced from Plan 01 |
| `grid/test/audit/operator-nous-forked-producer-boundary.test.ts` | Sole-producer grep-walk test | VERIFIED | Describe label confirms FORK-04 / D-43-04; grep-walks grid/src/ |
| `grid/src/export/fork-manifest.ts` | createForkManifest + ForkManifest interface | VERIFIED | Exports createForkManifest; HEX64 validation; format_version '1.0' literal |
| `grid/src/export/fork-archive-builder.ts` | buildForkArchive — deterministic .tar.gz | VERIFIED | EPOCH/portable/noPax present; brain_memory_in_memory_cannot_fork error code; memberships + treasury stubs; imports createForkManifest |
| `grid/src/api/operator/fork-token-store.ts` | In-memory one-time token Map with 5-min TTL | VERIFIED | Exports forkTokenStore; atomic consume (delete before expiry check); 5-min TTL |
| `grid/src/api/operator/fork-nous.ts` | POST fork + GET download endpoints (H4+ auth, order discipline) | VERIFIED | tierNum < 4 gate; cross_operator_forbidden; Referrer-Policy header; 5*60_000 TTL; appendOperatorNousForked before token; audit_emit_failed path |
| `grid/src/api/server.ts` | registerForkNousRoute registered | VERIFIED | Line 72 import + line 703 registration |
| `grid/src/api/policy.ts` | Two 'public' entries for fork routes | VERIFIED | Lines 256-257: POST + GET fork routes set to 'public' |
| `brain/src/noesis_brain/standalone/__init__.py` | Package init | VERIFIED | Exists (67 bytes); module docstring |
| `brain/src/noesis_brain/standalone/importer.py` | verify_and_unpack with path-traversal + hash guard | VERIFIED | T-43-slip defense; export_hash mismatch error; tarfile extraction |
| `brain/src/noesis_brain/standalone/factory.py` | create_brain_app_standalone — no Grid wire | VERIFIED | Sets BRAIN_STANDALONE=1; pops GRID_URL/CIVIC_DID; delegates to create_brain_app_from_env |
| `brain/src/noesis_brain/__main__.py` | argparse subcommand + BRAIN_DATA_DIR threading | VERIFIED | BRAIN_DATA_DIR_ENV + BRAIN_STANDALONE_ENV constants; 6 BRAIN_DATA_DIR refs; argparse with standalone subcommand; main_entry dispatches |
| `brain/src/noesis_brain/http/server.py` | Civic-action gate (CIVIC_ACTION_PATHS + middleware) | VERIFIED (partial) | CIVIC_ACTION_PATHS=set() (empty); _is_standalone() present; _civic_unavailable_response() with 503/grid_unavailable; middleware registered — but gate never fires (no civic paths defined) |
| `brain/test/test_standalone.py` | 12 tests (0 skips) | VERIFIED | TestBrainDataDir (3), TestStandaloneImport (3), TestStandaloneMode (2), TestCivicActionGate (4); 0 @pytest.mark.skip remaining |
| `steward/src/components/fork-irreversibility-dialog.tsx` | ForkIrreversibilityDialog — D-43-03 verbatim copy | VERIFIED | All 4 verbatim copy constants locked; onPaste; capturedDidRef; autoFocus on cancel button |
| `steward/src/components/fork-irreversibility-dialog.test.tsx` | 10 passing tests (0 .skip) | VERIFIED | grep for it.skip returns 0; 10 tests covering copy/paste/keyboard/typed-match/cancel |
| `steward/src/app/system/local-ai/page.tsx` | Fork Nous section + ForkIrreversibilityDialog wired | VERIFIED | ForkIrreversibilityDialog imported; fork-section data-testid; operator/fork fetch; download_url trigger; noesis_brain standalone --import instruction text |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grid/src/api/operator/fork-nous.ts` | `grid/src/audit/append-operator-nous-forked.ts` | appendOperatorNousForked import + call (D-30 order) | VERIFIED | Lines 43+146: import and call with package_hash in payload |
| `grid/src/api/operator/fork-nous.ts` | `grid/src/export/fork-archive-builder.ts` | buildForkArchive call | VERIFIED | Lines 44+112: import and await call |
| `grid/src/api/operator/fork-nous.ts` | `grid/src/api/operator/fork-token-store.ts` | forkTokenStore.put on POST + forkTokenStore.consume on GET | VERIFIED | Lines 45+161+187: import, put after audit, consume on download |
| `grid/src/api/server.ts` | `grid/src/api/operator/fork-nous.ts` | registerForkNousRoute import + call | VERIFIED | Line 72+703 |
| `grid/src/api/policy.ts` | fork routes | 'public' entries | VERIFIED | Lines 256-257 |
| `brain/src/noesis_brain/__main__.py` | `brain/src/noesis_brain/standalone/factory.py` | _run_standalone calls create_brain_app_standalone | VERIFIED | Line 608 |
| `brain/src/noesis_brain/standalone/factory.py` | `brain/src/noesis_brain/__main__.py` | Delegates to create_brain_app_from_env (GRID_URL unset) | VERIFIED | Line 37: os.environ.pop("GRID_URL") before create_brain_app_from_env |
| `brain/src/noesis_brain/http/server.py` | civic action handlers | civic_action_gate middleware registered | PARTIAL | Middleware registered; CIVIC_ACTION_PATHS is empty — gate never fires for any path today |
| `steward/src/app/system/local-ai/page.tsx` | POST /api/v1/operator/fork/<civic-did> | fetch with credentials:include | VERIFIED | Line 158: fetch with encodeURIComponent(civicDid) |
| POST response.download_url | browser download trigger | programmatic `<a>` element click | VERIFIED | Lines 173-177: createElement('a'), href=data.download_url, click() |
| `scripts/check-state-doc-sync.mjs` | `.planning/STATE.md` | Doc-sync count assertion | VERIFIED | Script passes with "68 members" check; STATE.md Phase 43 (+1): operator.nous_forked → 68 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `steward/src/app/system/local-ai/page.tsx` (civicDid) | `civicDid` | Optional field from `/api/v1/operator/me/settings` response | No — optional field not yet populated by Grid (Phase 37 augmentation pending) | PARTIAL (renders disabled "No Nous to fork yet" when undefined — intended fallback) |
| `grid/src/api/operator/fork-nous.ts` (civicVcJson) | `civicVcJson` | Placeholder stub (CivicDidStore.findByCivicDid doesn't exist) | No — hardcoded stub VC JSON | STUB (acknowledged in Plan 02 summary; Phase 49 will wire real fetch) |
| `grid/src/api/operator/fork-nous.ts` (checkOperatorOwnsNous) | ownership check | Injectable `services.checkOperatorOwnsNous`; default-deny when absent | No — not wired in production launcher | PARTIAL (fail-safe default-deny; deferred to Phase 49) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| doc-sync script passes | `node scripts/check-state-doc-sync.mjs` | "[state-doc-sync] OK — STATE.md is in sync (v2.5: 53 events + Phase 43: 68 members)" | PASS |
| ALLOWLIST.size === 68 | grep ALLOWLIST_MEMBERS count | 68 entries including operator.nous_forked at position 68 | PASS |
| fork-nous.ts imports all 3 collaborators | grep imports | appendOperatorNousForked + buildForkArchive + forkTokenStore all imported | PASS |
| Brain standalone argparse dispatch | grep _run_standalone | main_entry() dispatches to _run_standalone when mode=='standalone' | PASS |
| All skip-stubs removed from Wave 0 test files | grep it.skip | 0 matches across 4 stub files | PASS |
| ROADMAP ledger row 43 | grep ROADMAP | Still shows "0 | 67" — NOT updated | FAIL |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FORK-01 | Plans 02, 04 | Operator can export full Nous state via POST /api/v1/operator/fork/<nous-did> | SATISFIED | Fork endpoint exists, H4+ auth, archive with memory/*.db + credentials + audit + civic stubs + manifest; Steward UI wired |
| FORK-02 | Plan 02 | Export package is human-readable JSON archive with clear schema documentation | SATISFIED (partial) | Deterministic .tar.gz with manifest.json documenting schema; all files are JSON or SQLite. File paths differ from ROADMAP SC1 specification (memory/*.db vs brain/memory/karpathy.json etc.) — see human verification |
| FORK-03 | Plan 03 | Standalone forked Nous operates with reduced features (no civic life, full Brain cognition) | SATISFIED (partial) | `python -m noesis_brain standalone --import` CLI implemented; GRID_URL/CIVIC_DID unset; BRAIN_STANDALONE=1; civic gate wired but CIVIC_ACTION_PATHS empty (forward-compat) — see human verification |
| FORK-04 | Plans 01, 02 | Fork operation recorded as operator.nous_forked in BOTH Grid chain AND exported package | PARTIALLY SATISFIED | Audit event in Grid chain: YES. In exported package: NO (D-30 order forces archive before audit). Public fork/verify endpoint: NOT implemented. REQUIREMENTS.md says "Public verification of fork history possible" — chain audit history IS in the package but the specific fork event and verify endpoint are missing |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/api/operator/fork-nous.ts` | 107-108 | `civicVcJson = placeholder stub VC JSON` | Warning | civic-did.vc.json in every exported package is a placeholder stub, not the actual Civic-DID Verifiable Credential. Acknowledged deviation — Phase 49 will wire real lookup |
| `grid/src/api/operator/fork-nous.ts` | 81-89 | `services.checkOperatorOwnsNous` injectable default-deny | Warning | Cross-operator fork protection depends on injection at launch time. If services.checkOperatorOwnsNous is not wired in the launcher, every fork attempt returns 403. Fail-safe by design — but ownership verification is not exercised in production today |
| `brain/src/noesis_brain/http/server.py` | 32 | `CIVIC_ACTION_PATHS: set[str] = set()` | Warning | Civic-action gate middleware is registered but never fires (empty path set). SC3 behavioral claim is forward-compatible infrastructure only |
| `.planning/ROADMAP.md` | Ledger row 43 | `*(none — fork uses existing operator.* family)* | 0 | 67 |` | Blocker (doc) | Allowlist ledger table is inconsistent with actual code (68 entries). Downstream phase running totals (44-50) under-count by 1 |
| `.planning/REQUIREMENTS.md` | Traceability | FORK-01..04 all "Pending" | Warning | Phase completed but traceability not updated |

---

### Human Verification Required

### 1. SC2 — Standalone Brain Steward Console Memory Inspector

**Test:** Run `python -m noesis_brain standalone --import <pkg.tar.gz>` on a machine with Steward Console. Navigate to the memory inspector. Verify Karpathy/Hypnos/Pneuma memory from before the fork is visible and browsable.
**Expected:** Memory inspector renders the same state views as pre-fork. Full cognition (Ollama tick loop, reflection) is active. No Grid connection required.
**Why human:** Requires a running Brain process + Steward Console + real fork archive. Can only verify the memory actually loaded from the imported SQLite files, not from empty stubs.

### 2. SC3 — Civic Action Gate Behavior and Error Code

**Test:** With `BRAIN_STANDALONE=1` set, attempt a civic action against Brain's HTTP server. Confirm: (a) the gate fires, (b) returns 503, (c) the error code is acceptable (`grid_unavailable` was implemented; ROADMAP SC3 said `civic_features_unavailable_in_standalone`).
**Expected:** Either (a) CIVIC_ACTION_PATHS is populated and the gate fires with the correct error, OR (b) product decision confirms forward-compat wiring is acceptable for Phase 43 and the error code deviation from ROADMAP SC3 is intentional.
**Why human:** CIVIC_ACTION_PATHS is currently empty — the gate infrastructure exists but is unreachable. Product decision required on whether "no civic-action endpoints on Brain HTTP today" satisfies SC3's intent.

### 3. SC1 — Archive File Structure vs ROADMAP Exact Specification

**Test:** Download a fork archive and inspect its structure. Compare against ROADMAP SC1 which specifies: `brain/memory/karpathy.json`, `brain/memory/hypnos.sqlite`, `brain/memory/pneuma.json`, `civic/civic-did.jws`, `civic/business-did.jws`, `civic/audit-history.jsonl`, `civic/community-memberships.json`, `civic/treasury-balance.json`.
**Expected:** Either (a) the operator confirms the implemented structure (`memory/*.db`, `credentials/civic-did.vc.json`, `audit/chain-export.jsonl`, etc.) is acceptable as a structural refinement of ROADMAP SC1, OR (b) identifies which deviations require Phase 43 fixes vs which are deferred (business-did, Karpathy/Hypnos/Pneuma named exports).
**Why human:** ROADMAP SC1 was aspirational — the plans operationalized it with a different structure. Whether the spirit of FORK-02 ("human-readable JSON archive") is satisfied requires product judgment on file naming and format.

---

### Gaps Summary

**3 gaps identified:**

**Gap 1 (Documentation — Blocker):** ROADMAP.md Allowlist Growth Ledger row 43 was not updated. The ledger still reads `0 | 67` while the codebase (broadcast-allowlist.ts) has 68 entries and the Phase 43 detailed section in ROADMAP correctly states +1/68. All downstream phase running totals (44 through 50) are under-counted by 1. This is a documentation consistency gap — the code is correct, the ledger row is stale.

**Gap 2 (Documentation):** REQUIREMENTS.md traceability table still shows FORK-01..04 as "Pending". Phase 43 is complete per ROADMAP. Traceability should be updated to "Complete" for all four FORK requirements.

**Gap 3 (Feature — SC4/FORK-04):** The public fork verification endpoint `POST /api/v1/operator/fork/verify` is not implemented. ROADMAP SC4 and FORK-04 (REQUIREMENTS.md: "Public verification of fork history possible") require it. The audit event IS recorded in the Grid chain (including package_hash), and the exported package contains the chain history up to the fork moment — but the fork event itself is not in the package's chain-export.jsonl (D-30 order discipline), and there is no API for third-party verification of "was this package produced by a legitimate fork?". This is a partial FORK-04 satisfaction.

---

*Verified: 2026-05-28T03:09:16Z*
*Verifier: Claude (gsd-verifier)*
