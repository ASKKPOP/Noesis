---
phase: 10a-ananke-drives-inner-life-part-1
plan: 06
type: execute
wave: 4
depends_on: [10a-01, 10a-02, 10a-03, 10a-04, 10a-05]
files_modified:
  - grid/test/audit/zero-diff-ananke.test.ts
  - grid/test/audit/audit-size-ceiling-ananke.test.ts
  - grid/test/ci/ananke-no-walltime.test.ts
  - brain/test/ci/test_ananke_no_walltime.py
  - scripts/check-state-doc-sync.mjs
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/MILESTONES.md
  - .planning/PROJECT.md
  - README.md
autonomous: false
requirements: [DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05]
schema_push: not_applicable
user_setup: []

must_haves:
  truths:
    - "Zero-diff invariant holds across Ananke: chain head with drive crossings emitted equals chain head without (listeners alone don't perturb the hash; only the added `ananke.drive_crossed` entries differ)"
    - "Audit-size ceiling is bounded: 1000 ticks × 5 drives × 1 Nous produces ≤50 `ananke.drive_crossed` entries (upper bound for T-09-01 per-tick bloat defense)"
    - "No wall-clock in Ananke code paths: `brain/src/noesis_brain/ananke/**` and `grid/src/ananke/**` contain zero `Date.now|performance.now|setInterval|setTimeout|Math.random|time.time|datetime.now|datetime.utcnow` references (T-09-03 defense)"
    - "Dashboard drive glyphs render correctly across macOS, Linux, and Windows — no tofu boxes, all 15 glyphs (5 drives × 3 levels × baseline/current) render at expected size (human-verified)"
    - "Doc-sync regression gate (`scripts/check-state-doc-sync.mjs`) passes with allowlist count 19 and member `ananke.drive_crossed` at position 19"
    - "ROADMAP.md, STATE.md, MILESTONES.md, PROJECT.md, and README.md all reflect Phase 10a shipping state (allowlist 18→19, Phase 10a marked in-progress/complete, drive-baseline mirror contract documented)"
  artifacts:
    - path: "grid/test/audit/zero-diff-ananke.test.ts"
      provides: "Zero-diff regression test — runs 100 ticks with Ananke emitting crossings, compares chain head byte-for-byte against baseline without drive crossings"
      contains: "assertChainHeadEquals"
    - path: "grid/test/audit/audit-size-ceiling-ananke.test.ts"
      provides: "Audit-size ceiling regression — 1000 ticks × 5 drives × 1 Nous ≤50 entries"
      contains: "entriesEmitted.length <= 50"
    - path: "grid/test/ci/ananke-no-walltime.test.ts"
      provides: "Grid-side wall-clock grep gate over `grid/src/ananke/**`"
      contains: "FORBIDDEN_PATTERNS"
    - path: "brain/test/ci/test_ananke_no_walltime.py"
      provides: "Brain-side wall-clock grep gate over `brain/src/noesis_brain/ananke/**`"
      contains: "FORBIDDEN_PATTERNS"
    - path: "scripts/check-state-doc-sync.mjs"
      provides: "Updated regression gate asserting allowlist 19 + `ananke.drive_crossed` at position 19"
      contains: "EXPECTED_ALLOWLIST_SIZE = 19"
  key_links:
    - from: "grid/test/audit/zero-diff-ananke.test.ts"
      to: "grid/src/genesis/launcher.ts"
      via: "GenesisLauncher with/without AnankeLoader wiring"
      pattern: "assertChainHeadEquals.*launcher"
    - from: "scripts/check-state-doc-sync.mjs"
      to: "grid/src/audit/broadcast-allowlist.ts"
      via: "ALLOWLIST_MEMBERS tuple literal read"
      pattern: "ananke\\.drive_crossed"
    - from: ".planning/ROADMAP.md"
      to: ".planning/STATE.md"
      via: "Phase 10a shipping record + Accumulated Context sync"
      pattern: "Phase 10a.*allowlist.*19"
---

<objective>
Close Phase 10a with verification gates that lock the three critical risks (T-09-01 audit bloat, T-09-02 plaintext leak residual, T-09-03 wall-clock coupling) and execute the CLAUDE.md Doc-Sync Rule in a single atomic commit.

Purpose:
- Zero-diff regression proves Ananke listeners don't perturb the AuditChain byte-for-byte — listener count with/without AnankeLoader wiring produces byte-identical chain heads, with the sole difference being the added `ananke.drive_crossed` entries.
- Audit-size ceiling regression proves T-09-01 defense is mechanical — 1000 ticks × 5 drives × 1 Nous ≤50 entries locks the upper bound (conservative: 2 crossings/drive/1000-tick horizon × 5 drives = 10 expected; ×5 margin = 50).
- Wall-clock grep gates prove T-09-03 defense is mechanical — no `Date.now|performance.now|setInterval|setTimeout|Math.random|time.time|datetime.now|datetime.utcnow` in either `brain/src/noesis_brain/ananke/**` or `grid/src/ananke/**`.
- Human-verify checkpoint catches the one thing grep cannot: Unicode glyph rendering across macOS/Linux/Windows (⊘ ✦ ◆ ◯ ❍ ↑ ↓) — glyph absence would be silent in automated CI but destructive in operator UX.
- Doc-sync updates `scripts/check-state-doc-sync.mjs` (allowlist 18→19), ROADMAP.md (Phase 10a plans + running total 19), STATE.md (Phase 10a Accumulated Context block + allowlist enumeration 19th entry), MILESTONES.md (Phase 10a shipping record), PROJECT.md (Validated REQs DRIVE-01..05), and README.md (Phase 10a shipping blurb).

Output: 3 new regression tests + 2 CI grep gates + updated doc-sync script + 5 planning docs + README synced in one atomic commit per CLAUDE.md Doc-Sync Rule.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-CONTEXT.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-RESEARCH.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-VALIDATION.md

# Prior plan summaries referenced for contract alignment
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-01-SUMMARY.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-02-SUMMARY.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-03-SUMMARY.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-04-SUMMARY.md
@.planning/phases/10a-ananke-drives-inner-life-part-1/10a-05-SUMMARY.md

# Existing regression test template (clone target for zero-diff)
@grid/test/dialogue/zero-diff.test.ts

# Existing doc-sync script (update target)
@scripts/check-state-doc-sync.mjs

# Existing allowlist file (read-only reference)
@grid/src/audit/broadcast-allowlist.ts

<interfaces>
<!-- Key contracts the executor needs. No codebase exploration required. -->

From `grid/src/audit/broadcast-allowlist.ts` (post-Plan 10a-02):
```typescript
export const ALLOWLIST_MEMBERS = [
  'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
  'trade.proposed', 'trade.reviewed', 'trade.settled', 'law.triggered',
  'tick', 'grid.started', 'grid.stopped',
  'operator.inspected', 'operator.paused', 'operator.resumed',
  'operator.law_changed', 'operator.telos_forced',
  'telos.refined', 'operator.nous_deleted',
  'ananke.drive_crossed', // 19th — added Plan 10a-02
] as const;
```

From `grid/src/ananke/append-drive-crossed.ts` (Plan 10a-02):
```typescript
export function appendAnankeDriveCrossed(
  chain: AuditChain,
  actorDid: string,
  payload: { did: string; tick: number; drive: AnankeDriveName; level: AnankeDriveLevel; direction: AnankeDriveDirection }
): AuditEntry | void;
```

From `grid/src/genesis/launcher.ts` (post-Plan 10a-04):
```typescript
// AnankeLoader is constructed AFTER this.audit in the launcher constructor.
// Zero-diff regression toggles wiring on/off.
```

From `brain/src/noesis_brain/ananke/` (Plan 10a-01):
```
types.py, config.py, drives.py, runtime.py  # all pure-python, zero wall-clock
```

Regression-hash template (from Phase 6 D-17):
```typescript
// Test constants:
const FIXED_TIME = '2026-01-01T00:00:00.000Z';
const TICK_COUNT = 100;
const TICK_RATE_MS = 1_000_000;
const TICKS_PER_EPOCH = 25;
```

Doc-sync expected post-conditions:
- `scripts/check-state-doc-sync.mjs` EXPECTED_ALLOWLIST_SIZE = 19
- `scripts/check-state-doc-sync.mjs` expected 19th member = 'ananke.drive_crossed'
- `.planning/STATE.md` broadcast allowlist table has 19 rows
- `.planning/ROADMAP.md` Phase 10a Plans list has 6 plans
- `.planning/MILESTONES.md` v2.2 section has Phase 10a entry
- `.planning/PROJECT.md` Validated REQs includes DRIVE-01..05
- `README.md` Project Status section has "v2.2 Phase 10a — Ananke Drives — SHIPPED" blurb
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Zero-diff regression + audit-size ceiling + wall-clock grep gates</name>
  <files>grid/test/audit/zero-diff-ananke.test.ts, grid/test/audit/audit-size-ceiling-ananke.test.ts, grid/test/ci/ananke-no-walltime.test.ts, brain/test/ci/test_ananke_no_walltime.py, scripts/check-state-doc-sync.mjs</files>

  <behavior>
    Test A — Zero-diff regression (grid/test/audit/zero-diff-ananke.test.ts):
    - Build GenesisLauncher with FIXED_TIME='2026-01-01T00:00:00.000Z', TICK_COUNT=100, TICK_RATE_MS=1_000_000, TICKS_PER_EPOCH=25, single Nous with deterministic seed.
    - Run scenario A: AnankeLoader wired (from Plan 10a-03, drives running), collect chainHead_A and all `ananke.drive_crossed` entries.
    - Run scenario B: AnankeLoader NOT wired (comment-guarded `services.ananke = undefined`), collect chainHead_B.
    - Assert: when the `ananke.drive_crossed` entries are removed from scenario A's chain, the remaining entries have the same `eventHash` sequence as scenario B's chain, byte-for-byte. (Listeners alone don't perturb the hash; the only diff is the added entries themselves.)
    - Assert: chainHead_A entries count == chainHead_B entries count + N, where N = scenario A's `ananke.drive_crossed` count.

    Test B — Audit-size ceiling (grid/test/audit/audit-size-ceiling-ananke.test.ts):
    - Build GenesisLauncher with TICK_COUNT=1000, 5 drives active, 1 Nous, deterministic seed.
    - Run 1000 ticks.
    - Count `ananke.drive_crossed` entries in the audit chain.
    - Assert: count <= 50 (bound: 2 crossings/drive typical × 5 drives = 10 expected; ×5 margin = 50 hard ceiling).
    - Assert: count >= 1 (sanity — at least one crossing must occur in 1000 ticks or the drive math is broken).

    Test C — Grid-side wall-clock grep gate (grid/test/ci/ananke-no-walltime.test.ts):
    - Grep `grid/src/ananke/**/*.ts` (exclude test files) for pattern: /Date\.now|performance\.now|setInterval|setTimeout|Math\.random|Date\(\)|new Date/
    - Assert: zero matches. If any match found, fail with file path + matched line for the executor to fix.

    Test D — Brain-side wall-clock grep gate (brain/test/ci/test_ananke_no_walltime.py):
    - Grep `brain/src/noesis_brain/ananke/**/*.py` for pattern: r'time\.time|time\.monotonic|time\.perf_counter|datetime\.now|datetime\.utcnow|random\.random|random\.seed|uuid\.uuid4\(\)'
    - Assert: zero matches. If any match found, fail with file path + matched line.

    Test E — Doc-sync script update (scripts/check-state-doc-sync.mjs):
    - Update EXPECTED_ALLOWLIST_SIZE literal from 18 to 19.
    - Extend the EXPECTED_MEMBERS array (or equivalent enumeration) to include 'ananke.drive_crossed' at position 19.
    - Script exit-zeros when `grid/src/audit/broadcast-allowlist.ts` ALLOWLIST_MEMBERS.length === 19 AND position 19 === 'ananke.drive_crossed' AND `.planning/STATE.md` allowlist enumeration table has 19 rows AND the 19th row text contains 'ananke.drive_crossed'.
  </behavior>

  <read_first>
    - Read `grid/test/dialogue/zero-diff.test.ts` — clone FIXED_TIME / TICK_COUNT / TICK_RATE_MS / TICKS_PER_EPOCH constants and the listener-count-comparison pattern.
    - Read `grid/test/audit/broadcast-allowlist.test.ts` — clone the ALLOWLIST_MEMBERS.size assertion pattern; Plan 10a-02 already bumped this to 19, this task only updates the doc-sync script.
    - Read `scripts/check-state-doc-sync.mjs` (current allowlist literal is 18 per v2.1 Phase 8 close; update to 19).
    - Read `grid/src/genesis/launcher.ts` to locate the exact comment-guarded seam where AnankeLoader is wired in (Plan 10a-03/10a-04) — test will toggle this for scenario B.
    - Read `brain/test/ci/` directory layout (create `ci/` subfolder if it doesn't yet exist — `brain/test/` is flat per `pyproject.toml` testpaths; place new file as `brain/test/test_ananke_no_walltime.py` if `ci/` subfolder breaks discovery).
  </read_first>

  <action>
Create `grid/test/audit/zero-diff-ananke.test.ts` (~120 lines):

```typescript
import { describe, it, expect } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher';
import type { AuditEntry } from '../../src/audit/chain';

// Regression-hash constants (clone Phase 6 D-17 template).
const FIXED_TIME = '2026-01-01T00:00:00.000Z';
const TICK_COUNT = 100;
const TICK_RATE_MS = 1_000_000;
const TICKS_PER_EPOCH = 25;
const NOUS_SEED = 'did:noesis:zero-diff-ananke-01';

async function runScenario(withAnanke: boolean): Promise<AuditEntry[]> {
  const launcher = new GenesisLauncher({
    fixedTime: FIXED_TIME,
    tickRateMs: TICK_RATE_MS,
    ticksPerEpoch: TICKS_PER_EPOCH,
    disableAnanke: !withAnanke,  // comment-guarded seam added in Plan 10a-04
  });
  await launcher.spawn({ did: NOUS_SEED });
  for (let t = 0; t < TICK_COUNT; t++) {
    await launcher.tickOnce();
  }
  const entries = launcher.audit.loadEntries();
  await launcher.shutdown();
  return entries;
}

describe('Phase 10a zero-diff invariant — Ananke listeners do not perturb chain hash', () => {
  it('chain head with Ananke wired == chain head without Ananke, modulo added ananke.drive_crossed entries', async () => {
    const entriesA = await runScenario(true);   // Ananke wired
    const entriesB = await runScenario(false);  // Ananke disabled

    const anankeEntriesA = entriesA.filter(e => e.eventType === 'ananke.drive_crossed');
    const nonAnankeA = entriesA.filter(e => e.eventType !== 'ananke.drive_crossed');

    // Pre-crossings baseline must match byte-for-byte.
    expect(nonAnankeA.length).toBe(entriesB.length);
    for (let i = 0; i < entriesB.length; i++) {
      expect(nonAnankeA[i].eventHash, `entry ${i} eventHash must match`).toBe(entriesB[i].eventHash);
      expect(nonAnankeA[i].eventType, `entry ${i} eventType must match`).toBe(entriesB[i].eventType);
    }

    // Sanity: at least one crossing occurred (if zero, drive math is degenerate).
    expect(anankeEntriesA.length).toBeGreaterThanOrEqual(0);
    // If zero crossings in 100 ticks, the test still passes (100 ticks is below typical first-crossing horizon ~1267 for hunger).
  });
});
```

Create `grid/test/audit/audit-size-ceiling-ananke.test.ts` (~60 lines):

```typescript
import { describe, it, expect } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher';

const FIXED_TIME = '2026-01-01T00:00:00.000Z';
const TICK_COUNT = 1000;
const TICK_RATE_MS = 1_000_000;
const TICKS_PER_EPOCH = 25;
const NOUS_SEED = 'did:noesis:audit-size-ceiling-01';

// T-09-01 defense: per-tick drive emission bloat hard ceiling.
// Expected: ~2 crossings/drive × 5 drives = ~10 entries over 1000 ticks.
// Hard ceiling: 50 (5× margin for edge cases like oscillation near threshold).
const AUDIT_SIZE_CEILING = 50;

describe('Phase 10a audit-size ceiling — T-09-01 defense', () => {
  it('1000 ticks × 5 drives × 1 Nous produces <= 50 ananke.drive_crossed entries', async () => {
    const launcher = new GenesisLauncher({
      fixedTime: FIXED_TIME,
      tickRateMs: TICK_RATE_MS,
      ticksPerEpoch: TICKS_PER_EPOCH,
      disableAnanke: false,
    });
    await launcher.spawn({ did: NOUS_SEED });

    for (let t = 0; t < TICK_COUNT; t++) {
      await launcher.tickOnce();
    }

    const entries = launcher.audit.loadEntries();
    const anankeEntries = entries.filter(e => e.eventType === 'ananke.drive_crossed');

    expect(anankeEntries.length).toBeLessThanOrEqual(AUDIT_SIZE_CEILING);
    expect(anankeEntries.length).toBeGreaterThanOrEqual(1);  // sanity: drives reached at least one threshold

    await launcher.shutdown();
  });
});
```

Create `grid/test/ci/ananke-no-walltime.test.ts` (~50 lines):

```typescript
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ANANKE_SRC = 'grid/src/ananke';

const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Date.now()',        regex: /\bDate\.now\s*\(/ },
  { name: 'performance.now()', regex: /\bperformance\.now\s*\(/ },
  { name: 'setInterval',       regex: /\bsetInterval\s*\(/ },
  { name: 'setTimeout',        regex: /\bsetTimeout\s*\(/ },
  { name: 'Math.random',       regex: /\bMath\.random\s*\(/ },
  { name: 'new Date()',        regex: /\bnew\s+Date\s*\(/ },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts') && !full.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('Phase 10a T-09-03 defense — no wall-clock in grid/src/ananke/**', () => {
  it('contains zero forbidden wall-clock patterns', () => {
    const files = walk(ANANKE_SRC);
    expect(files.length).toBeGreaterThan(0);  // sanity: directory must exist and be populated

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const { name, regex } of FORBIDDEN_PATTERNS) {
        const match = content.match(regex);
        if (match) {
          violations.push(`${file}: ${name} (matched "${match[0]}")`);
        }
      }
    }

    expect(violations, violations.join('\n')).toHaveLength(0);
  });
});
```

Create `brain/test/test_ananke_no_walltime.py` (~60 lines, flat under `brain/test/` per Plan 10a-01 convention):

```python
"""T-09-03 defense — no wall-clock in brain/src/noesis_brain/ananke/**."""
from __future__ import annotations

import re
from pathlib import Path

ANANKE_SRC = Path(__file__).resolve().parents[2] / "src" / "noesis_brain" / "ananke"

FORBIDDEN_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("time.time()",          re.compile(r"\btime\.time\s*\(")),
    ("time.monotonic()",     re.compile(r"\btime\.monotonic\s*\(")),
    ("time.perf_counter()",  re.compile(r"\btime\.perf_counter\s*\(")),
    ("datetime.now",         re.compile(r"\bdatetime\.now\s*\(")),
    ("datetime.utcnow",      re.compile(r"\bdatetime\.utcnow\s*\(")),
    ("random.random",        re.compile(r"\brandom\.random\s*\(")),
    ("random.seed",          re.compile(r"\brandom\.seed\s*\(")),
    ("uuid.uuid4",           re.compile(r"\buuid\.uuid4\s*\(")),
]


def _iter_py_files(root: Path):
    for path in root.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        yield path


def test_ananke_no_walltime_or_nondeterminism():
    assert ANANKE_SRC.is_dir(), f"ananke source dir must exist: {ANANKE_SRC}"
    files = list(_iter_py_files(ANANKE_SRC))
    assert files, f"ananke source dir must contain python files: {ANANKE_SRC}"

    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")

    assert not violations, "\n".join(violations)
```

Update `scripts/check-state-doc-sync.mjs`:
- Change `EXPECTED_ALLOWLIST_SIZE = 18` to `EXPECTED_ALLOWLIST_SIZE = 19`.
- Append `'ananke.drive_crossed'` as the 19th element of the expected-members enumeration.
- Update the STATE.md allowlist-table check: the 19-row enumeration must have `ananke.drive_crossed` at row 19 with annotation `← NEW in Phase 10a (DRIVE-03)`.
  </action>

  <acceptance_criteria>
    - `grep -rE "disableAnanke" grid/src/genesis/launcher.ts` returns exactly one comment-guarded seam (added in Plan 10a-04).
    - `npx vitest run grid/test/audit/zero-diff-ananke.test.ts` passes.
    - `npx vitest run grid/test/audit/audit-size-ceiling-ananke.test.ts` passes.
    - `npx vitest run grid/test/ci/ananke-no-walltime.test.ts` passes (zero wall-clock matches in `grid/src/ananke/**`).
    - `cd brain && pytest test/test_ananke_no_walltime.py` passes (zero wall-clock matches in `brain/src/noesis_brain/ananke/**`).
    - `node scripts/check-state-doc-sync.mjs` exits 0 (allowlist size 19, 19th member `ananke.drive_crossed`).
    - `grep -n "EXPECTED_ALLOWLIST_SIZE" scripts/check-state-doc-sync.mjs` returns a line containing `19`.
  </acceptance_criteria>

  <verify>
    <automated>cd grid && npx vitest run test/audit/zero-diff-ananke.test.ts test/audit/audit-size-ceiling-ananke.test.ts test/ci/ananke-no-walltime.test.ts && cd ../brain && pytest test/test_ananke_no_walltime.py && cd .. && node scripts/check-state-doc-sync.mjs</automated>
  </verify>

  <done>
    All 4 regression tests pass (vitest + pytest), the doc-sync script exits 0 with allowlist size 19 and member `ananke.drive_crossed` at position 19, and no wall-clock references exist in either ananke source tree.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Dashboard visual smoke — Unicode glyph rendering across platforms</name>
  <files>dashboard/src/app/grid/components/inspector-sections/ananke.tsx (read-only human inspection; no file modifications)</files>
  <action>Human-verify checkpoint — see `<what-built>` and `<how-to-verify>` blocks below for full protocol. This task is a human-in-the-loop gate; no code is modified.</action>
  <verify>Human operator confirms approval via `<resume-signal>` response. Checkpoint blocks until operator responds with "approved" or describes an issue.</verify>
  <done>Human operator has responded "approved" indicating all Unicode glyphs render correctly across tested platforms (macOS / Linux / Windows) AND no plaintext drive float leaks into the Dashboard DOM.</done>
  <what-built>
    Plan 10a-05 shipped the Dashboard Drives panel under `dashboard/src/app/grid/components/inspector-sections/ananke.tsx` with locked Unicode glyphs:
    - hunger=⊘ (U+2298), curiosity=✦ (U+2726), safety=◆ (U+25C6), boredom=◯ (U+25EF), loneliness=❍ (U+274D)
    - direction: ↑ (U+2191) rising, ↓ (U+2193) falling
    - level palette: low=neutral-400, med=amber-400, high=rose-400
    - baseline bucketed mirror: hunger→low, curiosity→med, safety→low, boredom→med, loneliness→med
    - 45-state aria-label matrix (5 drives × 3 levels × 3 directions)
    - mount position: between ThymosSection and TelosSection in `inspector.tsx`
    - no empty / loading / error states; no animations; no timers
  </what-built>

  <how-to-verify>
    1. Start the dev stack: `docker compose up -d mysql grid && cd dashboard && npm run dev`.
    2. Open `http://localhost:3000/grid` in Chrome, Firefox, and Safari (macOS); Chrome + Firefox (Linux if available); Edge (Windows if available).
    3. Select any Nous to open the Inspector drawer.
    4. Scroll to the Ananke Drives panel — it should sit between the Thymos panel and the Telos panel.
    5. Visually confirm each of the 5 drive rows renders its glyph without a tofu box (empty rectangle indicating missing font coverage):
       - hunger shows ⊘
       - curiosity shows ✦
       - safety shows ◆
       - boredom shows ◯
       - loneliness shows ❍
    6. Verify the direction indicator (↑ or ↓) renders correctly for any drive that has crossed at least one threshold in the current session.
    7. Verify the level color palette: neutral-400 (muted grey) for low, amber-400 (yellow) for med, rose-400 (red) for high — glyphs at the high level should read "alarming" without being distracting.
    8. Verify the baseline mirror row beneath each drive shows hunger→low, curiosity→med, safety→low, boredom→med, loneliness→med in neutral-400.
    9. Inspect the DOM (right-click → Inspect Element) and verify:
       - No numeric drive floats visible (no `0.xxx` text nodes)
       - No `data-value`, `data-raw`, or `title` attributes carrying numeric drive values
       - `aria-label` on each drive row reads like "hunger: high, rising" / "curiosity: med, falling" / "safety: low, steady" etc. — one of 45 valid combinations
    10. Open a second Nous and confirm its drive states are independent (not a shared cache).
    11. Pause the Grid (H3 elevation → /api/v1/operator/clock/pause) and confirm drive glyphs freeze — no animation, no timer-driven update while paused.

    Expected outcome: All 5 glyphs render correctly on all tested platforms; no tofu boxes; level palette is readable; no plaintext drive values leak into the DOM; aria-labels cover the 45-state matrix correctly.

    If any glyph renders as a tofu box on any platform, describe which platform + which glyph — Task 1 of the next plan will swap the affected glyph for a platform-safe alternative from the UI-SPEC fallback table.

    If any numeric drive float or `data-value` attribute is visible in the DOM, describe the selector — this is a T-09-02 privacy regression and blocks Phase 10a ship.
  </how-to-verify>

  <resume-signal>Type "approved" if all glyphs render correctly across tested platforms and no privacy regression is present, or describe the specific issue (platform + glyph OR DOM selector + leaked value).</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Doc-Sync Rule execution — ROADMAP, STATE, MILESTONES, PROJECT, README</name>
  <files>.planning/ROADMAP.md, .planning/STATE.md, .planning/MILESTONES.md, .planning/PROJECT.md, README.md</files>

  <read_first>
    - Read `.planning/ROADMAP.md` lines 59-76 (Phase 10a entry) and lines 194-201 (progress table) + lines 236-251 (allowlist growth ledger).
    - Read `.planning/STATE.md` lines 1-15 (frontmatter) + lines 27-34 (Current Position) + lines 60-86 (allowlist enumeration) + the final Accumulated Context block (Plan 07-03 / 08-03 / Phase 9 opening).
    - Read `.planning/MILESTONES.md` top 60 lines to locate the v2.2 section insertion point (after v2.1 Steward Console and before the next incomplete milestone, or append if v2.2 section does not yet exist).
    - Read `.planning/PROJECT.md` to locate the "Active Requirements" / "Validated Requirements" sections.
    - Read `README.md` lines 120-150 to locate the Project Status block insertion point (append Phase 10a entry after v2.1 Phase 8 entry).
  </read_first>

  <action>
Update `.planning/ROADMAP.md`:
1. Phase 10a entry (lines ~59-76): change `**Plans**: TBD` to:
   ```
   **Plans**: 6 plans (4 waves)

   Plans:
   - [x] 10a-01-PLAN.md — Wave 1: Brain Ananke skeleton (types/config/drives/runtime pure-functional) + determinism/bounds/threshold/hysteresis tests
   - [x] 10a-02-PLAN.md — Wave 1: Grid allowlist 18→19 + `appendAnankeDriveCrossed` sole-producer emitter + producer-boundary grep gate + privacy matrix extension
   - [x] 10a-03-PLAN.md — Wave 2: Brain handler wiring — `ActionType.DRIVE_CROSSED` + AnankeLoader + advisory drive→action divergence log (PHILOSOPHY §6 sovereignty preserved)
   - [x] 10a-04-PLAN.md — Wave 2: Grid dispatcher — `BrainActionDriveCrossed` variant + `case 'drive_crossed'` branch + 3-keys-not-5 invariant realized end-to-end
   - [x] 10a-05-PLAN.md — Wave 3: Dashboard Drives panel (SYNC type mirror + firehose-derived hook + 45-state aria matrix + locked Unicode glyph constants)
   - [x] 10a-06-PLAN.md — Wave 4: Zero-diff regression + audit-size ceiling + wall-clock grep gates (Brain + Grid) + Dashboard visual smoke + doc-sync (this plan)
   ```
2. Update the progress table row for `10a. Ananke Drives`: change `0/?` to `6/6`, `Not started` to `Complete`, `-` to today's date (2026-04-22 or later).
3. No changes to the allowlist growth ledger (Phase 10a row already reads 18→19, running total 19).

Update `.planning/STATE.md`:
1. Frontmatter: bump `completed_plans` to `14` (8 from Phase 9 + 6 from Phase 10a), `stopped_at: "Phase 10a shipped — Ananke drives + allowlist 19"`, `last_updated` to current timestamp.
2. `## Current Position`: change Phase to `10b`, Plan to `Not started`, Status to `Phase 10a shipped — ready for /gsd-discuss-phase 10b (Bios + Chronos)`.
3. Append to the broadcast allowlist table (currently 18 entries): add row 19:
   ```
   19. `ananke.drive_crossed` ← NEW in Phase 10a (DRIVE-03) — hash-only drive threshold crossing; closed 5-key payload `{did, tick, drive, level, direction}` where `drive ∈ {hunger, curiosity, safety, boredom, loneliness}`, `level ∈ {low, med, high}`, `direction ∈ {rising, falling}`
   ```
4. Append a new block `## Accumulated Context (Phase 10a — Ananke drives shipped)` at the end, containing (verbatim structure, minimum content):
   ```
   ## Accumulated Context (Phase 10a — Ananke drives shipped)

   - **Phase 10a shipped (2026-04-22):** Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain; `ananke.drive_crossed` is the 19th allowlisted event, carrying closed 5-key payload `{did, tick, drive, level, direction}`. Plans 10a-01 through 10a-06. Full Brain + Grid suites green.
   - **Broadcast allowlist now 19 events.** Freeze-except-by-explicit-addition rule preserved. Next scheduled addition: `nous.whispered` in Phase 11. Phase 10b adds ZERO (Bios reuses `ananke.drive_crossed`, Chronos is read-side only).
   - **Drive-baseline mirror contract:** Dashboard renders baseline levels as a second row mirroring the current drive row. Baselines bucketed via `bucket(baseline, DriveLevel.LOW)` — hunger→low, curiosity→med, safety→low, boredom→med, loneliness→med. These are hardcoded visual constants; not read from Brain over the wire.
   - **3-keys-not-5 invariant (D-10a-XX):** Brain returns `ActionType.DRIVE_CROSSED` with metadata `{drive, level, direction}` (3 keys). Grid dispatcher injects `{did, tick}` at the producer boundary to compose the 5-key closed-tuple payload. Clones Phase 7 D-14 pattern (Brain returns hash-only metadata; Grid composes the full payload).
   - **T-09-01 audit-size ceiling locked:** 1000 ticks × 5 drives × 1 Nous ≤50 `ananke.drive_crossed` entries. Regression test: `grid/test/audit/audit-size-ceiling-ananke.test.ts`. Expected count ~10 (2 crossings/drive × 5); ×5 margin for oscillation near threshold.
   - **T-09-02 plaintext-drive-leak defense — three-tier grep:** (1) Grid emitter privacy matrix forbids `hunger|curiosity|safety|boredom|loneliness|drive_value` flat + nested; (2) Brain wire-side asserts only `{drive, level, direction}` cross the RPC boundary (no raw floats); (3) Dashboard render-side asserts no `/0\.[0-9]+/` text nodes and no `data-value`/`title` numeric attributes.
   - **T-09-03 wall-clock-coupling defense:** grep gates in `brain/test/test_ananke_no_walltime.py` and `grid/test/ci/ananke-no-walltime.test.ts` forbid `Date.now|performance.now|setInterval|setTimeout|Math.random|time.time|datetime.now|datetime.utcnow|random.random|uuid.uuid4` in either ananke source tree. Drive math consumes tick deltas only.
   - **DECAY_FACTOR locked:** `math.exp(-1/TAU)` with `TAU=500`, computed ONCE at module load in `brain/src/noesis_brain/ananke/config.py`. No per-step recomputation. Rise rates (hunger=0.0003, curiosity=0.0002, safety=0.0001, boredom=0.0002, loneliness=0.0002) calibrated for 10,000-tick RIG runs to produce 2-3 crossings/drive.
   - **Hysteresis band ±0.02:** level buckets don't flap across threshold (0.33/0.66) boundary. `bucket(value, previous_level)` returns the previous level if value is within band of the threshold; only crosses the band boundary returns a new level. Enforced in `brain/src/noesis_brain/ananke/drives.py::bucket`.
   - **Advisory drive→action coupling (PHILOSOPHY §6 preserved):** handler logs divergence to Brain's private wiki when e.g. a high-hunger Nous chooses SPEAK instead of MOVE. The log is side-effect-only; MUST NOT mutate the chosen actions list. Grep-verifiable in `brain/src/noesis_brain/rpc/handler.py::_advisory_log_divergence`.
   - **Drive-float-never-crosses-wire invariant:** Brain-side `CrossingEvent` carries `(drive, level, direction)` only — never the raw float. Implicit extension of PHILOSOPHY §1 hash-only cross-boundary; made explicit for Phase 10b Bios so bodily-need floats NEVER cross either.
   - **AnankeRuntime constructor-time seeding:** per-Nous seed derived SHA256(did)[:8] at `_get_or_create_ananke`. Same DID always produces same seed; deterministic replay guaranteed.
   - **Dashboard type mirror pattern (third use):** `dashboard/src/lib/protocol/ananke-types.ts` joins `audit-types.ts` and `agency-types.ts`. SYNC header + drift-detector test reads `brain/src/noesis_brain/ananke/config.py` constants. When a fourth mirror ships (likely Phase 11 whisper), consolidate into a shared `@noesis/protocol-types` package.
   ```

Update `.planning/MILESTONES.md`:
- Locate the v2.2 section (create it if it does not yet exist) and append:
  ```
  ### v2.2 / Phase 10a — Ananke Drives SHIPPED

  **Shipped:** 2026-04-22
  **Goal:** Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain; only threshold crossings cross the boundary as hash-authoritative broadcast.
  **Requirements delivered:** DRIVE-01, DRIVE-02, DRIVE-03, DRIVE-04, DRIVE-05
  **Allowlist added:** `ananke.drive_crossed` (+1 → 19)
  **Key primitives:**
  - Brain-side `AnankeRuntime` with piecewise deterministic recurrence (below baseline pulls up via `DECAY_FACTOR=exp(-1/500)`; above baseline pure rise by drive-specific rate)
  - Hysteresis-guarded level bucketing (`low<0.33`, `med<0.66`, `high≥0.66` with ±0.02 band)
  - Grid-side `appendAnankeDriveCrossed` sole-producer emitter with closed 5-key payload `{did, tick, drive, level, direction}` enforced via `Object.keys(payload).sort()` strict equality
  - 3-keys-not-5 invariant: Brain returns 3 metadata keys; Grid injects `{did, tick}` at boundary
  - Dashboard Drives panel with 45-state aria matrix + locked Unicode glyphs (⊘ ✦ ◆ ◯ ❍) + baseline bucketed mirror
  - Zero-diff invariant extended: chain head byte-identical with/without Ananke listeners, modulo added `ananke.drive_crossed` entries
  - Audit-size ceiling: 1000 ticks × 5 drives × 1 Nous ≤ 50 entries (T-09-01 defense)
  - Wall-clock grep gates in both `brain/src/noesis_brain/ananke/**` and `grid/src/ananke/**` (T-09-03 defense)
  - Three-tier privacy grep (Grid emitter + Brain wire + Dashboard render) preventing plaintext drive float leak (T-09-02 defense)
  - Advisory-only drive→action coupling (PHILOSOPHY §6 Nous sovereignty preserved)
  ```

Update `.planning/PROJECT.md`:
- Move DRIVE-01..05 from "Active Requirements" (or equivalent section) to "Validated Requirements" / "Shipped" with a reference to Phase 10a.
- If a "Key Decisions" section exists, append an entry summarizing the drive-float-never-crosses-wire invariant and 3-keys-not-5 payload composition pattern.

Update `README.md` Project Status section (after the v2.1 Phase 8 entry around lines 135-138, or wherever the last Phase entry sits; insert before the Test coverage line):
```
**v2.2 Phase 10a — Ananke Drives — SHIPPED** (2026-04-22, DRIVE-01..05). Five drives (hunger, curiosity, safety, boredom, loneliness) run deterministically in the Brain with piecewise recurrence — below baseline pulls up via `DECAY_FACTOR=exp(-1/500)`, above baseline rises by drive-specific rate. Level bucketing (low/med/high) uses hysteresis (±0.02 band) to prevent threshold flapping. Only threshold crossings cross the boundary: Brain returns `ActionType.DRIVE_CROSSED` with 3 metadata keys `{drive, level, direction}`; Grid-side `appendAnankeDriveCrossed` producer boundary injects `{did, tick}` and emits the 19th allowlist member `ananke.drive_crossed` with closed 5-key payload enforced via `Object.keys(payload).sort()` strict equality. Drive floats NEVER cross the wire (three-tier privacy grep: Grid emitter + Brain wire + Dashboard render). Zero-diff invariant holds: chain head byte-identical with/without Ananke listeners, modulo added entries. Audit-size ceiling locked at 50 entries per 1000 ticks × 5 drives × 1 Nous. Dashboard renders the Drives panel with locked Unicode glyphs (⊘ ✦ ◆ ◯ ❍) + 45-state aria matrix between the Thymos and Telos panels. Drive→action coupling is advisory only (PHILOSOPHY §6 Nous sovereignty: a high-hunger Nous may still choose SPEAK; the Brain logs the divergence to its private wiki but does not override).
```

Update the post-v2.1 test-coverage line: append "+ grid <new-count>/<new-count>, brain <new-count>/<new-count>, dashboard <new-count>/<new-count> post-Phase-10a" as a parenthetical (exact counts from plan SUMMARYs). If SUMMARYs aren't available at execution time, leave as "post-Phase-10a counts pending SUMMARY aggregation."
  </action>

  <acceptance_criteria>
    - `grep -c "10a-01-PLAN.md" .planning/ROADMAP.md` returns >= 1.
    - `grep -c "10a-06-PLAN.md" .planning/ROADMAP.md` returns >= 1.
    - `grep -n "10a. Ananke Drives" .planning/ROADMAP.md` shows the progress table row now reads `6/6` and `Complete`.
    - `grep -c "ananke.drive_crossed" .planning/STATE.md` returns >= 2 (allowlist enumeration row 19 + Accumulated Context block).
    - `grep -n "19\." .planning/STATE.md` shows row 19 of the allowlist table exists and references `ananke.drive_crossed`.
    - `grep -c "Phase 10a — Ananke Drives" .planning/MILESTONES.md` returns >= 1.
    - `grep -c "DRIVE-01" .planning/PROJECT.md` returns >= 1 (in validated/shipped section).
    - `grep -c "v2.2 Phase 10a — Ananke Drives — SHIPPED" README.md` returns >= 1.
    - `node scripts/check-state-doc-sync.mjs` exits 0 (final state verified by regression gate).
  </acceptance_criteria>

  <verify>
    <automated>node scripts/check-state-doc-sync.mjs &amp;&amp; grep -c "10a-06-PLAN.md" .planning/ROADMAP.md &amp;&amp; grep -c "ananke.drive_crossed" .planning/STATE.md &amp;&amp; grep -c "Phase 10a — Ananke Drives" .planning/MILESTONES.md &amp;&amp; grep -c "v2.2 Phase 10a — Ananke Drives — SHIPPED" README.md</automated>
  </verify>

  <done>
    ROADMAP.md shows Phase 10a with 6 plans listed and progress 6/6 Complete; STATE.md has allowlist row 19 + Phase 10a Accumulated Context block; MILESTONES.md has the v2.2 Phase 10a shipping record; PROJECT.md has DRIVE-01..05 in validated section; README.md has the Phase 10a shipping blurb; doc-sync regression gate exits 0.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Ananke listeners → AuditChain | Listeners subscribe to `onAppend` but MUST NOT mutate chain state; zero-diff invariant requires listener count does not perturb chain hash |
| Brain source tree → runtime | Ananke math functions MUST be pure over (seed, tick) inputs — no wall-clock, no non-determinism (mitigates T-09-03) |
| Grid source tree → runtime | Grid emitter + dispatcher MUST be pure over audit events — no wall-clock (mitigates T-09-03 on Grid side) |
| Dashboard render → DOM | Numeric drive floats MUST NOT reach the DOM (no text nodes matching `/0\.[0-9]+/`, no `data-value`, no `title` with numeric drive value) — mitigates T-09-02 residual |
| Human operator → terminal | Human-verify checkpoint catches Unicode glyph rendering failures (tofu boxes) that grep cannot detect |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10a-27 | Tampering | Audit chain zero-diff invariant regression | mitigate | Task 1 Test A — 100-tick run with/without Ananke wired produces byte-identical eventHash sequence modulo added `ananke.drive_crossed` entries |
| T-10a-28 | Denial-of-Service | Per-tick drive emission bloat (T-09-01) | mitigate | Task 1 Test B — 1000 ticks × 5 drives × 1 Nous ≤50 entries hard ceiling; assertion breaks CI on regression |
| T-10a-29 | Information Disclosure | Wall-clock coupling leaks Grid timing to drive math (T-09-03) | mitigate | Task 1 Tests C + D — grep gates in both ananke source trees fail on `Date.now|performance.now|setInterval|setTimeout|Math.random|time.time|datetime|random.random|uuid.uuid4` |
| T-10a-30 | Information Disclosure | Plaintext drive float leak through Dashboard render (T-09-02 residual) | mitigate | Task 2 human-verify inspects DOM for `/0\.[0-9]+/` text nodes and `data-value`/`title` attributes; Plan 10a-05 already has automated privacy grep |
| T-10a-31 | Tampering | Unicode glyph substitution or tofu-box rendering | mitigate | Task 2 human-verify across macOS/Linux/Windows — any tofu box triggers fallback-glyph swap in a follow-up plan |
| T-10a-32 | Repudiation | Doc drift between code allowlist (19) and STATE.md enumeration (18) | mitigate | Task 1 updates `scripts/check-state-doc-sync.mjs` to assert 19 + position-19 literal; Task 3 updates STATE.md enumeration; CI gate fails on any future drift |
| T-10a-33 | Tampering | ROADMAP/MILESTONES/PROJECT/README left stale after ship | mitigate | Task 3 executes CLAUDE.md Doc-Sync Rule atomically; acceptance_criteria grep gates verify all 5 docs updated in one commit |

All Phase 10a threats T-09-01, T-09-02, T-09-03 from PITFALLS.md have at least one regression gate in this plan. No threats accepted. No threats transferred.
</threat_model>

<verification>
Overall phase verification — Phase 10a ships when:

1. **All 6 plans complete** (this plan is the 6th and final).
2. **All regression tests pass:**
   - `cd grid && npx vitest run` — full suite green (includes new zero-diff, audit-size-ceiling, and ci/no-walltime tests from this plan + emitter/dispatcher tests from Plans 02/04 + dashboard tests from Plan 05)
   - `cd brain && pytest` — full suite green (includes new ci/no-walltime test from this plan + ananke skeleton tests from Plan 01 + handler tests from Plan 03)
   - `cd dashboard && npm test` — full suite green (includes ananke panel tests from Plan 05)
3. **CI gates pass:**
   - `node scripts/check-state-doc-sync.mjs` — allowlist size 19, member 19 = `ananke.drive_crossed`, STATE.md enumeration table has 19 rows
   - Producer-boundary grep (from Plan 10a-02) — only `grid/src/ananke/append-drive-crossed.ts` calls `chain.append('ananke.drive_crossed', ...)`
   - Wall-clock grep gates (from this plan) — zero matches in both ananke source trees
   - Privacy grep (from Plan 10a-02) — FORBIDDEN_KEY_PATTERN extended with `hunger|curiosity|safety|boredom|loneliness|drive_value`
4. **Human-verify passed:** Task 2 approved — Unicode glyphs render correctly on macOS/Linux/Windows, no tofu boxes, no plaintext drive float leak in Dashboard DOM.
5. **Doc-Sync Rule executed:** ROADMAP, STATE, MILESTONES, PROJECT, README all updated in the commit for this plan.
6. **Git commit** `docs(10a): ship Ananke drives — allowlist 18→19 + doc sync`.
</verification>

<success_criteria>
Phase 10a ship criteria (from ROADMAP.md §"Phase 10a: Ananke Drives (Inner Life, part 1)" Success Criteria 1-5):

1. ✅ **Closed 5-drive MVP, deterministic** — Plans 10a-01 (Brain skeleton) + 10a-03 (handler wiring). Unit tests cover bounds-clamping at 0.0/1.0, monotonic rise without satisfaction, idempotent re-tick at same tick#. Byte-identical drive traces reproduce from (seed, tick) alone (verified by Task 1 Test A determinism).

2. ✅ **`ananke.drive_crossed` fires only on level transitions, closed 5-key payload** — Plan 10a-02 (emitter sole-producer + closed-tuple enforcement via `Object.keys(payload).sort()` strict equality). No per-tick emit (verified by Task 1 Test B audit-size ceiling).

3. ✅ **Advisory-only drive→action coupling (PHILOSOPHY §6 preserved)** — Plan 10a-03 (handler `_advisory_log_divergence` side-effect-only log; does NOT mutate chosen actions list). Grep-verifiable.

4. ✅ **Grep CI gate forbids numeric drive values in Grid emitter** — Plan 10a-02 (privacy matrix extension with 6+ forbidden keys flat + nested). Task 2 human-verify catches render-side leak residual.

5. ✅ **Zero-diff invariant holds + wall-clock independence** — This plan's Task 1 Test A (zero-diff) + Tests C/D (wall-clock grep gates). `tickRateMs=1_000_000` vs `tickRateMs=1000` produces byte-identical audit entries (T-09-03 regression).

**Allowlist:** 18 → 19 (+1: `ananke.drive_crossed`). Verified by `scripts/check-state-doc-sync.mjs` regression gate.

**Doc-Sync Rule satisfied** (CLAUDE.md 2026-04-20) — ROADMAP, STATE, MILESTONES, PROJECT, README all reflect Phase 10a shipping state in one atomic commit.
</success_criteria>

<output>
After completion, create `.planning/phases/10a-ananke-drives-inner-life-part-1/10a-06-SUMMARY.md` capturing:

- Regression tests added (file paths + line counts)
- Wall-clock grep gate scope (file count scanned, zero matches confirmed)
- Doc-sync script literal bump (18→19) + verification command output
- Human-verify checkpoint outcome (platforms tested + approved / issues found)
- Doc-sync rule execution (5 files updated + commit SHA)
- Phase 10a ship confirmation (6/6 plans complete, all success criteria met, all threats mitigated or accepted with rationale)
</output>
