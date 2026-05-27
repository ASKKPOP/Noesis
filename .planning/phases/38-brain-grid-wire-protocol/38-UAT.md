---
status: complete
phase: 38-brain-grid-wire-protocol
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md, 38-04-SUMMARY.md]
started: "2026-05-26T00:00:00.000Z"
updated: "2026-05-26T00:00:00.000Z"
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running Brain/Grid services. Run Grid DB migrations (v25 brain_tokens + v26 brain_event_ingest apply cleanly with no errors). Start Grid server from scratch — it boots without errors and the health endpoint returns live data. Start Brain from scratch (with GRID_URL env var set to a valid https:// URL) — it initialises without crashing, TokenManager generates a JWT, and no startup error is logged.
result: pass

### 2. TLS Enforcement
expected: Set GRID_URL to `http://localhost:3000` (plaintext, not https). Launch Brain. Brain should refuse to start and print a clear ValueError containing "GRID_URL must use https or wss scheme". Changing to `https://` allows normal startup.
result: pass

### 3. Brain Token Registration
expected: POST /api/v1/brain/token/register with correct Ed25519-signed body returns 200 {ok:true}. Revoke via government session returns 200 {ok:true, revoked:true}. Re-register with fresh key clears revocation (upsert).
result: pass

### 4. Action Dispatch via REST
expected: Brain posts {tick, actions:[]} to POST /api/v1/brain/actions with valid Bearer JWT → {ok:true, accepted:1}. Without JWT → 401. Batch of 501 items → 413.
result: pass

### 5. Offline Queue + Batch Replay (Dry-Run)
expected: `node scripts/uat-wire-disconnect.mjs --dry-run` exits 0 and prints 4-step offline-queue procedure. No network calls in dry-run mode.
result: pass

### 6. WSS Firehose Connection
expected: Brain with valid EdDSA JWT connects to GET /api/v1/brain/firehose — 101 Switching Protocols + hello frame. Without JWT → 401 before upgrade. WssSubscriber auto-reconnects with jittered backoff on drop.
result: pass

### 7. Per-DID Event Filter (WIRE-05)
expected: Subscriber A receives its own nous.* events; subscriber B does NOT receive subscriber A's events. Public events (tick) delivered to both. R-31-01: chain head hash byte-identical regardless of subscriber count.
result: pass

### 8. Full Automated Test Suite
expected: `npx vitest run` passes all tests including brain-token (8), brain-wire (8), brain-wire-batch (8), brain-firehose (11), firehose-filter (8). `python -m pytest test/ -q` passes all Brain tests including test_token_manager (5), test_grid_wire_client, test_grid_wire_client_offline (6), test_wire_queue (7), test_wss_subscriber (7). `npx tsc --noEmit` clean.
result: pass

### 9. CI Gates
expected: check-did-policy-coverage.mjs (116 entries, 0 violations), check-ws-redaction-zero-diff.mjs (R-31-01 intact), check-no-silent-catch.mjs (clean), check-civic-did-issuance-path.mjs (unaffected) — all exit 0.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
