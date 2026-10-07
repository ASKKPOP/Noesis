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
