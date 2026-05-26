# Phase 37: DID Registry - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/civic-registry/civic-did-store.ts` | service | CRUD | `grid/src/registry/registry.ts` | role-match |
| `grid/src/civic-registry/business-did-store.ts` | service | CRUD | `grid/src/registry/registry.ts` | role-match |
| `grid/src/civic-registry/vc-builder.ts` | utility | transform | `grid/src/api/portal/auth.ts` (keyPairPromise + SignJWT) | data-flow-match |
| `grid/src/civic-registry/government-session.ts` | utility | request-response | `grid/src/api/portal/auth.ts` (jwtVerify pattern) | data-flow-match |
| `grid/src/civic-registry/types.ts` | model | — | `grid/src/api/preHandlers/types.ts` | role-match |
| `grid/src/api/routes/registry.ts` | route | request-response | `grid/src/api/governance/routes.ts` | exact |
| `grid/src/api/policy.ts` (modify) | config | — | `grid/src/api/policy.ts` | self |
| `grid/src/api/server.ts` (modify) | middleware | request-response | `grid/src/api/server.ts` (onRequest hook) | self |
| `grid/src/db/schema.ts` (modify) | migration | CRUD | `grid/src/db/schema.ts` (migrations v3–v22) | self |
| `grid/src/audit/append-registry-civic-did-issued.ts` | utility | event-driven | `grid/src/audit/append-portal-did-issued.ts` | exact |
| `grid/src/audit/append-registry-civic-did-revoked.ts` | utility | event-driven | `grid/src/audit/append-portal-did-issued.ts` | exact |
| `grid/src/audit/append-registry-business-did-registered.ts` | utility | event-driven | `grid/src/audit/append-grid-recognition-granted.ts` | exact |
| `grid/src/audit/append-registry-business-did-dissolved.ts` | utility | event-driven | `grid/src/audit/append-grid-recognition-granted.ts` | exact |
| `scripts/check-civic-did-issuance-path.mjs` | CI gate | — | `scripts/check-sole-producer-discipline.mjs` | role-match |

---

## Pattern Assignments

### `grid/src/audit/append-registry-civic-did-issued.ts` (utility, event-driven)

**Analog:** `grid/src/audit/append-portal-did-issued.ts`

**Imports pattern** (lines 22–25):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
// NOTE: do NOT import DID_RE — it only covers did:noesis:*
// Define local CIVIC_DID_RE and EXISTENCE_DID_RE instead (Pitfall 3 / Pattern 2)
```

**DID regex pattern** (local constants, no import):
```typescript
// Source: RESEARCH.md Pattern 2 — derived from append-portal-notification-dispatched.ts:39
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const EXISTENCE_DID_RE = /^did:noesis:nous:[a-z0-9_:\-]+$/i;
```

**Interface + EXPECTED_KEYS pattern** (lines 27–35 of analog):
```typescript
// Source: grid/src/audit/append-portal-did-issued.ts lines 27-35
export interface RegistryCivicDidIssuedPayload {
    readonly civic_did: string;       // CIVIC_DID_RE
    readonly existence_did: string;   // EXISTENCE_DID_RE
    readonly grid_name: string;       // non-empty string
    readonly issued_at_tick: number;  // non-negative integer
}

const EXPECTED_KEYS = ['civic_did', 'existence_did', 'grid_name', 'issued_at_tick'] as const;
```

**Full 8-step discipline** (lines 43–99 of analog — copy verbatim, adjust field names):
```typescript
// Source: grid/src/audit/append-portal-did-issued.ts lines 43-99
export function appendRegistryCivicDidIssued(
    audit: AuditChain,
    payload: RegistryCivicDidIssuedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistryCivicDidIssued: payload must be a plain object`);
    }
    // 2. Regex guard: civic_did.
    if (typeof payload.civic_did !== 'string' || !CIVIC_DID_RE.test(payload.civic_did)) {
        throw new TypeError(`appendRegistryCivicDidIssued: civic_did must match CIVIC_DID_RE`);
    }
    // 2b. Regex guard: existence_did.
    if (typeof payload.existence_did !== 'string' || !EXISTENCE_DID_RE.test(payload.existence_did)) {
        throw new TypeError(`appendRegistryCivicDidIssued: existence_did must match EXISTENCE_DID_RE`);
    }
    // 3. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendRegistryCivicDidIssued: grid_name must be non-empty`);
    }
    // 4. Non-negative integer guard: issued_at_tick.
    if (!Number.isInteger(payload.issued_at_tick) || payload.issued_at_tick < 0) {
        throw new TypeError(`appendRegistryCivicDidIssued: issued_at_tick must be non-negative integer`);
    }
    // 5. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`
        );
    }
    // 6. Explicit reconstruction — no spread.
    const cleanPayload = {
        civic_did: payload.civic_did,
        existence_did: payload.existence_did,
        grid_name: payload.grid_name,
        issued_at_tick: payload.issued_at_tick,
    };
    // 7. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendRegistryCivicDidIssued: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`
        );
    }
    // 8. Commit to chain.
    return audit.append('registry.civic_did_issued', payload.civic_did, cleanPayload);
}
```

---

### `grid/src/audit/append-registry-civic-did-revoked.ts` (utility, event-driven)

**Analog:** `grid/src/audit/append-portal-did-issued.ts`

**Key difference from issued:** field `court_conviction_ref_hash` uses a HEX64_RE (SHA-256). Plaintext ref never enters audit payload (same discipline as sanction_reasons in append-operator-*.ts).

**Interface + EXPECTED_KEYS:**
```typescript
// Source: RESEARCH.md Code Examples section — civic_did_revoked
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export interface RegistryCivicDidRevokedPayload {
    readonly civic_did: string;                    // CIVIC_DID_RE
    readonly court_conviction_ref_hash: string;    // HEX64_RE — SHA-256 of plaintext ref
    readonly grid_name: string;                    // non-empty string
    readonly revoked_at_tick: number;              // non-negative integer
}

const EXPECTED_KEYS = ['civic_did', 'court_conviction_ref_hash', 'grid_name', 'revoked_at_tick'] as const;
```

**All 8 steps same structure as above** — adapt step 2 for `court_conviction_ref_hash` using HEX64_RE, adapt step 8: `audit.append('registry.civic_did_revoked', payload.civic_did, cleanPayload)`.

---

### `grid/src/audit/append-registry-business-did-registered.ts` (utility, event-driven)

**Analog:** `grid/src/audit/append-grid-recognition-granted.ts`

**Key notes:** business_name and category are NOT in audit payload (privacy discipline — DB only). Two DID regex guards needed: BIZ_DID_RE and CIVIC_DID_RE.

**Interface + EXPECTED_KEYS:**
```typescript
const BIZ_DID_RE = /^did:biz:noesis:[a-z0-9_:\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export interface RegistryBusinessDidRegisteredPayload {
    readonly business_did: string;        // BIZ_DID_RE
    readonly civic_did: string;           // CIVIC_DID_RE — owner
    readonly grid_name: string;           // non-empty string
    readonly registered_at_tick: number;  // non-negative integer
}

const EXPECTED_KEYS = ['business_did', 'civic_did', 'grid_name', 'registered_at_tick'] as const;
```

**Step 8:** `audit.append('registry.business_did_registered', payload.business_did, cleanPayload)`.

---

### `grid/src/audit/append-registry-business-did-dissolved.ts` (utility, event-driven)

**Analog:** `grid/src/audit/append-grid-recognition-granted.ts`

**Interface + EXPECTED_KEYS:**
```typescript
const BIZ_DID_RE = /^did:biz:noesis:[a-z0-9_:\-]+$/i;
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;

export interface RegistryBusinessDidDissolvedPayload {
    readonly business_did: string;       // BIZ_DID_RE
    readonly civic_did: string;          // CIVIC_DID_RE — owner
    readonly grid_name: string;          // non-empty string
    readonly dissolved_at_tick: number;  // non-negative integer
}

const EXPECTED_KEYS = ['business_did', 'civic_did', 'dissolved_at_tick', 'grid_name'] as const;
```

**Step 8:** `audit.append('registry.business_did_dissolved', payload.business_did, cleanPayload)`.

---

### `grid/src/api/routes/registry.ts` (route, request-response)

**Analog:** `grid/src/api/governance/routes.ts`

**Imports pattern** (lines 31–48 of analog):
```typescript
// Source: grid/src/api/governance/routes.ts lines 31-48
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { keyPairPromise } from '../portal/auth.js';
import { jwtVerify } from 'jose';
import { CompactSign } from 'jose';
import { randomUUID } from 'node:crypto';
import { appendRegistryCivicDidIssued } from '../../audit/append-registry-civic-did-issued.js';
import { appendRegistryCivicDidRevoked } from '../../audit/append-registry-civic-did-revoked.js';
import { appendRegistryBusinessDidRegistered } from '../../audit/append-registry-business-did-registered.js';
// (append-registry-business-did-dissolved.ts imported similarly)
```

**Registration function pattern** (lines 64–67 of analog):
```typescript
// Source: grid/src/api/governance/routes.ts lines 64-67
export async function registerRegistryRoutes(
    app: FastifyInstance,
    services: GridServices,
): Promise<void> {
```

**POST handler with validation pattern** (lines 73–182 of analog):
```typescript
// Source: grid/src/api/governance/routes.ts lines 73-182
app.post<{ Body: { existence_did?: unknown; public_key?: unknown; civic_oath?: unknown; existence_key_signature?: unknown } }>(
    '/api/v1/registry/civic-did/request',
    async (req, reply) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        // 1. Extract + validate body fields
        const existenceDid = body['existence_did'];
        if (typeof existenceDid !== 'string') {
            return reply.code(400).send({ error: 'invalid_existence_did' });
        }
        // 2. Validate, sign, insert, audit
        // 3. Return 201
        return reply.code(201).send({ civic_did, credential });
    },
);
```

**GET handler with Cache-Control pattern** (from RESEARCH.md Code Examples + civic-map.ts pattern):
```typescript
// Source: RESEARCH.md Code Examples — Cache-Control
// Source: grid/src/api/routes/civic-map.ts line 118 (simple GET handler shape)
app.get<{ Params: { did: string } }>(
    '/api/v1/registry/civic-did/:did',
    async (req, reply) => {
        const record = await civicDidStore.get(services.gridName, req.params.did);
        if (!record) return reply.code(404).send({ error: 'not_found' });
        reply.header('Cache-Control', 'max-age=60');
        return { status: record.status, credential: record.credentialJson };
    },
);
```

**Error handling pattern** (lines 159–181 of analog):
```typescript
// Source: grid/src/api/governance/routes.ts lines 159-181
try {
    // ... service call ...
    return reply.code(201).send({ ... });
} catch (err) {
    if (err instanceof SomeSpecificError) {
        return reply.code(err.httpStatus).send({ error: err.code });
    }
    throw err; // re-throw unexpected errors — Fastify default error handler catches
}
```

---

### `grid/src/civic-registry/vc-builder.ts` (utility, transform)

**Analog:** `grid/src/api/portal/auth.ts` (ES256 signing block)

**Key signing pattern** (lines 166–177 of analog):
```typescript
// Source: grid/src/api/portal/auth.ts lines 166-177
import { CompactSign } from 'jose';
import { keyPairPromise } from '../api/portal/auth.js';
import { randomUUID } from 'node:crypto';

const { privateKey } = await keyPairPromise;
const jws = await new CompactSign(
    new TextEncoder().encode(JSON.stringify(vcBody)),
)
    .setProtectedHeader({ alg: 'ES256' })
    .sign(privateKey);
```

**W3C VC v2.0 field names** (RESEARCH.md Pattern 1 — use `validFrom`, NOT `issuanceDate`):
```typescript
// Use validFrom (VC v2.0), NOT issuanceDate (VC v1.x deprecated)
const vcBody = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    id: `urn:noesis:vc:${randomUUID()}`,
    type: ['VerifiableCredential', 'CivicDIDCredential'],
    issuer: 'did:grid:noesis:genesis-registry',
    validFrom: new Date().toISOString(),   // v2.0 field — NOT issuanceDate
    credentialSubject: { id: civicDid, ... },
};
```

---

### `grid/src/civic-registry/government-session.ts` (utility, request-response)

**Analog:** `grid/src/api/portal/auth.ts` (jwtVerify + GET /me pattern)

**jwtVerify pattern** (lines 362–365 of analog):
```typescript
// Source: grid/src/api/portal/auth.ts lines 362-365
import { jwtVerify } from 'jose';
import { keyPairPromise } from '../api/portal/auth.js';

const { publicKey } = await keyPairPromise;
const { payload } = await jwtVerify(token, publicKey);
```

**Issuer claim check pattern** (adapted from auth.ts + RESEARCH.md Pattern 6):
```typescript
// Source: RESEARCH.md Pattern 6 — government session stub
export const GOV_SESSION_ISSUER_DID = 'did:gov:noesis:genesis-polis';

export async function verifyGovernmentSession(
    authHeader: string | undefined,
): Promise<{ ok: true; courtConvictionRef: string } | { ok: false; reason: string }> {
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, reason: 'court_order_required' };
    }
    const token = authHeader.substring('Bearer '.length);
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        if (payload.iss !== GOV_SESSION_ISSUER_DID) {
            return { ok: false, reason: 'court_order_required' };
        }
        const ref = payload['court_conviction_ref'];
        if (typeof ref !== 'string' || ref.length === 0) {
            return { ok: false, reason: 'court_conviction_ref_required' };
        }
        return { ok: true, courtConvictionRef: ref };
    } catch {
        return { ok: false, reason: 'court_order_required' };
    }
}
```

---

### `grid/src/api/policy.ts` (modify — add 5 entries)

**Analog:** `grid/src/api/policy.ts` itself (lines 26–179)

**Addition pattern** — append after the existing `Phase 36` block comment:
```typescript
// Source: grid/src/api/policy.ts lines 57-63 — Phase 36 write routes pattern
// Phase 37 additions (REG-01..05):
'GET /api/v1/registry/civic-did/:did':         'public',              // REG-05
'GET /api/v1/registry/business-did/:did':      'public',              // REG-05
'POST /api/v1/registry/civic-did/request':     'public',              // REG-01 (existence-key signed)
'POST /api/v1/registry/civic-did/:did/revoke': 'government_only',     // REG-04
'POST /api/v1/registry/business-did/register': 'civic_did_required',  // REG-03
```

**Critical:** `government_only` has no enforcement branch in the `onRequest` hook yet (Pitfall 1 from RESEARCH.md). The `onRequest` hook in `server.ts` lines 323–347 must gain a new `if (policy === 'government_only')` branch before the generic `requireDid` fallthrough.

---

### `grid/src/api/server.ts` (modify — add `government_only` branch)

**Analog:** `grid/src/api/server.ts` itself (lines 323–347)

**Existing policy hook** (lines 323–347):
```typescript
// Source: grid/src/api/server.ts lines 323-347
void app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'OPTIONS') return;
    const routePath = (req as { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0];
    const policy = lookupPolicy(req.method, routePath);
    if (policy === 'public') {
        const ctx = await tryDid(req, { didStore: services.didStore });
        req.didContext = ctx;
        return;
    }
    if (policy === 'portal_session_required') {
        const ctx = await requirePortalSession(req, reply, { didStore: services.didStore });
        if (!ctx) return;
        req.didContext = ctx;
        return;
    }
    // Falls through to civic_did_required for government_only, police_only etc.
    const ctx = await requireDid(req, reply, { didStore: services.didStore });
    if (!ctx) return;
    req.didContext = ctx;
});
```

**New branch to add** (between `portal_session_required` and the generic fallthrough):
```typescript
// Source: RESEARCH.md Pitfall 1 — government_only enforcement gap
// Add this block from grid/src/civic-registry/government-session.ts import:
if (policy === 'government_only') {
    const result = await verifyGovernmentSession(req.headers.authorization);
    if (!result.ok) {
        return reply.code(403).send({ error: result.reason });
    }
    req.didContext = { did: GOV_SESSION_ISSUER_DID, tier: 'civic_member' };
    return;
}
```

---

### `grid/src/db/schema.ts` (modify — add migrations v23 + v24)

**Analog:** `grid/src/db/schema.ts` itself (lines 14–100 — MIGRATIONS array pattern)

**Migration entry pattern** (lines 28–50):
```typescript
// Source: grid/src/db/schema.ts lines 28-50 — standard Migration shape
{
    version: 23,
    name: 'create_civic_did_registry',
    up: `
        CREATE TABLE IF NOT EXISTS civic_did_registry (
            grid_name           VARCHAR(63)  NOT NULL,
            civic_did           VARCHAR(255) NOT NULL,
            existence_did       VARCHAR(255) NOT NULL,
            credential_json     JSON         NOT NULL,
            status              ENUM('active','revoked') NOT NULL DEFAULT 'active',
            issued_at_tick      INT UNSIGNED NOT NULL,
            revoked_at_tick     INT UNSIGNED,
            court_conviction_ref VARCHAR(255),
            created_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, civic_did),
            UNIQUE KEY uq_existence_did (grid_name, existence_did),
            INDEX idx_status (grid_name, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS civic_did_registry`,
},
{
    version: 24,
    name: 'create_business_did_registry',
    up: `
        CREATE TABLE IF NOT EXISTS business_did_registry (
            grid_name          VARCHAR(63)  NOT NULL,
            business_did       VARCHAR(255) NOT NULL,
            civic_did          VARCHAR(255) NOT NULL,
            business_name      VARCHAR(255) NOT NULL,
            category           VARCHAR(127) NOT NULL,
            credential_json    JSON         NOT NULL,
            status             ENUM('active','dissolved') NOT NULL DEFAULT 'active',
            issued_at_tick     INT UNSIGNED NOT NULL,
            dissolved_at_tick  INT UNSIGNED,
            bios_cost_paid     INT UNSIGNED NOT NULL,
            created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (grid_name, business_did),
            INDEX idx_civic_did (grid_name, civic_did),
            INDEX idx_status (grid_name, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS business_did_registry`,
},
```

---

### `grid/src/audit/broadcast-allowlist.ts` (modify — +4 events)

**Analog:** `grid/src/audit/broadcast-allowlist.ts` itself (lines 224–238 — Phase 36 additions)

**Addition pattern** — append after position 60 (`grid.recognition_revoked`), update header comment count from 60 → 64:
```typescript
// Source: grid/src/audit/broadcast-allowlist.ts lines 224-238
// Phase 37 (REG-06) — DID Registry lifecycle events. Allowlist 60 → 64.
// registry.civic_did_issued: closed 4-key {civic_did, existence_did, grid_name, issued_at_tick}.
//   Emitted ONLY via appendRegistryCivicDidIssued (grid/src/audit/append-registry-civic-did-issued.ts).
// ...
'registry.civic_did_issued',       // (61) {civic_did, existence_did, grid_name, issued_at_tick}
'registry.civic_did_revoked',      // (62) {civic_did, court_conviction_ref_hash, grid_name, revoked_at_tick}
'registry.business_did_registered', // (63) {business_did, civic_did, grid_name, registered_at_tick}
'registry.business_did_dissolved',  // (64) {business_did, civic_did, dissolved_at_tick, grid_name}
```

---

### `grid/src/api/preHandlers/tryDid.ts` (modify — expand DID_RE to accept civic DIDs)

**Analog:** `grid/src/api/preHandlers/tryDid.ts` itself (lines 29–76)

**Existing DID check** (lines 41–43):
```typescript
// Source: grid/src/api/preHandlers/tryDid.ts lines 41-43
const sub = payload.sub;
if (typeof sub === 'string' && sub.length > 0 && DID_RE.test(sub)) {
    // DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i — does NOT match did:civic:noesis:*
```

**Required change** (RESEARCH.md Pitfall 3):
```typescript
// Replace DID_RE.test(sub) with ANY_DID_RE to accept did:civic:noesis:* subjects:
const ANY_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i;
if (typeof sub === 'string' && sub.length > 0 && ANY_DID_RE.test(sub)) {
// Also update the cookie token check at line 66 similarly (for future portal tokens with civic DIDs)
```

---

### `scripts/check-civic-did-issuance-path.mjs` (new CI gate)

**Analog:** `scripts/check-sole-producer-discipline.mjs`

**Script structure pattern** (lines 1–35 of analog):
```javascript
#!/usr/bin/env node
/**
 * scripts/check-civic-did-issuance-path.mjs
 *
 * D-V3-33 Portal-gating invariant CI gate.
 * Verifies that appendRegistryCivicDidIssued is only imported
 * by approved registry service files — never from portal/auth.ts,
 * operator/*, admin/*, or any non-registry code path.
 *
 * Exit 0: approved-only importers.
 * Exit 1: violation found.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const APPROVED_IMPORTERS = new Set([
    'grid/src/civic-registry/civic-did-store.ts',
    'grid/src/api/routes/registry.ts',
]);
```

**File walk + grep pattern** (lines 58–94 of analog — reuse walkDir/scanFile structure):
```javascript
// Source: scripts/check-sole-producer-discipline.mjs lines 58-94
// Scan all .ts files under grid/src/ for the import string
// Flag any file that imports 'append-registry-civic-did-issued' and is NOT in APPROVED_IMPORTERS
const IMPORT_PATTERN = 'append-registry-civic-did-issued';
```

**Exit-code pattern** (lines 106–125 of analog):
```javascript
// Source: scripts/check-sole-producer-discipline.mjs lines 106-125
if (violations.length === 0) {
    console.log(`[check-civic-did-issuance-path] OK — no unauthorized importers found.`);
    process.exit(0);
}
console.error('[check-civic-did-issuance-path] VIOLATIONS FOUND:');
for (const v of violations) { console.error(`  ${v}`); }
process.exit(1);
```

---

## Shared Patterns

### ES256 Key Pair (keyPairPromise)
**Source:** `grid/src/api/portal/auth.ts` line 54
**Apply to:** `grid/src/civic-registry/vc-builder.ts`, `grid/src/civic-registry/government-session.ts`
```typescript
// Source: grid/src/api/portal/auth.ts line 54
export const keyPairPromise = generateKeyPair('ES256');
// Usage in consumers:
const { privateKey } = await keyPairPromise;  // for signing
const { publicKey } = await keyPairPromise;   // for verifying
```

### Sole-Producer Triad (3 mandatory lines)
**Source:** `scripts/check-sole-producer-discipline.mjs` lines 52–56
**Apply to:** All 4 `grid/src/audit/append-registry-*.ts` files
```typescript
// Required by CI gate — all 3 must appear literally in the file:
Object.keys(payload).sort()  // closed-tuple structural check (step 5)
payloadPrivacyCheck           // privacy gate (step 7)
audit.append(                 // chain commit (step 8)
```

### Services availability check pattern
**Source:** `grid/src/api/portal/auth.ts` lines 79–81
**Apply to:** `grid/src/api/routes/registry.ts` handlers
```typescript
// Source: grid/src/api/portal/auth.ts lines 79-81
if (!services.humanRegistry) {
    return reply.status(503).send({ error: 'human_registry_unavailable' });
}
// Adapt: if (!services.civicRegistryStore) { return reply.code(503).send({...}) }
```

### Default ROUTE_DID_POLICY entry format
**Source:** `grid/src/api/policy.ts` lines 26–179
**Apply to:** `grid/src/api/policy.ts` modification
```typescript
// Key format: 'METHOD /path/with/:params': 'policy_value'
// Source: grid/src/api/policy.ts line 26
export const ROUTE_DID_POLICY: Readonly<Record<string, RouteDIDPolicy>> = Object.freeze({
    'GET /api/v1/registry/civic-did/:did': 'public',
    // ...
} as Record<string, RouteDIDPolicy>);
```

### allowlist count guard in test file
**Source:** `grid/src/audit/broadcast-allowlist.ts` — existing test for count at 60
**Apply to:** `grid/test/audit/broadcast-allowlist.test.ts` (modify expected count 60 → 64)

---

## No Analog Found

All files have analogs in the codebase. No files require RESEARCH.md-only pattern guidance.

---

## Critical Anti-Patterns (from RESEARCH.md)

| Anti-Pattern | Correct Pattern | Source |
|---|---|---|
| `DID_RE.test(civicDid)` in sole-producer | Use local `CIVIC_DID_RE` | `append-portal-notification-dispatched.ts` PORTAL_DID_RE pattern |
| `issuanceDate` in W3C VC body | Use `validFrom` (VC v2.0) | W3C Recommendation 2025-05-15 |
| `{ ...payload }` in sole-producer | Explicit reconstruction per step 6 | `append-portal-did-issued.ts` lines 83–87 |
| Register `government_only` routes without adding enforcement branch | Add `if (policy === 'government_only')` block to `server.ts` onRequest hook before generic `requireDid` | `server.ts` lines 342–346 |
| Place `append-registry-*.ts` in `grid/src/civic-registry/` | Place in `grid/src/audit/` to stay in SCAN_DIRS | `scripts/check-sole-producer-discipline.mjs` lines 36–47 |

---

## Metadata

**Analog search scope:** `grid/src/audit/`, `grid/src/api/`, `scripts/`, `grid/src/db/`
**Files scanned:** 14 analog files read
**Pattern extraction date:** 2026-05-26
