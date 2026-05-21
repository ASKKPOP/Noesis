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
result: [pending]

### 2. /system Allowlist Monitor green state + 45-row reference table
expected: Green "No drift detected. All runtime emissions are allowlisted." panel, 45-row static reference table with Position/Event Type/Producer columns
result: [pending]

### 3. /nous/[id] Cognitive Inspector — live Brain fetch
expected: H3-gated fetch succeeds, 5 named drive bars (HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS), top-K skill titles populated, no plaintext fields anywhere
result: passed (2026-05-21, post 25a-07 gap closure — headers verified in DevTools, 5 drive bars non-zero, negative-path body-only fetch returns 401)
note: requires BRAIN_HTTP_SECRET exported in both Brain runtime and Grid env (generate: `openssl rand -hex 32`)

### 4. /nous/[id] Brain Health 2x2 grid live data
expected: p50/p95 tick latency numbers visible (or 'Tick metrics unavailable.' fallback), audit aggregation counts populated
result: passed (2026-05-21, regression-checked alongside item #3 after 25a-07)

### 5. /users → /humans/[did] deep-link + invalid DID inline 404
expected: Deep-link from /users works, 3 tabs render (Profile/History/Nous), invalid DID shows inline "Human not found." without redirect
result: [pending]

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
