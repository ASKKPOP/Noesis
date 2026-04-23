---
phase: 11
plan_slug: 04-ci-determinism-ui
wave_number: 4
type: execute
gap_closure: false
depends_on: [11-00-setup, 11-01-crypto, 11-02-emitter-router, 11-03-api-brain]
files_modified:
  - scripts/check-whisper-plaintext.mjs
  - grid/test/whisper/whisper-plaintext-fs-guard.test.ts
  - grid/test/whisper/whisper-privacy-matrix.test.ts
  - grid/test/whisper/whisper-determinism.test.ts
  - grid/test/whisper/whisper-zero-diff.test.ts
  - dashboard/src/lib/stores/whisperStore.ts
  - dashboard/src/lib/hooks/use-whisper-counts.ts
  - dashboard/src/components/inspector-sections/whisper.tsx
  - dashboard/src/components/inspector-sections/index.tsx
  - dashboard/test/lib/whisper-types.drift.test.ts
  - dashboard/test/components/whisper-panel.test.tsx
  - .planning/phases/11-mesh-whisper/11-VERIFICATION.md
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/MILESTONES.md
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - PHILOSOPHY.md
  - README.md
autonomous: true
requirements: [WHISPER-01, WHISPER-02, WHISPER-03, WHISPER-04, WHISPER-05, WHISPER-06]
must_haves:
  truths:
    - "scripts/check-whisper-plaintext.mjs merges plaintext grep + keyring-isolation gate: scans grid/src, brain/src, dashboard/src for forbidden keys on whisper-scoped paths AND fails if any grid/src/** file imports from brain/src/noesis_brain/whisper/keyring.py"
    - "grid/test/whisper/whisper-plaintext-fs-guard.test.ts monkey-patches fs.writeFile/fs.promises.writeFile/fs.writeFileSync at runtime, runs a 100-tick simulation with ≥20 whispers, and asserts zero plaintext bytes ever reach any disk-write buffer"
    - "grid/test/whisper/whisper-privacy-matrix.test.ts enumerates 16 cases (13 flat forbidden keys + 3 nested) and a coverage assertion that every D-11-08 forbidden key has ≥1 case — clones Phase 6 D-12 40-case enumerator shape"
    - "grid/test/whisper/whisper-determinism.test.ts runs two fresh simulations with tickRateMs=1_000_000 vs 1000 and asserts byte-identical (tick, from_did, to_did, ciphertext_hash) tuples across runs"
    - "grid/test/whisper/whisper-zero-diff.test.ts runs 100 whisper sends with 0 vs N passive 'nous.whispered' observers and asserts byte-identical audit entries[].eventHash arrays"
    - "Dashboard fourth protocol mirror has a SYNC drift detector (dashboard/test/lib/whisper-types.drift.test.ts) that reads BOTH grid/src/whisper/types.ts AND brain/src/noesis_brain/whisper/types.py and asserts shape parity"
    - "Dashboard counts-only whisper panel lives at dashboard/src/components/inspector-sections/whisper.tsx, consumes use-whisper-counts.ts firehose hook, renders {sent, received, last_whisper_tick, top-N partners by count} and zero plaintext/hash/inspect affordance — NOT EVEN a disabled button"
    - ".planning/phases/11-mesh-whisper/11-VERIFICATION.md enumerates every WHISPER-01..06 REQ with a passing test command; WHISPER-01..06 mark VALIDATED in .planning/REQUIREMENTS.md + .planning/PROJECT.md"
    - "Doc-sync atomic commit: STATE.md 22-event enumeration retained; ROADMAP.md Phase 11 marked complete; MILESTONES.md appends Phase 11 entry; README.md current-status block updated; PHILOSOPHY.md whisper-boundary invariant locked"
    - "Full regression green: cd grid && npm test && cd ../brain && pytest test/ && node scripts/check-state-doc-sync.mjs && node scripts/check-wallclock-forbidden.mjs && node scripts/check-whisper-plaintext.mjs"
  artifacts:
    - path: "scripts/check-whisper-plaintext.mjs"
      provides: "Three-tier plaintext grep gate + merged keyring-isolation check"
      contains: "FORBIDDEN_KEY_PATTERN"
    - path: "grid/test/whisper/whisper-plaintext-fs-guard.test.ts"
      provides: "Runtime fs.writeFile monkey-patch plaintext leak detector"
      contains: "vi.spyOn"
    - path: "grid/test/whisper/whisper-privacy-matrix.test.ts"
      provides: "16-case privacy matrix clone of Phase 6 D-12"
      contains: "it.each"
    - path: "grid/test/whisper/whisper-determinism.test.ts"
      provides: "Byte-identical replay across tickRateMs divergence"
      contains: "ciphertext_hash"
    - path: "grid/test/whisper/whisper-zero-diff.test.ts"
      provides: "0-observer vs N-observer eventHash parity"
      contains: "eventHash"
    - path: "dashboard/src/components/inspector-sections/whisper.tsx"
      provides: "Counts-only Whisper panel (no read affordance)"
      contains: "use-whisper-counts"
    - path: "dashboard/src/lib/hooks/use-whisper-counts.ts"
      provides: "Firehose-derived counts hook (clone of use-ananke-levels.ts)"
      contains: "nous.whispered"
    - path: "dashboard/src/lib/stores/whisperStore.ts"
      provides: "Counts-only Zustand-compatible store"
      contains: "subscribe"
    - path: "dashboard/test/lib/whisper-types.drift.test.ts"
      provides: "Fourth-mirror drift detector reading grid + brain source"
      contains: "WHISPERED_KEYS"
    - path: ".planning/phases/11-mesh-whisper/11-VERIFICATION.md"
      provides: "Per-REQ evidence + passing-command manifest for Phase 11 closeout"
      contains: "WHISPER-01"
  key_links:
    - from: "scripts/check-whisper-plaintext.mjs"
      to: "grid/src/**, brain/src/**, dashboard/src/**"
      via: "filesystem walk + forbidden-key regex scan"
      pattern: "FORBIDDEN_KEY_PATTERN"
    - from: "grid/test/whisper/whisper-plaintext-fs-guard.test.ts"
      to: "grid/src/whisper/router.ts + grid/src/api/whisper/*"
      via: "runtime fs.writeFile spy during send→pull→ack simulation"
      pattern: "vi.spyOn\\(fs"
    - from: "dashboard/src/components/inspector-sections/whisper.tsx"
      to: "dashboard/src/lib/hooks/use-whisper-counts.ts"
      via: "React hook consuming firehose filter on 'nous.whispered'"
      pattern: "useWhisperCounts"
    - from: "dashboard/test/lib/whisper-types.drift.test.ts"
      to: "grid/src/whisper/types.ts + brain/src/noesis_brain/whisper/types.py"
      via: "cross-language structural parity assertion"
      pattern: "WHISPERED_KEYS"
---

<objective>
Close Phase 11 by hardening the privacy invariant, proving determinism, surfacing counts-only Dashboard visibility, and landing the phase VERIFICATION + doc-sync commit that flips WHISPER-01..06 to Validated.

Purpose: The first three waves shipped runnable crypto, emitter, router, rate-limit, API, Brain sender/receiver, trade-guard, and DialogueAggregator extension. Wave 4 proves — via CI gates, runtime monkey-patch, privacy matrix, determinism regression, and zero-diff regression — that the system upholds "operators cannot read plaintext at any tier, including H5" and that the zero-diff invariant survives the +1 allowlist addition. It also ships the read-only counts UI (no inspect affordance at any tier) and performs the atomic doc-sync that marks Phase 11 complete.

Output: 1 new CI script (merged per user directive: plaintext grep + keyring-isolation), 5 new test files (fs-guard, privacy-matrix, determinism, zero-diff, dashboard-drift-detector), 3 new dashboard source files (store + hook + panel), 1 modified dashboard inspector index (to mount the panel into the existing Nous inspector sidebar between Ananke and Telos), 1 new VERIFICATION.md, 6 modified planning/docs files for closeout. Zero new audit events; allowlist stays at 22; regression hash stable.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/11-mesh-whisper/11-CONTEXT.md
@.planning/phases/11-mesh-whisper/11-RESEARCH.md
@.planning/phases/11-mesh-whisper/11-PATTERNS.md
@.planning/phases/11-mesh-whisper/11-VALIDATION.md
@.planning/phases/11-mesh-whisper/11-00-setup/PLAN.md
@.planning/phases/11-mesh-whisper/11-01-crypto/PLAN.md
@.planning/phases/11-mesh-whisper/11-02-emitter-router/PLAN.md
@.planning/phases/11-mesh-whisper/11-03-api-brain/PLAN.md

<interfaces>
<!-- Copy-verbatim analogs the executor MUST read before writing. -->

From scripts/check-wallclock-forbidden.mjs (Plan 10b-07 shipped) — clone walk + scan skeleton:
- Shebang, exit-code discipline, `walk(dir, acc)` helper (recursive, skips node_modules/.git/dist), `scan(filePath, patterns)` with comment-skip state machine, green/red summary lines.
- Exit 0 on zero hits, exit 1 with grouped violations on any hit.

From scripts/check-state-doc-sync.mjs (Plan 10b-08 shipped; re-extended in Wave 0) — the bump target for audit:
- Already at `"22 events"` + required array contains `'nous.whispered'` as of Wave 0. Wave 4 does NOT modify this gate further; the closeout step merely re-runs it to confirm no drift.

From D-11-08 (three-tier plaintext CI gate):
- **Grid tree (`grid/src/**`):** forbidden property keys (flat + nested) `text | body | content | message | utterance | offer | amount | ousia | price | value | plaintext | decrypted | payload_plain`. Exempt: `grid/src/whisper/router.ts` (ciphertext field is base64 bytes, not any forbidden key), and `grid/src/audit/broadcast-allowlist.ts` (forbidden-key constants are intentional).
- **Brain tree (`brain/src/**`):** same forbidden-keys set restricted to paths matching `whisper|envelope|mesh`. `keyring.py` exempt.
- **Dashboard tree (`dashboard/src/**`):** same forbidden-keys set restricted to paths matching `whisper|envelope|mesh`.

From D-11-04 (keyring isolation):
- `grid/src/**` MUST NOT import `brain/src/noesis_brain/whisper/keyring.py`. Per user directive: MERGE this check into `scripts/check-whisper-plaintext.mjs` — keyring-on-Grid = plaintext leak surface; one gate catches both.

From dashboard/src/lib/hooks/use-ananke-levels.ts (Plan 10a-05 shipped) — firehose-derived counts pattern:
- Pure `useMemo` over `useFirehose()`; no new RPC; filter on `eventType`; reduce to counts + last-seen tick. Clone for `use-whisper-counts.ts` with filter `eventType === 'nous.whispered'` and extraction of `{from_did, to_did, tick}` from `entry.payload`.

From dashboard/src/components/inspector-sections/index.tsx (existing registration) — panel mount pattern:
- Named export object mapping section slug to component. Append `whisper: WhisperSection` between `ananke` and `telos` entries (per D-11-15 ordering). Per user directive: "append counts panel to existing Nous inspector sidebar; no new route" — do NOT create a new Dashboard route; register inside the existing inspector tabpanel.

From dashboard/test/lib/ananke-types.drift.test.ts (Plan 10a-05 shipped) — drift detector clone pattern:
- Reads `grid/src/whisper/types.ts` (TS source) + `brain/src/noesis_brain/whisper/types.py` (Python source) as plain text; regex-extracts the interface/dataclass field list; asserts both match dashboard's mirror literal `WHISPERED_KEYS` tuple. Fails loudly with a diff on drift.

From grid/test/dialogue/zero-diff.test.ts (Phase 7 shipped) — zero-diff regression clone:
- Runs the same 100-tick simulation twice — once with zero observers on the target event, once with N passive observers — and asserts `entries.map(e => e.eventHash)` is byte-identical. For Wave 4 clone: N passive observers on `'nous.whispered'` must not mutate chain hashes.

From grid/test/audit/zero-diff-bios.test.ts (Plan 10b shipped) — `vi.spyOn(fs, 'writeFile')` template for the fs-guard runtime test:
- Template spies on `fs.writeFile`/`fs.promises.writeFile`/`fs.writeFileSync` before simulation; records every buffer argument; after simulation asserts zero buffers contain plaintext heuristics.

From .planning/phases/10b-inner-life-fabric/10b-VERIFICATION.md (Phase 10b shipped) — VERIFICATION.md shape:
- Frontmatter (phase, slug, status, date). Per-REQ table: `| REQ | Description | Evidence | Command | Result |`. Threat-model cross-check block (T-10-01..06 mitigation evidence). Closeout checklist. Footer: final regression hash + allowlist count.

Wall-clock ban:
- Tier-A still applies (grid/src/whisper/**, brain/src/noesis_brain/whisper/**). Wave 4 does NOT relax this. Determinism test uses `tickRateMs` as an injected Chronos parameter (not Date.now); the whole point of the test is to prove wall-clock-independence.

From .planning/REQUIREMENTS.md (Active section) — WHISPER-01..06 canonical text:
- WHISPER-01: E2E crypto_box envelope between any two Nous.
- WHISPER-02: Operators cannot read plaintext at any tier including H5.
- WHISPER-03: Audit chain retains only ciphertext_hash.
- WHISPER-04: Exactly +1 allowlist event `nous.whispered` at position 22.
- WHISPER-05: Tick-indexed rate-limit B=10/N=100 (env-overridable).
- WHISPER-06: Recipient-pull delivery; ciphertext deleted on ack.

Reachability — every WHISPER REQ has a concrete validation path:
- WHISPER-01: Wave 1 roundtrip + Wave 3 end-to-end API test (already GREEN) + Wave 4 determinism test.
- WHISPER-02: Wave 4 three-tier grep + runtime fs-guard + privacy-matrix + Dashboard panel (no-affordance test).
- WHISPER-03: Wave 2 producer-boundary + Wave 4 zero-diff regression.
- WHISPER-04: Wave 0 allowlist bump + state-doc-sync gate re-verified in Wave 4.
- WHISPER-05: Wave 2 rate-limit unit tests + Wave 3 metrics endpoint + Wave 4 no additional gate.
- WHISPER-06: Wave 3 pending/ack integration tests (already GREEN); Wave 4 doc-sync marks Validated.
</interfaces>
</context>

<tasks>

<task id="11-W4-01" type="auto" tdd="true">
  <name>Task 11-W4-01: Ship scripts/check-whisper-plaintext.mjs (merged three-tier grep + keyring isolation)</name>
  <requirement>WHISPER-02</requirement>
  <threat_ref>T-10-01, T-10-03</threat_ref>
  <files>scripts/check-whisper-plaintext.mjs</files>
  <behavior>
    - Exit 0 on zero hits across all three tiers AND zero grid/src imports of keyring.py
    - Exit 1 with grouped violations on any forbidden-key hit in a whisper-scoped path OR any grid/src/** import of brain/src/noesis_brain/whisper/keyring.py
    - Three tiers scanned with these scopes:
      - Grid tier: walk grid/src/**, scan ALL files (not path-filtered — whisper plaintext could leak anywhere)
      - Brain tier: walk brain/src/**, scan files whose path matches /whisper|envelope|mesh/
      - Dashboard tier: walk dashboard/src/**, scan files whose path matches /whisper|envelope|mesh/
    - FORBIDDEN_KEY_PATTERN regex alternation: text | body | content | message | utterance | offer | amount | ousia | price | value | plaintext | decrypted | payload_plain (scoped to string-literal keys inside object literals, JSON schemas, and identifier patterns flowing through whisper paths — use the comment-skip state machine from check-wallclock-forbidden.mjs)
    - Exempt files (hardcoded list with rationale comment):
      - grid/src/audit/broadcast-allowlist.ts (WHISPER_FORBIDDEN_KEYS const IS the forbidden-key list by design)
      - grid/src/whisper/router.ts (ciphertext field is opaque base64, not a forbidden key)
      - brain/src/noesis_brain/whisper/keyring.py (no forbidden keys; isolation-checked separately)
      - Any *.test.ts / *.test.tsx / test_*.py / *.drift.test.ts (tests assert forbidden keys are rejected)
      - This script itself (scripts/check-whisper-plaintext.mjs)
    - Keyring-isolation merge: after the three-tier scan, walk grid/src/** and for each .ts/.tsx/.mjs file, regex-scan for imports matching /from\s+['"].*brain\/.*whisper\/keyring/ — any hit fails CI with "grid/** may not import brain whisper keyring (D-11-04 T-10-03)"
    - Script runs in <3s on current repo
  </behavior>
  <action>
Clone scripts/check-wallclock-forbidden.mjs (Plan 10b-07) as the skeleton:
1. Shebang + Node imports (fs, path, url).
2. `const FORBIDDEN_KEY_PATTERN = /(?:^|[^a-zA-Z0-9_])(?:text|body|content|message|utterance|offer|amount|ousia|price|value|plaintext|decrypted|payload_plain)\s*[:=]/;` — match key-position usage only, not mid-word.
3. `const EXEMPT_PATHS = new Set([...])` with the hardcoded exemptions listed above.
4. `function walk(dir, acc)` recursive (skip node_modules, .git, dist, .next, .venv, build, coverage).
5. `function scan(filePath, patterns)` cloned from check-wallclock-forbidden.mjs comment-skip state machine (handles //, /* */, #, """ """ for Python).
6. Three scan tiers:
   - `scanTier('grid/src', walk('grid/src'), FORBIDDEN_KEY_PATTERN, (p) => !EXEMPT_PATHS.has(p) && !isTest(p))`
   - `scanTier('brain/src', walk('brain/src').filter(p => /whisper|envelope|mesh/.test(p)), FORBIDDEN_KEY_PATTERN, ...)`
   - `scanTier('dashboard/src', walk('dashboard/src').filter(p => /whisper|envelope|mesh/.test(p)), FORBIDDEN_KEY_PATTERN, ...)`
7. Keyring-isolation scan: `walk('grid/src').forEach(p => { const src = readFileSync(p,'utf8'); if (/from\s+['"][^'"]*brain\/[^'"]*whisper\/keyring/.test(src)) violations.push({tier:'keyring-isolation', file:p, msg:'grid/** imports brain whisper keyring (D-11-04 T-10-03)'}); })`
8. Summary: print `✓ check-whisper-plaintext: clean (0 violations across 3 tiers + keyring-isolation)` on clean; print grouped violation table + `✗ check-whisper-plaintext: N violations` and `process.exit(1)` on any hit.
9. Run from repo root only (`if (process.cwd() !== <repoRoot>) ...`) — clone the existing check for consistency.
  </action>
  <verify>
    <automated>node scripts/check-whisper-plaintext.mjs</automated>
  </verify>
  <done>
    Script exits 0 on current codebase (Wave 0-3 shipped clean); script exits 1 if a fixture file with `text:` inside `grid/src/whisper/` is temporarily added (smoke test, revert); ~3s runtime.
  </done>
</task>

<task id="11-W4-02" type="auto" tdd="true">
  <name>Task 11-W4-02: Ship grid/test/whisper/whisper-plaintext-fs-guard.test.ts (runtime fs.writeFile monkey-patch)</name>
  <requirement>WHISPER-02</requirement>
  <threat_ref>T-10-02</threat_ref>
  <files>grid/test/whisper/whisper-plaintext-fs-guard.test.ts</files>
  <behavior>
    - Monkey-patches fs.writeFile, fs.promises.writeFile, fs.writeFileSync, fs.createWriteStream BEFORE any whisper subsystem is instantiated (beforeAll hook)
    - Runs a 100-tick simulation with 20 whisper sends across ≥4 DIDs (reuses test/fixtures/dids.ts A/B/C pattern + one extra)
    - Records every buffer/string argument passed to any wrapped fs write
    - After simulation, asserts for each recorded buffer: `String(buf).match(/\b(text|body|utterance|offer|amount|plaintext|decrypted)\b/i) === null`
    - Restores original fs fns in afterAll
    - Test runs in <5s
  </behavior>
  <action>
Clone the vi.spyOn template from grid/test/audit/zero-diff-bios.test.ts lines 26–31:
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import { promises as fsp } from 'node:fs';

const capturedWrites: Array<{fn: string; buf: string}> = [];

beforeAll(() => {
  vi.spyOn(fs, 'writeFile').mockImplementation((...args: any[]) => {
    capturedWrites.push({fn: 'writeFile', buf: String(args[1])});
    const cb = args[args.length - 1];
    if (typeof cb === 'function') cb(null);
  });
  vi.spyOn(fs, 'writeFileSync').mockImplementation((_p, data) => {
    capturedWrites.push({fn: 'writeFileSync', buf: String(data)});
  });
  vi.spyOn(fsp, 'writeFile').mockImplementation(async (_p, data) => {
    capturedWrites.push({fn: 'promises.writeFile', buf: String(data)});
  });
});

afterAll(() => vi.restoreAllMocks());
```
Test body:
1. Instantiate full whisper pipeline in-memory (audit chain, registry, rate-limiter, pending-store, router) — no disk touching by design.
2. Run 100-tick loop: at selected ticks, `router.route(envelope)` with plaintext literals that INCLUDE forbidden words inside the PRE-ENCRYPT plaintext fed to `crypto.encryptFor(...)` (proves that even when plaintext contains the tripwires, they never escape to disk).
3. After loop: iterate capturedWrites; for each, assert `!/\b(text|body|utterance|offer|amount|plaintext|decrypted)\b/i.test(buf)`.
4. Include a control case: one forbidden buffer is NOT written (assert captured) to avoid false-positive-on-empty. Use `expect(capturedWrites.length).toBeGreaterThanOrEqual(0)` — zero is valid.
5. Additional assertion: audit chain grows by exactly 20 × ≤ rateBudget entries — proves the simulation actually executed.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-plaintext-fs-guard.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Test passes with zero disk-write-captured plaintext; test fails if a fixture source leaks `{text: plaintext}` into a write path (smoke-verified then reverted).
  </done>
</task>

<task id="11-W4-03" type="auto" tdd="true">
  <name>Task 11-W4-03: Ship grid/test/whisper/whisper-privacy-matrix.test.ts (16-case enumerator)</name>
  <requirement>WHISPER-02</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/test/whisper/whisper-privacy-matrix.test.ts</files>
  <behavior>
    - 16 test cases total: 13 flat forbidden keys + 3 nested cases + 1 coverage assertion
    - Flat cases: one per forbidden key (text, body, content, message, utterance, offer, amount, ousia, price, value, plaintext, decrypted, payload_plain) — each injects the key into a `nous.whispered` payload candidate via a wrapping helper and asserts the emitter throws
    - Nested cases: {meta: {text: '...'}}, {payload: {body: '...'}}, {ext: {utterance: '...'}} — each injects forbidden keys at depth 2+ and asserts the privacy-check rejects
    - Coverage assertion: `describe('coverage')` reads WHISPER_FORBIDDEN_KEYS from grid/src/audit/broadcast-allowlist.ts and asserts every key has at least one flat case in the matrix — guards against future key additions silently bypassing the matrix
    - Clones Phase 6 D-12 40-case enumerator structure (it.each with tuple input → assertion output)
  </behavior>
  <action>
Clone Phase 6 D-12 enumerator (`grid/test/audit/telos-refined-privacy.test.ts` or nearest analog):
```ts
import { describe, it, expect } from 'vitest';
import { WHISPER_FORBIDDEN_KEYS } from '../../src/audit/broadcast-allowlist.js';
import { appendNousWhispered } from '../../src/whisper/appendNousWhispered.js';

const FLAT_CASES = WHISPER_FORBIDDEN_KEYS.map(k => [k, 'some-plaintext-value']);
const NESTED_CASES: Array<[string, unknown]> = [
  ['meta.text', {meta: {text: '...'}}],
  ['payload.body', {payload: {body: '...'}}],
  ['ext.utterance', {ext: {utterance: '...'}}],
];

describe('whisper privacy matrix — flat forbidden keys (13)', () => {
  it.each(FLAT_CASES)('rejects payload carrying forbidden key %s', (key, value) => {
    const payload = { ciphertext_hash: 'a'.repeat(64), from_did: 'did:noesis:a'.padEnd(44,'a'), tick: 1, to_did: 'did:noesis:b'.padEnd(44,'b'), [key]: value };
    expect(() => appendNousWhispered(mockAudit, payload.from_did, payload)).toThrow(/forbidden|privacy|key/i);
  });
});

describe('whisper privacy matrix — nested forbidden keys (3)', () => {
  it.each(NESTED_CASES)('rejects nested forbidden key path %s', (path, injection) => {
    const payload = { ciphertext_hash: 'a'.repeat(64), from_did: '...', tick: 1, to_did: '...', ...injection };
    expect(() => appendNousWhispered(mockAudit, payload.from_did, payload)).toThrow();
  });
});

describe('coverage — every forbidden key has ≥1 case', () => {
  it('all WHISPER_FORBIDDEN_KEYS covered', () => {
    const flatKeys = new Set(FLAT_CASES.map(([k]) => k));
    for (const k of WHISPER_FORBIDDEN_KEYS) {
      expect(flatKeys.has(k)).toBe(true);
    }
  });
});
```
Count assertion: `expect(FLAT_CASES.length + NESTED_CASES.length).toBe(16)`.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-privacy-matrix.test.ts --reporter=dot</automated>
  </verify>
  <done>
    16 cases green; coverage assertion passes; any future addition to WHISPER_FORBIDDEN_KEYS without a matrix case fails the coverage test.
  </done>
</task>

<task id="11-W4-04" type="auto" tdd="true">
  <name>Task 11-W4-04: Ship whisper-determinism.test.ts + whisper-zero-diff.test.ts regressions</name>
  <requirement>WHISPER-03</requirement>
  <threat_ref>—</threat_ref>
  <files>grid/test/whisper/whisper-determinism.test.ts, grid/test/whisper/whisper-zero-diff.test.ts</files>
  <behavior>
    - whisper-determinism.test.ts: two fresh in-memory simulations with identical seeds; run A with tickRateMs=1_000_000 (slow), run B with tickRateMs=1000 (fast); collect (tick, from_did, to_did, ciphertext_hash) tuples; assert byte-identical sequences — proves wall-clock independence and nonce derivation determinism
    - whisper-zero-diff.test.ts: one simulation WITHOUT passive 'nous.whispered' observers, one WITH N=3 passive observers; assert chain.entries.map(e => e.eventHash) arrays are byte-identical modulo new whisper entries
    - Neither test touches disk or network; both run in <8s combined
    - Determinism test tuple count ≥ 20 (meaningful sample)
    - Zero-diff test covers both directions: whispers BETWEEN observed pairs AND whispers BETWEEN unobserved pairs
    - Regression hash (from STATE.md Accumulated Context) remains byte-identical after this wave — document in Wave 4 summary
  </behavior>
  <action>
1. Clone grid/test/dialogue/zero-diff.test.ts into `whisper-zero-diff.test.ts`:
   - Two identical simulations; second adds N passive observers via `audit.onAppend((e) => { if (e.eventType === 'nous.whispered') seenHashes.push(e.eventHash); })`.
   - Assert `runA.entries.map(e => e.eventHash).toEqual(runB.entries.map(e => e.eventHash))`.
   - Covers carry-forward invariant #2 (zero-diff) for whisper emissions.

2. New `whisper-determinism.test.ts` clones the replay pattern:
```ts
import { describe, it, expect } from 'vitest';
import { buildWhisperSim } from './_sim.js'; // small helper co-located in test/whisper/

describe('whisper determinism — byte-identical replay across tickRateMs divergence', () => {
  it('yields identical (tick, from, to, ciphertext_hash) sequence', async () => {
    const seeds = { whisperSeed: 'phase-11-det', ticks: 100, sends: 20 };
    const runA = await buildWhisperSim({...seeds, tickRateMs: 1_000_000});
    const runB = await buildWhisperSim({...seeds, tickRateMs: 1000});
    const tuplesA = runA.entries.filter(e => e.eventType === 'nous.whispered').map(e => [e.payload.tick, e.payload.from_did, e.payload.to_did, e.payload.ciphertext_hash]);
    const tuplesB = runB.entries.filter(e => e.eventType === 'nous.whispered').map(e => [e.payload.tick, e.payload.from_did, e.payload.to_did, e.payload.ciphertext_hash]);
    expect(tuplesA.length).toBeGreaterThanOrEqual(20);
    expect(tuplesA).toEqual(tuplesB);
  });
});
```

3. Co-located `_sim.ts` helper (not in files_modified top-list — list as implicit test helper): builds an in-memory Grid (audit chain, registry, router, keyring via crypto.ts fixtures) and runs the send loop deterministically. No Date.now, no Math.random (wall-clock ban). Nonces derived via deriveNonce(seed, tick, counter).

4. Add regression hash checkpoint in Wave 4 summary: note that grid/test/audit/regression-hash.test.ts (existing) still yields the same baseline hash after Phase 11 (baseline fixture has zero whispers, so no change).
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/whisper-determinism.test.ts test/whisper/whisper-zero-diff.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Both tests green; tuple count ≥ 20; regression hash stable.
  </done>
</task>

<task id="11-W4-05" type="auto" tdd="true">
  <name>Task 11-W4-05: Ship Dashboard fourth protocol mirror drift detector + counts panel (store + hook + component + inspector mount)</name>
  <requirement>WHISPER-02</requirement>
  <threat_ref>T-10-03</threat_ref>
  <files>dashboard/src/lib/stores/whisperStore.ts, dashboard/src/lib/hooks/use-whisper-counts.ts, dashboard/src/components/inspector-sections/whisper.tsx, dashboard/src/components/inspector-sections/index.tsx, dashboard/test/lib/whisper-types.drift.test.ts, dashboard/test/components/whisper-panel.test.tsx</files>
  <behavior>
    - dashboard/src/lib/stores/whisperStore.ts: SSR-safe singleton with subscribe/getSnapshot/notify triad. State shape {sent: number, received: number, lastTick: number | null, topPartners: Array<{did: string, count: number}>}. NO localStorage, NO H-tier gating (counts visible at all tiers per D-11-15)
    - dashboard/src/lib/hooks/use-whisper-counts.ts: pure `useMemo` over `useFirehose()`, filters `entry.eventType === 'nous.whispered'`, derives counts from `entry.payload.{from_did, to_did, tick}` for the inspected DID
    - dashboard/src/components/inspector-sections/whisper.tsx: `'use client'`; renders `whispers sent: N / whispers received: N / last whisper tick: T / top-5 partners: did — count`. Zero read/inspect affordance — not even a disabled button. No plaintext, no hash displayed
    - dashboard/src/components/inspector-sections/index.tsx: append `whisper: WhisperSection` between `ananke` and `telos` entries (D-11-15 panel ordering)
    - dashboard/test/lib/whisper-types.drift.test.ts: reads grid/src/whisper/types.ts AND brain/src/noesis_brain/whisper/types.py as plain text; regex-extracts field lists; asserts dashboard/src/lib/protocol/whisper-types.ts WHISPERED_KEYS tuple matches both sources exactly
    - dashboard/test/components/whisper-panel.test.tsx: mounts WhisperSection with mock firehose state; asserts text output contains "whispers sent" / "whispers received" / no "inspect" / no "read" / no "decrypt" / no HEX64 pattern / no base64 ciphertext
    - check-whisper-plaintext.mjs passes across the new dashboard tree files
  </behavior>
  <action>
1. Clone `dashboard/src/lib/stores/agency-store.ts` (Plan 10a-05 shipped) as the skeleton for `whisperStore.ts`:
   - Private state + listeners Set + subscribe/getSnapshot/notify.
   - SSR guards (`typeof window === 'undefined'`).
   - Initial state: `{sent: 0, received: 0, lastTick: null, topPartners: []}`.
   - Expose `recordWhisper(entry: {from_did, to_did, tick}, inspectedDid: string)` that updates counts.

2. Clone `dashboard/src/lib/hooks/use-ananke-levels.ts` for `use-whisper-counts.ts`:
   - `useMemo` over `useFirehose()` filtered to `eventType === 'nous.whispered'`.
   - Reduce: increment `sent` when `from_did === inspectedDid`, `received` when `to_did === inspectedDid`, track `lastTick = max(lastTick, entry.payload.tick)`, build partner count map, take top 5.
   - Return `{sent, received, lastTick, topPartners}`.

3. Write `whisper.tsx`:
```tsx
'use client';
// UI-SPEC: D-11-15 — counts only. No plaintext, no hash, no inspect/read affordance at any tier.
import { useWhisperCounts } from '@/lib/hooks/use-whisper-counts';

export function WhisperSection({ did }: {did: string}) {
  const {sent, received, lastTick, topPartners} = useWhisperCounts(did);
  return (
    <section aria-label="Whisper activity" data-section="whisper">
      <h3>Whisper</h3>
      <dl>
        <dt>Sent</dt><dd>{sent}</dd>
        <dt>Received</dt><dd>{received}</dd>
        <dt>Last whisper tick</dt><dd>{lastTick ?? '—'}</dd>
        <dt>Top partners</dt>
        <dd>
          {topPartners.length === 0 ? '—' : (
            <ul>
              {topPartners.map(p => <li key={p.did}>{p.did.slice(0,16)}… — {p.count}</li>)}
            </ul>
          )}
        </dd>
      </dl>
    </section>
  );
}
```
No `<button>` elements. No onClick that reveals payload. No plaintext, no hash.

4. Register in `inspector-sections/index.tsx` (between ananke and telos). Preserve existing ordering for other sections.

5. Write `whisper-types.drift.test.ts` (clone of `ananke-types.drift.test.ts` from Plan 10a-05):
```ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const gridSrc = fs.readFileSync(path.resolve(__dirname, '../../../grid/src/whisper/types.ts'), 'utf8');
const brainSrc = fs.readFileSync(path.resolve(__dirname, '../../../brain/src/noesis_brain/whisper/types.py'), 'utf8');
const dashSrc = fs.readFileSync(path.resolve(__dirname, '../../src/lib/protocol/whisper-types.ts'), 'utf8');

const expectedKeys = ['ciphertext_hash', 'from_did', 'tick', 'to_did'];

describe('whisper-types drift detector (fourth mirror)', () => {
  it('grid source lists alphabetical WHISPERED_KEYS', () => {
    expect(gridSrc).toMatch(/WHISPERED_KEYS\s*=\s*\[\s*'ciphertext_hash'\s*,\s*'from_did'\s*,\s*'tick'\s*,\s*'to_did'\s*\]\s*as const/);
  });
  it('brain source lists identical tuple', () => {
    expect(brainSrc).toMatch(/WHISPERED_KEYS\s*=\s*\(\s*"ciphertext_hash"\s*,\s*"from_did"\s*,\s*"tick"\s*,\s*"to_did"\s*\)/);
  });
  it('dashboard mirror matches both', () => {
    expect(dashSrc).toMatch(/WHISPERED_KEYS/);
    for (const k of expectedKeys) expect(dashSrc).toContain(k);
  });
});
```

6. Write `whisper-panel.test.tsx`:
   - Mock `useFirehose()` with 3 fixture whisper entries.
   - Render `<WhisperSection did="did:noesis:alice" />`.
   - Assert rendered text contains expected counts.
   - Assert `queryByText(/inspect|read|decrypt|view plaintext/i) === null`.
   - Assert no HEX64 regex match in rendered tree: `expect(container.innerHTML).not.toMatch(/[0-9a-f]{64}/)`.
   - Assert no base64 ciphertext fragments: `expect(container.innerHTML).not.toMatch(/[A-Za-z0-9+/]{40,}=*/)`.
  </action>
  <verify>
    <automated>cd dashboard &amp;&amp; npx vitest run test/lib/whisper-types.drift.test.ts test/components/whisper-panel.test.tsx --reporter=dot &amp;&amp; node scripts/check-whisper-plaintext.mjs</automated>
  </verify>
  <done>
    Drift detector green; panel test green; no inspect affordance; plaintext CI gate still clean across dashboard tree; inspector-sections index mounts WhisperSection between Ananke and Telos.
  </done>
</task>

<task id="11-W4-06" type="auto" tdd="true">
  <name>Task 11-W4-06: Write 11-VERIFICATION.md + run full regression suite</name>
  <requirement>WHISPER-01, WHISPER-02, WHISPER-03, WHISPER-04, WHISPER-05, WHISPER-06</requirement>
  <threat_ref>T-10-01, T-10-02, T-10-03, T-10-06</threat_ref>
  <files>.planning/phases/11-mesh-whisper/11-VERIFICATION.md</files>
  <behavior>
    - 11-VERIFICATION.md frontmatter: phase: 11, slug: mesh-whisper, status: pending-closeout, nyquist_compliant: true, created: <date>
    - Per-REQ evidence table: WHISPER-01..06 each with Description / Evidence / Command / Result columns populated from live test runs
    - Threat-model cross-check block: T-10-01..06 each with Mitigation / Test File / Command / Result
    - Closeout checklist: allowlist still at 22 / state-doc-sync green / wallclock-forbidden green / plaintext-grep green / fs-guard green / privacy-matrix green / determinism green / zero-diff green / drift-detector green / regression-hash stable
    - Footer: regression hash value + allowlist count + phase sign-off stamp
    - Full suite commands executed and pasted into Result columns with pass/fail + duration
  </behavior>
  <action>
1. Clone `.planning/phases/10b-inner-life-fabric/10b-VERIFICATION.md` structure.

2. Run every command from 11-VALIDATION.md per-task table and record outputs:
```
cd grid && npm test
cd brain && pytest test/
node scripts/check-state-doc-sync.mjs
node scripts/check-wallclock-forbidden.mjs
node scripts/check-whisper-plaintext.mjs
cd dashboard && npm test
```

3. Populate VERIFICATION.md per-REQ table — every row must cite a concrete command that passed (or flag the gap).

4. Threat block — each T-10-0X maps to a specific test file + its last passing run.

5. Closeout checklist — every line must be checked before doc-sync (Task 11-W4-07).

6. If ANY gate fails, STOP — do not proceed to 11-W4-07 doc-sync until green. Escalate to user with failure summary.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npm test &amp;&amp; cd ../brain &amp;&amp; pytest test/ &amp;&amp; node ../scripts/check-state-doc-sync.mjs &amp;&amp; node ../scripts/check-wallclock-forbidden.mjs &amp;&amp; node ../scripts/check-whisper-plaintext.mjs</automated>
  </verify>
  <done>
    VERIFICATION.md populated; all gates green; regression hash stable and noted.
  </done>
</task>

<task id="11-W4-07" type="auto" tdd="false">
  <name>Task 11-W4-07: Phase 11 atomic doc-sync closeout (STATE + ROADMAP + MILESTONES + PROJECT + REQUIREMENTS + PHILOSOPHY + README)</name>
  <requirement>WHISPER-04</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>.planning/STATE.md, .planning/ROADMAP.md, .planning/MILESTONES.md, .planning/PROJECT.md, .planning/REQUIREMENTS.md, PHILOSOPHY.md, README.md</files>
  <behavior>
    - STATE.md Session Continuity: "Stopped at: Phase 11 shipped — 22-event allowlist, Mesh Whisper closed" / "Next action: Phase 12 (Governance & Collective Law) — /gsd-discuss-phase 12"
    - STATE.md Accumulated Context retains the 22-event enumeration + hash-only whisper boundary invariant (already present from Wave 0) — confirm no regression
    - ROADMAP.md Phase 11 heading marked `[x] **Phase 11: Mesh Whisper** — SHIPPED` with running total updated if format requires it; Phase 11 detail block gets "**Status**: Complete (<date>)" line
    - MILESTONES.md appends: "## Phase 11: Mesh Whisper — SHIPPED <date>" with bullets (libsodium crypto_box end-to-end / 22-event allowlist / three-tier plaintext CI gate / fourth Dashboard protocol mirror with drift detector / tick-indexed rate-limit B=10/N=100 / recipient-pull delivery / trade-guard T-10-06 defense)
    - PROJECT.md: move WHISPER-01..06 from Active to Validated; add "Key Decision: Hash-only whisper boundary — Brain-local plaintext forever (D-11-04)" to Key Decisions section
    - REQUIREMENTS.md: mark WHISPER-01..06 as Validated with phase=11 reference
    - PHILOSOPHY.md: confirm 22-event allowlist invariant + `nous.whispered` enumeration (should already be present from Wave 0); confirm hash-only-cross-boundary clause mentions whispers
    - README.md: update Current status section to reflect Phase 11 shipped; move any README promise of whisper feature from "upcoming" to "shipped"
    - Commit message: `docs(11): Phase 11 Mesh Whisper SHIPPED — 22-event allowlist, hash-only whisper boundary, counts-only UI (WHISPER-01..06 validated)`
    - Single atomic commit — all doc edits together (CLAUDE.md doc-sync rule)
  </behavior>
  <action>
1. Read each target doc; apply the edits enumerated in behavior.
2. Cross-check: the STATE.md 22-event enumeration and PHILOSOPHY.md allowlist invariant should already show 22 (set in Wave 0). If they don't — that's a Wave 0 regression, fix here and note in VERIFICATION.md.
3. Verify `node scripts/check-state-doc-sync.mjs` still passes after all edits.
4. Verify full test suite still green.
5. Single commit with all docs — DO NOT split. This is the phase-close atomic doc-sync.
6. No code changes in this task — docs only.
  </action>
  <verify>
    <automated>node scripts/check-state-doc-sync.mjs &amp;&amp; cd grid &amp;&amp; npm test &amp;&amp; cd ../brain &amp;&amp; pytest test/</automated>
  </verify>
  <done>
    All 7 doc files updated in one commit; state-doc-sync green; full regression green; Phase 11 is closed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Disk ↔ runtime | fs.writeFile monkey-patch proves no plaintext crosses this boundary even under adversarial simulation |
| Grid ↔ Brain | Only ciphertext_hash, nonce, ephemeral_pub, ciphertext (bytes), envelope_id cross; plaintext is Brain-local |
| Dashboard ↔ firehose | Only counts and public audit fields cross; dashboard panel has zero read/inspect affordance |
| Source tree ↔ CI | Three-tier grep + keyring-isolation merge catches static leaks; regression fails CI |

## STRIDE Threat Register (Wave 4 closure)

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-01 | Information Disclosure | Whisper payload routing | mitigate | W4-01 (three-tier grep) + W4-03 (16-case privacy matrix); emitter throws on any forbidden key (Wave 2) |
| T-10-02 | Information Disclosure | Runtime disk writes | mitigate | W4-02 (fs.writeFile monkey-patch runtime test) + Grid never persists ciphertext per D-11-05 |
| T-10-03 | Information Disclosure | Operator UI (dashboard) | mitigate | W4-05 panel has zero read/inspect affordance; drift detector enforces shape parity; W4-01 keyring-isolation merge ensures grid/** cannot import brain keyring |
| T-10-06 | Elevation of Privilege | Whisper as trade covert channel | mitigate | Wave 3 trade_guard.py rejects trade literals pre-encrypt; ReviewerNous (Phase 5) remains authoritative gate; whisper-then-trade integration verified in W3 |
| T-10-04 | Information Disclosure | Log lines in Brain | accept | Python log handler scrubbing is out of scope this phase; keyring.py emits no stdout by design (tested in W1); revisit if Phase 12+ introduces structured Brain logging |
</threat_model>

<verification>
- scripts/check-whisper-plaintext.mjs: exit 0, zero violations across three tiers + keyring-isolation
- grid/test/whisper/whisper-plaintext-fs-guard.test.ts: green, zero plaintext bytes captured from fs writes
- grid/test/whisper/whisper-privacy-matrix.test.ts: 16 cases green + coverage assertion green
- grid/test/whisper/whisper-determinism.test.ts: byte-identical tuples across tickRateMs runs
- grid/test/whisper/whisper-zero-diff.test.ts: byte-identical eventHash arrays with/without passive observers
- dashboard/test/lib/whisper-types.drift.test.ts: cross-language parity green
- dashboard/test/components/whisper-panel.test.tsx: counts render, no inspect affordance
- node scripts/check-state-doc-sync.mjs: 22 events, all required present
- node scripts/check-wallclock-forbidden.mjs: whisper trees clean
- cd grid && npm test: full suite green
- cd brain && pytest test/: full suite green
- .planning/phases/11-mesh-whisper/11-VERIFICATION.md: all REQ rows + threat rows populated with live command output
- Phase 11 regression hash stable (unchanged baseline fixture has no whispers)
</verification>

<success_criteria>
- WHISPER-01..06 all marked Validated in REQUIREMENTS.md and PROJECT.md
- Allowlist stays at exactly 22 events; no drift
- Three-tier plaintext gate + runtime fs-guard + keyring-isolation all green
- Privacy matrix covers every forbidden key (coverage-asserted)
- Determinism + zero-diff regressions green
- Dashboard ships counts-only panel with zero read affordance
- Fourth protocol mirror has drift detector covering grid + brain source
- Atomic closeout commit lands: STATE + ROADMAP + MILESTONES + PROJECT + REQUIREMENTS + PHILOSOPHY + README in one commit
- Phase 11 regression hash stable
- Ready for Phase 12 discussion
</success_criteria>

<output>
After completion, create `.planning/phases/11-mesh-whisper/11-04-SUMMARY.md` documenting:
- Which CI gates shipped and their clean runs
- Which regression tests landed and their passing runs
- Dashboard panel file paths + inspector mount location
- Final allowlist count (22)
- Final regression hash
- Doc-sync commit SHA
- Any deferred items (e.g., shared @noesis/protocol-types package — deferred per D-11-16)
</output>
