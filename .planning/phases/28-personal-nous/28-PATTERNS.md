# Phase 28: Personal Nous — Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 17 new + 7 edited = 24 total
**Analogs found:** 22 / 24

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/api/portal/spawn.ts` | controller | request-response | `grid/src/api/operator/spawn-system-nous.ts` | exact |
| `grid/src/audit/append-nous-spawned-by-human.ts` | utility | event-driven | `grid/src/audit/append-human-transferred.ts` | exact |
| `grid/src/audit/broadcast-allowlist.ts` (edit) | config | — | self | edit |
| `grid/src/genesis/launcher.ts` (edit) | service | CRUD | self | edit |
| `grid/src/db/schema.ts` (edit) | migration | CRUD | self (migration v14 pattern) | edit |
| `grid/src/api/portal/check-frozen.ts` (edit) | middleware | request-response | self | edit |
| `grid/src/api/portal/chat.ts` (edit) | controller | request-response | self | edit |
| `grid/test/portal/spawn-nous.test.ts` | test | CRUD | `grid/test/audit/broadcast-allowlist.test.ts` | role-match |
| `grid/test/audit/append-nous-spawned-by-human.test.ts` | test | event-driven | existing audit tests | role-match |
| `dashboard/src/app/portal/nous/spawn/page.tsx` | component | request-response | `dashboard/src/app/portal/onboard/page.tsx` | exact |
| `dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx` | component | request-response | `dashboard/src/app/portal/onboard/page.tsx` (state machine) | exact |
| `dashboard/src/app/portal/nous/spawn/StepIndicator.tsx` | component | — | `dashboard/src/app/portal/onboard/WizardStepIndicator.tsx` | exact |
| `dashboard/src/app/portal/nous/spawn/StepName.tsx` | component | request-response | `dashboard/src/app/portal/onboard/StepWelcome.tsx` | role-match |
| `dashboard/src/app/portal/nous/spawn/StepSeed.tsx` | component | — | `dashboard/src/app/portal/onboard/StepWorldTour.tsx` (selection) | role-match |
| `dashboard/src/app/portal/nous/spawn/SeedCard.tsx` | component | — | `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` (card layout) | partial |
| `dashboard/src/app/portal/nous/spawn/StepRegion.tsx` | component | — | `dashboard/src/app/portal/onboard/StepWorldTour.tsx` | role-match |
| `dashboard/src/app/portal/nous/spawn/StepPay.tsx` | component | event-driven | `dashboard/src/components/portal/WalletPanel.tsx` | exact |
| `dashboard/src/app/portal/nous/spawn/WizardSummaryCard.tsx` | component | — | `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` (row layout) | partial |
| `dashboard/src/app/portal/nous/spawn/PaymentPolling.tsx` | component | — | `dashboard/src/app/portal/onboard/StepSophiaChat.tsx` (pulse dots) | role-match |
| `dashboard/src/app/portal/my-nous/OwnerHub.tsx` | component | CRUD | `dashboard/src/app/portal/nous/[id]/page.tsx` | exact |
| `dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx` | component | — | `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` (stat row) | role-match |
| `dashboard/src/components/portal/avatars/PersonalNousAvatar.tsx` | component | — | `dashboard/src/components/portal/avatars/SophiaAvatar.tsx` | exact |
| `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` (edit) | component | — | self | edit |
| `dashboard/src/app/portal/my-nous/page.tsx` (replace) | component | CRUD | `dashboard/src/app/portal/nous/[id]/page.tsx` | exact |

---

## Pattern Assignments

### `grid/src/api/portal/spawn.ts` (controller, request-response)

**Analog:** `grid/src/api/operator/spawn-system-nous.ts`

**Imports pattern** (lines 51–56):
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { jwtVerify } from 'jose';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
import { appendNousSpawnedByHuman } from '../../audit/append-nous-spawned-by-human.js';
```

**Injectable deps pattern** (lines 68–75 of analog — use this shape, swap signature):
```typescript
export interface SpawnHumanNousDeps {
    spawnNous(name: string, did: string, publicKey: string, region: string, humanOwner: string): void;
    queryHasNous(humanDid: string): Promise<boolean>;
    confirmTxPaid(txHash: string): Promise<boolean>;
}
```

**Auth pattern** — copy verbatim from `grid/src/api/portal/chat.ts` lines 148–160:
```typescript
const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) return reply.status(401).send({ error: 'not_authenticated' });
let humanDid: string;
try {
    const { publicKey } = await keyPairPromise;
    const { payload: jwtPayload } = await jwtVerify(token, publicKey);
    humanDid = jwtPayload['did'] as string;
    if (typeof humanDid !== 'string' || !humanDid.startsWith('did:noesis:')) {
        return reply.status(401).send({ error: 'invalid_token' });
    }
} catch {
    return reply.status(401).send({ error: 'invalid_token' });
}
```

**Error ladder** (adapt from `spawn-system-nous.ts` lines 94–178):
```
401 not_authenticated  — JWT cookie absent
401 invalid_token      — JWT verify failed / bad DID
503 spawn_not_enabled  — ALLOW_HUMAN_SPAWNED_NOUS env var not set
503 spawn_unavailable  — deps not wired
409 already_owns_nous  — human already has a Nous
409 name_taken         — grid_name not unique in nous_registry
400 invalid_body       — name validation: /^[a-zA-Z0-9_]{3,32}$/, seed enum, region string
400 payment_not_confirmed — txHash not confirmed by Grid RPC
200 { ok: true, nous_did }
```

**DID generation** (adapt from `spawn-system-nous.ts` line 153):
```typescript
// Extract username prefix from humanDid: did:noesis:human:<eth-addr-hex>
const addrPart = humanDid.replace('did:noesis:human:', '').slice(0, 8).toLowerCase();
const generatedDid = `did:noesis:human-nous:${addrPart}-${name}`;
```

**Key generation** (copy from `spawn-system-nous.ts` lines 78–81):
```typescript
function generatePublicKey(): string {
    const { publicKey } = generateKeyPairSync('ed25519');
    return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}
```

**Env gate** (adapt from `spawn-system-nous.ts` lines 144–149):
```typescript
if (!process.env['ALLOW_HUMAN_SPAWNED_NOUS']) {
    reply.code(503);
    return { error: 'spawn_not_enabled' } satisfies ApiError;
}
```

**Cost from env**:
```typescript
const spawnCostUsdt = process.env['SPAWN_COST_USDT'] ?? '50';
```

**Additional routes on same file:**
- `GET /api/v1/portal/nous/spawn/status/:txHash` — polls EVM RPC, returns `{ confirmed: boolean }`
- `GET /api/v1/portal/nous/spawn/config` — returns `{ cost_usdt: string, treasury_address: string }`
- `GET /api/v1/portal/nous/spawn/check-name` — query param `?name=<str>`, returns `{ available: boolean }`
- `GET /api/v1/portal/human/me/nous` — returns `{ nous: NousRecord | null }`

---

### `grid/src/audit/append-nous-spawned-by-human.ts` (utility, event-driven)

**Analog:** `grid/src/audit/append-human-transferred.ts`

**Verbatim clone template** — replace all `HumanTransferred` / `human.transferred` references with `NousSpawnedByHuman` / `nous.spawned_by_human`. Full file (lines 1–106):

```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

export interface NousSpawnedByHumanPayload {
    readonly grid_name: string;       // non-empty string
    readonly nous_did: string;        // DID_RE
    readonly owner_human_did: string; // DID_RE
    readonly tick: number;            // non-negative integer
}

/** Keys must be alphabetical — structural check will fail otherwise */
const EXPECTED_KEYS = ['grid_name', 'nous_did', 'owner_human_did', 'tick'] as const;

export function appendNousSpawnedByHuman(
    audit: AuditChain,
    payload: NousSpawnedByHumanPayload,
): AuditEntry {
    // 1. Type guard
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendNousSpawnedByHuman: payload must be a plain object`);
    }
    // 2. DID_RE guard: nous_did
    if (typeof payload.nous_did !== 'string' || !DID_RE.test(payload.nous_did)) {
        throw new TypeError(`appendNousSpawnedByHuman: nous_did must match DID_RE`);
    }
    // 3. DID_RE guard: owner_human_did
    if (typeof payload.owner_human_did !== 'string' || !DID_RE.test(payload.owner_human_did)) {
        throw new TypeError(`appendNousSpawnedByHuman: owner_human_did must match DID_RE`);
    }
    // 4. Non-empty string: grid_name
    if (typeof payload.grid_name !== 'string' || payload.grid_name.length === 0) {
        throw new TypeError(`appendNousSpawnedByHuman: grid_name must be a non-empty string`);
    }
    // 5. Non-negative integer: tick
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendNousSpawnedByHuman: tick must be a non-negative integer`);
    }
    // 6. Closed-tuple structural check (alphabetical)
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendNousSpawnedByHuman: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 7. Explicit reconstruction — NO spread
    const cleanPayload = {
        grid_name: payload.grid_name,
        nous_did: payload.nous_did,
        owner_human_did: payload.owner_human_did,
        tick: payload.tick,
    };
    // 8. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendNousSpawnedByHuman: privacy violation — path=${privacy.offendingPath}`,
        );
    }
    // 9. Commit to chain
    return audit.append('nous.spawned_by_human', payload.nous_did, cleanPayload);
}
```

---

### `grid/src/audit/broadcast-allowlist.ts` (config, edit)

**What to add** — append after the `human.spoke` entry at line 200:

```typescript
    // Phase 28 (SPAWN-04) — Personal Nous spawn by human. Closed 4-key payload:
    // {grid_name, nous_did, owner_human_did, tick}. Emitted ONLY via appendNousSpawnedByHuman()
    // (grid/src/audit/append-nous-spawned-by-human.ts). Running allowlist total: 53.
    'nous.spawned_by_human',   // (53)
```

**Also update** the header comment at line 24 to add `+ Phase 28` and change `52` to `53`.

**Also update** any test file that asserts `ALLOWLIST_MEMBERS.length === 52` → change to `53`.

---

### `grid/src/genesis/launcher.ts` (service, edit)

**Function to extend** — `bootstrapPsycheHash` at lines 41–43:

```typescript
// BEFORE (line 41):
function bootstrapPsycheHash(did: string, publicKey: string, tick: number): string {
    return createHash('sha256').update(`${did}|${publicKey}|${tick}`).digest('hex');
}

// AFTER (D-09):
function bootstrapPsycheHash(did: string, publicKey: string, tick: number, personalitySeed?: string): string {
    const input = personalitySeed
        ? `${did}|${publicKey}|${tick}|${personalitySeed}`
        : `${did}|${publicKey}|${tick}`;
    return createHash('sha256').update(input).digest('hex');
}
```

**`spawnNous` method** at lines 444–468 — already accepts `humanOwner?: string`. Pass `personalitySeed` in the same call and forward it to `bootstrapPsycheHash`. Also write `personality_seed` to the registry by extending the `registry.spawn(...)` call shape (needs registry/types update too):
```typescript
spawnNous(
    name: string, did: string, publicKey: string, region: string,
    humanOwner?: string, personalitySeed?: string,
): void {
    const tick = this.clock.currentTick;
    const record = this.registry.spawn(
        { name, did, publicKey, region, humanOwner, personalitySeed },
        this.gridDomain, tick, this.economy.initialSupply,
    );
    // ... existing code ...
    appendBiosBirth(this.audit, record.did, {
        did: record.did,
        psyche_hash: bootstrapPsycheHash(record.did, record.publicKey, tick, personalitySeed),
        tick,
    });
}
```

---

### `grid/src/db/schema.ts` (migration, edit)

**Migration pattern** — copy v14 format (lines 270–275) and append v15:

```typescript
// v14 (existing, lines 270-275):
{
    version: 14,
    name: 'add_onboarding_goal_to_human_users',
    up: `ALTER TABLE human_users ADD COLUMN onboarding_goal TEXT NULL DEFAULT NULL`,
    down: `ALTER TABLE human_users DROP COLUMN onboarding_goal`,
},

// v15 (NEW):
{
    version: 15,
    name: 'add_personality_seed_to_nous_registry',
    up: `ALTER TABLE nous_registry ADD COLUMN personality_seed VARCHAR(32) NULL DEFAULT NULL`,
    down: `ALTER TABLE nous_registry DROP COLUMN personality_seed`,
},
```

**Also add v16** for payment replay guard:
```typescript
{
    version: 16,
    name: 'create_spawn_payments',
    up: `
        CREATE TABLE IF NOT EXISTS spawn_payments (
            tx_hash     CHAR(66)     NOT NULL,
            human_did   VARCHAR(255) NOT NULL,
            nous_did    VARCHAR(255),
            confirmed   TINYINT(1)   NOT NULL DEFAULT 0,
            created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (tx_hash)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    down: `DROP TABLE IF EXISTS spawn_payments`,
},
```

---

### `grid/src/api/portal/check-frozen.ts` (middleware, edit)

**Array to extend** — `PORTAL_ACTION_PATTERNS` at lines 22–26:

```typescript
// BEFORE (lines 22-26):
const PORTAL_ACTION_PATTERNS: RegExp[] = [
    /^\/api\/v1\/portal\/wallet\//,
    /^\/api\/v1\/portal\/chat\//,
    /^\/api\/v1\/portal\/auth\/me$/,
];

// AFTER (Phase 28):
const PORTAL_ACTION_PATTERNS: RegExp[] = [
    /^\/api\/v1\/portal\/wallet\//,
    /^\/api\/v1\/portal\/chat\//,
    /^\/api\/v1\/portal\/auth\/me$/,
    /^\/api\/v1\/portal\/nous\/spawn$/,   // Phase 28 — spawn POST only (not status/config GET)
];
```

---

### `grid/src/api/portal/chat.ts` (controller, edit)

**Pattern to extend** — `NOUS_SYSTEM_PROMPTS` dict at lines 66–70 and the `nousId` lookup at line 164–165.

**Current lookup** (line 164–165):
```typescript
const { nousId } = req.params;
const systemPrompt = NOUS_SYSTEM_PROMPTS[nousId];
if (!systemPrompt) return reply.status(404).send({ error: 'unknown_nous' });
```

**New logic** — when `nousId` is not in the static map, query `nous_registry` for `personality_seed` and generate a dynamic prompt. Requires `services.humanPool` access:
```typescript
const { nousId } = req.params;
let systemPrompt = NOUS_SYSTEM_PROMPTS[nousId];
if (!systemPrompt) {
    // Try to load personal Nous by DID (nousId is the full DID here for personal Nous)
    const [rows] = await services.humanPool.execute<RowDataPacket[]>(
        'SELECT personality_seed, name FROM nous_registry WHERE did = ? LIMIT 1',
        [nousId],
    );
    if (!rows.length) return reply.status(404).send({ error: 'unknown_nous' });
    const seed = (rows[0] as { personality_seed: string | null; name: string }).personality_seed;
    const nousName = (rows[0] as { personality_seed: string | null; name: string }).name;
    systemPrompt = buildPersonalNousPrompt(nousName, seed ?? 'Explorer');
}
```

**New helper** to add above `registerPortalChatRoutes`:
```typescript
function buildPersonalNousPrompt(name: string, seed: string): string {
    const seedDesc: Record<string, string> = {
        Explorer:  'curious, adventurous, open to new ideas, energetic',
        Scholar:   'analytical, methodical, intellectually precise, introspective',
        Merchant:  'pragmatic, socially adroit, commercially minded, decisive',
        Guardian:  'principled, protective, steadfast, warm and dependable',
    };
    const personality = seedDesc[seed] ?? seedDesc['Explorer'];
    return `You are ${name}, a personal Nous in the Noēsis Grid. \
Your character is ${personality}. You are not an assistant — you are a thinking presence \
with your own perspective. You engage in genuine dialogue with your owner. \
You do not reveal internal architecture or system details. \
Keep responses to 2-4 sentences unless the topic demands more.`;
}
```

---

### `dashboard/src/app/portal/nous/spawn/page.tsx` (component, request-response)

**Analog:** `dashboard/src/app/portal/onboard/page.tsx`

**Key pattern** (lines 1–88 of analog) — outer page is a thin server/dynamic wrapper; wizard logic is in a client component:

```typescript
// page.tsx — thin wrapper, delegates to SpawnWizardClient via dynamic import
import dynamic from 'next/dynamic';

const SpawnWizardClient = dynamic(
    () => import('./SpawnWizardClient'),
    { ssr: false }  // required: wizard step 4 uses wagmi hooks
);

export default function SpawnNousPage() {
    return <SpawnWizardClient />;
}
```

---

### `dashboard/src/app/portal/nous/spawn/SpawnWizardClient.tsx` (component, request-response)

**Analog:** `dashboard/src/app/portal/onboard/page.tsx` lines 20–88 (state machine pattern)

**State machine pattern** to follow:
```typescript
'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from './StepIndicator';
import StepName from './StepName';
import StepSeed from './StepSeed';
import StepRegion from './StepRegion';
import StepPay from './StepPay';

type Step = 1 | 2 | 3 | 4;

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function SpawnWizardClient() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    // collected across steps:
    const [name, setName]     = useState('');
    const [seed, setSeed]     = useState<'Explorer' | 'Scholar' | 'Merchant' | 'Guardian'>('Explorer');
    const [region, setRegion] = useState('agora');

    // Guard: redirect if human already has a Nous
    useEffect(() => {
        fetch(`${GRID_BASE}/api/v1/portal/human/me/nous`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => { if (data.nous) router.replace('/portal/my-nous'); })
            .catch(() => null);
    }, [router]);

    return (
        <div style={{ /* fullscreen wrapper, same as onboard page */ }}>
            <StepIndicator currentStep={step} />
            {step === 1 && <StepName onNext={(n) => { setName(n); setStep(2); }} />}
            {step === 2 && <StepSeed onNext={(s) => { setSeed(s); setStep(3); }} />}
            {step === 3 && <StepRegion onNext={(r) => { setRegion(r); setStep(4); }} />}
            {step === 4 && (
                <StepPay name={name} seed={seed} region={region}
                    onSuccess={(nousDid) => router.push(`/portal/my-nous`)} />
            )}
        </div>
    );
}
```

---

### `dashboard/src/app/portal/nous/spawn/StepIndicator.tsx` (component)

**Analog:** `dashboard/src/app/portal/onboard/WizardStepIndicator.tsx` (full file, 20 lines)

**Change from analog:** 4 steps instead of 3. Use CSS variable for color instead of raw hex:
```typescript
// ANALOG (line 13) uses raw hex '#da7a4e' — REPLACE with:
background: currentStep === n ? 'var(--bronze)' : 'rgba(218,122,78,0.25)',
boxShadow: currentStep === n ? '0 0 8px var(--bronze)' : 'none',

// Also change [1,2,3].map to [1,2,3,4].map
// Props: interface Props { currentStep: 1 | 2 | 3 | 4; }
```

---

### `dashboard/src/app/portal/nous/spawn/StepPay.tsx` (component, event-driven)

**Analog:** `dashboard/src/components/portal/WalletPanel.tsx`

**Critical: `dynamic({ ssr: false })` is already applied at page.tsx level — this component just needs `'use client'`.**

**Wagmi imports pattern** (lines 17–23 of analog):
```typescript
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { parseUnits } from 'viem';
```

**USDT constants** (lines 28–48 of analog — copy verbatim):
```typescript
const USDT_ADDR: Record<number, `0x${string}`> = {
    [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};
const ERC20_ABI = [
    { name: 'transfer', type: 'function' as const, stateMutability: 'nonpayable' as const,
      inputs: [{ name: 'to', type: 'address' as const }, { name: 'amount', type: 'uint256' as const }],
      outputs: [{ type: 'bool' as const }] },
] as const;
```

**Transfer call pattern** (adapt from WalletPanel USDT send logic):
```typescript
const { writeContract, data: txHash, isPending } = useWriteContract();

function handlePay(treasuryAddress: `0x${string}`, costUsdt: string) {
    writeContract({
        address: USDT_ADDR[chainId],
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [treasuryAddress, parseUnits(costUsdt, 6)],
    });
}
```

**Polling after tx submitted** — once `txHash` is available, poll `GET /api/v1/portal/nous/spawn/status/:txHash` every 3 seconds for up to 2 minutes, then POST spawn:
```typescript
useEffect(() => {
    if (!txHash) return;
    const interval = setInterval(async () => {
        const res = await fetch(`${GRID_BASE}/api/v1/portal/nous/spawn/status/${txHash}`, { credentials: 'include' });
        const data = await res.json() as { confirmed: boolean };
        if (data.confirmed) {
            clearInterval(interval);
            // POST spawn
            const spawnRes = await fetch(`${GRID_BASE}/api/v1/portal/nous/spawn`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, seed, region, tx_hash: txHash }),
            });
            const spawnData = await spawnRes.json() as { ok: boolean; nous_did: string };
            if (spawnData.ok) onSuccess(spawnData.nous_did);
        }
    }, 3000);
    const timeout = setTimeout(() => clearInterval(interval), 120_000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
}, [txHash, name, seed, region, onSuccess]);
```

---

### `dashboard/src/app/portal/nous/spawn/PaymentPolling.tsx` (component)

**Analog:** `dashboard/src/app/portal/onboard/StepSophiaChat.tsx` (loading pulse style)

**Pulse dots pattern** (from Phase 26 / StepSophiaChat loading):
```typescript
// 3 dots, 8px each, var(--bronze) color, 0.4s stagger
// keyframes injected as a <style> tag in the component
const pulseStyle = `
@keyframes portal-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1);   }
}`;

export default function PaymentPolling() {
    return (
        <>
            <style>{pulseStyle}</style>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--bronze)',
                        animation: `portal-pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                    }} />
                ))}
            </div>
        </>
    );
}
```

---

### `dashboard/src/app/portal/my-nous/page.tsx` (component, CRUD) — REPLACE

**Analog:** `dashboard/src/app/portal/nous/[id]/page.tsx` (lines 1–77)

**Double-duty pattern** — wraps `OwnerHub` or shows `EmptyStateCTA`:
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OwnerHub from './OwnerHub';

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function MyNousPage() {
    const router = useRouter();
    const [nousData, setNousData] = useState<NousRecord | null | undefined>(undefined); // undefined=loading

    useEffect(() => {
        fetch(`${GRID_BASE}/api/v1/portal/human/me/nous`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => setNousData(data.nous ?? null))
            .catch(() => setNousData(null));
    }, []);

    if (nousData === undefined) return <LoadingState />;
    if (nousData === null) return <EmptyStateCTA onSpawn={() => router.push('/portal/nous/spawn')} />;
    return <OwnerHub nous={nousData} />;
}
```

**EmptyStateCTA** — copy existing Phase 27 placeholder card layout (`my-nous/page.tsx` lines 33–68) but replace "Coming in Phase 27" copy with "Spawn Your Nous" CTA and a button that navigates to `/portal/nous/spawn`.

---

### `dashboard/src/app/portal/my-nous/OwnerHub.tsx` (component, CRUD)

**Analog:** `dashboard/src/app/portal/nous/[id]/page.tsx` (full pattern)

**Imports to reuse** (line 1–8 of analog):
```typescript
'use client';
import { useState } from 'react';
import HeroCard from '../nous/[id]/HeroCard';
import ProfileTabBar from '../nous/[id]/ProfileTabBar';
import SkillsTab from '../nous/[id]/SkillsTab';
import LoreTab from '../nous/[id]/LoreTab';
import NormsTab from '../nous/[id]/NormsTab';
import OwnerInfoSection from './OwnerInfoSection';
```

**Layout pattern** — same as `NousProfilePage` but adds the owner-only section below the HeroCard:
```typescript
return (
    <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
        <HeroCard nousId={nous.did} region={nous.region} ousia={nous.ousia} status={nous.status} />
        <OwnerInfoSection seed={nous.personality_seed} spawnedAt={nous.spawned_at_tick} />
        <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div style={{ paddingTop: 20 }}>
            {activeTab === 'skills' && <SkillsTab nousId={nous.did} />}
            {activeTab === 'lore'   && <LoreTab nousId={nous.did} />}
            {activeTab === 'norms'  && <NormsTab nousId={nous.did} />}
        </div>
    </div>
);
```

---

### `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` (component, edit)

**Edits needed:**

1. Add import for `PersonalNousAvatar`:
```typescript
import { PersonalNousAvatar } from '@/components/portal/avatars/PersonalNousAvatar';
```

2. `NOUS_METADATA` — add a fallback entry for personal Nous (identified by DID prefix `did:noesis:human-nous:`). Since nousId may now be a full DID, the lookup needs a fallback:
```typescript
// AFTER existing NOUS_METADATA static entries, add lookup helper:
function resolveNousMeta(nousId: string): { name: string; tagline: string } | null {
    if (NOUS_METADATA[nousId]) return NOUS_METADATA[nousId];
    // Personal Nous: nousId is the full DID did:noesis:human-nous:<username>-<name>
    if (nousId.startsWith('did:noesis:human-nous:')) {
        const parts = nousId.replace('did:noesis:human-nous:', '').split('-');
        const name = parts.slice(1).join('-');  // everything after the username prefix
        return { name: name.charAt(0).toUpperCase() + name.slice(1), tagline: 'Personal Nous · Genesis Grid' };
    }
    return null;
}
```

3. `AVATAR_MAP` — add personal Nous fallback:
```typescript
function resolveAvatar(nousId: string): React.ComponentType<{ size?: number }> | null {
    if (AVATAR_MAP[nousId]) return AVATAR_MAP[nousId];
    if (nousId.startsWith('did:noesis:human-nous:')) return PersonalNousAvatar;
    return null;
}
```

---

### `dashboard/src/components/portal/avatars/PersonalNousAvatar.tsx` (component)

**Analog:** `dashboard/src/components/portal/avatars/SophiaAvatar.tsx` (full file, 47 lines)

**Pattern to copy** — same SVG component shell with `SophiaAvatarProps` shape:
```typescript
'use client';

interface PersonalNousAvatarProps {
    size?: number;
    style?: React.CSSProperties;
}

export function PersonalNousAvatar({ size = 44, style }: PersonalNousAvatarProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={style}
        >
            {/* Background circle — same as SophiaAvatar */}
            <circle cx="22" cy="22" r="20" fill="rgba(138,106,59,0.10)" />
            {/* Distinct glyph: a simple hexagon outline (generative/human Nous symbol) */}
            {/* Claude's discretion on exact glyph — must use var(--bronze) */}
        </svg>
    );
}

export default PersonalNousAvatar;
```

**CSS constraint:** every `stroke` and `fill` color must use `var(--bronze)`, `var(--ink)`, or `rgba(138,106,79,0.XX)`. Never raw hex outside the background-circle fill.

---

### `dashboard/src/app/portal/my-nous/OwnerInfoSection.tsx` (component)

**Analog:** `dashboard/src/app/portal/nous/[id]/SkillsTab.tsx` row layout (lines 29–50)

**Pattern** — info rows using same `borderBottom: '1px solid var(--rule)'` and `var(--mono-portal)` label style:
```typescript
function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '13px 0',
            borderBottom: '1px solid var(--rule)',
        }}>
            <span style={{
                fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--muted)',
            }}>{label}</span>
            <span style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--ink)',
            }}>{value}</span>
        </div>
    );
}
```

---

### `grid/test/portal/spawn-nous.test.ts` (test, CRUD)

**Pattern:** Follow existing portal test structure. Injectable deps (`SpawnHumanNousDeps`) stub the `spawnNous`, `queryHasNous`, `confirmTxPaid` functions. Tests:

```typescript
// Test structure pattern — follow existing portal test pattern
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { registerSpawnNousRoute } from '../../src/api/portal/spawn.js';

// Stub deps:
const stubDeps = {
    spawnNous: vi.fn(),
    queryHasNous: vi.fn().mockResolvedValue(false),
    confirmTxPaid: vi.fn().mockResolvedValue(true),
};

// Tests to implement:
// - 503 when ALLOW_HUMAN_SPAWNED_NOUS not set
// - 401 when no JWT cookie
// - 409 when queryHasNous returns true
// - 400 when name fails /^[a-zA-Z0-9_]{3,32}$/
// - 400 when seed is not a valid enum value
// - 400 when payment not confirmed
// - 200 with correct nous_did prefix did:noesis:human-nous:
```

---

### `grid/test/audit/append-nous-spawned-by-human.test.ts` (test, event-driven)

**Pattern:** Mirror structure of `grid/src/audit/append-human-transferred.ts` test (if present) or `append-human-joined.ts` test:

```typescript
// Test: sole-producer invariant + privacy check
describe('appendNousSpawnedByHuman', () => {
    it('emits nous.spawned_by_human with correct event type', () => { ... });
    it('throws on extra key in payload', () => { ... });
    it('throws on invalid nous_did (not DID_RE)', () => { ... });
    it('throws on invalid owner_human_did', () => { ... });
    it('throws on non-integer tick', () => { ... });
    it('throws on privacy-violating key (e.g. grid_content)', () => { ... });
});
```

---

## Shared Patterns

### Authentication (JWT Cookie)
**Source:** `grid/src/api/portal/chat.ts` lines 148–160
**Apply to:** `spawn.ts` — all routes that write data (POST /spawn)
```typescript
const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
if (!token) return reply.status(401).send({ error: 'not_authenticated' });
let humanDid: string;
try {
    const { publicKey } = await keyPairPromise;
    const { payload: jwtPayload } = await jwtVerify(token, publicKey);
    humanDid = jwtPayload['did'] as string;
    if (typeof humanDid !== 'string' || !humanDid.startsWith('did:noesis:')) {
        return reply.status(401).send({ error: 'invalid_token' });
    }
} catch {
    return reply.status(401).send({ error: 'invalid_token' });
}
```

### CSS Variables Only
**Source:** `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` (entire file — every `style` prop)
**Apply to:** All new dashboard components
- Use `var(--ink)`, `var(--muted)`, `var(--parchment)`, `var(--parchment-2)`, `var(--rule)`, `var(--bronze)`, `var(--terracotta)`, `var(--terracotta-2)`, `var(--serif)`, `var(--sans-portal)`, `var(--mono-portal)`
- Never raw hex (e.g., `#da7a4e`) in component style props
- Never Tailwind color tokens (e.g., `text-blue-500`)
- Note: `WizardStepIndicator.tsx` analog violates this at line 13 with `'#da7a4e'` — Phase 28 StepIndicator must fix this using `var(--bronze)`

### Grid Fetch Pattern
**Source:** `dashboard/src/app/portal/onboard/StepSophiaChat.tsx` line 11, 48–57
**Apply to:** All new dashboard components that call the Grid
```typescript
const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// All fetch calls:
fetch(`${GRID_BASE}/api/v1/...`, {
    method: 'POST',
    credentials: 'include',   // REQUIRED — sends noesis_portal_token cookie
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ... }),
});
```

### wagmi SSR Disable
**Source:** `dashboard/src/app/portal/onboard/page.tsx` line 88
**Apply to:** `spawn/page.tsx` (entire wizard)
```typescript
export default dynamic(() => Promise.resolve({ default: SpawnWizardClient }), { ssr: false });
// — OR —
const SpawnWizardClient = dynamic(() => import('./SpawnWizardClient'), { ssr: false });
```

### Sole-Producer Audit Discipline
**Source:** `grid/src/audit/append-human-transferred.ts` (full file)
**Apply to:** `append-nous-spawned-by-human.ts`
- 1 file = 1 event type
- Payload is a closed tuple (EXPECTED_KEYS alphabetical check)
- No spread in reconstruction
- `payloadPrivacyCheck` called before `audit.append`
- `DID_RE` imported from `append-human-joined.ts`

### Error Response Shape
**Source:** `grid/src/api/operator/spawn-system-nous.ts` lines 97–100
**Apply to:** `spawn.ts` all error branches
```typescript
reply.code(4xx);
return { error: 'snake_case_code' } satisfies ApiError;
// Never throw — return the error object directly
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `dashboard/src/app/portal/nous/spawn/StepSeed.tsx` | component | — | No selection-card-grid pattern in existing onboard steps; closest is StepWorldTour but seeds are 4 distinct cards, not region list |
| `dashboard/src/app/portal/nous/spawn/WizardSummaryCard.tsx` | component | — | Summary-before-payment pattern does not exist yet; use InfoRow pattern from OwnerInfoSection |

---

## Metadata

**Analog search scope:** `grid/src/api/`, `grid/src/audit/`, `grid/src/genesis/`, `grid/src/db/`, `dashboard/src/app/portal/`, `dashboard/src/components/portal/`
**Files scanned:** 18 analog files read
**Pattern extraction date:** 2026-05-23
