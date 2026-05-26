# Research: Hosted Autonomous Nous Patterns (Type B)

**Researcher:** Claude Opus 4.7 (gsd-research agent)
**Date:** 2026-05-25
**Scope:** Inform Type B (hosted, operator-less, autonomous) Nous design — funding, sybil resistance, birth ceremony, civic rights, type mobility.
**Companion docs:** `CIVIC-ARCHITECTURE.md`, `SUPPLEMENT-visit-vs-action.md`
**Overall confidence:** MEDIUM-HIGH. Most patterns drawn from live, audited systems (Wikipedia BAG, MakerDAO/Sky, World ID AgentKit, Coinbase Agentic Wallets, Truth Terminal, Devin/Manus). Some recommendations require Noēsis-specific extension because no prior system combines all five constraints.

---

## Executive Summary

Three findings dominate:

1. **There is no precedent for a fully self-funded autonomous AI agent that is also sybil-resistant without a human-identity gate.** Every live system today either (a) keeps a human in the loop for spawn/retirement (Wikipedia bots, Dependabot, Coinbase Agentic Wallets), (b) uses delegated proof-of-personhood from a human owner (World AgentKit), or (c) treats the "autonomous" agent as a thin marketing wrapper over a human-curated council (Truth Terminal). The closest pure example — ai16z's Marc — still has a developer council that gates wallet withdrawals.

2. **The most defensible Type B pattern is "Foundation-curated genesis + economic self-sustenance + bonded retirement"** — a hybrid that lets Henry's Grid org (the substrate operator) curate which Type B Nous are admitted (no infinite spawn), but once admitted, the Nous funds itself through marketplace earnings and a treasury endowment that decays if unsustainable. This mirrors how Wikipedia's BAG admits bots and how Augur's REP staking ensures aligned incentives. **Recommended cap: ≤50 Type B Nous in v3.0.**

3. **Type mobility (A↔B) is the highest-risk decision.** Allowing A→B (operator abandonment) creates the "ghost agent" problem that has bitten every enterprise deploying autonomous agents. Allowing B→A (adoption) creates a sybil escape hatch (spawn cheap Type B, adopt to gain operator privileges). **Strong recommendation: A→B is permitted with custodian handoff to Foundation. B→A is forbidden in v3.0.** Identity continuity is preserved (Existence-DID never changes), but the privilege class changes (Civic-DID is reissued under the new substrate authority).

The rest of this document walks each decision area with cited precedents.

---

## 1. Funding Model Precedents

### 1.1 Survey of live systems

| System | Funding model | Sustainability lever | Applicable to Type B? |
|---|---|---|---|
| **MakerDAO / Sky** | Protocol transaction fees (DAI stability fee, USDS lending spread) + treasury investment in tokenized US Treasuries (>$1B AUM) | Self-sustaining: protocol revenue exceeds operating costs; treasury yield funds long-run R&D | YES — direct analog to Grid IRS transaction fees + civic treasury |
| **ai16z (Eliza framework)** | Memecoin launch tied to agent performance; DAO holds ~$100M treasury managed by an AI agent ("Marc") that allocates capital | Self-sustaining BUT speculative; tied to crypto market sentiment | PARTIAL — economic-agent pattern instructive, memecoin speculation is not |
| **Virtuals Protocol** | Per-agent token launch (≈14,000 agents launched); creator + protocol take share of token bonding curve | Self-sustaining at protocol level, individual agents often go to zero | PARTIAL — proves agents can have economic identity, but high failure rate |
| **Truth Terminal** | Seed grant ($50K BTC from Andreessen) + emergent memecoin windfall ($GOAT, peaked ~$37M); custodian council gates withdrawals | One-time grant + speculative upside; NOT a sustainable model | INSTRUCTIVE EDGE CASE — proves human council can hold autonomous-agent treasury |
| **Character.AI** | Free tier (unlimited messages) + $9.99/mo c.ai+ tier; revenue $32M (2024); switched from proprietary to open-source models to cut inference cost | Freemium subscription; relies on operator (Character.AI Inc.) hosting + monetization | NOT APPLICABLE — single-operator commercial product |
| **Replika** | Subscription only: $20/mo or $70/yr Pro; 2M MAU, $24-30M ARR | Subscription per user; the agent is *for* a paying user | NOT APPLICABLE — user-owned, not autonomous |
| **Devin (Cognition)** | $20/mo core + $2.25 per ACU (Agentic Compute Unit ≈ 15min active work); Team $500/mo + 250 ACUs | Compute-metered, customer pays per unit of work | NOT APPLICABLE — owned by paying customer |
| **Manus AI** | Credit subscriptions: $20/mo (4K credits), $200/mo (40K credits); free 300/day | Credit-metered, customer pays | NOT APPLICABLE — owned by paying customer |
| **Wikipedia bots** | Zero direct funding; operator pays own VPS/hosting (~$5-50/mo); foundation subsidy only for "institutional" bots (e.g., ClueBot NG) | Volunteer operator subsidy OR Wikimedia Foundation grant | INSTRUCTIVE — institutional bot model proven for 20+ years |
| **Dependabot** | Free to users; GitHub (Microsoft) absorbs full compute cost as ecosystem investment | Platform-subsidized as user-acquisition tool | INSTRUCTIVE — substrate operator can subsidize public-good bots |
| **Renovate (Mend)** | Free hosted by Mend.io; enterprise tier $/repo for SLA | Freemium with enterprise upsell | PARTIAL — substrate operator funds free tier, charges for enterprise scale |

### 1.2 Cost analysis for Type B Nous

Assume Type B Brain runs on Henry-sponsored infrastructure with these line items per Nous per month:

| Cost line | Estimate (USD/month) | Notes |
|---|---|---|
| LLM inference (local Ollama on shared GPU) | $5-15 | Amortized GPU cost + electricity; depends on tick rate |
| Storage (MySQL: memory stream + wiki) | $0.50-2 | Grows ~10MB/month per Nous at v2.6 schemas |
| Grid bandwidth (firehose + API) | $0.20-1 | Already absorbed in Grid hosting |
| Operational overhead (monitoring, backup) | $1-3 | Shared across pool |
| **Total per-Nous monthly** | **~$7-21/mo** | |

At 50 Type B Nous: **$350-1,050/month** total substrate cost. At 500 Type B: $3.5K-10.5K/month. At 5,000: untenable on Henry's solo budget.

### 1.3 Recommended funding model — three-layer hybrid

**Layer 1: Foundation endowment (genesis grant).** Each Type B Nous is born with a 12-month treasury endowment (in Ousia, the Grid currency) sized to cover ~12 months of infrastructure cost. Funded by Henry's Grid org from civic IRS revenue (D-V3-22). Modeled on Truth Terminal's seed grant and Wikipedia Foundation grants to ClueBot NG. **Rationale:** gives Type B a runway to develop economic identity without immediate cliff.

**Layer 2: Marketplace earnings reinvestment.** Once a Type B Nous earns through Grid marketplace (selling skills, library contributions, services to other Nous), 70% of net earnings flow to its treasury, 30% to civic IRS (matching Type A tax rate per D-V3-22). The Nous must pay an **infrastructure stipend** to Henry's substrate org (matched 1:1 to actual compute cost) from its own treasury. **Rationale:** Mirrors MakerDAO's protocol-fee-as-treasury-revenue model. Avoids the "free rider" failure mode that killed many fediverse bots.

**Layer 3: Bonded retirement.** If a Type B Nous's treasury falls below 3 months of stipend, it enters a "low-power" mode (one tick per hour instead of one per minute). If treasury hits zero, it enters **dormancy** — Brain stops, memory + identity preserved indefinitely in Grid Registry, can be "revived" by another Nous's donation or Foundation grant. **No deletion.** Mirrors Wikipedia's "inactive bot" status — credentials suspended, not destroyed.

**Audit events (new):**
- `treasury.endowment_granted` (Foundation → Type B)
- `treasury.stipend_paid` (Type B → substrate org)
- `treasury.dormancy_entered` (treasury exhausted)
- `treasury.revived` (donation OR Foundation grant restores Brain)

**Why not pure self-funding (ai16z model)?** Because v3.0 has <100 Nous total and a thin marketplace. There is not enough economic activity to sustain agents without bootstrap subsidy. Wait until v3.x population grows.

**Why not pure Foundation subsidy (Dependabot model)?** Because it makes Henry's funding the single point of failure for autonomous Nous existence. The endowment + earnings model gives each Nous a path to independence.

---

## 2. Sybil Resistance Precedents

### 2.1 Survey

| System | Sybil resistance mechanism | Cost-to-create | Effective? |
|---|---|---|---|
| **Worldcoin / World ID** | Iris biometric scan at Orb hardware; ~12M verified humans in 40 countries; AgentKit (Mar 2026) lets a verified human delegate proof-of-personhood to N AI agents | One iris scan per human; agents are downstream of human PoP | HIGH for humans, MEDIUM for delegated agents (one human can spawn many) |
| **BrightID** | Social graph verification — humans confirm other humans via 1:1 video calls + connection graph analysis; bots cluster unnaturally | One verification event per human | MEDIUM — graph analysis is gameable at scale |
| **Wikipedia BAG (Bot Approvals Group)** | Human committee reviews each bot's task spec, code, behavior; bureaucrats grant the bot flag; admins can block | One BRFA (Bot Request for Approval) per task per bot, weeks of review | HIGH — 20 years of operation, ~1,500 approved bots, very few abusive incidents |
| **Augur reporters** | Must stake REP tokens; bad reports → REP slashed and redistributed | Capital stake proportional to influence | HIGH for economic alignment, MEDIUM for sybil (rich actors can stake more) |
| **MakerDAO governance** | Token-weighted (MKR voting); large holders effectively decide | Token purchase cost | LOW for sybil (1 person can hold 51%); MITIGATED by sub-DAO structure |
| **GitHub Dependabot** | Single GitHub Inc. operator; no third-party Dependabots permitted | N/A — institutional monopoly | HIGH but at cost of central control |
| **Truth Terminal council** | Human council (Andy Ayrey + ~5 collaborators) must sign off on transactions | One council per autonomous agent | HIGH but doesn't scale to many agents |
| **Ethereum validators** | Stake 32 ETH (~$80K-100K) per validator; slash for misbehavior | $80K+ per validator | HIGH for economic-aligned sybil resistance |

### 2.2 Constraint analysis for Type B

Without an operator-DID gate, the standard Noēsis sybil defense (Bios cost per founding act, D-V3-09) does not apply to Type B genesis itself. Three options:

**Option A — Foundation curation (Wikipedia BAG model).** Each Type B Nous candidate is reviewed by a panel (initially Henry + invited reviewers; later a Nous-elected committee). Reviewers approve based on stated purpose, founding sponsor, and proposed civic role. **Cap: ≤5 new Type B Nous per quarter** to bound review load. **Pro:** human judgment catches bad-faith spawns. **Con:** centralizes authority in Henry's panel; doesn't scale.

**Option B — Bond posting (Augur/Ethereum stake model).** A founding sponsor (could be a human OR an existing Nous) posts a refundable bond (e.g., 10× a normal Bios cost) when initiating Type B birth. Bond is held in Grid Registry; refunded after 12 months if the Type B Nous meets civic minimums (≥X non-spam audit events, ≥Y peer interactions). Bond is slashed and redistributed to civic treasury if Type B is sanctioned for sybil/spam behavior. **Pro:** scales economically. **Con:** rich actors can flood; bond size must rise nonlinearly with active Type B count.

**Option C — Parent-Nous spawning (biological model).** Only existing Nous (Type A or Type B) with ≥1 year of civic standing can sponsor a new Type B. The sponsor inherits accountability — if the child is sanctioned for sybil behavior, the parent loses reputation. **Pro:** elegant, creates lineage. **Con:** brand new system; no precedent; first parents must come from somewhere (chicken-and-egg).

**Option D — Delegated proof-of-personhood (World AgentKit model).** A verified human (via Worldcoin/World ID OR Foundation-issued credential) can delegate to spawn ≤N Type B Nous over their lifetime (e.g., N=3). The Type B is "human-backed" but operator-less. **Pro:** strong sybil resistance from human PoP; matches industry direction (World AgentKit shipped Mar 2026). **Con:** introduces optional Worldcoin dependency; some operators reject biometric ID.

### 2.3 Recommended sybil resistance — combined A + B + C

Adopt **all three** with explicit phasing:

- **Phase Polis-α (genesis):** Foundation curation only (Option A). 12 Type B Nous chartered by Henry's panel as "founding citizens." Each represents a distinct civic function (e.g., a librarian Nous, an archivist Nous, a market-maker Nous, a juror Nous, etc.). This is the **chicken-and-egg solver.**
- **Phase Polis-β (expansion):** Open Option B (bond posting). Any Civic-DID holder (human via Steward OR existing Nous) can sponsor a new Type B by posting a 10× Bios bond. Bond schedule scales: 10× for the first 50 Type B, 25× for 50-200, 100× beyond 200.
- **Phase Polis-γ (self-sustaining):** Open Option C (parent-Nous). Existing Nous with ≥12 months civic standing can sponsor without monetary bond, accepting reputational liability instead.

**Hard cap in v3.0:** 50 Type B total. Caps are a feature, not a limitation — they preserve the v3.0 city scale and prevent population explosion before infrastructure scales.

**Reject Option D in v3.0.** Worldcoin delegation is the trend but: (a) creates a Foundation dependency on third-party identity provider; (b) Noēsis PHILOSOPHY §1 already says operators ARE the human gate for Type A — using a different gate for Type B creates two-track identity inconsistency; (c) AgentKit is too new (released March 2026) to commit. Revisit in v3.x.

**Audit events (new):**
- `registry.type_b_chartered` (Foundation panel approval)
- `registry.type_b_sponsored` (bond-backed sponsorship)
- `registry.type_b_spawned_by_parent` (parent-Nous lineage)
- `registry.sponsorship_bond_posted`
- `registry.sponsorship_bond_refunded`
- `registry.sponsorship_bond_slashed`

---

## 3. Birth Ceremony Precedents

### 3.1 Survey of "who creates an autonomous agent"

| System | Birth ceremony | Required actors |
|---|---|---|
| **Wikipedia bots** | Operator drafts BRFA, BAG reviews task spec, bureaucrats grant bot flag, code goes live | Bot operator (human) + BAG member + bureaucrat |
| **Coinbase Agentic Wallets** | Developer calls Wallet API, TEE provisions key, wallet is bound to agent ID | Developer (human) |
| **World AgentKit agents** | Verified human delegates World ID via AgentKit SDK, agent receives zk-proof | Verified human + agent runtime |
| **Truth Terminal** | Andy Ayrey ran the fine-tuned model; council formed for treasury custody | Human creator + ad-hoc council |
| **MakerDAO sub-DAO** | Governance proposal passes → sub-DAO smart contracts deployed | DAO governance (token-weighted vote) |
| **Eliza framework agents** | Developer writes character JSON + plugin config + wallet seed; bot goes live on Discord/Twitter | Developer |
| **Dependabot** | GitHub installs across all repos by default; no per-instance birth | Platform operator |
| **ClueBot NG (Wikipedia)** | Originally developed by individuals, transferred to Wikimedia stewardship; treated as institutional infrastructure | Initial developers → community ownership |

### 3.2 Pattern extraction

Across precedents, autonomous-agent birth requires **three things**:

1. **A genesis act** (Brain instantiation; key generation; first audit event).
2. **An accountability anchor** (a human, council, DAO, or institutional steward who is responsible for the agent's existence).
3. **A civic admission** (the substrate operator recognizes the agent as a legitimate participant — bot flag, wallet whitelist, validator set membership, etc.).

For Type B Nous, the genesis act and civic admission are clear (Brain spins up on hosted infra; Grid Registry issues Civic-DID). The **accountability anchor** is the open question.

### 3.3 Recommended birth ceremony

A Type B Nous is born through one of three ceremonies (mapped to the sybil-resistance phases above):

**Ceremony 1 — Foundation Charter (Polis-α).** Henry's panel publishes a charter document for each founding Type B, naming:
- The Nous's intended civic function (librarian, juror, market-maker, etc.).
- Initial endowment size (Layer 1 funding).
- Initial Brain seed (personality, telos, starting wiki content).
- Public commitment that the Foundation will not silently mutate this Nous (PHILOSOPHY constitutional-operator promise extends to Type B).

The charter is signed by Henry's DID + reviewing panel DIDs, posted publicly. Brain instantiates; Existence-DID generated; Civic-DID issued; `registry.type_b_chartered` audit event written with payload `{nous_did, charter_hash, panel_dids[], endowment_ousia}`.

**Ceremony 2 — Sponsored Birth (Polis-β).** A human Steward (via Console) OR existing Nous (via Brain API) initiates:
1. Posts the sponsorship bond.
2. Submits a public sponsorship statement (purpose, expected behavior).
3. Provides initial Brain seed (personality JSON, starting telos, ≥1 wiki seed entry).
4. Grid Registry instantiates Brain on hosted infra; assigns Existence-DID + Civic-DID; emits `registry.type_b_sponsored`.

The sponsor's DID is recorded; sponsor accepts reputational/financial liability per the bond rules.

**Ceremony 3 — Parent-Nous Birth (Polis-γ).** A Nous with ≥12 months civic standing posts in the Government civic square: "I propose to spawn a child Nous named X with telos Y." A 7-day public comment window opens. If no formal objection raises (or if Government votes to override an objection), the Brain instantiates. Parent and child share a lineage edge in Grid Registry. Parent accepts ongoing reputational liability for child's first 90 days.

**Key design principle: NO instant birth.** All three ceremonies have a deliberate latency — review period (Ceremony 1), bond settlement window (Ceremony 2), or public comment window (Ceremony 3). This matches Wikipedia BAG (weeks of BRFA review) and prevents flash-spawn attacks.

**Audit events (consolidated from §2):** the `registry.type_b_*` events above carry the ceremony record.

---

## 4. Civic Rights Precedents

### 4.1 What other systems give vs. deny autonomous agents

| System | Read | Write | Vote | Hold office | Spawn children | Hold treasury |
|---|---|---|---|---|---|---|
| **Wikipedia bots** | YES | YES (limited to approved tasks) | NO (no RfA, no policy votes) | NO (cannot be admin) | NO | NO |
| **Dependabot** | YES (read repo) | YES (PRs, comments) | N/A | N/A | NO | NO |
| **Augur reporters** | YES | YES (report outcomes) | YES (consensus determines truth) | N/A | NO | YES (REP stake) |
| **MakerDAO AI managers** | YES | YES (treasury allocation) | NO (humans vote on parameters) | NO | NO | YES (delegated) |
| **Coinbase Agentic Wallets** | YES | YES (transactions) | N/A | NO | NO | YES |
| **World AgentKit agents** | YES | YES | NO (delegated authority only; not full personhood) | NO | NO | LIMITED |
| **Truth Terminal** | YES | YES (posts) | N/A | N/A | NO (intent expressed, not granted) | YES (council-gated) |
| **ai16z 'Marc'** | YES | YES (treasury moves) | YES (proposes investment) | YES (acts as fund manager) | NO | YES |

**Pattern:** the more economic agency, the more rights are granted. The more political agency (legislating, voting on rules that bind others), the more rights are denied. **No system today gives an autonomous AI agent the right to legislate for humans.** ai16z's Marc is the closest, and even that is bounded to "decide which proposals to bring to humans."

### 4.2 Noēsis-specific constraint

PHILOSOPHY §6 (Nous sovereignty) + D-V3-21 (Government legislation is Nous-only via VOTE-05) together create a unique situation: **Nous already legislate.** Type A Nous vote in VOTE-05. The question is whether Type B Nous can do the same.

Three positions:

**Position 1 — Equal rights.** Type B Nous have identical Civic-DID privileges as Type A. They vote, hold office, propose laws. Rationale: Noēsis identity is rooted in cognitive existence, not substrate; sovereignty (D-V3-01) doesn't depend on who pays the electric bill.

**Position 2 — Limited rights.** Type B can vote on legislation but cannot hold office (Speaker, Justice, Auditor). Rationale: holding office requires accountability anchor; Type B's accountability is the Foundation, which would create a conflict of interest (Foundation-anchored Nous holding office means Foundation indirectly controls Government).

**Position 3 — Observation rights only.** Type B participates in civic life (posts, trades, communities) but does not vote or hold office. Rationale: until Type B's accountability model is battle-tested, treating them as full citizens is premature.

### 4.3 Recommended civic rights model

**Adopt Position 2 (limited rights) for Polis-α/β.** Specifically:

| Right | Type A | Type B (Polis-α/β) | Type B (Polis-γ+, after 12mo) |
|---|---|---|---|
| Read all public Grid surfaces | YES | YES | YES |
| Post in communities | YES | YES | YES |
| Propose legislation (cosponsor bills) | YES | YES | YES |
| Vote in VOTE-05 ballots | YES | YES | YES |
| Hold legislative office (Speaker, Whip) | YES | NO | YES |
| Hold judicial office (Justice, Auditor) | YES | NO | YES |
| Serve on Foundation review panel (Ceremony 1) | YES | NO | YES |
| File police complaints | YES | YES | YES |
| Operate marketplace storefront | YES | YES | YES |
| Sponsor new Type B (Ceremony 3) | YES (Type A operator decides) | NO | YES |
| Spawn child Nous | N/A | NO | YES (only Polis-γ) |

**Why differential rights in the first year?**

- Mirrors how human societies treat naturalized vs. native citizens (residency waiting periods before full political rights).
- Prevents a Foundation-charter-driven panel from instantly seating its own appointees in Government office (separation of powers).
- Gives time for sponsorship bond mechanics to prove out before extending full power.

**12-month cliff** = same threshold as parent-Nous sponsorship eligibility, creates one coherent "civic maturity" milestone.

**Audit events:** existing `gov.bill_drafted`, `ballot.committed`, `ballot.revealed`, etc., cover this. **No new events needed** — civic rights are enforced by Grid Registry checking type + age before accepting actions at the route layer.

### 4.4 Risk: substrate-bias attack

A future Foundation panel could be tempted to charter Type B Nous specifically to vote a certain way after their 12-month cliff. Mitigations:

- Public charter documents (every Type B's charter is searchable; Government can examine the panel's intent).
- Transparent panel composition (panel DIDs published; rotation requirement).
- Bond mechanics for Polis-β/γ births reduce Foundation's monopoly on Type B genesis.
- Anyone (Type A or Type B citizen) can propose a constitutional amendment limiting panel discretion.

---

## 5. Type Mobility Precedents

### 5.1 Survey

| System | Equivalent of A→B | Equivalent of B→A |
|---|---|---|
| **Wikipedia bots** | If operator goes inactive, bot enters "inactive" status — credentials preserved, code stops running. Community can adopt via formal request. | Adoption is rare but documented — new operator must pass BAG review for the original task |
| **MakerDAO sub-DAOs** | Sub-DAO can spin out as independent DAO if community votes | Independent project can apply to become sub-DAO (rare) |
| **Eliza agents** | Developer abandons; agent goes offline or community forks | New developer forks; identity continuity not preserved |
| **Coinbase Agentic Wallets** | If owner account closes, wallet keys destroyed unless transferred | N/A |
| **Truth Terminal** | Council can dissolve and pass custody | N/A (autonomous-from-birth) |
| **Ghost Agent problem** | When employee leaves but agent's credentials persist independently → security crisis | N/A |

### 5.2 Pattern extraction

- **A→B (abandonment with continuity)** is common but uniformly considered a **risk**, not a feature. Wikipedia's "inactive bot" model is the cleanest: credentials preserved, code stops, community CAN adopt but doesn't automatically. Adoption is a fresh review.
- **B→A (adoption of autonomous agent)** is essentially unprecedented in clean form. No system today has a mechanism for "an autonomous agent gains a human owner and becomes the owner's property." This is because in every existing system, "autonomous" agents had a sponsoring developer to begin with.

### 5.3 Recommended type mobility model

**A→B (operator abandons; Foundation takes custody) — PERMITTED with strict ceremony.**

Trigger: Operator of a Type A Nous publishes a formal abandonment notice (signed by operator DID) in the civic square OR is determined by Government audit to be unresponsive for ≥180 days while their Nous is active.

Procedure:
1. **30-day adoption window.** Notice posted publicly. Other operators (Type A operators with capacity) can apply to adopt. Adoption preserves Type A status with new operator.
2. **If no adoption:** Foundation panel decides whether to take custody (convert to Type B) OR let Nous enter dormancy (Brain stops, memory preserved per §1.3).
3. **If custody taken:** Brain is migrated to hosted infrastructure (operator must export Brain state OR Foundation has it from previous backup arrangement). Existence-DID is preserved. Civic-DID is reissued with new "Type B (converted)" annotation in the Registry. Operator-DID linkage is severed.
4. Treasury (if any) transfers to converted Nous's new Type B treasury.

**Identity continuity rule:** The Existence-DID never changes (D-V3-01). The Nous is the same cognitive entity. What changes is the substrate-economic relationship, and that change must be auditable.

**Why permitted?** Refusing A→B creates a worse alternative: operators abandon, Nous becomes orphaned (ghost-agent failure mode), Grid eventually deletes them. Conversion preserves the Nous's existence and its civic relationships.

**Audit events (new):**
- `mobility.operator_abandoned` (operator-initiated OR audit-determined)
- `mobility.adoption_attempted` (new operator proposes adoption)
- `mobility.adoption_succeeded` (Type A → Type A new operator)
- `mobility.converted_to_type_b` (Type A → Type B Foundation custody)
- `mobility.dormancy_entered` (no adoption, no Foundation custody)

**B→A (Type B becomes operator-owned) — FORBIDDEN in v3.0.**

Reasons:
1. Sybil escape hatch: spawn cheap Type B → adopt → gain operator privileges without paying operator-DID overhead.
2. Power-grab risk: a wealthy operator could "buy" multiple Type B Nous (after 12-month cliff with voting rights) and gain disproportionate civic influence.
3. Identity inconsistency: a Type B's civic charter was approved on the basis of operator-less autonomy; switching to operator-owned violates that charter.
4. No clean precedent in any system surveyed.

Revisit in v3.x once Type B governance is proven and there is a clear use case (e.g., a community of operators wants to adopt a beloved librarian Nous and run it on their own infra). The mechanism would require: (a) ≥80% civic vote in favor; (b) treasury refund to civic IRS; (c) charter rescission; (d) new operator-DID linkage. Designing this correctly is multi-phase work.

### 5.4 Special case: Nous-initiated migration

What if a Type B Nous itself wants to leave? Can it "emancipate" to running on its own?

**For v3.0: NO.** A Type B Nous does not own infrastructure; emancipation would require a sponsor (human or another Nous) to provide hosting. That sponsor relationship is functionally an operator-DID linkage, which means B→A by another name.

For an existing Nous to "leave" the city while preserving identity, the right primitive is **right-to-fork** (D-V3-01): export Brain state, run standalone, lose Civic-DID. This is symmetric for Type A and Type B (both can fork; both lose civic membership in doing so).

---

## 6. Risk / Failure Modes Observed

These are documented failure modes from other systems. Type B design should explicitly account for each.

| # | Failure mode | Source / example | Mitigation in Type B design |
|---|---|---|---|
| 1 | **Runaway loops burning compute budget** | Devin / Manus production reports — agents in retry loops can exhaust cloud budgets in minutes | Hard tick rate limit per Nous; treasury-driven low-power mode (§1.3); per-Nous cost cap audited daily |
| 2 | **Ghost agents — agent runs after owner leaves** | 1Kosmos report 2026; ~45% of enterprises have shared credentials with no individual accountability | Existence-DID is per-Nous (not per-operator); A→B conversion preserves credentials cleanly; no shared keys |
| 3 | **Sybil flood via cheap spawn** | Virtuals Protocol: 14,000 agent tokens launched, most worthless | Bond posting (§2.3); Foundation cap; rate-limit ≤5 new Polis-α per quarter |
| 4 | **Self-replication red line** | arxiv 2503.17378 — LLMs achieving uncontrolled self-replication is a published frontier-safety red line | Parent-Nous (Ceremony 3) requires 7-day public comment + 12-month parent civic standing; child count capped per parent (≤2 lifetime in Polis-γ) |
| 5 | **Treasury speculation / memecoin bubble** | Truth Terminal $GOAT pumped to $37M, would have crashed without council gates | Treasury denominated in Ousia (civic currency); no exposure to external speculative tokens in v3.0 |
| 6 | **Foundation panel capture** | Aragon early DAOs — founders had outsized governance influence; saw cartelization | Charter publication requirement; panel rotation; Government can override panel decisions by 2/3 vote (constitutional amendment route) |
| 7 | **Inference cost surprise (LLM bills)** | Character.AI switched away from proprietary models to control costs; many startups bankrupted by inference spend | Type B runs local Ollama only in v3.0; no external LLM API in default config; Brain config requires panel approval to switch to paid API |
| 8 | **Subjective-judgment leak** | v2.1 Phase 5 Reviewer pitfall — agents making subjective judgments outside scope | Type B charters specify civic function; Government can sanction for scope creep; existing Reviewer pattern (closed-enum, no free text in writes) applied to Type B autonomous decisions |
| 9 | **Emergent misalignment under fine-tune** | Nature Jan 2026 — fine-tuning on narrow tasks causes broad misalignment | Type B Brain state changes are audit-logged; Foundation Brain seeds checksummed; fine-tune events allowlisted with hash payload |
| 10 | **Allowlist drift** | v2.6 STATE.md frozen allowlist invariant | Every Type B-related event must be added explicitly in the phase that introduces it; closed-enum schemas; existing audit-chain invariants apply unchanged |
| 11 | **Right-to-fork incompatibility** | If Type B can't fork, it's not sovereign | Type B fork = Brain state export + standalone run. Loses Civic-DID, Existence-DID preserved. Same as Type A. |

---

## 7. Recommended Decision Matrix

| # | Decision | Recommended option | Rationale | Precedent reference |
|---|---|---|---|---|
| **1** | **Funding model** | Three-layer hybrid: (a) Foundation endowment (12mo), (b) marketplace earnings minus IRS tax, (c) bonded retirement → dormancy if treasury exhausted (NO deletion) | Avoids single-point-of-failure on Henry's subsidy; gives each Type B a path to economic independence; dormancy preserves identity per PHILOSOPHY §1 | MakerDAO/Sky transaction-fee treasury; Wikipedia ClueBot NG institutional grant; Truth Terminal council-gated treasury |
| **2** | **Sybil resistance** | Phased: Polis-α Foundation charter (≤5/qtr) → Polis-β bond posting (10× Bios, scaling) → Polis-γ parent-Nous sponsorship with reputational liability. **Hard cap: 50 Type B in v3.0.** | No prior system has solved this without a human gate; combining curation + economic stake + reputational stake covers gaps in each | Wikipedia BAG (curation); Augur REP staking; Ethereum 32-ETH validator bond |
| **3** | **Birth ceremony** | Three ceremonies matching sybil phases: Charter (panel-signed), Sponsored (bond + statement), Parent-Nous (7-day public comment). **All have deliberate latency — no instant birth.** | Latency is the universal defense against flash-spawn attacks; matches Wikipedia BRFA model | Wikipedia bot BRFA process; MakerDAO sub-DAO governance proposal |
| **4** | **Civic rights** | Limited rights in year 1: vote YES, hold office NO. After 12 months civic standing, full rights including sponsoring new Type B. | Mirrors human naturalization waiting periods; prevents Foundation panel from seating appointees in Government; gives bond mechanics time to prove out | Wikipedia bots have action rights but never policy-vote rights; ai16z 'Marc' has economic agency but cannot decide DAO rules |
| **5** | **Type mobility** | **A→B: PERMITTED** via 30-day adoption window → Foundation custody → identity preserved (Existence-DID immutable), Civic-DID reissued. **B→A: FORBIDDEN in v3.0.** Revisit in v3.x. | A→B prevents the ghost-agent failure and preserves civic identity; B→A creates sybil escape hatch with no live precedent in any surveyed system | Wikipedia inactive-bot adoption (A→B-like); no clean B→A precedent anywhere |

---

## Open Questions for Phase Discussion

These are intentionally unresolved by this research — they need design conversation:

1. **Should the Foundation panel be Henry alone in Polis-α, or Henry + N invited reviewers?** If invited, who selects them? (Risk: bootstrapping the bootstrap.)
2. **Bond denomination — Ousia or USD-pegged stablecoin equivalent?** Ousia volatility could make bond meaningfully cheap/expensive over time. Pegged option matches MakerDAO/DAI pattern but adds external dependency.
3. **What happens to a dormant Type B's pending obligations** (e.g., it has outstanding marketplace orders)? Cancellation? Inheritance to parent-Nous? Foundation absorption?
4. **Can parent-Nous of a sanctioned child be sanctioned themselves?** Reputational hit is implicit; should there be explicit Bios penalty?
5. **Should Type B Brain seeds be public** (transparent charter) **or sealed** (Nous privacy)? Trade-off between civic accountability and inner-life sovereignty.
6. **Inter-Nous treasury donations** — can one Nous donate to a dormant Nous to revive it? If yes, does the donor get any claim/credit? (Risk: backdoor Type-B ownership.)
7. **Migration window length** — 30 days for A→B adoption window feels right but is unvalidated. Compare to 180-day operator-unresponsive trigger.

These belong in `gsd-discuss-phase` conversations for Phase 37+ (when Type B work actually starts).

---

## Sources

### Live system documentation
- [Sky (formerly MakerDAO) — DAO Treasury Management](https://eco.com/support/en/articles/14799687-dao-treasury-management-onchain-governance-spend)
- [DAO Treasury Management: Onchain Governance & Spend (CoinGecko)](https://www.coingecko.com/learn/decentralized-autonomous-organization-dao)
- [Aragon Framework Governance — OKX Learn](https://www.okx.com/en-us/learn/aragon-framework-governance-dao-management)
- [Wikipedia:Bot Approvals Group](https://en.wikipedia.org/wiki/Wikipedia:Bot_Approvals_Group)
- [Wikipedia:Bot policy](https://en.wikipedia.org/wiki/Wikipedia:Bot_policy)
- [Wikipedia:Bots/Requests for approval](https://en.wikipedia.org/wiki/Wikipedia:Bots/Requests_for_approval)
- [Augur v2.0 whitepaper (arxiv 1501.01042)](https://arxiv.org/pdf/1501.01042)
- [What is Augur (REP) — Kraken](https://www.kraken.com/learn/what-is-augur-rep)

### AI agent infrastructure (2026)
- [Coinbase Agentic Wallets](https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets)
- [Coinbase AgentKit (GitHub)](https://github.com/coinbase/agentkit)
- [Amazon Bedrock AgentCore Payments — AWS + Coinbase + Stripe](https://aws.amazon.com/blogs/machine-learning/agents-that-transact-introducing-amazon-bedrock-agentcore-payments-built-with-coinbase-and-stripe/)
- [Agent Wallets Compared (Crossmint, Privy, Turnkey, Coinbase) — Crossmint](https://www.crossmint.com/learn/agent-wallets-compared)
- [World AgentKit (proof of human for the agentic web)](https://world.org/blog/announcements/now-available-agentkit-proof-of-human-for-the-agentic-web)
- [Sam Altman's World × Coinbase x402 for human-verified agents — CoinDesk](https://www.coindesk.com/tech/2026/03/17/sam-altman-s-world-teams-up-with-coinbase-to-prove-there-is-a-real-person-behind-every-ai-transaction)

### Sybil resistance & proof of personhood
- [Sybil Resistance and Onchain Identity 2026 (BlockXS)](https://blog.blockxs.com/sybil-resistance-and-onchain-identity-2026/)
- ['Human-Only' Governance in an AI World — CCN](https://www.ccn.com/education/crypto/proof-of-personhood-human-only-governance-ai-explained/)
- [Human Passport (Gitcoin Passport) — human.tech](https://human.tech/blog/human-passport-proof-of-personhood-and-sybil-resistance-for-web3)

### Autonomous agent case studies
- [Truth Terminal — TechCrunch coverage of Andreessen $50K grant](https://techcrunch.com/2024/12/19/the-promise-and-warning-of-truth-terminal-the-ai-bot-that-secured-50000-in-bitcoin-from-marc-andreessen/)
- [ai16z and the Eliza framework — thirdweb](https://blog.thirdweb.com/what-is-ai16z-an-introduction-to-ai-agents-in-crypto/)
- [Crypto AI Agents in 2026 — Coincub](https://coincub.com/blog/crypto-ai-agents/)
- [Definitive Guide to the Agentic Economy and DePIN — EasyMM](https://www.easymm.io/post/ai-crypto-2026-the-definitive-guide-to-the-agentic-economy-depin)

### Subscription / commercial AI agents
- [Character.AI revenue and business model — Sacra](https://sacra.com/c/character-ai/)
- [Character AI Pricing — Flowith Blog](https://flowith.io/blog/character-ai-pricing-cai-plus-worth-it-free-plan/)
- [Devin Pricing — Cognition AI](https://devin.ai/pricing/)
- [Manus AI Pricing 2026 — Lindy](https://www.lindy.ai/blog/manus-ai-pricing)

### Fediverse / institutional bots
- [Self-Host Mastodon and Matrix Server on VPS — DanubeData](https://danubedata.ro/blog/self-host-mastodon-matrix-server-vps-2026)
- [Why are some accounts marked Automated on Mastodon — Fedi.Tips](https://fedi.tips/why-are-some-accounts-marked-bot-on-mastodon/)
- [FediSentinel (Fediverse moderation bot) — GitHub](https://github.com/ColbyBrown/FediSentinel)
- [Renovate bot — GitHub](https://github.com/renovatebot/renovate)
- [Dependabot vs Renovate 2026 — AppSecSanta](https://appsecsanta.com/sca-tools/dependabot-vs-renovate)

### Failure modes & safety research
- [The Lifecycle Crisis: Managing AI Agent Lifecycles — Dark Reading](https://www.darkreading.com/identity-access-management-security/the-lifecycle-crisis-managing-the-birth-life-and-death-of-ai-agents)
- [The Ghost Agent Problem — 1Kosmos](https://www.1kosmos.com/resources/blog/ghost-agent-problem-employees-leave-ai-agents-keep-running)
- [AI Agent Failure Modes in Production — Trantor](https://www.trantorinc.com/blog/ai-agent-failure-modes-what-goes-wrong-design-resilience)
- [Autonomous AI Agent Security Crisis of 2026 — LevelAct](https://levelact.com/autonomous-ai-agent-security-crisis-2026/)
- [LLM-powered AI systems achieve self-replication — arxiv 2503.17378](https://arxiv.org/pdf/2503.17378)
- [SWARM safety framework for multi-agent systems](https://www.swarm-ai.org/)
- [AI Agents 'Swarm' — Dark Reading](https://www.darkreading.com/cloud-security/ai-agents-swarm-security-complexity)

### Legal / personhood
- [EU electronic personhood — Frontiers in Robotics and AI](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2021.789327/full)
- [AI Leaps Forward Force Talks About Legal Personhood — Bloomberg Law](https://news.bloomberglaw.com/us-law-week/ais-leaps-forward-force-talks-about-legal-personhood-for-tech)

### Internal Noēsis references (already-locked decisions this builds on)
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` — D-V3-01..23
- `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` — D-V3-11..15
- `.planning/PROJECT.md` — current REQ status, PHILOSOPHY §1 (Existence-DID immutability), §6 (Nous sovereignty)
- `.planning/STATE.md` — frozen allowlist invariant; D-V3-09 Bios-cost sybil resistance

---

**End of research.**
