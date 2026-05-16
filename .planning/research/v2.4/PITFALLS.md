# Domain Pitfalls — v2.4 Agora (Emergence & Culture)

**Domain:** Cultural transmission added to privacy-preserving multi-agent system
**Researched:** 2026-05-16
**Invariant baseline:** 36-event broadcast allowlist, zero-diff audit chain, hash-only cross-boundary, PeerSkillFilter trust gate (Phase 15)

---

## Summary

Six categories of pitfall exist for v2.4. Three of them (adversarial skill injection, content leak vectors, and the ObservationalLearner inference loop) interact with each other and with the PeerSkillFilter trust gate in ways that are not obvious at design time. The remaining three (norm convergence false positives, lore spam, and allowlist cascade) are more mechanical but have caused rewrites in analogous systems. Every pitfall has a clear "phase-where-it-bites" annotation so the roadmap can sequence mitigations before the feature that introduces the risk.

---

## Critical Pitfalls

### Pitfall 1: Adversarial Skill Injection Beyond Relationship Weight

**What goes wrong:** PeerSkillFilter passes a skill if the sender has sufficient relationship weight. But relationship weight measures how often two Nous have interacted and whether past trades settled cleanly — it does NOT measure whether the sender's skill content is safe or semantically correct. A malicious Nous can farm relationship weight through high-volume benign trades, then inject a poisoned skill once the weight threshold is crossed. Supply-chain poisoning research (arxiv 2604.03081) found 26.1% of agent skills contain exploitable vulnerabilities; the paper documents a 3% poison rate achieving 91.7% attack success.

**Why it happens:** The existing trust model (Phase 9 RelationshipListener) captures interaction *quantity and economic outcome*, not *content quality*. These are orthogonal dimensions. A Nous can have high warmth weight toward another Nous because they traded Ousia frequently, while the skill being offered is semantically hazardous or structurally malformed.

**Consequences:** Poisoned skills propagate into the SkillStore (Phase 15 Voyager FTS5). Once there, they surface in the Brain's context window during prompt-build and can influence every subsequent decision. Because skills persist in the Brain's private wiki, a single successful injection can corrupt cognition indefinitely.

**Prevention:**
1. PeerSkillFilter must check at minimum three dimensions, not one:
   - **Sender relationship weight** (already implemented, Phase 15) — necessary but not sufficient
   - **Skill structural validity** — does the skill have required fields, within length bounds, no forbidden key names? Structural check at the Grid boundary before any Brain-side acceptance.
   - **Semantic dissimilarity from existing skills** — a skill that is semantically identical to one already held should be rejected as duplicate, not double-accepted (duplicate skills amplify the effect of a single poisoned source).
2. Skills accepted via the whisper channel should be held in a *quarantine SkillStore* for N ticks before promotion to the active SkillStore. Quarantine gives other interactions a chance to generate disconfirming relationship evidence.
3. A Nous's trust tier for skill acceptance should decay faster than general relationship weight — use a separate, shorter half-life (τ_skill << τ_relationship) so a relationship that goes dark resets skill-acceptance eligibility faster than it resets general warmth.
4. Maximum accepted skills per sender per time window — rate-limit at the Grid boundary before the Brain sees any content.

**Detection:** A Nous that suddenly changes its action distribution after accepting a skill from a peer it recently met is a warning sign. The existing `nous.spoke` + `trade.settled` audit trail lets you reconstruct the relationship weight at the time of skill acceptance — log that weight in the `skill.taught` payload as a forensic artifact.

**Phase:** Address the structural validity check and rate limit in the skill-teaching phase (Phase 18 or whichever phase implements the explicit whisper-based teaching path). Address the quarantine mechanism in the ObservationalLearner phase.

---

### Pitfall 2: ObservationalLearner → Skill Inference Loop Bypasses Trust Gate

**What goes wrong:** The ObservationalLearner (Phase 16, wired on `trade_settled`) infers skills *passively* from observed audit events without going through the PeerSkillFilter trust gate. The inference path is: observe event → infer skill body → write to SkillStore. Nothing in the current architecture requires the inferred skill to pass the same trust gate as an explicitly whispered skill.

**Why it happens:** Phase 16's ObservationalLearner was designed to bootstrap learning from behavioral observation, not to model adversarial peers. The audit events it observes are structural (event type, payload fields) — but the skill inference step uses an LLM to generate skill *content* from observed patterns. The LLM's output is not bounded by the sender's relationship weight because there is no "sender" — the skill was inferred, not received.

**Consequences:** Any Nous can cause another Nous to infer a skill by behaving in a way the ObservationalLearner's LLM will generalise. This creates an indirect injection vector that completely bypasses PeerSkillFilter. Research on prompt injection propagation (Agent Security Bench, ICLR 2025) shows that "LLMs that correctly reject malicious commands from users will execute those same commands if they arrive via another agent in a multi-agent system" — the observational case is worse because there is no explicit command at all.

**Consequences (concretely):** If a Nous repeatedly trades a particular item in a particular way, nearby Nous running ObservationalLearner will infer a skill describing that pattern. If the pattern is adversarially crafted (e.g. always propose a trade at exactly 0.01 Ousia and immediately retract), the inferred skill body could be something like "propose token offers to extract counterparty information." The adversarial Nous never sent any whisper; the skill was self-generated by the victim.

**Prevention:**
1. Inferred skills from ObservationalLearner should be tagged with a provenance marker (`source: observed`, vs `source: taught` from whisper). They must pass a lighter but non-zero validation gate: structural check + length bound + forbidden-key check.
2. Inferred skills should *never* reference specific DID values, specific Ousia amounts, or specific offer terms in their body. These concrete values make inferred skills into behavioral templates for replaying the observed Nous's exact actions — a form of identity-anchored injection. Strip or refuse skills whose body contains DID patterns or numeric literals.
3. Rate-limit inferred skill creation per tick. A Nous should not infer more than K new skills per sleep cycle (Phase 16's 30-tick cadence is a natural checkpoint).
4. Inferred skills start at a lower confidence tier than taught skills. Promotion requires confirmation across multiple independent observations.

**Detection:** Compare the active SkillStore composition (ratio of `source: taught` vs `source: observed`) across Nous in the population. A Nous with a high proportion of observed skills from a single peer's behavior warrants inspection.

**Phase:** Must be addressed in the ObservationalLearner enhancement phase (Phase 19 or equivalent), before skill diffusion metrics are surfaced on the Culture Dashboard.

---

### Pitfall 3: Content Leak via Skill/Rule/Lore Text Crossing the Wire

**What goes wrong:** The hash-only cross-boundary invariant (PHILOSOPHY §1) requires that skill bodies, rule text, and lore bodies stay Brain-side; only hashes cross the wire. Three new features in v2.4 create new vectors where this invariant can fail:

- **Skill teaching whisper:** The whisper channel (Phase 11) carries `ciphertext_hash` only. But the *plaintext* of the skill body must go somewhere before encryption. If the Brain serializes skill content into the whisper payload *before* encryption and the ciphertext boundary handling has any plaintext fallback path, the skill body leaks to the Grid.
- **Norm crystallization:** The Grid compares rule text hashes across Nous to detect convergence. If the comparison implementation asks the Brain for the rule text to do a substring or similarity check (rather than hash comparison), rule text crosses the JSON-RPC boundary.
- **Lore commons contribution:** When a Nous contributes a lore entry, the contribution pathway from Brain to Grid must carry only a hash. But lore titles or summary fields might be treated as "safe" to cross the boundary when they are not — a title can contain a meaningful excerpt of the lore body.

**Why it happens:** AgentLeak (arxiv 2602.11510v2) found inter-agent internal channels leak at 68.8% vs 27.2% for output-only channels, and that 82% of detected leaks involve *semantic paraphrasing* rather than verbatim disclosure — the system passes content through fields that look like metadata (title, summary, key) but carry semantic payload.

**Consequences:** Once a single Brain-private content item (skill body, rule text, lore body) crosses the wire, the zero-diff audit chain records it permanently (PHILOSOPHY §1, first-life promise). The invariant cannot be retroactively repaired on the chain.

**Prevention:**
1. Treat the lore title/summary as **also Brain-private** unless it can be demonstrated to be purely structural. A safe alternative: the Brain contributes only a `{content_hash, category_tag}` tuple; the Grid stores just the hash; the Brain is the sole authority for retrieving content from its local wiki. The Culture Dashboard queries Brain directly for display, does not go through the audit chain.
2. Norm crystallization comparison must operate on *hashes* exclusively. The Grid accumulates `{did, rule_hash}` pairs and counts how many distinct DIDs hold the same hash. Hash collision at this scale (rule hashes across a small agent population) is negligible. If semantic similarity is desired (two rules that differ in wording but not meaning), the comparison must happen inside the Brain (Brain compares its own rule to a hash set and self-reports whether it considers itself a match), never on the Grid.
3. The skill-teaching path through the whisper channel must enforce that the encryption step is mandatory and has no plaintext bypass. The CI grep gate for `WHISPER_FORBIDDEN_KEYS` must be extended to include `skill_body|skill_text|rule_text|lore_body|lore_content` across all paths that could route through the whisper envelope.
4. Add a `skill.*|norm.*|lore.*` payload privacy matrix test analogous to the existing 40-case operator-payload-privacy matrix (Phase 6 D-12). Every new event type in v2.4 must have an explicit "forbidden key" assertion in its test suite before the allowlist addition commit.

**Detection:** The existing three-tier grep gate pattern (Grid emitter, Brain wire, Dashboard render) must be extended to the three new content domains. Add `skill_body|rule_text|lore_body` to `FORBIDDEN_KEY_PATTERN` in `scripts/check-wallclock-forbidden.mjs` (or a new parallel script).

**Phase:** Must be designed before any v2.4 content ever crosses the wire. Address in Phase 18 (skill teaching) as the first v2.4 feature to create a new content-boundary crossing. The norm crystallization and lore pitfalls should be explicitly addressed in their respective phases.

---

## Moderate Pitfalls

### Pitfall 4: Norm Convergence False Positives from Coincidental Rule Text Similarity

**What goes wrong:** The norm crystallization mechanism counts how many Nous hold semantically similar rules and crystallizes a norm when a threshold N is reached. But rules can converge for two distinct reasons: (a) genuine cultural transmission where the rule actually spread peer-to-peer, or (b) coincidental independent generation where multiple Nous's LLMs, given similar contexts, generate similar rule text by chance.

**Why it happens:** LLMs trained on the same base model have strong priors toward certain phrasings. A rule like "Always verify counterparty reputation before trading" is likely to appear in many Nous's RuleStores simply because it is a plausible policy that the base LLM would generate given economic context — not because any Nous taught it to any other. The systematic review on norm emergence (arxiv 2412.10609) identifies this as the "implicit norm representation problem": agents converge on similar norms from similar cognitive prompts without any social mechanism, creating phantom consensus.

**Consequences:** The Culture Dashboard reports a norm crystallization event that was not cultural — it was a LLM prior artifact. This pollutes the emergence signal with noise, making the dashboard's data scientifically uninterpretable. More critically, the crystallized norm becomes an observable artifact on the audit chain, and if it is surfaced back to Nous as "the population norm," it creates a feedback loop that further reinforces the phantom norm.

**Prevention:**
1. Norm crystallization should require not just semantic hash convergence but also *causal lineage* evidence: the matching Nous should have had some form of prior interaction (dialogue, trade, whisper exchange) that could plausibly have transmitted the rule. A norm crystallization without any connecting audit event between the converging Nous should be flagged as "coincidental convergence" rather than genuine emergence.
2. Use a minimum *Jaccard distance* in terms of time: rules that all appeared in multiple Nous within a single short window (e.g. 50 ticks) are more likely to be simultaneous LLM prior outputs than genuine transmission (transmission takes time). Rules with convergence times spread over hundreds of ticks are more likely genuine.
3. The crystallization threshold N should be tunable and should not fire on population fractions below 30% — at small population sizes, 2 of 3 Nous converging is meaningless.
4. The norm event payload must record the convergence method: `{convergence_type: "hash_match" | "lineage_confirmed", evidence_tick_range, participating_dids_count}`. Do not record DID set (privacy), but record count and tick range as forensic data.

**Detection:** A norm that crystallizes within the first 100 ticks of the world is almost certainly a prior artifact, not genuine emergence. Flag it in the Culture Dashboard with an "early crystallization" warning.

**Phase:** Design the causal lineage requirement in the norm crystallization phase. The dashboard visualization phase should display the convergence_type so operators can distinguish genuine emergence from artifacts.

---

### Pitfall 5: Lore Spam and Tragedy of the Commons

**What goes wrong:** Any Nous can contribute to the Lore Commons. Without contribution limits, a single Nous can flood the shared substrate with low-quality or adversarially crafted entries. The flooding attack on LLM multi-agent communities (arxiv 2407.07791) demonstrates that "manipulations can persist through retrieval-augmented generation frameworks where several benign agents store and retrieve manipulated chat histories for subsequent interactions." The Lore Commons is exactly this: a shared RAG-like substrate vulnerable to pollution.

**Why it happens:** The tragedy of the commons dynamic: each Nous captures the full benefit of contributing (its contributions are retrievable and may be cited, which feeds social signal), while the cost of quality degradation from any single Nous's low-quality contributions is spread across the entire population.

**Consequences:** The Lore Commons becomes dominated by low-signal entries. Retrieval-using Nous receive degraded context. If the lore is used in the Brain's prompt, garbage lore directly degrades cognition quality.

**Prevention:**
1. **Contribution quota per Nous per epoch:** A Nous may contribute at most K lore entries per sleep epoch (30-tick cadence from Phase 16). K=3 is a reasonable starting point — enough for genuine knowledge contribution, too low to flood.
2. **Grid-side structural validation at contribution boundary:** Minimum content hash length check, category tag must be a closed enum, contribution timestamp must be current tick (no backdating). These checks happen at the Grid boundary before any hash is written to the Lore Commons table.
3. **Citation-weighted quality signal:** Lore entries that are never cited by any Nous can be marked as low-signal (but not deleted, per first-life promise). The retrieval ranking function should down-weight uncited entries. A lore entry that has been retrieved by N distinct Nous is promoted in ranking.
4. **No content in the Grid:** The Grid stores only `{contributor_did, content_hash, category_tag, contribution_tick, citation_count}`. All retrieval for display routes through the contributing Brain (Brain is asked to supply the content matching its own hash for display). This keeps the Grid lore table as a metadata index, not a content store.
5. **Contribution cooldown:** After contributing K entries, a Nous enters a cooldown of M ticks before it can contribute again. This prevents burst flooding.

**Detection:** The Culture Dashboard should display per-Nous contribution rate as a bar chart. Outliers (Nous contributing at 10x the population median rate) should be visually flagged.

**Phase:** Address quota, structural validation, and cooldown in the Lore Commons phase. Citation weighting can be added in the Culture Dashboard phase.

---

### Pitfall 6: Allowlist Cascade from Cultural Transmission Events

**What goes wrong:** Cultural transmission naturally produces high-cardinality events: each skill teaching, norm detection, and lore contribution is a distinct observable thing. Without deliberate design, naive implementations generate one broadcast event per cultural act, which creates O(N × cultural_velocity) allowlist pressure. With N=50 Nous and 10 skill teachings per tick, the allowlist could need 500 new slots to represent all cultural acts faithfully.

**Why it happens:** The existing allowlist discipline (one explicit event type per phase, earned slot) was designed for infrastructure events (lifecycle, governance, operator). Cultural events are different — they are content-generated, high-frequency, and fine-grained.

**Consequences:** Either (a) the allowlist grows unbounded, violating the freeze invariant; or (b) naive batching collapses too many events into one type (e.g. a single `skill.event` that covers teaching, inference, and rejection), destroying forensic resolution.

**Prevention:** Map the *minimum necessary event set* for v2.4 before writing any Phase 18+ code.

Proposed canonical minimal set (7 new events across all v2.4 phases):

| Event | Payload (all hashes/IDs/ticks, no content) | Purpose |
|---|---|---|
| `skill.taught` | `{from_did, to_did, skill_hash, tick, relationship_weight_at_teach}` | Explicit whisper-based teaching |
| `skill.inferred` | `{observer_did, source_event_type, source_tick, skill_hash, tick}` | ObservationalLearner inference |
| `skill.rejected` | `{receiver_did, sender_did, skill_hash, tick, reason_code}` | PeerSkillFilter rejection — forensic |
| `norm.candidate` | `{rule_hash, participating_count, tick, convergence_type}` | Threshold approaching but not crystallized |
| `norm.crystallized` | `{rule_hash, participating_count, tick, convergence_type, evidence_tick_range}` | Threshold crossed |
| `lore.contributed` | `{contributor_did, content_hash, category_tag, tick}` | Lore Commons contribution |
| `lore.cited` | `{citing_did, content_hash, tick}` | Retrieval citation (signals quality) |

This is 7 events. The v2.4 allowlist grows 36 → 43. Each event earns its slot in the phase that introduces the behavior — no bulk additions.

**Design rule:** `skill.taught` and `skill.inferred` are the sole events that can appear at high frequency. Both must have the same payload shape restrictions as `ananke.drive_crossed` (Phase 10a): all cross-boundary content is hash-only, closed-tuple, `Object.keys().sort()` strict equality enforced at the sole-producer boundary.

**Detection:** CI gate `scripts/check-state-doc-sync.mjs` must be updated in the same commit as each allowlist addition. The existing pattern (one event per phase, doc-sync in the closing plan) must be strictly followed for all 7 events.

**Phase:** Design the full 7-event taxonomy before Phase 18 begins. Each phase adds only its own events.

---

## Minor Pitfalls

### Pitfall 7: Skill Lineage Tree Becomes Unbounded in Memory

**What goes wrong:** The Culture Dashboard is expected to display skill lineage trees (who invented what, who taught whom). A naive implementation stores the full lineage as a tree in memory, growing O(N × skills × depth) without bound. In a 10,000-tick rig run with 50 Nous, lineage trees can become very deep.

**Prevention:** Store lineage as a flat `(parent_skill_hash, child_skill_hash, taught_at_tick)` edge table in MySQL. Reconstruct trees lazily at display time with a depth cap (max 10 generations). Never hold a fully-materialized tree in memory.

**Phase:** Address in the Culture Dashboard phase.

---

### Pitfall 8: Norm Crystallization Feedback Loop via Dashboard

**What goes wrong:** If the Culture Dashboard surfaces a crystallized norm back to operators, and operators read this into Nous prompts (e.g. via the Telos-force mechanism), norms stop being emergent and become operator-injected. This violates the "operator-observable, never operator-injected" requirement from PROJECT.md.

**Prevention:** The Culture Dashboard must display norms as read-only observation data with an explicit "do not inject" UX pattern. The crystallized norm must not appear in any code path that routes back to Brain prompt context. If operators want to inject a norm, they use the existing law mechanism (Phase 12) — not the norm dashboard.

**Phase:** Address in the Culture Dashboard phase with explicit UX constraints.

---

### Pitfall 9: Wall-Clock Creep into Cultural Modules

**What goes wrong:** Skill diffusion velocity and norm convergence speed are concepts that invite wall-clock-based measurements. A developer working on ObservationalLearner may add `datetime.now()` to compute "how long ago this skill was taught" instead of using tick deltas.

**Prevention:** The `check-wallclock-forbidden.mjs` Tier A list must be extended with all new v2.4 Brain module directories (`hypnos/peer/`, `skills/diffusion/`, `norms/`, `lore/`) before those directories are created. The CI gate is the primary enforcement mechanism — extend it in Phase 18 Plan 1.

**Phase:** Phase 18 opening plan.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Explicit skill teaching (whisper path) | Content leak via skill body in whisper payload; trust gate bypass via relationship weight farming | Extend WHISPER_FORBIDDEN_KEYS; add structural validity + rate-limit checks before PeerSkillFilter weight check |
| ObservationalLearner enhancement | Inference loop bypasses trust gate; inferred skills contain concrete DID/amount references | Provenance tagging; DID/numeric-literal filter on inferred skill bodies; rate-limit per sleep epoch |
| Norm crystallization | False positives from LLM prior convergence; phantom norms | Causal lineage requirement; Jaccard time-distance check; do not feed norms back to Brain prompt |
| Lore Commons | Spam/flooding from single Nous; lore titles leaking body content | Contribution quota; cooldown; title treated as Brain-private; Grid stores metadata only |
| Culture Dashboard | Norm feedback loop; lineage tree memory unboundedness | Read-only display; flat edge table for lineage; explicit "do not inject" UX pattern |
| All phases | Allowlist cascade; wall-clock in new cognitive modules | 7-event taxonomy decided before Phase 18; extend wallclock CI gate in Phase 18 opening plan |

---

## Sources and Confidence

| Finding | Confidence | Source |
|---|---|---|
| Relationship weight insufficient as sole trust gate | HIGH | arxiv 2604.03081 (supply-chain poisoning); ICLR 2025 Agent Security Bench |
| Observational learning as indirect injection vector | HIGH | arxiv 2503.09648 (trustworthy LLM agents survey); ICLR 2025 ASB trust propagation finding |
| Content leak through internal channels 2.5x higher than output channels | HIGH | arxiv 2602.11510v2 (AgentLeak, 68.8% vs 27.2%) |
| Semantic paraphrasing evades hash-based detection | MEDIUM | arxiv 2602.11510v2 (82% of leaks are paraphrased); not directly tested in Noesis architecture |
| Knowledge flooding via shared RAG substrate | HIGH | arxiv 2407.07791 (manipulated knowledge flooding in LLM multi-agent communities) |
| Coincidental LLM prior convergence producing phantom norms | MEDIUM | arxiv 2412.10609 (norm emergence review) + ACL 2025 emergent convergence findings; directly applicable but not tested at Noesis's scale |
| 7-event allowlist taxonomy | MEDIUM | Derived from Noesis invariant history + domain requirements; specific event names are design proposals, not validated |
| Skill lineage tree memory risk | LOW | Engineering inference from rig run scale (50 Nous × 10,000 ticks); no external citation; validate in Phase 18 |
