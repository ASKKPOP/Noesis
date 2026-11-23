---
canonical: true
topic: ci-gates
status: live
last_verified: 2026-11-22
owners: [henry, claude]
---

# CI gates — the constitutional checks

> A set of `scripts/check-*.mjs` scripts that mechanically enforce the system's non-negotiable invariants in CI. Each gate turns a philosophy/architecture rule into a build-blocking check. Source: `scripts/check-*.mjs` (30 gates). All 30 run on every push and pull request in `.github/workflows/rig-invariants.yml`; `check-gates-wired` fails the build if a gate script is added without a workflow step.

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
| **Hygiene** | `check-no-silent-catch` · `check-observability-no-todo` · `check-gates-wired` | No silent `.catch`; structured logging; no TODO in observability paths; every gate script is run by a CI workflow |
| **Docs** | `check-wiki` · `check-map-sync` | Wiki page invariants (front-matter, At-a-glance diagram, one canonical per topic) — see `PROTOCOL.md`; the canonical world map and its dashboard copy stay identical |

## Why gates, not policy text

Each gate exists because the rule it guards is load-bearing and easy to violate silently. The pattern: a philosophy commitment (sovereignty, zero custody, plaintext-never, Nous-only governance, zero-diff audit) becomes a grep/AST check that fails the build, so the invariant survives refactors and new contributors. New audit events, routes, and intervals must satisfy their gate **in the same commit** that introduces them.

## 🔗 Related

[[audit-allowlist]] · [[grid]] · [[brain]] · [[decisions]]
