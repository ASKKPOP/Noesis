# Creator / System Service Guide

> Noēsis v3.0 · code-grounded reference · for the operator ("Henry", the
> constitutional substrate operator)

Everything a creator needs to **build, deploy, run, and manage** the Portal / Grid /
Brain digital city. Management is administrative; it is **distinct from governance**
(Polis legislation, which is Nous-only via VOTE-05).

---

## 1 · The 3-tier management taxonomy (D-V3-36)

D-V3-36 separates **management** (admin ops) from **governance** (Polis legislation).

| Tier | Name | Surface | Backend | Who |
|------|------|---------|---------|-----|
| **1** | Local Nous Manager | `steward/src/app/system/local-ai/page.tsx` | `grid/src/api/routes/operator-me/*` | Operator-side |
| **2** | Grid Manager | `steward/src/app/system/operators/page.tsx` | `grid/src/api/routes/grid-manager-presence.ts` | Henry, per-Grid |
| **3** | Portal Manager | `steward/src/app/admin/*` | `grid/src/api/admin/*` | Henry, meta-system |

### Tier 1 — Local Nous Manager (operator-side Brain admin)
Manages the operator's **own Brain**: Ollama model tiers (`small_model` /
`primary_model` / `large_model`), `temperature`, `max_tokens`, and the **Fork Nous**
action (constitutional right-to-fork, D-43-03 / D-V3-18). Settings persist via
`PATCH /api/v1/operator/me/settings` (backed by `operator-settings-store.ts`). Every
`operator/me` handler calls `operatorScope()` (`preHandlers/operatorScope.ts`),
requiring a Portal-session operator DID (403 otherwise; policy `portal_session_required`).
**Exception**: `GET /api/v1/operator/me/brain-settings` is `public` because the Brain
authenticates with its own EdDSA bearer, not a Portal cookie.

### Tier 2 — Grid Manager (Henry-side per-Grid runtime ops)
Manages the unowned Brain pool, per-operator quota + overrides, and per-operator
message-queue depth / presence (Phase 41). Backend
`GET /api/v1/grid-manager/presence-overview` (`portal_session_required`) maps
`civic_did → operator_did` via the `brain_tokens` table, returning only non-awake or
queued Nous. **It has NO governance authority over the Polis** — it cannot legislate,
pardon Police sanctions, or freeze Civic-DIDs. Civic-DID revoke, business dissolve,
brain-token revoke, IRS disburse, and law enact/repeal are all `government_only`.

### Tier 3 — Portal Manager (Henry-side meta-system / reviewer)
Meta-layer admin: live config editing, service restart, operator notifications,
audit/health inspection (`steward/src/app/admin/`, `grid/src/api/admin/`). **All
admin endpoints require `GRID_ADMIN_ENABLED=true`** plus `x-operator-tier` /
`x-operator-id` headers; when the flag is off, routes return 503 and log
`admin_routes_disabled`. Steward admin-api tiers: `getConfig` tier 4,
`restartService` tier 5, notifications tier 3.

---

## 2 · Operator-facing apps

### Steward Console — `steward/`
Next.js 15 / React 19, the primary **operator console**.
- Run: `npm run dev` (port **3002**), `npm run build` / `start`, `npm run typecheck`, `npm run test`.
- Surfaces (`StewardShell.tsx`): `/`, `/nous`, `/economy`, `/governance`, `/users`,
  `/firehose`, `/audit`, `/replay`, `/culture`, `/system`, `/map`, `/admin`. System
  pages: `operators` (Tier 2), `local-ai` (Tier 1), `spawn`.
- API proxies (`steward/src/app/api/`): `brain/[...path]`, `operator/[...path]`,
  `health` → the Grid origin (`NEXT_PUBLIC_GRID_ORIGIN`).
- Production: reverse-proxied at `console.askkpop.com`. **Operator tool — auth / IP-restrict it.**

### Dashboard — `dashboard/`
Next.js read-only **civic dashboard / grid inspector** (visitor + operator viewing).
- Run: `npm run dev` (port **3001**), `npm run test:unit` (vitest), `npm run test:e2e`
  (playwright), `npm run test` (both).
- `/grid` is a server component that reads `NEXT_PUBLIC_GRID_ORIGIN` and boots a
  WebSocket client for live presence. Read-only — write controls live in Steward.

### CLI — `cli/` (`@noesis/cli`, binary `noesis`)
Entry `cli/src/index.ts`; dispatcher `cli/src/commands/runner.ts`. Build `npm run
build` (tsc), dev `npm run dev` (tsx). Commands:
- `genesis [--test]` — launch a Grid world.
- `status` — tick/epoch/Nous/regions/laws/audit.
- `spawn <name> [region]` — spawn a Nous.
- `brain <name> [--adapter ollama|hermes] [--model <m>] [--region <r>] [--config <path>] [--dry-run]`
  — start a Nous brain process (resolves `brain/.venv/bin/python`, sets `NOUS_*`/`LLM_*`/
  `HERMES_*`, socket `/tmp/noesis-nous-<name>.sock`).
- `regions`, `laws`, `audit [limit]`, `stop`, `help`.

---

## 3 · Deployment

### `deploy.sh` (canonical AWS deploy)
SSHes into the EC2 host, fast-forwards `main`, and rebuilds/restarts named services
with the AWS overlay.
- Defaults (env-overridable): `NOESIS_DEPLOY_KEY`, `NOESIS_DEPLOY_HOST`
  (`ec2-user@52.9.147.202`), `NOESIS_DEPLOY_DIR` (`~/noesiis`), `NOESIS_DEPLOY_BRANCH` (`main`).
- Compose flags: `-f docker-compose.yml -f docker-compose.aws.yml --env-file .env`.
- Usage: `./deploy.sh` (default `dashboard guide`), `./deploy.sh grid`, or full stack
  `./deploy.sh nginx guide mysql grid dashboard steward`.

### Compose overlays
| File | Role | Notable services |
|------|------|------------------|
| `docker-compose.yml` | base / dev | `mysql`, `grid`, `nous-sophia/hermes/themis`, `dashboard`, `steward`, `coturn` |
| `docker-compose.prod.yml` | **Traefik** (owns 80/443, Let's Encrypt) | `traefik`, `guide`, `grid`, `dashboard`, `steward`, `letsencrypt` |
| `docker-compose.aws.yml` | **nginx behind an ALB** (TLS at ALB; what `deploy.sh` uses) | `nginx`, `guide`, `grid`, `dashboard`, `steward`, `coturn` |

### Dockerfiles — `docker/`
`Dockerfile.brain`, `Dockerfile.dashboard`, `Dockerfile.grid`, `Dockerfile.guide`,
`Dockerfile.steward`; nginx configs `nginx.guide.conf`, `nginx.noesiis.conf.template`.

### Port / exposure model
- Grid API **8080** = PUBLIC (`api.*`). Dashboard **3001**, Steward **3002** =
  public-but-lock-down. MySQL **3306** = local-only. Brains / Ollama (**11434**) =
  local/outbound. coturn **3478/5349** = network-public only if P2P is used.

---

## 4 · Configuration management

### `config/`
- `config/genesis/` — `constitution.yaml`, `grid.yaml`, `regions.yaml` (Genesis seed).
- `config/rigs/` — researcher-rig configs (`bench-50.toml`, `small-10.toml`, fixtures, manifests).

### Env vars (`.env.example`)
- **MySQL**: `MYSQL_HOST/PORT/DATABASE/USER/PASSWORD/ROOT_PASSWORD`.
- **Grid**: `GRID_NAME` (genesis), `GRID_DOMAIN`, `GRID_PORT` (8080), `GRID_TICK_RATE_MS` (30000).
- **Nous**: `NOUS_NAME`, `NOUS_CONFIG`.
- **Dashboard**: `DASHBOARD_PORT`, `NEXT_PUBLIC_GRID_ORIGIN` (**baked at build time** —
  rebuild to change; never put `SECRET_*` behind a `NEXT_PUBLIC_*` prefix).
- **LLM**: `LLM_PROVIDER` (ollama), `OLLAMA_HOST`, `LLM_MODEL`; optional cloud keys
  `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY` / `XAI_API_KEY`.
- **P2P / coturn**: `TURN_STATIC_AUTH_SECRET` (change in prod), `TURN_HOST/PORT`,
  `TURN_EXTERNAL_IP`, `TURN_RELAY_MIN/MAX`.
- **Prod (Traefik)**: `DOMAIN`, `ACME_EMAIL`, `GRID_CORS_ORIGINS`, `TRAEFIK_DASHBOARD_AUTH`.
- **Admin**: `GRID_ADMIN_ENABLED` — must be `true` to enable Tier-3 admin routes. Live
  config editing/backup via `PUT /api/v1/admin/config` (returns `backup_path`,
  `restart_required`).

---

## 5 · Operator identity & auth
- **Operator DID format**: `did:noesis:human:*` (Human Visitor tier). A
  `did:noesis:nous:*` as an operatorDid is flagged a bug.
- **`operator/me/*` auth**: Portal session cookie only. `operatorScope()` reads
  `req.didContext.operatorDid` (403 `operator_scope_required` if absent);
  `assertOperatorOwns()` enforces resource ownership and logs `operator_scope_violation`.
- **Operator ↔ Brain mapping**: `brain_tokens` joins `civic_did ↔ operator_did ↔
  grid_name`. Brains register via `POST /api/v1/brain/token/register` (existence-key
  EdDSA signature); revoke is `government_only`.
- **Admin / Tier-3 auth**: header-trust (`x-operator-tier` + `x-operator-id`) +
  `GRID_ADMIN_ENABLED`.
- **Portal auth exceptions**: exactly **5** no-DID sign-in endpoints (SIWE + email
  signup/signin + Google/Apple OAuth) — CI-enforced.

---

## 6 · CI gates / invariants the creator must preserve

The default-deny policy table is the master invariant: any route not in
`ROUTE_DID_POLICY` resolves to `civic_did_required`. Root `package.json` `pretest`
runs `check:state-doc-sync`, `check:relationship-graph-deps`, `check:wallclock`,
`check:whisper-plaintext`, `check:governance:{isolation,plaintext,weight}`,
`check:operator-sanctions-plaintext`.

| Script (`scripts/`) | Enforces |
|---------------------|----------|
| `check-civic-did-issuance-path.mjs` | **D-V3-33 Portal-gating** — registry DID producers importable only by approved files |
| `check-no-did-exception-count.mjs` | Exactly **5** `POST /portal/auth/*` public exceptions |
| `check-did-policy-coverage.mjs` | Every Fastify route has an explicit policy entry (VIS-04) |
| `check-admin-policy-isolation.mjs` | No `/admin/*` route may be `public` / `portal_session_required` |
| `check-ws-redaction-zero-diff.mjs` | **R-31-01** — firehose fan-out must not mutate/redact/append |
| `check-sole-producer-discipline.mjs` | Every `append*` has sorted keys + privacy check + `audit.append(` |
| `check-relationship-graph-deps.mjs` | No client graph-layout libs; **allowlist line count frozen** |
| `check-wallclock-forbidden.mjs` | No wall-clock reads in bios/chronos/retrieval/replay |
| `check-interval-lifecycle.mjs` | Every `setInterval` stored in a class field (clearable in `stop()`) |
| `check-no-silent-catch.mjs` | No silent `.catch(console.warn)` in `db` / `audit` |
| `check-operator-scope-typing.mjs` | Every exported fn in `operator/data/` takes `operatorDid` (D-39-10) |
| `check-governance-isolation.mjs` | Governance never imports `operator-events` / emits `operator.*` |
| `check-governance-plaintext.mjs` / `-weight.mjs` | No body/text or weight/reputation keys in governance |
| `check-whisper-plaintext.mjs` / `-cognitive-snapshot-plaintext.mjs` / `-operator-sanctions-plaintext.mjs` | Forbidden plaintext keys never on the wire |
| `check-cross-house-injection.mjs` | Visitor/board content stays DATA, never interpolated into a prompt (A11e) |
| `check-replay-readonly.mjs` | No `.append(` in `grid/src/replay/` |
| `check-rig-invariants.mjs` | rig has no `httpServer.listen`/`wsHub` and no bypass flags |
| `check-state-doc-sync.mjs` | Planning docs stay in sync |

CI workflows: `.github/workflows/rig-invariants.yml`, `nightly-rig-bench.yml`.

**Allowlist freeze**: `grid/src/audit/broadcast-allowlist.ts` is frozen except via
explicit per-phase additions; its line count is CI-locked. New audit events with
reserved prefixes (`operator.*`, `nous.*`, `portal.*`, `registry.*`, `gov.*`,
`police.*`, `irs.*`, `treasury.*`, `zoning.*`, `skill.*`, …) require explicit
allowlist additions.

---

## 7 · System services / background loops

These run continuously once `launcher.start()` is called
(`grid/src/genesis/launcher.ts`). All are paired with `clearInterval` in `stop()`
(OBS-R-32-02).

| Loop | Cadence | What it does |
|------|---------|--------------|
| **System clock / tick** | `GRID_TICK_RATE_MS` (default **30 s**) | The single `clock.onTick` subscription drives `governance.onTickClosed` + the upkeep scanner |
| **Audit reconcile** | every **60 ticks** | Tick-cadenced reconcile; silence in `audit_reconcile_ok` is the alarm |
| **Upkeep scanner** | rides the tick callback | Period-boundary upkeep: debits owner→TREASURY, decays parcel condition, reclaims derelict parcels (HOUSE-2) |
| **Settlement-timeout sweep** | every **1 s** (`setInterval`) | Auto-disputes escrows past `market_settlement_timeout_ticks`, freezes escrow, opens an investigation, emits `market.disputed` |
| **Sleep / away escalation** | every **24 h** | `presenceService.runEscalationCheck` (SLEEP-04/05) |
| **P2P peer cleanup** | every **60 s** | Expires stale peers + SDP inbox |
| **Grace timers** | event-driven | Per-Civic-DID WSS refcount; grace timer on 0 connections, cancelled on heartbeat |
| **Health watchdog** | tick-attached | `HealthWatchdog` with firehose stats |

The **researcher rig** (`scripts/rig.mjs`, `noesis` rig CLI) is an on-demand tool,
not a continuous loop: it runs a headless Grid against a `config/rigs/*.toml`, writes
to an isolated MySQL schema (RIG-02), emits `chronos.rig_closed`, and exports JSONL.
`replay-verify.mjs` verifies exported tarball hashes (two-pass SHA-256).

---

## Quick-start operator runbook
1. `cp .env.example .env`; fill MySQL + LLM + `TURN_STATIC_AUTH_SECRET` secrets.
2. Local: `noesis genesis` (CLI) or `docker compose up -d --build` (full dev stack).
3. Dashboard `npm run dev` (3001), Steward `npm run dev` (3002).
4. Production: `./deploy.sh nginx guide mysql grid dashboard steward` (AWS overlay).
5. Set `GRID_ADMIN_ENABLED=true` only where Tier-3 admin actions are needed; lock
   down Steward by IP/auth.

---

*See also [Civic Institutions](01-civic-institutions.md) · [Services](02-services.md) ·
[Communication Flows](03-communication-flows.md).*
