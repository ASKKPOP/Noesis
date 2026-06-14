---
phase: 60
plan: 03
wave: 2
status: BUILT
requirements: [R-60-07, R-60-08]
---

# Phase 60 · Wave 2 — IOU Ledger + Cowork Agreement + Task Board (SUMMARY)

## What shipped

**Mutual-credit IOU ledger (D-60-05 / D-NH-06 / R-60-07)** — `grid/src/civic/credit-ledger.ts` (NEW)
- `IouEntry {iou_id, creditor_civic_did, debtor_civic_did, amount_bios, reason_ref, created_tick, settled_tick|null}`.
- `recordIou(creditor, debtor, amount, reasonRef, tick, deps?)` — bilateral payable; enforces per-pair `IOU_PAIR_CAP_BIOS` + global debtor `IOU_GLOBAL_CAP_BIOS` (over-cap → throws); persists DB-first via `deps.persistIou`; auto-nets against an outstanding counter-IOU (smaller cancels larger); **emits NOTHING on chain**.
- `settleIou(iouId, tick, deps?)` — flips bookkeeping (stamps `settled_tick`); idempotent. Ousia move is the caller's job.
- `outstandingFor(did)` — total unsettled payables where `did` is debtor. Plus `outstandingBetween(a,b)` for the severance drain.
- v1 BOOKKEEPING: no interest over ticks, no `transferIou`/`assignIou`. Module-level state with `_resetLedger` (test isolation) + `upsertIou`/`allIous` (hydrate mirror).

**Founding-law caps (single patch point)** — `grid/src/civic/founding-law.ts`
- `export const IOU_PAIR_CAP_BIOS = 1000;` and `export const IOU_GLOBAL_CAP_BIOS = 5000;` — the only copy; credit-ledger reads exclusively from these.

**Severance drain wired to the REAL ledger (D-60-02 / R-60-03)** — `grid/src/civic/severance.ts` + `grid/src/civic/parcel-registry.ts`
- New `makeIouDrain(host, holder, tick, deps?)` builds the SETTLEMENT `drainIous` hook from `outstandingBetween` + `settleIou` — drains every open IOU between the pair before REVOKE.
- `ParcelRegistry.revokeRole` now passes `makeIouDrain(owner↔holder)` as the FSM `drainIous` hook (replacing the Wave-1 empty injected hook). FSM stays pure + injection-based; existing severance test unchanged-green.

**Cowork Agreement + task board (D-60-06 / A5 / R-60-08)** — `grid/src/civic/cowork.ts` (NEW)
- `CoworkStatus = 'posted' | 'claimed' | 'completed' | 'settled'`.
- `CoworkAgreement {agreement_id, parcel_id, parties:[host,worker], scope_ref, settlement_amount_bios, term_ticks, status, dispute_route?}` — signed dual-DID source of truth.
- `createAgreement`/`postTask` (owner/staff) → `posted`; `claimTask` → `parties[1]=worker`, `claimed`; `completeTask(host, deps)` → `settled`.
- **Completion ALWAYS settles (D-NH-06):** funded → `transferOusia(host→worker, amount)`; unfunded → `recordIou(worker /*creditor*/, host /*debtor*/, amount, agreement_id, end_tick)`; amount ≤ 0 → **throws `cowork_must_pay`** (never free). Bumps worker `trust_score` on settlement.
- Constructs the `zoning.cowork_session` participants set + `participants_hash` (sha256, sorted DID set) but **does NOT emit** — the producer/append is Wave 4. `task_ref`/`scope_ref` bodies stay Grid-side.

**Persistence (v40)** — `grid/src/civic/parcel-store.ts`
- `persistIou(entry)` / `persistIouSettle(iouId, tick)` (DB-first, `civic_credit_ledger`).
- `persistCowork(agreement, {created, completed?})` (DB-first, `civic_cowork_agreements`; in-memory `settled` → DB `completed` enum + `completed_tick`).
- `hydrate()` now also reads `civic_credit_ledger` + `civic_cowork_agreements` (defensive against malformed rows under the shared mock-Pool SELECT).

## Tests
- Un-skipped `grid/test/civic/credit-ledger.test.ts` (8 tests) + `grid/test/civic/cowork.test.ts` (board post/claim/complete + settle/IOU/never-free; emission block left `describe.skip` for Wave 4).
- Added `beforeEach` `_resetLedger`/`_resetCowork` for module-state isolation.

## Out of scope this wave (left untouched)
- `broadcast-allowlist.ts` NOT modified — source stays **95**; `zoning.cowork_session` + the other 3 events are Wave 4 (60-05). Allowlist count/presence tests remain expected-RED at 99.
- No new `clock.onTick` (board ops + settlement are request-driven). No autoplay.
- Wave-0 stubs (place-registry, ring-expansion, shop-binding, civic-commerce-routes, append stubs, house-3-e2e) still `describe.skip`. Dashboard untouched.

## SELF-CHECK
- `npm run test -- civic/credit-ledger civic/cowork civic/severance` → **3 files, 19 passed | 1 skipped** (skipped = Wave-4 cowork_session emission block).
- `npx tsc --noEmit` → **exit 0, no new errors**.
- Allowlist SOURCE still **95** (proof: allowlist test reports `expected 95 to be 99`; no audit file modified per `git diff --stat src/audit/`).
- `zoning.cowork_session` **NOT emitted** — only constructed in cowork.ts (no `audit.append`/emit; Wave 4).
- `clock.onTick(` subscriptions = **2** (pre-existing grid-coordinator + launcher); no new subscription added.
- Full grid suite: only failures are the 14 expected-RED allowlist count/presence assertions (Wave 4); all 3182 other tests pass.
