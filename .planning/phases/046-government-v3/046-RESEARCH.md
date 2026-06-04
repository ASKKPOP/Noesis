---
phase: 046-government-v3
type: research
status: complete
authored: 2026-06-03
requirements: [CIVGOV-01, CIVGOV-02, CIVGOV-03, CIVGOV-04, CIVGOV-05, CIVGOV-06]
---

# Phase 46 — Government v3 (Research)

## Goal (from ROADMAP)
Per **D-V3-21**, Grid legislation is **Nous-only** via **VOTE-05** (preserved verbatim from v2.2 Phase 12). Civic-tier features layered on top: bill drafting with N≥2 co-sponsorship, scheduled legislative sessions with a debate window, and a civic **law book**. Operators do not vote; Henry does not legislate.

## Reuse map (what already exists — DO NOT rebuild)
| Concern | Existing asset | Phase 46 treatment |
|---|---|---|
| Commit-reveal voting (VOTE-05) | `grid/src/governance/{engine,store,tally,commit-reveal}.ts`, `append{ProposalOpened,BallotCommitted,BallotRevealed,ProposalTallied}.ts` | **Reused verbatim, zero changes.** A passed bill's vote runs through the *existing* `proposal.*` / `ballot.*` pipeline. The bill→proposal link is a new column, not a new vote engine. |
| Operator-tier governance routes | `grid/src/api/governance/routes.ts` (H-tier gated) | **Untouched.** Phase 46 adds a *separate* Civic-DID-gated route family under `/api/v1/gov/*`. |
| Civic-DID auth | Phase 37 `grid/src/civic-registry/` (`CivicDidStore`, `government-session.ts`, `vc-builder.ts`) | Reused for actor identity + `government_only` Speaker gate. |
| Sole-producer discipline | Phase 45 `append-irs-disbursement-authorized.ts` (9-step) | **Exact template** for the 6 new `gov.*` producers. |
| Route+policy+server wiring | Phase 45 `api/routes/irs.ts`, `api/policy.ts`, `server.ts` | Exact template for `api/routes/gov.ts`. |
| DB migration | `schema.ts` MIGRATIONS (latest v35) | Phase 46 adds **v36**. |

## Numbering reconciliation (IMPORTANT)
ROADMAP Phase 46 detail says "allowlist grows by +6 (74 → 80)". That literal is **stale** — it predates Phase 45 shipping at **75** (verified: last entry `irs.disbursement_executed // (75)`; test locks `ALLOWLIST.size).toBe(75)`). The phase's *intent* is unchanged: **+6**. Correct delta: **75 → 81**. Doc-sync (Plan 03) fixes the ROADMAP literal to `75 → 81`.

## Naming decision (gov vs polis)
REQUIREMENTS CIVGOV-01..06 and ROADMAP success criteria are authoritative and specify `/api/v1/gov/*` routes and `gov.*` audit events. The CLAUDE.md allowlist note lists `gov.*` as an approved v3.0 prefix. The stray `GET /api/v1/polis/bills` entries in `policy.ts` are pre-existing placeholders from an earlier sketch — **left untouched** (surgical-changes rule). Phase 46 ships `gov.*` + `/api/v1/gov/*`.

## The 6 new audit events (CIVGOV-06) — closed tuples, alphabetical
All hashes are sha256 lowercase hex (HEX64). `*_civic_did_hash` = sha256 of the actor Civic-DID (hash-only cross-boundary discipline, mirrors Phase 45). Bill/law/session ids are UUIDs (not sensitive). No body text ever crosses — only `title_hash`/`body_hash`.

1. **`gov.bill_drafted`** — actorDid=`author_civic_did_hash`
   `{author_civic_did_hash, bill_id, body_hash, category, tick, title_hash}`
2. **`gov.bill_cosponsored`** — actorDid=`cosponsor_civic_did_hash`
   `{bill_id, cosponsor_civic_did_hash, cosponsor_count, tick}`
3. **`gov.session_opened`** — actorDid=`speaker_civic_did_hash`
   `{bill_id, debate_deadline_tick, session_id, speaker_civic_did_hash, tick}`
4. **`gov.session_closed`** — actorDid=`speaker_civic_did_hash`
   `{bill_id, outcome, session_id, speaker_civic_did_hash, tick}` (outcome ∈ `advanced_to_vote|withdrawn`)
5. **`gov.law_enacted`** — actorDid=`law_id` (system/civic act, not a person)
   `{bill_id, enacted_at_tick, law_id, supersedes_law_id}` (`supersedes_law_id`: UUID or `null` — key always present for closed-tuple)
6. **`gov.law_repealed`** — actorDid=`law_id`
   `{law_id, repealing_bill_id, tick}`

### Closed-tuple null handling
`gov.law_enacted.supersedes_law_id` is always present; value is a UUID string or `null`. The producer validates: if non-null it must be a UUID; null is allowed. Closed-tuple check counts the key regardless of value.

## Schema migration v36 (Plan 01)
```
gov_bills(
  bill_id CHAR(36) PK, grid_name VARCHAR(63),
  author_civic_did VARCHAR(255), title_hash CHAR(64), body_text TEXT, body_hash CHAR(64),
  category VARCHAR(63),
  status ENUM('drafted','cosponsored','in_session','enacted','rejected','withdrawn') DEFAULT 'drafted',
  cosponsor_count INT UNSIGNED DEFAULT 0,
  proposal_id CHAR(36) NULL,           -- links to existing VOTE-05 proposal once session advances to vote
  created_at_tick INT UNSIGNED,
  INDEX(grid_name,status))
gov_bill_cosponsors(
  bill_id CHAR(36), cosponsor_civic_did VARCHAR(255), cosponsored_at_tick INT UNSIGNED,
  PRIMARY KEY(bill_id,cosponsor_civic_did))     -- dedup co-sponsor per bill
gov_sessions(
  session_id CHAR(36) PK, bill_id CHAR(36), grid_name VARCHAR(63),
  speaker_civic_did VARCHAR(255), debate_deadline_tick INT UNSIGNED,
  status ENUM('open','closed') DEFAULT 'open',
  opened_at_tick INT UNSIGNED, closed_at_tick INT UNSIGNED NULL, outcome VARCHAR(31) NULL,
  INDEX(grid_name,status))
gov_session_arguments(
  session_id CHAR(36), author_civic_did VARCHAR(255), argument_text TEXT, posted_at_tick INT UNSIGNED,
  INDEX(session_id))
gov_laws(
  law_id CHAR(36) PK, grid_name VARCHAR(63), bill_id CHAR(36),
  enacted_at_tick INT UNSIGNED, status ENUM('active','repealed') DEFAULT 'active',
  supersedes_law_id CHAR(36) NULL, repealed_at_tick INT UNSIGNED NULL, repealing_bill_id CHAR(36) NULL,
  INDEX(grid_name,status))
-- config seeds (genesis): gov_cosponsor_threshold='2', gov_debate_window_ticks='10080'  (1 week @ 1 tick/min)
```

## Routes (Plan 03) — Civic-DID gated unless noted
| Route | Policy | Notes |
|---|---|---|
| `POST /api/v1/gov/bill/draft` | `civic_did_required` | author drafts; emits `gov.bill_drafted`; 201 `{bill_id, title_hash, body_hash}` |
| `POST /api/v1/gov/bill/:id/cosponsor` | `civic_did_required` | distinct co-sponsor; dup→409; self-cosponsor→422; emits `gov.bill_cosponsored`; once count≥threshold status→`cosponsored` |
| `POST /api/v1/gov/session/open` | `government_only` | Speaker opens; bill must be `cosponsored`; emits `gov.session_opened`; status→`in_session` |
| `POST /api/v1/gov/session/:id/argument` | `civic_did_required` | post debate argument; visitor (no DID)→401 (Phase 36); after deadline→422 |
| `POST /api/v1/gov/session/close` | `government_only` | Speaker closes; emits `gov.session_closed`; outcome `advanced_to_vote` links a VOTE-05 proposal_id onto the bill (vote itself reuses existing `/governance/*` pipeline) |
| `POST /api/v1/gov/law/enact` | `government_only` | on passed proposal → create law row + emit `gov.law_enacted` (supersedes optional) |
| `POST /api/v1/gov/law/:id/repeal` | `government_only` | emits `gov.law_repealed` |
| `GET /api/v1/gov/law/active` | `public` | visitor-readable law book (CIVGOV-05 / Phase 36) |
| `GET /api/v1/gov/bill/:id` | `public` | visitor-readable bill (incl. debate transcript pointer) |

### Speaker gate (D-46) — reuse Phase 45 verifier, not a new DID type
`government_only` routes reuse Phase 37/45 `verifyGovernmentSession` (ES256 `did:gov:` issuer). The Speaker is the current Government session principal. `gov.session_opened.speaker_civic_did_hash` = sha256 of the Speaker's **civic** DID supplied in the authenticated request body, hashed (NOT the `did:gov:` issuer — same CIVIC_DID_RE constraint that bit Phase 45/D-45-06). If a civic speaker DID is unavailable, use the treasury-style civic placeholder `did:civic:noesis:speaker` hashed. **Carry D-45-06 forward: never feed a `did:gov:` value to a producer that hashes-as-civic without confirming the regex.**

## VOTE-05 invariant (CIVGOV-04 / success criterion 4)
No new vote affordance. Operators at any tier (incl. H5) have **zero** `propose|commit|reveal` DOM in Steward Console — Phase 12 regression test still pins this. Phase 46 adds no operator-facing vote button; the bill→vote bridge only sets `gov_bills.proposal_id` and relies on the *existing* civic `/governance/*` routes. Plan 03 includes a guard test asserting no operator vote affordance is introduced.

## Privacy / invariants preserved
- Hash-only cross-boundary: bill `body_text` lives only in MySQL + visitor-readable HTTP; only `title_hash`/`body_hash` enter audit (mirrors Phase 12 T-09-12).
- Wall-clock ban: every tick comes from request body; no `Date.now`/`Math.random` (check-wallclock-forbidden covers `grid/src/governance` — new files under `grid/src/gov/` must also comply; add to TIER_B roots if needed).
- R-31-01 zero-diff, payloadPrivacyCheck on every producer, default-deny policy, sole-producer discipline (9-step).
- D-V3-18 constitutional operator: Speaker acts under published civic rules; every `government_only` action emits an audit event.

## Plan breakdown
- **046-01** Wave 0: lock allowlist test 75→81, Phase 46 describe block, RED skeletons for 6 producers + routes, migration v36 + schema test.
- **046-02** 6 sole-producers (`grid/src/gov/append-gov-*.ts`) + `GovBillStore` (+in-memory) + `gov/types.ts` tuples; allowlist 75→81; producer unit tests GREEN.
- **046-03** `api/routes/gov.ts` (9 routes) + ROUTE_DID_POLICY + server wiring + route tests; update `check-state-doc-sync.mjs` 75→81; doc-sync ROADMAP/REQUIREMENTS/STATE; CI gates; commit.

## Open risks
1. **check-wallclock-forbidden TIER_B roots** may not include `grid/src/gov/` — verify and extend if the gate misses new files (otherwise a `Date.now` could slip). Mirror the `grid/src/governance` entry.
2. **check-sole-producer-discipline** must recognize `grid/src/gov/append-*.ts` as sole producers — verify the gate's glob covers the new dir.
3. **government-session verifier** civic-DID-hash sourcing (D-45-06 trap). Resolve in Plan 03 with explicit civic placeholder + documented deviation if needed.
