# Phase 28: Personal Nous — Research

**Researched:** 2026-05-23
**Domain:** Grid spawn flow, Brain psyche personality seeds, wagmi payment, Portal owner hub
**Confidence:** HIGH

---

## Summary

Phase 28 extends the existing operator spawn infrastructure to allow portal users (authenticated
humans) to spawn their own Nous agent. The implementation touches four layers: (1) a new Grid API
route for portal-auth spawn and payment polling, (2) an extension to `bootstrapPsycheHash` and the
Brain Psyche personality system to accept a seed type, (3) a new allowlist member
`nous.spawned_by_human` at position 53, and (4) two Dashboard routes: a 4-step spawn wizard and
the `/portal/my-nous` owner hub replacing the current Phase 27 placeholder.

The shared Brain container model (D-01) means no Docker provisioning is required. The Brain
already supports 6-dimensional personality profiles (openness/conscientiousness/extraversion/
agreeableness/resilience/ambition) read from YAML config. Phase 28 does not require a new Brain
endpoint — seed influence is encoded at spawn time by extending `bootstrapPsycheHash` and passing
personality data into the Nous YAML config dict that the Brain reads at startup.

**Primary recommendation:** Follow the `spawn-system-nous.ts` route structure exactly (SpawnNousDeps
injection, DID generation, sole-producer audit, error ladder) and mirror the `appendHumanTransferred`
pattern verbatim for the new `appendNousSpawnedByHuman` emitter. Re-use Phase 27 HeroCard +
tab components unchanged in the owner hub.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Personal Nous runs in the shared Brain container — same Brain service that handles
  Sophia, Hermes, and Themis. No separate Docker container provisioning.

- **D-02:** Personal Nous chat uses the same `POST /api/v1/portal/chat/nous/:nousId` endpoint.
  No new chat endpoint.

- **D-03:** Spawn requires on-chain USDT payment before spawning. User sends USDT to Grid
  treasury on-chain via wagmi (same send pattern as WALLET-02 / tip flow).

- **D-04:** Payment confirmation uses polling — Dashboard polls
  `GET /api/v1/portal/nous/spawn/status/:txHash` every 3 seconds for up to 2 minutes.

- **D-05:** `/portal/my-nous` is an owner hub showing HeroCard + Skills/Lore/Norms tabs plus
  owner-only section (seed type, spawn date, USDT cost, Chat shortcut, Nous Cyber Coin balance).
  No management controls.

- **D-06:** `/portal/my-nous` serves double duty — pre-spawn shows empty-state CTA; post-spawn
  shows owner hub. Button navigates to `/portal/nous/spawn`.

- **D-07:** The 4-step spawn wizard lives at `/portal/nous/spawn`. Steps: (1) Name, (2) Seed,
  (3) Region, (4) Confirm & Pay.

- **D-08:** Seeds map to Big Five preset values (see directions below). Claude sets exact floats.

- **D-09:** `bootstrapPsycheHash` extended to accept an optional `personalitySeed?: string`
  parameter.

### Claude's Discretion

- Exact Big Five float values for each seed preset (within D-08 directions)
- System prompt text per seed type for LLM chat personality
- How `bootstrapPsycheHash` extension is implemented (deterministic bias approach)
- Wizard step UI design details (progress indicator, loading animation during payment confirmation)
- Loading state during Grid payment confirmation (reuse Phase 26 "Sophia is thinking…" pulsing)
- Empty state design on `/portal/my-nous` before spawn (CTA button layout, copy)
- Error states in wizard (payment failed, spawn unavailable, Nous name conflict)
- How `?nous=<id>` pre-selection is passed to `/portal/chat` from "Chat with [Name]"

### Deferred Ideas (OUT OF SCOPE)

- Dedicated Brain Docker container per human Nous
- Multiple Nous per human (max 1 per SPAWN-06)
- Owner management controls (rename, suspend) — Brain sovereignty preserved
- Community features (Phase 29)
- Treasury funding mechanism
- Brain memory injection from human messages

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPAWN-01 | Spawn wizard at `/portal/nous/spawn`; fixed cost (default 50 USDT, `SPAWN_COST_USDT` env); Grid confirms payment before proceeding | Dashboard route + Grid payment-gate pattern verified |
| SPAWN-02 | Wizard steps (1) Name 3–32 chars alphanumeric+underscore, (2) seed Explorer/Scholar/Merchant/Guardian, (3) region, (4) Confirm & Pay; DID `did:noesis:human-nous:<username>-<name>` | DID regex verified; name validation pattern from spawn-system-nous.ts |
| SPAWN-03 | `ALLOW_HUMAN_SPAWNED_NOUS=true` env gate; if not set returns 503; shared Brain (D-01 override of Docker note) | check-frozen.ts exemption needed; env gate pattern from spawn-system-nous.ts |
| SPAWN-04 | `nous.spawned_by_human` audit event; payload `{nous_did, owner_human_did, grid_name, tick}`; allowlist slot 53 | appendHumanTransferred clone pattern verified |
| SPAWN-05 | Human can view Nous activity via profile page; no direct control (Brain sovereignty); can chat and tip | Phase 27 NousProfile reuse confirmed; no new endpoints needed |
| SPAWN-06 | Max 1 Nous per human; 409 `already_owns_nous` if cap exceeded; wizard redirects to `/portal/my-nous` | DB query on nous_registry by human_owner needed |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Payment gate (USDT on-chain) | Browser/Client | Grid API | wagmi `useWriteContract` executes on-chain; Grid only verifies after-the-fact |
| Payment confirmation polling | Dashboard → Grid API | — | Dashboard polls `GET /spawn/status/:txHash`; Grid polls RPC |
| Spawn execution | Grid API | Brain (config init) | Grid creates DID, writes registry, emits audit; Brain initializes psyche from personality dict |
| Personality seed → Big Five | Grid (encode at spawn) | Brain (read at startup) | `bootstrapPsycheHash` bias happens in Grid; personality dict passed into Brain's Nous YAML startup config |
| Allowlist enforcement | Grid (audit boundary) | — | Sole-producer emitter `appendNousSpawnedByHuman` |
| Owner hub UI | Dashboard (Portal) | Grid API | Reads existing Nous data endpoints from Phase 27 |
| One-Nous cap enforcement | Grid API | MySQL | Query `nous_registry WHERE human_owner = ?` |
| Freeze/ban gate | Grid (preHandler) | — | `check-frozen.ts` must include `/api/v1/portal/nous/spawn` |

---

## Standard Stack

### Core (verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wagmi | existing | On-chain USDT transfer for spawn payment | Already wired in WalletPanel; `useWriteContract` + `useWaitForTransactionReceipt` |
| viem | existing | `parseUnits`, `isAddress`, amount encoding | Used throughout WalletPanel.tsx |
| jose | existing | JWT verification on Grid routes | Same pattern as wallet.ts/chat.ts |
| fastify | existing | Grid API server | All portal routes registered via Fastify |
| node:crypto | existing | `randomUUID`, `createHash`, ed25519 key gen | Pattern from spawn-system-nous.ts |
| @fastify/cookie | existing | Read `noesis_portal_token` cookie | Same auth cookie as all portal routes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | existing | `useRouter` for redirect after spawn | wizard steps navigation |
| React useState/useEffect | existing | Wizard step state, polling interval | 4-step wizard state machine |

**No new packages required.** [VERIFIED: grep of package.json + WalletPanel.tsx]

---

## Architecture Patterns

### System Architecture Diagram

```
Dashboard Browser
  └─ /portal/nous/spawn (wizard)
       Step 4 Confirm & Pay
         ├─ wagmi useWriteContract → on-chain USDT transfer
         └─ poll GET /api/v1/portal/nous/spawn/status/:txHash (3s, 2min)
              └─ Grid: poll EVM RPC for tx confirmation
                   └─ confirmed → POST /api/v1/portal/nous/spawn
                        ├─ JWT auth guard (same as wallet.ts)
                        ├─ check-frozen.ts preHandler
                        ├─ env gate: ALLOW_HUMAN_SPAWNED_NOUS
                        ├─ 1-Nous cap: query nous_registry
                        ├─ GenesisLauncher.spawnNous(name, did, publicKey, region, humanOwner)
                        │    ├─ registry.spawn(...)
                        │    ├─ space.placeNous(...)
                        │    ├─ audit.append('nous.spawned', ...)      [existing]
                        │    ├─ appendBiosBirth(...)                   [existing]
                        │    └─ bootstrapPsycheHash(did, key, tick, personalitySeed?)
                        └─ appendNousSpawnedByHuman(audit, payload)    [new]
                             payload: {grid_name, nous_did, owner_human_did, tick}

Dashboard Browser
  └─ /portal/my-nous
       ├─ pre-spawn: empty CTA → navigate to /portal/nous/spawn
       └─ post-spawn: owner hub
            ├─ HeroCard (reused from [id]/HeroCard.tsx)
            ├─ ProfileTabBar + Skills/Lore/Norms (reused from [id])
            └─ owner-only section: seed type, spawn date, USDT cost, Chat shortcut
```

### Recommended Project Structure

```
grid/src/
├─ api/portal/
│    ├─ spawn.ts                   # NEW: POST /spawn + GET /spawn/status/:txHash
│    └─ check-frozen.ts            # EDIT: add spawn route pattern
├─ audit/
│    └─ append-nous-spawned-by-human.ts  # NEW: sole-producer emitter
├─ broadcast-allowlist.ts          # EDIT: add nous.spawned_by_human at pos 53
├─ genesis/
│    └─ launcher.ts               # EDIT: bootstrapPsycheHash optional seed param
└─ db/schema.ts                   # EDIT: migration v15 adds personality_seed column

dashboard/src/app/portal/
├─ nous/
│    └─ spawn/
│         └─ page.tsx             # NEW: 4-step wizard (client component, dynamic ssr:false for step 4)
└─ my-nous/
     └─ page.tsx                  # REPLACE: owner hub or empty CTA
```

### Pattern 1: Sole-Producer Audit Emitter (verbatim clone of appendHumanTransferred)

**What:** Every new audit event has exactly one file that calls `audit.append()`. Closed-tuple payload
with alphabetical key order, `Object.keys` sort check, explicit reconstruction (no spread), privacy check.

**When to use:** For every new allowlist event — `nous.spawned_by_human`.

```typescript
// Source: grid/src/audit/append-human-transferred.ts (clone this exactly)
const EXPECTED_KEYS = ['grid_name', 'nous_did', 'owner_human_did', 'tick'] as const;

export function appendNousSpawnedByHuman(
    audit: AuditChain,
    payload: NousSpawnedByHumanPayload,
): AuditEntry {
    // 1. Type guard
    // 2. DID_RE guard: nous_did
    // 3. DID_RE guard: owner_human_did
    // 4. Non-empty string: grid_name
    // 5. Non-negative integer: tick
    // 6. Closed-tuple key check (Object.keys.sort)
    // 7. Explicit reconstruction — NO spread
    // 8. payloadPrivacyCheck
    // 9. audit.append('nous.spawned_by_human', payload.nous_did, cleanPayload)
}
```

[VERIFIED: grid/src/audit/append-human-transferred.ts]

### Pattern 2: Portal Spawn Route (extend spawn-system-nous.ts structure)

**What:** JWT auth (not header-auth), SpawnNousDeps injection, env gate, 1-Nous cap, DID generation.

**Key differences from spawn-system-nous.ts:**
- Auth: `jwtVerify` on `noesis_portal_token` cookie (same as chat.ts/wallet.ts)
- DID scheme: `did:noesis:human-nous:<username>-<name>` not `did:noesis:system:<uuid>`
- Env gate: `ALLOW_HUMAN_SPAWNED_NOUS` → 503 `spawn_not_enabled`
- Cap check: query `nous_registry WHERE human_owner = ? LIMIT 1` → 409 `already_owns_nous`
- Payment gate: verify `txHash` was confirmed (polled separately)
- Passes `humanOwner` to `spawnNous`
- Calls `appendNousSpawnedByHuman` (not reusing `nous.spawned` alone)

[VERIFIED: grid/src/api/operator/spawn-system-nous.ts]

### Pattern 3: Wagmi Payment (reuse WalletPanel.tsx)

**What:** `useWriteContract` for ERC-20 USDT transfer to Grid treasury address.

```typescript
// Source: dashboard/src/components/portal/WalletPanel.tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

// USDT transfer (6 decimal places)
writeContract({
    address: USDT_ADDR[chainId],
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [treasuryAddress, parseUnits(spawnCostUsdt, 6)],
});
// Then poll Grid with resulting txHash
```

[VERIFIED: dashboard/src/components/portal/WalletPanel.tsx]

### Pattern 4: bootstrapPsycheHash Extension (D-09)

**What:** Optional `personalitySeed` param biases the SHA-256 hash input, producing a distinct
initial psyche_hash per seed type. Deterministic: same DID + key + tick + seed = same hash.

```typescript
// Source: grid/src/genesis/launcher.ts — extend this function
function bootstrapPsycheHash(
    did: string, publicKey: string, tick: number, personalitySeed?: string
): string {
    const input = personalitySeed
        ? `${did}|${publicKey}|${tick}|${personalitySeed}`
        : `${did}|${publicKey}|${tick}`;
    return createHash('sha256').update(input).digest('hex');
}
```

[VERIFIED: grid/src/genesis/launcher.ts]

### Pattern 5: Brain Personality — Low/Medium/High String Levels

**What:** Brain's `PersonalityProfile` uses string levels `"low"` | `"medium"` | `"high"` (not floats).
LEVEL_MAP maps: low→0.2, medium→0.5, high→0.8.

Dimensions available: openness, conscientiousness, extraversion, agreeableness, resilience, ambition.
Note: Brain uses 6 dimensions (adds resilience + ambition to the standard Big Five). The CONTEXT.md
D-08 mentions 5 (omits resilience/ambition) — use all 6 for completeness; set resilience/ambition to
"medium" for seed presets that don't specify them.

[VERIFIED: brain/src/noesis_brain/psyche/types.py]

Seed → dimension levels (Claude's discretion for exact values, directions from D-08):

| Seed | openness | conscientiousness | extraversion | agreeableness | resilience | ambition |
|------|----------|-------------------|--------------|---------------|------------|----------|
| Explorer | high | low | medium | medium | high | medium |
| Scholar | high | high | low | medium | medium | high |
| Merchant | medium | high | high | medium | medium | high |
| Guardian | low | high | medium | high | high | medium |

**Important:** The Brain does NOT receive personality preset data via an API call from Grid. The
personality is embedded at Brain startup via the Nous YAML config. For personal Nous, Grid must
write a YAML config file to a shared volume OR the Brain must support dynamic config injection.
This is a key open question (see Open Questions #1).

[VERIFIED: brain/src/noesis_brain/__main__.py + docker-compose.yml analysis]

### Pattern 6: Phase 27 HeroCard Reuse

**What:** `HeroCard` at `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` is a client component
that accepts `{nousId, region, ousia, status}`. It currently only knows Sophia/Hermes/Themis.

For the owner hub, the personal Nous needs an avatar and metadata entry in `NOUS_METADATA` and
`AVATAR_MAP`. Either extend the existing component or create a personal-Nous-specific variant.

[VERIFIED: dashboard/src/app/portal/nous/[id]/HeroCard.tsx]

### Pattern 7: Loading Pulse Animation (Phase 26 style)

```typescript
// Source: dashboard/src/app/portal/onboard/StepSophiaChat.tsx
@keyframes portal-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
}
// 3 circles, 8px each, var(--bronze) color, 0.4s stagger
```

[VERIFIED: dashboard/src/app/portal/onboard/StepSophiaChat.tsx]

### Anti-Patterns to Avoid

- **Raw hex colors in JSX styles:** Use `var(--bronze)`, `var(--ink)`, `var(--parchment)` etc. Never
  `#da7a4e` directly. This is a locked project constraint.
- **Tailwind color tokens:** Project uses CSS variables only. No `className="text-blue-500"` etc.
- **SSR with wagmi hooks:** Step 4 of the wizard uses `useWriteContract`. The entire wizard page
  (or at minimum step 4) must be wrapped in `dynamic({ ssr: false })`. Same pattern as WalletPanel.
- **Spreading payload objects:** Sole-producer emitters must use explicit key reconstruction, never
  `{...payload}`. The `Object.keys` sort check enforces this.
- **Calling audit.append directly outside sole-producer:** Only `appendNousSpawnedByHuman` calls
  `audit.append('nous.spawned_by_human', ...)`.
- **Hardcoding SPAWN_COST_USDT:** Must read from `process.env.SPAWN_COST_USDT ?? '50'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| On-chain USDT transfer | Custom EVM tx construction | wagmi `useWriteContract` | WalletPanel already does this; ERC-20 ABI + USDT address already in codebase |
| Transaction confirmation waiting | Custom RPC polling | wagmi `useWaitForTransactionReceipt` | Handles reorgs, retries, timeout |
| JWT verification on Grid route | Custom token parse | `jwtVerify` from `jose` + `keyPairPromise` | Same pattern in wallet.ts, chat.ts, nous.ts |
| Personality description for prompt | Custom formatter | `psyche.describe_personality()` | Already implemented in Brain Psyche class |
| DID validation | Custom regex | `DID_RE` from `append-human-joined.ts` | Enforced at 3 entry points; must not diverge |
| Payload privacy check | Custom key scanner | `payloadPrivacyCheck` from `broadcast-allowlist.ts` | All sole-producers call this before chain.append |

---

## Runtime State Inventory

> Not a rename/refactor phase. Omitted.

---

## Common Pitfalls

### Pitfall 1: Brain Personality Config — No Runtime API

**What goes wrong:** Planner assumes Grid can POST a personality profile to Brain at spawn time.
Brain has no `/init-personality` or `/set-psyche` endpoint. Personality is loaded from YAML config
at Brain startup.

**Why it happens:** The `bootstrapPsycheHash` extension (D-09) only affects the Grid-side audit
hash. The Brain's actual personality (what shapes system prompts and `describe_personality()`) is
read from `data/nous/<name>.yaml`. If a personal Nous needs a distinct personality in the LLM
prompt, a YAML file must exist before Brain starts for that Nous.

**How to avoid:** In v2.5 with the shared Brain model (D-01), personal Nous use the same Brain
process as genesis Nous. The chat endpoint at `POST /api/v1/portal/chat/nous/:nousId` uses
hardcoded `NOUS_SYSTEM_PROMPTS` — a new entry for the personal Nous personality can be added
there at spawn time, or the Grid can generate a dynamic system prompt from the seed type without
requiring Brain changes. The `bootstrapPsycheHash` extension satisfies the audit hash requirement;
the LLM personality shaping happens in the chat system prompt (Claude's discretion per D-09 note).

**Warning signs:** Any plan that requires a new Brain HTTP endpoint or a new Brain Python module.

[VERIFIED: brain/src/noesis_brain/http/server.py — only 2 routes: cognitive-snapshot + skills lookup]

### Pitfall 2: check-frozen.ts Not Extended

**What goes wrong:** The spawn endpoint exists but doesn't honour operator freeze/ban because
`check-frozen.ts` doesn't include the spawn URL pattern.

**Why it happens:** `PORTAL_ACTION_PATTERNS` in `check-frozen.ts` currently lists wallet, chat,
and auth/me. The comment says "Forward-compat: will be extended when phases 26 and 27 land."
Phase 28 must add the spawn pattern.

**How to avoid:** Add `/api\/v1\/portal\/nous\/spawn` to `PORTAL_ACTION_PATTERNS` before or in
the same plan as spawn route registration.

[VERIFIED: grid/src/api/portal/check-frozen.ts lines 22–26]

### Pitfall 3: DID Scheme Collision with System Nous

**What goes wrong:** Personal Nous DID `did:noesis:human-nous:<username>-<name>` could conflict
with existing Nous DIDs if `<username>-<name>` equals an existing name.

**Why it happens:** `nous_registry` has a `UNIQUE KEY uq_name (grid_name, name)` but the DID
itself is the primary key. Two different humans could want a Nous named "eidolon". The DID would
be `did:noesis:human-nous:henry-eidolon` vs `did:noesis:human-nous:alice-eidolon` — different
DIDs, but the `name` column must also be unique.

**How to avoid:** Grid checks for name uniqueness via `nous_registry WHERE name = ?` before
spawning, and returns 409 `name_taken` if already used. Wizard step 1 validates name uniqueness
via a `GET /api/v1/portal/nous/spawn/check-name?name=<name>` call or inline in the spawn POST.

[VERIFIED: grid/src/db/schema.ts — UNIQUE KEY uq_name on nous_registry]

### Pitfall 4: `personality_seed` Column Missing from nous_registry

**What goes wrong:** Plan tries to store the seed type for the owner hub display without a
migration, or queries a non-existent column.

**Why it happens:** Current `nous_registry` schema (migration v3) has no `personality_seed`
column. The owner hub D-05 requires showing "seed type" in the owner-only section.

**How to avoid:** Add migration v15 with `ALTER TABLE nous_registry ADD COLUMN personality_seed
VARCHAR(32) NULL`. The spawn route writes this column; owner hub reads it via the `/me/nous`
endpoint response.

[VERIFIED: grid/src/db/schema.ts — no personality_seed column, current high watermark v14]

### Pitfall 5: wagmi `useWriteContract` Requires Client Component with SSR Disabled

**What goes wrong:** Next.js hydration error when wagmi hooks run on server.

**Why it happens:** wagmi hooks depend on browser wallet APIs. Phase 27 established this pattern.

**How to avoid:** The spawn wizard page (or at minimum the payment step) must use
`dynamic(() => import('./SpawnWizardClient'), { ssr: false })` from next/dynamic.

[VERIFIED: dashboard/src/components/portal/WalletPanel.tsx — 'use client' directive]

### Pitfall 6: Allowlist Count Assertion

**What goes wrong:** `broadcast-allowlist.test.ts` asserts a specific member count. Adding
`nous.spawned_by_human` without updating the count assertion will cause test failure.

**Why it happens:** The allowlist has a length assertion somewhere in the test suite.

**How to avoid:** After adding position 53, search for hardcoded count assertions (e.g., `52`)
in test files and update to `53`.

[VERIFIED: broadcast-allowlist.ts comment "Running allowlist total: 52" at human.spoke position]

---

## Code Examples

### Sole-Producer Pattern (authoritative clone template)

```typescript
// Source: grid/src/audit/append-human-transferred.ts
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

export interface NousSpawnedByHumanPayload {
    readonly grid_name: string;
    readonly nous_did: string;
    readonly owner_human_did: string;
    readonly tick: number;
}

const EXPECTED_KEYS = ['grid_name', 'nous_did', 'owner_human_did', 'tick'] as const;

export function appendNousSpawnedByHuman(
    audit: AuditChain,
    payload: NousSpawnedByHumanPayload,
): AuditEntry {
    // guards: type, DID_RE for nous_did, DID_RE for owner_human_did, non-empty grid_name, non-neg tick
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendNousSpawnedByHuman: unexpected key set`);
    }
    const cleanPayload = {
        grid_name: payload.grid_name,
        nous_did: payload.nous_did,
        owner_human_did: payload.owner_human_did,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) throw new TypeError(`appendNousSpawnedByHuman: privacy violation`);
    return audit.append('nous.spawned_by_human', payload.nous_did, cleanPayload);
}
```

### JWT Auth Helper (reuse from chat.ts)

```typescript
// Source: grid/src/api/portal/chat.ts — requireAuth helper
import { jwtVerify } from 'jose';
import { COOKIE_NAME, keyPairPromise } from './auth.js';

async function requireAuth(req, reply): Promise<string | null> {
    const token = req.cookies[COOKIE_NAME];
    if (!token) { reply.status(401).send({ error: 'not_authenticated' }); return null; }
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        const did = payload['did'] as string;
        if (!did?.startsWith('did:noesis:')) { reply.status(401).send({ error: 'invalid_token' }); return null; }
        return did;
    } catch { reply.status(401).send({ error: 'invalid_token' }); return null; }
}
```

### My Nous Page — Double-duty Pattern (pseudocode)

```typescript
// dashboard/src/app/portal/my-nous/page.tsx
'use client';
export default function MyNousPage() {
    const [nousData, setNousData] = useState<NousRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${gridBase}/api/v1/portal/human/me/nous`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => { setNousData(data.nous ?? null); setLoading(false); });
    }, []);

    if (loading) return <LoadingState />;
    if (!nousData) return <EmptyStateCTA />;  // → navigate to /portal/nous/spawn
    return <OwnerHub nous={nousData} />;     // HeroCard + tabs + owner section
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Operator-only Nous spawn (spawn-system-nous.ts) | Portal human spawn via payment gate | Phase 28 | New route, new auth model (JWT not header-auth) |
| `bootstrapPsycheHash(did, key, tick)` | `bootstrapPsycheHash(did, key, tick, seed?)` | Phase 28 | Audit hash carries seed influence; Brain chat personality shaped via system prompt |
| HeroCard hardcoded for sophia/hermes/themis | HeroCard extended for personal Nous | Phase 28 | `NOUS_METADATA` and `AVATAR_MAP` need personal-Nous entries (generic avatar) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brain does NOT need a new HTTP endpoint for personality injection — chat personality is shaped via system prompt in `NOUS_SYSTEM_PROMPTS` in `chat.ts` | Pitfall 1 | If Brain must receive personality data via API, new Brain HTTP route needed — adds significant scope |
| A2 | A generic "Personal Nous" SVG avatar is acceptable for Phase 28 (not three-Nous named avatars) | HeroCard reuse | If per-seed avatars are required, 4 new avatar components needed |
| A3 | `GET /api/v1/portal/human/me/nous` is the right endpoint shape for "does this human have a Nous?" | My Nous page | Could also extend `GET /me` to include `nousOwned` — either works, but adds to auth route scope |

---

## Open Questions

1. **How does a personal Nous get its distinct personality in the LLM prompt?**
   - What we know: Brain's `NOUS_SYSTEM_PROMPTS` dict in `chat.ts` is keyed by `nousId`
     (`sophia`, `hermes`, `themis`). The personal Nous will have a DID-based ID.
   - What's unclear: Does the Grid generate a system prompt at spawn time and store it in MySQL
     for the chat route to fetch? Or does `chat.ts` generate it dynamically from the seed type
     stored in `nous_registry.personality_seed`?
   - Recommendation: Store `personality_seed` in `nous_registry` (migration v15). In `chat.ts`,
     when `nousId` is not in `NOUS_SYSTEM_PROMPTS`, query `nous_registry` for the seed and
     generate a dynamic prompt. This is the simplest approach consistent with D-02 (same endpoint).

2. **Treasury address for spawn payment**
   - What we know: SPAWN-01 says user pays on-chain to Grid treasury. `SPAWN_COST_USDT` is env-configurable.
   - What's unclear: What is the treasury EVM address? Is it in an env var (`GRID_TREASURY_ADDRESS`)?
   - Recommendation: Add `GRID_TREASURY_ADDRESS` env var. Wizard reads it from Grid via a
     `GET /api/v1/portal/nous/spawn/config` endpoint that returns `{cost_usdt, treasury_address}`.

3. **Username derivation for DID scheme**
   - What we know: DID is `did:noesis:human-nous:<username>-<name>`. Username comes from human's
     display name (ENS or truncated address).
   - What's unclear: The `human_users` table has `did` and `eth_address` but no `display_name`
     column at current migration v14. Where does `<username>` come from?
   - Recommendation: Derive from the human DID: `did:noesis:human:<checksummed-eth>` → truncate
     the address to first 6 chars as username (e.g. `0xaBcD12` → `0xabcd12`). Or add a
     `display_name` column in migration v15.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL (humanPool) | personality_seed column, 1-Nous cap query | Existing `humanPool` in GridServices | — | Test stub pattern from existing portal test suite |
| ALLOW_HUMAN_SPAWNED_NOUS env var | spawn endpoint gate | Not set by default | — | Returns 503 spawn_not_enabled |
| SPAWN_COST_USDT env var | Payment amount | Not set (default 50) | — | Default fallback in code |
| GRID_TREASURY_ADDRESS env var | Payment destination | Not yet defined | — | Must be added to docker-compose |
| wagmi on client | Payment step | Already wired via PortalWagmiShell.tsx | — | — |

**Missing dependencies with no fallback:**
- `GRID_TREASURY_ADDRESS` — spawn payment target. Must be defined in `docker-compose.yml` grid service env before wizard can send on-chain payment.

**Missing dependencies with fallback:**
- `ALLOW_HUMAN_SPAWNED_NOUS` — if not set, wizard shows "coming soon" message (503 `spawn_not_enabled`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (grid), vitest (dashboard) |
| Config file | `grid/vitest.config.ts`, `dashboard/vitest.config.ts` |
| Quick run command | `cd grid && npx vitest run test/portal/spawn-nous.test.ts` |
| Full suite command | `cd grid && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPAWN-01 | POST /spawn rejects if no payment confirmed | unit | `vitest run test/portal/spawn-nous.test.ts` | Wave 0 |
| SPAWN-01 | POST /spawn accepts after payment confirmed | unit | `vitest run test/portal/spawn-nous.test.ts` | Wave 0 |
| SPAWN-02 | DID scheme `did:noesis:human-nous:*` | unit | `vitest run test/portal/spawn-nous.test.ts` | Wave 0 |
| SPAWN-03 | Returns 503 when ALLOW_HUMAN_SPAWNED_NOUS unset | unit | `vitest run test/portal/spawn-nous.test.ts` | Wave 0 |
| SPAWN-04 | `appendNousSpawnedByHuman` closed-tuple + privacy | unit | `vitest run test/audit/append-nous-spawned-by-human.test.ts` | Wave 0 |
| SPAWN-04 | Allowlist contains `nous.spawned_by_human` at pos 53 | unit | `vitest run test/audit/broadcast-allowlist.test.ts` | existing — edit |
| SPAWN-05 | GET /portal/human/me/nous returns owned Nous | unit | `vitest run test/portal/spawn-nous.test.ts` | Wave 0 |
| SPAWN-06 | Returns 409 when human already has Nous | unit | `vitest run test/portal/spawn-nous.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd grid && npx vitest run test/portal/spawn-nous.test.ts && npx vitest run test/audit/append-nous-spawned-by-human.test.ts`
- **Per wave merge:** `cd grid && npx vitest run && cd ../dashboard && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `grid/test/portal/spawn-nous.test.ts` — covers SPAWN-01, SPAWN-02, SPAWN-03, SPAWN-05, SPAWN-06
- [ ] `grid/test/audit/append-nous-spawned-by-human.test.ts` — covers SPAWN-04 sole-producer invariant
- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — edit to assert length 53

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT from `jose` (same pattern as all portal routes) |
| V3 Session Management | yes | `noesis_portal_token` httpOnly cookie |
| V4 Access Control | yes | Freeze/ban check via `check-frozen.ts` preHandler |
| V5 Input Validation | yes | Name length/charset, DID regex, seed enum, region validation |
| V6 Cryptography | yes | ed25519 key gen via `generateKeyPairSync` (same as system spawn) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Race condition on 1-Nous cap | Tampering | MySQL unique constraint on `(grid_name, human_owner)` or SELECT-then-INSERT in transaction |
| Payment replay: same txHash spawns twice | Tampering | Store confirmed txHash in a `spawn_payments` table; reject duplicate txHash |
| DID injection: name with special chars | Tampering | Name regex `/^[a-zA-Z0-9_]{3,32}$/`; DID regex `DID_RE` at entry point |
| Spawn while frozen | Elevation | `check-frozen.ts` PORTAL_ACTION_PATTERNS must include spawn routes |
| System prompt injection via Nous name | Information Disclosure | Name chars limited to alphanumeric + underscore; no interpolation into LLM system prompt without sanitization |

---

## Sources

### Primary (HIGH confidence)
- `grid/src/api/operator/spawn-system-nous.ts` — operator spawn reference pattern; DID generation; SpawnNousDeps injection; error ladder
- `grid/src/genesis/launcher.ts` — `spawnNous()` signature; `bootstrapPsycheHash()` function
- `grid/src/audit/broadcast-allowlist.ts` — current 52-member allowlist; confirmed `human.spoke` at pos 52
- `grid/src/audit/append-human-transferred.ts` — sole-producer pattern to clone
- `grid/src/registry/types.ts` — `humanOwner?: string` already present; `personality` field on `SpawnRequest`
- `grid/src/db/schema.ts` — migration v14 is current high watermark; no `personality_seed` column exists
- `grid/src/api/portal/check-frozen.ts` — `PORTAL_ACTION_PATTERNS`; spawn route exemption needed
- `grid/src/api/portal/chat.ts` — `NOUS_SYSTEM_PROMPTS` dict; `requireAuth` pattern
- `grid/src/api/portal/nous.ts` — `requireAuth` helper (same pattern used here)
- `grid/src/api/server.ts` — `GridServices` interface; `humanPool` service
- `brain/src/noesis_brain/psyche/types.py` — `PersonalityProfile` 6-dimension string-level model
- `brain/src/noesis_brain/psyche/loader.py` — `load_psyche()` from YAML dict
- `brain/src/noesis_brain/__main__.py` — Brain startup; no personality injection API
- `brain/src/noesis_brain/http/server.py` — Brain HTTP API only has 2 routes
- `dashboard/src/components/portal/WalletPanel.tsx` — wagmi `useWriteContract` pattern; ERC-20 ABI
- `dashboard/src/app/portal/nous/[id]/HeroCard.tsx` — Phase 27 HeroCard; `NOUS_METADATA`; Chat button
- `dashboard/src/app/portal/nous/[id]/page.tsx` — Phase 27 profile page structure to reuse
- `dashboard/src/app/portal/my-nous/page.tsx` — Phase 27 placeholder to replace
- `dashboard/src/app/portal/onboard/StepSophiaChat.tsx` — pulsing loading animation pattern
- `brain/data/nous/sophia.yaml` — Nous YAML config format; all 6 personality dimensions

### Secondary (MEDIUM confidence)
- `.planning/phases/28-personal-nous/28-CONTEXT.md` — all locked decisions D-01 through D-09
- `.planning/research/v2.5-requirements.md` §SPAWN — SPAWN-01 through SPAWN-06 requirements
- `.planning/STATE.md` — allowlist count 52 confirmed; migration v14 confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified in codebase; no new packages
- Grid route architecture: HIGH — spawn-system-nous.ts pattern is directly reusable
- Allowlist discipline: HIGH — appendHumanTransferred clone is exact template
- Brain personality model: HIGH — 6-dimension string-level confirmed in psyche/types.py
- Brain personality injection path: MEDIUM — D-01 (shared Brain) means personality in system prompt in chat.ts (A1 assumption)
- Payment flow: HIGH — WalletPanel.tsx is the exact pattern to reuse
- Dashboard owner hub: HIGH — Phase 27 components are importable without change

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (stable stack, 30-day window)
