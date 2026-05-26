---
phase: 38
name: Brain ↔ Grid Wire Protocol
created: 2026-05-26
status: pre-execution
---

# Phase 38 Validation Strategy

## Test Frameworks

| Side | Framework | Config | Quick Run |
|------|-----------|--------|-----------|
| Grid | Vitest | `grid/vitest.config.ts` | `cd grid && npx vitest run test/api/` |
| Brain | pytest | `brain/pyproject.toml [tool.pytest.ini_options]` | `cd brain && python -m pytest test/ -x -q` |
| Grid full | Vitest | — | `cd grid && npx vitest run` |
| Brain full | pytest | — | `cd brain && python -m pytest test/ -q` |

## Requirements → Test Map

| Req ID | Behavior Under Test | Type | Automated Command | Test File | Status |
|--------|---------------------|------|-------------------|-----------|--------|
| WIRE-01 (TLS) | `validate_grid_url("http://...")` raises `ValueError` | unit (Brain) | `pytest test/wire/test_grid_wire_client.py::test_plaintext_rejected -x` | `brain/test/wire/test_grid_wire_client.py` | ❌ pre-execution |
| WIRE-01 (REST) | `POST /api/v1/brain/actions` with valid EdDSA bearer → 200 + actions dispatched | integration (Grid) | `npx vitest run test/api/brain-wire.test.ts` | `grid/test/api/brain-wire.test.ts` | ❌ pre-execution |
| WIRE-01 (WSS) | WSS upgrade with valid EdDSA bearer → 101 + hello frame | integration (Grid) | `npx vitest run test/api/brain-firehose.test.ts` | `grid/test/api/brain-firehose.test.ts` | ❌ pre-execution |
| WIRE-02 (token) | Brain generates EdDSA JWT, registers public key with Grid, Grid verifies via `importJWK` + `jwtVerify` | unit (Grid + Brain) | `npx vitest run test/api/brain-token.test.ts && pytest test/wire/test_token_manager.py -x` | `grid/test/api/brain-token.test.ts`, `brain/test/wire/test_token_manager.py` | ❌ pre-execution |
| WIRE-02 (rotation) | Token revoked via `POST /api/v1/brain/token/revoke` → subsequent requests get `401 token_revoked` | integration (Grid) | `npx vitest run test/api/brain-token.test.ts` (revocation suite) | `grid/test/api/brain-token.test.ts` | ❌ pre-execution |
| WIRE-02 (proactive rotate) | `TokenManager` rotates token when `time_until_expiry < ROTATE_BEFORE_EXPIRY_SECONDS (3600)` | unit (Brain) | `pytest test/wire/test_token_manager.py::test_proactive_rotation -x` | `brain/test/wire/test_token_manager.py` | ❌ pre-execution |
| WIRE-03 (queue) | Brain buffers up to 10K events when `post_actions()` raises; oldest evicted when full | unit (Brain) | `pytest test/wire/test_wire_queue.py::test_overflow_eviction -x` | `brain/test/wire/test_wire_queue.py` | ❌ pre-execution |
| WIRE-03 (replay) | On reconnect, `WireQueue.dequeue_batch()` replays events via batch endpoint | integration (Brain) | `pytest test/wire/test_grid_wire_client.py::test_offline_replay -x` | `brain/test/wire/test_grid_wire_client.py` | ❌ pre-execution |
| WIRE-03 (UAT) | 60s network sever → ≤10K queued → reconnect → Grid stores each event exactly once | manual / UAT | `node scripts/uat-wire-disconnect.mjs` | `scripts/uat-wire-disconnect.mjs` | ❌ pre-execution |
| WIRE-04 (dedup) | Same idempotency key submitted twice in batch → `{accepted:1, duplicate:1}` | unit (Grid) | `npx vitest run test/api/brain-wire-batch.test.ts::test_duplicate_idempotency_key` | `grid/test/api/brain-wire-batch.test.ts` | ❌ pre-execution |
| WIRE-04 (formula) | `sha256("did:noesis:nous:abc:1:nous.tick_started:deadbeef...")` matches expected hex | unit (Brain) | `pytest test/wire/test_wire_queue.py::test_idempotency_key_formula -x` | `brain/test/wire/test_wire_queue.py` | ❌ pre-execution |
| WIRE-05 (filter) | Subscriber DID A does NOT receive DID B's private `nous.*` events | unit (Grid) | `npx vitest run test/audit/firehose-filter.test.ts` | `grid/test/audit/firehose-filter.test.ts` | ❌ pre-execution |
| WIRE-05 (own echo) | Subscriber DID A DOES receive its own `nous.*` audit echoes | unit (Grid) | `npx vitest run test/audit/firehose-filter.test.ts` | `grid/test/audit/firehose-filter.test.ts` | ❌ pre-execution |
| R-31-01 (parity) | Actions via `/brain/actions` produce byte-identical chain head hash as in-process Unix socket path | regression (Grid) | `npx vitest run test/api/brain-wire.test.ts::test_chain_hash_parity` | `grid/test/api/brain-wire.test.ts` | ❌ pre-execution |
| R-31-01 (batch) | Actions via `/brain/events/batch` produce same chain head hash as live path | regression (Grid) | `npx vitest run test/api/brain-wire-batch.test.ts::test_chain_hash_parity` | `grid/test/api/brain-wire-batch.test.ts` | ❌ pre-execution |
| R-31-01 (fanout) | Chain head hash is byte-identical with 0, 1, or 3 simultaneous WSS subscribers | regression (Grid) | `npx vitest run test/audit/firehose-filter.test.ts::test_chain_hash_unaffected_by_subscribers` | `grid/test/audit/firehose-filter.test.ts` | ❌ pre-execution |

## Wave 0 Test Stubs to Create

Before writing source code (or alongside Wave 1 task 0), create these failing test stubs:

### Brain (`brain/test/wire/`)
- [ ] `test_token_manager.py` — covers WIRE-02 token creation, 24h expiry, proactive rotation
- [ ] `test_grid_wire_client.py` — covers WIRE-01 TLS rejection, `post_actions()`, offline buffering
- [ ] `test_wire_queue.py` — covers WIRE-03 queue overflow/eviction, WIRE-04 idempotency key formula

### Grid (`grid/test/`)
- [ ] `test/api/brain-token.test.ts` — covers WIRE-02 token store, revocation, 401 on revoked token
- [ ] `test/api/brain-wire.test.ts` — covers WIRE-01 REST, WIRE-02 bearer verify, R-31-01 chain parity
- [ ] `test/api/brain-wire-batch.test.ts` — covers WIRE-03 batch endpoint, WIRE-04 dedup
- [ ] `test/audit/firehose-filter.test.ts` — covers WIRE-05 per-DID filter, R-31-01 fanout parity

### UAT
- [ ] `scripts/uat-wire-disconnect.mjs` — network disconnect simulation (created in 38-03)

## Critical Invariants

| Invariant | Enforcement | Test |
|-----------|-------------|------|
| R-31-01 zero-diff | `PersistentAuditChain.append()` called only via sole-producer functions — Brain never writes to `audit_trail` directly | chain hash parity tests in brain-wire.test.ts |
| ROUTE_DID_POLICY coverage | All `/api/v1/brain/*` routes in `policy.ts`; CI gate `check-did-policy-coverage.mjs` | CI gate (existing) |
| Allowlist frozen | 0 new event types — no new `appendXxx` sole-producer functions | broadcast-allowlist test size 64 unchanged |
| TLS enforcement | Brain raises `ValueError` at config-load if `GRID_URL` is not `https://` | `test_plaintext_rejected` unit test |
| Idempotency formula | `sha256(f"{brain_did}:{tick}:{event_type}:{payload_hash}")` — canonical, colon-separated | `test_idempotency_key_formula` unit test |
