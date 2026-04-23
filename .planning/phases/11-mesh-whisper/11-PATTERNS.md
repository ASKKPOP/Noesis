---
phase: 11
slug: mesh-whisper
created: 2026-04-23
analyzed_files: 39
analogs_found: 39
exact_match: 31
role_match: 8
no_analog: 0
---

# Phase 11: Mesh Whisper — Pattern Map

> Per `gsd-pattern-mapper`: every NEW source/script/test file in §4.1–§4.5 of `11-RESEARCH.md` is mapped to its closest existing analog. Modified files are listed at the bottom for context but not pattern-mapped (they extend an existing file in place).
>
> Anchor analogs (verified):
> - `grid/src/bios/appendBiosBirth.ts` (Phase 10b) — sole-producer 8-step validation template
> - `grid/src/bios/appendBiosDeath.ts` (Phase 10b) — sole-producer + tombstone-gate + closed-enum
> - `grid/test/bios/bios-producer-boundary.test.ts` (Phase 10b) — three-describe boundary grep + KNOWN_CONSUMERS pattern
> - `grid/src/api/operator/delete-nous.ts` (Phase 8) — D-30 ordered side-effect discipline (encrypt → audit → queue, tombstone-respect)
> - `brain/src/noesis_brain/ananke/runtime.py` (Phase 10a) — per-DID seed runtime + drain queue
> - `dashboard/src/lib/protocol/ananke-types.ts` + `dashboard/test/lib/ananke-types.drift.test.ts` (Plan 10a-05) — fourth-mirror SYNC header + drift detector
> - `scripts/check-wallclock-forbidden.mjs` + `scripts/check-state-doc-sync.mjs` — extension templates for new gates

---

## File Classification

### 4.1 grid/src (TypeScript, 8 NEW + 3 MODIFY)

| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `grid/src/whisper/appendNousWhispered.ts` | sole-producer emitter | event-driven | `grid/src/bios/appendBiosBirth.ts` | exact |
| `grid/src/whisper/crypto.ts` | utility (libsodium wrapper) | transform | `grid/src/audit/state-hash.ts` (hashing helper module) | role-match |
| `grid/src/whisper/config.ts` | frozen config | n/a | `grid/src/relationships/config.ts` | exact |
| `grid/src/whisper/rate-limit.ts` | tick-indexed counter (utility/service) | event-driven | `grid/src/dialogue/aggregator.ts` (per-key Map + tick-window prune) | role-match |
| `grid/src/whisper/router.ts` | service (validate→ratelimit→tombstone→audit→queue) | request-response | `grid/src/api/operator/delete-nous.ts` (D-30 ordered side-effects) | exact |
| `grid/src/whisper/pending-store.ts` | in-memory store | CRUD | `grid/src/relationships/storage.ts` (per-DID Map store) | role-match |
| `grid/src/whisper/routes.ts` | controller (Fastify plugin) | request-response | `grid/src/api/operator/delete-nous.ts` (registerXxxRoute) | exact |
| `grid/src/whisper/types.ts` | type module (closed-tuple keys) | n/a | `grid/src/bios/types.ts` | exact |

### 4.2 brain/src/noesis_brain (Python, 7 NEW)

| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `brain/src/noesis_brain/whisper/__init__.py` | package marker | n/a | `brain/src/noesis_brain/bios/__init__.py` | exact |
| `brain/src/noesis_brain/whisper/keyring.py` | per-DID seeded runtime | transform | `brain/src/noesis_brain/ananke/runtime.py` (per-DID seed → keyed cache) | exact |
| `brain/src/noesis_brain/whisper/key_directory.py` | observer on audit stream | event-driven | `grid/src/dialogue/aggregator.ts` (audit.onAppend filter) — closest TS analog; Python form mirrors `brain/src/noesis_brain/bios/runtime.py` ananke-ref pattern | role-match |
| `brain/src/noesis_brain/whisper/nonce.py` | pure deterministic helper | transform | `brain/src/noesis_brain/state_hash.py` (deterministic hashing helper) | role-match |
| `brain/src/noesis_brain/whisper/sender.py` | service (Brain → Grid HTTP) | request-response | `brain/src/noesis_brain/rpc/handler.py` (action emitter shape) | role-match |
| `brain/src/noesis_brain/whisper/receiver.py` | service (poll/decrypt/ack) | request-response | `brain/src/noesis_brain/rpc/handler.py` (loop-driven ingest) + `brain/src/noesis_brain/ananke/runtime.py` `drain_crossings` (queue-drain semantics) | role-match |
| `brain/src/noesis_brain/whisper/trade_guard.py` | utility (regex pre-encrypt) | transform | `grid/src/audit/broadcast-allowlist.ts` `payloadPrivacyCheck` (regex-based reject) | role-match |

### 4.3 dashboard/src (TypeScript, 3 NEW)

| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `dashboard/src/protocol/whisper-types.ts` | fourth protocol mirror (SYNC) | n/a | `dashboard/src/lib/protocol/ananke-types.ts` | exact |
| `dashboard/src/panels/WhisperInspector.tsx` | component (read-only counts) | request-response (firehose-derived) | `dashboard/src/components/agency/agency-indicator.tsx` + `use-ananke-levels.ts` derivation | exact |
| `dashboard/src/state/whisperStore.ts` | counts-only Zustand store | event-driven | `dashboard/src/lib/stores/agency-store.ts` (subscribe/getSnapshot) | exact |

### 4.4 scripts (4 NEW or extend)

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `scripts/check-whisper-plaintext.mjs` | CI grep gate (3-tier) | batch | `scripts/check-wallclock-forbidden.mjs` (Tier-A/B walk + scan) | exact |
| `scripts/check-whisper-runtime-writes.mjs` | CI runtime monkey-patch gate | batch | None in `scripts/`; closest is the inline-vitest pattern from `grid/test/audit/zero-diff-bios.test.ts` (`vi.spyOn`) — script form spawns vitest one-off | role-match |

(`scripts/check-wallclock-forbidden.mjs` and `scripts/check-state-doc-sync.mjs` are MODIFY targets — see "Modified Files" section.)

### 4.5 tests (13 NEW: 9 grid + 4 brain)

| New File | Role | Data Flow | Closest Analog | Match |
|----------|------|-----------|----------------|-------|
| `grid/test/whisper/whisper-producer-boundary.test.ts` | static grep test | n/a | `grid/test/bios/bios-producer-boundary.test.ts` | exact |
| `grid/test/whisper/whisper-crypto.test.ts` | unit (round-trip + determinism) | transform | `grid/test/audit/state-hash.test.ts` | role-match |
| `grid/test/whisper/whisper-wire-format.test.ts` | unit (closed-tuple shape) | n/a | `grid/test/audit/closed-enum-bios-lifecycle.test.ts` + `grid/test/audit/telos-refined-privacy.test.ts` | exact |
| `grid/test/whisper/whisper-rate-limit.test.ts` | unit (tick-window matrix) | event-driven | `grid/test/dialogue/aggregator.test.ts` (per-key window assertions) | role-match |
| `grid/test/whisper/whisper-tombstone.test.ts` | unit (silent drop) | event-driven | `grid/test/registry/tombstone.test.ts` + `grid/test/api/tombstone-410.test.ts` | exact |
| `grid/test/whisper/whisper-api.test.ts` | integration (Fastify inject) | request-response | `grid/test/api.test.ts` (Fastify inject pattern) | exact |
| `grid/test/whisper/whisper-aggregator.test.ts` | unit (extension test) | event-driven | `grid/test/dialogue/aggregator.test.ts` | exact |
| `grid/test/whisper/whisper-determinism.test.ts` | regression (zero-diff) | n/a | `grid/test/dialogue/zero-diff.test.ts` + `grid/test/audit/zero-diff-bios.test.ts` | exact |
| `grid/test/whisper/whisper-plaintext-fs-guard.test.ts` | runtime (fs.writeFile monkey-patch) | event-driven | `grid/test/audit/zero-diff-bios.test.ts` (`vi.spyOn` pattern; new use of `vi.spyOn(fs, 'writeFile')`) | role-match |
| `brain/test/test_whisper_keyring.py` | unit (seed→keypair determinism) | transform | `brain/test/ananke/test_drives_determinism.py` | exact |
| `brain/test/test_whisper_roundtrip.py` | integration (Py↔JS byte-compat) | transform | `brain/test/test_state_hash.py` (cross-language hash compat) | role-match |
| `brain/test/test_whisper_trade_guard.py` | unit (regex reject) | transform | `brain/test/test_trade_request_shape.py` | role-match |
| `brain/test/test_whisper_key_directory.py` | unit (observer cache build) | event-driven | `brain/test/bios/test_needs_elevator.py` (observer-on-runtime) | role-match |

---

## Pattern Assignments

### `grid/src/whisper/appendNousWhispered.ts` (sole-producer emitter)

**Analog:** `grid/src/bios/appendBiosBirth.ts`

**Pattern kind:** `sole-producer + closed-tuple + 8-step validation`. Identical discipline.

**Copy verbatim:**
- Frontmatter banner (lines 1–26): rewrite for `nous.whispered` with WHISPER-03 + D-11-01 references; preserve the "ordering deliberate" enumeration.
- Imports (lines 28–32): swap `BIOS_BIRTH_KEYS` → `WHISPERED_KEYS`, `BiosBirthPayload` → `NousWhisperedPayload`.
- `DID_RE` (line 34) and `HEX64_RE` (line 37): copy verbatim — Phase 11 is the 7th DID_RE entry point per carry-forward §6.
- 8-step body (lines 45–115): copy structure — guard order = (1) DID regex on actor + (2) DID regex on `from_did` + `to_did` + (3) self-report invariant `payload.from_did === actorDid` + (4) `tick` non-negative-int + (5) `ciphertext_hash` HEX64 + (6) closed-tuple sort-equality on 4 keys + (7) explicit `cleanPayload = {ciphertext_hash, from_did, tick, to_did}` + (8) `payloadPrivacyCheck` belt + `audit.append('nous.whispered', actorDid, cleanPayload)`.

**Divergences:**
- Tuple is **4 keys** (`ciphertext_hash`, `from_did`, `tick`, `to_did`), not 3. `from_did` carries the self-report invariant slot (analog uses `did`).
- `actorDid` MUST equal `payload.from_did` (sender attests to its own send) — direct rename of the BIOS self-report check.
- No `cause`-style closed enum — no `assertCause` import.

---

### `grid/src/whisper/crypto.ts` (libsodium wrapper utility)

**Analog:** `grid/src/audit/state-hash.ts` (hashing helper module shape)

**Pattern kind:** `pure-helper module — exports named functions, no class, no side effects on import`.

**Copy verbatim:**
- Frontmatter style (10–20 line docblock with PHILOSOPHY + decision references, e.g. D-11-02, D-11-13).
- Named-export `function`s only: `initSodium()` (idempotent, returns ready libsodium), `encryptFor(recipientPub, plaintext, nonce)`, `decryptFrom(senderPub, recipientPriv, nonce, ciphertext)`, `hashCiphertext(bytes): string` (HEX64), `deriveNonce(seed, tick, counter): Uint8Array`.

**Divergences:**
- Async-init wrinkle: `libsodium-wrappers` requires `await sodium.ready`. Wrap in a memoized promise (`let _ready: Promise<typeof sodium> | null = null`); analog is fully synchronous.
- Wall-clock forbidden Tier-B applies — NO `Date.now`, NO `Math.random`. Nonce comes from `deriveNonce(seed,tick,counter)` exclusively (D-11-13).

---

### `grid/src/whisper/config.ts` (frozen config)

**Analog:** `grid/src/relationships/config.ts`

**Pattern kind:** `Object.freeze({...} as const)` exported singleton.

**Copy verbatim:**
- Frontmatter (lines 1–13): "Pattern cloned from grid/src/audit/broadcast-allowlist.ts Object.freeze usage" — preserve attribution; add D-11-07 reference.
- `export const DEFAULT_WHISPER_CONFIG: WhisperConfig = Object.freeze({ rateBudget: 10, rateWindowTicks: 100, envelopeVersion: 1 } as const);`

**Divergences:**
- Add env-var override at module init: `Number(process.env.WHISPER_RATE_BUDGET) || 10` — relationships config has no env override. Validate parsed env vars are positive ints; reject negative/NaN by falling back to default with a `console.warn`.

---

### `grid/src/whisper/rate-limit.ts` (tick-indexed counter)

**Analog:** `grid/src/dialogue/aggregator.ts` (per-key Map + sliding-window prune)

**Pattern kind:** `Map<senderDid, number[]> sliding-window; prune entries < tick - N; reject when length >= B`.

**Copy verbatim:**
- Buffer-management shape from `aggregator.ts` lines 37–48 (`PairBuffer` interface) — adapt to `SenderHistory { tickHistory: number[] }`.
- Pause-safe `reset()` method (Phase 7 D-04 invariant clones onto the rate-limiter — wipes history when WorldClock pauses).
- "No wall-clock" docblock guarantee block (analog lines 12–14).

**Divergences:**
- Pure passive helper: NO listener registration on AuditChain (router calls `.tryConsume(senderDid, currentTick)` directly).
- Belt-and-suspenders: a comment block referencing `@fastify/rate-limit` as the seconds-based DDoS layer (D-11-07), engaged at the route level.

---

### `grid/src/whisper/router.ts` (sole orchestrator)

**Analog:** `grid/src/api/operator/delete-nous.ts` (D-30 ordered side-effect discipline)

**Pattern kind:** `validate → tombstone-respect → external work (encrypt) → audit emit → queue (D-30 ordered)`.

**Copy verbatim:**
- Frontmatter "ERROR LADDER" + "ORDER (LOCKED)" docblocks (lines 1–25) — adapt to whisper order: (1) DID regex both sides → (2) tombstone check (silent reject per D-11-17, NOT 410) → (3) rate-limit consume → (4) crypto envelope assembled (already encrypted upstream — router receives ciphertext) → (5) `appendNousWhispered` → (6) `pendingStore.enqueue(recipient, envelope)`.
- Injectable-deps pattern (lines 53–73): `WhisperRouterDeps { audit, registry, rateLimiter, pendingStore }`.

**Divergences:**
- Tombstone violation = **silent drop** (D-11-17, clones Phase 7 D-21), NOT a 410 response — router is internal, called from `nous-runner.ts whisper_send` case, not an HTTP handler. Routes layer (`routes.ts`) handles HTTP errors.
- No Brain-RPC fetch step (Phase 8's step 5) — encryption already happened in Brain before envelope reached router.
- Silent reject must NOT emit audit (D-11-17 "no audit emit, no error log" — clones Phase 7 D-21).

---

### `grid/src/whisper/pending-store.ts` (in-memory recipient queue)

**Analog:** `grid/src/relationships/storage.ts` (per-DID Map store, no MySQL)

**Pattern kind:** `Map<recipientDid, Envelope[]>; enqueue/drainFor/ackDelete; tombstoned-DID GC on bios.death`.

**Copy verbatim:**
- Class shape: private `store: Map<string, Envelope[]>`; `enqueue(did, env)`, `drainFor(did): Envelope[]`, `ackDelete(did, envelopeIds: Set<string>)`.
- Frontmatter pointing to D-11-05 ("No MySQL persistence of ciphertext").

**Divergences:**
- `bios.death` listener required: must clear queue entries for tombstoned DID (D-11-17 GC clause).
- No persistence — relationships have snapshot-cadence durability; whisper queue is **ephemeral by design**.

---

### `grid/src/whisper/routes.ts` (Fastify plugin)

**Analog:** `grid/src/api/operator/delete-nous.ts` (registerXxxRoute pattern)

**Pattern kind:** `export function registerWhisperRoutes(app: FastifyInstance, services: GridServices, deps?: WhisperRoutesDeps)`.

**Copy verbatim:**
- Imports (lines 27–42) + injectable-deps escape hatch (lines 71–73).
- `app.post<{...}>('/api/v1/...', async (req, reply) => {...})` shape; tier+DID guards return 400 with `ApiError` discriminated union.
- `DID_REGEX` import from `../../api/server.js` (consistent with delete-nous).

**Divergences:**
- THREE routes registered in one plugin: `GET /api/v1/nous/:did/whispers/pending`, `POST /api/v1/nous/:did/whispers/ack`, `GET /api/v1/whispers/metrics` (counts-only per D-11-07).
- NO H5-tier gate (whisper read-side is Brain-private, not operator-tiered). DID-shape gate only.
- Layer `@fastify/rate-limit` plugin onto these three routes specifically (D-11-07 belt).

---

### `grid/src/whisper/types.ts` (type module)

**Analog:** `grid/src/bios/types.ts`

**Pattern kind:** `closed-tuple keys + interface + locked alphabetical KEY array`.

**Copy verbatim:**
- Frontmatter block (lines 1–16) — preserve the "Event-name string literals MUST NOT appear in this file" warning, swap to `nous.whispered` + producer-boundary test path `test/whisper/whisper-producer-boundary.test.ts`.
- `export interface NousWhisperedPayload { readonly ciphertext_hash: string; readonly from_did: string; readonly tick: number; readonly to_did: string; }`
- `export const WHISPERED_KEYS = ['ciphertext_hash', 'from_did', 'tick', 'to_did'] as const;`
- Plus `Envelope` interface (5 keys per D-11-05): `to_did`, `nonce`, `ephemeral_pub`, `ciphertext`, `envelope_id`.

**Divergences:**
- No closed enum (no `cause`-equivalent).
- Add SYNC-pointer comments to `dashboard/src/protocol/whisper-types.ts` and `brain/src/noesis_brain/whisper/types.py` (D-11-16 — fourth-mirror discipline).

---

### `brain/src/noesis_brain/whisper/__init__.py`

**Analog:** `brain/src/noesis_brain/bios/__init__.py`

**Pattern kind:** package marker.

**Copy verbatim:** entire file (typically 1–10 lines re-exporting the public API).

**Divergences:** none structural; export `Keyring`, `KeyDirectory`, `derive_nonce`, `WhisperSender`, `WhisperReceiver`, `assert_no_trade_literal` per D-11-04 / D-11-12.

---

### `brain/src/noesis_brain/whisper/keyring.py`

**Analog:** `brain/src/noesis_brain/ananke/runtime.py`

**Pattern kind:** `per-DID seeded runtime with internal cache; never persisted; rebuildable from sha256(did)[:32]`.

**Copy verbatim:**
- `@dataclass` shape with `seed: int` and a private cache field (analog uses `_crossings: list`; keyring uses `_keys: dict[str, nacl.public.PrivateKey]`).
- "Determinism contract" docblock (analog lines 30–34) — adapt to "Same DID → same (priv, pub) bytes; libsodium `crypto_box_seed_keypair(seed)` is deterministic" (D-11-03).
- Drain/peek pattern absent — but constructor-time lazy-init mirrors `field(default_factory=...)`.

**Divergences:**
- Seeding: `seed = sha256(did.encode())[:32]` (NOT the 8-byte int seed analog uses). PyNaCl: `nacl.public.PrivateKey.from_seed(seed_bytes)`.
- NO disk persistence (D-11-03 "NO plaintext key material on disk, ever") — analog also no-disk, so this matches.
- Public keys exposed via `pub_for(did) -> bytes` (RPC-callable per D-11-04). Private keys NEVER leave instance — `encrypt_for(peer_did, plaintext, tick, counter)` and `decrypt_from(envelope)` are the only exits.
- T-10-03 grep gate (D-11-04): `scripts/check-whisper-keyring-isolation.mjs` ensures no `grid/src/**` imports this file. (Note: this script is implied by D-11-04 but NOT in §4.4 — Planner should add it; otherwise covered by `check-whisper-plaintext.mjs` if scoped broadly.)

---

### `brain/src/noesis_brain/whisper/key_directory.py`

**Analog:** `brain/src/noesis_brain/bios/runtime.py` (subsystem-ref pattern); structurally an audit-stream observer like `grid/src/dialogue/aggregator.ts`.

**Pattern kind:** `observer on bios.birth audit stream → builds Dict[did, pub_bytes] cache; never writes to disk`.

**Copy verbatim:**
- `@dataclass` + `_pubkeys: dict[str, bytes] = field(default_factory=dict)` (mirrors analog's `_crossings` queue init).
- `on_bios_birth(did: str, pub_bytes: bytes) -> None` callback shape (analog has `on_tick`).

**Divergences:**
- Subscribes to bios.birth events from the shared audit stream — analog is purely tick-driven. Source of subscription: Brain-Brain hookup (D-11-04 — "BiosRuntime observer triggers construction").
- No drain/peek; cache is read-only after birth, until a `bios.death` callback prunes the entry.

---

### `brain/src/noesis_brain/whisper/nonce.py`

**Analog:** `brain/src/noesis_brain/state_hash.py`

**Pattern kind:** pure deterministic helper module; one exported function.

**Copy verbatim:**
- Module-level docstring with determinism guarantee.
- `def derive_nonce(sender_seed: bytes, tick: int, counter: int) -> bytes:` returning exactly 24 bytes via `hashlib.blake2b(sender_seed + tick.to_bytes(8,'little') + counter.to_bytes(4,'little'), digest_size=24).digest()`.

**Divergences:**
- Output shape locked to 24 bytes (XChaCha20 nonce length per D-11-02).
- MUST match JS-side `deriveNonce` byte-for-byte — covered by `brain/test/test_whisper_roundtrip.py`.

---

### `brain/src/noesis_brain/whisper/sender.py`

**Analog:** `brain/src/noesis_brain/rpc/handler.py` (action-emitter shape)

**Pattern kind:** high-level service: `(from_did, to_did, tick, plaintext_bytes) → Envelope dict → Grid HTTP POST /whisper/send`.

**Copy verbatim:**
- Logger + import block style (handler.py lines 1–25).
- Action-tuple construction style — return a closed dict matching `WHISPER_SEND` action's 5 metadata keys (D-11-05).

**Divergences:**
- Calls `trade_guard.assert_no_trade_literal(plaintext)` BEFORE `keyring.encrypt_for(...)` — pre-encrypt rejection per D-11-12 / T-10-06 depth.
- Counter: per-(sender_did, tick) monotonic integer; reset to 0 each tick. Stored in sender instance state (small `dict[tuple[str,int], int]` — pruned on tick advance).
- HTTP transport via existing client (do NOT introduce a new HTTP library).

---

### `brain/src/noesis_brain/whisper/receiver.py`

**Analog:** `brain/src/noesis_brain/ananke/runtime.py` (drain semantics) + `brain/src/noesis_brain/rpc/handler.py` (loop-driven ingest)

**Pattern kind:** poll → decrypt → forward to deliberation engine → ack.

**Copy verbatim:**
- `drain_crossings`-style queue-drain semantics for the dedup seen-set (D-11-06 ack-then-crash idempotency).
- Per-DID state container — `@dataclass` with `_seen_envelope_ids: set[str]` (mirrors `_crossings` analog).

**Divergences:**
- HTTP-poll loop on `GET /api/v1/nous/:did/whispers/pending` — emits ack-batch via `POST /api/v1/nous/:did/whispers/ack` after successful decrypt.
- Brain-side dedup keyed on `envelope_id` (D-11-06 — "Brain-side dedup by envelope_id; idempotent").
- Decrypted plaintext NEVER returns to Grid — passed to local deliberation engine and discarded.

---

### `brain/src/noesis_brain/whisper/trade_guard.py`

**Analog:** `grid/src/audit/broadcast-allowlist.ts` `payloadPrivacyCheck` (regex-based reject)

**Pattern kind:** pre-encrypt regex scan rejecting trade-action literals.

**Copy verbatim:**
- Regex-based rejection function shape; raise `ValueError` (Pythonic equivalent of `payloadPrivacyCheck`'s `{ok, offendingPath, offendingKeyword}`).
- Forbidden-literal list pattern (analog has `FORBIDDEN_KEY_PATTERN` regex over `prompt|response|wiki|...`).

**Divergences:**
- Operates on plaintext **bytes/string content**, not payload key names — regex over the body itself.
- T-10-06 depth defense ONLY — Phase 5 ReviewerNous remains the authoritative gate (D-11-14). Trade guard is belt; reviewer is suspenders.
- Forbidden literals: `trade.proposed`, `trade.settled`, `amount=`, `nonce=` (text-form regex per D-11-12 / D-11-14).

---

### `dashboard/src/protocol/whisper-types.ts`

**Analog:** `dashboard/src/lib/protocol/ananke-types.ts`

**Pattern kind:** **fourth protocol mirror** with two SYNC-header pointers (D-11-16).

**Copy verbatim:**
- Top-of-file SYNC banner (analog lines 1–20):
  ```
  /**
   * SYNC: mirrors grid/src/whisper/types.ts
   * SYNC: mirrors brain/src/noesis_brain/whisper/types.py
   *
   * Drift is detected by dashboard/test/lib/whisper-types.drift.test.ts
   * ...
   * PRIVACY — WHISPER-02 render surface:
   *   Plaintext NEVER enters this file or any downstream dashboard module.
   *   Only counts and ciphertext_hash (opaque) are mirrored.
   */
  ```
- `as const` enum exports + readonly interfaces.

**Divergences:**
- Two SYNC pointers (Grid + Brain), not three (analog has Brain-only, since ananke-types has no Grid-source). D-11-16 explicitly mandates **both** pointers.
- Note in frontmatter: "Per Phase 10a, the fourth mirror is the threshold for consolidation into `@noesis/protocol-types`. That refactor is logged as deferred and does NOT block Phase 11."

**Path note:** §4.3 lists `dashboard/src/protocol/whisper-types.ts` but existing mirrors live at `dashboard/src/lib/protocol/`. Planner should normalize to `dashboard/src/lib/protocol/whisper-types.ts` for consistency (analog path).

---

### `dashboard/src/panels/WhisperInspector.tsx`

**Analog:** `dashboard/src/components/agency/agency-indicator.tsx` (component) + `dashboard/src/lib/hooks/use-ananke-levels.ts` (firehose-derived counts)

**Pattern kind:** `'use client'` component using `useSyncExternalStore` + a derived hook (`use-whisper-counts.ts`) over the firehose.

**Copy verbatim:**
- `'use client'` directive + frontmatter listing UI-SPEC contract (analog lines 1–11).
- Hook structure from `use-ananke-levels.ts` (lines 1–60) — pure `useMemo` over `useFirehose()`, zero new RPC.
- `useFirehose` filter for `eventType === 'nous.whispered'` (analog filters `'ananke.drive_crossed'`).

**Divergences:**
- Renders ONLY counts (D-11-15): sent count, received count, last whisper tick, top-N partners by count.
- **NO inspect/read affordance** — even disabled. A visible-disabled button would itself be a T-10-03 violation per D-11-15. This is the divergence-by-omission discipline.
- Path: §4.3 lists `dashboard/src/panels/`; existing dashboard pattern lives under `dashboard/src/components/inspector-sections/` (per D-11-15). Planner should resolve consistently.

---

### `dashboard/src/state/whisperStore.ts`

**Analog:** `dashboard/src/lib/stores/agency-store.ts`

**Pattern kind:** framework-agnostic singleton with `subscribe/getSnapshot` (compatible with `useSyncExternalStore`).

**Copy verbatim:**
- Class shape (analog lines 38–42): private state + listeners Set + `subscribe/getSnapshot/notify` triad.
- SSR-safety guards (analog lines 14–20) — `typeof window === 'undefined'` checks.

**Divergences:**
- NO localStorage — counts derive from firehose (no persistence needed; analog persists tier).
- NO H-tier gating — counts visible at all tiers (D-11-15).
- §4.3 path `dashboard/src/state/whisperStore.ts` diverges from analog `dashboard/src/lib/stores/agency-store.ts` — Planner should normalize.

---

### `scripts/check-whisper-plaintext.mjs`

**Analog:** `scripts/check-wallclock-forbidden.mjs`

**Pattern kind:** `multi-tier static grep CI gate; walk + scan + comment-skip; exit 1 on violation`.

**Copy verbatim:**
- Shebang + frontmatter (lines 1–33).
- `walk(dir, acc)` helper (lines 78–87).
- `scan(filePath, patterns)` helper (lines 97–161) — preserve the comment-skip / triple-quote / block-comment state machine verbatim.
- "Run from repo root" + green OK / red exit lines (lines 187–199).

**Divergences:**
- Three tiers (D-11-08): grid-tree (forbidden flat+nested keys), brain-tree (whisper|envelope|mesh paths), dashboard-tree (whisper|envelope|mesh paths).
- Forbidden-keys regex from D-11-08: `text|body|content|message|utterance|offer|amount|ousia|price|value|plaintext|decrypted|payload_plain`.
- Exempt path list: `grid/src/whisper/router.ts` (ciphertext field is base64 bytes, not a forbidden key) + `keyring.py` (no forbidden keys by design).

---

### `scripts/check-whisper-runtime-writes.mjs`

**Analog:** No direct CI-script analog. Closest pattern is the `vi.spyOn` pattern from `grid/test/audit/zero-diff-bios.test.ts` (lines 26–31), wrapped in a one-shot script driver.

**Pattern kind:** `monkey-patch fs.writeFile + spawn full whisper send→ack cycle + assert no plaintext bytes`.

**Copy verbatim:**
- Shebang + node imports + exit-code discipline from `check-wallclock-forbidden.mjs` (lines 1–33).
- vi-spyOn idea from `zero-diff-bios.test.ts` lines 26–31.

**Divergences:**
- Spawns vitest with `grid/test/whisper/whisper-plaintext-fs-guard.test.ts` (per §4.5) under a wrapped `fs.writeFile`/`fs.promises.writeFile`/`fs.writeFileSync` that records every buffer; asserts none contain plaintext heuristics (`text|body|utterance|offer`).
- This is **NEW pattern** for the project — flag as such for Planner; consider whether it should be a vitest test (already covered by `grid/test/whisper/whisper-plaintext-fs-guard.test.ts`) or a separate script driver.

---

### Tests (per-file pattern assignment)

| Test file | Analog | Pattern kind | Divergences |
|-----------|--------|--------------|-------------|
| `grid/test/whisper/whisper-producer-boundary.test.ts` | `grid/test/bios/bios-producer-boundary.test.ts` | three-describe boundary grep + KNOWN_CONSUMERS whitelist | Initially-empty `KNOWN_CONSUMERS_WHISPERED = []` (DialogueAggregator subscribes via `audit.onAppend` not literal-reference per D-11-10 — does NOT need to appear). Forbidden siblings: `nous.whisper_broadcast`, `nous.whispered_plain`, `nous.whisper_rate_limited` (D-11-01). |
| `grid/test/whisper/whisper-crypto.test.ts` | `grid/test/audit/state-hash.test.ts` | round-trip + determinism | Add MAC-failure rejection case (libsodium-specific); seed-determinism case (same DID → same keypair bytes). |
| `grid/test/whisper/whisper-wire-format.test.ts` | `grid/test/audit/closed-enum-bios-lifecycle.test.ts` + `grid/test/audit/telos-refined-privacy.test.ts` | closed-tuple shape assertions | DID regex case + nonce length (24) + hash format (HEX64) + envelope version lock (D-11-05). |
| `grid/test/whisper/whisper-rate-limit.test.ts` | `grid/test/dialogue/aggregator.test.ts` | per-key window matrix | B=10/N=100 accept/reject grid; env override case; prune-on-advance case; `@fastify/rate-limit` integration sub-case (`-t fastify`). |
| `grid/test/whisper/whisper-tombstone.test.ts` | `grid/test/registry/tombstone.test.ts` + `grid/test/api/tombstone-410.test.ts` | tombstone gate | Silent drop (NOT 410) per D-11-17; assert NO audit emit + NO log. Sender-tombstoned + recipient-tombstoned both covered. |
| `grid/test/whisper/whisper-api.test.ts` | `grid/test/api.test.ts` | Fastify inject | Three sub-tests: pending → ack → drained; metrics endpoint counts-only (NO plaintext / hash / envelope_id). |
| `grid/test/whisper/whisper-aggregator.test.ts` | `grid/test/dialogue/aggregator.test.ts` | extension-test | Channel='whisper' buffer key separate from 'spoke'; hash-only extraction (plaintext never reaches aggregator per D-11-11). |
| `grid/test/whisper/whisper-determinism.test.ts` | `grid/test/dialogue/zero-diff.test.ts` + `grid/test/audit/zero-diff-bios.test.ts` | zero-diff + replay | TWO assertions: (1) zero-diff with N passive observers (clones dialogue zero-diff) and (2) byte-identical ciphertext_hash sequence across two runs at different `tickRateMs` (D-11-13 replay-determinism). |
| `grid/test/whisper/whisper-plaintext-fs-guard.test.ts` | `grid/test/audit/zero-diff-bios.test.ts` (`vi.spyOn` template) | runtime monkey-patch | NEW use of `vi.spyOn(fs, 'writeFile')` + `fs.promises.writeFile` + `fs.writeFileSync`. Run full send→ack cycle; assert no buffer contains plaintext heuristics. |
| `brain/test/test_whisper_keyring.py` | `brain/test/ananke/test_drives_determinism.py` | seed→deterministic-output | Same DID twice → identical pub bytes; libsodium-compat marker (cross-checked by roundtrip test). |
| `brain/test/test_whisper_roundtrip.py` | `brain/test/test_state_hash.py` (cross-language compat) | byte-compat fixture | Python encrypt → JS decrypt; load JS-produced fixture, assert decrypt succeeds and plaintext bytes equal expected. |
| `brain/test/test_whisper_trade_guard.py` | `brain/test/test_trade_request_shape.py` | rejection-on-bad-input | Each forbidden literal (`trade.proposed`, `trade.settled`, `amount=`, `nonce=`) raises ValueError pre-encrypt. |
| `brain/test/test_whisper_key_directory.py` | `brain/test/bios/test_needs_elevator.py` | observer-builds-cache | Mock bios.birth event stream; assert `pub_for(did)` returns the published bytes after observation; `bios.death` prunes the entry. |

---

## Shared Patterns

### Allowlist + closed-tuple discipline (applies to: `appendNousWhispered.ts`, `types.ts`, all privacy tests)

**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 24–80 (allowlist comment block + `ALLOWLIST_MEMBERS` array)

**Apply to:** Modify in place — append `'nous.whispered'` at index 21 (position 22). Update preamble comment to "21 → 22" with Phase 11 attribution mirroring the Phase-10b dual-event block (lines 40–48). Add `WHISPER_FORBIDDEN_KEYS` const + extend `FORBIDDEN_KEY_PATTERN` regex (D-11-08).

### DID regex (applies to: every whisper entry point)

**Source:** `grid/src/bios/appendBiosBirth.ts` line 34 — `export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;`

**Apply to:** `appendNousWhispered.ts`, `router.ts`, `routes.ts`, `keyring.py`, `pubkey RPC`. Phase 11 is the **7th DID_RE entry point** (carry-forward §6).

### Wall-clock forbidden Tier-A extension

**Source:** `scripts/check-wallclock-forbidden.mjs` lines 38–41 (`TIER_A_ROOTS`) + lines 66–68 (`TIER_B_TS_ROOTS`)

**Apply to:** add `'grid/src/whisper'` to `TIER_B_TS_ROOTS`; add `'brain/src/noesis_brain/whisper'` to `TIER_A_ROOTS`. Per carry-forward §7 + D-11-13. `@fastify/rate-limit` import-only allowance (D-11-07 belt) — internal use is third-party.

### State doc-sync extension

**Source:** `scripts/check-state-doc-sync.mjs` lines 43–46 (`21 events` literal) + lines 71–98 (`required` array)

**Apply to:** bump `21 events` → `22 events`; append `'nous.whispered'` to `required`. Single-commit with allowlist edit (CLAUDE.md doc-sync rule + D-11-01 obligation).

### Tombstone-respect (silent drop)

**Source:** `grid/src/bios/appendBiosDeath.ts` lines 14–20 (BIOS-04 tombstone gate); silent-drop behavior cloned from Phase 7 D-21 (search `dialogue/aggregator.ts` for the equivalent skip pattern)

**Apply to:** `WhisperRouter.route` (entry guard), `pending-store.ts` (GC on bios.death), `keyring.py` (eviction on bios.death). NO audit emit on rejection (D-11-17).

### SYNC-mirror header + drift detector

**Source:** `dashboard/src/lib/protocol/ananke-types.ts` lines 1–20 (header) + `dashboard/test/lib/ananke-types.drift.test.ts` (detector)

**Apply to:** `dashboard/src/lib/protocol/whisper-types.ts` (with TWO pointers per D-11-16) + `dashboard/test/lib/whisper-types.drift.test.ts` (mirrors detector — reads BOTH `grid/src/whisper/types.ts` AND `brain/src/noesis_brain/whisper/types.py` and asserts shape parity).

### Per-DID seeded runtime

**Source:** `brain/src/noesis_brain/ananke/runtime.py` lines 17–34 (`@dataclass`, `seed: int`, determinism contract)

**Apply to:** `brain/src/noesis_brain/whisper/keyring.py`. Diverge: seed is 32 bytes (`sha256(did)[:32]`) not int; cache is keypair dict not crossing list.

---

## No Analog Found

None. Every NEW file in §4.1–§4.5 has either an exact or role-match analog in the codebase. The closest-to-novel file is `scripts/check-whisper-runtime-writes.mjs` (no prior CI script monkey-patches `fs.writeFile`), but the pattern composes from `vi.spyOn` (zero-diff-bios test) + the `check-wallclock-forbidden.mjs` exit-code/walk skeleton.

---

## Modified Files (context-only, not pattern-mapped)

| Path | Pattern guidance |
|------|------------------|
| `grid/src/audit/broadcast-allowlist.ts` | Append at position 22 with Phase-11 attribution block mirroring Phase-10b dual-event block (lines 40–48). Add `WHISPER_FORBIDDEN_KEYS` const + extend `FORBIDDEN_KEY_PATTERN`. |
| `grid/src/integration/nous-runner.ts` | Add `case 'whisper_send':` near line 200, between `direct_message` and `trade_request`. Follow the trade_request pattern of explicit-key extraction + transport-error fallback (lines 195–233). Route to `WhisperRouter.route(...)`. |
| `grid/src/dialogue/aggregator.ts` | Widen `handleEntry` filter at line 162 from `entry.eventType !== 'nous.spoke'` to accept both `'nous.spoke'` and `'nous.whispered'`. Set `channel='whisper'` for the latter (D-11-11). Hash-only extraction — `ciphertext_hash` substitutes for `text` field. |
| `scripts/check-wallclock-forbidden.mjs` | See Shared Patterns. |
| `scripts/check-state-doc-sync.mjs` | See Shared Patterns. |

---

## Metadata

- **Analog search scope:** `grid/src/`, `grid/test/`, `brain/src/noesis_brain/`, `brain/test/`, `dashboard/src/`, `dashboard/test/`, `scripts/`
- **Files scanned:** ~120 (sole-producer/audit/dialogue/relationships/api/operator + brain rpc/ananke/bios + dashboard protocol/hooks/stores/components + scripts)
- **Pattern extraction date:** 2026-04-23
- **Mapper:** `gsd-pattern-mapper` (sub-agent of `/gsd-plan-phase 11 --auto`)
