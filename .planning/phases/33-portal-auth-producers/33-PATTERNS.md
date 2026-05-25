# Phase 33: portal-auth-producers — Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/audit/append-human-identified.ts` | sole-producer | request-response | `grid/src/audit/append-human-joined.ts` | exact |
| `grid/src/audit/append-portal-auth-login.ts` | sole-producer | request-response | `grid/src/audit/append-nous-spawned-by-human.ts` | exact |
| `grid/src/audit/append-portal-auth-register.ts` | sole-producer | request-response | `grid/src/audit/append-nous-spawned-by-human.ts` | exact |
| `grid/src/api/portal/auth.ts` (4 wiring sites) | wiring call-site | request-response | `grid/src/api/portal/auth.ts` lines 117-131 (existing `appendHumanJoined` call) | exact |
| `grid/src/audit/broadcast-allowlist.ts` (3 sites) | allowlist registration | CRUD | `grid/src/audit/broadcast-allowlist.ts` lines 202-206 (Phase 28 `nous.spawned_by_human`) | exact |
| `grid/test/portal-auth-login.test.ts` | test harness | request-response | `grid/test/audit-persistence-wiring.test.ts` | role-match |
| `grid/test/portal-auth-register.test.ts` | test harness | request-response | `grid/test/audit-persistence-wiring.test.ts` | role-match |
| `grid/test/human-identified.test.ts` | test harness | request-response | `grid/test/audit-persistence-wiring.test.ts` | role-match |
| `grid/test/portal-auth-forbidden-keys.test.ts` | test harness | request-response | `grid/test/audit.test.ts` | role-match |
| `grid/test/portal-auth-wiring.test.ts` | test harness | request-response | `grid/test/audit-persistence-wiring.test.ts` | role-match |
| `grid/src/__tests__/audit-query-perf.test.ts` | test harness (soft-log) | batch | `grid/test/audit.test.ts` | role-match |
| `scripts/check-sole-producer-discipline.mjs` | CI gate script | batch | `scripts/check-no-silent-catch.mjs` | exact |
| `scripts/check-state-doc-sync.mjs` (extend) | CI gate script | batch | `scripts/check-state-doc-sync.mjs` lines 50-121 | exact |
| `.github/workflows/rig-invariants.yml` (extend) | CI gate workflow | batch | `.github/workflows/rig-invariants.yml` lines 27-35 | exact |

---

## Pattern Assignments

### `grid/src/audit/append-human-identified.ts` (sole-producer, 5-key payload + closed enum)

**Analog:** `grid/src/audit/append-human-joined.ts` (lines 1-114 — read complete file)

**Verified:** File exists at `/Users/desirey/Programming/src/Noesis/grid/src/audit/append-human-joined.ts`, 114 lines.

**New additions vs analog:** (a) `identity_method` closed-enum guard AFTER HEX64_RE guard and BEFORE non-empty-string guard; (b) 5-key payload instead of 4-key; (c) `HEX64_RE` renamed field: `identity_hash` instead of `eth_address_hash`; (d) no `eth_address_hash` field.

**Imports pattern** (lines 1-4 of analog):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
// Phase 33 new files also import: DID_RE, HEX64_RE from './append-human-joined.js'
```

**Exported regex constants** (lines 24-31 of analog — Phase 33 files import these; do NOT redeclare):
```typescript
// From append-human-joined.ts — reuse via import, don't redeclare:
export const HEX64_RE = /^[0-9a-f]{64}$/;
export const DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;
```

**Payload interface pattern** (lines 34-39 of analog):
```typescript
/** Closed 4-key payload for human.joined (WEB3-04). */
export interface HumanJoinedPayload {
    readonly human_did: string;         // DID_RE
    readonly eth_address_hash: string;  // HEX64_RE — SHA-256 of lowercased ETH address
    readonly grid_name: string;         // non-empty string
    readonly tick: number;              // non-negative integer
}
```
Phase 33 `HumanIdentifiedPayload` is 5-key alphabetical: `grid_name`, `human_did`, `identity_hash`, `identity_method`, `tick`. The closed enum is `identity_method: 'siwe' | 'email'`.

**EXPECTED_KEYS constant** (line 42 of analog):
```typescript
const EXPECTED_KEYS = ['eth_address_hash', 'grid_name', 'human_did', 'tick'] as const;
// Phase 33 equivalent:
const IDENTITY_METHOD_ENUM = ['email', 'siwe'] as const;  // alphabetical
const EXPECTED_KEYS = ['grid_name', 'human_did', 'identity_hash', 'identity_method', 'tick'] as const;
```

**Core function — all 9 guard steps** (lines 50-114 of analog — COPY LINE-BY-LINE, adapting field names):
```typescript
export function appendHumanJoined(
    audit: AuditChain,
    payload: HumanJoinedPayload,
): AuditEntry {
    // 1. Type guard on payload.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendHumanJoined: payload must be a plain object`);
    }

    // 2. Regex guard: human_did.
    if (typeof payload.human_did !== 'string' || !DID_RE.test(payload.human_did)) {
        throw new TypeError(
            `appendHumanJoined: human_did must match DID_RE (did:noesis:...), got ${JSON.stringify(payload.human_did)}`,
        );
    }

    // 3. Regex guard: eth_address_hash (64-hex SHA-256 of lowercased ETH address).
    if (typeof payload.eth_address_hash !== 'string' || !HEX64_RE.test(payload.eth_address_hash)) {
        throw new TypeError(
            `appendHumanJoined: eth_address_hash must be 64 hex chars (SHA-256), got ${JSON.stringify(payload.eth_address_hash)}`,
        );
    }

    // 4. Non-empty string guard: grid_name.
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(
            `appendHumanJoined: grid_name must be a non-empty string`,
        );
    }

    // 5. Non-negative integer guard: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(
            `appendHumanJoined: tick must be a non-negative integer, got ${JSON.stringify(payload.tick)}`,
        );
    }

    // 6. Closed-tuple structural check (alphabetical key order matches EXPECTED_KEYS).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendHumanJoined: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 7. Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = {
        eth_address_hash: payload.eth_address_hash,
        grid_name: payload.grid_name,
        human_did: payload.human_did,
        tick: payload.tick,
    };

    // 8. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendHumanJoined: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 9. Commit to chain.
    return audit.append('human.joined', payload.human_did, cleanPayload);
}
```

**Phase 33 enum guard insertion** — insert as new step 4 (after HEX64_RE guard, before non-empty-string guard):
```typescript
    // 4. Closed-enum guard: identity_method.
    if (!IDENTITY_METHOD_ENUM.includes(payload.identity_method as typeof IDENTITY_METHOD_ENUM[number])) {
        throw new TypeError(
            `appendHumanIdentified: identity_method must be one of ${JSON.stringify(IDENTITY_METHOD_ENUM)}, got ${JSON.stringify(payload.identity_method)}`,
        );
    }
```

---

### `grid/src/audit/append-portal-auth-login.ts` (sole-producer, 3-key payload + closed enum)

**Analog:** `grid/src/audit/append-nous-spawned-by-human.ts` (lines 1-106 — read complete file)

**Verified:** File exists. 106 lines. 4-key payload, no enum. Phase 33 version is 3-key with `method` closed enum.

**Structural differences vs analog:** (a) 3-key payload: `human_did`, `method`, `tick` (no `grid_name`, no second DID); (b) `method` closed-enum check replaces second DID_RE guard; (c) event type string is `'portal.auth.login'`; (d) actorDid passed to `audit.append` is `payload.human_did`.

**Imports** (copy from `append-nous-spawned-by-human.ts` lines 22-25, adapt):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';
```

**Payload + EXPECTED_KEYS** (adapt from `append-nous-spawned-by-human.ts` lines 27-36):
```typescript
const LOGIN_METHOD_ENUM = ['email', 'siwe'] as const;  // alphabetical

export interface PortalAuthLoginPayload {
    readonly human_did: string;  // DID_RE
    readonly method: 'siwe' | 'email';  // closed enum
    readonly tick: number;  // non-negative integer
}

const EXPECTED_KEYS = ['human_did', 'method', 'tick'] as const;
```

**Guard sequence** (adapt `append-nous-spawned-by-human.ts` lines 48-105):
1. Type guard (identical shape)
2. DID_RE guard on `human_did`
3. Closed-enum guard on `method` (replaces second DID_RE guard in analog)
4. Non-negative integer guard on `tick`
5. Closed-tuple structural check via `Object.keys(payload).sort()`
6. Explicit reconstruction: `{ human_did, method, tick }`
7. `payloadPrivacyCheck(cleanPayload)`
8. `return audit.append('portal.auth.login', payload.human_did, cleanPayload);`

---

### `grid/src/audit/append-portal-auth-register.ts` (sole-producer, 3-key payload + closed enum)

**Analog:** Same as `append-portal-auth-login.ts` — identical structure.

**Only differences:** function name `appendPortalAuthRegister`, interface name `PortalAuthRegisterPayload`, enum constant `REGISTER_METHOD_ENUM`, event type string `'portal.auth.register'`, error message prefix `appendPortalAuthRegister:`.

Copy `append-portal-auth-login.ts` verbatim after it is created, substituting those 5 strings.

---

### `grid/src/api/portal/auth.ts` — 4 wiring call-sites

**Analog:** `grid/src/api/portal/auth.ts` lines 117-131 (existing `appendHumanJoined` call)

**Verified:** File exists. Current wiring anchor confirmed:
- Line 115: `let human = humanRegistry.findByAddress(gridName, ethAddress);`
- Line 116: `const isNew = human === undefined;`
- Line 117: `if (!human) {`
- Line 118: `human = humanRegistry.createHuman({ eth_address: ethAddress, grid_name: gridName });`
- Line 121-123: `const eth_address_hash = createHash('sha256').update(ethAddress.toLowerCase()).digest('hex');`
- Line 125-130: `appendHumanJoined(services.audit, { ... });`
- Line 131: `}` (closes `if (!human)`)
- Lines 133+: JWT issuance (untouched)

**SIWE email-signup anchor:**
- Line 188: `const password_hash = await hashPassword(password);`
- Line 189: `const human = services.humanRegistry.createHuman({ email, password_hash, grid_name: gridName });`
- Lines 195+: JWT issuance (untouched)

**SIWE email-signin anchor:**
- Line 249: `const valid = await verifyPassword(password, storedHash);`
- Line 250: `if (!valid) { return reply.status(401)... }`
- Line 253: blank — Phase 33 `appendPortalAuthLogin` inserts here
- Lines 254+: JWT issuance (`const { privateKey } = await keyPairPromise;`)

**Imports to add** (modeled on line 23's existing import):
```typescript
import { appendHumanJoined } from '../../audit/append-human-joined.js';
// Phase 33 adds below line 23:
import { appendHumanIdentified } from '../../audit/append-human-identified.js';
import { appendPortalAuthLogin } from '../../audit/append-portal-auth-login.js';
import { appendPortalAuthRegister } from '../../audit/append-portal-auth-register.js';
```

**SIWE first-connect wiring** (insert after line 130, still inside `if (!human)` block):
```typescript
            appendHumanIdentified(services.audit, {
                grid_name: gridName,
                human_did: human.did,
                identity_hash: eth_address_hash,  // reuses existing computed value
                identity_method: 'siwe',
                tick: services.clock.state.tick,
            });

            appendPortalAuthRegister(services.audit, {
                human_did: human.did,
                method: 'siwe',
                tick: services.clock.state.tick,
            });
```

**SIWE unconditional login wiring** (insert after line 131 — after closing brace of `if (!human)`):
```typescript
        appendPortalAuthLogin(services.audit, {
            human_did: human.did,
            method: 'siwe',
            tick: services.clock.state.tick,
        });
```

**Email signup wiring** (insert after line 193 — after `createHuman` call, before JWT issuance):
```typescript
        const email_hash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

        appendHumanIdentified(services.audit, {
            grid_name: gridName,
            human_did: human.did,
            identity_hash: email_hash,
            identity_method: 'email',
            tick: services.clock.state.tick,
        });

        appendPortalAuthRegister(services.audit, {
            human_did: human.did,
            method: 'email',
            tick: services.clock.state.tick,
        });

        appendPortalAuthLogin(services.audit, {
            human_did: human.did,
            method: 'email',
            tick: services.clock.state.tick,
        });
```

**Email signin wiring** (insert after line 252 `if (!valid)` block closes, before JWT issuance):
```typescript
        appendPortalAuthLogin(services.audit, {
            human_did: human.did,
            method: 'email',
            tick: services.clock.state.tick,
        });
```

**DO NOT TOUCH:** Lines 308-312 (`console.warn`) and line 356 (`console.error`). Per D-33-E1.

---

### `grid/src/audit/broadcast-allowlist.ts` — 3 modification sites

**Analog for allowlist entries:** Lines 202-206 (`nous.spawned_by_human` at position 53 — most recent addition)

**Verified:** Line 205 reads `'nous.spawned_by_human',   // (53)` followed by `] as const;` on line 206.

**ALLOWLIST_MEMBERS append** (insert before `] as const;` on line 206):
```typescript
    // Phase 33 (OBS-08, OBS-09, OBS-08b) — Portal auth lifecycle events. Allowlist 53→56.
    // portal.auth.login: closed 3-key payload {human_did, method, tick}. method ∈ {siwe, email}.
    // Emitted ONLY via appendPortalAuthLogin() (grid/src/audit/append-portal-auth-login.ts).
    'portal.auth.login',    // (54) {human_did, method, tick}
    // portal.auth.register: closed 3-key payload {human_did, method, tick}. method ∈ {siwe, email}.
    // Emitted ONLY via appendPortalAuthRegister() (grid/src/audit/append-portal-auth-register.ts).
    'portal.auth.register', // (55) {human_did, method, tick}
    // human.identified: universal identity-stamp. closed 5-key payload
    // {grid_name, human_did, identity_hash, identity_method, tick}. identity_method ∈ {siwe, email}.
    // Emitted ONLY via appendHumanIdentified() (grid/src/audit/append-human-identified.ts).
    'human.identified',     // (56) {grid_name, human_did, identity_hash, identity_method, tick}
```

**Analog for FORBIDDEN_KEYS export:** Lines 284-297 (`GOVERNANCE_FORBIDDEN_KEYS` — most recently using `Object.freeze([...] as const)` shape)

**Verified:** Lines 284-297 use `export const GOVERNANCE_FORBIDDEN_KEYS = Object.freeze([...] as const);`

**PORTAL_AUTH_FORBIDDEN_KEYS sibling** (insert after `WHISPER_FORBIDDEN_KEYS` export, around line 407):
```typescript
/**
 * Phase 33 (OBS-10 / D-33-B3): portal-auth-leaf keys that MUST NOT appear in any
 * portal.auth.* or human.identified payload. PII (IP, User-Agent, email plaintext,
 * session tokens, JWT, cookies, password, nonce, signature, device fingerprint)
 * is permanently forbidden from the audit chain.
 * Only hash representations (email_hash, identity_hash) are permitted — never plaintext.
 * Per D-33-B3 — exactly 13 keys. Do NOT add extras without a CONTEXT.md decision.
 */
export const PORTAL_AUTH_FORBIDDEN_KEYS = Object.freeze([
    'ip_address',
    'ip',
    'user_agent',
    'ua',
    'session_id',
    'token',
    'jwt',
    'cookie',
    'email',
    'password_hash',
    'nonce',
    'signature',
    'device_fingerprint',
] as const);
```

**FORBIDDEN_KEY_PATTERN extension** (line 444 — append to end of regex before the `/i` flag):
```typescript
// Current end of pattern (line 444):
// ...reflexion_text|creed_text|whisper_plaintext/i
// Phase 33 append (word-boundary anchored for multi-word/collision-risk keys):
// ...reflexion_text|creed_text|whisper_plaintext|\b(?:ip_address|user_agent|session_id|jwt|password_hash|device_fingerprint)\b/i
```

Note: `email`, `nonce`, `ip`, `ua`, `session_id`, `token`, `cookie`, `signature` do not use `\b` wrappers — they follow the non-boundary convention already in the regex. Only the 6 multi-word or collision-risk keys get `\b...\b`. The `content(?!_hash)` lookahead already covers `content` vs `content_hash`.

---

### `scripts/check-sole-producer-discipline.mjs` (NEW CI gate script)

**Analog:** `scripts/check-no-silent-catch.mjs` (lines 1-136 — read complete file)

**Verified:** File exists, 136 lines. Exact structural template: shebang → JSDoc header → imports → `ROOT` constant → `SCAN_DIRS` array → `EXCLUDE_*` constants → `RULES` array → `walkDir` generator → `scanFile` function → run-scan block → pass/fail exit.

**Structural differences vs analog:**
- `SCAN_DIRS` expands to ~10 directory globs across all sole-producer directories (see D-33-D1)
- `RULES` array has 3 checks instead of 2: presence of `Object.keys(payload).sort()`, presence of `payloadPrivacyCheck`, presence of `audit.append(`
- Gate logic: ALL THREE must appear in each file (AND not OR)
- Exit message references `"Phase 33 D-33-D1"`

**Header and imports** (copy from `check-no-silent-catch.mjs` lines 1-29):
```javascript
#!/usr/bin/env node
/**
 * scripts/check-sole-producer-discipline.mjs
 *
 * Phase 33 OBS-09 (D-33-D1) CI gate. Blocks PRs where any sole-producer
 * audit emitter file is missing one of the three required triad elements:
 *   1. Object.keys(payload).sort()  — closed-tuple structural check
 *   2. payloadPrivacyCheck          — privacy gate
 *   3. audit.append(               — chain commit
 *
 * Covers all 38 sole-producer files (13 existing audit/ + 3 new Phase 33 +
 * ananke/ + bios/ + sleep/ + iris/ + skills/ + norms/ + lore/ + governance/ + whisper/).
 *
 * Exit codes:
 *   0 — clean: all sole-producer files contain the full triad.
 *   1 — at least one violation found; output identifies file:missing-check.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
```

**SCAN_DIRS pattern** (adapt from `check-no-silent-catch.mjs` lines 32-35):
```javascript
const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'audit'),            // append-*.ts files
    join(ROOT, 'grid', 'src', 'ananke'),           // append-drive-crossed.ts
    join(ROOT, 'grid', 'src', 'bios'),             // appendBiosBirth.ts, appendBiosDeath.ts
    join(ROOT, 'grid', 'src', 'sleep'),            // appendNousSleep*.ts
    join(ROOT, 'grid', 'src', 'iris'),             // append*.ts (4 files)
    join(ROOT, 'grid', 'src', 'skills'),           // append*.ts (3 files)
    join(ROOT, 'grid', 'src', 'norms'),            // append*.ts (2 files)
    join(ROOT, 'grid', 'src', 'lore'),             // append*.ts (2 files)
    join(ROOT, 'grid', 'src', 'governance'),       // append*.ts (4 files)
    join(ROOT, 'grid', 'src', 'whisper'),          // appendNousWhispered.ts
];
```

**File filter** (restrict to `append` prefix files only — NOT all .ts files in the dirs):
```javascript
// walkDir filter: only files whose basename starts with 'append' (case-sensitive)
} else if (e.isFile() && /\.(ts)$/.test(e.name) && e.name.startsWith('append')) {
    if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
    yield p;
}
```

**Triad check logic** (replace per-line regex scan with per-file content check):
```javascript
function scanFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const missing = [];
    if (!text.includes('Object.keys(payload).sort()')) {
        missing.push('Object.keys(payload).sort()');
    }
    if (!text.includes('payloadPrivacyCheck')) {
        missing.push('payloadPrivacyCheck');
    }
    if (!text.includes('audit.append(')) {
        missing.push('audit.append(');
    }
    return missing.map(check => ({
        file: relative(ROOT, filePath),
        missing: check,
    }));
}
```

**walkDir generator** (copy verbatim from `check-no-silent-catch.mjs` lines 68-86, only change file filter as above).

**Run-scan block** (copy from `check-no-silent-catch.mjs` lines 114-135, adapt messages):
```javascript
console.log('[check-sole-producer-discipline] OK — all sole-producer files contain the full triad.');
// ...
console.error('Phase 33 D-33-D1 requires every sole-producer file to contain: ' +
    'Object.keys(payload).sort() + payloadPrivacyCheck + audit.append(');
```

---

### `scripts/check-state-doc-sync.mjs` — extend existing assertions

**Analog:** `scripts/check-state-doc-sync.mjs` lines 50-121 (existing count assertion + required array)

**Verified:** File exists, 207 lines. Current count assertion at line 51 checks for `"27 events"`. `required` array at lines 78-115 lists 27 members (v2.0 through Phase 13).

**NOTE:** The current script still checks for `"27 events"` — it was never updated through Phases 14-32. Phase 33 D-33-D3 extends it to assert `ALLOWLIST_MEMBERS.length === 56`.

**Existing count check pattern** (line 51):
```javascript
if (!/27\s+events/i.test(state)) {
  failures.push('STATE.md does not mention "27 events" — Phase 13 allowlist count assertion missing.');
}
```

**Phase 33 extends with direct allowlist file check** (new function, modeled on `checkReplayPrefixBan` at lines 127-145):
```javascript
function checkAllowlistCount() {
  const allowlistPath = resolve(repoRoot, 'grid/src/audit/broadcast-allowlist.ts');
  if (!existsSync(allowlistPath)) {
    failures.push(`checkAllowlistCount: ${allowlistPath} not found`);
    return;
  }
  const text = readFileSync(allowlistPath, 'utf8');
  // Count string-quoted entries in ALLOWLIST_MEMBERS (each on its own line starting with quote)
  // Phase 33 target: 56 members (positions 1-56)
  const members = text.match(/^\s+'[a-z][a-z0-9_.]+'/gm) ?? [];
  if (members.length !== 56) {
    failures.push(
      `ALLOWLIST_MEMBERS count mismatch: expected 56 entries, found ${members.length}.\n` +
      `  Phase 33 D-33-A1 revised allowlist from 53 to 56 (+3: portal.auth.login, portal.auth.register, human.identified).`
    );
  }
  // Position checks: verify exact strings at expected positions
  const all = text.match(/'[a-z][a-z0-9_.]+'/g) ?? [];
  if (!text.includes("'portal.auth.login'"))    failures.push('ALLOWLIST missing portal.auth.login (position 54)');
  if (!text.includes("'portal.auth.register'")) failures.push('ALLOWLIST missing portal.auth.register (position 55)');
  if (!text.includes("'human.identified'"))     failures.push('ALLOWLIST missing human.identified (position 56)');
}
checkAllowlistCount();
```

Also add `'portal.auth.login'`, `'portal.auth.register'`, `'human.identified'` to the `required` array (lines 78-115) so the STATE.md text-presence check also fires for v2.6 entries.

---

### `.github/workflows/rig-invariants.yml` — add Phase 33 gate step

**Analog:** `.github/workflows/rig-invariants.yml` lines 27-35 (Phase 31 + 32 steps)

**Verified:** File exists, 41 lines. Current gate steps:
```yaml
      - name: OBS-03 no-silent-catch gate (Phase 31)
        run: node scripts/check-no-silent-catch.mjs

      - name: OBS-R-32-01 observability-no-TODO gate (Phase 32)
        run: node scripts/check-observability-no-todo.mjs

      - name: OBS-R-32-02 setInterval-lifecycle gate (Phase 32)
        run: node scripts/check-interval-lifecycle.mjs
```

**Phase 33 step to add** (insert after the Phase 32 steps, before the Vitest step):
```yaml
      - name: OBS-09 sole-producer-discipline gate (Phase 33)
        run: node scripts/check-sole-producer-discipline.mjs
```

Step naming convention from D-32-D1: `"OBS-R-N-NN gate (Phase N)"` for risk-mitigations, `"OBS-NN gate (Phase N)"` for direct OBS requirement gates. Phase 33 uses `OBS-09` (direct requirement gate per D-33-D1).

---

### Test files — `grid/test/portal-auth-login.test.ts`, `portal-auth-register.test.ts`, `human-identified.test.ts`

**Analog:** `grid/test/audit-persistence-wiring.test.ts` (lines 1-68 — structure pattern)

**Verified:** File exists. Pattern: `import { describe, it, expect, vi, beforeEach } from 'vitest'` → named describe blocks → mock AuditChain → call sole-producer → assert throws or assert chain state.

**Test file structure**:
```typescript
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { appendPortalAuthLogin } from '../src/audit/append-portal-auth-login.js';

describe('appendPortalAuthLogin — sole-producer discipline', () => {
    it('appends portal.auth.login with valid payload', () => {
        const chain = new AuditChain();
        const entry = appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc123',
            method: 'siwe',
            tick: 1,
        });
        expect(entry.eventType).toBe('portal.auth.login');
        expect(entry.actorDid).toBe('did:noesis:human:0xabc123');
        expect(chain.length).toBe(1);
    });

    it('throws TypeError for invalid DID', () => {
        const chain = new AuditChain();
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'not-a-did',
            method: 'siwe',
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for invalid method enum', () => {
        const chain = new AuditChain();
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc123',
            method: 'passkey' as any,
            tick: 1,
        })).toThrow(TypeError);
    });

    it('throws TypeError for extra keys (closed-tuple)', () => {
        const chain = new AuditChain();
        expect(() => appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc123',
            method: 'siwe',
            tick: 1,
            extra_field: 'forbidden',
        } as any)).toThrow(TypeError);
    });

    it('throws TypeError for negative tick', () => { ... });
    it('throws TypeError for non-integer tick', () => { ... });
    it('throws TypeError for empty payload', () => { ... });
});
```

---

### `grid/test/portal-auth-forbidden-keys.test.ts` — 12+ word-boundary regression cases

**Analog:** `grid/test/audit.test.ts` lines 1-80 (test structure) + `broadcast-allowlist.ts` lines 444, 460-490 (`payloadPrivacyCheck` and `FORBIDDEN_KEY_PATTERN`)

**Required test cases** (per D-33-B4):

```typescript
import { describe, it, expect } from 'vitest';
import { payloadPrivacyCheck, PORTAL_AUTH_FORBIDDEN_KEYS } from '../src/audit/broadcast-allowlist.js';

describe('PORTAL_AUTH_FORBIDDEN_KEYS — word-boundary regression', () => {
    // Flat object cases
    it('rejects email (forbidden) but allows email_hash (allowed)', () => {
        expect(payloadPrivacyCheck({ email: 'user@example.com' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ email_hash: 'abc123' }).ok).toBe(true); // allowed
    });
    it('rejects nonce (forbidden) but allows nonce_hash (allowed)', () => {
        expect(payloadPrivacyCheck({ nonce: 'abc' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ nonce_hash: 'abc123' }).ok).toBe(true);
    });
    it('rejects ip_address (\b-bounded)', () => {
        expect(payloadPrivacyCheck({ ip_address: '1.2.3.4' }).ok).toBe(false);
    });
    it('rejects ip (non-bounded) but allows ip_country (allowed — future OBS-FUTURE-METRICS-01)', () => {
        expect(payloadPrivacyCheck({ ip: '1.2.3.4' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ ip_country: 'US' }).ok).toBe(true);
    });
    it('rejects user_agent (\b-bounded)', () => {
        expect(payloadPrivacyCheck({ user_agent: 'Mozilla/5.0' }).ok).toBe(false);
    });
    it('allows agent_version (no user_agent match)', () => {
        expect(payloadPrivacyCheck({ agent_version: '1.0' }).ok).toBe(true);
    });
    it('ALLOWS user_agent_version — \\buser_agent\\b does NOT match (\\b requires \\W boundary; _ is \\w)', () => {
        // JS regex \b fires between \w and \W (or string edge). Between user_agent and _version,
        // the next char is _ (word char), so no boundary triggers. Plan 33-05 corrected this
        // during revision iter 1 after CONTEXT.md D-33-B4 was found to be factually wrong.
        expect(payloadPrivacyCheck({ user_agent_version: '1.0' }).ok).toBe(true);
    });
    it('ALLOWS ip_address_v6 — same \\b-after-_ reason', () => {
        expect(payloadPrivacyCheck({ ip_address_v6: '::1' }).ok).toBe(true);
    });
    it('ALLOWS session_id_legacy — same \\b-after-_ reason', () => {
        expect(payloadPrivacyCheck({ session_id_legacy: 'abc' }).ok).toBe(true);
    });
    // Nested object cases
    it('rejects email nested in object', () => {
        expect(payloadPrivacyCheck({ meta: { email: 'x' } }).ok).toBe(false);
    });
    it('rejects nonce nested in array', () => {
        expect(payloadPrivacyCheck({ items: [{ nonce: 'abc' }] }).ok).toBe(false);
    });
    // All 13 PORTAL_AUTH_FORBIDDEN_KEYS flat
    for (const key of PORTAL_AUTH_FORBIDDEN_KEYS) {
        it(`rejects '${key}' flat`, () => {
            expect(payloadPrivacyCheck({ [key]: 'value' }).ok).toBe(false);
        });
    }
});
```

---

### `grid/test/portal-auth-wiring.test.ts` — emit-count + emit-order assertions

**Analog:** `grid/test/audit-persistence-wiring.test.ts` lines 53-68 (describe structure + launcher wiring pattern)

**Key test cases** (per D-33-A4 emit-order requirements):
```typescript
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';

describe('SIWE first-connect — 4 audit entries in order', () => {
    it('emits human.joined → human.identified → portal.auth.register → portal.auth.login', () => {
        // Use a real AuditChain + call appendHumanJoined/appendHumanIdentified/etc directly.
        // Do NOT use buildServerWithHub/app.inject — this is producer-level discipline, not
        // integration testing. Direct invocation is simpler and avoids Fastify scaffolding.
        // Expected: chain.length === 4
        // chain.at(0).eventType === 'human.joined'
        // chain.at(1).eventType === 'human.identified'
        // chain.at(2).eventType === 'portal.auth.register'
        // chain.at(3).eventType === 'portal.auth.login'
    });
});

describe('SIWE repeat-connect — 1 audit entry', () => {
    it('emits portal.auth.login only', () => {
        // Second call with same address: chain.length === 1
        // chain.at(0).eventType === 'portal.auth.login'
    });
});

describe('email signup — 3 audit entries in order', () => {
    it('emits human.identified → portal.auth.register → portal.auth.login', () => {
        // chain.length === 3, no human.joined
    });
});

describe('email signin — 1 audit entry', () => {
    it('emits portal.auth.login only', () => {
        // chain.length === 1
    });
});
```

**Recommended approach:** Direct producer invocation on an in-process `AuditChain` — import `appendHumanJoined`, `appendHumanIdentified`, `appendPortalAuthLogin`, `appendPortalAuthRegister` and call them in the order the wiring code does. NO Fastify scaffolding, NO `buildServerWithHub`, NO `app.inject()`. This is producer-level discipline testing (verifies the producer triad + emit order), not end-to-end HTTP integration testing. Plan 33-05 Task 3 enforces this with a `grep -c "buildServerWithHub\|app\.inject" → 0` acceptance criterion.

---

### `grid/src/__tests__/audit-query-perf.test.ts` — soft-log perf benchmark

**Analog:** `grid/test/audit.test.ts` lines 1-10 (imports) + D-33-C1 (soft-log, no `expect().toBeLessThan()`)

**Verified:** `grid/src/__tests__/` directory does not yet exist — will be created by Phase 33.

**Structure** (per D-33-C1):
```typescript
import { describe, it } from 'vitest';
import { AuditChain } from '../audit/chain.js';

describe('audit.query perf benchmark — soft-log (D-33-C1)', () => {
    it('audit.query({eventType, actorDid}) p95 perf with 100k entries', () => {
        const chain = new AuditChain();
        // Seed 100k entries spanning multiple event types and actor DIDs
        const EVENT_TYPES = ['portal.auth.login', 'portal.auth.register', 'human.joined', 'human.identified'];
        const ACTOR_DIDS = ['did:noesis:human:0xaaa', 'did:noesis:human:0xbbb', 'did:noesis:human:0xccc'];
        for (let i = 0; i < 100_000; i++) {
            chain.append(
                EVENT_TYPES[i % EVENT_TYPES.length],
                ACTOR_DIDS[i % ACTOR_DIDS.length],
                { tick: i },
            );
        }
        // Run 100 queries and measure latency
        const testDid = ACTOR_DIDS[0];
        const latencies: number[] = [];
        for (let run = 0; run < 100; run++) {
            const t0 = performance.now();
            chain.query({ eventType: 'portal.auth.login', actorDid: testDid });
            latencies.push(performance.now() - t0);
        }
        latencies.sort((a, b) => a - b);
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        // SOFT LOG ONLY — no expect().toBeLessThan() per D-33-C1
        console.log(`[perf] audit.query p95 at 100k entries: ${p95.toFixed(2)}ms (target <50ms)`);
    });
});
```

**Key constraint:** NO `expect().toBeLessThan()` assertion. This is a visibility benchmark, not a hard CI gate. If p95 > 50ms, OBS-FUTURE-INDEX-01 is opened as v2.7 work.

---

## Shared Patterns

### Sole-producer triad (applies to all 3 new `append-*.ts` files)

**Source:** `grid/src/audit/append-human-joined.ts` lines 88-113
**Apply to:** `append-human-identified.ts`, `append-portal-auth-login.ts`, `append-portal-auth-register.ts`

```typescript
    // Structural check — closed-tuple (alphabetical).
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendFoo: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // Explicit reconstruction — no spread, no prototype pollution.
    const cleanPayload = { /* each key individually */ };

    // Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendFoo: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // Commit to chain.
    return audit.append('event.type', payload.human_did, cleanPayload);
```

### Closed-enum guard (NEW for Phase 33 — not in Phase 22 analogs)

**Source:** D-33-A3 (no existing codebase analog — first enum check in any sole-producer)
**Apply to:** All 3 new `append-*.ts` files

```typescript
const METHOD_ENUM = ['email', 'siwe'] as const;  // alphabetical order

    // Enum guard: method.
    if (!METHOD_ENUM.includes(payload.method as typeof METHOD_ENUM[number])) {
        throw new TypeError(
            `appendPortalAuthLogin: method must be one of ${JSON.stringify(METHOD_ENUM)}, got ${JSON.stringify(payload.method)}`,
        );
    }
```

### walkDir + scanFile CI gate pattern

**Source:** `scripts/check-no-silent-catch.mjs` lines 68-112
**Apply to:** `scripts/check-sole-producer-discipline.mjs`

```javascript
function* walkDir(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        if (err && err.code === 'ENOENT') return;
        throw err;
    }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (EXCLUDE_DIR_NAMES.has(e.name)) continue;
            yield* walkDir(p);
        } else if (e.isFile() && /\.(ts|mjs|js)$/.test(e.name)) {
            if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
            yield p;
        }
    }
}
```

### `Object.freeze([...] as const)` pattern for FORBIDDEN_KEYS exports

**Source:** `grid/src/audit/broadcast-allowlist.ts` lines 284-297 (`GOVERNANCE_FORBIDDEN_KEYS`)
**Apply to:** `PORTAL_AUTH_FORBIDDEN_KEYS` declaration

```typescript
export const GOVERNANCE_FORBIDDEN_KEYS = Object.freeze([
    'text',
    'body',
    // ...
] as const);
```

### createHash SHA-256 pattern (auth.ts reuse)

**Source:** `grid/src/api/portal/auth.ts` lines 121-123 (already in file)
**Apply to:** email signup wiring site in the same file

```typescript
const eth_address_hash = createHash('sha256')
    .update(ethAddress.toLowerCase())
    .digest('hex');
// Phase 33 email analog:
const email_hash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
```

`createHash` is already imported at the top of `auth.ts` — no new import needed.

### CI gate workflow step shape

**Source:** `.github/workflows/rig-invariants.yml` lines 27-35
**Apply to:** Phase 33 gate step addition

```yaml
      - name: OBS-03 no-silent-catch gate (Phase 31)
        run: node scripts/check-no-silent-catch.mjs

      - name: OBS-R-32-01 observability-no-TODO gate (Phase 32)
        run: node scripts/check-observability-no-todo.mjs
```

---

## No Analog Found

All files in Phase 33 have close analogs. No entries in this section.

---

## Ground-Truth Verification Notes

The following line numbers were confirmed against the live codebase as of 2026-05-25:

| Claim | Verified |
|---|---|
| `append-human-joined.ts` exists, 114 lines | YES |
| `append-nous-spawned-by-human.ts` exists, 106 lines, 4-key no-enum | YES |
| `broadcast-allowlist.ts` line 80: `ALLOWLIST_MEMBERS` starts | YES |
| `broadcast-allowlist.ts` line 205: `'nous.spawned_by_human'` at position 53 | YES |
| `broadcast-allowlist.ts` line 206: `] as const;` ends ALLOWLIST_MEMBERS | YES |
| `broadcast-allowlist.ts` line 229: `ALLOWLIST` frozen set | YES |
| `broadcast-allowlist.ts` line 284: `GOVERNANCE_FORBIDDEN_KEYS` uses `Object.freeze([...] as const)` | YES |
| `broadcast-allowlist.ts` line 444: `FORBIDDEN_KEY_PATTERN` regex | YES |
| `broadcast-allowlist.ts` line 460: `payloadPrivacyCheck` function | YES |
| `auth.ts` line 115-131: SIWE `findByAddress` → `createHuman` → `appendHumanJoined` block | YES |
| `auth.ts` line 125: `appendHumanJoined` call | YES |
| `auth.ts` line 131: closing brace of `if (!human)` block | YES |
| `auth.ts` line 188-193: email signup `createHuman` block | YES |
| `auth.ts` line 249-252: email signin `valid` check block | YES |
| `check-no-silent-catch.mjs` exists, 136 lines | YES |
| `check-observability-no-todo.mjs` exists, 121 lines | YES |
| `check-interval-lifecycle.mjs` exists, 145 lines | YES |
| `check-state-doc-sync.mjs` exists, 207 lines | YES |
| `rig-invariants.yml` exists, 41 lines | YES |
| `grid/src/__tests__/` directory does NOT yet exist | YES (absent) |
| `ALLOWLIST_MEMBERS` currently has 53 entries (not 55/56) | YES — STATE.md says 53, code confirms `nous.spawned_by_human` at position 53 |

**STATE.md discrepancy noted:** STATE.md line 155 still documents "+2 (53→55)" and positions 54/55 only for Phase 33. D-33-A1 and D-33-F1 require updating to "+3 (53→56)" with position 56 = `human.identified`. The Phase 33 doc-sync plan (33-01 or 33-DOC-SYNC) must update STATE.md, ROADMAP.md, and REQUIREMENTS.md BEFORE producer plans execute.

---

## Metadata

**Analog search scope:** `grid/src/audit/`, `grid/src/api/portal/`, `scripts/`, `.github/workflows/`, `grid/test/`
**Files scanned:** 15 source files read in full or targeted ranges
**Pattern extraction date:** 2026-05-25
