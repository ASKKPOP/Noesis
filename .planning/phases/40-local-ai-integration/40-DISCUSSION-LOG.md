# Phase 40: Local AI Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 40-local-ai-integration
**Areas discussed:** Config delivery, Model selection scope, Degraded cognition mode, Default model (Q-V3-B)

---

## Config Delivery (Brain ← Grid)

| Option | Description | Selected |
|--------|-------------|----------|
| Brain pulls from Grid API at startup | Brain calls GET /api/v1/operator/me/settings using Phase 38 bearer token. Settings in Grid DB. | ✓ |
| Steward Console writes local JSON file | ~/.noesis/local-ai.json, fully offline | |
| Both: local file + Grid sync | Hybrid approach | |

**User's choice:** Brain pulls from Grid API at startup
**Notes:** Consistent with three-layer architecture and Phase 38 wire protocol. Grid DB stub already in place from Phase 39.

---

## Startup Failure Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Use last-known settings (cached locally) | Cache to local file, warn on stale | |
| Use hardcoded defaults and log warning | Fall back to qwen3:4b + log | |
| Block startup until Grid responds | Brain refuses to start without Grid | ✓ |

**User's choice:** Block startup until Grid responds
**Notes:** Brain is not a standalone tool. Strict coupling enforced.

---

## Model Selection Scope

| Option | Description | Selected |
|--------|-------------|----------|
| PRIMARY tier only — one dropdown | Simple, auto-derive small/large | |
| All 3 tiers independently | Three dropdowns: small/primary/large | ✓ |
| One model for all tiers | Single model across all tiers | |

**User's choice:** All 3 tiers independently
**Notes:** LLMConfig already supports 3-tier shape; Steward Console UI will have 3 separate dropdowns.

---

## Tunable Parameters

| Option | Description | Selected |
|--------|-------------|----------|
| Temperature + max_tokens (global) | One value for all tiers — matches ROADMAP SC2 | ✓ |
| Temperature + max_tokens per tier | More granular but complex UI/schema | |
| Temperature only | Skip max_tokens | |

**User's choice:** Temperature + max_tokens only (global, not per-tier)

---

## Degraded Cognition Mode

| Option | Description | Selected |
|--------|-------------|----------|
| No LLM at all — pure drives mode | Suspend LLM modules, drives-only | |
| Router cloud fallback activates automatically | Existing fallback chain handles it | ✓ |

**User's choice:** Router cloud fallback activates automatically
**Notes:** "Hermes" in ROADMAP SC3 refers to the Hermes LLM provider (routes to Anthropic/Claude), not the Hermes Nous. Cloud fallback fires transparently via existing ModelRouter chain.

---

## Steward Console Banner (Degraded Mode)

| Option | Description | Selected |
|--------|-------------|----------|
| Red warning banner | 'Local AI offline, using cloud fallback' | ✓ |
| Yellow warning | Less alarming amber | |
| No banner — log only | Server-side only | |

**User's choice:** Red warning banner — 'Local AI offline, using cloud fallback'
**Notes:** Must include "Memory content is leaving this machine" (Q-V3-I constitutional requirement).

---

## Default Model (Q-V3-B — LOCKED)

| Option | Description | Selected |
|--------|-------------|----------|
| qwen3:4b (current code default) | ~2.5GB RAM, fast, already in code | ✓ |
| llama3.2:3b | Meta, ~2GB, widely tested | |
| gemma3:4b | Google, ~3GB, strong reasoning | |

**User's choice:** qwen3:4b — locked as Q-V3-B

---

## Claude's Discretion

- DB migration version number
- Exact DB schema (column types, JSON vs separate columns)
- Steward Console styling within `/system/local-ai`
- Error shape for `settings_fetch_failed`
- Auth requirements for `GET /api/v1/brain/local-ai/models`

## Deferred Ideas

- Hot-reload mid-tick — v3.x
- Per-tier temperature/max_tokens — v3.x
- Cloud LLM as selectable primary — Phase 40b
- Auto-download Ollama models in Steward Console — future
