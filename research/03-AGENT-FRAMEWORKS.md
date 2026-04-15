# Research: Multi-Agent Frameworks

## Framework Comparison

### 1. Google ADK (Agent Development Kit)

**What**: Open-source framework. Python, TypeScript, Go, Java. Shipped 2025.

**Agent Types**:
- `LlmAgent` — Core LLM-powered agent (name, model, instruction, tools, sub_agents)
- `SequentialAgent` — Runs sub-agents in order
- `ParallelAgent` — Runs sub-agents concurrently
- `LoopAgent` — Repeats until max_iterations or escalate=True
- `CoordinatorAgent` — LLM-powered routing to specialists

**State Management** (4-tier scoping):
- Session state (no prefix) — current session only
- User state (`user:` prefix) — persists across sessions per user
- App state (`app:` prefix) — global across all users/sessions
- Temp state (`temp:` prefix) — discarded after invocation

State updates via event system. Template injection: `{key}` in instructions auto-replaced from state.

**Inter-Agent Communication**:
1. Shared session state (write/read)
2. `transfer_to_agent()` function calls
3. `AgentTool` wrapping agents as callable tools

**LLM Support**: Gemini, Claude, Ollama, vLLM, LiteLLM via adapters.

**Persistence**: InMemorySessionService, DatabaseSessionService, VertexAiSessionService.

### 2. LangGraph (LangChain)

**What**: Graph-based agent orchestration. Agents as directed graph nodes.

**Core Concepts**:
- `StateGraph(State)` — typed state schema (TypedDict)
- `add_node("name", function)` — computation nodes
- `add_edge()` / `add_conditional_edges()` — flow control
- `compile()` → runnable graph
- `Send` API — dynamic parallel fan-out

**Memory Architecture** (3 types):
- Semantic: Continuously updated JSON/collections
- Episodic: Past experiences as few-shot examples
- Procedural: Agent instructions/system prompts
- Store API: `store.put(namespace, key, data)`, `store.search()` with semantic search

**Multi-Agent Patterns**:
- Orchestrator-Worker (central + parallel workers via `Send`)
- Supervisor (LLM routing)
- Swarm (agent handoffs)
- Evaluator-Optimizer (feedback loops)

**Checkpointing**: Thread-scoped state persisted to DB, resumable at any point.

### 3. AutoGen / AG2 (Microsoft)

**What**: Conversational multi-agent framework. Message-passing paradigm.

**Core Classes**:
- `ConversableAgent` — base (send/receive messages)
- `AssistantAgent` — LLM-powered
- `UserProxyAgent` — human proxy, code execution

**Communication**:
- `agent.initiate_chat(recipient, message, max_turns)`
- `GroupChat` with `GroupChatManager` (dynamic speaker selection)
- FSM-based speaker selection constraints
- Nested chats (sub-conversations as reply)

**Tool System**: `register_function(caller, executor, description)` — separates decision from execution.

### 4. CrewAI

**What**: Role-based multi-agent orchestration.

**Agent Definition**: `role`, `goal`, `backstory` + optional tools, memory, delegation.

**Process Types**:
- Sequential — linear task execution
- Hierarchical — manager agent delegates and validates

**Features**: Reasoning mode, multimodal, delegation, respect_context_window auto-summarization.

### 5. Anthropic Agent SDK (Claude)

**What**: Claude Code as a programmable library. Python/TypeScript.

**Architecture**: `ClaudeSDKClient` with built-in tool loop. Read, Write, Edit, Bash, Glob, Grep, WebSearch — all built-in.

**Multi-Agent**: Subagents via `AgentDefinition(description, prompt, tools)`. Parent-child delegation only, not P2P.

**Limitation**: Locked to Claude models. No pluggable LLM backend.

---

## Head-to-Head Comparison for Noēsis

| Criterion | ADK | LangGraph | AutoGen | CrewAI | Anthropic SDK |
|-----------|-----|-----------|---------|--------|---------------|
| **Long-running agents** | Best (4-tier state, DB persistence) | Good (checkpointing, BaseStore) | Weak (conversation only) | Weak (task-oriented) | Weak (filesystem) |
| **P2P communication** | Moderate (hierarchical + shared state) | Moderate (graph nodes + state) | Best (native initiate_chat, GroupChat) | Weak (delegation only) | Weak (parent-child) |
| **Pluggable LLMs** | Best (Gemini, Claude, Ollama, vLLM) | Best (LangChain abstraction) | Good (OpenAI-compatible) | Good (per-agent config) | None (Claude only) |
| **Persistent memory** | Best (session/user/app/temp) | Good (BaseStore, semantic search) | Weak (no built-in) | Moderate (3 memory types) | Weak (filesystem) |
| **Agent identity** | None (agents are compute units) | None (nodes are functions) | Partial (names + system messages) | Good (role/goal/backstory) | None |

---

## Stanford Generative Agents (Smallville)

The definitive reference for autonomous agent behavior (2023, Stanford/Google).

### Memory Stream

Chronological append-only database of all agent experiences:
- Each record: natural language description + timestamp + importance score + pointers to related memories
- Observations AND reflections stored in same stream

### Retrieval Function (equally weighted)

```
score = (1/3) * recency(m) + (1/3) * importance(m) + (1/3) * relevance(m, query)
```

- **Recency**: Exponential decay (0.995/hour) based on last access
- **Importance**: LLM-rated 1-10 (1=mundane, 10=significant)
- **Relevance**: Cosine similarity of embedding vectors

### Reflection Mechanism

Triggers when sum of importance scores exceeds threshold (~2-3x per simulated day):
1. Take 100 most recent memories
2. LLM generates 3 salient high-level questions
3. Retrieve relevant memories for each question
4. LLM extracts 5 insights with cited evidence
5. Store insights as reflections (with pointers to source memories)

Creates hierarchical structure: concrete observations → abstract reflections.

### Planning

Hierarchical recursive decomposition:
1. Daily: 5-8 broad goals
2. Hourly: Decompose into segments
3. 5-15 minute: Fine-grained action units

Plans stored in memory stream, can be updated mid-stream based on new observations.

### Reaction Loop

Perceive → Store observations → Decide: continue plan or react? → If react: generate context from memories, regenerate plan from reaction point.

### Cost

25 agents, 2 in-game days, GPT-3.5-turbo: thousands of dollars, multiple real-time days.

---

## Gap Analysis: What Existing Frameworks Lack for Noēsis

**What frameworks provide**:
- Tool-using agents completing tasks
- Workflow orchestration
- State persistence and sessions
- Multi-agent delegation

**What Noēsis requires that NONE provide natively**:
1. Memory stream with retrieval scoring (recency × importance × relevance)
2. Autonomous reflection (importance threshold, hierarchical abstraction)
3. Hierarchical planning (day → hour → 5-minute recursive decomposition)
4. Environment perception (spatial awareness, world model)
5. Reactive re-planning (interrupt plan based on observations)
6. Agent identity (persistent personality, backstory, relationships)
7. Value exchange / economy
8. Governance / law enforcement

### Recommendation

**Google ADK as runtime foundation**:
- 4-tier state maps to agent memory (session=short-term, user=identity, app=world)
- Event-driven architecture with persistence
- Pluggable LLMs (mix cheap for perception, powerful for reasoning)
- Sequential/Loop/Parallel primitives model perceive-plan-act loop
- Multi-language SDKs

**Build on top of ADK**:
- Memory stream with Stanford retrieval function
- Reflection engine
- Hierarchical planner
- Spatial world model
- Personality/relationship system
- Economy layer
- Governance layer

**Alternative**: Custom runtime (maximum control, but massive effort). Use ADK/LangGraph for LLM calls, state persistence, tool execution — build cognitive architecture on top.
