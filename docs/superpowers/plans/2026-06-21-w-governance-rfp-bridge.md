# W — Governance→RFP bridge (Polis issues RFPs by law) — Implementation Plan

> Overnight autonomous · local branch `night/loop-wiring` · **NO push**. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Make RFP issuance **self-driving and constitutional**: when the Polis enacts a `procurement` bill (via the existing VOTE-05 pipeline), the bill's RFP is created (`ProcurementStore.issueNotice`) with the law as its `polis_authorization_ref`. This is the proper Polis-only issuance path (members never self-issue — VOTE-05 / D-V3-21 preserved) and the W2 driver for the RFP station.

**INVESTIGATE-FIRST (constitutional component — proceed only if clean):** Read `grid/src/governance/engine.ts` (`onLawEnacted` / `onTickClosed` and its `deps`), how a bill's `category`/`body` is structured, and whether the enactment path has (or can be given) the MySQL `pool` + `audit` + current tick. 
- If a clean seam exists (deps carry the pool, or the launcher can thread it), implement the bridge.
- If wiring the pool into the governance enactment path is invasive/unclear, **STOP and report BLOCKED** with exactly what's needed (do NOT force a risky change to governance autonomously).

**Architecture (if clean):** a `procurement` bill carries `category === 'procurement'` + a JSON body `{ title, spec, budget_wei, zone, function_type, deadline_offset_ticks }`. On enactment, parse it; on success call `ProcurementStore(pool, audit).issueNotice({ noticeId: randomUUID, polisAuthorizationRef: <bill/law id>, ...fields, deadlineTick: currentTick + deadline_offset_ticks, currentTick })`. **Safe parse:** malformed body → log + skip (never throw out of the enactment path; mirror the existing fire-and-forget governance sweeps).

**Invariants:** issuance ONLY via an enacted bill (VOTE-05/D-V3-21 — no self-issue); parse-fail is non-fatal; `procurement.notice_issued` emitted via `ProcurementStore` (sole-producer); allowlist +0; additive (existing governance behavior unchanged for non-procurement bills).

---

## Task 1: investigate + (if clean) bridge

- [ ] **Step 1:** Read `grid/src/governance/engine.ts` + how `onLawEnacted`/enacted bills flow + the `deps` shape + bill `category`/`body`. Determine if the pool/audit/tick are reachable at enactment. Record the finding.
- [ ] **Step 2 (if clean): failing test** — `grid/test/governance/procurement-bridge.test.ts`: enacting a `category:'procurement'` bill with a valid JSON body calls `ProcurementStore.issueNotice` (mock pool — assert `INSERT INTO procurement_notices`); a malformed body does NOT throw + does NOT issue; a non-procurement bill is unaffected.
- [ ] **Step 3 (if clean): implement** the bridge in the enactment path: gate on `bill.category === 'procurement'`, `JSON.parse` the body in try/catch, validate the required fields (title/spec/budget_wei digit-string/zone/function_type/deadline_offset_ticks int), `void ProcurementStore(pool, audit).issueNotice(...)` fire-and-forget, log+skip on any failure. Thread the pool/audit/tick from the launcher into the governance enactment deps if needed (minimal, additive).
- [ ] **Step 4 (if clean): verify** — `npx vitest run test/governance/ test/economy/procurement-store.test.ts` → green; `npm run typecheck` → clean.
- [ ] **Step 5: Commit LOCALLY (NO push)** (if implemented):
```bash
git add grid/src/governance/engine.ts grid/src/economy/procurement-store.ts grid/test/governance/procurement-bridge.test.ts <any launcher wiring>
git commit -m "feat(grid): W governance->RFP bridge — enacted procurement bill issues an RFP (VOTE-05)

Polis-only issuance via the existing VOTE-05 pipeline; parse-fail non-fatal. Local only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Do NOT push. **If BLOCKED, commit nothing — report what's needed.**

## Self-Review
Issuance only via enacted bill (VOTE-05 intact); safe parse; procurement.notice_issued via store; additive; allowlist +0; local commit only — OR a clear BLOCKED report.
