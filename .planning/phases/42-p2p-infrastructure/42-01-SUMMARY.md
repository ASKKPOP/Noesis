---
phase: 42
plan: "01"
subsystem: p2p-infrastructure
tags: [tdd, wave-0, test-scaffolding, p2p, webrtc, pynacl]
dependency_graph:
  requires: []
  provides:
    - grid/test/p2p/ (6 new test files, all Wave-0 stubs)
    - grid/test/registry/vc-builder-public-key.test.ts
    - grid/test/audit/broadcast-allowlist.test.ts (Phase 42 describe.skip block)
    - brain/test/wire/test_p2p.py
    - brain/test/wire/test_p2p_crypto.py
  affects:
    - Plans 42-02 through 42-05 (each turns stubs from red → green)
tech_stack:
  added: []
  patterns:
    - "it.skip / describe.skip wave-0 TDD scaffolding"
    - "pytest.mark.skip with reason string for Python tests"
    - "PyNaCl SealedBox Ed25519→X25519 conversion sanity test"
key_files:
  created:
    - grid/test/p2p/p2p-peer-store.test.ts
    - grid/test/p2p/sdp-inbox-store.test.ts
    - grid/test/p2p/turn-credentials.test.ts
    - grid/test/p2p/p2p-producer-boundary.test.ts
    - grid/test/p2p/p2p-routes.test.ts
    - grid/test/p2p/firehose-push-signal.test.ts
    - grid/test/registry/vc-builder-public-key.test.ts
    - brain/test/wire/test_p2p.py
    - brain/test/wire/test_p2p_crypto.py
  modified:
    - grid/test/audit/broadcast-allowlist.test.ts
decisions:
  - "Allowlist count locked at 64 in Wave 0; Phase 42 Plan 03 will flip to 67 atomically"
  - "p2p.signal_received explicitly NOT in allowlist (D-42-06); asserted in both firehose and allowlist tests"
  - "PyNaCl nacl.public.SealedBox imports at module top (pynacl>=1.6.2 already in pyproject.toml)"
  - "No aiortc module-level imports in brain tests (not yet in pyproject.toml)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-27"
  tasks_completed: 2
  files_created: 9
  files_modified: 1
---

# Phase 42 Plan 01: Wave-0 Test Scaffolding Summary

Wave-0 TDD scaffold for Phase 42 P2P Infrastructure: 8 Grid test files (6 new p2p + 1 new registry + 1 edited allowlist) and 2 Brain pytest files establishing all behavioral contracts as `.skip` / `@pytest.mark.skip` stubs.

## Files Created / Modified

### Grid (8 files)

| File | Tests | Status |
|------|-------|--------|
| `grid/test/p2p/p2p-peer-store.test.ts` | 6 it.skip | NEW |
| `grid/test/p2p/sdp-inbox-store.test.ts` | 5 it.skip | NEW |
| `grid/test/p2p/turn-credentials.test.ts` | 7 it.skip | NEW |
| `grid/test/p2p/p2p-producer-boundary.test.ts` | 1 describe.skip + 24 it.skip | NEW |
| `grid/test/p2p/p2p-routes.test.ts` | 16 it.skip (5 routes) | NEW |
| `grid/test/p2p/firehose-push-signal.test.ts` | 5 it.skip | NEW |
| `grid/test/registry/vc-builder-public-key.test.ts` | 4 it.skip | NEW |
| `grid/test/audit/broadcast-allowlist.test.ts` | +1 describe.skip (5 it inside) | EDITED |

**Total Grid skip count in p2p/ directory: 64 (well above ≥30 requirement)**

### Brain (2 files)

| File | Tests | Status |
|------|-------|--------|
| `brain/test/wire/test_p2p.py` | 11 @pytest.mark.skip | NEW |
| `brain/test/wire/test_p2p_crypto.py` | 7 @pytest.mark.skip + 1 PASSING | NEW |

## Key Invariants Locked

### Allowlist count at 64 (transition to 67 owned by Plan 03)

The existing `grid/test/audit/broadcast-allowlist.test.ts` still asserts:
```
expect(ALLOWLIST.size).toBe(64);
expect(ALLOWLIST_MEMBERS.length).toBe(64);
```
These are **untouched**. The new `describe.skip('ALLOWLIST_MEMBERS Phase 42 ...)` block with `.toBe(67)` assertions is skipped — Plan 03 will unskip them when it adds the 3 P2P events to the allowlist.

### p2p.signal_received NOT in allowlist (D-42-06)

Asserted in two places:
- `firehose-push-signal.test.ts`: "frame type 'p2p.signal_received' is NOT broadcast to allowlist subscribers"
- `broadcast-allowlist.test.ts` (Phase 42 describe.skip block): `expect(ALLOWLIST_MEMBERS).not.toContain('p2p.signal_received')`

### PyNaCl crypto stack confirmed ready

`test_pynacl_sealedbox_roundtrip_sanity` PASSES (non-skipped):
- Generates Ed25519 SigningKey
- Converts to X25519 via `verify_key.to_curve25519_public_key()` and `signing_key.to_curve25519_private_key()`
- Encrypts with SealedBox, decrypts successfully
- Asserts `recovered == plaintext`

This proves the crypto stack is ready before Plan 05 builds on it.

## Test Suite Verification

```
Grid (new files only):
  Test Files: 7 skipped (new p2p + registry) + 1 passed (allowlist with edits)
  Tests: 80 passed | 72 skipped

Brain:
  1 passed | 18 skipped (0 failed)
```

The 132 pre-existing failures in `cd grid && npm test` are pre-existing in other test files and were not caused by this plan's changes. My 8 files all pass/skip cleanly when run in isolation.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All test bodies are Wave-0 stubs by design. This is the intent of Plan 01: provide behavioral contracts for Plans 02-05 to implement against.

No production stubs exist (no implementation written in this plan).

## Threat Flags

None — this plan creates test files only, no new network endpoints or auth paths.

## Self-Check: PASSED

Files exist:
- grid/test/p2p/p2p-peer-store.test.ts: FOUND
- grid/test/p2p/sdp-inbox-store.test.ts: FOUND
- grid/test/p2p/turn-credentials.test.ts: FOUND
- grid/test/p2p/p2p-producer-boundary.test.ts: FOUND
- grid/test/p2p/p2p-routes.test.ts: FOUND
- grid/test/p2p/firehose-push-signal.test.ts: FOUND
- grid/test/registry/vc-builder-public-key.test.ts: FOUND
- brain/test/wire/test_p2p.py: FOUND
- brain/test/wire/test_p2p_crypto.py: FOUND

Commits exist:
- 4c8bfc6: test(42-01): add Grid Wave-0 test scaffolds for P2P infrastructure
- 60d27cd: test(42-01): add Brain Wave-0 pytest stubs for P2P client and SDP crypto
