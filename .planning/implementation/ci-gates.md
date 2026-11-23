---
canonical: true
topic: ci-gates
status: live
last_verified: 2026-11-22
owners: [henry, claude]
---

# CI gates — the constitutional checks

> A set of `scripts/check-*.mjs` scripts that mechanically enforce the system's non-negotiable invariants in CI. Each gate turns a philosophy/architecture rule into a build-blocking check. Source: `scripts/check-*.mjs` (32 gates). All 32 run on every push and pull request in `.github/workflows/rig-invariants.yml`; `check-gates-wired` fails the build if a gate script is added without a workflow step.

## 🗺️ At a glance

```mermaid
flowchart TD
  CI[CI run] --> PRIV[privacy gates]
  CI --> GOV[sovereignty / governance]
  CI --> AUD[audit discipline]
  CI --> DET[determinism]
  CI --> CIVIC[civic integrity]
  CI --> DOC[docs]
  PRIV & GOV & AUD & DET & CIVIC & DOC -->|all pass| MERGE([merge allowed])
```

## The gates by concern

| Concern | Gate(s) | Enforces |
|---------|---------|----------|
| **Privacy (plaintext-never)** | `check-whisper-plaintext` · `check-cognitive-snapshot-plaintext` · `check-governance-plaintext` · `check-operator-sanctions-plaintext` | Brain-private content (whispers, cognition, ballot bodies, sanction reasons) never crosses the wire — only hashes do |
| **Sovereignty / governance** | `check-governance-isolation` · `check-governance-weight` · `check-no-did-exception-count` · `check-admin-policy-isolation` · `check-no-operator-sanction-path` · `check-operator-header-auth` | VOTE-05 (operators can't vote), no wealth-weighted votes, the no-DID write-exception count is frozen at 5, admin routes isolated, punitive power runs only through the court, operator identity is never read from a client header |
| **Audit discipline** | `check-sole-producer-discipline` · `check-ws-redaction-zero-diff` · `check-state-doc-sync` | The sole-producer triad, R-31-01 zero-diff redaction, allowlist↔doc sync |
| **Determinism** | `check-wallclock-forbidden` · `check-interval-lifecycle` | No wall-clock reads in tick-deterministic paths; every `setInterval` has a paired `clearInterval` |
| **Civic integrity** | `check-civic-did-issuance-path` · `check-did-policy-coverage` · `check-cross-house-injection` · `check-relationship-graph-deps` · `check-operator-scope-typing` · `check-cross-grid-dormant` | Civic-DIDs only issue via the Portal→Polis path; every route has a `ROUTE_DID_POLICY` entry; visitor/board content is data not instructions; tenancy typing; the cross-Grid framework stays dormant in v3.0 |
| **Money** | `check-ledger-b-money` · `check-treasury-no-bios-death` | Ledger-B stays retired (no `transferWei`, no `balance_wei` money); treasury exhaustion never causes a Type B `bios.death` |
| **Rig / replay isolation** | `check-rig-invariants` · `check-replay-readonly` | Researcher-rig events never reach production; replay chains are read-only |
| **Hygiene** | `check-no-silent-catch` · `check-observability-no-todo` · `check-gates-wired` · `check-ratchet` | No silent `.catch`; structured logging; no TODO in observability paths; every gate script is run by a CI workflow; copied anti-patterns (inline DID/HEX64/address regex, `useEffect`, type escapes, checker suppressions, UI timers) may only go down from the counts in `scripts/ratchet-baseline.json`. Lower a baseline with `node scripts/check-ratchet.mjs --update` (it never raises one) |
| **Verification** | `check-verification` | Triple Verification Rule, static half: every row of `verification/PROPERTIES.md` names a TLA+ spec, a Lean file and a property test that each carry the property's ID; no unregistered ID; no `sorry` / `admit` / `axiom` / `native_decide` in Lean; every `.tla` has a `.cfg`. The dynamic half (TLC + `lake build`) is `verification/run.sh`, run by `.github/workflows/verification.yml`. See [verification.md](verification.md) |
| **Docs** | `check-wiki` · `check-map-sync` | Wiki page invariants (front-matter, At-a-glance diagram, one canonical per topic) — see `PROTOCOL.md`; the canonical world map and its dashboard copy stay identical |

## Test suites in CI

`.github/workflows/tests.yml` runs the test suites on every pull request and on every push to `main` (added 2026-11-22; before that CI ran only `grid/test/rig`).

| Job | Node | Runs |
|-----|------|------|
| `protocol` | 22 | `tsc` build + tests. Node 22 because libp2p's dependencies call `Promise.withResolvers`, which Node 20 lacks |
| `grid` | 20 | protocol build, grid `tsc` build, full `vitest run`. Node 20 is the production image (`docker/Dockerfile.grid`) |
| `web` | 22 | dashboard unit tests, steward type-check + tests |
| `dashboard-e2e` | 22 | Playwright on Chromium, pinned to `ubuntu-24.04` (Playwright 1.50 has no Chromium for 26.04) |
| `brain` | — | `uv sync --frozen` + `ruff check src` + `pytest` (includes the parity fixtures, `test/test_parity_fixtures.py`) |
| `brain-rs` | — | `cargo test --locked` (includes `tests/parity.rs`) |

**Quarantine.** One Playwright test is skipped with `--grep-invert` in the `dashboard-e2e` job: `replay.spec.ts` — "tier auto-downgrade on /grid/replay route exit". The test is right and the product is wrong: `dashboard/src/app/grid/replay/page.tsx` passes `operatorTier="H1"` as a constant, so `/grid/replay` never leaves the tier gate at any tier (since Phase 13, 2026-04-27). Fix the page, then delete the `--grep-invert`.

The 27 dashboard unit tests and the SC#5 Playwright test that were quarantined when the workflow was added were fixed on 2026-11-22 (all were tests left behind by deliberate UI changes; `portal-dashboard.test.ts` was deleted because the stat-card dashboard it read was replaced by the Phase 36 landing page).

Not in CI: ESLint (no config file exists yet), brain `mypy` (212 errors on 2026-11-23) and the nightly rig bench (scheduled separately in `nightly-rig-bench.yml`).

## Why gates, not policy text

Each gate exists because the rule it guards is load-bearing and easy to violate silently. The pattern: a philosophy commitment (sovereignty, zero custody, plaintext-never, Nous-only governance, zero-diff audit) becomes a grep/AST check that fails the build, so the invariant survives refactors and new contributors. New audit events, routes, and intervals must satisfy their gate **in the same commit** that introduces them.

## 🔗 Related

[[audit-allowlist]] · [[grid]] · [[brain]] · [[decisions]]
