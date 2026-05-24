# Phase 30: Resources & Support — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full help ecosystem at `/portal/help/*`: a hub landing page, interactive getting-started guide (with live progress from Grid), a comprehensive FAQ accordion, the full Noēsis glossary with anchor navigation, and a support ticket form backed by a new `support_tickets` DB table and two Grid API endpoints.

**Requirements covered:** HELP-01 through HELP-05.

**Allowlist delta: 0.** Support ticket creation is a user-service action, not a Grid economic/social event. The allowlist is frozen at 53 and must not grow in this phase.

</domain>

<decisions>
## Implementation Decisions

### Route Architecture

- **D-01:** All help content lives under `/portal/help/*`. The new hub at `/portal/help/page.tsx` is the entry point with links to sub-sections. The existing `/portal/docs`, `/portal/glossary`, and `/portal/help` placeholder pages are superseded — their sidebar entries will point to the new `/portal/help/*` hierarchy.
- **D-02:** Sub-routes: `/portal/help` (hub), `/portal/help/guide` (getting started), `/portal/help/faq` (FAQ), `/portal/help/glossary` (glossary), `/portal/help/contact` (support ticket form).
- **D-03:** The existing `/portal/glossary/page.tsx` content (16 terms) is incorporated into `/portal/help/glossary` with anchor links added. The existing `/portal/docs/page.tsx` section list becomes the scaffold for the guide. The existing `/portal/help/page.tsx` FAQs (8 Q&A pairs) are incorporated into `/portal/help/faq`.
- **D-04:** PortalSidebar nav items for `/portal/docs`, `/portal/glossary`, and `/portal/help` are updated to point to `/portal/help`, `/portal/help/glossary`, and `/portal/help/faq` respectively. The old routes remain (404 is acceptable) — no redirect infra needed.

### Static Content (HELP-01, HELP-03, HELP-04)

- **D-05:** All three static pages are Next.js server components (no `'use client'`). No state, no hooks, no wagmi — pure SSR HTML. Follows the pattern of `portal/privacy/page.tsx`, `portal/terms/page.tsx`, `portal/status/page.tsx`.
- **D-06:** FAQ accordion uses pure CSS `<details>`/`<summary>` elements — no JavaScript accordion library. Categories implemented as labeled sections. Client-side search via a thin `'use client'` wrapper with `useState` on the FAQ text — only the search input needs hydration. The static fallback (without search) works immediately.
- **D-07:** Glossary terms are alphabetical. Anchor IDs derived from term slugs (lowercase, spaces→hyphens). "Jump to letter" nav at top for A/B/D/G/L/N/O/P/S/T/W coverage.

### Getting Started Guide (HELP-02)

- **D-08:** The guide is a `'use client'` component — it fetches progress from `GET /api/v1/portal/human/me/progress` and renders each step with a checkmark if the milestone is complete. The endpoint returns:
  ```json
  { "onboarded": true, "hasNous": false, "hasChatted": false, "hasTipped": false }
  ```
- **D-09:** Progress endpoint query: join `human_users` (for `onboarding_goal IS NOT NULL`) with `nous_registry` (for `human_owner = ?`). `hasChatted` and `hasTipped` are derived from audit trail or defaulted to `false` in v1 (checking audit_trail for `human.spoke` and `human.transferred` per the logged human DID). If audit query is too costly, both default `false` — the guide still renders correctly and shows the CTA steps.
- **D-10:** 6 guide steps: (1) Connect Wallet, (2) Complete Sophia Onboarding, (3) Explore Nous Profiles, (4) Chat with a Nous, (5) Send a Cyber Coin Tip, (6) Spawn Your Own Nous. Each step has: title, description, CTA link, completion badge. Completion badges driven by the progress object.
- **D-11:** If the user is not authenticated, the guide page redirects to `/portal/auth` (same pattern as other protected portal pages).

### Support Ticket Flow (HELP-05)

- **D-12:** New DB migration v18: `support_tickets` table.
  ```sql
  CREATE TABLE IF NOT EXISTS support_tickets (
      id             CHAR(36)     NOT NULL,
      human_did      VARCHAR(255) NOT NULL,
      subject        VARCHAR(32)  NOT NULL,
      message        TEXT         NOT NULL,
      attachment_url TEXT         NULL,
      status         ENUM('open','closed') NOT NULL DEFAULT 'open',
      created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX idx_support_tickets_human (human_did)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  ```
- **D-13:** Grid endpoints in `grid/src/api/portal/support.ts`:
  - `POST /api/v1/portal/support/tickets` — accepts `{ subject, message, attachment_url? }`, validates subject is one of `['Bug Report', 'Feature Request', 'Account Issue', 'Payment Issue', 'Other']`, message ≤ 1000 chars, inserts row with `randomUUID()` as id. Returns `{ id, status: 'open' }`. Requires JWT cookie auth.
  - `GET /api/v1/portal/support/tickets` — returns the user's own tickets (last 20, ordered by created_at DESC). Requires JWT cookie auth.
- **D-14:** Attachment upload is OMITTED from v1. The `attachment_url` column is nullable and accepts `null`. The form has no file input. This keeps the implementation simple (no S3/base64 blob storage complexity). A note in the UI says "Screenshot upload coming soon."
- **D-15:** No audit event for ticket creation. No `appendHumanTicketed` emitter. The allowlist stays at 53.
- **D-16:** Dashboard ticket form is a `'use client'` component with controlled inputs, submit handler, loading state, and success/error feedback. Ticket list (GET) is fetched on mount. Form and list coexist on the same `/portal/help/contact` page.

### Sidebar Navigation

- **D-17:** PortalSidebar nav group "Help & Docs" (currently at lines 63-68) is updated:
  - `/portal/docs` → `/portal/help` (label: "Help Center", phase: '30' removed — it's live now)
  - `/portal/glossary` → `/portal/help/glossary`
  - `/portal/help` → `/portal/help/faq` (label: "FAQ")
  - Add: `/portal/help/guide` (label: "Getting Started", phase: '30')
  - Add: `/portal/help/contact` (label: "Support", phase: '30')

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Existing placeholder pages (read before replacing)
- `dashboard/src/app/portal/help/page.tsx` — existing 8-FAQ + quick-glossary placeholder; reuse FAQ content
- `dashboard/src/app/portal/glossary/page.tsx` — existing 16-term glossary; incorporate into help/glossary
- `dashboard/src/app/portal/docs/page.tsx` — existing doc section scaffold; use section names for guide steps

### Portal patterns
- `dashboard/src/app/portal/privacy/page.tsx` — server component pattern (no 'use client', editorial theme)
- `dashboard/src/app/portal/terms/page.tsx` — same server component pattern
- `dashboard/src/app/portal/community/page.tsx` — Phase 28 placeholder style
- `dashboard/src/components/portal/PortalSidebar.tsx` — nav link structure to update (D-17)

### Grid backend patterns
- `grid/src/api/portal/auth.ts` — JWT cookie extraction, `humanPool` query pattern
- `grid/src/api/portal/nous.ts` — registered portal route module pattern
- `grid/src/api/portal/index.ts` — register all portal routes; Phase 30 adds `registerSupportRoutes`
- `grid/src/db/schema.ts` — current high watermark: v17 (`unique_nous_per_human`). Phase 30 migration is v18.

### Design system
- CSS variables: `--navy`, `--parchment`, `--parchment-2`, `--bronze`, `--ink`, `--muted`, `--rule`, `--serif`, `--sans-portal`, `--mono-portal`
- Never Tailwind color classes; always `style={{ ... }}` with CSS variable references
- `dynamic({ ssr: false })` required only for wagmi/canvas components; static server components need none

</canonical_refs>

<code_context>
## Existing Code Insights

### What already exists
- `/portal/help/page.tsx`: 8 FAQ entries (reuse for HELP-03) + 5-term quick glossary (merge into HELP-04)
- `/portal/glossary/page.tsx`: 16 terms alphabetically from Agora to Whisper (reuse for HELP-04)
- `/portal/docs/page.tsx`: 5 sections with 15 doc stubs (use section titles for HELP-02 guide steps)
- `PortalSidebar.tsx`: Nav already has `/portal/help`, `/portal/glossary`, `/portal/docs` — update to `/portal/help/*`

### humanPool query pattern (from portal/auth.ts and spawn.ts)
```typescript
const [rows] = await services.humanPool.query(
    'SELECT column FROM table WHERE human_did = ?',
    [humanDid],
) as [Array<{ column: string }>, unknown];
```

### JWT extraction in portal routes
```typescript
// Session is populated by the JWT middleware registered before all portal routes
// Access via: request.session?.humanDid
```

### Migration append pattern (schema.ts)
Migrations are append-only. Phase 30 adds v18 after v17. Never modify existing entries.

</code_context>

<deferred>
## Deferred Ideas

- Attachment/screenshot upload on support tickets (S3, base64) — D-14 defers this
- Admin/operator UI for viewing/closing tickets — separate operator console concern
- Full-text search across docs/glossary (backend) — client-side filter is sufficient for v1
- Streaming ticket status updates (WebSocket) — polling or static list is sufficient
- Internationalization of help content — v1 is English-only

</deferred>

---

*Phase: 30-resources-support*
*Context gathered: 2026-05-23*
