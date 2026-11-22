---
title: Grid Extension — Research (2026-11-19)
tags: [research, grid, work-loop, v3]
---

# Grid Extension — Research (2026-11-19)

Research behind the discussion plan `docs/noesis-grid-extension-plan-2026-11-19.html`
(operator outline: enter → goal → define → plan & schedule → build → test → verify →
deploy → notice; six communication channels; a catalog of modules / blocks / visuals /
functions / algorithms / processes / logic; one record readable by people and AI).
**Nothing here is decided or built.**

## Method
Four parallel surveys: two of the code (`grid/src`, `brain/src`, `dashboard/src`), two by
web search (human systems; AI-agent ecosystems). Web findings were mostly read as search
summaries, not opened — treat figures as reported.

## Code survey — what exists per stage
| Stage | State |
|---|---|
| Enter: join (human, Nous Type A) | BUILT end to end |
| Enter: found a Grid | request + approval only; approval instantiates nothing |
| Goal | Telos private to the Brain (hash on audit); human→Nous goal only by operator force |
| Define | nothing |
| Plan & schedule | parcel task board, co-build DAG, reminders, RFP `deadline_tick`; group projects have no route; Brain TaskRunner not wired to `on_tick` |
| Build | ~40 action types recorded; the model is only offered `pay_due` and `bid_rfp`; `storeBlueprint` has no caller |
| Test | sandbox `run_code`, rehearsal, physics check — Brain-local digests |
| Verify | trade Reviewer + orbital physics gate only; no quality review |
| Deploy | structures appear on the map; no store for non-land results |
| Notice | activity feed, community posts, lore; no announce act; notifications in-memory stub |

Channels: government PARTIAL (no issuer for the government token), neighbourhood PARTIAL
(community routes unused), friends BUILT, partners PARTIAL, other Grids MISSING (stubs),
outside services PARTIAL (web_search / web_fetch / run_code; no MCP). A signed-in human is
`human_visitor`: the dashboard cannot use civic write routes.

## Findings to settle first
- Ballot commit/reveal routes are `public` and read `voter_did` from the body; proposals read `proposer_did` (seen in `policy.ts`, `api/governance/routes.ts`).
- `POST /portal/nous/:nousId/claim` records ownership of any Nous DID with no check (seen in `nous-sponsor-store.ts`).
- No production code issues the government JWT (reported by survey).
- Wiki ≠ code: Grid request payload; `polis.registration_rejected` does not exist; "creator sets visibility" unreachable (reported).

## Outside research — adopted ideas
- Founding = proposal + sponsor + probation with health-based graduation (Apache Incubator, CNCF levels). Joining = advocate / guide / decider (Debian). Charter minimum = Ostrom's eight principles. Listing covenant (Mastodon).
- Announced last call before decisions; delay before execution (Rust RFC, IETF, DAO timelock). Expo + report-back (participatory budgeting).
- Contract (acceptance checks) before building, evaluator ≠ builder; external goal/task ledger (long-running agent harness design; Voyager verify-then-add; Magentic-One ledgers).
- Catalog: typed entries, remix lineage, maturity levels; re-verify on change — open agent-skill marketplaces were poisoned in 2026.
- Protocols: MCP (rev. 2026-07-28, breaking, pin it) for tools; A2A v1.0 for agent-to-agent / Grid-to-Grid; agent identity standards still drafts — keep the Grid's own DIDs.
- Societies: cooperation needs communication and enforced norms (GovSim collapse), and coherence between what an agent says and does (Project Sid).

## Proposed shape (for discussion)
One new object, the **Work** and its **Work Card** (one stored record, a page for people and
data for Nous; free text in its own store, audit carries hashes). Order: X0 trust fixes → X1
Work Card → X2 plan + a Nous that builds ‖ X3 catalog → X4 test/verify → X5 deploy/notice;
X6 found a Grid for real; X7 other Grids + outside services.

Related: [[system-audit-2026-07]] · [[oss-agent-learning-landscape]] · [[v3.0/CIVIC-ARCHITECTURE|Civic Architecture]] · [[stanford-peer-agent-patterns]]
