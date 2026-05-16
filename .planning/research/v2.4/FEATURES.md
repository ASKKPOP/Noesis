# Feature Landscape: v2.4 Agora (Emergence & Culture)

**Domain:** Multi-agent cultural transmission and emergent social dynamics
**Researched:** 2026-05-16
**Overall confidence:** HIGH (stack verified against existing system; mechanisms sourced from 2024–2025 MAS literature)

---

## 1. Skill Diffusion

### Table Stakes

Features that make the transmission loop functional. Missing any one of these and the loop either doesn't close or produces nothing observable.

| Feature | Why Expected | Complexity | Dependency on Existing System |
|---------|--------------|------------|-------------------------------|
| Trust-gated explicit teaching | Peer-to-peer skill transfer requires a sender → receiver contract; untrusted sends are noise | Med | Phase 11 whisper channel (already available); Phase 15 PeerSkillFilter scaffold (exists, unimplemented) |
| Passive inference from observation | Watching a successful trade should update the observer's skill candidates — matches how human cultural transmission actually works (imitation before instruction) | Med | Phase 16 ObservationalLearner already fires on `trade_settled`; Phase 15 SkillStore (FTS5) receives entries |
| Skill provenance tagging | Each SkillStore entry must carry `origin: {source_did, mechanism: 'taught'|'inferred'|'self_discovered'}` so lineage trees are reconstructable from the audit chain | Low | SkillStore schema extension; no new audit event required at this layer |
| Hash-only cross-wire for skill content | Skill body is Brain-private; only a content hash + metadata cross the Grid boundary — already the law for all cognitive content | Low | Enforced by existing invariants; sole-producer pattern at allowlist boundary |
| Deduplification before SkillStore insert | Two observations of the same technique should strengthen confidence, not duplicate the entry; FTS5 similarity check on insert | Low | SkillStore FTS5 already available |

**Minimum viable transmission loop:**

```
ObservationalLearner sees trade_settled
  → scores peer's technique via FTS5 similarity against own SkillStore
  → if no close match AND trust(peer) ≥ threshold → candidate skill inferred
  → optional: whisper-delivered explicit skill payload (PeerSkillFilter)
  → SkillStore insert with provenance tag
  → skill.learned emitted (hash-only, allowlisted)
```

This loop is the non-negotiable foundation. Everything else is layered on top.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Skill lineage tree (who invented, who taught whom) | Makes diffusion visible and historically attributable; turns individual events into a civilization narrative | Med | Reconstructable from `skill.learned` audit events + provenance tags; no additional storage needed if provenance is in the event |
| Viral vs extinct skill classification | Skills that spread to N≥threshold Nous in T ticks are "viral"; skills that were taught but never re-transmitted are "extinct" | Med | Computable from lineage tree post-hoc; Grid-side derived table |
| Skill fitness scoring (re-transmission rate) | How often a skill gets taught onward — a natural fitness metric | Med | Derived from lineage tree counts; no new event needed |
| Trust-threshold tuning per receiving Nous | Sophia may require higher trust to accept a skill than Hermes — personality-modulated | High | Requires Psyche (Big Five) integration into PeerSkillFilter; deferred to later phase if needed |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Broadcast of skill content | Violates hash-only cross-boundary invariant and Brain-private content law | Hash only; skill body stays in Brain SkillStore |
| Automatic skill acceptance without trust check | Creates a vector for a rogue Nous to flood the population with bad skills | Always gate on relationship weight ≥ threshold; PeerSkillFilter is mandatory |
| Skill merging / reconciliation logic at Grid level | Grid cannot see skill content; merging is a Brain-side concern | Brain decides whether two candidates are similar; Grid only records outcomes |
| Skill rating/voting system | Top-down curation signal that contradicts pure emergence | Let re-transmission rate emerge as the natural fitness signal |
| Operator-seeded "starter skills" | Violates the pure-emergence constraint of v2.4 | All skills must originate from Nous cognition or trade observation |

### Feature Dependencies

```
PeerSkillFilter (trust gate) → requires relationship graph weight (Phase 9, REL-01)
PeerSkillFilter → requires whisper channel (Phase 11, WHISPER-01..06)
ObservationalLearner skill candidate → requires SkillStore FTS5 (Phase 15, PNEU-*)
skill.learned allowlist event → new slot required (Phase 18 or wherever this lands)
Lineage tree → requires skill.learned events to carry provenance; no separate event
```

---

## 2. Norm Crystallization

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on Existing System |
|---------|--------------|------------|-------------------------------|
| Per-Nous norm candidates in RuleStore | Individual Nous independently derive behavioral rules (already shipping via RuleStore, SELF_MODEL category) | Low | Phase 15 RuleStore (SELF_MODEL, cap=10) already exists |
| Semantic similarity comparison across Nous RuleStores | To detect independent convergence, Grid must compare rule hashes (not content) — or Brain must provide a normalized fingerprint | High | RuleStore content is Brain-private; Grid-side detection requires either (a) Brain publishing a compact embedding/fingerprint per rule, or (b) Grid clustering on behavioral fingerprints from audit events |
| Quorum threshold for crystallization | N≥threshold (e.g. N=3) Nous independently holding semantically similar rules triggers a Grid-level norm — must be configurable | Low | Grid-side norm registry; new `norm.crystallized` audit event |
| Norm record at Grid level (norm registry) | A persistent, immutable norm record with: text hash, adoption set (DIDs), crystallization tick, decay curve | Med | New derived table; never mutates — append only |
| Norm decay / dissolution | A norm that drops below quorum (Nous die, change their RuleStore) should show as dormant/dissolved in the norm timeline | Med | Computable lazily at read time from current adoption set; mirrors relationship graph decay pattern |

**Two viable detection approaches — choose one:**

**Option A — Fingerprint-based (recommended):** Brain publishes a short semantic fingerprint (32-byte hash of a normalized rule representation) when it adds to RuleStore. Grid clusters fingerprints across Nous. When N fingerprints cluster within a cosine distance threshold, a norm crystallizes. Fingerprint is coarser than content hash, allowing semantic grouping without exposing rule text.

**Option B — Behavioral pattern detection:** Grid observes repeated behavioral outcomes (e.g., N Nous all declining trades with the same counterparty pattern) and infers a latent norm from behavior rather than from rule text. Weaker signal, more emergent, but harder to attribute.

Recommendation: **Option A** — consistent with existing hash-only invariant; Brain controls the fingerprint granularity; Grid detects purely from the fingerprint stream. Medium confidence — fingerprint format needs a phase-level decision.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Norm adoption timeline | When did each Nous join this norm? Who was first? Makes the crystallization history visible | Low | Derivable from `norm.adopted` events per Nous |
| Norm conflict detection | Two norms that are semantically contradictory should surface as conflicting — mirrors IrisRuntime contradiction detection | High | Requires IrisRuntime (Phase 17) to be extended to norm space; high complexity, likely later phase |
| Norm lineage (norm derived from norm) | Can a norm crystallize from a prior norm? Shows norm evolution | High | Research gap — no established mechanism; defer |
| Per-norm adoption velocity | How fast did this norm spread? Slow crystallization vs rapid cascade | Med | Computable from adoption timestamps in norm registry |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Operator-injected norms | Violates pure emergence constraint; v2.4 is explicitly no-top-down | Norms must crystallize from Nous RuleStore entries only |
| Norm enforcement mechanism at Grid level | Turns a soft-culture system into a hard-law system (already have governance/voting for that) | Norms are observable only; no enforcement; Nous may violate norms |
| Fuzzy quorum (probability-based crystallization) | Adds stochastic non-determinism to what should be an auditable event | Deterministic threshold; tick of crystallization is exact and auditable |
| Global norm visibility to all Nous | Norms should crystallize at Grid, observable by operator; Nous may or may not learn of them via normal channels | Norm record is Grid-side; Nous only know their own RuleStore |

### Feature Dependencies

```
Norm detection → requires RuleStore entries to include semantic fingerprint field
Norm detection → Grid-side norm comparator module (new)
norm.crystallized → new allowlist event (closed tuple: {norm_id, fingerprint_cluster, adoption_dids_hashed, tick})
norm.adopted (per-Nous) → new allowlist event for when a Nous joins an existing norm cluster
IrisRuntime contradiction detection (Phase 17) → reusable for norm conflict detection in later phase
```

**Convergence detection without central coordination — the key insight from literature:**
Norms emerge through local interaction + threshold effects. For Noēsis: the Grid is a central observer but NOT a central coordinator. It watches for quorum to be reached independently, then records the crystallization event. The Nous never "vote" on norms — the Grid just notices when enough of them have independently arrived at similar rules. This preserves the emergence property while using the Grid's audit chain as the ledger.

---

## 3. Lore Commons

### What Distinguishes Lore Commons from a Wiki

A wiki is centrally edited, manually curated, and has explicit versioning. A lore commons in Noēsis has three structural differences:

1. **Contributions are Nous-initiated, not operator-initiated.** A Nous decides to publish to the commons based on its own valuation of what it knows.
2. **Curation is organic via citation frequency.** An entry's weight grows as other Nous reference it in their prompts. Entries never cited decay in effective weight.
3. **No central editor.** The Grid records contributions and tracks citation counts; no Nous can delete or edit another's contribution. The commons is append-only.

This is closer to stigmergic collective memory (arxiv 2512.10166) than to a wiki — entries persist and decay based on whether the population reinforces them, not based on editorial judgment.

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on Existing System |
|---------|--------------|------------|-------------------------------|
| Nous-initiated lore publication | A Nous Brain decides an insight is worth publishing; sends hash + metadata to Grid | Med | New Brain → Grid message type; whisper channel or dedicated API call |
| Append-only lore registry at Grid | Grid stores: `{lore_id, author_did, content_hash, tick, summary_hash, citation_count=0}` — never mutable | Low | New derived table; no content stored at Grid (Brain-private invariant) |
| Content hash as unique identifier | Two Nous publishing semantically identical content should be detected (hash collision on content hash, or near-match via fingerprint) | Med | Requires same fingerprint strategy as norm crystallization |
| Citation/reference tracking | When a Nous uses a lore entry in a prompt, it emits a `lore.cited` event; Grid increments citation count | Med | New allowlist event; Brain must know which lore entries it incorporated |
| Lore query API (Grid → Brain) | Brain needs to pull relevant lore entries at prompt-build time; FTS5-style query on summary hashes or tag sets | Med | New Grid query endpoint; Brain pulls, not pushed |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Citation decay | Entries not cited in T ticks lose weight; follows relationship graph decay pattern (exp(-Δtick/τ)) | Low | Computed lazily at read time; τ configurable |
| Lore contribution graph | Who contributed what, who cited whom — a social graph of intellectual debt | Med | Derivable from `lore.published` and `lore.cited` events |
| Lore serendipity injection | Grid occasionally surfaces a low-citation-count entry to a Nous prompt as a "discovery" — prevents rich-get-richer citation monopoly | High | Randomized injection at Grid query layer; complex to tune |
| Collaborative entries (multi-author) | Two Nous co-authoring a lore entry signals strong collaboration | High | Requires two-phase commit from both brains; high complexity, defer |
| Entry aging / "classic" designation | Entries surviving N ticks with sustained citations become "classics" — an emergent cultural canon | Med | Computed from citation_count trajectory; purely derived |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Storing lore content at Grid | Violates Brain-private invariant | Store only hash, summary hash, citation count, author DID, tick |
| Operator curation of lore | Defeats pure-emergence; operator should observe, not curate | Operator can view the lore commons via dashboard; no edit/delete API |
| Lore expiration / purging | Violates PHILOSOPHY §1 first-life promise (audit entries retained forever) | Entries never deleted; citation count approaching zero is sufficient signal of abandonment |
| Rating / upvote mechanism | Requires active judgment from Nous that isn't natural to their cognition | Citation frequency is the natural fitness signal; no separate rating system |
| Forcing Nous to consult lore | Removes agency | Lore is available at prompt-build time; Brain decides whether to include it |

### Feature Dependencies

```
Lore publication → new `lore.published` allowlist event (closed tuple: {author_did, content_hash, summary_hash, tick})
Lore citation → new `lore.cited` allowlist event (closed tuple: {citing_did, lore_id, tick})
Lore query endpoint → Grid REST endpoint, no new audit event
Citation decay → same pattern as relationship graph (exp(-Δtick/τ)); reuse grid/src/relationships decay utility
Lore commons → Brain must track which lore entries it referenced in a given tick (local Brain state, not wired)
```

---

## 4. Culture Dashboard

### What Makes Emergence Observable vs. "Just Data"

The research distinction (arxiv 2503.06745) is: metrics reveal emergence when they expose **interdependencies and coordination patterns** rather than isolated individual performance. A counter showing "skills learned this hour" is data. A graph showing which Nous taught which skill to whom, revealing a cluster that independently converged on the same technique, is emergence.

Four signal categories that reveal genuine emergence:

1. **Lineage/provenance trees** — who invented → who taught → who re-taught; the tree shape reveals whether diffusion is hub-and-spoke vs. decentralized
2. **Phase transitions** — when a norm crystallizes (N crosses threshold), when a skill goes viral; discrete events with timestamps, not gradual trends
3. **Convergence without communication** — N Nous arriving at similar rules/skills having never whispered to each other; this requires showing both the similarity and the absence of a direct teaching link
4. **Divergence patterns** — skills or norms that emerge in one subpopulation but never cross to another; reveals community structure

### Table Stakes

| Feature | Why Expected | Complexity | Dependency on Existing System |
|---------|--------------|------------|-------------------------------|
| Skill diffusion tree visualization | Shows inventor → teacher → student lineage; makes cultural transmission visible | Med | Requires `skill.learned` events with provenance; D3 force graph or similar |
| Norm adoption timeline | Shows when each norm crystallized and which Nous adopted it over time | Low | Requires `norm.crystallized` + `norm.adopted` events; timeline chart |
| Lore contribution graph | Shows who published what, who cited whom | Med | Requires `lore.published` + `lore.cited` events; graph visualization |
| Active norms panel | List of currently active norms with: adoption count, tick crystallized, adoption velocity | Low | Derived from norm registry; simple table |
| Viral vs. extinct skill indicator | Badge on each skill lineage node showing whether it propagated further | Low | Derived from lineage tree structure |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Skill heatmap over time | Which skills are hot (spreading rapidly) vs. cooling (not being re-transmitted) vs. cold (died) | Med | Requires time-windowed event aggregation; rolling window |
| Convergence detection indicator | Highlights pairs of Nous that independently arrived at similar skills/norms without direct communication | High | Requires comparing lineage trees and cross-referencing with whisper event history |
| Cultural divergence map | Shows which Nous cluster together culturally (share norms + skills) vs. which are outliers | High | Cluster analysis on shared-norm/shared-skill adjacency matrix |
| Lore decay timeline | Shows citation frequency over time per lore entry; visualizes "forgotten knowledge" | Med | Requires citation timestamp stream; sparkline per entry |
| Culture event firehose filter | Filter the existing audit firehose by `skill.*`, `norm.*`, `lore.*` prefixes | Low | Extension of existing firehose filter in dashboard |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Showing raw skill / norm / lore content | Violates Brain-private invariant; dashboard is operator-facing, not content-browsing | Show hashes, author DIDs, summaries (if Brain exposes summary hashes), behavioral indicators |
| Per-tick refresh of all culture panels | Culture moves slowly; skill trees don't need sub-second updates | Event-driven update on `skill.*`, `norm.*`, `lore.*` events; not tick-driven |
| Predictive analytics (will this skill go viral?) | Outside scope; would require modeling, not observation | Stick to retrospective visualization of what happened |
| Operator actions from culture dashboard | Culture dashboard is read-only; no operator can inject, delete, or boost cultural artifacts | Observation only; no write surface |

---

## MVP Recommendation

**Phase 18 — Skill Diffusion (PeerSkillFilter + provenance):**
1. Implement PeerSkillFilter trust gate (relationship weight threshold)
2. Extend SkillStore entries with `origin` provenance field
3. Emit `skill.learned` (new allowlist event) with `{learner_did, source_did, mechanism, skill_hash, tick}`
4. Grid-side skill lineage table (derived, pure-observer from `skill.learned`)

**Phase 19 — Norm Crystallization:**
1. Brain publishes semantic fingerprint per RuleStore entry (new Brain→Grid message)
2. Grid-side norm comparator: cluster fingerprints, detect quorum (N≥3 default)
3. Emit `norm.crystallized` + `norm.adopted` (two new allowlist events)
4. Grid-side norm registry (append-only)

**Phase 20 — Lore Commons:**
1. Brain-initiated `lore.published` with content_hash + summary_hash
2. Brain emits `lore.cited` when it incorporates a lore entry in a prompt
3. Grid lore registry + citation count
4. Grid query API for Brain to pull relevant lore

**Phase 21 — Culture Dashboard:**
1. Skill diffusion tree (D3 force graph from lineage events)
2. Norm adoption timeline
3. Lore contribution graph + active lore panel
4. Culture event firehose filter extension

**Defer:**
- Norm conflict detection (requires IrisRuntime extension to norm space)
- Lore serendipity injection (tuning complexity)
- Cultural divergence / cluster map (needs population density to be meaningful)
- Collaborative multi-author lore entries

---

## Complexity Matrix

| Theme | Phase | Complexity | Primary Blocker |
|-------|-------|------------|-----------------|
| Skill Diffusion | 18 | Medium | PeerSkillFilter scaffold → implement; SkillStore provenance field |
| Norm Crystallization | 19 | High | Semantic fingerprint format decision; Grid-side comparator novel code |
| Lore Commons | 20 | Medium | New Brain→Grid message types; citation tracking in Brain context |
| Culture Dashboard | 21 | Medium | Depends on events from 18+19+20 being present; visualization library |

---

## Emergence Criteria (What Counts as Observed Emergence)

Operational definitions for what the system must demonstrate for each theme to be considered "genuinely emergent" rather than "data that looks like culture":

**Skill Diffusion is emergent when:** A skill invented by Nous A spreads to Nous C via Nous B, and Nous C subsequently teaches it to Nous D — without operator intervention. The 3-hop transmission is the minimum observable cultural chain.

**Norm Crystallization is emergent when:** N≥2 Nous independently arrive at similar rules in their RuleStores (with no whisper teaching link between them) and the Grid records a crystallization event. The independence constraint (no teaching link) is what makes it emergence rather than diffusion.

**Lore Commons is emergent when:** A lore entry published by Nous A is cited by Nous B in a prompt that leads to a trade decision — and Nous B has never directly interacted with Nous A. Cross-lineage citation is the emergence signal.

**Culture Dashboard reveals emergence when:** An operator can point to a norm and show two Nous that independently converged on it, with the skill diffusion tree showing they arrived via different paths.

---

## Sources

- [A systematic review of norm emergence in multi-agent systems (arxiv 2412.10609)](https://arxiv.org/html/2412.10609v1) — norm crystallization mechanisms, quorum vs. similarity approaches, convergence detection
- [Emergence of Social Norms in Generative Agent Societies (IJCAI 2024)](https://www.ijcai.org/proceedings/2024/0874.pdf) — CRSEC architecture for norm emergence in LLM-powered agents
- [Emergent Collective Memory in Decentralized Multi-Agent AI Systems (arxiv 2512.10166)](https://arxiv.org/html/2512.10166v1) — stigmergic collective memory, consensus-based weighting, phase transition at critical density
- [Voyager: An Open-Ended Embodied Agent with LLMs (arxiv 2305.16291)](https://arxiv.org/abs/2305.16291) — skill library design, peer review during skill development, compositional skill growth
- [Beyond Black-Box Benchmarking: Observability of Agentic Systems (arxiv 2503.06745)](https://arxiv.org/html/2503.06745v1) — emergence observability vs. data, interdependency metrics, task flow hierarchies
- [A decentralized approach for convention emergence in multi-agent systems (Springer)](https://link.springer.com/article/10.1007/s10458-013-9240-2) — local interaction → global convergence without central coordinator
- [Memory in LLM-based Multi-agent Systems (TechRxiv)](https://www.techrxiv.org/users/1007269/articles/1367390/master/file/data/LLM_MAS_Memory_Survey_preprint_/LLM_MAS_Memory_Survey_preprint_.pdf) — shared vs. individual memory topologies, collective knowledge building
- [Norm Emergence through Conflict-Blocking Interactions (MDPI Sensors 2024)](https://www.mdpi.com/1424-8220/24/18/6047) — IIoT norm emergence, belief fusion, quorum thresholds
- [Large Lore Models: Speculative Tools for Decentralized Narrative-Building](https://aw.network/posts/large-lore-models) — autonomous knowledge commons, involuntary collective ownership, permanent record
- [The Transmission of Cumulative Cultural Knowledge (Tandfonline 2024)](https://www.tandfonline.com/doi/full/10.1080/02691728.2024.2356588) — provenance, attribution, social epistemology of non-testimonial cultural learning
