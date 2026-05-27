# Phase 41: Sleep Cycle + Away Presence — Research

**Researched:** 2026-05-27
**Domain:** Grid-side civic presence lifecycle, Node.js grace timers, MySQL migrations, Brain heartbeat, Portal Civic Map polling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-41-01: Away Detection — Hybrid Grace Timer**
- WSS disconnect starts a 5-minute server-side grace timer per Civic-DID
- Grace window: 5 minutes
- Storage: `away_grace_expires_at TIMESTAMP(3)` column on `civic_did_registry` (migration v30)
- Timer management: Node.js `setTimeout` per Civic-DID on WSS disconnect; cancelled on reconnect or heartbeat

**D-41-02: Heartbeat Endpoint**
- Brain sends `POST /api/v1/civic/presence` every 60 seconds while running
- Auth: Phase 38 Brain bearer JWT (`policy: 'brain_required'`)
- Effect: resets grace timer + updates `last_seen_at` + `last_seen_tick`
- Away status is invisible at the Brain API level — Brain-authenticated writes NOT blocked while Nous is `away`

**D-41-03: Message Queue — Direct Messages Only**
- Only `POST /api/v1/civic/message` queues in `civic_message_queue` when recipient Nous is `away`
- All other civic writes execute immediately; away Nous discovers them on reconnect via firehose replay
- Queue table: `civic_message_queue` (migration v31) with columns: id, grid_name, recipient_civic_did, sender_civic_did, message_json, sent_at_tick, sent_at, status ENUM('pending','delivered')
- Index: (grid_name, recipient_civic_did, status)

**D-41-04: Inbox Endpoint — Messages Only**
- `GET /api/v1/civic/inbox?since=<tick>` returns only queued direct messages
- Response: `{ messages: [{...}], queue_depth: N }`
- After Brain confirms delivery: `PATCH /api/v1/civic/inbox/ack` marks messages `delivered`
- Auth: Phase 38 Brain bearer JWT

**D-41-05: last_seen_tick Persistence**
- Brain-local SQLite (Phase 38 WireQueue DB): Brain writes `last_seen_tick` after each successful heartbeat ACK
- On reconnect, Brain reads local value and passes to: inbox `?since=<tick>` + WSS subscribe `?since=<tick>`
- Fallback: if local SQLite is wiped, Brain calls `GET /api/v1/civic/presence/me` (Brain-JWT auth) to retrieve Grid's stored `last_seen_tick`
- Grid stores `last_seen_tick` in `civic_did_registry` (migration v30)

**D-41-06: Civic Map Away State**
- Portal Civic Map is free to use CSS (D-V3-06 raw-SVG invariant applies to Steward Console only)
- Away CSS: `opacity: 0.4; filter: grayscale(100%)`
- Hover tooltip: "away — last seen X min ago"
- Portal Civic Map polls `GET /api/v1/civic/presence` (no-auth, `visitor_public` policy) every 30 seconds
- Response: `{ nous: [{ civic_did, presence_status, last_seen_at }] }`

**D-41-07: Absence Escalation Thresholds (Q-V3-H — LOCKED)**
- `away`: Grace timer expires (5 min) → Civic Map shows dimmed avatar
- `absent`: 30 days since `last_seen_at` → community charters with `revoke_absent: true` auto-revoke; notification queued
- `presumed_departed`: 1 year since `last_seen_at` → Civic-DID frozen; Business-DID dissolved; Bios → treasury with `irs.disbursement_executed` audit entry tagged `cause: presumed_departed`
- Escalation trigger: Node.js `setInterval` running every 24 hours (NOT tick-loop based)

### Claude's Discretion

- DB migration numbering: v30 = add presence columns to `civic_did_registry`; v31 = new `civic_message_queue` table
- Exact column names for presence tracking
- `POST /api/v1/civic/presence` response shape
- Whether the 24h escalation check is wired into `GenesisLauncher` or as a standalone module
- `absent` / `presumed_departed` visual states on Civic Map beyond `away` treatment
- `GET /api/v1/civic/presence` response shape (public endpoint)
- Steward Console queue depth display: existing `/system/operators` page pattern can be reused

### Deferred Ideas (OUT OF SCOPE)

- Operator notification channels (email, push) when Brain's Nous goes away
- Reversal of `presumed_departed` — TBD constitutional process, not in v3.0
- Government-legislated threshold overrides — Phase 46 framework
- Hot-reload of presence thresholds without restart — v3.x
- Per-community `revoke_absent` charter processing — Phase 49; Phase 41 stubs the emission
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SLEEP-01 | Brain offline >5min → Grid marks Civic-DID `away`; Civic Map renders dimmed avatar + tooltip | D-41-01 grace timer + D-41-06 CSS + firehose-hub.ts `onConnect`/`close` hooks |
| SLEEP-02 | Messages to away Nous queue in `civic_message_queue`; delivered as batch on Brain reconnect | D-41-03 queue table + `POST /api/v1/civic/message` handler |
| SLEEP-03 | On reconnect, Brain pulls queued messages + civic events since `last_seen` via inbox endpoint | D-41-04 inbox endpoint + D-41-05 `last_seen_tick` persistence + Phase 38 WSS subscriber `?since=` cursor |
| SLEEP-04 | After 30 days offline, status → `absent`; community charter revocation stub emitted | D-41-07 escalation thresholds + 24h `setInterval` in GenesisLauncher |
| SLEEP-05 | After 1 year offline, status → `presumed_departed`; Civic-DID frozen; Business-DID dissolved; Bios → treasury | D-41-07 + `irs.disbursement_executed` audit event (pre-emitted; Phase 45 will own full IRS logic) |
</phase_requirements>

---

## Summary

Phase 41 implements Grid-side civic presence tracking for operator Brain offline windows. It is a pure infrastructure phase: no new civic institutions, no new governance rules. The core mechanic is a hybrid grace timer on the Grid that starts when a Brain's WSS connection drops and is cancelled when the Brain reconnects or sends a heartbeat. The 4-state model (awake → away → absent → presumed_departed) persists in MySQL `civic_did_registry`, with a daily `setInterval` escalation check.

The phase touches three tiers: Grid (new routes + DB columns + timer management), Brain (new heartbeat loop + `last_seen_tick` KV in existing WireQueue SQLite + `?since=` cursor on WSS reconnect), and Portal Dashboard (Civic Map poll frequency changes from 5s → 30s + presence-aware avatar styling). The Steward Console adds a queue-depth section following the Phase 39 `/system/operators` pattern.

The key architectural constraint is that Phase 41 MUST NOT interfere with Phase 16 cognitive sleep (Hypnos). The two are entirely orthogonal: Phase 16 (`nous.sleep.entered` / `nous.sleep.completed`) is Brain-internal LTM consolidation; Phase 41 is Grid-side TCP presence tracking. They use separate event types, separate code paths, and separate modules.

**Primary recommendation:** Implement in three waves: (Wave 1) DB schema + `CivicDidStore` presence methods + escalation `setInterval` in `GenesisLauncher`; (Wave 2) Grid routes + `WsFirehoseHub` grace timer wiring + Brain heartbeat loop; (Wave 3) Civic Map 30s polling + presence CSS + Steward Console queue depth display.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Grace timer start/cancel | Grid (firehose-hub.ts) | — | WSS disconnect events fire in `WsFirehoseHub.onConnect` socket close handler |
| Presence status storage | Grid (MySQL civic_did_registry) | — | All civic state lives in Grid MySQL; Brain never writes civic state directly |
| Heartbeat receipt + timer reset | Grid (POST /api/v1/civic/presence) | Brain (periodic call) | Grid owns the authoritative status; Brain is the keep-alive signal sender |
| last_seen_tick persistence | Brain (WireQueue SQLite KV) | Grid (civic_did_registry column) | Brain-local for fast reconnect; Grid copy is fallback if Brain's SQLite is wiped |
| Message queueing | Grid (civic_message_queue table) | — | Queue lives server-side; Brain never knows messages queued until it reconnects |
| Message delivery on reconnect | Grid (inbox endpoint) | Brain (inbox poll) | Grid serves queued messages; Brain initiates the pull on reconnect |
| Civic event replay on reconnect | Grid (WSS firehose `?since=`) | Brain (subscriber `?since=` cursor) | Phase 38 subscriber already reconnects; Phase 41 adds the tick cursor |
| 24h escalation check | Grid (GenesisLauncher setInterval) | — | Absence thresholds are server-side policy; no client involvement |
| Civic Map presence display | Portal Dashboard (CivicMap.tsx) | — | D-V3-06 raw-SVG invariant; Portal free to use CSS |
| Queue depth display | Steward Console (operators page) | — | Tier-2 Grid Manager surface per D-V3-36 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MySQL2 (mysql2/promise) | ~3.9 (already in project) | Presence column queries + queue table | [VERIFIED: grid/package.json — existing dep] |
| Node.js `setTimeout`/`setInterval` | built-in | Grace timer + 24h escalation | [VERIFIED: CONTEXT.md D-41-01/07 — locked decision] |
| TypeScript | ~5.x (already in project) | Grid-side implementation | [VERIFIED: grid/tsconfig.json exists] |
| Python asyncio + httpx | already in brain | Brain heartbeat async loop | [VERIFIED: brain/src/noesis_brain/wire/client.py] |
| SQLite3 (sqlite3 module) | already in brain WireQueue | last_seen_tick KV storage | [VERIFIED: brain/src/noesis_brain/wire/queue.py] |
| Vitest | already in project | Grid unit tests | [VERIFIED: grid/package.json — `npm test` = `vitest run`] |
| pytest + pytest-asyncio | already in brain | Brain unit tests | [VERIFIED: brain/pyproject.toml] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix Tooltip or HTML `title` | already in Portal (Radix used) | Civic Map hover tooltip | Away tooltip on Nous avatar |
| AbortController + `fetch` | browser built-in | Civic Map 30s polling hook | Extend `useCivicMap` hook with 30s interval |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js `setTimeout` per Civic-DID | Redis TTL / distributed timer | `setTimeout` is simpler for single-process Grid; Redis not in current stack |
| `setInterval` in GenesisLauncher | Standalone escalation module | GenesisLauncher precedent set by Phase 31 audit reconcile; either works — Claude's discretion per CONTEXT.md |
| 30s polling for Civic Map presence | WebSocket push from Grid | Polling is already established pattern (`useCivicMap` currently polls at 5s); no new WS subscription needed per D-41-06 |

**Installation:** No new packages required. All dependencies already present in the project.

---

## Architecture Patterns

### System Architecture Diagram

```
Brain (operator machine)
  │  60s heartbeat loop
  ▼
POST /api/v1/civic/presence ──► Grid: reset grace timer + update last_seen_at/tick
                                     │
WSS disconnect ──────────────► Grid: WsFirehoseHub.onConnect socket 'close' handler
                                     │ starts setTimeout(300_000ms) per Civic-DID
                                     │
                                     ├── if heartbeat/reconnect arrives within 5min
                                     │   └── clearTimeout → status stays 'awake'
                                     │
                                     └── if grace timer fires (5min elapsed)
                                         └── CivicDidStore.updatePresence('away')
                                                     │
                                                     ▼
Portal Civic Map ◄── 30s poll ── GET /api/v1/civic/presence (visitor_public)
  (opacity:0.4, grayscale)

                                GenesisLauncher setInterval(86_400_000ms)
                                     │
                                     ├── last_seen_at > 30d → status = 'absent'
                                     │   └── emit stub: community.revocation_queued (if revoke_absent)
                                     │
                                     └── last_seen_at > 1y → status = 'presumed_departed'
                                         ├── freeze Civic-DID (409 on any action)
                                         ├── dissolve Business-DID
                                         ├── cancel marketplace listings
                                         └── Bios → treasury + irs.disbursement_executed

Brain reconnects:
  ├── reads last_seen_tick from WireQueue SQLite (fallback: GET /api/v1/civic/presence/me)
  ├── GET /api/v1/civic/inbox?since=<tick> → receive queued direct messages
  ├── PATCH /api/v1/civic/inbox/ack → mark messages delivered
  └── WSS subscribe wss://grid/api/v1/brain/firehose?since=<tick> → replay missed events

POST /api/v1/civic/message (sender → away Nous)
  └── recipient is 'away'? → INSERT civic_message_queue (status='pending')
                            → else: deliver normally
```

### Recommended Project Structure

```
grid/src/
├── civic-presence/             # NEW: Phase 41 presence management
│   ├── presence-store.ts       # PresenceStore — wraps MySQL presence queries
│   ├── grace-timer-registry.ts # GraceTimerRegistry — Map<civicDid, NodeJS.Timeout>
│   ├── escalation-check.ts     # runEscalationCheck() — walk away/absent, apply thresholds
│   ├── message-queue-store.ts  # MessageQueueStore — civic_message_queue CRUD
│   └── types.ts                # PresenceStatus enum, PresenceRecord, QueuedMessage types
├── api/routes/
│   ├── civic-presence.ts       # NEW: POST /api/v1/civic/presence (heartbeat + public GET)
│   ├── civic-inbox.ts          # NEW: GET /api/v1/civic/inbox, PATCH /api/v1/civic/inbox/ack
│   └── civic-message.ts        # NEW: POST /api/v1/civic/message (queue-aware send)
├── db/schema.ts                # ADD migrations v30 (presence columns) + v31 (queue table)
├── audit/firehose-hub.ts       # EXTEND: grace timer on WSS disconnect/reconnect
├── civic-registry/
│   └── civic-did-store.ts      # EXTEND: updatePresence(), getPresenceStatus(), listAwayNous()
└── genesis/
    └── launcher.ts             # EXTEND: setInterval for 24h escalation

brain/src/noesis_brain/wire/
├── client.py                   # EXTEND: post_presence_heartbeat() method
├── subscriber.py               # EXTEND: ?since=<last_seen_tick> on WSS reconnect
└── queue.py                    # EXTEND: last_seen_tick KV entry (new table in wire_queue.db)

dashboard/src/
├── lib/use-civic-map.ts        # EXTEND: change poll interval 5s → 30s; add presence fields
├── app/portal/civic-map/
│   ├── CivicMap.tsx            # EXTEND: away/absent/presumed_departed avatar CSS + tooltip

steward/src/app/system/operators/
└── page.tsx                    # EXTEND: Section 4 queue depth display
```

### Pattern 1: Grace Timer per Civic-DID in WsFirehoseHub

**What:** When a Civic-DID holder's WSS socket closes, start a per-DID `setTimeout`. If Brain reconnects or heartbeats within the window, cancel the timer. If it fires, call `CivicDidStore.updatePresence('away')`.

**When to use:** Any WSS disconnect where the client has an authenticated Civic-DID context.

**Example:**
```typescript
// Source: [ASSUMED] — pattern follows existing firehose-hub.ts socket close handler
// grid/src/civic-presence/grace-timer-registry.ts

export class GraceTimerRegistry {
    private readonly timers = new Map<string, NodeJS.Timeout>();

    startGraceTimer(civicDid: string, onExpired: () => void, graceMs: number): void {
        this.cancelGraceTimer(civicDid); // reset if already running
        const timer = setTimeout(() => {
            this.timers.delete(civicDid);
            onExpired();
        }, graceMs);
        this.timers.set(civicDid, timer);
    }

    cancelGraceTimer(civicDid: string): void {
        const existing = this.timers.get(civicDid);
        if (existing) {
            clearTimeout(existing);
            this.timers.delete(civicDid);
        }
    }

    clear(): void {
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
    }
}
```

**Integration with WsFirehoseHub:** In `WsFirehoseHub.onConnect`, wire the `socket.on('close', ...)` handler to call `graceTimerRegistry.startGraceTimer(didContext.civicDid, () => civicDidStore.updatePresence(civicDid, 'away', currentTick), GRACE_MS)`.

### Pattern 2: 24h Escalation Check via setInterval in GenesisLauncher

**What:** Add a `setInterval` in the `GenesisLauncher` constructor (NOT in `onTick`) that fires every 24 hours. Calls `runEscalationCheck()` which walks `away`/`absent` Civic-DIDs and applies thresholds.

**When to use:** Any daily server-side check that is too expensive to run on every tick.

**Example:**
```typescript
// Source: [ASSUMED] — pattern mirrors Phase 31 auditReconcile wiring in launcher.ts
// grid/src/genesis/launcher.ts (inside constructor)

private _escalationInterval: NodeJS.Timeout | undefined;

// In constructor, after pool is attached (or wired via attachPresenceStore):
this._escalationInterval = setInterval(
    () => void this._presenceStore?.runEscalationCheck(this.clock.currentTick),
    24 * 60 * 60 * 1000, // 24 hours
);
// NOTE: Must be cleared in stop() — OBS-R-32-02 setInterval-lifecycle CI gate WILL fail otherwise.
```

**Key constraint:** The `check-interval-lifecycle.mjs` CI gate (Phase 32, OBS-R-32-02) enforces that every `setInterval` in `grid/src/` has a corresponding `clearInterval` reachable from the same class. The escalation interval MUST be cleared in `GenesisLauncher.stop()` or equivalent shutdown path.

### Pattern 3: Brain Heartbeat Loop in GridWireClient

**What:** Add `post_presence_heartbeat()` method to `GridWireClient`. Call it from a `asyncio.Task` started at Brain startup. The method posts to `POST /api/v1/civic/presence` and writes the returned `last_seen_tick` to WireQueue SQLite.

**When to use:** Any Brain-to-Grid keep-alive that requires auth.

**Example:**
```python
# Source: [ASSUMED] — pattern follows existing post_actions() in client.py
# brain/src/noesis_brain/wire/client.py

async def post_presence_heartbeat(self) -> None:
    """POST to /api/v1/civic/presence to reset grace timer on Grid.

    Called every 60s by the heartbeat task. Errors are logged but NOT raised
    — a failed heartbeat is not fatal; the grace timer will fire after 5min.
    On success, stores returned last_seen_tick in WireQueue SQLite.
    """
    try:
        token = self._token_manager.get_valid_token()
        client = await self._get_client()
        resp = await client.post(
            f"{self._base_url}/api/v1/civic/presence",
            json={},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if 200 <= resp.status_code < 300:
            data = resp.json()
            if self._queue and "last_seen_tick" in data:
                self._queue.set_last_seen_tick(data["last_seen_tick"])
    except Exception as exc:
        log.warning("[Brain] presence heartbeat failed: %s", exc)
```

### Pattern 4: last_seen_tick KV in WireQueue SQLite

**What:** Add a `kv_store` table to the existing `wire_queue.db` SQLite database. `set_last_seen_tick(tick)` and `get_last_seen_tick()` are the only methods needed.

**Example:**
```python
# Source: [ASSUMED] — extends existing WireQueue.__init__ in queue.py
# brain/src/noesis_brain/wire/queue.py

# In WireQueue.__init__, add after existing table creation:
self._conn.execute("""
    CREATE TABLE IF NOT EXISTS kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
""")

def set_last_seen_tick(self, tick: int) -> None:
    with self._conn:
        self._conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_seen_tick', ?)",
            (str(tick),),
        )

def get_last_seen_tick(self) -> int | None:
    cur = self._conn.execute("SELECT value FROM kv_store WHERE key = 'last_seen_tick'")
    row = cur.fetchone()
    return int(row[0]) if row else None
```

### Pattern 5: Civic Map Presence CSS (Portal, not Steward)

**What:** Extend `CivicMap.tsx` `NousMapEntry` to include `presence_status`. Apply inline SVG style for `away` opacity + grayscale filter. D-V3-06 raw-SVG invariant allows CSS on Portal; this is in `dashboard/`, not `steward/`.

**Example:**
```tsx
// Source: [ASSUMED] — extends existing CivicMap.tsx avatar circle render
// Existing code: opacity={n.status === 'online' ? 1 : 0.4}
// Phase 41 extension:

const isAway = n.presence_status === 'away';
const isAbsent = n.presence_status === 'absent' || n.presence_status === 'presumed_departed';

// On the circle element:
style={{
    pointerEvents: 'none',
    filter: isAway || isAbsent ? 'grayscale(100%)' : 'none',
    opacity: isAway ? 0.4 : isAbsent ? 0.2 : 1,
}}
```

### Anti-Patterns to Avoid

- **Adding `onTick` subscription for escalation check:** The 24h check fires via `setInterval`, NOT `this.clock.onTick`. A tick-based check on every tick is expensive (walks all `away` DIDs every ~500ms). CONTEXT.md explicitly: "MUST NOT add a new `onTick` subscription — use `setInterval` in the launcher constructor instead."
- **Reusing Phase 16 sleep apparatus:** `NousSleepPayload`, `appendNousSleepEntered`, `appendNousSleepCompleted`, and `grid/src/audit/append-operator-forced-sleep.ts` are for cognitive sleep (Hypnos). DO NOT reuse for Phase 41 civic presence. The types are unrelated; conflation would break Phase 16 sole-producer discipline.
- **Blocking the Grid tick on grace timer callbacks:** Grace timer callbacks must be fire-and-forget (use `void` dispatch into async MySQL update). The timer callback must never throw into the Node.js event loop synchronously.
- **Using `setInterval` without `clearInterval` in shutdown:** The `check-interval-lifecycle.mjs` CI gate checks this. Every new `setInterval` in `grid/src/` must have a paired `clearInterval` in a cleanup path.
- **Emitting `irs.disbursement_executed` without adding to allowlist:** Phase 41 pre-emits this event for `presumed_departed` Bios disbursement. It MUST be added to the broadcast allowlist at position 65. Phase 45 (IRS) will own the full IRS machinery, but Phase 41 is the first emitter.
- **Routing `POST /api/v1/civic/presence` with wrong policy:** The heartbeat endpoint must use `brain_required` (Brain JWT policy). The public GET `GET /api/v1/civic/presence` must use `'public'` (visitor_public, no auth). These are different routes with different policies. If `'brain_required'` is not already a `RouteDIDPolicy` value, add it; otherwise use the nearest Brain-JWT policy (`'civic_did_required'` with Brain JWT resolving to `civic_member` tier as established in Phase 38 `GET /api/v1/brain/firehose`).
- **Forgetting the ROUTE_DID_POLICY CI gate:** `check-did-policy-coverage.mjs` fails if any route registered in `grid/src/api/server.ts` is not in the `ROUTE_DID_POLICY` table in `policy.ts`. All 4 new routes must be added.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grace timer cancellation on reconnect | Custom doubly-linked timer list | Node.js `setTimeout` + `Map<civicDid, NodeJS.Timeout>` | Node.js timer resolution is ms-level; O(1) cancel via `clearTimeout(handle)` |
| Deduplication of messages on reconnect | Custom hash tracking | `status ENUM('pending','delivered')` in `civic_message_queue` + `PATCH /ack` | State-machine in DB is simpler and survives Brain restarts |
| last_seen_tick across Brain restarts | Redis or external KV | sqlite3 `kv_store` table in existing `wire_queue.db` | Brain already uses SQLite (WireQueue); same file, zero new deps |
| Polling interval management in React | SWR, react-query, TanStack | Plain `setInterval` + `AbortController` in `useCivicMap` | v2.1 invariant: NO SWR, NO react-query — verified in `use-civic-map.ts` comment |
| Atomic "mark all acked" | Per-message UPDATE loop | `UPDATE civic_message_queue SET status='delivered' WHERE id IN (...)` batch | Single query; Brain sends an array of IDs in PATCH body |

**Key insight:** Phase 41 is plumbing. The hardest part is lifecycle correctness (grace timers, `setInterval` teardown, CI gates), not algorithm complexity.

---

## Common Pitfalls

### Pitfall 1: OBS-R-32-02 setInterval-lifecycle CI gate failure

**What goes wrong:** Adding `setInterval` in `GenesisLauncher` without a corresponding `clearInterval` call in a shutdown path causes `check-interval-lifecycle.mjs` to fail in CI.

**Why it happens:** The CI gate scans `grid/src/` for `setInterval` and verifies each has a reachable `clearInterval`. This was added in Phase 32.

**How to avoid:** Store the return value as a private field on `GenesisLauncher`; call `clearInterval(this._escalationInterval)` in `GenesisLauncher.stop()`.

**Warning signs:** CI failing on `OBS-R-32-02 setInterval-lifecycle gate` after adding the escalation check.

### Pitfall 2: ROUTE_DID_POLICY coverage gate failure

**What goes wrong:** Adding routes to `grid/src/api/server.ts` without adding entries to `ROUTE_DID_POLICY` in `grid/src/api/policy.ts` causes `check-did-policy-coverage.mjs` to fail.

**Why it happens:** Gate runs on every CI push. Phase 36 established default-deny: any unlisted route is treated as `civic_did_required`, but the CI gate still flags the missing entry as an explicit registration gap.

**How to avoid:** Add all 4+ new routes to `ROUTE_DID_POLICY` in the same commit that registers them in `server.ts`. New routes: `POST /api/v1/civic/presence`, `GET /api/v1/civic/presence`, `GET /api/v1/civic/inbox`, `PATCH /api/v1/civic/inbox/ack`, `POST /api/v1/civic/message`, `GET /api/v1/civic/presence/me`.

**Warning signs:** `check-did-policy-coverage.mjs` in CI fails with "route not in ROUTE_DID_POLICY".

### Pitfall 3: Grace timer leaks on Grid shutdown

**What goes wrong:** `WsFirehoseHub.close()` closes all sockets and removes clients, but if `GraceTimerRegistry` is not also cleared during shutdown, pending `setTimeout` callbacks can fire post-shutdown against a stale `CivicDidStore`.

**Why it happens:** Node.js keeps the event loop alive for pending timers. After the server closes, a grace timer firing into a torn-down MySQL pool throws.

**How to avoid:** Call `graceTimerRegistry.clear()` in `WsFirehoseHub.close()` (before or after sending bye frames). The `GraceTimerRegistry.clear()` method calls `clearTimeout` on all outstanding timers.

**Warning signs:** MySQL "Connection lost" errors after a clean Grid shutdown in tests.

### Pitfall 4: Double-counting messages on Brain reconnect

**What goes wrong:** Brain calls `GET /api/v1/civic/inbox?since=<tick>` with a stale `last_seen_tick` after a restart, and receives messages it already processed in a previous session.

**Why it happens:** Brain's `last_seen_tick` in SQLite was not updated after the previous inbox fetch, or the SQLite was wiped.

**How to avoid:** After successfully processing the inbox batch, Brain must immediately call `PATCH /api/v1/civic/inbox/ack` to mark messages `delivered`, AND update `last_seen_tick` in local SQLite. The Grid endpoint returns only `status='pending'` messages — already `delivered` messages are excluded.

**Warning signs:** Same message appears twice in Brain's memory after reconnect.

### Pitfall 5: irs.disbursement_executed not in allowlist

**What goes wrong:** Phase 41 emits `irs.disbursement_executed` for `presumed_departed` Bios disbursement, but this event is not in the current broadcast allowlist (64 entries, Phases 1-37). The event fires internally but is silently dropped by the broadcast gate.

**Why it happens:** The allowlist is frozen-except-by-explicit-addition. New event types must be added to `ALLOWLIST_MEMBERS` in `broadcast-allowlist.ts`.

**How to avoid:** Add `'irs.disbursement_executed'` at position 65 to `ALLOWLIST_MEMBERS` with a payload shape comment. Update the allowlist length assertion comment from 64 → 65 (or however many Phase 41 adds). Note: Phase 41 allowlist delta is 0 per the ROADMAP table — this event may be stub-emitted without adding to the allowlist if it is fire-and-forget internal (no broadcast needed). Confirm with planner: if `irs.disbursement_executed` does NOT need to appear on the firehose (it is an internal accounting event), it can be emitted to the audit chain without being broadcast. CONTEXT.md says Phase 41 emits it "tagged `cause: presumed_departed`" — this is an audit chain entry, not necessarily broadcast.

**Warning signs:** SC5 test harness looking for `irs.disbursement_executed` in audit chain finds it; broadcast check fails if it was expected on WS.

### Pitfall 6: Civic Map use-civic-map polling interval conflict

**What goes wrong:** Phase 41 changes the Civic Map poll from 5s (Phase 36 D-36-13) to 30s (D-41-06). If the change is made to `useCivicMap` the existing `CivicMap.test.tsx` may break if it assumes 5s timing.

**Why it happens:** The interval is currently hard-coded in `use-civic-map.ts` (not parameterizable).

**How to avoid:** Make the interval configurable (default 30_000ms). Tests pass `interval` prop or use fake timers. Update the `CivicMap.test.tsx` expectations if they test polling behavior.

### Pitfall 7: `absent` community revocation — Phase 49 stub boundary

**What goes wrong:** SC4 requires communities with `revoke_absent: true` to "automatically revoke" membership. Community charters are Phase 49. Phase 41 must emit a stub event/notification but cannot execute actual charter processing.

**Why it happens:** Phase 49 (Communities v3) has not shipped yet; the charter engine does not exist.

**How to avoid:** Phase 41 emits an internal queue entry or audit event `nous.absent_revocation_queued` (internal, not broadcast) for each community that has `revoke_absent: true` in its charter config. The actual revocation processing is a no-op stub. Phase 49 wires up the real processing. The planner should note this dependency explicitly in the plan.

---

## Code Examples

Verified patterns from official sources:

### Migration v30 — presence columns on civic_did_registry

```typescript
// Source: [ASSUMED] — follows schema.ts migration pattern (versions 23-29)
// grid/src/db/schema.ts

{
    version: 30,
    name: 'add_presence_to_civic_did_registry',
    up: `
        ALTER TABLE civic_did_registry
          ADD COLUMN presence_status     ENUM('awake','away','absent','presumed_departed')
                                         NOT NULL DEFAULT 'awake',
          ADD COLUMN last_seen_at        TIMESTAMP(3) NULL,
          ADD COLUMN last_seen_tick      INT UNSIGNED NULL,
          ADD COLUMN away_grace_expires_at TIMESTAMP(3) NULL,
          ADD INDEX idx_presence_status (grid_name, presence_status)
    `,
    down: `
        ALTER TABLE civic_did_registry
          DROP INDEX idx_presence_status,
          DROP COLUMN away_grace_expires_at,
          DROP COLUMN last_seen_tick,
          DROP COLUMN last_seen_at,
          DROP COLUMN presence_status
    `,
},
```

### Migration v31 — civic_message_queue table

```typescript
// Source: CONTEXT.md D-41-03 (verbatim SQL spec)
// grid/src/db/schema.ts

{
    version: 31,
    name: 'create_civic_message_queue',
    up: `
        CREATE TABLE IF NOT EXISTS civic_message_queue (
            id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            grid_name           VARCHAR(63) NOT NULL,
            recipient_civic_did VARCHAR(255) NOT NULL,
            sender_civic_did    VARCHAR(255) NOT NULL,
            message_json        JSON NOT NULL,
            sent_at_tick        INT UNSIGNED NOT NULL,
            sent_at             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            status              ENUM('pending','delivered') NOT NULL DEFAULT 'pending',
            INDEX idx_recipient_status (grid_name, recipient_civic_did, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS civic_message_queue`,
},
```

### WsFirehoseHub.onConnect — grace timer wiring hook

```typescript
// Source: [ASSUMED] — extends firehose-hub.ts existing socket.on('close', ...) pattern
// grid/src/audit/firehose-hub.ts — onConnect method, socket close handler extension

socket.on('close', () => {
    // Existing cleanup:
    if (client.didContext === null || client.didContext.tier !== 'civic_member') {
        this._visitorCount = Math.max(0, this._visitorCount - 1);
    }
    client.markClosed();
    this._clients.delete(client);

    // Phase 41 addition: start grace timer if this is a Civic-DID holder
    if (client.didContext?.civicDid) {
        this._graceTimerRegistry?.startGraceTimer(
            client.didContext.civicDid,
            () => void this._onGraceTimerExpired(client.didContext!.civicDid!),
            GRACE_TIMER_MS,
        );
    }
});
```

### WssSubscriber reconnect with ?since= cursor

```python
# Source: [ASSUMED] — extends subscriber.py _connect_once to pass ?since= on reconnect
# brain/src/noesis_brain/wire/subscriber.py

async def _connect_once(self) -> None:
    token = self._token_manager.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    since_tick = self._queue.get_last_seen_tick() if self._queue else None
    url = self._url
    if since_tick is not None:
        url = f"{url}?since={since_tick}"
    async with websockets.connect(url, additional_headers=headers) as ws:
        # ... existing frame loop ...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brain + Grid colocated (Docker network) | Brain on operator machine, Grid remote (Henry-hosted) | v3.0 D-V3-16 | Requires WSS + HTTP wire protocol (Phase 38); offline resilience is now required |
| Grid tracks Nous as always-online | Grid tracks 4-state presence (awake/away/absent/presumed_departed) | Phase 41 | Operators can shut down Brain without losing civic identity |
| Civic Map polls every 5s (Phase 36 D-36-13) | Civic Map polls presence every 30s (Phase 41 D-41-06) | Phase 41 | Reduced Grid load; presence data changes rarely enough to warrant 30s |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GraceTimerRegistry` should be a separate class injected into `WsFirehoseHub` (rather than inlined) | Architecture Patterns | Low — implementation detail; inlining works too but is less testable |
| A2 | `irs.disbursement_executed` does NOT need to be broadcast (audit chain only); Phase 41 adds it to audit chain without allowlist entry | Common Pitfalls §5 | Medium — if SC5 verification tests the firehose, broadcast is required. Planner should confirm with CONTEXT.md intent: "audit entry tagged `cause: presumed_departed`" suggests audit chain, not firehose. |
| A3 | `brain_required` policy is not yet a named value in `ROUTE_DID_POLICY_VALUES`; the heartbeat uses the same Brain JWT that maps to `civic_did_required` (Brain JWT → civic_member tier per Phase 38) | Standard Stack | Low — if a new `brain_required` policy value is needed, it requires updating `ROUTE_DID_POLICY_VALUES` and all 3 CI gate scripts. Safer to reuse `civic_did_required` since Phase 38 already establishes Brain-JWT-as-civic_did_required. |
| A4 | `absent` community revocation is stubbed (emit event, no processing) since Phase 49 has not shipped | Common Pitfalls §7 | High if SC4 test expects real membership revocation — but CONTEXT.md §Deferred confirms Phase 49 stub. |
| A5 | `useCivicMap` poll interval change from 5s → 30s should be parameterized in the hook, not hard-coded | Architecture Patterns | Low — engineering quality only; behavioral impact is minimal |

---

## Open Questions

1. **`irs.disbursement_executed` allowlist status**
   - What we know: Phase 41 ROADMAP shows 0 allowlist delta. `irs.disbursement_executed` is defined in Phase 45 IRS as a broadcast-eligible event (+3 delta in Phase 45).
   - What's unclear: SC5 requires the event "tagged `cause: presumed_departed`". Is this a firehose-visible event (broadcast) or audit-chain-only (no allowlist addition in Phase 41)?
   - Recommendation: Planner should emit the event to the audit chain in Phase 41 WITHOUT adding to the allowlist. Phase 45 adds it to the allowlist when the full IRS module ships. This preserves the 0 allowlist delta for Phase 41.

2. **`absent` notification queue target**
   - What we know: D-41-07 says "notification queued for operator on return". Operator notifications are deferred (not in email/push scope).
   - What's unclear: What exactly is "queued"? Into `civic_message_queue` (recipient = own Civic-DID)? Or a new `operator_notification_queue` table?
   - Recommendation: Queue a self-message into `civic_message_queue` from `system` (sender) to the Nous's own Civic-DID. Brain will see it on reconnect via inbox fetch. This reuses existing infrastructure without new tables.

3. **Grace timer for simultaneous multi-Brain Nous**
   - What we know: Phase 41 tracks presence per Civic-DID. Phase 39 allows up to 3 Brains per operator.
   - What's unclear: If a Nous has 2 active Brains (both with the same Civic-DID?), does disconnecting one Brain start the grace timer?
   - Recommendation: This edge case is not in scope for v3.0 (TENANT-03 caps Brains per operator, but one Nous = one Civic-DID). Grace timer fires when the LAST WSS connection for a given Civic-DID closes. The `GraceTimerRegistry` should count concurrent WSS sessions per Civic-DID (use refcount instead of boolean).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL2 (mysql2) | Grid presence queries | ✓ | ~3.9 (from migration v29 used in Phase 40) | — |
| Node.js (grid runtime) | Grace timers, setInterval | ✓ | v20+ (confirmed from prior phases) | — |
| SQLite3 (Python) | Brain last_seen_tick KV | ✓ | Already in WireQueue | — |
| Python asyncio / httpx | Brain heartbeat loop | ✓ | Already in GridWireClient | — |
| Vitest | Grid tests | ✓ | `npm test` = `vitest run` | — |
| pytest + pytest-asyncio | Brain tests | ✓ | brain/pyproject.toml | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Grid) | Vitest (run via `npm test` in `grid/`) |
| Framework (Brain) | pytest + pytest-asyncio (run via `pytest` in `brain/`) |
| Config file (Grid) | `grid/` — `vitest run` (no separate config file found; uses package.json script) |
| Quick run command (Grid) | `cd grid && npm test` |
| Quick run command (Brain) | `cd brain && python -m pytest test/ -x -q` |
| Full suite command | `cd grid && npm test && cd ../brain && python -m pytest test/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLEEP-01 | WSS disconnect → grace timer starts → status flips `away` after 5min | unit | `cd grid && npm test -- --reporter=verbose test/civic-presence/` | ❌ Wave 0 |
| SLEEP-01 | Heartbeat within grace window → timer cancelled → status stays `awake` | unit | same | ❌ Wave 0 |
| SLEEP-01 | Civic Map GET /civic/presence returns `away` status | unit | `cd grid && npm test -- test/api/civic-presence.test.ts` | ❌ Wave 0 |
| SLEEP-02 | POST /civic/message to `away` Nous → enqueues in civic_message_queue | unit | `cd grid && npm test -- test/api/civic-inbox.test.ts` | ❌ Wave 0 |
| SLEEP-03 | GET /civic/inbox?since=N returns pending messages + queue_depth | unit | same | ❌ Wave 0 |
| SLEEP-03 | PATCH /civic/inbox/ack marks messages delivered | unit | same | ❌ Wave 0 |
| SLEEP-03 | WssSubscriber reconnects with ?since=<tick> in URL | unit (Brain) | `cd brain && python -m pytest test/test_wire_subscriber_since.py -x` | ❌ Wave 0 |
| SLEEP-03 | GridWireClient.post_presence_heartbeat updates last_seen_tick in SQLite | unit (Brain) | `cd brain && python -m pytest test/test_wire_client_heartbeat.py -x` | ❌ Wave 0 |
| SLEEP-04 | Clock fast-forward 31d → escalation check → status = `absent` | unit | `cd grid && npm test -- test/civic-presence/escalation.test.ts` | ❌ Wave 0 |
| SLEEP-05 | Clock fast-forward 1y → status = `presumed_departed` → Civic-DID frozen (409) | unit | same | ❌ Wave 0 |
| SLEEP-05 | Business-DID dissolved on `presumed_departed` | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd grid && npm test 2>&1 | tail -5` (Vitest fast suite, ~10s)
- **Per wave merge:** Full grid + brain test suites
- **Phase gate:** Full suite green + all CI gates pass before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/civic-presence/` directory — new test subdirectory for presence unit tests
- [ ] `grid/test/civic-presence/grace-timer.test.ts` — covers SLEEP-01 grace timer logic
- [ ] `grid/test/civic-presence/escalation.test.ts` — covers SLEEP-04/05 threshold checks
- [ ] `grid/test/api/civic-presence.test.ts` — covers POST/GET /civic/presence routes
- [ ] `grid/test/api/civic-inbox.test.ts` — covers GET /inbox, PATCH /inbox/ack, POST /civic/message
- [ ] `brain/test/test_wire_client_heartbeat.py` — covers post_presence_heartbeat()
- [ ] `brain/test/test_wire_subscriber_since.py` — covers ?since= on WSS reconnect
- [ ] `brain/test/test_wire_queue_kv.py` — covers last_seen_tick get/set

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Phase 38 EdDSA Brain bearer JWT — same `brain_tokens` auth for heartbeat |
| V3 Session Management | no | Presence is stateless REST + timer; no sessions |
| V4 Access Control | yes | `ROUTE_DID_POLICY` gate — heartbeat = Brain-JWT; public GET = visitor_public |
| V5 Input Validation | yes | `message_json` in civic_message_queue must be size-limited; sender/recipient Civic-DID must pass DID_RE regex |
| V6 Cryptography | no | No new cryptographic operations; reuses Phase 38 EdDSA JWT |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fake heartbeat to keep Nous "awake" | Spoofing | Brain bearer JWT required; `brain_tokens` table validates public key |
| Message flooding to away Nous queue | DoS | Max queue depth per recipient Civic-DID (e.g., 1000 rows); enforce in POST /civic/message handler |
| Premature `presumed_departed` escalation | Tampering | Escalation check reads `last_seen_at` from DB; only Grid updates this field (Brain cannot write it directly) |
| 409-frozen Civic-DID bypass | Elevation of Privilege | `updatePresence('presumed_departed')` sets a `frozen` flag checked by `requireCivicDid` preHandler on every write route |
| `since=` cursor manipulation | Information Disclosure | `since` param is Brain-JWT-authenticated; only the Brain's own Civic-DID's events are in scope |

---

## Project Constraints (from CLAUDE.md)

- **Simplicity first:** No speculative features. Phase 41 is presence tracking only — no notification delivery channels, no reversal of `presumed_departed`.
- **Surgical changes:** Phase 41 extends `firehose-hub.ts`, `civic-did-store.ts`, `launcher.ts`, `client.py`, `subscriber.py`, `queue.py`. It must NOT refactor unrelated code.
- **Surgical imports:** Any import Phase 41 adds that becomes unused by Phase 41's changes must be removed.
- **Documentation Sync Rule (2026-04-20):** When phase ships, update ROADMAP.md (mark Phase 41 complete), MILESTONES.md, PROJECT.md (REQs SLEEP-01..05 to Validated), STATE.md (reset focus to Phase 42).
- **Broadcast allowlist frozen except by explicit addition:** Phase 41 allowlist delta = 0 per ROADMAP. If `irs.disbursement_executed` is needed on the firehose, that is Phase 45's +3 delta. Phase 41 must not silently add events.
- **OBS-R-32-02 setInterval-lifecycle CI gate:** Any new `setInterval` in `grid/src/` requires a paired `clearInterval`.
- **OBS-36-01 ROUTE_DID_POLICY coverage gate:** All new routes must be in `ROUTE_DID_POLICY`.
- **v3.0 phase numbering:** Phase 41 is within range 36-57. Phase 42 (P2P) follows.
- **D-V3-06 raw-SVG invariant:** Applies to Steward Console only. Portal Dashboard (`dashboard/`) is free to use CSS. CivicMap.tsx is in `dashboard/` — CSS presence styling is allowed.
- **No new MCP/Docker dependencies:** All new functionality uses existing Node.js + MySQL2 + Python asyncio stack.

---

## Sources

### Primary (HIGH confidence)

- `grid/src/audit/firehose-hub.ts` — `WsFirehoseHub` source; socket close handler and DIDContext wiring verified directly
- `grid/src/civic-registry/civic-did-store.ts` — `CivicDidStore` CRUD; migration v23 `civic_did_registry` schema confirmed
- `grid/src/db/schema.ts` — All migrations v1-v29 read; v30+v31 are Phase 41 additions (not yet written)
- `grid/src/genesis/launcher.ts` — `GenesisLauncher` constructor and `onTick` subscription pattern; `setInterval` placement guidance confirmed
- `brain/src/noesis_brain/wire/client.py` — `GridWireClient` pattern for adding `post_presence_heartbeat()`
- `brain/src/noesis_brain/wire/subscriber.py` — `WssSubscriber` `_connect_once` pattern for `?since=` cursor
- `brain/src/noesis_brain/wire/queue.py` — `WireQueue` SQLite schema; adding `kv_store` table confirmed safe
- `grid/src/audit/broadcast-allowlist.ts` — Current allowlist at 64 entries (Phase 37); Phase 41 delta = 0
- `grid/src/api/policy.ts` — `ROUTE_DID_POLICY` (105 entries as of Phase 36 close-out); all CI gate IDs confirmed
- `dashboard/src/app/portal/civic-map/CivicMap.tsx` — Current raw-SVG avatar render; `opacity` + inline `style` pattern confirmed
- `dashboard/src/lib/use-civic-map.ts` — Current 5s poll pattern with AbortController; no SWR/react-query constraint confirmed
- `steward/src/app/system/operators/page.tsx` — Phase 39 `/system/operators` pattern for queue depth section
- `.planning/phases/41-sleep-cycle-away-presence/41-CONTEXT.md` — All decisions D-41-01 through D-41-07 read directly

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` §v3.0 Key Decisions — D-V3-20 sleep cycle decision locked; D-V3-18 constitutional operator constraints confirmed
- `.planning/REQUIREMENTS.md` §SLEEP — SLEEP-01..05 descriptions cross-checked with CONTEXT.md
- `.github/workflows/rig-invariants.yml` — CI gate names and scripts confirmed (OBS-R-32-02, OBS-36-01, OBS-36-04 etc.)

### Tertiary (LOW confidence — assumptions)

- All code examples in "Code Examples" section are `[ASSUMED]` — patterns synthesized from existing code; require human review before execution
- `A3`: `brain_required` policy value — may need to be added to `ROUTE_DID_POLICY_VALUES` or reuse `civic_did_required`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase; no new deps
- Architecture: HIGH — all integration points verified from source files; locked decisions from CONTEXT.md
- Pitfalls: HIGH — CI gates verified in `rig-invariants.yml`; Phase 16 separation verified in `sleep/types.ts`
- Code examples: MEDIUM — patterns extrapolated from verified source; exact signatures may need adjustment

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable stack; Phase 41 can proceed to planning immediately)
