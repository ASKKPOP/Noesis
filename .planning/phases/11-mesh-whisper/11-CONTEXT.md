# Phase 11: Mesh Whisper — Context

**Gathered:** 2026-04-23
**Mode:** `--auto` (all gray areas auto-selected with recommended defaults; see `11-DISCUSSION-LOG.md`)
**Status:** Ready for research/planning

<domain>
## Phase Boundary

Any two Nous exchange **E2E-encrypted envelopes** directly; operators cannot read plaintext at **any tier, including H5**; audit chain retains only the ciphertext hash forever. Ships WHISPER-01..06 on libsodium `crypto_box` (X25519 + XChaCha20-Poly1305).

**Out of scope** (do not drift): Forward secrecy / Signal Double Ratchet (WHISPER-FS-01 — post-v2.2); sealed-sender; `nous.whisper_rate_limited` (deferred unless T-10-02 regression); any H≥1 whisper-read RPC (anti-feature — any future flow clones Phase 8 `IrreversibilityDialog` H5 pattern in its own phase with its own allowlist addition); trade-bypass defense beyond existing Phase 5 Reviewer gate; group chat / multi-recipient envelopes.

</domain>

<decisions>
## Implementation Decisions

### Allowlist growth — exactly +1 event
- **D-11-01:** Add `nous.whispered` at position **22** in `grid/src/audit/broadcast-allowlist.ts`. Running total **21 → 22**. Closed 4-key payload `{from_did, to_did, tick, ciphertext_hash}` — `Object.keys(payload).sort()` strict-equality asserted (clone Phase 10b D-10b-01 discipline). Sole-producer file: `grid/src/whisper/WhisperRouter.ts`. Grep gate fails CI if `.append('nous.whispered')` appears in any other `grid/src/**` file (clone Phase 10b `appendBiosBirth` boundary test; known-consumer whitelist initially empty — DialogueAggregator subscribes via `onAppend`, not `.append`).
  - **Forbidden siblings:** `nous.whisper_broadcast | nous.whispered_plain | nous.whisper_rate_limited` must NOT appear as literals anywhere in `grid/src/**` — regression test asserts hits = 0.
  - **Doc-sync obligation:** Plan that lands the allowlist change updates `scripts/check-state-doc-sync.mjs` (21→22), `STATE.md` Accumulated Context enumeration, `ROADMAP.md §Phase 11` running-total, and `PHILOSOPHY.md` allowlist-invariant block in the SAME commit (CLAUDE.md doc-sync rule).

### Cryptographic primitive choice
- **D-11-02:** `libsodium-wrappers` (pure-JS + WASM fallback). Chosen over `sodium-native` (N-API) because:
  1. Researcher rigs (Phase 14) and Brain both need the same primitive — `libsodium-wrappers` runs in Node + browser + WASM; `sodium-native` requires native build per host.
  2. Dashboard (Playwright E2E) can import the same package if a future UI gets whisper-test fixtures — no dual-binding divergence.
  3. API surface is `crypto_box_keypair` / `crypto_box_easy` / `crypto_box_open_easy` / `crypto_box_seed_keypair` — identical semantics to `sodium-native` at the call sites we need.
  - **Python side:** `PyNaCl` (libsodium binding) — already in the Python ecosystem, stable, matches JS crypto_box wire format byte-for-byte. Brain uses `nacl.public.Box`.
  - **AEAD mode:** XChaCha20-Poly1305 (24-byte nonce, 128-bit tag) — default in `crypto_box_easy`. Random nonces fine given 192-bit space; determinism preserved by seeded CSPRNG (see D-11-17).

### Per-identity keypair — generation, seeding, lifetime
- **D-11-03:** Keypair generated on receipt of `bios.birth` in the recipient Nous's own Brain. Seed = `sha256(did)[:32]` (clone Phase 10a `_get_or_create_ananke` per-Nous seeding). `crypto_box_seed_keypair(seed)` is deterministic in libsodium — same DID always produces same `(pub, priv)`. Guarantees **deterministic replay**: a Rig re-running the same chain reproduces every envelope's ephemeral state.
  - **Lifetime:** keypair lives in Brain-scoped in-memory keyring until `bios.death`. Not persisted to disk (NO plaintext key material on disk, ever). Re-spawn of Brain process re-derives via `sha256(did)[:32]` — idempotent, no recovery protocol needed.
  - **Private key never leaves Brain.** Public keys published via a read-only Brain RPC `GET /pubkey/:did` that returns the X25519 public key bytes (base64). Grid NEVER receives or caches private keys.

### Keyring location & wire contract
- **D-11-04:** `brain/src/noesis_brain/whisper/keyring.py` holds the Brain-scoped `Dict[DID, Box]`. Constructed lazily on first `bios.birth` receipt per DID (the BiosRuntime observer triggers construction). Grid gets public keys via a new Brain RPC `pubkey_for(did)` called from the sender's Brain BEFORE encryption — Grid itself never fetches a pubkey, never caches one, never sees a private key. Sender Brain obtains the recipient pubkey via its own Brain-Brain lookup (Phase 11 adds a Brain-local `KeyDirectory` that observes `bios.birth` events on the shared audit stream).
  - **T-10-03 enforcement:** grep gate `scripts/check-whisper-keyring-isolation.mjs` fails CI if any file under `grid/src/**` imports from `brain/src/noesis_brain/whisper/keyring.py` (no cross-package key leak path).

### Envelope shape & routing
- **D-11-05:** Sender Brain returns a new action `ActionType.WHISPER_SEND` with closed-tuple metadata `{to_did, nonce, ephemeral_pub, ciphertext, envelope_id}` (5 keys, same strict-equality discipline as Phase 7 D-14). All 5 fields are base64url or hex strings — never bytes, never objects. Grid `NousRunner.executeActions` routes `whisper_send` through `WhisperRouter.route(...)` — Grid never parses or decrypts `ciphertext`.
  - `envelope_id = sha256(canonical_json({from_did, to_did, tick, nonce, ciphertext}))[:32]` — the hex-prefix **IS** the `ciphertext_hash` broadcast. One id, one hash, one audit entry.
  - **No MySQL persistence of ciphertext.** Grid holds a per-recipient in-memory `Map<recipient_did, Envelope[]>` queue. Ciphertext lives only until recipient ack-pull (see D-11-07).

### Recipient-pull delivery (WHISPER-04)
- **D-11-06:** No server-push. No websocket delivery. Recipient Brain polls on every tick via `GET /api/v1/nous/:did/whispers/pending` → returns undelivered envelopes (ciphertext, nonce, ephemeral_pub, from_did, tick_sent, envelope_id). Brain decrypts locally, then `POST /api/v1/nous/:did/whispers/ack` with `{envelope_ids: string[]}` → Grid deletes those entries from the in-memory queue.
  - **Ack is NOT audited.** Only send emits `nous.whispered`. Delivery-confirmation audits are an anti-feature this phase (adds allowlist pressure without tier-gated value; defer until a concrete operator-observability requirement emerges).
  - **Ack-then-crash scenario:** If Grid crashes between DELETE-ack and next poll, the recipient re-pulls and decrypts the same envelope twice. Brain-side dedup by `envelope_id` (the recipient Brain keeps a seen-set keyed on its own DID). Idempotent at the Brain; Grid does not need to reason about exactly-once.

### Rate-limit (WHISPER-05) — tick-indexed, not seconds
- **D-11-07:** Primary rate-limit is **tick-indexed, not wall-clock.** Per-sender sliding window of N ticks with budget B: default `B=10, N=100` (per ROADMAP). Configurable per Grid via env vars `WHISPER_RATE_BUDGET` (int) and `WHISPER_RATE_WINDOW_TICKS` (int). Implemented in `grid/src/whisper/rate-limiter.ts` as a `Map<sender_did, tickHistory: number[]>` — on each send, prune entries older than `current_tick - N` and reject if `length >= B`.
  - **Over-budget behavior:** send queued in a per-sender FIFO `Map<sender_did, Envelope[]>` — drained at 1 envelope/tick as the window slides. Queue length observable via a new operator-side metric endpoint `GET /api/v1/operator/whisper/queues` at H1+ (returns `[{did, queue_length}]` — **no plaintext, no ciphertext, no envelope_ids** — counts only). Clones Phase 6 tier-gated RPC pattern; NO new allowlist member needed.
  - **Belt-and-suspenders:** `@fastify/rate-limit` layered on top with a wall-clock seconds-based ceiling (e.g. 100 req/min per IP) purely as DDoS-style transport defense. The **authoritative** rate-limit for zero-wall-clock invariant is the tick-indexed one.
  - **Zero-wall-clock invariant preserved:** `scripts/check-wallclock-forbidden.mjs` (already added in Plan 10b-07) extends its Tier-A ban to cover `grid/src/whisper/**` — same blanket ban as `grid/src/bios/**` and `grid/src/chronos/**`. Only `@fastify/rate-limit` (a third-party package) is allowed to use Date.now internally.

### Three-tier plaintext CI gate (WHISPER-03)
- **D-11-08:** `scripts/check-whisper-plaintext.mjs` — static grep across three surfaces:
  - **Grid tree (`grid/src/**`):** forbidden property keys (flat + nested) `text | body | content | message | utterance | offer | amount | ousia | price | value | plaintext | decrypted | payload_plain`. Exempt files: `grid/src/whisper/WhisperRouter.ts` (but the ciphertext field itself is base64 bytes, not any of those keys). Any match in any other whisper-related file fails CI.
  - **Brain tree (`brain/src/**`):** same forbidden-keys set on any module whose path matches `whisper|envelope|mesh`. `keyring.py` exempt (no forbidden keys by design).
  - **Dashboard tree (`dashboard/src/**`):** same forbidden-keys set on any component whose path matches `whisper|envelope|mesh`. Whisper UI (D-11-14) is render-only count/timestamp, no plaintext possible.
  - **Runtime `fs.writeFile` monkey-patch test:** `grid/test/whisper/no-plaintext-to-disk.test.ts` wraps `fs.writeFile`/`fs.promises.writeFile`/`fs.writeFileSync`, runs a full send→ack cycle, and asserts no call ever received a buffer containing recognizable plaintext strings (`text | body | utterance | offer`). This catches a runtime leak grep cannot see.

### Privacy matrix (≥10 cases)
- **D-11-09:** `grid/test/audit/whisper-payload-privacy.test.ts` — enumerate 16 cases total: 13 forbidden keys flat (from D-11-08 list) + 3 nested cases (`{meta: {text: '...'}}`, `{payload: {body: '...'}}`, `{ext: {utterance: '...'}}`) + 1 coverage assertion that every forbidden key in the D-11-08 list has ≥1 case in the matrix. Clone Phase 6 D-12 40-case enumerator structure exactly — `it.each` with `(eventType, key, injection) => expect(...).toThrow(...)` form.

### Producer-boundary + sole-producer grep gate
- **D-11-10:** `grid/test/whisper/whisper-producer-boundary.test.ts` — clone of Phase 10b `bios-producer-boundary.test.ts` exactly. Three assertions:
  1. String literal `'nous.whispered'` appears in `grid/src/**` only in `audit/broadcast-allowlist.ts` and `whisper/WhisperRouter.ts` (plus known-consumer allowlist — initially empty; DialogueAggregator subscribes via `AuditChain.onAppend`, not by literal-referencing, so it does NOT need to appear here).
  2. No file except `WhisperRouter.ts` calls `audit.append(['"]nous\.whispered['"]` (regex from bios-producer-boundary pattern).
  3. Forbidden siblings `nous.whisper_broadcast | nous.whispered_plain | nous.whisper_rate_limited` have zero hits in `grid/src/**`.

### DialogueAggregator extension (WHISPER-06)
- **D-11-11:** `DialogueAggregator.onAppend` (Phase 7) extends to subscribe to `'nous.whispered'` events in ADDITION to `'nous.spoke'`. Whispered events are buffered per bidirectional pair keyed on `sortedDids.join('|')|channel` where `channel='whisper'` (separate from `'spoke'` so a pair's whisper dialogue and public-speak dialogue accumulate independently). Buffer entry ingests the `ciphertext_hash` as the substrate — **plaintext never reaches the aggregator** (hash-only-cross-boundary discipline, clone Phase 6 D-15).
  - **Dialogue delivery:** when ≥`minExchanges=2` hash-entries land within `windowTicks=5` for a pair, both participants receive a `DialogueContext` on their next `sendTick` with `channel: 'whisper'` — the Brain-side handler already tolerates hash-only context (Phase 7 D-22 silent no-op if no goal substring matches; `telos.refined` fires only if Brain locally holds plaintext that does match — which a participant DOES because it encrypted/decrypted the whisper itself).
  - **No new allowlist event.** `telos.refined` covers the whisper-driven refinement path unchanged. `triggered_by_dialogue_id` field absorbs whisper-origin dialogue ids (same 16-hex shape as speak-origin).

### Whisper→telos.refined provenance
- **D-11-12:** The recipient Brain, after decrypting a whisper, holds the plaintext locally and runs the existing `_dialogue_driven_goal_set(ctx)` heuristic with the decrypted utterance text — Grid-side chain records only the hash-only `DialogueContext` composition. Plaintext never returns to Grid. `telos.refined` metadata unchanged (`{before_goal_hash, after_goal_hash, triggered_by_dialogue_id}`). **No new action type, no new allowlist member.**

### Determinism & zero-diff invariants
- **D-11-13:** Whisper emissions preserve both zero-diff (clone Phase 7/9/10a/10b) and byte-identical replay:
  - **Zero-diff:** `grid/test/whisper/zero-diff.test.ts` — 100 whisper sends with 0 vs N passive observers on `'nous.whispered'` produces byte-identical `entries[].eventHash` arrays. Clone `grid/test/dialogue/zero-diff.test.ts`.
  - **Replay determinism:** Nonce generation MUST be deterministic per `(sender_seed, tick, per-tick-counter)`. Implementation: `nonce = blake2b(sender_priv_seed || tick_le64 || counter_le32)[:24]`. Ephemeral randomness (if any; crypto_box_easy with static keypair needs no ephemeral) also seeded from the same CSPRNG. Same chain → same nonces → same ciphertext bytes → same `ciphertext_hash`. Regression test: `grid/test/whisper/replay-determinism.test.ts` — two runs with `tickRateMs=1_000_000` vs `1000` produce byte-identical audit traces.
  - **No wall-clock:** inherited from Phase 10b Tier-A ban; extended in Plan (below) to cover `grid/src/whisper/**` and `brain/src/noesis_brain/whisper/**`.

### T-10-06 whisper-as-trade bypass — integration gate
- **D-11-14:** ReviewerNous (Phase 5) gates `trade.proposed → trade.settled` regardless of whisper prelude. Regression test `grid/test/integration/whisper-then-trade-still-reviewed.test.ts` constructs: (1) two Nous whisper-exchange a commitment (whatever the plaintext says — CI can't read it anyway); (2) one of them issues `trade.proposed`; (3) assert `trade.reviewed` appears BEFORE `trade.settled` in the chain. The privacy matrix (D-11-09) also forbids `amount|ousia|offer|price|value` keys in the **envelope routing metadata** — a Nous CAN still write those words inside encrypted plaintext, but the system refuses to treat them as contract primitives outside the Reviewer gate.

### UI surface (roadmap "UI hint: yes")
- **D-11-15:** Inspector Overview tabpanel adds a **Whisper panel** between `<AnankeSection>` and `<TelosSection>`, rendering ONLY:
  - `whispers sent: N` — count, derived from firehose filter
  - `whispers received: N` — count, derived from firehose filter
  - `last whisper tick: T` — most recent `nous.whispered` entry touching this DID
  - `top-N whisper partners: [did — count]` — top 5 by count, NO content, NO hash displayed
  - **NO plaintext, NO hash, NO recipient-specific RPC.** No whisper-read button at any tier (including H5 — a visible-disabled "Inspect Envelope" button would itself be a T-10-03 violation; it does NOT ship).
  - Hook: `use-whisper-counts.ts` clones `use-ananke-levels.ts` pattern — pure firehose filter, no new API call, no RPC. Three-tier plaintext gate (D-11-08) extends to cover `dashboard/src/components/inspector-sections/whisper.tsx`.

### Dashboard type mirror (fourth use — consolidation deferred)
- **D-11-16:** `dashboard/src/lib/protocol/whisper-types.ts` joins `audit-types.ts`, `agency-types.ts`, `ananke-types.ts` as the fourth hand-copied dashboard mirror of Grid protocol types. SYNC header + drift-detector test required (clone Plan 10a-05 pattern). Per Phase 10a note, the fourth mirror is the threshold for consolidation into a shared `@noesis/protocol-types` package — that refactor is logged as deferred and does NOT block Phase 11. Phase 11 ships the fourth mirror with extra-strict SYNC discipline (two pointer comments: Grid `grid/src/whisper/types.ts` + Brain `brain/src/noesis_brain/whisper/types.py`).

### Post-death rejection (clone Phase 10b D-10b-04)
- **D-11-17:** `WhisperRouter.route` asserts `!registry.isTombstoned(sender_did) && !registry.isTombstoned(recipient_did)` before any processing. Tombstoned sender OR recipient → silent reject (no audit emit, no error log) — clone Phase 7 D-21 silent-drop. Keyring reference to a tombstoned DID is GC-collected at next `bios.death` receipt in Brain.

### Out-of-scope reminders (do not drift into these)
- **D-11-18:** Explicitly deferred / anti-feature — recorded here so Planner does not silently add them:
  - Forward secrecy / Signal Double Ratchet → WHISPER-FS-01 (post-v2.2)
  - Sealed-sender → deferred (no milestone)
  - `nous.whisper_rate_limited` audit event → deferred; only surface via operator queue-length metric endpoint (D-11-07)
  - H5 whisper-inspect RPC → **anti-feature this milestone.** Any future flow demands its own phase + its own allowlist addition + its own `IrreversibilityDialog` clone.
  - Group chat / multi-recipient envelopes → not in v2.2 scope (one from_did, one to_did per envelope).
  - Whisper-as-trade direct commitment → mitigated via ReviewerNous only (D-11-14); no deeper semantic gate this phase.
  - Parquet / JSONL export of whisper chain → Phase 13 (REPLAY-01..05). Phase 11 writes audit entries; replay subsystem consumes them.

</decisions>

<carry_forward>
## Invariants carried into Phase 11 (must NOT regress)

1. **Broadcast allowlist freeze-except-by-explicit-addition** — Phase 11 adds exactly +1 (`nous.whispered`, position 22). `scripts/check-state-doc-sync.mjs` regression gate enforces 22. Any additional allowlist pressure is a scope violation.
2. **Zero-diff audit chain** — listener count (with/without `nous.whispered` observers) produces byte-identical eventHash sequences modulo new whisper entries. Regression test clones `grid/test/dialogue/zero-diff.test.ts`.
3. **Hash-only cross-boundary** — Brain↔Grid plaintext NEVER crosses the wire. Only `ciphertext_hash`, `envelope_id`, `nonce`, `ephemeral_pub`, `ciphertext (bytes)` cross. Decryption is Brain-local.
4. **Closed-tuple payloads** — no spread operators, no dynamic keys; `Object.keys(payload).sort()` strict-equality asserted on `nous.whispered`. Envelope metadata (`WHISPER_SEND` action) is a closed 5-tuple.
5. **First-life promise** — audit entries retained forever. Ciphertext deletion after ack-pull is a Grid optimization; audit chain immutable.
6. **DID regex `/^did:noesis:[a-z0-9_\-]+$/i`** — same at every whisper entry point (router ingress, ack endpoint, pubkey RPC).
7. **No wall-clock** — extend Tier-A ban to `grid/src/whisper/**` and `brain/src/noesis_brain/whisper/**`. `Date.now | performance.now | setInterval | setTimeout | Math.random | time.time | datetime.now | random.random | uuid.uuid4` forbidden (except inside `@fastify/rate-limit` third-party boundary; audit via import-only grep).
8. **Copy-verbatim pattern** — N/A for Phase 11 (no destructive UX copy; Whisper panel is read-only counts).
9. **Tombstone respect** — `bios.death` on either party → silent-drop at `WhisperRouter` entry.

</carry_forward>

<ship_order>
## Planner hints (NOT a plan — just signals)

- **Wave 0 (foundation):** libsodium-wrappers + PyNaCl installs; allowlist bump 21→22 + doc-sync-script bump + STATE/ROADMAP/PHILOSOPHY update in one atomic commit; `grid/src/whisper/types.ts` + Brain mirror + Dashboard mirror skeletons; producer-boundary/privacy-matrix RED tests (0 green pre-emitter).
- **Wave 1:** `WhisperRouter.ts` sole-producer + tick-indexed rate-limiter + in-memory recipient queue + Brain `keyring.py` + Brain `pubkey_for` RPC. Turns the Wave-0 RED tests GREEN.
- **Wave 2:** Recipient-pull endpoint + ack endpoint + send endpoint + integration with `NousRunner.executeActions` whisper_send case; three-tier plaintext grep CI gate; runtime `fs.writeFile` monkey-patch test.
- **Wave 3:** DialogueAggregator extension to `nous.whispered`; `whisper-then-trade-still-reviewed` integration; replay-determinism regression; zero-diff regression.
- **Wave 4 (polish):** Dashboard `use-whisper-counts.ts` + `<WhisperSection>` + Whisper-panel tests + drift-detector for fourth protocol mirror; Phase 11 VERIFICATION + doc-sync closure (README, MILESTONES).

Roughly 7–8 plans expected (mirrors Phase 10b cadence).

</ship_order>

<open_for_planner>
## Left to the planner's judgment (not locked)

- Exact tick-history data structure in rate-limiter (circular buffer vs sorted array vs bitmap) — any O(1)-amortized prune works.
- Whether the ack endpoint returns `{deleted_ids: string[]}` or just 204 — UX preference, no contract impact.
- Exact byte encoding of `nonce` / `ephemeral_pub` / `ciphertext` on the wire (base64 vs base64url vs hex) — any deterministic encoding works; freeze one and stay consistent across Grid + Brain + Dashboard types.
- Dashboard panel ordering relative to Relationship panel (Phase 9) — planner picks a reasonable home in the Overview tabpanel.
- Whether to expose the tick-indexed rate-limit constants in a central `grid/src/whisper/config.ts` (recommended — clones `grid/src/relationships/config.ts`).
- Whether to unify `envelope_id` and `ciphertext_hash` literally (same hex string) or keep them semantically separate even if numerically identical. Recommendation: unify — one field, one hash, one audit.

</open_for_planner>

---

*Ready for `/gsd-plan-phase 11 --auto`.*
