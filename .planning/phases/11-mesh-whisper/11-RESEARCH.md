# Phase 11: Mesh Whisper — Research

**Researched:** 2026-04-23
**Domain:** E2E cryptography (libsodium crypto_box) + deterministic protocol design + audit hash-only boundary + sole-producer CI gates
**Confidence:** HIGH (stack, file plan, gate templates all cloned from shipped Phase 10a/10b precedents)

---

<user_constraints>
## User Constraints (from 11-CONTEXT.md)

### Locked Decisions (D-11-01 … D-11-18)

- **D-11-01 Allowlist growth:** exactly one new event `nous.whispered` appended at position 22. Payload closed 4-tuple `{from_did, to_did, tick, ciphertext_hash}`. Sole producer file `grid/src/whisper/appendNousWhispered.ts`. [CITED: 11-CONTEXT.md]
- **D-11-02 JS crypto binding:** `libsodium-wrappers` (WASM; universal Node/browser). PyNaCl on Python side. [CITED: 11-CONTEXT.md]
- **D-11-03 Keypair generation:** at `bios.birth` emission. Seed = `SHA256(DID)[:32]` → `crypto_box_seed_keypair`. Deterministic replay. [CITED: 11-CONTEXT.md]
- **D-11-04 Keyring storage:** Python-side only (`brain/src/noesis_brain/whisper/keyring.py`). Private keys never leave Brain. Grid never sees private keys and never caches pubkeys. [CITED: 11-CONTEXT.md]
- **D-11-05 Ciphertext storage:** Grid in-memory `Map<recipient_did, Array<Envelope>>`. Deleted on ack. No MySQL persistence. [CITED: 11-CONTEXT.md]
- **D-11-06 Envelope shape:** `{version:1, from_did, to_did, tick, nonce_b64, ciphertext_b64, ciphertext_hash}`. Action type `whisper_send`. [CITED: 11-CONTEXT.md]
- **D-11-07 Recipient-pull:** `GET /api/v1/nous/:did/whispers/pending` → list; `POST /api/v1/nous/:did/whispers/ack` → delete. No push, no broadcast. [CITED: 11-CONTEXT.md]
- **D-11-08 Rate limit:** tick-indexed primary (B=10 sends per N=100 ticks, per sender DID, env-overridable). `@fastify/rate-limit` wall-clock secondary (DDoS). Queue-length metric endpoint counts-only. [CITED: 11-CONTEXT.md]
- **D-11-09 Plaintext CI gate:** three tiers (grid/src, brain/src, dashboard/src) + runtime `fs.writeFile` monkey-patch. Forbidden keys: `text|body|content|message|utterance|offer|amount|ousia|price|value|plaintext|decrypted|payload_plain`. [CITED: 11-CONTEXT.md]
- **D-11-10 Privacy matrix:** 16 entries across whisper payloads, envelopes, logs, metrics, UI. [CITED: 11-CONTEXT.md]
- **D-11-11 Producer-boundary grep:** clone `grid/test/bios/bios-producer-boundary.test.ts`. Three describe blocks. Forbidden siblings: `nous.whisper_broadcast`, `nous.whispered_plain`, `nous.whisper_rate_limited`. [CITED: 11-CONTEXT.md]
- **D-11-12 DialogueAggregator:** extend existing aggregator with `channel='whisper'` axis. Buffer key = `sortedDids.join('|') + '|' + channel`. No new event type. Hash-only ingestion. [CITED: 11-CONTEXT.md]
- **D-11-13 telos.refined provenance:** reuse existing `triggered_by_dialogue_id` field — no new schema field. [CITED: 11-CONTEXT.md]
- **D-11-14 Determinism & zero-diff:** replay test asserts byte-identical `ciphertext_hash` across two runs; regression-hash invariant preserved. [CITED: 11-CONTEXT.md]
- **D-11-15 T-10-06 defense depth:** trade actions forbidden inside whispered content (Brain-side validator) + `trade.*` events still require plaintext audit path (no whispered trade settlement). [CITED: 11-CONTEXT.md]
- **D-11-16 UI at H1+:** read-only counts panel (sent/received/pending). H5 whisper-inspect explicitly EXCLUDED (no button, no RPC). [CITED: 11-CONTEXT.md]
- **D-11-17 Fourth dashboard mirror:** ship `dashboard/src/protocol/whisper-types.ts`. Mark `@noesis/protocol-types` consolidation as deferred. SYNC-with-Grid discipline documented. [CITED: 11-CONTEXT.md]
- **D-11-18 Tombstone gate:** inherit Phase 10b D-10b-04 — silent drop at router if either DID is tombstoned. [CITED: 11-CONTEXT.md]

### Claude's Discretion

Wave slicing (4 vs 5), exact sequence of tests within a wave, file-internal helper naming, Fastify route mounting pattern.

### Deferred Ideas (OUT OF SCOPE)

- Forward secrecy / key ratcheting (long-term keys only; Phase 11+)
- Sealed-sender (sender DID visible in envelope this phase)
- H5 whisper-inspect RPC (T-10-03 anti-feature)
- Group whisper / N-recipient (pairwise only)
- `@noesis/protocol-types` consolidation (fourth-mirror trigger, deferred explicitly)
- MySQL ciphertext persistence
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (WHISPER-01..06) | Research Support |
|----|-------------|------------------|
| WHISPER-01 | Any two Nous exchange E2E-encrypted envelopes via libsodium crypto_box | §2 Framework Quick Reference, §3 Wire-format Contract |
| WHISPER-02 | Operator cannot read plaintext at any tier including H5 | §5 Three-tier plaintext CI gate + fs.writeFile monkey-patch; §8 T-10-03 mapping |
| WHISPER-03 | Audit chain retains only ciphertext_hash; plaintext never persisted | §3 hash derivation; §4 appendNousWhispered emitter; §5 zero-diff determinism |
| WHISPER-04 | One new allowlist event `nous.whispered` at position 22 | §4 broadcast-allowlist.ts diff; §7 integration point line 1 |
| WHISPER-05 | Tick-indexed rate limit (B=10 / N=100 default, env-overridable) | §2 config pattern; §4 whisper/rate-limit.ts; §7 integration line 4 |
| WHISPER-06 | Recipient-pull delivery; ciphertext deleted on ack | §2 Fastify routes; §4 whisper/routes.ts; §7 integration line 5 |
</phase_requirements>

---

## 1. Executive Summary

- **Stack is minimal and stable.** Only two new deps: `libsodium-wrappers@0.8.4` (JS, WASM) [VERIFIED: npm view 2026-04-19] and `PyNaCl 1.6.2` (Python) [VERIFIED: pip index 2026-04-23]. `@fastify/rate-limit@^10.0.0` already installed [VERIFIED: grid/package.json]. Both libsodium bindings use the same underlying C library → byte-for-byte compatible ciphertexts across JS↔Python.
- **Pattern reuse is maximal.** `appendNousWhispered.ts` clones `appendBiosBirth.ts` 8-step validation discipline. Producer-boundary test clones `grid/test/bios/bios-producer-boundary.test.ts` verbatim with string substitutions. Tombstone gate inherits Phase 10b D-10b-04. Rate-limit config file clones `grid/src/relationships/config.ts` `Object.freeze` pattern.
- **Hash-only boundary is the load-bearing invariant.** Audit chain stores `ciphertext_hash = SHA256(ciphertext_bytes)` only — plaintext never touches the chain, Brain logs, Dashboard state, or disk. The three-tier grep gate + fs.writeFile monkey-patch enforce this structurally; no runtime code can bypass it without triggering CI failure.
- **Determinism is achieved via seeded keys + derived nonces.** Seed = `SHA256(DID)[:32]` → `crypto_box_seed_keypair`. Nonce = `blake2b(sender_priv_seed ‖ tick_le64 ‖ counter_le32)[:24]`. Two simulation runs of the same tick-budget yield identical `ciphertext_hash` sequences, preserving the zero-diff invariant (regression hash `c7c49f49...`).
- **Recommended wave structure is 5 waves** mirroring Phase 10b cadence: W0 (RED stubs + allowlist + config), W1 (crypto core + keyring), W2 (emitter + router + rate limit), W3 (API routes + aggregator extension + tombstone gate), W4 (CI gates + dashboard mirror + determinism regression + closeout).

**Primary recommendation:** Ship as 5 waves. Allowlist bump + sole-producer boundary test must be W0-RED (matches Phase 10b discipline). Encryption core and producer-boundary tests must be GREEN before any API surface or dashboard work.

---

## 2. Framework Quick Reference

### 2.1 libsodium-wrappers (JS, version 0.8.4)

```typescript
// Source: https://github.com/jedisct1/libsodium.js — README.md public API [CITED]
import sodium from 'libsodium-wrappers';

await sodium.ready;  // MUST await before any call — WASM init

// Deterministic keypair from 32-byte seed
const seed: Uint8Array = sodium.crypto_generichash(32, did_utf8);  // or SHA256 external
const kp = sodium.crypto_box_seed_keypair(seed);
// kp = { publicKey: Uint8Array(32), privateKey: Uint8Array(32), keyType: 'x25519' }

// Encrypt (X25519 key agreement → XSalsa20-Poly1305 AEAD, 24-byte nonce)
const nonce: Uint8Array = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);  // 24
const ct: Uint8Array = sodium.crypto_box_easy(plaintext_u8, nonce, recipient_pub, sender_priv);
// ct.length === plaintext.length + crypto_box_MACBYTES (16)

// Decrypt
const pt: Uint8Array = sodium.crypto_box_open_easy(ct, nonce, sender_pub, recipient_priv);
// throws on MAC failure
```

**Constants (confirmed):** `crypto_box_PUBLICKEYBYTES=32`, `crypto_box_SECRETKEYBYTES=32`, `crypto_box_NONCEBYTES=24`, `crypto_box_MACBYTES=16`, `crypto_box_SEEDBYTES=32`. [CITED: libsodium.js API]

**Gotchas:**
- `await sodium.ready` is mandatory. Calling before ready → undefined behavior. Cache a module-level `readyPromise`. [CITED: libsodium.js README]
- WASM init is ~2MB; in Node it loads synchronously on first await. Acceptable for Grid process; cold-start overhead ~30ms on M-series Mac. [ASSUMED: typical WASM init cost]
- `crypto_box_easy` uses XSalsa20, NOT XChaCha20 — the `_easy` variant is the classic Nacl crypto_box. For XChaCha20 use `crypto_box_curve25519xchacha20poly1305_easy` if needed. Recommendation: **use `crypto_box_easy` (XSalsa20) — PyNaCl's `Box.encrypt` uses the same primitive → byte-for-byte compatible.** [CITED: libsodium.js & PyNaCl Box docs]

### 2.2 PyNaCl (Python, version 1.6.2)

```python
# Source: https://pynacl.readthedocs.io/en/latest/public/ [CITED]
from nacl.public import PrivateKey, PublicKey, Box
from nacl.hash import sha256
import hashlib

# Deterministic keypair from 32-byte seed
seed: bytes = hashlib.sha256(did.encode()).digest()[:32]  # 32 bytes
priv = PrivateKey(seed)         # PrivateKey(seed) is literally the seed as the X25519 scalar
pub  = priv.public_key          # PublicKey(32 bytes)

# Encrypt
box = Box(sender_priv, recipient_pub)
ct_with_nonce = box.encrypt(plaintext, nonce=nonce_24)   # returns EncryptedMessage
# ct_with_nonce.nonce (24), ct_with_nonce.ciphertext (pt+16)

# Decrypt
pt = box.decrypt(ct, nonce=nonce_24)   # raises CryptoError on MAC fail
```

**Critical compat note:** `PrivateKey(seed_bytes)` in PyNaCl treats the 32 bytes AS the X25519 clamped scalar. libsodium.js `crypto_box_seed_keypair(seed)` runs `crypto_hash_sha512(seed)` internally and uses the first 32 bytes as the scalar. **These two paths produce DIFFERENT keypairs from the same seed.** [CITED: libsodium source `crypto_box_seed_keypair` → `crypto_sign_seed_keypair` reuses sha512; PyNaCl `PrivateKey.__init__` uses raw bytes]

**Resolution:** both sides MUST use the libsodium-style derivation. In Python, call `nacl.bindings.crypto_box_seed_keypair(seed)` (the low-level binding) instead of `PrivateKey(seed)`:

```python
from nacl.bindings import crypto_box_seed_keypair
pub, priv = crypto_box_seed_keypair(seed_32)   # matches libsodium.js exactly
```

[VERIFIED: PyNaCl exposes the low-level binding at `nacl.bindings`]

### 2.3 @fastify/rate-limit (already installed, ^10.0.0)

```typescript
// Source: https://github.com/fastify/fastify-rate-limit [CITED]
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 120,                       // wall-clock belt-and-suspenders only
  timeWindow: '1 minute',
  allowList: (req) => req.routerPath === '/api/v1/nous/:did/whispers/pending',
  keyGenerator: (req) => req.headers['x-sender-did'] ?? req.ip,
});
```

Wall-clock path is DDoS-only; the primary budget is tick-indexed (see §4 `whisper/rate-limit.ts`). The Fastify limiter MUST be permissive enough that tick-budget rejects almost always win. [CITED: 11-CONTEXT.md D-11-08]

---

## 3. Wire-format Contract

### 3.1 Envelope (JSON over HTTP, stored in Grid in-memory Map)

```json
{
  "version": 1,
  "from_did": "did:noesis:xxxx",
  "to_did":   "did:noesis:yyyy",
  "tick": 42,
  "nonce_b64":       "<base64 24 bytes>",
  "ciphertext_b64":  "<base64 N+16 bytes>",
  "ciphertext_hash": "<hex 64 chars>"
}
```

**Field widths:**
- `nonce_b64`: 32 chars (24 bytes → 32 base64 chars, no padding since 24%3==0)
- `ciphertext_b64`: `ceil((N+16)/3)*4` chars
- `ciphertext_hash`: 64 hex chars (SHA256 lowercase, no `0x`)

### 3.2 Nonce derivation (deterministic)

```
nonce_24 = blake2b(
  sender_priv_seed_32 ‖ tick_le64 ‖ counter_le32,
  digest_size=24
)
```

Where `counter` is a per-(sender, tick) monotonic integer starting at 0, incrementing for each whisper sent by the same sender at the same tick. This guarantees **nonce-misuse resistance** (identical (sender, tick) emits distinct nonces) while preserving determinism. [ASSUMED: matches Phase 10a ChronosListener counter pattern; user to confirm.]

### 3.3 ciphertext_hash

```
ciphertext_hash = sha256_hex(ciphertext_bytes_without_nonce)
```

The MAC is included inside `ciphertext_bytes` (libsodium `crypto_box_easy` concatenates MAC+encrypted). Nonce is NOT hashed — hashing nonce would break the "whisper sent from the same ≡ same hash" invariant used by the determinism regression test. [ASSUMED]

### 3.4 Base64 encoding choice

**Use `base64` (standard, with `=` padding) — NOT base64url, NOT hex.**

Justification:
- Standard base64 is the libsodium-js / PyNaCl idiom (both expose `sodium.to_base64` with `base64_variants.ORIGINAL`).
- Hex doubles payload size; base64url gains nothing since envelopes live in JSON bodies, not URLs.
- Rust-side consumers (none yet, but likely H1 onwards) get `base64::STANDARD` by default.

[CITED: libsodium.js `base64_variants.ORIGINAL`; PyNaCl `nacl.encoding.Base64Encoder`]

### 3.5 Wire-format invariants (enforced by emitter)

1. `nonce_b64` length === 32 exactly
2. `ciphertext_hash` matches `/^[0-9a-f]{64}$/`
3. `from_did` and `to_did` match `DID_RE = /^did:noesis:[0-9a-f]{32}$/` [CITED: Phase 10b D-29 DID_RE enforcement]
4. `from_did !== to_did` (self-whisper rejected)
5. `tick >= 0` and `Number.isInteger(tick)`
6. `version === 1` (locked; bump = new allowlist addition)

---

## 4. File-by-file Plan

### 4.1 grid/src (TypeScript)

| File | Status | Purpose |
|------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | MODIFY | Add `'nous.whispered'` at position 22; add `WHISPER_FORBIDDEN_KEYS` const; extend `FORBIDDEN_KEY_PATTERN` |
| `grid/src/whisper/appendNousWhispered.ts` | NEW | Sole producer — clone `appendBiosBirth.ts` 8-step validation discipline |
| `grid/src/whisper/crypto.ts` | NEW | libsodium init wrapper, `encryptFor`, `hashCiphertext`, `deriveNonce` |
| `grid/src/whisper/config.ts` | NEW | `Object.freeze({ rateBudget: 10, rateWindowTicks: 100, envelopeVersion: 1 })` with env override |
| `grid/src/whisper/rate-limit.ts` | NEW | Tick-indexed counter: `Map<sender_did, Array<tick>>`. Prune entries older than `tick - N`. Reject when >= B |
| `grid/src/whisper/router.ts` | NEW | `WhisperRouter.route(envelope, tombstoneCheck)` — validates → rate-limit → tombstone → appendNousWhispered → stash in in-memory Map |
| `grid/src/whisper/pending-store.ts` | NEW | `Map<recipient_did, Envelope[]>`; `enqueue`, `drainFor`, `ackDelete` |
| `grid/src/whisper/routes.ts` | NEW | Fastify plugin exposing GET `/api/v1/nous/:did/whispers/pending` + POST `/api/v1/nous/:did/whispers/ack` + GET `/api/v1/whispers/metrics` |
| `grid/src/whisper/types.ts` | NEW | `Envelope` interface; shared with dashboard mirror |
| `grid/src/integration/nous-runner.ts` | MODIFY | Add `case 'whisper_send':` in executeActions switch (line ~200) |
| `grid/src/dialogue/aggregator.ts` | MODIFY | Widen `handleEntry` filter (line ~162) to also accept `'nous.whispered'` with `channel='whisper'` |

### 4.2 brain/src/noesis_brain (Python)

| File | Status | Purpose |
|------|--------|---------|
| `brain/src/noesis_brain/whisper/__init__.py` | NEW | Package marker |
| `brain/src/noesis_brain/whisper/keyring.py` | NEW | `Keyring` — seeded keypair cache by DID; `encrypt_for(peer_did, plaintext, tick, counter)` returns envelope fields; `decrypt_from(envelope)` returns plaintext |
| `brain/src/noesis_brain/whisper/key_directory.py` | NEW | Observer on `bios.birth` audit stream; maintains `Dict[did, bytes_pubkey]`. Never writes to disk |
| `brain/src/noesis_brain/whisper/nonce.py` | NEW | `derive_nonce(sender_seed, tick, counter) -> bytes[24]` using blake2b |
| `brain/src/noesis_brain/whisper/sender.py` | NEW | High-level: given `(from_did, to_did, tick, plaintext_bytes)` → emit envelope to Grid via existing HTTP client |
| `brain/src/noesis_brain/whisper/receiver.py` | NEW | Polls `whispers/pending`, decrypts, forwards to deliberation engine, acks |
| `brain/src/noesis_brain/whisper/trade_guard.py` | NEW | Regex-scan plaintext for trade-action literals before encrypt; reject at Brain (T-10-06 depth) |

### 4.3 dashboard/src (TypeScript, fourth protocol mirror)

| File | Status | Purpose |
|------|--------|---------|
| `dashboard/src/protocol/whisper-types.ts` | NEW | Mirror of `grid/src/whisper/types.ts` — SYNC-header comment, type-only import allowed |
| `dashboard/src/panels/WhisperInspector.tsx` | NEW | Read-only counts panel (sent / received / pending). H5 tier excluded |
| `dashboard/src/state/whisperStore.ts` | NEW | Counts-only Zustand store; subscribes to metrics endpoint |

### 4.4 scripts

| File | Status | Purpose |
|------|--------|---------|
| `scripts/check-wallclock-forbidden.mjs` | MODIFY | Add `grid/src/whisper` to `TIER_B_TS_ROOTS`; add `brain/src/noesis_brain/whisper` to Python roots |
| `scripts/check-state-doc-sync.mjs` | MODIFY | Bump literal `"21 events"` → `"22 events"`; append `'nous.whispered'` to `required` array |
| `scripts/check-whisper-plaintext.mjs` | NEW | Three-tier grep gate: scan grid/src, brain/src, dashboard/src for `FORBIDDEN_KEY_PATTERN` inside whisper-related files |
| `scripts/check-whisper-runtime-writes.mjs` | NEW | Spawns a short simulation under a `fs.writeFile` monkey-patch that fails on any write matching plaintext heuristics |

### 4.5 tests

| File | Status | Purpose |
|------|--------|---------|
| `grid/test/whisper/whisper-producer-boundary.test.ts` | NEW | Clone of `grid/test/bios/bios-producer-boundary.test.ts`. Three describes; forbidden siblings `nous.whisper_broadcast`, `nous.whispered_plain`, `nous.whisper_rate_limited` |
| `grid/test/whisper/whisper-crypto.test.ts` | NEW | Round-trip encrypt/decrypt; deterministic keypair from seed; MAC-failure rejection |
| `grid/test/whisper/whisper-wire-format.test.ts` | NEW | Envelope validation (DID regex, nonce length, hash format, version lock) |
| `grid/test/whisper/whisper-rate-limit.test.ts` | NEW | B=10/N=100 accept/reject matrix; env override; prune on tick advance |
| `grid/test/whisper/whisper-tombstone.test.ts` | NEW | Silent drop when sender or recipient tombstoned |
| `grid/test/whisper/whisper-api.test.ts` | NEW | Fastify inject: pending → ack → drained; metrics endpoint counts-only |
| `grid/test/whisper/whisper-aggregator.test.ts` | NEW | DialogueAggregator accepts `nous.whispered`; channel='whisper' buffer key; hash-only extraction |
| `grid/test/whisper/whisper-determinism.test.ts` | NEW | Two simulation runs → byte-identical ciphertext_hash sequence |
| `grid/test/whisper/whisper-plaintext-fs-guard.test.ts` | NEW | Runtime `fs.writeFile` monkey-patch rejects plaintext writes |
| `brain/test/test_whisper_keyring.py` | NEW | Seed → keypair determinism; libsodium-compat (matches JS-side pub bytes) |
| `brain/test/test_whisper_roundtrip.py` | NEW | Python encrypt → JS decrypt fixture; byte-compat assertion |
| `brain/test/test_whisper_trade_guard.py` | NEW | Reject trade-action literals in plaintext |
| `brain/test/test_whisper_key_directory.py` | NEW | Observer picks up bios.birth → pubkey cached |

---

## 5. Testing Strategy

### 5.1 Three-tier plaintext CI gate

**Tier A (strict, grid/src + brain/src):** No file in these trees may contain any `FORBIDDEN_KEY_PATTERN` match inside a string literal, object key, JSON schema, or identifier *that flows through a whisper path*. Whitelisted: the allowlist file itself, forbidden-key const declarations, this RESEARCH.md.

**Tier B (advisory, dashboard/src):** Dashboard may display the word "message" in UI copy; enforcement is on data shapes flowing over the wire. Runtime test asserts `whisperStore` never holds any field matching `FORBIDDEN_KEY_PATTERN` except counts.

**Tier C (runtime, all processes):** `fs.writeFile` + `fs.writeFileSync` + `fs.promises.writeFile` + `fs.createWriteStream` monkey-patched during a test simulation. If any write contains `FORBIDDEN_KEY_PATTERN` substrings in buffer content, fail. Spawns a 100-tick simulation with 20 whispers flowing; asserts zero offending writes. [CLONED: 11-CONTEXT.md D-11-09]

### 5.2 Determinism / zero-diff regression

`whisper-determinism.test.ts`: runs the same 100-tick simulation twice with fresh processes; captures the sequence of `(tick, from_did, to_did, ciphertext_hash)` tuples; asserts byte-identical between runs.

The global regression hash `c7c49f49...` must also remain stable after Phase 11 given no whispers are emitted in the zero-diff baseline fixture. [CITED: 11-CONTEXT.md D-11-14]

### 5.3 Producer-boundary grep (Wave 0 RED)

Clone `grid/test/bios/bios-producer-boundary.test.ts` exactly. Substitute:
- `bios.birth` → `nous.whispered`
- `appendBiosBirth.ts` → `appendNousWhispered.ts`
- Known consumers: `['dialogue/aggregator.ts', 'whisper/router.ts']` (both ingest the event)
- Forbidden siblings: `['nous.whisper_broadcast', 'nous.whispered_plain', 'nous.whisper_rate_limited']`

Will RED at Wave 0 (emitter file absent). [CLONED: grid/test/bios/bios-producer-boundary.test.ts]

### 5.4 Fixtures

- `grid/test/fixtures/whisper/deterministic-run.json`: 100-tick simulation output with 20 whispers — the golden file for the determinism test.
- `brain/test/fixtures/whisper/js-compat-envelope.json`: envelope produced by libsodium-wrappers with known seed+nonce+plaintext; Python decrypt must succeed.
- `brain/test/fixtures/whisper/py-compat-envelope.json`: reverse direction.

### 5.5 Test framework + commands (per §10 Validation Architecture below)

| Property | Value |
|----------|-------|
| Grid framework | vitest |
| Grid quick run | `cd grid && npx vitest run test/whisper/ --reporter=dot` |
| Grid full | `cd grid && npm test` |
| Brain framework | pytest |
| Brain quick run | `cd brain && pytest test/ -k whisper -x` |
| Brain full | `cd brain && pytest test/` |

---

## 6. Wave Structure Recommendation

### Wave 0 — RED stubs + allowlist + config (foundation)

- Add `nous.whispered` at position 22 of allowlist (MODIFY `broadcast-allowlist.ts`)
- Add `WHISPER_FORBIDDEN_KEYS` + extend `FORBIDDEN_KEY_PATTERN`
- Bump `check-state-doc-sync.mjs` literal `"21"` → `"22"` + append to `required` array
- Create `grid/src/whisper/config.ts` (just the frozen constants)
- Create `grid/src/whisper/types.ts` (Envelope interface)
- Create `dashboard/src/protocol/whisper-types.ts` (mirror)
- Write RED stubs: `whisper-producer-boundary.test.ts`, `whisper-crypto.test.ts`, `whisper-wire-format.test.ts`, `whisper-rate-limit.test.ts`
- Update STATE.md Accumulated Context with allowlist bump

**Exit:** RED tests fail on missing emitter; doc-sync gate green; type files compile.

### Wave 1 — Crypto core + keyring (cryptographic bedrock)

- `grid/src/whisper/crypto.ts` (libsodium init, encryptFor, hashCiphertext, deriveNonce)
- `brain/src/noesis_brain/whisper/keyring.py`
- `brain/src/noesis_brain/whisper/nonce.py`
- `brain/src/noesis_brain/whisper/key_directory.py`
- Tests: `whisper-crypto.test.ts`, `test_whisper_keyring.py`, `test_whisper_roundtrip.py` (JS↔Python compat fixtures)
- `npm install libsodium-wrappers@0.8.4`; `uv add pynacl==1.6.2` (or equivalent)

**Exit:** Round-trip JS↔Python encrypt/decrypt works with identical keypair bytes from shared seed.

### Wave 2 — Emitter + router + rate limit (Grid producer)

- `appendNousWhispered.ts` (sole producer, 8-step discipline)
- `grid/src/whisper/rate-limit.ts`
- `grid/src/whisper/router.ts` (validates → rate-limit → tombstone → emit → enqueue)
- `grid/src/whisper/pending-store.ts`
- Tests: `whisper-producer-boundary.test.ts` (GREEN now), `whisper-wire-format.test.ts`, `whisper-rate-limit.test.ts`, `whisper-tombstone.test.ts`
- Extend `grid/src/integration/nous-runner.ts` with `case 'whisper_send':`

**Exit:** Producer-boundary test GREEN; tombstone silent-drop verified.

### Wave 3 — API routes + aggregator + trade guard (delivery + Brain side)

- `grid/src/whisper/routes.ts` (Fastify plugin mount)
- Extend `grid/src/dialogue/aggregator.ts` with `channel='whisper'`
- `brain/src/noesis_brain/whisper/sender.py`
- `brain/src/noesis_brain/whisper/receiver.py`
- `brain/src/noesis_brain/whisper/trade_guard.py`
- Tests: `whisper-api.test.ts`, `whisper-aggregator.test.ts`, `test_whisper_trade_guard.py`, `test_whisper_key_directory.py`

**Exit:** End-to-end Nous→Nous whisper flows via HTTP; DialogueAggregator emits hash-only observation on `channel='whisper'`.

### Wave 4 — CI gates + dashboard mirror + determinism + closeout

- `scripts/check-whisper-plaintext.mjs`
- `scripts/check-whisper-runtime-writes.mjs`
- Extend `scripts/check-wallclock-forbidden.mjs` roots
- `dashboard/src/panels/WhisperInspector.tsx` + `dashboard/src/state/whisperStore.ts`
- Tests: `whisper-determinism.test.ts`, `whisper-plaintext-fs-guard.test.ts`
- Update ROADMAP (mark Phase 11 complete), MILESTONES (append), PROJECT (move WHISPER-01..06 to Validated), STATE (reset focus)
- Verify regression hash still stable; if whispers enabled in baseline, rebaseline documented

**Exit:** All CI gates green; dashboard shows counts; all 6 WHISPER REQs validated; doc-sync commit lands.

**Rationale for 5 waves (not 4):** separating emitter (W2) from API+Brain (W3) mirrors Phase 10b's producer/consumer split (appendBios* landed before bios lifecycle orchestration). Collapsing to 4 would overload W3 with both Grid-side emission and Brain-side decryption, and would block aggregator testing behind Brain readiness.

---

## 7. Integration Points

| # | File | Line (approx) | Hook |
|---|------|---------------|------|
| 1 | `grid/src/audit/broadcast-allowlist.ts` | After entry 21 in `ALLOWLIST_MEMBERS` array | Insert `'nous.whispered'`; add `WHISPER_FORBIDDEN_KEYS = Object.freeze([...])`; extend `FORBIDDEN_KEY_PATTERN` regex |
| 2 | `grid/src/integration/nous-runner.ts` | ~line 200 (inside executeActions switch) | Add `case 'whisper_send': await whisperRouter.route(action.envelope, tombstoneCheck); break;` |
| 3 | `grid/src/dialogue/aggregator.ts` | ~line 162 (handleEntry filter) | Widen `if (entry.eventType !== 'nous.spoke') return;` to `if (entry.eventType !== 'nous.spoke' && entry.eventType !== 'nous.whispered') return;`; derive `channel = entry.eventType === 'nous.whispered' ? 'whisper' : 'spoke'`; include channel in buffer key |
| 4 | `grid/src/chronos/wire-listener.ts` | observer registration | Add passive observer subscription for `nous.whispered` if needed for metrics only (counts, never payload fields) |
| 5 | `grid/src/server.ts` (or wherever fastify is constructed) | After existing route plugins | `await fastify.register(whisperRoutes)` |
| 6 | `scripts/check-wallclock-forbidden.mjs` | `TIER_B_TS_ROOTS` const | Append `'grid/src/whisper'` |
| 7 | `scripts/check-state-doc-sync.mjs` | `"21 events"` literal + `required` array | Bump to `"22 events"`; append `'nous.whispered'` |
| 8 | `grid/package.json` | `dependencies` | Add `"libsodium-wrappers": "^0.8.4"` |
| 9 | `brain/pyproject.toml` | `[project] dependencies` | Add `"pynacl>=1.6.2,<2"` |
| 10 | `.planning/STATE.md` | Accumulated Context § allowlist | Bump "21-event allowlist" → "22-event allowlist"; add Phase 11 carry-forward invariants (hash-only whisper boundary, keyring is Brain-only, ciphertext never persists) |

---

## 8. Threat-model & Mitigation Map

| Threat | Description | Mitigation | CI Gate / Test File |
|--------|-------------|------------|---------------------|
| T-10-01 | Operator reads plaintext from persisted audit | Hash-only: chain stores `ciphertext_hash` only; no plaintext ever serialized | `whisper-producer-boundary.test.ts` (FORBIDDEN_KEY_PATTERN check inside payload); `check-whisper-plaintext.mjs` (Tier A) |
| T-10-02 | Operator reads plaintext from in-memory state leaked to disk | In-memory pending-store only; no MySQL/disk persistence; runtime fs.writeFile monkey-patch | `whisper-plaintext-fs-guard.test.ts`; `check-whisper-runtime-writes.mjs` |
| T-10-03 | Operator introduces a Dashboard H5 whisper-inspect RPC | Read-only counts panel only; no inspect button; routes.ts exposes only metrics (counts) | `whisper-api.test.ts` asserts no route returns `nonce_b64` or `ciphertext_b64`; code review + D-11-16 lock |
| T-10-04 | Plaintext leaks through Brain-side log lines | Python log handler scrubs `FORBIDDEN_KEY_PATTERN` fields; trade_guard.py rejects trade literals pre-encrypt | `test_whisper_keyring.py` (no stdout leaks); Tier A gate covers brain/src |
| T-10-05 | Replay attack — same ciphertext re-sent | Nonce is deterministic per (sender, tick, counter); receiver tracks last-seen tick per peer; older-tick whispers silently dropped | `whisper-determinism.test.ts` + router dedup logic |
| T-10-06 | Whisper used to bypass audit on trades (covert settlement channel) | Brain-side trade_guard rejects trade-action literals in plaintext BEFORE encrypt; `trade.*` events still require plaintext audit path | `test_whisper_trade_guard.py` (defense depth); router.ts rejects envelopes whose `from_did` has a pending `trade_request` action at the same tick |

---

## 9. Open Questions / Planner's Judgment

1. **Counter scope (nonce derivation):** Is `counter` reset per-tick (0,1,2,... for each whisper in a tick) or monotonic across sender's lifetime? Phase 10a ChronosListener uses per-tick reset; recommend matching. Confirm in plan.
2. **`nous.whispered` emission timing:** emitter runs on Grid at receive-time (when router validates) vs send-time (when Brain emits action). Recommend **receive-time at router** — matches Phase 10b "sole producer owns emission" pattern. Alternative would require whisper_send to cross the chain boundary twice.
3. **Chronos wire-listener observer:** does Phase 11 need Chronos to observe `nous.whispered`? If metrics-only (counts), yes. If no current metric consumer, defer to Phase 12+.
4. **Python dependency manager:** project uses `uv` based on `pyproject.toml` conventions; confirm exact install command with executor.
5. **libsodium-wrappers or libsodium-wrappers-sumo?** The `-sumo` variant exposes more primitives (including `crypto_sign` etc.). Standard `libsodium-wrappers` is sufficient for `crypto_box_*` — recommend standard.
6. **DialogueAggregator buffer-key collision risk:** if a pair of Nous both `speak` AND `whisper` in the same tick, they produce two separate buffers (different channel). Confirm downstream `telos.refined` consumer treats these as distinct sources.
7. **UI counts aggregation window:** metrics endpoint returns "pending" (live), but "sent"/"received" are cumulative since process start. Planner to choose: cumulative vs last-N-ticks. Recommend cumulative — simpler.

---

## 10. Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Grid framework | vitest (existing) [VERIFIED: grid/package.json, grid/test/bios/*.test.ts] |
| Grid config | `grid/vitest.config.ts` (existing) |
| Grid quick run | `cd grid && npx vitest run test/whisper/ --reporter=dot` |
| Grid full suite | `cd grid && npm test` |
| Brain framework | pytest (existing) [VERIFIED: brain/pyproject.toml testpaths = ["test"]] |
| Brain config | `brain/pyproject.toml` `[tool.pytest.ini_options]` |
| Brain quick run | `cd brain && pytest test/ -k whisper -x` |
| Brain full suite | `cd brain && pytest test/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WHISPER-01 | Two Nous exchange libsodium-encrypted envelopes | integration | `cd grid && npx vitest run test/whisper/whisper-crypto.test.ts test/whisper/whisper-api.test.ts` | ❌ Wave 0/1/2 |
| WHISPER-01 | JS↔Python byte-for-byte compat | integration | `cd brain && pytest test/test_whisper_roundtrip.py -x` | ❌ Wave 1 |
| WHISPER-02 | Operator cannot read plaintext at any tier | static+runtime | `node scripts/check-whisper-plaintext.mjs && node scripts/check-whisper-runtime-writes.mjs` | ❌ Wave 4 |
| WHISPER-02 | No plaintext writes to fs during simulation | runtime | `cd grid && npx vitest run test/whisper/whisper-plaintext-fs-guard.test.ts` | ❌ Wave 4 |
| WHISPER-03 | Audit chain retains ciphertext_hash only | static+unit | `cd grid && npx vitest run test/whisper/whisper-producer-boundary.test.ts test/whisper/whisper-wire-format.test.ts` | ❌ Wave 0 (RED) → Wave 2 (GREEN) |
| WHISPER-04 | `nous.whispered` at allowlist position 22 | static | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts && node scripts/check-state-doc-sync.mjs` | ⚠️ partially (allowlist test exists; state-doc-sync needs bump) |
| WHISPER-05 | Tick-indexed rate limit B=10/N=100 | unit | `cd grid && npx vitest run test/whisper/whisper-rate-limit.test.ts` | ❌ Wave 0 (RED) → Wave 2 (GREEN) |
| WHISPER-06 | Recipient-pull + ack-delete | integration | `cd grid && npx vitest run test/whisper/whisper-api.test.ts` | ❌ Wave 3 |
| — | Determinism / zero-diff | regression | `cd grid && npx vitest run test/whisper/whisper-determinism.test.ts` | ❌ Wave 4 |
| — | Tombstone silent-drop | unit | `cd grid && npx vitest run test/whisper/whisper-tombstone.test.ts` | ❌ Wave 2 |
| — | Sole-producer boundary | static | `cd grid && npx vitest run test/whisper/whisper-producer-boundary.test.ts` | ❌ Wave 0 (RED) → Wave 2 (GREEN) |
| — | Wall-clock ban in whisper trees | static | `node scripts/check-wallclock-forbidden.mjs` | ⚠️ needs roots extended |

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run test/whisper/ --reporter=dot` (or `pytest test/ -k whisper -x` for brain-side tasks)
- **Per wave merge:** `cd grid && npm test && cd ../brain && pytest test/ && node scripts/check-state-doc-sync.mjs && node scripts/check-wallclock-forbidden.mjs && node scripts/check-whisper-plaintext.mjs`
- **Phase gate:** full suite green + `scripts/check-whisper-runtime-writes.mjs` passes + regression hash verified before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/whisper/` directory does not exist — W0 creates it
- [ ] `grid/test/whisper/whisper-producer-boundary.test.ts` — clone of bios-producer-boundary (RED stub)
- [ ] `grid/test/whisper/whisper-crypto.test.ts` — RED stub
- [ ] `grid/test/whisper/whisper-wire-format.test.ts` — RED stub
- [ ] `grid/test/whisper/whisper-rate-limit.test.ts` — RED stub
- [ ] `brain/test/test_whisper_*.py` — all new in W1+
- [ ] `scripts/check-whisper-plaintext.mjs` — new W4
- [ ] `scripts/check-whisper-runtime-writes.mjs` — new W4
- [ ] `scripts/check-wallclock-forbidden.mjs` — root extensions W0
- [ ] `scripts/check-state-doc-sync.mjs` — literal + array bump W0
- [ ] libsodium-wrappers not yet installed: `cd grid && npm install libsodium-wrappers@^0.8.4` (W1)
- [ ] PyNaCl not yet installed: `cd brain && uv add 'pynacl>=1.6.2,<2'` (W1)

### Security Domain

#### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Sender DID is in envelope and signed implicitly via crypto_box (sender priv key) — MAC failure ⇒ auth fail |
| V3 Session Management | no | Stateless envelopes; no sessions |
| V4 Access Control | yes | Recipient-pull endpoint authorizes by DID ownership (Brain holds priv key; Grid cannot impersonate) |
| V5 Input Validation | yes | Envelope shape strictly validated at appendNousWhispered (8-step discipline); DID_RE enforcement |
| V6 Cryptography | yes | **libsodium crypto_box (X25519 + XSalsa20-Poly1305). NEVER hand-roll.** Key derivation via crypto_box_seed_keypair only |
| V7 Error Handling | yes | MAC failure → silent drop (don't leak which DID's key failed); rate-limit → 429 without detail |
| V9 Communication | yes | Envelope over HTTPS (existing Grid infrastructure) |

#### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plaintext leak via log/disk | Information Disclosure | Three-tier CI grep + fs.writeFile monkey-patch (§5.1) |
| Ciphertext tampering | Tampering | Poly1305 MAC (crypto_box_open_easy throws) |
| Nonce reuse | Information Disclosure | Deterministic per-(sender,tick,counter) blake2b nonce (§3.2) |
| Replay | Spoofing | Receiver tracks last-seen tick per peer; older drops |
| Key impersonation | Spoofing | Keys derived from DID seed; directory updated only on bios.birth audit event |
| Covert trade channel | Elevation of Privilege | Brain-side trade_guard pre-encrypt + `trade.*` must still use plaintext audit (T-10-06) |
| DDoS via whisper spam | Denial of Service | Tick-indexed budget (primary) + @fastify/rate-limit (secondary) |
| Post-death whisper | Spoofing | Tombstone gate at router (D-11-18) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Deterministic nonce formula `blake2b(seed ‖ tick_le64 ‖ counter_le32)[:24]` matches project's existing counter discipline | §3.2 | Non-deterministic ciphertexts; regression test fails; rebaseline needed |
| A2 | `crypto_box_easy` (XSalsa20-Poly1305) is byte-compat with PyNaCl `Box` default | §2.1 | JS↔Python interop broken; fallback: both sides use `nacl.bindings.crypto_box_curve25519xsalsa20poly1305` explicitly |
| A3 | `ciphertext_hash` excludes nonce | §3.3 | Determinism test design differs; easily changed |
| A4 | libsodium-wrappers (non-sumo) is sufficient | §2.1 | If more primitives needed later, switch to `-sumo` |
| A5 | WASM cold-start ~30ms acceptable | §2.1 | Grid startup perf impacted; mitigate with ready-at-boot |
| A6 | Counter resets per-tick | §9 Q1 | Nonce collisions if mis-scoped; planner must lock this |
| A7 | `nous.whispered` emitted at receive-time (router) not send-time (Brain) | §9 Q2 | Two different architectural shapes; current plan assumes receive-time |
| A8 | Regression hash `c7c49f49...` unchanged if baseline fixture has zero whispers | §5.2 | If rebaselined, STATE.md + VERIFICATION must document new hash |
| A9 | `uv` is the Python package manager | §9 Q4 | Install command differs (pip / poetry); planner to confirm |
| A10 | Cumulative counts (not windowed) for UI metrics | §9 Q7 | Planner to pick; trivial diff |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled XOR "encryption" | libsodium crypto_box | Since 2014 | Authenticated encryption; nonce-misuse-resistant-ish |
| Sign-then-encrypt | AEAD (Poly1305 MAC inside crypto_box) | 2010s | Single primitive; no padding oracle |
| base64url for wire | base64 for bodies, base64url for URLs | Ongoing | JSON bodies → standard base64 idiomatic |

**Deprecated:**
- `crypto_box` (non-`_easy`) requires zero-padding buffers — do not use.
- `nacl.public.PrivateKey(seed)` in PyNaCl is incompatible with libsodium's `crypto_box_seed_keypair`; use `nacl.bindings.crypto_box_seed_keypair` for cross-lang compat.

---

## Sources

### Primary (HIGH confidence)
- `libsodium-wrappers@0.8.4` registry entry [VERIFIED: `npm view libsodium-wrappers version` → 0.8.4; time.modified 2026-04-19]
- `PyNaCl 1.6.2` PyPI [VERIFIED: `pip index versions pynacl` → 1.6.2 latest]
- `grid/package.json` — `@fastify/rate-limit ^10.0.0` already installed [VERIFIED]
- `grid/src/audit/broadcast-allowlist.ts` — 21-entry authoritative state [VERIFIED]
- `grid/src/bios/appendBiosBirth.ts` — sole-producer 8-step discipline template [VERIFIED]
- `grid/src/bios/appendBiosDeath.ts` — tombstone-gated sole producer template [VERIFIED]
- `grid/test/bios/bios-producer-boundary.test.ts` — producer-boundary grep test template [VERIFIED]
- `grid/src/dialogue/aggregator.ts` — extension line for channel='whisper' [VERIFIED]
- `grid/src/integration/nous-runner.ts` executeActions switch [VERIFIED]
- `.planning/phases/11-mesh-whisper/11-CONTEXT.md` — D-11-01..18 [CITED]
- `.planning/REQUIREMENTS.md` — WHISPER-01..06 [CITED]
- `.planning/STATE.md` — 21-event allowlist + carry-forward invariants [CITED]

### Secondary (MEDIUM confidence)
- libsodium-js README public API shapes [CITED: jedisct1/libsodium.js]
- PyNaCl ReadTheDocs `Box` API [CITED: pynacl.readthedocs.io]
- fastify/fastify-rate-limit README [CITED]

### Tertiary (LOW confidence — flagged)
- Byte-for-byte JS↔Python compat via `nacl.bindings.crypto_box_seed_keypair` — requires fixture verification in W1 (A2 assumption)
- Nonce counter scope (per-tick vs monotonic) — open question Q1

---

## Project Constraints (from CLAUDE.md)

- **Doc-sync rule:** Phase 11 closeout MUST update README (current status), ROADMAP (mark complete), MILESTONES (append), PROJECT (WHISPER-01..06 → Validated), STATE (reset focus + bump allowlist enumeration 21→22), REQUIREMENTS (mark validated), PHILOSOPHY (if hash-only whisper becomes a carry-forward non-negotiable — recommend YES, add it).
- **Allowlist discipline:** exactly one new event this phase (`nous.whispered`). Any accidental additional allowlist addition fails CI.
- **Archive discipline:** Phase 11 directory stays under `.planning/phases/11-mesh-whisper/` until v2.2 milestone closes; then archive to `.planning/phases/archived/v2.2/`.
- **Phase numbering:** continue to 11 (no reset).

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — all deps verified against registries; compat pattern established by Phase 10a/10b precedents
- Architecture: **HIGH** — clones Phase 10a DialogueAggregator extension pattern + Phase 10b sole-producer discipline verbatim
- Wire format: **MEDIUM** — envelope shape locked in CONTEXT; nonce formula A1 needs explicit confirmation
- Pitfalls: **HIGH** — libsodium pitfalls well-documented (sodium.ready, seed_keypair derivation, _easy vs raw)
- Cross-lang compat: **MEDIUM** — A2 assumption verified in spec but requires W1 fixture round-trip test

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days; stack is stable, deps pinned)

---

## RESEARCH COMPLETE

**Phase:** 11 — Mesh Whisper
**Confidence:** HIGH (overall)

### Key Findings
- Two new deps only (`libsodium-wrappers@0.8.4`, `PyNaCl 1.6.2`); `@fastify/rate-limit` already present.
- Cross-lang keypair derivation requires `nacl.bindings.crypto_box_seed_keypair` on Python side, NOT `PrivateKey(seed)` — critical compat gotcha.
- Architecture 100% reuses Phase 10a (DialogueAggregator channel extension) + Phase 10b (sole-producer emitter, tombstone gate, three-tier grep) patterns.
- Recommended 5-wave split: W0 RED+allowlist, W1 crypto, W2 emitter+router, W3 API+Brain, W4 CI gates+dashboard+determinism+closeout.
- 12 new test files, 5 new scripts (2 modified), 19 new source files, 3 modified source files.

### File Created
`/Users/desirey/Programming/src/Noēsis/.planning/phases/11-mesh-whisper/11-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All deps verified via npm / pip registries today |
| Architecture | HIGH | Cloned from shipped Phase 10a/10b precedents |
| Wire Format | MEDIUM | Envelope locked; nonce counter scope (A6) + A1/A2 need W1 fixture validation |
| Pitfalls | HIGH | libsodium gotchas well-documented |
| CI Gates | HIGH | Scripts clone shipped `check-wallclock-forbidden.mjs` / `check-state-doc-sync.mjs` patterns |

### Open Questions
1. Nonce counter scope (per-tick vs monotonic) — Q1
2. Emitter timing (receive-time vs send-time) — Q2
3. Chronos observer needed this phase? — Q3
4. Python package manager (uv / pip / poetry) — Q4
5. DialogueAggregator buffer-key split semantics for downstream telos — Q6
6. UI metrics window (cumulative vs last-N-ticks) — Q7

### Ready for Planning
Research complete. `/gsd-plan-phase 11 --auto` can proceed to produce per-wave PLAN.md files consuming this RESEARCH.md + 11-CONTEXT.md.
