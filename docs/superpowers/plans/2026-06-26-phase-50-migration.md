# Phase 50 — v2.6 → v3.0 Migration (build plan)

**Goal (ROADMAP):** a one-shot migration ceremony for existing v2.6 operators — import Brain memory,
preserve audit history as "pre-civic context", grandfather reputation from v2.6 metrics, reversible until
the first civic action commits. **Allowlist +0** (a CLI/ceremony + a pure reputation transform, no new events).

## Plans

### Plan 1 — Grandfathering (MIG-03) — ✅ SHIPPED 2026-06-26
- `grid/src/migration/grandfather.ts` — a **pure, total, deterministic** `grandfatherReputation(v26Metrics)`:
  - `civicStanding = −(sanctionCount)` (negative if ever sanctioned, else 0)
  - `libraryContributionScore = skillTeachCount` (1 point per skill taught)
  - `marketplaceReputation = round(clamp(tradeSuccessRate,0,1) × 100)` (0–100)
- **Published in `wiki/1-design/philosophy.md` §12** ("Grandfathering Honors History") for transparency — the
  mapping is identical for everyone, by rule, in the open.
- 5 tests (clean / sanctioned / clamping / total-on-malformed / deterministic); tsc + check-wiki clean.

### Plan 2 — Migrate CLI export + commit (MIG-01/02) — next
- A new `cli/` subcommand `noesis migrate --from-v2.6 --to-v3.0`: read the operator's v2.6 MySQL, export the
  Karpathy/Hypnos/Pneuma memory tables (one bundle per Nous, **reusing the Phase-43 `fork-archive-builder`
  deterministic `.tar.gz`**), write a v3.0 Brain init bundle locally, print a per-Nous summary (row counts +
  memory hash + migration tick). No Grid network call. Then `--commit`: start the v3.0 runtime, replay memory,
  and show pre-Phase-37 audit as a read-only "pre-civic context" timeline in the Steward Console.

### Plan 3 — Revert + the committed gate (MIG-04)
- `noesis migrate --revert`: roll back to v2.6 mode **iff** no post-migration civic action has committed
  (delete the v3.0 bundle, restore v2.6 pointers, "Reverted — no civic actions had occurred"). After the first
  post-migration `*.civic.*` audit event → `409 migration_committed` (the operator must use the Phase-43
  right-to-fork to leave instead). Wire Plan 1's grandfathering into the Phase-37 Civic-DID issuance.
