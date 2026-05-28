---
phase: 43-right-to-fork
verified: 2026-05-27T22:30:00Z
status: human_needed
score: 11/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/11
  gaps_closed:
    - "ROADMAP.md Allowlist Growth Ledger row 43 updated to operator.nous_forked | +1 | 68 (commit e5e1442)"
    - "REQUIREMENTS.md FORK-01..04 traceability rows updated to Complete (commit e5e1442)"
  gaps_remaining:
    - "SC4/FORK-04: POST /api/v1/operator/fork/verify endpoint not implemented"
  regressions: []
gaps:
  - truth: "SC4 (FORK-04): Public verification endpoint POST /api/v1/operator/fork/verify exists and returns {found: true, forked_at_tick, civic_did}"
    status: failed
    reason: "No route implementing POST /api/v1/operator/fork/verify exists anywhere in grid/src/. The audit event operator.nous_forked is in the Grid chain (with package_hash), and the exported package contains chain-export.jsonl with prior history — but the fork event itself is not in the package (D-30 order requires archive build before audit append), and no dedicated verify endpoint exists for third-party validation."
    artifacts:
      - path: "grid/src/api/operator/fork-nous.ts"
        issue: "Only POST /api/v1/operator/fork/:nousDid and GET /api/v1/operator/fork/:nousDid/download implemented; no /fork/verify route"
      - path: "grid/src/api/policy.ts"
        issue: "No policy entry for POST /api/v1/operator/fork/verify"
    missing:
      - "Implement POST /api/v1/operator/fork/verify endpoint that accepts package_hash and returns {found: bool, forked_at_tick: N, civic_did: <did>} from the audit chain"
human_verification:
  - test: "SC2 — Standalone Brain Steward Console memory inspector"
    expected: "After running 'python -m noesis_brain standalone --import <pkg.tar.gz>', opening Steward Console at the standalone Brain's local address renders the same memory inspector views (Karpathy/Hypnos/Pneuma) as before the fork. Memory contents from pre-fork state are visible."
    why_human: "Requires a running Brain process + Steward Console + real fork archive. Whether memory actually loads from the imported SQLite files (not empty stubs) can only be verified with a live integration test."
  - test: "SC3 — Civic action gate error code and forward-compat wiring acceptance"
    expected: "ROADMAP SC3 specifies error code 'civic_features_unavailable_in_standalone'. Implementation returns 'grid_unavailable'. CIVIC_ACTION_PATHS is empty (set()) — gate is wired but never fires (no civic-action endpoints on Brain HTTP today). Confirm whether this forward-compatible wiring satisfies SC3's intent for Phase 43."
    why_human: "Product decision required: (a) does 'grid_unavailable' error code satisfy SC3 or must it match 'civic_features_unavailable_in_standalone'? (b) is empty CIVIC_ACTION_PATHS acceptable for Phase 43 given forward-compat claim?"
  - test: "SC1 — Archive file structure vs ROADMAP exact specification"
    expected: "ROADMAP SC1 specifies: brain/memory/karpathy.json, brain/memory/hypnos.sqlite, brain/memory/pneuma.json, civic/civic-did.jws, civic/business-did.jws, civic/audit-history.jsonl, civic/community-memberships.json, civic/treasury-balance.json. Implementation ships: memory/*.db, credentials/civic-did.vc.json, audit/chain-export.jsonl + audit/chain-tail-hash.txt, civic/memberships.json (stub), civic/treasury.json (stub). Operator explicitly approved 4 plans and the phase. Confirm whether the implemented structure is an acceptable refinement of ROADMAP SC1."
    why_human: "ROADMAP SC1 was aspirational pre-decision text; D-43-02 operationalized the structure differently. The operator has reviewed and approved. This item exists for explicit sign-off that no phase 43 fix is needed for the structural deviation."
---

# Phase 43: Right-to-Fork Export Tooling — Verification Report

**Phase Goal:** Constitutional enforcement of D-V3-18 — operator must be able to walk away with their Nous at any time. Export package is portable, human-readable JSON; standalone forked Nous retains full Brain cognition + memory + audit history but cannot participate in civic life until Civic-DID is re-registered.
**Verified:** 2026-05-27T22:30:00Z
**Status:** human_needed (1 persistent gap + 3 human items; 11/13 truths verified)
**Re-verification:** Yes — after gap closure. Previous status: gaps_found (8/11).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | operator.nous_forked sole-producer exists at position 68 in ALLOWLIST | VERIFIED | `grid/src/audit/broadcast-allowlist.ts` line 286: 'operator.nous_forked' at index 67 (position 68); `grid/test/audit/broadcast-allowlist.test.ts`: toBe(68) passes |
| 2 | All Wave 0 test stubs from Plan 01 have been removed (.skip → implementations) | VERIFIED | grep for it.skip across fork-nous.test.ts, fork-archive-builder.test.ts, fork-manifest.test.ts, fork-irreversibility-dialog.test.tsx returns 0 matches |
| 3 | BRAIN_DATA_DIR env var threads through MemoryStore construction in __main__.py | VERIFIED | `brain/src/noesis_brain/__main__.py`: BRAIN_DATA_DIR_ENV + BRAIN_STANDALONE_ENV constants; MemoryStore branches on data_dir; falls back to :memory: when None |
| 4 | POST /api/v1/operator/fork/:nousDid endpoint exists with H4+ auth + audit order discipline | VERIFIED | `grid/src/api/operator/fork-nous.ts` exists; tierNum < 4 gate; D-30 order: archive → audit → token → response; registered in server.ts line 703; policy.ts lines 256-257 set to 'public' |
| 5 | Deterministic .tar.gz archive builder exists with EPOCH mtime + portable + noPax | VERIFIED | `grid/src/export/fork-archive-builder.ts`: EPOCH=new Date(0), portable:true, noPax:true, sorted by localeCompare; exports buildForkArchive; manifest.json included |
| 6 | Brain standalone CLI (python -m noesis_brain standalone --import) is implemented | VERIFIED | `brain/src/noesis_brain/__main__.py` lines 613-636: argparse subcommand 'standalone' with --import; _run_standalone coroutine; main_entry dispatches; default mode preserved |
| 7 | standalone/importer.py has path-traversal guard and manifest hash verification | VERIFIED | T-43-slip: target.relative_to(data_dir_resolved) raises ValueError; hash mismatch raises ValueError; symlink rejection present |
| 8 | standalone/factory.py unsets GRID_URL + CIVIC_DID and sets BRAIN_STANDALONE=1 | VERIFIED | Lines 31-34: os.environ["BRAIN_STANDALONE"]="1"; os.environ.pop("GRID_URL"); os.environ.pop("CIVIC_DID") before create_brain_app_from_env |
| 9 | ForkIrreversibilityDialog with D-43-03 verbatim copy + paste/Enter discipline wired into /system/local-ai | VERIFIED | TITLE_COPY='Fork Nous from Grid', WARNING_COPY verbatim, CONFIRM_LABEL='Fork forever', CANCEL_LABEL='Keep on Grid'; onPaste preventDefault; capturedDidRef; autoFocus on cancel; page.tsx imports component and POSTs to /api/v1/operator/fork/<civic-did> |
| 10 | ROADMAP.md Allowlist Growth Ledger row 43 updated to operator.nous_forked / +1 / 68 | VERIFIED | commit e5e1442: row 43 reads `operator.nous_forked \| +1 \| 68`; downstream rows corrected (44→72, 45→75, 46→81, 47→85, 48→87, 49→91, 50→91); total shows +35 (56→91) |
| 11 | REQUIREMENTS.md FORK-01..04 traceability rows updated to Complete | VERIFIED | commit e5e1442: FORK-01, FORK-02, FORK-03, FORK-04 all show "Complete" in traceability table |
| 12 | SC4: operator.nous_forked audit event recorded in Grid chain with package_hash | VERIFIED | fork-nous.ts lines 141-157: civicDidHash + operatorDidHash + package_hash passed to appendOperatorNousForked before response; audit_emit_failed path enforced |
| 13 | SC4: Public verification endpoint POST /api/v1/operator/fork/verify exists | FAILED | No such route implemented anywhere in grid/src/. Policy.ts has no entry. ROADMAP SC4 and FORK-04 REQUIREMENTS both specify this endpoint. |

**Score:** 11/13 truths verified (1 failed feature gap + 3 human-needed SC items)

---

### Deferred Items

No items are addressed in later milestone phases. The fork/verify endpoint gap was confirmed absent from Phases 44-57 roadmap sections.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/append-operator-nous-forked.ts` | Sole-producer for operator.nous_forked (9-step discipline) | VERIFIED | Exports appendOperatorNousForked; 9-step guards: operatorId RE, payload type, FORK_REASONS enum, HEX64 regex, closed-tuple, reconstruction, payloadPrivacyCheck, audit.append |
| `grid/src/audit/broadcast-allowlist.ts` | operator.nous_forked at position 68 | VERIFIED | Index 67 confirmed; ALLOWLIST.size===68 test passes |
| `grid/src/export/fork-manifest.ts` | createForkManifest + ForkManifest interface | VERIFIED | Exports createForkManifest; HEX64 validation; format_version '1.0' |
| `grid/src/export/fork-archive-builder.ts` | buildForkArchive — deterministic .tar.gz | VERIFIED | EPOCH/portable/noPax; brain_memory_in_memory_cannot_fork error; memberships + treasury stubs; imports createForkManifest |
| `grid/src/api/operator/fork-token-store.ts` | In-memory one-time token Map with 5-min TTL | VERIFIED | Exports forkTokenStore; atomic consume (delete before expiry check); 5-min TTL |
| `grid/src/api/operator/fork-nous.ts` | POST fork + GET download endpoints | VERIFIED | H4+ auth; D-30 order; Referrer-Policy header; appendOperatorNousForked before token; audit_emit_failed path |
| `grid/src/api/server.ts` | registerForkNousRoute registered | VERIFIED | Line 72 import + line 703 registration |
| `grid/src/api/policy.ts` | Two 'public' entries for fork routes | VERIFIED | Lines 256-257: POST + GET fork routes set to 'public' |
| `brain/src/noesis_brain/standalone/importer.py` | verify_and_unpack with path-traversal + hash guard | VERIFIED | T-43-slip defense; export_hash mismatch error; tarfile extraction |
| `brain/src/noesis_brain/standalone/factory.py` | create_brain_app_standalone — no Grid wire | VERIFIED | BRAIN_STANDALONE=1; pops GRID_URL/CIVIC_DID; delegates to create_brain_app_from_env |
| `brain/src/noesis_brain/__main__.py` | argparse subcommand + BRAIN_DATA_DIR threading | VERIFIED | BRAIN_DATA_DIR_ENV + BRAIN_STANDALONE_ENV constants; argparse with standalone subcommand; main_entry dispatches |
| `brain/src/noesis_brain/http/server.py` | Civic-action gate (CIVIC_ACTION_PATHS + middleware) | PARTIAL | CIVIC_ACTION_PATHS=set() (empty); _is_standalone() present; 503/grid_unavailable response function; middleware registered — gate never fires today (no civic paths defined) |
| `steward/src/components/fork-irreversibility-dialog.tsx` | ForkIrreversibilityDialog — D-43-03 verbatim copy | VERIFIED | All 4 verbatim copy constants locked; onPaste; capturedDidRef; autoFocus on cancel button |
| `steward/src/app/system/local-ai/page.tsx` | Fork Nous section + ForkIrreversibilityDialog wired | VERIFIED | ForkIrreversibilityDialog imported; fork-section data-testid; operator/fork fetch; download_url trigger |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `fork-nous.ts` | `append-operator-nous-forked.ts` | appendOperatorNousForked import + D-30 order call | VERIFIED | Lines 43+146 |
| `fork-nous.ts` | `fork-archive-builder.ts` | buildForkArchive call | VERIFIED | Lines 44+112 |
| `fork-nous.ts` | `fork-token-store.ts` | forkTokenStore.put on POST + .consume on GET | VERIFIED | Lines 45+161+187 |
| `server.ts` | `fork-nous.ts` | registerForkNousRoute import + call | VERIFIED | Lines 72+703 |
| `__main__.py` | `standalone/factory.py` | _run_standalone calls create_brain_app_standalone | VERIFIED | Line 608 |
| `http/server.py` | civic-action gate | civic_action_gate middleware registered | PARTIAL | Registered; CIVIC_ACTION_PATHS empty — never fires |
| `local-ai/page.tsx` | POST /api/v1/operator/fork/<civic-did> | fetch with credentials:include | VERIFIED | Line 158: fetch with encodeURIComponent(civicDid) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `steward/src/app/system/local-ai/page.tsx` | civicDid | Optional field from /api/v1/operator/me/nous response | No — civic_did is hardcoded null in the nous route (Phase 37 civic_did_registry join deferred to Phase 46) | PARTIAL — renders disabled "No Nous to fork yet" when undefined; intended fallback behavior |
| `fork-nous.ts` | civicVcJson | Placeholder stub (CivicDidStore.findByCivicDid not implemented) | No — hardcoded stub VC JSON | STUB — acknowledged; Phase 49 will wire real fetch |
| `fork-nous.ts` | checkOperatorOwnsNous | Injectable services.checkOperatorOwnsNous; default-deny when absent | No — not wired in production launcher; default-deny until Phase 49 | PARTIAL — fail-safe design |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| doc-sync script passes | node scripts/check-state-doc-sync.mjs | OK — STATE.md in sync (68 members) | PASS |
| ALLOWLIST.size === 68 | grep operator.nous_forked broadcast-allowlist.ts | 2 occurrences (declaration + comment); positional entry at index 67 | PASS |
| fork-nous.ts imports all 3 collaborators | grep imports | appendOperatorNousForked + buildForkArchive + forkTokenStore all imported | PASS |
| Brain standalone argparse dispatch | grep _run_standalone __main__.py | main_entry dispatches to _run_standalone when mode=='standalone' | PASS |
| All skip-stubs removed from Wave 0 test files | grep it.skip across 4 stub files | 0 matches | PASS |
| ROADMAP ledger row 43 | grep ROADMAP | operator.nous_forked | +1 | 68 — UPDATED (commit e5e1442) | PASS |
| REQUIREMENTS FORK-01..04 traceability | grep REQUIREMENTS | FORK-01..04 all "Complete" (commit e5e1442) | PASS |
| fork/verify endpoint in grid/src/ | grep -rn fork/verify | No matches — endpoint not implemented | FAIL |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FORK-01 | Plans 02, 04 | Operator can export full Nous state via POST endpoint | SATISFIED | Fork endpoint exists, H4+ auth, archive with memory/*.db + credentials + audit + civic stubs + manifest; Steward UI wired with consent gate |
| FORK-02 | Plan 02 | Export package is human-readable JSON archive with clear schema | SATISFIED (with noted deviation) | Deterministic .tar.gz with manifest.json; all files JSON or SQLite; D-43-02 structure differs from ROADMAP SC1 pre-decision spec — see human verification item 3 |
| FORK-03 | Plan 03 | Standalone forked Nous operates with reduced features | SATISFIED (with forward-compat caveat) | CLI implemented; GRID_URL/CIVIC_DID unset; BRAIN_STANDALONE=1; civic gate wired with empty CIVIC_ACTION_PATHS — see human verification item 2 |
| FORK-04 | Plans 01, 02 | Fork recorded as operator.nous_forked in BOTH Grid chain AND exported package; public verification possible | PARTIALLY SATISFIED | Audit event in Grid chain: YES (with package_hash). In exported package: NO (D-30 order discipline prevents this — archive built before audit appended). Public fork/verify endpoint: NOT IMPLEMENTED. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `grid/src/api/operator/fork-nous.ts` | 107-108 | civicVcJson = placeholder stub VC JSON | Warning | civic-did.vc.json in every exported package is a placeholder, not the actual Civic-DID VC; acknowledged; Phase 49 wires real lookup |
| `grid/src/api/operator/fork-nous.ts` | 81-89 | services.checkOperatorOwnsNous injectable default-deny | Warning | Cross-operator fork protection fails open (403) if not wired at launch; fail-safe by design; production wiring deferred to Phase 49 |
| `brain/src/noesis_brain/http/server.py` | 32 | CIVIC_ACTION_PATHS: set[str] = set() | Warning | Civic-action gate middleware is wired but never fires; SC3 forward-compatibility infrastructure only |

---

### Human Verification Required

### 1. SC2 — Standalone Brain Steward Console Memory Inspector

**Test:** Run `python -m noesis_brain standalone --import <pkg.tar.gz>` on a machine with Steward Console installed. Navigate to the memory inspector after import. Verify Karpathy/Hypnos/Pneuma memory from pre-fork state is visible and browsable.
**Expected:** Memory inspector renders the same state views as before the fork. Full Ollama cognition (tick loop, reflection) is active. No Grid connection required.
**Why human:** Requires a live Brain process + Steward Console + a real fork archive (not a test fixture). Whether the imported SQLite files actually load into the memory inspector can only be verified with a running integration environment.

### 2. SC3 — Civic Action Gate Error Code and Forward-Compat Wiring Acceptance

**Test:** With `BRAIN_STANDALONE=1` set, attempt a civic action against Brain's HTTP server. Confirm: (a) the gate fires correctly if CIVIC_ACTION_PATHS is populated, (b) the error code `grid_unavailable` is acceptable vs ROADMAP SC3's specified `civic_features_unavailable_in_standalone`, (c) empty CIVIC_ACTION_PATHS is acceptable for Phase 43.
**Expected:** Product decision that (a) the error code deviation is intentional and the D-43-01 decision overrides ROADMAP SC3 wording, OR (b) a fix is needed.
**Why human:** CIVIC_ACTION_PATHS is currently empty — the gate infrastructure exists but is unreachable. No civic-action endpoints exist on Brain HTTP in Phase 43. Product judgment required on whether this satisfies SC3's intent or defers it to a future phase.

### 3. SC1 — Archive File Structure vs ROADMAP Exact Specification

**Test:** Download a fork archive. Inspect structure. Compare against ROADMAP SC1 specification: `brain/memory/karpathy.json`, `brain/memory/hypnos.sqlite`, `brain/memory/pneuma.json`, `civic/civic-did.jws`, `civic/business-did.jws`, `civic/audit-history.jsonl`, `civic/community-memberships.json`, `civic/treasury-balance.json`. Actual structure: `memory/*.db`, `credentials/civic-did.vc.json`, `audit/chain-export.jsonl`, `audit/chain-tail-hash.txt`, `civic/memberships.json` (stub), `civic/treasury.json` (stub), `manifest.json`.
**Expected:** Operator confirms the implemented structure is an acceptable structural refinement of ROADMAP SC1 (pre-decision spec text), and no Phase 43 fix is required for the path/format differences. Note: business-did.vc.json absent (single-DID Nous scope), treasury and memberships are stubs (Phases 45/49).
**Why human:** The operator has already reviewed and approved all 4 plans. This is explicit sign-off that the SC1 structural deviation is intentional and not a gap requiring closure.

---

### Re-Verification Summary

**2 gaps closed since previous verification (2026-05-28T03:09:16Z):**

1. ROADMAP.md Allowlist Growth Ledger — commit e5e1442 corrected row 43 to `operator.nous_forked | +1 | 68` and bumped all downstream running totals (Phases 44-50). Total updated to +35 (56→91).
2. REQUIREMENTS.md FORK-01..04 traceability — commit e5e1442 updated all four rows from Pending to Complete.

**1 gap persists:**

Gap 3 (SC4/FORK-04): `POST /api/v1/operator/fork/verify` is not implemented. No later milestone phase in the roadmap addresses it. FORK-04 REQUIREMENTS says "Public verification of fork history possible" — the audit chain satisfies traceability, but the dedicated verify endpoint is absent.

**Note on FORK-04 traceability vs implementation:** REQUIREMENTS.md shows FORK-04 as "Complete" (updated in e5e1442) but the verify endpoint is not implemented. The audit event itself IS in the Grid chain. Whether "Public verification of fork history possible" is satisfied via chain lookup vs a dedicated endpoint requires the human verification decision above.

**3 human verification items remain from previous report** (SC1 structure, SC2 memory inspector, SC3 error code). The operator committed "human verification approved" in commit f539d5e, and the HUMAN-UAT.md `status: resolved` frontmatter was set — but the individual test items remain `pending` in the body. These items are preserved here for explicit product sign-off.

---

*Verified: 2026-05-27T22:30:00Z*
*Verifier: Claude (gsd-verifier)*
*Re-verification after: commit e5e1442 (docs gap closures)*
