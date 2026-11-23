---
milestone: cross-cutting
sources: 2
tags: [agent-coding, ci-gates, verification, code-quality]
---

# The Potato Method applied to Noēsis — audit (2026-11-23)

Source: `potato-agent-guide.md` (a write-up of Lauren Tan's talk "All Code Is Slop (Except Mine)").
Its claim: you get agent productivity without slop by building an environment you can trust. Spend
most of the effort on deterministic layers (the codebase, then static analysis), then on verification.
Keep prose rules thin. Human review is the last resort.

This page measures Noēsis against each layer and records what was applied on 2026-11-23. Links:
[[system-audit-2026-07]], [[v2.6/OBSERVABILITY-HARDENING|Observability hardening]].

## Scorecard (measured on `research/atlas-simulator` @ 416faea5)

| Layer | State | Evidence |
|---|---|---|
| 1. Codebase | **Weak**: duplicated patterns spread | 193 inline DID/HEX64/address regexes in 12+ DID shapes. HEX64 is case-insensitive in 77 copies and case-sensitive in 28, so emitters disagree on the same id. The dashboard keeps its own copy of the wire types (`dashboard/src/lib/protocol/*`) and never imports `@noesis/protocol`. 120 hand-written `append-*.ts` validators (9,134 lines). The brain `BrainHandler` held 5 byte-identical methods twice (~250 lines). |
| 2. Static analysis | **Strong on invariants, missing general lint** | 31 custom `scripts/check-*.mjs` gates enforce the constitution (privacy, VOTE-05, Portal-gating, money). ESLint has **no config**, so `grid`'s `lint` script fails on ESLint 9 and no TS lint runs. Brain had 37 ruff errors (6 undefined names, 3 shadowed methods) and 212 mypy errors, and neither tool ran in CI. |
| 3. Verification | **Medium** | 515 grid test files, 154 brain, real-MySQL migration CI, brain↔brain-rs parity fixtures. Only 3 Playwright specs cover 49 dashboard + 22 steward routes. There is no feature map, no driver CLI, one property-test file (fast-check), and no formal specs or statecharts. |
| 4. Prose | **Heavy** | `CLAUDE.md` is 206 lines, plus 12 feedback memories and a 97-line wiki `PROTOCOL.md`. Many rules in them could be checks. |
| 5. Human review | — | Fix commits find bugs after the fact: 12 of 111 commits in the last 30 days are fixes, mostly persistence ("are saved", "survive a restart") that the mock-Pool tests could not see. |

### Comment layer (Potato rule 5)

27% of `grid/src` lines are comments (16,146). 1,902 of those cite decisions or phases (`D-…`,
`Phase N`), and 31 are justifications ("is fine", "for now", "intentional"). Signs of drift:
`fix(brain): … correct dispatch comments` and `fix(audit): keep the frozen allowlist at its
baseline line count`. In the second, a gate counts **lines** of `broadcast-allowlist.ts`, so editing
a comment fails CI. That gate measures a stand-in, not the property it is meant to protect.

**Do not ban comments wholesale here.** Decision-ref comments carry constitutional traceability
(D-V3-33 and similar), and that traceability is a real requirement. The Potato-consistent move is to
replace *justification* comments with gates, and to make the decision ref point at a gate wherever
one exists.

## Correction log: prose rule → deterministic check

| Rule (where it lives) | Deterministic today? | Next step |
|---|---|---|
| Portal-gating D-V3-33 (CLAUDE.md) | ✅ `check-civic-did-issuance-path` | — |
| VOTE-05 Nous-only voting | ✅ governance gates | — |
| Money axiom D-MONEY-01 (memory) | ✅ partly: `check-ledger-b-money` | Gate "Ousia as money" copy in UI (fix commit `fix(landing): … not Ousia`) |
| Audit key privacy (memory) | ✅ runtime `FORBIDDEN_KEY_PATTERN` | — |
| Mock-Pool SQL gap (memory) | ✅ `real-mysql-migrations.yml` | Extend to every new store |
| Zone code keys on `kind`, never name (D-V3-40, CLAUDE.md) | ❌ prose | Gate: zone-name string literals compared outside the template file |
| Polis naming (D-V3-31, CLAUDE.md) | ❌ prose | Gate: "Genesis Government/Council/Senate" in src + wiki |
| No mock/hardcode in product (memory) | ❌ prose. `fork-nous.ts` had a placeholder existence-DID and a stub credential. **Correction:** no production manifest ever carried them, because the fork route's ownership check is also unwired, so production refuses every fork (403). **Fixed 2026-11-23**: both values now come from the civic registry record | Enable forks in production (wire ownership), then ban placeholder DIDs in src |
| Allowlist baseline re-pin (memory) | ⚠️ gate measures line count | Replace the line count with a member-set snapshot |
| nginx force-recreate after deploy (memory) | ❌ prose | Make `deploy.sh` do it, so the wrong thing can't happen |
| Deploy never includes nous-* (memory) | ❌ prose | `deploy.sh` refuses nous-* when `BRAIN_HTTP_SECRET` is unset |
| Wiki updated with every task (memory) | ⚠️ `check-wiki` checks page integrity, not coverage | Gate: a change to a `src/` subsystem must touch its wiki page or say why not |
| Copied anti-patterns (new) | ✅ **`check-ratchet` (2026-11-23)** | Lower the baselines as the cleanup lands |
| Brain undefined names / dead code (new) | ✅ **ruff in CI (2026-11-23)** | Then mypy, with a ratchet on its error count |

## Applied 2026-11-23 (Potato rule 7: block new occurrences first, clean up second)

1. **Brain ruff clean, enforced in CI.** Fixed a latent `NameError`: `except (json.JSONDecodeError…)`
   inside the skill-sweep promotion referenced an unimported `json`, so a malformed `payload_json`
   would crash the sweep instead of falling back. Deleted the second copies of 5 identical
   `BrainHandler` methods (verified by comparing ASTs). Removed 19 unused imports and 6 dead
   variables. Added `TYPE_CHECKING` imports for the lazily imported SDKs. 1542 brain tests pass.
2. **`scripts/check-ratchet.mjs`**, a count that may only go down. Baselines: inline-id-regex 201,
   react-use-effect 119, type-escape 553, suppression 109, ui-timer 21. Each failure message tells
   the agent what to do instead.
3. **`grid/src/util/id-patterns.ts`** is the single home for id regexes. `civic/blueprint.ts` was
   migrated (same lowercase pattern, no behaviour change).

## Recommended order (not yet done)

1. ~~Decide HEX64 case, then consolidate the regexes.~~ **Done 2026-11-23.** The operator chose
   "accept both cases" (D-ID-01). 162 grid files now import from `id-patterns.ts`; the ratchet went
   201 → 4 (the 4 left are in dashboard/steward, which cannot import grid). DID shapes were kept per
   producer, and two copies that let a backslash through were tightened. 7 tests that pinned
   lowercase-only were flipped. Grid 4519 pass.
2. ~~Drop the fork placeholders.~~ **Done 2026-11-23**: the identity and credential come from `civicDidStore.get`; an unknown Civic-DID gets 404 and a missing registry gets 503. **Still open:** production refuses every fork because `checkOperatorOwnsNous` is not wired. The wiki now says so on `civic-architecture.md`.
3. **ESLint flat config** with `@typescript-eslint` (already installed), carrying the ratchet rules
   as real lint rules.
4. **Replace the allowlist line-count gate** with a member-set snapshot.
5. **Feature map + driver** (`dashboard/feature-map.yaml` with a gate that every `page.tsx` route is
   listed), and Playwright evidence screenshots per route.
6. **Property tests** for the economy and settlement invariants (fast-check is already installed),
   and a statechart for the Portal→Polis registration flow.
7. **Only then** automate the outer loop (agent-merged PRs per category, by revert rate).
