---
phase: 26-sophia-onboarding
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - dashboard/src/app/portal/auth/page.tsx
  - dashboard/src/app/portal/onboard/ChatInput.tsx
  - dashboard/src/app/portal/onboard/ContinueButton.tsx
  - dashboard/src/app/portal/onboard/SophiaBubble.tsx
  - dashboard/src/app/portal/onboard/StepSophiaChat.tsx
  - dashboard/src/app/portal/onboard/StepWelcome.tsx
  - dashboard/src/app/portal/onboard/StepWorldTour.tsx
  - dashboard/src/app/portal/onboard/UserBubble.tsx
  - dashboard/src/app/portal/onboard/WizardStepIndicator.tsx
  - dashboard/src/app/portal/onboard/page.tsx
  - dashboard/src/components/portal/PortalShell.tsx
  - dashboard/src/lib/web3/siwe-auth.ts
  - grid/src/api/portal/auth.ts
  - grid/src/api/portal/chat.ts
  - grid/src/api/portal/check-frozen.ts
  - grid/src/api/portal/index.ts
  - grid/src/api/server.ts
  - grid/src/db/schema.ts
  - grid/src/main.ts
  - grid/test/db/schema-v14.test.ts
  - grid/test/portal/auth-me-onboarded.test.ts
  - grid/test/portal/auth-me-patch.test.ts
  - grid/test/portal/chat.test.ts
  - grid/test/portal/integration-onboard.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 26 delivers the Sophia onboarding wizard: a 3-step frontend wizard (Welcome → Sophia chat → World Tour), a new `/api/v1/portal/chat/onboard` LLM-proxy endpoint, a `PATCH /api/v1/portal/auth/me` endpoint for storing the onboarding goal, and a `GET /me` enhancement that derives `onboarded: boolean` from the DB. The migration adds `onboarding_goal TEXT NULL` to `human_users` (v14).

The overall implementation is well-structured. Security fundamentals are sound: JWT guards on both new endpoints, input validation, scrypt password hashing with timing-safe compare, and nonce consumption to prevent replay. No hardcoded secrets or injection vulnerabilities were found.

Four warnings require attention before shipping, all in the backend: (1) user-controlled message content is forwarded to Ollama without sanitizing individual message fields, (2) the CORS allowlist blocks the PATCH method, which will silently fail in browsers, (3) the frozen-check preHandler does not intercept PATCH requests (method-agnostic regex matches fine), and (4) the `onboarding_goal` field in the PATCH handler is stored raw to the DB — the truncation happens but the value is still stored verbatim rather than trimmed.

---

## Warnings

### WR-01: CORS `methods` array omits PATCH — browser PATCH requests to Grid will be rejected

**File:** `grid/src/api/server.ts:263`
**Issue:** The CORS plugin is registered with `methods: ['GET', 'POST', 'OPTIONS']`. The new `PATCH /api/v1/portal/auth/me` endpoint is called cross-origin from the Next.js dashboard (port 3001 → 8080). Browsers will send a preflight `OPTIONS` for the PATCH method; the CORS plugin will respond without `Access-Control-Allow-Methods: PATCH`, causing the browser to block the actual request. The endpoint works in Fastify inject tests (no CORS) but will silently fail in real browser sessions.

**Fix:**
```typescript
void app.register(cors, {
    origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
});
```

---

### WR-02: User-controlled message content forwarded to Ollama without per-field validation

**File:** `grid/src/api/portal/chat.ts:82-84`
**Issue:** The `messages` body is array-validated and capped at 10 items, but the content of each message object is cast directly to `Array<{ role: string; content: string }>` and forwarded to Ollama without checking field types or sizes. A malicious client could send objects where `role` or `content` are non-strings, very large strings, or contain values designed to confuse Ollama. The system prompt is fixed and prepended (good), but unbounded content per message could still cause unexpected LLM behavior or large upstream payloads.

**Fix:** Add per-message validation before forwarding:
```typescript
// After the messages.length > 10 check:
const validMessages = (messages as unknown[]).filter(
    (m): m is { role: string; content: string } =>
        typeof m === 'object' && m !== null &&
        typeof (m as Record<string, unknown>).role === 'string' &&
        typeof (m as Record<string, unknown>).content === 'string' &&
        ((m as Record<string, unknown>).content as string).length <= 4000,
);
if (validMessages.length !== messages.length) {
    return reply.status(400).send({ error: 'invalid_request' });
}
```

---

### WR-03: `onboarding_goal` is stored with leading/trailing whitespace; trimming happens on validation but not on storage

**File:** `grid/src/api/portal/auth.ts:343-346`
**Issue:** The PATCH `/me` handler validates that `onboarding_goal.trim().length !== 0` (so whitespace-only is rejected) but then stores the *untrimmed* value in the DB: `const truncated = onboarding_goal.slice(0, 2000)`. A goal of `"  explore AI  "` passes validation and is stored with surrounding spaces. The `GET /me` logic only checks `!== null && !== undefined`, so the trailing-space goal still marks the user as onboarded (fine), but the raw stored value is noisier than intended.

**Fix:** Apply `trim()` before truncation:
```typescript
const trimmed = onboarding_goal.trim();
// (already validated trimmed.length > 0 above)
const truncated = trimmed.slice(0, 2000);
```

---

### WR-04: `siwe-auth.ts` silently drops `onboarded` from the returned `HumanUser` after `/verify`

**File:** `dashboard/src/lib/web3/siwe-auth.ts:99-105`
**Issue:** The `/verify` response includes `is_new` but `onboarded` is never returned by the verify endpoint (by design). The `signInWithEthereum` function returns a partial `HumanUser` without `onboarded`. The auth page correctly follows up with `GET /me` to hydrate `onboarded`, but the pattern creates a window where `currentUser` in the store has `onboarded: undefined`. `PortalShell.tsx` checks `currentUser.onboarded === false` (strict equality), so `undefined` passes through the guard and does not redirect to onboarding. The `/me` fetch in the auth page usually succeeds, but if it fails the user lands on `/portal` without completing onboarding.

This is a latent bug: the fallback paths at lines 149 and 219 of `auth/page.tsx` push to `/portal` unconditionally when `/me` fails, bypassing the onboarding guard for new users.

**Fix:** In `siwe-auth.ts`, return `onboarded: false` as an explicit default so the store is never in an ambiguous `undefined` state:
```typescript
return {
    did: userData.did,
    eth_address: userData.eth_address,
    region: userData.region,
    created_at: userData.created_at,
    onboarded: false,  // conservative default; GET /me will update
};
```
And update `HumanUser.onboarded` in the type to be required (not optional), so TypeScript catches future callers that omit it.

---

## Info

### IN-01: `detectClose` function is duplicated between frontend and backend

**File:** `dashboard/src/app/portal/onboard/StepSophiaChat.tsx:13-19` and `grid/src/api/portal/chat.ts:36-42`
**Issue:** The `detectClose` function is copy-pasted verbatim in both the frontend component and the backend chat route. The backend returns `done: boolean` precisely so the frontend can rely on it — the frontend's duplicate `detectClose` at line 63 acts as a client-side fallback (`data.done || detectClose(data.reply)`). This is intentional as a belt-and-suspenders pattern, but the duplication means any future phrase additions to the detection logic must be updated in two places.

**Fix:** Document the intentional duplication with a comment. If it ever diverges, consolidation is worth a dedicated task.

---

### IN-02: Key-based chat message rendering uses array index as React key

**File:** `dashboard/src/app/portal/onboard/StepSophiaChat.tsx:128-130`
**Issue:** Chat messages are rendered with `key={i}` (array index). If messages are ever reordered or prepended, React's reconciler will incorrectly reuse DOM nodes. In the current append-only pattern this is safe, but it is a latent issue if scrollback or message editing is ever added.

**Fix:** Use a stable key. A simple approach:
```typescript
const [messages, setMessages] = useState<(ChatMessage & { id: number })[]>([]);
// assign id: Date.now() + index or a monotonic counter when appending
```

---

### IN-03: `handleWizardComplete` in onboard page does not confirm the PATCH succeeded before advancing

**File:** `dashboard/src/app/portal/onboard/page.tsx:33-46`
**Issue:** `handleSophiaDone` fires the PATCH and then unconditionally calls `setStep(3)` regardless of whether the server returned 200. If the server is busy, the user advances to step 3 (World Tour) and then completes onboarding without their goal being stored. The PATCH is labelled "non-blocking" intentionally, but this means a user could finish the wizard with `onboarding_goal` still null — and subsequent `GET /me` calls would return `onboarded: false`, causing them to re-enter the wizard.

This is a design choice documented in the plans (D-08). Flagging as info rather than warning since the plan explicitly calls it non-blocking. If the acceptance criteria require the goal to be persisted before completion, the step advancement should be gated.

**Fix (if goal storage is required for `onboarded=true`):** Await the PATCH and gate `setStep(3)` on success. If intentionally non-blocking, add a comment citing D-08 directly.

---

### IN-04: `PortalShell.tsx` onboarding redirect fires on every render while redirect is in flight

**File:** `dashboard/src/components/portal/PortalShell.tsx:26-29`
**Issue:** The redirect guard calls `router.replace('/portal/onboard')` synchronously during render (not inside a `useEffect`). In React's concurrent rendering model, this can fire multiple times before the navigation settles. `router.replace` is idempotent for the same URL, so this does not cause visible bugs today, but it is a misuse of the rendering model and could cause issues with future React versions.

**Fix:** Wrap in `useEffect`:
```typescript
useEffect(() => {
    if (currentUser !== null && currentUser.onboarded === false && pathname !== '/portal/onboard') {
        router.replace('/portal/onboard');
    }
}, [currentUser, pathname, router]);
```
Return `null` from the component until the effect fires.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
