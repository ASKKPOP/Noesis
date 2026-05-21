# Phase 25a: Observer Surfaces — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 18 new + 8 modified = 26
**Analogs found:** 24 / 26 (2 files have only partial analogs — see "No Analog Found")

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/audit/firehose-hub.ts` | service (hub) | streaming / pub-sub | `grid/src/api/ws-hub.ts` | exact |
| `grid/src/audit/drift-detector.ts` | service | event-driven | `grid/src/api/ws-hub.ts` (onAppend hook block) | role-match |
| `grid/src/api/routes/audit-firehose.ts` | route (WS) | streaming | `grid/src/api/server.ts:475-518` (`/ws/events` block) | exact |
| `grid/src/api/routes/audit-drift-alerts.ts` | route (REST) | request-response | `grid/src/api/operator/memory-query.ts` (without H-tier gate) | role-match |
| `grid/src/api/operator/cognitive-snapshot.ts` | route (H3 proxy) | request-response | `grid/src/api/operator/memory-query.ts` | exact |
| `grid/src/api/operator/cognitive-snapshot-client.ts` | client (HTTP) | request-response | `grid/src/api/operator/brain-hash-state-client.ts` | exact |
| `grid/src/api/routes/humans.ts` | route (REST CRUD-read) | request-response | `grid/src/api/operator/memory-query.ts` (route registration shape) | role-match |
| `grid/src/api/routes/tick-metrics.ts` | route (REST) | request-response | `grid/src/api/operator/memory-query.ts` | role-match |
| `brain/src/noesis_brain/http/server.py` | service (HTTP server) | request-response | none in Brain — first HTTP server | NO ANALOG (use research recommendation) |
| `brain/src/noesis_brain/http/cognitive_snapshot.py` | handler (HTTP) | request-response | none in Brain | NO ANALOG (use research code example) |
| `brain/src/noesis_brain/__main__.py` (MOD) | bootstrap | lifecycle | self (existing RPCServer wiring) | self-extend |
| `brain/pyproject.toml` (MOD) | config | n/a | self | self-extend |
| `grid/src/api/server.ts` (MOD) | bootstrap | lifecycle | self (lines 454-530, existing WS+services wiring) | self-extend |
| `grid/src/audit/broadcast-allowlist.ts` (MOD) | config (regex) | n/a | self (FORBIDDEN_KEY_PATTERN extension) | self-extend |
| `steward/src/app/firehose/page.tsx` | component (page) | streaming | `steward/src/app/audit/page.tsx` (fetch+render skeleton; WS replaces fetch) | role-match |
| `steward/src/app/humans/[did]/page.tsx` | component (page) | request-response | `steward/src/app/nous/[id]/page.tsx` | exact |
| `steward/src/app/nous/[id]/page.tsx` (MOD) | component (page) | request-response | self (existing card mount points) | self-extend |
| `steward/src/app/system/page.tsx` (MOD) | component (page) | request-response | self + `steward/src/app/users/page.tsx` (card list pattern) | self-extend |
| `steward/src/app/users/page.tsx` (MOD) | component (page) | request-response | self (add `<Link>` to DID cell) | self-extend |
| `steward/src/components/StewardShell.tsx` (MOD) | component | n/a | self (existing nav array) | self-extend |
| `scripts/check-cognitive-snapshot-plaintext.mjs` | utility (CI gate) | batch | `scripts/check-whisper-plaintext.mjs` | exact |
| `grid/test/audit/firehose-hub.test.ts` | test | unit | `grid/test/ws-hub.test.ts` (referenced from ws-hub.ts header) | exact |
| `grid/test/audit/drift-detector.test.ts` | test | unit | `grid/test/ws-hub.test.ts` | role-match |
| `grid/test/operator/cognitive-snapshot.test.ts` | test | unit | `grid/test/operator/memory-query.test.ts` (assumed sibling of memory-query.ts) | role-match |
| `grid/test/api/humans.test.ts` | test | unit | `grid/test/operator/memory-query.test.ts` | role-match |
| `brain/test/test_cognitive_snapshot.py` | test (pytest) | unit | `brain/test/` existing aiohttp-free tests | partial |

---

## Pattern Assignments

### `grid/src/audit/firehose-hub.ts` (service, streaming / pub-sub)

**Analog:** `grid/src/api/ws-hub.ts`

**Imports pattern** (ws-hub.ts:20-33):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { Unsubscribe } from '../audit/types.js';
import { isAllowlisted } from '../audit/broadcast-allowlist.js';
import { RingBuffer } from '../util/ring-buffer.js';
```

**ServerSocket adapter interface** (ws-hub.ts:36-43) — reuse VERBATIM. Do not redeclare; import from `../api/ws-hub.js`.

**Core fan-out pattern** (ws-hub.ts:262 + 345-355) — subscribe ONCE to `audit.onAppend`, allowlist-gate per entry, fan-out to clients with backpressure:
```typescript
this.unsubscribeAudit = this.audit.onAppend((entry) => this.onAuditEvent(entry));
// ...
private onAuditEvent(entry: AuditEntry): void {
    if (!isAllowlisted(entry.eventType)) return;
    for (const client of this._clients) {
        // FirehoseHub: NO client-side filter — every allowlisted entry to every client
        try { client.enqueue(entry); } catch { /* swallow */ }
    }
}
```

**ClientConnection backpressure pattern** (ws-hub.ts:84-242) — clone the `ClientConnection` inner class with these reductions:
- Strip `filters`, `matches()`, `setFilters*`, `globMatch` — firehose is unfiltered (D-25a-14).
- Strip `droppedMin/droppedMax` and `DroppedFrame` emission — density-first design has no resume protocol.
- Keep `enqueue` direct-send-vs-buffer split (lines 144-169), `tryDrain` loop (lines 180-202), `trySend` swallow (lines 129-137).
- Keep `RingBuffer<AuditEntry>` with `DEFAULT_BUFFER_CAPACITY = 256`.

**Lifecycle pattern** (ws-hub.ts:357-386) — `close()` is two-phase: send Bye → `await setImmediate` yield → close sockets. Reuse verbatim.

**Hello frame** (ws-hub.ts:286-291) — emit a hello frame with `{type:'hello', serverTime, gridName, lastEntryId}` on connect. Drop `lastEntryId` if firehose does not support replay (recommended: drop it; density-first).

---

### `grid/src/audit/drift-detector.ts` (service, event-driven)

**Analog:** `grid/src/api/ws-hub.ts` (the `onAppend` hook block specifically, lines 252-263 + 345-355)

**Core hook pattern** (ws-hub.ts:262, 345-355) — subscribe to `audit.onAppend`, but INVERT the allowlist check (push only when NOT allowlisted):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry, Unsubscribe } from '../audit/types.js';
import { isAllowlisted } from './broadcast-allowlist.js';
import { RingBuffer } from '../util/ring-buffer.js';

export interface DriftAlert {
    event_type: string;
    actor_did: string;
    tick: number;
    detected_at: number;
}

export class DriftDetector {
    private readonly buffer: RingBuffer<DriftAlert>;
    private readonly unsubscribe: Unsubscribe;

    constructor(audit: AuditChain, capacity = 256) {
        this.buffer = new RingBuffer<DriftAlert>(capacity);
        this.unsubscribe = audit.onAppend((entry: AuditEntry) => {
            if (isAllowlisted(entry.eventType)) return;
            this.buffer.push({
                event_type: entry.eventType,
                actor_did: entry.actorDid,
                tick: (entry.payload as Record<string, unknown>)['tick'] as number ?? 0,
                detected_at: entry.createdAt,
            });
        });
    }

    snapshot(): DriftAlert[] { /* non-destructive read — see Open Question Q5 */ }
    close(): void { try { this.unsubscribe(); } catch { /* swallow */ } }
}
```

**Exception-swallow pattern** (ws-hub.ts:349-353) — the `onAppend` listener MUST NOT throw; wrap all body in try/catch with swallow comment. AuditChain documents that listener exceptions are swallowed, but defense-in-depth.

**Non-destructive read:** RingBuffer.drain() is destructive (used by WsHub::tryDrain). For drift snapshots the steward polls repeatedly — add a `peek()` / `all()` method to `grid/src/util/ring-buffer.ts`, OR maintain a parallel array. (See RESEARCH Open Question Q5.)

---

### `grid/src/api/routes/audit-firehose.ts` (route, streaming)

**Analog:** `grid/src/api/server.ts:475-518` — the existing `/ws/events` registration block.

**WebSocket route registration pattern** (server.ts:475-518) — must be registered INSIDE `app.register(async (instance) => { ... })` scope after `fastifyWebsocket` plugin is registered (server.ts:456-458):
```typescript
app.register(async (instance) => {
    instance.get('/api/v1/audit/firehose', { websocket: true }, (socket, req) => {
        // 1. GRID_WS_SECRET gate — clone verbatim from lines 477-494
        const secret = process.env.GRID_WS_SECRET;
        if (secret) {
            const headerAuth = (req.headers['authorization'] as string | undefined) ?? '';
            const bearer = headerAuth.startsWith('Bearer ')
                ? headerAuth.substring('Bearer '.length) : null;
            const q = req.query as { token?: unknown } | undefined;
            const queryToken = typeof q?.token === 'string' ? q.token : null;
            const presented = bearer ?? queryToken;
            if (presented !== secret) {
                try { socket.close(1008, 'unauthorized'); } catch { /* swallow */ }
                return;
            }
        }
        // 2. Adapter: clone verbatim from lines 496-515
        const adapter = { /* ...same as WsHub adapter... */ };
        firehoseHub.onConnect(adapter);
    });
});
```

**Pitfall:** Do NOT register `fastifyWebsocket` a second time. Reuse the single registration at server.ts:456. Register both `/ws/events` and `/api/v1/audit/firehose` inside the SAME `app.register(async (instance) => ...)` scope, OR inside two siblings — but the plugin itself must be registered exactly once.

**preClose lifecycle hook** (server.ts:528-530) — extend the existing `preClose` to also call `await firehoseHub.close()` and `driftDetector.close()`.

---

### `grid/src/api/operator/cognitive-snapshot.ts` (route, H3 proxy, request-response)

**Analog:** `grid/src/api/operator/memory-query.ts` (the H2 inspect equivalent — only the tier changes)

**Imports pattern** (memory-query.ts:26-32):
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { validateTierBody, type OperatorBody } from './_validation.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
```

**Route skeleton** (memory-query.ts:39-143) — clone exactly, change `'H2'` to `'H3'` and the action from `'inspect'` to `'cognitive_snapshot'`. Specific block-by-block adaptation:

1. **Tier gate** (lines 48-53) — `validateTierBody(body, 'H3')`.
2. **DID gate** (lines 56-60) — `DID_REGEX.test(targetDid)` → 400 `invalid_did`.
3. **Tombstone check** (lines 63-73) — copy verbatim; 410 on tombstoned.
4. **Body validation** (lines 76-91) — cognitive-snapshot has no `query` field; skip this block.
5. **Runner lookup** (lines 94-98) — 404 `unknown_nous` if no runner.
6. **Bridge health** (lines 101-109) — 503 `brain_unavailable` if disconnected.
7. **RPC call** (lines 113-124) — but the RPC is NOT through the runner. The cognitive snapshot is fetched via HTTP from Brain. Replace `runner.queryMemory(...)` with `fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch)`. Wrap in try/catch → 503 `brain_unavailable`.
8. **Assemble final response** (NEW): query audit for `nous.creed_violation` count for the DID and add `creed_violation_count` to the response (Brain does NOT return this field — see RESEARCH "Brain Data Sources" table).
9. **Emit operator.inspected** (lines 127-138) — clone verbatim, change `action: 'inspect'` → `action: 'cognitive_snapshot'`, tier → `v.tier` (will be `'H3'`):
```typescript
appendOperatorEvent(
    services.audit,
    'operator.inspected',
    v.operator_id,
    { tier: v.tier, action: 'cognitive_snapshot', operator_id: v.operator_id, target_did: targetDid },
    targetDid,
);
```
10. **Return response body** (line 141) — `{ ...snapshot, creed_violation_count }`.

**Error ladder discipline** (memory-query.ts:18-24): 400 / 404 / 410 / 503 only — no 500. Audit emit only on SUCCESS path.

---

### `grid/src/api/operator/cognitive-snapshot-client.ts` (HTTP client, request-response)

**Analog:** `grid/src/api/operator/brain-hash-state-client.ts`

**Error class pattern** (brain-hash-state-client.ts:22-48) — clone the three error classes verbatim, renaming:
- `BrainUnreachableError` → reuse as-is (same class is appropriate)
- `BrainUnknownDidError` → reuse as-is
- `BrainMalformedResponseError` → reuse as-is

Recommendation: do NOT redeclare these classes — import them from `brain-hash-state-client.ts`. Move them to a shared `brain-http-errors.ts` file if Plan needs both clients in the same compile unit.

**Injectable fetch + timeout pattern** (brain-hash-state-client.ts:71-90):
```typescript
export async function fetchCognitiveSnapshot(
    brainBaseUrl: string,
    did: string,
    brainFetch: typeof fetch,
    timeoutMs = 5_000,
): Promise<CognitiveSnapshot> {
    const url = `${brainBaseUrl}/cognitive-snapshot/${encodeURIComponent(did)}`;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
        response = await brainFetch(url, {
            signal: controller.signal,
            headers: { 'X-Brain-Secret': process.env.BRAIN_HTTP_SECRET ?? '' },
        });
    } catch (err) {
        clearTimeout(timerId);
        throw new BrainUnreachableError(err);
    } finally {
        clearTimeout(timerId);
    }
    if (!response.ok) throw new BrainUnknownDidError(did, response.status);
    // ... JSON parse + schema validation, same pattern as lines 95-127 ...
}
```

**Closed-tuple schema validation** (brain-hash-state-client.ts:51-56, 102-127):
```typescript
const EXPECTED_KEYS = ['drive_levels','last_sleep_tick','reflexion_count','rule_count','skill_titles_topk'] as const; // sorted
// after JSON parse:
const actualKeys = Object.keys(body as Record<string,unknown>).sort();
if (actualKeys.length !== EXPECTED_KEYS.length || !actualKeys.every((k,i) => k === EXPECTED_KEYS[i])) {
    throw new BrainMalformedResponseError(`expected keys ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
}
```

This closed-tuple validation IS the structural half of the plaintext-leak defense (D-25a-05). Any extra key (e.g. `reflexion_text`) crashes the client immediately. Document this in the JSDoc.

---

### `grid/src/api/routes/humans.ts` (route, REST CRUD-read)

**Analog:** `grid/src/api/operator/memory-query.ts` (route registration skeleton ONLY — strip the H-tier gate, strip the audit emit; humans data is non-operator)

**Route registration skeleton** (memory-query.ts:39-46):
```typescript
export function registerHumansRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Params: { did: string } }>('/api/v1/humans/:did', async (req, reply) => { ... });
    app.get<{ Params: { did: string } }>('/api/v1/humans/:did/history', async (req, reply) => { ... });
}
```

**DID validation** (memory-query.ts:56-60) — reuse `DID_REGEX.test(did)` → 400 `invalid_did`.

**Service lookup** (memory-query.ts:94-98) — adapt to `services.humanRegistry.findByDid(did)` → 404 `unknown_human` if not found.

**Audit query for history** — use existing `services.audit.query(...)` with `eventType` and `actorDid` filters (RESEARCH Pitfall 3: AuditChain.query cannot filter by payload field). For `human.transferred` / `nous.whispered` where the human DID is in the payload, fetch all events of that type and filter in application code.

---

### `grid/src/api/routes/audit-drift-alerts.ts`, `grid/src/api/routes/tick-metrics.ts` (route, REST)

**Analog:** `grid/src/api/operator/memory-query.ts` (route registration shape; no tier gate, no audit emit — these are read-only diagnostic endpoints)

Skeleton — strip everything to the bare minimum:
```typescript
export function registerDriftAlertsRoute(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/audit/drift-alerts', async () => {
        if (!services.driftDetector) return { alerts: [] };
        return { alerts: services.driftDetector.snapshot() };
    });
}
```

---

### `brain/src/noesis_brain/http/server.py`, `cognitive_snapshot.py` (Brain HTTP server)

**Analog:** none in Brain codebase — this is the FIRST HTTP server. Use the RESEARCH code example (lines 614-635) as the seed.

**Imports + bootstrap shape:**
```python
from aiohttp import web
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ..rpc.handler import BrainHandler

class BrainHttpServer:
    def __init__(self, handler: 'BrainHandler', secret: str, port: int):
        self._handler = handler
        self._secret = secret
        self._port = port
        self._app = web.Application()
        self._app.router.add_get('/cognitive-snapshot/{did}', self._handle)
        self._runner: web.AppRunner | None = None
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
```

**Auth + DID extraction** (per RESEARCH 619-624):
```python
async def _handle(self, request: web.Request) -> web.Response:
    if request.headers.get('X-Brain-Secret', '') != self._secret:
        raise web.HTTPUnauthorized()
    did = request.match_info['did']
    # ... assemble response from handler internals ...
```

**Data-source map** (RESEARCH lines 225-238):
| Response field | Brain source |
|---|---|
| `reflexion_count` | `handler._memory_store.count(MemoryType.REFLECTION)` (or equivalent) |
| `rule_count` | wiki page count with `WikiCategory.SELF_MODEL` titled `self_model_rule_*` |
| `skill_titles_topk` | `handler._skill_store.list_all()[:10]` → `.name` field only (NEVER `.body`) |
| `drive_levels` | `handler._ananke_runtimes[did].state.values` → `{k.value: v for k,v in ...}` |
| `last_sleep_tick` | `handler._last_sleep_tick` |

**Lifecycle wiring** (modify `brain/src/noesis_brain/__main__.py`) — start the HTTP server alongside `RPCServer.start()` in `BrainApp.start()`. Pattern: both on the same asyncio event loop, no threading.

**Plaintext invariant:** NEVER include `reflexion_text`, `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext` in the response. `skill_title` IS the documented exception.

---

### `steward/src/app/firehose/page.tsx` (component, streaming)

**Analog:** `steward/src/app/audit/page.tsx` for the page skeleton + StewardShell + fetch-error/loading patterns. The WebSocket layer has no direct steward analog — use `new WebSocket(GRID_ORIGIN.replace(/^http/, 'ws') + '/api/v1/audit/firehose')`.

**Imports + GRID_ORIGIN pattern** (audit/page.tsx:1-6):
```typescript
'use client';
import { useEffect, useState, useRef } from 'react';
import StewardShell from '@/components/StewardShell';
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
```

**Reusable helpers** (audit/page.tsx:18-44) — clone verbatim: `truncateDid`, `relativeTime`, `absoluteTime`. Recommend extracting these to `steward/src/lib/format.ts` (small refactor; in scope only if planner approves — surgical-change rule says skip if not needed).

**Page shell + StewardShell wrap** (audit/page.tsx:111+ + users/page.tsx:118-119):
```typescript
return (
    <StewardShell title="Live Firehose" breadcrumb="Steward · Firehose">
        {/* status pill + viewport */}
    </StewardShell>
);
```

**Connection-status pattern (new — no direct analog):** see UI-SPEC.md "Connection status pill" and "Auto-scroll behavior" — these are 25a-specific contracts. Implement with `useRef<WebSocket>(null)`, `useState` for connected/disconnected/retry-countdown, exponential backoff (1s → 2s → 4s, cap 30s).

**Loading / error state styling** (users/page.tsx:137-145):
```typescript
<div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
    Loading users…
</div>
```
Use this token-set verbatim for firehose "Connecting…" overlay.

**Row styling: UI-SPEC.md is authoritative** — 32px height, family-colored 3px left-border, mono badges, etc. Do NOT clone audit/page.tsx's `<PayloadCell>` expand pattern — firehose is single-line, no expand (D-25a-14).

---

### `steward/src/app/humans/[did]/page.tsx` (component, page)

**Analog:** `steward/src/app/nous/[id]/page.tsx` (drill-down spine — header card + tabbed sections — referenced in CONTEXT.md line 181).

Mirror the page module structure of `nous/[id]/page.tsx`:
- `'use client'` + `useEffect`/`useState` + `useParams` (Next.js App Router dynamic route)
- StewardShell wrap with `title={grid_name ?? truncateDid(did)}` and `breadcrumb="Steward · Users · {name}"`
- Header card with `steward-card` className (`.steward-card` styled by `globals.css`)
- Tab bar implementation: see UI-SPEC.md "Tabbed sections" — `role="tablist"`, `role="tab"`, `aria-selected`, arrow-key handling
- Back link `← Back to Users` → `/users` (UI-SPEC explicitly references the `← Back to Roster` pattern from `nous/[id]`)

**Data fetching pattern** (audit/page.tsx + users/page.tsx):
```typescript
useEffect(() => {
    async function fetchAll() {
        setLoading(true); setError(null);
        try {
            const [profileRes, historyRes] = await Promise.allSettled([
                fetch(`${GRID_ORIGIN}/api/v1/humans/${did}`),
                fetch(`${GRID_ORIGIN}/api/v1/humans/${did}/history`),
            ]);
            // ... parallel result handling, mirror users/page.tsx:93-108 ...
        } catch (e) { setError(...); } finally { setLoading(false); }
    }
    fetchAll();
}, [did]);
```

**404 handling** — UI-SPEC: "Full-page inline: 'Human not found.' serif 22px, link back to `/users`. Do not redirect."

---

### `steward/src/app/users/page.tsx` (MOD)

**Self-extend.** Wrap the DID cell at lines 174-178 with a Next.js `<Link href={`/humans/${u.did}`}>` while keeping the same `truncateDid`, `var(--mono)`, `var(--muted)` styling. Add `:hover` color change to `var(--terracotta)` via inline style toggle or a className. (UI-SPEC §"Surface 5 deep-link from `/users`".)

---

### `scripts/check-cognitive-snapshot-plaintext.mjs` (utility, CI gate)

**Analog:** `scripts/check-whisper-plaintext.mjs` (276 lines, full pattern).

Clone the file verbatim, then adjust:
1. **Scan scope:** change file globs from whisper paths to `brain/src/noesis_brain/http/cognitive_snapshot.py`, `brain/test/test_cognitive_snapshot.py`, `grid/src/api/operator/cognitive-snapshot.ts`, `grid/src/api/operator/cognitive-snapshot-client.ts`, and their test siblings.
2. **Forbidden key list:** `['reflexion_text', 'rule_text', 'creed_text', 'skill_body', 'lore_body', 'whisper_plaintext']`. EXEMPT: `skill_title` (D-25a-05 — explicitly permitted; never add to forbidden list).
3. **Exit code semantics:** preserve the parent script's exit-1-on-hit, exit-0-on-clean behavior.

**Pitfall** (RESEARCH Pitfall 7): NEVER add `skill_title` to the forbidden list — that would break the one permitted Brain-internal text field.

---

### `grid/src/audit/broadcast-allowlist.ts` (MOD — FORBIDDEN_KEY_PATTERN extension)

**Self-extend.** RESEARCH lines 394-402: the current `FORBIDDEN_KEY_PATTERN` already covers `skill_body|rule_text|lore_body|...`. NEW additions in 25a: `reflexion_text|creed_text|whisper_plaintext`.

**Pitfall** (RESEARCH Pitfall 2): the existing regex contains `content(?!_hash)` — a negative lookahead. When appending new alternates, do NOT break the existing lookahead structure. Read the current pattern string and append `|reflexion_text|creed_text|whisper_plaintext` at a position that preserves the regex semantics.

---

## Shared Patterns

### Audit listener exception-swallow

**Source:** `grid/src/api/ws-hub.ts:349-353`
**Apply to:** `firehose-hub.ts`, `drift-detector.ts`

```typescript
try { /* listener body */ } catch { /* swallow — listener exceptions must not corrupt chain state */ }
```

This is the universal rule for `audit.onAppend` listeners. Both new services must follow it.

---

### H-tier validation + tombstone check + operator.inspected emit

**Source:** `grid/src/api/operator/memory-query.ts:48-138`
**Apply to:** `grid/src/api/operator/cognitive-snapshot.ts`

Five-block sequence:
1. `validateTierBody(body, 'H3')` → 400 on invalid
2. `DID_REGEX.test(targetDid)` → 400 on invalid
3. `tombstoneCheck(services.registry, targetDid)` → 410 on tombstoned
4. Runner / dependency lookup → 404 / 503 on missing/disconnected (NO audit emit)
5. After SUCCESS: `appendOperatorEvent(services.audit, 'operator.inspected', operator_id, { tier, action, operator_id, target_did }, targetDid)`

**Sole-producer invariant** (RESEARCH Pitfall 4): NEVER create a new `operator.inspected` emitter. Always go through `appendOperatorEvent` from `grid/src/audit/operator-events.ts`.

---

### Brain HTTP client (injectable fetch + closed-tuple schema)

**Source:** `grid/src/api/operator/brain-hash-state-client.ts:51-135`
**Apply to:** `grid/src/api/operator/cognitive-snapshot-client.ts`

- `brainFetch: typeof fetch` parameter for test injectability — NEVER use global `fetch` directly.
- `AbortController` + `setTimeout(..., timeoutMs)` for explicit timeout.
- `try/catch` on `brainFetch(...)` → throw `BrainUnreachableError`.
- Non-200 → `BrainUnknownDidError`.
- JSON parse failure or schema mismatch → `BrainMalformedResponseError`.
- Closed-tuple key check via sorted `EXPECTED_KEYS` comparison.

**Privacy invariant:** the closed-tuple schema check IS the structural defense against accidental plaintext leakage. Document in JSDoc.

---

### Steward page skeleton (Next.js App Router, GRID_ORIGIN, StewardShell)

**Source:** `steward/src/app/users/page.tsx:1-117` (canonical small-page skeleton)
**Apply to:** `steward/src/app/firehose/page.tsx`, `steward/src/app/humans/[did]/page.tsx`

- `'use client'` directive at top.
- `const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';`
- `useEffect(() => { async function fetchAll() {...} fetchAll(); }, [deps])` pattern.
- `Promise.allSettled([...])` for parallel fetches that may fail independently.
- Local helpers: `truncateDid`, `relativeTime`, `formatDate` — duplicate inline (existing convention) OR extract to `lib/format.ts` (planner's call; default = duplicate to keep changes surgical).
- StewardShell wrap: `<StewardShell title="..." breadcrumb="...">{children}</StewardShell>`.

---

### Inline-styled muted error / loading text

**Source:** `steward/src/app/users/page.tsx:137-145`
**Apply to:** all new steward pages

```typescript
<div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
    {error ? `Could not load X: ${error}` : 'Loading X…'}
</div>
```

UI-SPEC.md copy strings are authoritative for the exact text.

---

### CSS-token discipline (Steward)

**Source:** `steward/src/app/globals.css` `:root` + UI-SPEC §"Color"
**Apply to:** all new steward components

Only use these CSS variables for color: `--ink`, `--parchment`, `--vellum`, `--terracotta`, `--terracotta-2`, `--bronze`, `--rule`, `--muted`. Hardcoded hex values are reserved for: event-family palette on `/firehose` (per UI-SPEC §"Event-Family Color Palette"), drive bar colors (UI-SPEC §"Drive bars section"), sidebar bg `#1e1c1a`, online green `#2d7a2d`. Do NOT introduce new tokens.

---

### CI grep gate pattern

**Source:** `scripts/check-whisper-plaintext.mjs` (276 lines)
**Apply to:** `scripts/check-cognitive-snapshot-plaintext.mjs`

Clone the entire script; adjust file globs and forbidden-key list. Preserve exit-code semantics for pre-commit / CI integration.

---

## No Analog Found

| File | Role | Reason / Mitigation |
|------|------|--------------------|
| `brain/src/noesis_brain/http/server.py` | First HTTP server in Brain (Python aiohttp) | Brain has only Unix-socket JSON-RPC today (RESEARCH §"Brain Endpoint Deep-Dive"). Use the RESEARCH code example (lines 615-635) as the seed pattern. Verify via Plan that no hidden HTTP server already exists (RESEARCH Open Question Q1). |
| `brain/src/noesis_brain/http/cognitive_snapshot.py` | aiohttp handler | Same as above. RESEARCH provides the seed shape. |
| `grid/src/api/routes/tick-metrics.ts` — in-memory tick latency ring buffer | Per-Nous tick instrumentation | RESEARCH §"Surface 3 Brain Health" + Assumption A7: no existing tick-latency metric. Add lightweight in-memory ring buffer in `NousRunner.sendTick()` path. Closest pattern: `grid/src/util/ring-buffer.ts` (already in use by WsHub). |

---

## Open Questions (forwarded from RESEARCH for planner)

1. **Does Brain already have an HTTP server?** — RESEARCH Q1; verify before Plan 1.
2. **`actorDid` for `skill.taught` / `skill.inferred`** — RESEARCH Q2; read `grid/src/skills/appendSkillTaught.ts` to confirm filter shape for Brain health metric #2.
3. **`humanOwner` field on NousRegistry** — RESEARCH Q3; verify in `grid/src/registry/registry.ts`.
4. **Color-family `human.*` and `ananke.*`** — RESEARCH Q4; UI-SPEC already locked these (added `human` family forest-green + `ananke` family deep-rose). Planner: no further decision needed.
5. **RingBuffer non-destructive snapshot** — RESEARCH Q5; add `peek()` / `all()` method to `grid/src/util/ring-buffer.ts` for drift-detector polling.

---

## Metadata

**Analog search scope:** `grid/src/`, `grid/src/api/`, `grid/src/audit/`, `brain/src/noesis_brain/`, `steward/src/app/`, `scripts/`
**Files scanned (Read tool):** 8 primary analogs + 3 input docs = 11
**Anchor analogs (cited multiple times):**
- `grid/src/api/ws-hub.ts` — cited for firehose-hub, drift-detector, WS-route shape
- `grid/src/api/operator/memory-query.ts` — cited for cognitive-snapshot, humans, tick-metrics, drift-alerts
- `grid/src/api/operator/brain-hash-state-client.ts` — cited for cognitive-snapshot-client
- `grid/src/api/server.ts:475-518` — cited for audit-firehose route registration
- `steward/src/app/audit/page.tsx`, `steward/src/app/users/page.tsx`, `steward/src/app/nous/[id]/page.tsx` — cited for Steward page skeletons
- `scripts/check-whisper-plaintext.mjs` — cited for CI grep gate

**Pattern extraction date:** 2026-05-21
