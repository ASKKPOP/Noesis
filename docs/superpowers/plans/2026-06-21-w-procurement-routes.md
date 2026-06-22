# W — Procurement member routes (see RFPs + bid) — Implementation Plan

> Overnight autonomous · local branch `night/loop-wiring` · **no push**. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** De-orphan `ProcurementStore` over HTTP for the member-facing acts: see open RFPs, see one RFP + its bids, place a bid. **Issuance + award stay Polis-only** (via the governance→RFP bridge, next slice) — members must NOT self-authorize issuing or awarding (VOTE-05 / D-V3-21). Read-heavy + one write (bid), all invariant-safe; no wei moves here.

**Architecture:** `registerProcurementRoutes(app, services)` using `services.pool` (503 idiom) + `req.didContext` (civic_member for the bid write). Routes:
- `GET /api/v1/procurement/notices?status=open` — list notices (public-readable; anyone may see open RFPs to bid).
- `GET /api/v1/procurement/notices/:noticeId` — one notice + its bids.
- `POST /api/v1/procurement/notices/:noticeId/bids` — place a bid (civic_member; bidder = caller; `{ priceWei, artifactSpec }`).
Add read helpers to `ProcurementStore` (listOpenNotices / getNotice / listBids) — it currently has issue/bid/award/settle/cancel but no reads. Register in `server.ts`.

**Tech Stack:** TS ESM, Vitest. Run from `grid/`: `npx vitest run <target>` (run-only). **Commit locally, do NOT push.**

**Invariants:** members bid only (no issue/award via these routes → VOTE-05 preserved); `placeBid` already guards notice-open; allowlist +0 (procurement.bid_placed exists; emit wiring rides the store's audit dep if present — pass `services.audit`).

---

## Task 1: store reads + routes

- [ ] **Step 1:** Add to `grid/src/economy/procurement-store.ts` three read methods (non-transactional, like OrbitalObjectStore reads):
```ts
async listNotices(gridName: string, status = 'open'): Promise<RowDataPacket[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT notice_id, title, spec, budget_wei, zone, function_type, status, deadline_tick, polis_authorization_ref
         FROM procurement_notices WHERE grid_name = ? AND status = ? ORDER BY deadline_tick ASC LIMIT 200`, [gridName, status]);
    return rows;
}
async getNotice(gridName: string, noticeId: string): Promise<RowDataPacket | undefined> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT notice_id, title, spec, budget_wei, zone, function_type, status, deadline_tick FROM procurement_notices WHERE grid_name = ? AND notice_id = ?`, [gridName, noticeId]);
    return rows[0];
}
async listBids(gridName: string, noticeId: string): Promise<RowDataPacket[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT bid_id, bidder_did, price_wei, status FROM procurement_bids WHERE grid_name = ? AND notice_id = ? ORDER BY created_at ASC LIMIT 200`, [gridName, noticeId]);
    return rows;
}
```
(If the store constructor is `(pool)` only — confirm — these are fine; the bid write route may construct `new ProcurementStore(pool)` and call `placeBid`.)

- [ ] **Step 2:** Create `grid/src/api/routes/procurement.ts` `registerProcurementRoutes` mirroring `grid/src/api/routes/civic-dues.ts` (503 on no pool; `CIVIC_DID_RE` + tier `civic_member` for the bid write). `placeBid` params: generate `bidId` server-side (`randomUUID`), `bidderDid = req.didContext.did`, body `{ price_wei: string, artifact_spec: string }` (validate price_wei is digit-string, artifact_spec non-empty). Map `notice_not_open`→409, `invalid_amount`→400.
- [ ] **Step 3:** Register in `grid/src/api/server.ts` beside `registerCivicDueRoutes`.
- [ ] **Step 4:** Tests `grid/test/api/procurement-route.test.ts` (mock pool + injected didContext, mirror `civic-dues-route.test.ts`): list notices 200; get notice+bids 200; place bid 200/4xx; bad price→400; no pool→503. Run `npx vitest run test/api/procurement-route.test.ts test/economy/procurement-store.test.ts` + typecheck.
- [ ] **Step 5: Commit locally (NO push):**
```bash
git add grid/src/economy/procurement-store.ts grid/src/api/routes/procurement.ts grid/src/api/server.ts grid/test/api/procurement-route.test.ts
git commit -m "feat(grid): W procurement member routes — see RFPs + place bids (de-orphan ProcurementStore)

Issuance/award stay Polis-only (governance bridge); members read + bid. No push (local branch).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
**Do NOT `git push`.**

---

## Self-Review
Members can see open RFPs + bid; issue/award NOT exposed (VOTE-05). Reads bounded. ProcurementStore de-orphaned. Allowlist +0. Local commit only.
