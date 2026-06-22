# O3 "Forest" — installable PWA for human↔Nous chat (design)

**Date:** 2026-06-22 · **Decision:** PWA (installable web), not native, not just-responsive.

## What it is

A human's pocket window to their Nous: an **installable Progressive Web App** built on the
existing Next.js Portal, so a person can open "Forest" from their home screen and have a
**persistent conversation with their Nous**. Backend chat (O2c-a `ConversationStore`,
migration v53) already exists; the P2P rails (Phase 42) exist for a later real-time upgrade.

## What already exists (reuse)

- **Portal** — Next.js **15.2.4**, `dashboard/src/app/portal/`, SIWE + email auth → JWT cookie
  (`noesis_portal_token`); a `/portal/chat` UI already exists **but is transient** (localStorage,
  no server persistence; `dashboard/src/app/portal/chat/`).
- **O2c-a backend** — `grid/src/economy/conversation-store.ts` + `grid/src/api/routes/conversation.ts`
  (`POST/GET /api/v1/civic/conversation/:partnerDid`), but **civic_did_required (Brain JWT)** — a
  human's Portal session can't call them. Content is private (off the audit chain).
- **Notifications** — `GET /portal/api/v1/notifications` (poll-based, in-memory stub).

## The gaps Forest must fill

1. **O2c-b — human-authed persistent conversation routes** (the critical backend gap):
   `POST /api/v1/portal/conversation/:nousId/messages` + `GET /api/v1/portal/conversation/:nousId`,
   `portal_session_required`, ownership-checked (the human_did from the JWT must own/be paired
   with that Nous). Reuse `ConversationStore.postMessage/listThread` keyed to the human's DID.
2. **PWA shell** — `dashboard/public/manifest.json` (name, icons, `display:standalone`,
   `start_url:/portal`, `scope:/portal`) + a **service worker** (offline shell cache, stale-
   while-revalidate reads) + `<link rel="manifest">`. None exist today.
3. **Chat UI wired to O2c-b** — replace the localStorage transient store in `/portal/chat` with
   the persistent O2c-b routes; add an installable, mobile-first layout + unread badge.
4. **Notifications** — v1: in-app polling badge on `GET /portal/api/v1/notifications` (no new
   infra). Web Push (VAPID + SW `push` handler + subscription store) is **deferred** to a follow-up.

## Scope — phased (YAGNI)

**Phase O3a (MVP):** O2c-b routes + ConversationStore reuse + persistent chat UI + PWA manifest
+ service worker (installable, offline shell). A human installs Forest, opens it, and has a saved
conversation with their Nous. **HTTP chat — no WebRTC.**

**Deferred (explicit):**
- **WebRTC / P2P real-time** — browser RTCPeerConnection over the Phase-42 signal/TURN routes
  (no browser WebRTC client exists today). Big, separate; the MVP chat works over HTTP.
- **Web Push** — VAPID keys, SW push handler, subscription persistence, server-side dispatch.
- **Beyond chat** — surfacing dues/voting/marketplace in Forest (chat-only for v1).

## Architecture

```
Forest PWA (installed Portal /portal)
  └─ Chat UI ──HTTP(JWT cookie)──▶ POST/GET /api/v1/portal/conversation/:nousId  (O2c-b, NEW)
                                       └─ ConversationStore (v53, existing) keyed to human_did
  └─ Service worker: offline app-shell cache; poll notifications for unread badge
```

Auth path unchanged (SIWE/email → JWT cookie). O2c-b mirrors the existing
`portal/chat/nous/:nousId` auth pattern but **persists** via ConversationStore instead of
being transient.

## Files

- `grid/src/api/routes/portal-conversation.ts` (NEW — O2c-b) + policy entries + server wiring
- `grid/test/api/portal-conversation-route.test.ts` (NEW)
- `dashboard/public/manifest.json` (NEW) + `dashboard/public/sw.js` (NEW) + register in `portal/layout.tsx`
- `dashboard/src/app/portal/chat/` — swap localStorage → O2c-b client (`dashboard/src/lib/api/conversation.ts` NEW)

## Verification

Grid: vitest on the O2c-b routes (auth, ownership 403, persistence round-trip). Dashboard:
install/offline check via the preview tools (manifest detected, SW registers, chat persists
across reload). No new audit events (chat stays private/off-chain — preserves the O2c-a invariant).

## Open decisions for review

1. **Nous↔human pairing source** — what record proves a human "owns" the Nous it chats with?
   (the operator/me/nous roster? a Civic-DID↔human_did link?) — drives the O2c-b ownership check.
2. **Notifications v1** — accept poll-based badge for MVP, or is real Web Push required day one?
3. **Icons/branding** — does "Forest" get its own icon/name, or reuse Noēsis Portal branding?
