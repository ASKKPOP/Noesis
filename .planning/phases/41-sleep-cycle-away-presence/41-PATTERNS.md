# Phase 41: Sleep Cycle + Away Presence — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/db/schema.ts` (v30+v31) | migration | CRUD | same file v27–v29 | exact |
| `grid/src/civic-registry/civic-did-store.ts` | store | CRUD | same file + `business-did-store.ts` | exact |
| `grid/src/civic-presence/grace-timer-registry.ts` | utility | event-driven | `grid/src/audit/firehose-hub.ts` (Map<> + close logic) | role-match |
| `grid/src/civic-presence/presence-service.ts` | service | CRUD+event-driven | `grid/src/civic-registry/civic-did-store.ts` | role-match |
| `grid/src/civic-presence/message-queue-store.ts` | store | CRUD | `grid/src/civic-registry/civic-did-store.ts` | exact |
| `grid/src/civic-presence/types.ts` | model | — | `grid/src/civic-registry/types.ts` (sibling) | exact |
| `grid/src/api/routes/civic-presence.ts` | route | request-response | `grid/src/api/routes/registry.ts` | exact |
| `grid/src/api/routes/civic-inbox.ts` | route | request-response | `grid/src/api/routes/brain-wire.ts` | role-match |
| `grid/src/audit/firehose-hub.ts` (extend) | hub | event-driven | same file (existing onConnect/close) | exact |
| `grid/src/genesis/launcher.ts` (extend) | bootstrap | event-driven | same file (attachRelationshipStorage / onTick) | exact |
| `grid/src/api/server.ts` (extend) | config | request-response | same file (civicDidStore, brainTokenStore entries) | exact |
| `grid/src/api/policy.ts` (extend) | config | — | same file (existing ROUTE_DID_POLICY entries) | exact |
| `brain/src/noesis_brain/wire/client.py` (extend) | service | request-response | same file (`post_actions` method) | exact |
| `brain/src/noesis_brain/wire/subscriber.py` (extend) | service | streaming | same file (`_connect_once`) | exact |
| `brain/src/noesis_brain/wire/queue.py` (extend) | store | CRUD | same file (`enqueue`/`mark_acked`) | exact |
| `dashboard/src/app/portal/civic-map/CivicMap.tsx` (extend) | component | request-response | same file (avatar circle render) | exact |
| `dashboard/src/lib/use-civic-map.ts` (extend) | hook | request-response | same file (5s polling) | exact |
| `steward/src/app/system/operators/page.tsx` (extend) | component | request-response | same file (Section 1/2/3 pattern) | exact |

---

## Pattern Assignments

### `grid/src/db/schema.ts` — add migrations v30 and v31

**Analog:** same file, migrations v27–v29 (ALTER TABLE and CREATE TABLE patterns)

**Migration v27 — ALTER TABLE pattern** (lines 474–486):
```typescript
{
    version: 27,
    name: 'add_operator_did_to_brain_tokens',
    up: `
        ALTER TABLE brain_tokens
          ADD COLUMN operator_did VARCHAR(255) NULL DEFAULT NULL,
          ADD INDEX idx_operator_did (grid_name, operator_did)
    `,
    down: `
        ALTER TABLE brain_tokens
          DROP INDEX idx_operator_did,
          DROP COLUMN operator_did
    `,
},
```

**Migration v29 — CREATE TABLE pattern** (lines 512–524):
```typescript
{
    version: 29,
    name: 'create_operator_settings',
    up: `
        CREATE TABLE IF NOT EXISTS operator_settings (
            grid_name    VARCHAR(63)  NOT NULL,
            operator_did VARCHAR(255) NOT NULL,
            settings     JSON         NOT NULL,
            updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                             ON UPDATE CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, operator_did)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS operator_settings`,
},
```

**Migration v23 — civic_did_registry schema** (lines 380–399): The table Phase 41 extends. Status column uses ENUM; presence_status will follow same ENUM pattern:
```typescript
status ENUM('active','revoked') NOT NULL DEFAULT 'active',
```

**What v30 adds (ALTER TABLE):** Copy v27 pattern. Four new columns on `civic_did_registry`: `presence_status ENUM('awake','away','absent','presumed_departed') NOT NULL DEFAULT 'awake'`, `last_seen_at TIMESTAMP(3) NULL`, `last_seen_tick INT UNSIGNED NULL`, `away_grace_expires_at TIMESTAMP(3) NULL`, plus `INDEX idx_presence_status (grid_name, presence_status)`.

**What v31 adds (CREATE TABLE):** Copy v29 pattern but with the exact schema from CONTEXT.md D-41-03: `civic_message_queue` with `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`.

---

### `grid/src/civic-registry/civic-did-store.ts` — add presence methods

**Analog:** same file (full file read above)

**Imports pattern** (lines 1–11):
```typescript
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { CivicDidRecord, CivicDidStatus } from './types.js';
```

**Row interface pattern** (lines 13–22): Phase 41 adds a `CivicDidPresenceRow extends RowDataPacket` with the four new columns. Follow the `CivicDidRow` shape.

**Core CRUD pattern** — `markRevoked` (lines 74–87): exact pattern for `updatePresence()`:
```typescript
async markRevoked(
    gridName: string,
    civicDid: string,
    revokedAtTick: number,
    courtConvictionRef: string,
): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
        `UPDATE civic_did_registry
         SET status='revoked', revoked_at_tick = ?, court_conviction_ref = ?
         WHERE grid_name = ? AND civic_did = ? AND status = 'active'`,
        [revokedAtTick, courtConvictionRef, gridName, civicDid],
    );
    return result.affectedRows === 1;
}
```
`updatePresence(gridName, civicDid, status, tick)` replaces `SET status='revoked'` with `SET presence_status=?, last_seen_at=NOW(3), last_seen_tick=?` and removes the `AND status = 'active'` guard.

**SELECT pattern** — `get` (lines 58–64): exact pattern for `getPresenceStatus()` and `getAllAwayNous()`:
```typescript
async get(gridName: string, civicDid: string): Promise<CivicDidRecord | null> {
    const [rows] = await this.pool.query<CivicDidRow[]>(
        `SELECT * FROM civic_did_registry WHERE grid_name = ? AND civic_did = ?`,
        [gridName, civicDid],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
}
```
`getAllAwayNous(gridName)` uses `WHERE grid_name = ? AND presence_status IN ('away','absent')` and returns an array.

**rowToRecord helper** (lines 24–38): add `presenceStatus`, `lastSeenAt`, `lastSeenTick` fields to the existing mapper. Null-coalesce same as `revokedAtTick ?? undefined`.

---

### `grid/src/civic-presence/grace-timer-registry.ts` (NEW)

**Analog:** `grid/src/audit/firehose-hub.ts` — the `_clients: Set<ClientConnection>` + `close()` lifecycle (lines 182–337)

**Map lifecycle pattern from firehose-hub.ts** (lines 182–183, 312–337):
```typescript
private readonly _clients: Set<ClientConnection> = new Set();
// ...
async close(): Promise<void> {
    // ... clear all clients
    this._clients.clear();
}
```

**What to copy:** The per-object Map + clear-on-shutdown idiom. The `GraceTimerRegistry` uses `Map<string, NodeJS.Timeout>` instead of `Set<ClientConnection>`, but the clear-in-shutdown contract is identical. The `close()` / `clear()` pattern mirrors `WsFirehoseHub.close()`.

**Core pattern to implement** (from RESEARCH.md Architecture Patterns §Pattern 1):
```typescript
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

---

### `grid/src/audit/firehose-hub.ts` — extend `onConnect` socket close handler

**Analog:** same file (full read above)

**Exact socket close hook to extend** (lines 270–277):
```typescript
socket.on('close', () => {
    // Existing cleanup:
    if (client.didContext === null || client.didContext.tier !== 'civic_member') {
        this._visitorCount = Math.max(0, this._visitorCount - 1);
    }
    client.markClosed();
    this._clients.delete(client);
    // Phase 41 addition goes here — after existing cleanup
});
```

**Phase 41 adds after `this._clients.delete(client)`:**
```typescript
if (client.didContext?.civicDid) {
    this._graceTimerRegistry?.startGraceTimer(
        client.didContext.civicDid,
        () => void this._onGraceTimerExpired(client.didContext!.civicDid!),
        GRACE_TIMER_MS,
    );
}
```

**Constructor field additions** — follow `_healthWatchdog` pattern (lines 132–138):
```typescript
// One-shot-settable pattern used for _healthWatchdog:
private _healthWatchdog: HealthWatchdog | undefined;
// Phase 41 adds:
private _graceTimerRegistry: GraceTimerRegistry | undefined;
```

**close() cleanup** — follow `unsubscribeAudit()` try/catch pattern (lines 312–320):
```typescript
async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    try {
        this.unsubscribeAudit();
    } catch { /* swallow */ }
    // Phase 41: clear grace timers before closing sockets
    this._graceTimerRegistry?.clear();
    // ... existing two-phase close
}
```

---

### `grid/src/genesis/launcher.ts` — add setInterval for 24h escalation

**Analog:** same file (full read above)

**Existing attach pattern** (lines 250–262) — the `attachRelationshipStorage` method shows the injectable-post-construction pattern:
```typescript
attachRelationshipStorage(pool: Pool): void {
    if (this.relationshipStorage !== null) {
        if (this.relationshipStorage.pool === pool) { return; }
        throw new Error('GenesisLauncher.attachRelationshipStorage called twice with different pools');
    }
    this.relationshipStorage = new RelationshipStorage(pool);
}
```

**Phase 41 follow this pattern** for `attachPresenceStore(store: PresenceService)`. Use the same throw-on-second-call guard.

**Existing onTick usage** (lines 421–459): The `setInterval` for escalation MUST NOT use `onTick`. Use the constructor or an `attachPresenceStore` call site. Store return value as a private field:
```typescript
private _escalationInterval: NodeJS.Timeout | undefined;
```

**stop() pattern** (lines 503–512):
```typescript
stop(): void {
    this.audit.append('grid.stopped', 'system', { tick: this.clock.currentTick });
    this.clock.stop();
}
```
Phase 41 adds `clearInterval(this._escalationInterval)` here before `this.clock.stop()`.

**Fire-and-forget void dispatch** (line 438): The existing `void this.governance.onTickClosed(event.tick)` shows the fire-and-forget pattern. The escalation callback should use the same `void this._presenceService?.runEscalationCheck(...)`.

---

### `grid/src/api/routes/civic-presence.ts` (NEW)

**Analog:** `grid/src/api/routes/registry.ts` (lines 35–80) and `grid/src/api/routes/operator-me/settings.ts`

**Route registration function signature** (from registry.ts line 35):
```typescript
export async function registerRegistryRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
```

**503 guard pattern** (registry.ts line 45):
```typescript
const store = services.civicDidStore;
if (!store) return reply.code(503).send({ error: 'civic_registry_unavailable' });
```
Phase 41 presence routes use `services.civicPresenceService` (or similar field) with analogous 503 guard.

**Brain-authenticated pattern** (operator-me/nous.ts lines 13–20):
```typescript
export async function registerOperatorMeNousRoute(app, services) {
    app.get('/api/v1/operator/me/nous', async (req, reply) => {
        const operatorDid = await operatorScope(req, reply);
        if (!operatorDid) return; // 403 already sent
        const { pool, gridName } = services;
        if (!pool) return reply.code(503).send({ error: 'db_unavailable' });
```

**POST heartbeat response shape:** `{ status: 'awake', grace_timer_active: false, last_seen_tick: <number> }` (from CONTEXT.md §Specific Ideas). The DIDContext carries the civicDid — accessed via `req.didContext?.civicDid` (same pattern as all civic routes).

**Public GET response shape** (D-41-06): `{ nous: [{ civic_did, presence_status, last_seen_at }] }` — analogous to civic-map.ts `NousMapEntry[]` array response.

---

### `grid/src/api/routes/civic-inbox.ts` (NEW)

**Analog:** `grid/src/api/routes/brain-wire.ts` (Brain-JWT authenticated, batch operations)

**Brain-JWT auth pattern** (brain-firehose.ts lines 31–47):
```typescript
instance.get('/api/v1/brain/firehose', { websocket: true }, async (socket, req) => {
    const didContext = await tryDid(req, {
        didStore: services?.didStore,
        brainTokenStore: services?.brainTokenStore,
    });
    if (!didContext || didContext.tier !== 'civic_member') {
        try { socket.close(4401, 'civic_did_required'); } catch { /* swallow */ }
        return;
    }
```
For REST routes (non-WS), the policy table (`ROUTE_DID_POLICY`) enforces the tier; the handler can access `req.didContext?.civicDid` directly.

**Batch UPDATE pattern** (from brain-wire.ts general shape): The PATCH /inbox/ack endpoint receives `{ message_ids: number[] }` and runs a batch `UPDATE ... WHERE id IN (?)`.

**GET with ?since= query param pattern** — no existing exact analog for query params, but the brain-wire route bodies show how to extract from body. For query params: `const since = req.query as { since?: string }` following TypeScript Fastify query type generics.

---

### `grid/src/api/server.ts` — extend GridServices + register new routes

**Analog:** same file (lines 284–348 show the established optional-field pattern)

**Optional service field pattern** (lines 290–292):
```typescript
/**
 * Phase 37 REG-01..04: Civic-DID persistence store.
 * When present, registry routes use this for insert/get/revoke operations.
 * When absent, registry routes return 503 civic_registry_unavailable.
 */
civicDidStore?: import('../civic-registry/civic-did-store.js').CivicDidStore;
```
Phase 41 adds analogous `civicPresenceService?` and `messageQueueStore?` fields with the same doc-comment pattern.

**Route registration pattern** (from the import block lines 29–65): add two new `import { registerCivicPresenceRoutes } from './routes/civic-presence.js'` style imports, then call inside `buildServer`.

---

### `grid/src/api/policy.ts` — add new routes to ROUTE_DID_POLICY

**Analog:** same file (full read above)

**Brain-JWT routes** — Phase 38 established `civic_did_required` for Brain JWT routes. New heartbeat route follows this:
```typescript
'POST /api/v1/civic/presence': 'civic_did_required',
'GET /api/v1/civic/presence/me': 'civic_did_required',
'GET /api/v1/civic/inbox': 'civic_did_required',
'PATCH /api/v1/civic/inbox/ack': 'civic_did_required',
```

**Public route** — follows `'GET /api/v1/civic-map/state': 'public'` pattern:
```typescript
'GET /api/v1/civic/presence': 'public',
```

**Civic write route** — direct-message send:
```typescript
'POST /api/v1/civic/message': 'civic_did_required',
```

---

### `brain/src/noesis_brain/wire/client.py` — add `post_presence_heartbeat()`

**Analog:** same file, `_do_post_actions` / `post_actions` methods (lines 112–170)

**Bearer token + httpx pattern** (lines 155–170):
```python
async def _do_post_actions(self, actions, tick):
    token = self._token_manager.get_valid_token()
    client = await self._get_client()
    return await client.post(
        f"{self._base_url}/api/v1/brain/actions",
        json={"tick": tick, "actions": actions},
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
```

**Error handling pattern** (lines 143–149): errors are logged but NOT raised — same pattern for heartbeat:
```python
except (httpx.RequestError, httpx.TimeoutException) as exc:
    log.warning("[Brain] grid_wire actions transport error, queueing: %s", exc)
```

**heartbeat method** — errors must be logged + swallowed (not fatal); successful response writes `last_seen_tick` to `self._queue.set_last_seen_tick(data["last_seen_tick"])`.

**60s heartbeat task:** The caller in BrainApp creates an `asyncio.create_task(heartbeat_loop())` where the loop calls `await client.post_presence_heartbeat()` then `await asyncio.sleep(60)`. Pattern mirrors Phase 38 subscriber `asyncio.create_task(self._run_forever())` in `WssSubscriber.start()`.

---

### `brain/src/noesis_brain/wire/subscriber.py` — extend `_connect_once` with `?since=` cursor

**Analog:** same file (lines 127–148)

**Exact method to extend** (lines 127–148):
```python
async def _connect_once(self) -> None:
    token = self._token_manager.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    async with websockets.connect(self._url, additional_headers=headers) as ws:
        log.info("[Brain] WSS connected to %s", self._url)
        while not self._stop.is_set():
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
```

**Phase 41 change:** Before `websockets.connect(self._url, ...)`, compute:
```python
since_tick = self._queue.get_last_seen_tick() if self._queue else None
connect_url = f"{self._url}?since={since_tick}" if since_tick is not None else self._url
```
Then use `connect_url` instead of `self._url`. The `_queue` field must be added to `__init__` (optional, same `Optional[WireQueue]` pattern as `GridWireClient._queue`).

---

### `brain/src/noesis_brain/wire/queue.py` — add `kv_store` table

**Analog:** same file (lines 110–133, `__init__` table creation)

**Table creation pattern** (lines 117–129):
```python
self._conn.execute(
    """
    CREATE TABLE IF NOT EXISTS wire_queue (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        ...
    )
    """
)
```

**New table to add after existing table creation:**
```python
self._conn.execute("""
    CREATE TABLE IF NOT EXISTS kv_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
""")
```

**Method pattern** — follows `size()` (lines 136–139) for simple SELECT, `enqueue()` for `with self._conn:` transaction:
```python
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

---

### `dashboard/src/app/portal/civic-map/CivicMap.tsx` — add presence CSS + tooltip

**Analog:** same file (full read above)

**Avatar circle render** (lines 128–137):
```tsx
<circle
    cx={n.x}
    cy={n.y}
    r={hoveredNousId === n.civic_did_hash ? 8 : 6}
    fill={n.type === 'A' ? '#7c9eff' : '#c084fc'}
    opacity={n.status === 'online' ? 1 : 0.4}
    stroke="#0a0a0c"
    strokeWidth="1"
    style={{ pointerEvents: 'none' }}
/>
```

**Phase 41 extension — presence-aware opacity + filter:**
```tsx
const isAway = n.presence_status === 'away';
const isAbsent = n.presence_status === 'absent' || n.presence_status === 'presumed_departed';

<circle
    cx={n.x}
    cy={n.y}
    r={hoveredNousId === n.civic_did_hash ? 8 : 6}
    fill={n.type === 'A' ? '#7c9eff' : '#c084fc'}
    opacity={isAway ? 0.4 : isAbsent ? 0.2 : 1}
    stroke="#0a0a0c"
    strokeWidth="1"
    style={{
        pointerEvents: 'none',
        filter: isAway || isAbsent ? 'grayscale(100%)' : 'none',
    }}
/>
```

**NousMapEntry must gain `presence_status` field** — extend the type in `use-civic-map.ts` (see below).

**Tooltip pattern:** The existing `aria-label` on the hitbox rect (line 125) provides accessible text. For the hover tooltip, use `<title>` inside the `<g>` or a React tooltip — the portal uses Radix UI. Keep it inside the SVG `<g>` for D-V3-06 compatibility.

---

### `dashboard/src/lib/use-civic-map.ts` — change poll interval + add presence fields

**Analog:** same file (full read above)

**Poll interval change** (line 81):
```typescript
const interval = setInterval(fetchCivicMap, 5000); // change to 30_000
```

**`NousMapEntry` type extension** (lines 23–33): add:
```typescript
/** Presence status from Phase 41 presence tracking. Absent = undefined on older API. */
presence_status?: 'awake' | 'away' | 'absent' | 'presumed_departed';
/** ISO timestamp of last Brain heartbeat or reconnect. */
last_seen_at?: string | null;
```

**Fetch target change:** The hook currently polls `GET /api/v1/civic-map/state`. Phase 41 changes this to also fetch (or merge) `GET /api/v1/civic/presence` (visitor_public, returns `{ nous: [{ civic_did, presence_status, last_seen_at }] }`). Two options:
1. Grid extends `/api/v1/civic-map/state` to include `presence_status` inline — simpler, single fetch.
2. Merge two fetches — adds complexity. Option 1 is preferred (planner decides).

**AbortController + cleanup pattern** (lines 51–87): preserve exactly. Only change `5000` to `30_000`.

---

### `steward/src/app/system/operators/page.tsx` — add Section 4 queue depth display

**Analog:** same file (full read above)

**Section pattern** (lines 74–104, Section 1):
```tsx
<section className="mb-8">
    <h2 className="text-lg font-semibold mb-2">Unowned Brains</h2>
    <p className="text-xs text-gray-400 mb-3">...</p>
    {!loading && unowned.length === 0 && (
        <p className="text-gray-400 text-sm">No unowned Brains.</p>
    )}
    {unowned.length > 0 && (
        <table className="w-full text-sm border-collapse">
            ...
        </table>
    )}
</section>
```

**Phase 41 Section 4 — Queue Depth** follows this exact pattern. New interface and state:
```tsx
interface PresenceQueueRow {
    operator_did: string;
    civic_did: string;
    queue_depth: number;  // messages pending delivery
    presence_status: 'away' | 'absent' | 'presumed_departed';
}
```

**Data fetch pattern** (lines 32–56): add a second `fetch('/api/v1/grid-manager/presence-overview', ...)` call inside the existing `load()` function, following the same `res.ok` check and `setError` pattern.

**Error state + loading state:** reuse the same `{loading && ...}` and `{error && ...}` blocks from lines 67–72.

---

## Shared Patterns

### Brain-JWT Authentication (civic_did_required tier)

**Source:** `grid/src/audit/firehose-hub.ts` + `grid/src/api/policy.ts`
**Apply to:** `civic-presence.ts` POST + GET /me, `civic-inbox.ts` GET + PATCH routes

Brain JWT routes resolve to `civic_member` tier via the `tryDid` preHandler (same as `POST /api/v1/brain/actions`). The `req.didContext?.civicDid` is the authenticated Civic-DID. No `operatorScope()` call needed — Brain JWT subjects ARE the Civic-DID directly.

```typescript
// Policy entry (policy.ts)
'POST /api/v1/civic/presence': 'civic_did_required',
// Handler access pattern
const civicDid = req.didContext?.civicDid;
if (!civicDid) return reply.code(401).send({ error: 'unauthorized' });
```

### 503 Guard for Optional Services

**Source:** `grid/src/api/routes/registry.ts` line 45, `grid/src/api/routes/operator-me/settings.ts` line 21
**Apply to:** All new `civic-presence.ts` and `civic-inbox.ts` route handlers

```typescript
const store = services.civicPresenceService;
if (!store) return reply.code(503).send({ error: 'civic_presence_unavailable' });
```

### MySQL Parameterized Queries

**Source:** `grid/src/civic-registry/civic-did-store.ts` (all methods)
**Apply to:** `civic-did-store.ts` new methods, `message-queue-store.ts` all methods

All SQL uses `?` placeholders. Values passed as array. Never use string concatenation. Pattern:
```typescript
const [rows] = await this.pool.query<CivicDidRow[]>(
    `SELECT ... WHERE grid_name = ? AND civic_did = ?`,
    [gridName, civicDid],
);
```

### setInterval Lifecycle (OBS-R-32-02)

**Source:** `grid/src/genesis/launcher.ts` — the `auditReconcile` field + `stop()` method
**Apply to:** `genesis/launcher.ts` new escalation interval

Every `setInterval` in `grid/src/` MUST have a corresponding `clearInterval` in a shutdown path. Store as `private _escalationInterval: NodeJS.Timeout | undefined`. Clear in `stop()`.

### Fire-and-Forget Async Dispatch

**Source:** `grid/src/genesis/launcher.ts` line 438 (`void this.governance.onTickClosed(event.tick)`)
**Apply to:** Grace timer expired callback, escalation check call

```typescript
// Grace timer callback (never throws into event loop):
() => void this._presenceService?.updatePresence(civicDid, 'away', currentTick)
// Escalation interval callback:
() => void this._presenceService?.runEscalationCheck(this.clock.currentTick)
```

### Python async error-swallow pattern (Brain methods)

**Source:** `brain/src/noesis_brain/wire/client.py` lines 143–149
**Apply to:** `post_presence_heartbeat()` in client.py

Heartbeat failures are logged as warning but not raised. The grace timer will fire if 5 consecutive heartbeats are missed. Never raise from a periodic keep-alive:
```python
except Exception as exc:
    log.warning("[Brain] presence heartbeat failed: %s", exc)
```

### React Steward section pattern (no SWR, plain useEffect)

**Source:** `steward/src/app/system/operators/page.tsx` lines 32–56
**Apply to:** Section 4 queue depth in operators page

Plain `useEffect` + `useState`. No SWR. One `fetch()` call per data source. Error stored in `useState<string | null>`. Follows the same loading/error/data triple-state render.

---

## No Analog Found

No files lack a close analog. All new modules have clear existing counterparts.

---

## Metadata

**Analog search scope:** `grid/src/`, `brain/src/noesis_brain/wire/`, `dashboard/src/`, `steward/src/`
**Files scanned:** 20 source files read directly
**Pattern extraction date:** 2026-05-27

**CI Gates that affect Phase 41 (from RESEARCH.md):**
- `OBS-R-32-02 check-interval-lifecycle.mjs` — every new `setInterval` in `grid/src/` needs `clearInterval` in shutdown
- `OBS-36-01 check-did-policy-coverage.mjs` — all 6 new routes must appear in `ROUTE_DID_POLICY`
- `check-civic-did-issuance-path.mjs` (Phase 37b) — no new Civic-DID issuance outside Portal→Polis pipeline (Phase 41 does not issue DIDs; N/A)
