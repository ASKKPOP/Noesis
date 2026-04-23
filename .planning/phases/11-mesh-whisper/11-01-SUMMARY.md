---
phase: 11-mesh-whisper
plan: "01"
plan_slug: 01-crypto
subsystem: whisper
tags: [libsodium, pynacl, crypto_box, x25519, blake2b, xsalsa20-poly1305, deterministic-nonce, cross-lang-compat]

dependency_graph:
  requires:
    - phase: 11-mesh-whisper/11-00-setup
      provides: [allowlist-22, whisper-types, RED-stubs, whisper-package-markers]
  provides:
    - grid/src/whisper/crypto.ts — libsodium wrapper (keypair/nonce/encrypt/decrypt/hash)
    - brain/src/noesis_brain/whisper/nonce.py — blake2b-24 nonce (byte-identical to JS)
    - brain/src/noesis_brain/whisper/keyring.py — Brain-scoped per-DID keyring (nacl.bindings)
    - brain/src/noesis_brain/whisper/key_directory.py — observer cache DID→pubkey
    - JS↔Python byte-compat proven via fixture roundtrip (A2 assumption verified)
    - golden pub hex: did:noesis:alice_test → 64d82bca2c149c01c3606a919b5d7ba0b75c1abe84717db3d2964742fffe407c
  affects:
    - 11-02-emitter (uses crypto.ts for encryptFor/hashCiphertext/deriveNonce)
    - 11-03-routes (uses keyring for decrypt_from on pull endpoint)
    - 11-04-gates (determinism test uses hashCiphertext output)

tech-stack:
  added:
    - libsodium-wrappers@0.8.4 (grid/package.json)
    - pynacl==1.6.2 (brain/pyproject.toml)
    - pytest@9.0.3, pytest-asyncio@1.3.0 (brain dev deps, installed via uv)
  patterns:
    - top-level await sodium init (enables sync API after module import)
    - nacl.bindings.crypto_box_seed_keypair NOT PrivateKey(seed) (A2 compat pattern)
    - Node built-in crypto.createHash('sha256') for SHA-256 (libsodium non-sumo lacks it)
    - blake2b via sodium.crypto_generichash(24, ...) in JS; hashlib.blake2b in Python
    - golden-fixture cross-lang compat test: JS generates fixture, Python decrypts + vice versa

key-files:
  created:
    - grid/src/whisper/crypto.ts
    - brain/src/noesis_brain/whisper/nonce.py
    - brain/src/noesis_brain/whisper/keyring.py
    - brain/src/noesis_brain/whisper/key_directory.py
    - grid/test/whisper/whisper-keyring.test.ts
    - brain/test/whisper/__init__.py
    - brain/test/whisper/test_nonce.py
    - brain/test/whisper/test_keyring.py
    - brain/test/whisper/test_key_directory.py
    - brain/test/whisper/test_roundtrip.py
    - brain/test/fixtures/whisper/js-encrypted-envelope.json
    - brain/test/fixtures/whisper/py-encrypted-envelope.json
    - grid/scripts/gen-whisper-jsfixture.mjs
  modified:
    - grid/test/whisper/whisper-crypto.test.ts (RED stub → 30-test GREEN suite)
    - brain/src/noesis_brain/whisper/__init__.py (re-exports crypto trio)
    - grid/package.json (libsodium-wrappers added)
    - package-lock.json (lockfile updated)
    - brain/pyproject.toml (pynacl added)
    - brain/uv.lock (lockfile updated)
    - scripts/check-wallclock-forbidden.mjs (__pycache__ skip fix)
    - .planning/STATE.md (22-event entry restored from lost merge)

key-decisions:
  - "SHA-256 via Node built-in crypto.createHash not sodium.crypto_hash_sha256 — libsodium-wrappers non-sumo omits that function; Node crypto produces identical bytes to Python hashlib.sha256"
  - "Sync API with top-level await: crypto.ts uses top-level await initSodium() so module is ready for synchronous callers immediately after dynamic import()"
  - "Generator script gen-whisper-jsfixture.mjs replicates crypto.ts logic inline in pure JS (no tsx transpilation) to avoid top-level await + CJS mode conflict"
  - "STATE.md 22-event entry was lost in worktree merge f92bd8c; restored minimally as Rule 3 blocking fix (check-state-doc-sync gate dependency)"

requirements-completed: [WHISPER-01, WHISPER-02]

duration: ~25min
completed: 2026-04-23
---

# Phase 11 Plan 01: Crypto Summary

**Deterministic X25519/XSalsa20-Poly1305 crypto core proven byte-identical across JS (libsodium-wrappers) and Python (nacl.bindings) via committed fixture roundtrip, with blake2b-24 nonces and SHA-256 hashed keypair seeds**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-23T10:50:00Z
- **Completed:** 2026-04-23T11:05:00Z
- **Tasks:** 4 (+ 1 blocking fix)
- **Files created:** 13
- **Files modified:** 8

## Accomplishments

- libsodium-wrappers@0.8.4 installed in grid; PyNaCl 1.6.2 installed in brain via uv
- `grid/src/whisper/crypto.ts` shipped: initSodium (memoized), deriveKeypairFromSeed, keypairFromDid, seedForDid, deriveNonce (blake2b-24), encryptFor, decryptFrom (throws on MAC fail), hashCiphertext — all synchronous after top-level await init
- Brain crypto trio shipped: `nonce.py` (derive_nonce with validation), `keyring.py` (nacl.bindings.crypto_box_seed_keypair NOT PrivateKey), `key_directory.py` (observer pattern)
- RESEARCH §2.2 A2 assumption proven by fixture: `did:noesis:alice_test` produces pub `64d82bca...` on both JS and Python sides
- Wave 0 `whisper-crypto.test.ts` RED stub turned GREEN (30 tests)
- Total: 39 JS tests + 50 Python whisper tests all GREEN

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 11-W1-01 | Install libsodium-wrappers + PyNaCl | 1a905f9 | chore |
| 11-W1-02 | grid/src/whisper/crypto.ts | 98c56ce | feat |
| 11-W1-03 | Brain crypto trio + tests | e395b7f | feat |
| 11-W1-04 | JS↔Python roundtrip fixtures + tests | a420f88 | feat |
| Blocking fix | Restore STATE.md 22-event entry | 0b0cc98 | fix |

## Files Created

| File | Purpose |
|------|---------|
| `grid/src/whisper/crypto.ts` | libsodium wrapper — sync API, top-level await init |
| `brain/src/noesis_brain/whisper/nonce.py` | derive_nonce blake2b-24, byte-identical to JS |
| `brain/src/noesis_brain/whisper/keyring.py` | Per-DID keyring using nacl.bindings |
| `brain/src/noesis_brain/whisper/key_directory.py` | Observer: bios.birth→pubkey cache |
| `grid/test/whisper/whisper-keyring.test.ts` | JS decrypts Python fixture (9 tests) |
| `brain/test/whisper/test_nonce.py` | 15 tests: determinism, scope, validation |
| `brain/test/whisper/test_keyring.py` | 12 tests: golden fixture, MAC failure, evict |
| `brain/test/whisper/test_key_directory.py` | 9 tests: birth/death/idempotent |
| `brain/test/whisper/test_roundtrip.py` | 10 tests: A2 proof, cross-lang decrypt |
| `brain/test/fixtures/whisper/js-encrypted-envelope.json` | JS-encrypted (tick=42) |
| `brain/test/fixtures/whisper/py-encrypted-envelope.json` | Python-encrypted (tick=43) |
| `grid/scripts/gen-whisper-jsfixture.mjs` | Deterministic fixture generator |

## Golden Values (Wave 2 cross-reference)

| DID | Seed (SHA256) | Public Key |
|-----|---------------|------------|
| `did:noesis:alice_test` | `1d69ad3997ae84fbbd02f0778363a27121ccf00838483d87bddf219f24d4b69e` | `64d82bca2c149c01c3606a919b5d7ba0b75c1abe84717db3d2964742fffe407c` |
| `did:noesis:bob_test` | `(sha256(bob_test))` | `87bc47cd478f147d3e143b6e05f2a58c749bbde2734398dd10caecc2f5bb9617` |

## Fixture Paths and Regeneration

| Fixture | Regenerate via |
|---------|---------------|
| `brain/test/fixtures/whisper/js-encrypted-envelope.json` | `node grid/scripts/gen-whisper-jsfixture.mjs` |
| `brain/test/fixtures/whisper/py-encrypted-envelope.json` | `cd brain && uv run pytest test/whisper/test_roundtrip.py` |

## Decisions Made

1. **SHA-256 via Node built-in, not libsodium:** `libsodium-wrappers` (non-sumo) does not expose `crypto_hash_sha256`. Used `node:crypto createHash('sha256')` instead — byte-identical to Python `hashlib.sha256`. This is the cross-language compat path.

2. **Synchronous API with top-level await:** `crypto.ts` uses `await initSodium()` at module level so all exported functions are synchronous after dynamic `import()`. This matches how vitest test code calls the functions without additional `await`.

3. **Generator in pure JS:** `gen-whisper-jsfixture.mjs` replicates crypto.ts logic inline rather than importing the TypeScript source, avoiding CJS-mode top-level-await conflicts with tsx.

4. **STATE.md minimal fix:** The worktree merge commit `f92bd8c` lost the Wave 0 STATE.md update (commit `0f5f3e5` was in the worktree branch but conflicted). Restored minimally as a blocking deviation fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `sodium.crypto_hash_sha256` unavailable in libsodium-wrappers non-sumo**
- **Found during:** Task 11-W1-02 (crypto.ts implementation)
- **Issue:** The plan's `<interfaces>` block used `sodium.crypto_hash_sha256(sodium.from_string(did))` which is only available in `libsodium-wrappers-sumo`, not the standard package. Running the test produced `TypeError: default.crypto_hash_sha256 is not a function`.
- **Fix:** Replaced with `node:crypto createHash('sha256')` for both DID seed derivation and `hashCiphertext`. Produces byte-identical output to Python `hashlib.sha256`.
- **Files modified:** `grid/src/whisper/crypto.ts`
- **Verification:** 30/30 whisper-crypto tests GREEN; JS golden fixture alice_pub matches Python golden value
- **Committed in:** 98c56ce

**2. [Rule 3 - Blocking] Wall-clock gate false-positives from `__pycache__` `.pyc` files**
- **Found during:** Task 11-W1-03 (after creating brain whisper files)
- **Issue:** `check-wallclock-forbidden.mjs` `walk()` scanned `__pycache__/*.pyc` bytecode files. Comments in `keyring.py` and `nonce.py` mentioning `datetime` appear verbatim in bytecode, triggering false-positive violations.
- **Fix:** Added `if (entry === '__pycache__') continue;` to the `walk()` function.
- **Files modified:** `scripts/check-wallclock-forbidden.mjs`
- **Verification:** Gate exits 0 after fix
- **Committed in:** e395b7f

**3. [Rule 3 - Blocking] STATE.md "22 events" missing — gate failure**
- **Found during:** Post-task CI gate verification
- **Issue:** `check-state-doc-sync.mjs` expects "22 events" in STATE.md. Worktree merge commit `f92bd8c` resolved the conflict by keeping the pre-Wave-0 "21 events" version, losing the update from Wave 0 commit `0f5f3e5`.
- **Fix:** Added Phase 11 entry #22 (`nous.whispered`) to STATE.md; updated heading and gate reference.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `[state-doc-sync] OK — STATE.md is in sync with the 22-event allowlist.`
- **Committed in:** 0b0cc98

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All three fixes necessary for correctness and CI gate passage. No scope creep.

## Known Stubs

None. All source files implement complete functionality. The four Wave 0 RED stubs (`whisper-producer-boundary.test.ts`, `whisper-wire-format.test.ts`, `whisper-rate-limit.test.ts`) remain RED as designed — they await Wave 2 emitter/router code.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new files are:
- Pure computation (crypto primitives, key derivation)
- In-memory state only (Keyring, KeyDirectory)
- Test files and fixture JSON
- Generator script (dev tool, not runtime)

Threat mitigations from plan threat model applied:
- T-11-W1-01: Private keys in-memory only; `Keyring.evict()` tested; no logging of `_priv`
- T-11-W1-02: A2 assumption locked via fixture roundtrip test (golden bytes)
- T-11-W1-03: Nonce length validated (24 bytes); determinism confirmed via tests
- T-11-W1-06: Wall-clock gate now covers `__pycache__` correctly

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `grid/src/whisper/crypto.ts` | FOUND |
| `brain/src/noesis_brain/whisper/nonce.py` | FOUND |
| `brain/src/noesis_brain/whisper/keyring.py` | FOUND |
| `brain/src/noesis_brain/whisper/key_directory.py` | FOUND |
| `grid/test/whisper/whisper-keyring.test.ts` | FOUND |
| `brain/test/whisper/test_roundtrip.py` | FOUND |
| `brain/test/fixtures/whisper/js-encrypted-envelope.json` | FOUND |
| `brain/test/fixtures/whisper/py-encrypted-envelope.json` | FOUND |
| Commit 1a905f9 | FOUND |
| Commit 98c56ce | FOUND |
| Commit e395b7f | FOUND |
| Commit a420f88 | FOUND |
| Commit 0b0cc98 | FOUND |
| whisper-crypto.test.ts 30/30 GREEN | VERIFIED |
| whisper-keyring.test.ts 9/9 GREEN | VERIFIED |
| brain pytest test/whisper/ 50/50 GREEN | VERIFIED |
| check-wallclock-forbidden.mjs exits 0 | VERIFIED |
| check-state-doc-sync.mjs exits 0 | VERIFIED |
| No PrivateKey() calls in brain/whisper source | VERIFIED |
| alice_test pub matches JS golden | VERIFIED |
