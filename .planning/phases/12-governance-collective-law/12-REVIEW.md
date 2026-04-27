---
phase: 12-governance-collective-law
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - PHILOSOPHY.md
  - README.md
  - brain/src/noesis_brain/governance/__init__.py
  - brain/src/noesis_brain/governance/commit_reveal.py
  - brain/src/noesis_brain/governance/proposer.py
  - brain/src/noesis_brain/governance/state.py
  - brain/src/noesis_brain/governance/types.py
  - brain/src/noesis_brain/governance/voter.py
  - brain/src/noesis_brain/rpc/types.py
  - grid/src/api/governance/_validation.ts
  - grid/src/api/governance/routes.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/governance/appendBallotCommitted.ts
  - grid/src/governance/appendBallotRevealed.ts
  - grid/src/governance/appendLawTriggered.ts
  - grid/src/governance/appendProposalOpened.ts
  - grid/src/governance/appendProposalTallied.ts
  - grid/src/governance/commit-reveal.ts
  - grid/src/governance/engine.ts
  - grid/src/governance/errors.ts
  - grid/src/governance/replay.ts
  - grid/src/governance/store.ts
  - grid/src/governance/tally.ts
  - grid/src/governance/types.ts
  - grid/src/governance/config.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/integration/types.ts
  - dashboard/src/app/grid/governance/governance-dashboard.tsx
  - dashboard/src/app/grid/governance/use-governance-proposals.ts
  - dashboard/src/app/grid/governance/voting-history-modal.tsx
  - scripts/check-governance-isolation.mjs
  - scripts/check-governance-plaintext.mjs
  - scripts/check-governance-weight.mjs
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

Phase 12 implements a commit-reveal governance system — the most security-sensitive subsystem in the codebase to date. The overall architecture is solid: sole-producer boundary enforcement, closed-tuple payload discipline, operator-exclusion invariants, the DB-write-before-audit-append ordering, and cross-language hash formula parity (TS ↔ Python) are all correctly implemented.

Two critical issues were found: (1) commits and reveals can be accepted against a proposal that has already been tallied (status='tallied'), enabling post-close ballot stuffing; and (2) the `ballot.revealed` emitter does not guard against re-revelation, allowing an already-revealed voter to overwrite their stored nonce/choice in the DB (and emit a second `ballot.revealed` audit event). Four warnings cover weaker-than-intended voter identity validation in the commit/reveal HTTP routes, a nonce regex inconsistency, an unsafe Law type-cast on tally, and non-deterministic vote choice in the v2.2 placeholder. Three info items cover the `evaluate_choice` Python hash() non-portability, dead import, and a toggle-logic bug in the body expansion handler.

---

## Critical Issues

### CR-01: Commits and reveals accepted on already-tallied proposals

**File:** `grid/src/api/governance/routes.ts:232-242` and `grid/src/governance/appendBallotCommitted.ts:55-57`

**Issue:** The commit route fetches the proposal to check the deadline tick (`committedAtTick > proposal.deadline_tick`), but never checks `proposal.status`. If a proposal has been tallied (status='tallied') but its deadline_tick has not yet passed in the client-provided tick, a Nous can still submit a commit (and its ballot will be stored). Similarly, the reveal route does not fetch the proposal at all — it only checks whether a ballot row exists for the voter. Neither `appendBallotCommitted` nor `appendBallotRevealed` fetches the proposal to validate its status. This means:

- A Nous can commit a ballot against a proposal that has already been tallied.
- A Nous can reveal a ballot against a proposal that has already been tallied.
- If `onTickClosed` races with an HTTP commit (concurrent tally + commit), both can succeed.
- The stored ballot affects no outcome (tally already ran), but the audit chain records a `ballot.committed` or `ballot.revealed` event for a closed proposal — corrupting the audit record and potentially misleading forensic analysis.

In a system where the audit chain is tamper-evident and the record outlives the Nous, phantom post-tally events are a significant integrity violation.

**Fix:** In `appendBallotCommitted` and `appendBallotRevealed`, fetch the proposal and reject if status is not 'open':

```typescript
// appendBallotCommitted.ts — add after step 3 (proposal_id validation)
const proposal = await input.store.getProposal(input.proposal_id);
if (!proposal) {
    throw new GovernanceError('proposal_not_found', 404);
}
if (proposal.status !== 'open') {
    throw new GovernanceError('proposal_closed', 422);
}
```

```typescript
// appendBallotRevealed.ts — add after step 4 (proposal_id validation),
// before the getBallot call
const proposal = await input.store.getProposal(input.proposal_id);
if (!proposal) {
    throw new GovernanceError('proposal_not_found', 404);
}
if (proposal.status !== 'open') {
    throw new GovernanceError('proposal_closed', 422);
}
```

The HTTP routes should also surface the new error code as a 422 response.

---

### CR-02: Re-revelation not guarded — double ballot.revealed audit event possible

**File:** `grid/src/governance/appendBallotRevealed.ts:66-112`

**Issue:** `appendBallotRevealed` checks that a ballot row exists (step 5: `getBallot`) and that the hash verifies (step 6: `verifyReveal`), but it does not check whether the ballot has already been revealed (`ballotRow.revealed === 1`). If a voter calls the reveal endpoint twice with the same (or different) valid preimage:

1. First call: `revealed=0` → verification passes → DB updated to `revealed=1`, choice/nonce stored → `ballot.revealed` emitted.
2. Second call: `revealed=1` → `getBallot` still returns the row → `verifyReveal` still passes (same hash) → `updateBallotReveal` runs again (MySQL `UPDATE` succeeds, overwriting with identical data) → second `ballot.revealed` audit event emitted.

This allows a voter to generate two `ballot.revealed` entries in the audit chain for one proposal. `getRevealsForProposal` filters by `revealed = 1` and could return the voter twice if the in-memory store's `Map` semantics differ from MySQL's row-based SELECT (the in-memory store uses a `Map` keyed by `proposal_id::voter_did` which would deduplicate, but the SQL query has no DISTINCT). Even if the tally count is not doubled in the SQL path (a subsequent MySQL SELECT might return only one row per voter), the audit chain will contain an illegitimate second event, and the in-memory store used by tests will silently deduplicate it, hiding the bug.

**Fix:** In `appendBallotRevealed`, check `ballotRow.revealed` before proceeding:

```typescript
// appendBallotRevealed.ts — after step 5 (getBallot fetch)
if (ballotRow.revealed === 1) {
    throw new GovernanceError('ballot_already_revealed', 409);
}
```

The HTTP reveal route should map this new `GovernanceError` code to a 409 response.

---

## Warnings

### WR-01: Commit route skips registry membership check for voter DIDs

**File:** `grid/src/api/governance/routes.ts:211-215`

**Issue:** The commit route (POST `/proposals/:id/ballots/commit`) checks only `registry.isTombstoned(voterDid)`. The comment at line 211 says "registry membership check is optional for voters — they may be any active Nous", but this contradicts `_validation.ts`'s `validateVoterDid`, which explicitly checks both registry membership AND tombstone status, and whose doc comment states "voters MUST be NousRegistry members". The reveal route has the same pattern. A non-existent DID that passes the regex can submit a commit — this is an operator-exclusion gap: an operator could craft a DID that is not in the registry but passes the regex, allowing a ghost voter to participate.

The sole-producer emitters (`appendBallotCommitted`, `appendBallotRevealed`) do not validate registry membership either, so the defense-in-depth check is absent at both layers.

**Fix:** Replace the inline tombstone-only check in both commit and reveal routes with `validateVoterDid`:

```typescript
// routes.ts — commit handler, replace lines 207-215 with:
const didResult = validateVoterDid(voterDid, registry);
if (!didResult.ok) {
    reply.code(didResult.status);
    return { error: didResult.error };
}
```

Apply the same substitution in the reveal handler (replace lines 288-295).

---

### WR-02: Nonce regex inconsistency — lowercase-only at wire boundary vs case-insensitive at hash boundary

**File:** `grid/src/api/governance/_validation.ts:28` and `grid/src/governance/commit-reveal.ts:37`

**Issue:** The `NONCE_RE` exported from `_validation.ts` and used in both the route handler and `appendBallotRevealed` is `/^[0-9a-f]{32}$/` — strictly lowercase. The `computeCommitHash` function in `commit-reveal.ts` accepts `/^[0-9a-fA-F]+$/` (case-insensitive, line 37) and normalizes to lowercase via `nonce.toLowerCase()` (line 43). These two validators are inconsistent: a nonce with uppercase hex chars would fail the route/emitter validation but would be accepted by `computeCommitHash`. This is not a current attack vector (Brain generates lowercase nonces via `secrets.token_hex`), but if any code path produces an uppercase nonce (e.g., a third-party Brain implementation), the reveal will be silently rejected at validation rather than producing a clear hash-mismatch error. The inconsistency also makes the validation semantics harder to reason about.

**Fix:** Make `NONCE_RE` case-insensitive to match `computeCommitHash`:

```typescript
// _validation.ts:28 and appendBallotRevealed.ts:29 — change to:
export const NONCE_RE = /^[0-9a-fA-F]{32}$/i;
```

Or alternatively, normalize nonces to lowercase at the route boundary before validation, mirroring the `computeCommitHash` behavior.

---

### WR-03: Unsafe `JSON.parse(...) as Law` cast — unvalidated Law object reaches LogosEngine

**File:** `grid/src/governance/appendProposalTallied.ts:112`

**Issue:** When a proposal passes, `appendProposalTallied` parses `proposal.body_text` as a `Law` object using a bare `JSON.parse(proposal.body_text) as Law`. The `as Law` is a TypeScript type assertion — it performs no runtime validation. A malformed or adversarially crafted `body_text` (e.g., missing required `id`, `ruleLogic`, `severity`, or `status` fields) will pass through and be handed to `logos.addLaw(input.law)` (line 58 of `appendLawTriggered.ts`). If `LogosEngine.addLaw` does not validate the Law schema, a passed proposal could inject a structurally invalid Law object into the active-laws set, potentially causing downstream evaluation failures or bypassing law conditions.

This is a governance-specific integrity concern: the body_text is stored at proposal-open time but only parsed at tally time, after the voting period. An attacker who can control body_text at proposal time can inject any JSON.

**Fix:** Add a runtime schema validation step after parsing:

```typescript
// appendProposalTallied.ts:111-115 — add a schema guard:
let law: Law;
try {
    const parsed = JSON.parse(proposal.body_text) as unknown;
    // Structural guard — verify minimum required Law fields are present
    if (
        typeof parsed !== 'object' || parsed === null ||
        typeof (parsed as Record<string, unknown>)['id'] !== 'string' ||
        typeof (parsed as Record<string, unknown>)['ruleLogic'] !== 'object' ||
        typeof (parsed as Record<string, unknown>)['status'] !== 'string'
    ) {
        throw new Error('invalid Law schema');
    }
    law = parsed as Law;
} catch {
    throw new Error(
        `proposal.tallied: body_text is not valid JSON Law for proposal ${input.proposal_id}`
    );
}
```

Alternatively, define and use a `validateLaw(obj: unknown): Law` helper in `logos/types.ts`.

---

### WR-04: `evaluate_choice` uses Python's `hash()` — not deterministic across processes or Python versions

**File:** `brain/src/noesis_brain/governance/voter.py:165`

**Issue:** The `evaluate_choice` placeholder uses `hash(proposal_body) % 3` to deterministically assign a vote choice. Python's `hash()` for strings is randomized per-process by default (PYTHONHASHSEED randomization, introduced in Python 3.3). This means the same `proposal_body` will produce different results across Brain process restarts, on different machines, and potentially across Python versions — despite the docstring claiming "intentionally NOT random — determinism allows test assertions."

While this is documented as a placeholder to be replaced in v2.3, if tests rely on the deterministic property (as the docstring implies), they will exhibit non-deterministic failures in CI when PYTHONHASHSEED is not fixed. Additionally, if this placeholder outlasts v2.2, it silently violates its own stated contract.

**Fix:** Replace `hash()` with a deterministic digest function:

```python
import hashlib

def evaluate_choice(proposal_body: str, telos: object | None = None) -> str:
    choices = ["yes", "no", "abstain"]
    # Use sha256 for cross-process determinism (PYTHONHASHSEED-immune)
    idx = int(hashlib.sha256(proposal_body.encode("utf-8")).hexdigest(), 16) % 3
    return choices[idx]
```

This matches the wall-clock ban (no datetime/random), uses stdlib only, and is truly deterministic across process restarts and machines.

---

## Info

### IN-01: `validateVoterDid` imported but never called in routes.ts

**File:** `grid/src/api/governance/routes.ts:44`

**Issue:** `validateVoterDid` is imported from `_validation.ts` at line 44 but is never called anywhere in `routes.ts`. The commit and reveal handlers use inline checks or `registry.isTombstoned()` directly. This is a dead import that also signals the intent mismatch flagged in WR-01 — the function exists to validate voters but was not wired up.

**Fix:** Either wire `validateVoterDid` as described in WR-01 fix (preferred), or remove the import if the intent is to keep the inline check.

---

### IN-02: Body expansion toggle logic has a no-op branch

**File:** `dashboard/src/app/grid/governance/governance-dashboard.tsx:44-47`

**Issue:** The `handleViewBody` toggle handler has a logic error. When `bodyExpanded[proposalId]` is already set, the code attempts to toggle between `null` (collapsed) and its current value (expanded):

```typescript
setBodyExpanded((prev) => ({ ...prev, [proposalId]: prev[proposalId] ? null : prev[proposalId] }));
```

The `else` branch of this ternary (`prev[proposalId]` — the current value) is reached when `prev[proposalId]` is falsy (e.g., `null` or empty string). In that state, assigning `prev[proposalId]` to itself is a no-op — the collapsed state cannot be "un-collapsed" via the toggle; it would require fetching again (which won't happen since `bodyExpanded[proposalId] !== undefined`). In practice the collapsed state is `null`, which is falsy, so clicking "View body" a third time (after expand → collapse) does nothing.

**Fix:**

```typescript
// governance-dashboard.tsx:44-47 — replace with:
const handleViewBody = async (proposalId: string) => {
    if (bodyExpanded[proposalId] !== undefined) {
        // Toggle: collapse if expanded, expand if collapsed (re-use cached value)
        setBodyExpanded((prev) => ({
            ...prev,
            [proposalId]: prev[proposalId] ? null : _cachedBody[proposalId] ?? null,
        }));
        return;
    }
    // ... rest of fetch logic
```

Simpler alternative: store the fetched text separately from the expanded flag, so toggling is unambiguous.

---

### IN-03: Nonce construction in buildFixtureA has a dead code branch

**File:** `grid/src/governance/replay.ts:69-76`

**Issue:** `buildFixtureA` constructs nonces in two steps. Lines 69-72 build a `voters` array with a nonce formula using `padStart/slice` that is immediately overridden: lines 74-76 re-build the nonces array using the correct `(i+1).toString(16).padStart(32, '0')` formula, and line 97 spreads the correct nonces over the voters. The first nonce formula (lines 69-72) is dead code — the resulting `nonce` values in the initial `voters` array are never used. This creates a maintainability risk: a future reader may trust the first formula as the authoritative one.

**Fix:** Remove the dead nonce computation in the `voters` array initializer and keep only the `nonces` array approach:

```typescript
function buildFixtureA(): FixtureDefinition {
    const nonces = Array.from({ length: 10 }, (_, i) =>
        (i + 1).toString(16).padStart(32, '0'),
    );
    const voters = Array.from({ length: 10 }, (_, i) => ({
        voter_did: `did:noesis:v${String(i).padStart(2, '0')}`,
        choice: (i < 8 ? 'yes' : 'no') as 'yes' | 'no' | 'abstain',
        nonce: nonces[i],
    }));
    // ...
}
```

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
