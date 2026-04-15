# Research: Agent Memory Systems

## Memory Architecture Types

### Episodic Memory
Specific events with timestamps and context. In Stanford Generative Agents, every perception is saved as natural-language record in a "memory stream" — time-ordered append-only log.

### Semantic Memory
General knowledge and facts. Key-value pairs or knowledge graphs. MIRIX system implements distinct "Semantic" and "Knowledge Vault" types.

### Procedural Memory
Learned skills and behaviors. Least developed — usually plan templates or tool-use patterns.

### Working Memory
Current context/attention. In LLM agents = the prompt context window (assembled retrieved memories + goals + observations).

---

## Memory Retrieval

### Stanford Scoring Function

```
score = α * recency(m) + β * importance(m) + γ * relevance(m, query)
```

Default: α = β = γ = 1/3 (equally weighted)

- **Recency**: Exponential decay, factor 0.995 per hour since last access
- **Importance**: LLM-rated integer 1-10
  - 1 = mundane (brushing teeth)
  - 10 = significant (entering college)
- **Relevance**: Cosine similarity of embedding vectors

### A-MEM Note Structure (Zettelkasten-inspired, NeurIPS 2025)

```
m_i = {c_i, t_i, K_i, G_i, X_i, e_i, L_i}
```

| Field | Type | Content |
|-------|------|---------|
| c | text | Original content |
| t | timestamp | Creation time |
| K | string[] | LLM-generated keywords |
| G | string[] | LLM-generated categorical tags |
| X | text | LLM-generated contextual description |
| e | float[768] | Embedding of concat(c, K, G, X) |
| L | ID[] | Linked memory IDs |

**Linking algorithm**: Cosine similarity across all memories → top-k candidates → LLM decides which links are meaningful. Creates emergent knowledge graph without predefined schema.

**Bidirectional evolution**: When a new memory is added, nearby historical memories are updated by LLM to reflect new relationships.

### Forgetting: MemoryBank (Ebbinghaus Curve)

```
p(t) = 1 - exp(-r * e^(-t/g_n))
```

- r = relevance (cosine similarity)
- t = elapsed time
- g_n = decay gradient, updates on recall: g_n = g_(n-1) + S(t)
- S(t) = (1 - e^(-t)) / (1 + e^(-t))

Key: Memory strength never reaches absolute zero. Long recall intervals strengthen memory more than frequent short intervals (spacing effect).

### Power-Law Decay

Activation halves every ~7 days without access. Access-based decay outperforms time-based decay.

---

## Vector Database Comparison

| Dimension | ChromaDB | Qdrant | Weaviate | Milvus |
|-----------|----------|--------|----------|--------|
| **Best Scale** | <10M vectors | <50M vectors | <50M vectors | Billions |
| **Latency** | Low (embedded) | Sub-ms p99 small | Sub-100ms | <30ms p95 |
| **Indexing** | Basic HNSW | HNSW (Rust) | Graph hybrid | HNSW configurable |
| **Metadata Filtering** | Built-in + FTS | Rich JSON, nested | Integrated | Supported |
| **Deployment** | Embedded only | Self/Cloud/Hybrid | Self/Cloud | Self/Zilliz Cloud |
| **Language** | Python (Rust rewrite 2025) | Rust | Go | Go/C++ |
| **Hybrid Search** | Limited | Yes | Native (vector + BM25) | Supported |
| **License** | Apache 2.0 | Apache 2.0 | BSD-3 | Apache 2.0 |

### Recommendation for Noēsis

- **Prototype**: ChromaDB — embedded, zero-config, runs in-process per agent
- **Production**: Qdrant — Rust performance, rich metadata filtering (agent ID, memory type, time ranges), self-hostable
- **Scale (10K+ agents)**: Milvus — proven at billion-scale, separate storage/compute

---

## Persistent Structured State

### SQLite vs PostgreSQL

| Factor | SQLite | PostgreSQL |
|--------|--------|------------|
| **Deployment** | Embedded, single file | Server process |
| **Concurrency** | Single writer (WAL helps) | Full MVCC |
| **Per-agent isolation** | One .db file per agent | Schema/row-level |
| **Migration path** | → PostgreSQL when outgrown | Production from day 1 |
| **Operational cost** | Zero | Server management |

### Recommended Schema (per-agent SQLite)

```sql
agents(id, name, personality_json, current_location, created_at)
goals(id, agent_id, description, priority, status, deadline)
relationships(agent_id, other_agent_id, type, strength, last_interaction)
inventory(agent_id, item_id, quantity, acquired_at)
memories(id, agent_id, content, importance, embedding_id, created_at, last_accessed)
plans(id, agent_id, description, start_time, end_time, status, parent_plan_id)
```

Move to PostgreSQL when: cross-agent queries needed, concurrent writes matter, or world state needs single queryable store.

---

## Reflection Architecture for Noēsis

Based on Stanford + A-MEM research:

### Trigger
When sum of importance scores for recent memories exceeds threshold.
Practical: ~2-3 reflections per simulated day.

### Process
1. Take 100 most recent memories
2. LLM generates 3 salient questions about the memories
3. Retrieve relevant memories for each question (using scoring function)
4. LLM generates 5 high-level insights with cited evidence
5. Store insights as reflection-type memories with pointers to sources

### Hierarchical Abstraction
- Level 0: Raw observations ("I saw Hermes at the Agora")
- Level 1: Reflections ("Hermes frequently visits the Agora around noon")
- Level 2: Meta-reflections ("Hermes seems to be building a trading network")

Each level links to its source memories via the A-MEM linking mechanism.
