---
status: partial
phase: 25a-observer-surfaces
source: [25a-VERIFICATION.md]
started: 2026-05-21
updated: 2026-05-21
---

## Current Test

[awaiting human testing]

## Tests

### 1. /firehose live WebSocket + hover-pause
expected: 1-line color-coded event rows, connection status pill cycling through Connecting/Connected/Disconnected, hover pauses scroll and Paused indicator appears
result: passed-partial (2026-05-21, automated browser drive — page loads, sidebar nav highlights Firehose, "Connected" green pill renders, "Paused — hover to resume" indicator wired in DOM; color-coded event rows NOT exercised because Grid was idle (0 events). To complete: drive Nous activity (e.g. /gsd-do or wait for Sophia/Hermes/Themis tick events) then re-check row rendering.)

### 2. /system Allowlist Monitor green state + 45-row reference table
expected: Green "No drift detected. All runtime emissions are allowlisted." panel, 45-row static reference table with Position/Event Type/Producer columns
result: passed (2026-05-21, automated browser drive — drift panel green: "No drift detected. All runtime emissions are allowlisted." · Allowlisted Events table renders exactly 45 numbered rows · #/Event Type/Producer File columns present)

### 3. /nous/[id] Cognitive Inspector — live Brain fetch
expected: H3-gated fetch succeeds, 5 named drive bars (HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS), top-K skill titles populated, no plaintext fields anywhere
result: passed (2026-05-21, post 25a-07 gap closure — headers verified in DevTools, 5 drive bars non-zero, negative-path body-only fetch returns 401)
note: requires BRAIN_HTTP_SECRET exported in both Brain runtime and Grid env (generate: `openssl rand -hex 32`)

### 4. /nous/[id] Brain Health 2x2 grid live data
expected: p50/p95 tick latency numbers visible (or 'Tick metrics unavailable.' fallback), audit aggregation counts populated
result: passed (2026-05-21, regression-checked alongside item #3 after 25a-07)

### 5. /users → /humans/[did] deep-link + invalid DID inline 404
expected: Deep-link from /users works, 3 tabs render (Profile/History/Nous), invalid DID shows inline "Human not found." without redirect
result: passed-partial (2026-05-21, automated browser drive — well-formed unknown DID `did:noesis:human:0x000...001` renders inline "Human not found." with "Steward · Users · Not Found" breadcrumb and "← Back to Users" link, no redirect ✅ · malformed DID `not-a-did` ALSO renders inline "Human not found." after 400-handling fix ✅ · 3 tabs (Profile/History/Nous) render on the profile path · /users deep-link CLICK NOT exercised because no humans have registered (0 unique DIDs); href wiring confirmed earlier in VERIFICATION.md item 18.)
fix: `steward/src/app/humans/[did]/page.tsx:137` now treats Grid API 400 (invalid_did) as not-found in addition to 404 (unknown_human). Grid container + Steward container both running on the fixed image.

## Summary

total: 5
passed: 3
passed_partial: 2
issues: 0
pending: 0
skipped: 0
blocked: 0
notes: |
  Items #1 and #5 pass on their main path but have data-dependent secondary
  checks that could only be fully exercised with live Grid activity / registered
  humans (none present at UAT time). The minor 400-handling gap surfaced during
  #5 has been patched (steward/src/app/humans/[did]/page.tsx:137 now treats
  Grid API 400 as not-found in addition to 404).

## Gaps
