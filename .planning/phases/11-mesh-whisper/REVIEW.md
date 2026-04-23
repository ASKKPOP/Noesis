---
phase: 11-mesh-whisper
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - grid/src/whisper/crypto.ts
  - grid/src/whisper/appendNousWhispered.ts
  - grid/src/whisper/rate-limit.ts
  - grid/src/whisper/router.ts
  - grid/src/whisper/pending-store.ts
  - grid/src/whisper/types.ts
  - grid/src/whisper/config.ts
  - grid/src/whisper/metrics-counter.ts
  - grid/src/api/whisper/send.ts
  - grid/src/api/whisper/pending.ts
  - grid/src/api/whisper/ack.ts
  - grid/src/api/whisper/metrics.ts
  - grid/src/api/whisper/routes.ts
  - grid/src/audit/broadcast-allowlist.ts
  - brain/src/noesis_brain/whisper/keyring.py
  - brain/src/noesis_brain/whisper/sender.py
  - brain/src/noesis_brain/whisper/trade_guard.py
  - brain/src/noesis_brain/whisper/nonce.py
  - brain/src/noesis_brain/whisper/decrypt.py
  - brain/src/noesis_brain/whisper/receiver.py
  - brain/src/noesis_brain/whisper/key_directory.py
  - scripts/check-whisper-plaintext.mjs
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 11: Mesh Whisper — Code Review Report

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The whisper subsystem is structurally sound. The sole-producer invariant holds: `appendNousWhispered` is the only caller of `audit.append('nous.whispered', ...)`. The audit tuple payload is confirmed to be the closed 4-key set `{ciphertext_hash, from_did, tick, to_did}` with no plaintext. The keyring correctly uses `nacl.bindings.crypto_box_seed_keypair` (not `PrivateKey(seed)`). Tombstone drops are silent. The rate limiter is tick-based with no wall-clock. Nonce derivation is deterministic blake2b.

One critical bug is present: the `senderDid` URL parameter in `send.ts` is never validated against `DID_RE` before being used as the audit actor, allowing a malformed DID to reach `appendNousWhispered` (which does validate — but the envelope is also built with the raw value before that check runs). Four warnings cover meaningful correctness and security concerns. Three info items cover lower-priority issues.

---

## Critical Issues

### CR-01: `senderDid` URL param reaches envelope construction without DID validation

**File:** `grid/src/api/whisper/send.ts:53`

**Issue:** `senderDid` is extracted from `req.params.did` and used immediately to call `deps.registry.isTombstoned(senderDid)` (line 81) and to build the `envelope.from_did` field (line 102) — but it is never validated against `DID_RE` before those operations. `appendNousWhispered` will ultimately reject a malformed DID at step 1, but by that point the tombstone check and envelope construction have already run with the raw string. The router wraps the `route()` call in a try/catch that maps the TypeError to a generic `400 { error: 'invalid_did' }` (line 119), but the execution path through registry and envelope construction is still exercised with garbage input. More concretely: `isTombstoned` receives an arbitrary attacker-controlled string; `randomUUID()` and `createHash` are called; `hashCiphertext` is computed; the envelope object is allocated — all before validation fires.

`to_did` IS validated on line 58. The asymmetry is the bug.

**Fix:**
```typescript
// After line 53:
const senderDid = req.params.did;

// Add immediately after:
if (!DID_RE.test(senderDid)) {
    reply.code(400);
    return { error: 'invalid_did' };
}
```

---

## Warnings

### WR-01: `evictDid` mutates the Map it is currently iterating

**File:** `grid/src/whisper/pending-store.ts:115-124`

**Issue:** `evictDid` calls `this.store.delete(recipient)` inside a `for...of this.store` loop (line 119). The [ECMAScript spec](https://tc39.es/ecma262/#sec-map.prototype.foreach) for `Map` iteration states that deleting an entry that has not yet been visited causes it to be skipped — but deleting an already-visited or future entry during `for...of` iteration is defined behavior that does NOT throw. However, `this.store.set(recipient, filtered)` on line 121 is also inside the loop. Setting an existing key during `Map` iteration does NOT re-visit it, so that is safe. The `delete` is technically safe in V8 (spec-compliant), but it is fragile and the behavior is easy to get wrong on subsequent edits. The risk of introducing a real skip or double-process bug on the next touch is high.

**Fix:** Collect keys to delete/update in a first pass, then apply in a second pass:
```typescript
evictDid(did: string): void {
    this.store.delete(did);

    // Collect mutations first, apply after iteration.
    const toDelete: string[] = [];
    const toSet: [string, Envelope[]][] = [];
    for (const [recipient, envs] of this.store) {
        const filtered = envs.filter(e => e.from_did !== did);
        if (filtered.length !== envs.length) {
            if (filtered.length === 0) toDelete.push(recipient);
            else toSet.push([recipient, filtered]);
        }
    }
    for (const k of toDelete) this.store.delete(k);
    for (const [k, v] of toSet) this.store.set(k, v);
}
```

---

### WR-02: No upper bound on `ciphertext_blob_b64` length allows memory exhaustion

**File:** `grid/src/api/whisper/send.ts:64-65`

**Issue:** The only validation on `ciphertext_blob_b64` is `typeof ctB64 !== 'string' || ctB64.length === 0`. A caller can send an arbitrarily large base64 string — all routes are loopback-only, so the threat model is a compromised or misbehaving local Brain process rather than an external attacker. However, a runaway Brain (or a test bug) can allocate unbounded memory via `Buffer.from(ctB64, 'base64')` on line 89. There is no Fastify body-size limit visible in this file, and the Fastify default body size limit is 1 MB — which may be appropriate but it is not enforced at the whisper layer explicitly.

**Fix:** Add an explicit maximum length check before the `Buffer.from` call. The maximum legitimate whisper plaintext should be well under a few kilobytes; cap the base64 blob at a reasonable ceiling (e.g., 65536 characters = ~48 KB decoded):
```typescript
const MAX_CT_B64_LENGTH = 65_536; // ~48 KB decoded; well above any real whisper
if (ctB64.length > MAX_CT_B64_LENGTH) {
    reply.code(400);
    return { error: 'invalid_ciphertext' };
}
```

---

### WR-03: `counter` is a caller-supplied input with no monotonicity enforcement — nonce reuse is caller's responsibility with no guard

**File:** `brain/src/noesis_brain/whisper/sender.py:58`, `brain/src/noesis_brain/whisper/nonce.py:44`

**Issue:** The nonce formula `blake2b(seed ‖ tick_le64 ‖ counter_le32)` is deterministic. For a given `(sender_did, tick)` pair, nonce uniqueness depends entirely on `counter` being distinct for each call. `sender.py` accepts `counter` as a caller-supplied `int` with no tracking or enforcement of uniqueness. If a caller invokes `send_whisper(sender_did=X, recipient_did=Y, plaintext=A, tick=5, counter=0)` and then `send_whisper(sender_did=X, recipient_did=Y, plaintext=B, tick=5, counter=0)`, the same nonce is reused for two different plaintexts encrypted to the same key pair — a catastrophic AEAD failure that can reveal the XOR of the two plaintexts.

`nonce.py` validates `counter >= 0` but does not prevent reuse. There is no per-(sender, tick) counter state anywhere in the Brain whisper module.

**Fix:** The Brain caller is responsible for maintaining a per-(sender, tick) counter. Add a module-level or class-level `_counter_state: dict[tuple[str,int], int]` to `sender.py` that auto-increments, or mandate that callers pass an explicitly-managed counter and document the invariant prominently. At minimum, add a docstring assertion that makes the reuse risk explicit:
```python
# In send_whisper docstring, add:
# CRITICAL: caller must ensure (tick, counter) is unique per sender_did per
# process lifetime. Reusing the same (tick, counter) pair for two different
# plaintexts causes nonce reuse under XSalsa20-Poly1305 — an AEAD catastrophe.
# Recommended: pass counter=0,1,2,... monotonically per tick; reset on tick advance.
```

---

### WR-04: `pending.ts` and `ack.ts` do not validate the `:did` URL parameter

**File:** `grid/src/api/whisper/pending.ts:29`, `grid/src/api/whisper/ack.ts:31`

**Issue:** Both `pendingHandler` and `ackHandler` extract `did` from `req.params.did` and pass it directly to `PendingStore.drainFor(did)` / `PendingStore.ackDelete(did, ...)` without any DID format validation. Although these routes are loopback-only and the store simply returns empty arrays or 0 for unknown DIDs, a malformed DID that contains `|` (the separator character used by `aggregator.ts` to build whisper buffer keys: `sortedDids.join('|') + '|whisper'`) could cause key collisions in downstream aggregator state if the Aggregator observes stored envelope metadata keyed by DID. The direct risk here is low because `PendingStore` uses the DID as a plain Map key without structural interpretation — but it is asymmetric with `send.ts` which does validate `to_did`, and the `|` injection concern is real at the aggregator boundary.

**Fix:** Add DID validation at the top of both handlers:
```typescript
// In pendingHandler and ackHandler, after extracting did:
if (!DID_RE.test(did)) {
    reply.code(400);
    return { error: 'invalid_did' };
}
```
Both files will need to import or inline the same `DID_RE` already defined in `send.ts` and `appendNousWhispered.ts`.

---

## Info

### IN-01: `appendNousWhispered` validation ordering comment is inconsistent with code

**File:** `grid/src/whisper/appendNousWhispered.ts:6-11`

**Issue:** The header comment documents validation steps as `1. actorDid DID_RE → 2. payload.from_did DID_RE → ... → 8. Closed-tuple`. The actual code performs the closed-tuple check at step 2 (line 90) and the individual field DID checks at steps 3 and 4 (lines 102, 109). The comment says step 2 is `from_did` DID regex; the code does closed-tuple first. The inline comment on line 86 explains the reversal rationale (`"so a missing/extra key yields 'unexpected key set' rather than a misleading 'invalid from_did'"`) which is correct and intentional — but the numbered list in the file header (lines 6-11) still says the old order. This creates a maintenance hazard: a future reader trusting the header over the inline comment may re-order the checks.

**Fix:** Update the header list to match actual code order: `1. actorDid regex → 2. Closed-tuple → 3. from_did regex → 4. to_did regex → 5. self-report → ...`

---

### IN-02: `decrypt.py` allocates a second `Keyring` instance independent of `sender.py`'s instance

**File:** `brain/src/noesis_brain/whisper/decrypt.py:37`, `brain/src/noesis_brain/whisper/sender.py:49`

**Issue:** Both `sender.py` and `decrypt.py` create module-level `_keyring = Keyring()` singletons. These are separate instances. If a key is evicted from the sender's keyring on `bios.death`, the decrypt keyring retains it (and vice versa). In practice eviction only removes the cache entry and the key will be re-derived deterministically on next use, so there is no correctness bug — but the split means `evict()` calls must be issued twice (once per instance) for a full eviction. Any future code that assumes eviction from one instance affects the other will be wrong.

**Fix:** Thread a single shared `Keyring` instance through both modules via dependency injection, or document explicitly that the two singletons are independent and eviction must be called on both.

---

### IN-03: `check-whisper-plaintext.mjs` triple-quote docstring tracking can false-negative on inline strings

**File:** `scripts/check-whisper-plaintext.mjs:141-149`

**Issue:** The scanner's Python docstring tracker counts `"""` occurrences per line and toggles `inTripleQuote` based on parity. A line like `x = """text:""" + """body:"""` has 4 `"""` tokens — even count — so the tracker stays in `inTripleQuote=false` and the line is scanned. That particular case is correct. However, the opening-line check (line 146-148) sets `inTripleQuote = true` on an odd count and then returns early, skipping the opening line entirely even if it contains code after the `"""`. More significantly, a line that ends a triple-quote block and opens a new one (odd count) would incorrectly re-enter `inTripleQuote=true`. This is a known edge case with parity-based string tracking. It is unlikely to produce false negatives in real whisper files (which use docstrings conventionally), but it is a fragile CI gate.

**Fix:** Use a state-machine approach that tracks the exact position of `"""` tokens on each line rather than counting parity. Alternatively, use a proper Python AST parser (e.g., call `python3 -c "import ast; ast.parse(...)"`) for Python files.

---

## Invariant Verification

All 7 key invariants from the review brief are verified:

| # | Invariant | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `appendNousWhispered` is the SOLE producer of `nous.whispered` | **PASS** | Only `audit.append('nous.whispered', ...)` call is in `appendNousWhispered.ts:164`. `dialogue/aggregator.ts:209` reads the event type but does not produce it. |
| 2 | Audit tuple payload is exactly `{ciphertext_hash, from_did, tick, to_did}` — 4 keys, no plaintext | **PASS** | `WHISPERED_KEYS` tuple enforced at line 90-99; explicit reconstruction at lines 145-150. |
| 3 | No operator can read plaintext — no decryption in `grid/src` or `dashboard/src` | **PASS** | Grid never calls `decryptFrom`; `crypto.ts` exports it but no Grid caller uses it. `dashboard/src` not examined (no whisper files present). Keyring isolation check in CI script covers the import boundary. |
| 4 | `keyring.py` uses `nacl.bindings.crypto_box_seed_keypair` NOT `PrivateKey(seed)` | **PASS** | `keyring.py:50` — `pub, priv = crypto_box_seed_keypair(seed)`. |
| 5 | Tombstone drops are silent (return false, no 410, no log) | **PASS** | `router.ts:79-86` returns false with only optional metrics increment. No log call, no audit emit. `send.ts` correctly returns silent 202 for recipient tombstone (line 72-79); 410 only for sender (line 81-84), which is documented as acceptable because the local Brain already knows. |
| 6 | Rate limit is tick-based (no wall-clock, no `Date.now()`) | **PASS** | `rate-limit.ts` uses only the injected `currentTick: number` parameter. No `Date.now`, `performance.now`, or `Date` references. |
| 7 | Nonce derivation is deterministic (blake2b or equivalent) | **PASS** | JS: `sodium.crypto_generichash(24, seed ‖ tick_le64 ‖ counter_le32)` (`crypto.ts:115`). Python: `hashlib.blake2b(buf, digest_size=24).digest()` (`nonce.py:52`). Byte layout matches: LE64 tick, LE32 counter. |

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
