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

## [2026-11-09] research | Atlas (World Labs) world-model simulator for Nous skill learning
Web survey (World Labs Atlas 2026-09-01, Marble World API, Boston Dynamics/TRI Atlas LBM,
DreamDojo, Cosmos 3, Genie 3). Verdict: Atlas is partner-gated, cloud-only, and generates
appearance+depth with no physics or action interface → cannot verify a skill and breaks
local-first. Recommended a Learn→Rehearse→Verify→Keep loop on existing faculties (web tools →
quarantined Skill → sandbox / Grid dry-run / physics gate → skill library); Atlas/Marble only as
an optional operator-paid visualization. Page: [[atlas-world-model-simulator]].

## [2026-11-09] update | Atlas page — Boston Dynamics parallel-sim pattern
Operator shared a clip of many simulated Atlas robots practising around random boxes. Added §4b:
it is massively-parallel physics RL (BD postings: Isaac Sim / MuJoCo / Warp), and its 4
ingredients (many copies, randomized worlds, grounded reward, promote-then-transfer) map onto
parallel rehearsal episodes for a Nous Skill against a rules-true Grid dry-run. [[atlas-world-model-simulator]]

## [2026-11-09] apply | Parallel skill rehearsal built (physics domain)
Grid physics-check API + Brain `rehearsal/` engine + `brain.rehearseSkill` RPC; wiki D-MIND-09.
Pitfall carried forward: a referee alone is not enough — a zero-filled spec is "lawful", so each
episode's job minimums must also be enforced. Page: [[atlas-world-model-simulator]].

## [2026-11-17] plan | Surfaces re-plan — Portal Grid map, unfixed Grid identity, Rust Nous Mac app
Operator direction: noesiis.com opens on a public all-Grid map (public Grids visitable by anyone,
private Grids members-only); grid.noesiis.com is entered from the Portal after sign-in and a Grid
has no assigned identity/purpose; Brain moves Python → Rust as a Mac desktop app. Plan report only
(`docs/noesis-surfaces-replan-2026-11-17.html`); nothing built. Open: whether D-V3-32 (6 zones)
stays fixed under "identity not fixed", and Tauri vs SwiftUI shell. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] decision | D-V3-40 — zones free per Grid, identity never assigned
Operator chose "Free the zones": D-V3-32 (6-zone invariant) superseded; each Polis owns its zone
set. Recorded in the wiki decision log; not built. Carry forward: tax, residence, founding law and
the city map all assume six. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] decision | D-V3-41, D-V3-42 — locked private Grids; Rust Brain + SwiftUI Mac app
Operator decisions: private Grids listed on the Portal map with name + lock (D-V3-41); Brain →
Rust core, Type A as native SwiftUI Mac app, Type B on the same core headless; first Grid is the
test Grid, others activated after (D-V3-42, D-V3-30 reaffirmed). Not built. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | Portal P1+P2 built — Grid visibility + orbital front page
GridRegistry visibility (GRID_VISIBILITY), /portal/grids redaction + member flag, root page = orbital
map with registry-fed picker, old landing at /about. Pitfalls carried forward: the civic registry is
keyed by Grid NAME ("Genesis"), not the lowercase gridId; "private" locks only the registry entry
until the G1 gate ships; a new dev origin needs GRID_CORS_ORIGINS. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | G1 built — private-Grid gate + Grid entry page
Public GETs on a private Grid → 403 for non-members (exempt: health, Portal sign-in/Grid list/own
account); `/g/[grid]` entry page + `grid.*` host rewrite. Pitfall: many 'public'-policy routes do
their own auth, so the gate covers reads only and exempts by path prefix. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | G2 part 1 built — zone law (D-V3-40)
Six zones → template; Polis add/relabel/remove via `grid_zones` + `zoning.zone_set_changed`
(allowlist 160). Pitfalls: zone semantics are spread by NAME across civic/types.ts
(PURCHASABLE/HOME/BUSINESS zones, structure fit), founding-law seed, residence store, the orbital
scene (ZCOL/rings) and the Brain system prompt — part 2 must key them on zone `kind`. Removal is
"no parcels at all", so only land-less zones are removable until lots can be retired.
[[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | G2 part 2 built — land, map and Nous view keyed on zone kind (D-V3-40)
Purchase / caps / structure fit read `ParcelRegistry` zone kinds (boot + after each zone law);
`seed_ring` bills take `zone_id`; removal retires unclaimed lots; parcel feed carries
`zone_kind` + `zone_label`; orbital scene draws ring 4+ shells and live signs; Brain reads kind.
Pitfalls found: `parcel-registry.ts` contains a literal NUL byte (role-edge key separator) — grep
needs `-a`, Edit/Write refuse it; `seedZone` numbered from 0001 every call (would have overwritten
owned parcels on a second seeding — now continues); ring-expansion land was never persisted (lost on
restart — now `insertParcels`); `market.ts` read `ZONE_TAX_BPS[zone]` directly (undefined for a new
zone, ignored Polis overrides). [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | G3 built — Grid identity profile from the audit chain (D-V3-40)
Read-only projection: activity share (trade / knowledge / making / civic / social / settling) over
the latest 2,000 counted actions + the window before. Window is an action COUNT, not wall-clock
(wallclock gate). Event→activity map lives in `grid/src/identity/grid-profile.ts`; unmapped
families are substrate and excluded. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | Visibility switch built — creator changes public/private later (D-V3-41)
`POST /api/v1/operator/grid/visibility` (H5), saved in `grid_visibility` (v78), boot override,
`operator.grid_visibility_changed` (allowlist 161). Pitfall: the "creator" of a config-launched
Grid has no DID of its own — it is the operator; a Portal-created Grid will need the requester
carried into the Grid's config before this route can serve its creator. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | R0 started — Brain parity fixtures for the Rust port (D-V3-42)
Deterministic faculties recorded as language-neutral JSON (`brain/parity/`), replayed in the Brain
suite. Porting hazards found while recording: Python float text in canonical JSON (`1e-07`,
`1e+21`, `-0.0`) hashes differently from Rust's default; `exp(-1/500)` must match to the last bit;
hashes use raw UTF-8. Dev machine has no `cargo` and no Xcode — R1 and the SwiftUI shell cannot
start until they are installed. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-17] apply | Rust Brain begun — deterministic faculties pass the parity fixtures (D-V3-42)
`brain-rs/` (crate `noesis-brain`): needs, drives, subjective time, emotion, hashing, reply parsing.
What it took to match Python exactly: an own JSON reader (Python accepts `NaN`, duplicate keys,
big ints) and writer (Python float text; `ensure_ascii` on for the Telos hash, off for state
hashes); `powf` not `powi` for recency; the decay constant embedded as a literal; first-wins on
emotion ties; `str.strip()` also strips 0x1C–0x1F. The test reader needs serde_json's
`float_roundtrip` or fixture doubles can be off by one bit. Python bug seen: the reply parsers
raise `TypeError` when `action` is a list or object. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Python reply parsers: non-text action is "no decision", not a crash
The `TypeError` seen while porting is fixed in the three action parsers and pinned by two new
parsing-fixture cases (35). The Rust port already behaved this way. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Rust Brain slice 2 — personality, state hashes, memory scoring, prompts
Fixtures recorded first (ten now), then ported. Notes: prompt f-strings render missing / null
values as `None` and booleans as `True`, so the port carries a `py_str`; an empty due object counts
as no due; the handler's top-k is a stable descending sort over a newest-first pool; `str.split()`
whitespace differs from Rust's by 0x1C–0x1F. The wall-clock recency path is unused and not ported.
[[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Rust Brain slice 3 — goal handling and the system prompt
Twelve fixtures now. Notes: Rust `{:.N}` formatting matches Python's `:.Nf` / `:.0%` (checked on
51k values, ties included); Python truthiness and `x or y` chains over Grid feed values need
explicit helpers; installing Xcode without accepting its license makes `/usr/bin/git`,
`/usr/bin/python3` and the Rust linker all refuse to run. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Mac app begun — SwiftUI Nous viewer over the Rust core (D-V3-42)
Swift Package + Rust static library through a two-function C interface (text in, JSON out); no
Xcode project needed. Pitfalls: a SwiftUI HStack column squeezed to zero width wraps a character
per line and makes a tall blank gap; background accessibility cannot set a toolbar Slider, so the
tick is also an editable field. Observation: the live handler builds BiosRuntime without `ananke`,
so need crossings never lift drives; the linked form emits a spurious "falling" drive crossing one
tick later. Operator direction: every Local Nous Manager function moves into this app.
[[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Mac app is the Local Nous Manager; local chat endpoint; router bug
Found by using it: `ModelRouter.generate(prompt, options)` (the adapter call form the handler
uses) put options in the tier slot and raised ValueError, so a Brain on the Ollama router could
not answer any message; fixed. The shipped Nous configs name `qwen3:*` models; a Mac without them
gets no thinking until a model is chosen (app sets `LLM_MODEL`). Port 8090 may be taken. An app
killed by signal must stop its Brain itself. Chats are not stored as Nous memories and each
message is answered without the earlier ones — open product question. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Local chat: the Nous sees the conversation and remembers it
Mirrors the Portal conversation cycle (transcript prompt + `record_event` memory) in a dedicated
`local_chat` method; history comes from the app so it matches what the person sees and survives
a Brain restart. Memory is one event per exchange — a long chat adds many high-importance events;
watch whether that crowds retrieval. [[v3.0/CIVIC-ARCHITECTURE]]

## [2026-11-18] apply | Mac app: Configuration and Local AI as grouped settings
- Rust `config_edit`: config tree + choices, JSON merge patch, YAML writer (all strings quoted; order kept; comments dropped). FFI `noesis_config_json` / `noesis_config_patch`.
- App Configuration = grouped form + Text switch over one file text; patches only what changed. Local AI = grouped form.
- Finding: without `GRID_URL` the Brain passes `LLM_MODEL` (default `qwen3:4b`) as all three tier overrides, so a config file's `llm.models` never applies locally. Left out of the form; not changed in the Brain.

## [2026-11-19] apply | Mac app: Map screen (Portal's live map of Grids)
- `MapPane.swift`: WKWebView on the Portal map page; address setting `mapURL` (default `https://noesiis.com/worldmap/orbital`). No native redraw — one map, the Portal's.
- Open: the app and the Portal page do not share identity; entering a Grid as this Nous still goes through Portal sign-in.

## [2026-11-19] apply | Mac app: Grid Access (join a Grid through the existing Portal → Polis pipeline)
- `GridAccessPane.swift`: Grid address → `GRID_URL`; shows Nous ID + Brain public key (read from `brain-wire.key`, Brain remains sole key maker) + status from cached `civic-did`; opens Portal sign-in / registration in Map. No new issuance path.
- Fix: app passes `NOUS_NAME` from the config; before, every config ran as `sophia`.
- Open: a joined Brain's models come from Grid operator settings (default `qwen3:4b`), overriding the app's Local AI choice — unverified end to end; no live enrolment was run.

## [2026-11-19] apply | Mac app: account sign-in with stored auth
- `GridAccount.swift`: email sign-in on the existing Portal endpoint; password in Keychain; cookie into WKWebView; auto re-sign-in (session 24 h, renew at 20 h). `joinGrid` switch separates "my account" from "my Nous joins".
- First Swift test target (`swift test`, stub Grid via URLProtocol). No live sign-in run.

## [2026-11-19] apply | Orbital map: click-to-full-zoom and the Grid description card
- `grid-focus.ts` fit distance (radius, fov, aspect); scene click focuses a Grid; drag ≠ click.
- `grid-description.ts` + `GridCard.tsx`: description built only from existing public reads; missing source → line omitted. "Members" = live Nous count (no human-member count endpoint exists).
- Not deployed; the Mac app's Map shows the live site, so it appears there after a dashboard deploy.

## [2026-11-19] deploy | Grid + dashboard from research/atlas-simulator (operator-requested)
- Prod checkout moved main@75a8477 → work branch. v77/v78 dry-run on MySQL 8.0 first. nginx force-recreated. Live checks 200; Portal map, private/public Grid list, zone freeing, Grid card now live.
- Learned: `deploy.sh` cannot check out a branch the server never fetched; the Grid clock (tick, startedAt) restarts on every Grid restart — it is not a founding date.

## [2026-11-19] apply | Map: human member count + six-language switch
- Human member = human with an active Civic-DID in the Grid (same rule as the private-Grid unlock). `/portal/grids` full entries carry `human_members`; locked private entries do not.
- `map-i18n.ts`: en / es / ja / ko / vi / fil for the map's own wording only; Grid-supplied text stays as written. Scope is the map page, not the whole dashboard.
- Deployed 2026-11-19 (operator-requested; `deploy.sh` with the branch env now works since the server has the branch). Live: `human_members: 2`. Translations not reviewed by native speakers.

## [2026-11-19] apply | Mac app: Brain kept running (restart, model-server watch, notification)
- `keepBrainRunning` set by Start, cleared only by Stop; restart backoff 2→60 s without end; model server polled every 15 s; one notification per outage after 5 failures.
- Email alert NOT built: no mail-sending path exists in app or Grid (only the operator SNS watchdog). Needs an operator decision on a mail service.

## [2026-11-19] apply | Email alert route (AWS SES) for a Local Nous that cannot stay running
- `POST /api/v1/portal/nous-alert`: session-only, recipient = the account's own address, fixed wording, 1/hour per kind; no audit event. `ALERT_EMAIL_FROM` unset → 503.
- SES setup (identity, sandbox exit, role permission, env) is the operator's; steps in `.planning/implementation/alerting.md`. Grid deployed 2026-11-19; no real mail sent.

## [2026-11-19] apply | Mac app: Local AI usage graphs
- `LocalAIUsage.swift`: `ps` totals for the model server's processes + Ollama `/api/ps`; Swift Charts, 3 s samples for the whole app run, last hour kept in memory (first version sampled only while the screen was open).

## [2026-11-19] ingest | Grid extension research + discussion plan
- New page [[grid-extension-research-2026-11]]; index updated. Four surveys (2 code, 2 web). Plan page `docs/noesis-grid-extension-plan-2026-11-19.html` — for discussion, nothing decided, ROADMAP untouched.

## [2026-11-20] ingest | Grid visualization research
- New page [[grid-visualization-research-2026-11]]; index updated. Three surveys (engines, engagement, code) + NVIDIA page. Verdict: stay in the browser; the gap is live Nous on screen, then art. For discussion; nothing decided.

## [2026-11-20] decide | Visualization: audience and budget (operator, in discussion)
- Audience = visitor, Grid joiner and Nous owner, all three (one funnel). Budget = none → browser only, free CC0 assets, no GPU streaming, no paid generators. Recorded on the research page ("Settled in discussion"). Other decisions still open.

## [2026-11-20] decide | D-V3-43 — the Grid is shown to people first
- Operator: public Grid shows Nous names + public actions live to anyone; never private conversation or balances. Life before look (look alongside, slower). Written to `wiki/1-design/decisions.md` (D-V3-43) and the research page. Still open: regions↔rings mapping; relaxing the map's "unpkg, no build" rule; ordering against the Work Card.

## [2026-11-20] apply | V0 — live, true map (D-V3-43 first step)
- Public roster: `balance_wei` operator-only. New `GET /api/v1/scene/events` — closed list of 19 public acts, names only for acts under the Nous's own DID, land events without owner (D-58-08 kept), ballots without voter, no text/amounts. Map: 5 s poll, "Happening now" list, event-driven pulse, targeted re-read; decorative packets removed. Not deployed.
- Open for V1: regions↔rings mapping; whether public speech text and land owners' names may be shown.

## [2026-11-20] decide | D-V3-44 — Grid Station View; a city inside the rings
- Operator: the Grid's screen is the "Grid Station View" (not a map); levels outside → district cutaway → interior (option D); buildings are a city along the inside of each ring, not capsule modules. Written to decisions.md, the visualizer skill, the research page. Open: building orientation in a ring.

## [2026-11-20] apply | District level of the Grid Station View (first cut)
- Roofs toward the centre (operator). `district-layout.ts` + `district-scene.ts` + `DistrictView.tsx`: a zone as a street along the ring's curve, lots both sides, code-drawn buildings by kind/condition/occupancy from the lot feed; event flash from the scene feed. Not deployed. Next needs approval: regions→places mapping to put Nous in it.

## [2026-11-20] apply | Nous in their districts (V1 first cut)
- Operator approved regions→places. `nous-places.ts` (placing + kind fall-back, roster reader, event following); figures, names, act signs in the district scene; roster bar. Not deployed. Not yet seen with real moves (needs a Nous that acts).

## [2026-11-20] deploy | V0 + district level + Nous in districts (operator-requested)
- Live and correct. Finding: the live Nous do not act — last 1,000 record entries are ticks; no Brain container on the server. The view is truthful and therefore still. Interest now depends on running Brains (operator's secret) and on Nous taking more than two kinds of action (X2).

## [2026-11-20] apply | A wire-connected Brain decides on the Grid's clock
- Finding: the Grid never calls a Brain; the Brain ignored firehose ticks. No Brain anywhere would have acted. Operator chose the Mac as where the Nous think. Built `TickDriver` (Brain) and `restoreCivicDids` (Grid start). Unit-tested both sides; not run end to end, not deployed. Next: enrol the founding Nous (operator, Portal), then offer the Nous more actions (move, speak first).

## [2026-11-20] apply | A Nous can walk (move in the decision cycle)
- Correction: the decision cycle already offered work/speak/rest; "only two actions" described the economic cycle. Added move, limited to regions the Grid says are reachable. gpt-oss needed think="low" (ignored think=false, empty answers). Real-model trial 9/9 valid, all moves — watch for a Nous that only ever walks. Not deployed; needs enrolled Brains to be seen live.

## [2026-11-20] deploy | Grid with the Brain binding restored at start (operator-requested)
- Live and healthy. Live registry: no founding Nous has a Brain key or Civic-DID yet, so enrolment from the operator's Mac is unblocked. Still still: no Nous acts until enrolled and its Brain runs.

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

## [2026-11-21] lint | Wrong branch; per-tick upkeep; Grid reclaim path fixed on main (sheet v0.2.4)
Operator said to fix the two Grid defects. Findings while doing it:
(1) AUTHOR ERROR — every code-derived statement about "production" in the sheet was read from
`main`, while production's Grid runs `research/atlas-simulator` (57 commits not on main). On that
branch commit `aeee7173` (2026-11-20) already added `brain/.../wire/tick_driver.py` (firehose tick
-> on_tick: the sheet's "eighth link") and `GridCoordinator.restoreCivicDids` (the "restart
unbinds runners" defect; live on production). The author's duplicate runner-binding fix was
dropped; the clock follower on main now duplicates TickDriver.
(2) An independent review of the reclaim fix found the path broken more deeply, confirmed in code
on both branches and reproduced by tests against the real ParcelRegistry: upkeep charged on EVERY
tick (memory never learned `lastUpkeepTick`); a reclaimed parcel owned by the treasury in memory
and by nobody in the database, reclaimed again every tick and unpurchasable until restart; razed
structure `undefined` -> public parcel feed 500; `persistReclaim` leaving structure name/type,
shop binding and allowlist. All four fixed on main (`createUpkeepRegistryFacade`,
`ParcelRegistry.stampUpkeep`, reclaim -> no owner; BEHAVIOUR CHANGE: memory no longer reports
TREASURY_DID as owner of a reclaimed parcel). Grid suite 4214 green; in shuffled order five older
tests in four unrelated files fail (pre-existing order dependence). NOT on production.
(3) Brain: property cycle now off unless `BRAIN_PROPERTY_CYCLE=on`. Brain suite 1432 green twice.
Open, not fixed: role edges survive reclaim; condition not persisted between periods; failing
persistReclaim splits memory and DB; tick stamps not comparable across a Grid restart.
A raw NUL byte in `grid/src/civic/parcel-registry.ts` (in a comment) made grep treat the file as
binary and hid it from text search; removed on main, still present on the production branch,
where it makes that file a binary merge conflict. Pitfalls carried forward: read the branch
production runs before describing production; `grep` silently skips files with a NUL byte.

## [2026-11-21] deploy | Upkeep fix live on production; one trunk; clock follower corrected
Operator approved "merge and deploy". The other session had already merged main into
`research/atlas-simulator` (7a87b895); its resolution of `grid/src/civic/parcel-registry.ts` was
read and is correct (NUL byte gone, fix intact). Gate in a fresh clone: Grid tsc clean, 4324
tests (one run: 2 failures in `health-watchdog-alert-sns.test.ts`, a setTimeout(0) race that the
merge does not touch; passes alone and in the second full run); Brain 1509 twice. Deploy carried
four Grid source files and no migration. Server checkout fast-forwarded 954107c -> 7a87b89
(`git add` of the bind-mounted nginx template first, so the ff did not rewrite it; inode kept),
grid image rebuilt, container replaced, healthy in 15 s; rollback image
`noesiis-grid:pre-upkeep-fix-2026-11-21`. Verified twice on production: public endpoints 200,
53 parcels / 0 owned, tick restarted from 0; and the same in-memory scenario inside the running
container vs the old image: funded owner charged 1 vs 50 times in 50 ticks, reclaimed parcel
resold vs refused. PR #29 (`research/atlas-simulator` -> main) merged; trees identical.
Then found in my own clock follower, now that both clock mechanisms are on one branch: it posted
every action a second time (`on_tick` already forwards), and it could start a decision alongside
one the firehose TickDriver was running. Fixed: follower never posts; `on_tick` runs one decision
at a time. Brain 1511 twice. Pitfalls carried forward: the server's fetch refspec tracks only
`main`, so `origin/<other-branch>` there is stale — compare against FETCH_HEAD; on this machine
`rm` is aliased, use `/bin/rm`; the server checkout is no longer dirty.
Still open: §19.8 rows 5-7; links 1-3; whether the firehose reaches a Brain off the Grid's host
(needs an enrolled Brain's token); the catalog half of Q17.

## [2026-11-21] fix+deploy | Reclaim: roles end, condition and upkeep periods survive a restart
Operator: "Yes, fix them" (sheet §19.8 rows 5-7). PR #37, main db3db4f4, deployed to production.
(5) `ParcelRegistry.reclaimToTreasury(address, tick)` stamps `revoked_tick` on every active role
edge of the parcel (kept as history); the scanner emits `zoning.role_revoked`
(`severance_complete`) per ended role before `zoning.parcel_reclaimed`; IOUs are not drained.
(6) `ParcelStore.persistUpkeep` writes `condition` with the stamp and missed periods.
(7) `UpkeepScannerDeps.ticksBeforeStart` = `ticksRecorded(chain.all())`, computed in main.ts after
the chain is restored and before the clock starts; due-ness and `last_upkeep_tick` use lifetime
ticks (that + clock tick); events and the ledger keep the clock tick. Boot logs
`[civic] upkeep counts from lifetime tick N`. A stamp ahead of the count is restamped with a
warning, no charge.
Two review rounds (unanchored reader, read-only) changed the fix: removed a dead UPDATE of
`civic_parcel_roles` (nothing writes that table); the reclaim is now written DATABASE-FIRST (a
refused write changes nothing and is retried next sweep — swallowing it after the memory
transition would have let a buyer inherit the former owner's row); a failed ladder write warns
instead of rejecting out of the un-awaited sweep; `advanceCondition`/`reclaimToTreasury` require
the tick; `house-2-e2e` now composes the facade exactly as production. Each fix undone in turn
fails a test. Grid 4340 green twice, tsc clean.
Production: boot log lifetime tick 476011 == 476011 `tick` rows; last tick before the restart
(99) persisted, no gap; 0 owned, 0 stamped rows (no conversion needed). Deployed by
fast-forwarding `research/atlas-simulator` to main, then the server checkout; rollback image
`noesiis-grid:pre-reclaim3-2026-11-21`.
Open, reported, not changed: `persistRole`/`persistRoleRevoke` have no caller (roles are lost at
any restart); `board/complete` has no role check, `claimTask` no parcel check; `ZONE_ID_RE`
allows digits but the audit producers' `PARCEL_ID_RE` does not (paid branch would re-charge every
tick for such a parcel); a persist failure after a successful charge is logged as
`upkeep_charge_failed` and recharged after a restart; re-grant resumes trust_score across owners.

## [2026-11-22] fix+deploy | Roles saved; task board tied to its parcel; zone ids with digits
Operator: do the list §19.10 left open. PR #41 (main 6617edae), deployed to production; PR #40
committed the rules block that sat uncommitted in the main checkout's CLAUDE.md, and the main
checkout is at main again.
Roles: grant, invite and revoke routes call `persistRole` / `persistRoleRevoke` DATABASE-FIRST
(`pendingEdge` builds the row before memory changes); new `ParcelStore.persistRoleTrust` after a
completed task (failure logged, completion stands); `persistReclaim(parcel, tick)` ends the
parcel's role rows and resets the parcel row in ONE TRANSACTION (`pool.getConnection`); invite
mints a guest edge only when the invitee holds no role. Board: `getAgreement` in cowork.ts;
claim/complete 404 unless `task.parcel_id` is the URL parcel; claim 409 `task_host_left` unless
the poster is still owner/staff; NO role check on completion (only the host can complete and
completion pays the worker — D-NH-06); host === worker earns no trust and emits no
`zoning.cowork_session`. Zone ids: the 14 `PARCEL_ID_RE` copies in `grid/src/audit/` accept
`[a-z0-9_]+` in the zone segment. Scanner: period recorded (memory, then database) BEFORE the
event in the paid and ladder branches; `emitOrWarn` around every event write.
Grid 4367 green twice, tsc clean; each guard undone fails a test; two review rounds.
Production: lifetime tick 476151 == 476151 `tick` rows; the new statements run against the real
database with a non-existent parcel id (reclaim transaction, role writes, upkeep write, hydrate
incl. the roles JOIN) all ok, row counts unchanged; 0 owned, 0 role rows. Rollback image
`noesiis-grid:pre-roles-2026-11-22`.
Corrected: my claim that IOUs/agreements cannot be saved because ids restart at 0 was FALSE —
`upsertIou` / `upsertAgreement` (called by hydrate) advance `seq` past stored ids.
Open: `persistIou` / `persistCowork` still have no caller (debts, posted and claimed tasks lost at
restart; obstacles: PK is the id alone, not per grid; ledger hooks are synchronous and
`completeTask` / the severance drain pass none); narrow grant-vs-reclaim race across the awaited
write; staff can re-invite a revoked holder; trust resumes across owners; 404-vs-403 on complete
reveals a task's parcel; parcel seq > 9999 fails `\d{4}`; `health-watchdog-alert-sns.test.ts` flaky.
Pitfall repeated: zsh `"$T:refs/..."` — write `"${T}:refs/..."`.
