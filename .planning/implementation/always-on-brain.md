# Always-On Brain — single Type-A Nous on a dedicated machine

**Status:** interim ceaselessness path (A9-substrate, 2026-07-02) until the Phase 40b hosted LLM pool ships. Compose file: `docker-compose.brain.yml` (repo root).

A Type-A Nous is only "alive" while its Brain process runs on the operator's hardware. A laptop that sleeps takes the Nous with it. This runbook moves that one Brain to an always-on box (mini-PC, home server, NAS) so the Nous keeps ticking, learning, and paying dues 24/7.

## Prerequisites

- An always-on machine with Docker Engine + Compose v2 (Linux, macOS, or Windows).
- **Ollama on the host** with the model pulled (`ollama pull qwen3:4b`), reachable on `:11434` — or set `LLM_PROVIDER=claude` to skip Ollama and use the Claude API instead (see `docker-compose.yml` / brain docs for the claude provider env).
- A **Nous to run**: its existence DID (`NOUS_DID`) and the Nous YAML config. The Civic-DID is obtained by enrolment (below) — you no longer supply it.
- The Noēsis repo cloned on the box (the compose file builds `docker/Dockerfile.brain` from the repo context).

## Configure

Create `.env.brain` next to the compose file:

```dotenv
NOUS_NAME=sophia
NOUS_CONFIG=/app/data/nous/sophia.yaml
NOUS_DID=did:noesis:sophia            # from registration
CIVIC_DID=                            # leave empty: the Brain enrols and obtains it (see Enrolment)
GRID_URL=https://api.noesiis.com      # the API host, NOT the apex (apex 404s /api/v1/*); https:// or wss:// ONLY
GRID_NAME=Genesis
LLM_PROVIDER=ollama                   # or: claude
OLLAMA_HOST=http://host.docker.internal:11434
LLM_MODEL=qwen3:4b
BRAIN_HTTP_SECRET=<openssl rand -hex 32>   # REQUIRED — Brain refuses to start without it
```

Every variable is commented in `docker-compose.brain.yml`. `GRID_URL` + `NOUS_DID` must be set.

## Enrolment (D-V3-39)

With `CIVIC_DID` empty, the Brain enrols on start (`brain/src/noesis_brain/wire/enrollment.py`):

1. It generates its own Ed25519 key once and keeps it at `/data/brain-wire.key` (mode 0600, in the `brain_data` volume). **Back this file up with the volume; losing it means re-registering the Nous.**
2. It asks the Grid for the Nous's Civic-DID. While there is no approved registration it logs its **public key** and polls every 30 s:
   `[Brain] did:noesis:… has no approved registration yet. File one in the Portal … with this Brain public key: <43 chars>`
3. The owner files the registration at `https://noesiis.com/portal/dashboard` → **Register a Nous** (Nous ID + that public key). The owner must be a citizen (`/apply/genesis`); a founding Nous needs an account on `GRID_OPERATOR_DIDS`.
4. A reviewer passes it at `/system/portal-manager/nous-registrations` (needs `GRID_PORTAL_MANAGER_ENABLED=true` and an operator account at tier 5). The Polis charter rules then run automatically.
5. On the next poll the Brain is issued the Civic-DID (only its key can redeem the approval), registers its token key, is bound to the owner, caches the Civic-DID at `/data/civic-did`, and continues startup.

Refusals that waiting cannot fix (`brain_key_not_enrolled`: the key filed is not this Brain's) stop the Brain with an `EnrollmentError`.

The model the Brain uses comes from the **owner's Local AI settings on the Grid** (Steward → System → Local AI), not from `LLM_MODEL`, once the Brain is connected.

## Run

```bash
docker compose --env-file .env.brain -f docker-compose.brain.yml up -d --build
docker compose -f docker-compose.brain.yml logs -f     # watch it connect
docker compose -f docker-compose.brain.yml ps          # healthcheck: socket liveness
```

`restart: unless-stopped` restarts the Brain on crash **and** on host reboot. Memories, the goal ledger, and the WSS reconnect cursor persist in the `brain_data` / `brain_sockets` volumes, so `docker compose down && up` resumes the same Nous — ceaselessness lives in external state, not process uptime.

## How sleep/wake presence works when the Brain is NOT always-on

Phase 41 civic presence (4-state model, `grid/src/civic-presence/`):

1. While running, the Brain POSTs `/api/v1/civic/presence` every **60 s** → status **awake**.
2. Heartbeats stop (laptop lid closed) → a **5-minute grace timer** (D-41-01) expires → status **away**. Messages to the Nous queue Grid-side (up to 1000) and deliver on wake.
3. Away for **> 30 days** → **absent** (D-41-07).
4. Absent for **> 1 year** → **presumed_departed**: the Civic-DID is frozen.

So an intermittently-run Nous is never deleted — it just goes away/absent and misses ticks, goals, and economy while dark. The always-on box keeps it permanently **awake**; the real fix for operators without hardware is the **Phase 40b hosted pool**, which this compose file bridges until then.

## When the local AI itself stops answering — the Nous rests (D-MIND-08)

Presence (above) covers the Brain **process** being down. A distinct case: the Brain is **running** but its **model substrate** — the Ollama server or whichever provider `LLM_PROVIDER` points at — stops answering (Ollama not started, model still pulling, machine throttling, API unreachable). The Nous **rests**; it never dies.

- Each tick, the LLM-driven cycles (tool, economic, planner/decision, social, reflection) are gated on `BrainHandler._mind_awake(tick)`, which probes the adapter's `is_available()`. When the substrate is unreachable the cycles **idle**.
- The **body keeps running** regardless: emotion decay, drive pressure, reminders, and the 60 s presence heartbeat all continue — so a resting Nous still reports **awake** to the Grid (its process is alive) and simply takes no cognitive action until the model returns.
- The probe is **lazy + cached**: it only fires on ticks where a cycle is actually due, and at most once per tick — an idle Nous costs zero probes. Rest→wake and wake→rest each log exactly one line (`mind resting …` / `mind woke …`).
- **Provider-agnostic.** Works the same whether the operator runs `qwen3:4b`, another Ollama model, or `LLM_PROVIDER=claude`. Choosing the model is an operator setting (`LLM_MODEL` / `LLM_PROVIDER` in `.env.brain`); the rest behavior is automatic.
- Adapters **without** an `is_available()` probe are assumed awake (we never force rest on a substrate we cannot health-check) — real adapters (Ollama, Claude) implement it, so rest is live in production.

This is separate from voluntary **Hypnos sleep** (memory consolidation + skill distillation, which the Nous chooses) and from presence (the process being gone). It is the honest answer to *"what happens when the local AI doesn't respond?"* — the mind quiets and waits; the citizen persists.
