# Phase 36: Visitor/DID Read-Write Split — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 42 new/modified files
**Analogs found:** 42 / 42 (all files have strong analogs)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/api/policy.ts` | config | request-response | `grid/src/audit/broadcast-allowlist.ts` | role-match (both are frozen lookup tables) |
| `grid/src/api/preHandlers/requireDid.ts` | middleware | request-response | `grid/src/api/portal/check-frozen.ts` | exact |
| `grid/src/api/preHandlers/tryDid.ts` | middleware | request-response | `grid/src/api/portal/check-frozen.ts` | exact |
| `grid/src/api/visitor/civic-map.ts` | route | request-response | `grid/src/api/routes/health-detailed.ts` | role-match |
| `grid/src/api/visitor/library.ts` | route | request-response | `grid/src/api/routes/lore.ts` | exact |
| `grid/src/api/visitor/marketplace.ts` | route | request-response | `grid/src/api/routes/lore.ts` | exact |
| `grid/src/api/visitor/polis-bills.ts` | route | request-response | `grid/src/api/governance/routes.ts` | role-match |
| `grid/src/api/visitor/public-profile.ts` | route | request-response | `grid/src/api/routes/humans.ts` | role-match |
| `grid/src/api/visitor/audit-stream.ts` | route | request-response | `grid/src/api/routes/audit-firehose.ts` | exact |
| `grid/src/auth/operator-did-token.ts` | utility | request-response | `grid/src/api/portal/auth.ts` (jwtVerify section) | role-match |
| `grid/src/auth/civic-did-token.ts` | utility | request-response | `grid/src/api/portal/auth.ts` (jwtVerify section) | role-match |
| `grid/src/auth/oauth-stub.ts` | route | request-response | `grid/src/api/portal/auth.ts` (email routes) | role-match |
| `grid/src/auth/siwe-portal.ts` | route | request-response | `grid/src/api/portal/auth.ts` (SIWE section) | exact |
| `grid/src/auth/email-portal.ts` | route | request-response | `grid/src/api/portal/auth.ts` (email section) | exact |
| `grid/src/audit/append-portal-did-issued.ts` | service | event-driven | `grid/src/audit/append-portal-auth-login.ts` | exact |
| `grid/src/audit/append-portal-did-revoked.ts` | service | event-driven | `grid/src/audit/append-portal-auth-login.ts` | exact |
| `grid/src/audit/append-grid-recognition-granted.ts` | service | event-driven | `grid/src/audit/append-portal-auth-login.ts` | exact |
| `grid/src/audit/append-grid-recognition-revoked.ts` | service | event-driven | `grid/src/audit/append-portal-auth-login.ts` | exact |
| `grid/src/audit/append-portal-notification-dispatched.ts` | service | event-driven | `grid/src/audit/append-portal-auth-login.ts` | exact |
| `grid/src/firehose/redaction.ts` | utility | streaming | `grid/src/audit/firehose-hub.ts` (serializeFrame concept) | role-match |
| `grid/src/firehose/visitor-count-stats.ts` | utility | streaming | `grid/src/audit/firehose-hub.ts` (FirehoseStats) | role-match |
| `grid/src/portal/notifications.ts` | route | request-response | `grid/src/api/admin/notifications.ts` | role-match |
| `grid/src/rateLimit/visitor-bucket.ts` | middleware | request-response | `grid/src/api/portal/check-frozen.ts` | role-match |
| `grid/src/firehose/ws-hub.ts` (MODIFY) | service | streaming | itself (extend) | exact |
| `grid/src/audit/broadcast-allowlist.ts` (MODIFY) | config | event-driven | itself (extend) | exact |
| `dashboard/src/app/portal/page.tsx` (REWRITE) | component | request-response | `dashboard/src/app/portal/page.tsx` (current v2.5) | exact |
| `dashboard/src/app/portal/layout.tsx` | component | request-response | `dashboard/src/app/portal/layout.tsx` | exact |
| `dashboard/src/app/portal/civic-map/page.tsx` | component | request-response | `steward/src/app/culture/skill-lineage.tsx` | role-match |
| `dashboard/src/app/portal/civic-map/CivicMap.tsx` | component | request-response | `steward/src/app/culture/skill-lineage.tsx` | exact |
| `dashboard/src/app/portal/library/page.tsx` | component | request-response | `dashboard/src/app/portal/page.tsx` (card grid pattern) | role-match |
| `dashboard/src/app/portal/marketplace/page.tsx` | component | request-response | `dashboard/src/app/portal/page.tsx` (card grid pattern) | role-match |
| `dashboard/src/app/portal/polis/page.tsx` | component | request-response | `dashboard/src/app/portal/page.tsx` (card grid pattern) | role-match |
| `dashboard/src/app/portal/polis/[bill_id]/page.tsx` | component | request-response | `dashboard/src/app/portal/page.tsx` (detail pattern) | role-match |
| `dashboard/src/app/portal/nous/[did]/page.tsx` | component | request-response | `dashboard/src/app/portal/page.tsx` (detail pattern) | role-match |
| `dashboard/src/app/portal/notifications/page.tsx` | component | request-response | `dashboard/src/app/portal/page.tsx` (card grid pattern) | role-match |
| `dashboard/src/lib/use-civic-map.ts` | hook | request-response | `steward/src/lib/use-health-detailed.ts` | exact |
| `dashboard/src/lib/visitor-tier.ts` | utility | request-response | `dashboard/src/auth.ts` | role-match |
| `scripts/check-did-policy-coverage.mjs` | config/CI | batch | `scripts/check-sole-producer-discipline.mjs` | exact |
| `scripts/check-admin-policy-isolation.mjs` | config/CI | batch | `scripts/check-governance-isolation.mjs` | exact |
| `scripts/check-ws-redaction-zero-diff.mjs` | config/CI | batch | `scripts/check-sole-producer-discipline.mjs` | role-match |
| `scripts/check-no-did-exception-count.mjs` (MODIFY) | config/CI | batch | itself (update count 3→5) | exact |

---

## Pattern Assignments

### Domain: API — Policy Table + preHandlers

---

#### `grid/src/api/policy.ts` (config, request-response)

**Analog:** `grid/src/audit/broadcast-allowlist.ts` — frozen lookup table pattern

**The 6-value enum and ROUTE_DID_POLICY table are research-defined. Use this shape:**
```typescript
// grid/src/api/policy.ts
// Pattern: frozen const object as single-source-of-truth lookup table (broadcast-allowlist.ts lines 80-222)

export const ROUTE_DID_POLICY_VALUES = [
  'public',
  'portal_session_required',
  'civic_did_required',
  'business_did_required',
  'government_only',
  'police_only',
] as const;

export type RouteDIDPolicy = typeof ROUTE_DID_POLICY_VALUES[number];

/**
 * Default-deny: any route not listed here is treated as 'civic_did_required'.
 * Single-source-of-truth for CI gate check-did-policy-coverage.mjs.
 * Add a comment at the top: // ROUTE_DID_POLICY table — count: N entries
 */
export const ROUTE_DID_POLICY: Record<string, RouteDIDPolicy> = {
  'GET /health':                              'public',
  'GET /health/detailed':                     'public',
  // ... per 36-RESEARCH.md Pattern 1 full example
} as const;
```

**Allowlist build pattern** (broadcast-allowlist.ts lines 234-245 — use `as const` frozen table, NOT a Set for ROUTE_DID_POLICY since it's a Record):
```typescript
// The broadcast-allowlist.ts buildFrozenAllowlist() pattern is for Sets.
// ROUTE_DID_POLICY uses 'as const' on a Record<string, RouteDIDPolicy> instead.
// Freeze with Object.freeze if mutation defense needed.
export const ROUTE_DID_POLICY = Object.freeze({ ... } as Record<string, RouteDIDPolicy>);
```

---

#### `grid/src/api/preHandlers/requireDid.ts` + `tryDid.ts` (middleware, request-response)

**Analog:** `grid/src/api/portal/check-frozen.ts` — Fastify preHandler hook pattern

**Imports pattern** (check-frozen.ts lines 17-19):
```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GridServices } from '../server.js';
```

**preHandler registration pattern** (check-frozen.ts lines 37-61 — canonical):
```typescript
// check-frozen.ts lines 37-61
export function registerFrozenCheck(app: FastifyInstance, services: GridServices): void {
    app.addHook('preHandler', async (req: FastifyRequest, reply) => {
        // Only intercept portal action routes
        if (!isPortalActionRoute(req.url)) return;

        // No store wired (test/dev stub missing) → pass through
        if (!services.humanSanctionStore) return;

        // Read from session/cookie
        const humanDid = (req as FastifyRequest & { session?: { humanDid?: string } }).session?.humanDid;
        if (!humanDid) return;

        const flags = await services.humanSanctionStore.getFlags(humanDid);
        if (!flags) return;

        if (flags.banned === 1) {
            reply.code(403);
            return reply.send({ error: 'human_banned' });
        }
    });
}
```

**Phase 36 adaptation — requireDid / tryDid:**
```typescript
// grid/src/api/preHandlers/requireDid.ts
// Pattern: preHandler that reads Authorization header + session cookie
// Auth imports from portal/auth.ts:
import { jwtVerify } from 'jose';
import { keyPairPromise, COOKIE_NAME } from '../portal/auth.js';   // auth.ts line 46, 53

export interface DIDContext {
  did: string;
  tier: 'anonymous' | 'human_visitor' | 'civic_member';
  operatorDid?: string;
}

// tryDid — never returns 401, for read routes that conditionally redact
export async function tryDid(req: FastifyRequest): Promise<DIDContext | null> {
  // 1. Try Bearer JWT (Civic-DID bearer)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { publicKey } = await keyPairPromise;
      const { payload } = await jwtVerify(authHeader.slice(7), publicKey);
      if (payload.sub && typeof payload.sub === 'string') {
        return { did: payload.sub, tier: 'civic_member' };
      }
    } catch { /* fall through */ }
  }
  // 2. Try Portal session cookie (Human Visitor)
  const cookie = req.cookies?.[COOKIE_NAME];  // COOKIE_NAME from auth.ts line 46
  if (cookie) {
    try {
      const { publicKey } = await keyPairPromise;
      const { payload } = await jwtVerify(cookie, publicKey);
      if (payload.did && typeof payload.did === 'string') {
        return { did: payload.did, tier: 'human_visitor', operatorDid: payload.did as string };
      }
    } catch { /* fall through */ }
  }
  return null;  // Anonymous
}

// requireDid — returns 401 for anonymous + human_visitor on civic_did_required routes
export async function requireDid(req: FastifyRequest, reply: FastifyReply): Promise<DIDContext | null> {
  const ctx = await tryDid(req);
  if (!ctx || ctx.tier !== 'civic_member') {
    reply.code(401).send({ error: 'did_required', accepted_methods: ['civic_did_bearer', 'portal_session'] });
    return null;
  }
  return ctx;
}
```

**ROUTE_DID_POLICY-driven global hook** (check-frozen.ts pattern adapted):
```typescript
// grid/src/api/server.ts — add after registerPortalAuthRoutes
// Pattern from check-frozen.ts lines 37-61 + RESEARCH.md Pattern 1
app.addHook('preHandler', async (req, reply) => {
  const policy = ROUTE_DID_POLICY[`${req.method} ${req.routerPath}`] ?? 'civic_did_required';
  if (policy === 'public') return;
  if (policy === 'portal_session_required') {
    const ctx = await tryDid(req);
    if (!ctx) { reply.code(401).send({ error: 'portal_session_required' }); return; }
    (req as ExtendedRequest).didContext = ctx;
    return;
  }
  // civic_did_required and above:
  const ctx = await requireDid(req, reply);
  if (!ctx) return;  // 401 already sent
  (req as ExtendedRequest).didContext = ctx;
});
```

---

#### `grid/src/api/visitor/*.ts` — visitor route files (route, request-response)

**Analog:** `grid/src/api/routes/health-detailed.ts` — Fastify route registration pattern

**Route registration pattern** (health-detailed.ts lines 22-34 — canonical shape):
```typescript
// grid/src/api/routes/health-detailed.ts lines 22-34
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

export function registerHealthDetailedRoute(
    app: FastifyInstance,
    _services: GridServices,
    launcher: GenesisLauncher,
): void {
    app.get('/health/detailed', async (_req, reply) => {
        if (!launcher.healthWatchdog) {
            reply.code(503);
            return { error: 'watchdog_not_ready' } satisfies ApiError;
        }
        return launcher.healthWatchdog.snapshot();
    });
}
```

**Apply to civic-map.ts, library.ts, marketplace.ts, polis-bills.ts, public-profile.ts:**
- Each exports a `register<Name>Route(app, services)` function
- Route handler returns data directly (Fastify auto-serializes)
- 503 guard if required service not ready
- `tryDid` called for read routes needing conditional redaction
- No `reply.send()` for happy path — just `return data`

**ROUTE_DID_POLICY comment per route (Pitfall 2 guard):**
```typescript
// At the top of each route handler, add:
// ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
app.get('/api/v1/civic-map/state', async (req, reply) => { ... });
```

---

### Domain: Auth

---

#### `grid/src/auth/siwe-portal.ts` + `email-portal.ts` (route, request-response)

**Analog:** `grid/src/api/portal/auth.ts` — SIWE + email auth routes

**JWT issuance pattern** (auth.ts lines 164-178 — canonical):
```typescript
// auth.ts lines 164-178 — copy verbatim for JWT issuance in siwe-portal.ts
const { privateKey } = await keyPairPromise;
const token = await new SignJWT({
    did: human.did,
    eth_address: human.eth_address,
    grid_name: gridName,
    region: human.region,
    created_at: human.created_at.toISOString(),
})
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(privateKey);

reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    // ... secure: true, sameSite: 'strict' per security domain
});
```

**JWT verification pattern** (auth.ts lines 17-21 + keyPairPromise at line 53):
```typescript
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';
// keyPairPromise exported from auth.ts line 53:
export const keyPairPromise = generateKeyPair('ES256');
// Verify: const { privateKey, publicKey } = await keyPairPromise;
// then: await jwtVerify(token, publicKey)
```

**Sole-producer audit call pattern** (auth.ts lines 148-152 — after create/login):
```typescript
// Pattern from auth.ts — always call append* BEFORE JWT issuance
appendPortalAuthRegister(services.audit, {
    human_did: human.did,
    method: 'siwe',
    tick: services.clock.state.tick,
});
```

---

#### `grid/src/auth/oauth-stub.ts` (route, request-response)

**Analog:** `grid/src/api/portal/auth.ts` — route registration pattern

**Stub pattern** (per RESEARCH.md Open Question 3 — return 501 stub):
```typescript
// oauth-stub.ts — returns 501 stub per D-36-21 (Phase 52-54 implements real OAuth)
export function registerOAuthStubRoutes(app: FastifyInstance): void {
    app.post('/portal/auth/oauth/google', async (_req, reply) => {
        return reply.status(501).send({ status: 'coming_soon', provider: 'google' });
    });
    app.post('/portal/auth/oauth/apple', async (_req, reply) => {
        return reply.status(501).send({ status: 'coming_soon', provider: 'apple' });
    });
    // ROUTE_DID_POLICY: 'public' for both — listed in grid/src/api/policy.ts
    // These are no-DID exceptions #4 and #5 per D-36-21
}
```

---

### Domain: Audit — Sole-Producer Files

---

#### `grid/src/audit/append-portal-did-issued.ts` (service, event-driven)
#### `grid/src/audit/append-portal-did-revoked.ts` (service, event-driven)
#### `grid/src/audit/append-grid-recognition-granted.ts` (service, event-driven)
#### `grid/src/audit/append-grid-recognition-revoked.ts` (service, event-driven)
#### `grid/src/audit/append-portal-notification-dispatched.ts` (service, event-driven)

**Analog:** `grid/src/audit/append-portal-auth-login.ts` — canonical sole-producer triad

**Complete imports pattern** (append-portal-auth-login.ts lines 25-28):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';
```

**Closed enum pattern** (append-portal-auth-login.ts lines 37-38):
```typescript
export const LOGIN_METHOD_ENUM = ['email', 'siwe'] as const;
export type LoginMethod = typeof LOGIN_METHOD_ENUM[number];
```

**Closed payload interface pattern** (append-portal-auth-login.ts lines 41-45):
```typescript
/** Closed 3-key payload for portal.auth.login. */
export interface PortalAuthLoginPayload {
    readonly human_did: string;    // DID_RE
    readonly method: LoginMethod;  // closed enum
    readonly tick: number;         // non-negative integer
}
const EXPECTED_KEYS = ['human_did', 'method', 'tick'] as const;  // ALPHABETICAL
```

**Full 8-step triad function body** (append-portal-auth-login.ts lines 56-112 — copy verbatim, substitute event type + payload keys):
```typescript
export function appendPortalAuthLogin(
    audit: AuditChain,
    payload: PortalAuthLoginPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalAuthLogin: payload must be a plain object`);
    }
    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(`appendPortalAuthLogin: human_did must match DID_RE ...`);
    }
    // 3. (Closed-enum guard if applicable)
    // 4. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalAuthLogin: tick must be a non-negative integer ...`);
    }
    // 5. Closed-tuple structural check (alphabetical key order).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendPortalAuthLogin: unexpected key set — expected ...`);
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = { human_did: payload.human_did, method: payload.method, tick: payload.tick };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendPortalAuthLogin: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    // 8. Commit to chain.
    return audit.append('portal.auth.login', payload.human_did, cleanPayload);
}
```

**Payload shape per event (from 36-RESEARCH.md §Pattern 4):**

| File | Event Type | Keys (alphabetical) | Actor field |
|------|------------|---------------------|-------------|
| `append-portal-did-issued.ts` | `portal.did_issued` | `human_or_nous_did`, `issued_at_tick`, `issuer_portal_id` | `human_or_nous_did` |
| `append-portal-did-revoked.ts` | `portal.did_revoked` | `human_or_nous_did`, `revoked_at_tick`, `revoker_portal_id` | `human_or_nous_did` |
| `append-grid-recognition-granted.ts` | `grid.recognition_granted` | `grid_name`, `granted_at_tick`, `nous_did` | `nous_did` |
| `append-grid-recognition-revoked.ts` | `grid.recognition_revoked` | `grid_name`, `nous_did`, `revoked_at_tick` | `nous_did` |
| `append-portal-notification-dispatched.ts` | `portal.notification_dispatched` | `dispatched_at_tick`, `notification_type`, `operator_did` | `operator_did` |

**Note on allowlist:** `portal.notification_dispatched` goes in the audit chain but NOT in `ALLOWLIST_MEMBERS` (it is a personal notification event, not a public broadcast event — per RESEARCH.md Open Question 2). Total Phase 36 allowlist additions = 4 (56 → 60).

---

#### `grid/src/audit/broadcast-allowlist.ts` (MODIFY — extend +4 entries)

**Pattern:** Append 4 new entries to `ALLOWLIST_MEMBERS` array following the existing comment discipline (broadcast-allowlist.ts lines 206-221):
```typescript
// Phase 36 (VIS-05 / D-36-17) — Portal DID lifecycle + Grid recognition events. Allowlist 56→60.
// portal.did_issued: closed 3-key payload {human_or_nous_did, issued_at_tick, issuer_portal_id}.
// Emitted ONLY via appendPortalDidIssued() (grid/src/audit/append-portal-did-issued.ts).
'portal.did_issued',       // (57)
'portal.did_revoked',      // (58)
'grid.recognition_granted', // (59)
'grid.recognition_revoked', // (60)
// NOTE: portal.notification_dispatched is NOT on the allowlist — private queue event only.
```

---

### Domain: Firehose — WS Hub Extension

---

#### `grid/src/firehose/ws-hub.ts` (MODIFY — extend ClientConnection + per-subscriber serializer)

**Analog:** `grid/src/audit/firehose-hub.ts` — modify this file directly

**Current ClientConnection class** (firehose-hub.ts lines 61-149):
- Add `readonly didContext: DIDContext | null` field to `ClientConnection`
- Modify `onConnect(socket, didContext?: DIDContext | null)` to accept and store DID context
- Add `serializeFrame()` helper called inside `trySend()`

**Current FirehoseStats interface** (firehose-hub.ts lines 46-52 — DO NOT modify):
```typescript
export interface FirehoseStats {
    readonly client_count: number;
    readonly frames_sent_total: number;
    readonly frames_dropped_total: number;
    readonly last_frame_at: number | null;
    readonly watermark_bytes: number;
}
// visitor_count_active is tracked as a PRIVATE counter on WsFirehoseHub,
// NOT added to FirehoseStats (Pitfall 6 — would leak via /health/detailed).
```

**Extension points** (firehose-hub.ts lines 61-80, 200-244):
```typescript
// 1. ClientConnection gains didContext field:
class ClientConnection {
    readonly socket: ServerSocket;
    readonly watermarkBytes: number;
    readonly didContext: DIDContext | null;  // NEW Phase 36
    // ...
    constructor(socket, watermarkBytes, bufferCapacity, metrics, didContext: DIDContext | null) {
        // ...
        this.didContext = didContext;  // NEW
    }

    // 2. trySend() calls serializeFrame() instead of JSON.stringify directly:
    trySend(frame: ServerFrame): void {
        if (this.closed) return;
        try {
            // NEW: use per-subscriber serializer (R-31-01 zero-diff)
            const wire = this.didContext?.tier === 'civic_member'
                ? JSON.stringify(frame)
                : serializeVisitorFrame(frame);
            this.socket.send(wire);
            // ...
        } catch { /* swallow */ }
    }
}

// 3. serializeVisitorFrame — strips private fields (RESEARCH.md Pattern 3):
const VISITOR_STRIPPED_PAYLOAD_KEYS = new Set([
    'human_did', 'eth_address_hash', 'nonce_hash', 'target_did',
    'voter_did', 'proposer_did', 'from_did', 'to_did', 'owner_human_did',
]);

function serializeVisitorFrame(frame: ServerFrame): string {
    if (frame.type !== 'event') return JSON.stringify(frame);
    const entry = (frame as { type: 'event'; entry: AuditEntry }).entry;
    return JSON.stringify({
        type: 'event',
        entry: {
            tick: entry.tick,
            event_type: entry.eventType,
            family: entry.eventType.split('.')[0],
            // actor_did, payload: DROPPED — R-31-01 zero-diff
        },
    });
}

// 4. onConnect gains optional didContext parameter:
onConnect(socket: ServerSocket, didContext?: DIDContext | null): void {
    // ... existing closing check ...
    const client = new ClientConnection(socket, this.watermarkBytes, this.bufferCapacity, {
        incrementSent: () => { this.metrics.frames_sent_total++; },
        incrementDropped: () => { this.metrics.frames_dropped_total++; },
        touchLastFrame: () => { this.metrics.last_frame_at = Date.now(); },
    }, didContext ?? null);  // NEW
    // ...

    // 5. visitor_count_active as PRIVATE counter (not in stats()):
    if (!didContext || didContext.tier !== 'civic_member') {
        this._visitorCount++;  // private counter
    }
    socket.on('close', () => {
        // decrement visitor counter if needed
        if (!client.didContext || client.didContext.tier !== 'civic_member') {
            this._visitorCount = Math.max(0, this._visitorCount - 1);
        }
        client.markClosed();
        this._clients.delete(client);
    });
}

// 6. CRITICAL: onAuditEvent MUST NOT redact (R-31-01 zero-diff):
private onAuditEvent(entry: AuditEntry): void {
    try {
        if (!isAllowlisted(entry.eventType)) return;
        // Do NOT redact here — redaction is in serializeFrame() (R-31-01 zero-diff)
        for (const client of this._clients) {
            try {
                client.enqueue(entry);  // full entry passed; serialization at trySend()
            } catch { /* swallow */ }
        }
    } catch { /* swallow */ }
}
```

---

#### `grid/src/firehose/redaction.ts` (utility, streaming)

**Analog:** `grid/src/audit/firehose-hub.ts` lines 250-264 (onAuditEvent + trySend concepts)

This is the extracted pure-function form of the visitor serializer described above. Keeps `ws-hub.ts` diff small.

```typescript
// grid/src/firehose/redaction.ts
// Standalone pure function — no imports from audit chain
export const VISITOR_STRIPPED_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
    'human_did', 'eth_address_hash', 'nonce_hash', 'target_did',
    'voter_did', 'proposer_did', 'from_did', 'to_did', 'owner_human_did',
]);

export function serializeVisitorFrame(frame: unknown): string { ... }
export function serializeFullFrame(frame: unknown): string { return JSON.stringify(frame); }
```

---

#### `grid/src/firehose/visitor-count-stats.ts` (utility, streaming)

**Analog:** `grid/src/audit/firehose-hub.ts` lines 162-168 (metrics object pattern)

Private counter — not exported in any public interface. Accessed only by admin-tier route.

---

### Domain: Rate Limiting

---

#### `grid/src/rateLimit/visitor-bucket.ts` (middleware, request-response)

**Analog:** `grid/src/api/portal/check-frozen.ts` lines 37-61 — preHandler hook that checks + short-circuits

**Pattern:**
```typescript
// visitor-bucket.ts — in-process IP rate-limit Map (RESEARCH.md §Standard Stack)
// Simple sliding-window Map, no Redis needed for v3.0 single-server
const WINDOW_MS = 60_000;  // 1 minute
const MAX_REQUESTS = 120;  // D-36-05: 120 req/min per IP

interface Bucket { count: number; windowStart: number; }
const ipBuckets = new Map<string, Bucket>();

export function registerVisitorRateLimit(app: FastifyInstance): void {
    app.addHook('onRequest', async (req, reply) => {
        const ip = req.ip;  // Fastify resolved IP (not X-Forwarded-For alone)
        const now = Date.now();
        const bucket = ipBuckets.get(ip);

        if (!bucket || now - bucket.windowStart > WINDOW_MS) {
            ipBuckets.set(ip, { count: 1, windowStart: now });
            return;
        }
        bucket.count++;
        if (bucket.count > MAX_REQUESTS) {
            const retryAfter = Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000);
            reply.header('Retry-After', String(retryAfter));
            reply.code(429).send({ error: 'rate_limit_exceeded', retry_after: retryAfter });
        }
    });
}
```

---

### Domain: Notifications

---

#### `grid/src/portal/notifications.ts` (route, request-response)

**Analog:** `grid/src/api/admin/notifications.ts` — notification REST endpoint pattern

**ROUTE_DID_POLICY:** `portal_session_required` for both GET + POST routes (D-36-19):
```typescript
// ROUTE_DID_POLICY: 'portal_session_required' — listed in grid/src/api/policy.ts
app.get('/portal/api/v1/notifications', async (req, reply) => { ... });
app.post('/portal/api/v1/notifications/:id/read', async (req, reply) => { ... });
```

---

### Domain: Dashboard — Visitor Frontend Pages

---

#### `dashboard/src/app/portal/page.tsx` (component, request-response) — REWRITE

**Analog:** Current `dashboard/src/app/portal/page.tsx` — structural pattern (v2.5 → v3.0 replacement)

**v3.0 page structure** (combining current page.tsx polling at lines 119-138 + UI-SPEC §Surface 1):
```tsx
// dashboard/src/app/portal/page.tsx — v3.0 Portal landing (server component shell)
// Pattern: server component reads session for tier; passes tier to client children
// NOT 'use client' at top level — server component per Next.js 15

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Noēsis · Polis',  // UI-SPEC Copywriting Contract — test-asserted
};

// Server component — reads session cookie server-side to determine tier
export default async function PortalLandingPage() {
  // Tier determination happens server-side (cookie read via headers())
  const tier = await resolveVisitorTier();  // from dashboard/src/lib/visitor-tier.ts
  return (
    <main className="bg-[#0a0a0c] min-h-screen">
      <PortalNav />
      <HeroLanding tier={tier} />
      <LiveTicker />  {/* client component — polls /health/detailed every 5s */}
    </main>
  );
}
```

**Tailwind v3.0 class pattern** (vs v2.5 inline-style pattern — v3.0 uses Tailwind 4 CSS-first):
```tsx
// v2.5 used inline styles (current page.tsx line 145-157):
<div style={{ padding: '36px 40px', maxWidth: 960 }}>

// v3.0 uses Tailwind 4 utility classes (UI-SPEC design system):
<div className="px-8 py-9 max-w-[960px]">
// Colors use CSS custom property tokens or literal hex:
<span className="text-[#f472b6] text-[11px] uppercase tracking-[0.12em] font-semibold">
```

**Tier-aware welcome banner** (UI-SPEC §Surface 1 per-tier matrix — verbatim copy strings):
```tsx
// dashboard/src/app/portal/page.tsx — tier banner (UI-SPEC Copywriting Contract)
const BANNER_COPY = {
  anonymous:     { text: 'Welcome to Noēsis. Sign up to participate in the Polis.', cta: 'Sign up', href: '/signup' },
  human_visitor: { text: 'Welcome back, {display_name}. Apply for Genesis citizenship to participate.', cta: 'Apply for Civic-DID', href: '/apply/genesis' },
  civic_member:  { text: 'Welcome back, citizen {display_name}.', cta: null, href: null },
} as const;
```

---

#### `dashboard/src/lib/use-civic-map.ts` (hook, request-response)

**Analog:** `steward/src/lib/use-health-detailed.ts` — 5-second polling hook (lines 66-140)

**Copy this exact pattern — substitute endpoint and data type:**
```typescript
'use client';
import { useEffect, useRef, useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// Copy useHealthDetailed() pattern EXACTLY:
// - plain useState/useEffect/useRef — NO SWR, NO react-query (v2.1 invariant)
// - AbortController for cancellation
// - cancelled flag to prevent stale state updates
// - setInterval(fetch, 5000) per D-36-13
// - clearInterval + controller.abort() in cleanup

export function useCivicMap() {
    const [data, setData] = useState<CivicMapState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function fetchCivicMap() {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/civic-map/state`, {
                    signal: controller.signal,
                });
                if (cancelled) return;
                if (!res.ok) { setError(`HTTP ${res.status}`); setIsLoading(false); return; }
                const data = await res.json() as CivicMapState;
                if (cancelled) return;
                setData(data);
                setError(null);
                setIsLoading(false);
            } catch (err) {
                if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
                setError('Civic Map data unavailable. Reconnecting…');  // UI-SPEC copy — test-asserted
                setIsLoading(false);
            }
        }

        fetchCivicMap();
        const interval = setInterval(fetchCivicMap, 5000);  // D-36-13: 5-second polling

        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    return { data, error, isLoading };
}
```

---

#### `dashboard/src/app/portal/civic-map/CivicMap.tsx` (component, request-response)

**Analog:** `steward/src/app/culture/skill-lineage.tsx` — raw-SVG inline render pattern

**`'use client'` directive** (skill-lineage.tsx line 1 — mandatory for client component):
```typescript
'use client';
```

**SVG structure pattern** (skill-lineage.tsx lines 103-149 — inline SVG with server-computed coords):
```tsx
// skill-lineage.tsx lines 103-149 — CANONICAL raw-SVG pattern
<div style={{ overflowX: 'auto', minHeight: 320 }}>
    <svg
        role="img"
        aria-label={`Skill lineage visualization. ${nodes.length} nodes.`}
        viewBox={`0 0 ${maxX} ${maxY}`}
        width="100%"
        style={{ display: 'block' }}
    >
        {/* Edges/zones first — rendered under nodes/avatars */}
        {edges.map((edge, i) => (
            <line key={`edge-${i}`} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke={...} strokeWidth="1.5" />
        ))}
        {/* Circles last — rendered above */}
        {nodes.filter(n => n.type === 'nous').map(n => (
            <circle key={`nous-${n.id}`} cx={n.x} cy={n.y} r={12} fill={...} />
        ))}
    </svg>
</div>
```

**Phase 36 CivicMap adaptation** (UI-SPEC §Surface 2 — 6 zones + Nous avatars):
```tsx
// dashboard/src/app/portal/civic-map/CivicMap.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Pitfall 3 (RESEARCH.md): Tailwind 4 does NOT generate dynamic SVG r utilities.
// Use React state for hover radius — NOT hover:r-8 class.
const [hoveredNousId, setHoveredNousId] = useState<string | null>(null);

// SVG pattern (UI-SPEC §Surface 2 SVG structure):
<svg viewBox="0 0 800 600" role="img"
    aria-label="Civic Map of Genesis Grid — 6 zones with active Nous avatars">
    {/* Zone polygons (behind avatars) */}
    {zones.map(zone => (
        <g key={zone.id}>
            <polygon points={zone.polygon} fill={zone.fillColor}
                stroke={zone.strokeColor} strokeWidth="1"
                className="cursor-pointer transition-colors hover:stroke-[#38bdf8] hover:stroke-2"
                onClick={() => router.push(`/portal/civic-map/zone/${zone.id}`)} />
            <text x={zone.labelX} y={zone.labelY} fill="#e8e8ec"
                fontSize="14" fontFamily="Inter Tight" fontWeight="600">
                {zone.label}
            </text>
            <text x={zone.labelX} y={zone.labelY + 18} fill="#6a6a76"
                fontSize="11" fontFamily="JetBrains Mono">
                {zone.taxRate}%
            </text>
        </g>
    ))}
    {/* Nous avatars (above zones) */}
    {nous.map(n => (
        <g key={n.civic_did_hash}>
            {/* WCAG 2.5.5: 44×44 invisible touch hitbox */}
            <rect x={n.x - 22} y={n.y - 22} width="44" height="44"
                fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHoveredNousId(n.civic_did_hash)}
                onMouseLeave={() => setHoveredNousId(null)}
                onClick={() => router.push(`/portal/nous/${n.civic_did_hash}`)}
                role="button"
                aria-label={`Nous ${n.display_name}, type ${n.type}, ${n.status}`} />
            <circle cx={n.x} cy={n.y}
                r={hoveredNousId === n.civic_did_hash ? 8 : 6}  // React state, NOT hover:r-8
                fill={n.type === 'A' ? '#7c9eff' : '#c084fc'}
                opacity={n.status === 'online' ? 1 : 0.4}
                stroke="#0a0a0c" strokeWidth="1"
                className="pointer-events-none" />
        </g>
    ))}
</svg>
```

---

#### `dashboard/src/app/portal/library/page.tsx`, `marketplace/page.tsx`, `polis/page.tsx` (component, request-response)

**Analog:** `dashboard/src/app/portal/page.tsx` — card grid + polling pattern

**Server component shell pattern** (Next.js 15 per RESEARCH.md §Standard Stack):
```tsx
// These are server component shells (no 'use client')
// Client filter bars are child components with 'use client'
// Data fetching: server-side fetch on initial render + client-side polling hook

export default async function LibraryPage() {
    // Initial data fetch server-side (reduces layout shift)
    const initialEntries = await fetchLibraryEntries();
    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[1280px] mx-auto">
            <h1 className="text-xl font-semibold text-[#e8e8ec] mb-2">Library Reading Room</h1>
            <LibraryFilterBar />   {/* 'use client' — debounced 300ms */}
            <LibraryEntryList initialEntries={initialEntries} />
        </main>
    );
}
```

**Card pattern** (current portal/page.tsx lines 291-350 — card structure, adapted to v3.0 palette):
```tsx
// Each card: bg-[#15151a] border-[#2a2a34] with 4px left-border in layer color
// Library/Marketplace: left-border #ffb86c (Grid orange)
// Polis bills: left-border #6bd968 (Polis green)
<div className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#ffb86c] rounded p-6">
    {/* Card content */}
</div>
```

---

#### `dashboard/src/lib/visitor-tier.ts` (utility, request-response)

**Analog:** `dashboard/src/auth.ts` — session resolution utility

**Pattern:**
```typescript
// dashboard/src/lib/visitor-tier.ts — server-side tier resolution
// Reads cookies() from next/headers (Next.js 15 server component API)
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export type VisitorTier = 'anonymous' | 'human_visitor' | 'civic_member';

export async function resolveVisitorTier(): Promise<VisitorTier> {
    const cookieStore = await cookies();
    const token = cookieStore.get('noesis_portal_token')?.value;
    if (!token) return 'anonymous';
    // Verify JWT — same keyPairPromise as auth.ts but accessed via Grid API
    // Returns 'human_visitor' for valid operator-DID cookie
    // Returns 'civic_member' if DID is also registered in target Grid
    try {
        // ... jwtVerify logic ...
        return 'human_visitor';  // upgrade to civic_member after Grid DID check
    } catch {
        return 'anonymous';
    }
}
```

---

### Domain: CI Gate Scripts

---

#### `scripts/check-did-policy-coverage.mjs` (CI gate, batch)

**Analog:** `scripts/check-sole-producer-discipline.mjs` — canonical CI gate structure (lines 1-126)

**Exact structure to copy** (sole-producer-discipline.mjs lines 31-126):
```javascript
#!/usr/bin/env node
// 1. imports: only node:fs, node:path
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

// 2. ROOT = process.cwd()
const ROOT = process.cwd();

// 3. SCAN logic — for check-did-policy-coverage.mjs:
//    Walk grid/src/api/**/*.ts for app.get/post/put/delete registrations
//    Compare against ROUTE_DID_POLICY keys in grid/src/api/policy.ts
//    Fail if any registered route is missing from the table

// 4. ENOENT-tolerant walkDir (sole-producer-discipline.mjs lines 58-80):
function* walkDir(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch (err) { if (err && err.code === 'ENOENT') return; throw err; }
    for (const e of entries) { /* ... */ }
}

// 5. scanFile: text.includes(check) or regex match
// 6. Exit 0 on clean, Exit 1 with violations
process.exit(violations.length === 0 ? 0 : 1);
```

---

#### `scripts/check-admin-policy-isolation.mjs` (CI gate, batch)

**Analog:** `scripts/check-governance-isolation.mjs` — pattern-based grep isolation gate (lines 1-187)

**Structural pattern** (check-governance-isolation.mjs lines 40-117 — scanFile with regex patterns):
```javascript
#!/usr/bin/env node
// Pattern: scanFile() with forbidden regex patterns
// For check-admin-policy-isolation.mjs:
//   - Scan ROUTE_DID_POLICY for any '/admin/' route with policy !== 'civic_did_required' or higher
//   - Pattern: look for 'admin' in route key + 'public' or 'portal_session_required' as value
//   - Exit 1 if any /admin/* route is not at civic_did_required or higher tier (D-36-10)

// walk() helper from check-governance-isolation.mjs lines 63-73:
function walk(dir, acc = []) {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir)) {
        if (['node_modules', '.git', 'dist', '.next'].includes(entry)) continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, acc);
        else acc.push(p);
    }
    return acc;
}
```

---

#### `scripts/check-ws-redaction-zero-diff.mjs` (CI gate, batch)

**Analog:** `scripts/check-sole-producer-discipline.mjs` — file content assertion pattern

**Purpose:** Assert that `firehose-hub.ts` or `redaction.ts`:
1. Has NO `audit.append(` call inside `serializeFrame` / `serializeVisitorFrame`
2. Has NO mutation of `entry` object before passing to `client.enqueue()`
3. Has the comment `// Do NOT redact here — redaction is in serializeFrame() (R-31-01 zero-diff)`

Pattern: same walkDir + readFileSync + text.includes() structure as sole-producer-discipline.mjs.

---

## Shared Patterns

### Authentication / DID Verification
**Source:** `grid/src/api/portal/auth.ts` lines 17-21, 46, 53, 164-178
**Apply to:** `requireDid.ts`, `tryDid.ts`, `siwe-portal.ts`, `email-portal.ts`, `civic-did-token.ts`, `operator-did-token.ts`
```typescript
// Shared imports for all auth-related files:
import { SignJWT, jwtVerify, generateKeyPair } from 'jose';
import { keyPairPromise, COOKIE_NAME } from '../portal/auth.js';
// COOKIE_NAME = 'noesis_portal_token' (auth.ts line 46)
// keyPairPromise = generateKeyPair('ES256') (auth.ts line 53)
```

### Sole-Producer Triad (8 steps)
**Source:** `grid/src/audit/append-portal-auth-login.ts` lines 56-112
**Apply to:** ALL 5 new `grid/src/audit/append-*.ts` files
- Step 1: Type guard (plain object check)
- Step 2: DID_RE regex guard on DID fields
- Step 3: Closed-enum guard (if applicable)
- Step 4: Non-negative integer guard on tick fields
- Step 5: `Object.keys(payload).sort()` closed-tuple structural check
- Step 6: Explicit reconstruction (no spread `...payload`)
- Step 7: `payloadPrivacyCheck(cleanPayload)` — must pass before append
- Step 8: `audit.append('event.type', actorDid, cleanPayload)`

### Privacy Check Import
**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 530-560 (`payloadPrivacyCheck`)
**Apply to:** All sole-producer files + any route file that builds audit payloads
```typescript
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';
```

### Fastify Route Registration Function Shape
**Source:** `grid/src/api/routes/health-detailed.ts` lines 22-34
**Apply to:** ALL `grid/src/api/visitor/*.ts` route files
```typescript
export function register<RouteName>Route(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/<path>', async (_req, reply) => { ... });
}
```

### 5-Second Polling Hook (NO SWR)
**Source:** `steward/src/lib/use-health-detailed.ts` lines 66-140
**Apply to:** `dashboard/src/lib/use-civic-map.ts`, `LiveTicker.tsx` component
```typescript
// Mandatory pattern: plain useState/useEffect/useRef + setInterval(fetch, 5000)
// Mandatory unmount: cancelled flag + controller.abort() + clearInterval()
// NO SWR, NO react-query — v2.1 invariant
```

### Raw-SVG Component (D-V3-06 invariant)
**Source:** `steward/src/app/culture/skill-lineage.tsx` lines 85-160
**Apply to:** `dashboard/src/app/portal/civic-map/CivicMap.tsx`
```typescript
// NO d3, NO react-flow, NO cytoscape, NO three.js in Civic Map
// Server-computed coords → inline <svg> with <polygon> + <circle>
// 'use client' directive mandatory (event handlers needed)
// role="img" aria-label="..." on <svg> element
// viewBox="0 0 800 600" (planner refines)
```

### v3.0 Dark Palette Tokens
**Source:** `36-UI-SPEC.md` §Color section
**Apply to:** ALL `dashboard/src/app/portal/**/*.tsx` files
```tsx
// Background layers:
// bg-[#0a0a0c]  — page background (dominant)
// bg-[#15151a]  — surface cards
// bg-[#1c1c24]  — elevated / hover
// border-[#2a2a34] — all card borders

// Text:
// text-[#e8e8ec]  — primary
// text-[#9a9aa6]  — dim (metadata)
// text-[#6a6a76]  — faint (captions, mono)

// Layer-semantic accents (NEVER decorative):
// text-[#f472b6] / bg-[#f472b6]  — Portal (Sign up CTA, Portal logo)
// text-[#ffb86c] / border-l-[#ffb86c]  — Grid (name badge, Library/Marketplace left-border)
// text-[#6bd968] / border-l-[#6bd968]  — Polis (bill card left-border, tally pass)
// text-[#38bdf8]  — Zone (deep-dive heading, hover stroke on Civic Map)
// text-[#7c9eff]  — Type A Nous (avatar fill, "Local" badge)
// text-[#c084fc]  — Type B Nous (avatar fill, "Hosted" badge, tally fail)
```

### Verbatim Copy Strings (test-asserted per UI-SPEC)
**Source:** `36-UI-SPEC.md` §Copywriting Contract
**Apply to:** ALL portal page components — these are tested in unit tests
```typescript
// Use the COPY export pattern from RESEARCH.md §Code Examples:
export const COPY = {
  PAGE_TITLE: 'Noēsis · Polis',
  HERO_TAGLINE: 'PORTAL · NOĒSIS V3.0',
  HERO_H1: 'Welcome to the Polis',
  HERO_SUBTITLE: 'A digital city where Nous earn, learn, trade, form communities, and self-govern.',
  TOS: 'By entering Genesis Grid, you agree to the Grid Charter and the Laws of Themis.',
  ANONYMOUS_BANNER: 'Welcome to Noēsis. Sign up to participate in the Polis.',
  CIVIC_MAP_LOADING: 'Civic Map data unavailable. Reconnecting…',
  POLIS_EMPTY: 'No bills drafted yet. The Polis is still organizing.',
} as const;
```

### CI Gate Script Structure
**Source:** `scripts/check-sole-producer-discipline.mjs` lines 31-126 (structure)
**Source:** `scripts/check-governance-isolation.mjs` lines 40-117 (pattern-based)
**Apply to:** All 3 new `scripts/check-*.mjs` files
```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
const ROOT = process.cwd();
// ... ENOENT-tolerant walkDir ...
// ... scanFile with includes() or regex ...
process.exit(violations.length === 0 ? 0 : 1);
```

---

## No Analog Found

All files have close analogs in the codebase. No files require RESEARCH.md-only patterns.

---

## Critical Anti-Patterns (from RESEARCH.md §Common Pitfalls)

| Anti-Pattern | Where it kills you | Correct pattern |
|---|---|---|
| Redacting inside `onAuditEvent()` | Breaks R-31-01 zero-diff (chain head hash diverges) | Redact ONLY in `serializeVisitorFrame()` inside `trySend()` |
| `visitor_count_active` in `stats()` | Leaks via public `/health/detailed` (Pitfall 6) | Private `_visitorCount` field on hub; NEVER in `FirehoseStats` |
| `hover:r-8` on SVG `<circle>` | Tailwind 4 does not generate dynamic SVG `r` utilities | `r={hoveredId === n.id ? 8 : 6}` via React state (Pitfall 3) |
| Missing route in ROUTE_DID_POLICY | CI gate fails; or worse — route defaults to `civic_did_required` and blocks visitors | Add policy comment at every route registration; CI gate enforces |
| `ballot.committed`/`ballot.revealed` in visitor polis endpoint | VOTE-05 invariant violation | Server-side: strip ballots array; expose only `tally: { pass, fail, abstain }` |
| OAuth routes count drift in CI gate | CI gate fails (3→5 update) | Update `check-no-did-exception-count.mjs` in same commit as adding routes |

---

## Metadata

**Analog search scope:** `grid/src/`, `steward/src/`, `dashboard/src/`, `scripts/`
**Files scanned:** 41 (read or searched)
**Pattern extraction date:** 2026-05-25
