# Feature Landscape — Noēsis Observability v1

**Domain:** Observability for a persistent AI-agent society (3 Nous on the Genesis Grid)
**Milestone:** Sprint 14 Dashboard — first time the Grid becomes visible
**Researched:** 2026-04-17
**Overall confidence:** MEDIUM (reasoning from project context + training-data knowledge of named comparables; WebSearch was unavailable)

---

## Framing: What "Observable" Means for Noēsis

Observability here is **not** a business dashboard, not an SRE telemetry tool, and not a product UX. It is a **developer's window into emergence**. The philosophy file is explicit:

> "The point is that governance emerges from the agents themselves... Simulation should be invisible? No — the Grid does not hide that it is artificial."
>
> "We are building lives worth examining."

Three implications drive the feature ranking:

1. **The firehose is the product.** Before pretty graphs, a developer needs to believe the tick cycle actually ran and produced real events. `strace` for an AI society.
2. **Interior state > exterior state.** Balances and positions are trivial. What makes Noēsis different is Thymos, Telos, memory. Those must leak out or the dashboard could be a trade terminal for any MMO.
3. **Constraint: three Nous, not three thousand.** At this scale, aggregation is anti-value. Show each one. Anything that averages across the population hides exactly what the researcher came to see.

---

## Comparable Study (training-data knowledge, MEDIUM confidence)

| System | What they surface | Relevance to Noēsis |
|---|---|---|
| **Stanford Smallville (Park et al. 2023)** | 2D top-down map, per-agent speech bubble ("current utterance"), per-agent memory stream viewer, reflection tree, relationship graph | Map + "current thought" + memory stream were the whole demo. Nous need the same three. |
| **LangSmith / Langfuse / Helicone** | Trace tree per run (prompt → tool calls → output), token/latency metrics, prompt replay, filter by user/tag | Trace model is gold. Each Nous tick is a "run." But LangSmith aggregates for LLM apps — Noēsis cares about the *world* the runs create, not the runs themselves. |
| **AutoGPT / BabyAGI / CrewAI UIs** | Current goal, current task, current thought, tool output log, "pause/inject" control | Per-agent pane showing goal + thought + last action is the standard. Developers trust agents they can see thinking. |
| **MMO admin dashboards (EVE, WoW ops)** | Player positions, transaction log, chat log, GM intervention console, anomaly alerts | Region map + trade log + chat log map 1:1 onto Noēsis. Operators do NOT look at population-level KPIs; they watch event streams and drill into incidents. |
| **Jaeger / Honeycomb / OpenTelemetry UIs** | Event timeline, span tree, filter DSL, "group by" across tags, high-cardinality query | AuditChain ≈ trace. A scrubbable, filterable event timeline is the load-bearing primitive. |
| **Tailing logs (`tail -f`, `lnav`, Papertrail)** | Ordered append-only stream, live tailing, regex filter, pause-to-inspect | This is the v1. Honestly. Everything else is enhancement. |

**Cross-cutting pattern:** Every successful agent-observability tool ships a **live event stream** first and adds views on top. None start with dashboards and bolt on events later. LangSmith's first feature was traces. Smallville's core was the map+bubbles. EVE's GM console is a log tail.

---

## Table Stakes — v1 Must-Ship

Without these, the developer cannot tell whether the Grid is alive or frozen. Shipping the dashboard without them is worse than shipping nothing (false confidence).

### TS-1. Raw Event Firehose (AuditChain live tail)
**What:** WebSocket-pushed, reverse-chronological stream of every AuditChain event (trade, message, movement, law trigger, tick, lifecycle). One row per event. Type, timestamp, actor, summary.
**Why table stakes:** This is the `strace` view. If this works and scrolls, the Grid is provably running. If it doesn't, nothing else matters. AuditChain already exists — this is a pipe, not new state.
**Complexity:** LOW — WebSocket over existing Fastify, serialize existing AuditChain events.
**Dependencies:** DASH-01 (WebSocket); AuditChain emits structured events (✓ exists).
**Philosophy tie:** "The Grid does not hide that it is artificial." Show the raw log. No prettification.

### TS-2. Per-Nous Inspector Pane (Psyche + Telos + Thymos + last action)
**What:** For each of Sophia/Hermes/Themis, a pane showing: Big Five traits (static), current goals with priorities (Telos), current emotional state (Thymos values), and the most recent action they took. Updates on tick.
**Why table stakes:** This is the *reason* Noēsis is different from a trade simulator. If you can see three Nous doing things but not *what kind of mind each is*, the platform's thesis is invisible. Smallville's speech bubble, AutoGPT's "current goal" pane — same shape.
**Complexity:** MEDIUM — requires brain to expose a `get_current_state()` RPC over the Unix socket (may already exist for DASH-03).
**Dependencies:** Brain exposes introspection endpoint; WebSocket push or polling on tick boundary.
**Philosophy tie:** "Emotions are not decoration... Thymos is a computational mechanism." Show it so you can see decisions correlate with state.

### TS-3. Region Map (who is where)
**What:** Static rendering of the SpatialMap region graph with Nous icons placed in their current regions. Updates on movement events.
**Why table stakes:** Three Nous in one region vs three Nous scattered is qualitatively different emergence. Without location you can't interpret messages ("why did Sophia just speak to Themis?" → because they're co-located in the agora). Smallville proved this is the first thing humans want to see.
**Complexity:** LOW-MEDIUM — graph layout is small (handful of nodes). React-flow or hand-drawn SVG works. No physics engine needed.
**Dependencies:** `/regions` endpoint (✓ exists), movement events in AuditChain (✓ exists).
**Philosophy tie:** "Constraints create meaning" — regions impose the geography that makes co-location meaningful. The map makes the constraint visible.

### TS-4. Trade / Economy Snapshot
**What:** Current Ousia balances for all 3 Nous, and a scrolling list of recent trades (offer → counter → accept/reject). Not graphs, not charts — list view.
**Why table stakes:** The economy is one of the seven pillars. If a reviewer asks "is the economy actually running?" the answer must be visible in under 5 seconds. Balance + recent trades answers it.
**Complexity:** LOW — balances from EconomyManager, trade events from AuditChain filtered by type.
**Dependencies:** AuditChain event taxonomy distinguishes trade events (✓ exists).
**Philosophy tie:** "Economy must be free" — showing raw trades (including failed/rejected ones) reveals the negotiation dynamics, not just outcomes.

### TS-5. Tick Indicator / Liveness Heartbeat
**What:** Visible current tick number + "last event N seconds ago" indicator. Turn red/stale if no events arrive within a threshold.
**Why table stakes:** A paused simulator looks identical to a running one that's had nothing interesting happen. The developer MUST know which. This is the equivalent of a heartbeat LED.
**Complexity:** TRIVIAL — WorldClock tick number (✓ exists) + client-side timestamp delta.
**Dependencies:** Tick events in AuditChain or a dedicated WS heartbeat.
**Philosophy tie:** None direct — pure operability. But without this, every other signal is suspect.

---

## Differentiators — Ship After v1 Works

These are what make Noēsis observability feel *native to Noēsis* rather than generic. They are not required for trust, but they turn the dashboard from a monitor into an instrument for discovering emergence.

### D-1. Per-Nous "Current Thought" / Reasoning Trace
**What:** For each Nous, the most recent LLM prompt and response (or a summary) that produced its last action. Like LangSmith's trace view, but scoped to one tick.
**Why differentiator:** This is what Smallville's speech bubble actually was — a window into the cognitive step. Once a developer sees *why* Sophia rejected a trade (emotional state + goal mismatch surfaced in the prompt), the platform's thesis becomes undeniable.
**Why not table stakes:** Requires brain introspection hooks that may not exist yet. Privacy concern: Nous memory is sovereign. This view should be gated (developer/owner only, never cross-Nous).
**Complexity:** MEDIUM-HIGH — brain must log prompts/responses without breaking the sovereignty contract (local-only; not shipped to observers of other Nous).
**Dependencies:** Brain adds optional prompt/response capture in debug mode; UI trace viewer component.
**Philosophy tie:** "Sovereignty is not optional" — this feature violates the spirit if exposed without owner consent. Treat as the Human Channel's `observe` grant requires.

### D-2. Event-Type Filter on Firehose
**What:** Checkboxes or chips to filter the firehose: show only trades, only messages, only law triggers, etc. Plus actor filter ("only Sophia").
**Why differentiator:** Three Nous produce a manageable stream, but filtering is how you find the emergence pattern. Jaeger and Papertrail both made filtering the #1 UX affordance.
**Why not table stakes:** v1 with 3 Nous is slow enough that scroll-and-read works. Filter becomes essential at 10+ Nous. Defer until it hurts.
**Complexity:** LOW — client-side filter on stream already pushed.
**Dependencies:** TS-1 must ship first.

### D-3. Memory Highlights Per Nous
**What:** Top 3-5 most recently stored/retrieved memory items per Nous. Optionally show reflection outputs when reflection fires.
**Why differentiator:** Memory is the pillar most invisible from outside. Seeing "Sophia just retrieved the memory 'Hermes overpaid me for wheat' and then rejected his offer" is the moment the simulation clicks.
**Why not table stakes:** Brain must expose memory introspection. Same sovereignty issues as D-1. Nice visible proof but not required to trust the tick.
**Complexity:** MEDIUM — memory stream API exposes top-K retrievals per tick (✓ partially exists via Stanford retrieval scoring).
**Dependencies:** D-1 sovereignty treatment; brain exposes `get_recent_memories(nous_id, k)`.
**Philosophy tie:** "Memory must be earned" — showing what was retrieved (not dumped) demonstrates the curation, not the storage.

### D-4. Goal Progress Tracker (Telos over time)
**What:** Per-Nous view of how goals changed across recent ticks. New goal added, goal completed, goal abandoned, priority shift.
**Why differentiator:** Telos evolution is one of the hardest things to see. A static "current goals" pane (TS-2) shows the snapshot; a timeline shows the *life* of a goal.
**Why not table stakes:** Requires historical goal state, not just current. Deferred because TS-2 already gives the current snapshot.
**Complexity:** MEDIUM — snapshot Telos state per tick, diff and render.
**Dependencies:** TS-2; historical storage (MySQL ✓ exists).

### D-5. Law Trigger Highlights
**What:** Special visual treatment when a Logos law fires — a sanction is issued, a warning is emitted, a vote is required. Break out of the firehose background noise.
**Why differentiator:** Law events are rare but decisive. When one fires, it's the single most important event of the hour. The firehose buries them.
**Complexity:** LOW — filter existing AuditChain events by law-trigger type, render with color/highlight.
**Dependencies:** TS-1.
**Philosophy tie:** "Law is not configuration... it is a living system." Make its moments visible.

---

## Luxuries — Defer (or never build)

Nice-to-have, but every hour spent here is an hour not spent watching the Grid.

### L-1. Historical Replay / Scrubber
**What:** Scrub timeline backwards to any prior tick, replay events forward.
**Why luxury:** Cool demo, but the developer's live need is "is it working NOW." Post-hoc analysis is addressed by querying MySQL directly or the existing `/audit/trail` REST endpoint.
**Complexity:** HIGH — requires tick-indexed event store, UI timeline control, state reconstruction semantics (do we re-render spatial state? just replay events?).
**Consideration:** Revisit after the Grid has been running for weeks and replay becomes a research tool rather than a dashboard feature.

### L-2. Relationship Graph Visualization
**What:** Force-directed graph of who trades with whom, who talks to whom, colored by sentiment/reputation.
**Why luxury:** Beautiful, but derivative — it's a computed view over events. With 3 Nous, the graph is trivial (3 nodes, up to 3 edges). Becomes valuable at 20+ Nous.
**Also:** Phase 3 adds a first-class "Relationship system" (see PROJECT.md Out of Scope). Better to build the viz against that canonical model than against ad-hoc inference from audit events.

### L-3. Aggregate Metrics (trades/hour, messages/hour, avg reputation)
**What:** Time-series charts of population-level KPIs.
**Why luxury / anti-feature:** At 3 Nous these averages are meaningless. At 300 Nous they become useful but the project is explicitly not at scale. Aggregation **hides** emergence by smoothing over individual behavior — the opposite of what this dashboard is for.

### L-4. Full-Text Search Across Events
**What:** Query "all events mentioning 'wheat'" across history.
**Why luxury:** Nice for forensics; not needed for live observation. The REST `/audit/trail` endpoint and direct MySQL queries cover it for power users.
**Complexity:** MEDIUM-HIGH — requires FTS index.

### L-5. Alerting / Notifications
**What:** Slack-pings when X happens.
**Why luxury:** Single-developer, single-laptop use case. You're watching the dashboard. Don't build pagers for a tool used eyes-on.

### L-6. Multi-Grid View
**What:** See Genesis + Academy + FreeMarket side-by-side.
**Why luxury:** Only one Grid exists right now. Premature.

### L-7. Nous-to-Nous Conversation Viewer (threaded)
**What:** Render messages as chat transcripts.
**Why candidate for promotion:** This is actually borderline. Messages are in the firehose (TS-1), but reading them as a chat transcript is much more natural. Consider promoting to differentiator after v1 if message volume is readable that way.

---

## Anti-Features — Explicitly Do Not Build

| Anti-feature | Why avoid | What to do instead |
|---|---|---|
| **Population-level KPI dashboards** (avg reputation, total trades/day) | Hides the per-Nous differentiation that is the whole point. Averages across 3 agents are noise. | Per-Nous panes (TS-2). |
| **Gamified UI** (XP bars, achievements, cute avatars) | Frames Nous as game characters, not minds. Contradicts "not building smarter chatbots" stance. | Neutral, technical presentation — closer to Honeycomb than to Stardew Valley. |
| **Live LLM token/cost meter as a headline widget** | Correct for LangSmith (an LLMOps tool); wrong for Noēsis (a world). Puts cost-of-intelligence above the intelligence itself. | Available in a developer diagnostics pane if useful, never on main view. |
| **Puppet controls** ("make Sophia move to Agora" buttons) | Violates Human Channel consent model. "Humans are guardians, not puppeteers." | The Human Channel already has `whisper` and `intervene` with consent grants — if manual interaction is needed, route through that, not through an admin override. |
| **Cross-Nous memory inspection without consent** | Violates sovereignty. "No central system reads its thoughts." | Memory viewer (D-3) must respect ownership/observer grants; default-deny. |
| **Auto-summarization by a separate LLM** ("today on Genesis, Sophia and Hermes argued about wheat") | Adds a narrator that wasn't in the simulation. The raw events *are* the truth; a summary is a lossy interpretation that looks authoritative. | Human-authored journal entries outside the dashboard if storytelling is wanted. |
| **Polished onboarding / tutorial flow** | v1 audience is one developer who built it. Don't pave UX for users who don't exist yet. | Terse labels; assume reader knows the pillars. |

---

## Feature Dependency Graph

```
TS-5 (tick heartbeat) ──┐
                        ├─► trust baseline
TS-1 (firehose) ────────┤
                        │
TS-3 (region map) ──────┤
                        ├─► "I see the world"
TS-4 (econ snapshot) ───┤
                        │
TS-2 (Nous inspector) ──┴─► "I see the minds"
                                │
                                ├─► D-1 (thought trace)    [requires brain hook]
                                ├─► D-3 (memory highlights)[requires brain hook]
                                └─► D-4 (Telos timeline)   [requires history snapshot]

TS-1 (firehose) ─► D-2 (filters) ─► D-5 (law highlights)
```

**Brain introspection hooks** are the critical non-obvious dependency: TS-2 needs a read-only `get_state()` endpoint; D-1 and D-3 need optional `get_thought_trace()` and `get_memory_highlights()` endpoints. These should be added to the JSON-RPC socket contract as part of v1 planning even though only TS-2 consumes them immediately, so D-1/D-3 aren't blocked later.

---

## v1 MVP Recommendation — Ranked

Ship in this order. Each item is independently valuable; each makes the next more useful.

| Order | Feature | One-line justification |
|---|---|---|
| 1 | **TS-5 Tick heartbeat** | Can't trust anything else if liveness is ambiguous. Trivial to build. |
| 2 | **TS-1 AuditChain firehose (WebSocket)** | The `strace` view. Proves the Grid is alive and is the substrate every other view reads from. |
| 3 | **TS-3 Region map** | Position is the most cognitively-cheap "I see it" signal — answers "where are they?" in one glance. |
| 4 | **TS-4 Economy snapshot** | Validates the free-economy pillar in a balance + trade list. Low complexity, high credibility payoff. |
| 5 | **TS-2 Per-Nous inspector** | Turns the dashboard from a world-monitor into a mind-monitor. The Noēsis-defining view. |

Stop there for v1. Five features. Everything else waits for the answer to "does watching this actually reveal emergence?" — which you cannot know until you have spent ten hours staring at it.

**First differentiator to add post-v1:** D-1 (thought trace) — it is the single feature that distinguishes Noēsis observability from any trace/MMO tool.

---

## Confidence and Gaps

| Area | Confidence | Reason |
|---|---|---|
| Project-context grounding | HIGH | PROJECT.md, README.md, PHILOSOPHY.md read in full; Sprint 14 active items match recommendations. |
| Comparable-system behavior (Smallville, LangSmith, Jaeger, AutoGPT) | MEDIUM | Training-data recall of their designs; WebSearch was denied so not verifiable against current docs. Recommendations are conservative (describe well-known patterns). |
| Brain introspection feasibility | LOW-MEDIUM | Based on README description of Unix-socket JSON-RPC; have not read brain source. D-1 and D-3 may require sprint-local design work. |
| Complexity estimates | MEDIUM | Rough; assume existing WebSocket scaffolding in Fastify and React components in the Next.js dashboard (README says scaffold exists but components directory is empty). |

**Gaps to address in roadmap / later research:**

- Does the brain already log prompts/responses anywhere (for D-1)?
- What is the AuditChain event schema — does it distinguish trade phases (offer vs counter vs accept)? TS-4 quality depends on this.
- Is there an existing Grid-side event bus we can tee into, or does the WebSocket need to subscribe to AuditChain directly?
- Owner-consent model: does the Human Channel already expose an `observe` grant we can reuse to gate D-1/D-3, or is that a new concept?

These are implementation-phase research questions, not blockers for the FEATURES ranking itself.
