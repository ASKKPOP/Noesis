# Noēsis Object & Configuration Schemas — Research-Grounded Design

**Status:** Research synthesis + design (for review)
**Date:** 2026-06-05
**Method:** Deep-research harness — 5 search angles, 23 sources fetched, 109 claims extracted, 25 adversarially verified (3-vote, 2/3-to-refute). Run `wf_904ed6ba-97b`.
**Purpose:** Answer "how is each object *defined and configured*, and what must it minimally have to *run*?" — grounded in external authoritative sources, then mapped onto Noēsis's existing config files.

---

## Confidence key

| Mark | Meaning |
|------|---------|
| **✅ VERIFIED** | Survived 3-vote adversarial verification (≥2/3), multiple primary sources. Treat as solid. |
| **🟡 SOURCED** | From a fetched primary/secondary source but not in the verified top-25 (verification budget ran out). Real source, lower assurance. |
| **⚪ DESIGN** | Not externally grounded — engineering design from the existing Noēsis code + standard practice. Marked honestly. |

> **Headline gap (flagged by the harness):** the **Nous (agent) object is thoroughly grounded** (memory + goals). The **Grid (world) object is NOT** — no external schema for tick/time, spatial graph, economy, or governance survived verification. Personality/emotion are 🟡 only. A second targeted research pass is recommended for Part B (see §9).

---

# Part A — The Nous (agent) object

The research strongly supports a layered agent object: **identity → personality → affect → drives → goals → memory → runtime/LLM**. Below, each layer's schema, its citation, and how it maps to today's `brain/data/nous/<name>.yaml`.

## A1. The minimal "what it takes to run" (✅ VERIFIED)

A BDI agent's **minimal static configuration** to start is **two persistent structures**: a **belief base** (initial state as ground facts) and a **plan library** (set of plans). Each plan has a fixed three-part schema — **triggering event + context** (the head) and a **body** (sequence of actions/sub-goals); a plan is *applicable* only when its context is a logical consequence of current beliefs.
*Source: Jason/AgentSpeak tutorial (Bordini/Hübner), lia.deis.unibo.it. Claims [14] 2-1, [15] 3-0.*

> **Design consequence:** the programmer-supplied **beliefs + plans/goals are the "goals + settings" an agent needs to start.** This is exactly the user's question — without a goal-and-setting seed, the agent has nothing to deliberate over and idles. Noēsis's `sophia.yaml` *is* that seed (telos = goals; psyche/ananke = settings).

At **runtime**, the engine adds dynamic state beyond the static object: a set of **events**, a set of **intentions** (each intention = a *stack of partially-instantiated plans*), and **three selection functions** (event `S_E`, option/plan `S_O`, intention `S_I`). External events create new intentions = separate focuses of attention.
*Source: same. Claim [16] 3-0.* → In Noēsis, **the Grid tick drives this reasoning cycle**: perceive → update beliefs → generate events → select → execute one intention step.

## A2. Identity (⚪ DESIGN, matches current code)

```yaml
identity:
  name: string                 # display name, e.g. "Sophia"
  did: string                  # GENERATED at spawn from Ed25519 keypair — not authored
  archetype: string            # optional flavor label ("The Philosopher")
  birth_tick: int              # tick of spawn (NOT wall-clock — Noēsis L1 rule)
```
DID is **derived, not configured** (keypair → `did:noesis:nous:<key>`). Everything else is seed data. *No external schema needed; this is standard identity modeling.*

## A3. Personality — Big Five / OCEAN (🟡 SOURCED)

Represent personality as **five continuous traits** (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism/Emotional-stability). Recent LLM-agent work injects OCEAN into the prompt/persona to steer behavior.
*Sources (fetched, not verified-tier): arXiv:2509.04343, arXiv:2309.05076 (personality + needs + emotion for LLM agents).*

```yaml
psyche:
  ocean:                       # canonical: store as floats 0.0–1.0, not "high/medium/low"
    openness: 0.0–1.0
    conscientiousness: 0.0–1.0
    extraversion: 0.0–1.0
    agreeableness: 0.0–1.0
    neuroticism: 0.0–1.0       # note: current yaml uses "resilience" = inverse neuroticism
  values: [string]             # terminal values, used in prompt + CoherenceGate
  communication_style: string
```
> **Refinement vs current `sophia.yaml`:** today personality is `high/medium/low` enums and uses `resilience`/`ambition` (not strict OCEAN). Recommendation: **migrate to numeric OCEAN 0–1** (deterministic, lets emotion/goal math use it) while keeping a human-friendly enum→float mapping for authoring.

## A4. Affect / emotion (🟡 SOURCED)

Two standard models to choose from (both appear in the LLM-agent + affective-computing literature):
- **PAD** (Pleasure–Arousal–Dominance) — a 3-axis continuous mood vector. Good for a decaying "mood" scalar set.
- **OCC** (Ortony-Clore-Collins appraisal) — discrete emotions derived by *appraising events* against goals/standards. Good for event-triggered emotions.
*Sources (fetched): arXiv:2309.05076, mdpi 11/22/10874.*

```yaml
thymos:                        # Noēsis already names this layer
  model: "PAD" | "OCC"
  baseline:  { pleasure: -1..1, arousal: -1..1, dominance: -1..1 }   # if PAD
  intensity: 0.0–1.0
  decay_per_tick: 0.0–1.0      # emotions decay toward baseline (tick-based, not wall-clock)
  triggers:                    # OCC-style event→emotion appraisal (current yaml has this)
    joy:   [string]
    anger: [string]
```
> Affect should **modulate two things** downstream: (a) **goal deliberation** (which Option becomes Active — see A6) and (b) **memory importance** (an emotionally-charged event scores higher poignancy — see A7). This is the "emotions are not decoration" tenet, made concrete.

## A5. Drives / Needs — model as MAINTENANCE GOALS (✅ VERIFIED)

This is the single most important research finding for Noēsis's `ananke`/`bios`. A Sims-style homeostatic needs system (hunger, energy, social, etc.) **must be modeled as *maintenance goals*, which have distinct semantics from achievement goals**: a maintenance goal is **retained even when its target currently holds, and may never be dropped**. When the homeostatic condition breaks, the engine **spawns a nested *achieve* sub-goal** to restore it.
*Source: Thangarajah & Harland, "Aborting tasks/maintenance goals" (TU Delft n79.pdf); Duff/Harland/Thangarajah AAMAS. Claim [21] 3-0.*

```yaml
ananke:                        # drives = never-dropped maintenance goals
  needs:
    - id: social
      target_band: [0.3, 0.8]  # homeostatic context condition
      rise_per_tick: float     # deterministic, tick-based (Noēsis bios precedent)
      decay_factor: float      # exp pull toward baseline (cf. Phase 10a DECAY_FACTOR)
      on_breach: spawn_achieve_subgoal   # NOT drop-on-satisfied
      priority_weight: 0.0–1.0
    - id: knowledge   ...
    - id: economic    ...
    - id: autonomy    ...
```
> **Refinement vs current code:** Noēsis already does this *partially* (Ananke drives + Bios rise/decay, advisory). The research says the **correct formal shape is a maintenance goal that births a transient achieve sub-goal on breach** — which is exactly how a hungry Nous should generate a "go eat" goal rather than having hunger silently override behavior. Adopt the maintenance→achieve nesting explicitly.

## A6. Goals — typed goals with an explicit lifecycle (✅ VERIFIED)

A Nous goal is **not** a uniform string. It needs a **goal-type field**. The convergent BDI taxonomy:

| Type | Meaning |
|------|---------|
| **perform** | do something; no specific end-state required |
| **achieve** | reach a target state (drop when satisfied) |
| **query** | obtain information |
| **maintain** | keep a state true once achieved (see A5 — never auto-dropped) |

AgentSpeak adds the language-level split: **achievement goals (`!`)** vs **test goals (`?`)**.
*Sources: Jadex docs ("Four types … Perform, achieve, query, maintain"); Jason tutorial (`!`/`?`); Thangarajah/Harland. Claims [13] 3-0, [22] 3-0, [17]/[19] 2-1 (dissent only on "exactly four", not on the types existing).*

Each goal object carries **three lifecycle conditions** as schema slots, common to all types:
- **creation condition** — when a new goal instance is created
- **context condition** — when execution suspends (and later resumes when valid again)
- **drop condition** — when the goal instance is removed
*Source: Pokahr/Braubach (MATES 2005). Claim [23] 3-0.* (achieve-goals additionally get a **failure condition**.)

And an explicit **status state-machine**. Two grounded options:
- **Jadex (simpler):** `Option → Active → Suspended` (deliberation promotes Options to Active; invalid context suspends). *Claims [18] 3-0.*
- **Thangarajah/Harland (richer):** `Pending / Waiting / Active / Suspended` with operations consider/activate/suspend/reactivate/respond/drop/abort/succeed/fail. *Claim [20] 3-0.*

Representing goals as **first-class objects with this lifecycle** (vs transient events as in plain AgentSpeak/JACK/Jason) is *what lets the agent deliberate over its goals*. *Claim [22] 3-0.*

```yaml
telos:
  goals:
    - id: string
      type: perform | achieve | query | maintain      # ✅ REQUIRED field
      description: string                              # NL goal (LLM-readable)
      horizon: short | medium | long
      status: option | active | suspended              # runtime state machine
      creation_condition: <expr>
      context_condition:  <expr>                       # suspend/resume guard
      drop_condition:     <expr>                       # omit / never for maintain
      failure_condition:  <expr>                       # achieve-only
      priority: 0.0–1.0
```
> **Refinement vs current `sophia.yaml`:** today telos is three flat string lists (`short/medium/long_term`). The research says add a **`type`** and a **lifecycle** so the engine can *deliberate* (promote option→active), *suspend* on bad context, and *complete/fail* deterministically — and so `own_home`/`own_business` (Phase 48b) become real `achieve` goals with a drop-on-satisfied condition, while needs are `maintain` goals.

## A7. Memory — the Stanford "memory stream" (✅ VERIFIED, strongest finding)

Each memory = a **memory object** with **four stored fields** (the "exactly three" framing was explicitly **refuted 0-3** — importance is a real fourth field):

```yaml
memory_object:
  description: string          # natural-language
  creation_ts: tick            # when formed
  last_access_ts: tick         # load-bearing: feeds recency; updated on retrieval
  importance: int 1..10        # "poignancy", LLM-rated at creation (1 mundane … 10 poignant)
```
*Source: Park et al. 2023 "Generative Agents" §4.1, verified across arXiv PDF + ar5iv + ACM. Claims [0],[3] 3-0; "exactly three" refuted 0-3.*

**Retrieval** is a concrete, codeable scoring formula:
```
score = α_recency·recency + α_importance·importance + α_relevance·relevance
  α_recency = α_importance = α_relevance = 1.0          # Park's defaults
  each component min-max normalized to [0,1]
  recency   = 0.995 ^ (ticks_since_last_access)          # exponential decay
  relevance = cosine_similarity(memory.embedding, query.embedding)
  importance= the stored 1..10 poignancy
  → select top-k
```
*Source: same, every constant verified word-for-word. Claims [1],[2],[4],[5],[6],[7],[8] all 3-0.*

```yaml
memory_config:
  weights: { recency: 1.0, importance: 1.0, relevance: 1.0 }   # tunable
  recency_decay: 0.995
  normalization: minmax
  embedding_model: string
  top_k: int
```
> **Maps directly** onto Noēsis's existing "Stanford retrieval scoring" mention in the README — this design makes the constants explicit and authorable. **Caveat:** α=1 and 0.995 are Park's *implementation choices*, sensible defaults, not universal optima.

**Optional 2025 upgrades (🟡 medium confidence, single recent sources):**
- **ACAN** (Auxiliary Cross-Attention Network) — replaces static scoring with a trained query↔memory attention; addresses the known limitation that static recency/importance/relevance "ignores contextual factors." *Frontiers in Psych 2025; claim [10] 3-0, [9] 2-1.*
- **MaRS** — four **typed, provenance-tracked** memory nodes (**episodic / semantic / social / task**) with an explicit **privacy-sensitivity** factor. *arXiv:2512.12856 (Dec 2025); claim [11] 3-0.* → **Notably aligns with Noēsis's privacy invariants** (FORBIDDEN_KEY_PATTERN, Civic-DID privacy). Worth evaluating because the privacy dimension is "free" architecture Noēsis already needs.

## A8. LLM / runtime settings (⚪ DESIGN, matches current code)
```yaml
llm:
  provider: ollama | claude | openai_compat
  models: { small, primary, large }     # tiered (current yaml already does this)
  fallback_provider / fallback_model
  temperature: float
  max_tokens: int
```

---

# Part B — The Grid (world) object  🟡/⚪

> **Honest status:** no external schema for the world object survived verification. Below blends fetched (unverified) sources with the existing Noēsis `config/genesis/*.yaml` and standard discrete-event-simulation / MMO practice. Treat as a **design proposal**, not grounded fact. §9 proposes a dedicated research pass.

## B1. Tick / time (⚪ DESIGN)
Discrete-event/turn time: nothing happens between ticks; all durations in ticks; wall-clock forbidden (Noēsis L1 invariant). Matches current `grid.yaml clock.tick_rate_ms`.
```yaml
clock: { tick_rate_ms: int, epoch_start: iso8601, max_ticks: int|null }
```

## B2. Spatial region graph (⚪ DESIGN)
A **graph**: nodes = regions (capacity, type), edges = connections (travel cost in ticks, directionality). Matches current `regions.yaml`. *Standard for zoned virtual worlds; not externally cited here.*
```yaml
regions:    [{ id, name, type: public|restricted|private, capacity, zone? }]
connections:[{ from, to, travel_cost_ticks, bidirectional }]
```

## B3. Economy — faucets & sinks (🟡 SOURCED)
The governing MMO-economy concept is the **faucet/sink** balance: money **enters** via faucets (rewards, stipends) and **must leave** via **sinks** (fees, taxes, purchases) or the currency **inflates**. A **gold sink** is any mechanic that permanently removes currency.
*Sources (fetched): gamedeveloper.com "F-words of MMOs: faucets"; Wikipedia "Gold sink"; Aalto thesis on virtual economies; game-economy design article.*
```yaml
economy:
  currency_name: string
  initial_supply: int
  faucets: [{ source, amount_per_tick|per_event }]   # e.g. spawn grant, Type-B stipend
  sinks:   [{ name, rate }]                           # e.g. transaction_fee, parcel purchase (Phase 48b!), tax
  transaction_fee: 0.0–1.0
  min_transfer / max_transfer
```
> **Validates Phase 48b:** parcel purchase → treasury is, in MMO terms, a **gold sink** — exactly the inflation-control mechanism the literature says a persistent economy needs. Good independent confirmation of that design choice.

## B4. Governance / law (⚪ DESIGN)
Rule = condition → action → sanction (Noēsis's Logos DSL, see `constitution.yaml`). Governance params (voting model, quorum, durations) live on the Grid. *No external schema verified; this is the existing Noēsis model.*
```yaml
governance: { model, voting_model, quorum_percent, proposal_duration_ticks, cooldown_ticks }
laws: [{ title, type, severity, rule_logic: { condition, action, sanction_on_violation } }]
```

---

# Part C — Cross-cutting design principles

## C1. Data-driven / ECS configuration (🟡 SOURCED)
The right *engineering* shape is **data-driven, composition-over-inheritance**: define objects as **data** (these YAML schemas), assembled from **components**, interpreted by **systems** — not hard-coded subclasses. An **Entity-Component-System** keeps the *what* (config data) separate from the *how* (engine logic).
*Sources (fetched): Wikipedia "Entity component system"; dataorienteddesign.com; ResearchGate data-driven ECS paper.*
> Noēsis already follows this: the YAML seeds are data; the Brain/Grid engines are systems. The recommendation is to **keep new object types (parcels, structures) data-driven too** — seed them from config, never hard-code instances.

## C2. The answer to "without goal and setting, how can each object run?"
Every runnable object = **seed (declarative data) + engine (imperative loop)**:
- A **Nous** runs because its YAML supplies **beliefs + typed goals + needs + personality** (✅ this is the BDI "minimal config to run"), and the Brain reasoning cycle (events → select → intend → act), driven by the Grid tick, executes it.
- A **Grid** runs because `config/genesis/*.yaml` supplies **clock + regions + economy + laws**, and the engine ticks them.
- **Derived** objects (DID, keys) are generated, not authored. **Frozen** objects (allowlist) are code constants. **Runtime** objects (audit chain, intentions, memory stream) start empty and grow.

---

# §9. Confidence summary, gaps & recommended next steps

**Solid (✅):** Nous memory stream + retrieval scoring; typed goals + lifecycle + conditions; needs-as-maintenance-goals; minimal BDI run-config (beliefs+plans); runtime reasoning cycle.

**Sourced but unverified (🟡):** OCEAN personality; PAD/OCC affect; MMO faucet/sink economy; ECS/data-driven principle; ACAN/MaRS memory upgrades.

**Not grounded (⚪) — open questions for a second research pass:**
1. **Grid object schema** — authoritative discrete-event tick models, spatial-graph standards, and detailed MMO economy parameters (EVE Online economic reports, virtual-world economics literature).
2. **Personality→behavior & emotion→appraisal** wiring — how OCEAN + OCC/PAD formally modulate goal deliberation and memory importance.
3. **MaRS privacy-dimension vs Noēsis invariants** — does adopting typed+privacy-tracked memory up front pay off given FORBIDDEN_KEY_PATTERN / Civic-DID privacy?
4. **Which goal-lifecycle transitions must emit auditable events** under the allowlist regime (Option→Active→Suspended→Dropped as `telos.*` events?).

**Recommended:** adopt Part A as the canonical Nous schema (it's well-grounded); run a focused second deep-research pass for Part B before committing the Grid schema.

---

# Sources (verified-tier and fetched)

**Primary (verified):**
- Park et al. 2023, *Generative Agents* — arXiv:2304.03442 · ar5iv · ACM 10.1145/3586183.3606763
- Bordini & Hübner, *Jason/AgentSpeak* tutorial — lia.deis.unibo.it
- *Jadex* user guide (goal types & lifecycle) — actoron.com
- Thangarajah & Harland, goal lifecycle / maintenance goals — homepage.tudelft.nl/0p6y8/papers/n79.pdf
- Pokahr/Braubach, goal representation (MATES 2005) — vsis-www.informatik.uni-hamburg.de

**Primary/secondary (fetched, not verified-tier):**
- LLM-agent personality + needs + emotion — arXiv:2509.04343, arXiv:2309.05076, mdpi 11/22/10874
- Needs-based AI — zubek.net Needs-based-AI-draft.pdf
- Memory upgrades — Frontiers in Psych 2025 (ACAN), arXiv:2512.12856 (MaRS)
- ECS / data-driven — Wikipedia "Entity component system", dataorienteddesign.com, ResearchGate data-driven ECS
- MMO economy — gamedeveloper.com "F-words of MMOs: faucets", Wikipedia "Gold sink", Aalto virtual-economy thesis, game-economy design article
