---
phase: 12
slug: governance-collective-law
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Grid)** | vitest 3.x |
| **Framework (Brain)** | pytest 8.x |
| **Grid config** | `grid/vitest.config.ts` |
| **Brain config** | `brain/pyproject.toml` |
| **Quick run (Grid)** | `cd grid && npx vitest run --reporter=dot` |
| **Quick run (Brain)** | `cd brain && python -m pytest -q` |
| **Full suite** | Quick Grid + Quick Brain |
| **Estimated runtime** | ~8s total |

---

## Sampling Rate

- **After every task commit:** `cd grid && npx vitest run --reporter=dot`
- **After every plan wave:** Full Grid + Brain suite
- **Before `/gsd-verify-work`:** Full suite must be green (1122+ Grid, 498+ Brain)
- **Max feedback latency:** ~8 seconds

---

## Baseline

| Suite | Baseline count | Date verified |
|-------|---------------|---------------|
| Grid (vitest) | 1122 | 2026-04-23 |
| Brain (pytest) | 498 | 2026-04-23 |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| W0-01 | 12-00 | 0 | VOTE-01..04 | T-09-12 | allowlist has 26 entries, not 22 | vitest | `cd grid && npx vitest run test/audit/allowlist-twenty-six.test.ts` | pending |
| W0-02 | 12-00 | 0 | VOTE-01 | T-09-12 | proposal.opened RED stub fails | vitest | `cd grid && npx vitest run test/governance/` | pending |
| W0-03 | 12-00 | 0 | VOTE-02 | — | ballot.committed RED stub fails | vitest | `cd grid && npx vitest run test/governance/` | pending |
| W0-04 | 12-00 | 0 | VOTE-03 | — | ballot.revealed RED stub fails | vitest | `cd grid && npx vitest run test/governance/` | pending |
| W0-05 | 12-00 | 0 | VOTE-04 | T-09-13 | proposal.tallied RED stub fails | vitest | `cd grid && npx vitest run test/governance/` | pending |
| W1-01 | 12-01 | 1 | VOTE-02 | — | sha256(choice+pipe+nonce+pipe+voter_did) matches expected fixture | vitest | `cd grid && npx vitest run test/governance/governance-commit-hash.test.ts` | pending |
| W1-02 | 12-01 | 1 | VOTE-02 | — | Python commit_hash matches JS fixture (cross-lang roundtrip) | pytest | `cd brain && python -m pytest test/governance/test_commit_hash.py -v` | pending |
| W1-03 | 12-01 | 1 | VOTE-02 | — | reveal hash verification rejects mismatch | vitest | `cd grid && npx vitest run test/governance/governance-reveal-verify.test.ts` | pending |
| W2-01 | 12-02 | 2 | VOTE-01 | T-09-12 | appendProposalOpened sole-producer, closed 6-tuple | vitest | `cd grid && npx vitest run test/governance/governance-producer-boundary.test.ts` | pending |
| W2-02 | 12-02 | 2 | VOTE-02 | — | appendBallotCommitted sole-producer, closed 3-tuple | vitest | `cd grid && npx vitest run test/governance/governance-producer-boundary.test.ts` | pending |
| W2-03 | 12-02 | 2 | VOTE-03 | — | appendBallotRevealed sole-producer, closed 4-tuple | vitest | `cd grid && npx vitest run test/governance/governance-producer-boundary.test.ts` | pending |
| W2-04 | 12-02 | 2 | VOTE-04 | T-09-13 | appendProposalTallied sole-producer, closed 6-tuple | vitest | `cd grid && npx vitest run test/governance/governance-producer-boundary.test.ts` | pending |
| W2-05 | 12-02 | 2 | VOTE-04 | T-09-15 | outcome=passed triggers law.triggered with enacted_by:'collective' | vitest | `cd grid && npx vitest run test/governance/governance-tally.test.ts` | pending |
| W2-06 | 12-02 | 2 | VOTE-06 | T-09-14 | weight field in ballot payload rejected at producer boundary | vitest | `cd grid && npx vitest run test/governance/governance-privacy-matrix.test.ts` | pending |
| W2-07 | 12-02 | 2 | VOTE-04 | T-09-13 | zero-diff tally regression: 0/1/5/10 reveals all produce valid chain | vitest | `cd grid && npx vitest run test/governance/governance-zero-diff.test.ts` | pending |
| W3-01 | 12-03 | 3 | VOTE-01 | T-09-16 | POST /governance/proposals returns 400 for tombstoned proposer_did | vitest | `cd grid && npx vitest run test/api/governance-*.test.ts` | pending |
| W3-02 | 12-03 | 3 | VOTE-02 | — | POST /governance/proposals/:id/ballots/commit returns 409 for duplicate DID | vitest | `cd grid && npx vitest run test/api/governance-ballot.test.ts` | pending |
| W3-03 | 12-03 | 3 | VOTE-02 | — | POST /governance/proposals/:id/ballots/reveal returns 422 for hash mismatch | vitest | `cd grid && npx vitest run test/api/governance-ballot.test.ts` | pending |
| W3-04 | 12-03 | 3 | VOTE-07 | — | GET /governance/proposals returns aggregate view (no per-Nous breakdown) | vitest | `cd grid && npx vitest run test/api/governance-dashboard.test.ts` | pending |
| W3-05 | 12-03 | 3 | VOTE-07 | — | GET /governance/proposals/:id/ballots/history requires H5 | vitest | `cd grid && npx vitest run test/api/governance-tier.test.ts` | pending |
| W3-06 | 12-03 | 3 | VOTE-05 | T-09-12 | Brain PROPOSE action emits proposal.opened (not operator.*) | pytest | `cd brain && python -m pytest test/governance/ -v` | pending |
| W3-07 | 12-03 | 3 | VOTE-02 | — | Brain VOTE_COMMIT generates valid commit_hash | pytest | `cd brain && python -m pytest test/governance/test_vote_commit.py -v` | pending |
| W3-08 | 12-03 | 3 | VOTE-03 | — | Brain VOTE_REVEAL sends matching nonce | pytest | `cd brain && python -m pytest test/governance/test_vote_reveal.py -v` | pending |
| W4-01 | 12-04 | 4 | VOTE-05 | T-09-12 | check-governance-isolation.mjs exits 0 | node | `node scripts/check-governance-isolation.mjs` | pending |
| W4-02 | 12-04 | 4 | VOTE-01 | T-09-12 | check-governance-plaintext.mjs exits 0 | node | `node scripts/check-governance-plaintext.mjs` | pending |
| W4-03 | 12-04 | 4 | VOTE-06 | T-09-14 | check-governance-weight.mjs exits 0 | node | `node scripts/check-governance-weight.mjs` | pending |
| W4-04 | 12-04 | 4 | VOTE-07 | — | Dashboard governance page renders open proposals list | vitest | `cd dashboard && npx vitest run test/components/governance-*.test.tsx` | pending |
| W4-05 | 12-04 | 4 | VOTE-07 | — | Drift detector: dashboard governance types match grid types | vitest | `cd dashboard && npx vitest run test/lib/governance-types.drift.test.ts` | pending |
