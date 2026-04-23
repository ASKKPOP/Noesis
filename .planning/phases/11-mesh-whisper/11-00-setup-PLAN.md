---
phase: 11
plan_slug: 00-setup
wave_number: 0
type: execute
gap_closure: false
depends_on: []
files_modified:
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/whisper/types.ts
  - grid/src/whisper/config.ts
  - dashboard/src/lib/protocol/whisper-types.ts
  - brain/src/noesis_brain/whisper/__init__.py
  - brain/src/noesis_brain/whisper/types.py
  - grid/test/whisper/whisper-producer-boundary.test.ts
  - grid/test/whisper/whisper-crypto.test.ts
  - grid/test/whisper/whisper-wire-format.test.ts
  - grid/test/whisper/whisper-rate-limit.test.ts
  - scripts/check-state-doc-sync.mjs
  - scripts/check-wallclock-forbidden.mjs
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - PHILOSOPHY.md
autonomous: true
requirements: [WHISPER-03, WHISPER-04]
must_haves:
  truths:
    - "Broadcast allowlist contains exactly 22 events; index 21 is 'nous.whispered'"
    - "STATE.md Accumulated Context enumeration reflects 22-event allowlist with nous.whispered at position 22 and Phase 11 carry-forward invariants appended"
    - "scripts/check-state-doc-sync.mjs literal '21 events' → '22 events'; required array includes 'nous.whispered'"
    - "scripts/check-wallclock-forbidden.mjs root lists include 'grid/src/whisper' (TIER_B_TS_ROOTS) and 'brain/src/noesis_brain/whisper' (TIER_A_ROOTS)"
    - "grid/test/whisper/ directory exists with four RED stub files that compile and fail as intended against missing emitter/crypto/router/rate-limiter"
    - "grid/src/whisper/types.ts exports NousWhisperedPayload (4 readonly keys ciphertext_hash/from_did/tick/to_did) + WHISPERED_KEYS tuple + Envelope (5 keys) with SYNC-pointer comments to dashboard and brain mirrors"
    - "dashboard/src/lib/protocol/whisper-types.ts fourth protocol mirror exists with TWO SYNC pointer comments (grid + brain)"
    - "grid/src/whisper/config.ts exports Object.freeze({rateBudget:10, rateWindowTicks:100, envelopeVersion:1}) with WHISPER_RATE_BUDGET / WHISPER_RATE_WINDOW_TICKS env override"
  artifacts:
    - path: "grid/src/audit/broadcast-allowlist.ts"
      provides: "22-event ALLOWLIST_MEMBERS; WHISPER_FORBIDDEN_KEYS const; extended FORBIDDEN_KEY_PATTERN"
      contains: "nous.whispered"
    - path: "grid/src/whisper/types.ts"
      provides: "Shared closed-tuple NousWhisperedPayload + Envelope interface"
      contains: "WHISPERED_KEYS"
    - path: "grid/src/whisper/config.ts"
      provides: "Frozen rate-limit constants with env override"
      contains: "rateBudget"
    - path: "dashboard/src/lib/protocol/whisper-types.ts"
      provides: "Fourth dashboard protocol mirror with two SYNC pointers"
      contains: "SYNC: mirrors grid/src/whisper/types.ts"
    - path: "brain/src/noesis_brain/whisper/types.py"
      provides: "Brain-side type mirror"
      contains: "WHISPERED_KEYS"
    - path: "grid/test/whisper/whisper-producer-boundary.test.ts"
      provides: "RED stub — three-describe grep boundary test (clone of bios-producer-boundary.test.ts)"
      contains: "KNOWN_CONSUMERS_WHISPERED"
    - path: "grid/test/whisper/whisper-crypto.test.ts"
      provides: "RED stub — keypair + nonce determinism + roundtrip"
      contains: "crypto_box_seed_keypair"
    - path: "grid/test/whisper/whisper-wire-format.test.ts"
      provides: "RED stub — closed-tuple envelope validation"
      contains: "NousWhisperedPayload"
    - path: "grid/test/whisper/whisper-rate-limit.test.ts"
      provides: "RED stub — tick-indexed B=10/N=100 matrix"
      contains: "rateBudget"
    - path: "scripts/check-state-doc-sync.mjs"
      provides: "Regression gate bumped to 22 events"
      contains: "22 events"
    - path: "scripts/check-wallclock-forbidden.mjs"
      provides: "Tier-A/Tier-B roots extended to whisper trees"
      contains: "grid/src/whisper"
  key_links:
    - from: "grid/src/audit/broadcast-allowlist.ts"
      to: "grid/src/whisper/types.ts"
      via: "WHISPERED_KEYS import drives closed-tuple assertions in the (yet-to-ship) emitter"
      pattern: "WHISPERED_KEYS"
    - from: "scripts/check-state-doc-sync.mjs"
      to: ".planning/STATE.md"
      via: "gate asserts 22-event enumeration matches STATE.md block"
      pattern: "22 events"
    - from: "dashboard/src/lib/protocol/whisper-types.ts"
      to: "grid/src/whisper/types.ts"
      via: "SYNC header pointer + (future) whisper-types.drift.test.ts detector"
      pattern: "SYNC: mirrors grid/src/whisper/types.ts"
---

<objective>
Establish Phase 11 foundation: bump broadcast allowlist 21→22 with `nous.whispered` at index 21 (position 22) per D-11-01; extend `FORBIDDEN_KEY_PATTERN` with `WHISPER_FORBIDDEN_KEYS`; ship the closed-tuple type module + dashboard fourth-mirror skeleton + Brain type mirror; drop four RED-stub whisper tests that compile but fail (missing emitter/crypto/router/rate-limiter); extend the wall-clock-forbidden gate to cover whisper trees on both Grid and Brain sides; complete the atomic doc-sync mandated by CLAUDE.md (STATE.md + ROADMAP.md + PHILOSOPHY.md + `scripts/check-state-doc-sync.mjs` all in the SAME commit).

Purpose: Lock the allowlist invariant at 22 so every subsequent wave inherits the sole-producer contract; make the producer-boundary test RED-ready so Wave 2 turns it GREEN by landing the emitter; wire three-tier plaintext and wall-clock invariants into CI from the first commit of this phase.

Output: 1 modified allowlist, 5 new source/type files (grid/dashboard/brain type trio + config + grid whisper package stub), 4 new RED test stubs, 2 modified CI gate scripts, 3 modified planning docs. Zero runtime behavior change yet; all Grid/Brain tests outside `test/whisper/` must remain green.
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

<interfaces>
<!-- Copy-verbatim analogs the executor MUST read before writing. -->

From grid/src/bios/types.ts (10b-03 shipped) — clone the closed-tuple + KEYS tuple pattern:
```ts
export interface BiosBirthPayload {
  readonly did: string;
  readonly tick: number;
  readonly psyche_hash: string;
}
export const BIOS_BIRTH_KEYS = ['did', 'psyche_hash', 'tick'] as const;  // alphabetical
```
Adapt to:
```ts
export interface NousWhisperedPayload {
  readonly ciphertext_hash: string;
  readonly from_did: string;
  readonly tick: number;
  readonly to_did: string;
}
export const WHISPERED_KEYS = ['ciphertext_hash', 'from_did', 'tick', 'to_did'] as const;  // alphabetical
```

From grid/src/audit/broadcast-allowlist.ts (current, 21 events) — append discipline:
- The `ALLOWLIST_MEMBERS` array holds the authoritative order. Append `'nous.whispered'` at the END (index 21) — NOT anywhere else. Array length must be 22 after edit.
- Add `export const WHISPER_FORBIDDEN_KEYS = Object.freeze(['text','body','content','message','utterance','offer','amount','ousia','price','value','plaintext','decrypted','payload_plain'] as const);`
- Extend `FORBIDDEN_KEY_PATTERN` regex alternation to include every WHISPER_FORBIDDEN_KEYS literal not already present. (Most of `amount|ousia|price|value|offer` may already exist from BIOS/ANANKE gate additions — de-dupe, do NOT re-add.)
- Preserve the Phase-10b dual-event attribution block (lines 40–48). Add a matching Phase-11 attribution block: "Phase 11 (WHISPER-04): +1 `nous.whispered` at position 22 — closed 4-tuple `{ciphertext_hash, from_did, tick, to_did}`; sole producer `grid/src/whisper/appendNousWhispered.ts` (to land in Wave 2). Per D-11-01 / CONTEXT-11."

From grid/test/bios/bios-producer-boundary.test.ts (10b-03 shipped) — clone verbatim into `grid/test/whisper/whisper-producer-boundary.test.ts`:
- Three `describe` blocks: (1) "'nous.whispered' literal appears only in allowlist + sole-producer + known-consumers", (2) "no file except appendNousWhispered.ts calls audit.append('nous.whispered', …)", (3) "forbidden siblings have zero hits".
- Known consumers whitelist: `const KNOWN_CONSUMERS_WHISPERED: string[] = [];` — initially empty. DialogueAggregator subscribes via `audit.onAppend`, not by literal-reference per D-11-10; it does NOT need to appear here. Rate-limiter / router / pending-store / routes / nous-runner pass the event symbolically via the emitter or via dispatch tables, so the literal does not appear in them. (If during Wave 2/3 a consumer genuinely must reference the literal, executor appends it here in the SAME commit.)
- Forbidden siblings: `['nous.whisper_broadcast', 'nous.whispered_plain', 'nous.whisper_rate_limited']` — zero hits in `grid/src/**`.
- This test MUST be RED at the end of Wave 0 because `grid/src/whisper/appendNousWhispered.ts` does not yet exist — assertion (1) will pass (only allowlist hit), assertion (2) will pass vacuously, but the file-exists probe on `appendNousWhispered.ts` MUST fail with a "sole producer file missing" message. Include that probe explicitly so Wave 2 sees a meaningful RED→GREEN flip.

From grid/src/relationships/config.ts (Phase 9 shipped) — clone for `grid/src/whisper/config.ts`:
- `Object.freeze({...} as const)` singleton. Env override in module init:
```ts
const envBudget = Number.parseInt(process.env.WHISPER_RATE_BUDGET ?? '', 10);
const envWindow = Number.parseInt(process.env.WHISPER_RATE_WINDOW_TICKS ?? '', 10);
export const WHISPER_CONFIG = Object.freeze({
  rateBudget: Number.isInteger(envBudget) && envBudget > 0 ? envBudget : 10,
  rateWindowTicks: Number.isInteger(envWindow) && envWindow > 0 ? envWindow : 100,
  envelopeVersion: 1,
} as const);
```
- NO `Date.now()`, NO `Math.random()` — wall-clock ban extends here per carry-forward §7 + D-11-13.

From dashboard/src/lib/protocol/ananke-types.ts (Plan 10a-05 shipped) — clone for `dashboard/src/lib/protocol/whisper-types.ts`:
- SYNC banner (top 20 lines). Adapt to TWO pointers per D-11-16:
```ts
/**
 * SYNC: mirrors grid/src/whisper/types.ts
 * SYNC: mirrors brain/src/noesis_brain/whisper/types.py
 *
 * Drift detected by dashboard/test/lib/whisper-types.drift.test.ts (lands in Wave 4).
 *
 * PRIVACY — WHISPER-02 render surface:
 *   Plaintext NEVER enters this file or any downstream dashboard module.
 *   Only counts and ciphertext_hash (opaque hex) may be mirrored here.
 *
 * Per Phase 10a, the fourth mirror is the threshold for consolidation into
 * @noesis/protocol-types. That refactor is logged as deferred and does NOT
 * block Phase 11.
 */
```
- Re-declare `NousWhisperedPayload` + `WHISPERED_KEYS` + `Envelope` verbatim (type-only; no runtime imports from grid/).

From brain/src/noesis_brain/bios/__init__.py (10b shipped) — clone for `brain/src/noesis_brain/whisper/__init__.py`:
- 1-10 line package re-export. For Wave 0 the package exports ONLY the types module (`from .types import NousWhisperedPayload, WHISPERED_KEYS`). Keyring/sender/receiver/etc. join in W1/W3.

For `brain/src/noesis_brain/whisper/types.py` — plain dataclass mirror (no PyNaCl import yet; types only):
```python
from dataclasses import dataclass

@dataclass(frozen=True)
class NousWhisperedPayload:
    ciphertext_hash: str
    from_did: str
    tick: int
    to_did: str

WHISPERED_KEYS = ("ciphertext_hash", "from_did", "tick", "to_did")
```

From scripts/check-wallclock-forbidden.mjs (Plan 10b-07 shipped) — the extension pattern:
- Locate the `TIER_A_ROOTS` array (Python trees, blanket ban).
- Locate the `TIER_B_TS_ROOTS` array (TypeScript trees, blanket ban except third-party).
- Append `'brain/src/noesis_brain/whisper'` to TIER_A_ROOTS.
- Append `'grid/src/whisper'` to TIER_B_TS_ROOTS.
- Dashboard whisper tree is render-only counts — does NOT need wall-clock ban (Dashboard already allows Date.now for UI state); do NOT extend to `dashboard/src/whisper/**`.
- `@fastify/rate-limit` is third-party — its internal Date.now usage is already exempt via the existing third-party import-only clause; do NOT modify that clause.

From scripts/check-state-doc-sync.mjs (Plan 10b-08 shipped) — the two edits:
- The hard-coded count literal (currently `"21 events"` or equivalent) bumps to `"22 events"`.
- The `required` array appends `'nous.whispered'` (order preserved — alphabetical or append-at-end, match existing convention).

STATE.md edit (atomic with this plan):
- In the "Broadcast allowlist (Phase 10b — post-ship, Plan 10b-03)" block:
  - Change heading to "Broadcast allowlist (Phase 11 — pre-ship, Plan 11-00)".
  - Change "**21 events.**" to "**22 events.**".
  - Append a line 22 entry: "22. `nous.whispered` ← NEW in Phase 11 (WHISPER-04) — Nous↔Nous envelope emission; closed 4-key payload `{ciphertext_hash, from_did, tick, to_did}`; sole producer `grid/src/whisper/appendNousWhispered.ts` · Phase 11 · D-11-01"
  - Under "Hard v2.2 invariants (inherited, non-negotiable)", append a new bullet:
    "- Hash-only whisper boundary — Brain↔Grid whisper plaintext NEVER crosses the wire. Grid sees only `{ciphertext_hash, nonce, ephemeral_pub, ciphertext(bytes), envelope_id}`. Ciphertext is deleted from Grid on recipient ack; audit chain retains `ciphertext_hash` forever. Keyring lives Brain-side only (D-11-04). Wall-clock ban extends to `grid/src/whisper/**` and `brain/src/noesis_brain/whisper/**` (D-11-13)."
  - Update "Session Continuity" block: "Stopped at: Phase 11 Wave 0 shipped — allowlist 21→22; RED stubs in place" and "Next action: `/gsd-execute-phase 11` Wave 1 (crypto core)".

ROADMAP.md edit (atomic with this plan):
- Phase 11 running-total line: ensure the "allowlist 21→22 with `nous.whispered`" note appears in the Phase 11 heading block (consistent with Phase 10a/10b format).

PHILOSOPHY.md edit (atomic with this plan):
- In the allowlist-invariant block, bump "21 events" → "22 events" and add `nous.whispered` to the enumeration if PHILOSOPHY carries an explicit list. Add a sentence under hash-only-cross-boundary: "Whisper plaintext is Brain-local forever; the audit chain retains only `ciphertext_hash`." Cite Phase 11 / WHISPER-02/03.
</interfaces>
</context>

<tasks>

<task id="11-W0-01" type="auto" tdd="true">
  <name>Task 11-W0-01: Bump broadcast allowlist 21→22 with `nous.whispered` + WHISPER_FORBIDDEN_KEYS</name>
  <requirement>WHISPER-04</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/src/audit/broadcast-allowlist.ts</files>
  <behavior>
    - ALLOWLIST_MEMBERS.length === 22 after edit
    - ALLOWLIST_MEMBERS[21] === 'nous.whispered'
    - Indices 0..20 byte-identical to pre-edit content (no reordering)
    - WHISPER_FORBIDDEN_KEYS exported as Object.freeze(['text','body','content','message','utterance','offer','amount','ousia','price','value','plaintext','decrypted','payload_plain'] as const)
    - FORBIDDEN_KEY_PATTERN includes every WHISPER_FORBIDDEN_KEYS literal (de-duped)
    - Existing grid/test/audit/broadcast-allowlist.test.ts passes after planned update to assert length 22 + index-21 literal
  </behavior>
  <action>
Append `'nous.whispered'` at the end of ALLOWLIST_MEMBERS (index 21). Do NOT touch any other member or reorder. Add `WHISPER_FORBIDDEN_KEYS` const and extend `FORBIDDEN_KEY_PATTERN` regex (alternation, de-dupe against existing literals from BIOS/CHRONOS/OPERATOR additions). Append a Phase-11 attribution comment block mirroring Phase-10b's (lines 40–48) — cite D-11-01 + WHISPER-04 + sole-producer file `grid/src/whisper/appendNousWhispered.ts` (which lands in Wave 2). Update `grid/test/audit/broadcast-allowlist.test.ts` (if it enumerates 21 explicitly) to assert 22 + index-21 literal. NO new allowlist entries beyond the single `nous.whispered` addition (D-11-01 guardrail).
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/audit/broadcast-allowlist.test.ts --reporter=dot</automated>
  </verify>
  <done>
    Allowlist test green at length 22 with index-21 === 'nous.whispered'; WHISPER_FORBIDDEN_KEYS exported; FORBIDDEN_KEY_PATTERN covers all whisper keys.
  </done>
</task>

<task id="11-W0-02" type="auto" tdd="true">
  <name>Task 11-W0-02: Ship closed-tuple type trio (grid + dashboard mirror + brain mirror) + grid whisper package stub</name>
  <requirement>WHISPER-03</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/src/whisper/types.ts, grid/src/whisper/config.ts, dashboard/src/lib/protocol/whisper-types.ts, brain/src/noesis_brain/whisper/__init__.py, brain/src/noesis_brain/whisper/types.py</files>
  <behavior>
    - grid/src/whisper/types.ts exports NousWhisperedPayload (4 readonly keys) + WHISPERED_KEYS tuple + Envelope interface (5 keys: to_did, nonce_b64, ephemeral_pub_b64, ciphertext_b64, envelope_id)
    - WHISPERED_KEYS is alphabetical ['ciphertext_hash','from_did','tick','to_did']
    - grid/src/whisper/config.ts exports WHISPER_CONFIG = Object.freeze({rateBudget, rateWindowTicks, envelopeVersion:1}); env override via WHISPER_RATE_BUDGET / WHISPER_RATE_WINDOW_TICKS (positive int else default 10/100)
    - dashboard/src/lib/protocol/whisper-types.ts re-declares the same types (type-only) with TWO SYNC-pointer header comments (grid + brain)
    - brain/src/noesis_brain/whisper/types.py declares the same payload as @dataclass(frozen=True) + WHISPERED_KEYS tuple
    - brain/src/noesis_brain/whisper/__init__.py re-exports ONLY the types (keyring/sender/receiver absent until Wave 1/3)
    - Grid, Brain, and Dashboard typecheck after addition (tsc --noEmit / mypy / next typecheck all green)
    - No Date.now, Math.random, time.time, datetime.now in any of these files (wall-clock ban enforced by Task 11-W0-05)
  </behavior>
  <action>
Clone per &lt;interfaces&gt; analogs. Place SYNC header on dashboard mirror with BOTH pointers (D-11-16). Use path `dashboard/src/lib/protocol/whisper-types.ts` (NOT `dashboard/src/protocol/...`) — matches existing ananke/agency/audit mirror convention per PATTERNS.md §dashboard/src path note. Config file MUST reject negative/NaN env overrides (fall back to default with single console.warn). Export type + tuple + interface from grid/src/whisper/types.ts with no runtime-side-effectful code.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx tsc --noEmit &amp;&amp; cd ../dashboard &amp;&amp; npx tsc --noEmit &amp;&amp; cd ../brain &amp;&amp; python -c "from noesis_brain.whisper.types import NousWhisperedPayload, WHISPERED_KEYS; assert WHISPERED_KEYS == ('ciphertext_hash','from_did','tick','to_did')"</automated>
  </verify>
  <done>
    All three typecheckers pass; Python assertion passes; five files exist with correct exports; no wall-clock literals.
  </done>
</task>

<task id="11-W0-03" type="auto" tdd="true">
  <name>Task 11-W0-03: Land four RED stubs in grid/test/whisper/ (producer-boundary, crypto, wire-format, rate-limit)</name>
  <requirement>WHISPER-01, WHISPER-03, WHISPER-05</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>grid/test/whisper/whisper-producer-boundary.test.ts, grid/test/whisper/whisper-crypto.test.ts, grid/test/whisper/whisper-wire-format.test.ts, grid/test/whisper/whisper-rate-limit.test.ts</files>
  <behavior>
    - `grid/test/whisper/` directory exists
    - whisper-producer-boundary.test.ts: clones grid/test/bios/bios-producer-boundary.test.ts three-describe structure verbatim with string substitutions; KNOWN_CONSUMERS_WHISPERED=[]; forbidden siblings ['nous.whisper_broadcast','nous.whispered_plain','nous.whisper_rate_limited']; explicit file-exists probe for `grid/src/whisper/appendNousWhispered.ts` → RED at W0 end
    - whisper-crypto.test.ts: expects importable `encryptFor` / `decryptFrom` / `deriveNonce` / `hashCiphertext` from grid/src/whisper/crypto.ts → RED at W0 (module absent)
    - whisper-wire-format.test.ts: asserts Object.keys(payload).sort() strict-equality against WHISPERED_KEYS; DID_RE on from_did + to_did; from_did !== to_did; tick non-negative integer; ciphertext_hash /^[0-9a-f]{64}$/; nonce_b64 exactly 32 chars → RED at W0 (emitter absent; the test imports from appendNousWhispered which does not exist)
    - whisper-rate-limit.test.ts: B=10/N=100 accept/reject matrix stub importing `RateLimiter` from grid/src/whisper/rate-limit.ts → RED at W0 (module absent)
    - RED failures are compilation or import errors, NOT runtime false assertions; every test file must itself typecheck
  </behavior>
  <action>
Copy `grid/test/bios/bios-producer-boundary.test.ts` verbatim to `grid/test/whisper/whisper-producer-boundary.test.ts`. Substitute: `bios.birth` → `nous.whispered`; `appendBiosBirth.ts` → `appendNousWhispered.ts`; `KNOWN_CONSUMERS_BIOS_BIRTH` → `KNOWN_CONSUMERS_WHISPERED` (initial value `[]`); forbidden-siblings list to `['nous.whisper_broadcast','nous.whispered_plain','nous.whisper_rate_limited']`. Preserve the three describe blocks 1:1.

For the other three stubs: author minimal imports + `it.todo` markers BUT include at least one real assertion that forces the file to fail by resolving a module that does not yet exist (use a `beforeAll` dynamic import and `expect(() => import('…')).not.toThrow()` pattern if vitest's static import cannot be caught). The tests MUST import from the target module path so that Wave 1/2 turns them GREEN by creating the module — not by editing the test.

Keep stubs as lean as possible — no fixture data beyond what's needed to make them compile. Wave 2 will expand to full matrices.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/whisper/ --reporter=dot 2>&amp;1 | tee /tmp/w0-red.log; grep -qE "(failed|FAIL)" /tmp/w0-red.log</automated>
  </verify>
  <done>
    All four tests execute (no TypeScript compile failure in the test files themselves) but FAIL at the module-resolution or file-exists step. Passing tests at this stage is a bug — every stub must be RED.
  </done>
</task>

<task id="11-W0-04" type="auto" tdd="false">
  <name>Task 11-W0-04: Extend wall-clock-forbidden gate to whisper trees</name>
  <requirement>WHISPER-02</requirement>
  <threat_ref>T-10-03</threat_ref>
  <files>scripts/check-wallclock-forbidden.mjs</files>
  <behavior>
    - TIER_A_ROOTS includes 'brain/src/noesis_brain/whisper'
    - TIER_B_TS_ROOTS includes 'grid/src/whisper'
    - Dashboard whisper tree NOT in either roots array (counts-only UI, Date.now allowed for UI tick)
    - @fastify/rate-limit third-party exemption clause unchanged
    - Script still exits 0 on current tree (whisper dirs empty or contain only types.ts/config.ts which have no wall-clock refs)
  </behavior>
  <action>
Per &lt;interfaces&gt; analog. Add the two roots; preserve alphabetical/append-at-end ordering per existing convention. Do NOT introduce new ban modes; inherit Phase 10b Tier-A semantics. Verify the script passes locally against the Wave 0 tree (grid/src/whisper/ has only types.ts + config.ts; brain/src/noesis_brain/whisper/ has only __init__.py + types.py; none contain Date.now/time.time/etc).
  </action>
  <verify>
    <automated>node scripts/check-wallclock-forbidden.mjs</automated>
  </verify>
  <done>
    Script exits 0; the two new roots are present (grep `grid/src/whisper` scripts/check-wallclock-forbidden.mjs returns ≥1 hit; same for `brain/src/noesis_brain/whisper`).
  </done>
</task>

<task id="11-W0-05" type="auto" tdd="false">
  <name>Task 11-W0-05: Atomic doc-sync — STATE + ROADMAP + PHILOSOPHY + check-state-doc-sync.mjs in one commit</name>
  <requirement>WHISPER-04</requirement>
  <threat_ref>T-10-01</threat_ref>
  <files>scripts/check-state-doc-sync.mjs, .planning/STATE.md, .planning/ROADMAP.md, PHILOSOPHY.md</files>
  <behavior>
    - scripts/check-state-doc-sync.mjs literal "21 events" → "22 events"
    - scripts/check-state-doc-sync.mjs `required` array contains 'nous.whispered'
    - STATE.md Accumulated Context enumeration lists 22 allowlist members with #22 = `nous.whispered`
    - STATE.md carry-forward section adds the hash-only-whisper-boundary invariant (D-11-04 + D-11-13 refs)
    - STATE.md Session Continuity block updated (Phase 11 Wave 0 shipped; next = W1 crypto)
    - ROADMAP.md Phase 11 heading block notes "allowlist 21→22 with `nous.whispered`"
    - PHILOSOPHY.md allowlist-invariant section reflects 22 events + whisper hash-only-cross-boundary sentence
    - `node scripts/check-state-doc-sync.mjs` exits 0 against the updated STATE.md
  </behavior>
  <action>
Make ALL four edits in ONE git commit with message `plan(11): wave 0 — setup` (the orchestrator handles the commit per its instruction to commit each plan individually; this task ensures all four files are staged together). Do NOT split into two commits — CLAUDE.md's doc-sync rule mandates atomic updates.

STATE.md — see &lt;interfaces&gt; block for exact edits. Heading + enumeration + invariants + Session Continuity.

ROADMAP.md — locate Phase 11 heading block; add or update the running-total marker to "allowlist 21→22 with `nous.whispered`". If a line already enumerates per-phase allowlist deltas, append there.

PHILOSOPHY.md — bump "21 events" → "22 events" wherever it appears; append `nous.whispered` to any explicit list. Under the hash-only-cross-boundary principle, add: "Whisper plaintext is Brain-local forever; the audit chain retains only `ciphertext_hash`. (Phase 11 / WHISPER-02/03 / D-11-04)."

scripts/check-state-doc-sync.mjs — bump literal and append to required array per &lt;interfaces&gt;.
  </action>
  <verify>
    <automated>node scripts/check-state-doc-sync.mjs &amp;&amp; grep -q "22 events" scripts/check-state-doc-sync.mjs &amp;&amp; grep -q "nous.whispered" .planning/STATE.md &amp;&amp; grep -q "22 events" PHILOSOPHY.md</automated>
  </verify>
  <done>
    Doc-sync gate exits 0; all four documents reference the 22-event allowlist with nous.whispered; single-commit atomicity preserved.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Operator → Grid allowlist | New event type crosses policy boundary; must be allowlisted BEFORE any producer lands |
| Grid ↔ Dashboard types | Hand-copied fourth mirror — drift risk (D-11-16); SYNC pointers + Wave 4 drift detector |
| Brain ↔ Grid types | Shared closed-tuple contract; Python dataclass mirrors TS interface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-W0-01 | Tampering | broadcast-allowlist.ts | mitigate | Attribution block + test asserts length 22 + index-21 literal; CI regression via `check-state-doc-sync.mjs` |
| T-11-W0-02 | Information Disclosure | types.ts / dashboard mirror | mitigate | Envelope interface carries opaque base64 fields; no plaintext keys; PRIVACY header in dashboard mirror explicitly forbids downstream plaintext |
| T-11-W0-03 | Elevation of Privilege | scripts/check-wallclock-forbidden.mjs | mitigate | Tier-A/B roots extended; blanket ban inherited from Phase 10b |
| T-11-W0-04 | Repudiation | STATE.md / ROADMAP / PHILOSOPHY doc-sync | mitigate | Atomic single-commit edit; doc-sync gate enforces consistency |
| T-11-W0-05 | Denial of Service | — | accept | Wave 0 ships no runtime code paths; DoS surface unchanged |
</threat_model>

<verification>
After all five tasks land:
- `cd grid && npm test` — all pre-existing tests green; whisper stubs RED as intended (producer-boundary expects missing emitter)
- `cd grid && npx vitest run test/whisper/ --reporter=dot` — 4 test files, all RED for module-resolution reasons
- `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts` — GREEN at 22 events
- `cd grid && npx tsc --noEmit` — GREEN
- `cd dashboard && npx tsc --noEmit` — GREEN (fourth mirror compiles)
- `cd brain && python -c "from noesis_brain.whisper.types import WHISPERED_KEYS; assert WHISPERED_KEYS == ('ciphertext_hash','from_did','tick','to_did')"` — exit 0
- `node scripts/check-state-doc-sync.mjs` — exit 0
- `node scripts/check-wallclock-forbidden.mjs` — exit 0
- `grep -c "nous.whispered" grid/src/audit/broadcast-allowlist.ts` — ≥1
- `grep -c "22 events" scripts/check-state-doc-sync.mjs` — ≥1
- Regression hash from Plan 10b zero-diff fixture UNCHANGED (Wave 0 ships no runtime emission path; no new chain entries emitted yet).
</verification>

<success_criteria>
1. Broadcast allowlist at length 22 with `nous.whispered` at index 21; no other members moved.
2. Four RED whisper test stubs present and failing at module-resolution step.
3. Five new source/type files (grid types + config, dashboard mirror, brain __init__ + types) typecheck clean across all three trees.
4. Two CI gates (state-doc-sync + wall-clock-forbidden) pass against updated tree.
5. Atomic doc-sync: STATE.md + ROADMAP.md + PHILOSOPHY.md + check-state-doc-sync.mjs in ONE commit, all referencing 22 events + `nous.whispered`.
6. Pre-Phase-11 test suites (grid/brain/dashboard outside whisper/) remain byte-stable green — no regressions.
7. Zero-diff regression hash from Plan 10b unchanged (no runtime emission yet).
</success_criteria>

<output>
After completion, create `.planning/phases/11-mesh-whisper/11-00-setup/SUMMARY.md` capturing the five task outcomes, the four RED stub states, and the exact STATE.md diff so Wave 1 can reference it.
</output>
