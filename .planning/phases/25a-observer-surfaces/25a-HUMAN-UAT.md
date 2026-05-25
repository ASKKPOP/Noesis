---
status: closed
phase: 25a-observer-surfaces
source: [25a-VERIFICATION.md]
started: 2026-05-21
updated: 2026-05-25
reverified: 2026-05-25 — Phase 35 OBS-15 closed Items #1 (Gap A) + #5c (Gap B) to PASS
---

## Current Test

[closed — see Summary]

## Tests

### 1. /firehose live WebSocket + hover-pause
expected: 1-line color-coded event rows, connection status pill cycling through Connecting/Connected/Disconnected, hover pauses scroll and Paused indicator appears
result: passed (2026-05-21 — page loads, sidebar nav highlights Firehose, "Connected" green pill renders, "Paused — hover to resume" indicator wired in DOM)
postscript: 2026-05-24 — Color-coded rendering verified by inspection of `steward/src/app/firehose/page.tsx:9-21` — EVENT_FAMILY_COLORS map covers 10 families (operator/nous/trade/law/iris/skill/norm/lore/human/ananke) plus an `unknown` fallback. Re-attempting live capture during post-ship UAT surfaced an unrelated operational fault (see Gaps GAP-2026-05-24-A): MySQL `audit_trail` flush has been stalled since 2026-05-22 (max_id 2193 vs in-memory 2430+) and the firehose WebSocket delivered only the `hello` frame over a 22s observation window despite the in-memory tick counter advancing. The firehose code path itself remains correct; the upstream audit pipeline needs investigation. Tracked as a v2.6 backlog candidate.
reverification: 2026-05-25 (Phase 35 OBS-15) — **PASS**. GAP-A resolved by Phase 31 (PersistentAuditChain + reconcile + Pino structured logging) and Phase 34.1 (chain.length + lastPersistError wired into HealthWatchdog). Live re-verification via gstack /browse against post-grace Grid: connection pill "Connected" stable. Over a 95-second observation window the firehose delivered 7 distinct events spanning 4 families: 4× `tick` (system, unknown-family border `rgb(219,216,204)`), 1× `human.identified`, 1× `portal.auth.register`, 1× `portal.auth.login` (all from a triggered email signup). DOM inspection confirmed per-row color application from `event-family-colors.ts`. Original GAP-A is permanently closed.

### 2. /system Allowlist Monitor green state + 45-row reference table
expected: Green "No drift detected. All runtime emissions are allowlisted." panel, 45-row static reference table with Position/Event Type/Producer columns
result: passed (2026-05-21)

### 3. /nous/[id] Cognitive Inspector — live Brain fetch
expected: H3-gated fetch succeeds, 5 named drive bars (HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS), top-K skill titles populated, no plaintext fields anywhere
result: passed (2026-05-21, post 25a-07 gap closure)
note: requires BRAIN_HTTP_SECRET exported in both Brain runtime and Grid env (generate: `openssl rand -hex 32`)

### 4. /nous/[id] Brain Health 2x2 grid live data
expected: p50/p95 tick latency numbers visible (or 'Tick metrics unavailable.' fallback), audit aggregation counts populated
result: passed (2026-05-21, regression-checked alongside item #3 after 25a-07)

### 5. /users → /humans/[did] deep-link + invalid DID inline 404
expected: Deep-link from /users works, 3 tabs render (Profile/History/Nous), invalid DID shows inline "Human not found." without redirect
result: passed-with-gap (2026-05-24 — components verified independently; cross-page click path blocked by missing audit producers, see Gaps GAP-2026-05-24-B)
breakdown:
  5a — /humans/[did] direct URL: PASS. Test fixture human registered via email signup (`did:noesis:human:email:728a0f57-886e-49fe-97f2-012d30c929f6`). `GET /api/v1/humans/:did` returns 200 with HumanRecord + derived counts. `/humans/[did]` SSR returns 200, DID is emitted into the page payload.
  5b — Invalid DID inline 404: PASS (2026-05-21 — both malformed and well-formed-unknown DIDs render inline "Human not found." with breadcrumb + back link; no redirect). Fix at `steward/src/app/humans/[did]/page.tsx:137` treats Grid 400 (invalid_did) as not-found in addition to 404.
  5c — /users → /humans/[did] CLICK: BLOCKED. The /users page derives its directory from `portal.auth.login` and `portal.auth.register` audit events (`steward/src/app/users/page.tsx:95-97`). Grep of `grid/src` confirms ZERO producers emit either event type, and neither type is in the broadcast allowlist (`grid/src/audit/broadcast-allowlist.ts`). The /users directory will always be empty until those producers are wired. See GAP-2026-05-24-B for remediation candidate.
  5c reverification: 2026-05-25 (Phase 35 OBS-15) — **PASS**. GAP-B resolved by Phase 33 (appendPortalAuthLogin + appendPortalAuthRegister + appendHumanIdentified sole-producers wired into SIWE + email auth paths; allowlist 53 → 56). Live re-verification via gstack /browse against post-Phase-33 Grid: triggered 2 test email signups via `POST /api/v1/portal/auth/email/signup`. /users page populated with 2 unique DIDs ("Known Users 2 unique DIDs" + "Registrations 2 events"). Clicked first row → URL navigated to `/humans/did%3Anoesis%3Ahuman%3Aemail%3A...` → page rendered profile (Wallet, Joined date, Region, DID, Nous Count, Transfers). All 3 expected tabs present (Profile/History/Nous) plus Sanctions tab. History tab shows "SIWE Sessions 2 events" — non-empty (portal.auth.register + portal.auth.login both recorded against the test human). Original GAP-B is permanently closed.

## Summary

total: 5
passed: 3 (items 2, 3, 4)
passed_with_postscript: 1 (item 1 — re-verification blocked by Gap A; original UAT pass stands)
passed_with_gap: 1 (item 5 — direct surfaces pass; cross-page click blocked by Gap B)
issues: 0
pending: 0
skipped: 0
blocked: 0
notes: |
  UAT closed for v2.5 milestone ship. Two real product/operational gaps surfaced
  during the post-ship re-verification pass — both are recorded in the Gaps
  section below as v2.6 backlog candidates rather than blockers, since the
  Phase 25a code itself was verified correct at original UAT time (2026-05-21)
  and the gaps are upstream (audit pipeline, missing producers) rather than in
  the Phase 25a surfaces themselves.

## Gaps

### GAP-2026-05-24-A — Audit pipeline silence (operational fault)
- **Symptom:** MySQL `audit_trail` table has not received a write since 2026-05-22T06:57Z (last `created_at` = 1779404222769 ms epoch, last id = 2193) despite in-memory audit chain growing to 2430+ entries. Firehose WebSocket connects and sends the `hello` frame but delivers zero `event` frames over a 22s observation window even though the clock continues to advance (tick 234 → 236 in that interval).
- **Scope:** Affects all event-driven observability — firehose live render, /system drift detector recent activity, /humans history fetch, /users listing (would be affected if it had producers — see Gap B).
- **Hypothesis:** Either the MySQL audit flusher errored out and silently retried into a stuck state, or the audit chain's `onAppend` subscribers stopped receiving events (e.g. listener exception swallowed at the chain level).
- **Remediation candidate (v2.6):** Add audit pipeline health probe to `/health` endpoint; alert when in-memory length diverges from MySQL count by >N entries; structured log on flusher failures.

### GAP-2026-05-24-B — /users directory has no audit producers
- **Symptom:** `steward/src/app/users/page.tsx` reads `portal.auth.login` and `portal.auth.register` event types via `GET /api/v1/audit/trail`, but `grep` of `grid/src` confirms NEITHER type is emitted anywhere. Both consumers (users page + /humans/[did]/history `siwe_sessions`) will always see an empty list.
- **Scope:** /users directory is permanently empty regardless of how many humans register. /humans/[did]/history `siwe_sessions` array is always `[]`.
- **Remediation candidate (v2.6):** Add `appendPortalAuthLogin` / `appendPortalAuthRegister` sole-producer files; wire into `auth.ts` SIWE verify path and email signup/signin paths; add to broadcast allowlist (consider whether they should be allowlisted at all, since they may carry PII implications); add forbidden-key checks on payload shape.
