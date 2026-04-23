---
phase: 11-mesh-whisper
verified: 2026-04-23T12:38:30Z
status: passed
score: 6/6 WHISPER requirements verified
re_verification: false
notes: >
  brain/src/noesis_brain/whisper/crypto.py was listed as a key artifact in the
  task spec but does not exist. The crypto functionality was intentionally split
  into nonce.py + keyring.py + key_directory.py per Wave 1 SUMMARY (11-01-SUMMARY.md
  lines 14-16, 39-41). This is a spec-vs-implementation naming divergence only;
  all crypto functions are present and all 498 brain tests pass. Not a gap.

  CONTEXT.md D-11-30 labels the AEAD as "XChaCha20-Poly1305" but the implementation
  uses crypto_box_easy (XSalsa20-Poly1305). RESEARCH.md explicitly identifies this
  as the correct, byte-compatible primitive. Doc label is inaccurate; implementation
  is correct and tested. Not a gap.
---

# Phase 11 — Mesh Whisper: Verification Report

**Phase Goal:** Ship Nous-to-Nous end-to-end encrypted whisper (WHISPER-01..06)
**Verified:** 2026-04-23T12:38:30Z
**Status:** PASSED
**Re-verification:** No — initial goal-backward verification

---

## WHISPER Requirement Verdicts

| Req | Description | Verdict | Evidence |
|-----|-------------|---------|----------|
| WHISPER-01 | E2E encrypted envelopes via libsodium crypto_box | PASS | `crypto.ts` uses `sodium.crypto_box_easy` (XSalsa20-Poly1305); `crypto_box_seed_keypair` for X25519 keypairs; 30 crypto tests pass |
| WHISPER-02 | Operators cannot read plaintext at any tier | PASS | `check-whisper-plaintext.mjs` reports 0 violations; `whisper-plaintext-fs-guard.test.ts` (2 tests) + `whisper-privacy-matrix.test.ts` (19 tests) all pass |
| WHISPER-03 | Audit chain retains only ciphertext hash, no plaintext | PASS | `appendNousWhispered.ts` cleanPayload contains exactly `{ciphertext_hash, from_did, tick, to_did}` — no plaintext field; HEX64_RE validates hash format |
| WHISPER-04 | Broadcast allowlist grows exactly +1 (nous.whispered → 22 total) | PASS | Allowlist has exactly 22 entries; `nous.whispered` at position 22; `allowlist-twenty-two.test.ts` (6 tests) passes |
| WHISPER-05 | Tick-indexed rate limiting B=10/N=100 (zero wall-clock) | PASS | `TickRateLimiter` defaults: `rateBudget=10`, `rateWindowTicks=100`; zero wall-clock calls in whisper source; `check-wallclock-forbidden.mjs` clean |
| WHISPER-06 | PendingStore + ack-delete semantics | PASS | `PendingStore.ackDelete()` present; `drainFor()` returns frozen snapshot without deleting; bios.death GC via `evictDid()` |

**Overall Verdict: PASSED — all 6 WHISPER requirements verified**

---

## Artifact Existence and Substance

### Grid Whisper Core (`grid/src/whisper/`)

| File | Lines | Status |
|------|-------|--------|
| `crypto.ts` | 167 | PRESENT — libsodium `crypto_box_easy`/`crypto_box_open_easy`, `crypto_box_seed_keypair`, blake2b nonce derivation |
| `appendNousWhispered.ts` | 165 | PRESENT — sole producer, 11-step validation, closed 4-tuple payload |
| `rate-limit.ts` | 81 | PRESENT — `TickRateLimiter` class, B=10/N=100 defaults, `tryConsume`, `reset` |
| `router.ts` | 110 | PRESENT — `WhisperRouter`, calls `appendNousWhispered` |
| `pending-store.ts` | 171 | PRESENT — `PendingStore`, `enqueue`, `drainFor`, `ackDelete`, `evictDid` |

### Grid API Routes (`grid/src/api/whisper/`)

| File | Lines | Status |
|------|-------|--------|
| `send.ts` | 147 | PRESENT |
| `pending.ts` | 42 | PRESENT |
| `ack.ts` | 54 | PRESENT |
| `metrics.ts` | 48 | PRESENT |
| `routes.ts` | 128 | PRESENT |

### Brain Whisper (`brain/src/noesis_brain/whisper/`)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `keyring.py` | 126 | PRESENT — `crypto_box_seed_keypair`, `encrypt_for`, `decrypt_from` | Implements crypto.py function |
| `sender.py` | 152 | PRESENT — `nacl.bindings.crypto_box`, deterministic nonce | |
| `receiver.py` | 103 | PRESENT | |
| `trade_guard.py` | 68 | PRESENT | |
| `decrypt.py` | ~87 | PRESENT — `nacl.bindings.crypto_box_open`, hash-verify-before-decrypt | |
| `nonce.py` | present | PRESENT — blake2b-24 deterministic nonce | |
| `key_directory.py` | present | PRESENT — observer cache DID→pubkey | |
| `crypto.py` | — | ABSENT — functionality split into keyring.py + nonce.py + key_directory.py per Wave 1 SUMMARY. Not a gap. | |

### CI and Canonical Tests

| File | Status |
|------|--------|
| `scripts/check-whisper-plaintext.mjs` | PRESENT — reports 0 violations |
| `grid/src/audit/broadcast-allowlist.ts` | PRESENT — 22 entries confirmed |
| `grid/test/audit/allowlist-twenty-two.test.ts` | PRESENT — 6 tests, all pass |

---

## Test Suite Results

### Grid (vitest)

```
Test Files  123 passed (123)
     Tests  1122 passed (1122)
  Duration  4.35s
```

### Whisper suite only (11 files, 123 tests)

```
✓ whisper-crypto.test.ts           (30 tests)
✓ whisper-privacy-matrix.test.ts   (19 tests)
✓ whisper-wire-format.test.ts      (19 tests)
✓ whisper-tombstone.test.ts        (10 tests)
✓ whisper-keyring.test.ts          (9 tests)
✓ whisper-router.test.ts           (7 tests)
✓ whisper-rate-limit.test.ts       (present, passing)
✓ whisper-producer-boundary.test.ts (present, passing)
✓ whisper-plaintext-fs-guard.test.ts (2 tests)
✓ whisper-determinism.test.ts       (3 tests)
✓ whisper-zero-diff.test.ts         (3 tests)
Test Files  11 passed (11) — Tests  123 passed (123)
```

### Canonical allowlist test

```
✓ allowlist-twenty-two.test.ts (6 tests) — PASS
```

### Brain (pytest)

```
498 passed in 2.87s
```

---

## Key Wiring Verification

### Sole-Producer Gate (WHISPER-03 / WHISPER-04)

`grep -rn "audit.append.*nous.whispered" grid/src --include="*.ts" | grep -v appendNousWhispered.ts` → **0 results**

No code path can emit `nous.whispered` to the audit chain except through `appendNousWhispered()`.

`appendNousWhispered` is imported and called in `router.ts` line 35/95 only. Comments in `integration/types.ts` and `router.ts` docstrings reference it by name but do not call `audit.append` directly.

### Rate Limiter → Router Wiring

`TickRateLimiter` is instantiated inside `WhisperRouter` constructor (via `router.ts`) and `tryConsume` is called on each send attempt. Config defaults confirmed: `rateBudget=10`, `rateWindowTicks=100`.

### PendingStore → ACK Route Wiring

`PendingStore.ackDelete()` is the deletion mechanism in `grid/src/api/whisper/ack.ts`. `drainFor()` is the read path in `pending.ts`. Both routes share the singleton `PendingStore` instance.

---

## CI Gate Results

| Gate | Result |
|------|--------|
| `check-whisper-plaintext.mjs` | 0 violations across 3 tiers + keyring-isolation |
| `check-wallclock-forbidden.mjs` | Clean — no wall-clock reads in whisper paths |

---

## Notable Findings (Non-Blocking)

1. **`brain/src/noesis_brain/whisper/crypto.py` absent** — The Wave 1 plan listed a `crypto.py` but implementation split crypto responsibilities into `keyring.py` (key derivation + encrypt/decrypt), `nonce.py` (blake2b), and `key_directory.py` (pubkey cache). Wave 1 SUMMARY (11-01-SUMMARY.md) documents this structure. All 498 brain tests pass. No functional gap.

2. **XSalsa20 vs XChaCha20 label in CONTEXT.md** — CONTEXT.md D-11-30 says "XChaCha20-Poly1305" but `crypto_box_easy` uses XSalsa20-Poly1305. RESEARCH.md (line 104) explicitly documents this distinction and confirms XSalsa20 is the correct, byte-compatible choice between JS and Python. The implementation is correct; the CONTEXT.md label is a carry-over from early spec language. No functional impact.

3. **`check-state-doc-sync.mjs` and `check-relationship-graph-deps.mjs` doc-drift** — Noted in the existing `11-VERIFICATION.md` as resolved in W4-07 doc-sync commit. Out of scope for this verification (infrastructure script baseline updates, not WHISPER requirements).

---

## Summary

All six WHISPER requirements are implemented, wired, and tested. The full grid test suite (1122 tests, 123 files) and brain pytest suite (498 tests) both pass cleanly. The CI plaintext gate reports 0 violations. The allowlist has exactly 22 entries with `nous.whispered` at position 22, verified by the canonical `allowlist-twenty-two.test.ts`. Phase 11 goal is achieved.

---

_Verified: 2026-04-23T12:38:30Z_
_Verifier: Claude (gsd-verifier)_
