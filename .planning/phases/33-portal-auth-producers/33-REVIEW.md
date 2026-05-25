---
phase: 33-portal-auth-producers
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - .github/workflows/rig-invariants.yml
  - grid/src/__tests__/audit-query-perf.test.ts
  - grid/src/api/portal/auth.ts
  - grid/src/audit/append-human-identified.ts
  - grid/src/audit/append-portal-auth-login.ts
  - grid/src/audit/append-portal-auth-register.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/governance/appendBallotCommitted.ts
  - grid/src/governance/appendBallotRevealed.ts
  - grid/src/governance/appendLawTriggered.ts
  - grid/src/governance/appendProposalOpened.ts
  - grid/src/governance/appendProposalTallied.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/human-identified.test.ts
  - grid/test/portal-auth-forbidden-keys.test.ts
  - grid/test/portal-auth-wiring.test.ts
  - grid/test/portal-auth-login.test.ts
  - grid/test/portal-auth-register.test.ts
  - scripts/check-sole-producer-discipline.mjs
  - scripts/check-state-doc-sync.mjs
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 33 introduces three sole-producer audit emitters (`appendPortalAuthLogin`, `appendPortalAuthRegister`, `appendHumanIdentified`), wires them into four auth route call-sites in `auth.ts`, adds six test files, extends `PORTAL_AUTH_FORBIDDEN_KEYS`, and adds two CI gates.

The closed-payload + enum-guard pattern is implemented correctly and consistently across all three new producers. PII discipline is sound: raw email, raw ETH address, IP, User-Agent, session tokens, and similar fields never reach `audit.append`. The `\b`-bounded regex semantics are correctly documented and the word-boundary test file pins the exact JS behavior (compound forms pass the regex, closed-tuple catches them). The governance files' addition of `payloadPrivacyCheck` is correct and does not alter existing behavior.

Three warnings are raised: one functional (the `check-state-doc-sync.mjs` script asserts a stale count in STATE.md), one potential audit-consistency gap (law.triggered not fired if proposal body JSON is malformed, after `proposal.tallied` is already committed), and one operational oversight (`check-state-doc-sync.mjs` is never invoked in CI). Two info items cover a cosmetic duplicate step label and the perf-test env-var mismatch.

No critical issues found.

---

## Warnings

### WR-01: `check-state-doc-sync.mjs` asserts "53 events" in STATE.md but the script's own success log says "56 members" — count assertion will pass on stale STATE.md language

**File:** `scripts/check-state-doc-sync.mjs:53`

**Issue:** Invariant 1 in `check-state-doc-sync.mjs` asserts `/53\s+events/i` must appear in `STATE.md`. The script's success message (line 252) says "v2.5: 53 events + Phase 33: 56 members" — confirming the intent is that STATE.md retains the v2.5-era "53 events" section header while the actual code count moves to 56. This is intentional per the script comments, but it means the script's "doc-sync" guarantee is weaker than it appears: a STATE.md that enumerates only 53 events (the v2.5 set) would pass invariant 1 even after Phase 33 ships. The 56-member check is handled only by `checkAllowlistCount()` against the source file, not against STATE.md. If the goal is to assert STATE.md reflects the Phase 33 additions, the invariant should check for the Phase 33 count (56) or the presence of the three new event names in the STATE.md enumeration section.

STATE.md currently does enumerate the three new events (the `required` array in the script includes them, and the STATE.md text passes that check). But invariant 1 alone would not fail even if someone deleted those three entries from STATE.md while the "53 events" heading remained.

**Fix:** Either update invariant 1 to match `/56\s+members/i` (the new count) or change the section header in STATE.md from "53 events" to "56 events" and update the assertion accordingly. The cleanest fix is to update invariant 1:

```js
// scripts/check-state-doc-sync.mjs line 53
// Change:
if (!/53\s+events/i.test(state)) {
// To:
if (!/56\s+(?:events|members)/i.test(state)) {
```

And update the STATE.md section header:
```markdown
### Broadcast allowlist (v2.6 end-state — 56 events)
```

---

### WR-02: `check-state-doc-sync.mjs` is not invoked by any CI workflow — the doc-sync gate provides no automated protection

**File:** `scripts/check-state-doc-sync.mjs:1`

**Issue:** The file exists and runs correctly as a script, but neither `rig-invariants.yml` nor `nightly-rig-bench.yml` calls it. The `rig-invariants.yml` workflow (lines 24–44) runs four other check scripts plus the Vitest suite, but omits `check-state-doc-sync.mjs`. The `check-sole-producer-discipline.mjs` (Phase 33's new gate) IS wired in at line 36–37 of `rig-invariants.yml`. The doc-sync script can only be run manually.

This means STATE.md can drift from the allowlist without any PR blocking signal. Given the script already validates `checkAllowlistCount()` against the live source file (important protection), this is worth fixing.

**Fix:** Add a step to `rig-invariants.yml` after the existing gate steps:

```yaml
      - name: STATE.md doc-sync gate (Phase 5+)
        run: node scripts/check-state-doc-sync.mjs
```

---

### WR-03: `appendProposalTallied` commits `proposal.tallied` to the audit chain before calling `appendLawTriggered` — a malformed `body_text` leaves the chain in an inconsistent state

**File:** `grid/src/governance/appendProposalTallied.ts:113`

**Issue:** When `tally.outcome === 'passed'`, the function appends `proposal.tallied` to the audit chain (line 113), then attempts to parse `proposal.body_text` as JSON and call `appendLawTriggered` (lines 116–128). If `JSON.parse` throws (malformed body), the catch block re-throws (line 121), causing the function to fail with an error — but `proposal.tallied` is already committed to the immutable chain. The audit record says "proposal passed" but no `law.triggered` event follows. Consumers querying the chain for `law.triggered` after `proposal.tallied` with `outcome=passed` will find an orphan.

This is pre-existing Phase 12 code (not introduced by Phase 33's `payloadPrivacyCheck` additions), but the Phase 33 deviation added `payloadPrivacyCheck` calls to these files and the comment trail suggests this was reviewed. The DB write at line 106 (`updateProposalTallied`) correctly precedes `audit.append`, following the DB-write-first pattern, but the law trigger ordering is reversed relative to the audit append.

**Fix:** Move the `audit.append('proposal.tallied', ...)` call to after the law trigger, or validate `body_text` as parseable JSON before any DB write or audit append:

```typescript
// Validate body parsability BEFORE DB write and audit.append (when outcome is 'passed')
if (tally.outcome === 'passed') {
    try {
        law = JSON.parse(proposal.body_text) as Law;
    } catch {
        throw new Error(`proposal.tallied: body_text is not valid JSON Law for proposal ${input.proposal_id}`);
    }
}

// 10. DB write
await input.store.updateProposalTallied({ ... });

// 11. Audit append
audit.append('proposal.tallied', ...);

// 12. Law trigger (now safe — law was pre-validated)
if (tally.outcome === 'passed') {
    await appendLawTriggered(audit, { law, ... });
}
```

---

## Info

### IN-01: Duplicate step number "// 11." in `appendProposalTallied`

**File:** `grid/src/governance/appendProposalTallied.ts:112`

**Issue:** Two sequential comments are both labeled `// 11.` — line 112 labels the audit append step, and line 115 labels the law-trigger step. The numbering should be 11 and 12 respectively (or the existing comment at line 115 `// 11. On outcome...` should be `// 12. On outcome...`). This causes confusion when cross-referencing the implementation steps.

**Fix:**
```typescript
// 11. Audit append (sole-producer line)
audit.append('proposal.tallied', ...);

// 12. On outcome === 'passed': parse body_text as Law and trigger law.triggered
if (tally.outcome === 'passed') {
```

---

### IN-02: `audit-query-perf.test.ts` uses `NOESIS_RUN_PERF` but the nightly workflow sets `NOESIS_RUN_NIGHTLY` — the perf benchmark is never executed in any CI context

**File:** `grid/src/__tests__/audit-query-perf.test.ts:21`

**Issue:** The perf test guards on `process.env['NOESIS_RUN_PERF']` (line 21). The nightly workflow (`nightly-rig-bench.yml`) sets `NOESIS_RUN_NIGHTLY=1` but not `NOESIS_RUN_PERF`. Additionally, `rig-invariants.yml` runs only `test/rig/` (not `src/__tests__/`), so the file is not even in scope for the PR gate. Per D-33-C1, this is intentional ("soft-log only; trend monitoring is the operator's responsibility"). However, there is no path — not even the nightly job — that ever executes this test. If operator inspection of CI logs is the intended mechanism, the mechanism does not exist.

This is an info-level item because D-33-C1 explicitly scopes this as human-driven monitoring, not a CI assertion. But if the intent is ever to run the benchmark in nightly, the env var name should be `NOESIS_RUN_NIGHTLY` (consistent with Phase 32's rig-bench skip pattern which the test comment references), or the nightly workflow should additionally set `NOESIS_RUN_PERF=1`.

**Fix (if automated nightly run is desired):**
```typescript
// grid/src/__tests__/audit-query-perf.test.ts line 21
// Change:
if (!process.env['NOESIS_RUN_PERF']) {
// To (consistent with Phase 32 rig-bench pattern):
if (!process.env['NOESIS_RUN_NIGHTLY'] && !process.env['NOESIS_RUN_PERF']) {
```

Or add `NOESIS_RUN_PERF: '1'` to `nightly-rig-bench.yml` env block.

---

## Verification of Key Design Decisions

The following items were explicitly flagged for scrutiny and are confirmed correct:

**D-33-B4 word-boundary semantics:** Verified with live Node.js execution. `\buser_agent\b` correctly rejects `user_agent` and correctly passes `user_agent_version` (because `_` is `\w`, so no word boundary fires between `t` and `_`). Same for `\bip_address\b`, `\bsession_id\b`, `\bjwt\b`, `\bpassword_hash\b`, `\bdevice_fingerprint\b`. The test file (`portal-auth-forbidden-keys.test.ts`) pins this behavior explicitly with a comment anchored to D-33-B4. Test coverage for compound-form pass-through is present and accurate.

**content_hash lookahead:** `content(?!_hash)` correctly allows `content_hash` (for hash-carrying keys) while blocking `content` as a standalone key. Verified by regex execution.

**PII non-leakage across all 4 auth call-sites:** All four call-sites in `auth.ts` were inspected:
- SIWE first-connect (lines 128–162): raw `ethAddress` is hashed before `appendHumanJoined`; the hash reused as `identity_hash` in `appendHumanIdentified`; only `human_did`, `method`, `tick` cross into `appendPortalAuthLogin` and `appendPortalAuthRegister`.
- SIWE repeat-connect (line 158): only `appendPortalAuthLogin` fires, with `{human_did, method, tick}`.
- Email signup (lines 232–249): `email` is hashed before use; only the hash enters `appendHumanIdentified`; raw email never reaches any producer.
- Email signin (line 315): only `appendPortalAuthLogin` fires.

No PII reaches the audit chain in any path.

**Governance `payloadPrivacyCheck` additions (33-06 auto-deviation):** All five governance sole-producer files now call `payloadPrivacyCheck` before `audit.append`. The calls are structurally correct — they run on the already-validated `payload` object after the closed-tuple check, as a belt-and-suspenders gate. No existing behavior is altered since none of the governance payload keys match `FORBIDDEN_KEY_PATTERN`.

**`check-sole-producer-discipline.mjs` correctness:** The script correctly finds violations. It performs a plain-string `includes` check for three triad elements (`Object.keys(payload).sort()`, `payloadPrivacyCheck`, `audit.append(`). All governance files contain all three. The `walkDir` function is recursive and correctly excludes `.test.ts` files. Exit code 1 fires when violations exist. The script is correctly wired into `rig-invariants.yml` at line 36–37.

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
