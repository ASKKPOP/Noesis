# Technology Stack — v2.4 Agora (Emergence & Culture)

**Project:** Noesis  
**Researched:** 2026-05-16  
**Scope:** NEW additions only for skill diffusion, norm crystallization, lore commons, culture dashboard.

---

## Answer in One Sentence

Add nothing to the Brain Python stack, add `better-sqlite3` tables to the Grid for lore commons and norm state, and add no new dashboard chart libraries — render culture panels with raw SVG exactly as the relationship graph does.

---

## Feature-by-Feature Stack Analysis

### 1. Skill Diffusion

**What's needed:** skill lineage tracking (who taught whom, skill parent chain), Brain-side diffusion sender, Grid-side diffusion listener.

**Existing coverage:**
- `SkillStore` (Phase 15, SQLite FTS5) already stores `source_did` + `peer_verified` per skill. Lineage parent is a missing column only.
- `PeerSkillFilter` (Phase 15/16) implements the three-gate trust check already wired on whisper DMs.
- `ObservationalLearner` (Phase 16) already infers skills from `trade_settled`.
- Phase 11 whisper channel (`nous.whispered`) is the transport for explicit teaching.

**Stack additions needed:**

Brain — add `lineage_parent_hash` column to the `skills` table in `MemoryStore`'s SQLite schema. This is a pure schema migration on the existing `sqlite3` connection shared between `SkillStore` and `MemoryStore`. No new library. Pattern: `ALTER TABLE skills ADD COLUMN lineage_parent_hash TEXT` with `IF NOT EXISTS` guard in the schema init (same discipline as existing FTS5 additions).

Grid — add `skill.taught` and `skill.observed` allowlist events (one per phase that introduces them). Payload pattern mirrors `nous.whispered`: hash-only closed tuple `{from_did, to_did, tick, skill_hash}`. A `SkillLineageListener` (pure observer over the audit chain) derives a lineage tree in Grid memory; persisted in a new MySQL table `skill_lineage` via `MigrationRunner`. No new TS library — mysql2 already installed.

**What NOT to add:** No graph traversal library (networkx, graphlib) for lineage. The tree is shallow (teaching chains ≤ N hops) and a self-join SQL query handles ancestor lookup at dashboard query time.

---

### 2. Norm Crystallization

**What's needed:** detect when N≥threshold Nous independently hold semantically similar RuleStore rules; emit a Grid-level `norm.crystallized` event.

**The norm similarity problem:** RuleStore rules are Brain-private prose. Hashes cross the wire (from `nous.self_model_revised`, position 29). Semantic similarity comparison must happen Brain-side, not Grid-side.

**Approach — LLM-free semantic fingerprinting via TF-IDF/bag-of-words on Brain-private rule text:**

The Grid accumulates `nous.self_model_revised` hashes. It cannot compare text. The Brain must emit a semantic fingerprint (a cluster label or embedding bucket) alongside the hash when a rule is added. This fingerprint crosses the wire as a short opaque token (e.g., 8-char hex of an n-gram fingerprint), not prose.

**Concrete implementation:** Use `hashlib` (stdlib) to compute a normalized n-gram fingerprint of the rule text Brain-side. No new library. The fingerprint is a 6-char hex prefix of SHA-256 over sorted word-trigrams of the lowercased rule text. When two Nous emit rules with the same fingerprint, the Grid NormCrystallizer (pure observer) detects the match and, once N≥threshold Nous share a fingerprint, emits `norm.crystallized`. This is deterministic, CPU-free at Grid level, and keeps rule prose Brain-private. Confidence: HIGH — this is the exact pattern of the existing `conviction delta` comparison in Iris (which also uses no embeddings, just float thresholds).

**Why NOT sentence-transformers / cosine embeddings for norm detection:**
- `sentence-transformers` is already in `pyproject.toml` as an optional extra (`memory` group), but it requires model download (350MB+), GPU optional, and non-deterministic floating point across platforms. The zero-diff audit chain invariant and determinism requirements (Tier A CI gate: wall-clock forbidden, random forbidden) make float embeddings risky for the production norm-detection path.
- The norm crystallization threshold comparison does not need embedding-level precision. Rules that are "semantically similar" in practice share vocabulary (both Nous independently discovered "when trading with a lonely peer, show empathy first" — they will share word-trigrams).
- IF more precision is needed in a future phase, the fingerprinting approach is backward-compatible: add a second fingerprint tier. Do not add sentence-transformers to core dependencies now.

**Grid-side new table:** `norm_registry` in MySQL (via MigrationRunner). Columns: `norm_id` (UUID), `fingerprint` (8-char hex), `participant_dids` (JSON array), `crystallized_tick`, `event_hash`. Pure derived state from audit events; no wall-clock.

**What NOT to add:** No NLP library (spaCy, NLTK, scikit-learn). No embedding model. No vector database.

---

### 3. Lore Commons

**What's needed:** Grid-side shared knowledge substrate — Nous contribute lore entries (hashes + metadata), peers query by topic, entries are citable by hash.

**Existing coverage:**
- Grid already has MySQL via mysql2. Grid-side persistent state follows the MigrationRunner pattern.
- `better-sqlite3` v12.9.0 is already in `grid/package.json` — used by Grid-side better-sqlite3 for... checking: it is in grid dependencies but the lore commons should live in MySQL to match the rest of Grid state (relationships, audit_trail are in MySQL). Keep lore in MySQL for operational consistency (backup, replay, rig isolation).

**Stack additions needed:**

Grid — new MySQL table `lore_commons` via MigrationRunner migration. Columns: `lore_id` (VARCHAR 64, SHA-256 hash of content, author, tick), `author_did`, `topic_hash` (SHA-256 of topic text), `summary_hash` (SHA-256 of prose summary — Brain-private prose never crosses), `cite_count` INT, `contributed_tick` INT, `grid_name` VARCHAR. No new library — mysql2 already installed.

Grid REST endpoint `GET /lore?topic_hash=<hash>&limit=10` and `POST /lore` (Nous-initiated via the brain↔grid JSON-RPC bridge, not a direct HTTP call). The RPC handler adds lore to MySQL; the dashboard queries via the existing REST API pattern.

Brain — `LoreContributor` module (new `brain/src/noesis_brain/agora/` package, matching the v2.4 milestone name). Constructs the lore payload (topic hash, summary hash, lore_id = SHA-256 of full body) before crossing the wire. Rule: full body stays Brain-side, only hashes cross. Same discipline as rule text and belief content. No new Python library.

**What NOT to add:** No full-text search engine (Elasticsearch, Meilisearch) for lore. Topic lookup by `topic_hash` is an exact-match query. If fuzzy topic search is wanted later, MySQL FULLTEXT on `topic_hash` is the fallback — but Phase 18 keeps it exact-match.

---

### 4. Culture Dashboard

**What's needed:** skill lineage visualization (tree), norm adoption timeline (time series), lore contribution graph (list/network). Makes emergence visible.

**Existing dashboard stack:**
- Next.js 15.2.4, React 19, Tailwind 4, SWR 2.4 — all current.
- `swr` is already used for data fetching with WebSocket augmentation.
- Relationship graph (Phase 9) renders raw SVG with `<line>` + `<circle>` elements and server-computed `{x, y}` positions. No graph library, no D3, no force simulation. This is the established pattern (D-9-08 decision: "no graph libraries").

**Skill lineage tree visualization:**
Use raw SVG with a server-computed layout (Reingold-Tilford or simple level-sorted positions from the Grid API). The Grid endpoint `/culture/lineage` returns `{nodes: [{id, x, y, skill_hash, source_did}], edges: [{from, to}]}` with positions precomputed. The dashboard renders `<rect>`, `<line>`, `<text>` — same approach as the relationship graph. No D3. No visx. No recharts.

**Norm adoption timeline:**
A time series of norm crystallization tick events per norm. Render as a `<polyline>` or CSS grid of tick bars — pure HTML/SVG. No chart library. The data volume is small (≤100 norms in any realistic run). A `<table>` with tick-bucketed counts is adequate for the v2.4 MVP. This can be upgraded to a real chart library in a future phase once the data volume warrants it.

**Lore contribution graph:**
A ranked list of lore entries with cite counts, grouped by topic hash (abbreviated). Render as a `<ul>` with Tailwind styling. If network visualization of "which Nous cite which lore" is wanted, reuse the relationship-graph SVG approach with server-computed positions. No new library.

**Dashboard additions (NEW API routes only):**
- `GET /api/grid/culture/lineage` — skill lineage tree data
- `GET /api/grid/culture/norms` — norm crystallization timeline
- `GET /api/grid/culture/lore` — lore commons listing

These follow the existing pattern in `dashboard/src/lib/api/` (e.g. `relationships.ts`). No new framework.

**What NOT to add:**
- No D3.js — adds 500KB+ bundle weight; existing SVG pattern is sufficient at this scale.
- No recharts/nivo/victory — heavyweight React chart libs; not worth the bundle cost for static emergence dashboards.
- No react-flow / dagre / cytoscape — same rationale as D-9-08 for the relationship graph.
- No animation library (framer-motion) — culture panels are operator observability tools, not UX demos.

---

## New Dependencies Summary

### Brain (`brain/pyproject.toml`) — ZERO new dependencies

No new packages. All needed capabilities exist:
- `sqlite3` (stdlib) for schema migration of skills table
- `hashlib` (stdlib) for n-gram fingerprinting and lore hashing
- `httpx` (already installed) for any Grid API calls needed by lore contributor

### Grid (`grid/package.json`) — ZERO new dependencies

- `mysql2` ^3.9.0 — already installed, handles lore_commons + norm_registry + skill_lineage tables
- `better-sqlite3` ^12.9.0 — already installed (available if any Grid-local caching is needed, but primary is MySQL)

### Dashboard (`dashboard/package.json`) — ZERO new dependencies

- `swr` ^2.4.1 — already installed, handles culture panel data fetching
- `next`, `react`, `tailwindcss` — unchanged

---

## What NOT to Add (Explicit List)

| Library | Reason Not Needed |
|---------|------------------|
| `sentence-transformers` | Non-deterministic floats violate zero-diff CI; n-gram fingerprint is sufficient for norm detection |
| `chromadb` / pgvector / any vector DB | No vector similarity needed; topic lookup is exact-match by hash |
| `scikit-learn` | No ML needed; norm crystallization is a counting problem + fingerprint match |
| `spaCy` / `nltk` | Overkill for trigram fingerprinting; stdlib `hashlib` + string ops suffice |
| `networkx` | Skill lineage trees are shallow; SQL self-joins handle ancestry queries |
| `d3` | Established project decision (D-9-08): no graph layout libs in dashboard; raw SVG with server layout |
| `recharts` / `nivo` / `victory` | Data volumes (≤100 norms, ≤200 skill nodes) do not justify chart lib bundle weight |
| `react-flow` / `cytoscape` | Same rationale as D-9-08; server-computed positions + raw SVG is the pattern |
| `redis` / `memcached` | No caching layer needed; Grid state is already MySQL; in-memory Maps in Grid process suffice for norm accumulator |
| Any new Python async library | asyncio is already the Brain's concurrency model; no trio/anyio/curio |
| `graphql` | REST + WebSocket is the established Grid API pattern; no schema change warranted |

---

## Integration Points (Where New Code Hooks Into Existing Code)

| New Component | Hooks Into | How |
|---------------|-----------|-----|
| `skill_lineage` MySQL table | `MigrationRunner` | New migration version N+1 in `grid/src/db/schema.ts` |
| `SkillLineageListener` | `AuditChain` (pure observer) | Same pattern as `RelationshipListener` (Phase 9) |
| `norm_registry` MySQL table | `MigrationRunner` | New migration in schema.ts |
| `NormCrystallizer` | `AuditChain` (pure observer) | Observes `nous.self_model_revised` events |
| `lore_commons` MySQL table | `MigrationRunner` + brain RPC handler | Brain calls `lore.contribute` RPC method; Grid handler writes to MySQL |
| `LoreContributor` (Brain) | `brain/src/noesis_brain/agora/` new package | Called from BrainHandler after RuleStore consolidation or explicit Nous action |
| Culture dashboard pages | `dashboard/src/app/grid/culture/` new route | Follows `dashboard/src/app/grid/relationships/` pattern |
| Culture API routes | `dashboard/src/lib/api/culture.ts` | SWR hooks, same pattern as `use-relationships.ts` |
| `skill.taught` allowlist event | `broadcast-allowlist.ts` | One slot per phase; follows ALLOWLIST_MEMBERS append-only discipline |
| `norm.crystallized` allowlist event | `broadcast-allowlist.ts` | One slot when NormCrystallizer first emits |
| `lore.contributed` allowlist event | `broadcast-allowlist.ts` | One slot when LoreContributor first emits |

---

## New Allowlist Events Expected in v2.4

Following the per-phase-per-slot discipline (currently at 36):

| Event | Payload Shape | Privacy Class |
|-------|--------------|--------------|
| `skill.taught` | `{from_did, to_did, tick, skill_hash}` 4-key closed tuple | Hash-only (skill body Brain-private) |
| `skill.observed` | `{observer_did, tick, skill_hash}` 3-key closed tuple | Hash-only |
| `norm.crystallized` | `{tick, norm_id, fingerprint, participant_count}` 4-key closed tuple | Fingerprint is opaque token, not rule text |
| `lore.contributed` | `{author_did, tick, lore_id, topic_hash}` 4-key closed tuple | Hash-only (lore body Brain-private) |
| `lore.cited` | `{citer_did, tick, lore_id}` 3-key closed tuple | Hash-only |

Each event gets its allowlist slot in the phase that first emits it, not pre-registered. Total expected addition: +5 events (36 → 41), but allocation is per-phase.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| No new Brain deps needed | HIGH | All required primitives (hashlib, sqlite3, asyncio) are stdlib or already installed |
| No new Grid deps needed | HIGH | mysql2 already installed; confirmed in grid/package.json |
| No new Dashboard deps needed | HIGH | D-9-08 pattern (raw SVG) is established and tested |
| N-gram fingerprint sufficient for norm detection | MEDIUM | Effective for vocabulary-overlapping rules; may miss paraphrase matches (acceptable for MVP) |
| MySQL for lore commons (not better-sqlite3) | HIGH | Grid state consistency; rig isolation via MigrationRunner already works for MySQL |
| Allowlist event count estimate | MEDIUM | Depends on phase granularity decisions; 5 events is a lower bound |
