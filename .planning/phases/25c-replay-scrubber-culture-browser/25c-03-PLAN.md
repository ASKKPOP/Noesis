---
phase: 25c
plan: 03
type: execute
wave: 3
depends_on: [25c-01, 25c-02]
files_modified:
  - steward/src/components/StewardShell.tsx
  - steward/src/app/replay/page.tsx
  - steward/src/app/replay/replay-modal.tsx
autonomous: true
requirements: [D-04, D-05, D-06]

must_haves:
  truths:
    - "StewardShell nav shows Observatory group with /replay and /culture links"
    - "Navigating to /replay renders a table with columns: Exported At, Operator, Tick Range, Tarball Hash"
    - "Clicking a table row opens a scrubber modal with a tick slider"
    - "H1/H2 operators see gate message instead of slider"
    - "H3 operators see slider + event list with H4-redacted sensitive fields"
    - "H4/H5 operators see slider + event list with no redaction"
    - "No Grid mutations from the replay surface"
  artifacts:
    - path: "steward/src/components/StewardShell.tsx"
      provides: "Observatory nav group with /replay and /culture links"
      contains: "Observatory"
    - path: "steward/src/app/replay/page.tsx"
      provides: "Listing page for operator.exported entries"
      contains: "Operator Exports"
    - path: "steward/src/app/replay/replay-modal.tsx"
      provides: "Tick scrubber modal with H3+ gate and H4 redaction"
      contains: "Replay tick scrubber"
  key_links:
    - from: "steward/src/app/replay/page.tsx"
      to: "NEXT_PUBLIC_GRID_ORIGIN/api/v1/audit/trail?type=operator.exported"
      via: "direct fetch (not proxied)"
      pattern: "audit/trail"
    - from: "steward/src/app/replay/replay-modal.tsx"
      to: "NEXT_PUBLIC_GRID_ORIGIN/api/v1/audit/trail"
      via: "fetch audit slice on row click"
      pattern: "audit/trail"
---

<objective>
Build the StewardShell Observatory nav group and the /replay surface: listing page
(server/client component) showing operator.exported entries, plus a scrubber modal with
tick slider, H3+ gate, H4 redaction, and cumulative event list.

Purpose: Operators can inspect past Grid exports tick-by-tick from the Steward Console.
The surface is observer-only — no writes to the live Grid.
Output: Three new/modified files. Manual verification at localhost:3002/replay.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-CONTEXT.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-RESEARCH.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-PATTERNS.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-UI-SPEC.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-01-SUMMARY.md
@.planning/phases/25c-replay-scrubber-culture-browser/25c-02-SUMMARY.md

<interfaces>
<!-- Key contracts for executor -->

From steward/src/components/StewardShell.tsx (NavSection + NavItem components, lines 23-50):
```typescript
function NavSection({ title }: { title: string }) {
    return (
        <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#5a554e',
            padding: '16px 16px 6px',
        }}>
            {title}
        </div>
    );
}

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
Insertion point: after `<NavItem href="/audit" label="Audit Log" />`, before `<NavSection title="Grid" />`.

operator.exported payload shape (from grid/src/audit/append-operator-exported.ts):
```typescript
// AuditEntry.payload for operator.exported:
{
    tier: 'H5',
    operator_id: string,
    start_tick: number,
    end_tick: number,
    tarball_hash: string,
    requested_at: number,  // unix seconds
}
// NOTE: NO nous_did field — D-05 "Nous DID" column replaced with Tarball Hash
```

AuditEntry type used in Steward (infer from users/page.tsx pattern):
```typescript
interface AuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: Record<string, unknown>;
    createdAt: number;
    eventHash: string;
}

interface OperatorExportedPayload {
    tier: string;
    operator_id: string;
    start_tick: number;
    end_tick: number;
    tarball_hash: string;
    requested_at: number;
}
```

Tier gate pattern (from dashboard/src/app/grid/replay/replay-client.tsx):
```typescript
type Tier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
const TIER_ORDER: Tier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];
function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}
```

H4 redaction (from 25c-PATTERNS.md):
```typescript
const SENSITIVE_KEYS = new Set([
    'telos_text', 'creed_text', 'skill_body', 'rule_text', 'lore_body',
    'message', 'text', 'content', 'ciphertext', 'belief_content', 'violation_text',
]);
const REDACT_PLACEHOLDER = '— Requires H4';
```

Event-family colors (from 25a-UI-SPEC, operator family):
```
operator family: #b8542f (terracotta)
nous family:     #3a7a5a (sage)
trade family:    #6a4a7a (mauve)
law family:      #5a5a6a (slate)
tick:            #8a8479 (muted)
```

Design tokens (from 25a-UI-SPEC):
- --ink, --parchment, --vellum, --terracotta, --rule, --muted
- steward-card CSS class: vellum bg + 3px terracotta stripe (::before)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Observatory nav group to StewardShell.tsx (D-04)</name>
  <files>steward/src/components/StewardShell.tsx</files>
  <read_first>
    - steward/src/components/StewardShell.tsx (read fully — find the Audit Log NavItem and the Grid NavSection insertion point)
  </read_first>
  <action>
In steward/src/components/StewardShell.tsx, find the line containing `<NavItem href="/audit" label="Audit Log" />`. Immediately AFTER that line, insert:

```tsx
{/* Observatory section — Phase 25c: read-only historical/derived views */}
<NavSection title="Observatory" />
<NavItem href="/replay" label="Replay" />
<NavItem href="/culture" label="Culture" />
```

This places the Observatory group BETWEEN the Operator group (ends with Audit Log) and the Grid group (starts with System/World Map), per 25c-UI-SPEC nav structure contract.

Do not change anything else in StewardShell.tsx. The NavSection and NavItem components already exist in the file — no new components needed.
  </action>
  <verify>
    <automated>grep -n "Observatory\|/replay\|/culture" /Users/desirey/Programming/src/Noesis/steward/src/components/StewardShell.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep "Observatory" steward/src/components/StewardShell.tsx` returns 1 match
    - `grep '"/replay"' steward/src/components/StewardShell.tsx` returns 1 match
    - `grep '"/culture"' steward/src/components/StewardShell.tsx` returns 1 match
    - The Observatory section appears between Audit Log and Grid section in the file
  </acceptance_criteria>
  <done>Observatory nav group with /replay and /culture links added to StewardShell between Operator and Grid sections.</done>
</task>

<task type="auto">
  <name>Task 2: Create /replay listing page + scrubber modal (D-05, D-06)</name>
  <files>steward/src/app/replay/page.tsx, steward/src/app/replay/replay-modal.tsx</files>
  <read_first>
    - steward/src/app/users/page.tsx (client component pattern: 'use client' + useEffect + steward-card table — this is the exact structural analog)
    - steward/src/app/nous/[id]/page.tsx (modal overlay pattern + tier badge pattern)
    - steward/src/components/StewardShell.tsx (StewardShell props: title, breadcrumb)
    - steward/src/app/globals.css (verify --ink, --parchment, --vellum, --terracotta, --rule, --muted are defined)
  </read_first>
  <action>
Create TWO new files.

FILE 1 — steward/src/app/replay/page.tsx:
Follow the users/page.tsx pattern exactly (client component with useEffect). Key implementation:

```tsx
'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';
import { ReplayModal } from './replay-modal';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface OperatorExportedPayload {
    tier: string;
    operator_id: string;
    start_tick: number;
    end_tick: number;
    tarball_hash: string;
    requested_at: number;
}

interface ExportAuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: OperatorExportedPayload;
    createdAt: number;
    eventHash: string;
}
```

Fetch from `${GRID_ORIGIN}/api/v1/audit/trail?type=operator.exported&limit=200` (direct fetch, NOT proxied through /api/operator — this is a public audit read, not an operator-gated call per RESEARCH Pitfall 3).

Render a steward-card containing a table with thead: [Exported At | Operator | Tick Range | Tarball Hash]. Exact column specs per 25c-UI-SPEC:
- Exported At: `new Date(entry.payload.requested_at * 1000).toISOString().replace('T', ' ').slice(0, 19)` in 11px mono --muted, width 160px
- Operator: `entry.payload.operator_id` in 11px mono --ink
- Tick Range: `${entry.payload.start_tick.toLocaleString()} → ${entry.payload.end_tick.toLocaleString()}` in 11px mono --ink, whiteSpace nowrap
- Tarball Hash: `entry.payload.tarball_hash.slice(0, 12) + '…'` with title attr = full hash, 11px mono --muted, width 140px

Row: height 36px, cursor pointer, borderLeft '3px solid #b8542f' (operator family), tabIndex={0}, role="button",
aria-label={`Open scrubber for export ${entry.payload.operator_id} ticks ${entry.payload.start_tick} to ${entry.payload.end_tick}`}
onClick + onKeyDown ('Enter'/'Space') → setSelected(entry).

Row hover: background rgba(184,84,47,0.06).

StewardShell props: `title="Replay"` `breadcrumb="Steward · Observatory · Replay"`

Page h1: "Replay" (20px serif --ink), sub-label: "Operator exports — click a row to scrub through its tick range." (11px mono --muted)

Card title: "Operator Exports" with count badge showing export count.

Empty state (no exports): "No exports recorded yet. Exports appear here when an H5 operator runs `operator.exported`." 12px mono --muted, padding 24px, centered.

Error state: "Could not reach Grid. Retry by reloading the page." or "Could not load operator exports." 12px mono --muted.

When a row is selected: render `<ReplayModal entry={selected} onClose={() => setSelected(null)} />` (conditional render outside the card).

---

FILE 2 — steward/src/app/replay/replay-modal.tsx:
Client component implementing the scrubber modal. Reads operator tier from a prop (page passes it from cookie/session) OR defaults to reading from a dedicated GET endpoint. Since Steward uses cookie-based operator tier set during proxy auth, the simplest approach: accept `operatorTier` as a prop with a default of 'H1' (safe default). The page component can read the tier from document.cookie or pass 'H5' for trusted internal use. For v1, accept `operatorTier?: string` prop defaulting to 'H3' (gives scrubber access to most operators).

NOTE: The tier gate in Steward works as follows — the Steward proxy injects x-operator-tier on Grid API calls, but the Steward UI itself is accessed by operators who have a cookie from the Steward auth session. Read how other Steward pages handle operator tier display (check nous/[id]/page.tsx or users/page.tsx for any tier reading pattern). If no pattern exists, default to H3 (show scrubber, apply H4 redaction for sensitive fields) — this is the safe default per REPLAY-05.

Modal implementation per 25c-UI-SPEC §Scrubber Modal:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface AuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: Record<string, unknown>;
    createdAt: number;
    eventHash: string;
}

interface OperatorExportedPayload {
    operator_id: string;
    start_tick: number;
    end_tick: number;
    tarball_hash: string;
    requested_at: number;
}

interface ReplayModalProps {
    entry: { payload: OperatorExportedPayload; eventHash: string };
    onClose: () => void;
    operatorTier?: string;
}
```

State: `selectedTick` (number, init = start_tick), `entries` (AuditEntry[], init = []), `loading` (bool), `error` (string|null).

On mount / when entry changes: fetch `${GRID_ORIGIN}/api/v1/audit/trail?limit=1000` and filter to entries where id >= start_tick && id <= end_tick. Or fetch with offset/limit if the audit trail supports tick-range queries. If the Grid does not support tick range filtering in the query, fetch limit=1000 and filter client-side.

Tier gate: derive `operatorTierNum` from `parseInt(operatorTier ?? 'H3'.slice(1))`. If tier < 3 (H1 or H2), render gate message "H3+ operator tier required to replay exports." 14px sans --ink, centered, padding-block 48px. No slider. No data fetch.

Tier for H4 redaction: if tierNum < 4, apply SENSITIVE_KEYS redaction to payload field values.

Modal overlay: position fixed, inset 0, background rgba(26,23,20,0.55), z-index 50. Click overlay → onClose.

Panel: position fixed, top 50%, left 50%, transform translate(-50%,-50%), maxWidth 960, maxHeight '80vh', background var(--vellum), borderRadius 12, boxShadow '0 20px 60px rgba(0,0,0,0.25)', overflow hidden, zIndex 51, display flex, flexDirection column. Click panel → stopPropagation.

role="dialog", aria-modal="true", aria-labelledby="replay-modal-title".

Panel header (padding 16px 24px, borderBottom 1px var(--rule)):
- Eyebrow "Export": 10px mono uppercase --muted, letterSpacing 0.14em
- Title (id="replay-modal-title"): operator_id + " · ticks " + start_tick + " → " + end_tick, 20px serif --ink
- Close button "×": 24px square, aria-label="Close scrubber", onClick onClose. Focus ring: outline 2px solid var(--terracotta).

Body (overflow-y auto, padding 24px, flex 1):
- Scrubber control region (only when tier >= H3):
  - Tick label row (flexbox justifyContent spaceBetween, marginBottom 12):
    - Left: "Tick {selectedTick.toLocaleString()}" 14px mono --ink fontVariantNumeric tabular-nums
    - Right: "{visibleEntries.length} events" 11px mono --muted
  - `<input type="range">` min={start_tick} max={end_tick} value={selectedTick} step={1}
    onChange={(e) => setSelectedTick(parseInt(e.target.value, 10))}
    aria-label="Replay tick scrubber"
    aria-valuemin={start_tick} aria-valuemax={end_tick} aria-valuenow={selectedTick}
    style={{ width:'100%', height:6, background:'var(--rule)', borderRadius:3, accentColor:'var(--terracotta)' }}
  - Bounds row (flexbox justifyContent spaceBetween): start_tick.toLocaleString() | end_tick.toLocaleString() 10px mono --muted

- Event list region:
  - Section eyebrow "Events at tick {selectedTick}" 10px mono uppercase --muted
  - Scroll container: maxHeight 320px, overflowY auto
  - visibleEntries = entries.filter(e => (e.id ?? 0) <= selectedTick).sort((a,b)=>(b.id??0)-(a.id??0)).slice(0,100)
  - Each row: height 24px, display flex, alignItems center, gap 8, paddingBlock 4
    - Family dot: 6px circle, color from EVENT_FAMILY_COLORS map
    - Tick: e.id, 10px mono --muted, minWidth 60, textAlign right
    - Event type badge: eventType, 10px mono, background with family color, borderRadius 2
    - Actor DID: e.actorDid.slice(0,8)+'…'+e.actorDid.slice(-6), 10px mono --muted
    - Payload preview: up to 2 key=value pairs, applying H4 redaction
  - Empty state: "No events at or before this tick." 12px mono --muted, padding 24px, centered

EVENT_FAMILY_COLORS:
```typescript
const EVENT_FAMILY_COLORS: Record<string, string> = {
    operator: '#b8542f',
    nous: '#3a7a5a',
    trade: '#6a4a7a',
    law: '#5a5a6a',
    tick: '#8a8479',
    bios: '#5a8a4a',
    iris: '#4a6a8a',
    skill: '#7a6a2e',
    norm: '#5a5a6a',
    lore: '#6a4a7a',
    proposal: '#8a6a2e',
    ballot: '#8a6a2e',
    ananke: '#8a4a2e',
};
function familyColor(eventType: string): string {
    const family = eventType.split('.')[0] ?? 'tick';
    return EVENT_FAMILY_COLORS[family] ?? '#8a8479';
}
```

Footer (padding 12px 24px, borderTop 1px var(--rule)):
- "Showing tick {selectedTick} · Observer-only — no Grid mutations." 10px mono --muted

Escape key handler (useEffect):
```typescript
useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
}, [onClose]);
```

Scroll lock (useEffect):
```typescript
useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
}, []);
```

GRID_ORIGIN: `const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';`

SENSITIVE_KEYS and redact function:
```typescript
const SENSITIVE_KEYS = new Set([
    'telos_text','creed_text','skill_body','rule_text','lore_body',
    'message','text','content','ciphertext','belief_content','violation_text',
]);
function redactValue(key: string, value: unknown, tierNum: number): string {
    if (tierNum < 4 && SENSITIVE_KEYS.has(key)) return '— Requires H4';
    return String(value).slice(0, 40);
}
```
  </action>
  <verify>
    <automated>grep -n "Operator Exports\|operator_id\|tarball_hash\|Replay tick scrubber\|Observatory\|No exports" /Users/desirey/Programming/src/Noesis/steward/src/app/replay/page.tsx /Users/desirey/Programming/src/Noesis/steward/src/app/replay/replay-modal.tsx 2>/dev/null</automated>
  </verify>
  <acceptance_criteria>
    - `grep "Operator Exports" steward/src/app/replay/page.tsx` → 1 match
    - `grep "audit/trail" steward/src/app/replay/page.tsx` → 1 match (direct Grid fetch, not /api/operator/ proxy)
    - `grep "/api/operator" steward/src/app/replay/page.tsx` → 0 matches (culture routes NOT proxied — same rule applies here for public audit trail read)
    - `grep "Replay tick scrubber" steward/src/app/replay/replay-modal.tsx` → 1 match (aria-label)
    - `grep "H3+ operator tier required" steward/src/app/replay/replay-modal.tsx` → 1 match (tier gate copy)
    - `grep "Requires H4\|SENSITIVE_KEYS" steward/src/app/replay/replay-modal.tsx` → matches (redaction implemented)
    - `grep "Observer-only" steward/src/app/replay/replay-modal.tsx` → 1 match (footer copy)
    - `grep -rn "audit\.append\|audit\.emit" steward/src/app/replay/` → 0 matches (allowlist delta 0)
    - `grep -rn "import.*d3\|import.*recharts\|import.*react-flow\|import.*cytoscape" steward/src/app/replay/` → 0 matches
  </acceptance_criteria>
  <done>/replay listing page and scrubber modal created. Observatory nav wired. H3+ tier gate and H4 redaction implemented. Observer-only — no Grid mutations.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Steward /replay page | Client fetches public audit trail; operator tier is derived from session cookie |
| Steward replay-modal → Grid audit trail | Direct fetch to GRID_ORIGIN; read-only, no auth token required |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25c-03-01 | Elevation of Privilege | replay-modal tier gate | mitigate | H1/H2 operators see gate message only; no event data fetched until tier >= H3 |
| T-25c-03-02 | Information Disclosure | H3 payload rendering | mitigate | SENSITIVE_KEYS set blocks 11 sensitive payload fields for tier < H4; placeholder '— Requires H4' shown |
| T-25c-03-03 | Tampering | replay surface | accept | Surface is read-only; no write operations on any endpoint; ReadOnlyAuditChain on Grid side throws on append (T-10-07 carried) |
| T-25c-03-04 | Repudiation | export attribution | accept | Listing shows operator_id from the operator.exported payload; attribution recorded at export time |
| T-25c-03-05 | Spoofing | direct audit trail fetch | accept | Audit trail is public read (no auth required by Grid design); data integrity comes from AuditChain hash chain |
</threat_model>

<verification>
- `grep "Observatory" steward/src/components/StewardShell.tsx` → 1 match
- `grep "Operator Exports" steward/src/app/replay/page.tsx` → 1 match
- `grep "Replay tick scrubber" steward/src/app/replay/replay-modal.tsx` → 1 match
- `grep -rn "audit\.append" steward/src/app/replay/` → 0 matches
- `grep -rn "import.*d3\|recharts\|react-flow\|cytoscape" steward/src/app/replay/` → 0 matches
- Manual: navigate to localhost:3002/replay → table with columns visible
- Manual: click row → modal opens with slider
</verification>

<success_criteria>
1. StewardShell Observatory nav group with /replay and /culture links present
2. /replay renders Operator Exports table (4 columns per UI-SPEC)
3. Clicking a row opens scrubber modal with tick slider
4. H1/H2 shows gate message; H3+ shows slider; H3 shows H4 redaction
5. No audit.append calls in steward/src/app/replay/ (allowlist delta 0)
6. No charting library imports in replay files
</success_criteria>

<output>
After completion, create `.planning/phases/25c-replay-scrubber-culture-browser/25c-03-SUMMARY.md`
</output>
