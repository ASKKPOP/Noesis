---
phase: 43
slug: right-to-fork
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Grid)** | vitest 2.x |
| **Framework (Brain)** | pytest |
| **Framework (Steward)** | vitest |
| **Config files** | `grid/vitest.config.ts`, `brain/pyproject.toml`, `steward/vitest.config.ts` |
| **Quick run command** | `cd grid && npm test` / `cd brain && pytest -x` / `cd steward && npm test` |
| **Full suite command** | `npm test -ws` from repo root |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd <package> && npm test` (or `pytest -x`)
- **After every plan wave:** Run `npm test -ws` from repo root + `node scripts/check-state-doc-sync.mjs`
- **Before `/gsd-verify-work`:** Full suite green + manual UAT (standalone Brain on separate machine)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | FORK-04 | — | allowlist count is 65 | unit | `cd grid && npm test -- test/audit/broadcast-allowlist.test.ts` | ⚠️ EXISTS, UPDATE | ⬜ pending |
| 43-01-02 | 01 | 1 | FORK-04 | — | `operator.nous_forked` at position 64 in array | unit | same file | ❌ Wave 0 | ⬜ pending |
| 43-01-03 | 01 | 1 | FORK-04 | — | closed 5-tuple payload guard | unit | `cd grid && npm test -- test/audit/append-operator-nous-forked.test.ts` | ❌ Wave 0 | ⬜ pending |
| 43-01-04 | 01 | 1 | FORK-04 | T-43-sole | only append-operator-nous-forked.ts calls audit.append('operator.nous_forked'...) | unit | `cd grid && npm test -- test/audit/operator-nous-forked-producer-boundary.test.ts` | ❌ Wave 0 | ⬜ pending |
| 43-01-05 | 01 | 1 | FORK-01 | — | BRAIN_DATA_DIR env var threads through MemoryStore/LtmStore | unit | `cd brain && pytest tests/test_standalone.py::test_brain_data_dir_env_var -x` | ❌ Wave 0 | ⬜ pending |
| 43-01-06 | 01 | 1 | — | — | check-state-doc-sync.mjs passes after STATE.md update | CI | `node scripts/check-state-doc-sync.mjs` | ⚠️ EXISTS, UPDATE | ⬜ pending |
| 43-02-01 | 02 | 1 | FORK-01 | T-43-auth | POST /api/v1/operator/fork/:nousDid returns 200 with download_url | integration | `cd grid && npm test -- test/api/operator/fork-nous.test.ts` | ❌ Wave 0 | ⬜ pending |
| 43-02-02 | 02 | 1 | FORK-01 | T-43-own | cross-operator fork attempt returns 403 | integration | same file | ❌ Wave 0 | ⬜ pending |
| 43-02-03 | 02 | 1 | FORK-01 | — | archive contains memory/, credentials/, audit/, civic/ | unit | `cd grid && npm test -- test/export/fork-archive-builder.test.ts` | ❌ Wave 0 | ⬜ pending |
| 43-02-04 | 02 | 1 | FORK-01 | — | manifest.json export_hash is sha256 of sorted (path, content) tuples | unit | same file | ❌ Wave 0 | ⬜ pending |
| 43-02-05 | 02 | 1 | FORK-04 | T-43-order | audit event committed BEFORE response sent | integration | `cd grid && npm test -- test/api/operator/fork-nous.test.ts` (order assertion) | ❌ Wave 0 | ⬜ pending |
| 43-02-06 | 02 | 1 | FORK-04 | — | package_hash in audit event == sha256 of full archive bytes | integration | same file | ❌ Wave 0 | ⬜ pending |
| 43-02-07 | 02 | 1 | — | T-43-token | one-time token consumed after first download (second request 404) | integration | same file | ❌ Wave 0 | ⬜ pending |
| 43-02-08 | 02 | 1 | — | T-43-token | token expires after 5 minutes | integration | same file | ❌ Wave 0 | ⬜ pending |
| 43-03-01 | 03 | 2 | FORK-03 | — | standalone mode skips wire client init (BRAIN_STANDALONE=1) | unit | `cd brain && pytest tests/test_standalone.py::test_no_wire_client_when_standalone -x` | ❌ Wave 0 | ⬜ pending |
| 43-03-02 | 03 | 2 | FORK-03 | — | civic action returns {error: 'grid_unavailable'} in standalone mode | integration | `cd brain && pytest tests/test_standalone.py::test_civic_action_returns_grid_unavailable -x` | ❌ Wave 0 | ⬜ pending |
| 43-03-03 | 03 | 2 | FORK-03 | T-43-hash | import aborts on export_hash mismatch | unit | `cd brain && pytest tests/test_standalone.py::test_import_aborts_on_hash_mismatch -x` | ❌ Wave 0 | ⬜ pending |
| 43-03-04 | 03 | 2 | FORK-02 | T-43-slip | path traversal attempt in tar.gz rejected | unit | `cd brain && pytest tests/test_standalone.py::test_path_traversal_rejected -x` | ❌ Wave 0 | ⬜ pending |
| 43-04-01 | 04 | 2 | — | T-43-copy | fork dialog renders verbatim D-43-03 copy text | unit | `cd steward && npm test -- src/components/fork-irreversibility-dialog.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 43-04-02 | 04 | 2 | — | — | paste suppressed on DID input field | unit | same file | ❌ Wave 0 | ⬜ pending |
| 43-04-03 | 04 | 2 | FORK-01 | — | Fork forever button disabled until typed DID matches | unit | same file | ❌ Wave 0 | ⬜ pending |
| 43-04-04 | 04 | 2 | FORK-02 | — | manifest.json does not contain MySQL connection strings or secrets | unit | `cd grid && npm test -- test/export/fork-manifest.test.ts` (content-check) | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 01 MUST create/update these files before any subsequent plan executes:

**Grid (create new):**
- [ ] `grid/test/api/operator/fork-nous.test.ts` — stubs for FORK-01, FORK-04 (endpoint + token + audit order)
- [ ] `grid/test/export/fork-archive-builder.test.ts` — stubs for FORK-01, FORK-02 (archive structure + hash)
- [ ] `grid/test/export/fork-manifest.test.ts` — stubs for FORK-02, FORK-04 (manifest schema + no-secrets check)
- [ ] `grid/test/audit/append-operator-nous-forked.test.ts` — stubs for FORK-04 (9 guard tests per sole-producer discipline)
- [ ] `grid/test/audit/operator-nous-forked-producer-boundary.test.ts` — grep test for sole-producer enforcement

**Grid (update existing):**
- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — bump `expect(64)` → `expect(65)`, add positional assertion for `operator.nous_forked`

**Brain (create new):**
- [ ] `brain/tests/test_standalone.py` — stubs for FORK-03 (standalone mode, civic action rejection, hash mismatch abort, path traversal)

**Steward (create new):**
- [ ] `steward/src/components/fork-irreversibility-dialog.test.tsx` — stubs for D-43-03 copy, paste suppression, button enable gate

**CI scripts (update existing):**
- [ ] `scripts/check-state-doc-sync.mjs` — append `'operator.nous_forked'` to known-events list + bump count literal

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Standalone Brain on a separate machine starts with full memory and renders memory inspector | FORK-03 | Requires a second machine + Ollama installed | Unpack archive on separate host, set BRAIN_DATA_DIR, run `python -m noesis_brain standalone --import <pkg>`, open Steward |
| .tar.gz opens in macOS Finder, Windows Explorer, and 7-Zip | FORK-02 | Cross-OS file-open test; no automation cross-platform | Download fork package, open on each OS, verify readable structure |
| Fork event visible in audit chain firehose immediately after download | FORK-04 | Requires live Grid + WebSocket subscriber | Open WS firehose, trigger fork, confirm `operator.nous_forked` arrives before download completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
