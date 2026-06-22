# L3b — `orbital.object_built` audit event — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Put the loop's final station on the tamper-evident audit chain: when a settled contract realizes a real object (L3a), emit `orbital.object_built`. This completes the audit trail for the whole Economic Reality Loop (due → … → object built).

**Architecture:** One sole-producer emitter + producer-boundary test + emitter unit test + allowlist **116 → 117** + wire `OrbitalObjectStore.createFromContract` to emit (optional `audit?` dep, after commit, hashed builder DID). Identical machinery to L1b (`due.*`) and L2b (`procurement.*`).

**Tech Stack:** TypeScript ESM (NodeNext, `.js`), Vitest. Run from `grid/`: `npx vitest run <target>` (**`vitest run` only, never watch; kill stray vitest first**). Allowlist additions explicit per the freeze rule.

---

## File Structure

| File | Action |
|---|---|
| `grid/src/audit/append-orbital-object-built.ts` | **Create** — sole-producer emitter |
| `grid/src/audit/broadcast-allowlist.ts` | **Modify** — add `orbital.object_built` (116 → 117) |
| `grid/src/economy/orbital-object-store.ts` | **Modify** — optional `audit?` dep + emit after commit |
| `grid/test/audit/append-orbital-object-built.test.ts` | **Create** — emitter unit test |
| `grid/test/audit/orbital-object-built-producer-boundary.test.ts` | **Create** — boundary test |
| `grid/test/audit/broadcast-allowlist.test.ts` (+ any other file asserting the count) | **Modify** — count 116 → 117 |
| `grid/test/economy/orbital-object-store.test.ts` | **Modify** — emit spy test |

---

## Task 1: emitter + allowlist + wiring

Clone the established pattern: emitter from `grid/src/audit/append-procurement-awarded.ts` (9-step guard, closed alphabetical-key tuple, HEX64/UUID regex, decimal-string amounts, `payloadPrivacyCheck`, `audit.append`); producer-boundary test from `grid/test/audit/procurement-awarded-producer-boundary.test.ts`; emitter unit test from `grid/test/audit/append-procurement-awarded.test.ts`; store-emit wiring from how `ProcurementStore` emits (optional `audit?: AuditChain`, local `sha256Hex`, emit via the emitter FUNCTION after commit).

- [ ] **Step 1 — allowlist.** In `grid/src/audit/broadcast-allowlist.ts`, append `'orbital.object_built'` to `ALLOWLIST_MEMBERS` (position 117) under an `orbital.*` comment block (116 → 117).

- [ ] **Step 2 — count assertions.** Find EVERY allowlist count assertion currently `116` and bump to `117`:
  `grep -rn "toBe(116)\|toHaveLength(116)\|ALLOWLIST_MEMBERS.length).toBe(116)\|ALLOWLIST.size).toBe(116)" grid/test` — update all (broadcast-allowlist.test.ts has several; check `human-civic-application.test.ts`, `portal-manager-readonly-guard.test.ts`, `civic/house-4-e2e.test.ts` too). Do NOT change index-position assertions (e.g. `[107]`/`[110]`). Add `orbital.object_built` to the inclusion `it.each` + a position assertion `ALLOWLIST_MEMBERS[116] === 'orbital.object_built'`.

- [ ] **Step 3 — emitter.** Create `grid/src/audit/append-orbital-object-built.ts` → `orbital.object_built`, closed alphabetical payload `{ build_cost_wei, builder_did_hash, contract_id, function_type, object_id, output_rate, tick }`:
  - `build_cost_wei`, `output_rate` — decimal-digit strings (`/^[0-9]+$/`)
  - `builder_did_hash` — HEX64
  - `contract_id`, `object_id` — UUID
  - `function_type` — non-empty string
  - `tick` — non-negative integer
  - actorDid = `builder_did_hash`; 9-step guard; `payloadPrivacyCheck`; `audit.append('orbital.object_built', builder_did_hash, cleanPayload)`.

- [ ] **Step 4 — boundary + emitter unit tests.** Clone the procurement equivalents for the new event.

- [ ] **Step 5 — wire the store.** In `grid/src/economy/orbital-object-store.ts`: add optional `audit?: AuditChain` ctor dep (default off → L3a tests unaffected), import `createHash` + define `sha256Hex`, import `appendOrbitalObjectBuilt`. After the successful `commit()` in `createFromContract`, if `this.audit` is set, emit `orbital.object_built` with `builder_did_hash = sha256Hex(String(contract.winner_did))`, `build_cost_wei = String(contract.award_wei)`, `contract_id = p.contractId`, `function_type = p.functionType`, `object_id = p.objectId`, `output_rate = p.outputRate.toString()`, `tick = p.currentTick`. Call the emitter FUNCTION (never `audit.append('orbital.*')` directly → boundary stays green). Add a store test that the emit fires with the hashed builder DID when an AuditChain spy is passed (and no-op without it).

- [ ] **Step 6 — verify.** `npx vitest run test/audit/ test/economy/` → all green (allowlist 117); `npm run typecheck 2>/dev/null || npx tsc --noEmit` → clean; `grep -rn "append('orbital\.\|append(\"orbital\." grid/src` → only the new emitter file.

- [ ] **Step 7 — commit.**

```bash
git add grid/src/audit/append-orbital-object-built.ts grid/src/audit/broadcast-allowlist.ts grid/src/economy/orbital-object-store.ts grid/test/audit/append-orbital-object-built.test.ts grid/test/audit/orbital-object-built-producer-boundary.test.ts grid/test/audit/broadcast-allowlist.test.ts grid/test/economy/orbital-object-store.test.ts
git commit -m "feat(grid): L3b orbital.object_built audit event (allowlist 116->117) + emit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push
```

---

## Self-Review
**1. Coverage:** the loop's final station (`orbital.object_built`) is now on the audit chain. ✓
**2. Sole-producer:** only the emitter file calls `audit.append('orbital.object_built')`; the store calls the emitter function → boundary test green. ✓
**3. Privacy:** builder DID hashed (HEX64) before the chain; `payloadPrivacyCheck` run. ✓
**4. Allowlist +1 = 117:** explicit entry + all count assertions bumped (incl. the previously-stale files now at 116→117). ✓
**5. Additive:** optional `audit?` defaults off → L3a tests unaffected; emit after commit. ✓
