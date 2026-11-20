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
