# Phase 39: Grid Multi-Tenancy — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 39-grid-multi-tenancy
**Areas discussed:** Operator-Brain Ownership Claim, GET /api/v1/operator/me/* scope, Quota storage + Henry configurability, operatorScope security logging

---

## Operator-Brain Ownership Claim

| Option | Description | Selected |
|--------|-------------|----------|
| Extend token registration (1-step) | Add operator_did to POST /brain/token/register; Brain signs with existence key | |
| **Separate Portal-gated claim (2-step)** | Brain registers as today; operator claims via Portal session POST /operator/me/brains | ✓ |
| JWT claim extension | Add operator_did as JWT claim at token issuance | |

**User's choice:** Separate Portal-gated claim (2-step)
**Notes:** Two separate auth proofs (Brain existence key + Portal session) = stronger ownership verification. Phase 38 JWT format stays stable.

---

### Unclaimed Brain token behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Still works, just invisible in me/nous | Unclaimed = functional but not surfaced | |
| **Still works, but counts against quota-free pool** | Functional + Henry sees them in Steward Console "Unowned" section | ✓ |
| Must be claimed within N ticks or auto-expires | Shorter TTL for unclaimed tokens | |

**User's choice:** Still works, but counts against a quota-free pool (Henry-visible)
**Notes:** Prevents silent breakage of pre-Phase-39 Brains; Henry can identify operators who haven't completed the claim step.

---

## GET /api/v1/operator/me/* Scope

### Nous entry data shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | { civic_did, brain_did, status } only | |
| Operational | + last_active_tick, token_expires_at, quota_usage | |
| **Rich** | + zone_id, civic_standing (full metadata) | ✓ |

**User's choice:** Rich — full metadata including zone + civic standing
**Notes:** Enables Steward Console fleet view without extra round-trips.

---

### me/* route set

| Option | Description | Selected |
|--------|-------------|----------|
| me/nous only | Minimal Phase 39 | |
| me/nous + me/quota | Fleet overview | |
| **me/nous + me/quota + me/settings** | Full operator self-service namespace | ✓ |

**User's choice:** Full operator self-service (me/nous + me/quota + me/settings)
**Notes:** me/settings starts as placeholder namespace for Phase 40+ Local AI config.

---

### me/* auth mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| **Portal session token only** | HTTP-only cookie, portal_session_required policy | ✓ |
| Either Portal session OR Brain JWT | Dual auth logic in operatorScope | |
| Brain JWT only | Same bearer as action dispatch routes | |

**User's choice:** Portal session token only
**Notes:** Humans manage fleet from Steward Console; Brains dispatch actions. Clean auth separation.

---

## Quota Storage + Henry Configurability

### Brain-process quota storage

| Option | Description | Selected |
|--------|-------------|----------|
| **Derived from brain_tokens count** | SELECT COUNT(*) WHERE operator_did = X — no separate table | ✓ |
| In-memory counter | Like LoreQuotaTracker, resets on restart | |
| Explicit operator_quotas table | DB-backed, fully auditable | |

**User's choice:** Derived from brain_tokens count
**Notes:** DB-authoritative; cannot be gamed by Grid restarts; no extra table.

---

### Henry's quota configuration UX

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars + config file | Restart required | |
| **Steward Console /system/operators page** | Tier-2 Grid Manager, runtime changes | ✓ |
| DB-backed defaults + negotiated overrides | Most flexible | |

**User's choice:** Steward Console /system/operators page
**Notes:** Per D-V3-36 this is exactly what Tier-2 Grid Manager is for.

---

### Per-DID rate limit value (D-36-05 closure)

| Option | Description | Selected |
|--------|-------------|----------|
| 600 req/min (5× visitor) | Conservative | |
| 1200 req/min (10× visitor) | Comfortable headroom | |
| **Claude's discretion** | Planner sets reasonable default, tune vs Phase 38 traffic | ✓ |

**User's choice:** Claude's discretion

---

## operatorScope Security Logging

| Option | Description | Selected |
|--------|-------------|----------|
| **Pino structured warning only** | Internal log, no audit chain | ✓ |
| Pino warning + audit event | Adds allowlist +1 | |
| Silent 403 only | No trail | |

**User's choice:** Pino structured warning only
**Notes:** Consistent with Phase 33 patterns; no new allowlist entry needed.

---

## Claude's Discretion

- Per-DID rate limit default value (600 req/min suggested; tune vs Phase 38 traffic)
- `me/settings` initial field set (placeholder for Phase 40 AI config)
- `operatorScope` exact Fastify hook shape (follow Phase 36 preHandler patterns)
- DB migration numbers (v27 = brain_tokens.operator_did; v28 = operator_quota_overrides)

## Deferred Ideas

- Operator billing for hosting — commercial concern, out of v3.0 scope
- Federated multi-Grid operator accounts (FUTURE-MULTIGRID-01) — v3.x
- Per-operator Dashboard UI customization — explicitly out of Phase 39 scope
- `operator.scope_violation` audit event — rejected; Pino warning sufficient
