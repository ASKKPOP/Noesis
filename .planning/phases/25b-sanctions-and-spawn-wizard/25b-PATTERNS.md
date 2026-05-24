# Phase 25b: Sanctions + Spawn Wizard — Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 28 (6 Wave-0 migrations + 6 emitters + 6 routes + 1 spawn route + allowlist + migration + 2 UI panels + portal middleware + CI gate + tests)
**Analogs found:** 28/28 (every file in scope has a direct existing analog)

---

## File Classification

### Wave 0 — Header-auth migration (6 modified routes)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `grid/src/api/operator/clock-pause-resume.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` | exact (header-auth) |
| `grid/src/api/operator/governance-laws.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` | exact |
| `grid/src/api/operator/telos-force.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` | exact |
| `grid/src/api/operator/delete-nous.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` | exact |
| `grid/src/api/operator/memory-query.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` | exact |
| `grid/src/api/operator/export-replay.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` | exact |

### Wave 1 — Sanction emitter foundation (6 new + 2 modified)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `grid/src/audit/append-operator-muted.ts` | audit-emitter | event-driven | `grid/src/audit/append-nous-deleted.ts` | exact (closed-tuple sole producer) |
| `grid/src/audit/append-operator-slashed.ts` | audit-emitter | event-driven | `grid/src/audit/append-nous-deleted.ts` | exact |
| `grid/src/audit/append-operator-quarantined.ts` | audit-emitter | event-driven | `grid/src/audit/append-nous-deleted.ts` | exact |
| `grid/src/audit/append-operator-forced-sleep.ts` | audit-emitter | event-driven | `grid/src/audit/append-nous-deleted.ts` | exact |
| `grid/src/audit/append-operator-human-banned.ts` | audit-emitter | event-driven | `grid/src/audit/append-nous-deleted.ts` | exact (target_did → human_did variant) |
| `grid/src/audit/append-operator-human-frozen.ts` | audit-emitter | event-driven | `grid/src/audit/append-nous-deleted.ts` | exact |
| `grid/src/audit/broadcast-allowlist.ts` | config | n/a | self (same file, +6 entries) | self |
| `grid/src/db/schema.ts` | migration | DDL | self — append migration v12 | self |

### Wave 2/3 — Sanction routes + UI (6 new routes + UI mods)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `grid/src/api/operator/mute-broadcast.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` (header-auth) + `delete-nous.ts` (sanction shape) | exact composite |
| `grid/src/api/operator/slash-coin.ts` | controller | request-response | same composite | exact |
| `grid/src/api/operator/quarantine.ts` | controller | request-response | same composite | exact |
| `grid/src/api/operator/force-sleep.ts` | controller | request-response | same composite + `grid/src/sleep/appendNousSleepEntered.ts` | exact |
| `grid/src/api/operator/ban-human.ts` | controller | request-response | same composite (human variant — no DID_REGEX for Nous; uses human DID) | exact |
| `grid/src/api/operator/freeze-wallet.ts` | controller | request-response | same composite + writes to `human_users.frozen` | exact |
| `grid/src/api/operator/index.ts` | barrel | n/a | self — append 7 new registrar imports/calls | self |
| `steward/src/app/nous/[id]/page.tsx` | component | request-response | self — add Sanctions card following "Danger Zone" pattern | self |
| `steward/src/app/humans/[did]/page.tsx` | component | request-response | self — add Sanctions tab/card following same pattern | self |

### Wave 4 — Spawn wizard

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `grid/src/api/operator/spawn-system-nous.ts` | controller | request-response | `grid/src/api/operator/cognitive-snapshot.ts` (header-auth) + existing spawn path emitting `nous.spawned` | exact |
| `steward/src/app/system/spawn/page.tsx` (new) | component | wizard flow | `steward/src/app/nous/[id]/page.tsx` "Force Telos" form pattern | role-match |

### Cross-cutting

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| Portal frozen-check middleware (new under `grid/src/api/portal/`) | middleware | request-response | existing `grid/src/api/portal/auth.ts` SIWE preHandler | role-match |
| `scripts/check-operator-sanctions-plaintext.mjs` (new) | CI gate | static-analysis | `scripts/check-cognitive-snapshot-plaintext.mjs` | exact |
| Regression tests under `grid/test/operator/` | test | n/a | `grid/test/audit/operator-exported-producer-boundary.test.ts` | exact |

---

## Pattern Assignments

### Wave 0 — Header-auth migration (apply to all 6 routes)

**Canonical analog:** `grid/src/api/operator/cognitive-snapshot.ts`

**Pattern: Replace `validateTierBody(body, 'H?')` with header reads.**

Current (body-trust, what each of the 6 routes does today — example from `clock-pause-resume.ts:33-42`):
```typescript
app.post<{ Body: OperatorBody }>(
    '/api/v1/operator/clock/pause',
    async (req, reply) => {
        const v = validateTierBody(req.body ?? {}, 'H3');
        if (!v.ok) {
            reply.code(400);
            return { error: v.error } satisfies ApiError;
        }
        // ... uses v.tier, v.operator_id
```

Replace with header-trust block (verbatim from `cognitive-snapshot.ts:65-90`):
```typescript
// 1. Tier gate — read from server-trusted x-operator-tier header (D-25a-04).
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
if (tierNum < 3) {  // ← adjust per route: 3 for H3 routes, 4 for H4, 5 for H5
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}

// 1b. Operator-id gate — read from server-trusted x-operator-id header.
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
const resolvedTier: 'H3' = 'H3';  // ← literal per route
const resolvedOperatorId = opIdHeader;
```

**Per-route tier mapping (read into header gate constant):**
| Route | Tier | `if (tierNum < N)` | `resolvedTier` literal |
|-------|------|---------------------|------------------------|
| clock-pause-resume | H3 | `< 3` | `'H3'` |
| governance-laws | H3 | `< 3` | `'H3'` |
| telos-force | H4 | `< 4` | `'H4'` |
| delete-nous | H5 | `< 5` | `'H5'` |
| memory-query | H2 | `< 2` | `'H2'` |
| export-replay | H5 | `< 5` | `'H5'` |

**Imports to add** (mirrors `cognitive-snapshot.ts:39-42`):
```typescript
import { OPERATOR_ID_REGEX } from '../types.js';
// REMOVE: import { validateTierBody, type OperatorBody } from './_validation.js';
```

**Body type changes:** Drop `OperatorBody` from generic and from extending interfaces. Replace `Body: XBody` with `Body: never` where body is now unused (clock, delete, export — they only used body for tier/operator_id), or with a body type containing only the route-specific fields (telos-force, memory-query, governance-laws keep their non-auth body fields).

**Audit emit:** Replace `v.tier` / `v.operator_id` with `resolvedTier` / `resolvedOperatorId`.

**Regression test pattern** (per route — analog: `grid/test/operator/cognitive-snapshot.test.ts`):
- Body-only request (no `x-operator-tier` header) → expect `401 tier_missing`
- Body claims `tier: 'H5'` but no header → expect `401 tier_missing`
- Header `x-operator-tier: 3` but body `tier: 'H1'` → SUCCESS (body ignored), audit payload sources operator_id from header
- Header `x-operator-id` invalid format → `400 invalid_operator_id`

---

### Wave 1 — Sanction emitters (6 new files)

**Canonical analog:** `grid/src/audit/append-nous-deleted.ts` (already-shipped sole-producer template)

**Pattern: 8-step sole-producer emitter.** Each new emitter is a near-verbatim clone of `append-nous-deleted.ts`, changing only:
1. Function name (`appendOperatorMuted`, etc.)
2. `tier` literal (H3 for muted/forced-sleep, H4 for slashed/quarantined, H5 for human_banned/human_frozen)
3. `action` literal (`'mute'`, `'slash'`, `'quarantine'`, `'force_sleep'`, `'ban_human'`, `'freeze_wallet'`)
4. Event-type string passed to `audit.append('operator.muted', ...)` etc.
5. Extra fields beyond `{tier, action, operator_id, target_did}`: add `tick` (all 6), `amount` (slashed only), `reason_hash` (all 6).
6. Target-DID alias: Nous sanctions use `target_did` (Nous DID). Human sanctions use `human_did` (human DID). Both validated by `DID_RE` since human DIDs share the `did:noesis:` shape.

**Closed-tuple key sets (sorted, per D-25b-07/08):**
```typescript
// muted (5 keys, H3)
['action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier']  // 6
// slashed (6 keys, H4)
['action', 'amount', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier']  // 7
// quarantined (5 keys, H4)
['action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier']  // 6
// forced_sleep (5 keys, H3)
['action', 'operator_id', 'reason_hash', 'target_did', 'tick', 'tier']  // 6
// human_banned (5 keys, H5)
['action', 'human_did', 'operator_id', 'reason_hash', 'tick', 'tier']  // 6
// human_frozen (5 keys, H5)
['action', 'human_did', 'operator_id', 'reason_hash', 'tick', 'tier']  // 6
```

**Template (verbatim from `append-nous-deleted.ts:60-133` — every emitter clones this):**

Header imports (lines 21-23):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

export const HEX64_RE = /^[0-9a-f]{64}$/;
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

8-step body (clone from `append-nous-deleted.ts:60-133`):
1. Operator-id format guard (OPERATOR_ID_RE)
2. Type guard on payload (plain object)
3. Literal guards (`tier === 'H?'`, `action === '?'`)
4. Regex guards on remaining fields (operator_id, target_did/human_did, reason_hash via HEX64_RE, tick non-negative integer)
5. Self-report invariant (`payload.operator_id === operatorId`)
6. Closed-tuple structural check (`Object.keys(payload).sort()` matches EXPECTED_KEYS)
7. Explicit reconstruction (`const cleanPayload = { ... }` — no spread, prevents prototype pollution)
8. `payloadPrivacyCheck(cleanPayload)` belt-and-suspenders
9. `audit.append('operator.muted', operatorId, cleanPayload, payload.target_did)`

**Reason hash discipline (D-25b-11):** `reason_hash` is `sha256(plaintext_reason)` — the plaintext NEVER appears in the audit payload. Reasoning rationale is stored separately in the new sanction-reasons table (Grid-side) for operator-UI lookup. CI grep gate (see Cross-cutting section) ensures no reason plaintext leaks into `grid/src/audit/append-operator-*.ts` or sanction route files.

---

### Wave 1 — Allowlist update

**File:** `grid/src/audit/broadcast-allowlist.ts`

**Pattern:** Append 6 new entries to `ALLOWLIST_MEMBERS` array (current line 75-183, last entry `human.transferred` at position 45).

**Insertion (preserve existing structure — see `broadcast-allowlist.ts:178-183` for the immediately-preceding `human.*` block):**
```typescript
    // Phase 25b (SANCTION-01..06 / D-25b-07/08) — operator sanction events. Allowlist 45→51.
    // All 6 emitted ONLY via grid/src/audit/append-operator-*.ts sole-producer emitters (D-25b-09).
    // Reason plaintext NEVER crosses the wire — only reason_hash (HEX64_RE) per D-25b-11.
    'operator.muted',          // (46) {action, operator_id, reason_hash, target_did, tick, tier:'H3'}
    'operator.slashed',        // (47) {action, amount, operator_id, reason_hash, target_did, tick, tier:'H4'}
    'operator.quarantined',    // (48) {action, operator_id, reason_hash, target_did, tick, tier:'H4'}
    'operator.forced_sleep',   // (49) {action, operator_id, reason_hash, target_did, tick, tier:'H3'}
    'operator.human_banned',   // (50) {action, human_did, operator_id, reason_hash, tick, tier:'H5'}
    'operator.human_frozen',   // (51) {action, human_did, operator_id, reason_hash, tick, tier:'H5'}
```

**Update the count assertion** (currently `ALLOWLIST_MEMBERS.length === 39` comment at line 164 — bring it up to 45 since norm/lore/human entries already brought total to 45; new total 51).

**Tests to update:** `grid/test/audit/broadcast-allowlist.test.ts` (count assertion) + add the 6 new event types to whatever "expected list" snapshot exists there.

---

### Wave 1 — Migration v12

**File:** `grid/src/db/schema.ts`

**Pattern:** Append a new migration entry following the v11 shape (see `schema.ts:218-235`). Migration v12 carries BOTH the sanction-reasons table AND the `human_users.frozen` column (single coherent migration per CONTEXT scope).

```typescript
{
    version: 12,
    name: 'create_sanction_reasons_and_freeze_human_users',
    up: `
        CREATE TABLE IF NOT EXISTS sanction_reasons (
            id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            reason_hash   CHAR(64)        NOT NULL,
            plaintext     TEXT            NOT NULL,
            operator_id   VARCHAR(48)     NOT NULL,
            event_type    VARCHAR(63)     NOT NULL,
            target_did    VARCHAR(255)    NOT NULL,
            tick          BIGINT UNSIGNED NOT NULL,
            created_at    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (id),
            UNIQUE KEY uq_reason_hash (reason_hash),
            INDEX idx_target_tick (target_did, tick)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ALTER TABLE human_users ADD COLUMN frozen TINYINT(1) NOT NULL DEFAULT 0;
    `,
    down: `
        ALTER TABLE human_users DROP COLUMN frozen;
        DROP TABLE IF EXISTS sanction_reasons;
    `,
},
```

`MigrationRunner.executeBlock()` already splits on `;` (see `migration-runner.ts:20-28`) so multi-statement up/down works as-is.

---

### Wave 2/3/4 — New operator routes (7 files, all born header-auth)

**Composite analog:** `grid/src/api/operator/cognitive-snapshot.ts` (auth + error ladder) + `grid/src/api/operator/delete-nous.ts` (ORDER-LOCKED gates + sole-producer emit on success only).

**Template for a sanction route (e.g., `mute-broadcast.ts`):**

```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import { appendOperatorMuted } from '../../audit/append-operator-muted.js';
import { createHash } from 'node:crypto';

interface MuteBody {
    reason?: unknown;  // plaintext; never enters audit payload
}

export function registerMuteBroadcastRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Params: { did: string }; Body: MuteBody }>(
        '/api/v1/operator/nous/:did/mute',
        async (req, reply) => {
            // 1. Header-auth gates (clone cognitive-snapshot.ts:65-90).
            //    tierNum < 3 → 403 tier_too_low; resolvedTier = 'H3'.
            // 2. DID shape gate (clone :92-97).
            // 3. Tombstone check (clone :99-110).
            // 4. Runner lookup — 404 unknown_nous (clone :112-117).
            //    (delete-nous order: tombstone → despawn → emit. Sanction order: enforce → emit.)
            // 5. Reason hash — sha256(plaintext). Plaintext written to sanction_reasons table.
            const reasonPlain = typeof req.body?.reason === 'string' ? req.body.reason : '';
            const reasonHash = createHash('sha256').update(reasonPlain).digest('hex');
            // (insert into sanction_reasons table; on duplicate reason_hash, idempotent)
            // 6. Apply the sanction at the broadcast boundary (mute = registry/runner flag).
            // 7. Emit operator.muted via sole-producer emitter (success path only).
            appendOperatorMuted(services.audit, resolvedOperatorId, {
                tier: 'H3',
                action: 'mute',
                operator_id: resolvedOperatorId,
                target_did: targetDid,
                tick: services.clock.state.tick,
                reason_hash: reasonHash,
            });
            return { ok: true };
        },
    );
}
```

**Per-route variation:**
| Route | Tier | New audit event | Special action |
|-------|------|-----------------|----------------|
| `mute-broadcast.ts` | H3 | `operator.muted` | Set `runner.muteFlag = true` (suppress broadcasts at NousRunner emitter boundary per D-25b-NEW-3) |
| `slash-coin.ts` | H4 | `operator.slashed` | Body adds `amount: number`; debit Nous wallet |
| `quarantine.ts` | H4 | `operator.quarantined` | Set `registry.quarantineFlag = true`; peer-discovery filters |
| `force-sleep.ts` | H3 | `operator.forced_sleep` | Trigger Hypnos sleep entry — Brain owns sleep state; Grid emits `operator.forced_sleep` THEN `nous.sleep.entered` follows via existing Phase 16 path |
| `ban-human.ts` | H5 | `operator.human_banned` | Set `human_users.banned = 1` (add column? or reuse `frozen`? — planner decides) |
| `freeze-wallet.ts` | H5 | `operator.human_frozen` | `UPDATE human_users SET frozen = 1 WHERE did = ?` |
| `spawn-system-nous.ts` | H5 | `nous.spawned` (reused, no new event) | Treasury-fund + Nous bootstrap — planner picks treasury source |

**Force-sleep specific (D-25b-NEW-3):** Force-sleep route emits `operator.forced_sleep` then the existing Phase 16 sleep machinery emits `nous.sleep.entered` / `nous.sleep.completed` via `grid/src/sleep/appendNousSleepEntered.ts`. The audit chain shows: `operator.forced_sleep` → `nous.sleep.entered` → `nous.sleep.completed`, distinguishing forced from natural sleep purely by the upstream operator event.

**Ban-human vs freeze-wallet target validation:** Both take `human_did` URL param (not Nous DID). Same `DID_REGEX` check passes (shared `did:noesis:` shape). Tombstone check N/A for humans (no human tombstones in v2.5).

**Register all 7 routes in `grid/src/api/operator/index.ts`** following the existing barrel pattern (see `index.ts:14-31`).

---

### Wave 2/3 — Steward UI sanctions panels

**Analogs:**
- **Danger Zone shape** for the per-sanction confirm box — `steward/src/app/nous/[id]/page.tsx:842-952` (Phase 8 H5 IrreversibilityDialog pattern: requires typing Nous name + reason).
- **Force Telos form shape** for H3 single-click + reason prompt — `steward/src/app/nous/[id]/page.tsx:751-839` (Phase 6 H3 pattern).
- **Header-auth fetch pattern** — `steward/src/app/nous/[id]/page.tsx:221-231` (sends `x-operator-tier` + `x-operator-id` headers, no body auth fields).

**Pattern for `/nous/[id]` Sanctions card (add new card after Force Telos, before Danger Zone):**

```tsx
{/* Sanctions */}
<div className="steward-card" style={{ marginBottom: 24 }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)',
                  fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>
        Sanctions
    </div>
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* H3 single-click + reason: mute, force-sleep */}
        <SanctionRow tier="H3" action="mute"  endpoint={`/api/v1/operator/nous/${id}/mute`} />
        <SanctionRow tier="H3" action="force-sleep" endpoint={`/api/v1/operator/nous/${id}/force-sleep`} />
        {/* H4 single-click + reason (slash adds amount field): quarantine, slash */}
        <SanctionRow tier="H4" action="quarantine" endpoint={`/api/v1/operator/nous/${id}/quarantine`} />
        <SanctionRow tier="H4" action="slash" endpoint={`/api/v1/operator/nous/${id}/slash`} extraField="amount" />
    </div>
</div>
```

Each sanction submit uses the **fetch header-auth pattern** (clone of `[id]/page.tsx:221-231`):
```typescript
const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/mute`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-operator-tier': '3',
        'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID
            ?? 'op:00000000-0000-4000-8000-000000000001',
    },
    body: JSON.stringify({ reason: reasonText }),
});
```

**H5 confirm dialog (ban-human, freeze-wallet)** clones the Danger Zone pattern (`[id]/page.tsx:860-951`): requires typing the human name/DID + reason; submit button disabled until confirm string matches.

**For `/humans/[did]` Sanctions panel:** add as a new tab "Sanctions" alongside Profile/History/Nous (TABS array at `humans/[did]/page.tsx:118-122`). Inside the tab panel, two H5 SanctionRow cards (ban-human, freeze-wallet) each cloning the Danger Zone shape with typed-confirmation.

---

### Wave 3 — Portal middleware (frozen check)

**Analog:** `grid/src/api/portal/auth.ts` (existing SIWE preHandler). Pattern: Fastify `preHandler` hook that reads session DID, queries `human_users` table, blocks with 403 if `frozen = 1`.

**File:** new `grid/src/api/portal/check-frozen.ts` (or extend `auth.ts`).

**Pattern:** preHandler queries the DB once per request, attaches `req.humanFrozen` flag. Downstream action handlers (chat, tip, spawn — phases 26/27) check the flag and return 403 `human_frozen` before doing any work. SIWE sign-in itself does NOT check (frozen humans can still authenticate to see their status).

```typescript
app.addHook('preHandler', async (req, reply) => {
    if (!isPortalActionRoute(req.url)) return;  // skip auth-only routes
    const humanDid = req.session?.humanDid;
    if (!humanDid) return;  // auth middleware will handle
    const row = await db.queryOne(
        'SELECT frozen FROM human_users WHERE did = ?', [humanDid],
    );
    if (row?.frozen === 1) {
        reply.code(403);
        return { error: 'human_frozen' };
    }
});
```

---

### Cross-cutting — CI plaintext gate

**Analog:** `scripts/check-cognitive-snapshot-plaintext.mjs` (verbatim structure).

**New file:** `scripts/check-operator-sanctions-plaintext.mjs`

Clone the entire script structure (`check-cognitive-snapshot-plaintext.mjs:1-246`), changing only:

1. **Forbidden keys** (lines 33-40 in analog):
   ```javascript
   const FORBIDDEN_KEYS = [
       'reason_text',
       'reason_plaintext',
       'reason_body',
       'plaintext_reason',
   ];
   ```

2. **Scanned scopes** (lines 196-205 in analog):
   ```javascript
   const gridEmitterFiles = walk('grid/src/audit').filter(f => /append-operator-/.test(norm(f)));
   const gridRouteFiles   = walk('grid/src/api/operator').filter(f =>
       /(mute|slash|quarantine|force-sleep|ban-human|freeze-wallet|spawn-system-nous)/.test(norm(f)));
   const gridTestFiles    = walk('grid/test/operator').filter(f => /sanction|mute|slash|quarantine|ban|freeze/.test(norm(f)));
   ```

3. **Exempt paths** (lines 50-55): keep `broadcast-allowlist.ts` exempt; add this script itself.

Wire into `package.json` test/lint pipeline alongside the existing cognitive-snapshot gate.

---

## Shared Patterns

### S1. Header-auth (applies to ALL 13 controller files in scope — 6 Wave-0 + 6 sanctions + spawn)

**Source:** `grid/src/api/operator/cognitive-snapshot.ts:65-90`
**Apply to:** Every operator.* route (existing migrations + new sanctions + spawn-system-nous)

Already excerpted above in Wave-0 section. The block is identical across all routes except for the tier threshold (`< N`) and resolved-tier literal.

### S2. Closed-tuple sole-producer emitter (applies to all 6 new audit emitters)

**Source:** `grid/src/audit/append-nous-deleted.ts:60-133`
**Apply to:** `append-operator-muted.ts`, `append-operator-slashed.ts`, `append-operator-quarantined.ts`, `append-operator-forced-sleep.ts`, `append-operator-human-banned.ts`, `append-operator-human-frozen.ts`

8 steps verbatim: operator-id guard → payload type guard → literal guards → regex/range guards → self-report invariant → closed-tuple structural check → explicit reconstruction → privacy gate → `audit.append(...)`.

### S3. Producer-boundary test (one per new emitter)

**Source:** `grid/test/audit/operator-exported-producer-boundary.test.ts` (exists for `operator.exported`).
**Apply to:** Each of the 6 new event types — assert via grep that NO file in `grid/src/` other than the dedicated `append-operator-*.ts` calls `audit.append('operator.muted', ...)` etc. Closes the AGENCY-03 sole-producer invariant for each new event type.

### S4. Error ladder (applies to all 7 new operator routes)

**Source:** `grid/src/api/operator/cognitive-snapshot.ts:25-33` (canonical comment block) + the route body.

| Code | Trigger |
|------|---------|
| 400 | `invalid_did` (URL param fails DID_REGEX), `invalid_operator_id` (header fails OPERATOR_ID_REGEX) |
| 401 | `tier_missing` (no/non-numeric `x-operator-tier` header) |
| 403 | `tier_too_low` (header tier < required) |
| 404 | `unknown_nous` (no runner for DID) |
| 410 | `gone` (tombstoned DID — Nous sanctions only) |
| 200 | success — audit emit happens here, ONCE |

No 500s. Errors NEVER emit audit events (sole-producer invariant + Pitfall 4).

### S5. Steward fetch header-auth pattern (applies to all new UI submit handlers)

**Source:** `steward/src/app/nous/[id]/page.tsx:221-231`

```typescript
headers: {
    'Content-Type': 'application/json',
    'x-operator-tier': '3',  // or 4/5 per action
    'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID
        ?? 'op:00000000-0000-4000-8000-000000000001',
},
```

---

## No Analog Found

None. Every file in 25b scope has a strong existing analog. The phase is fundamentally a clone-and-vary exercise over already-proven Phase 6 / Phase 8 / Phase 13 / Phase 25a patterns.

---

## Metadata

**Analog search scope:**
- `grid/src/api/operator/` (12 files)
- `grid/src/audit/` (12 files)
- `grid/src/db/` (3 files)
- `grid/src/sleep/` (4 files)
- `grid/src/api/portal/` (3 files)
- `steward/src/app/` (selected pages)
- `scripts/` (3 plaintext gates)
- `grid/test/audit/` + `grid/test/operator/` (test analogs)

**Files scanned:** ~45 source files + 5 test files
**Pattern extraction date:** 2026-05-21
