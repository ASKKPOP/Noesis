---
phase: 11
plan_slug: 01-crypto
wave_number: 1
type: execute
gap_closure: false
depends_on: [11-00-setup]
files_modified:
  - grid/package.json
  - grid/package-lock.json
  - brain/pyproject.toml
  - brain/uv.lock
  - grid/src/whisper/crypto.ts
  - brain/src/noesis_brain/whisper/nonce.py
  - brain/src/noesis_brain/whisper/keyring.py
  - brain/src/noesis_brain/whisper/key_directory.py
  - grid/test/whisper/whisper-crypto.test.ts
  - grid/test/whisper/whisper-keyring.test.ts
  - brain/test/whisper/__init__.py
  - brain/test/whisper/test_keyring.py
  - brain/test/whisper/test_nonce.py
  - brain/test/whisper/test_key_directory.py
  - brain/test/whisper/test_roundtrip.py
  - brain/test/fixtures/whisper/js-encrypted-envelope.json
  - brain/test/fixtures/whisper/py-encrypted-envelope.json
autonomous: true
requirements: [WHISPER-01, WHISPER-02]
must_haves:
  truths:
    - "libsodium-wrappers@^0.8.4 installed in grid; PyNaCl>=1.6.2 installed in brain"
    - "grid/src/whisper/crypto.ts exports initSodium (memoized), encryptFor, decryptFrom, hashCiphertext, deriveNonce — all deterministic, no wall-clock, no Math.random"
    - "brain/src/noesis_brain/whisper/nonce.py derive_nonce(seed:bytes, tick:int, counter:int) -> bytes[24] produces byte-identical output to grid/src/whisper/crypto.ts deriveNonce for same inputs"
    - "brain/src/noesis_brain/whisper/keyring.py Keyring.pub_for(did) / .encrypt_for(peer_did, plaintext, tick, counter) / .decrypt_from(envelope) — seeded via sha256(did)[:32] via nacl.bindings.crypto_box_seed_keypair (NOT PrivateKey(seed))"
    - "Same DID → byte-identical (pub, priv) across JS (libsodium-wrappers) and Python (nacl.bindings.crypto_box_seed_keypair)"
    - "brain/src/noesis_brain/whisper/key_directory.py KeyDirectory observes bios.birth events → caches Dict[did, pub_bytes]; bios.death prunes; never writes to disk"
    - "Fixture round-trip: JS-encrypted envelope decrypts successfully in Python; Python-encrypted envelope decrypts successfully in JS; both yield identical plaintext bytes"
    - "MAC failure raises (not silently returns garbage) on both sides"
    - "Private key material never appears in any on-disk file (no key persistence); keyring re-derives from sha256(did)[:32] on every instance construction"
    - "Wave 0 whisper-crypto.test.ts RED stub is now GREEN"
  artifacts:
    - path: "grid/src/whisper/crypto.ts"
      provides: "libsodium wrapper — encrypt/decrypt/nonce/hash helpers"
      contains: "crypto_box_seed_keypair"
    - path: "brain/src/noesis_brain/whisper/keyring.py"
      provides: "Brain-scoped per-DID keyring"
      contains: "crypto_box_seed_keypair"
    - path: "brain/src/noesis_brain/whisper/nonce.py"
      provides: "derive_nonce blake2b helper — byte-identical with JS side"
      contains: "blake2b"
    - path: "brain/src/noesis_brain/whisper/key_directory.py"
      provides: "Observer on bios.birth → Dict[did, pub_bytes]; bios.death prune"
      contains: "on_bios_birth"
    - path: "brain/test/fixtures/whisper/js-encrypted-envelope.json"
      provides: "JS-produced envelope fixture with known seeds (ALL test DIDs, not real)"
      contains: "ciphertext_b64"
    - path: "brain/test/fixtures/whisper/py-encrypted-envelope.json"
      provides: "Python-produced envelope fixture"
      contains: "ciphertext_b64"
  key_links:
    - from: "grid/src/whisper/crypto.ts"
      to: "brain/src/noesis_brain/whisper/keyring.py"
      via: "byte-compatible crypto_box wire format (shared libsodium C core)"
      pattern: "crypto_box_seed_keypair"
    - from: "brain/src/noesis_brain/whisper/nonce.py"
      to: "grid/src/whisper/crypto.ts"
      via: "deriveNonce(seed, tick, counter) produces identical 24-byte nonce"
      pattern: "blake2b"
    - from: "brain/src/noesis_brain/whisper/key_directory.py"
      to: "brain/src/noesis_brain/bios/runtime.py"
      via: "BiosRuntime observer triggers on_bios_birth / on_bios_death callbacks"
      pattern: "bios.birth"
---

<objective>
Land the cryptographic bedrock: install libsodium-wrappers on Grid and PyNaCl on Brain; ship `grid/src/whisper/crypto.ts` + `brain/src/noesis_brain/whisper/{nonce,keyring,key_directory}.py` implementing deterministic X25519 keypair derivation, deterministic blake2b nonces, XSalsa20-Poly1305 AEAD via `crypto_box_easy` / PyNaCl `Box`, and a Brain-observer-built public-key directory seeded from the `bios.birth` audit stream. Turn the Wave 0 `whisper-crypto.test.ts` RED stub GREEN. Prove JS↔Python byte-for-byte compatibility via two fixture envelopes round-tripped in `brain/test/whisper/test_roundtrip.py`.

Purpose: Before any producer or router lands, the encryption core must be proven deterministic, cross-language compatible, and free of wall-clock / random-source entropy. The single most likely failure mode is RESEARCH §2.2 A2 — `PrivateKey(seed)` divergence from `crypto_box_seed_keypair(seed)`. This wave pins both sides to the libsodium-style derivation and verifies it with a byte-compat fixture test.

Output: 2 dependency bumps, 1 new Grid source file, 3 new Brain source files, 2 new Grid test files, 4 new Brain test files (+ __init__.py), 2 fixture JSON files. Zero new allowlist entries; zero new audit events emitted.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/11-mesh-whisper/11-CONTEXT.md
@.planning/phases/11-mesh-whisper/11-RESEARCH.md
@.planning/phases/11-mesh-whisper/11-PATTERNS.md
@.planning/phases/11-mesh-whisper/11-VALIDATION.md
@.planning/phases/11-mesh-whisper/11-00-setup/PLAN.md

<interfaces>
<!-- Critical compat gotcha — RESEARCH §2.2: DO NOT use PyNaCl PrivateKey(seed). -->

**JS side (grid/src/whisper/crypto.ts):**
```ts
import sodium from 'libsodium-wrappers';

let _readyPromise: Promise<typeof sodium> | null = null;
export function initSodium(): Promise<typeof sodium> {
  if (_readyPromise) return _readyPromise;
  _readyPromise = sodium.ready.then(() => sodium);
  return _readyPromise;
}

export async function keypairFromDid(did: string): Promise<{publicKey: Uint8Array; privateKey: Uint8Array}> {
  const s = await initSodium();
  // Seed = sha256(did)[:32]; libsodium's crypto_box_seed_keypair does the X25519 clamp internally.
  const seedHash = s.crypto_hash_sha256(s.from_string(did));  // 32 bytes
  const seed = seedHash.slice(0, 32);
  const kp = s.crypto_box_seed_keypair(seed);
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

export async function deriveNonce(senderPrivSeed: Uint8Array, tick: number, counter: number): Promise<Uint8Array> {
  const s = await initSodium();
  const tickBuf = new Uint8Array(8);
  new DataView(tickBuf.buffer).setBigUint64(0, BigInt(tick), /*littleEndian*/ true);
  const ctrBuf = new Uint8Array(4);
  new DataView(ctrBuf.buffer).setUint32(0, counter, /*littleEndian*/ true);
  const input = new Uint8Array(senderPrivSeed.length + 8 + 4);
  input.set(senderPrivSeed, 0);
  input.set(tickBuf, senderPrivSeed.length);
  input.set(ctrBuf, senderPrivSeed.length + 8);
  return s.crypto_generichash(24, input);  // blake2b, 24-byte output
}

export async function encryptFor(
  recipientPub: Uint8Array,
  senderPriv: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const s = await initSodium();
  return s.crypto_box_easy(plaintext, nonce, recipientPub, senderPriv);
}

export async function decryptFrom(
  senderPub: Uint8Array,
  recipientPriv: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const s = await initSodium();
  return s.crypto_box_open_easy(ciphertext, nonce, senderPub, recipientPriv);  // throws on MAC fail
}

export async function hashCiphertext(ciphertext: Uint8Array): Promise<string> {
  const s = await initSodium();
  const h = s.crypto_hash_sha256(ciphertext);
  return Array.from(h).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Python side — `brain/src/noesis_brain/whisper/keyring.py`:**
```python
# CRITICAL: use nacl.bindings.crypto_box_seed_keypair, NOT PrivateKey(seed).
# Reason: PrivateKey(seed) treats seed as the raw X25519 scalar (no sha512 pre-hash).
# libsodium.js crypto_box_seed_keypair hashes seed with sha512 internally and uses
# the first 32 bytes as the clamped scalar. The two paths produce DIFFERENT keypairs.
# See RESEARCH.md §2.2 A2.
import hashlib
from typing import Any
from nacl.bindings import crypto_box_seed_keypair, crypto_box, crypto_box_open

class Keyring:
    def __init__(self) -> None:
        self._pub: dict[str, bytes] = {}
        self._priv: dict[str, bytes] = {}

    def _ensure(self, did: str) -> None:
        if did in self._pub:
            return
        seed = hashlib.sha256(did.encode("utf-8")).digest()[:32]  # 32 bytes
        pub, priv = crypto_box_seed_keypair(seed)
        self._pub[did] = pub
        self._priv[did] = priv

    def pub_for(self, did: str) -> bytes:
        self._ensure(did)
        return self._pub[did]

    def priv_seed_for(self, did: str) -> bytes:
        # Used ONLY internally for deriveNonce — never leaves this module.
        return hashlib.sha256(did.encode("utf-8")).digest()[:32]

    def encrypt_for(self, sender_did: str, recipient_pub: bytes, plaintext: bytes, nonce: bytes) -> bytes:
        self._ensure(sender_did)
        return crypto_box(plaintext, nonce, recipient_pub, self._priv[sender_did])

    def decrypt_from(self, recipient_did: str, sender_pub: bytes, ciphertext: bytes, nonce: bytes) -> bytes:
        self._ensure(recipient_did)
        return crypto_box_open(ciphertext, nonce, sender_pub, self._priv[recipient_did])

    def evict(self, did: str) -> None:
        """Called on bios.death from outside; zero-out key material refs."""
        self._pub.pop(did, None)
        self._priv.pop(did, None)
```

**`brain/src/noesis_brain/whisper/nonce.py`:**
```python
import hashlib

def derive_nonce(sender_priv_seed: bytes, tick: int, counter: int) -> bytes:
    if len(sender_priv_seed) != 32:
        raise ValueError("sender_priv_seed must be 32 bytes")
    if tick < 0:
        raise ValueError("tick must be non-negative")
    if counter < 0:
        raise ValueError("counter must be non-negative")
    buf = sender_priv_seed + tick.to_bytes(8, "little") + counter.to_bytes(4, "little")
    return hashlib.blake2b(buf, digest_size=24).digest()
```

**`brain/src/noesis_brain/whisper/key_directory.py` (observer pattern):**
```python
from dataclasses import dataclass, field

@dataclass
class KeyDirectory:
    _pubkeys: dict[str, bytes] = field(default_factory=dict)

    def on_bios_birth(self, did: str, pub_bytes: bytes) -> None:
        self._pubkeys[did] = pub_bytes

    def on_bios_death(self, did: str) -> None:
        self._pubkeys.pop(did, None)

    def pub_for(self, did: str) -> bytes | None:
        return self._pubkeys.get(did)
```

Subscription to the audit stream lives in whatever Brain-side module owns bios observation (reuse the existing `brain/src/noesis_brain/bios/runtime.py` hook — KeyDirectory is one more subscriber). This wave ONLY ships KeyDirectory itself; Wave 3 wires it into BiosRuntime.

**Cross-language byte-compat proof (`brain/test/whisper/test_roundtrip.py`):**

Use two fixture JSONs generated deterministically at test time (not stored as hand-edited JSON — generate via a pytest fixture so regeneration is reproducible). Each fixture records: `{sender_did, recipient_did, tick, counter, plaintext_b64, nonce_b64, ciphertext_b64, sender_pub_b64, recipient_pub_b64}`.

- `js-encrypted-envelope.json` is generated by a Node helper script the first time the test runs (or pre-committed after the initial run). Helper: `grid/scripts/gen-whisper-jsfixture.mjs` spawning `grid/src/whisper/crypto.ts` via ts-node or pre-compiled JS; writes to `brain/test/fixtures/whisper/`.
- `py-encrypted-envelope.json` is generated by the Python test itself (Python encrypt → save → JS decrypt in a later JS test OR via inline subprocess call).

Both fixture files MUST include a header comment (or metadata field) stating "GENERATED — DO NOT EDIT; regenerate via `pytest brain/test/whisper/test_roundtrip.py --regen-fixtures`".

**Known pitfalls:**
1. `crypto_box_easy` (JS) vs `crypto_box` (Python low-level binding): both are XSalsa20-Poly1305 and byte-compatible with each other. Do NOT use PyNaCl's `Box.encrypt` convenience API — it prepends the nonce to ciphertext, breaking strict byte equality. Use `nacl.bindings.crypto_box(plaintext, nonce, pub, priv)` which returns JUST the ciphertext.
2. libsodium `crypto_box_easy` also returns JUST the ciphertext (no nonce prepended). So the two outputs match byte-for-byte when inputs match.
3. `crypto_hash_sha256` on the DID string must use UTF-8 encoding on both sides (`from_string` in libsodium-js yields UTF-8 bytes; Python `did.encode("utf-8")` matches).
4. Nonce endianness: little-endian on both sides. JS `DataView.setBigUint64(0, BigInt(tick), true)` matches Python `tick.to_bytes(8, "little")`.
5. libsodium-wrappers is the non-`-sumo` variant — sufficient for `crypto_box_*` + `crypto_generichash` + `crypto_hash_sha256` + `crypto_box_seed_keypair` (RESEARCH §2.1 A4). Do NOT install `libsodium-wrappers-sumo` unless a later wave proves need.
6. `await sodium.ready` is mandatory before ANY libsodium call. `initSodium()` memoizes the ready promise so subsequent calls resolve instantly. Call `await initSodium()` in every public function entry.

**Install commands:**
- `cd grid && npm install libsodium-wrappers@^0.8.4` — updates package.json + package-lock.json.
- `cd brain && uv add 'pynacl>=1.6.2,<2'` — updates pyproject.toml + uv.lock. If `uv` is not the package manager, fall back to `pip install 'pynacl>=1.6.2,<2'` + manual pyproject.toml edit; executor inspects `brain/pyproject.toml` header to decide.

**Types already shipped in Wave 0:** `grid/src/whisper/types.ts` and `brain/src/noesis_brain/whisper/types.py` — import from these, do NOT redefine.
</interfaces>
</context>

<tasks>

<task id="11-W1-01" type="auto" tdd="false">
  <name>Task 11-W1-01: Install libsodium-wrappers (grid) + PyNaCl (brain)</name>
  <requirement>WHISPER-01</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/package.json, grid/package-lock.json, brain/pyproject.toml, brain/uv.lock</files>
  <behavior>
    - grid/package.json dependencies includes "libsodium-wrappers": "^0.8.4"
    - grid/package-lock.json reflects the addition (committed lockfile)
    - brain/pyproject.toml dependencies includes pynacl>=1.6.2,<2 (or equivalent spec)
    - brain/uv.lock reflects the addition (committed lockfile) OR brain/requirements.txt if uv not used
    - `cd grid && npm ci && npx vitest run test/audit/ --reporter=dot` — existing allowlist test remains green
    - `cd brain && pytest test/ -k 'not whisper' -x` — existing tests remain green
    - No runtime code imports the new libs yet (install-only task)
  </behavior>
  <action>
Run `cd grid && npm install libsodium-wrappers@^0.8.4`. Inspect `brain/pyproject.toml` to determine the Python package manager (look for `[tool.uv]`, `[tool.poetry]`, or plain `[project]` with requirements.txt); use the matching install command (`uv add 'pynacl>=1.6.2,<2'`, `poetry add 'pynacl>=1.6.2,<2'`, or `pip install ... && edit pyproject.toml manually + requirements.txt`). Commit BOTH the manifest AND the lockfile. Do NOT install `libsodium-wrappers-sumo` (non-sumo is sufficient per RESEARCH §2.1).

Verify the installs by running a throwaway `node -e "require('libsodium-wrappers').ready.then(()=>console.log('ok'))"` and `python -c "import nacl.bindings; print('ok')"` at the shell. These probes are NOT tests, just install-validation.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; node -e "require('libsodium-wrappers').ready.then(()=>console.log('ok'))" &amp;&amp; cd ../brain &amp;&amp; python -c "from nacl.bindings import crypto_box_seed_keypair; print('ok')"</automated>
  </verify>
  <done>
    Both probes print "ok"; manifests + lockfiles committed; pre-existing test suites still green.
  </done>
</task>

<task id="11-W1-02" type="auto" tdd="true">
  <name>Task 11-W1-02: Ship grid/src/whisper/crypto.ts — deterministic libsodium wrapper (turns whisper-crypto.test.ts RED→GREEN)</name>
  <requirement>WHISPER-01, WHISPER-02</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/src/whisper/crypto.ts, grid/test/whisper/whisper-crypto.test.ts</files>
  <behavior>
    - `initSodium()` memoizes the ready promise (second call resolves synchronously via the cached promise)
    - `keypairFromDid('did:noesis:abc')` returns deterministic (publicKey, privateKey) — same DID twice → byte-identical output
    - `keypairFromDid('did:noesis:abc')` !== `keypairFromDid('did:noesis:xyz')` (distinct DIDs → distinct keypairs)
    - `deriveNonce(seed, 0, 0)` returns a 24-byte Uint8Array; same inputs twice → byte-identical output
    - `deriveNonce(seed, 42, 0) !== deriveNonce(seed, 42, 1)` (counter scope respected)
    - `encryptFor(recipientPub, senderPriv, nonce, plaintext)` returns ciphertext where `ciphertext.length === plaintext.length + 16` (Poly1305 MAC)
    - `decryptFrom(senderPub, recipientPriv, nonce, ciphertext)` returns the original plaintext bytes
    - `decryptFrom` with MAC-corrupted ciphertext THROWS (not silent return of garbage)
    - `hashCiphertext(ct)` returns 64-char lowercase hex string matching /^[0-9a-f]{64}$/
    - No `Date.now`, `Math.random`, `performance.now`, `setTimeout`, `setInterval` appear anywhere in crypto.ts
  </behavior>
  <action>
Implement `grid/src/whisper/crypto.ts` exactly per &lt;interfaces&gt; block. Replace Wave 0's RED stub `grid/test/whisper/whisper-crypto.test.ts` with a real test suite:
- describe('initSodium'): memoization (second call === first)
- describe('keypairFromDid'): determinism (same DID twice), distinctness (two DIDs)
- describe('deriveNonce'): determinism, counter-scope, tick-scope, length=24
- describe('encryptFor + decryptFrom'): round-trip, length math, MAC-failure throws
- describe('hashCiphertext'): 64-hex, determinism, different ciphertexts → different hashes

Use plaintext fixtures like `new TextEncoder().encode('hello whisper')` — NOT strings containing forbidden-key literals. `check-wallclock-forbidden.mjs` will scan this file; verify it stays clean.

After writing, run `cd grid && npx vitest run test/whisper/whisper-crypto.test.ts` and iterate until green. Then run `node scripts/check-wallclock-forbidden.mjs` — must exit 0.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-crypto.test.ts --reporter=dot &amp;&amp; cd .. &amp;&amp; node scripts/check-wallclock-forbidden.mjs</automated>
  </verify>
  <done>
    whisper-crypto.test.ts all green; wall-clock gate still passes; MAC-failure case throws (not returns garbage).
  </done>
</task>

<task id="11-W1-03" type="auto" tdd="true">
  <name>Task 11-W1-03: Ship Brain-side crypto trio (nonce.py + keyring.py + key_directory.py) + tests</name>
  <requirement>WHISPER-01</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>brain/src/noesis_brain/whisper/nonce.py, brain/src/noesis_brain/whisper/keyring.py, brain/src/noesis_brain/whisper/key_directory.py, brain/test/whisper/__init__.py, brain/test/whisper/test_keyring.py, brain/test/whisper/test_nonce.py, brain/test/whisper/test_key_directory.py</files>
  <behavior>
    - `derive_nonce(seed, tick, counter)` → 24-byte output; determinism; counter+tick scope; rejects len(seed)!=32, negative tick, negative counter
    - `Keyring._ensure(did)` uses `nacl.bindings.crypto_box_seed_keypair(sha256(did)[:32])` — NOT `PrivateKey(seed)`
    - Same DID twice → byte-identical pub bytes
    - `Keyring.encrypt_for` + `Keyring.decrypt_from` round-trip succeeds on valid envelope
    - `Keyring.decrypt_from` raises `nacl.exceptions.CryptoError` on MAC-corrupted ciphertext
    - `Keyring.evict(did)` zero-outs `_pub` and `_priv` entries for that DID
    - `KeyDirectory.on_bios_birth(did, pub)` → `pub_for(did)` returns the bytes
    - `KeyDirectory.on_bios_death(did)` → `pub_for(did)` returns None afterward
    - Python tests pass: `cd brain && pytest test/whisper/ -x`
    - No `time.time`, `datetime.now`, `random.random`, `uuid.uuid4`, `perf_counter` in any of the three source files (wall-clock gate)
    - `scripts/check-wallclock-forbidden.mjs` still exits 0
  </behavior>
  <action>
Implement `nonce.py`, `keyring.py`, `key_directory.py` per &lt;interfaces&gt; block. Write three corresponding test files:
- `test_nonce.py`: determinism, tick scope, counter scope, 24-byte length, input validation (rejects non-32-byte seed, negative tick/counter).
- `test_keyring.py`: keypair determinism (same DID → same bytes), distinct DIDs, MAC failure raises, evict zeroes entries. Critically, cross-check against a hard-coded expected pub byte fixture (generate the fixture by running libsodium-wrappers in a one-shot Node script once, paste the resulting pub hex into the test as a golden value).
- `test_key_directory.py`: birth adds, death removes, lookup for unknown DID returns None.

Ensure `brain/test/whisper/__init__.py` exists (empty file) so pytest picks up the module.

Run `cd brain && pytest test/whisper/ -x` and iterate until green.
  </action>
  <verify>
    <automated>cd brain &amp;&amp; pytest test/whisper/test_nonce.py test/whisper/test_keyring.py test/whisper/test_key_directory.py -x &amp;&amp; cd .. &amp;&amp; node scripts/check-wallclock-forbidden.mjs</automated>
  </verify>
  <done>
    All three Python tests green; wall-clock gate exits 0; golden pub-byte fixture matches the libsodium-js reference.
  </done>
</task>

<task id="11-W1-04" type="auto" tdd="true">
  <name>Task 11-W1-04: JS↔Python byte-compat fixture round-trip (the A2 assumption proof)</name>
  <requirement>WHISPER-01</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>brain/test/whisper/test_roundtrip.py, brain/test/fixtures/whisper/js-encrypted-envelope.json, brain/test/fixtures/whisper/py-encrypted-envelope.json, grid/test/whisper/whisper-keyring.test.ts, grid/scripts/gen-whisper-jsfixture.mjs</files>
  <behavior>
    - `grid/scripts/gen-whisper-jsfixture.mjs` is a standalone Node script that uses grid/src/whisper/crypto.ts helpers to produce a fixture envelope with test DIDs `did:noesis:alice_test` (sender) and `did:noesis:bob_test` (recipient), tick=42, counter=0, plaintext bytes `new TextEncoder().encode('hello from JS')`; writes to brain/test/fixtures/whisper/js-encrypted-envelope.json with fields: sender_did, recipient_did, tick, counter, plaintext_b64, nonce_b64, ciphertext_b64, sender_pub_b64, recipient_pub_b64
    - `brain/test/whisper/test_roundtrip.py` loads js-encrypted-envelope.json, reconstructs Keyring for recipient_did, calls decrypt_from, asserts plaintext bytes === 'hello from JS' UTF-8
    - test_roundtrip.py also generates py-encrypted-envelope.json (sender Python, recipient Python) and asserts its own decrypt succeeds
    - `grid/test/whisper/whisper-keyring.test.ts` loads py-encrypted-envelope.json (requires Python fixture generation first — either committed or regenerated via a make-target), decrypts via grid/src/whisper/crypto.ts, asserts plaintext matches
    - Both fixture JSONs contain a top-level `_generated` field with a fingerprint + regeneration hint; fixture files are committed to git
    - `cd brain && pytest test/whisper/test_roundtrip.py -x` — green
    - `cd grid && npx vitest run test/whisper/whisper-keyring.test.ts --reporter=dot` — green
  </behavior>
  <action>
Build a small generator script `grid/scripts/gen-whisper-jsfixture.mjs`:
- Uses grid/src/whisper/crypto.ts helpers (compile via `tsx` or `node --experimental-strip-types` if supported; else compile to dist and import).
- Produces the deterministic envelope described above.
- Writes to `brain/test/fixtures/whisper/js-encrypted-envelope.json` with an explicit `_generated` metadata block stating "DO NOT EDIT; regenerate via `node grid/scripts/gen-whisper-jsfixture.mjs`".

Write `brain/test/whisper/test_roundtrip.py`:
- Fixture: load js-encrypted-envelope.json.
- Test 1: Python decrypts JS-encrypted → plaintext === "hello from JS".
- Test 2: Python encrypts a round-trip envelope (new recipient/sender pair, tick=43, counter=0), writes py-encrypted-envelope.json, then decrypts itself → plaintext matches.

Write `grid/test/whisper/whisper-keyring.test.ts`:
- Fixture: load py-encrypted-envelope.json (committed).
- Test: JS decrypts Python-encrypted → plaintext matches.

Run the JS generator script first to produce the initial fixture, commit both fixture files, then run both tests. If the Python test produces py-encrypted-envelope.json, commit it too.

If a CI environment cannot run the JS generator, add a make target `make regenerate-whisper-fixtures` that runs both the JS generator and the Python fixture-producer test in regen mode (`pytest --regen-fixtures`). Document in the fixture JSON header.
  </action>
  <verify>
    <automated>cd brain &amp;&amp; pytest test/whisper/test_roundtrip.py -x &amp;&amp; cd ../grid &amp;&amp; npx vitest run test/whisper/whisper-keyring.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Both directions of the roundtrip green; fixtures committed to git; A2 assumption proven with concrete byte-compat evidence; MAC-failure negative cases covered in Task 11-W1-02 and 11-W1-03.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DID → keypair | Deterministic derivation; same DID always → same keypair |
| JS ↔ Python crypto | Shared libsodium C core; byte-compat proven by fixture roundtrip |
| Keyring ↔ disk | NEVER cross — no key persistence; re-derive on every Brain process start |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-W1-01 | Information Disclosure | Keyring private key bytes | mitigate | Private keys live in-memory only; `Keyring.evict` on bios.death; wall-clock gate forbids any `time`/`random` import that could hint at side-channel timing; no `print`/`log` of `_priv` anywhere |
| T-11-W1-02 | Spoofing | `PrivateKey(seed)` vs `crypto_box_seed_keypair(seed)` divergence | mitigate | Cross-lang fixture round-trip is the regression gate; RESEARCH §2.2 A2 locked via `test_roundtrip.py` |
| T-11-W1-03 | Tampering | Nonce reuse | mitigate | Deterministic nonce via blake2b(seed‖tick_le64‖counter_le32); counter is per-(sender, tick) monotonic (Wave 3 responsibility); nonce length validated (24 bytes) |
| T-11-W1-04 | Elevation of Privilege | Grid imports brain keyring path | mitigate | `scripts/check-whisper-keyring-isolation.mjs` — per D-11-04 / PATTERNS §keyring.py — merged into Wave 4's `check-whisper-plaintext.mjs` per user judgment-item (keyring on disk = plaintext leak; one gate catches both) |
| T-11-W1-05 | Repudiation | Determinism break | mitigate | Wave 4's `whisper-determinism.test.ts` asserts byte-identical ciphertext_hash across two runs — this wave ensures the primitives are deterministic (no Math.random / time) |
| T-11-W1-06 | Information Disclosure | Wall-clock ingress into whisper trees | mitigate | `check-wallclock-forbidden.mjs` roots extended in Wave 0; verified per task |
</threat_model>

<verification>
After all four tasks land:
- `cd grid && npx vitest run test/whisper/whisper-crypto.test.ts test/whisper/whisper-keyring.test.ts --reporter=dot` — GREEN
- `cd brain && pytest test/whisper/ -x` — all of test_nonce / test_keyring / test_key_directory / test_roundtrip GREEN
- `cd grid && npx vitest run test/whisper/whisper-producer-boundary.test.ts` — still RED (emitter not yet shipped; Wave 2's job)
- `cd grid && npx vitest run test/whisper/whisper-wire-format.test.ts test/whisper/whisper-rate-limit.test.ts` — still RED (Wave 2's job)
- `node scripts/check-wallclock-forbidden.mjs` — exit 0
- `node scripts/check-state-doc-sync.mjs` — exit 0 (unchanged by this wave)
- Fixture files brain/test/fixtures/whisper/{js,py}-encrypted-envelope.json committed and readable
- `grep -r 'PrivateKey(' brain/src/noesis_brain/whisper/` — returns zero hits (confirms A2 avoided)
- `grep -rE 'Math\.random|Date\.now|performance\.now|time\.time|datetime\.now|random\.random' grid/src/whisper/ brain/src/noesis_brain/whisper/` — zero hits
- Zero-diff regression hash UNCHANGED (no runtime emission yet; Wave 2 first triggers chain writes)
</verification>

<success_criteria>
1. libsodium-wrappers + PyNaCl installed with lockfile commits.
2. `grid/src/whisper/crypto.ts` + Brain crypto trio implement deterministic X25519 + deterministic blake2b nonces + XSalsa20-Poly1305 AEAD with no wall-clock and no Math.random.
3. Same DID produces byte-identical keypair bytes across JS and Python (RESEARCH A2 proven via fixture).
4. JS-encrypted envelope decrypts successfully in Python; Python-encrypted envelope decrypts successfully in JS.
5. MAC failures throw on both sides (not silent garbage).
6. Wave 0 whisper-crypto.test.ts RED stub flipped to GREEN.
7. No PrivateKey(seed) path anywhere in Brain whisper code (grep returns zero).
8. Fixture files committed with regeneration instructions.
9. Wall-clock gate still exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/11-mesh-whisper/11-01-crypto/SUMMARY.md` capturing:
- Dependency versions actually installed (from lockfiles)
- The golden pub-byte hex string for `did:noesis:alice_test` (so Wave 2 can cross-reference deterministically)
- Fixture paths + regeneration command
- Any deviation from RESEARCH recommendations (e.g. if `uv` was not available and `pip` used instead)
</output>
