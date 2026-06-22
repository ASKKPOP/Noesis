# W — Conversation routes (human↔Nous chat, reachable) — Implementation Plan

> Overnight autonomous · local branch `night/loop-wiring` · **NO push**. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** De-orphan `ConversationStore` over HTTP so the human↔Nous chat ("talking with user") is reachable: a participant posts a message to a partner, and reads the thread. Private (content off the audit chain), allowlist +0, no wei.

**Architecture:** `registerConversationRoutes(app, services)` (`services.pool` 503; `req.didContext` civic_did_required). The caller is one participant; the `:partnerDid` is the other. **Sender inferred from the caller's DID form** (`HUMAN_DID_RE = /^did:civic:noesis:human:/`): if the caller is a human → `sender='human'`, `humanDid=caller`, `nousDid=partner`; else the caller is a Nous → `sender='nous'`, `nousDid=caller`, `humanDid=partner`. (So `(human_did, nous_did)` is always resolved consistently regardless of who posts.)
- `POST /api/v1/civic/conversation/:partnerDid/messages` — `{ text }`; `messageId=randomUUID`; `tick=services.clock?.currentTick ?? 0`; → `ConversationStore.postMessage`.
- `GET /api/v1/civic/conversation/:partnerDid` — `ConversationStore.listThread(grid, humanDid, nousDid)` (resolve the pair from caller+partner+forms); 200 `{ messages }`.
Register in `server.ts` + policy.ts (both `civic_did_required`).

**Invariants:** caller is always a participant (posts as themselves); content never on the audit chain (no events); allowlist +0; bounded reads.

---

## Task 1: routes

- [ ] **Step 1:** Create `grid/src/api/routes/conversation.ts` `registerConversationRoutes` (mirror `civic-dues.ts` auth/503). Add `const HUMAN_DID_RE = /^did:civic:noesis:human:/i;`. Helper to resolve `{humanDid, nousDid, sender}` from `(caller, partner)`: if `HUMAN_DID_RE.test(caller)` → {humanDid:caller, nousDid:partner, sender:'human'}; else if `HUMAN_DID_RE.test(partner)` → {humanDid:partner, nousDid:caller, sender:'nous'}; else 400 `no_human_party` (a conversation needs one human + one nous). Validate `:partnerDid` matches `CIVIC_DID_RE`, `text` non-empty (→400 empty_text). Construct `new ConversationStore(pool)`.
- [ ] **Step 2:** Register in `server.ts` + 2 policy.ts entries (`civic_did_required`).
- [ ] **Step 3:** Tests `grid/test/api/conversation-route.test.ts` (mock pool + injected didContext): human posts to nous → 201 (sender human); GET thread → 200; nous posts to human → 201 (sender nous); empty text → 400; partner without a human party → 400; no pool → 503. Run `npx vitest run test/api/conversation-route.test.ts test/economy/conversation-store.test.ts test/api/` + typecheck.
- [ ] **Step 4: Commit LOCALLY (NO push):**
```bash
git add grid/src/api/routes/conversation.ts grid/src/api/server.ts grid/src/api/policy.ts grid/test/api/conversation-route.test.ts
git commit -m "feat(grid): W conversation routes — human<->Nous chat (de-orphan ConversationStore)

Sender inferred from DID form; content off-chain (allowlist +0). Local only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Do NOT push.

## Self-Review
Chat reachable both directions; caller always a participant; one-human-one-nous enforced; content off-chain; allowlist +0; local commit only.
