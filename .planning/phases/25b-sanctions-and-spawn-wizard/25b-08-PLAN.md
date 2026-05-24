---
phase: 25b-sanctions-and-spawn-wizard
plan: 08
type: execute
wave: 1
# wave = earliest-possible execution wave; depends_on enforces actual ordering within wave.
depends_on: [25b-07]
files_modified:
  - scripts/check-operator-sanctions-plaintext.mjs
  - grid/test/audit/operator-muted-producer-boundary.test.ts
  - grid/test/audit/operator-slashed-producer-boundary.test.ts
  - grid/test/audit/operator-quarantined-producer-boundary.test.ts
  - grid/test/audit/operator-forced-sleep-producer-boundary.test.ts
  - grid/test/audit/operator-human-banned-producer-boundary.test.ts
  - grid/test/audit/operator-human-frozen-producer-boundary.test.ts
  - package.json
autonomous: true
requirements: [D-25b-09, D-25b-11]
tags: [ci-gate, producer-boundary, plaintext-gate, sanctions]

must_haves:
  truths:
    - "CI gate fails if any grid/src/audit/append-operator-*.ts contains reason plaintext field names"
    - "CI gate scans grid/src/api/operator/{mute,slash,quarantine,force-sleep,ban-human,freeze-wallet,spawn-system-nous}.ts"
    - "Each of 6 new sanction events has a producer-boundary test asserting only its emitter file calls audit.append"
    - "CI gate wired into package.json test/lint pipeline"
  artifacts:
    - path: "scripts/check-operator-sanctions-plaintext.mjs"
      provides: "Static analysis script forbidding reason plaintext field names in sanction-related files"
      contains: "FORBIDDEN_KEYS"
    - path: "grid/test/audit/operator-muted-producer-boundary.test.ts"
      provides: "Asserts only append-operator-muted.ts emits operator.muted"
    - path: "package.json"
      provides: "npm script wiring for sanctions plaintext gate"
      contains: "check-operator-sanctions-plaintext"
  key_links:
    - from: "package.json test script"
      to: "scripts/check-operator-sanctions-plaintext.mjs"
      via: "npm script entry"
      pattern: "check-operator-sanctions-plaintext"
---

<objective>
Lock the producer-boundary and plaintext-gate invariants for the 6 new sanction events. Clone the existing CI gate pattern (`check-cognitive-snapshot-plaintext.mjs`) to forbid reason plaintext field names across sanction emitters, routes, and tests. Add 6 producer-boundary tests (one per event) asserting the sole-producer invariant.

Purpose: Without these, future contributors could (a) add a `reason_text` field that bypasses the hash discipline, or (b) call `audit.append('operator.muted', ...)` from a non-emitter file, breaking D-25b-09.

Output: 1 CI script + 6 producer-boundary tests + package.json wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-CONTEXT.md
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-PATTERNS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CI plaintext gate for sanction emitters and routes</name>
  <files>scripts/check-operator-sanctions-plaintext.mjs, package.json</files>
  <read_first>
    - scripts/check-cognitive-snapshot-plaintext.mjs (entire file — canonical clone target, lines 1-246)
    - package.json (test/lint pipeline scripts — find where check-cognitive-snapshot-plaintext is invoked)
  </read_first>
  <action>
    1. Clone `scripts/check-cognitive-snapshot-plaintext.mjs` verbatim to `scripts/check-operator-sanctions-plaintext.mjs`.
    2. Change only:
       - **FORBIDDEN_KEYS** (analog ~lines 33-40):
         ```javascript
         const FORBIDDEN_KEYS = [
           'reason_text',
           'reason_plaintext',
           'reason_body',
           'plaintext_reason',
         ];
         ```
       - **Scanned scopes** (analog ~lines 196-205):
         ```javascript
         const gridEmitterFiles = walk('grid/src/audit').filter(f => /append-operator-/.test(norm(f)));
         const gridRouteFiles   = walk('grid/src/api/operator').filter(f =>
           /(mute-broadcast|slash-coin|quarantine|force-sleep|ban-human|freeze-wallet|spawn-system-nous)/.test(norm(f)));
         const gridTestFiles    = walk('grid/test/operator').filter(f =>
           /(sanction|mute|slash|quarantine|ban|freeze)/.test(norm(f)));
         ```
       - **Exempt paths** (analog ~lines 50-55): keep `broadcast-allowlist.ts` exempt; add THIS script to the exempt list.
       - Script header comment: rename from cognitive-snapshot to operator-sanctions.
    3. Wire into `package.json`: find the existing `check-cognitive-snapshot-plaintext` script invocation; add a parallel script `check-operator-sanctions-plaintext` and include it in the same composite test/lint task.
  </action>
  <verify>
    <automated>node scripts/check-operator-sanctions-plaintext.mjs</automated>
  </verify>
  <done>
    - Script exists and exits 0 against current codebase
    - package.json includes a script entry that invokes it
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Producer-boundary tests for 6 new sanction events</name>
  <files>grid/test/audit/operator-muted-producer-boundary.test.ts, grid/test/audit/operator-slashed-producer-boundary.test.ts, grid/test/audit/operator-quarantined-producer-boundary.test.ts, grid/test/audit/operator-forced-sleep-producer-boundary.test.ts, grid/test/audit/operator-human-banned-producer-boundary.test.ts, grid/test/audit/operator-human-frozen-producer-boundary.test.ts</files>
  <read_first>
    - grid/test/audit/operator-exported-producer-boundary.test.ts (canonical clone target — exact assertion pattern for sole-producer invariant)
    - grid/src/audit/append-operator-muted.ts (and the other 5 emitters — verify they exist and export the expected function names)
  </read_first>
  <behavior>
    For EACH new sanction event:
    - Recursive grep over `grid/src/**/*.ts` (excluding test dirs) for `audit.append('operator.<event>', ...)` calls
    - Assertion: the ONLY file matching is `grid/src/audit/append-operator-<event>.ts`
    - Any other matching file fails the test with a clear message
  </behavior>
  <action>
    Clone `operator-exported-producer-boundary.test.ts` six times, changing only the event-name string literal and emitter file path:

    | Test file | Event-name searched | Allowed emitter file |
    |-----------|---------------------|----------------------|
    | operator-muted-producer-boundary.test.ts | 'operator.muted' | grid/src/audit/append-operator-muted.ts |
    | operator-slashed-producer-boundary.test.ts | 'operator.slashed' | grid/src/audit/append-operator-slashed.ts |
    | operator-quarantined-producer-boundary.test.ts | 'operator.quarantined' | grid/src/audit/append-operator-quarantined.ts |
    | operator-forced-sleep-producer-boundary.test.ts | 'operator.forced_sleep' | grid/src/audit/append-operator-forced-sleep.ts |
    | operator-human-banned-producer-boundary.test.ts | 'operator.human_banned' | grid/src/audit/append-operator-human-banned.ts |
    | operator-human-frozen-producer-boundary.test.ts | 'operator.human_frozen' | grid/src/audit/append-operator-human-frozen.ts |

    Re-use whatever recursive grep helper the existing test uses (likely a fs.readdirSync walk + regex match).
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/audit/operator-*-producer-boundary.test.ts</automated>
  </verify>
  <done>
    - All 6 producer-boundary tests pass
    - Each test would fail if a non-emitter file called audit.append for that event
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Source code → audit.append calls for sanction events | Producer-boundary invariant: only the dedicated emitter file may call audit.append for each event |
| Source code → reason plaintext fields | Plaintext field names forbidden in sanction-related source paths |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-08-01 | Tampering | Producer-boundary | mitigate | Per-event producer-boundary test fails if multiple files call audit.append for same event |
| T-25b-08-02 | Information Disclosure | Source files | mitigate | CI gate (`check-operator-sanctions-plaintext.mjs`) fails on FORBIDDEN_KEYS appearance in sanction-related files |
</threat_model>

<verification>
- `node scripts/check-operator-sanctions-plaintext.mjs` exits 0
- `npm --prefix grid run test -- run test/audit/operator-*-producer-boundary.test.ts` passes
- `grep -n "check-operator-sanctions-plaintext" package.json` shows it wired into test pipeline
</verification>

<success_criteria>
- Plaintext gate exists, passes, and runs in CI pipeline
- 6 producer-boundary tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-08-SUMMARY.md`
</output>
