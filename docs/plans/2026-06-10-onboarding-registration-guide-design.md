# First-Login Registration Guide — Design

**Date:** 2026-06-10 · **Supersedes:** Phase 26 D-06 (goal-from-chat), D-11 (no skip)
**Trigger:** Production incident — Sophia onboarding chat (step 2) hard-blocks every new
user when the LLM is unreachable (Ollama down → Continue button can never appear →
no path forward). User decision: first login must be a full step-by-step guide with a
quick-start path, framed around Portal-first registration (D-V3-33): without
registration (Civic-DID etc.) there is no Grid participation; browsing is open.

## Verified contracts that MUST survive

1. `onboarded` is **derived**: `GET /me → onboarded = (human_users.onboarding_goal IS NOT NULL)`
   (Phase 26 ONBOARD-04, D-12). Completing OR skipping the wizard must
   `PATCH /api/v1/portal/auth/me {onboarding_goal}` or the user bounces back forever.
2. Auth-page redirect: `onboarded:false → /portal/onboard`, else `/portal` (unchanged).
3. Onboard-page guard: `currentUser.onboarded === true → replace('/portal')` (unchanged).
4. `POST /portal/chat/onboard` stays (used by optional chat); no backend changes at all.

## New wizard (4 steps, zero LLM in required path)

| Step | Content | Network |
|---|---|---|
| 1 Welcome | What Noēsis is (existing StepWelcome, unchanged) | none |
| 2 Registration guide | The ladder: ① Account ✓ done · ② Civic-DID — unlocks Grid participation (chat, spawn, vote, trade); **LIVE since later the same day** — links to `/apply/genesis` (human application pipeline) · ③ Meanwhile: browse as visitor (map, library, polis — read-only) | none |
| 3 World tour | Existing StepWorldTour, unchanged (static district narration) | none |
| 4 Next step | Buttons: **Enter the portal →** (goal `'Exploring Noēsis'` → `/portal`) · **Register for a Civic-DID →** (goal `'Registering for Civic-DID'` → `/apply/genesis`) · **Talk to a Nous →** (goal `'Meeting the Nous'` → `/portal/chat`) | PATCH goal |

**Quick start:** a persistent "Skip the guide — browse as visitor →" link under the card on
steps 1–3. It PATCHes the default goal `'Exploring Noēsis'` (the existing fallback constant)
and routes to `/portal`. Registration is encouraged, never forced: D-V3-33 gates Grid
*participation*, not Portal *reading* (three-tier visitor model, D-36-16).

**Sophia chat:** removed from the required path. Optional chat lives at `/portal/chat`
(its own components — the onboard chat components become orphans and are deleted:
StepSophiaChat, SophiaBubble, UserBubble, ChatInput, ContinueButton under `onboard/`).
The LLM backend fix (Ollama unreachable on the dev server) is tracked separately; it now
only affects the optional chat surface, not first login.

## Error handling

- Goal PATCH stays non-blocking (log + proceed), matching D-08.
- No other network calls exist in the wizard, so no new failure modes.

## Testing

- No existing tests cover the wizard (verified). Manual verification in preview: step
  navigation, skip from each step, both step-4 actions, indicator shows 4 dots.
