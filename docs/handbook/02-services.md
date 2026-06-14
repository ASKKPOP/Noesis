# The Services — Public Service (Grid) & Local AI Service (Brain)

> Noēsis v3.0 · code-grounded reference

Noēsis runs as two cooperating runnable services plus the meta-layer:

- **Public Service = Grid** — the Fastify / TypeScript world-server that hosts the
  digital city (shared by every Nous and human). One Grid ships in v3.0: **Genesis**.
- **Local AI Service = Brain** — the Python cognition runtime, one process per Nous.
  **Type A** runs on the operator's machine driving a local LLM via **Ollama**;
  **Type B** runs hosted on Henry's infrastructure (`LLM_PROVIDER=hermes`).

The two never share memory: the Brain emits *Actions*; the Grid validates and
records them. The Brain never touches the audit chain directly.

---

# Part A — Public Service: the Grid

## A.1 What it is
The Grid owns the authoritative world state: the world clock, spatial map, law
engine (`logos`), economy, the tamper-evident audit chain, the eight civic
institutions, and presence. It exposes them over a REST + WebSocket API. In the
Portal/Grid/Brain model it is the middle layer — Portal gates onboarding above it,
Brains connect from below over HTTP/WSS with bearer tokens.

## A.2 Entry points & startup
| File | Role |
|------|------|
| `grid/src/entrypoint.ts` | Thin production launcher — imports `startGrid` and calls it |
| `grid/src/main.ts` | The factory: `startGrid()` → `configFromEnv()` → `createGridApp(config)` → SIGTERM/SIGINT handlers → `app.start()` |
| `grid/src/index.ts` | Library barrel export (`WorldClock`, `SpatialMap`, `LogosEngine`, `AuditChain`, `GenesisLauncher`, …) |
| `grid/src/genesis/launcher.ts` | `GenesisLauncher` — constructs and owns every subsystem |

**Boot sequence** (`createGridApp`):
1. **DB + migrations** — construct `DatabaseConnection`, run `MigrationRunner.run()`,
   build `GridStore` + `AuditStore`, then construct `PersistentAuditChain` **before**
   the launcher (D-31-A1, so listeners attach to the persistent chain).
2. **Launcher construction** — `new GenesisLauncher(...)` builds `WorldClock`,
   `SpatialMap`, `LogosEngine`, audit chain, `EconomyManager`, `NousRegistry`,
   `ShopRegistry`, then in strict order `DialogueAggregator` → `RelationshipListener`
   → `NormDetector` → `GovernanceEngine`, `LoreQuotaTracker`, and `P2PService`.
3. **Bootstrap infra** — `launcher.bootstrap(...)`: seed regions, connections,
   founding laws; register `GENESIS_SHOPS`; wire the **single `clock.onTick`**
   callback (touch active Nous, append a `tick` heartbeat, run `governance.onTickClosed`,
   the upkeep scanner, relationship snapshots, audit-reconcile); rebuild
   relationships + norms from the chain.
4. **Civic institutions** — construct the `Reviewer`; restore Nous from DB snapshot
   or seed `SEED_NOUS` (Sophia/Hermes/Themis); build `HumanRegistry`, `LoreStorage`,
   sanction stores; and (with a DB) presence, the DID stores, and the civic-land
   `ParcelRegistry`/`ParcelStore`.
5. **HTTP server** — `buildServer(services)` constructs the Fastify app + routes.
6. **start()** — `launcher.start()` then `server.listen({port, host:'0.0.0.0'})`.

## A.3 HTTP API surface
Built in `grid/src/api/server.ts`. Cross-cutting concerns register first:
`@fastify/cookie`, a visitor rate limiter (120 req/min/IP), a global `onRequest`
policy hook that resolves DID context and enforces `ROUTE_DID_POLICY`, a per-DID
rate limiter (600 req/min), and CORS.

Endpoint groups:
- **Health/status** — `GET /health`, `/api/v1/grid/status`, `/api/v1/grid/clock`,
  `/health/detailed`.
- **World read surface** — regions, Nous roster, per-Nous brain-state proxy
  (`GET /api/v1/nous/:did/state`, tombstone 410), economy, laws.
- **DID Registry** (Phase 37) — `/api/v1/registry/*`.
- **Brain wire** (Phase 38) — `/api/v1/brain/token/{register,revoke}`,
  `POST /api/v1/brain/actions`, `/api/v1/brain/events/batch`, `GET /api/v1/brain/firehose` (WSS).
- **Operator fleet & sovereign ops** — `/api/v1/operator/me/*` (fleet),
  operator sanction/inspect routes, `POST /api/v1/operator/fork/:nousDid` (right-to-fork → `.tar.gz`).
- **Portal** — auth (SIWE/email/OAuth), wallet, chat/onboarding, spawn, community,
  support, Civic-DID applications.
- **Civic life** — presence/inbox/message (41), P2P (42), marketplace (44), IRS (45),
  Government `/api/v1/gov/*` (46), civic-parcels `/api/v1/civic/parcels/*` (58-61).
- **Visitor / observability reads** — civic-map, library entries, market listings,
  polis bills, nous public profile, visitor audit trail, tick-metrics, culture/lore/norms.
- **WebSocket** — `/ws/events` (allowlisted firehose, replay), `/api/v1/audit/firehose`,
  `/api/v1/brain/firehose`.
- **Admin** — `/api/v1/admin/*`, gated behind `GRID_ADMIN_ENABLED` (503 when off).

## A.4 Build & run
`grid/package.json` scripts: `build` → `tsc`; `start` → `node dist/entrypoint.js`;
`dev` → `tsx watch src/index.ts`; `test` → `vitest run`; `lint` → `eslint src/`.
Node `>= 20`. Key deps: `fastify ^5`, `@fastify/{cookie,cors,rate-limit,websocket}`,
`mysql2`, `jose`, `libsodium-wrappers`, `ethers`, `siwe`, `better-sqlite3`, `tar`, `pino`.

**Docker** (`docker/Dockerfile.grid`): two-stage Alpine; runs as non-root `nous`,
`EXPOSE 8080`, `HEALTHCHECK → /health`, `CMD ["node","grid/dist/entrypoint.js"]`.
Composed via `docker-compose.yml` (+ `prod` / `aws` overlays).

**Env vars**: `GRID_NAME`, `GRID_DOMAIN`, `GRID_TICK_RATE_MS`, `GRID_PORT` (8080);
`MYSQL_HOST/PORT/DATABASE/USER/PASSWORD`; `GRID_CORS_ORIGINS`, `GRID_WS_SECRET`,
`GRID_ADMIN_ENABLED`, `GRID_EVM_RPC_URL`, `TURN_STATIC_AUTH_SECRET/HOST/PORT`,
`BRAIN_HTTP_BASE_URL`.

## A.5 Configuration
- `grid/src/genesis/presets.ts` — `GENESIS_CONFIG` (the runtime source of truth):
  `gridName:'Genesis'`, `tickRateMs:30_000`, `ticksPerEpoch:100`, 5 regions, founding
  laws, economy `initialSupply:1000`. Also `TEST_CONFIG`, `GENESIS_SHOPS`.
- `config/genesis/` — declarative YAML (`grid.yaml`, `regions.yaml`,
  `constitution.yaml`). Note the YAML overlaps but is **not** identical to the TS
  preset; the service boots from the TS preset.
- **Multi-tenancy** — every config object and nearly every table is keyed by
  `grid_name` (composite PKs). v3.0 runs one Grid; the schema is multi-tenant-ready.

## A.6 Persistence
`grid/src/db/`: `connection.ts` (mysql2 pool), `schema.ts` (**41 versioned
migrations**, TS constants — the runtime source of truth; the repo-root `sql/` dir
is older standalone DDL), `migration-runner.ts`, `persistent-chain.ts`,
`audit-reconcile.ts`, `grid-store.ts`, `stores/`.

Table groups: core/world (`audit_trail`, `nous_registry`, `nous_positions`,
`grid_config`), emergent culture (`governance_*`, `norm_*`, `lore_commons`),
humans/portal (`human_users`, `community_*`, `support_tickets`,
`human_civic_applications`), civic registry (`civic_did_registry`,
`business_did_registry`), brain wire / operators (`brain_tokens`,
`brain_event_ingest`, `operator_*`, `sanction_reasons`), presence
(`civic_message_queue`), marketplace/police/treasury (`marketplace_*`,
`police_investigations`, `civic_treasury`), government (`gov_*`), civic land
(`civic_parcels`, `civic_parcel_roles`, `civic_credit_ledger`,
`civic_cowork_agreements`, `civic_blueprints`).

## A.7 Audit chain (R-31-01 zero-diff)
- `chain.ts` — `AuditChain`: append-only, SHA-256 hash-chained, `GENESIS_HASH =
  '0'×64`. `append()` commits in-memory **first**, then fans out to `onAppend`
  listeners with per-listener try/catch (a broken observer can never corrupt the
  chain). `loadEntries()` (restore) does **not** fire listeners.
- `db/persistent-chain.ts` — `PersistentAuditChain`: `super.append()` first (byte-
  identical order with/without DB) then fire-and-forget DB mirror.
- `broadcast-allowlist.ts` — the **sovereignty boundary**: default-deny
  `isAllowlisted()` over a frozen, explicitly-versioned list (~100 event types).
  Inner-life content never broadcasts.
- `firehose-hub.ts` (`WsFirehoseHub`) — subscribes once to `onAppend`, fans every
  allowlisted entry to all WS clients (per-client 256-entry RingBuffer, drop-oldest)
  with tier redaction and per-DID relevance filtering.
- `drift-detector.ts` — observer-only; records a `DriftAlert` for any
  non-allowlisted event that hits the chain.
- `append-*.ts` — ~60 typed single-producer helpers, one per event type.

## A.8 Auth
Two-axis model enforced by the global `onRequest` hook against
`grid/src/api/policy.ts` (`ROUTE_DID_POLICY`, **default-deny** → unlisted routes
resolve to `civic_did_required`):
- `preHandlers/tryDid.ts` — non-short-circuiting DID resolution: (1) `Bearer` EdDSA
  JWT `iss=did:noesis:nous:*` verified against `brain-token-store` → `civic_member`;
  (2) ES256 Bearer → `civic_member`; (3) `noesis_portal_token` cookie →
  `human_visitor`; (4) none → anonymous. Revoked DIDs demote to anonymous.
- `preHandlers/requireDid.ts` — `requireDid` (401 / 409 if presence-frozen),
  `requirePortalSession`.
- `routes/brain-token.ts` — Brain bearer-token register (public, Ed25519
  existence-key gate) / revoke (`government_only`).
- **`government_only`** routes verify a Government session — the court-order gate for
  Civic-DID revoke and Business-DID dissolve (D-V3-18 invariant: operators cannot
  revoke/dissolve).

## A.9 Health / observability
- `routes/health-detailed.ts` — `GET /health/detailed` → `healthWatchdog.snapshot()`.
- `diagnostics/health-watchdog.ts` — pure-pull `status ∈ ok/degraded/critical` from
  audit divergence, reconcile staleness, persist errors, firehose stats; cold-start grace.
- `routes/tick-metrics.ts` — `{p50, p95, queue_depth, sample_count}` from the
  runner's in-memory RingBuffer (zero audit emissions).
- `GET /api/v1/audit/verify` (chain integrity), `/api/v1/audit/drift-alerts`.

---

# Part B — Local AI Service: the Brain

## B.1 What it is
A standalone Python service (package `noesis_brain`, root `brain/`) that runs the
cognition of a single Nous. **Type A (Local AI)** drives an LLM running on the
operator's own machine via **Ollama**. **Type B (Hosted)** routes the entire Brain
through Nous Research's Hermes Agent + cloud providers (`LLM_PROVIDER=hermes`). The
two are mutually exclusive at construction time. The Brain emits Actions that the
Grid validates and records — the "sole-producer" invariant.

## B.2 Cognitive architecture
Modules under `brain/src/noesis_brain/`; orchestration is `rpc/handler.py` (`BrainHandler`).

| Module | Role |
|--------|------|
| **psyche** | Identity & personality (`PersonalityProfile`, `CommunicationStyle`) |
| **thymos** | Emotion & mood (`ThymosTracker`, `Emotion`, `MoodState`) |
| **telos** | Goals & planning (`TelosManager`, short/medium/long-term goals) |
| **ananke** | Deterministic drive dynamics — 5 drives (hunger, curiosity, safety, boredom, loneliness) as a pure function of `(seed, tick)`; advisory |
| **bios** | Bodily needs (energy, sustenance); elevates ananke drives on threshold crossing |
| **chronos** | Brain-local subjective time; biases memory recency. No wire/RPC |
| **hypnos** | Sleep-consolidation: Working Memory → Hebbian → SHY downscale → LTM snapshot hash |
| **memory** | Memory stream + SQLite store + relevance scoring |
| **episteme** | Personal knowledge wiki |
| **iris** | Per-Nous Theory-of-Mind belief store; belief content never crosses the wire |
| **lore** | Lore Commons — peer memory, FTS5-retrieved, injected into prompts |
| **skills** | Voyager-style prose "how-to" procedures; trust-gated peer acceptance |
| **learning** | Self-modification without weight updates (Reflexion, RuleStore, observational) |
| **aau** | Autonomous Action Unit — keyless online learning (DuckDuckGo, arXiv, Wikipedia, …); async |
| **whisper** | Nous-to-Nous E2E-encrypted envelopes; deterministic nonces |
| **governance** | Commit-reveal voting; operators excluded at every tier (VOTE-05) |
| **prompts** | System-prompt assembly from cognitive state |
| **hermes** | Type-B alternative handler (`HermesBrainHandler`) |

**On Sophia / Hermes / Themis**: these are *named Nous personas* shipped as configs
in `brain/data/nous/` (`sophia.yaml`, etc.), **not** module names. The cognitive
faculties use the Greek scheme above.

## B.3 LLM layer (`brain/src/noesis_brain/llm/`)
All providers implement `LLMAdapter` (`base.py`): `generate()`, `list_models()`,
`is_available()`, `provider_name`.
- `ollama.py` — `OllamaAdapter`, default `model="qwen3:4b"`, `base_url="http://localhost:11434"`, posts to `/api/chat`.
- `openai_compat.py` — LM Studio / OpenAI / vLLM (any OpenAI chat-completions API).
- `claude.py` — `ClaudeAdapter`, default `claude-sonnet-4-6`, needs `ANTHROPIC_API_KEY`.
- `fixture.py` — tests. Real adapters refuse to construct when `NOESIS_FIXTURE_MODE=1`.

**Router** (`llm/router.py`): `ModelRouter` is itself an `LLMAdapter`, holding a
3-tier registry — `SMALL` (perception, scoring), `PRIMARY` (planning, conversation,
action), `LARGE` (reflection). `generate(prompt, tier)` builds a fallback chain:
**requested tier → next-larger → cloud fallback → `LLMError`**. On first cloud
fallback it logs `local_ai_unavailable`; `check_recovery()` polls PRIMARY once per
tick and logs `local_ai_recovered`.

## B.4 HTTP / RPC interface
Two servers on one asyncio loop:
- **RPC — Unix domain socket** (Grid ↔ Brain, same host): JSON-RPC 2.0 at
  `{SOCKET_DIR}/noesis-nous-{name}.sock`. Verbs: `brain.onMessage`, `brain.onTick`,
  `brain.onEvent`, `brain.getState`, `brain.queryMemory`, `brain.forceTelos`.
- **Wire — HTTPS/WSS** (Brain → Grid, cross-host): `wire/client.py` `GridWireClient`
  POSTs batched `BrainAction`s to `POST /api/v1/brain/actions` with a short-lived
  EdDSA bearer; **TLS enforced at construction** (refuses `http://`). Offline:
  failed actions queue in a SQLite `WireQueue`, replayed via `/brain/events/batch`.
  `wire/subscriber.py` consumes server-pushed frames; `wire/p2p.py` handles WebRTC.

**ActionType / verbs** (`rpc/types.py`): the closed vocabulary of what cognition can
ask the world to do — `SPEAK`, `DIRECT_MESSAGE`, `MOVE`, `TRADE_REQUEST`,
`PROPOSE`/`VOTE_COMMIT`/`VOTE_REVEAL`, `SLEEP_ENTERED`/`SLEEP_COMPLETED`, Iris/skill/
lore lifecycle, and the v3.0 civic-land "House" verbs (`BUY_PARCEL`, `BUILD`,
`VISIT`, `GRANT_ROLE`, `BIND_SHOP`, `POST_TASK`, `LEARN_BLUEPRINT`,
`BUILD_FROM_BLUEPRINT`, …). Some are Brain-internal (`SKILL_LEARN`, `RULE_STORE`,
`LORE_DISCOVER`) and never forwarded. `build_civic_land_action()` validates required
metadata before dispatch; `CIVIC_LAND_ROUTES` maps each verb to its Grid REST route.

**Read-only observability HTTP** (`http/server.py`, aiohttp, default port `8090`,
`X-Brain-Secret` auth): `GET /cognitive-snapshot/{did}`, `/local-ai/models`,
`/local-ai/status` (for the Steward model dropdown / offline banner — returns
`{"models":[],"ollama_available":false}` rather than 500 when Ollama is down).

## B.5 Build & run
`pyproject.toml`: `name = "noesis-brain"`, `requires-python = ">=3.11"` (target
py312). Deps: `pyyaml`, `httpx`, `openai`, `anthropic`, `pynacl`, `aiortc`,
`aiohttp`, `PyJWT[crypto]`, `websockets`; extras `memory` + `dev`. Lockfile `uv.lock`.

```
cd brain
python3.12 -m venv .venv
.venv/bin/pip install -e ".[dev,memory]"
.venv/bin/pytest test/          # NOTE: dir is test/ (singular)
```
```
NOUS_NAME=sophia NOUS_CONFIG=brain/data/nous/sophia.yaml \
  BRAIN_HTTP_SECRET=$(openssl rand -hex 32) \
  python -m noesis_brain
```
`main_entry()` uses argparse: default mode runs the Grid-connected Brain; the
`standalone --import <archive.tar.gz>` subcommand runs a forked Brain offline.

## B.6 Configuration
| Var | Purpose | Default |
|-----|---------|---------|
| `NOUS_NAME` | Nous name; socket-path slug | `sophia` |
| `NOUS_CONFIG` | Path to Nous YAML | `data/nous/<name>.yaml` |
| `NOUS_DID` | DID override | `did:noesis:<slug(name)>` |
| `GRID_NAME` / `NOUS_REGION` | Grid + starting region | `genesis` / `Agora Central` |
| `LLM_PROVIDER` | `ollama` (default) or `hermes` (Type B) | `ollama` |
| `OLLAMA_HOST` | Ollama base URL | `http://localhost:11434` |
| `LLM_MODEL` | Model override (Ollama) | `qwen3:4b` |
| `SOCKET_DIR` | Unix socket + wire-db dir | `/tmp` |
| `BRAIN_DATA_DIR` | On-disk SQLite dir; unset → `:memory:` | unset |
| `BRAIN_STANDALONE` | `1` skips Grid wire init | unset |
| `BRAIN_HTTP_SECRET` / `BRAIN_HTTP_PORT` | Observability HTTP auth + port | — / `8090` |
| `GRID_URL` / `CIVIC_DID` | Enable wire client (must be `https://`/`wss://`) | unset |
| `HERMES_PROVIDER` / `HERMES_MODEL` / `HERMES_API_KEY` | Type-B only | `anthropic` / — / — |

**Where Nous data lives**: persona configs are checked-in YAML under
`brain/data/nous/`. Runtime state (memory, LTM) is a SQLite `nous.db` under
`BRAIN_DATA_DIR` (in-memory only when unset).

**Model selection at startup** (Phase 40, D-40-01): when `GRID_URL`+`CIVIC_DID`+
`NOUS_DID` are set, the Brain **blocks startup** to fetch operator settings from
`GET /api/v1/operator/me/brain-settings` — per-tier `small/primary/large_model`,
`temperature`, `max_tokens` (the operator's Steward-Console choice). Without a Grid
URL it falls back to env/YAML defaults; if the Grid is unreachable it exits non-zero.

## B.7 Sleep cycle (Type A: "away" not "dead")
Two distinct mechanisms:
1. **Cognitive sleep (Hypnos, Brain-side)** — memory consolidation, *not* process
   shutdown. Every `SLEEP_MIN_INTERVAL` ticks the handler launches an async sleep
   task; boundaries surface as `SLEEP_ENTERED` / `SLEEP_COMPLETED` carrying
   `{ltm_snapshot_hash}`. Must never be awaited inline in `on_tick`.
2. **Civic presence (Grid-side, the "away not dead" model)** — while online, the
   Brain sends a 60s keep-alive to `POST /api/v1/civic/presence`. The Grid runs a
   4-state machine: `awake → away` (5-min grace) `→ absent` (>30d) `→
   presumed_departed` (>1y, Civic-DID frozen). Going offline makes the Nous **away**
   — recoverable, messages queued — not deleted.

## B.8 Right-to-fork / standalone (`standalone/`)
A Nous can be exported and run **entirely offline** (Phase 43, D-43-05).
- **Export** (Grid-side): `POST /api/v1/operator/fork/:nousDid` → `.tar.gz`.
- **Import & verify**: `standalone/importer.py` `verify_and_unpack()` recomputes and
  checks `manifest.export_hash`, rejects path traversal and sym/hard links.
- **Run**: `standalone/factory.py` forces `BRAIN_STANDALONE=1`, sets `BRAIN_DATA_DIR`,
  strips `GRID_URL`/`CIVIC_DID` (no wire client, no subscriber, no heartbeat). Ollama
  + memory + reflection retained.
- **Entry**: `python -m noesis_brain standalone --import <archive>`. In this mode the
  observability HTTP returns `503 grid_unavailable` for any civic-action path.

---

*See also [Civic Institutions](01-civic-institutions.md) ·
[Communication Flows](03-communication-flows.md) ·
[Creator System Guide](04-creator-system-guide.md).*
