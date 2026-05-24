# Phase 26: Sophia Onboarding — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 26-sophia-onboarding
**Areas discussed:** Sophia chat UX, Goal capture

---

## Sophia chat UX

| Option | Description | Selected |
|--------|-------------|----------|
| Typewriter (streaming) | Text renders character-by-character as LLM streams tokens. Feels alive. Requires SSE. | |
| Full text after spinner | Show loading indicator (~2s), then snap full message in. Simpler, no streaming infra. | |
| Pre-scripted steps 1 + 4, LLM only for steps 2 + 3 | Welcome and world tour use fixed copy; only greeting and goal hit the proxy. | ✓ |

**User's choice:** Pre-scripted steps 1 and 4, LLM only for the greeting/goal conversation steps.

---

## Sophia chat turns

| Option | Description | Selected |
|--------|-------------|----------|
| Single exchange each | Sophia sends one message → user replies once → advance. Clean and fast. | |
| Multi-turn (up to 3 exchanges) | Sophia can respond to user's reply and have a short back-and-forth before advancing. | ✓ |

**User's choice:** Multi-turn, up to 3 exchanges per LLM step.

---

## Wizard advancement

| Option | Description | Selected |
|--------|-------------|----------|
| Sophia says 'ready?' and user taps Continue | LLM includes natural closing line; Continue button appears. User controls pace. | ✓ |
| Explicit 'Next step' button always visible | Persistent Next button exists throughout; user advances whenever done. | |
| Auto-advance after Sophia's closing message | Step auto-advances after 3rd exchange with 2s pause. | |

**User's choice:** Sophia closes naturally → Continue button appears → user taps to advance.

---

## Goal capture

| Option | Description | Selected |
|--------|-------------|----------|
| Free-form text (Sophia asks, user types) | Sophia prompts "What brings you to Noēsis?" — user types, stored verbatim. | ✓ |
| Preset cards + optional free text | 4–5 cards (Explorer / Scholar / Merchant / Guardian / Other). | |
| Sophia infers from conversation | No explicit goal field; Sophia extracts intent, summarizes for confirmation. | |

**User's choice:** Free-form text — Sophia asks organically, user types.

---

## Goal timing

| Option | Description | Selected |
|--------|-------------|----------|
| Step 3 is dedicated goal step (separate from step 2 greeting) | Clean separation between greeting and goal. | |
| Goal captured during step 2 (merged with greeting) | Sophia's greeting chat captures both name/interests and goal naturally. Fewer steps. | ✓ |

**User's choice:** Merged — goal captured in the same multi-turn Sophia conversation as the greeting.

---

## Claude's Discretion

- Welcome scene: CyberGrid as animated background with Sophia's world intro narration overlay
- World tour: CyberGrid with district highlight cycling (AI_CORE → HUB → DATA → DARKWEB → RESIDENTIAL)
- Skip policy: No skip — wizard required for first-time users; mid-flow abandonment restarts from step 1
- First-time detection: `human_users.onboarding_goal IS NULL` → `onboarded: false` in `/me` response

## Deferred Ideas

- Streaming LLM responses via SSE — chosen simpler full-text approach for v2.5
- Sophia re-do onboarding flow — future phase/settings
- Preset goal cards (Explorer / Scholar / Merchant / Guardian) — free-form text chosen
- Sophia references onboarding goal in Phase 27 chat — note for Phase 27 context
