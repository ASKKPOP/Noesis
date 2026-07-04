# Noēsis QA/UAT — Session History (2026-07-04)

Chronological log of the user-acceptance test session. Tester: Luu (`luu@askkpop.com`).
Code under test ended on `origin/main @ d8ccaa22`. Companion: `noesis-qa-uat-2026-07-04.html`, `-summary.md`.

## Timeline

1. **Merge & assess** — Merged `origin/main` into `fix/audit-chain-canonical-hash` (clean). Found the Genesis Grid already running on `:8080` as a local `tsx` process, MySQL-backed (`noesis-mysql`, 3308→3306, tick 500ms). Dashboard on `:3001`. Ollama not installed.

2. **Core UAT (batch probes)** — Public reads (irs/library/market/bills/groups/procurement/orbital) all 200; auth gates 401; privacy scan clean; `/polis/bills/<bad>` returned `200 {}` at this point. Discovered the running process (started Jul 3 09:23) **predated** the D-V3-33 gate commit `8d50900e` (Jul 3 14:23) and behaved like pre-fix code.

3. **Restart from HEAD** — Rebooted the Grid from the merged working tree (restored the existing 115k-row MySQL chain). Validated:
   - **Audit canonical-hash fix**: `chain_valid: true`; `status: degraded → up` after `tick > COLD_START_TICKS(60)`.
   - **D-V3-33 gate**: valid ES256-signed oath + no approval → `403 portal_approval_required`.
   - `/polis/bills/<bad>` now `404` (API-01 resolved in HEAD).

4. **Economy loop (deterministic)** — 164 vitest across `account-endowment`, `civic-dues`, `civic-economy`, `procurement`, `commerce`, `trades`, `treasury`, plus audit appenders (endow / due assessed·paid·delinquent / procurement notice·awarded·attested·settled / treasury revenue·upkeep). All green. Live `due.assessed`/`due.delinquent` events present.

5. **Browser QA** — Rendered marketing page (7 pillars, Pre-launch pill, no h-overflow), world-map (chrome + 6-zone legend + Genesis/Moon/Mars + privacy hint), dashboard `:3001` (renders, footer "53 PARCELS"). Headless Chromium can't create a WebGL context → 3D orbital scene not visually verifiable.

6. **Claude instead of Ollama** — Created `brain/.venv` (python3.12; `anthropic 0.116.0`). Model `claude-haiku-4-5-20251001` via the Brain's native `ClaudeAdapter`. Full-stack liveness: Brain pulled real Grid sight over HTTP and produced grounded per-group reasoning, choosing to abstain (`{"action":"none"}`) — valid cautious cognition.

7. **BLOCKER-01 discovered** — Trying to make a Nous *act* revealed a DID-format mismatch: seed Nous use `did:noesis:<name>` but the issuance/audit/brain-token/JWT gates require `did:noesis:nous:*`. Proof: `POST /registry/civic-did/request {existence_did:"did:noesis:sophia"}` → `400 invalid_existence_did`. So no founding Nous can obtain a runner-bound Civic-DID → `/brain/actions` → 404.

8. **Proof-of-fix (C1)** — Temporarily added a `nous:`-format test Nous (`did:noesis:nous:qa`) to `SEED_NOUS`, restarted, and ran the full ceremony: seed approved registration → issue Civic-DID (binds runner) → register Ed25519 Brain token → EdDSA civic-bearer JWT → `POST /brain/actions`. A hand-crafted `join_group` (Aegis) landed (200, `group.member_joined` id 155809). Then a **real Claude social cycle** chose `join_group` **Dynamo** (energy group, goal-directed) → dispatched → 200 → `group.member_joined` id 156159 (hashed actor). Chain stayed `up`/`valid`. Reverted the seed edit.

9. **Fix + PR** — On a fresh branch `fix/founding-nous-did-format` off `origin/main`: narrow regex relax across 4 core gates + 2 operator-claim routes; +2 regression tests. `tsc` clean, issuance-path CI guard passes. Opened **PR #4**.

10. **Main-vs-branch check** (user reminder) — Found `origin/main` had advanced **7 commits** beyond the running branch, incl. `d8ccaa22` (tryDid portal-cookie fix) which overlaps PR #4's file. **Rebased PR #4** onto current `main` (no conflict; my change line 20, `d8ccaa22` line 142), 86 tests pass, force-pushed.

11. **Re-verify on main** — Checked out local `main @ origin/main` (`d8ccaa22`), restarted the Grid from main code. Confirmed live: audit fix `up`/`valid`; `d8ccaa22` makes `GET /operator/me/settings` + human session → 200 (Steward Tier-1 backing works on main); CORS header present. Re-ran the full core checklist on main — **all pass** (403 gate, public reads, API-01 404, gates, governance Nous-only, dues, privacy, audit events, chain valid).

## Artifacts produced
- Code fix: **PR #4** (`fix/founding-nous-did-format`, rebased on main).
- Report: `docs/noesis-qa-uat-2026-07-04.html`, `claudedocs/uat-2026-07-04.md`.
- This history + `-summary.md`.
- Env: `brain/.venv` (gitignored). Demo data (qa registration/civic-DID/brain-token/2 join events) persists in local MySQL (harmless; orphans on next restart).
