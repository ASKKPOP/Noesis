# O2b — `human.approval_*` audit events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Put the human-in-the-loop approval lifecycle (O2a) on the tamper-evident audit chain: `human.approval_requested` (a Nous asks), `human.approval_granted` / `human.approval_denied` (the human resolves). Privacy-preserving — only the `approval_id`, the `kind`, and **hashed** DIDs cross the boundary; the held action `payload` + `summary` stay Grid-side.

**Architecture:** 3 sole-producer emitters + boundary tests + emitter tests + allowlist **117 → 120** + wire `ApprovalStore` (optional `audit?` dep) to emit. Identical machinery to L1b/L2b/L3b. `human.*` is on the per-phase-addition list (CLAUDE.md) — these 3 additions are explicit.

**Tech Stack:** TypeScript ESM, Vitest. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**).

**Invariants:** sole-producer (only the 3 emitter files call `audit.append('human.approval_*')`; `ApprovalStore` calls the emitter FUNCTIONS); DIDs hashed (HEX64) — no raw DID, no `summary`/`payload` on chain; allowlist exactly +3 = 120; optional `audit?` defaults off so O2a tests stay green; emit after commit.

---

## File Structure
| File | Action |
|---|---|
| `grid/src/audit/append-human-approval-requested.ts` · `-granted.ts` · `-denied.ts` | **Create** — 3 sole-producer emitters |
| `grid/src/audit/broadcast-allowlist.ts` | **Modify** — add 3 `human.approval_*` (117 → 120) |
| `grid/src/economy/approval-store.ts` | **Modify** — optional `audit?` + emit after commit |
| `grid/test/audit/append-human-approval-*.test.ts` (×3) · `human-approval-*-producer-boundary.test.ts` (×3) | **Create** |
| `grid/test/audit/broadcast-allowlist.test.ts` (+ any file asserting the count) | **Modify** — 117 → 120 |
| `grid/test/economy/approval-store.test.ts` | **Modify** — emit spy tests |

---

## Task 1: emitters + allowlist + wiring

Clone the established pattern: emitter from `grid/src/audit/append-orbital-object-built.ts` (L3b, freshest 9-step guard); boundary test from `grid/test/audit/orbital-object-built-producer-boundary.test.ts`; emitter unit test from `grid/test/audit/append-orbital-object-built.test.ts`; store-emit wiring from how `ProcurementStore`/`OrbitalObjectStore` emit (optional `audit?: AuditChain`, local `sha256Hex`, emit via emitter FUNCTION after commit).

- [ ] **Step 1 — allowlist:** append to `ALLOWLIST_MEMBERS` (positions 118–120) under a `human.approval.*` comment block (117 → 120):
  `'human.approval_requested'`, `'human.approval_granted'`, `'human.approval_denied'`.

- [ ] **Step 2 — count assertions:** `grep -rn "toBe(117)\|toHaveLength(117)" grid/test` and bump EVERY allowlist count assertion 117 → 120 (broadcast-allowlist.test.ts has several; also `human-civic-application.test.ts`, `portal-manager-readonly-guard.test.ts`, `civic/house-4-e2e.test.ts`). Do NOT touch index-position assertions. Add the 3 events to the inclusion `it.each` + a position assertion `ALLOWLIST_MEMBERS[117] === 'human.approval_requested'`.

- [ ] **Step 3 — emitters** (closed alphabetical-key tuples; actorDid as noted):
  - `append-human-approval-requested.ts` → `human.approval_requested`, payload `{ approval_id, human_did_hash, kind, nous_did_hash, tick }`; `approval_id` UUID, `human_did_hash`/`nous_did_hash` HEX64, `kind` non-empty string, `tick` non-neg int; actorDid = `nous_did_hash` (the Nous asking).
  - `append-human-approval-granted.ts` → `human.approval_granted`, payload `{ approval_id, human_did_hash, tick }`; actorDid = `human_did_hash` (the human granting).
  - `append-human-approval-denied.ts` → `human.approval_denied`, payload `{ approval_id, human_did_hash, tick }`; actorDid = `human_did_hash`.
  9-step guard each; `payloadPrivacyCheck`. NOTE: never put `summary`/`payload` (the held action) on the chain.

- [ ] **Step 4 — boundary + emitter unit tests** for all 3 events (clone the orbital equivalents).

- [ ] **Step 5 — wire `ApprovalStore`:** add optional `audit?: AuditChain` ctor dep (default off → O2a tests unaffected); import `createHash` + `sha256Hex` + the 3 emitters. 
  - `requestApproval`: after the INSERT, if `this.audit`, emit `human.approval_requested` with `nous_did_hash = sha256Hex(p.nousDid)`, `human_did_hash = sha256Hex(p.humanDid)`, `approval_id`, `kind`, `tick`.
  - `resolve(...)`: change the `SELECT ... FOR UPDATE` to also fetch `human_did`; after `commit`, if `this.audit`, emit `human.approval_granted` (when `to==='approved'`) or `human.approval_denied` (when `to==='rejected'`) with `human_did_hash = sha256Hex(<the row's human_did>)`, `approval_id`, `tick`. (Expiry `to==='expired'` emits nothing for now.)
  Call the emitter FUNCTIONS (never `audit.append('human.approval_*')` directly → boundary green). Add a store test: emit fires with hashed DIDs when an AuditChain spy is passed; no-op without.

- [ ] **Step 6 — verify:** `npx vitest run test/audit/ test/economy/` → all green (allowlist 120); `npm run typecheck 2>/dev/null || npx tsc --noEmit` → clean; `grep -rn "append('human\.approval\|append(\"human\.approval" grid/src` → only the 3 emitter files.

- [ ] **Step 7 — commit.**

```bash
git add grid/src/audit/append-human-approval-*.ts grid/src/audit/broadcast-allowlist.ts grid/src/economy/approval-store.ts grid/test/audit/append-human-approval-*.test.ts grid/test/audit/human-approval-*-producer-boundary.test.ts grid/test/audit/broadcast-allowlist.test.ts grid/test/economy/approval-store.test.ts
git commit -m "feat(grid): O2b human.approval_* audit events (allowlist 117->120) + emit

Sole-producer human.approval_requested/granted/denied (hashed DIDs, held action
payload stays off-chain) + ApprovalStore emits on request/approve/reject.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review
**1. Coverage:** the approval lifecycle (request/grant/deny) is on the audit chain. ✓
**2. Sole-producer:** only the 3 emitter files call `audit.append('human.approval_*')`; the store calls the emitter functions → boundary green. ✓
**3. Privacy:** DIDs hashed; `summary`/`payload` (the held action) never on chain; `payloadPrivacyCheck` run. ✓
**4. Allowlist +3 = 120:** explicit entries + all count assertions bumped. ✓
**5. Additive:** optional `audit?` defaults off → O2a tests unaffected; emit after commit. ✓
