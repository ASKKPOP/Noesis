# Phase 13: Operator Replay & Export — Research

**Researched:** 2026-04-27
**Domain:** Deterministic replay engine + audit-chain tarball export + Steward Console rewind UI
**Confidence:** HIGH

## Summary

Phase 13 has unusually low novel-research surface area: every architectural primitive it
needs already exists in the codebase and has been hardened across Phases 5–12. The phase is
predominantly **disciplined cloning of established patterns** rather than greenfield design.

Three concrete novelties carry real risk and warrant the bulk of planner attention:

1. A new `better-sqlite3` dependency for the in-memory ReplayGrid chain — first SQLite
   dependency in the grid workspace `[VERIFIED: grid/package.json reads only mysql2 + fastify]`.
2. A bit-deterministic tarball whose hash is reproduced by a `replay-verify` CLI — requires
   canonical JSON, fixed mtime/uid/gid/mode, and sorted entries.
3. The first non-`api/server.ts` route in the dashboard's `app/grid/` tree to host two read-
   only operators (`<Firehose>`, `<Inspector>`, `<RegionMap>`) with cross-tier elevation that
   resets on route exit.

Everything else is a clone-and-rename of existing files: `appendNousDeleted` →
`appendOperatorExported`, `IrreversibilityDialog` → `ExportConsentDialog`,
`RelationshipListener.rebuildFromChain()` → ReplayGrid bootstrap, the `26→27` allowlist bump
discipline. The CI gate `check-replay-readonly.mjs` is a brand-new script but follows the
exact pattern of seven existing `scripts/check-*.mjs` files.

**Primary recommendation:** Plan five waves: (0) Dependency setup + test scaffolding;
(1) ReplayGrid + ReadOnlyAuditChain core; (2) deterministic tarball + replay-verify CLI;
(3) `operator.exported` event + allowlist bump + sole-producer; (4) `/grid/replay` UI +
`ExportConsentDialog`. CI gates and doc-sync co-commit with the appropriate landing wave.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-13-01:** Route is `/grid/replay` — a dedicated new Next.js page. Not a tab or drawer on
the existing `/grid` page. URL is bookmarkable and clearly distinguishes live-grid state from
historical replay state.

**D-13-02:** Nav entry — H3+ operators see a `Replay` link in the existing top nav alongside
`Grid` and `Governance`. H1/H2 operators do not see the link (tier-gated in nav, same pattern
as the existing agency-indicator tier chip). Nav entry added to `DASHBOARD_ROUTES` in the E2E
spec (clones Phase 6 SC#1 coverage discipline).

**D-13-03:** Component reuse — the replay page reuses the existing `<Firehose>`,
`<Inspector>`, and `<RegionMap>` components. Each component receives a `replayMode` prop (or
equivalent flag) to suppress write-back affordances and hide live-only controls. No replay-
specific component variants. Replay inherits future improvements to these components
automatically.

**D-13-04:** Navigation controls — a timeline slider spanning `start_tick`–`end_tick` plus a
numeric jump-to-tick input field. No step buttons required.

**D-13-05:** No auto-play. Manual step only — no play button, no speed multiplier, no wall-
clock timer in the replay UI. This preserves the determinism discipline and avoids
`Date.now`/`setInterval` coupling (extends Phase 10a–11 wall-clock grep gates to
`dashboard/src/app/grid/replay/**`).

**D-13-06:** Inline redaction with on-demand elevation. Telos-revealing fields (require H4)
and whisper-revealing fields (require H5) render as inline placeholders
(`— Requires H4` / `— Requires H5`) within the Inspector and Firehose components when the
operator's current tier is insufficient. The operator clicks an `Elevate` affordance beside
the redacted field, which opens the existing `<ElevationDialog>` without pausing the replay
scrubber.

**D-13-07:** Tier reset on route exit. Any H4/H5 elevation granted inside `/grid/replay`
resets to H1 when the operator navigates away from the replay route. Clones the Phase 6/8
auto-downgrade pattern (`agencyStore.setTier('H1')` on component unmount / route change).

**D-13-08:** Export is H5-consent-gated. Clones `<IrreversibilityDialog>` (Phase 8) — paste-
suppressed typed confirmation, verbatim copy locked in test assertions:
- Title: `Export audit chain slice`
- Warning body: `This export is permanent and cannot be undone. The tarball will contain the
  complete audit chain for the selected tick range. Anyone with the file can verify the chain.`
- Confirm label: `Export forever`
- Cancel label: `Keep private`
- Typed confirmation: operator types the **Grid-ID** (the grid's canonical name string,
  exposed at `GET /api/v1/grid/info`). Field must be typed manually — paste suppressed.

**D-13-09:** Allowlist event `operator.exported` — closed-tuple payload
`{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. `requested_at` is a
Unix timestamp in **seconds** (< 10_000_000_000, matching Phase 5 TradeRecord contract).
Sole-producer file: `grid/src/audit/append-operator-exported.ts`. Privacy matrix: no `body`,
`entries`, `text`, `chain_data` in the payload — only the 6 closed-tuple keys.

### Claude's Discretion

- ReplayGrid SQLite vs MySQL schema isolation strategy — planner chooses based on the
  better-sqlite3 integration approach already used in the test suite.
- Tarball format details (manifest field ordering, JSONL line structure) — planner defines,
  must satisfy the REPLAY-01 determinism criterion.
- `replay-verify` CLI ergonomics — planner designs command interface; success/failure exit
  codes are implementation decisions.
- Whether to add a `replay.* event` hard-ban in `scripts/check-state-doc-sync.mjs` or a
  separate CI gate — planner chooses the enforcement mechanism.

### Deferred Ideas (OUT OF SCOPE)

- Decision-level replay (re-running Brain prompts) — explicitly anti-feature per ROADMAP.
- Parquet export format — deferred to RIG-PARQUET-01.
- Witness-bundle plaintext export with H5 consent — WITNESS-BUNDLE-01 deferred to v2.3.
- Auto-play / speed multiplier for the scrubber.
- Mutating rewind (writing back to the live Grid) — anti-feature per ROADMAP.
- `replay.*` allowlist events — hard-banned. ReplayGrid runs its own isolated chain;
  nothing it does reaches the production allowlist.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REPLAY-01 | Deterministic tarball: JSONL audit slice + state snapshots + manifest with chain-tail hash; reproducible byte-for-byte; verified by `replay-verify` CLI | Standard Stack §Tarball; Architecture Patterns §Deterministic Export; Don't Hand-Roll §Canonical JSON & Tar |
| REPLAY-02 | `operator.exported` allowlist event (26→27); H5 typed-Grid-ID consent gate; sole-producer at `grid/src/audit/append-operator-exported.ts`; closed 6-tuple payload | Architecture Patterns §Sole-Producer Clone; Code Examples §appendOperatorExported skeleton; Common Pitfalls §P-13-04 |
| REPLAY-03 | ReplayGrid: configuration-over-fork of GenesisLauncher with in-memory better-sqlite3 chain, isolated MySQL schema, isolated WsHub port, fake Brain bridges, readonly chain contract (zero `.append(` in `grid/src/replay/**`) | Standard Stack §better-sqlite3; Architecture Patterns §ReadOnlyAuditChain; Common Pitfalls §P-13-01 (T-10-07) |
| REPLAY-04 | State-level (not decision-level) replay; LLM non-determinism documented as anti-feature; replay reconstructs derived state via existing `audit.onAppend` listeners + manual `loadEntries()` rebuild path | Architecture Patterns §State Reconstruction; Code Examples §rebuildFromChain pattern |
| REPLAY-05 | Steward Console Rewind panel at `/grid/replay`; H3+ tier-gated; reuses `<Firehose>`/`<Inspector>`/`<RegionMap>` with `replayMode` prop; slider+jump-to-tick (no auto-play); inline redaction with on-demand `<ElevationDialog>`; tier reset on route exit | Architecture Patterns §Replay UI Composition; Architecture Patterns §Auto-Downgrade; Common Pitfalls §P-13-02 (T-10-09) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ReplayGrid orchestration (`grid/src/replay/`) | API / Backend | Database (in-memory SQLite) | Reuses GenesisLauncher service graph; chain is derived state from audit events |
| ReadOnlyAuditChain | API / Backend | — | Append discipline is enforced server-side; never crosses tier boundary |
| Tarball construction + canonical JSON | API / Backend | — | Produced server-side; hash determinism requires controlled environment |
| `replay-verify` CLI | CLI / standalone | API / Backend (shared util) | Standalone Node script; reuses canonical-JSON + hash modules from grid |
| `operator.exported` allowlist event | API / Backend | — | Audit chain is server-only; sole-producer pattern locks file ownership |
| H5 consent dialog (`<ExportConsentDialog>`) | Frontend Server (SSR) | Browser | Renders in `/grid/replay` page; paste suppression and typed-match validation are client-side |
| Replay scrubber + redacted Inspector/Firehose | Browser | Frontend Server | Pure UI state; replay data fetched via SSR or SWR from grid API |
| Tier-reset on route exit | Browser | — | `useEffect` cleanup on unmount of `/grid/replay` page |
| Nav entry (`Replay` link, tier-gated) | Frontend Server | Browser | Tier check happens in shared nav component; SSR-rendered |
| CI gates (`check-replay-readonly.mjs`, allowlist bump) | Build / Static | — | Runs in `pretest` hook; pure file-tree grep |

## Standard Stack

### Core (new dependencies for Phase 13)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | `^12.9.0` `[VERIFIED: npm view better-sqlite3 version, 2026-04-27]` | In-memory + on-disk SQLite for ReplayGrid isolated chain | Synchronous API → no async/await pollution in chain hot path; `:memory:` mode is bit-deterministic; native bindings only built once per Node major. Industry standard for embedded SQLite in Node. `[CITED: github.com/WiseLibs/better-sqlite3]` |
| `tar` (npm `tar`) | `^7.5.13` `[VERIFIED: npm view tar version, 2026-04-27]` | Tarball construction with deterministic options | Maintained by isaacs (npm CLI maintainer); supports `mtime`, `mode`, `noPax`, `portable`, `prefix` options needed for byte-determinism `[CITED: github.com/isaacs/node-tar]` |

### Supporting (already in repo, reused)

| Library | Version | Purpose | Reused From |
|---------|---------|---------|-------------|
| `vitest` | `^2.0.0` | Test runner for new replay/export tests | `grid/package.json:30` `[VERIFIED]` |
| `fastify` | `^5.0.0` | API server hosting `/api/v1/grid/info` | `grid/package.json:21` `[VERIFIED]` |
| `mysql2` | `^3.9.0` | Production chain backing — ReplayGrid uses isolated schema | `grid/package.json:23` `[VERIFIED]` |
| Node built-in `crypto` | Node ≥20 | SHA-256 for tarball hash and manifest chain-tail hash | Already used by `grid/src/audit/chain.ts` `computeHash` `[VERIFIED: chain.ts]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `better-sqlite3` | `sql.js` (pure-WASM) | Pro: no native build. Con: ~10× slower, harder to make bit-deterministic, larger bundle. ReplayGrid runs server-side only — native is correct choice. `[ASSUMED: relative perf]` |
| `better-sqlite3` | Pure in-memory `Map<number, AuditEntry>` (no SQLite at all) | Pro: zero new deps. Con: D-13 CONTEXT explicitly says "isolated in-memory chain (better-sqlite3)" — locked decision. Also loses durability for inspect-then-export workflow if planner later adds optional disk persistence. |
| npm `tar` | Shell out to `tar` with `--sort=name --mtime=… --owner=0 --group=0 --numeric-owner` | Pro: GNU/BSD tar is well-understood. Con: cross-platform fragility (BSD tar on macOS doesn't support all GNU flags); CI determinism varies by tar version. npm `tar` is pure JS, no shell-out. `[CITED: reproducible-builds.org/docs/archives]` |
| npm `tar` | `archiver` package | `archiver` is more focused on streaming for HTTP responses; `tar` package is the lower-level primitive used by npm itself. `[ASSUMED: prior knowledge]` |

**Installation:**

```bash
# Run inside the grid workspace
cd grid && npm install better-sqlite3@^12.9.0 tar@^7.5.13
# Type definitions
cd grid && npm install --save-dev @types/better-sqlite3 @types/tar
```

**Version verification:** `npm view better-sqlite3 version` → `12.9.0` and `npm view tar version` → `7.5.13` confirmed against the npm registry on 2026-04-27 `[VERIFIED]`.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                       OPERATOR (H3+ tier)                              │
│                              │                                          │
│                              ▼                                          │
│   ┌──────────────────────────────────────────────────────────┐         │
│   │  /grid/replay  (Next.js page, SSR)                        │         │
│   │   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐    │         │
│   │   │ Scrubber     │→ │ <Firehose>   │  │ <Inspector> │    │         │
│   │   │ (slider +    │  │ replayMode   │  │ replayMode  │    │         │
│   │   │  tick input) │  │ + redaction  │  │ + redaction │    │         │
│   │   └──────┬───────┘  └──────────────┘  └──────┬──────┘    │         │
│   │          │                                    │          │         │
│   │          │  Inline "— Requires H4" / "Elevate"           │         │
│   │          │     │                              │          │         │
│   │          │     ▼                              ▼          │         │
│   │          │  <ElevationDialog>  (no scrubber pause)       │         │
│   │          │                                               │         │
│   │          ├──────► <ExportConsentDialog>  (H5-gated)      │         │
│   │          │            (Grid-ID typed match,              │         │
│   │          │             paste-suppressed)                 │         │
│   │          │                  │                            │         │
│   │          │                  ▼                            │         │
│   │   on unmount: agencyStore.setTier('H1') ←─── tier-reset  │         │
│   └──────────┼──────────────────┼────────────────────────────┘         │
│              │ (read replay     │ (POST export request,                │
│              │  state at tick)  │  with consent token)                 │
│              ▼                  ▼                                      │
│   ┌──────────────────────────────────────────────────────────┐         │
│   │   GRID API (Fastify, port :8080 production / isolated    │         │
│   │              port for ReplayGrid)                         │         │
│   │                                                            │         │
│   │  GET /api/v1/grid/info              → {gridName, …}       │         │
│   │  POST /api/v1/replay/sessions       → ReplayGrid spin-up  │         │
│   │  GET  /api/v1/replay/{id}/at?tick=N → state snapshot      │         │
│   │  POST /api/v1/replay/{id}/export    → tarball + audit     │         │
│   └──────────┼──────────────────┼────────────────────────────┘         │
│              │                  │                                      │
│              ▼                  ▼                                      │
│   ┌──────────────────────┐  ┌──────────────────────────────┐           │
│   │  ReplayGrid          │  │  appendOperatorExported()    │           │
│   │  (extends            │  │  ↓ closed 6-tuple payload    │           │
│   │   GenesisLauncher)   │  │  ↓ payloadPrivacyCheck       │           │
│   │                      │  │  ↓ chain.append(...)         │           │
│   │  ┌────────────────┐  │  │                              │           │
│   │  │ ReadOnlyAudit  │  │  │  AuditChain (production,     │           │
│   │  │ Chain          │  │  │  PersistentAuditChain w/     │           │
│   │  │ (loadEntries   │  │  │  MySQL backing)              │           │
│   │  │  from JSONL,   │  │  └──────────────────────────────┘           │
│   │  │  append THROWS)│  │                                             │
│   │  └────────┬───────┘  │  ┌──────────────────────────────┐           │
│   │           │          │  │  Tarball Builder (npm tar)   │           │
│   │           ▼          │  │  • canonical JSON (sorted    │           │
│   │  RelationshipListener│  │    keys, no whitespace)      │           │
│   │  DialogueAggregator  │  │  • fixed mtime/mode/uid      │           │
│   │  GovernanceEngine    │  │  • sorted entry order        │           │
│   │  (existing listeners,│  │  • SHA-256 over bytes →      │           │
│   │   replayed via       │  │    tarball_hash              │           │
│   │   manual loop)       │  └──────────────────────────────┘           │
│   │                      │           │                                 │
│   │  Backing: in-memory  │           ▼                                 │
│   │  better-sqlite3      │  ┌──────────────────────────────┐           │
│   │  ':memory:'          │  │  replay-verify CLI           │           │
│   │  + isolated MySQL    │  │  (standalone Node script)    │           │
│   │  schema name         │  │  $ replay-verify <tarball>   │           │
│   │  (per-session)       │  │   → exit 0 if hash matches   │           │
│   └──────────────────────┘  │   → exit 1 if mismatch       │           │
│                              └──────────────────────────────┘           │
└────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
grid/src/replay/                   # NEW — all ReplayGrid code lives here
├── replay-grid.ts                 # extends/wraps GenesisLauncher
├── readonly-audit-chain.ts        # extends AuditChain; append() THROWS
├── replay-session.ts              # session lifecycle (start, scrub, expire)
└── index.ts                       # public exports

grid/src/audit/
└── append-operator-exported.ts    # NEW — sole producer for operator.exported

grid/src/export/                   # NEW — tarball construction + verify
├── canonical-json.ts              # deterministic JSON (sorted keys, no whitespace)
├── tarball-builder.ts             # npm tar wrapper with deterministic options
└── manifest.ts                    # tarball manifest schema

scripts/
├── replay-verify.mjs              # NEW — CLI; recomputes tarball hash
└── check-replay-readonly.mjs      # NEW — grep gate: zero `.append(` in grid/src/replay/**

dashboard/src/app/grid/replay/     # NEW — sibling of grid/governance/
├── page.tsx                       # /grid/replay route entry
├── replay-dashboard.tsx           # main scrubber + viewer composition
├── scrubber.tsx                   # slider + jump-to-tick input
└── use-replay-session.ts          # SWR hook for replay state

dashboard/src/components/agency/
└── export-consent-dialog.tsx      # NEW — clone of irreversibility-dialog.tsx

grid/test/replay/                  # NEW — Vitest tests
grid/test/export/                  # NEW — tarball determinism tests
dashboard/tests/e2e/replay.spec.ts # NEW — Playwright E2E
```

### Pattern 1: ReadOnlyAuditChain (extends AuditChain)

**What:** ReplayGrid's chain must throw on `append()` to enforce the "ReplayGrid never writes
back to the live Grid" invariant `[VERIFIED: D-13 CONTEXT §domain]`. The pattern is a direct
clone of `PersistentAuditChain`'s override approach.

**When to use:** Constructor injection point inside `ReplayGrid`, replacing `new AuditChain()`.

**Example (clone of `grid/src/db/persistent-chain.ts`):**

```typescript
// Source: grid/src/db/persistent-chain.ts (override pattern, verbatim discipline)
import { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';

export class ReadOnlyAuditChain extends AuditChain {
    override append(
        _eventType: string,
        _actorDid: string,
        _payload: unknown,
        _targetDid?: string,
    ): AuditEntry {
        throw new Error(
            'ReadOnlyAuditChain: append() forbidden — ReplayGrid is read-only by contract',
        );
    }

    /** Restore from a JSONL slice; uses base loadEntries which is silent (no listener fan-out). */
    public restoreFromJsonl(jsonl: string): void {
        const entries: AuditEntry[] = jsonl
            .split('\n')
            .filter((line) => line.length > 0)
            .map((line) => JSON.parse(line) as AuditEntry);
        this.loadEntries(entries);
    }
}
```

### Pattern 2: ReplayGrid State Reconstruction

**What:** After `ReadOnlyAuditChain.restoreFromJsonl()`, derived listeners
(`RelationshipListener`, `DialogueAggregator`, `GovernanceEngine`) have not yet seen any
events because `loadEntries()` is silent `[VERIFIED: chain.ts loadEntries() comment + relationships/listener.ts:138]`. The launcher must explicitly call each listener's
`rebuildFromChain()`-equivalent to derive state.

**When to use:** Final step of `ReplayGrid.bootstrap()`, after all listeners are wired but
before serving any tick query.

**Example (clone of `grid/src/genesis/launcher.ts:286-290`):**

```typescript
// Source: grid/src/genesis/launcher.ts:286 — "P-9-02: AuditChain.loadEntries() does NOT
// fire onAppend. Manual replay is required to reconstruct the derived view."
async bootstrap(): Promise<void> {
    // 1. Load chain slice from JSONL
    this.audit.restoreFromJsonl(this.config.jsonlSlice);

    // 2. Wire listeners (constructor injection already attached audit.onAppend)
    // ... aggregator, relationships, governance constructors run ...

    // 3. Manually replay each entry through each listener (the silent-restore caveat)
    this.relationships.rebuildFromChain();
    // ... add similar calls for any other listener that depends on chain history
}
```

**Note for planner:** `RelationshipListener.rebuildFromChain()` already exists. Other
listeners (`DialogueAggregator`, `GovernanceEngine`) may need a similar method added — verify
during Wave 1 planning by reading each listener's source. `[ASSUMED: only RelationshipListener
has the method today; others may need parallel additions]`

### Pattern 3: Sole-Producer Audit Event (clone of `appendNousDeleted`)

**What:** The `operator.exported` event has exactly one producer: the file
`grid/src/audit/append-operator-exported.ts`. Enforced by a producer-boundary grep gate.
Eight discipline points from `appendNousDeleted` apply identically.

**When to use:** When wiring the export endpoint to write the audit event.

**Example skeleton (mirror of `grid/src/audit/append-nous-deleted.ts`):**

```typescript
// Source: grid/src/audit/append-nous-deleted.ts (template)
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

export const HEX64_RE = /^[0-9a-f]{64}$/;
export const OPERATOR_ID_RE =
    /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface OperatorExportedPayload {
    readonly tier: 'H5';
    readonly operator_id: string;          // OPERATOR_ID_RE
    readonly start_tick: number;            // non-negative integer
    readonly end_tick: number;              // ≥ start_tick
    readonly tarball_hash: string;          // HEX64_RE (SHA-256 of tarball bytes)
    readonly requested_at: number;          // Unix seconds, < 10_000_000_000
}

const EXPECTED_KEYS = [
    'end_tick', 'operator_id', 'requested_at', 'start_tick', 'tarball_hash', 'tier',
] as const;

export function appendOperatorExported(
    audit: AuditChain,
    operatorId: string,
    payload: OperatorExportedPayload,
): AuditEntry {
    // 1. operator-id format guard (OPERATOR_ID_RE)
    // 2. payload type guard (plain object)
    // 3. literal guards: tier === 'H5'
    // 4. self-report invariant: payload.operator_id === operatorId
    // 5. numeric bounds: start_tick >= 0, end_tick >= start_tick,
    //    requested_at >= 0 && < 10_000_000_000  (Phase 5 TradeRecord pattern)
    // 6. regex guard: tarball_hash matches HEX64_RE
    // 7. closed-tuple key check (Object.keys().sort() strict equality)
    // 8. payloadPrivacyCheck before chain.append (belt-and-suspenders)
    // 9. audit.append('operator.exported', operatorId, cleanPayload)
    // FULL guards: see grid/src/audit/append-nous-deleted.ts lines 60-133
}
```

### Pattern 4: Allowlist Bump (26 → 27)

**What:** Add `'operator.exported'` to `ALLOWLIST_MEMBERS` in
`grid/src/audit/broadcast-allowlist.ts`, and bump the literal `26` → `27` in
`scripts/check-state-doc-sync.mjs` and the corresponding text in `.planning/STATE.md`.
**All three changes co-commit.** `[VERIFIED: STATE.md Accumulated Context + check-state-doc-sync.mjs]`

**Privacy matrix verification:** The closed 6-tuple keys (`tier`, `operator_id`, `start_tick`,
`end_tick`, `tarball_hash`, `requested_at`) are all primitives or DID-format strings. None
of them match `FORBIDDEN_KEY_PATTERN` (`body|entries|text|chain_data|whisper|telos`).
`[VERIFIED: broadcast-allowlist.ts forbidden-key sets]` — payload privacy passes natively.

### Pattern 5: Replay UI Composition (`replayMode` prop)

**What:** Each existing component (`<Firehose>`, `<Inspector>`, `<RegionMap>`) accepts a
`replayMode?: boolean` prop that:
1. Suppresses any write affordance (no Speak, no propose, no vote).
2. Shows the amber `border-2 border-amber-400` replay frame and `REPLAY` badge `[VERIFIED: 13-UI-SPEC.md]`.
3. For `<Inspector>` and `<Firehose>`: renders inline placeholders for redacted fields based
   on tier, with an `Elevate` link that opens `<ElevationDialog>` without pausing the scrubber.

**When to use:** All three components must be edited to accept the prop. The replay page
passes `replayMode={true}`; the live grid page passes `replayMode={false}` (or omits).

### Pattern 6: Auto-Downgrade on Route Exit

**What:** When the operator navigates away from `/grid/replay`, any H4/H5 elevation must be
reset to H1. Cloned from Phase 6 D-07 / Phase 8 dialog close.

**When to use:** `useEffect` cleanup function in the `/grid/replay` page component.

**Example:**

```typescript
// Pattern source: dashboard/src/components/agency/irreversibility-dialog.tsx:81-90
//                 (close-event listener restores tier on dialog close)
useEffect(() => {
    return () => {
        // On unmount (route change away from /grid/replay): downgrade.
        agencyStore.setTier('H1');
    };
}, []);
```

### Pattern 7: Deterministic Tarball Construction

**What:** Bit-for-bit reproducibility requires controlling every variable in the tar format.
`[CITED: reproducible-builds.org/docs/archives]`

**When to use:** Every export operation. The output hash MUST be reproducible by
`replay-verify` against the same inputs.

**Required disciplines:**
1. **Sorted entry order:** `entries.sort((a, b) => a.path.localeCompare(b.path))`.
2. **Fixed mtime:** Use a fixed epoch (e.g., `0`) or the chain's deterministic anchor tick.
3. **Fixed mode:** `0o644` for files, `0o755` for the (single, fixed) directory if any.
4. **Fixed uid/gid:** `0` / `0` (`portable: true` in npm `tar`).
5. **Canonical JSON:** All `.json` and `.jsonl` content uses `JSON.stringify` over a sorted-
   key recursive walk; JSONL lines use `\n` line endings; no trailing newline at end of file.
6. **No PAX headers:** Set `noPax: true`; PAX adds platform-specific extended attributes.
7. **No compression at the format level** (or fixed-seed gzip); raw `.tar` is simplest.

`[ASSUMED: npm tar option names — verify in Wave 0 by reading node-tar README]`

### Anti-Patterns to Avoid

- **Calling `audit.append()` anywhere inside `grid/src/replay/**`** — violates D-13 §domain
  and T-10-07 (CRITICAL risk). CI gate `check-replay-readonly.mjs` enforces zero matches.
- **Subscribing to a fresh production `AuditChain` from inside ReplayGrid listeners** — the
  zero-diff invariant says listener count must not affect chain hash, but ReplayGrid's chain
  is a separate instance; cross-wiring would silently double-apply events.
- **Using `Date.now()` or `setInterval` in `dashboard/src/app/grid/replay/**`** — extends
  the existing wall-clock grep gate; the slider must be operator-driven only (D-13-05).
- **Adding any `replay.*` event type to the production allowlist** — D-13 §deferred bans this.
  ReplayGrid runs an isolated chain; nothing it does ever reaches production.
- **Pasting the Grid-ID into the export consent input** — paste must be suppressed (D-13-08,
  cloned from Phase 8 D-05).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tar archive creation | Custom tar header writer | `tar` (npm) with deterministic options | Tar format has POSIX/ustar/PAX modes, padding rules, checksum field, end-of-archive blocks. One byte wrong → hash mismatch. `[CITED: github.com/isaacs/node-tar]` |
| Canonical JSON serialization | `JSON.stringify(payload)` direct | Recursive sorted-key walker (small custom util) | `JSON.stringify` does NOT sort keys; key order in JS objects is insertion-order, varies by source. Hand-roll the walker but keep it ≤30 lines and Vitest-test it. (Note: this IS a hand-roll, but a small one with high test density.) |
| In-memory SQLite | Pure `Map<bigint, AuditEntry>` ad-hoc store | `better-sqlite3` `:memory:` | CONTEXT D-13 specifies better-sqlite3. Also: SQL queries simplify slice-by-tick-range without writing custom indexers. |
| Native `<dialog>` focus trap | Radix portal + custom trap | Browser `HTMLDialogElement.showModal()` | Phase 8 already proved native dialog suffices; cloning IrreversibilityDialog inherits this. `[VERIFIED: irreversibility-dialog.tsx:67]` |
| Tier elevation flow | New dialog/store | Existing `<ElevationDialog>` + `agencyStore` | D-13-06 explicit reuse mandate. |
| SHA-256 chain hashing | `crypto-js` package | Node built-in `crypto.createHash('sha256')` | Already used by `AuditChain.computeHash()`. Native binding, no dep. `[VERIFIED: chain.ts]` |
| Operator-id / DID validation | Per-call regex | Reuse `OPERATOR_ID_RE` and `DID_RE` from `grid/src/audit/append-nous-deleted.ts` | Single source of truth across 4+ producer files. |

**Key insight:** Phase 13 has very low novel-code surface. Most "build" instincts should be
replaced with "find the existing pattern and clone it." The high-leverage hand-rolls are the
canonical-JSON walker and the deterministic-tar option-set — both small, both heavily testable.

## Common Pitfalls

### Pitfall 1: ReplayGrid sharing state with the live grid (T-10-07, CRITICAL)

**What goes wrong:** ReplayGrid construction reuses a service singleton (e.g., production
`audit`, the live `space`, the live `governance` registry), causing replay queries to mutate
production state or vice versa.

**Why it happens:** GenesisLauncher's constructor takes injected services; if the planner
constructs ReplayGrid with the production service references rather than fresh instances,
no warning fires.

**How to avoid:**
- ReplayGrid MUST construct its own `ReadOnlyAuditChain`, its own in-memory `space`, its own
  `governance` registry from the **isolated** MySQL schema name.
- Test invariant: spin up ReplayGrid in a Vitest test that ALSO spins up a live launcher in
  the same process; mutate the live one; assert the replay one sees zero diff.
- CI gate `check-replay-readonly.mjs` greps for `.append(` in `grid/src/replay/**` — zero
  matches required.

**Warning signs:**
- ReplayGrid constructor accepts an `AuditChain` parameter (instead of constructing its own).
- Test setup reuses `launcher.services.audit` for the replay session.

### Pitfall 2: H1 operator sees plaintext during replay (T-10-09, HIGH)

**What goes wrong:** The Inspector's `replayMode` flag is on, but the redaction logic checks
the operator's *replay session tier* instead of the operator's *current global tier*. An H4
operator who elevates to H5 inside replay, then navigates away without unmount completing,
leaves H5 leaking.

**Why it happens:** Replay state and global tier state cross-contaminate; `agencyStore` is a
singleton.

**How to avoid:**
- Tier check inside Inspector/Firehose redaction reads the **same** `agencyStore.currentTier`
  as the live grid (single source of truth — never duplicate tier state).
- Auto-downgrade discipline (Pattern 6) MUST run on every unmount of `/grid/replay`.
- E2E test: navigate to `/grid/replay`, elevate to H5, navigate to `/grid`, assert
  `agencyStore.currentTier === 'H1'`.

**Warning signs:**
- Two separate `tier` state slices exist (one for live, one for replay).
- `useEffect` cleanup is conditional rather than unconditional.

### Pitfall 3: Tarball hash differs across machines (T-10-08 / REPLAY-01)

**What goes wrong:** The same tick-range export produces different hashes on different
machines, defeating `replay-verify`.

**Why it happens:**
- Default `tar` uses current `mtime` and current `uid/gid`.
- `JSON.stringify` insertion-order varies if any payload was constructed with non-sorted keys.
- Newline differences (CRLF on Windows vs LF on Linux).
- PAX extended headers add platform metadata.

**How to avoid:**
- Apply all 7 disciplines from Pattern 7 (sorted entries, fixed mtime/mode/uid/gid, canonical
  JSON, LF only, no PAX).
- Test: produce two tarballs from the same inputs in two separate Vitest runs; assert
  `bufferA.equals(bufferB)`.
- Test: run on Linux, run on macOS in CI (or at minimum on the dev machine), assert hash
  match.

**Warning signs:**
- Test harness uses `Date.now()` or `process.hrtime()` anywhere in the export path.
- Tar invocation does not specify `mtime`, `mode`, `portable`, `noPax`.

### Pitfall 4: `operator.exported` payload carries plaintext (T-10-10, CRITICAL)

**What goes wrong:** A planner well-meaningly adds `entry_count` or `chain_text` or `tags`
to the payload; later, a refactor adds `description`; eventually the payload leaks the
content of the exported chain into the live audit log.

**Why it happens:** Payload schema drift. The closed-tuple discipline is the only defense.

**How to avoid:**
- Sole producer file checks `EXPECTED_KEYS` strict equality (Pattern 3).
- Privacy matrix test: 6 forbidden keys × {flat, nested} = 12 cases assert that
  `appendOperatorExported` throws when each forbidden key is present.
- Code review: every new key requires a CONTEXT amendment.

**Warning signs:**
- A new field appears in `OperatorExportedPayload` without a corresponding CONTEXT decision.
- `EXPECTED_KEYS` array has more than 6 entries.

### Pitfall 5: `loadEntries()` silently doesn't replay through listeners

**What goes wrong:** ReplayGrid bootstraps, calls `chain.loadEntries(entries)`, then queries
"give me the relationship graph at tick 100" — and gets an empty graph. Because
`loadEntries()` is the silent restore path, listeners never saw the events.
`[VERIFIED: relationships/listener.ts:138 explicit comment]`

**Why it happens:** It's a real, intentional behavior in `AuditChain` (used by the production
launcher to avoid duplicate apply on restart), but it's surprising to anyone who hasn't read
the comment.

**How to avoid:**
- After `restoreFromJsonl`, call each listener's explicit rebuild method (Pattern 2).
- Add a Vitest test that constructs ReplayGrid from a non-empty JSONL slice and asserts the
  derived state is non-empty.

**Warning signs:**
- ReplayGrid bootstrap omits any explicit listener-rebuild step.
- Tests pass for empty-chain bootstrap but not for non-empty.

## Code Examples

### `appendOperatorExported` numeric bounds guard

```typescript
// Source: grid/src/audit/append-nous-deleted.ts (regex pattern) +
//         REQUIREMENTS Phase 5 TradeRecord (Unix seconds < 10_000_000_000)
if (!Number.isInteger(payload.start_tick) || payload.start_tick < 0) {
    throw new TypeError('appendOperatorExported: start_tick must be non-negative integer');
}
if (!Number.isInteger(payload.end_tick) || payload.end_tick < payload.start_tick) {
    throw new TypeError('appendOperatorExported: end_tick must be >= start_tick');
}
if (!Number.isInteger(payload.requested_at)
    || payload.requested_at < 0
    || payload.requested_at >= 10_000_000_000) {
    throw new TypeError(
        'appendOperatorExported: requested_at must be Unix seconds (< 10_000_000_000)',
    );
}
```

### Canonical JSON walker (small hand-roll, heavily tested)

```typescript
// Source: deterministic JSON pattern (planner's own implementation)
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalJson).join(',') + ']';
    }
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return '{' + keys.map((k) =>
        JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k]),
    ).join(',') + '}';
}
```

### npm `tar` deterministic options sketch

```typescript
// Source: github.com/isaacs/node-tar README (option names; verify in Wave 0)
import * as tar from 'tar';
import { Writable } from 'node:stream';

const buffers: Buffer[] = [];
const sink = new Writable({
    write(chunk, _enc, cb) { buffers.push(chunk); cb(); },
});

await tar.create({
    file: undefined,                  // stream output
    cwd: stagingDir,
    portable: true,                   // no uid/gid metadata
    noPax: true,                      // no PAX extended headers
    mtime: new Date(0),               // fixed epoch
    mode: 0o644,                      // overridden per-entry
    // npm tar honors a `filter` and `follow: false`; review docs in Wave 0.
}, sortedEntryPaths).pipe(sink);

// `[ASSUMED: exact option names — verify against npm tar 7.5.13 docs in Wave 0]`
```

### CI gate skeleton (`scripts/check-replay-readonly.mjs`)

```javascript
// Source: clones scripts/check-relationship-graph-deps.mjs pattern
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'grid/src/replay';
const FORBIDDEN = /\.append\s*\(/;

function walk(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p, files);
        else if (p.endsWith('.ts')) files.push(p);
    }
    return files;
}

let violations = 0;
for (const file of walk(ROOT)) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, idx) => {
        // Skip comments and lines mentioning ReadOnlyAuditChain.append (the throw site)
        if (FORBIDDEN.test(line) && !line.trim().startsWith('//')) {
            console.error(`${file}:${idx + 1}: forbidden .append( in ReplayGrid`);
            violations++;
        }
    });
}
process.exit(violations > 0 ? 1 : 0);
```

## Runtime State Inventory

> Phase 13 is partially a refactor of the existing `<Firehose>`, `<Inspector>`, `<RegionMap>`
> components (adding `replayMode` prop). Inventory included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — ReplayGrid is fully ephemeral; no persistent rename needed. Existing chain entries are read, never rewritten. | None. |
| Live service config | None — no n8n / Datadog / Tailscale style external config touches the rename. | None. |
| OS-registered state | None — no Task Scheduler / launchd / systemd state references replay. | None. |
| Secrets/env vars | None — `DATABASE_URL`, `MYSQL_PASSWORD` etc. unchanged. ReplayGrid uses isolated *schema name*, not a new credential. | Verify in Wave 0 that schema-name parameterization works with the existing pool. |
| Build artifacts | `node_modules/` will gain `better-sqlite3` native binary. CI must rebuild on first run after dependency add. `package-lock.json` regenerates. | `npm install` from the workspace root after Wave 0 dependency add; commit lockfile. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥20 | Grid + dashboard | ✓ | engines pin in `package.json` `[VERIFIED]` | — |
| `better-sqlite3` | ReplayGrid in-memory chain | ✗ — must install | — | None — locked decision in CONTEXT D-13. |
| `tar` (npm) | Tarball builder | ✗ — must install | — | None — see Don't Hand-Roll. |
| `vitest` | Tests | ✓ | `^2.0.0` `[VERIFIED: grid/package.json]` | — |
| MySQL pool (existing) | ReplayGrid isolated schema | ✓ (production); unknown for local-dev | — | Document required local-dev MySQL setup if not already in README. |
| Playwright (E2E) | `dashboard/tests/e2e/replay.spec.ts` | ✓ (existing E2E suite uses it) `[VERIFIED: tests/e2e/agency.spec.ts present]` | — | — |
| Native build toolchain (for `better-sqlite3`) | First `npm install` | Likely ✓ on macOS dev machine; required in CI | — | Use `prebuild` if not. `[ASSUMED: better-sqlite3 ships prebuilds for Node 20+]` |

**Missing dependencies with no fallback:**
- `better-sqlite3` — install required.
- `tar` — install required.
- `@types/better-sqlite3`, `@types/tar` — TypeScript type definitions required.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest@^2.0.0` `[VERIFIED]` |
| Config file | `grid/vitest.config.ts` (existing); dashboard uses Playwright + `vitest` for unit |
| Quick run command | `cd grid && npx vitest run test/replay test/export --no-coverage` |
| Full suite command | `npm test` (turbo orchestrated; runs `pretest` CI gates first) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPLAY-01 | Tarball is bit-deterministic | unit | `npx vitest run grid/test/export/tarball-determinism.test.ts -x` | ❌ Wave 0 |
| REPLAY-01 | `replay-verify` CLI returns 0 on match, 1 on mismatch | integration | `node scripts/replay-verify.mjs <fixture>.tar` | ❌ Wave 0 |
| REPLAY-02 | `appendOperatorExported` rejects bad payloads (8+ guard cases) | unit | `npx vitest run grid/test/audit/append-operator-exported.test.ts -x` | ❌ Wave 0 |
| REPLAY-02 | Allowlist contains exactly 27 events including `operator.exported` | unit | `npx vitest run grid/test/audit/broadcast-allowlist.test.ts -x` | ✅ (extend existing) |
| REPLAY-02 | Privacy matrix: 6 forbidden keys × 2 (flat/nested) = 12 rejection cases | unit | same file as above | ❌ Wave 0 |
| REPLAY-02 | `check-state-doc-sync.mjs` recognizes 27 events | smoke | `npm run check:state-doc-sync` | ✅ (extend) |
| REPLAY-03 | Zero `.append(` in `grid/src/replay/**` | smoke | `npm run check:replay-readonly` | ❌ Wave 0 |
| REPLAY-03 | ReadOnlyAuditChain throws on append | unit | `npx vitest run grid/test/replay/readonly-chain.test.ts -x` | ❌ Wave 0 |
| REPLAY-03 | ReplayGrid + live launcher in same process: zero cross-mutation | integration | `npx vitest run grid/test/replay/isolation.test.ts -x` | ❌ Wave 0 |
| REPLAY-04 | After `restoreFromJsonl`, `relationships.rebuildFromChain()` produces non-empty graph | unit | `npx vitest run grid/test/replay/state-reconstruction.test.ts -x` | ❌ Wave 0 |
| REPLAY-05 | `/grid/replay` route renders for H3+ only | E2E | `npx playwright test dashboard/tests/e2e/replay.spec.ts` | ❌ Wave 0 |
| REPLAY-05 | Scrubber slider + jump-to-tick input both update viewer | E2E | same file | ❌ Wave 0 |
| REPLAY-05 | Inline elevation in Inspector reveals Telos field after H4 | E2E | same file | ❌ Wave 0 |
| REPLAY-05 | Tier resets to H1 on route exit (navigate to `/grid` after H5 elevation) | E2E | same file | ❌ Wave 0 |
| REPLAY-05 | Export consent dialog: Grid-ID typed match enables button; paste blocked | E2E | same file | ❌ Wave 0 |
| REPLAY-05 | No `Date.now`/`setInterval` in `dashboard/src/app/grid/replay/**` | smoke | `npm run check:wallclock` (extend) | ✅ (extend) |

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run test/replay test/export test/audit/append-operator-exported.test.ts --no-coverage`
- **Per wave merge:** `npm test` (full turbo run including CI gates)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/test/export/tarball-determinism.test.ts` — covers REPLAY-01
- [ ] `grid/test/export/canonical-json.test.ts` — covers REPLAY-01 (sub-component)
- [ ] `grid/test/audit/append-operator-exported.test.ts` — covers REPLAY-02
- [ ] `grid/test/replay/readonly-chain.test.ts` — covers REPLAY-03
- [ ] `grid/test/replay/isolation.test.ts` — covers REPLAY-03
- [ ] `grid/test/replay/state-reconstruction.test.ts` — covers REPLAY-04
- [ ] `dashboard/tests/e2e/replay.spec.ts` — covers REPLAY-05
- [ ] `scripts/check-replay-readonly.mjs` — new CI gate (REPLAY-03)
- [ ] Extend `scripts/check-wallclock-forbidden.mjs` to include `dashboard/src/app/grid/replay/**`
- [ ] Extend `scripts/check-state-doc-sync.mjs` literal `26` → `27`, add `'operator.exported'` to required array
- [ ] Extend `dashboard/tests/e2e/agency.spec.ts` `DASHBOARD_ROUTES` constant: add `/grid/replay`
- [ ] Framework install: `cd grid && npm install better-sqlite3@^12.9.0 tar@^7.5.13 && npm install --save-dev @types/better-sqlite3 @types/tar`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Tier check via existing `agencyStore`; H3+ for view, H5 for export. No new auth. |
| V3 Session Management | yes | Replay session lifecycle: spin-up returns session ID; expire on timeout / route exit. Reuses cookie-based session from existing dashboard. |
| V4 Access Control | yes | H1/H2 cannot reach `/grid/replay` (nav hidden + page-level guard). H3 can view (with redaction). H4 can see Telos. H5 can see whispers and export. |
| V5 Input Validation | yes | `appendOperatorExported` literal/regex/closed-tuple guards (Pattern 3). Tarball file path passed to `replay-verify` validated for null bytes / traversal. |
| V6 Cryptography | yes | SHA-256 via Node `crypto` (already used by `AuditChain.computeHash`). Tarball hash uses same primitive. **Never hand-roll the digest.** |

### Known Threat Patterns for Phase 13

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tarball includes plaintext leaking out of tier discipline | Information Disclosure | H5 consent gate + `payloadPrivacyCheck` on the audit event; tarball CONTENT is the audit slice itself, which is already redacted at ingestion (whispers/Telos hashes only, plaintext ledger lives in `whisper-store`/`telos-store`). |
| Replay session impersonation (operator A starts session, operator B uses session ID) | Spoofing | Session ID bound to operator-id in cookie; verify at every replay endpoint. |
| `replay-verify` on a maliciously crafted tar (tar-bomb / path traversal) | Tampering / DoS | Use npm `tar` with `strict: true` and pre-flight size cap; refuse `..` entries. |
| Plaintext leak via Inspector when H1 operator briefly sees pre-redaction render flash | Information Disclosure | Server-side render the redaction (don't fetch raw → redact-on-client); inspect existing Inspector render path during planning. |
| Forged `operator.exported` event from non-sole-producer site | Tampering | Producer-boundary grep gate: any other `audit.append('operator.exported', …)` site fails CI. |
| Cross-replay-session state pollution | Tampering | Each ReplayGrid spawns its own `ReadOnlyAuditChain` and isolated MySQL schema — no shared singletons. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Replay = re-run Brain prompts | State-level replay (recompute derived state from immutable audit slice) | ROADMAP v2.2 design | LLM non-determinism makes prompt-replay impossible; state-replay is the only honest contract. |
| Audit allowlist size frozen | Per-phase additions with explicit doc-sync bump | Phase 6+ | Allowlist literal in CI gate prevents drift; every new event is an explicit policy decision. |
| Hand-rolled focus-trap dialogs | Native `<dialog>` `showModal()` | Phase 6/8 | No Radix dep, simpler, tested in production for two phases. |
| Replay-verify as part of grid binary | Standalone `scripts/replay-verify.mjs` CLI | Phase 13 (this) | Verifier runs without booting grid; recipient of an exported tarball can verify on any machine with Node + tar. |

**Deprecated/outdated:**
- Decision-level replay — explicitly forbidden anti-feature; LLM non-determinism guarantees
  prompt-replay cannot reproduce.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Only `RelationshipListener` has a `rebuildFromChain()` method today; other listeners (`DialogueAggregator`, `GovernanceEngine`, `AnankeLoader`) may need a parallel addition for replay state reconstruction | Pattern 2 | Wave 1 task estimate undercount if multiple listeners need new code. Verify in Wave 0 by reading each listener's source. |
| A2 | `better-sqlite3@12.9.0` ships prebuilt binaries for Node 20+ on macOS arm64, x86_64, and Linux x64; no native build toolchain required on dev machines | Environment Availability | First `npm install` fails on contributor machines without C++ toolchain. Documented mitigation: `npm install --build-from-source` fallback. |
| A3 | npm `tar@7.5.13` exact option names (`portable`, `noPax`, `mtime`, `mode`) match the deterministic-tar requirements | Pattern 7, Code Examples | Wave 0 must read node-tar README to confirm. If options differ, planner adjusts the wrapper. |
| A4 | `<Firehose>`, `<Inspector>`, `<RegionMap>` source files exist as named React components and accept additional props non-disruptively | Pattern 5 | If they're large monolithic page components rather than isolated components, refactor cost increases. Verify in Wave 0 by reading `dashboard/src/app/grid/page.tsx` and component tree. |
| A5 | The dashboard's nav component (where `Grid` and `Governance` links live) is a single shared file editable in one place to add `Replay` | D-13-02 implementation | Wave 4 task estimate undercount if nav is replicated across pages. |
| A6 | `GET /api/v1/grid/info` does not yet exist; `GET /api/v1/grid/status` returns `{name, …}` and may already cover the Grid-ID need | D-13-08, integration | Confirmed: `server.ts:163` returns `name: services.gridName` from `/api/v1/grid/status`. Planner may reuse this rather than introduce a new endpoint. |
| A7 | The `ALLOWLIST_MEMBERS` array in `broadcast-allowlist.ts` is currently exactly 26 entries | Pattern 4 | STATE.md Accumulated Context confirms 26 — but `check-state-doc-sync.mjs` re-asserts this at every test run, so any drift would already be a test failure. |
| A8 | ReplayGrid's "isolated MySQL schema" can be implemented by the existing `attachRelationshipStorage(pool)` injection point with a different schema name parameter, without rebuilding the pool layer | Pattern 1, Wave 1 | If schemas can't be cheaply isolated per-session, planner falls back to skipping MySQL backing entirely for ReplayGrid (in-memory better-sqlite3 only). |

## Open Questions

1. **Does `better-sqlite3` require a native build on CI, and is the CI image equipped?**
   - What we know: better-sqlite3 ships prebuilds for Node 20+ on common arches.
   - What's unclear: whether the project's CI image (likely GitHub Actions Linux runner) needs
     additional setup for the prebuild to install.
   - Recommendation: Wave 0 task includes a CI dry-run of `npm install` on a fresh checkout
     of the dependency-add commit. If it fails, add `node-gyp` toolchain to the CI image.

2. **What's the policy on tarball size limits?**
   - What we know: a year-long chain could be many MB; `replay-verify` must handle it.
   - What's unclear: max chain slice size, max tarball size, whether to stream or buffer.
   - Recommendation: Wave 2 design includes a hard size cap (e.g., 100MB) checked at the
     export endpoint; reject larger ranges with HTTP 413.

3. **Do we need a `replay-verify` for end-users or only operators?**
   - What we know: the CLI is for chain integrity verification.
   - What's unclear: whether it's distributed as a published npm package or stays in-repo.
   - Recommendation: Phase 13 keeps it in-repo at `scripts/replay-verify.mjs`. Future phase
     may publish it as `@noesis/replay-verify` if external verification is needed.

4. **Should the `/grid/replay` page be SSR or client-only?**
   - What we know: Existing `/grid/governance/page.tsx` uses SSR for layout, SWR for data.
   - What's unclear: whether replay state benefits from SSR (probably not — it's per-session).
   - Recommendation: Wave 4 planner reads governance page as the template; defaults to the
     same shape unless a specific reason to deviate emerges.

## Project Constraints (from CLAUDE.md)

- **Documentation Sync Rule:** When the phase ships, update README, PHILOSOPHY (only if a new
  invariant emerges — likely yes for `replay.* hard-ban` and `replayGrid is read-only`),
  ROADMAP (mark Phase 13 complete), MILESTONES (append), STATE (allowlist 27, accumulated
  context), and PROJECT (move REPLAY-01..05 to Validated).
- **Phase numbering:** Continues at 13 (no reset).
- **Allowlist:** Frozen except via explicit phase additions — Phase 13 adds exactly one event
  (`operator.exported`).
- **Every new `operator.*` event requires explicit allowlist addition** in the phase that
  introduces it — REPLAY-02 satisfies this.
- **Do NOT skip git pre-commit hooks** (default GSD discipline; nothing in Phase 13 needs to
  bypass).

## Sources

### Primary (HIGH confidence)

- `grid/src/audit/chain.ts` `[VERIFIED]` — `loadEntries()` silent restore, `onAppend` fan-out,
  `computeHash` SHA-256, `verify()` integrity check.
- `grid/src/audit/append-nous-deleted.ts` `[VERIFIED]` — sole-producer template (8 discipline
  points), DID/OPERATOR_ID/HEX64 regexes.
- `grid/src/audit/broadcast-allowlist.ts` `[VERIFIED]` — `ALLOWLIST_MEMBERS` array (26
  entries), `payloadPrivacyCheck`, `FORBIDDEN_KEY_PATTERN`.
- `grid/src/db/persistent-chain.ts` `[VERIFIED]` — `override append()` extension pattern.
- `grid/src/genesis/launcher.ts` `[VERIFIED]` — service-construction order; bootstrap calls
  `relationships.rebuildFromChain()` after audit restore.
- `grid/src/relationships/listener.ts` `[VERIFIED]` — `rebuildFromChain()` reference
  implementation; explicit comment about silent `loadEntries()`.
- `dashboard/src/components/agency/irreversibility-dialog.tsx` `[VERIFIED]` — paste suppression,
  typed-confirmation, native `<dialog>`, close-event listener (auto-cancel discipline).
- `dashboard/src/components/agency/elevation-dialog.tsx` `[VERIFIED]` — H5 elevation surface
  for inline replay redaction.
- `scripts/check-state-doc-sync.mjs` `[VERIFIED]` — 26-event literal that bumps to 27.
- `.planning/phases/13-operator-replay-export/13-CONTEXT.md` `[VERIFIED]` — locked decisions
  D-13-01..D-13-09.
- `.planning/phases/13-operator-replay-export/13-UI-SPEC.md` `[VERIFIED]` — verbatim copy
  for all UI strings.
- `.planning/REQUIREMENTS.md` `[VERIFIED]` — REPLAY-01..05 verbatim.
- `.planning/ROADMAP.md` `[VERIFIED]` — risks T-10-07..T-10-10, phase boundaries.
- `.planning/STATE.md` `[VERIFIED]` — accumulated context, allowlist composition.

### Secondary (MEDIUM confidence)

- `dashboard/tests/e2e/agency.spec.ts` `[VERIFIED via grep]` — DASHBOARD_ROUTES extension
  pattern (clones Phase 6 SC#1 discipline).
- `grid/src/api/server.ts:163` `[VERIFIED]` — `/api/v1/grid/status` already returns
  `name: services.gridName` (likely satisfies the Grid-ID requirement).
- npm registry — `better-sqlite3@12.9.0`, `tar@7.5.13` `[VERIFIED via npm view, 2026-04-27]`.

### Tertiary (LOW confidence — flag for validation)

- npm `tar` exact option names (`portable`, `noPax`, `mtime`, `mode`) — `[ASSUMED]` from
  general knowledge; verify by reading `node_modules/tar/README.md` after install.
- `better-sqlite3` prebuild availability for project's CI image — `[ASSUMED]`; verify in
  Wave 0 dry-run.
- The exact compositional surface of `<Firehose>`, `<Inspector>`, `<RegionMap>` (whether they
  are component-level or page-level) — `[ASSUMED]` to be component-level. Wave 0 confirms.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against npm registry; reuse from existing
  workspace dependencies.
- Architecture: HIGH — every architectural pattern has a direct in-repo precedent; no novel
  design.
- Pitfalls: HIGH — T-10-07..T-10-10 are documented in ROADMAP; cloning discipline from
  Phases 6, 8, 9 is well-tested.
- Sole-producer / allowlist discipline: HIGH — Phase 6+ has shipped this pattern five times.
- UI patterns: MEDIUM — depends on assumption A4 about component compositional surface;
  Wave 0 confirms.
- Tarball determinism: MEDIUM — pattern is industry-standard, but exact npm `tar` options
  need Wave 0 verification (assumption A3).

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable codebase, slow-moving deps)
