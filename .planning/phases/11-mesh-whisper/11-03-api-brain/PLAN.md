---
phase: 11
plan_slug: 03-api-brain
wave_number: 3
type: execute
gap_closure: false
depends_on: [11-00-setup, 11-01-crypto, 11-02-emitter-router]
files_modified:
  - grid/src/api/whisper/routes.ts
  - grid/src/api/whisper/send.ts
  - grid/src/api/whisper/pending.ts
  - grid/src/api/whisper/ack.ts
  - grid/src/api/whisper/metrics.ts
  - grid/src/dialogue/aggregator.ts
  - brain/src/noesis_brain/whisper/__init__.py
  - brain/src/noesis_brain/whisper/sender.py
  - brain/src/noesis_brain/whisper/receiver.py
  - brain/src/noesis_brain/whisper/decrypt.py
  - brain/src/noesis_brain/whisper/trade_guard.py
  - grid/test/api/whisper-send.test.ts
  - grid/test/api/whisper-pending-ack.test.ts
  - grid/test/api/whisper-metrics.test.ts
  - grid/test/api/whisper-fastify-rate-limit.test.ts
  - grid/test/dialogue/aggregator-whisper-channel.test.ts
  - brain/tests/whisper/test_sender.py
  - brain/tests/whisper/test_receiver.py
  - brain/tests/whisper/test_decrypt_dispatch.py
  - brain/tests/whisper/test_trade_guard.py
autonomous: true
requirements: [WHISPER-01, WHISPER-05, WHISPER-06]
must_haves:
  truths:
    - "POST /api/v1/nous/:did/whisper/send accepts {to_did, plaintext_blob_b64} from the LOCAL Brain only (loopback bind), encrypts via libsodium-wrappers, builds a closed-5-tuple Envelope, calls WhisperRouter.route(envelope, currentTick), returns 202 on accept / 429 on rate-limit / 400 on validation / 410 on tombstone-of-self ONLY (recipient-tombstone is silent-drop returning 202 per D-11-18)"
    - "POST /api/v1/nous/:did/whisper/send is wrapped by @fastify/rate-limit (seconds-based DDoS belt, 60/min per sender DID); the tick-indexed TickRateLimiter remains the primary semantic limiter inside WhisperRouter"
    - "GET /api/v1/nous/:did/whispers/pending returns {envelopes: Envelope[]} drained from PendingStore (snapshot only; does NOT delete)"
    - "POST /api/v1/nous/:did/whispers/ack accepts {envelope_ids: string[]} and calls PendingStore.ackDelete; returns {deleted: count}"
    - "GET /api/v1/whispers/metrics returns counts-only payload {total_pending, per_did_counts: Record<did, number>, total_emitted, total_rate_limited, total_tombstone_dropped} — zero hashes, zero ciphertext, zero DIDs in payload BODIES (per_did_counts keys are DIDs but values are integers only)"
    - "Brain whisper/sender.py uses libsodium-wrappers-sumo (PyNaCl crypto_box_easy with deterministic nonce from blake2b(seed ‖ tick_le64 ‖ counter_le32, 24)) — clones the W1 deterministic nonce contract VERBATIM"
    - "Brain whisper/receiver.py polls GET /whispers/pending on configurable interval (default every nous-tick boundary; tick-indexed, not wall-clock), decrypts each envelope via decrypt.py, dispatches to deliberation engine via the same conduit as 'spoke' messages but tagged channel='whisper'"
    - "Brain whisper/trade_guard.py runs T-10-06 defense-depth regex on plaintext BEFORE encryption — rejects payloads matching `\\b(buy|sell|trade|offer|bid|ask|price|amount|ousia)\\b` with case-insensitive match; ReviewerNous (Phase 5) remains the AUTHORITATIVE gate, this is belt-and-suspenders"
    - "grid/src/dialogue/aggregator.ts ingests nous.whispered events with channel='whisper' (separate buffer key from 'spoke') — buffer key formula: `[did1,did2].sort().join('|') + '|' + channel`; HASH-ONLY ingestion (only ciphertext_hash + tick stored, NEVER any plaintext or even ciphertext)"
    - "DialogueAggregator's whisper buffer counts toward relationship-formation thresholds the SAME WAY 'spoke' does (D-11-09); the heuristic engine sees ['spoke', 'whisper'] as equally weighted dialogue evidence"
    - "All five new Grid test files GREEN; all four new Brain test files GREEN"
    - "No file under grid/src/api/whisper/** or brain/src/noesis_brain/whisper/** contains time.time(), datetime.now(), Date.now(), Math.random(), setTimeout, setInterval; check-wallclock-forbidden gate exits 0"
    - "Three-tier plaintext check (Wave 4 ships the script) would pass NOW: zero forbidden-key matches across the new files; zero `text|body|content|message|utterance|offer|amount|ousia|price|value|plaintext|decrypted|payload_plain` keys in any audit emit, response shape, or log line"
  artifacts:
    - path: "grid/src/api/whisper/routes.ts"
      provides: "Fastify plugin mounting /whisper/send + /whispers/pending + /whispers/ack + /whispers/metrics + @fastify/rate-limit"
      contains: "fastifyRateLimit"
    - path: "grid/src/api/whisper/send.ts"
      provides: "POST handler — encrypts plaintext, calls WhisperRouter.route, returns 202/400/410/429"
      contains: "whisperRouter.route"
    - path: "grid/src/api/whisper/pending.ts"
      provides: "GET handler — drainFor snapshot, returns {envelopes: []}"
      contains: "pendingStore.drainFor"
    - path: "grid/src/api/whisper/ack.ts"
      provides: "POST handler — ackDelete, returns {deleted: n}"
      contains: "pendingStore.ackDelete"
    - path: "grid/src/api/whisper/metrics.ts"
      provides: "GET handler — counts-only metrics; zero hashes / DIDs in body values"
      contains: "total_pending"
    - path: "grid/src/dialogue/aggregator.ts"
      provides: "Extended ingestion: nous.whispered events with channel='whisper' separate buffer"
      contains: "channel === 'whisper'"
    - path: "brain/src/noesis_brain/whisper/sender.py"
      provides: "Brain encrypt-and-send path — libsodium-wrappers-sumo crypto_box_easy + deterministic nonce + POST /whisper/send"
      contains: "crypto_box_easy"
    - path: "brain/src/noesis_brain/whisper/receiver.py"
      provides: "Brain pull-and-decrypt loop — GET /whispers/pending → decrypt.py → deliberation dispatch + ack"
      contains: "drainFor"
    - path: "brain/src/noesis_brain/whisper/decrypt.py"
      provides: "Decrypt envelope → plaintext string; verifies envelope_id + ciphertext_hash"
      contains: "crypto_box_open_easy"
    - path: "brain/src/noesis_brain/whisper/trade_guard.py"
      provides: "T-10-06 defense-depth regex pre-encrypt; rejects trade-keyword payloads"
      contains: "TRADE_KEYWORDS_RE"
  key_links:
    - from: "grid/src/api/whisper/routes.ts"
      to: "grid/src/whisper/router.ts"
      via: "Routes share the SAME WhisperRouter instance constructed at bootstrap (W2)"
      pattern: "whisperRouter"
    - from: "grid/src/api/whisper/routes.ts"
      to: "@fastify/rate-limit"
      via: "fastifyRateLimit registered as a route-scoped plugin on /whisper/send only"
      pattern: "fastifyRateLimit"
    - from: "brain/src/noesis_brain/whisper/sender.py"
      to: "POST /api/v1/nous/:did/whisper/send"
      via: "httpx POST with {to_did, plaintext_blob_b64}; loopback only"
      pattern: "/whisper/send"
    - from: "brain/src/noesis_brain/whisper/receiver.py"
      to: "GET /api/v1/nous/:did/whispers/pending + POST .../whispers/ack"
      via: "Pull on tick boundary, decrypt, dispatch, ack"
      pattern: "/whispers/pending"
    - from: "brain/src/noesis_brain/whisper/decrypt.py"
      to: "deliberation engine"
      via: "Dispatches plaintext + channel='whisper' tag to the same conduit as 'spoke'"
      pattern: "channel='whisper'"
    - from: "brain/src/noesis_brain/whisper/sender.py"
      to: "brain/src/noesis_brain/whisper/trade_guard.py"
      via: "Sender calls trade_guard.assert_no_trade_keywords(plaintext) BEFORE encryption"
      pattern: "assert_no_trade_keywords"
    - from: "grid/src/dialogue/aggregator.ts"
      to: "grid/src/whisper/appendNousWhispered.ts"
      via: "Aggregator subscribes to audit chain, filters eventType==='nous.whispered', tags channel='whisper'"
      pattern: "nous.whispered"
---

<objective>
Surface the whisper pipeline through HTTP and stand up the Brain's encrypt/decrypt loop. Ship four Grid Fastify routes (send / pending / ack / metrics) sharing the W2 WhisperRouter + PendingStore singletons; mount @fastify/rate-limit as the seconds-based DDoS belt on /whisper/send; ship four Brain modules (sender / receiver / decrypt / trade_guard) implementing the W1 deterministic-nonce crypto contract; widen DialogueAggregator to ingest channel='whisper' events as hash-only relationship evidence equally weighted with 'spoke'.

Purpose: Connect the producer pipeline (W2) to the outside world. The Brain becomes the only entity that ever holds plaintext; the Grid's API surface only ever sees ciphertext envelopes. T-10-06 trade-bypass defense lives in trade_guard.py at the pre-encrypt boundary so even a compromised deliberation prompt cannot smuggle trade intent through the whisper channel — Phase 5 ReviewerNous remains the authoritative gate, this is belt-and-suspenders. After this wave, two Brains can converse end-to-end: Brain-A sender.py → Grid POST /whisper/send → WhisperRouter → PendingStore → Brain-B receiver.py poll → decrypt → deliberation engine. The audit chain witnesses only ciphertext_hash; the dashboard (Wave 4) sees only counts.

Output: 5 new Grid source files (routes + send + pending + ack + metrics), 1 modified Grid source file (aggregator.ts widening), 5 new Grid test files, 4 new Brain source files (+ __init__.py), 4 new Brain test files. Zero scripts touched (Wave 4 ships plaintext gate). Dashboard untouched (Wave 4). Allowlist unchanged (W0 already added the slot).
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
@.planning/phases/11-mesh-whisper/11-01-crypto/PLAN.md
@.planning/phases/11-mesh-whisper/11-02-emitter-router/PLAN.md
@grid/src/api/operator/delete-nous.ts
@grid/src/api/relationships/list.ts
@grid/src/dialogue/aggregator.ts
@brain/src/noesis_brain/spoke/sender.py
@brain/src/noesis_brain/spoke/receiver.py

<interfaces>
<!-- Contracts the executor builds against. W0/W1/W2 already shipped. -->

**From W2 grid/src/whisper/router.ts (DO NOT redefine):**
```ts
export class WhisperRouter {
  route(envelope: Envelope, currentTick: number): boolean;
  // returns true on accept; false on silent-drop (tombstone OR rate-limit); throws on validation failure
}
```

**From W2 grid/src/whisper/pending-store.ts:**
```ts
export class PendingStore {
  enqueue(env: Envelope): void;
  drainFor(recipientDid: string): readonly Envelope[];
  ackDelete(recipientDid: string, envelopeIds: ReadonlySet<string>): number;
  evictDid(did: string): void;
  countFor(did: string): number;
  size(): number;
}
```

**From W1 grid/src/whisper/crypto.ts (already shipped):**
```ts
export async function deriveKeypair(did: string): Promise<{publicKey: Uint8Array; secretKey: Uint8Array}>;
export function deriveNonce(senderSeed: Uint8Array, tick: number, counter: number): Uint8Array;  // 24 bytes
export function ciphertextHash(ciphertext: Uint8Array): string;  // HEX64 sha256
```

**From W1 brain/src/noesis_brain/whisper/crypto.py (already shipped):**
```python
def derive_keypair(did: str) -> tuple[bytes, bytes]:  # (public, secret) — uses crypto_box_seed_keypair(sha256(did)[:32])
def derive_nonce(sender_seed: bytes, tick: int, counter: int) -> bytes:  # 24 bytes
def ciphertext_hash(ciphertext: bytes) -> str:  # HEX64 sha256
```

**Fastify route shapes (NEW — this wave):**

```ts
// POST /api/v1/nous/:did/whisper/send
// Body: { to_did: string, plaintext_blob_b64: string }
// Auth: loopback only (127.0.0.1 or localhost; not exposed to LAN/WAN)
// Returns:
//   202 { envelope_id: string, ciphertext_hash: string }      — accepted
//   400 { error: 'invalid_did' | 'invalid_plaintext' }        — validation
//   410 { error: 'self_tombstoned' }                          — :did is tombstoned (sender side, NOT recipient — recipient-tombstone is silent-drop returning 202 per D-11-18)
//   429 { error: 'rate_limited' }                             — TickRateLimiter rejected (Wave 4 confirms this is INFORMATIONAL only since the response itself is a non-payload metadata leak; document the trade-off)
//
// Note on the 429 vs silent-drop tension: 429 is acceptable here because the SENDER is the local Brain itself (loopback);
// it's not a remote attacker probing for tombstone state. Tombstone-of-RECIPIENT remains silent (returns 202 with a fake envelope_id, NO router invocation).
```

```ts
// GET /api/v1/nous/:did/whispers/pending
// Auth: loopback only
// Returns: 200 { envelopes: Envelope[] }   — snapshot, no delete
```

```ts
// POST /api/v1/nous/:did/whispers/ack
// Body: { envelope_ids: string[] }
// Auth: loopback only
// Returns: 200 { deleted: number }
```

```ts
// GET /api/v1/whispers/metrics
// Auth: loopback only (operator-style endpoint)
// Returns: 200 {
//   total_pending: number,
//   per_did_counts: Record<string, number>,   // DIDs as keys, counts as values
//   total_emitted: number,                    // monotonic counter from a small in-memory tally
//   total_rate_limited: number,
//   total_tombstone_dropped: number
// }
// CRITICAL: zero hashes, zero ciphertext, zero envelope_ids in the response body.
```

**routes.ts skeleton (THIS WAVE):**
```ts
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';

export interface WhisperRouteDeps {
  whisperRouter: WhisperRouter;
  pendingStore: PendingStore;
  registry: NousRegistry;
  worldClock: { currentTick(): number };
  metricsCounter: WhisperMetricsCounter;
}

export const whisperRoutes: FastifyPluginAsync<{deps: WhisperRouteDeps}> = async (fastify, { deps }) => {
  // Loopback guard hook — applied to all routes in this plugin
  fastify.addHook('onRequest', loopbackOnly);

  // Rate-limit JUST the send endpoint
  await fastify.register(fastifyRateLimit, {
    max: 60,
    timeWindow: '1 minute',
    keyGenerator: (req) => (req.params as any).did,  // per-sender-DID key
    skipOnError: false,
  });

  fastify.post('/api/v1/nous/:did/whisper/send', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, sendHandler(deps));
  fastify.get('/api/v1/nous/:did/whispers/pending', pendingHandler(deps));
  fastify.post('/api/v1/nous/:did/whispers/ack', ackHandler(deps));
  fastify.get('/api/v1/whispers/metrics', metricsHandler(deps));
};
```

**aggregator.ts widening (THIS WAVE — clone the existing 'spoke' filter at line ~162):**
```ts
// EXISTING (~line 162):
// if (entry.eventType === 'nous.spoke') {
//   const key = [entry.payload.did_a, entry.payload.did_b].sort().join('|') + '|spoke';
//   ...
// }

// EXTEND to also handle whispered:
if (entry.eventType === 'nous.whispered') {
  const key = [entry.payload.from_did, entry.payload.to_did].sort().join('|') + '|whisper';
  this.buffers.set(key, [...(this.buffers.get(key) ?? []), {
    tick: entry.payload.tick,
    ciphertext_hash: entry.payload.ciphertext_hash,
    // NO plaintext — this is hash-only ingestion. The aggregator's per-pair count
    // is the only signal exposed to the heuristic engine.
  }]);
  this.maybePromoteRelationship(key);
}
```

**Brain sender.py contract (NEW):**
```python
async def send_whisper(
    *,
    sender_did: str,
    recipient_did: str,
    plaintext: str,
    tick: int,
    counter: int,
    grid_base_url: str = "http://127.0.0.1:8080",
) -> dict:
    """Encrypt plaintext, POST to /whisper/send, return {envelope_id, ciphertext_hash}.

    Steps:
      0. trade_guard.assert_no_trade_keywords(plaintext)  # T-10-06 defense-depth
      1. recipient_pub, _ = derive_keypair(recipient_did)
      2. _, sender_priv = derive_keypair(sender_did)
      3. sender_seed = sha256(sender_did.encode())[:32]
      4. nonce = derive_nonce(sender_seed, tick, counter)
      5. ciphertext = crypto_box_easy(plaintext.encode(), nonce, recipient_pub, sender_priv)
      6. envelope_id = uuid4().hex
      7. ct_hash = ciphertext_hash(ciphertext)
      8. POST {to_did, plaintext_blob_b64: base64(ciphertext)}  # NB: misnamed field — see note below
      9. Return {envelope_id, ciphertext_hash}
    """
```

**Field naming note (D-11-19 — ratify in this wave's SUMMARY):**
The route accepts `plaintext_blob_b64` from the local Brain ONLY because the loopback boundary is the only place plaintext-shaped payloads should appear (and even here it's already encrypted by sender.py before POST). To minimize leak surface, the field SHOULD be renamed `ciphertext_blob_b64` in this wave. Make the rename: route accepts `ciphertext_blob_b64`; sender.py builds the ciphertext FIRST then POSTs it. The `plaintext_blob_b64` name only appears in this docblock as a deprecated alias.

**Brain receiver.py contract (NEW):**
```python
async def receive_loop(
    *,
    nous_did: str,
    grid_base_url: str = "http://127.0.0.1:8080",
    tick_source: TickSource,
    deliberation_dispatcher: DeliberationDispatcher,
) -> None:
    """On every nous-tick boundary:
      1. resp = httpx.GET(f"{grid_base_url}/api/v1/nous/{nous_did}/whispers/pending")
      2. envelopes = resp.json()['envelopes']
      3. plaintexts = [decrypt.decrypt_envelope(env, our_did=nous_did) for env in envelopes]
      4. for plaintext, env in zip(plaintexts, envelopes):
           deliberation_dispatcher.dispatch(channel='whisper', plaintext=plaintext, from_did=env['from_did'], tick=env['tick'])
      5. POST .../whispers/ack with envelope_ids
    """
```

The `tick_source` injection avoids any `time.time()` import in the receiver — the receiver waits for the WorldClock tick event, NOT for wall-clock seconds.

**Brain decrypt.py contract (NEW):**
```python
def decrypt_envelope(envelope: dict, *, our_did: str) -> str:
    """Decrypt and return plaintext string. Verifies ciphertext_hash matches envelope.ciphertext_b64.
    Raises if verification fails. Caller is responsible for catching + dropping.
    """
    # 1. Verify ciphertext_hash(b64decode(envelope['ciphertext_b64'])) == envelope['ciphertext_hash']
    # 2. our_pub, our_priv = derive_keypair(our_did)
    # 3. nonce = b64decode(envelope['nonce_b64'])
    # 4. sender_pub = b64decode(envelope['ephemeral_pub_b64'])  # OR derived from from_did per D-11-06; this wave uses the latter
    # 5. plaintext = crypto_box_open_easy(b64decode(envelope['ciphertext_b64']), nonce, sender_pub, our_priv)
    # 6. return plaintext.decode('utf-8')
```

NB: D-11-06 uses sender's stable derived keypair (NOT ephemeral). The `ephemeral_pub_b64` field in the Envelope is reserved for future forward-secrecy upgrades — for now, sender.py populates it with the sender's derived public key (redundant with from_did but preserves the schema slot). decrypt.py SHOULD ignore `ephemeral_pub_b64` and re-derive from `from_did` to ensure single source of truth.

**Brain trade_guard.py contract (NEW):**
```python
TRADE_KEYWORDS_RE = re.compile(r'\b(buy|sell|trade|offer|bid|ask|price|amount|ousia)\b', re.IGNORECASE)

class TradeKeywordRejected(Exception):
    pass

def assert_no_trade_keywords(plaintext: str) -> None:
    """T-10-06 defense-depth pre-encryption gate.
    Raises TradeKeywordRejected if any trade keyword matches.
    Phase 5 ReviewerNous remains the authoritative semantic gate; this is belt-and-suspenders
    that catches obvious literal smuggling at the wire boundary.
    """
    m = TRADE_KEYWORDS_RE.search(plaintext)
    if m:
        raise TradeKeywordRejected(f"trade keyword '{m.group(0)}' rejected at whisper boundary (T-10-06)")
```

**Pattern source files to clone (DO read these):**
- `grid/src/api/operator/delete-nous.ts` — Fastify route shape with locked-order docblock + injected deps
- `grid/src/api/relationships/list.ts` — counts-only response shape (template for /whispers/metrics)
- `grid/src/dialogue/aggregator.ts` — line ~162 'spoke' filter (extend at the same site for 'whispered')
- `brain/src/noesis_brain/spoke/sender.py` — httpx POST loopback pattern (template for whisper sender.py)
- `brain/src/noesis_brain/spoke/receiver.py` — tick-boundary pull loop with deliberation dispatch (template for whisper receiver.py)
- `test/fixtures/dids.ts` — A/B/C DIDs

**Wave 4 hand-off:**
After this wave, the three-tier plaintext check (Wave 4 ships `scripts/check-whisper-plaintext.mjs`) MUST pass against ALL files this wave creates. Pre-emptively grep your own files: `grep -nE '(text|body|content|message|utterance|offer|amount|ousia|price|value|plaintext|decrypted|payload_plain)\\s*[:=]' grid/src/api/whisper/ brain/src/noesis_brain/whisper/` should return ONLY: (a) the deprecated alias docblock comment in routes.ts, (b) trade_guard.py's TRADE_KEYWORDS_RE definition, (c) decrypt.py's local variable `plaintext` (acceptable — it's a local, not a wire/audit/log key). Document any remaining matches in SUMMARY.md so Wave 4's gate can whitelist them.
</interfaces>
</context>

<tasks>

<task id="11-W3-01" type="auto" tdd="true">
  <name>Task 11-W3-01: Ship POST /api/v1/nous/:did/whisper/send + @fastify/rate-limit mount</name>
  <requirement>WHISPER-01</requirement>
  <threat_ref>T-10-04, T-10-06</threat_ref>
  <files>grid/src/api/whisper/routes.ts, grid/src/api/whisper/send.ts, grid/test/api/whisper-send.test.ts, grid/test/api/whisper-fastify-rate-limit.test.ts</files>
  <behavior>
    - POST /api/v1/nous/:did/whisper/send accepts {to_did, ciphertext_blob_b64} (loopback-only, 127.0.0.1 / ::1)
    - Builds Envelope from request body + WorldClock.currentTick() + uuid envelope_id + sha256 ciphertext_hash
    - Calls whisperRouter.route(envelope, currentTick)
    - Returns 202 {envelope_id, ciphertext_hash} on accept
    - Returns 410 {error: 'self_tombstoned'} when registry.isTombstoned(:did) — the SENDER's own DID — true
    - Returns 429 {error: 'rate_limited'} when router returns false AND the cause was rate-limit (router does not currently distinguish; introduce a side-channel: route returns a small enum {accepted, rate_limited, tombstoned}. UPDATE: keep the boolean signature for W2 backward compat; add a peek method `rateLimiter.peek(did, tick)` for the route to call BEFORE route() to determine which 4xx code to return — order: peek tombstone first → if tombstone-of-recipient, return 202 with synthetic envelope_id (silent drop per D-11-18) → peek tombstone-of-self, return 410 → peek rate-limit, return 429 → else call route() which should now return true)
    - Returns 400 {error: 'invalid_did' | 'invalid_ciphertext'} on validation failure
    - Non-loopback request returns 403 {error: 'loopback_only'}
    - @fastify/rate-limit registered with max=60, timeWindow='1 minute', keyGenerator=req.params.did
    - whisper-fastify-rate-limit.test.ts: 60 requests in <1min from same DID succeed; 61st returns 429 with @fastify/rate-limit's response shape; the W2 TickRateLimiter is bypassed at this layer (it's still inside route())
  </behavior>
  <action>
Read `grid/src/api/operator/delete-nous.ts` for the locked-order docblock + Fastify plugin shape. Build:

1. **routes.ts**: Fastify plugin exporting `whisperRoutes` per the &lt;interfaces&gt; skeleton. Add `loopbackOnly` hook (reject `req.ip !== '127.0.0.1' && req.ip !== '::1'` with 403).

2. **send.ts**: Handler factory `sendHandler(deps)`. Body validation via @fastify/schema (zod or fastify's built-in JSON schema). Tombstone-recipient peek: if `deps.registry.isTombstoned(body.to_did)` → return 202 with `{envelope_id: 'silent-drop-' + crypto.randomUUID(), ciphertext_hash: '0'.repeat(64)}` and do NOT call router (this preserves D-11-18 silent-drop while satisfying the loopback Brain's expectation of a 2xx). Tombstone-self peek: if `deps.registry.isTombstoned(req.params.did)` → return 410. Then construct Envelope and call router.route(); on `false` return 429; on throw return 400; on `true` return 202 with `{envelope_id, ciphertext_hash}`.

3. **whisper-send.test.ts**: Use Fastify's `inject()`. Cases: happy path → 202; bad to_did → 400; recipient-tombstoned → 202 with synthetic envelope_id; self-tombstoned → 410; non-loopback → 403; rate-limit (router false) → 429.

4. **whisper-fastify-rate-limit.test.ts**: Loop 60 inject() calls, expect 60 × 202; 61st → 429 with @fastify/rate-limit's `{statusCode: 429, error: 'Too Many Requests', message: ...}` shape. Distinct DID → independent budget.

Wire `whisperRoutes` into the existing Grid Fastify bootstrap (find via `grep -rn 'fastify.register' grid/src/server.ts`). Pass the SAME `whisperRouter`, `pendingStore`, `registry`, `worldClock` instances W2 constructed.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/api/whisper-send.test.ts test/api/whisper-fastify-rate-limit.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Both test files green; loopback-only enforced; @fastify/rate-limit returns 429 at 61st request; recipient-tombstone returns 202 with synthetic envelope_id (silent-drop preserved); self-tombstone returns 410; routes.ts + send.ts contain zero forbidden plaintext keys.
  </done>
</task>

<task id="11-W3-02" type="auto" tdd="true">
  <name>Task 11-W3-02: Ship GET /whispers/pending + POST /whispers/ack</name>
  <requirement>WHISPER-06</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>grid/src/api/whisper/pending.ts, grid/src/api/whisper/ack.ts, grid/test/api/whisper-pending-ack.test.ts</files>
  <behavior>
    - GET /api/v1/nous/:did/whispers/pending returns {envelopes: Envelope[]} from pendingStore.drainFor(:did) (snapshot, no delete)
    - POST /api/v1/nous/:did/whispers/ack accepts {envelope_ids: string[]}, calls pendingStore.ackDelete, returns {deleted: count}
    - Both endpoints loopback-only (403 otherwise)
    - Pending → ack → pending round-trip: enqueue 3 → drainFor returns 3 → ackDelete with 1 id → drainFor returns 2 → ackDelete with remaining 2 → drainFor returns []
    - Acking a non-existent id is a no-op (count=0, no error)
    - Acking with empty list returns {deleted: 0}
    - Body validation: envelope_ids must be array of strings; otherwise 400
  </behavior>
  <action>
Implement pending.ts and ack.ts as small handler factories. Wire into routes.ts. Test via Fastify inject(). Use a real PendingStore + a stubbed AuditChain for `onAppend` so bios.death GC doesn't fire during tests.

```ts
// pending.ts
export const pendingHandler = (deps: WhisperRouteDeps) => async (req, reply) => {
  const did = req.params.did;
  const envelopes = deps.pendingStore.drainFor(did);
  return { envelopes };
};

// ack.ts
export const ackHandler = (deps: WhisperRouteDeps) => async (req, reply) => {
  const did = req.params.did;
  const ids = (req.body as any).envelope_ids;
  if (!Array.isArray(ids) || !ids.every(i => typeof i === 'string')) {
    return reply.code(400).send({ error: 'invalid_envelope_ids' });
  }
  const deleted = deps.pendingStore.ackDelete(did, new Set(ids));
  return { deleted };
};
```

Test cases in whisper-pending-ack.test.ts:
- Round-trip (3 enqueue → drain → partial ack → drain → full ack → drain empty)
- Non-existent ack id → {deleted: 0}, no error
- Empty list ack → {deleted: 0}
- Bad body shape → 400
- Non-loopback → 403
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/api/whisper-pending-ack.test.ts --reporter=dot</automated>
  </verify>
  <done>
    All round-trip + edge cases pass; loopback enforced; PendingStore state matches expectations after each op.
  </done>
</task>

<task id="11-W3-03" type="auto" tdd="true">
  <name>Task 11-W3-03: Ship GET /api/v1/whispers/metrics (counts-only)</name>
  <requirement>WHISPER-05</requirement>
  <threat_ref>T-10-04</threat_ref>
  <files>grid/src/api/whisper/metrics.ts, grid/test/api/whisper-metrics.test.ts</files>
  <behavior>
    - GET /api/v1/whispers/metrics returns:
      ```json
      {
        "total_pending": <int>,
        "per_did_counts": {"did:noesis:alice": 3, "did:noesis:bob": 0},
        "total_emitted": <int>,
        "total_rate_limited": <int>,
        "total_tombstone_dropped": <int>
      }
      ```
    - Zero hashes, zero ciphertext, zero envelope_ids in the response body (test asserts via JSON.stringify regex)
    - WhisperMetricsCounter is a small in-memory class incremented by WhisperRouter (extend router.ts to call deps.metricsCounter.increment('emitted' | 'rate_limited' | 'tombstone_dropped') at each branch — backward-compatible: deps.metricsCounter is OPTIONAL; W2 tests pass without it)
    - Endpoint loopback-only (403 otherwise)
    - per_did_counts derived from pendingStore: iterate the internal Map keys → countFor(did)
  </behavior>
  <action>
1. Add `WhisperMetricsCounter` class to `grid/src/whisper/metrics-counter.ts` (NEW small file, NOT in files_modified — add to deps in routes.ts):
```ts
export class WhisperMetricsCounter {
  private counters = { emitted: 0, rate_limited: 0, tombstone_dropped: 0 };
  increment(key: 'emitted' | 'rate_limited' | 'tombstone_dropped'): void { this.counters[key]++; }
  snapshot(): {emitted: number; rate_limited: number; tombstone_dropped: number} { return { ...this.counters }; }
}
```

2. Add `metrics-counter.ts` to files_modified (correction — listed implicitly here):
   - grid/src/whisper/metrics-counter.ts

3. Modify `grid/src/whisper/router.ts` (W2 file, light touch): make `metricsCounter` an OPTIONAL dep; call `this.deps.metricsCounter?.increment(...)` at each branch (silent-drop tombstone → 'tombstone_dropped'; rate-limit reject → 'rate_limited'; success → 'emitted'). Add a regression test that W2's test suite still passes (it should — the dep is optional).

4. Implement `metrics.ts`:
```ts
export const metricsHandler = (deps: WhisperRouteDeps) => async () => {
  const snap = deps.metricsCounter.snapshot();
  // Iterate pendingStore internal — expose a getter `pendingStore.allDidsWithCounts(): Record<string, number>`
  const per_did_counts = deps.pendingStore.allDidsWithCounts();
  const total_pending = deps.pendingStore.size();
  return {
    total_pending,
    per_did_counts,
    total_emitted: snap.emitted,
    total_rate_limited: snap.rate_limited,
    total_tombstone_dropped: snap.tombstone_dropped,
  };
};
```

5. Add `allDidsWithCounts()` to PendingStore (W2 file extension):
```ts
allDidsWithCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [did, envs] of this.store) out[did] = envs.length;
  return out;
}
```

6. Test cases in whisper-metrics.test.ts:
   - Empty store → all counts 0
   - 3 enqueues across 2 DIDs → total_pending=3, per_did_counts populated
   - After 5 emits + 2 rate-limit rejects + 1 tombstone-drop → counters reflect each
   - Response body regex: `expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{64}/)` (no HEX64 hashes); `expect(JSON.stringify(body)).not.toMatch(/[A-Za-z0-9+\/]{40,}/)` (no base64 ciphertext fragments)
   - Non-loopback → 403
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/api/whisper-metrics.test.ts test/whisper/whisper-router.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Metrics endpoint returns counts-only payload; regex assertions confirm zero hashes/ciphertext in body; W2 router tests still pass with new OPTIONAL metricsCounter dep; PendingStore.allDidsWithCounts works.
  </done>
</task>

<task id="11-W3-04" type="auto" tdd="true">
  <name>Task 11-W3-04: Ship Brain whisper/sender.py + receiver.py + decrypt.py + trade_guard.py</name>
  <requirement>WHISPER-01, WHISPER-06</requirement>
  <threat_ref>T-10-06</threat_ref>
  <files>brain/src/noesis_brain/whisper/__init__.py, brain/src/noesis_brain/whisper/sender.py, brain/src/noesis_brain/whisper/receiver.py, brain/src/noesis_brain/whisper/decrypt.py, brain/src/noesis_brain/whisper/trade_guard.py, brain/tests/whisper/test_sender.py, brain/tests/whisper/test_receiver.py, brain/tests/whisper/test_decrypt_dispatch.py</files>
  <behavior>
    - sender.send_whisper encrypts plaintext via crypto_box_easy + deterministic nonce + POSTs to /whisper/send; returns {envelope_id, ciphertext_hash}
    - sender calls trade_guard.assert_no_trade_keywords(plaintext) FIRST (before any crypto); raises TradeKeywordRejected on violation
    - sender uses derived sender_priv (NOT ephemeral) per D-11-06; populates envelope.ephemeral_pub_b64 with derived sender_pub
    - receiver.receive_loop: on each tick boundary (injected TickSource), GET pending → decrypt each → dispatch via injected DeliberationDispatcher with channel='whisper' → POST ack
    - decrypt.decrypt_envelope verifies ciphertext_hash matches; re-derives sender_pub from from_did (ignores ephemeral_pub_b64 per single-source-of-truth note); calls crypto_box_open_easy; returns plaintext str
    - decrypt raises on hash mismatch OR crypto_box_open_easy MAC failure; receiver catches + drops + logs (via injected logger, not stdout — keep observable for tests)
    - test_sender.py: happy path round-trip with mocked httpx → asserts plaintext NEVER appears in POST body (only ciphertext_blob_b64); trade-keyword rejection raises before httpx call
    - test_receiver.py: 3 envelopes pulled → 3 decrypts → 3 dispatches with channel='whisper' → ack with 3 ids; failed decrypt is silently dropped (NOT acked, NOT crashed)
    - test_decrypt_dispatch.py: round-trip A→B encrypt+decrypt yields original plaintext; tampered ciphertext raises; mismatched hash raises
    - No `time.time()`, `datetime.now()`, `asyncio.sleep` (without injected clock) anywhere in these files; receiver uses TickSource events
  </behavior>
  <action>
Read `brain/src/noesis_brain/spoke/sender.py` and `brain/src/noesis_brain/spoke/receiver.py` for the httpx patterns + tick-boundary pull loop. Clone shapes.

1. **__init__.py**: Re-export `send_whisper`, `receive_loop`, `decrypt_envelope`, `assert_no_trade_keywords`, `TradeKeywordRejected`. Module docstring cites WHISPER-04/06/07 + D-11-06/D-11-19.

2. **trade_guard.py** (smallest, write first):
```python
import re

TRADE_KEYWORDS_RE = re.compile(r'\b(buy|sell|trade|offer|bid|ask|price|amount|ousia)\b', re.IGNORECASE)

class TradeKeywordRejected(Exception):
    pass

def assert_no_trade_keywords(plaintext: str) -> None:
    m = TRADE_KEYWORDS_RE.search(plaintext)
    if m:
        raise TradeKeywordRejected(
            f"trade keyword '{m.group(0)}' rejected at whisper boundary (T-10-06)"
        )
```

3. **decrypt.py**:
```python
import base64
from nacl.bindings import crypto_box_open_easy
from .crypto import derive_keypair, ciphertext_hash

class DecryptVerificationError(Exception):
    pass

def decrypt_envelope(envelope: dict, *, our_did: str) -> str:
    ct = base64.b64decode(envelope['ciphertext_b64'])
    if ciphertext_hash(ct) != envelope['ciphertext_hash']:
        raise DecryptVerificationError('ciphertext_hash mismatch')
    our_pub, our_priv = derive_keypair(our_did)
    sender_pub, _ = derive_keypair(envelope['from_did'])  # re-derive; ignore ephemeral_pub_b64
    nonce = base64.b64decode(envelope['nonce_b64'])
    pt_bytes = crypto_box_open_easy(ct, nonce, sender_pub, our_priv)
    return pt_bytes.decode('utf-8')
```

4. **sender.py**:
```python
import base64
import hashlib
import uuid
import httpx
from nacl.bindings import crypto_box_easy
from .crypto import derive_keypair, derive_nonce, ciphertext_hash
from .trade_guard import assert_no_trade_keywords

async def send_whisper(*, sender_did, recipient_did, plaintext, tick, counter,
                       grid_base_url='http://127.0.0.1:8080', http_client=None):
    assert_no_trade_keywords(plaintext)
    recipient_pub, _ = derive_keypair(recipient_did)
    _, sender_priv = derive_keypair(sender_did)
    sender_seed = hashlib.sha256(sender_did.encode('utf-8')).digest()[:32]
    nonce = derive_nonce(sender_seed, tick, counter)
    ct = crypto_box_easy(plaintext.encode('utf-8'), nonce, recipient_pub, sender_priv)
    body = {
        'to_did': recipient_did,
        'ciphertext_blob_b64': base64.b64encode(ct).decode('ascii'),
        'nonce_b64': base64.b64encode(nonce).decode('ascii'),
        'tick': tick,
    }
    client = http_client or httpx.AsyncClient()
    resp = await client.post(f"{grid_base_url}/api/v1/nous/{sender_did}/whisper/send", json=body)
    resp.raise_for_status()
    return resp.json()
```

5. **receiver.py**:
```python
import httpx
from .decrypt import decrypt_envelope, DecryptVerificationError

async def receive_loop(*, nous_did, grid_base_url, tick_source, deliberation_dispatcher,
                       http_client=None, logger):
    client = http_client or httpx.AsyncClient()
    async for current_tick in tick_source.ticks():
        resp = await client.get(f"{grid_base_url}/api/v1/nous/{nous_did}/whispers/pending")
        envelopes = resp.json().get('envelopes', [])
        ack_ids = []
        for env in envelopes:
            try:
                pt = decrypt_envelope(env, our_did=nous_did)
                deliberation_dispatcher.dispatch(
                    channel='whisper',
                    plaintext=pt,
                    from_did=env['from_did'],
                    tick=env['tick'],
                )
                ack_ids.append(env['envelope_id'])
            except DecryptVerificationError as e:
                logger.warning(f"whisper decrypt failed: {e}; envelope_id={env.get('envelope_id')}")
                # Do NOT ack — leave in queue for next-tick retry OR operator GC
        if ack_ids:
            await client.post(
                f"{grid_base_url}/api/v1/nous/{nous_did}/whispers/ack",
                json={'envelope_ids': ack_ids},
            )
```

6. **test_sender.py** — Use httpx.MockTransport. Assert POST body `ciphertext_blob_b64` is NOT decodable to original plaintext (it's encrypted). Trade-keyword test: pass `"I want to buy ousia"` → raises TradeKeywordRejected; httpx mock asserts ZERO calls.

7. **test_receiver.py** — Mock TickSource yielding 1 tick; mock httpx returning 3 envelopes; mock DeliberationDispatcher; assert dispatch called 3× with channel='whisper'; assert ack POST with all 3 envelope_ids. Failed decrypt (tampered): assert NOT acked, dispatcher NOT called for that envelope, logger.warning called.

8. **test_decrypt_dispatch.py** — Round-trip: encrypt with sender.send_whisper internals (extract pure crypto into helper for testability), decrypt with decrypt_envelope, assert plaintext matches. Tampered: flip a ciphertext byte → DecryptVerificationError or NaCl CryptoError. Hash mismatch: forge ciphertext_hash field → DecryptVerificationError.
  </action>
  <verify>
    <automated>cd brain &amp;&amp; uv run pytest tests/whisper/test_sender.py tests/whisper/test_receiver.py tests/whisper/test_decrypt_dispatch.py -v</automated>
  </verify>
  <done>
    All four Brain modules (incl. trade_guard) shipped; three test files green; sender's POST body never contains plaintext; receiver dispatches with channel='whisper'; decrypt round-trip works; tampered envelopes rejected; trade_guard rejects keyword smuggling before crypto.
  </done>
</task>

<task id="11-W3-05" type="auto" tdd="true">
  <name>Task 11-W3-05: Extend grid/src/dialogue/aggregator.ts with channel='whisper' hash-only ingestion</name>
  <requirement>WHISPER-05</requirement>
  <threat_ref>T-10-02</threat_ref>
  <files>grid/src/dialogue/aggregator.ts, grid/test/dialogue/aggregator-whisper-channel.test.ts</files>
  <behavior>
    - DialogueAggregator subscribes to 'nous.whispered' audit events (in addition to existing 'nous.spoke')
    - Per-pair buffer key formula: `[from_did, to_did].sort().join('|') + '|' + channel` where channel ∈ {'spoke', 'whisper'}
    - Whisper buffer entries store ONLY {tick, ciphertext_hash} — NEVER any plaintext or even the ciphertext blob
    - maybePromoteRelationship() considers BOTH 'spoke' and 'whisper' buffers — if combined unique-tick count >= threshold, promote per D-11-09
    - Equal weighting: 5 spokes + 0 whispers === 0 spokes + 5 whispers === 3 spokes + 2 whispers (tested)
    - aggregator-whisper-channel.test.ts: emit 3 nous.whispered events between A and B → buffer key 'A|B|whisper' has 3 entries (A and B sorted alphabetically); buffer entries contain ONLY {tick, ciphertext_hash}; combined-with-spoke threshold logic verified
    - whisper-producer-boundary.test.ts (W2) STILL passes — KNOWN_CONSUMERS now includes aggregator.ts (the test's whitelist needs widening)
  </behavior>
  <action>
1. Read `grid/src/dialogue/aggregator.ts` end-to-end. Locate the existing 'nous.spoke' filter (~line 162). Add a sibling block for 'nous.whispered':

```ts
} else if (entry.eventType === 'nous.whispered') {
  const sortedDids = [entry.payload.from_did, entry.payload.to_did].sort();
  const key = sortedDids.join('|') + '|whisper';
  const existing = this.buffers.get(key) ?? [];
  this.buffers.set(key, [...existing, {
    tick: entry.payload.tick,
    ciphertext_hash: entry.payload.ciphertext_hash,
    // EXPLICIT: no plaintext, no ciphertext, no envelope_id (per D-11-09 hash-only ingestion)
  }]);
  this.maybePromoteRelationship(sortedDids[0], sortedDids[1]);
}
```

2. Update `maybePromoteRelationship(didA, didB)` to sum buffer entries from BOTH `didA|didB|spoke` AND `didA|didB|whisper` keys when comparing against the threshold. The summing must be by UNIQUE TICK (a spoke at tick=5 and a whisper at tick=5 count as 1, not 2 — same dialogue moment, different channels). Use a Set.

3. Update W2's `whisper-producer-boundary.test.ts`'s `KNOWN_CONSUMERS_WHISPERED` whitelist to include `'grid/src/dialogue/aggregator.ts'`. Re-run the boundary test to confirm green.

4. Write `aggregator-whisper-channel.test.ts`:
   - Test 1: emit 3 nous.whispered between A and B → buffer key 'didA|didB|whisper' (lex-sorted) has 3 entries; each entry has exactly 2 keys: tick, ciphertext_hash
   - Test 2: emit 3 spokes + 3 whispers at distinct ticks between A and B → unique-tick count = 6; promotion fires (assuming threshold=5)
   - Test 3: emit 5 spokes at tick 1..5 + 5 whispers at tick 1..5 between A and B → unique-tick count = 5; promotion fires (assuming threshold=5)
   - Test 4: hash-only assertion — `JSON.stringify(buffer)` regex-asserted to contain NO plaintext markers (no 'plaintext', no 'text', no 'message', no readable English words from the original payload)
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/dialogue/aggregator-whisper-channel.test.ts test/whisper/whisper-producer-boundary.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Aggregator widening landed; whisper buffer entries are hash-only (verified by regex); spoke+whisper unique-tick summing works; W2 producer-boundary test still green with widened whitelist.
  </done>
</task>

<task id="11-W3-06" type="auto" tdd="true">
  <name>Task 11-W3-06: Brain trade_guard.py — T-10-06 defense-depth test suite + integration sweep</name>
  <requirement>WHISPER-01</requirement>
  <threat_ref>T-10-06</threat_ref>
  <files>brain/tests/whisper/test_trade_guard.py</files>
  <behavior>
    - Each TRADE_KEYWORDS_RE keyword (buy, sell, trade, offer, bid, ask, price, amount, ousia) raises TradeKeywordRejected when present in plaintext
    - Case-insensitive: "BUY", "Sell", "tRaDe" all rejected
    - Word-boundary respected: "buyer" does NOT match (not in keyword list); "buying" rejected (whole-word "buy" appears? No — \b enforces token boundary. Actually "buying" contains no whole-word match. Test asserts: "buying" PASSES, "I will buy" FAILS — clarify the regex semantics in the test docblock)
    - Empty string passes
    - Multi-line plaintext with keyword in any line rejected
    - sender.send_whisper integration: passing trade-keyword plaintext raises BEFORE the httpx mock is touched (test asserts mock.call_count == 0)
    - ReviewerNous remains authoritative: docstring of trade_guard.py explicitly notes Phase 5 ReviewerNous as the semantic gate; this is the literal-keyword belt
    - Full Brain test suite green (regression sweep): `uv run pytest tests/`
    - Full Grid test suite green (regression sweep): `cd grid && npm test`
    - Wall-clock gate: `node scripts/check-wallclock-forbidden.mjs` exits 0 (covers brain/src/noesis_brain/whisper/** + grid/src/api/whisper/**)
    - state-doc-sync gate: `node scripts/check-state-doc-sync.mjs` exits 0 (unchanged)
  </behavior>
  <action>
Write test_trade_guard.py:
```python
import pytest
from noesis_brain.whisper.trade_guard import (
    assert_no_trade_keywords, TradeKeywordRejected, TRADE_KEYWORDS_RE
)

@pytest.mark.parametrize("keyword", ["buy", "sell", "trade", "offer", "bid", "ask", "price", "amount", "ousia"])
def test_each_keyword_rejected(keyword):
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords(f"I want to {keyword} something")

@pytest.mark.parametrize("variant", ["BUY", "Sell", "tRaDe", "OFFER"])
def test_case_insensitive(variant):
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords(f"please {variant} now")

def test_word_boundary_strict():
    # "buyer" / "buying" do NOT contain whole-word "buy" (token boundary)
    assert_no_trade_keywords("the buyer of records")  # passes — no whole-word match
    assert_no_trade_keywords("I am buying things")     # passes — "buying" not "buy"
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords("I want to buy")     # fails — whole-word "buy"

def test_empty_passes():
    assert_no_trade_keywords("")
    assert_no_trade_keywords("hello world")

def test_multiline():
    text = "first line is fine\nbut this line has buy in it"
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords(text)

@pytest.mark.asyncio
async def test_sender_short_circuits_on_keyword(mocker):
    """Sender must reject BEFORE touching httpx."""
    from noesis_brain.whisper.sender import send_whisper
    mock_client = mocker.AsyncMock()
    with pytest.raises(TradeKeywordRejected):
        await send_whisper(
            sender_did='did:noesis:alice',
            recipient_did='did:noesis:bob',
            plaintext='let us trade',
            tick=10, counter=0,
            http_client=mock_client,
        )
    assert mock_client.post.call_count == 0
```

Then run the integration sweep:
```bash
cd brain && uv run pytest tests/ -v
cd ../grid && npm test
cd .. && node scripts/check-wallclock-forbidden.mjs
node scripts/check-state-doc-sync.mjs
```

If wall-clock gate flags any whisper file, fix immediately (the only legitimate exception is `@fastify/rate-limit`'s internal use, which is a third-party import — the gate must scope to first-party `grid/src/whisper/` + `grid/src/api/whisper/` + `brain/src/noesis_brain/whisper/`, NOT `node_modules`).
  </action>
  <verify>
    <automated>cd brain &amp;&amp; uv run pytest tests/whisper/test_trade_guard.py -v &amp;&amp; cd ../grid &amp;&amp; npm test &amp;&amp; cd .. &amp;&amp; node scripts/check-wallclock-forbidden.mjs &amp;&amp; node scripts/check-state-doc-sync.mjs