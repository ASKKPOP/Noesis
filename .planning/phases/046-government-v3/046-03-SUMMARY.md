---
phase: 046-government-v3
plan: 03
status: complete
completed: 2026-06-03
---

# Phase 46 — Plan 03 Summary (Routes + Doc-Sync)

## 9 routes (`grid/src/api/routes/gov.ts`) + ROUTE_DID_POLICY (+9)
| Route | Policy |
|-------|--------|
| `POST /api/v1/gov/bill/draft` | `civic_did_required` |
| `POST /api/v1/gov/bill/:id/cosponsor` | `civic_did_required` |
| `POST /api/v1/gov/session/open` | `government_only` |
| `POST /api/v1/gov/session/:id/argument` | `civic_did_required` |
| `POST /api/v1/gov/session/close` | `government_only` |
| `POST /api/v1/gov/law/enact` | `government_only` |
| `POST /api/v1/gov/law/:id/repeal` | `government_only` |
| `GET /api/v1/gov/law/active` | `public` (Cache-Control: max-age=10) |
| `GET /api/v1/gov/bill/:id` | `public` |

`registerGovRoutes` wired into `buildServerWithHub` next to `registerIrsRoutes`. `GridServices.govStore?` added (in-memory store injected by tests; falls back to `MySqlGovBillStore(pool)` in prod). Config (threshold/window) read via pool-or-default helper so in-memory-store tests need no pool mock.

## Key decisions
- **D-46-02:** legislative `government_only` routes reuse the Phase 37 `verifyGovernmentSession` gate (iss `did:gov:noesis:genesis-polis` + a session-ref claim; `court_conviction_ref` in the bootstrap stub). No shared-verifier change (surgical).
- **D-46-03:** bill→vote bridge is a single `gov_bills.proposal_id` set on `session/close` outcome `advanced_to_vote`. The vote runs through the EXISTING civic `/governance/*` commit-reveal routes — Phase 46 re-implements NO voting (CIVGOV-04 / VOTE-05 verbatim).
- **D-46-04:** speaker hash = `sha256(GOV_SESSION_ISSUER_DID)` (mirrors Phase 45). Producers hash the DID → HEX64, so the D-45-06 CIVIC_DID_RE trap does not recur.

## Tests (`grid/test/gov-routes.test.ts`, 6 GREEN)
- Full lifecycle: draft → self-cosponsor 422 → Bob cosponsor (count 1, not eligible) → Bob dup 409 → Carol cosponsor (count 2, eligible) → session open (gov JWT) → argument → close(advanced, proposal_id) → enact → `law/active` shows it → repeal → `law/active` empty → public bill view exposes body_text.
- Visitor (no DID) draft → **401**. Non-gov session/open → **403**. session/open on non-cosponsored bill → **422 bill_not_cosponsored**. Bad draft input → **400**.
- Audit ordering asserted: drafted < cosponsored < session_opened < session_closed < law_enacted < law_repealed; exactly 2 `gov.bill_cosponsored` emitted.
- **VOTE-05 guard:** source-scan asserts gov.ts has no `propose|commit|reveal` route path, no `operator-events` import, no `appendProposal|appendBallot`.

## CI gates (all green)
- `check-sole-producer-discipline` → OK (64 files)
- `check-did-policy-coverage` → OK (0 violations)
- `check-civic-did-issuance-path` → OK
- `check-no-silent-catch`, `check-wallclock-forbidden`, `check-ws-redaction-zero-diff` (R-31-01) → OK
- `check-state-doc-sync` → updated 75 → 81 (count + required array + gov.* presence + message). **OK.**

## Doc-sync (same turn, per CLAUDE.md)
- ROADMAP: Phase 46 `[x]` + numbering `74→80` → `75→81` + SC-1 `content_hash` note + Plans 3/3 + progress row Complete.
- REQUIREMENTS: CIVGOV-01..06 → `[x]` / Validated.
- STATE: Phase 46 SHIPPED close-out (D-46-01..04), focus → Phase 47, progress 12/25 phases, 56 plans.

## MILESTONES.md
NOT touched — Phase 46 is mid-milestone (v3.0). STATE/ROADMAP/REQUIREMENTS sync sufficient per CLAUDE.md "Phase ships" row.

## Verify
- gov routes + producers + allowlist GREEN; `npx tsc --noEmit` 0 errors.
- Baseline regression: zero NEW failures vs HEAD (the only red is the pre-existing migration DROP-TABLE assertion, identical on HEAD).
