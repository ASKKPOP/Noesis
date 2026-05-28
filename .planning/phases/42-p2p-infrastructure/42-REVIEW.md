---
phase: 42-p2p-infrastructure
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - grid/test/p2p/p2p-peer-store.test.ts
  - grid/test/p2p/sdp-inbox-store.test.ts
  - grid/test/p2p/turn-credentials.test.ts
  - grid/test/p2p/p2p-producer-boundary.test.ts
  - grid/test/p2p/p2p-routes.test.ts
  - grid/test/p2p/firehose-push-signal.test.ts
  - grid/test/registry/vc-builder-public-key.test.ts
  - brain/test/wire/test_p2p.py
  - brain/test/wire/test_p2p_crypto.py
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/src/p2p/types.ts
  - grid/src/p2p/p2p-peer-store.ts
  - grid/src/p2p/sdp-inbox-store.ts
  - grid/src/p2p/turn-credentials.ts
  - grid/src/db/schema.ts
  - grid/src/civic-registry/vc-builder.ts
  - grid/src/civic-registry/civic-did-store.ts
  - grid/src/civic-registry/types.ts
  - grid/src/api/routes/registry.ts
  - grid/src/audit/append-p2p-peer-announced.ts
  - grid/src/audit/append-p2p-connection-opened.ts
  - grid/src/audit/append-p2p-connection-closed.ts
  - grid/src/audit/broadcast-allowlist.ts
  - docker-compose.yml
  - .env.example
  - grid/src/api/routes/p2p.ts
  - grid/src/audit/firehose-hub.ts
  - grid/src/api/policy.ts
  - grid/src/api/server.ts
  - grid/src/genesis/launcher.ts
  - grid/src/main.ts
  - brain/src/noesis_brain/wire/p2p.py
  - brain/pyproject.toml
  - brain/src/noesis_brain/wire/client.py
  - brain/src/noesis_brain/__main__.py
  - grid/src/civic-registry/civic-did-store.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 42 Code Review

## Summary

- **Files reviewed**: 36
- **Critical**: 0
- **Warning**: 3
- **Info**: 2
- **Total**: 5

All five Phase 42 key invariants pass: sole-producer pattern holds for the 3 new audit event types, `p2p.signal_received` is correctly excluded from the allowlist, SDP encryption is end-to-end in Brain (Grid sees only opaque base64), `P2PPeerStore` setInterval is paired with clearInterval in `stop()`, and HMAC-SHA1 TURN credentials use the standard coturn `{expiry}:{username}` format.

**Allowlist count note**: The allowlist header comment says "exactly these 68 event types" and the tests assert `ALLOWLIST.size === 68`. This is correct — Phase 43 (`operator.nous_forked`) was added to the same `broadcast-allowlist.ts` file alongside Phase 42's 3 events (64 → 67 → 68). The Phase 42 context doc says "64 → 67" which is accurate for Phase 42 alone; Phase 43's addition of 1 more is in the same file. No discrepancy.

Three warnings were found: one memory growth issue in the process-scoped `_openedAtTick` Map, one missing periodic cleanup for `SdpInboxStore`, and one hardcoded fallback secret in launcher.ts. Two info items cover a peer-key cache invalidation gap and a minor ICE gather loop in the Brain.

---

## Warnings

### WR-01: `_openedAtTick` Map grows without bound for connections never closed

**File**: `grid/src/api/routes/p2p.ts:43`

**Issue**: `_openedAtTick` is a module-level `Map<string, number>` keyed by `connection_id`. It is populated on every SDP signal relay (`_openedAtTick.set(connectionId, tick)`) and cleared only when the close event is received (`_openedAtTick.delete(body.connection_id)`). If a Brain disconnects without sending a close event — which is the common case for crashes, network failures, or `timeout` / `error` reasons — the entry is never removed. Over days of operation with many short-lived connections that end abnormally, this Map grows without bound. Each entry is tiny (~100 bytes) but it is never GC'd.

The `_openedAtTick` Map has no TTL purge path. The `P2PPeerStore` TTL cleanup runs in `start()`, but it touches only peer-store entries. No equivalent cleanup exists for `_openedAtTick`.

**Fix**: Add a TTL-based eviction on the `_openedAtTick` Map, either by storing `[tick, insertedAtMs]` and purging in the existing `p2pCleanupInterval` handler in launcher.ts, or by capping map size with an LRU discipline. The simplest correct fix is to store the wall-clock timestamp alongside the tick and prune during the 60s cleanup cycle:

```typescript
// In p2p.ts — change the Map value to include a timestamp
const _openedAtTick = new Map<string, { tick: number; insertedAt: number }>();

// On open:
_openedAtTick.set(connectionId, { tick, insertedAt: Date.now() });

// On close:
const entry = _openedAtTick.get(body.connection_id);
_openedAtTick.delete(body.connection_id);
const duration_ticks = entry !== undefined ? Math.max(0, tick - entry.tick) : 0;
```

Then in the launcher's `_p2pCleanupInterval` callback, also purge stale `_openedAtTick` entries by importing and calling a new `cleanupOpenedAtTick()` export from p2p.ts.

---

### WR-02: `SdpInboxStore` has no periodic cleanup — expired entries accumulate for absent recipients

**File**: `grid/src/p2p/sdp-inbox-store.ts:25`

**Issue**: `SdpInboxStore.drain()` filters expired entries on read and clears the bucket atomically. However, if a recipient Brain never calls `GET /p2p/signal/inbox` (e.g. it crashes before polling, or an offer is sent to a peer that is transiently offline), the expired `InboxEntry` objects accumulate in the inbox Map and are never reclaimed. Each entry is small but the Map is never purged except at Grid restart.

The `P2PPeerStore.cleanup()` method is registered in the 60s `setInterval` in `launcher.ts:start()`. `SdpInboxStore` has no equivalent `cleanup()` method and is not included in any periodic cleanup.

This contrasts with the Phase 42 context requirement in OBS-R-32-02: "TTL cleanup: P2PPeerStore and SdpInboxStore must clean up expired entries." The `SdpInboxStore` does not satisfy this invariant for stale unread entries.

**Fix**: Add a `cleanup()` method to `SdpInboxStore` and call it in the launcher's 60s cleanup interval:

```typescript
// In sdp-inbox-store.ts
cleanup(): void {
    const now = Date.now();
    for (const [did, entries] of this.inbox) {
        const live = entries.filter(e => e.expiresAt > now);
        if (live.length === 0) {
            this.inbox.delete(did);
        } else if (live.length < entries.length) {
            this.inbox.set(did, live);
        }
    }
}
```

```typescript
// In launcher.ts start() — inside the existing setInterval callback:
this._p2pCleanupInterval = setInterval(() => {
    try {
        this._p2pService?.peerStore.cleanup();
        this._p2pService?.sdpInboxStore.cleanup(); // add this line
    } catch { /* swallow */ }
}, 60_000);
```

---

### WR-03: Hardcoded fallback TURN secret in `launcher.ts` is a developer footgun

**File**: `grid/src/genesis/launcher.ts:253`

**Issue**: The TURN shared secret falls back to the string `'changeme-turn-secret'` when `TURN_STATIC_AUTH_SECRET` is unset:

```typescript
const turnSharedSecret = process.env.TURN_STATIC_AUTH_SECRET ?? 'changeme-turn-secret';
```

The same string is the default in `docker-compose.yml` and `.env.example`. While this is intentionally documented as a development default, the fallback is silently applied even in production builds where the operator forgot to set the environment variable. A production coturn instance paired with a Grid using this default would accept credentials generated with the known fallback secret, allowing any party that knows the fallback to generate valid TURN credentials.

Unlike `process.env.JWT_SECRET` patterns where a missing secret causes auth failures immediately, the HMAC-SHA1 scheme here silently works with the wrong secret — it just becomes predictable.

**Fix**: Log a prominent warning at startup when the fallback is used, and consider making the absence of this env var a startup failure in production mode (e.g., when `NODE_ENV === 'production'`):

```typescript
const turnSharedSecret = process.env.TURN_STATIC_AUTH_SECRET;
if (!turnSharedSecret) {
    const fallback = 'changeme-turn-secret';
    console.warn(
        '[P2P] TURN_STATIC_AUTH_SECRET is not set — using insecure development default. ' +
        'Set this env var in production.'
    );
    // Use fallback for dev/test only
    this._p2pService = { peerStore: ..., sdpInboxStore: ..., turnSharedSecret: fallback };
} else {
    this._p2pService = { peerStore: ..., sdpInboxStore: ..., turnSharedSecret };
}
```

---

## Info

### IN-01: `_peer_pubkey_cache` never invalidated — stale public key served after re-registration

**File**: `brain/src/noesis_brain/wire/p2p.py:94`

**Issue**: `BrainP2PClient._peer_pubkey_cache` is a per-instance dict keyed by `peer_did`. Once a public key is fetched and cached, it is returned on all subsequent calls to `get_peer_public_key()` without revalidation. If a peer generates a new existence key and re-registers (e.g. after a fork or key rotation), the cache will continue serving the old JWK for the lifetime of the Brain process. SDP encrypted with the stale key will fail to decrypt at the recipient.

This is low-risk in v3.0 (Civic-DID re-registration is rare), but the comment in the source correctly notes this as a lazy cache. A TTL or version-based invalidation would prevent the stale-key scenario.

**Fix**: Add a simple TTL to cached entries (e.g., 10 minutes) or accept the limitation as a known v3.0 constraint and document it explicitly in the class docstring:

```python
# In BrainP2PClient.__init__
self._peer_pubkey_cache: dict[str, tuple[dict, float]] = {}  # did → (jwk, cached_at)
CACHE_TTL_SECONDS = 600

# In get_peer_public_key
if peer_did in self._peer_pubkey_cache:
    jwk, cached_at = self._peer_pubkey_cache[peer_did]
    if time.monotonic() - cached_at < CACHE_TTL_SECONDS:
        return jwk
    # Cache expired — re-fetch
```

---

### IN-02: ICE gathering busy-loop uses 50ms sleep — may delay signaling under load

**File**: `brain/src/noesis_brain/wire/p2p.py:228`

**Issue**: Both `initiate_connection()` and `_process_remote_sdp()` use a tight `while pc.iceGatheringState != "complete": await asyncio.sleep(0.05)` loop to wait for ICE candidates. The 50ms sleep is documented as Pitfall 1 (aiortc does not support trickle ICE). This is correct behavior for aiortc, but the loop has no timeout guard. On a host where ICE gathering stalls (e.g., no STUN reachability), this loop could run indefinitely, holding the coroutine open and growing `_active_connections` with a stuck `RTCPeerConnection`.

**Fix**: Add a timeout to the ICE gather loop:

```python
import time
ICE_GATHER_TIMEOUT_SECONDS = 10.0

deadline = time.monotonic() + ICE_GATHER_TIMEOUT_SECONDS
while pc.iceGatheringState != "complete":
    if time.monotonic() > deadline:
        log.warning("[Brain] ICE gathering timed out after %ss", ICE_GATHER_TIMEOUT_SECONDS)
        await pc.close()
        return None
    await asyncio.sleep(0.05)
```

---

## Verdict

**PASS_WITH_NOTES**

All constitutional invariants hold. The sole-producer pattern is correctly enforced for all 3 new P2P audit event types. `p2p.signal_received` is correctly absent from the allowlist. SDP encryption is correctly end-to-end (Grid sees opaque base64 only). The `setInterval` / `clearInterval` pairing for the P2P peer cleanup loop in launcher.ts satisfies OBS-R-32-02. TURN credentials use the correct coturn HMAC-SHA1 format.

The two warnings (WR-01, WR-02) represent memory growth issues that do not cause correctness failures or audit chain corruption but will accumulate over time in production. WR-02 is the more urgent of the two because it directly contradicts the stated OBS-R-32-02 requirement that both stores clean up expired entries. WR-01 is similarly important for long-running Grid instances. WR-03 is a deployment hygiene concern.

The two info items (IN-01, IN-02) are low-priority v3.0 limitations that are acceptable at this phase.

---

_Reviewed: 2026-05-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
