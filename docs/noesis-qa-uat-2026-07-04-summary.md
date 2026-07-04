# Noēsis QA/UAT — Executive Summary (2026-07-04)

**Verdict:** API / audit-first / constitutional / economy layers are **fully verified on `origin/main`**. Remaining gaps are interactive UI and a few live write-paths, blocked only by environment (no Ollama, headless has no GPU/WebGL, Steward/Portal-Manager UIs not running) — **not defects**.

## What passed (on `main`)
- **Audit canonical-hash fix** — `chain_valid: true`, `status: up` on a real MySQL-restored chain (past cold-start). Regression test green. Resolves R-31-01.
- **D-V3-33 Portal-gating** — valid oath + no approval → `403 portal_approval_required`.
- **Economy loop** — 164 vitest (endow → due → treasury → RFP → escrow → paid). Live autonomous dues events present.
- **Auth gates** uniform (401/403); **privacy** clean (no plaintext DID/email; hashed actors).
- **Public reads** all 200; **API-01** `/polis/bills/<bad>` → `404` (was `200`).
- **Live Claude cognition → audit chain** — Claude chose `join_group` Dynamo; `group.member_joined` landed, chain stayed valid.

## Key finding — BLOCKER-01 (fixed → PR #4)
Founding Nous (`did:noesis:<name>`) can't pass the Civic-DID gates (`did:noesis:nous:*` only) → can never obtain a runner-bound Civic-DID → `/brain/actions` → `404` forever (why they sit "spawning"). **Fix:** narrow regex relax admitting the 3 founding DIDs across 6 gates; +2 regression tests; no DID renaming / DB migration. Proven end-to-end. → https://github.com/ASKKPOP/Noesis/pull/4

## Other notes
- **Doc drift:** guide says port `:3000` (real `8080`), oath sig `Ed25519` (real `ES256`), map "68 parcels" (real `53`).
- **Process:** live UAT first ran 7 commits behind main; re-verified on main. `d8ccaa22` (portal-session fix) makes `operator/me/settings` work with a human session — earlier "human→401" was partly that pre-fix bug.

## Not covered (needs environment)
Interactive Steward/Grid-Manager/Portal-Manager UIs · world-map 3D (GPU browser) · live parcel/library/market writes · real Portal→Polis approval ceremony (was DB-seeded).

## Deliverables
- **PR #4** — BLOCKER-01 fix (rebased on `main`, 86 tests pass).
- `docs/noesis-qa-uat-2026-07-04.html` — full report · `-history.md` — timeline · this summary.
- `claudedocs/uat-2026-07-04.md` — detailed working report.
