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
