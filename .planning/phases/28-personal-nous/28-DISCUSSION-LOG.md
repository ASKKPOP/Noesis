# Phase 28: Personal Nous — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 28-personal-nous
**Areas discussed:** Brain provisioning model, Payment gate UX, My Nous page (post-spawn), Personality seed depth

---

## Brain provisioning model

| Option | Description | Selected |
|--------|-------------|----------|
| Shared Brain container | Personal Nous runs inside the existing Brain service — same container as Sophia/Hermes/Themis. Grid calls Brain API to register new Nous context. | ✓ |
| Separate Brain Docker container | Each personal Nous gets its own Brain container via Docker API. Complex, Docker-in-Docker, overengineering for v2.5. | |
| Deferred — spawn Grid-only first | Nous exists in Grid but can't chat yet; Brain wiring in a follow-up. | |

**User's choice:** Shared Brain container (recommended)
**Notes:** SPAWN-03's Docker provision intent was aspirational; shared Brain is the correct v2.5 model.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same POST /api/v1/portal/chat/nous/:nousId | Phase 27 endpoint dispatches by Nous ID; personal Nous gets own system prompt from seed. No new chat infrastructure. | ✓ |
| Different endpoint for personal Nous | Separate handler for personal Nous. Only justified if interaction model is fundamentally different. | |

**User's choice:** Same endpoint, different system prompt

---

## Payment gate UX

| Option | Description | Selected |
|--------|-------------|----------|
| On-chain payment before spawn | wagmi sends USDT to Grid treasury; Grid confirms tx; then spawns. Wizard blocks at step 4 until confirmed. | ✓ |
| Balance check only — no on-chain tx | Check wallet has enough USDT, spawn immediately, record debt. Doesn't match SPAWN-01. | |
| No cost in v2.5 — free spawning | Remove payment gate; any human can spawn. Simpler but removes intent of SPAWN-01. | |

**User's choice:** On-chain payment before spawn (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Polling (consistent with WALLET-02) | Dashboard polls /api/v1/portal/nous/spawn/status/:txHash every 3s for up to 2 min. | ✓ |
| Long-poll or SSE | Grid holds connection open and pushes spawn-ready event on tx confirmation. | |
| You decide | Claude picks approach from codebase. | |

**User's choice:** Polling — consistent with WALLET-02 pattern

---

## My Nous page (post-spawn)

| Option | Description | Selected |
|--------|-------------|----------|
| Owner hub — extends public profile | HeroCard + Skills/Lore/Norms (Phase 27) + owner section: spawn metadata, Chat shortcut, Nous Cyber Coin balance. | ✓ |
| Simple redirect to public profile | /portal/my-nous → redirect to /portal/nous/[myNousDid]. No new UI. | |
| Spawn page until spawned, profile after | Route serves dual purpose: CTA before spawn, owner hub after. | |

**User's choice:** Owner hub (recommended)

---

| Option | Description | Selected |
|--------|-------------|----------|
| /portal/my-nous shows CTA, wizard at /portal/nous/spawn | Separate route per SPAWN-01. Clean separation. | ✓ |
| Wizard embedded in /portal/my-nous | Single route handles both states. Fewer routes. | |
| You decide | Claude picks routing approach. | |

**User's choice:** /portal/my-nous shows CTA — wizard at /portal/nous/spawn (recommended)

---

## Personality seed depth

| Option | Description | Selected |
|--------|-------------|----------|
| System prompt only | Seed becomes distinct LLM system prompt. Quick, visible in chat, no Brain architecture changes. | |
| Big Five preset values wired to Brain psyche | Seeds map to specific Big Five values passed to Brain on spawn. Wires into Psyche (BRAIN-01), shapes drive dynamics. | ✓ |
| Record only — no wiring yet | Seeds stored in registry, no effect on Brain or prompt. Same as current operator spawn. | |

**User's choice:** Big Five preset values wired to Brain psyche

---

| Option | Description | Selected |
|--------|-------------|----------|
| Need a new Brain endpoint | A new Brain API POST /api/v1/brain/nous/:did/psyche-seed. | |
| Extend bootstrapPsycheHash | Pass seed type as optional param; biases initial Big Five output. Grid passes at spawn. | ✓ |
| You decide | Claude investigates Brain psyche bootstrap path. | |

**User's choice:** Extend bootstrapPsycheHash (Grid-side, no new Brain endpoint)

---

## Claude's Discretion

- Exact Big Five float presets per seed type
- System prompt text per seed personality
- bootstrapPsycheHash extension implementation detail
- Wizard step UX and animations
- Loading state during payment confirmation
- Empty state on /portal/my-nous before spawn
- Error states in wizard (payment failed, spawn unavailable, name conflict)
- /portal/chat pre-selection param propagation from owner hub

## Deferred Ideas

- Dedicated Brain Docker container per personal Nous — deferred to v2.6+
- Multiple Nous per human — v2.6 decision
- Owner management controls (rename, suspend) — deferred
- Treasury management — deferred to v2.6
