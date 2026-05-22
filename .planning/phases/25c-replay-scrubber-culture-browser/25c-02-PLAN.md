---
phase: 25c
plan: 02
type: execute
wave: 2
depends_on: []
files_modified:
  - dashboard/package.json
  - dashboard/src/app/grid/replay/replay-client.tsx
autonomous: true
requirements: [D-07]

must_haves:
  truths:
    - "replay-client.test.tsx test suite passes (RED → GREEN)"
    - "@vitejs/plugin-react is resolvable from dashboard/node_modules"
  artifacts:
    - path: "dashboard/src/app/grid/replay/replay-client.tsx"
      provides: "Complete REPLAY-05 dashboard surface"
      contains: "tierAtLeast"
    - path: "dashboard/package.json"
      provides: "@vitejs/plugin-react in devDependencies"
      contains: "@vitejs/plugin-react"
  key_links:
    - from: "dashboard/src/app/grid/replay/replay-client.tsx"
      to: "dashboard/src/app/grid/replay/scrubber.tsx"
      via: "Scrubber component import"
      pattern: "Scrubber"
---

<objective>
Make the Phase 13 RED test stubs in replay-client.test.tsx GREEN (D-07).
First fixes the @vitejs/plugin-react hoisting gap that prevents dashboard tests from
running at all, then completes replay-client.tsx so all test assertions pass.

Purpose: Honours the Phase 13 acceptance contract before the Steward version supersedes it.
D-07 is a prerequisite trust anchor — the dashboard REPLAY-05 surface must be green before
the Steward scrubber is built.
Output: Green replay-client.test.tsx; @vitejs/plugin-react in dashboard devDependencies.
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

<interfaces>
<!-- Key types and contracts extracted from source files -->

From dashboard/src/app/grid/replay/scrubber.tsx (Scrubber component contract):
```typescript
export interface ScrubberProps {
    value: number;
    startTick: number;
    endTick: number;
    onChange: (tick: number) => void;
}
// Renders: <input type="range" data-testid="scrubber-range" aria-label="Replay tick slider" />
```

From dashboard/src/app/grid/replay/replay-client.tsx (already-present constants, lines 50-68):
```typescript
const TIER_GATE_COPY = 'Replay requires H3 or higher';
const REPLAY_BADGE_COPY = 'REPLAY';

type Tier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
const TIER_ORDER: Tier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}
```

From dashboard/src/app/grid/replay/replay-client.test.tsx (test file — read before editing):
The test file contains 9 test cases describing the component's API surface. Read the
full test file to understand exactly which renders, props, and behaviors are asserted
before modifying replay-client.tsx.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install @vitejs/plugin-react locally in dashboard/ (D-07 Pitfall 1)</name>
  <files>dashboard/package.json</files>
  <read_first>
    - dashboard/package.json (check current devDependencies for @vitejs/plugin-react)
  </read_first>
  <action>
Check whether @vitejs/plugin-react is already in dashboard's local node_modules:
```bash
ls dashboard/node_modules/@vitejs/plugin-react 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING: run `cd dashboard && npm install --save-dev @vitejs/plugin-react@^4.3.4` from the repo root's dashboard/ subdirectory. This adds it to dashboard/package.json devDependencies AND installs it locally in dashboard/node_modules so vitest's bundled Vite can find it.

If EXISTS: skip install, proceed to Task 2.

Verify vitest can now load the test file without "jsx parse" errors:
```bash
cd dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx --reporter=dot 2>&1 | head -20
```
The output should show test results (pass or fail), NOT a "Failed to parse source" or "invalid JS syntax" error.
  </action>
  <verify>
    <automated>ls /Users/desirey/Programming/src/Noesis/dashboard/node_modules/@vitejs/plugin-react/dist/index.js</automated>
  </verify>
  <acceptance_criteria>
    - `ls dashboard/node_modules/@vitejs/plugin-react` exits 0 (directory exists)
    - `grep "@vitejs/plugin-react" dashboard/package.json` shows the package in devDependencies
    - Running vitest on the replay-client.test.tsx does NOT produce "Failed to parse source" or "preserve" errors in its output
  </acceptance_criteria>
  <done>@vitejs/plugin-react installed locally in dashboard/; vitest can parse .tsx test files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Complete replay-client.tsx to make RED stubs GREEN (D-07)</name>
  <files>dashboard/src/app/grid/replay/replay-client.tsx</files>
  <read_first>
    - dashboard/src/app/grid/replay/replay-client.test.tsx (READ FULLY — all 9 test cases define the exact API surface required)
    - dashboard/src/app/grid/replay/replay-client.tsx (current state — partially implemented)
    - dashboard/src/app/grid/replay/scrubber.tsx (Scrubber component props and data-testid)
  </read_first>
  <behavior>
    - Test: H1 or H2 tier renders TIER_GATE_COPY ('Replay requires H3 or higher') not slider
    - Test: H3 tier renders slider (Scrubber component with data-testid="scrubber-range")
    - Test: H4 tier renders slider with no redaction placeholders for standard fields
    - Test: H3 tier renders "— Requires H4" placeholder for sensitive payload keys (telos_text, skill_body, etc.)
    - Test: event list shows entries at or before selectedTick (cumulative filter)
    - Test: REPLAY_BADGE_COPY ('REPLAY') appears in the component output
    - Test: all 9 test assertions in replay-client.test.tsx pass
  </behavior>
  <action>
Read replay-client.test.tsx completely first to understand all 9 test cases and their exact assertions. Then read the current replay-client.tsx to see what is already implemented vs. what is missing.

The component must satisfy EXACTLY what the test file asserts. Key behaviors to implement based on the PATTERNS.md analysis:

1. **H3+ tier gate**: if tier is H1 or H2 (not at least H3), render TIER_GATE_COPY text and no slider. Use `tierAtLeast(tier, 'H3')` — already defined in the file.

2. **Event list cumulative filter**: `entries.filter(e => (e.id ?? 0) <= selectedTick).sort((a,b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, 100)` — show all events from start_tick up to and including selectedTick.

3. **H4 redaction**: for H3 operators, sensitive payload keys render as '— Requires H4'. Sensitive keys: `telos_text, creed_text, skill_body, rule_text, lore_body, message, text, content, ciphertext, belief_content, violation_text`. Use `tierAtLeast(tier, 'H4')` check.

4. **Scrubber integration**: render `<Scrubber value={selectedTick} startTick={startTick} endTick={endTick} onChange={setSelectedTick} />` when tier >= H3. Import from `./scrubber`.

5. **REPLAY badge**: render REPLAY_BADGE_COPY somewhere in the component (badge, header, or label).

Do NOT add features beyond what the tests assert. Match test assertions exactly — check each test's `expect(...)` for exact strings, component roles, testids, and values.

After implementing, run the test suite to confirm all 9 pass. Fix any failing assertions iteratively — do not guess; read the error output carefully.
  </action>
  <verify>
    <automated>cd /Users/desirey/Programming/src/Noesis/dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `cd dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx --reporter=dot` exits 0
    - Output shows all tests in the file as passing (green), not skipped
    - `cd dashboard && npx vitest run --reporter=dot` exits 0 (full dashboard suite green)
    - No new test files were added (only replay-client.tsx was modified)
  </acceptance_criteria>
  <done>All replay-client.test.tsx tests pass. Dashboard test suite remains green. Phase 13 REPLAY-05 acceptance contract fulfilled.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Dashboard replay-client → operator tier prop | Tier is read from a prop passed by the parent — in production, comes from session cookie validated server-side |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25c-02-01 | Elevation of Privilege | replay-client.tsx tier gate | mitigate | tierAtLeast(tier, 'H3') check before rendering scrubber; H1/H2 see only gate message, no data |
| T-25c-02-02 | Information Disclosure | H3 payload redaction | mitigate | Sensitive keys (telos_text, skill_body, ciphertext, etc.) replaced with '— Requires H4' when tier < H4 |
| T-25c-02-03 | Tampering | observer-only surface | accept | Dashboard replay viewer is read-only; no mutations to live Grid from this component |
</threat_model>

<verification>
- `cd dashboard && npx vitest run src/app/grid/replay/replay-client.test.tsx --reporter=dot` → all tests pass
- `cd dashboard && npx vitest run --reporter=dot` → full suite green
- `grep -r "validateTierBody" dashboard/src/` → 0 matches (not applicable to dashboard)
- `grep -rn "import.*d3\|import.*recharts\|import.*react-flow\|import.*cytoscape" dashboard/src/app/grid/replay/` → 0 matches
</verification>

<success_criteria>
1. @vitejs/plugin-react resolvable from dashboard/node_modules
2. replay-client.test.tsx: all 9 tests pass
3. Full dashboard vitest suite green
4. No new allowlist events or audit.append calls introduced
</success_criteria>

<output>
After completion, create `.planning/phases/25c-replay-scrubber-culture-browser/25c-02-SUMMARY.md`
</output>
