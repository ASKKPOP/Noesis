---
phase: 10b
plan: 07
type: execute
wave: 4
depends_on: [10b-02, 10b-03, 10b-04, 10b-05, 10b-06]
files_modified:
  - grid/test/regression/pause-resume-10b.test.ts
  - grid/test/ananke/audit-size-ceiling-10b.test.ts
  - grid/test/integration/bios-crossing-to-drive-crossed.test.ts
  - grid/test/integration/audit-tick-system-tick-drift-1000.test.ts
  - grid/test/audit/closed-enum-bios-lifecycle.test.ts
  - scripts/check-wallclock-forbidden.mjs
autonomous: true
requirements: [BIOS-01, BIOS-02, BIOS-03, BIOS-04, CHRONOS-01, CHRONOS-02, CHRONOS-03]
must_haves:
  truths:
    - "Over 1000 ticks, audit_tick === system_tick holds for every event (zero drift)"
    - "Phase 6 D-17 regression hash c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461 unchanged with Chronos listener wired"
    - "Bios pressure crossing produces ananke.drive_crossed within the same Brain tick"
    - "bios.resurrect / bios.migrate / bios.transfer events rejected at allowlist"
    - "Wall-clock grep gate covers brain/src/noesis_brain/bios/, brain/src/noesis_brain/chronos/, brain/src/noesis_brain/memory/retrieval.py"
  artifacts:
    - path: "grid/test/integration/audit-tick-system-tick-drift-1000.test.ts"
      provides: "1000-tick invariant check audit_tick === system_tick"
      contains: "1000"
    - path: "grid/test/integration/bios-crossing-to-drive-crossed.test.ts"
      provides: "end-to-end: need threshold crossing emits ananke.drive_crossed"
      contains: "ananke.drive_crossed"
    - path: "scripts/check-wallclock-forbidden.mjs"
      provides: "CI gate forbidding datetime/time.time in Bios/Chronos/retrieval paths"
      contains: "datetime"
  key_links:
    - from: "scripts/check-wallclock-forbidden.mjs"
      to: "brain/src/noesis_brain/bios/, chronos/, memory/retrieval.py"
      via: "grep scan fails build on wall-clock import"
      pattern: "datetime"
---

<objective>
End-of-phase integration + regression suite. Exercises the full Bios→Ananke crossing pipeline, proves the audit_tick=system_tick invariant holds over 1000 ticks with all Phase 10b events in-flight, re-verifies the Phase 6 D-17 pause/resume zero-diff hash with Chronos listener wired, and installs a CI grep-gate forbidding wall-clock reads in Bios/Chronos/retrieval paths. Turns final Wave 0 regression/ceiling/enum stubs GREEN.

Purpose: Seal the phase invariants in executable tests + CI so Phase 10c and later cannot silently regress them.

Output: 5 integration/regression tests + 1 CI script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-RESEARCH.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-VALIDATION.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-02-SUMMARY.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-03-SUMMARY.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-04-SUMMARY.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-05-SUMMARY.md
@.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-06-SUMMARY.md

<interfaces>
<!-- Reference hashes + invariants. -->

Phase 6 D-17 regression hash (from STATE.md Accumulated Context):
c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461

Phase 10a audit size ceiling: 1000 ticks × 5 drives ≤ 50 events (from prior ceiling test).
Phase 10b extension: same 1000 ticks now also includes bios.* events; ceiling widens per CONTEXT.md (see 10b-CONTEXT.md for exact updated bound — compute from rise rates: energy crosses 2 boundaries over 1000 ticks maximum, sustenance 1 → +3 events/Nous max; new bound ≤ 53 events).

Bios→Ananke contract (from plan 10b-02):
BiosRuntime.step(tick) produces crossings; crossings invoke AnankeRuntime.elevate_drive; NEXT AnankeRuntime.step(tick) emits ananke.drive_crossed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: 1000-tick audit_tick drift test + Bios→Ananke crossing end-to-end</name>
  <files>grid/test/integration/audit-tick-system-tick-drift-1000.test.ts, grid/test/integration/bios-crossing-to-drive-crossed.test.ts</files>
  <read_first>
    - grid/test/regression/ (existing ceiling test for the format pattern)
    - grid/src/genesis/launcher.ts (spawn entrypoint for integration harness)
    - grid/src/bios/appendBiosBirth.ts
    - brain/src/noesis_brain/bios/runtime.py (BiosRuntime for assertions about crossings)
  </read_first>
  <behavior>
    - audit-tick-system-tick-drift-1000.test.ts: spawn 1 Nous, run 1000 ticks, assert every emitted audit event has payload.tick === systemTick at emission
    - bios-crossing-to-drive-crossed.test.ts: force an energy crossing (seed + run enough ticks), assert ananke.drive_crossed (drive='hunger') emitted within same tick or next tick of crossing
    - Neither test reads wall-clock
    - Both use existing in-memory audit chain harness (Phase 5 pattern)
  </behavior>
  <action>
Create `grid/test/integration/audit-tick-system-tick-drift-1000.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryHarness } from '../helpers/harness';

describe('Phase 10b invariant: audit_tick === system_tick over 1000 ticks', () => {
  it('no drift across 1000 ticks with bios + ananke + telos events in stream', async () => {
    const harness = createInMemoryHarness({ seed: 42 });
    await harness.spawnNous({ did: 'did:noesis:' + 'a'.repeat(32) });

    for (let t = 1; t <= 1000; t++) {
      await harness.tick();
      const events = harness.eventsAtTick(t);
      for (const ev of events) {
        expect(ev.payload.tick).toBe(t);
      }
    }
    // Sanity: at least bios.birth fired
    expect(harness.eventsOfType('bios.birth').length).toBeGreaterThanOrEqual(1);
  });
});
```

Create `grid/test/integration/bios-crossing-to-drive-crossed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryHarness } from '../helpers/harness';

describe('Bios→Ananke elevator end-to-end', () => {
  it('energy crossing LOW→MED produces ananke.drive_crossed drive=hunger', async () => {
    const harness = createInMemoryHarness({ seed: 42 });
    await harness.spawnNous({ did: 'did:noesis:' + 'b'.repeat(32) });

    // Rise rate 0.0003/tick; from baseline 0.3 → threshold 0.33+0.02 band = ~130 ticks
    let crossedTick: number | null = null;
    for (let t = 1; t <= 2000; t++) {
      await harness.tick();
      const driveEvents = harness.eventsAtTick(t).filter(e => e.type === 'ananke.drive_crossed');
      const hungerCross = driveEvents.find((e: any) => e.payload.drive === 'hunger' && e.payload.level === 'med');
      if (hungerCross) { crossedTick = t; break; }
    }
    expect(crossedTick).not.toBeNull();
    expect(crossedTick!).toBeGreaterThan(100);
    expect(crossedTick!).toBeLessThan(500);
  });
});
```
  </action>
  <verify>
    <automated>cd grid && bun test test/integration/audit-tick-system-tick-drift-1000.test.ts test/integration/bios-crossing-to-drive-crossed.test.ts --run</automated>
  </verify>
  <done>Both integration tests GREEN. Drift test covers 1000 ticks. Crossing test proves elevator wiring works end-to-end.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pause/resume regression hash + audit-size-ceiling + closed-enum rejection</name>
  <files>grid/test/regression/pause-resume-10b.test.ts, grid/test/ananke/audit-size-ceiling-10b.test.ts, grid/test/audit/closed-enum-bios-lifecycle.test.ts</files>
  <read_first>
    - grid/test/regression/pause-resume.test.ts (Phase 6 D-17 original, ~c7c49f49 hash template)
    - grid/test/ananke/audit-size-ceiling.test.ts (Phase 10a ceiling, for Bios extension)
    - grid/src/audit/broadcast-allowlist.ts (21-event allowlist from plan 10b-03)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-10 ceiling extension bound)
  </read_first>
  <behavior>
    - pause-resume-10b.test.ts: clone Phase 6 regression hash scenario with bios.birth/death + Chronos listener in the pipeline; assert hash matches c7c49f49…0461 when bios state is steady (no crossing during pause window)
    - audit-size-ceiling-10b.test.ts: 1000 ticks × 1 Nous (5 drives + 2 needs); assert total events ≤ bound from CONTEXT.md D-10b-10
    - closed-enum-bios-lifecycle.test.ts: attempt to append 'bios.resurrect', 'bios.migrate', 'bios.transfer'; assert all three throw allowlist violation
    - No wall-clock reads in any test
  </behavior>
  <action>
Create `grid/test/regression/pause-resume-10b.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryHarness } from '../helpers/harness';

const PHASE_6_D17_HASH = 'c7c49f492d85072327e8a4af6912228d6dc2db2d7be372f92b57b30b2a4b0461';

describe('Phase 6 D-17 regression: zero-diff pause/resume with Bios + Chronos wired', () => {
  it('produces identical audit hash when bios state is steady during pause window', async () => {
    const harness = createInMemoryHarness({ seed: 42, chronosListener: true });
    await harness.spawnNous({ did: 'did:noesis:' + 'c'.repeat(32) });
    for (let t = 1; t <= 100; t++) await harness.tick();

    harness.pause();
    // Steady window: no ticks, no events expected. Bios values don't advance.
    await harness.simulatePause({ wallClockMs: 5000 });
    harness.resume();

    for (let t = 101; t <= 200; t++) await harness.tick();

    expect(harness.auditHash()).toBe(PHASE_6_D17_HASH);
  });
});
```

Create `grid/test/ananke/audit-size-ceiling-10b.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryHarness } from '../helpers/harness';

// Phase 10b D-10b-10: 5 drives × crossings + 2 needs × crossings + bios.birth over 1000 ticks
// Tight bound per D-10b-10: 50 (drives 10a) + 2 (energy max crossings) + 1 (sustenance max crossing) = 53
// (bios.birth + bios.death are lifecycle events, not counted in per-tick steady-state ceiling)
const PHASE_10B_CEILING = 53;

describe('Phase 10b audit size ceiling', () => {
  it('≤ ceiling events per Nous over 1000 ticks', async () => {
    const harness = createInMemoryHarness({ seed: 42 });
    await harness.spawnNous({ did: 'did:noesis:' + 'd'.repeat(32) });
    for (let t = 1; t <= 1000; t++) await harness.tick();

    expect(harness.totalEvents()).toBeLessThanOrEqual(PHASE_10B_CEILING);
  });
});
```
(If D-10b-10 in 10b-CONTEXT.md specifies a different exact bound, update `PHASE_10B_CEILING` to that value. Do NOT guess — if unsure, fail the test with the actual computed number and update CONTEXT.md to match.)

Create `grid/test/audit/closed-enum-bios-lifecycle.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInMemoryHarness } from '../helpers/harness';

describe('Closed-enum allowlist: bios lifecycle rejects non-members', () => {
  for (const fake of ['bios.resurrect', 'bios.migrate', 'bios.transfer']) {
    it(`rejects ${fake}`, async () => {
      const harness = createInMemoryHarness({ seed: 42 });
      await expect(harness.rawAppend(fake as any, { did: 'did:noesis:' + 'e'.repeat(32), tick: 1 }))
        .rejects.toThrow(/allowlist/i);
    });
  }
});
```
  </action>
  <verify>
    <automated>cd grid && bun test test/regression/pause-resume-10b.test.ts test/ananke/audit-size-ceiling-10b.test.ts test/audit/closed-enum-bios-lifecycle.test.ts --run</automated>
  </verify>
  <done>Pause/resume hash matches Phase 6 D-17. Ceiling holds. All 3 closed-enum rejection cases throw correctly.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: CI wall-clock forbidden grep-gate</name>
  <files>scripts/check-wallclock-forbidden.mjs</files>
  <read_first>
    - scripts/ (list existing CI scripts for style consistency)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-CONTEXT.md (D-10b-06 wall-clock forbidden paths)
    - .planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-PATTERNS.md (grep gate pattern)
  </read_first>
  <behavior>
    - Script greps the three D-10b-06 paths for forbidden patterns
    - Forbidden: `datetime`, `time.time`, `time.monotonic`, `Date.now`, `performance.now`
    - Exits non-zero with path + line on any match
    - Exits 0 with green "OK" line when clean
    - Runnable via `node scripts/check-wallclock-forbidden.mjs` from repo root
  </behavior>
  <action>
Create `scripts/check-wallclock-forbidden.mjs`:
```js
#!/usr/bin/env node
// Phase 10b D-10b-06: wall-clock reads forbidden in Bios/Chronos/retrieval paths.
// Exits non-zero with details on violation.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = [
  'brain/src/noesis_brain/bios',
  'brain/src/noesis_brain/chronos',
];

const FILES = [
  'brain/src/noesis_brain/memory/retrieval.py',
];

// Grid-side Bios emitters must also be wall-clock-free
const GRID_ROOTS = [
  'grid/src/bios',
];

const FORBIDDEN = [
  /\bdatetime\b/,
  /\btime\.time\b/,
  /\btime\.monotonic\b/,
  /\bDate\.now\b/,
  /\bperformance\.now\b/,
];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function scan(path) {
  const content = readFileSync(path, 'utf8');
  const violations = [];
  content.split('\n').forEach((line, i) => {
    for (const rx of FORBIDDEN) {
      if (rx.test(line)) {
        violations.push({ path, line: i + 1, text: line.trim(), pattern: String(rx) });
      }
    }
  });
  return violations;
}

const targets = [
  ...ROOTS.flatMap(r => walk(r)),
  ...GRID_ROOTS.flatMap(r => walk(r)),
  ...FILES,
];

let allViolations = [];
for (const t of targets) {
  allViolations = allViolations.concat(scan(t));
}

if (allViolations.length > 0) {
  console.error('❌ Wall-clock forbidden violations found:');
  for (const v of allViolations) {
    console.error(`  ${v.path}:${v.line} matches ${v.pattern}: ${v.text}`);
  }
  process.exit(1);
}
console.log('✅ No wall-clock reads in Bios/Chronos/retrieval paths');
```

Make it executable and integrate into CI: add to the existing CI workflow (if present) as a required step, or invoke from `package.json` scripts (`"check:wallclock": "node scripts/check-wallclock-forbidden.mjs"`). If a top-level Makefile / justfile / CI yaml exists, add the step there too — but do NOT create a new CI system if none exists; just make the script runnable and documented.
  </action>
  <verify>
    <automated>node scripts/check-wallclock-forbidden.mjs</automated>
  </verify>
  <done>Script exists, runs from repo root, exits 0 on clean tree, exits 1 with actionable message on any violation. Documented in README or PHILOSOPHY (see closeout plan 10b-08).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI pipeline | Must fail fast on determinism regressions (wall-clock, hash drift) |
| Regression baselines | Phase 6 D-17 hash must remain stable across phases |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-07-01 | Tampering | Silent drift of audit_tick vs system_tick | mitigate | 1000-tick integration assertion per tick |
| T-10b-07-02 | Repudiation | Unauthorized hash change in pause/resume | mitigate | Explicit PHASE_6_D17_HASH literal assertion |
| T-10b-07-03 | Tampering | Future PR adds datetime import to Bios path | mitigate | CI grep-gate scripts/check-wallclock-forbidden.mjs fails build |
</threat_model>

<verification>
- `cd grid && bun test test/integration/ test/regression/pause-resume-10b.test.ts test/ananke/audit-size-ceiling-10b.test.ts test/audit/closed-enum-bios-lifecycle.test.ts --run` — all GREEN
- `node scripts/check-wallclock-forbidden.mjs` — exit 0
- `cd brain && uv run pytest -q` — full brain suite GREEN
- `cd grid && bun test --run` — full grid suite GREEN
</verification>

<success_criteria>
- 1000-tick audit_tick=system_tick invariant proven in integration test
- Bios→Ananke end-to-end crossing → ananke.drive_crossed verified
- Phase 6 D-17 regression hash unchanged with Chronos listener active
- Audit size ceiling respected (bios additions don't break 10a bound)
- Closed-enum allowlist rejects bios.resurrect/migrate/transfer
- CI wall-clock grep-gate installed and passing
</success_criteria>

<output>
After completion, create `.planning/phases/10b-bios-needs-chronos-subjective-time-inner-life-part-2/10b-07-SUMMARY.md`
</output>
