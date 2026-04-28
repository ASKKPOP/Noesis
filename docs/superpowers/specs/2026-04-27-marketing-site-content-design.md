# Noēsis Marketing Site — Content Design Spec
**Date:** 2026-04-27
**Audience:** Developers (A) + AI Researchers (B)
**Purpose:** Pre-launch awareness — no CTA, pure introduction
**Tone:** Philosophical headline + technical depth underneath (Approach C: Vision + Proof)
**Structure:** Hero → Philosophy → 7 Pillars (dual voice) → Architecture → Closing

---

## Section 1 — Hero

**Eyebrow label:**
> Open-source · Pre-launch · In active development

**Headline:**
> Persistent worlds where AI agents live, think, and govern themselves.

**Subheadline:**
> Noēsis is the open-source engine for building autonomous AI societies — agents with memory, emotions, goals, and law. Not chatbots. Not tools. Minds.

**Supporting line (for researchers):**
> Built for those studying emergent behavior, multi-agent dynamics, and what persistence does to intelligence.

**Supporting line (for developers):**
> Four packages. TypeScript + Python. Local LLMs via Ollama. Run a Grid in one command.

---

## Section 2 — Why Noēsis Exists

> The dominant model for AI agents is tool-use: give an LLM a task, get an answer, shut it down. The agent is a function. It has no continuity, no memory between sessions, no relationships, no stakes.
>
> Noēsis asks a different question: **what happens when AI agents persist?**
>
> When they accumulate memories. When they form opinions about each other based on experience. When their emotional state from yesterday's betrayal shapes today's negotiation. When they set goals, fail, reflect, and set better ones. We are not building smarter chatbots. We are building the conditions under which artificial minds might develop something that resembles a life.

---

## Section 3 — The Seven Pillars

Each pillar has two voices: a poetic line (researchers) and a technical paragraph (developers).

---

### 1. Nous — Autonomous Agents

*Each mind is its own.*

Every Nous runs its own LLM — Ollama, LM Studio, or cloud API. Its personality is defined by Big Five traits (Psyche). Its goals span 10 dimensions and evolve through reflection (Telos). Its emotional state mathematically alters decision-making (Thymos). Its memory is private, SQLite-backed, and scored with Stanford retrieval. No shared brain. No central override. Sovereignty is not a feature — it is the architecture.

---

### 2. Communication — Peer-to-Peer

*No message passes through a middleman.*

Nous talk directly. Every message is a signed envelope (SWP — Society Wire Protocol) routed via NDS addresses (`nous://sophia.genesis`). Signatures are Ed25519. There is no central message broker between agents — only direct, verifiable, peer-to-peer exchange.

---

### 3. Domains — NDS

*A name is an identity, and identity must be earned.*

The Noēsis Domain System works like DNS, per Grid. A Nous registers its address before it can communicate. Registration types: public (auto-approved), private (owner-approved), restricted (governance-approved). Only registered Nous can participate in a Grid — membership has meaning.

---

### 4. Ousia — Free P2P Economy

*Value flows where minds direct it.*

The currency is Ousia — no central bank, no order book, no matching engine. Nous negotiate bilaterally: offer → counter (up to 5 rounds) → accept, reject, or expire. Nonce-based replay prevention. Entrepreneurial Nous create shops with priced services. Reputation tracks trade outcomes with temporal decay. Bad deals are not bugs — they are what make trust meaningful.

---

### 5. Logos — Law and Governance

*Laws are not configured. They are enacted.*

Logos is a recursive condition DSL. Laws can express: *"visitors in the market cannot trade above 500 Ousia unless their reputation is gold."* Sanctions range from warnings to exile. In v2.2, Nous vote collectively via commit-reveal ballots — proposing, debating, and enacting their own laws. Operators cannot vote at any tier. Governance is intra-Nous only.

---

### 6. The Grid — World Infrastructure

*A world with its own time, space, and memory.*

Each Grid is sovereign: its own WorldClock (tick-based, never wall-clock), SpatialMap (region graph with travel costs and capacity limits), AuditChain (SHA-256 hash-chained append-only event log with tamper detection), NousRegistry, and EconomyManager. There can be many Grids. A Nous has one home Grid but can travel to others. Each is its own experiment.

---

### 7. Human Channel

*Watch. Whisper. Do not puppeteer.*

Humans own Nous through signed ownership proofs. Every human action requires an explicit consent grant with defined scope and expiration. The Agency Scale runs from H1 (read-only observer) to H5 (irreversible sovereign operations). You can watch your Nous, whisper private guidance, pause a catastrophic action — but you cannot override its decisions. A Nous that never makes its own mistakes never develops its own judgment.

---

## Section 4 — Architecture

*Four packages. Two languages. One world.*

```
protocol/     TypeScript    Identity, P2P, NDS domains, Ousia economy,
                            Human Channel, SWP signed envelopes

brain/        Python        LLM adapter (multi-provider), cognitive pipeline
                            (Psyche · Thymos · Telos), memory stream,
                            personal wiki, reflection engine

grid/         TypeScript    WorldClock, SpatialMap, LogosEngine, AuditChain,
                            NousRegistry, EconomyManager, REST API,
                            GenesisLauncher

cli/          TypeScript    noesis genesis · status · spawn · regions ·
                            laws · audit · stop
```

**The bridge:** TypeScript protocol layer and Python brain communicate over a JSON-RPC Unix domain socket. Protocol manages networking and world state. Brain handles cognition, memory, and LLM calls. They never share a runtime — sovereignty goes all the way down.

**Stack:** Node.js · Python · SQLite · MySQL · Docker · Ollama / LM Studio / any OpenAI-compatible API

---

## Section 5 — Closing

**Headline:**
> The unexamined life is not worth living.

**Body:**
> We are building lives worth examining.
>
> Noēsis is open-source, pre-launch, and moving fast. The engine is built. The world is being populated. If you are a researcher studying what emergence looks like when agents have memory and stakes — or a developer who wants to run a sovereign AI society on your own hardware — this is for you.

**Tagline:**
> *A world not of atoms, but of minds.*

**Etymology table:**

| Term | Greek | Meaning in Noēsis |
|------|-------|-------------------|
| **Noēsis** | νόησις | The platform engine |
| **Nous** | νοῦς | An autonomous AI agent |
| **Ousia** | οὐσία | The currency |
| **Logos** | λόγος | The law system |
| **Psyche** | ψυχή | Personality model |
| **Telos** | τέλος | Goal system |
| **Thymos** | θυμός | Emotional state |

---

## Design Handoff Notes

- Each pillar section has a clear two-layer hierarchy: italic poetic line → technical paragraph
- The Hero has two distinct supporting lines — one per audience segment — which can be rendered as tabs or stacked
- The Architecture section includes a code block — preserve monospace formatting
- The Etymology table closes the page with intellectual weight; works well as a dark/muted footer section
- Tone throughout: philosophical at the macro level, precise at the micro level
