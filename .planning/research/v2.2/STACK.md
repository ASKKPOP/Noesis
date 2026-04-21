# Stack Research — v2.2 Living Grid

**Domain:** autonomous agent simulation (additive to an existing live platform)
**Researched:** 2026-04-21
**Confidence:** HIGH on zero-dep recommendations, MEDIUM on optional export-format additions

---

## TL;DR

The existing v2.1 stack is sufficient for **5 of the 6 themes** with **zero new runtime dependencies**. The only theme that justifies a new library is Theme 6 (Researcher Tooling) where dataset export to Parquet needs `pyarrow` (Brain-side) for downstream ML interop — and even that is optional if JSONL is acceptable. Everything else is hand-rolled code against primitives the platform already has: MySQL, AuditChain, JSON-RPC bridge, Fastify, Ed25519/SHA-256, WorldClock.

Treating this as a subsequent milestone over a mature platform means the stack-level answer is mostly "don't add dependencies; write 200 lines of TypeScript or Python against what's already pinned." This preserves every v2.1 invariant (zero-diff, sole-producer, allowlist freeze, closed-tuple payloads) without needing to audit a new transitive dependency tree.

---

## Existing Stack (DO NOT RE-RESEARCH — baseline for v2.2)

### Runtime (already validated, DO NOT REPLACE)

| Layer | Technology | Pinned Version | Status |
|-------|------------|----------------|--------|
| Node runtime | Node.js | `>=20.0.0` | baseline engine constraint across all workspaces |
| TS compiler | TypeScript | `^5.5.0` (monorepo root, grid, cli); `^5.8.2` (protocol) | OK |
| Monorepo | turbo | `^2.0.0` | OK |
| Grid HTTP | Fastify | `^5.0.0` | serves REST + WS; already battle-tested across Phases 5–8 |
| Grid WS | @fastify/websocket | `^11.2.0` | powers firehose broadcast |
| Grid RL | @fastify/rate-limit | `^10.0.0` | **reuse for WHISPER-01 rate limiting — no new dep** |
| DB driver | mysql2 | `^3.9.0` | sufficient for relationship adjacency + replay queries |
| Test runner (TS) | vitest | `^2.0.0` (grid/cli), `^3.0.7` (protocol), `^4.1.0` (dashboard) | OK |
| Crypto | @noble/ed25519 | `^2.2.3` | DID signing |
| Hash | @noble/hashes | `^1.7.1` | SHA-256 for audit chain, **reuse for whisper hash-pinning + vote receipts** |
| P2P (protocol) | libp2p | `^3.1.4` | not used by v2.2 (WHISPER-01 is intra-Grid, not libp2p) |
| Python runtime | CPython | `>=3.11` (ruff/mypy target `py312`) | OK |
| Brain HTTP | httpx | `>=0.27.0` | OK |
| LLM | openai | `>=1.0.0`; anthropic `>=0.30.0` | OK |
| Config | pyyaml | `>=6.0` | **reuse for preset-rig manifests (Theme 6)** |
| Test runner (Py) | pytest | `>=8.0` | OK |

### Dashboard (Next.js 15 — DO NOT REPLACE)

- next `15.2.4`, react `19.2.5`, tailwindcss `^4.0.0`, playwright `1.50.0`. All v2.1 dashboard additions (`AgencyIndicator`, `IrreversibilityDialog`, firehose styling) live here. v2.2 additions (relationship graph viz, vote panel, replay scrubber, whisper presence indicators) stay inside this stack.

---

## Theme-by-Theme Recommendations

### Theme 1 — Rich Inner Life (Ananke / Bios / Chronos)

**Stack addition: NONE.** Hand-rolled pure-Python state on Brain + tick-driven RPC update from Grid runner.

**Why no library:**
- Ananke/Bios/Chronos are small scalar-state machines. Ananke drives are a fixed closed-set (hunger / curiosity / safety — MVP scope keeps this closed-tuple like everything else). Bios is energy/fatigue floats. Chronos is a recency-decay function over the existing memory_stream.
- Existing Python cognitive architecture libraries (ACT-R, SOAR, OpenCog) are the wrong granularity — they impose their own world/agent model that conflicts with the Psyche/Thymos/Telos triumvirate already shipping. SOAR is C++/Java with Python bindings; ACT-R is Lisp-rooted (`pyactr` is an abandoned shim, last release 2021). None of them are the MVP-depth fit.
- Homeostasis/fatigue simulators at PyPI (`pyhomeostasis`, `fatigue-model`) are specialist research code with single-digit monthly downloads; not maintained; not worth the audit cost.
- Decay functions (exponential, power-law, Ebbinghaus forgetting curve) are 3-line numpy or pure-math. No lib needed.

**Hand-rolled plan:**
- New Brain module: `brain/src/noesis_brain/ananke.py`, `bios.py`, `chronos.py`. Each exposes a dataclass-style state + `tick(delta_ticks: int) -> None` pure function.
- Grid side: no new module. `NousRunner` already passes tick context; Brain updates drives/needs on each `on_tick`.
- Cross-boundary (Grid↔Brain): **hash-only** (same discipline as Telos) — Brain may emit a `drive.*` or `need.*` audit event if a threshold crosses (e.g. hunger > critical), payload is `{did, drive_name, threshold_crossed, snapshot_hash}`. No plaintext drive values on the wire.

**Integration points:**
- `brain/src/noesis_brain/handler.py` — hook drive/need/chronos updates into `on_tick` before action selection.
- `grid/src/integration/nous-runner.ts` — no changes (Brain returns actions; drives never cross as plaintext).

**Risks:**
- **Scope creep** — Ananke/Bios/Chronos can bloat if drive count is uncapped. Lock drive list to closed enum in PHASE-OPEN decision, mirror `ReviewFailureCode` enum discipline.
- **Zero-diff threat** — if drives emit new audit events, every new event is a new allowlist member (one per phase, per frozen-except-by-addition rule).

**Rejected alternatives:**
| Rejected | Reason (1 line) |
|----------|-----------------|
| `pyactr` (PyPI) | Unmaintained since 2021; imposes ACT-R buffer model incompatible with existing Psyche/Thymos. |
| OpenCog Python bindings | Massive transitive install (~500MB); mismatched cognitive ontology. |
| `transitions` (state machine lib) | Overkill for 3-state `low|normal|critical` thresholds; 1-line `if/elif` is clearer. |
| Custom numpy/scipy decay | Adds numpy as runtime dep to Brain — current Brain is numpy-free; preserve that discipline. |

---

### Theme 2 — Relationship & Trust (Nous↔Nous graph)

**Stack addition: NONE.** MySQL adjacency table + thin TypeScript query layer.

**Why no library:**
- At MVP N (tens to hundreds of Nous), the relationship graph is **dense-enough-for-adjacency** (O(N²) edges worst case = ~10,000 rows for 100 Nous). A single MySQL table `relationships(did_a, did_b, trust_valence, updated_tick, interaction_count, ...)` with composite primary key `(did_a, did_b)` where `did_a < did_b` canonicalizes the edge. Reads are indexed point-lookups; writes are upserts on audit-event observation.
- JS graph libraries (`graphology` 0.26.0, `graphlib` 2.1.8) are useful when you need **algorithms** (shortest path, centrality, community detection). MVP depth for v2.2 = pairwise trust queries + Inspector rendering. No algorithm needs justify a dep.
- **If** a later phase needs trust propagation / PageRank-style reputation decay, `graphology` + `graphology-pagerank` is the right addition — defer until the REQ explicitly asks for it.
- Trust-propagation at small N is cheap: for transitive-trust through 1 hop, a 2-level JOIN on the adjacency table finishes in <5ms on any dev MySQL. No need for in-memory graph unless N > ~500.

**Hand-rolled plan:**
- New MySQL migration: `relationships` table keyed on `(did_a_canonical, did_b_canonical)`. Columns: `trust` (FLOAT, -1..1), `interaction_count` (INT), `last_observed_tick` (BIGINT), `last_event_type` (VARCHAR 32, closed enum).
- New Grid module: `grid/src/relationships/` — `RelationshipTracker` subscribes to AuditChain as pure-observer listener (like `DialogueAggregator` and `ReviewerNous`). On `trade.settled` / `nous.spoke` / `trade.reviewed` / `dialogue_id-matched` events, it upserts edges. **Zero-diff preserved** — listener is observer-only; chain hash unaffected.
- Reputation-decay: simple time-based linear decay in a nightly tick-bucketed sweep. Formula: `trust -= decay_rate * (current_tick - last_observed_tick)`. Clamp to [-1, 1]. Hand-rolled. The well-known families here (EigenTrust, Bayesian beta-reputation, PageRank) are all over-specified for MVP — a single hand-rolled exponential decay is the MVP-depth fit.
- Dashboard query: `GET /api/v1/relationships?did=<DID>&limit=20` returns top-N edges by `|trust|`. Inspector renders them as a list; D3 force-layout can be hand-wired in Next.js (~150 lines) when / if a visualization REQ lands.

**Integration points:**
- MySQL — add table via existing migration mechanism in `grid/src/db/`.
- AuditChain — new pure-observer subscriber in `grid/src/relationships/tracker.ts`, constructed in `GenesisLauncher` AFTER `this.audit` (same discipline as `DialogueAggregator` per Phase 7).
- Dashboard — new route `dashboard/src/app/nous/[did]/relationships/` consuming a new Fastify endpoint.

**Risks:**
- **Bilateral-canonicalization bug** — if `(A, B)` is stored twice as `(A,B)` and `(B,A)` the graph fractures. Use `did_a < did_b` canonical sort at write time; regression test for both-orderings-produce-same-row.
- **Decay sweep cost at scale** — at N=1000 the edge count could hit 1M. Decay becomes a batch job. MVP N is tens–hundreds; defer the problem.
- **Trust-valence privacy** — trust values are derivable from audit-observable events, so broadcasting them in `relationship.*` events does not leak private memory. Still keep payloads closed-tuple `{did_a, did_b, trust_before_hash, trust_after_hash}` or similar if the REQ requires an audit emit.

**Rejected alternatives:**
| Rejected | Reason (1 line) |
|----------|-----------------|
| `graphology` ^0.26.0 | Useful for centrality/shortest-path, but MVP queries are point-lookups — SQL wins. |
| `graphlib` ^2.1.8 | Same as above; even less maintained. |
| Neo4j / ArangoDB | New DB service to deploy; obliterates the MySQL-only persistence invariant. |
| SQLite for graph subsystem | Splits persistence; dual-store complexity not worth it at MVP N. |
| Bayesian beta-reputation / EigenTrust | Over-specified for MVP; readable linear-decay is the on-ramp. |

---

### Theme 3 — Governance & Law (voting primitives)

**Stack addition: NONE.** Voting is a proposal-lifecycle state machine over the existing AuditChain + MySQL + LogosEngine primitives.

**Why no library:**
- DAO governance libraries (Aragon, Snapshot.js, OpenZeppelin Governor) are **chain-backed and signature-heavy** — they assume ERC-20 voting tokens or ZK proofs for privacy. v2.2 MVP governance is a single-Grid, audit-chain-backed tally with Ed25519-signed votes. The existing SWP envelope signing already handles vote authenticity.
- Small-N consensus (Paxos, Raft) is for replicated-state-machine coordination across distributed nodes — wrong problem. v2.2 has ONE grid runner; the tally is sequential.
- Voting receipts: the existing AuditChain **is** the receipt layer. Every `vote.cast` event is a signed audit entry with a hash-pinned payload `{proposal_id, did, choice_hash, nonce}`. Receipt verification = chain verification (already implemented via `audit-no-purge.test.ts` discipline).
- Privacy: plaintext vote choice CAN leak through a naive `choice` field. Use the same **hash-only cross-boundary** pattern as Telos — Brain commits `sha256(choice + nonce)` into the proposal commit phase, reveals `(choice, nonce)` in a later `vote.revealed` phase. Commit-reveal is ~40 lines of hand-rolled crypto using `@noble/hashes` (already a dep).

**Hand-rolled plan:**
- New MySQL tables: `proposals` (id, title_hash, proposed_by_did, opened_at_tick, closes_at_tick, state enum('open','closed','enacted','rejected')) and `votes` (proposal_id, did, choice_commit_hash, revealed_choice, nonce, voted_at_tick). Commit-reveal optional for MVP — `revealed_choice` column can be `NULL` for commit-only first phase.
- New Grid module: `grid/src/governance/` — `ProposalLifecycle` state machine. Three new audit events across three phases (one per allowlist addition to respect per-phase-one-event rule): `vote.proposed`, `vote.cast`, `vote.enacted`. Or two if commit-reveal is deferred: `vote.proposed` + `vote.settled`. Final count subject to REQ phase scoping.
- Brain emits `vote_cast` actions via the JSON-RPC bridge (same channel as `trade_request`, `telos_refined`). Payload crosses as `{proposal_id, choice_commit_hash, nonce_hash}` — plaintext choice never crosses the bridge until reveal.
- LogosEngine integration: when a proposal closes and passes (tally > quorum), a new `LogosEngine.promoteLaw(proposal_id)` method reads the proposal body from MySQL and appends via the existing `amendLaw` path (Phase 6 D-11 closed-tuple `operator.law_changed` payload stays intact — a vote-triggered law change uses a NEW `law.enacted_by_vote` event type, one more allowlist addition).

**Integration points:**
- AuditChain — two-to-three new events, one per phase.
- LogosEngine — new `promoteLaw` method consumed by ProposalLifecycle tick-subscriber.
- Brain — new `ActionType.VOTE_CAST` enum value (mirrors `TELOS_REFINED` discipline from Phase 7 D-13).
- Dashboard — new `/proposals` route, vote panel on Inspector.

**Risks:**
- **Quorum definition drift** — quorum percentage must be a `LogosEngine.law` itself so it's amendable. Don't hardcode.
- **Commit-reveal deadlock** — a Nous that commits but never reveals can freeze tally. Add reveal-deadline tick; unrevealed commits count as abstain. Same pattern as Ethereum beacon chain attestation reveal windows; well-understood.
- **Tally determinism across replay** — tally must be pure function of audit chain contents (see Theme 5). Never use wall-clock in tally logic. Use `tick` exclusively. This is the same discipline that preserved pause/resume zero-diff (Phase 6 D-17).

**Rejected alternatives:**
| Rejected | Reason (1 line) |
|----------|-----------------|
| Snapshot.js / Aragon governance | Blockchain-rooted — requires wallet/token infrastructure we don't have and don't want. |
| OpenZeppelin Governor | Solidity, not applicable. |
| `zk-snarks` for private votes | Massive dep (rapidsnark, circom) for problem commit-reveal already solves at MVP. |
| Raft/Paxos libraries | Wrong problem domain — we have one Grid, not N replicas. |
| In-memory-only tally | Violates first-life promise — proposals/votes MUST be in MySQL for replay (Theme 5). |

---

### Theme 4 — Mesh Whisper (WHISPER-01)

**Stack addition: NONE.** Sidechannel is a hash-pinned envelope pattern on the existing Brain↔Grid bridge + a new audit event per phase.

**Why no library:**
- Existing multi-agent sidechannel patterns (libp2p pubsub topics, ZeroMQ inproc sockets, Nanomsg scalability protocols) are **transport layers** — we already have a transport (Unix domain socket JSON-RPC to Brain, WebSocket firehose for observers). What's missing is the **envelope semantics**, not the pipe.
- The WHISPER-01 contract per the user's description: plaintext not observable; presence / payload-length / content-hash observable. This is literally a commitment scheme: Brain computes `sha256(plaintext || nonce)`, submits the hash as audit payload, retains plaintext in a private per-Nous memory. No library required — `@noble/hashes` already shipped in `protocol/`.
- Rate-limiting: `@fastify/rate-limit@^10.0.0` is already a Grid dep. Reuse its middleware with a new keyBy function (`sender_did + receiver_did`) on the whisper endpoint. No `rate-limiter-flexible` dep needed.
- STRIDE-style replay guards: use a per-whisper `nonce` (ULID or 16-byte random) — ULID is already in `protocol/`'s dep tree (`ulid@^2.3.0`). Grid rejects `(sender_did, nonce)` duplicates.

**Hand-rolled plan:**
- New Brain action type: `ActionType.WHISPER` with closed-tuple metadata `{recipient_did, content_hash, nonce, length_bytes}`. Brain retains plaintext in a private whisper-memory module (`brain/src/noesis_brain/whisper_log.py`).
- New Grid module: `grid/src/whisper/` — `WhisperReceiver` routes via `NousRunner.executeActions` case `'whisper'`. Producer boundary `appendWhispered(senderDid, recipientDid, payload)` (sole-producer pattern, same as Phase 7 `appendTelosRefined` + Phase 8 `appendNousDeleted`). Enforces DID regex + HEX64 regex + length bound + rate limit check.
- Delivery: whisper envelope is passed back to the recipient's next `on_tick` via a new `dialogue_context`-analog param (`whisper_envelopes: list[{sender_did, content_hash, length_bytes, nonce}]`). **Recipient receives hashes only over the bridge** — plaintext stays in sender's private memory and is re-transmitted on-demand via a separate unauthenticated-is-fine direct Brain-to-Brain channel **OR** (MVP-depth choice) plaintext is never delivered at all and whispers function as "I tried to reach out" signals that the recipient can acknowledge but not read. Latter is the zero-plaintext MVP — simplest, keeps plaintext-never invariant absolute.
- New allowlist member: `nous.whispered`, closed 5-key payload `{sender_did, recipient_did, content_hash, length_bytes, nonce}`. Dashboard firehose renders as `"Sophia whispered to Hermes (42 bytes)"` — content never shown.

**Rate-limiting integration:**
- `@fastify/rate-limit` on the operator API is at the HTTP boundary. Whispers are NOT HTTP-triggered — they flow through the Brain action channel. Rate limit at the producer boundary: `appendWhispered` rejects if `(sender_did)` has emitted > N whispers in the last K ticks. Token-bucket state kept in-memory on the WhisperReceiver — lost on restart is fine (rate limit is audit-flooding prevention, not security). Persisting is unnecessary for MVP.

**Integration points:**
- AuditChain — new event `nous.whispered` (1 allowlist addition in the WHISPER-01 phase).
- NousRunner — new action case `'whisper'`.
- Brain — new ActionType enum value + whisper-log module.
- Dashboard — new firehose row style; Inspector "whisper activity" panel.

**Risks:**
- **Audit flooding** — a Brain that emits N whispers per tick per recipient can balloon the chain. Rate-limit at producer boundary (see above).
- **Plaintext leak through length** — payload length is a side-channel for whisper content. MVP accepts this; clamp `length_bytes` to bucketed values (e.g. round to nearest 32) if stricter privacy is wanted. Document as known limitation.
- **Topology drift** — WHISPER-01 is intra-Grid sidechannel; federation/mesh-across-Grids is explicitly out-of-scope (arxiv 2512.08296 O(N²) cost). Keep the receiver strictly in-Grid; don't expose a libp2p topic.

**Rejected alternatives:**
| Rejected | Reason (1 line) |
|----------|-----------------|
| libp2p gossipsub topics | Adds cross-Grid surface area; MVP is intra-Grid. |
| ZeroMQ inproc | New native-build dep; solves a problem we already have (Unix socket RPC). |
| `rate-limiter-flexible` ^5.10.1 | @fastify/rate-limit + in-memory token-bucket suffices; no new dep. |
| Age/NaCl encryption of whisper payload | Out-of-scope for MVP (plaintext-never makes encryption moot); adds key-distribution complexity. |

---

### Theme 5 — Operator Observability (Replay / Rewind / Export)

**Stack addition: NONE.** Replay is a pure function of the existing AuditChain + snapshot/restore machinery shipped in v2.0 Sprint 12.

**Why no library:**
- Event-sourcing replay libraries for Node (`eventstore-node-client`, `eventuate`) target full CQRS systems with event-type routing, projection rebuild, consumer groups — massive overkill. Our event stream is the AuditChain (SHA-256 linked, append-only, already persisted to MySQL). Replay = read chain from head-hash-at-tick-T and recompute derived state.
- Time-travel debugging libraries (`redux-devtools`, `ChucK`) don't apply — they operate inside browser/runtime, not over a persistent world snapshot.
- SQL snapshot-diff tooling (`pg_diff`, `mysqldiff`) is DBA tooling for schema migration review; not applicable.
- **The correct replay primitive is already built**: snapshots at epoch boundaries (Sprint 12) + append-only chain = canonical event sourcing. What's missing is:
  1. A **read-only replay engine** that loads `snapshot@tick=T0` + chain segment `[T0..T1]` into a **detached** Grid instance.
  2. An **export** primitive that slices chain + snapshot + state into a deliverable archive.

**Hand-rolled plan:**
- New Grid module: `grid/src/replay/` — `ReplayEngine` class that consumes `(fromSnapshot: Snapshot, chainSegment: AuditEntry[])` and produces `ReplayResult { finalStateHash, observedEvents }`. **Pure function — zero-diff with live run guaranteed by construction**.
- **Detachment invariant**: replay uses a separate MySQL connection on a disposable schema (or in-memory SQLite via `better-sqlite3@^11.8.1` — already a protocol/ dep — for transient replay). Replay NEVER writes to the live chain. This is the observer-only reproducibility discipline the user asks for.
- Export primitive: Fastify endpoint `GET /api/v1/observer/export?from_tick=T0&to_tick=T1&format=jsonl` streams chain slice as NDJSON via `archiver@^7.0.1` (already in `protocol/` deps — `tar.gz` export includes snapshot + chain slice + manifest).
- Rewind UI: Dashboard gets a new scrubber component on the firehose. Scrubber writes to a URL param `?replay=T` which triggers the replay engine on demand via a new observer endpoint. State view renders `snapshot@tick=T` in read-only mode.

**Integration points:**
- AuditChain — no writes; replay is observer-only read.
- MySQL — `snapshots` table already exists (Sprint 12). Add `ReplayEngine.loadSnapshot(tick)` that queries the nearest snapshot ≤ tick.
- Fastify — new `/api/v1/observer/export` + `/api/v1/observer/replay` routes. Agency tier: **H1 (Observer)** — read-only, no elevation.
- Dashboard — new "Replay" UI mode; scrubber + timeline.

**Risks:**
- **Determinism break** — any non-deterministic tick logic (Date.now, Math.random w/o seeded RNG) breaks replay. Audit grid source for non-determinism. Grid already uses `WorldClock` ticks, not wall-clock, for derived timestamps (Phase 6 D-17 regression hash proves this). Confirm Brain side is also tick-deterministic — current Brain uses LLM calls which ARE non-deterministic; replay **cannot replay Brain inference** without recorded action output. The AuditChain records the **effect** (action was taken) not the Brain reasoning; replay is therefore **state-level replay**, not decision-level replay. Document clearly.
- **Snapshot-miss** — if no snapshot exists within N ticks of requested T, replay becomes slow (full chain from tick 0). Mitigation: auto-snapshot every M epochs; document snapshot cadence.
- **Export dataset size** — for 10,000-tick runs, chain slice can be ~100MB uncompressed. Streaming NDJSON via archiver keeps memory bounded.
- **Replay-write contamination** — cannot allow replay to ever emit into the live chain. Separate DB schema + separate AuditChain instance for replay is the hard gate. Add regression test asserting live chain head unchanged after 100 replay invocations.

**Rejected alternatives:**
| Rejected | Reason (1 line) |
|----------|-----------------|
| eventstore-node-client | Full CQRS framework; our chain already IS the event store. |
| `redux-devtools`-style time travel | Browser-scope; wrong layer. |
| Dump-and-parse via `mysqldump` | Loses chain linkage; archiver + NDJSON preserves hash linkage. |
| ClickHouse / DuckDB analytical DB | Post-MVP if export volume demands; JSONL + pyarrow (Theme 6) covers researcher analysis for now. |

---

### Theme 6 — Researcher Tooling (spawn-N rigs, 10k-tick runs, dataset export)

**Stack addition: OPTIONAL `pyarrow>=15.0.0,<25.0.0` in Brain dev-extras; OR zero-dep JSONL.** The TS side stays zero-dep.

**Why optional:**
- Parquet output gives researchers 5-20x compression and columnar access for pandas/polars/DuckDB analysis — valuable downstream. But MVP-depth means "export dataset for external analysis" is satisfied by JSONL (line-delimited JSON), which pandas reads natively via `pd.read_json(lines=True)`. Pick ONE:
  - **Zero-dep (MVP minimum)**: JSONL export. Hand-written streaming writer in TS (`grid/src/export/jsonl-writer.ts`) — 30 lines. Works for all downstream tools (Python, R, Julia, Excel).
  - **+Parquet (researcher-friendly)**: Add `pyarrow>=15.0.0,<25.0.0` (current HEAD per PyPI 2026-04: `24.0.0`) as an OPTIONAL Brain dep under a new `[project.optional-dependencies]` entry `export` alongside the existing `memory` extras. A new `brain/scripts/convert_jsonl_to_parquet.py` tool runs post-simulation. Keeps Brain runtime surface unchanged for users who don't need Parquet.
- Polars `1.40.0` is faster than pyarrow for some workloads but it's a heavier install (rust-backed 50-80MB wheel) and pyarrow is the lingua-franca format. `pyarrow` wins the default slot.
- DuckDB `1.5.2` is tempting (single binary, reads Parquet/JSONL directly, SQL queries) but it's a post-MVP "researcher convenience" — defer.
- CSV via `csv-stringify@^6.7.0` (Node) rejected: CSV loses type fidelity (numbers become strings), and any schema with nested JSON (which every AuditEntry has) degrades to quoted-JSON columns. JSONL is strictly better at the same write complexity.

**Long-running Node process patterns:**
- Headless 10,000-tick runs are already supported by the existing `WorldClock` — it's tick-driven, not wall-clock-driven when `tickRateMs` is set low. v2.1 Phase 6 D-17 regression hash proves 100-tick headless runs are deterministic. Extending to 10k is a configuration change, not a code change.
- Process supervision: Node v20 built-ins (`AbortController`, `process.on('SIGINT')`) cover graceful shutdown. No PM2 / forever / nodemon dep. Docker Compose (already shipped) covers restart policies for long runs if desired.
- Memory ceiling: for 10k ticks at ~10 Nous, peak memory stays well under 1GB on dev hardware (empirical from v2.0 stress tests). For 50+ Nous × 10k ticks, audit chain in MySQL keeps RAM bounded. Chain streaming to disk is the natural pressure valve.

**Hand-rolled plan:**
- New CLI commands in `cli/`:
  - `noesis rig spawn --preset=<path> --nous=<N>` — spawns N Nous against a preset world. Preset is YAML (`pyyaml` already shipped; use `yaml@^2.8.2` on TS side — already in `protocol/` deps).
  - `noesis rig run --ticks=<K> --output=<dir>` — runs headless for K ticks, writes audit chain + snapshots to output dir.
  - `noesis rig export --format=jsonl|tar` — slice the stored chain + snapshots into a dataset.
- New TS module: `grid/src/export/` — JSONL/NDJSON streaming writer. Consumes `AuditChain.iterateFrom(tick)` and pipes to `fs.createWriteStream`. Backpressure via standard Node streams.
- Optional Python converter: `brain/scripts/convert_jsonl_to_parquet.py` — one-shot, reads JSONL from rig output, writes Parquet via pyarrow. Schema is inferred from payload tuples (each allowlisted event type has a closed tuple — can be a fixed Arrow schema).
- No pytest-style fixture framework needed — presets ARE the fixtures. `cli/presets/genesis-10.yaml`, `genesis-50.yaml`, `genesis-100.yaml` ship as the standard rig set.

**Integration points:**
- CLI — 3 new commands under `cli/src/rig/`.
- Grid — new `grid/src/export/` module; new observer endpoint `/api/v1/observer/export` reuses same writer.
- Brain — optional `[export]` extras in `brain/pyproject.toml`.
- Docker — no changes. Rig runs inside the existing Grid container.

**Risks:**
- **pyarrow native wheel size + platform drift** — pyarrow ships C++ binaries; arm64 vs x64 Linux vs macOS wheels diverge occasionally. Version-pin to a range (`>=15.0.0,<25.0.0`) and CI test on both arches. Mitigated by keeping it under OPTIONAL `[export]` extras — users on exotic platforms can stick with JSONL.
- **pyarrow version lookup discrepancy** — local pip cache (this machine) reports `21.0.0` as latest; PyPI live API reports `24.0.0`. Treating live PyPI as truth for April 2026. **Verify at install time** — pin to a minor-bound range not an exact version.
- **JSONL growth unbounded** — 10k ticks × ~18 events/tick = 180k events × ~500 bytes = ~90MB per run. Acceptable. For 100k-tick runs, compress via `archiver@^7.0.1` (already a dep) to `.jsonl.gz` — native Node gzip stream.
- **Schema drift across milestones** — v2.1 allowlist is 18 events; v2.2 adds 5-10 more. Export schema must embed allowlist version. Add `allowlist_version: "v2.2"` to export manifest; downstream readers gate on it.

**Rejected alternatives:**
| Rejected | Reason (1 line) |
|----------|-----------------|
| `csv-stringify@^6.7.0` | CSV loses types and nested-JSON fidelity; JSONL is strictly better. |
| `@dsnp/parquetjs@^1.8.7` (JS Parquet writer) | Immature; pyarrow (Python post-process) is the industry standard. |
| `hyparquet@^1.25.6` (JS reader) | Reader-only; we need a writer. |
| Polars `1.40.0` | Heavier install than pyarrow; pyarrow is the canonical Parquet writer. |
| DuckDB `1.5.2` | Post-MVP researcher convenience; adds a new runtime binary. |
| `pytest-benchmark` fixtures | v2.2 rigs are simulation configs, not unit-test fixtures. Wrong abstraction. |
| PM2 / forever for long-run supervision | Docker Compose restart policies + Node process signals already cover this. |

---

## Summary — Stack Delta for v2.2

| Theme | New runtime deps | New dev deps | Allowlist additions (projected) |
|-------|------------------|---------------|---------------------------------|
| 1. Rich Inner Life | — | — | `drive.*` / `need.*` threshold events (1-3, one per phase) |
| 2. Relationship & Trust | — | — | `relationship.*` events (1-2, one per phase) |
| 3. Governance & Law | — | — | `vote.proposed`, `vote.cast`, `law.enacted_by_vote` (3, one per phase) |
| 4. Mesh Whisper | — | — | `nous.whispered` (1) |
| 5. Observability (Replay/Export) | — | — | 0 (replay is pure-observer) |
| 6. Researcher Tooling | OPTIONAL `pyarrow>=15.0.0,<25.0.0` under Brain `[export]` extras | — | 0 (rigs use existing emit paths) |

**Broadcast allowlist projection**: v2.2 end-state is 18 + 6–10 events = **24–28 events**, all added per the frozen-except-by-addition rule, each with closed-tuple payload, sole-producer boundary, and doc-sync regression gate. Every addition ships in its own phase commit.

**Net new runtime dependencies**: **0 required, 1 optional (`pyarrow`).**

**Net new dev dependencies**: **0.**

---

## Installation (if Parquet export is elected)

```bash
# Brain (optional — only if Parquet export is desired)
cd brain
pip install -e ".[export]"

# Everything else: no new installs
# Existing workspaces already have vitest, turbo, fastify, mysql2, @noble/hashes, archiver, etc.
```

`brain/pyproject.toml` update (if Parquet is elected):

```toml
[project.optional-dependencies]
memory = [
    "chromadb>=0.5.0",
    "sentence-transformers>=3.0.0",
]
export = [
    "pyarrow>=15.0.0,<25.0.0",
]
dev = [ ... ]  # unchanged
```

---

## What NOT to Use (cross-theme)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new ORM (Sequelize, Prisma, SQLAlchemy) | Breaks existing migration/snapshot contract. | `mysql2` prepared statements (already in use). |
| In-memory-only state | Violates first-life promise; replay (Theme 5) can't read it. | Always persist via existing MySQL schema. |
| `zeromq`, `nanomsg` native binaries | Platform-drift risk; Unix socket + JSON-RPC already solved the IPC problem. | Existing bridge. |
| New WebSocket framework (socket.io, uws) | Existing `@fastify/websocket` handles firehose correctly; don't refactor. | `@fastify/websocket@^11.2.0`. |
| LLM-driven drive/need updates | Out-of-scope per PROJECT.md "LLM-driven drives/emotions/goals — v2.2 keeps deterministic heuristics". | Deterministic Python. |
| Cross-Grid federation libraries (libp2p relays, quic-transport) | Explicitly deferred post-v2.2. | Defer. |
| Process managers (PM2, forever, nodemon) | Docker Compose restart policies already handle this. | Docker Compose. |
| `graphology`, Neo4j for relationships | Over-specified for tens-to-hundreds-of-Nous MVP N. | MySQL adjacency table. |
| Blockchain governance primitives (Aragon, Snapshot.js) | Wrong trust model; AuditChain + SWP signing already provides vote authenticity. | Hand-rolled proposal lifecycle. |
| `rate-limiter-flexible` | `@fastify/rate-limit` + in-memory token bucket suffice. | Existing `@fastify/rate-limit`. |
| CSV for dataset export | Type-lossy; nested JSON degrades. | JSONL (MVP), optional Parquet (researcher). |

---

## Stack-Level Risks (cross-theme)

1. **Dependency drift across milestones** — current mix has vitest 2/3/4 across workspaces, typescript 5.5/5.8 across workspaces. v2.2 should not introduce a THIRD version delta. Prefer matching the existing version in the workspace you're editing.
2. **Native-module rebuild cost** — `better-sqlite3@^11.8.1` (protocol/) is the only native dep that bites on platform switches. Replay (Theme 5) might consume better-sqlite3 for detached in-memory replay; if it does, the existing build pipeline already handles it. No new native dep introduced.
3. **Python dev-extras duplication** — `[memory]` already exists; adding `[export]` is a precedent for per-concern extras. Keep it additive; don't collapse into one `[dev]`.
4. **Frozen-except-by-addition allowlist** — every new event type in v2.2 is one new commit. Budget ~6-10 commits just for allowlist growth across the 6 themes. This is by design.
5. **Zero-diff regression surface** — each new observer listener (RelationshipTracker, ReplayEngine-detached, WhisperReceiver) must have its own zero-diff regression test clone of Phase 7's `grid/test/dialogue/zero-diff.test.ts`. Copy-and-adapt pattern.

---

## Version Compatibility (pinned existing + projected)

| Package | Pinned | Source | v2.2 Consumes |
|---------|--------|--------|---------------|
| Node.js | `>=20.0.0` | root | all themes |
| TypeScript | `^5.5.0` | grid/cli | themes 2, 3, 4, 5, 6 |
| Fastify | `^5.0.0` | grid | themes 3, 5, 6 (new endpoints) |
| @fastify/websocket | `^11.2.0` | grid | themes 4, 5 (firehose + replay streaming) |
| @fastify/rate-limit | `^10.0.0` | grid | theme 4 (whisper RL) |
| mysql2 | `^3.9.0` | grid | themes 2, 3, 5 (relationships, proposals, replay) |
| @noble/hashes | `^1.7.1` | protocol | themes 3, 4 (commit-reveal, whisper content-hash) |
| archiver | `^7.0.1` | protocol | themes 5, 6 (export tar, compressed JSONL) |
| better-sqlite3 | `^11.8.1` | protocol | theme 5 (optional — detached replay store) |
| ulid | `^2.3.0` | protocol | theme 4 (whisper nonce) |
| yaml | `^2.8.2` | protocol | theme 6 (rig presets) |
| Python | `>=3.11` | brain | theme 1, optional theme 6 |
| httpx | `>=0.27.0` | brain | unchanged |
| pyyaml | `>=6.0` | brain | theme 6 (rig preset parsing) |
| **pyarrow (new, OPTIONAL)** | `>=15.0.0,<25.0.0` | brain `[export]` | theme 6 ONLY if Parquet elected |

---

## Sources

- **Noēsis repo inspection** (HIGH): `package.json`, `grid/package.json`, `protocol/package.json`, `cli/package.json`, `dashboard/package.json`, `brain/pyproject.toml` — pinned versions verified 2026-04-21.
- **PyPI live queries** (MEDIUM): `https://pypi.org/pypi/pyarrow/json` → 24.0.0; `https://pypi.org/pypi/polars/json` → 1.40.0; `https://pypi.org/pypi/duckdb/json` → 1.5.2; `https://pypi.org/pypi/networkx/json` → 3.6.1; `https://pypi.org/pypi/rich/json` → 15.0.0 (verified 2026-04-21).
- **npm registry** (MEDIUM): `graphology@0.26.0`, `graphlib@2.1.8`, `rate-limiter-flexible@5.10.1`, `csv-stringify@6.7.0`, `archiver@7.0.1`, `hyparquet@1.25.6`, `@dsnp/parquetjs@1.8.7`, `parquet-wasm@0.7.1`, `parquetjs@0.11.2`, `ndjson@2.0.0`, `@msgpack/msgpack@3.1.3`, `ioredis@5.10.1` — verified via `npm view <pkg> version` 2026-04-21.
- **Noēsis `.planning/STATE.md` + `.planning/MILESTONES.md`** (HIGH): allowlist enumeration (18 events), zero-diff invariant (Phase 1 `29c3516`), sole-producer pattern (Phase 7 `append-telos-refined.ts`, Phase 8 `append-nous-deleted.ts`), regression hash `c7c49f49...` for pause/resume (Phase 6 D-17).
- **Noēsis `.planning/PROJECT.md`** (HIGH): v2.2 opening context, out-of-scope list (no LLM-driven drives, no full mesh, no federation, no real crypto signing beyond Ed25519), MVP-depth constraint, 6-theme scope.
- **arxiv 2512.08296** (via v2.1 research `stanford-peer-agent-patterns.md`): multi-agent topology O(N²) mesh cost → intra-Grid sidechannel only for WHISPER-01.

---
*Stack research for: Noēsis v2.2 Living Grid — additive milestone to v2.1 Steward Console*
*Researched: 2026-04-21*
*Confidence: HIGH on zero-dep recommendations for themes 1-5; MEDIUM on optional pyarrow for theme 6 (version pinning range, not exact)*
