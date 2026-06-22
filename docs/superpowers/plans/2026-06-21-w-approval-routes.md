# W — Approval routes (consult-your-human, reachable) — Implementation Plan

> Overnight autonomous · local branch `night/loop-wiring` · **NO push**. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** De-orphan `ApprovalStore` over HTTP so the consult-your-human flow is reachable: a Nous **requests** an approval; the human **lists** their pending approvals and **approves/rejects**. Invariant-safe; no wei.

**Architecture:** `registerApprovalRoutes(app, services)` (`services.pool` 503 idiom; `services.audit` so the store emits `human.approval_*` from O2b). **Auth by exact DID-ownership match** (avoids the human-tier design fork): a caller may only act where they are the named party.
- `POST /api/v1/civic/approvals` — a Nous requests (caller `req.didContext.did` = `nous_did`; body `{ human_did, kind, summary, payload, deadline_tick }`; `approvalId=randomUUID`).
- `GET /api/v1/civic/approvals` — the caller's PENDING approvals where `human_did = caller` (the human's queue).
- `POST /api/v1/civic/approvals/:id/approve` — caller must equal the approval's `human_did` (else 403); → `ApprovalStore.approve`.
- `POST /api/v1/civic/approvals/:id/reject` — same ownership → `ApprovalStore.reject`.
Register in `server.ts`. Add `getApproval` is already on the store (read ownership before approve/reject).

**Invariants:** only the named human resolves (ownership 403); only the named nous requests; resolve-once is in the store; `human.approval_*` emitted via the store (sole-producer); allowlist +0.

---

## Task 1: routes

- [ ] **Step 1:** Create `grid/src/api/routes/approvals.ts` `registerApprovalRoutes` mirroring `civic-dues.ts` (503/401 idioms, `CIVIC_DID_RE`). For approve/reject: `const a = await store.getApproval(grid, id); if (!a) 404; if (a.human_did !== caller) 403 not_your_approval;` then `store.approve/reject`. Map `approval_not_pending`→409. For request: validate `kind` non-empty (400), `human_did` matches `CIVIC_DID_RE`. Construct `new ApprovalStore(pool, services.audit)`.
- [ ] **Step 2:** Register in `server.ts` + policy.ts entries (request/list/approve/reject = `civic_did_required` — they all need an authenticated caller).
- [ ] **Step 3:** Tests `grid/test/api/approvals-route.test.ts` (mock pool + injected didContext): request 201; list 200 (filtered human_did); approve 200; approve someone-else's → 403; approve non-pending → 409; bad kind → 400; no pool → 503. Run `npx vitest run test/api/approvals-route.test.ts test/economy/approval-store.test.ts test/api/` + typecheck.
- [ ] **Step 4: Commit LOCALLY (NO push):**
```bash
git add grid/src/api/routes/approvals.ts grid/src/api/server.ts grid/src/api/policy.ts grid/test/api/approvals-route.test.ts
git commit -m "feat(grid): W approval routes — request/list/approve/reject (de-orphan ApprovalStore)

Consult-your-human reachable; DID-ownership enforced; human.approval_* via store. Local only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Do NOT push.

## Self-Review
Consult-your-human reachable; ownership 403 on cross-party; resolve-once in store; human.approval_* sole-producer; allowlist +0; local commit only.
