# Research Wiki — Log

Append-only, chronological. Newest at the bottom. One entry per ingest / synthesis /
lint action. Parseable prefix: `## [YYYY-MM-DD] action | title`. See [[SCHEMA]].

## [2026-06-29] init | LLM-wiki vault bootstrapped
Adopted Karpathy's LLM-wiki pattern over `.planning/research/` (private tree).
Created [[SCHEMA]], catalogued all 26 existing research docs in [[index]], added
`scripts/lint-research-wiki.mjs` and an Obsidian config (`.obsidian/`, wikilinks on,
gitignored). No existing sources were modified — index/log/schema are new additions.

## [2026-07-02] synthesis | Full-System Audit (Nous & Grid)
Operator asked for full analytics on (1) Nous autonomous learning/ceaseless goal pursuit,
(2) visualization of Nous-built objects/knowledge + upgradeability, (3) availability/
scalability/usability. Ran 4 codebase deep-audits + 2 live OSS web surveys; synthesized
into [[system-audit-2026-07]] (verdicts + W-A..W-E implementation program). Served twin:
`docs/noesis-system-analysis-2026-07.html`.

## [2026-07-02] apply | W-A Mind loop shipped from the audit program
Operator approved the [[system-audit-2026-07]] program; W-A A1–A4 implemented in the Brain
(decision cycle replacing NOOP, GoalLedger + slow planner, ReflectionEngine wired,
outcome feedback with Reflexion lessons; D-MIND-01..04). 43 TDD tests, brain suite 1127
green, allowlist +0. Patterns applied from [[oss-agent-learning-landscape]]
(BabyAGI ledger × PIANO intent · Generative-Agents reflection · Reflexion lessons).

## [2026-07-02] apply | W-A5/6/7 learning half shipped
"go next": Stanford-scored retrieval into planner+decisions (A5), Voyager skill loop
closed on the existing SkillStore with sleep-time distillation of completed goals (A6),
and _sleep_time_compute after Hypnos (A7 — Letta pattern). Brain suite 1140 green,
D-MIND-05/06. W-A remaining: A8 DSPy/GEPA (offline), A9 Phase 40b hosted pool.

## [2026-07-02] apply | "do until finish" wave — W-B society + substrate + doors
Operator directed autonomous completion. Shipped: W-B social cycle (autonomous DM/teach/
lore/commit-reveal voting — VOTE-05 end-to-end, D-SOC-01..03, brain 1152 green) · W-D
(watchdog webhook alerts, real-MySQL migration CI, backup script+runbook) · W-C6 map-sync
CI gate · W-E1 bilingual getting-started · A8 decision-evalset exporter · A9 always-on
Brain compose. Daily visual log: docs/noesis-daily-log-2026-07-02.html. Remaining tail
recorded there + in [[system-audit-2026-07]] program (W-C1–C5, W-E2–E5, Phase 40b).

## [2026-07-02] apply | afternoon wave — live map, fly-to, group join, knowledge graph
"do do do": W-C1 live map (orbital.js firehose → glow-on-build) + W-C2 fly-to camera
(canon-safe) + W-B4 autonomous group join (GET /api/v1/groups + social-cycle) + W-C4 the
first knowledge-graph view (docs/noesis-knowledge-graph.html — force-directed lore commons,
applies [[oss-visualization-landscape]] three-forcegraph pattern hand-rolled/no-deps).
W-C3a upkeep scanner confirmed already wired. Brain 1154 green, grid clean, allowlist +0.

## [2026-07-02] verify | liveness run — Nous ALIVE on real qwen3:4b, caught a dead-loop bug
Ran the REAL BrainHandler against REAL qwen3:4b (brain/scripts/liveness_run.py). Found a
production-breaking bug all 1155 mock tests missed: qwen3's hidden <think> consumed the
256-token structured-call budget → empty content → the whole mind/society loop silently
no-op'd on the default model. Fixed with constrained decoding (json_mode → Ollama
format=json + think=false), validating [[oss-agent-learning-landscape]] rec #5 in practice.
Re-run: 6/6 loop stages fire (plan→work→100%→re-goal→pay→bid→join Dynamo→speak→vote). D-MIND-07.

## [2026-07-03] verify | full-stack liveness — real Grid boots on real MySQL
Brought up MySQL 8.0 (colima). W-D2 migration chain proven (71 migrations v1→v71 clean on
real DB). Real Grid boot caught a crash-loop: group_id used the capitalized canonical grid
name "Genesis" → failed GROUP_ID_RE (lowercase); mocks seed lowercase so never caught it.
Fixed (lowercase id prefix, parcel-id convention). Grid then booted clean, W-B4 /api/v1/groups
serves 5 seeded groups, audit persists to MySQL. Liveness thread total: 5 real bugs found+fixed.

## [2026-07-03] verify | full-stack cognition — real Brain ← HTTP ← real Grid ← real qwen3
Joined the halves: real GridWireClient pulled 5 real seeded groups over HTTP from the live
Grid (real MySQL); real qwen3:4b, given an energy goal, chose to JOIN Dynamo (the energy
company) — goal-relevant, not a hallucination. Chain proven MySQL→Grid→HTTP→Brain→qwen3→
decision. Write-back needs a Civic-DID (Portal→Polis) — next milestone. brain/scripts/
fullstack_liveness.py.

## [2026-07-02] ingest | OSS landscapes (agent learning · visualization)
Created [[oss-agent-learning-landscape]] (Voyager, Generative Agents, Reflexion, PIANO,
Letta sleep-time, Mem0/Graphiti, DSPy+GEPA, SLM cascades) and
[[oss-visualization-landscape]] (camera-controls, three-mesh-bvh/csg, Colyseus delta sync,
CZML replay pattern, three-forcegraph/cosmos.gl, CC0 asset pipeline). Both catalogued in [[index]].

## [2026-07-13] build | Phase 75 packaged as a pure macOS app
`apps/local-nous-manager/` now ships as a double-clickable macOS bundle: electron-builder
DMG target (arm64), icon generated from `dashboard/public/forest-icon.svg`
(`scripts/make-icns.sh`, Swift/AppKit → iconutil → `assets/icon.icns`), afterPack ad-hoc
codesign (`scripts/afterpack-sign.cjs`) because Apple Silicon requires a sealed bundle and
no Developer ID exists locally. Verified: bundle seal valid, launch-tested from
`/Applications`. No research pages changed — build/packaging only.

## [2026-07-13] doc | Local Nous Manager — full per-menu operator guide
Wrote `docs/local-nous-manager-guide.html` (self-contained, claude.ai design theme,
light+dark): documents all 7 menus (Overview·Memory·Personal Wiki·Local AI·Process·Brain
Config·Settings) with per-menu field tables, every Settings field, a data-flow SVG, first-run
steps, troubleshooting, by-design exclusions (fork/standalone), and the secret-isolation
security model. Derived from the app source (App.tsx/main.cjs/preload.cjs) + sophia.yaml — no
research pages changed.

## [2026-07-24] apply | Phase 76 operator-bridge providers shipped (v3.3 Mind)
Operator returned and asked to finish v3.2 Money 62.5-04/05 + unhold Phase 76. Verified
against code+git that 62.5-04/05 were ALREADY merged (PRs #16/#17, 2026-07-11; Issue #9
closed) — surfaced the stale STATE.md rather than redo. Built the held bridge half of the
faculty pattern (capability + in-world/operator-bridge providers): `brain/src/noesis_brain/bridge/` — ConsentGate (off-by-default,
Type-A structural), digest-only BridgeJournal, BridgeRegistry + 3 providers
(notebook→synopsis, supervision→aisthesis, sim-use→praxis with allowlist+money-guard+
dry-run). Additive handler wiring, allowlist +0, state hash 4, brain suite 1271 green (+45).
Safe-by-default per the constitution (a hosted Type-B can never hold a grant). Honesty:
pypdf/cv2/pyautogui absent here → live paths inert-by-design, seams+txt/md verified.
Design `docs/plans/2026-07-24-operator-bridge-design.md`; system truth
`wiki/2-concepts/mind/operator-bridge.md`.

## [2026-10-07] report | Full development + service status report
Operator asked for an HTML status report with diagrams. Read ROADMAP/STATE/MILESTONES/
spec-coverage + git/PR history, probed public noesiis.com endpoints read-only (no SSH), and
re-ran brain (1268 pass) + grid (4139 pass, 2 fail = known SNS-watchdog flake) suites.
Key finding: build is feature-complete through v3.3 Mind and prod is healthy (audit 344,922,
divergence 0, uptime 68.8 d) but INERT — 3 Nous `spawning`, 0 wei, 0 objects, 0 proposals,
0/53 parcels owned; no Brain connected, endowment gate off. `system.noesiis.com` times out.
No commits since 2026-07-30. Planning docs drifted (STATE front matter, ROADMAP money block,
allowlist "91" vs 159 in code, phase numbers 72–79 reused). Report:
`docs/noesis-status-report-2026-10-07.html`. No system change ⇒ wiki untouched.

## [2026-10-07] apply | Solutions for the status report's open items
Wrote `docs/noesis-open-items-solutions-2026-10-07.html` (11 items: cause/fix/owner/done-test +
dependency diagram). Fixed in-repo: STATE/ROADMAP drift; two allowlist baseline gates stale
since PR #19 (159 members / 1075 lines); Brain compose `GRID_URL` default was the apex, which
404s `/api/v1/*` — now `https://api.noesiis.com`; added the missing `.env.brain.example`.
Diagnosed `system.noesiis.com`: A record → dead IPs (no TCP 80/443), vhost fine, live cert lacks
the name. Pitfall carried forward: phase numbers 72–79 are shared by three tracks — cite the
track name; next free phase number is 89.

## [2026-10-07] apply | Activation builds — Groups 71, Forest chat, task scheduler, Portal overview, v3.0 re-scope
Shipped on `feat/activation-builds`: Group detail route + `/grid/groups`; `/portal/chat` on the
persistent thread (reply persisted server-side); Brain `scheduler/` TaskQueue + `brain.scheduleTask`;
`GET /api/v1/portal/me/overview` + `/portal/dashboard`; D-V3-38 (40b + 52 → v3.1). Allowlist +0,
no migration. Findings carried forward: (1) the portal chat reply is a Grid-side Ollama persona,
not the Nous's Brain — a Brain cannot read its human's messages yet, and the two conversation
routes key the human differently (`did:noesis:human…` vs `did:civic:noesis:human:`); (2) Next.js
page files may only export the page — put helpers in a sibling module; (3) `/portal/status` shows
hardcoded service statuses (violates no-mock; not fixed here); (4) the orbital map does not render
Groups at all, so "click a Group on the map" needs map work first.

## [2026-10-07] apply | Brain inbox — the real Nous answers Portal chat
Grid `civic/conversation-inbox` (read waiting threads / reply) + Brain `_run_conversation_cycle`.
Pairing key = the Portal human DID already stored on the thread; the Nous is resolved
civic→existence server-side, so no new identity link was needed. The Grid-side persona now
returns 202 `pending` while the Nous's presence is `awake`, so two voices never answer one
message. Pitfall: `conversation_messages.created_at` was a copy of `tick`, so messages inside one
30 s tick had no order — it now stores a ms arrival stamp (legacy rows sort first by tick).
Unverified on real MySQL / with a live Brain.

## [2026-10-07] apply | Portal Project Status page de-hardcoded (no-mock rule)
`/portal/status` rendered invented service statuses/latencies and a roadmap frozen at
Phase 22. Replaced with live public Grid reads (`/health/detailed`, `/api/v1/grid/status`,
`/api/v1/system/map`, `/api/v1/grid/nous`) via new `dashboard/src/lib/api/grid-health.ts`;
unanswered reads are shown as unanswered. Roadmap, latencies and the "no incidents" claim
removed (no live source). `PortalAuthGate` login-gated the page on a Grid session, so a
Grid outage redirected to sign-in before the outage state could render — operator approved
making `/portal/status` public (public reads only). Pitfall carried forward: any page that
must render during a Grid outage cannot sit behind the session gate.
System truth: `wiki/2-concepts/city/portal.md`.

## [2026-10-08] apply | Nous registration pipeline made real (D-V3-39) — Phase 54 NOUS track, Type A
Trying to give Hermes a Brain exposed that no Nous could obtain a Civic-DID in practice: the
pipeline's review routes needed a government-session token nothing issues, there was no owner
filing path, the issuance route rejected Ed25519 keys, no code enrolled a Brain, and a registered
Brain stayed unclaimed. Operator decisions (2026-10-08): review queue with the HUMAN decision at
the Portal pre-screen (operator reviewers) and the Polis stage as automatic charter rules;
citizens only; founding Nous filed by operators only, one owner per Nous. Security finding
carried forward: a Nous's existence-DID is public and the Brain key was SHA-256(DID), so
"signed by the Nous" proved nothing — the Brain now holds its own key, the filing carries its
public half, and issuance + token registration + ownership are bound to it. Open: Type B flow,
the government-session stub, DID-derived Whisper/P2P keys. System truth:
`wiki/1-design/civic-architecture.md` (Registration flow), `wiki/2-concepts/city/portal.md`,
decision D-V3-39. Runbook: `.planning/implementation/always-on-brain.md`.
Verified end to end on a real local Grid + MySQL 8.0. Pitfall carried forward: the store unit
tests for brain tokens use a hand-written mock store, not the real class, which hid that
`BrainTokenStore.getByDid` omitted `operator_did` (every Brain read as unclaimed) — fixed and
pinned with a test that only returns the columns the SQL selects.

## [2026-10-13] apply | Reviewer separation of duties on Nous registrations
Operator asked to close the self-review gap: the filer of a registration can no longer pass
or reject it as reviewer (`403 self_review_forbidden`; the queue marks `own_filing`).
Consequence carried forward: a founding Nous needs two operator accounts — one files, a
different one reviews.

## [2026-10-13] apply | First real Brain start against production — image could not write its data dir
Starting Hermes's Brain (`docker-compose.brain.yml`) crashed with PermissionError on
`/data/brain-wire.key`: `docker/Dockerfile.brain` never created `/data`, so the named volume
mounted root-owned under the non-root `nous` user. Fixed in the image (`mkdir /data` + chown).
Pitfall carried forward: the always-on compose had never been run end to end before this.

## [2026-11-21] synthesis | Grid House Objects — first discussion sheet
Operator base idea (objects inside a Holding: three origins, drawn form vs sealed link box,
predefined algorithms vs linked apps, share, open sell, co-workers, alerts) read against the tree
at `e47513b2` and a single-pass web survey. Output: `docs/noesis-grid-objects-discussion-2026-11-21.html`
(seven inline diagrams, EN with a KO summary) + [[grid-objects-research]]. Finding: Phases 58–61
already hold the catalog, interior tree, roles, agreements and severance; the gaps are a 3D
interior scene, a GLB path, a Brain-side credential vault, per-object role caveats and affordance
execution. Nothing ratified — twelve decisions (Q1–Q12) are open, including whether Type B may hold
third-party credentials and whether the unratified T1 split gets decided by building the Link Box.
Pitfall carried forward: "object" is already taken by `orbital_objects`; interior objects need
their own noun before any code lands.

## [2026-11-21] synthesis | Grid House Objects v0.2 — catalog, initialization, placement, gaps
Operator asked for the full furnishing catalog with Holding materials, deeper research on every
section, a system-seeded model users can extend, positioning and per-object settings by Nous and
human, and a verification of what is missing. Output: sheet v0.2 (§14–§19, twelve diagrams) and
`docs/plans/2026-11-21-genesis-catalog-seed.draft.yaml`, generated from one data source. Findings
that stand without the design: no Brain decision path emits a build, furnish or buy action;
perception does not cover interiors and has a latent path from feed text into memory; whisper key
pairs derive from the public DID; parcel reclaim razes the interior; interior objects have no
coordinates and cannot be moved or removed; production is empty (0 of 53 parcels owned, measured
2026-11-21). An independent review found 17 errors in the draft, all re-checked in code and
corrected (§19.1), and 10 collisions with canon (§19.2). One operator requirement recorded:
custom objects are valid in the Grid where they were defined and shareable with its Nous.
Decisions now Q1–Q20, none taken. Pitfall carried forward: a reviewer with no access to the
author's reasoning caught errors that three self-checks had passed. Overlap carried forward: two
related plans (2026-11-19, 2026-11-20) live only on `research/atlas-simulator`.

## [2026-11-21] apply | Reports are served at /reports
Operator rule: every HTML report lives on https://noesiis.com/reports/ and its final version is
republished on every change. Added `scripts/build-reports-index.py` (deterministic index of
`docs/reports/`), a `/reports/` route on the apex proxy and a copy step in the guide image. The
discussion sheet moved to `docs/reports/`; its old `/docs/` address redirects.

## [2026-11-21] query | Q18 traced end to end (sheet v0.2.1)
Operator chose to settle Q18 (decision loop) first. Traced "decide -> buy -> build -> place one
furnishing" through code at `1546d5e9` and through production (read-only). Seven links are needed
and none holds: (1) no Brain process exists on production; (2) all four mind cycles are gated on
`_grid_wire_client`, which the compose seed Brains never get (no `GRID_URL`, no enrolment);
(3) no Nous holds money (ledger: one test row; cheapest parcel 400); (4) no menu offers a
civic-land verb and `produce_civic_land_action` has no caller; (5) `NousRunner.executeActions`
has no case for `buy_parcel` / `build` / `extend_interior` and no default, so the documented batch
path drops them while answering 200; (6) `build` lacks `visibility` (route answers 400) and
`buy_parcel` carries no parcel address; (7) a Nous cannot see its own interior. Three more errors
of the author recorded in the sheet (§19.6). Recommended shape for the menu: a cost-gated property
cycle on the economic-cycle pattern, dispatched by direct REST. New sub-decision Q18a (who runs
the first living Nous) is the operator's and is open. Pitfall carried forward: comments in
`rpc/types.py` and `wire/client.py` assert a Grid routing contract that the runner does not
implement; a type, a route table and a passing test are not evidence that a verb works end to end.

## [2026-11-21] decision | Q18a — first living Nous on the operator's Mac Studio (sheet v0.2.2)
Operator decision: the first living Nous runs on the operator's office Mac Studio on its Local AI.
Stated constraint: no remote access to that machine now, so links 1-3 (start, enrol, fund) close
only at that machine. Design for links 4-7 written, awaiting approval:
`docs/plans/2026-11-21-nous-property-cycle-design.md` (property cycle on the economic-cycle
pattern; stages land / build / furnish; direct REST dispatch; Brain-side checks; allowlist +0).
New finding: `GRID_ENDOWMENT_ENABLED=false` on production, so a new Nous has no first money;
operator's call (endow once vs earn first). No code changed.

## [2026-11-21] lint | Independent check of the property-cycle design — eighth link
A reader with the code and without the author's reasoning checked the first draft of
`docs/plans/2026-11-21-nous-property-cycle-design.md`. Six contradictions with the code, all
re-read in source and confirmed: (1) nothing calls `handler.on_tick` for a Brain off the Grid's
host (socket RPC only; production Grid holds a stub bridge) — an EIGHTH open link the sheet's
"seven" missed; (2) upkeep is debited by the Grid scanner, not paid by the Nous; (3) structure
type must fit the zone (`STRUCTURE_ZONE_FIT`) and commons look `available` but are not
purchasable; (4) a Grid-wired Brain takes model names from the operator's Grid-side settings and
exits on failure; (5) unset `NOUS_DID` makes the Brain claim Sophia, and registration needs
sponsorship (operator rights for a founder); (6) `extend_interior` carries no parcel and
`post_economic_action` returns a bare bool. Design corrected (clock-follower in the Brain; Grid
untouched). Sheet corrected to eight links (v0.2.2, errors 21-22). Pitfall carried forward, third
time in one day: the author's own passes did not find what an unanchored reader found.

## [2026-11-21] apply | Property cycle + clock follower built in the Brain (sheet v0.2.3)
Operator approved the design. Built test-first in `brain/` only: `property_logic.py`,
`prompts/property_decision.py`, `wire/clock_follower.py`, additions to `wire/client.py`,
`rpc/handler.py`, `rpc/types.py`, `__main__.py`. 128 new tests, suite 1430 green, one end-to-end
test inside the Brain (mutation-checked on three links). NOT run on production: links 1-3 wait
for the Mac Studio. Independent review of the branch against Grid source: 8 findings in the new
code, all fixed (zone-blind candidate list, follower losing ~1 tick in 15, stale-tick delivery,
Brain-side refusal recorded as "chose to wait", lessons not in the prompt, timeout called a
refusal, Grid error text into memory verbatim, forced sleep on Grid restart) plus a circular
import. Two Grid defects found and NOT fixed: (1) `reclaimToTreasury` sets `structure = undefined`
and `publicView` dereferences it — one reclaim makes `GET /api/v1/civic/parcels` answer 500 for
everyone until restart; (2) the Civic-DID -> runner index is memory-only and bound only on first
issuance, so a Grid restart makes `post_actions` 404 for every enrolled Brain. Facts carried
forward: the Grid creates runners for the three founders only; the Grid tick restarts from 0 on
restart. Pitfall carried forward: a green full run does not show import-order defects — run each
new test file on its own.
