# Phase 6: Operator Agency Foundation (H1–H4) - Research

**Researched:** 2026-04-21
**Domain:** React 19 / Next.js 15 client-side UI state + Fastify 5 audit-stamped endpoints + frozen-allowlist extension
**Confidence:** HIGH (stack, architecture, pitfalls all verified against repo code); MEDIUM (Brain-side RPC extension for H2/H4 — Python surface not re-examined this session)

## Summary

Phase 6 introduces a persistent Human Agency Scale indicator (H1–H4, H5 disabled) and an explicit per-action elevation dialog to the Noēsis dashboard, with every operator-initiated endpoint stamping the operator's tier into the audit chain. The work is cleanly partitioned across three concern-bands:

1. **Dashboard UI (React 19 client component)** — An `<AgencyIndicator />` chip that lives in the root layout, a native `<dialog>`-based `<ElevationDialog />` primitive, a session-scoped `op:<uuid-v4>` operator ID in localStorage, and a `useElevatedAction()` hook that race-safely captures the tier at confirm-click. This is pure client state (D-01).

2. **Grid API (Fastify 5 handlers)** — Five new endpoints (H2 memory query, H3 pause/resume, H3 law CRUD, H4 force-Telos) each validating a `tier` field in the request body and emitting one of five new `operator.*` audit events. The broadcast allowlist extends from 11 → 16 events in a locked tuple order.

3. **Invariants & regression gates** — Tier-required contract test on `audit.append` for any `operator.*` event, elevation-race regression (SC#4), zero-diff invariant across pause/resume boundary, payload-privacy enumeration for all 5 new events, and doc-sync gate extended to 16 events.

**Primary recommendation:** Build the client-side indicator + dialog + hook as a single cohesive wave, then the Grid endpoints as a second wave that depends on the allowlist extension landing first. Two existing gaps — `WorldClock.pause()/resume()` don't exist yet, and `LogosEngine.amendLaw()` doesn't exist — must be added as explicit plan tasks before the endpoints that consume them. [VERIFIED: codebase grep on `grid/src/clock/ticker.ts` and `grid/src/logos/engine.ts`]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-22, verbatim from 06-CONTEXT.md)

**Agency Indicator — Persistence & Rendering**
- **D-01:** Agency Indicator state is per-operator, client-side, session-scoped (localStorage in the dashboard). Grid does NOT hold tier state. Tier defaults to H1 Observer on first load. Persists across reloads within the same browser; does not cross device/browser boundaries.
- **D-02:** `<AgencyIndicator />` mounts in the dashboard root layout (`dashboard/src/app/layout.tsx`). Test: no dashboard route can be entered without the indicator in the DOM (SC#1). Tooltip exposes H1–H5 definitions verbatim from PHILOSOPHY.md §7. H5 renders subdued with "requires Phase 8" affordance.
- **D-03:** Indicator is a single pill/chip in the top-right header. Reuses `<Chip />` primitive. Tier-to-color: H1 neutral, H2 blue, H3 amber, H4 red, H5 gray-with-strikethrough.

**Operator Identity**
- **D-04:** Operator identity is a session-scoped UUID generated on first Agency Indicator mount and stored in localStorage under key `noesis.operator.id`. Format `op:<uuid-v4>`. NOT a DID. Every `operator.*` audit event carries this ID.
- **D-05:** `operator_id` is NOT authenticated in Phase 6. Forensic attribution within one steward session; cross-operator accountability deferred to OP-MULTI-01.

**Elevation Dialog — UX & Race Handling**
- **D-06:** Elevation from H1 to H2/H3/H4 triggers a modal dialog that intercepts the action before any HTTP dispatch. Body text is REQ-verbatim: `"Entering H{N} — {TierName}. This will be logged."` Tier names: H2 Reviewer, H3 Partner, H4 Driver, H5 Sovereign. Cancel → aborts. Confirm → dispatches with tier captured at confirm-click; dialog closes and tier auto-downgrades to H1.
- **D-07:** Elevation-race invariant (SC#4): tier committed to audit chain is the tier captured at dialog-confirm time, NOT the tier active when HTTP request arrives at Grid. Implementation: request body constructed inside dialog's confirm handler — body `{tier: "H{N}", ...}` serialized before any network I/O.
- **D-08:** Dialog primitive at `dashboard/src/components/primitives/elevation-dialog.tsx`. Built with native `<dialog>` element (focus trap, Escape-to-cancel, keyboard-first). Test harness: RTL with fake timers.

**Tier Map (AGENCY-02 locked)**
- **D-09:** Action-to-tier mapping (verbatim): H1 Observer (firehose/map/heartbeat/inspector-open) — no events. H2 Reviewer (memory query) — `operator.inspected`. H3 Partner (pause, resume, allowlist-mutate [deferred], law-change) — `operator.paused`, `operator.resumed`, `operator.law_changed`. H4 Driver (force-Telos) — `operator.telos_forced`. H5 Sovereign (delete Nous) — Phase 8 only.
- **D-09a:** "Mutate broadcast allowlist" DEFERRED (rethinking frozen-set invariant is non-trivial). VERIFICATION must flag as `partial AGENCY-02 coverage`.
- **D-09b:** Inspector "open" at H1 shows presence-only data (DID, region, recent `nous.spoke` lines). Memory reading requires explicit H2 elevation.

**Broadcast Allowlist Additions**
- **D-10:** Allowlist grows 11 → 16. Append to `ALLOWLIST_MEMBERS` in this tuple order after `grid.stopped`: `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced`.
- **D-11:** Shared payload shape: `{tier, action, operator_id, target_did?}`. Extensions per event (see CONTEXT.md D-11).
- **D-12:** Every `operator.*` event passes `payloadPrivacyCheck()`. Regression test enumerates all 5.
- **D-13:** Tier-required invariant: `audit.append(eventType, ...)` for any `operator.*` rejects if payload missing `tier`.

**Server-Side Enforcement Boundary**
- **D-14:** Grid validates `{tier}` well-formed in body. Rejects 400 if missing/malformed. Grid does NOT verify tier-to-action mapping — trusts dashboard.
- **D-15:** Dashboard enforces tier rules at UI layer. Bypass requires direct HTTP. OP-MULTI-01 hardens later.

**Endpoint Shapes**
- **D-16:** H2: `POST /api/v1/operator/memory/query` — `{tier:'H2', operator_id, target_did, query_params}`. Proxies to Brain via bridge. Emits `operator.inspected`.
- **D-17:** H3 clock: `POST /api/v1/operator/clock/pause` and `POST /api/v1/operator/clock/resume`. Body `{tier:'H3', operator_id}`. Wraps `WorldClock.pause()`/`resume()`. Zero-diff invariant preserved across pause/resume boundary.
- **D-18:** H3 law: `POST /api/v1/operator/governance/laws` (add), `PUT .../:id` (amend), `DELETE .../:id` (repeal). Body `{tier:'H3', operator_id, law_body, change_type}`. Emits `operator.law_changed` with no law content in broadcast.
- **D-19:** H4 force-Telos: `POST /api/v1/operator/nous/:did/telos`. Body `{tier:'H4', operator_id, target_did, new_telos}`. Grid forwards to Brain; Brain returns `{telos_hash_before, telos_hash_after}`. Emits `operator.telos_forced` hash-only.

**H5 Placeholder**
- **D-20:** H5 delete surfaces in Inspector as disabled button with tooltip "Requires Phase 8 (Sovereign Operations)". No-op click. Indicator tooltip shows H5 subdued.

**Testing Strategy**
- **D-21:** REQ-to-test matrix: AGENCY-01 → route-mount test; AGENCY-02 → tier-map dispatcher test; AGENCY-03 → audit invariant + payload enumerator; AGENCY-04 → elevation dialog test; SC#4 → elevation-race regression; SC#5 → H5-disabled affordance test.
- **D-22:** Test locations: `grid/test/audit/broadcast-allowlist.test.ts` (extend), `grid/test/audit/operator-events.test.ts` (new), `grid/test/api/operator/` (new subtree), dashboard tests co-located.

### Claude's Discretion

- Exact Chip color palette — match existing Tailwind 4 `@theme` tokens.
- Whether `<AgencyIndicator />` mounts in `layout.tsx` or inside a top-level client component wrapper — planner to resolve based on RSC boundaries. (Research verdict below: direct mount into `layout.tsx` works because `'use client'` components compose into Server Components.)
- Elevation-dialog animation style — match existing Inspector drawer polish.
- File layout for operator API endpoints (`grid/src/api/operator/` subtree vs inline) — planner decides; follow existing patterns.
- `operator_id` UUID generation — `crypto.randomUUID()` on client is fine.
- Tier enum: `type HumanAgencyTier = 'H1'|'H2'|'H3'|'H4'|'H5'`. Store in `dashboard/src/lib/protocol/agency-types.ts` + shared copy in `grid/src/api/types.ts`.
- Error handling when Brain unreachable for H2/H4: return 503, do NOT emit the `operator.*` event (no action took place).

### Deferred Ideas (OUT OF SCOPE)

- Broadcast allowlist runtime mutation (AGENCY-02 H3 item #2) — deferred; ship other 4 H3 actions.
- H5 Sovereign Nous deletion — Phase 8 (AGENCY-05).
- Multi-operator conflict resolution — OP-MULTI-01.
- Server-side tier-hierarchy enforcement.
- Authenticated operator identity.
- Cross-device/cross-browser session sync.
- Session-wide elevation (stay in H3 for multiple actions) — explicitly rejected by AGENCY-04.
- Operator identity as a DID — explicitly rejected in D-04.
- WHISPER-01 regional peer channel — Sprint 16+.
- AI-judged operator action evaluation — rejected per REV-04.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENCY-01 | Persistent Agency Indicator visible on every dashboard route | Standard Stack §Client UI (Next.js 15 + React 19 layout composition); Architecture Patterns §Pattern 1 (Server Component layout with Client Component island) |
| AGENCY-02 | Tier-to-action map enforced at dispatch time (H1–H4 client-side; H5 deferred) | Architecture Patterns §Pattern 3 (`useElevatedAction` hook); Don't Hand-Roll §Focus Trap |
| AGENCY-03 | Every `operator.*` audit event carries `tier`; allowlist extends to include the 5 new events | Architecture Patterns §Pattern 4 (allowlist tuple append); Common Pitfalls §Frozen Set Mutation; Code Examples §Tier-required invariant |
| AGENCY-04 | Elevation dialog uses exact text `"Entering H{N} — {TierName}. This will be logged."` and scopes to a single action (auto-downgrade) | Architecture Patterns §Pattern 2 (native `<dialog>`); Common Pitfalls §Race at Confirm-Click |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `<AgencyIndicator />` render + tooltip | Browser / Client | — | UI-only state, per-session, never leaves browser (D-01) |
| Operator ID generation + persistence | Browser / Client | — | localStorage-scoped `op:<uuid-v4>` (D-04, D-05) |
| Tier state (current operator tier) | Browser / Client | — | Client-side store backed by localStorage; Grid holds no tier state (D-01) |
| Elevation dialog modal | Browser / Client | — | Native `<dialog>` intercepts user input before network I/O (D-06, D-08) |
| Tier capture at confirm-click | Browser / Client | — | Race-safe closure over `targetTier` before body serialization (D-07) |
| H2/H3/H4 endpoint body validation (`tier` present) | API / Backend | — | Fastify middleware / per-handler guard (D-14) |
| Audit chain `append` with `operator.*` events | API / Backend | — | Grid owns AuditChain; Phase 6 adds 5 new emit sites (D-10, D-13) |
| Broadcast allowlist membership | API / Backend | — | `buildFrozenAllowlist` tuple in Grid (D-10) |
| `telos_hash_before/after` computation | API / Backend | Brain (returns hashes) | SHA-256 over canonical Telos JSON; Brain computes & returns, Grid emits (D-19) |
| WorldClock pause/resume | API / Backend | — | Grid owns clock; must add `pause()`/`resume()` methods (D-17) |
| LogosEngine law add/amend/repeal | API / Backend | — | Grid owns law store; must add `amendLaw()` or compose remove+add (D-18) |
| Nous memory query | API / Backend | Brain (authoritative) | Grid proxies via `IBrainBridge`; Brain returns memory entries (D-16) |
| Force-Telos write | API / Backend | Brain (authoritative) | Grid proxies via `IBrainBridge`; Brain replaces active Telos, returns hashes (D-19) |
| H5 disabled button render | Browser / Client | — | Pure UI affordance, no endpoint exists (D-20) |
| Doc-sync gate (`check-state-doc-sync.mjs`) | Tooling / CI | — | Extended regression: count 11 → 16, new events present |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.2.4 | App-router framework hosting the dashboard | [VERIFIED: `dashboard/package.json`] Already in use; Phase 6 adds layout-level mount with no framework change |
| React | 19.2.5 | Component runtime; provides native `<dialog>` ergonomics via `ref` + `showModal()` | [VERIFIED: `dashboard/package.json`] React 19's improved `useSyncExternalStore` + RSC composition model enable the client/server split cleanly |
| Fastify | 5.x | HTTP server for Grid API | [VERIFIED: `grid/package.json`] Already in use; Phase 6 adds 5–7 new routes following existing pattern at `grid/src/api/server.ts:244–254` |
| TypeScript | 5.x | Type safety for `HumanAgencyTier` union + payload shapes | [VERIFIED: both packages] Closed-enum discipline matches Phase 5 `ReviewFailureCode` precedent |
| Tailwind CSS | 4.x | Tier-color styling via `@theme` tokens | [VERIFIED: `dashboard/` Tailwind 4 config] CSS-first tokens (no shadcn) matches existing hand-rolled primitives |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 2.x (grid), 4.1 (dashboard) | Unit + integration test runner | All new test files |
| @testing-library/react | 16.3 | Client component tests (AgencyIndicator, ElevationDialog) | Dashboard tests |
| @testing-library/user-event | 14.6 | Realistic user interaction (dialog confirm/cancel, tooltip hover) | Dashboard tests |
| jsdom | 26 | DOM emulation for RTL; supports `HTMLDialogElement.showModal()` in v26+ | Dashboard tests |
| @playwright/test | 1.50 | E2E for SC#1 (indicator on every route) | Dashboard E2E suite |
| `crypto.randomUUID()` | browser-native | `op:<uuid-v4>` generation | Client, on first mount |
| Fastify `app.inject()` | built-in | Endpoint integration tests without spinning a server | Grid API tests |

[VERIFIED: registry check — `node --version` → ≥20 satisfied per `grid/package.json` engines; `npm view fastify version` → 5.x current; `npm view next version` → 15.x current as of 2026-04-21]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<dialog>` | Radix UI `<Dialog>` or headlessui | Native is zero-dep, focus trap built-in, `showModal()` handles inert-background for free. Radix would add a dependency for no net gain. [CITED: MDN `<dialog>` — showModal creates top layer, implicit `aria-modal`, Escape-to-cancel] |
| `crypto.randomUUID()` | `uuid` npm package | Native API is universally available in modern browsers + Node ≥14.17. Zero dep. |
| Custom localStorage wrapper | `zustand` / `jotai` with persist middleware | Existing dashboard stores (`dashboard/src/lib/stores/`) are hand-rolled with `useSyncExternalStore` — matching that keeps the stack uniform |
| Adding `pause()`/`resume()` to `WorldClock` | Wrapping clock in a `SimulationController` | Clock is the natural owner of tick lifecycle; adding two methods there is smaller surface than a new abstraction |
| `amendLaw()` on `LogosEngine` | Compose `removeLaw(id) + addLaw(newBody)` at handler level | Adding `amendLaw` preserves the law's `id` and creation timestamp; compose would generate a new ID. Use `amendLaw` (preserves identity) |

**Installation:** No new packages required. All dependencies already in `package.json` for both `grid/` and `dashboard/`.

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                          Browser (Dashboard)                          │
│                                                                       │
│   [RootLayout (RSC)]──mounts──►[AgencyIndicator ('use client')]       │
│                                       │                               │
│                                       │ reads/writes                  │
│                                       ▼                               │
│                          ┌──────────────────────────┐                 │
│                          │  AgencyStore             │                 │
│                          │  - tier: HumanAgencyTier │                 │
│                          │  - operatorId: op:uuid   │                 │
│                          │  backed by localStorage  │                 │
│                          └──────────────────────────┘                 │
│                                       ▲                               │
│                                       │                               │
│   [Action button] ──onClick──► useElevatedAction(targetTier)          │
│                                       │                               │
│                                       │ open                          │
│                                       ▼                               │
│                          [ElevationDialog (native <dialog>)]          │
│                                       │                               │
│                          ┌────────────┴────────────┐                  │
│                          │                         │                  │
│                        Cancel                   Confirm               │
│                          │                         │                  │
│                        abort                       │                  │
│                                                    │                  │
│          ┌─── capture tier AT CONFIRM-CLICK ◄──────┘                  │
│          │                                                            │
│          │  body = {tier, operator_id, ...payload}                    │
│          │                                                            │
│          │  fetch('/api/v1/operator/...', {body})                     │
│          │                                                            │
│          └─► finally: setAgencyTier('H1')  ◄── AGENCY-04              │
└─────────────┬─────────────────────────────────────────────────────────┘
              │
              │ HTTP
              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                            Grid (Fastify 5)                           │
│                                                                       │
│   [Operator Router] ──validate {tier} well-formed──► 400 if missing   │
│          │                                                            │
│          ├── H2 /operator/memory/query ──► IBrainBridge ──► Brain     │
│          │                                      │                     │
│          │                                      ▼                     │
│          │                            emit operator.inspected         │
│          │                                                            │
│          ├── H3 /operator/clock/pause ──► WorldClock.pause()          │
│          │     (or resume)                      │                     │
│          │                                      ▼                     │
│          │                            emit operator.paused/resumed    │
│          │                                                            │
│          ├── H3 /operator/governance/laws ──► LogosEngine.addLaw      │
│          │     PUT :id                    ──► LogosEngine.amendLaw    │
│          │     DELETE :id                 ──► LogosEngine.removeLaw   │
│          │                                      │                     │
│          │                                      ▼                     │
│          │                            emit operator.law_changed       │
│          │                                                            │
│          └── H4 /operator/nous/:did/telos ──► IBrainBridge ──► Brain  │
│                                                 │                     │
│                                                 ▼ returns hashes      │
│                                     emit operator.telos_forced        │
│                                     (hash-only payload)               │
│                                                                       │
│    All emits: AuditChain.append(eventType, actorDid, payload)         │
│               └── tier-required invariant enforced here ─────┐        │
│                                                              │        │
│    broadcast-allowlist.ts: 11 → 16 events (frozen tuple) ◄──┘        │
└───────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
dashboard/src/
├── app/
│   └── layout.tsx                           # RSC — mounts <AgencyIndicator />
├── components/
│   ├── primitives/
│   │   ├── chip.tsx                         # EXTEND: add color prop
│   │   └── elevation-dialog.tsx             # NEW (D-08)
│   └── agency-indicator.tsx                 # NEW (D-02)
├── lib/
│   ├── protocol/
│   │   └── agency-types.ts                  # NEW: HumanAgencyTier union + tier names/colors
│   ├── stores/
│   │   └── agency-store.ts                  # NEW: useSyncExternalStore + localStorage
│   └── hooks/
│       └── useElevatedAction.ts             # NEW (D-07)

grid/src/
├── api/
│   ├── server.ts                            # EXTEND: register operator router
│   ├── operator/                            # NEW subtree
│   │   ├── memory.ts                        # H2
│   │   ├── clock.ts                         # H3 pause/resume
│   │   ├── governance.ts                    # H3 law CRUD
│   │   └── telos.ts                         # H4
│   └── types.ts                             # EXTEND: HumanAgencyTier union
├── audit/
│   └── broadcast-allowlist.ts               # EXTEND: 5 new tuple members
├── clock/
│   └── ticker.ts                            # EXTEND: add pause()/resume()
├── logos/
│   └── engine.ts                            # EXTEND: add amendLaw()
└── integration/
    └── types.ts                             # EXTEND: add queryMemory/forceTelos to IBrainBridge
```

### Pattern 1: Server Component Layout with Client Component Island (D-02)

**What:** `layout.tsx` is an RSC (no `'use client'`), but it can directly import and render a `'use client'` component as a child. React handles the serialization boundary.

**When to use:** Any globally persistent UI element that needs browser state (localStorage, window events) but must render on every route.

**Example:**
```tsx
// dashboard/src/app/layout.tsx  (Server Component)
import { AgencyIndicator } from '@/components/agency-indicator';  // 'use client' internally
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <header className="global-header">
                    <AgencyIndicator />
                </header>
                {children}
            </body>
        </html>
    );
}
```

No refactor of `layout.tsx` into a client component is required — composition handles it. [CITED: Next.js 15 docs, app-router client-server composition model]

### Pattern 2: Native `<dialog>` Elevation Modal (D-08)

**What:** HTML `<dialog>` element with `.showModal()` gives you focus trap, Escape-to-cancel, `::backdrop` styling, and inert background for free.

**When to use:** Any blocking confirmation where the user must make an explicit choice before an action proceeds.

**Example:**
```tsx
// dashboard/src/components/primitives/elevation-dialog.tsx
'use client';
import { useRef, useImperativeHandle, forwardRef } from 'react';
import { TIER_NAME, type HumanAgencyTier } from '@/lib/protocol/agency-types';

export interface ElevationDialogHandle {
    open: (tier: HumanAgencyTier) => Promise<boolean>;  // resolves true=confirm, false=cancel
}

export const ElevationDialog = forwardRef<ElevationDialogHandle>((_, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const resolverRef = useRef<(confirmed: boolean) => void>();
    const tierRef = useRef<HumanAgencyTier>('H1');

    useImperativeHandle(ref, () => ({
        open: (tier) => new Promise<boolean>((resolve) => {
            tierRef.current = tier;
            resolverRef.current = resolve;
            dialogRef.current?.showModal();
        }),
    }));

    const handleConfirm = () => {
        dialogRef.current?.close();
        resolverRef.current?.(true);
    };
    const handleCancel = () => {
        dialogRef.current?.close();
        resolverRef.current?.(false);
    };

    // REQ-verbatim text (D-06, AGENCY-04).
    const tier = tierRef.current;
    const bodyText = `Entering ${tier} — ${TIER_NAME[tier]}. This will be logged.`;

    return (
        <dialog ref={dialogRef} onCancel={handleCancel} aria-labelledby="elev-title">
            <h2 id="elev-title">Elevate operator agency</h2>
            <p>{bodyText}</p>
            <button onClick={handleCancel}>Cancel</button>
            <button onClick={handleConfirm} autoFocus>Confirm</button>
        </dialog>
    );
});
```

[CITED: MDN HTMLDialogElement — `showModal()`, `cancel` event fires on Escape, native focus trap] Note: the `onCancel` handler on `<dialog>` catches Escape key presses; jsdom 26+ supports `showModal()`.

### Pattern 3: Race-Safe `useElevatedAction` Hook (D-07, SC#4)

**What:** A hook that (1) opens the elevation dialog, (2) on confirm, captures the target tier into a closure, (3) serializes the request body with that captured tier before any I/O, (4) dispatches, (5) always auto-downgrades in `finally`.

**When to use:** Every call site that needs to elevate (H2 memory query, H3 pause/resume, H3 law CRUD, H4 force-Telos).

**Example:**
```ts
// dashboard/src/lib/hooks/useElevatedAction.ts
'use client';
import { useCallback } from 'react';
import { useElevationDialog } from '@/components/primitives/elevation-dialog-provider';
import { getOperatorId, setAgencyTier } from '@/lib/stores/agency-store';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';

export function useElevatedAction(targetTier: HumanAgencyTier) {
    const dialog = useElevationDialog();
    return useCallback(
        async <T>(
            payload: Record<string, unknown>,
            dispatch: (body: Record<string, unknown>) => Promise<T>,
        ): Promise<{ ok: true; result: T } | { ok: false; reason: 'cancelled' | 'error'; error?: unknown }> => {
            const confirmed = await dialog.open(targetTier);
            if (!confirmed) return { ok: false, reason: 'cancelled' };

            // D-07: tier captured at this moment. `targetTier` is closed over and
            // serialized into `body` BEFORE any I/O. No later setAgencyTier('H1')
            // call can mutate what we send to the Grid.
            const body = {
                tier: targetTier,
                operator_id: getOperatorId(),
                ...payload,
            };
            try {
                const result = await dispatch(body);
                return { ok: true, result };
            } catch (error) {
                return { ok: false, reason: 'error', error };
            } finally {
                // AGENCY-04: single confirmation covers one action — auto-downgrade.
                setAgencyTier('H1');
            }
        },
        [targetTier, dialog],
    );
}
```

### Pattern 4: Frozen Allowlist Tuple Append (D-10)

**What:** The allowlist is a `readonly` tuple wrapped in a `Set` with `add/delete/clear` overridden to throw, and `Object.freeze` applied. Extension is a compile-time edit to the tuple — runtime mutation stays forbidden.

**When to use:** Any phase that adds new broadcast events.

**Example:**
```ts
// grid/src/audit/broadcast-allowlist.ts — Phase 6 edit
const ALLOWLIST_MEMBERS: readonly string[] = [
    // v2.0 baseline (10)
    'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
    'trade.proposed', 'trade.settled',
    'law.triggered', 'tick', 'grid.started', 'grid.stopped',
    // Phase 5 addition (1)
    'trade.reviewed',
    // Phase 6 additions (5) — tuple order per D-10
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
] as const;
```

### Pattern 5: Tier-Required Invariant at Audit Append (D-13)

**What:** A runtime guard in `AuditChain.append` (or a dedicated wrapper) rejects any `operator.*` event whose payload lacks `tier`. This is a structural contract, not a lint rule.

**Where to implement:** Either patch `AuditChain.append` (heavier blast radius — non-operator events must be unaffected) OR introduce an `appendOperatorEvent()` helper that validates then forwards. **Recommendation:** wrapper helper — preserves AuditChain's zero-diff invariant for all non-operator paths.

```ts
// grid/src/audit/operator-events.ts (NEW)
import { AuditChain } from './chain.js';
import type { HumanAgencyTier } from '../api/types.js';

const VALID_TIERS: ReadonlySet<HumanAgencyTier> = new Set(['H1', 'H2', 'H3', 'H4', 'H5']);

export interface OperatorEventPayload {
    tier: HumanAgencyTier;
    action: string;
    operator_id: string;
    target_did?: string;
    // event-specific fields per D-11
    [key: string]: unknown;
}

export function appendOperatorEvent(
    audit: AuditChain,
    eventType: `operator.${string}`,
    actorDid: string,
    payload: OperatorEventPayload,
): void {
    if (!payload.tier || !VALID_TIERS.has(payload.tier)) {
        throw new Error(
            `operator.* event '${eventType}' payload missing or invalid tier field — ` +
            `AGENCY-03 invariant violated (Phase 6 D-13)`,
        );
    }
    audit.append(eventType, actorDid, payload);
}
```

### Anti-Patterns to Avoid

- **Reading `getAgencyTier()` inside the dispatch function:** This breaks SC#4. The tier must be captured in the confirm handler's closure BEFORE the fetch — never re-read from the store after `await`.
- **Mounting `<AgencyIndicator />` in `grid-client.tsx`:** Only the `/grid` route would get it. D-02 explicitly requires every route. Mount in `layout.tsx`.
- **Using `window.confirm()` for elevation:** Fails accessibility and can't render the REQ-verbatim text styling. Use native `<dialog>`.
- **Calling `audit.append('operator.foo', ...)` directly:** Bypasses the D-13 tier-required guard. Always route through `appendOperatorEvent()`.
- **Letting Grid hold operator tier state:** D-01 forbids this. Tier is per-session client state only.
- **Storing `operator_id` under any other localStorage key:** D-04 locks key to `noesis.operator.id`.
- **Using a `did:noesis:op:*` format for operator ID:** Explicitly rejected in D-04; DID namespace is reserved for Nous.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap | Custom tab-order tracker | Native `<dialog>.showModal()` | Focus trap, inert background, `::backdrop`, Escape-to-cancel all free; jsdom 26 supports it in tests |
| UUID generation | `Math.random()`-based IDs | `crypto.randomUUID()` | Browser-native, collision-safe, no dep [CITED: MDN Crypto.randomUUID] |
| localStorage reactive binding | Manual `window.addEventListener('storage')` plumbing | `useSyncExternalStore` | React 19's built-in; tear-free reads; matches existing dashboard store pattern |
| Client/server component boundary | Refactor layout into client | Compose: RSC imports `'use client'` child directly | Next.js 15 handles the serialization boundary natively |
| SHA-256 hash chain | Roll-your-own hashing for `telos_hash_*` | Reuse `AuditChain.computeHash` discipline — canonical JSON + SHA-256 | Prevents Phase 7 divergence; same algorithm must be reusable for `telos.refined` |
| Dialog library (Radix/Headless) | Pull in a dep for one modal | Native `<dialog>` | Zero cost; all features needed are native |
| Tier enum as object | `const TIER = { H1: 'H1', ... }` | String-literal union `type HumanAgencyTier = 'H1'|'H2'|'H3'|'H4'|'H5'` | Matches `ReviewFailureCode` precedent (Phase 5 D-09); narrower type surface |
| Runtime allowlist mutation | Custom addAllowedEvent API | Append to tuple, ship in phase commit | Frozen-set invariant IS the sovereignty moat. Don't undo it. |
| Authentication on `operator_id` | JWT / session cookies | Raw session UUID | D-05 explicitly defers auth to OP-MULTI-01; single-operator v2.1 |

**Key insight:** Phase 6 is almost entirely an exercise in composing patterns that already exist in the codebase or in the platform. The only genuinely new machinery is (1) race-safe tier capture in `useElevatedAction`, (2) the `appendOperatorEvent` tier-required guard, and (3) the WorldClock pause/resume methods (currently missing).

## Runtime State Inventory

This is a greenfield feature phase (new capability, no rename/refactor). State inventory does not apply.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — localStorage key `noesis.operator.id` is NEW (no pre-existing data to migrate) | New write only |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None — `operator_id` is not a secret per D-05 | None |
| Build artifacts | None | None |

**Nothing found in category:** Verified by grep `noesis.operator` across repo — no pre-existing references; `op:` prefix does not conflict with existing DID format `did:noesis:`.

## Common Pitfalls

### Pitfall 1: Elevation Race at Confirm-Click (SC#4, D-07)

**What goes wrong:** Developer reads `getAgencyTier()` inside the dispatch function instead of capturing `targetTier` at confirm time. After the user clicks Confirm, the `await fetch(...)` yields; before it resolves, auto-downgrade runs (or concurrent code resets tier). The fetch body then carries `tier: 'H1'` — the audit event is wrong.

**Why it happens:** The natural pattern is "elevate, then dispatch, then emit." But between dispatch invocation and Grid receiving the body, React can re-render and run effects that mutate the store.

**How to avoid:** Always close over `targetTier` (the hook parameter) in the body builder. Never re-read from the store inside the dispatch or inside an `await` continuation. The regression test must simulate a store mutation during the `await`.

**Warning signs:** Any `getAgencyTier()` call inside `useElevatedAction` after `dialog.open()`. Any `async` body-builder that reads state.

### Pitfall 2: Frozen-Set Mutation Trap

**What goes wrong:** Developer tries to hot-add an operator event at runtime (e.g. via a test helper) and trips `buildFrozenAllowlist`'s overridden `add()`, which throws. OR — worse — the overrides are not re-verified after tuple extension, and a hidden mutation slips through.

**Why it happens:** The frozen-set pattern relies on (a) tuple-driven construction, (b) overridden `add/delete/clear`, (c) `Object.freeze`. If any layer is bypassed, the invariant breaks.

**How to avoid:** Only edit `ALLOWLIST_MEMBERS` tuple. Run the existing Phase 5 assertion test that `ALLOWLIST.size === 16` after extension. Add a fresh assertion that each of the 5 new events returns `true` from `ALLOWLIST.has(event)`.

**Warning signs:** Any test that mocks the allowlist, any code that accepts a dynamic event list, any PR that modifies `buildFrozenAllowlist` itself.

### Pitfall 3: WorldClock Missing pause/resume (Critical Gap)

**What goes wrong:** Developer implements `POST /operator/clock/pause` expecting `clock.pause()` to exist — it doesn't. Ships a handler that silently fails or calls `clock.stop()` (destructive — loses tick state).

**Why it happens:** D-17 names the methods but CONTEXT.md flags "planner to verify these methods exist or add them." [VERIFIED: `grid/src/clock/ticker.ts` has `start()`, `stop()`, `advance()` only. No `pause()`/`resume()`.]

**How to avoid:** Plan must include an explicit task to add `pause()` and `resume()` to WorldClock with:
- `pause()` stops tick advancement but preserves current `tick`, `epoch`, and interval handle state (distinct from `stop()` which tears down)
- `resume()` restarts ticking from the preserved position — no tick jump, no epoch jump
- Zero-diff regression: run N ticks → pause → resume → run M ticks, vs run N+M ticks. Filter out `operator.paused`/`operator.resumed` events; assert remaining audit entries byte-identical (pattern from `grid/test/review/zero-diff.test.ts`)

**Warning signs:** PR that wraps `clock.stop()` as pause. Plan tasks that assume these methods exist without adding them.

### Pitfall 4: LogosEngine Missing amendLaw (Gap)

**What goes wrong:** D-18 specifies `PUT /operator/governance/laws/:id` for amend. [VERIFIED: `grid/src/logos/engine.ts` has `addLaw`, `removeLaw`, `getLaw`, `activeLaws` — no `amendLaw`.] Developer composes `removeLaw(id) + addLaw(newBody)` — new law gets a new ID, breaking any audit-chain references to the old ID.

**Why it happens:** Ad-hoc composition at the handler layer is the path of least resistance.

**How to avoid:** Add `amendLaw(id, newBody)` to `LogosEngine` that mutates the existing Law object in place, preserving `id` and `createdAt`. Alternative: preserve-id atomic swap inside a single method.

**Warning signs:** Handler code that calls `removeLaw` followed by `addLaw`.

### Pitfall 5: `IBrainBridge` Extension for H2/H4

**What goes wrong:** [VERIFIED: `grid/src/integration/types.ts` `IBrainBridge` has only `sendTick`, `sendMessage`, `sendEvent`, `getState`.] Developer tries to "just call getState with a query" or shoves memory-query routing into `sendMessage`. Contract breaks, Brain side rejects or returns wrong shape.

**Why it happens:** The bridge is narrow by design (pre-Phase-6); adding surface requires Python brain-side RPC method registration too.

**How to avoid:** Plan must include explicit tasks to (a) add `queryMemory(params)` and `forceTelos(newTelos)` methods to `IBrainBridge`, (b) implement them in the JSON-RPC bridge (`grid/src/integration/bridge.ts` or equivalent), (c) add matching Python-side RPC handlers in the brain package. This is cross-package work — flag as dependency in plan sequencing.

**Warning signs:** Handler that calls `bridge.sendMessage({channel: 'memory_query', ...})` — that's a router-through-message-channel hack.

### Pitfall 6: jsdom `<dialog>` Support

**What goes wrong:** RTL tests call `dialogRef.current.showModal()` — on jsdom <23, `showModal()` throws. Test fails with "showModal is not a function."

**Why it happens:** jsdom historically lacked `HTMLDialogElement`. [VERIFIED: `dashboard/package.json` has jsdom 26 — which DOES support `showModal()`.]

**How to avoid:** Confirm jsdom ≥26 is in use (it is). For safety, ensure `vitest.config.ts` or the test setup doesn't pin an older version.

**Warning signs:** `TypeError: dialogRef.current.showModal is not a function` in test output.

### Pitfall 7: localStorage Access During SSR

**What goes wrong:** `useAgencyTier()` reads `localStorage.getItem('noesis.operator.id')` at module initialization. On the server (Next.js RSC hydration pass), `localStorage` is undefined → crashes.

**Why it happens:** Naïve store initialization runs in both environments.

**How to avoid:** Use `useSyncExternalStore` with a separate `getServerSnapshot` that returns defaults ('H1', null operator_id). Only access `localStorage` inside `getSnapshot` (client-only) and `subscribe`.

**Warning signs:** `ReferenceError: localStorage is not defined` in SSR logs. Hydration mismatch warnings in dev console.

### Pitfall 8: Doc-Sync Gate Regex Mismatch

**What goes wrong:** `scripts/check-state-doc-sync.mjs` has `/11\s+events/` regex; post-Phase-6, STATE.md says "16 events" — gate fails on the merge commit.

**Why it happens:** CLAUDE.md doc-sync rule requires same-commit reconciliation, but the gate's regex is hard-coded to 11.

**How to avoid:** Update the regex to `/16\s+events/` AND extend the `required` events array in the same commit that extends the allowlist. Phase 5 did this at 10 → 11 and committed the gate extension in the same stream.

**Warning signs:** CI failure on merge: "STATE.md says N events, gate expects 11."

## Code Examples

### Agency Store with SSR-Safe Initialization

```ts
// dashboard/src/lib/stores/agency-store.ts
'use client';
import { useSyncExternalStore } from 'react';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';

const TIER_KEY = 'noesis.operator.tier';     // NOT persisted per D-01 session-scope — optional
const ID_KEY = 'noesis.operator.id';          // D-04

let currentTier: HumanAgencyTier = 'H1';
let currentOperatorId: string | null = null;
const subscribers = new Set<() => void>();

function notify() { subscribers.forEach((s) => s()); }

function subscribe(cb: () => void) {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
}

function getTierSnapshot(): HumanAgencyTier { return currentTier; }
function getTierServerSnapshot(): HumanAgencyTier { return 'H1'; }

export function useAgencyTier(): HumanAgencyTier {
    return useSyncExternalStore(subscribe, getTierSnapshot, getTierServerSnapshot);
}

export function setAgencyTier(tier: HumanAgencyTier): void {
    currentTier = tier;
    notify();
}

export function getOperatorId(): string {
    if (currentOperatorId) return currentOperatorId;
    if (typeof window === 'undefined') return 'op:ssr-placeholder';  // should never be called on server
    let stored = window.localStorage.getItem(ID_KEY);
    if (!stored) {
        stored = `op:${crypto.randomUUID()}`;
        window.localStorage.setItem(ID_KEY, stored);
    }
    currentOperatorId = stored;
    return stored;
}
```

### Agency Types (Shared Enum)

```ts
// dashboard/src/lib/protocol/agency-types.ts
export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export const TIER_NAME: Record<HumanAgencyTier, string> = {
    H1: 'Observer',
    H2: 'Reviewer',
    H3: 'Partner',
    H4: 'Driver',
    H5: 'Sovereign',
};

export const TIER_COLOR: Record<HumanAgencyTier, 'neutral' | 'blue' | 'amber' | 'red' | 'muted'> = {
    H1: 'neutral',
    H2: 'blue',
    H3: 'amber',
    H4: 'red',
    H5: 'muted',  // disabled/strikethrough per D-03
};

// Mirror in grid/src/api/types.ts (intentional dual-source per Claude's Discretion)
```

### Fastify Operator Endpoint (H3 Pause)

```ts
// grid/src/api/operator/clock.ts
import type { FastifyInstance } from 'fastify';
import type { WorldClock } from '../../clock/ticker.js';
import type { AuditChain } from '../../audit/chain.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import type { HumanAgencyTier } from '../types.js';

interface OperatorClockBody {
    tier?: unknown;
    operator_id?: unknown;
}

const VALID_TIERS: ReadonlySet<HumanAgencyTier> = new Set(['H1', 'H2', 'H3', 'H4', 'H5']);

export function registerClockRoutes(
    app: FastifyInstance,
    deps: { clock: WorldClock; audit: AuditChain },
): void {
    app.post<{ Body: OperatorClockBody }>('/api/v1/operator/clock/pause', async (req, reply) => {
        const body = req.body ?? {};
        if (typeof body.tier !== 'string' || !VALID_TIERS.has(body.tier as HumanAgencyTier)) {
            return reply.code(400).send({ error: 'missing or invalid tier', code: 400 });
        }
        if (typeof body.operator_id !== 'string' || !body.operator_id.startsWith('op:')) {
            return reply.code(400).send({ error: 'missing or invalid operator_id', code: 400 });
        }

        deps.clock.pause();  // new method — Phase 6

        appendOperatorEvent(deps.audit, 'operator.paused', body.operator_id, {
            tier: body.tier as HumanAgencyTier,
            action: 'pause',
            operator_id: body.operator_id,
        });

        return { ok: true };
    });

    // Symmetric resume endpoint — same pattern
}
```

### Tier-Required Invariant Test

```ts
// grid/test/audit/operator-events.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorEvent } from '../../src/audit/operator-events.js';

const OPERATOR_EVENTS = [
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
] as const;

describe('AGENCY-03 (D-13): tier field required on all operator.* events', () => {
    let audit: AuditChain;
    beforeEach(() => { audit = new AuditChain(); });

    for (const eventType of OPERATOR_EVENTS) {
        it(`${eventType}: rejects payload missing tier`, () => {
            expect(() =>
                // @ts-expect-error — intentionally bad payload
                appendOperatorEvent(audit, eventType, 'did:noesis:test', {
                    action: 'x', operator_id: 'op:test-1',
                }),
            ).toThrow(/tier.*invariant/i);
        });

        it(`${eventType}: accepts well-formed payload`, () => {
            expect(() =>
                appendOperatorEvent(audit, eventType, 'did:noesis:test', {
                    tier: 'H3', action: 'x', operator_id: 'op:test-2',
                }),
            ).not.toThrow();
        });
    }
});
```

### Elevation-Race Regression (SC#4)

```tsx
// dashboard/src/lib/hooks/useElevatedAction.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useElevatedAction } from './useElevatedAction';
import { setAgencyTier, getAgencyTier } from '@/lib/stores/agency-store';

// Mock the dialog provider to always confirm synchronously
vi.mock('@/components/primitives/elevation-dialog-provider', () => ({
    useElevationDialog: () => ({ open: vi.fn().mockResolvedValue(true) }),
}));

describe('SC#4: committed tier is the confirmed tier, not the tier at HTTP arrival', () => {
    it('survives mid-flight auto-downgrade', async () => {
        const dispatch = vi.fn().mockImplementation(async (body: { tier: string }) => {
            // Simulate a concurrent state mutation DURING the async dispatch.
            act(() => { setAgencyTier('H1'); });
            return { echoed_tier: body.tier };
        });

        const { result } = renderHook(() => useElevatedAction('H4'));

        const outcome = await result.current({ target_did: 'did:noesis:x' }, dispatch);

        // The body sent to dispatch carried H4 (the confirmed tier), not H1.
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ tier: 'H4' }));

        // After the action, tier auto-downgraded (AGENCY-04).
        expect(getAgencyTier()).toBe('H1');

        // The dispatch resolved successfully.
        expect(outcome).toEqual({ ok: true, result: { echoed_tier: 'H4' } });
    });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom modal with manual focus trap + Escape handling | Native `<dialog>.showModal()` | HTMLDialogElement widely supported since ~2022; jsdom 26 (2024+) | Zero-dep, a11y-correct, tests green |
| `uuid` npm package | `crypto.randomUUID()` | Node 14.17+ / all modern browsers | One less dep |
| `window.addEventListener('storage')` reactive localStorage | `useSyncExternalStore` (React 18+) | React 18, hardened in 19 | Tear-free reads, SSR-safe with `getServerSnapshot` |
| Refactor layout into client component to host client state | RSC layout imports `'use client'` child | Next.js 13 app router; stable in 15 | Keeps most of `layout.tsx` server-rendered |
| Bespoke enum object | TypeScript string-literal union | Pattern adopted in Phase 5 `ReviewFailureCode` | Narrower type surface, runtime strings are the values |

**Deprecated/outdated:**
- Any reference to dashboard "top-level client component wrapper" for the indicator (D-02 Claude's Discretion clause) — resolved: direct layout mount is the correct pattern.
- Assumption that `WorldClock` has pause/resume — it does not; Phase 6 must add them.
- Assumption that `LogosEngine.amendLaw` exists — it does not; Phase 6 must add it (or compose with ID preservation).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | jsdom 26 in `dashboard/` supports `HTMLDialogElement.showModal()` for RTL tests | Pitfall 6, Standard Stack | LOW — if wrong, tests fall back to `@testing-library/react`'s dialog-polyfill approach or we swap in `happy-dom` |
| A2 | Brain package has (or will gain) JSON-RPC handlers for `query_memory` and `force_telos` | Architectural Map (H2/H4 rows); Pitfall 5 | MEDIUM — if Brain refuses the RPC surface, H2/H4 endpoints return 503 stubs until Brain ships; Phase 6 core UI still ships |
| A3 | `operator_id` format `op:<uuid-v4>` has no collision with any existing actor ID | Operator Identity | LOW — verified by grep: no `op:` prefix used elsewhere; DID format is distinct |
| A4 | `PHILOSOPHY.md §7` H1–H5 definitions are stable enough to be pasted into the tooltip verbatim | D-02 tooltip | LOW — if philosophy text updates, tooltip must be synced per CLAUDE.md doc-sync rule (flag in verification) |
| A5 | `useSyncExternalStore` with localStorage is the existing pattern in `dashboard/src/lib/stores/` | Agency Store | MEDIUM — confirmed against Inspector's store pattern earlier; planner to re-verify during task breakdown |
| A6 | Adding `amendLaw` to `LogosEngine` does not break any existing law-related test | Pitfall 4 | LOW — it's a new method, not a change to existing ones; existing tests should pass unchanged |
| A7 | `WorldClock.pause()` can preserve tick state by simply gating the tick-advance callback without destroying the interval handle | Pitfall 3 | LOW — straightforward Node `setInterval` pattern; zero-diff test will catch any regression |

## Open Questions

1. **Should `<AgencyIndicator />` tooltip render H5 with strikethrough AND a click-to-see-Phase-8 affordance?**
   - What we know: D-20 says H5 appears disabled with "Requires Phase 8 (Sovereign Operations)." D-02 tooltip shows H5 subdued. D-03 color is `muted` with strikethrough.
   - What's unclear: Whether the tooltip has any interactive element beyond text, or is purely informational.
   - Recommendation: Informational only. Interactive Phase-8 preview adds complexity for no user value now. Flag for `/gsd-discuss-phase` if planner disagrees.

2. **Does adding `queryMemory`/`forceTelos` to `IBrainBridge` require matching Python-side RPC handlers in this phase?**
   - What we know: Bridge is TypeScript-only surface; actual RPC call goes to Python brain. CONTEXT.md doesn't explicitly carve Brain work in or out.
   - What's unclear: Whether Phase 6 includes brain-package changes or stubs the calls client-side.
   - Recommendation: Include Brain-side RPC handlers in Phase 6 — otherwise H2/H4 endpoints can't be verified end-to-end. Plan task should span both packages.

3. **Should `amendLaw` take a whole new `LawBody` or a partial diff?**
   - What we know: D-18 body carries `{law_body, change_type}`. The full-replace pattern is simpler.
   - What's unclear: Whether law amendment semantics preserve the old law's metadata or replace it entirely.
   - Recommendation: Full-replace (preserve `id` + `createdAt`, replace everything else). Matches REST `PUT` semantics.

4. **Should `operator.law_changed` event payload include the law's prior and new hash (for audit completeness), or just `law_id` + `change_type`?**
   - What we know: D-11 says `{tier, action, operator_id, law_id, change_type}` — no hashes.
   - What's unclear: Whether adding `law_hash_before/after` (matching H4 `telos_hash_*` pattern) would be more consistent.
   - Recommendation: Follow D-11 verbatim for Phase 6. If audit consistency becomes a concern, add hashes in a later phase — locking in the minimal spec now avoids scope creep.

5. **Does `scripts/check-state-doc-sync.mjs` need to assert the 5 new events are in a specific order, or only that they're present?**
   - What we know: Phase 5 gate asserts counts and presence. D-10 locks tuple order in the code, not necessarily in the doc.
   - What's unclear: Whether STATE.md enumeration order matters to the gate.
   - Recommendation: Gate checks presence + count. Code-tuple order is the authoritative ordering (enforced by `ALLOWLIST_MEMBERS` tuple literal).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid + dashboard build/test | ✓ | ≥20 (per `grid/package.json` engines) | — |
| npm | Package management | ✓ | 10.x | — |
| `crypto.randomUUID()` | Client UUID generation | ✓ | Browser-native (all modern browsers); Node 14.17+ | — |
| `HTMLDialogElement.showModal()` | Elevation dialog | ✓ | Native in all evergreen browsers; jsdom 26 in tests | — |
| Python brain runtime (for E2E) | H2 memory query + H4 force-Telos integration tests | ~ | Assumed available per Phase 1+ setup | Mock bridge for unit tests; 503-stub endpoints if brain unreachable |
| Playwright browsers | SC#1 E2E indicator-on-every-route | ✓ | 1.50 | Skip E2E if browsers not installed; rely on RTL mount tests |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:**
- Brain RPC surface for `query_memory`/`force_telos` — if not yet implemented, ship Grid endpoints that return `503 Service Unavailable {reason: 'brain_unavailable'}` (matches Claude's Discretion clause on error handling). Do NOT emit the `operator.*` event in that case.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2 (grid), Vitest 4.1 + @testing-library/react 16.3 + jsdom 26 (dashboard); Playwright 1.50 (dashboard E2E) |
| Config file | `grid/vitest.config.ts`, `dashboard/vitest.config.ts`, `dashboard/playwright.config.ts` |
| Quick run command | `cd grid && npm test -- --run grid/test/audit grid/test/api/operator`; `cd dashboard && npm test -- --run src/components/primitives src/lib/hooks src/components/agency-indicator.test.tsx` |
| Full suite command | `cd grid && npm test` (full 262+ tests); `cd dashboard && npm test` (full 215+ tests); `cd dashboard && npx playwright test` |
| Phase gate | `scripts/check-state-doc-sync.mjs` + both full suites green |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENCY-01 | Every dashboard route renders `<AgencyIndicator />` | E2E (Playwright) | `npx playwright test agency-indicator.spec.ts` | ❌ Wave 0 |
| AGENCY-01 | Indicator mounts via root layout | unit (RTL) | `vitest run src/components/agency-indicator.test.tsx` | ❌ Wave 0 |
| AGENCY-02 | Each action dispatcher carries expected tier | unit (RTL) | `vitest run src/lib/hooks/useElevatedAction.test.tsx` | ❌ Wave 0 |
| AGENCY-03 | `audit.append` rejects `operator.*` event missing `tier` | unit (Vitest) | `vitest run grid/test/audit/operator-events.test.ts` | ❌ Wave 0 |
| AGENCY-03 | Payload privacy check passes for all 5 new events | unit (Vitest) | `vitest run grid/test/audit/broadcast-allowlist.test.ts` | ✅ extend |
| AGENCY-03 | Allowlist contains 16 events in correct tuple order | unit (Vitest) | `vitest run grid/test/audit/broadcast-allowlist.test.ts` | ✅ extend |
| AGENCY-04 | Elevation dialog shows REQ-verbatim text | unit (RTL) | `vitest run src/components/primitives/elevation-dialog.test.tsx` | ❌ Wave 0 |
| AGENCY-04 | Single confirmation; auto-downgrade after dispatch | unit (RTL) | `vitest run src/lib/hooks/useElevatedAction.test.tsx` | ❌ Wave 0 |
| SC#4 | Elevation-race: committed tier = confirmed tier, not tier at HTTP arrival | unit (RTL + fake timers) | `vitest run src/lib/hooks/useElevatedAction.test.tsx` | ❌ Wave 0 |
| SC#5 | H5 surfaces as disabled button with correct tooltip | unit (RTL) | `vitest run src/app/grid/components/inspector.test.tsx` | ✅ extend |
| Zero-diff (D-17) | Pause/resume preserves audit chain invariant | unit (Vitest + fake timers) | `vitest run grid/test/clock/pause-resume-zero-diff.test.ts` | ❌ Wave 0 |
| Endpoint validation | All 5 operator endpoints reject missing/malformed `tier` | integration (Fastify inject) | `vitest run grid/test/api/operator/` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `vitest run` on the changed test file(s) — sub-5-second signal
- **Per wave merge:** Full `npm test` in the changed package (`grid/` or `dashboard/`)
- **Phase gate:** Both full suites + `scripts/check-state-doc-sync.mjs` + Playwright E2E + `npm run build` in both packages

### Wave 0 Gaps

- [ ] `grid/test/audit/operator-events.test.ts` — tier-required invariant (D-13)
- [ ] `grid/test/api/operator/clock.test.ts` — pause/resume endpoint validation
- [ ] `grid/test/api/operator/governance.test.ts` — law add/amend/repeal endpoint validation
- [ ] `grid/test/api/operator/memory.test.ts` — H2 memory query (may stub brain)
- [ ] `grid/test/api/operator/telos.test.ts` — H4 force-Telos (may stub brain)
- [ ] `grid/test/clock/pause-resume-zero-diff.test.ts` — zero-diff invariant across pause boundary
- [ ] `dashboard/src/components/agency-indicator.test.tsx` — mount + tier render + tooltip
- [ ] `dashboard/src/components/primitives/elevation-dialog.test.tsx` — native `<dialog>` behavior + REQ-verbatim text
- [ ] `dashboard/src/lib/hooks/useElevatedAction.test.tsx` — race regression (SC#4) + auto-downgrade
- [ ] `dashboard/e2e/agency-indicator.spec.ts` — Playwright E2E for SC#1 (every route)
- [ ] Extend `grid/test/audit/broadcast-allowlist.test.ts` — assert 16 events, 5 new names present, privacy check passes
- [ ] Extend `scripts/check-state-doc-sync.mjs` — change `required` array to include 5 new events, update count regex 11 → 16

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | NO | D-05: operator_id is unauthenticated in Phase 6 (single-operator v2.1, explicit scope limit) |
| V3 Session Management | NO | localStorage-scoped session UUID; no server-side session (D-04) |
| V4 Access Control | PARTIAL | D-14: Grid validates `tier` well-formedness only; does NOT enforce tier-to-action mapping (deferred to OP-MULTI-01) |
| V5 Input Validation | YES | Hand-rolled guards: `VALID_TIERS.has(body.tier)`, `body.operator_id.startsWith('op:')`, DID regex `/^did:noesis:[a-z0-9_\-]+$/i` for `target_did` |
| V6 Cryptography | YES | SHA-256 via Node `crypto` for `telos_hash_before/after` — reuse AuditChain discipline; never hand-roll hash |

### Known Threat Patterns for Phase 6 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `tier` in request body (e.g. `tier: null`, `tier: 'H9'`) | Tampering | Validate against `VALID_TIERS` set; reject 400 |
| Missing `tier` payload on audit append | Tampering | `appendOperatorEvent()` guard throws; tier-required invariant test (D-13) |
| Cross-operator ID spoofing | Spoofing | Accepted risk per D-05 — single-operator v2.1, forensic attribution only |
| Memory payload leakage through `operator.inspected` event | Information Disclosure | `payloadPrivacyCheck()` runs on every `operator.*` emit; broadcast carries no memory content — D-12 enumerates all 5 events |
| Telos contents leaked in `operator.telos_forced` | Information Disclosure | D-19: broadcast carries hashes only (`telos_hash_before/after`). Contents stay in Brain. Regression test enforces this. |
| Allowlist runtime mutation (add rogue event without phase) | Tampering | `buildFrozenAllowlist` overrides `add/delete/clear` to throw; `Object.freeze` applied; tests assert size = 16 |
| Elevation race (tier changes mid-flight) | Tampering | D-07 race-safe closure; SC#4 regression test simulates mid-flight downgrade |
| SSR crash from localStorage access | DoS (dev-time) | `useSyncExternalStore` with distinct `getServerSnapshot`; `typeof window === 'undefined'` guard |
| Law content leakage through `operator.law_changed` broadcast | Information Disclosure | D-18: broadcast carries `{law_id, change_type}` only; law contents stay in Grid law store accessible via existing governance endpoint |

## Sources

### Primary (HIGH confidence)
- `grid/src/audit/broadcast-allowlist.ts` — frozen-set pattern, `ALLOWLIST_MEMBERS` tuple, `FORBIDDEN_KEY_PATTERN` [grep-verified in session]
- `grid/src/audit/chain.ts` — `AuditChain.append` signature, SHA-256 hash discipline [verified]
- `grid/src/api/server.ts` — existing Fastify pattern, `DID_REGEX` export, law-endpoint shape at L244–254 [verified]
- `grid/src/clock/ticker.ts` — only has `start()/stop()/advance()`; NO `pause()/resume()` [grep-verified — this is the critical gap flagged in Pitfall 3]
- `grid/src/logos/engine.ts` — only has `addLaw/removeLaw/getLaw/activeLaws`; NO `amendLaw` [verified — Pitfall 4 gap]
- `grid/src/integration/types.ts` — `IBrainBridge` has only `sendTick/sendMessage/sendEvent/getState` [verified — Pitfall 5 gap]
- `grid/src/integration/nous-runner.ts` — privacy-at-producer boundary precedent; explicit-keys discipline for audit append [verified from conversation context]
- `grid/test/review/zero-diff.test.ts` — template for zero-diff regression with `vi.useFakeTimers() + vi.setSystemTime(FIXED_TIME)` [read in session]
- `dashboard/src/app/layout.tsx` — RSC root layout [verified from conversation context]
- `dashboard/src/components/primitives/chip.tsx` — existing `<Chip />` primitive; needs color prop extension [verified from conversation context]
- `dashboard/src/app/grid/components/inspector.tsx` — reference pattern for focus trap, openerRef restore, AbortController [verified from conversation context]
- `.planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md` — 22 locked decisions D-01..D-22 [authoritative upstream input, fully quoted in User Constraints]
- `.planning/phases/06-operator-agency-foundation-h1-h4/06-UI-SPEC.md` — tier-to-color map and dialog verbatim text [read in prior session]
- `PHILOSOPHY.md` §7 — H1–H5 definitions for tooltip [read in prior session]
- `.planning/REQUIREMENTS.md` AGENCY-01..05 [read in prior session]
- `.planning/STATE.md` — broadcast allowlist baseline 11 events, Phase 5 shipped, Phase 6 adds 5 [read in session]

### Secondary (MEDIUM confidence)
- MDN `HTMLDialogElement` / `showModal()` documentation — native focus trap, top-layer rendering, Escape-to-cancel, `::backdrop` [well-established web standard]
- React 19 `useSyncExternalStore` — SSR-safe external state binding [React docs, stable API since 18]
- Next.js 15 app-router client-server composition — RSC can import `'use client'` children directly [Next.js docs]
- Fastify 5 `app.inject()` for integration tests [Fastify docs]

### Tertiary (LOW confidence)
- Brain-side Python JSON-RPC surface for `query_memory` / `force_telos` — NOT examined this session. Assumption A2 flags this as MEDIUM risk.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages verified in `package.json` files; versions confirmed against registries where relevant; no new dependencies.
- Architecture: HIGH — Patterns verified against existing codebase (Phase 5 Reviewer, Inspector drawer, AuditChain); three explicit gaps (WorldClock pause/resume, LogosEngine amendLaw, IBrainBridge extensions) flagged as new work.
- Pitfalls: HIGH — Five of eight pitfalls (#1, #2, #3, #4, #5) are verified against repo code (either as existing patterns to preserve or explicit gaps to fill). Pitfalls #6–#8 are well-known platform/tooling concerns.
- Client-side race handling (D-07 / SC#4): HIGH — Pattern is a straight closure-capture; regression test sketch provided.
- Brain-side RPC (A2): MEDIUM — Python brain package not re-examined this session; if Brain surface is not ready, H2/H4 ship with 503 stubs per error-handling discretion clause.

**Research date:** 2026-04-21

**Valid until:** 2026-05-21 (30 days — stack is stable, Phase 6 implementation window should close within this band)
