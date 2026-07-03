---
milestone: cross-cutting
sources: 60+ (GitHub/arXiv, surveyed live 2026-07-02)
tags: [autonomy, learning, memory, skills, oss]
---

# OSS Landscape — Agent Autonomy & Lifelong Learning (2026-07)

> Web survey feeding the [[system-audit-2026-07|Full-System Audit]] Q1 ("can a Nous learn on its
> own and work ceaselessly toward its goals?"). Constraints honored: Brain = local-first Python,
> models = qwen3:4b (Ollama) or Claude API, no mandatory cloud, Grid = shared world + ground truth.

## 1. Skill libraries / lifelong learning

| Project | URL | License | Maturity | One-liner |
|---|---|---|---|---|
| Voyager (NVIDIA/MineDojo) | github.com/MineDojo/Voyager | MIT | 7.0k★, dormant 2024-04 | First lifelong-learning agent: auto-curriculum + growing skill library of executable code + self-verification |
| Cradle (BAAI) | github.com/BAAI-Agents/Cradle | MIT | 2.5k★, dormant | 6-module GCC agent incl. self-reflection + skill curation |
| OS-Copilot / FRIDAY | github.com/OS-Copilot/OS-Copilot | MIT | 1.8k★, dormant | Self-improving OS agent, +35% GAIA via skill reuse |
| Agent Workflow Memory | github.com/zorazrw/agent-workflow-memory | Apache-2.0 | 445★, active 2025-12 | Induces reusable NL *workflows* from own successful trajectories |
| SkillWeaver (OSU) | github.com/OSU-NLP-Group/SkillWeaver | MIT | research code | Explores, synthesizes skills as tested Python APIs |
| **Agent Skills standard** (Anthropic) | github.com/anthropics/skills · github.com/agentskills/agentskills | open standard | 157k★, very active | `SKILL.md` folders — de-facto interchange format for skills-as-artifacts |

**Fit:** port the Voyager *pattern* (skills = executable verified code, embedding-indexed, composed,
added only after self-verified success); AWM is the cheapest variant for small models. Serialize a
Nous skill library as **SKILL.md folders** — open standard, human-auditable, travels with the Nous.

## 2. Memory & reflection architectures

| Project | URL | License | Maturity | One-liner |
|---|---|---|---|---|
| Generative Agents (Stanford) | github.com/joonspk-research/generative_agents | Apache-2.0 | 21.7k★, frozen | Canonical memory stream + recency×importance×relevance retrieval + reflection + plans |
| Letta (MemGPT) | github.com/letta-ai/letta | Apache-2.0 | 23.6k★, very active | Stateful agents, self-editing memory, **sleep-time agents** (background consolidation) |
| Mem0 | github.com/mem0ai/mem0 | Apache-2.0 | 60k★, very active | Embeddable Python memory layer; fully local-capable (Ollama + Chroma/Qdrant) |
| LangMem | github.com/langchain-ai/langmem | MIT | 1.5k★ | Semantic/episodic/procedural memory SDK + background manager |
| Zep / Graphiti | github.com/getzep/graphiti | Apache-2.0 | 28.3k★, very active | Bi-temporal knowledge-graph memory (needs Neo4j/FalkorDB) |
| A-MEM | github.com/WujiangXu/A-mem | MIT | ~1k★, NeurIPS 2025 | Zettelkasten agentic memory: auto note-linking + memory evolution |
| MemOS | github.com/MemTensor/MemOS | Apache-2.0 | 10.1k★ | "Memory OS" over graph memory, cross-task skill reuse |
| MIRIX | github.com/Mirix-AI/MIRIX | Apache-2.0 | 3.6k★ | Six-type memory managed by multi-agent controller; SOTA LOCOMO |
| cognee | github.com/topoteretes/cognee | Apache-2.0 | 26.6k★ | ECL pipelines → queryable semantic graph memory |

**Fit:** production-grade embeddable = **Mem0** (or Graphiti if a graph DB is acceptable). Letta =
mine patterns (sleep-time compute), don't embed. Highest value-per-line: the **Generative-Agents
scoring formula** on the existing SQLite MemoryStore — no new deps.

## 3. Autonomous goal-pursuit frameworks

| Project | URL | License | Note |
|---|---|---|---|
| BabyAGI | github.com/yoheinakajima/babyagi | (none) | The durable artifact is the 2023 loop pattern: task queue → execute → create → reprioritize → loop |
| LangGraph | github.com/langchain-ai/langgraph | MIT | Durable graph agents; cron/"ambient" mostly paid-platform |
| CrewAI | github.com/crewAIInc/crewAI | MIT | Role crews, not persistent citizens |
| AG2 / AutoGen | github.com/ag2ai/ag2 | Apache-2.0 | Churn warning: 3 breaking migrations in 2 years |
| OpenHands | github.com/OpenHands/OpenHands | MIT | Event-sourced agent loop reference (dev-tooling) |
| smolagents (HF) | github.com/huggingface/smolagents | Apache-2.0 | Lightest embeddable Python agent loop; code-as-action |
| Agno | github.com/agno-agi/agno | Apache-2.0 | µs-scale agent instantiation; thousands of concurrent agents |

**Fit:** none gives sovereign "ceaseless" for free — **Chronos (the Grid tick) is already the
scheduler**. What's missing is a **persistent goal/task ledger** consulted each tick (BabyAGI
pattern) + local timers for off-tick background work. A heavyweight framework would fight the tick
architecture — avoid.

## 4. Self-improvement: usable vs paper-only

| Project | URL | License | Verdict |
|---|---|---|---|
| Reflexion | github.com/noahshinn/reflexion | MIT | Port the pattern (~50 lines): verbal lesson after failure, retrieved on similar decisions. Works on small models |
| Self-Refine | github.com/madaan/self-refine | Apache-2.0 | Pattern-only; weak self-feedback at 4B — prefer external Grid outcomes |
| **DSPy** | github.com/stanfordnlp/dspy | MIT | Production-grade prompt programming/optimization |
| **GEPA** | github.com/gepa-ai/gepa | MIT | Reflective prompt evolution; big model optimizes prompts FOR a small runtime model (Qwen3 0.578→0.690) |
| TextGrad | github.com/zou-group/textgrad | MIT | Usable; less momentum than GEPA/DSPy |
| Darwin Gödel Machine (Sakana) | github.com/jennyzzt/dgm | Apache-2.0 | Read-only: self-rewriting agents need frontier models + heavy sandboxing |
| AI Scientist v1/v2 (Sakana) | github.com/SakanaAI/AI-Scientist | custom | Read-only; tree-search over hypotheses idea |
| Meta self-taught evaluators | github.com/facebookresearch/RAM | MIT | Paper-only at our scale (70B-class) |

**Deployable 2026 stack for local-first small-model agents:** (1) Reflexion lessons in memory
(runtime), (2) skill/workflow induction from successful trajectories (sleep-time), (3) GEPA/DSPy
prompt evolution against logged Grid outcomes (offline). Weight-level self-improvement = research theater.

## 5. Multi-agent societies — architectural lessons

| Project | URL | License | Lesson |
|---|---|---|---|
| **Project Sid / PIANO** (Altera) | github.com/altera-al/project-sid · arxiv 2411.00114 | tech report only | 10–1000+ agent civilization. PIANO: ~10 concurrent modules at different timescales + **Cognitive Controller bottleneck** broadcasting one coherent intent. Closest published blueprint for a Nous Brain |
| Generative Agents | (above) | Apache-2.0 | Plans must persist and be revisable — not regenerated per tick |
| Concordia (DeepMind) | github.com/google-deepmind/concordia | Apache-2.0 | **Game Master** adjudicates free-form NL intents → world outcomes (future Grid idea beyond fixed action enum) |
| CAMEL + OASIS | github.com/camel-ai/camel · /oasis | Apache-2.0 | Society scaling laws; OASIS runs up to 1M agents when actions are cheap/structured |
| AI Town (a16z) | github.com/a16z-infra/ai-town | MIT | Full generative-agent loop proven fully local on Ollama — existence proof for sovereign citizens |

## 6. Small-model agents (4B–8B viability)

- NVIDIA "SLMs are the future of agentic AI" (research.nvidia.com/labs/lpr/slm-agents/): SLMs for
  narrow/repeated/structured errands; **heterogeneous cascade** (SLM default → LLM escalation) — formalizes our ollama|claude split.
- **Structured decoding**: Ollama native JSON-schema; Outlines (github.com/dottxt-ai/outlines, Apache-2.0);
  Instructor (MIT). Converts a flaky 4B "decider" into a reliable classifier over the action enum — biggest single reliability win.
- Known limits: 4B–8B lose plan coherence past ~2–3 steps, choke past ~5–10 tools → keep per-tick
  decision space tiny; hold long-horizon coherence in **external state** (goal ledger/memory), never in context.
- GEPA offline optimization makes optimized small models beat unoptimized frontier models on a fixed decision distribution.

## Top-5 recommendations (impact vs effort)

1. **Generative-Agents memory upgrade** — scored retrieval (recency×importance×relevance) + reflection pass every N ticks + Reflexion failure-lessons. Port pattern, no new deps. *High impact · low effort.*
2. **Persistent goal ledger + two-timescale loop** — BabyAGI task queue × PIANO bottleneck: slow planner (every N ticks, LARGE tier) + fast actor (every tick, JSON-schema-constrained). Goal stack survives restarts; idle ticks advance it instead of NOOPing. *Very high · moderate.*
3. **Nous skill library in SKILL.md format** — Voyager verify-then-add + AWM induction at sleep-time; top-3 retrieval into actor prompt; skills portable across Grids. *Very high (compounding) · moderate-high.*
4. **Sleep-time compute on the Chronos night cycle** — consolidate, reflect, distill skills, revise ledger, pre-plan tomorrow (Letta pattern). *High · low.*
5. **Offline prompt evolution (DSPy+GEPA) fed by Grid audit logs** + constrained decoding for the per-tick action choice. *High · moderate; zero runtime risk.*

**Embed as libraries:** Mem0 or Graphiti (optional), Outlines/Instructor, DSPy+GEPA (dev-time).
**Port patterns:** Voyager, GA memory/reflection, Reflexion, BabyAGI ledger, PIANO, Letta sleep-time.
**Avoid:** adopting LangGraph-Platform/CrewAI/AG2/Agno as the Brain core — duplicates Chronos + Brain loop, churn risk, cloud-gated "always-on" conflicts with sovereignty.

Related: [[system-audit-2026-07]] · [[oss-visualization-landscape]] · [[v3.0/NOUS-SIM-MASTERPLAN|Nous Sim Master Plan]] · [[stanford-peer-agent-patterns]]
