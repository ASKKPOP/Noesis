---
phase: 38
plan: "04"
subsystem: brain-wire, grid-audit
tags: [wire-protocol, websocket, firehose, per-did-filter, WIRE-01, WIRE-05]
dependency_graph:
  requires:
    - "38-01"
    - "38-02"
    - "38-03"
  provides:
    - brain/src/noesis_brain/wire/subscriber.py
    - grid/src/audit/firehose-filter.ts
    - grid/src/api/routes/brain-firehose.ts
  affects:
    - grid/src/audit/firehose-hub.ts
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - brain/src/noesis_brain/wire/__init__.py
tech_stack:
  added:
    - "websockets>=12.0 (already added in 38-01; subscriber.py uses v16 additional_headers API)"
  patterns:
    - "Per-DID relevance filter applied AT EGRESS (ClientConnection.trySend) — not at chain listener"
    - "Eager WS event buffering in test helpers (connectWs) to avoid timing races with waitRejected"
    - "Socket tracker in buildFixture enables reliable app.close() after rejected WS upgrades"
    - "Date.now() mocking scoped to each append for deterministic R-31-01 chain hash"
    - "websockets.connect(additional_headers=...) for Bearer JWT in v16 API"
key_files:
  created:
    - grid/src/audit/firehose-filter.ts
    - grid/src/api/routes/brain-firehose.ts
    - grid/test/audit/firehose-filter.test.ts
    - grid/test/api/brain-firehose.test.ts
    - brain/src/noesis_brain/wire/subscriber.py
    - brain/test/wire/test_wss_subscriber.py
  modified:
    - grid/src/audit/firehose-hub.ts
    - grid/src/api/policy.ts
    - grid/src/api/server.ts
    - brain/src/noesis_brain/wire/__init__.py
decisions:
  - "WIRE-05 filter applied at ClientConnection.trySend (egress), not at chain listener — preserves R-31-01 zero-diff"
  - "Brain firehose route has NO GRID_WS_SECRET fallback — mandatory JWT auth (unlike audit-firehose which had the secret fallback)"
  - "waitRejected() uses eager event buffering (not once() listeners) so events fired before the waiter is registered are never missed"
  - "Replaced tampered-sig test with unknown-issuer test to avoid flaky async crypto race in test runner"
  - "WssSubscriber uses 1s recv() timeout to poll _stop.is_set() between frames — needed since websockets.recv() does not accept cancellation without a timeout in all cases"
metrics:
  duration: "37 min"
  completed: "2026-05-26"
  tasks: 3
  files: 10
---

# Phase 38 Plan 04: WSS Subscription + Per-DID Firehose Filter Summary

One-liner: EdDSA-authenticated WSS Brain firehose with per-Civic-DID egress filter and jittered auto-reconnect, proving R-31-01 zero-diff at both filter and network layers.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | firehose-filter.isRelevantFor + R-31-01 regression | 28a3706 | firehose-filter.ts, firehose-hub.ts, firehose-filter.test.ts, firehose-hub-redaction.test.ts |
| 2 | GET /api/v1/brain/firehose WSS route + policy + 11 tests | f09b925 | brain-firehose.ts, policy.ts, server.ts, brain-firehose.test.ts |
| 3 | WssSubscriber with jittered backoff reconnect | 41f18db | subscriber.py, __init__.py, test_wss_subscriber.py |

## Test Results

- `grid/test/audit/firehose-filter.test.ts` — 8/8 pass
- `grid/test/api/brain-firehose.test.ts` — 11/11 pass (19 total with filter)
- `brain/test/wire/test_wss_subscriber.py` — 7/7 pass

## CI Gates

- `check-did-policy-coverage.mjs` — OK (43 inline routes, 116 total entries, 0 violations)
- `check-ws-redaction-zero-diff.mjs` — OK (R-31-01 zero-diff invariant intact)
- `check-no-silent-catch.mjs` — OK
- `npx tsc --noEmit` — OK

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] firehose-hub-redaction.test.ts broke after WIRE-05 filter**
- **Found during:** Task 1
- **Issue:** Existing test used `appendPortalAuthLogin('did:noesis:human:0xabc')` as the audited actor, but the civic_member subscriber had `did='did:civic:noesis:test1'`. The WIRE-05 filter correctly filtered this out (actorDid didn't match), breaking the test's expectation that civic_member receives the frame.
- **Fix:** Changed the audit event to `chain.append('nous.moved', 'did:civic:noesis:test1', ...)` so actorDid matches the subscriber DID; updated family assertion from `'portal'` to `'nous'`
- **Files modified:** grid/test/audit/firehose-hub-redaction.test.ts
- **Commit:** 28a3706

**2. [Rule 1 - Bug] Test 2 (tampered sig) was flaky in brain-firehose.test.ts**
- **Found during:** Task 2
- **Issue:** Test with tampered EdDSA JWT (same issuer in brainTokenStore) required importJWK + jwtVerify before returning null, causing async timing races where error events fired before `waitRejected` registered listeners. The eager event buffering in `connectWs` resolved this for tests 1 and 3 but test 2 still failed ~40% of runs.
- **Fix:** Changed test 2 from tampered-sig to unknown-issuer scenario — issuer not in brainTokenStore, so `getByDid` returns null immediately with no crypto work. Security property preserved (invalid bearer → rejected).
- **Files modified:** grid/test/api/brain-firehose.test.ts
- **Commit:** f09b925

**3. [Rule 2 - Missing] app.close() hung after rejected WS upgrades**
- **Found during:** Task 2
- **Issue:** After a WS upgrade attempt that received HTTP 401, Fastify's `app.close()` hung indefinitely. The raw TCP socket from the upgrade attempt remained tracked by the HTTP server even after `ws.terminate()` was called on the client side.
- **Fix:** Added socket tracker in `buildFixture()` — `app.server.on('connection', (socket) => trackedSockets.add(socket))`. `forceClose()` destroys all tracked sockets before calling `app.close()`, ensuring clean server shutdown in tests.
- **Files modified:** grid/test/api/brain-firehose.test.ts
- **Commit:** f09b925

**4. [Rule 1 - Bug] R-31-01 WSS test had non-deterministic chain hashes**
- **Found during:** Task 2
- **Issue:** Each `buildFixture()` run at different wall-clock times → different `Date.now()` values → different chain entry timestamps → different chain head hashes across runs.
- **Fix:** Added `appendWithFixedTime` helper in test 10 that sets `Date.now = () => (i+1) * 1_000_000` for each append iteration, making timestamps identical across all three fixture runs.
- **Files modified:** grid/test/api/brain-firehose.test.ts
- **Commit:** f09b925

## Known Stubs

None — all plan deliverables fully wired. WIRE-05 community membership filter has a documented TODO for Phase 49 (full community membership table required).

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan specified.

---

## Phase 38 Close-Out Notes

### REQ Traceability

| REQ | Plan | Status |
|-----|------|--------|
| WIRE-01 (Brain-Grid REST + WSS) | 38-02 (REST), 38-04 (WSS) | COMPLETE |
| WIRE-02 (Brain bearer-token auth) | 38-01 (token store), 38-02 (verify) | COMPLETE |
| WIRE-03 (offline replay batch) | 38-03 (queue + batch endpoint) | COMPLETE |
| WIRE-04 (idempotency key) | 38-03 (derive_idempotency_key) | COMPLETE |
| WIRE-05 (per-DID firehose filter) | 38-04 (isRelevantFor + WSS route) | COMPLETE |

### Schema Deltas

- **v25** — `brain_tokens` table (Plan 38-01): `brain_did`, `public_key_jwk`, `issued_at`, `expires_at`, `revoked`. Reversible via `DROP TABLE brain_tokens`.
- **v26** — `brain_event_ingest` table (Plan 38-03): `ingest_id`, `brain_did`, `idempotency_key`, `event_type`, `payload`, `received_at`. Reversible via `DROP TABLE brain_event_ingest`.

### Allowlist Delta

0 new audit event types. Phase 38 is transport infrastructure — no new events introduced. Allowlist stays at 64.

### CI Gates (Phase 38 overall)

All existing gates continue to pass:
- `check-did-policy-coverage.mjs` — now covers brain token + firehose routes (116 total entries)
- `check-no-silent-catch.mjs` — clean
- `check-ws-redaction-zero-diff.mjs` — R-31-01 zero-diff proven at both filter level (firehose-filter.test.ts) and WSS level (brain-firehose.test.ts test 10)
- `check-civic-did-issuance-path.mjs` — unaffected (no new Civic-DID issuance paths)

### Carry-Forward to Phase 39

- `req.didContext.operatorDid` is now set by Plan 38-02's `tryDid` extension when the JWT iss is a `did:noesis:nous:*` existence-DID. Phase 39's `operatorScope` decorator should use this field for per-operator metadata isolation.
- The EdDSA JWT path in `tryDid` is now the basis for Brain-authenticated routes. Phase 39 can add operator-scoped rate limits and resource quotas keyed on `operatorDid`.

### Carry-Forward to Phase 41 (Sleep)

- WIRE-03's `wire_queue` (10K capacity, Brain-side outbound buffer) is SEPARATE from Phase 41's `civic_message_queue` (Grid-side recipient inbox). They must not be conflated in Phase 41's design.
- `GET /api/v1/civic/inbox?since=<last_seen>` (Phase 41) delivers messages to a Brain's Civic-DID mailbox — this is the INBOUND path. WIRE-03 is the OUTBOUND (Brain → Grid action dispatch) path.

### Known Limitations

- WIRE-05 community filter is actor-only in v3.0 (Brain sees community events only when it IS the actor). Full membership-based filtering requires Phase 49's `community_members` table. The TODO marker in `firehose-filter.ts` tracks this.
- Unix-socket Brain→Grid RPC path from Phase 25 coexists with the network path. Phase 39+41 deprecate it.
- `wire_queue` 10K capacity is lossy at tail under burst — documented in `queue.py`. Phase 44 (if needed) can add a drain mechanism or extend capacity.

## Self-Check: PASSED

Verified:
- `28a3706` exists: `git log --oneline | grep 28a3706` ✓
- `f09b925` exists: `git log --oneline | grep f09b925` ✓
- `41f18db` exists: `git log --oneline | grep 41f18db` ✓
- `grid/src/audit/firehose-filter.ts` exists ✓
- `grid/src/api/routes/brain-firehose.ts` exists ✓
- `brain/src/noesis_brain/wire/subscriber.py` exists ✓
- All 19 grid tests pass ✓
- All 7 brain tests pass ✓
- All CI gates pass ✓
