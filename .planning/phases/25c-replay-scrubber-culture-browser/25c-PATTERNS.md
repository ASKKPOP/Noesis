# Phase 25c: Replay Scrubber + Culture Browser — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 11 (3 modified, 8 created)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `grid/src/api/operator/relationships.ts` | route (modify) | request-response | `grid/src/api/operator/export-replay.ts` | exact |
| `grid/src/main.ts` | config/wiring (modify) | batch | `grid/src/main.ts` (existing loreStorage block) | self-reference |
| `dashboard/src/app/grid/replay/replay-client.tsx` | component (modify) | request-response | `dashboard/src/app/grid/replay/scrubber.tsx` | role-match |
| `steward/src/components/StewardShell.tsx` | component (modify) | — | `steward/src/components/StewardShell.tsx` (NavSection/NavItem) | self-reference |
| `steward/src/app/replay/page.tsx` | page / server component | request-response | `steward/src/app/users/page.tsx` | role-match |
| `steward/src/app/replay/replay-modal.tsx` | client component | request-response | `dashboard/src/app/grid/replay/replay-client.tsx` | role-match |
| `steward/src/app/culture/page.tsx` | page / server component | CRUD | `steward/src/app/users/page.tsx` | role-match |
| `steward/src/app/culture/nous-filter-bar.tsx` | client component | event-driven | `steward/src/app/nous/[id]/page.tsx` (filter/input pattern) | partial |
| `steward/src/app/culture/norm-timeline.tsx` | SVG component | transform | `dashboard/src/lib/api/culture.ts` (data types only) | data-match |
| `steward/src/app/culture/lore-graph.tsx` | SVG component | transform | `dashboard/src/lib/api/culture.ts` (data types only) | data-match |
| `steward/src/app/culture/skill-lineage.tsx` | SVG component | transform | `dashboard/src/lib/api/culture.ts` (data types only) | data-match |

---

## Pattern Assignments

### `grid/src/api/operator/relationships.ts` (route, modify)

**Task:** D-01 — replace both `validateTierBody` call sites with header-auth.
**Analog:** `grid/src/api/operator/export-replay.ts`

**Header-auth pattern** (export-replay.ts lines 69–90):
```typescript
// 1. Tier gate — read from server-trusted x-operator-tier header.
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
if (tierNum < 2) {  // adjust threshold per route: H2 gate = 2, H5 gate = 5
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}

// 1b. Operator-id gate — read from server-trusted x-operator-id header.
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
```

**What to replace:** In `relationships.ts`, find both `validateTierBody` call sites:
- Route 2 (H2 POST `/api/v1/nous/:did/relationships/inspect`): replace `validateTierBody(body, 'H2')` block with the header-auth pattern above using `tierNum < 2`.
- Route 3 (H5 GET `/api/v1/operator/relationships/:edge_key/events`): this route reads tier from query params currently (`req.query.tier`). Migrate to headers using the same pattern with `tierNum < 5`.

**Imports to add** (relationships.ts already imports `OPERATOR_ID_REGEX` from `../types.js` via `ApiError` — confirm it imports `OPERATOR_ID_REGEX` directly):
```typescript
import { OPERATOR_ID_REGEX } from '../types.js';
```

**Remove after migration:**
```typescript
import { validateTierBody } from './_validation.js';  // DELETE this import once both call sites are migrated
```

---

### `grid/src/main.ts` (config/wiring, modify)

**Task:** D-02 (humanSanctionStore) + D-03 (SpawnNousDeps).
**Analog:** Existing `loreStorage` wiring block in `grid/src/main.ts` (lines 126–127 + buildServer spread lines 143).

**Existing loreStorage wiring pattern** (main.ts lines 126–127, 142–143):
```typescript
// Pattern: conditional construction + optional spread into buildServer
const loreStorage = dbConn ? new LoreStorage(dbConn.getPool()) : undefined;

const server = buildServer({
    // ...other props...
    ...(loreStorage ? { lore: { storage: loreStorage } } : {}),
});
```

**D-02 humanSanctionStore wiring** — copy this pattern exactly, inserting after the loreStorage line:
```typescript
// D-02: humanSanctionStore — DB pool wrapper for ban-human + freeze-wallet routes.
// Must be conditioned on dbConn (Pitfall 6 — test envs run without MySQL).
const humanSanctionStore = dbConn ? {
    async existsByDid(did: string): Promise<boolean> {
        const pool = dbConn.getPool();
        const [rows] = await pool.query<Array<{ did: string }>>(
            'SELECT did FROM human_users WHERE did = ? LIMIT 1',
            [did],
        );
        return rows.length > 0;
    },
    async setBanned(did: string): Promise<void> {
        const pool = dbConn.getPool();
        await pool.query('UPDATE human_users SET banned = 1 WHERE did = ?', [did]);
    },
    async setFrozen(did: string): Promise<void> {
        const pool = dbConn.getPool();
        await pool.query('UPDATE human_users SET frozen = 1 WHERE did = ?', [did]);
    },
    async getFlags(did: string): Promise<{ frozen: number; banned: number } | null> {
        const pool = dbConn.getPool();
        const [rows] = await pool.query<Array<{ frozen: number; banned: number }>>(
            'SELECT frozen, banned FROM human_users WHERE did = ? LIMIT 1',
            [did],
        );
        return rows[0] ?? null;
    },
} : undefined;
```

Then spread into `buildServer` after the loreStorage spread:
```typescript
...(humanSanctionStore ? { humanSanctionStore } : {}),
```

**D-03 SpawnNousDeps wiring** — insert after `launcher.bootstrap()`:
```typescript
// D-03: SpawnNousDeps — wraps launcher.spawnNous for spawn-system-nous route.
// Interface from grid/src/api/operator/spawn-system-nous.ts line 68.
const spawnNousDeps = {
    spawnNous: (name: string, did: string, publicKey: string, region: string) =>
        launcher.spawnNous(name, did, publicKey, region),
};
```

Then pass to `buildServer` (check `registerSpawnSystemNousRoute` signature for exact prop name — research indicates the route reads from `(services as unknown as { _spawnNousDeps?: SpawnNousDeps })._spawnNousDeps`, so pass via the services object or directly to the registrar if the function signature accepts it).

---

### `dashboard/src/app/grid/replay/replay-client.tsx` (component, modify — D-07)

**Task:** Make Phase 13 RED test stubs GREEN.
**Analog:** `dashboard/src/app/grid/replay/scrubber.tsx` (for the slider control) + `dashboard/src/app/grid/replay/replay-client.tsx` (the file itself, already partially implemented).

The file already exists and is substantially implemented (lines 1–217). The RED stubs are in `replay-client.test.tsx`. Read the test file before modifying the component to understand exactly which assertions are failing.

**Test file location:** `dashboard/src/app/grid/replay/replay-client.test.tsx`

**Pre-step (Pitfall 1):** Before running tests, verify `@vitejs/plugin-react` is in dashboard's local node_modules:
```bash
ls dashboard/node_modules/@vitejs/plugin-react 2>/dev/null || echo "MISSING — install locally"
# If missing:
cd dashboard && npm install --save-dev @vitejs/plugin-react
```

**Tier gate constants already in file** (replay-client.tsx lines 50–58):
```typescript
const TIER_GATE_COPY = 'Replay requires H3 or higher';
const REPLAY_BADGE_COPY = 'REPLAY';

type Tier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
const TIER_ORDER: Tier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}
```

**Scrubber props contract** (scrubber.tsx lines 15–19):
```typescript
export interface ScrubberProps {
    value: number;
    startTick: number;
    endTick: number;
    onChange: (tick: number) => void;
}
```

**Scrubber input pattern** (scrubber.tsx lines 39–63):
```typescript
<input
    type="range"
    min={startTick}
    max={endTick}
    value={value}
    onChange={handleRangeChange}
    className="flex-1 accent-amber-400"
    data-testid="scrubber-range"
    aria-label="Replay tick slider"
/>
```

---

### `steward/src/components/StewardShell.tsx` (component, modify)

**Task:** Add "Observatory" nav section with `/replay` and `/culture` links.
**Analog:** The file itself — copy the existing `NavSection` + `NavItem` pattern.

**NavSection component** (StewardShell.tsx lines 23–38):
```typescript
function NavSection({ title }: { title: string }) {
    return (
        <div
            style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#5a554e',
                padding: '16px 16px 6px',
            }}
        >
            {title}
        </div>
    );
}
```

**NavItem component** (StewardShell.tsx lines 40–50):
```typescript
function NavItem({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
    const pathname = usePathname();
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/') || (href !== '/' && pathname.startsWith(href));
    const dotColor = active ? '#b8542f' : '#3a3630';
    return (
        <Link href={href} className={`steward-nav-link${active ? ' active' : ''}`}>
            <Dot color={dotColor} />
            {label}
        </Link>
    );
}
```

**Insertion point** (StewardShell.tsx lines 100–103 — between Audit Log and Grid section):
```typescript
<NavItem href="/audit" label="Audit Log" />

{/* Observatory section — NEW, insert here */}
<NavSection title="Observatory" />
<NavItem href="/replay" label="Replay" />
<NavItem href="/culture" label="Culture" />

{/* Grid section */}
<NavSection title="Grid" />
<NavItem href="/system" label="System" />
<NavItem href="/map" label="World Map" />
```

---

### `steward/src/app/replay/page.tsx` (server component, create)

**Analog:** `steward/src/app/users/page.tsx` — same pattern: `'use client'` with `useEffect` for data fetching, `StewardShell` wrapper, `steward-card` container, table with empty state.

NOTE: The users page uses `'use client'` + `useEffect` (client component). The replay listing page can follow this same pattern since it needs no special Next.js server features — the data is not sensitive and the page is simply a listing. Alternatively, it can be a pure server component (`async function` with `await fetch`) if `cache: 'no-store'` is sufficient. Either works; the simpler client pattern from users/page.tsx is the established convention in Steward.

**Imports pattern** (users/page.tsx lines 1–6):
```typescript
'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
```

**Audit trail fetch pattern** (users/page.tsx lines 93–116):
```typescript
useEffect(() => {
    async function fetchAll() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${GRID_ORIGIN}/api/v1/audit/trail?type=operator.exported&limit=200`,
            );
            if (res.ok) {
                const data = await res.json();
                const entries = Array.isArray(data) ? data : data.entries ?? [];
                setExports(entries);
            } else {
                setError('Could not load operator exports.');
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not reach Grid. Retry by reloading the page.');
        } finally {
            setLoading(false);
        }
    }
    fetchAll();
}, []);
```

**steward-card + table pattern** (users/page.tsx lines 149–202):
```typescript
<div className="steward-card" style={{ marginBottom: 28 }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
            Operator Exports
        </h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
            {exports.length} exports
        </span>
    </div>

    {exports.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            No exports recorded yet. Exports appear here when an H5 operator runs `operator.exported`.
        </div>
    ) : (
        <table>
            <thead>
                <tr>
                    <th>Exported At</th>
                    <th>Operator</th>
                    <th>Tick Range</th>
                    <th>Tarball Hash</th>
                </tr>
            </thead>
            <tbody>
                {exports.map((entry) => (
                    <tr
                        key={entry.eventHash}
                        style={{ cursor: 'pointer', borderLeft: '3px solid #b8542f' }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open scrubber for export ${entry.payload.operator_id} ticks ${entry.payload.start_tick} to ${entry.payload.end_tick}`}
                        onClick={() => setSelected(entry)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(entry)}
                    >
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', width: 160 }}>
                            {new Date(entry.payload.requested_at * 1000).toISOString().replace('T', ' ').slice(0, 19)}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)' }}>
                            {entry.payload.operator_id}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                            {entry.payload.start_tick.toLocaleString()} → {entry.payload.end_tick.toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', width: 140 }}
                            title={entry.payload.tarball_hash}>
                            {entry.payload.tarball_hash.slice(0, 12)}…
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )}
</div>
```

**StewardShell wrapper** (users/page.tsx line 120):
```typescript
<StewardShell title="Replay" breadcrumb="Steward · Observatory · Replay">
```

---

### `steward/src/app/replay/replay-modal.tsx` (client component, create)

**Analog:** `dashboard/src/app/grid/replay/replay-client.tsx` (tier gate logic, `useState` for tick, event filtering) + `steward/src/app/nous/[id]/page.tsx` (inline modal overlay pattern — the card overlay with fixed positioning).

**Tier gate pattern** (replay-client.tsx lines 53–109):
```typescript
'use client';

type Tier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
const TIER_ORDER: Tier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}

// H1/H2 gate
if (!tierAtLeast(operatorTier as Tier, 'H3')) {
    // Render gate message inline (no slider, no data)
    return <p style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink)', textAlign: 'center', paddingBlock: 48 }}>
        H3+ operator tier required to replay exports.
    </p>;
}
```

**Modal overlay pattern** — hand-rolled inline, no modal library (from UI-SPEC + RESEARCH anti-patterns):
```typescript
{/* Overlay */}
<div
    style={{ position: 'fixed', inset: 0, background: 'rgba(26,23,20,0.55)', zIndex: 50 }}
    onClick={onClose}
    aria-hidden="true"
/>
{/* Panel */}
<div
    role="dialog"
    aria-modal="true"
    aria-labelledby="replay-modal-title"
    style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 960,
        width: '90vw',
        maxHeight: '80vh',
        background: 'var(--vellum)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        zIndex: 51,
        display: 'flex',
        flexDirection: 'column',
    }}
    onClick={(e) => e.stopPropagation()}
>
```

**Tick slider pattern** (scrubber.tsx lines 39–49 + UI-SPEC Scrubber Control):
```typescript
const [selectedTick, setSelectedTick] = useState(startTick);

<input
    type="range"
    min={startTick}
    max={endTick}
    value={selectedTick}
    step={1}
    onChange={(e) => setSelectedTick(parseInt(e.target.value, 10))}
    aria-label="Replay tick scrubber"
    aria-valuemin={startTick}
    aria-valuemax={endTick}
    aria-valuenow={selectedTick}
    style={{
        width: '100%',
        height: 6,
        background: 'var(--rule)',
        borderRadius: 3,
        accentColor: 'var(--terracotta)',
    }}
/>
```

**Event list filter** (RESEARCH Pattern 5 — inline, no ReplayGrid dependency):
```typescript
const visibleEntries = entries
    .filter(e => (e.id ?? 0) <= selectedTick)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    .slice(0, 100);
```

**H4 redaction pattern** — check tier before rendering sensitive payload fields:
```typescript
const SENSITIVE_KEYS = new Set([
    'telos_text', 'creed_text', 'skill_body', 'rule_text', 'lore_body',
    'message', 'text', 'content', 'ciphertext', 'belief_content', 'violation_text',
]);
const REDACT_PLACEHOLDER = '— Requires H4';

function redactIfNeeded(key: string, value: unknown, tier: Tier): React.ReactNode {
    if (!tierAtLeast(tier, 'H4') && SENSITIVE_KEYS.has(key)) {
        return (
            <span
                style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}
                title="Sensitive payload field — H4 required to view"
            >
                {REDACT_PLACEHOLDER}
            </span>
        );
    }
    return String(value).slice(0, 40);
}
```

**Close on Escape** (keyboard pattern):
```typescript
useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
}, [onClose]);
```

**Scroll lock** (modal open):
```typescript
useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
}, []);
```

---

### `steward/src/app/culture/page.tsx` (server/client component, create)

**Analog:** `steward/src/app/users/page.tsx` — same `'use client'` + `useEffect` + `Promise.allSettled` multi-fetch pattern.

**Multi-fetch pattern** (nous/[id]/page.tsx lines 282–292, adapted):
```typescript
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

useEffect(() => {
    async function fetchCultureData() {
        setLoading(true);
        try {
            const [skillRes, normsRes, loreRes, citationsRes] = await Promise.allSettled([
                fetch(`${GRID_ORIGIN}/api/v1/grid/culture/skills/lineage`, { cache: 'no-store' }),
                fetch(`${GRID_ORIGIN}/api/v1/grid/norms`, { cache: 'no-store' }),
                fetch(`${GRID_ORIGIN}/api/v1/grid/lore`, { cache: 'no-store' }),
                fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=lore.cited`, { cache: 'no-store' }),
            ]);
            // process each settled result — set state per panel
        } finally {
            setLoading(false);
        }
    }
    fetchCultureData();
}, []);
```

IMPORTANT: Culture routes are NOT proxied through `/api/operator/...` — they go directly to `NEXT_PUBLIC_GRID_ORIGIN` (Pitfall 3 from RESEARCH). This is the same pattern used by users/page.tsx and nous/[id]/page.tsx, which also fetch directly from `GRID_ORIGIN`.

**URL search param reading** (for `?nous=<did>` filter — D-11):
```typescript
import { useSearchParams } from 'next/navigation';

// In the component:
const searchParams = useSearchParams();
const nousFilter = searchParams.get('nous') ?? '';
const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;
const activeFilter = DID_REGEX.test(nousFilter) ? nousFilter : null;
```

**StewardShell wrapper:**
```typescript
<StewardShell title="Culture" breadcrumb="Steward · Observatory · Culture">
```

**Card grid layout** (single-column full-width per UI-SPEC):
```typescript
<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <SkillLineage nodes={skillData?.nodes ?? []} edges={skillData?.edges ?? []} filter={activeFilter} />
    <NormTimeline norms={normsData?.norms ?? []} />
    <LoreGraph entries={loreData?.entries ?? []} citations={citationsData?.entries ?? []} filter={activeFilter} />
</div>
```

---

### `steward/src/app/culture/nous-filter-bar.tsx` (client component, create)

**Analog:** `steward/src/app/nous/[id]/page.tsx` (input + state pattern). No direct analog for URL-param filter; use `useRouter` + `useSearchParams` from Next.js.

**URL-param filter pattern** (D-11, Claude's discretion — URL params):
```typescript
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

export function NousFilterBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentFilter = searchParams.get('nous') ?? '';
    const [inputValue, setInputValue] = useState(currentFilter);

    // Debounced URL update (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            const isValid = DID_REGEX.test(inputValue);
            if (inputValue === '' || isValid) {
                const url = inputValue ? `/culture?nous=${encodeURIComponent(inputValue)}` : '/culture';
                router.replace(url);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue, router]);

    const clearFilter = useCallback(() => {
        setInputValue('');
        router.replace('/culture');
    }, [router]);

    const isActive = DID_REGEX.test(currentFilter);

    return (
        <div style={{
            background: 'var(--vellum)',
            borderBottom: '1px solid var(--rule)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
        }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Filter by Nous
            </span>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="did:noesis:..."
                aria-label="Filter by Nous DID"
                style={{
                    width: 320, height: 32, padding: '8px 12px',
                    background: 'var(--parchment)', border: '1px solid var(--rule)',
                    borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)',
                    outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terracotta)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--rule)'; }}
            />
            {isActive && (
                <div style={{ background: 'rgba(184,84,47,0.10)', border: '1px solid rgba(184,84,47,0.3)', borderRadius: 12, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--terracotta)' }}>
                        {currentFilter.slice(0, 8)}…{currentFilter.slice(-6)}
                    </span>
                    <button
                        role="button"
                        aria-label="Clear filter"
                        onClick={clearFilter}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--terracotta)', fontFamily: 'var(--mono)', fontSize: 11, padding: 0 }}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
```

---

### `steward/src/app/culture/norm-timeline.tsx` (SVG component, create)

**Analog:** `dashboard/src/lib/api/culture.ts` for data types. No SVG analog exists in Steward — write from scratch per UI-SPEC §Card 2.
**Data types to import** (culture.ts lines 25–36):
```typescript
// Copy ONLY the types, not the fetch functions:
export interface NormRecord {
    norm_id: string;
    fingerprint: string;
    crystallized_tick: number;
    participant_count: number;
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number];
}
```

**SVG structure** (UI-SPEC §Card 2 — full spec):
```typescript
// Norm convergence colors (from 25a palette — no new colors):
const NORM_COLORS: Record<string, string> = {
    emergent: '#5a5a6a',      // norm family slate
    coincidental: '#8a8479',  // --muted
};

// Scale function — maps tick value to SVG x coordinate:
function scaleX(tick: number, minTick: number, maxTick: number, svgWidth = 720): number {
    if (maxTick === minTick) return 80;
    return 80 + ((tick - minTick) / (maxTick - minTick)) * (svgWidth - 80);
}

// SVG output structure (per UI-SPEC Card 2):
<svg
    role="img"
    aria-label={`Norm timeline visualization. ${norms.length} norms.`}
    viewBox={`0 0 800 ${norms.length * 32 + 60}`}
    width="100%"
    style={{ background: 'var(--parchment)' }}
>
    {/* X-axis line */}
    {/* Norm rows: evidence range rect + crystallized_tick circle + label */}
</svg>
```

**Card wrapper** (steward-card pattern from nous/[id]/page.tsx lines 548–590):
```typescript
<div className="steward-card">
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                Culture
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                Norm Timeline
            </h2>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 4, padding: '2px 6px' }}>
            {norms.length} norms
        </span>
    </div>
    <div style={{ padding: '20px 0 0 0', overflowX: 'auto', minHeight: 320, maxHeight: 480 }}>
        {/* SVG here */}
    </div>
</div>
```

---

### `steward/src/app/culture/lore-graph.tsx` (SVG component, create)

**Analog:** `dashboard/src/lib/api/culture.ts` for data types. No SVG analog exists.
**Data types** (culture.ts lines 38–65):
```typescript
export interface LoreEntry {
    contributor_did: string;
    tick: number;
    content_hash: string;
    category_tag: string;
    citation_count: number;
    // NOTE: x, y are NOT in the LoreEntry type in culture.ts
    // Grid lore endpoint may or may not return {x,y} — planner must verify
    // from grid/src/api/routes/culture.ts whether lore entries get positions
}

export interface LoreCitation {
    citing_did: string;
    content_hash: string;
    tick: number;
}
```

**IMPORTANT — position fields:** The RESEARCH confirms `SkillLineageResponse` has `{x, y}` per server-computed BFS. Verify whether `LoreEntry` also has `{x, y}` from `grid/src/api/routes/culture.ts`. If lore entries do NOT have server-computed positions, the executor must add them to the Grid response or use a deterministic client-side position (e.g., SHA-256-seeded scatter like `relationships.ts` lines 75–83). Read `grid/src/api/routes/culture.ts` before writing this component.

**Category colors** (from 25a palette per UI-SPEC §Card 3):
```typescript
const CATEGORY_COLORS: Record<string, string> = {
    myth:      '#6a4a7a',  // lore family mauve
    history:   '#5a5a6a',  // norm family slate
    ritual:    '#b8542f',  // --terracotta
    principle: '#8a6a2e',  // --bronze
};
const FALLBACK_COLOR = '#8a8479';  // --muted

function categoryColor(tag: string): string {
    return CATEGORY_COLORS[tag] ?? FALLBACK_COLOR;
}
```

**SVG structure** (UI-SPEC §Card 3):
```typescript
<svg
    role="img"
    aria-label={`Lore graph visualization. ${entries.length} entries.`}
    viewBox="0 0 800 480"
    width="100%"
    style={{ background: 'var(--parchment)' }}
>
    {/* citation edges (lines first) */}
    {/* entry nodes (circles on top) */}
    {/* citation count labels for entries with citation_count >= 3 */}
</svg>
```

**Filter opacity pattern** (from UI-SPEC §Filter Scope):
```typescript
// filter prop = activeNousDid (string | null)
const isFiltered = (entry: LoreEntry) => !filter || entry.contributor_did === filter;
// opacity: isFiltered(entry) ? 1 : 0.3
// filtered node: additional terracotta stroke ring: stroke="var(--terracotta)" strokeWidth={2}
```

---

### `steward/src/app/culture/skill-lineage.tsx` (SVG component, create)

**Analog:** `dashboard/src/lib/api/culture.ts` for data types. No SVG analog exists.
**Data types** (culture.ts lines 20–23):
```typescript
export interface SkillLineageResponse {
    nodes: Array<{ id: string; label: string; type: 'nous' | 'skill'; x: number; y: number }>;
    edges: Array<{ source: string; target: string; tick: number; type: 'taught' | 'inferred' }>;
}
```

Node positions confirmed server-computed (`{x, y}` in response) — no client layout needed.

**Node/edge colors** (from 25a nous + skill family colors per UI-SPEC §Card 1):
```typescript
const NOUS_COLOR  = '#3a7a5a';  // sage — nous family
const SKILL_COLOR = '#7a6a2e';  // amber — skill family
const TAUGHT_STROKE   = '#3a7a5a';  // sage
const INFERRED_STROKE = '#7a6a2e';  // amber
```

**SVG structure** (UI-SPEC §Card 1):
```typescript
// SVG viewBox computed from node positions:
const maxX = Math.max(...nodes.map(n => n.x), 0) + 40;
const maxY = Math.max(...nodes.map(n => n.y), 0) + 40;

<svg
    role="img"
    aria-label={`Skill lineage visualization. ${nodes.length} nodes.`}
    viewBox={`0 0 ${maxX} ${maxY}`}
    width="100%"
    style={{ background: 'var(--parchment)' }}
>
    {/* Edges (render before nodes so nodes appear on top) */}
    {edges.map((edge, i) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;
        return (
            <line
                key={i}
                x1={src.x} y1={src.y}
                x2={tgt.x} y2={tgt.y}
                stroke={edge.type === 'taught' ? TAUGHT_STROKE : INFERRED_STROKE}
                strokeWidth="1.5"
                strokeDasharray={edge.type === 'inferred' ? '4 3' : undefined}
                opacity={isEdgeInFilter(edge) ? 0.9 : 0.25}
            />
        );
    })}
    {/* Nous nodes: circles */}
    {/* Skill nodes: rects */}
    {/* Labels */}
</svg>
```

**Filter logic** (per UI-SPEC §Filter Scope — Skill Lineage):
```typescript
// filter = activeNousDid (string | null)
// Highlight: filtered node + its incident edges at full opacity; all others dim
const filteredNode = filter ? nodes.find(n => n.id === filter) : null;
const incidentEdges = filteredNode
    ? new Set(edges.filter(e => e.source === filter || e.target === filter).map((_, i) => i))
    : null;

const isNodeFiltered = (n: { id: string }) =>
    !filter || n.id === filter || (incidentEdges !== null && /* adjacency check */false);

const isEdgeInFilter = (_: unknown, i: number) =>
    !filter || incidentEdges === null || incidentEdges.has(i);
```

---

## Shared Patterns

### steward-card Container

**Source:** `steward/src/app/nous/[id]/page.tsx` lines 548–551 and `steward/src/app/users/page.tsx` line 149.
**Apply to:** All Steward page components (`replay/page.tsx`, `culture/page.tsx`, all three SVG card components).

```typescript
// Card container
<div className="steward-card" style={{ marginBottom: 24 }}>
    {/* Card header */}
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
            {title}
        </h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
            {subtitle}
        </span>
    </div>
    {/* Card body */}
    <div style={{ padding: 20 }}>
        {children}
    </div>
</div>
```

### Section Eyebrow

**Source:** `steward/src/app/nous/[id]/page.tsx` lines 594–596.
**Apply to:** All card headers, modal header eyebrow.

```typescript
<div style={{
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: 4,
}}>
    Culture
</div>
```

### Tier Badge

**Source:** `steward/src/app/nous/[id]/page.tsx` lines 597–599.
**Apply to:** Replay modal panel header (H3+ badge), any tier-gated section header.

```typescript
<span style={{
    fontFamily: 'var(--mono)',
    fontSize: 9,
    color: 'var(--muted)',
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    padding: '2px 6px',
}}>
    H3+
</span>
```

### Loading / Error State

**Source:** `steward/src/app/users/page.tsx` lines 139–145.
**Apply to:** All pages with async data (`replay/page.tsx`, `culture/page.tsx`, `replay-modal.tsx`).

```typescript
{error ? (
    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
        {error}
    </div>
) : loading ? (
    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, marginBottom: 24 }}>
        Loading…
    </div>
) : (
    /* content */
)}
```

### GRID_ORIGIN Direct Fetch (public endpoints)

**Source:** `steward/src/app/users/page.tsx` line 7 + `steward/src/app/nous/[id]/page.tsx` line 8.
**Apply to:** `replay/page.tsx` (operator.exported audit), `culture/page.tsx` (all 4 culture endpoints).
**Key rule:** Culture routes (`/api/v1/grid/...`, `/api/v1/audit/trail`) do NOT go through `/api/operator/...` proxy.

```typescript
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
// Direct fetch — not proxied:
fetch(`${GRID_ORIGIN}/api/v1/grid/culture/skills/lineage`, { cache: 'no-store' })
```

### Operator Proxy Call (operator-gated endpoints only)

**Source:** `steward/src/app/nous/[id]/page.tsx` lines 242–251.
**Apply to:** Only calls that need `x-operator-id` injection (none in 25c surfaces — all are read-only public fetches or observer-only).

```typescript
// Pattern for operator-gated calls (NOT needed in 25c read surfaces):
fetch(`/api/operator/nous/${encodeURIComponent(did)}/cognitive-snapshot`, {
    method: 'POST',
    headers: { 'x-operator-tier': '3' },
})
```

### SVG Common Attributes (raw-SVG invariant)

**Apply to:** All three culture SVG components (`norm-timeline.tsx`, `lore-graph.tsx`, `skill-lineage.tsx`).
**Rule:** D-9-08 / D-10 — NO d3, react-flow, cytoscape, recharts. Only `<svg>`, `<line>`, `<circle>`, `<rect>`, `<text>`, `<g>`.

```typescript
// All SVG elements:
<svg
    role="img"
    aria-label="{type} visualization. {count} {unit}."
    viewBox="..."
    width="100%"
    style={{ background: 'var(--parchment)', display: 'block' }}
>
```

---

## No Analog Found

All files have analogs. The SVG components (`norm-timeline.tsx`, `lore-graph.tsx`, `skill-lineage.tsx`) have no SVG rendering analog in Steward (only data type analogs in `dashboard/src/lib/api/culture.ts`). The planner should use the UI-SPEC §Cards 1–3 as the primary specification and `culture.ts` type definitions as the data contract.

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `steward/src/app/culture/norm-timeline.tsx` | SVG component | transform | No SVG rendering analog in Steward — write from UI-SPEC §Card 2 |
| `steward/src/app/culture/lore-graph.tsx` | SVG component | transform | No SVG rendering analog in Steward — write from UI-SPEC §Card 3; verify lore `{x,y}` fields from `grid/src/api/routes/culture.ts` |
| `steward/src/app/culture/skill-lineage.tsx` | SVG component | transform | No SVG rendering analog in Steward — write from UI-SPEC §Card 1 |

---

## Pre-Execution Checklist for Planner

These are blockers discovered during pattern mapping:

1. **@vitejs/plugin-react in dashboard local node_modules** — must be installed before D-07 tests can run. `ls dashboard/node_modules/@vitejs/plugin-react` to check.
2. **Lore entry {x,y} fields** — read `grid/src/api/routes/culture.ts` to verify whether `GET /api/v1/grid/lore` returns `{x, y}` per entry before writing `lore-graph.tsx`. If not, the plan must add server-side position computation or document the gap.
3. **SpawnNousDeps exact wiring point** — read `grid/src/api/operator/spawn-system-nous.ts` lines 60–90 to determine whether `registerSpawnSystemNousRoute` accepts a third `spawnNousDeps` argument directly or expects it injected into `services`. The RESEARCH indicates it reads `(services as unknown as { _spawnNousDeps? })._spawnNousDeps` — confirm this before writing the main.ts wiring.
4. **relationships.ts OPERATOR_ID_REGEX import** — confirm the import is already present or add it. The H5 query-param route currently references `operatorId` from `req.query`, not a validated DID; the H2 route uses `validateTierBody` which internally validates the operator_id. After migration, both routes must validate via `OPERATOR_ID_REGEX`.

---

## Metadata

**Analog search scope:** `grid/src/api/operator/`, `grid/src/main.ts`, `steward/src/app/`, `steward/src/components/`, `dashboard/src/app/grid/replay/`, `dashboard/src/lib/api/`
**Files scanned:** 12 source files read (6 Grid, 6 Steward/Dashboard)
**Pattern extraction date:** 2026-05-22
