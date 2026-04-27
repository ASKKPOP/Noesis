---
phase: 13
slug: operator-replay-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Grid: `grid/vitest.config.ts`); pytest (Brain: `brain/pyproject.toml`); vitest (Dashboard: `dashboard/vitest.config.ts`) |
| **Config file** | `grid/vitest.config.ts`, `dashboard/vitest.config.ts`, `brain/pyproject.toml` |
| **Quick run command** | `cd grid && npx vitest run --reporter=dot` |
| **Full suite command** | `cd grid && npx vitest run && cd ../brain && python -m pytest && cd ../dashboard && npx vitest run` |
| **Estimated runtime** | ~60 seconds (grid ~25s, brain ~20s, dashboard ~15s) |

---

## Sampling Rate

- **After every task commit:** Run `cd grid && npx vitest run --reporter=dot`
- **After every plan wave:** Run full suite (grid + brain + dashboard)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 13-W0-01 | W0 | 0 | REPLAY-01..05 | T-10-07 | better-sqlite3 installs; RED stubs exist | unit | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-01-01 | 01 | 1 | REPLAY-03 | T-10-07 | ReadOnlyAuditChain.append() throws | unit | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-01-02 | 01 | 1 | REPLAY-03 | T-10-07 | grep gate zero .append( in grid/src/replay/** | ci-gate | `node scripts/check-replay-readonly.mjs` | ⬜ pending |
| 13-01-03 | 01 | 1 | REPLAY-03 | T-10-07 | ReplayGrid isolated from live AuditChain | integration | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-02-01 | 02 | 2 | REPLAY-04 | T-10-07 | State-level replay byte-identical to live | integration | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-02-02 | 02 | 2 | REPLAY-01 | T-10-10 | Tarball hash deterministic (fixed seed → same hash) | unit | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-02-03 | 02 | 2 | REPLAY-01 | T-10-10 | replay-verify CLI exits 0 on valid tarball, 1 on tampered | e2e | `node scripts/replay-verify.mjs path/to/test.tar.gz` | ⬜ pending |
| 13-03-01 | 03 | 3 | REPLAY-02 | T-10-10 | operator.exported sole producer | unit | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-03-02 | 03 | 3 | REPLAY-02 | — | closed-tuple payload Object.keys sort strict | unit | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-03-03 | 03 | 3 | REPLAY-02 | T-10-10 | privacy matrix 6+ forbidden keys flat+nested | unit | `cd grid && npx vitest run --reporter=dot` | ⬜ pending |
| 13-04-01 | 04 | 4 | REPLAY-05 | T-10-09 | H1/H2 tier gate shows "Replay requires H3" | unit | `cd dashboard && npx vitest run --reporter=dot` | ⬜ pending |
| 13-04-02 | 04 | 4 | REPLAY-05 | T-10-09 | H4 redaction placeholder "— Requires H4" visible | unit | `cd dashboard && npx vitest run --reporter=dot` | ⬜ pending |
| 13-04-03 | 04 | 4 | REPLAY-02 | — | ExportConsentDialog verbatim copy locked | unit | `cd dashboard && npx vitest run --reporter=dot` | ⬜ pending |
| 13-04-04 | 04 | 4 | REPLAY-02 | — | paste suppressed on Grid-ID input | unit | `cd dashboard && npx vitest run --reporter=dot` | ⬜ pending |
| 13-04-05 | 04 | 4 | — | — | wall-clock grep gate covers dashboard/src/app/grid/replay/** | ci-gate | `node scripts/check-wallclock-forbidden.mjs` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/replay/readonly-chain.test.ts` — RED stubs for REPLAY-03 (ReadOnlyAuditChain throws)
- [ ] `grid/test/replay/replay-grid.test.ts` — RED stubs for REPLAY-03/04 (isolated chain, state-level replay)
- [ ] `grid/test/audit/operator-exported-allowlist.test.ts` — RED stub for REPLAY-02 (allowlist 26→27)
- [ ] `dashboard/src/app/grid/replay/replay-client.test.tsx` — RED stubs for REPLAY-05 UI
- [ ] `dashboard/src/app/grid/replay/export-consent-dialog.test.tsx` — RED stubs for REPLAY-02 consent dialog
- [ ] `grid/package.json` — add `better-sqlite3@^12.9.0` and `tar@^7.5.13` (if not already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tarball download and integrity verification in browser | REPLAY-01 | File download requires browser; `replay-verify` must run locally on the downloaded file | Download tarball from export endpoint; run `node scripts/replay-verify.mjs <file>` and verify exit 0 |
| Scrubber slider renders correctly in dark theme | REPLAY-05 | WCAG contrast on native range slider thumb is system-dependent | Open `/grid/replay` at H3+; verify amber border, REPLAY badge, slider thumb visible and accessible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
