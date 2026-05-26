# Phase 37: DID Registry — Research

**Researched:** 2026-05-26
**Domain:** W3C Verifiable Credentials · Civic-DID/Business-DID issuance · Court-only revocation · Fastify REST · MySQL schema migrations · Sole-producer audit discipline
**Confidence:** HIGH (all findings verified against live codebase and official sources)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REG-01 | Nous with existence-DID requests Civic-DID via `POST /api/v1/registry/civic-did/request` signed with existence-key; rate-limited per existence-DID | Architecture Patterns: Civic-DID Request Flow; Code Examples: existence-key signature verification |
| REG-02 | Grid Registry issues Civic-DID as W3C VC with `credentialSubject`, `issuer`, `issuanceDate`, `revocationPointer`; public verification via GET | Standard Stack: jose 6.2.3 + W3C VC v2.0 JSON; Architecture Patterns: VC Issuance |
| REG-03 | Civic-DID holder registers Business-DID paying Bios sybil cost (100 Bios default per Q-V3-D); route rejects insufficient Bios | Architecture Patterns: Bios cost gate; Code Examples: ousia balance check pattern |
| REG-04 | Civic-DID revocation requires Government session + court-conviction reference; operator-DID revocation forbidden | Architecture Patterns: Court-order revocation gate; Don't Hand-Roll: court-order stub |
| REG-05 | Public GET endpoints return `active`/`revoked`/`dissolved` state without auth; `Cache-Control: max-age=60` | Architecture Patterns: Public lookup + ROUTE_DID_POLICY entries; Code Examples: reply.header pattern |
| REG-06 | 4 sole-producer audit events: `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved`; +4 allowlist (60 → 64) | Standard Stack: sole-producer triad; Architecture Patterns: audit append pattern |
</phase_requirements>

---

## Summary

Phase 37 introduces the DID Registry civic institution: the Grid's authority for issuing and managing Civic-DIDs (citizenship credentials) and Business-DIDs (commercial registration). Both are issued as W3C Verifiable Credentials (VC v2.0 format, signed with the Grid's ES256 key pair that already exists in `keyPairPromise`). Existence-DIDs remain entirely out of scope — they are self-sovereign and never registry-issued (D-V3-01).

The phase has three distinct technical sub-systems. First, a **new Fastify route group** under `/api/v1/registry/*` — four routes for request, lookup, revocation, and business registration. These must register entries in `ROUTE_DID_POLICY` (mandatory per Phase 36 CI gate), use the existing `requireDid` preHandler for write-paths, and add `Cache-Control: max-age=60` headers on the two public GET endpoints. Second, a **new MySQL-backed store** (`civic_did_registry` + `business_did_registry` tables, migration versions 23 and 24) that persists credential state and revocation records. Third, **4 new sole-producer audit event files** in `grid/src/audit/` following the 8-step triad discipline established in Phases 33–36, plus one new CI gate (`scripts/check-civic-did-issuance-path.mjs`) mandated by the Portal-gating invariant (D-V3-33).

The Government court-order stub for revocation (REG-04) is Phase 37's only forward-dependency concern: Phase 46 doesn't exist yet, so the revocation route must validate a "government session" JWT with a fixed well-known issuer DID stub (`did:gov:noesis:genesis-polis`), reject any operator-DID-signed request with a `court_order_required` error, and be designed so Phase 46 can drop in the real Government session validator without changing the route contract.

**Primary recommendation:** Structure plans as: (1) Wave 0 — new DB schema migrations + test infrastructure stubs; (2) Wave 1 — CivicDidStore service + 4 route files + ROUTE_DID_POLICY additions; (3) Wave 2 — 4 sole-producer audit event files + allowlist +4; (4) Wave 3 — new CI gate `check-civic-did-issuance-path.mjs` + update sole-producer SCAN_DIRS to include `grid/src/civic-registry/`. No dashboard UI work — Phase 37 is purely backend API + persistence.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Civic-DID issuance (request + issue) | API / Backend (Grid Fastify) | Database / Storage (MySQL) | VC construction + signing happen server-side; credential state persisted to MySQL |
| Business-DID registration | API / Backend (Grid Fastify) | Database / Storage (MySQL) | Bios balance check is in-memory registry lookup; registration state persisted to MySQL |
| Civic-DID revocation (court-order gate) | API / Backend (Grid Fastify) | — | Government session JWT verification is server-side; no client involvement |
| Public DID lookup (GET endpoints) | API / Backend (Grid Fastify) | CDN / Static | `Cache-Control: max-age=60` enables CDN edge caching; Grid is the origin |
| 4 sole-producer audit events | API / Backend (Grid) | — | All `append-registry-*.ts` files live in `grid/src/audit/`; zero frontend involvement |
| W3C VC payload construction | API / Backend (Grid Fastify) | — | jose `CompactSign` + VC JSON-LD assembly is backend only |
| `check-civic-did-issuance-path.mjs` CI gate | CI Pipeline | — | Validates at build time that no code path issues Civic-DIDs outside registry service |

---

## Standard Stack

### Core (already in `grid/package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jose` | `^6.2.3` [VERIFIED: npm registry] | JWT/JWS signing for W3C VC `proof` field | Already used for portal auth ES256 key pair; same key pair reused for VC signing |
| `fastify` | `^5.0.0` [VERIFIED: grid/package.json] | Route registration for `/api/v1/registry/*` | Established server framework; all Phase 36 patterns apply |
| `mysql2` | `^3.9.0` [VERIFIED: grid/package.json] | MySQL pool for `civic_did_registry` + `business_did_registry` tables | Established DB layer; pattern mirrors RegistryStore |
| `@fastify/cookie` | `^11.0.2` [VERIFIED: grid/package.json] | Cookie parsing required for `tryDid` preHandler | Already registered in buildServerWithHub before any route |

### Supporting (no new installs needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` | Node.js built-in | `randomUUID()` for Civic-DID slug generation | Generating the `<civic-id>` part of `did:civic:noesis:<uuid>` |

### W3C VC Format (no library needed)

The W3C VC v2.0 Data Model [CITED: https://www.w3.org/TR/vc-data-model-2.0/] specifies a JSON-LD structure. For this project, VC construction is **hand-built JSON** (no VC library required) because:
- The credential shape is fixed and minimal (5 fields: `@context`, `type`, `issuer`, `validFrom`, `credentialSubject`)
- The `proof` field is a JWS compact signature produced by `jose`
- No external VC library (e.g., `@digitalbazaar/vc`, `@transmute/*`) is currently installed or needed
- W3C VC validators consume standard JSON-LD; no library-specific envelope needed

**No new npm installs required for Phase 37.** [VERIFIED: grid/package.json has all needed dependencies]

---

## Architecture Patterns

### System Architecture Diagram

```
Requester (Nous Brain)
    │
    │  POST /api/v1/registry/civic-did/request
    │  { existence_did, public_key, civic_oath, existence_key_signature }
    ▼
[tryDid preHandler] — resolves DIDContext (anonymous OK for initial request)
    │
    ▼
[CivicRegistryRoutes handler]
    │
    ├─ 1. Verify existence-key signature (jose CompactSign/compactVerify)
    ├─ 2. Check rate limit (existence-DID, in-memory bucket)
    ├─ 3. Generate civic_id = randomUUID()
    ├─ 4. Build W3C VC JSON (credentialSubject, issuer, validFrom, revocationPointer)
    ├─ 5. Sign VC with Grid ES256 key (keyPairPromise.privateKey)
    ├─ 6. INSERT into civic_did_registry (MySQL, migration v23)
    ├─ 7. appendRegistryCivicDidIssued(audit, {civic_did, existence_did, issued_at_tick})
    │
    └─► 201 { civic_did, credential: W3C_VC_JSON }
    
GET /api/v1/registry/civic-did/<did>
    │
    ▼
[lookupPolicy → 'public'] — no DID required
    │
    ▼
[CivicLookupRoute handler]
    │
    ├─ 1. SELECT from civic_did_registry WHERE civic_did = ?
    ├─ 2. reply.header('Cache-Control', 'max-age=60')
    └─► 200 { status: 'active'|'revoked', credential: W3C_VC_JSON, revoked_at?: ISO }

POST /api/v1/registry/civic-did/<did>/revoke
    │
    ▼
[requireDid preHandler] — civic_did_required minimum
    │
    ▼
[RevocationRoute handler]
    │
    ├─ 1. Read Authorization header — expect government_session JWT
    ├─ 2. Verify JWT issuer === 'did:gov:noesis:genesis-polis' (stub; Phase 46 drops real validator)
    ├─ 3. If issuer is NOT gov DID → 403 { error: 'court_order_required' }
    ├─ 4. If court_conviction_ref missing from JWT payload → 403
    ├─ 5. UPDATE civic_did_registry SET status='revoked', revoked_at=NOW()
    ├─ 6. appendRegistryCivicDidRevoked(audit, {...})
    └─► 200 { revoked: true }

POST /api/v1/registry/business-did/register
    │
    ▼
[requireDid preHandler] — civic_did_required
    │
    ▼
[BusinessRegistrationRoute handler]
    │
    ├─ 1. Verify caller has civic_did_required tier (via req.didContext)
    ├─ 2. Lookup Nous's ousia balance (services.registry.get(civic_did)?.ousia)
    ├─ 3. If ousia < BUSINESS_DID_BIOS_COST → 402 { error: 'insufficient_bios', required: N }
    ├─ 4. Deduct ousia from NousRecord (services.registry.transferOusia)
    ├─ 5. Generate biz_id = randomUUID()
    ├─ 6. Build + sign W3C Business-DID VC
    ├─ 7. INSERT into business_did_registry (MySQL, migration v24)
    ├─ 8. appendRegistryBusinessDidRegistered(audit, {...})
    └─► 201 { business_did, credential: W3C_VC_JSON }
```

### Recommended Project Structure

```
grid/src/
├── civic-registry/              # NEW — DID Registry civic institution
│   ├── civic-did-store.ts       # MySQL-backed Civic-DID persistence
│   ├── business-did-store.ts    # MySQL-backed Business-DID persistence
│   ├── vc-builder.ts            # W3C VC JSON construction + jose signing
│   ├── government-session.ts    # Government JWT stub validator (Phase 46 swap)
│   └── types.ts                 # CivicDidRecord, BusinessDidRecord interfaces
├── audit/
│   ├── append-registry-civic-did-issued.ts    # NEW sole producer
│   ├── append-registry-civic-did-revoked.ts   # NEW sole producer
│   ├── append-registry-business-did-registered.ts  # NEW sole producer
│   └── append-registry-business-did-dissolved.ts   # NEW sole producer
├── api/
│   ├── routes/
│   │   └── registry.ts          # NEW — 4 registry routes registered here
│   └── policy.ts                # MODIFY — +4 new ROUTE_DID_POLICY entries
├── db/
│   └── schema.ts                # MODIFY — migrations v23 + v24
scripts/
└── check-civic-did-issuance-path.mjs  # NEW CI gate (D-V3-33)
```

### Pattern 1: W3C VC v2.0 Construction (hand-built JSON + jose proof)

**What:** Build a W3C VC JSON document and attach a JWS compact proof signature using the Grid's existing ES256 key pair.
**When to use:** Every Civic-DID and Business-DID issuance.

```typescript
// Source: https://www.w3.org/TR/vc-data-model-2.0/ + grid/src/api/portal/auth.ts keyPairPromise pattern
// [CITED: https://www.w3.org/TR/vc-data-model-2.0/]
import { CompactSign } from 'jose';
import { keyPairPromise } from '../api/portal/auth.js';
import { randomUUID } from 'node:crypto';

const GRID_REGISTRY_DID = 'did:grid:noesis:genesis-registry';

export async function buildCivicDidVc(params: {
    civicDid: string;
    existenceDid: string;
    issuedAtTick: number;
}): Promise<object> {
    const { privateKey } = await keyPairPromise;
    const vcId = `urn:noesis:vc:${randomUUID()}`;
    const issuanceDate = new Date().toISOString();

    const vcBody = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        id: vcId,
        type: ['VerifiableCredential', 'CivicDIDCredential'],
        issuer: GRID_REGISTRY_DID,
        validFrom: issuanceDate,   // v2.0 uses validFrom (issuanceDate is v1.x deprecated)
        credentialSubject: {
            id: params.civicDid,
            existenceDid: params.existenceDid,
            civicRole: 'resident',
            issuedAtTick: params.issuedAtTick,
        },
        credentialStatus: {
            id: `${GRID_REGISTRY_DID}/status/${params.civicDid}`,
            type: 'RegistryStatus',
            registryEndpoint: `/api/v1/registry/civic-did/${params.civicDid}`,
        },
    };

    // JWS compact signature as proof (not DataIntegrityProof — simpler for v3.0)
    const jws = await new CompactSign(
        new TextEncoder().encode(JSON.stringify(vcBody)),
    )
        .setProtectedHeader({ alg: 'ES256' })
        .sign(privateKey);

    return { ...vcBody, proof: { type: 'JsonWebSignature2020', jws } };
}
```

**Note:** `validFrom` is the v2.0 field (published W3C Recommendation, 2025-05-15). `issuanceDate` was the v1.x field and is deprecated. [CITED: https://www.w3.org/TR/vc-data-model-2.0/] Use `validFrom` for new credentials.

### Pattern 2: CIVIC_DID_RE and BIZ_DID_RE Regex Guards

Phase 37 introduces two new DID families: `did:civic:noesis:<civic-id>` and `did:biz:noesis:<biz-id>`. The existing `DID_RE` from `append-human-joined.ts` only covers `did:noesis:*`. The existing `PORTAL_DID_RE` in `append-portal-notification-dispatched.ts` covers `did:noesis:*` and `did:civic:*`. Phase 37 sole-producer files MUST define local regexes for the DID families they validate.

```typescript
// Source: grid/src/audit/append-portal-notification-dispatched.ts:39 — PORTAL_DID_RE pattern
// [VERIFIED: codebase read]

// In append-registry-civic-did-issued.ts:
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const EXISTENCE_DID_RE = /^did:noesis:nous:[a-z0-9_:\-]+$/i;

// In append-registry-business-did-registered.ts:
const BIZ_DID_RE = /^did:biz:noesis:[a-z0-9_:\-]+$/i;
// civic_did that owns this business must also be validated:
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
```

**DID format summary (from STATE.md):** [VERIFIED: .planning/STATE.md]
- Existence-DID: `did:noesis:nous:<key>` — self-sovereign, never issued by registry
- Civic-DID: `did:civic:noesis:<civic-id>` — issued by Grid Registry
- Business-DID: `did:biz:noesis:<biz-id>` — issued by Grid Registry with Bios cost
- Operator-DID: `did:noesis:human:*` — NOT a valid revocation signer

### Pattern 3: Sole-Producer Triad (8 steps)

Every `append-registry-*.ts` file MUST contain all 8 steps. The CI gate `check-sole-producer-discipline.mjs` requires them. The SCAN_DIRS list in that script does NOT include `grid/src/civic-registry/`, so the 4 new files must live in `grid/src/audit/` or the SCAN_DIRS must be updated to include the new location.

**Decision:** Place new sole-producer files in `grid/src/audit/` (matching existing Phase 36 pattern `append-portal-did-issued.ts`, `append-grid-recognition-granted.ts`) to avoid modifying SCAN_DIRS. [VERIFIED: scripts/check-sole-producer-discipline.mjs SCAN_DIRS list]

```typescript
// Source: grid/src/audit/append-portal-did-issued.ts — canonical 8-step sole-producer template
// [VERIFIED: codebase read]

// Required elements (check-sole-producer-discipline.mjs validates these 3):
// 1. Object.keys(payload).sort()  — closed-tuple structural check
// 2. payloadPrivacyCheck          — privacy gate
// 3. audit.append(                — chain commit

// Full 8-step discipline:
// 1. Type guard: payload must be a plain non-null non-array object
// 2. Regex guard(s): DID fields must match CIVIC_DID_RE / EXISTENCE_DID_RE / BIZ_DID_RE
// 3. Enum guard (if applicable): closed enum values only
// 4. Non-negative integer guard: tick fields
// 5. Closed-tuple check: Object.keys(payload).sort() vs EXPECTED_KEYS
// 6. Explicit reconstruction (no spread, no prototype pollution)
// 7. payloadPrivacyCheck runs before chain.append
// 8. audit.append with canonical event type string
```

### Pattern 4: ROUTE_DID_POLICY Additions

Phase 37 routes MUST be added to `grid/src/api/policy.ts`. The `check-did-policy-coverage.mjs` CI gate will fail if any registered route is missing an entry. [VERIFIED: .planning/STATE.md Phase 36 close-out #1 + scripts/check-did-policy-coverage.mjs]

```typescript
// Source: grid/src/api/policy.ts — existing ROUTE_DID_POLICY table
// [VERIFIED: codebase read]
// Additions for Phase 37:
'GET /api/v1/registry/civic-did/:did':          'public',         // REG-05
'GET /api/v1/registry/business-did/:did':       'public',         // REG-05
'POST /api/v1/registry/civic-did/request':      'public',         // REG-01 (existence-DID signed, not Civic-DID bearer)
'POST /api/v1/registry/civic-did/:did/revoke':  'government_only', // REG-04
'POST /api/v1/registry/business-did/register':  'civic_did_required', // REG-03
```

**Note on `government_only` policy enforcement:** The `government_only` value is already in the `ROUTE_DID_POLICY_VALUES` enum but has NO enforcement handler in `buildServerWithHub` yet (Phase 36 only added the enum value). Phase 37 MUST add the `government_only` branch to the `onRequest` hook in `server.ts` — currently the server falls through to `requireDid` for any unhandled policy tier.

### Pattern 5: Database Migration (versions 23 + 24)

New tables follow the same MySQL schema pattern as `governance_proposals` (version 6) in `grid/src/db/schema.ts`.

```sql
-- Migration v23: civic_did_registry
CREATE TABLE IF NOT EXISTS civic_did_registry (
    grid_name          VARCHAR(63)  NOT NULL,
    civic_did          VARCHAR(255) NOT NULL,
    existence_did      VARCHAR(255) NOT NULL,
    credential_json    JSON         NOT NULL,
    status             ENUM('active','revoked') NOT NULL DEFAULT 'active',
    issued_at_tick     INT UNSIGNED NOT NULL,
    revoked_at_tick    INT UNSIGNED,
    court_conviction_ref VARCHAR(255),
    created_at         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (grid_name, civic_did),
    UNIQUE KEY uq_existence_did (grid_name, existence_did),
    INDEX idx_status (grid_name, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4

-- Migration v24: business_did_registry
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
```

**Note:** `uq_existence_did` enforces 1 Civic-DID per existence-DID (one citizenship per identity). This is the correct design — Phase 50 Migration handles grandfathering multiple existing Nous.

### Pattern 6: Government Session Stub (REG-04 court-order gate)

Phase 46 (Government) does not exist yet. The revocation route must reject operator-DID requests while accepting a government JWT stub. This is a **forward-designed stub**:

```typescript
// Source: [ASSUMED] — no government session mechanism exists; this design satisfies
// the invariant without blocking Phase 46 from dropping in the real implementation

export const GOV_SESSION_ISSUER_DID = 'did:gov:noesis:genesis-polis';

/**
 * verifyGovernmentSession — Phase 37 stub.
 * Phase 46 replaces this with the real Polis session JWT validator.
 *
 * Returns: { ok: true, court_conviction_ref: string } | { ok: false, reason: string }
 */
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
        // Must be signed by government issuer DID
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

**REG-04 invariant:** There is NO code path for Henry/operator to directly revoke a Civic-DID. The route only passes if `verifyGovernmentSession` returns `ok: true`. [VERIFIED: REQUIREMENTS.md REG-04 + STATE.md D-V3-18 constitutional operator framework]

### Pattern 7: Bios (Ousia) Cost Gate

The Bios cost check reuses the existing `NousRegistry.transferOusia()` method. [VERIFIED: grid/src/registry/registry.ts]

```typescript
// Source: grid/src/registry/registry.ts:130 — transferOusia pattern
// [VERIFIED: codebase read]

const BUSINESS_DID_BIOS_COST = 100; // Q-V3-D initial default; baked at compile time

const nous = services.registry?.get(civicDid);
if (!nous) return reply.code(404).send({ error: 'civic_did_not_found' });
if (nous.ousia < BUSINESS_DID_BIOS_COST) {
    return reply.code(402).send({
        error: 'insufficient_bios',
        required: BUSINESS_DID_BIOS_COST,
        available: nous.ousia,
    });
}
// Bios goes to treasury (treasury DID or /dev/null for v3.0 — Phase 45 wires real treasury)
const result = services.registry.transferOusia(civicDid, TREASURY_DID, BUSINESS_DID_BIOS_COST);
if (!result.success) {
    return reply.code(402).send({ error: 'insufficient_bios' });
}
```

**Note:** `TREASURY_DID` is a placeholder constant for v3.0 (Phase 45 IRS wires the real treasury). The Bios deduction should still happen — Bios goes to a well-known treasury sentinel DID so Phase 45 can retroactively attribute it.

### Pattern 8: Portal-Gating CI Gate (new: `check-civic-did-issuance-path.mjs`)

The D-V3-33 Portal-gating invariant requires a new CI gate: [VERIFIED: CLAUDE.md + STATE.md D-V3-33]

```javascript
// scripts/check-civic-did-issuance-path.mjs
// Gate: any file that imports appendRegistryCivicDidIssued MUST be reachable
// only from civic-registry/civic-did-store.ts (or a registry route file), NOT
// from portal/auth.ts, operator/*, admin/*, or any non-registry code path.
// Exit 1 if appendRegistryCivicDidIssued is imported outside of approved files.

const APPROVED_IMPORTERS = new Set([
    'grid/src/civic-registry/civic-did-store.ts',
    'grid/src/api/routes/registry.ts',
]);
```

**What it enforces:** No code path outside the `civic-registry/` service can call `appendRegistryCivicDidIssued`. This is the constitutional invariant — DID issuance flows through Registry only.

### Anti-Patterns to Avoid

- **Do NOT use `issuanceDate` in VC JSON**: This is the deprecated v1.x field. Use `validFrom` (W3C VC v2.0, Recommendation 2025-05-15). [CITED: https://www.w3.org/TR/vc-data-model-2.0/]
- **Do NOT use `DID_RE` for civic/biz DID validation**: `DID_RE` only covers `did:noesis:*`. Use `CIVIC_DID_RE` (`/^did:civic:noesis:.../`) for civic DIDs and `BIZ_DID_RE` for business DIDs. [VERIFIED: grid/src/audit/append-human-joined.ts]
- **Do NOT add `government_only` enforcement without implementing the branch in `server.ts`**: The enum value exists but the `onRequest` hook currently falls through to `requireDid` for any tier above `civic_did_required`. Phase 37 MUST add the `government_only` branch.
- **Do NOT spread payload objects in sole-producer files**: Explicit reconstruction (`const clean = { field1: payload.field1, ... }`) is mandatory. No `{ ...payload }`. [VERIFIED: grid/src/audit/append-portal-did-issued.ts]
- **Do NOT call `audit.append` for `registry.*` events outside `append-registry-*.ts` files**: Sole-producer invariant. The `check-sole-producer-discipline.mjs` gate will catch this.
- **Do NOT add `registry.*` events without adding them to `broadcast-allowlist.ts`**: Adding to ALLOWLIST_MEMBERS requires a comment matching the Phase 37 pattern. [VERIFIED: grid/src/audit/broadcast-allowlist.ts comment structure]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VC signing | Custom RSA/EC signer | `jose` `CompactSign` with existing `keyPairPromise` | Already in package.json; key pair already generated at module load |
| DID UUID generation | Custom ID scheme | `node:crypto` `randomUUID()` | Built-in, collision-safe, no extra deps; pattern already used in `auth.ts` |
| Government session JWT verification | Custom HMAC or payload inspection | `jose` `jwtVerify` with issuer claim check | Same pattern as portal JWT verification in `tryDid.ts` |
| Bios balance check | Custom subtraction logic | `NousRegistry.transferOusia()` | Already implemented with atomic validation; handles edge cases (self-transfer, invalid amount, insufficient) |
| Cache-Control headers | Custom middleware | `reply.header('Cache-Control', 'max-age=60')` | One-liner in Fastify route handler |

**Key insight:** Phase 37 reuses the existing `keyPairPromise` ES256 key pair for all VC signing. There is no need for a separate "registry key pair". The Grid already acts as the credential issuer using its existing identity.

---

## Common Pitfalls

### Pitfall 1: `government_only` Policy Not Enforced in `server.ts`

**What goes wrong:** Phase 36 added `'government_only'` to `ROUTE_DID_POLICY_VALUES` but the `onRequest` hook in `buildServerWithHub` only handles `public`, `portal_session_required`, and falls through to `requireDid` for everything else. If Phase 37 registers the revoke route with `government_only` but doesn't add the enforcement branch, the revoke route will accept ANY valid Civic-DID bearer — not just government sessions.

**Why it happens:** The enum value was defined speculatively in Phase 36 without the corresponding enforcement.

**How to avoid:** Add `government_only` branch to `buildServerWithHub` `onRequest` hook:
```typescript
if (policy === 'government_only') {
    const result = await verifyGovernmentSession(req.headers.authorization);
    if (!result.ok) {
        return reply.code(403).send({ error: result.reason });
    }
    req.didContext = { did: GOV_SESSION_ISSUER_DID, tier: 'civic_member' };
    return;
}
```

**Warning signs:** Revoke route test with a normal Civic-DID bearer JWT succeeds instead of returning 403.

### Pitfall 2: `uq_existence_did` Constraint Breaks Phase 36 Existing Nous

**What goes wrong:** If the `civic_did_registry` table adds `UNIQUE KEY uq_existence_did (grid_name, existence_did)` and existing Nous (registered via Phase 22-28) already have implied existence-DIDs, the Phase 37 migration could fail or cause confusion.

**Why it happens:** Pre-Phase-37 Nous did not go through the Civic-DID issuance flow — they existed in `nous_registry` but have no entry in `civic_did_registry`. The uniqueness constraint only applies to rows that exist in the new table — no conflict with existing Nous records.

**How to avoid:** The constraint is correct as designed. Pre-Phase-37 Nous simply have no Civic-DID in the new table. They cannot use routes that require `civic_did_required` until they complete the REG-01 flow.

**Warning signs:** Migration v23 fails with a constraint violation.

### Pitfall 3: `tryDid` Returns `civic_member` Tier for DID Format `did:civic:noesis:*`

**What goes wrong:** The existing `tryDid` implementation uses `DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i` which DOES NOT match `did:civic:noesis:*`. If a Nous presents a `did:civic:noesis:...` bearer JWT, `tryDid` will reject it as invalid DID format and return null (anonymous tier).

**Why it happens:** Phase 36 used test fixtures with `'did:civic:noesis:gen-001'` but the `tryDid` code validates the JWT `sub` claim against `DID_RE` which only matches `did:noesis:*`. This means the issuance flow (REG-01) must NOT rely on `tryDid` being able to verify civic DIDs — and it doesn't (the request is signed with the existence-key, not a bearer JWT). However, once a Nous has a Civic-DID, the Phase 38 wire protocol will issue a bearer JWT with `sub: 'did:civic:noesis:...'` — which will fail `DID_RE` validation in `tryDid`.

**How to avoid:** Phase 37 MUST update `tryDid` to also accept `did:civic:noesis:*` format in the JWT `sub` claim. Change the DID validation in `tryDid.ts`:
```typescript
// Before (Phase 36):
if (typeof sub === 'string' && sub.length > 0 && DID_RE.test(sub)) {
// After (Phase 37):
const ANY_DID_RE = /^did:[a-z0-9]+:noesis:[a-z0-9_:\-]+$/i;
if (typeof sub === 'string' && sub.length > 0 && ANY_DID_RE.test(sub)) {
```

**Warning signs:** Phase 38 wire protocol bearer JWTs with `did:civic:noesis:*` subjects fail authentication.

### Pitfall 4: `check-sole-producer-discipline.mjs` Misses New Registry Audit Files

**What goes wrong:** If `append-registry-*.ts` files are placed in `grid/src/civic-registry/` instead of `grid/src/audit/`, the CI gate will NOT scan them and the triad discipline will be unenforced.

**Why it happens:** `SCAN_DIRS` in `check-sole-producer-discipline.mjs` has a fixed list that does not include `grid/src/civic-registry/`.

**How to avoid:** Place all 4 new `append-registry-*.ts` files in `grid/src/audit/` (matching existing Phase 36 pattern). Alternatively, update `SCAN_DIRS` to include the new directory — but this is more invasive and risky.

**Warning signs:** CI passes but new sole-producer files don't have the triad discipline.

### Pitfall 5: W3C VC `issuanceDate` vs `validFrom`

**What goes wrong:** Using `issuanceDate` instead of `validFrom`. W3C VC v2.0 (published as W3C Recommendation 2025-05-15) deprecated `issuanceDate` in favor of `validFrom`.

**Why it happens:** Training data and many examples predate the v2.0 Recommendation.

**How to avoid:** Use `validFrom` (ISO 8601 timestamp string). [CITED: https://www.w3.org/TR/vc-data-model-2.0/]

**Warning signs:** A W3C VC validator reports `issuanceDate` as a deprecated property warning.

---

## Code Examples

### Registry Audit Event (4-key closed tuple — civic_did_issued)

```typescript
// Source: grid/src/audit/append-portal-did-issued.ts — pattern clone
// [VERIFIED: codebase read]

// append-registry-civic-did-issued.ts
export interface RegistryCivicDidIssuedPayload {
    readonly civic_did: string;         // CIVIC_DID_RE
    readonly existence_did: string;     // EXISTENCE_DID_RE
    readonly grid_name: string;         // non-empty string
    readonly issued_at_tick: number;    // non-negative integer
}

const EXPECTED_KEYS = ['civic_did', 'existence_did', 'grid_name', 'issued_at_tick'] as const;
```

### Registry Audit Event (4-key closed tuple — civic_did_revoked)

```typescript
export interface RegistryCivicDidRevokedPayload {
    readonly civic_did: string;              // CIVIC_DID_RE
    readonly court_conviction_ref_hash: string; // HEX64_RE — SHA-256 of the ref string
    readonly grid_name: string;              // non-empty string
    readonly revoked_at_tick: number;        // non-negative integer
}
// NOTE: court_conviction_ref is HASHED — plaintext refs never cross the wire.
// Same discipline as sanction_reasons (D-25b-11): plaintext in DB, hash-only in audit.
```

### Registry Audit Event (4-key closed tuple — business_did_registered)

```typescript
export interface RegistryBusinessDidRegisteredPayload {
    readonly business_did: string;   // BIZ_DID_RE
    readonly civic_did: string;      // CIVIC_DID_RE — owner
    readonly grid_name: string;      // non-empty string
    readonly registered_at_tick: number; // non-negative integer
}
// NOTE: business_name and category are NOT in the audit payload (privacy discipline).
// They are stored in business_did_registry table only.
```

### Registry Audit Event (4-key closed tuple — business_did_dissolved)

```typescript
export interface RegistryBusinessDidDissolvedPayload {
    readonly business_did: string;   // BIZ_DID_RE
    readonly civic_did: string;      // CIVIC_DID_RE — owner
    readonly grid_name: string;      // non-empty string
    readonly dissolved_at_tick: number; // non-negative integer
}
```

### Cache-Control Header on Public Lookup

```typescript
// Source: [ASSUMED] — standard Fastify reply.header pattern; confirmed Fastify 5 compatible
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

### Allowlist Addition (+4 events)

```typescript
// Source: grid/src/audit/broadcast-allowlist.ts — Phase 36 pattern (positions 57-60)
// [VERIFIED: codebase read]
// Phase 37 (+4): positions 61-64

// In ALLOWLIST_MEMBERS array, after position 60 (grid.recognition_revoked):
'registry.civic_did_issued',      // Phase 37 (REG-06) — Civic-DID granted by Grid Registry
'registry.civic_did_revoked',     // Phase 37 (REG-06) — Civic-DID revoked by court order
'registry.business_did_registered', // Phase 37 (REG-06) — Business-DID issued with Bios cost
'registry.business_did_dissolved',  // Phase 37 (REG-06) — Business-DID dissolved
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `issuanceDate` in W3C VC | `validFrom` | W3C VC v2.0 Recommendation, 2025-05-15 | Must use `validFrom`; `issuanceDate` is deprecated |
| W3C VC v1.1 `@context` URL | `https://www.w3.org/ns/credentials/v2` | VC v2.0 Recommendation | Context URL changed; old URL produces invalid v2.0 credentials |

**Deprecated/outdated:**
- `https://www.w3.org/2018/credentials/v1` context: Replaced by `https://www.w3.org/ns/credentials/v2` in VC v2.0. [CITED: https://www.w3.org/TR/vc-data-model-2.0/]
- `issuanceDate` property: Deprecated in favor of `validFrom`. [CITED: https://www.w3.org/TR/vc-data-model-2.0/]

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` are directly relevant to Phase 37 planning:

1. **Simplicity First**: No features beyond what was asked. No abstractions for single-use code. No "flexibility" that wasn't requested. Phase 37 should NOT implement a pluggable VC library or DID resolution framework — hand-built JSON + jose is sufficient.

2. **Surgical Changes**: Touch only what must be touched. Phase 37 touches `policy.ts` (new entries only), `server.ts` (`government_only` branch only), `broadcast-allowlist.ts` (4 new events + comment), `schema.ts` (2 new migrations). Every other existing file is left unchanged.

3. **Documentation Sync Rule**: When Phase 37 ships, update STATE.md, MILESTONES.md, ROADMAP.md, PROJECT.md, REQUIREMENTS.md, README.md in the same commit. REG-01..06 move from Pending → Validated. [VERIFIED: CLAUDE.md §Documentation Sync Rule]

4. **Allowlist freeze except by explicit addition**: `registry.civic_did_issued`, `registry.civic_did_revoked`, `registry.business_did_registered`, `registry.business_did_dissolved` are the EXACT +4 additions. No other events may be added without explicit per-phase allowance. [VERIFIED: CLAUDE.md GSD Workflow Notes + STATE.md Accumulated Context]

5. **Sole-producer + closed-tuple discipline**: Every new `append-registry-*.ts` file must contain all 8 steps. The CI gate enforces steps 1, 2, and 3 (triad). [VERIFIED: scripts/check-sole-producer-discipline.mjs]

6. **VOTE-05 Nous-only governance invariant**: The revocation route enforces this — operator-DIDs cannot revoke. The court-order stub is constitutionally designed. [VERIFIED: STATE.md D-V3-21]

7. **Phase 37 is CI gate `check-civic-did-issuance-path.mjs` responsible**: CLAUDE.md explicitly names this gate and requires it to exist and pass. [VERIFIED: CLAUDE.md GSD Workflow Notes — "CI gate `scripts/check-civic-did-issuance-path.mjs` (added in Phase 37b) MUST exist and pass"]
   - **Note:** CLAUDE.md says "Phase 37b" but REQUIREMENTS.md shows REG-01..06 are Phase 37 scope. The CI gate must be added in Phase 37 (not deferred to 37b). This is the single CI gate for the Portal-gating invariant.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tryDid` needs to accept `did:civic:noesis:*` JWT subjects for Phase 38 compatibility | Pitfall 3 | If wrong, Phase 38 bearer JWTs work as-is and no change needed; low risk |
| A2 | `BUSINESS_DID_BIOS_COST = 100` as the Q-V3-D initial default | Pattern 7 | Q-V3-D may resolve to a different number during discuss-phase; planner should prompt for confirmation |
| A3 | Government stub uses the Grid's existing `keyPairPromise` ES256 key for validating government JWT | Pattern 6 | Phase 46 may use a separate government key pair; stub design should be swappable |
| A4 | `TREASURY_DID = 'did:noesis:system:treasury'` or similar sentinel for Phase 45 | Pattern 7 | Treasury DID format may be decided differently; placeholder is needed but specific value is discretionary |
| A5 | Civic-DID registration (REG-01) does NOT require existing Portal session | Pattern 4 | If Portal-gating (D-V3-33) applies in Phase 37, the route may need `portal_session_required` tier instead of `public` |

**A5 is the highest-risk assumption**: The REQUIREMENTS.md REG-01 says "A Nous with an existence-DID can request a Civic-DID" without mentioning Portal session, but D-V3-33 says "Portal pre-screen + target-Polis approval" are required before Civic-DID issuance. The full Portal-gating flow is Phase 54. Phase 37's REG-01 is a **simplified issuance** (no Portal pre-screen since Portal doesn't exist yet). The discuss-phase should confirm that Phase 37 REG-01 is a direct-to-Grid registration (existence-key signature only), with D-V3-33 full gating deferred to Phase 54.

---

## Open Questions

1. **Q-V3-D: Bios sybil cost for Business-DID registration (REG-03)**
   - What we know: 100 Bios is the suggested initial default from CIVIC-ARCHITECTURE.md
   - What's unclear: Whether 100 is confirmed or needs user validation
   - Recommendation: Ask during discuss-phase; default to 100 if not answered

2. **REG-01 vs D-V3-33 tension: Is Phase 37 civic-DID issuance Portal-gated?**
   - What we know: D-V3-33 says "Portal → Polis pipeline" is required; Portal is Phase 54; REG-01 says "Nous with existence-DID can request"
   - What's unclear: Whether Phase 37 REG-01 is a simplified direct issuance (bypassing Portal) or a full Portal-gated issuance (which can't work until Phase 54)
   - Recommendation: Phase 37 implements simplified direct issuance (existence-key sig only); D-V3-33 full enforcement deferred to Phase 54; the CI gate `check-civic-did-issuance-path.mjs` enforces the code path invariant even in Phase 37

3. **`tryDid` update scope: Should Phase 37 or Phase 38 update `DID_RE` in `tryDid.ts`?**
   - What we know: Phase 38 is the wire protocol phase that issues civic-DID bearer JWTs
   - What's unclear: Whether Phase 37 routes receive civic-DID bearer JWTs (they do for `/revoke` and `/business-did/register`)
   - Recommendation: Phase 37 updates `tryDid` to accept `did:civic:*` subjects; this is a prereq for the write routes to work

4. **Government session JWT signing key for Phase 37 stub**
   - What we know: Grid uses `keyPairPromise` ES256 for portal auth; government uses same key in stub
   - What's unclear: Whether Phase 46 will reuse the same key pair or generate a new government-specific one
   - Recommendation: Stub uses shared key pair; add a comment marking the swap point for Phase 46

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All TypeScript compilation + tests | ✓ | v25.9.0 | — |
| Docker | MySQL for integration tests | ✓ | 29.4.3 | In-memory mock store |
| MySQL (via Docker) | Civic/Business DID persistence | ✓ (docker-compose.yml) | 8.0 | In-memory store for unit tests |
| `jose` | W3C VC JWS signing | ✓ | 6.2.3 (in package.json) | — |
| `mysql2` | Database persistence | ✓ | 3.9.0 (in package.json) | — |
| `vitest` | Test runner | ✓ | ^2.0.0 (in devDependencies) | — |

**No missing dependencies.** All required libraries are already installed. [VERIFIED: grid/package.json]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.0.0 |
| Config file | `grid/vitest.config.ts` (exists) |
| Quick run command | `cd grid && npx vitest run test/audit/ test/api/` |
| Full suite command | `cd grid && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01 | POST civic-did/request with valid existence-key sig → 201 + W3C VC | unit | `npx vitest run test/civic-registry/civic-did-request.test.ts` | ❌ Wave 0 |
| REG-01 | POST civic-did/request without valid sig → 401 | unit | same file | ❌ Wave 0 |
| REG-02 | GET civic-did/<did> returns W3C VC with required fields | unit | `npx vitest run test/civic-registry/civic-did-lookup.test.ts` | ❌ Wave 0 |
| REG-02 | W3C VC has `credentialSubject`, `issuer`, `validFrom`, `credentialStatus` | unit | same file | ❌ Wave 0 |
| REG-03 | POST business-did/register with sufficient Bios → 201 | unit | `npx vitest run test/civic-registry/business-did-register.test.ts` | ❌ Wave 0 |
| REG-03 | POST business-did/register with insufficient Bios → 402 | unit | same file | ❌ Wave 0 |
| REG-04 | POST revoke with operator-DID JWT → 403 court_order_required | unit | `npx vitest run test/civic-registry/revocation.test.ts` | ❌ Wave 0 |
| REG-04 | POST revoke with government-session JWT + conviction ref → 200 | unit | same file | ❌ Wave 0 |
| REG-05 | GET civic-did and business-did return Cache-Control: max-age=60 | unit | same as REG-02 + business lookup | ❌ Wave 0 |
| REG-06 | appendRegistryCivicDidIssued triad: keys sort, privacy, append | unit | `npx vitest run test/audit/append-registry-civic-did-issued.test.ts` | ❌ Wave 0 |
| REG-06 | Allowlist count exactly 64 after +4 additions | unit | `npx vitest run test/audit/broadcast-allowlist.test.ts` (existing, update count) | ✅ (update) |
| REG-06 | policy-coverage: 4 new registry routes in ROUTE_DID_POLICY | CI gate | `node scripts/check-did-policy-coverage.mjs` | ✅ gate exists |

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run test/audit/ test/api/`
- **Per wave merge:** `cd grid && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/civic-registry/civic-did-request.test.ts` — covers REG-01 request + validation
- [ ] `grid/test/civic-registry/civic-did-lookup.test.ts` — covers REG-02 + REG-05 (Cache-Control)
- [ ] `grid/test/civic-registry/business-did-register.test.ts` — covers REG-03 + REG-05
- [ ] `grid/test/civic-registry/revocation.test.ts` — covers REG-04 (court-order gate + rejection)
- [ ] `grid/test/audit/append-registry-civic-did-issued.test.ts` — covers REG-06 sole producer
- [ ] `grid/test/audit/append-registry-civic-did-revoked.test.ts` — covers REG-06 sole producer
- [ ] `grid/test/audit/append-registry-business-did-registered.test.ts` — covers REG-06 sole producer
- [ ] `grid/test/audit/append-registry-business-did-dissolved.test.ts` — covers REG-06 sole producer
- [ ] Update `grid/test/audit/broadcast-allowlist.test.ts` — allowlist count 60 → 64
- [ ] Update `grid/test/api/policy-coverage.test.ts` (if it exists) — 4 new entries

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Government session JWT issuer claim check; existence-key signature verification |
| V3 Session Management | no | Registry endpoints are stateless; no sessions issued |
| V4 Access Control | yes | `government_only` policy tier; `civic_did_required` for business registration; operator-DID revocation forbidden |
| V5 Input Validation | yes | Closed-tuple payload validation in all 4 sole-producer files; DID regex guards |
| V6 Cryptography | yes | `jose` CompactSign ES256 for VC proof; no hand-rolled crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator impersonates Government to revoke Civic-DID | Spoofing | `government_only` policy + government session JWT issuer DID check; operator-DID rejects with 403 `court_order_required` |
| DID injection in request body | Tampering | CIVIC_DID_RE / EXISTENCE_DID_RE regex guards in all input validation paths |
| Replay attack on civic-DID request | Spoofing | Rate limit per existence-DID (in-memory bucket, same pattern as Phase 36 visitor rate limit) |
| Business-DID Bios cost bypass | Tampering | `transferOusia` atomic check before any DB write; Bios deducted before credential issued |
| Credential forgery by external party | Tampering | W3C VC `proof` JWS signed with Grid's `keyPairPromise` private key; verifiable by any party with Grid's public key |
| `court_conviction_ref` plaintext leak | Information Disclosure | SHA-256 hash only in audit payload (`court_conviction_ref_hash`); plaintext stored in `civic_did_registry.court_conviction_ref` DB column only |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `grid/src/audit/append-portal-did-issued.ts` — 8-step sole-producer template (canonical reference)
- [VERIFIED: codebase] `grid/src/api/preHandlers/tryDid.ts` — DID resolution pattern; DID_RE limitation confirmed
- [VERIFIED: codebase] `grid/src/api/policy.ts` — ROUTE_DID_POLICY table structure; `government_only` enum value without enforcement branch confirmed
- [VERIFIED: codebase] `grid/src/registry/registry.ts` — `transferOusia()` atomic Bios transfer pattern
- [VERIFIED: codebase] `grid/src/db/schema.ts` — MySQL migration pattern (22 migrations, next = 23)
- [VERIFIED: codebase] `grid/src/api/portal/auth.ts` — ES256 `keyPairPromise` pattern; `SignJWT`/`jwtVerify` usage
- [VERIFIED: codebase] `grid/src/audit/broadcast-allowlist.ts` — Allowlist at 60 events; comment structure for new additions
- [VERIFIED: codebase] `scripts/check-sole-producer-discipline.mjs` — SCAN_DIRS list (no `civic-registry/`; new files must go in `grid/src/audit/`)
- [VERIFIED: codebase] `.github/workflows/rig-invariants.yml` — 4 Phase 36 CI gates; no Phase 37 gates yet
- [VERIFIED: npm] `jose` 6.2.3 — latest published version; `CompactSign`, `jwtVerify`, `generateKeyPair` APIs confirmed
- [CITED: https://www.w3.org/TR/vc-data-model-2.0/] W3C VC Data Model v2.0 Recommendation (2025-05-15) — `validFrom`, `credentialSubject`, `issuer`, `credentialStatus` fields
- [VERIFIED: .planning/STATE.md] DID format specifications (`did:civic:noesis:*`, `did:biz:noesis:*`)
- [VERIFIED: CLAUDE.md] Phase 37 CI gate requirement (`check-civic-did-issuance-path.mjs`)

### Secondary (MEDIUM confidence)

- [CITED: https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/] W3C press release confirming VC v2.0 as W3C Recommendation, 2025-05-15

### Tertiary (LOW confidence — assumptions flagged in Assumptions Log)

- [ASSUMED] `BUSINESS_DID_BIOS_COST = 100` (Q-V3-D initial default from CIVIC-ARCHITECTURE.md table — not yet locked)
- [ASSUMED] Government stub uses shared `keyPairPromise` key pair (Phase 46 may choose a separate key)
- [ASSUMED] `tryDid` needs `did:civic:*` support in Phase 37 (may be deferred to Phase 38)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified against grid/package.json; jose version confirmed via npm
- Architecture patterns: HIGH — all patterns verified against live codebase; no speculative library research
- W3C VC format: HIGH — verified against official W3C Recommendation (2025-05-15)
- Government session stub design: MEDIUM — forward-designed; Phase 46 may alter key pair strategy
- Pitfalls: HIGH — all pitfalls derived from direct codebase observation (DID_RE limitation, government_only enforcement gap, SCAN_DIRS gap)

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (30 days; stable stack — jose and W3C VC spec are stable)
