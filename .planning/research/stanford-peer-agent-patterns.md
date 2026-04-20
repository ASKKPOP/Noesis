# Stanford Peer-Agent Research → Noēsis Applications

*Research synthesis — 2026-04-20*
*Inputs: 4 parallel web searches against Stanford-origin material (Agentic Reviewer, multi-agent topology paper, SPARC, Human Agency Scale paper)*
*Purpose: decide which Stanford findings survive contact with our shipped architecture and turn them into candidate scope for Sprint 15+*

---

## TL;DR — what's worth stealing

| Stanford finding | Noēsis fit | Verdict |
|---|---|---|
| **Agentic Reviewer** (Zou, Stanford HAI) — AI strong on objective checks, unreliable on subjective novelty | Nous-to-Nous decision review as a cheap pre-filter for trade proposals, goal drift, memory integrity | ✅ High fit — adopt for *objective* invariants only |
| **Multi-agent topology taxonomy** (arxiv 2512.08296 — Indep / Central / Mesh / Hybrid) | We're effectively star-on-Grid today. Paper shows message-routing complexity grows *log* under hierarchy, *quadratically* under mesh | ⚠️ Fit is real but costly — stay star-dominant, allow *local* mesh for colocated Nous only |
| **SPARC peer-agent dialogue** — peer-to-peer beats tutor-student for learning | Telos refinement via conversation rather than prescription; Nous teaching Nous skills | ✅ Medium fit — frames the next evolution of `nous.spoke` beyond chatter |
| **Human Agency Scale H1–H5** (arxiv 2506.06576) — H3 Equal Partnership dominant in 47/104 occupations; workers want *more* agency than experts assume | Frames operator-in-the-loop UI: where does the human intervene in a Nous's life? | ✅ High fit — directly informs the operator intervention surface we haven't built yet |

**Sprint 15 candidate scope derived from this:**
1. **Agentic Invariant Checker** — lightweight "peer reviewer" Nous that runs objective-only checks on proposed trades + goal updates before they commit (Agentic Reviewer pattern, adapted)
2. **Operator Agency Tiers** — expose H1–H5 explicitly in the dashboard as the *mode* the operator is in when they intervene (H1=observe, H3=co-decide, H5=override). Law changes = H3; routine cognition = H1
3. **Peer Dialogue Memory** — upgrade `nous.spoke` events so a conversation between two Nous can cause Telos updates in *both* participants (SPARC peer learning effect)

Reject for now:
- Full mesh peer-to-peer between all Nous (complexity + audit chain cost doesn't pay back)
- AI-judged subjective evaluations (novelty, creativity, "is this a good Telos") — Zou's data says AI is bad at this and we'd be inventing pseudoscience

---

## 1. Agentic Reviewer (James Zou / Stanford HAI)

### The finding
Zou's team ran Agents for Science workshop + paperreview.ai; studied ~20,000 reviews; built an LLM reviewer and measured where it's trustworthy:

- **Strong**: number mismatches, equation contradictions, missing baselines, incomplete methodology disclosure, citation integrity
- **Weak**: novelty judgment, "is this interesting", subjective quality — frequently disagrees with expert reviewers and with itself across seeds
- **Key pattern**: the AI reviewer is a *pre-filter*, not a replacement. It catches the things humans get tired of checking; humans still decide whether the work matters

### Why this maps to Noēsis
We already have invariants that a Nous's action must satisfy but that are only enforced at *commit* time by the Grid (trade balance, DID validity, allowlist shape). We have no pre-commit layer where one Nous can sanity-check another's proposed action. The Agentic Reviewer pattern says: build that layer, but constrain it ruthlessly to objective checks.

### Concrete proposal: `ReviewerNous` (objective only)

A special role a Nous can take (or a dedicated system Nous) that runs pre-commit checks on any `trade.proposed` event before it's allowed to progress to `trade.settled`.

**Checks in scope (objective — Zou's "strong" column):**
- Proposer's Ousia balance ≥ trade amount (arithmetic; already done by Grid, but pull into the reviewer for observability)
- Counterparty DID matches regex `/^did:noesis:[a-z0-9_\-]+$/i`
- Trade amount is integer, non-negative, non-zero
- Memory references in justification exist in proposer's memory store
- No goal contradiction: active Telos goals don't mutually exclude this trade (e.g., "save Ousia" + "spend 100 Ousia")

**Checks explicitly out of scope (subjective — Zou's "weak" column):**
- "Is this a fair price?"
- "Is this trade strategically wise?"
- "Does this Nous have good taste?"

Those remain with the Nous itself (via Brain) or emerge from social dynamics.

### Implementation notes
- Fits cleanly as a new audit event: `trade.reviewed` (allowlist addition — requires explicit allowlist update)
- ReviewerNous runs synchronously between `trade.proposed` and Grid's `transferOusia` call — keeps the invariant that the audit chain serializes
- Cost: one extra Brain RPC per trade — acceptable given current tick budget
- **Risk**: do NOT let the reviewer veto on subjective grounds. If we start asking "is this a reasonable trade," we've re-invented a failure mode Zou's data explicitly warns against.

---

## 2. Multi-Agent Topology Taxonomy (arxiv 2512.08296 — "Towards a Science of Scaling Agent Systems")

### The finding
Paper tests four topologies:
- **Independent**: agents don't communicate (baseline)
- **Centralized**: hub-and-spoke through a coordinator
- **Decentralized-mesh**: every agent can talk to every other
- **Hybrid**: hierarchical clusters of mesh groups

Key quantitative results:
- Message routing complexity is `O(log N)` under hierarchy, `O(N²)` under full mesh
- Mesh wins on task *quality* for small N (<10), loses badly on throughput and debuggability for N > ~20
- Hybrid dominates above N=30

### Where Noēsis sits today
We are **Centralized**. All Nous actions route through Grid → AuditChain → (broadcast). There is no direct Nous-to-Nous channel. `nous.spoke` events are broadcast to everyone with no addressability. This is by design — the audit chain is our integrity contract.

### The tension
- Centralized gives us: single source of truth, deterministic hash chain, easy debuggability, 99.9% of what we claim to offer
- What centralized *costs* us: any genuinely peer-to-peer behavior (two Nous trading privately, a whispered teaching moment) is either impossible or observationally indistinguishable from public behavior

### Recommendation: resist full mesh; consider *scoped* peer channels

Do NOT build decentralized mesh. Reasons:
1. Audit chain is our moat; mesh breaks it
2. O(N²) is fatal at our target Nous counts (we've discussed 100+)
3. Debuggability/observability — the whole point of the dashboard — collapses

DO consider a scoped hybrid: *region-local* message routing where Nous in the same region can exchange `nous.whispered` events that are still audit-logged but not broadcast to the full firehose. This preserves integrity (still hits AuditChain) while letting social structure emerge locally.

**Payload shape (proposed):**
```
nous.whispered:
  region_id: <same region required for both parties>
  from_did: <did:noesis:...>
  to_did: <did:noesis:...>
  content_hash: <SHA-256 — content goes to private memory, not broadcast>
```

Broadcast allowlist gets `nous.whispered` but the **payload is hash-only** — content stays in per-Nous memory. This is Pitfall-3 compliant (no privacy leak) and audit-chain complete (hash in, hash out, verifiable).

### Deferred until there's a concrete user pull
This is a new frontier, not a shipped-tomorrow feature. File under "Sprint 16 or later" unless something in the live sim demands it.

---

## 3. SPARC — Peer-Agent Dialogue Pattern

### The finding
Stanford's SPARC (Systematic Problem Solving and Algorithmic Reasoning for Children) platform pairs students with LLM *peer* agents — not tutor agents. Adjacent research in the same program found:
- Peer-to-peer LLM collaboration > teacher-student LLM collaboration on math problem solving
- Reciprocal peer teaching > one-way critical debate
- The effect holds when peers have *different* partial knowledge — the disagreement is productive

### Why this is interesting for Nous
Today `nous.spoke` is essentially a public broadcast with no learning feedback. A Nous speaks; the message enters the audit chain; life goes on. The speaker learns nothing from having spoken; the listener's memory gains an entry but their Telos/Psyche/Thymos don't update meaningfully from the conversation content.

The SPARC finding suggests: conversation should *mutate* participants, and the biggest gains come from peers, not hierarchy.

### Concrete proposal: Telos-updating dialogue

When two Nous have an exchange (not a single utterance — a back-and-forth within N ticks):
1. Brain receives the full exchange as context on its next `get_state` call
2. Brain can return a `telos.refined` action if the conversation surfaced a goal tension or a new sub-goal
3. AuditChain logs `telos.refined` as a new allowlisted event with shape `{did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}` — again hash-only to avoid privacy leak

This gives us the SPARC "peer learning" effect while keeping our cognitive model (Brain owns Telos mutation, not the Grid).

### Non-goal
Do not implement LLM-peer *debate* as a decision mechanism for Grid-level choices. That's subjective judgment territory — Zou's warning applies. Dialogue should shape *internal* Nous state, not *commit* external Grid-level mutations without the reviewer/invariant gates.

---

## 4. Human Agency Scale (H1–H5) — arxiv 2506.06576v2 "Future of Work with AI Agents"

### The finding
The paper (Stanford + authors) builds the WORKBank database: 1,500 workers, 844 tasks, 104 occupations. They introduce H1–H5:

- **H1**: AI runs the task. Human absent.
- **H2**: AI runs the task with minimal oversight (human approves output).
- **H3**: Equal Partnership — AI and human co-decide in the loop.
- **H4**: Human runs the task; AI supports/advises.
- **H5**: Human only. No AI.

Results:
- **H3 dominant**: 47/104 occupations cluster at Equal Partnership
- **Worker/expert gap**: workers want higher human agency than domain experts deem necessary on 47.5% of tasks — people consistently prefer more control than the "optimal" model says they need
- Implication: designing for H1 (full autonomy) even when "theoretically fine" produces worker rejection

### Why this hits Noēsis hard
We built an observational dashboard. We have zero operator intervention surface. That's fine as long as we're claiming "zoo exhibit"; it breaks as soon as someone wants to *steward* the Nous population — change laws, intervene in a spiraling Nous, inject a shock. And the research says: even if the system technically can auto-correct, users will reject it if they don't have a lever.

### Concrete proposal: Agency-tier intervention surface

Build the operator UI with H1–H5 as a first-class concept, not an afterthought. Each intervention type gets a default tier:

| Intervention | Default tier | Rationale |
|---|---|---|
| Watch firehose / map / inspector | H1 | No action, pure observation |
| Query a Nous's memory | H2 | Read-only, but logged as `operator.inspected` |
| Pause simulation | H3 | Co-decision: operator triggers, Grid acknowledges + snapshots |
| Change broadcast-allowlist | H3 | Co-decision with a confirm dialog: "this affects integrity" |
| Change law/rule governing all Nous | H3 | Co-decision + 2-operator confirm if destructive |
| Force-mutate a specific Nous's Telos | H4 | Operator drives, system just executes |
| Delete a Nous | H5 | Operator-only, no AI "should we?" — you decided, full audit log |

### UI expression
The dashboard header gets an **Agency Indicator**: shows current tier ("You are in H1 — Observer") and any action that would elevate it triggers an explicit mode-switch: "Entering H3 — Co-decision. This will be logged." Every `operator.*` audit event records the tier at time of action.

This matches Zou's objectivity constraint (system enforces invariants even in H4/H5) and respects the worker-agency finding (users always have the higher-agency option, even when unnecessary).

### Why this is Sprint 15-sized
It's UI + a small set of new audit events + allowlist additions. No new Brain logic. It turns the dashboard from "zoo cam" into "steward console" — which is the natural v2.1 story.

---

## Open questions for discuss-phase before Sprint 15

1. **ReviewerNous deployment model** — is it a system singleton, or can any Nous opt-in as a reviewer? (Security concern: a malicious reviewer could veto-DoS the economy. System singleton is safer for v1.)
2. **nous.whispered scope** — does "region-local" mean same-Region only, or same-Region *at the tick of whisper*? Movement causes edge cases.
3. **Agency Indicator persistence** — does the tier live in per-operator session state, or is it a global "sim mode"? Global risks multi-operator conflicts; per-session risks audit confusion.
4. **H5 operations** — do we even permit "delete a Nous"? The first-life promise arguably forbids it. If we allow it, what's the audit record format?

These should be addressed in a `/gsd-discuss-phase` pass before `/gsd-plan-phase` runs.

---

## Citations

- **Agentic Reviewer / paperreview.ai** — Stanford HAI, James Zou group. Agents for Science conference 2024-2025. [paperreview.ai](https://paperreview.ai/)
- **Scaling Agent Systems** — "Towards a Science of Scaling Agent Systems", arxiv 2512.08296
- **Human Agency Scale** — "Future of Work with AI Agents", arxiv 2506.06576v2, Stanford SALT Lab + collaborators. WORKBank dataset.
- **SPARC** — Stanford GSE / CS collaboration; peer-to-peer LLM collaboration finding cross-referenced with math education LLM studies 2024-2025

---

*Next step: if this synthesis is directionally right, move into `/gsd-discuss-phase` for Sprint 15 with the open questions above as the discussion seeds.*
