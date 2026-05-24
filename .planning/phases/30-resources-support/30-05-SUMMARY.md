---
phase: 30-resources-support
plan: "05"
title: "Support Ticket Flow (/portal/help/contact) + Grid Ticket API + DB Migration v22"
subsystem: portal-support
tags: [support-tickets, db-migration, grid-api, dashboard-ui, portal]
dependency_graph:
  requires: [30-04]
  provides: [support-ticket-flow, migration-v22, POST-support-tickets, GET-support-tickets]
  affects: [grid/src/db/schema.ts, grid/src/api/portal/support.ts, dashboard/src/app/portal/help/contact/page.tsx]
tech_stack:
  added: []
  patterns: [randomUUID-from-crypto, fastify-route-pattern, controlled-react-form, useEffect-refetch-on-state-change]
key_files:
  created:
    - dashboard/src/app/portal/help/contact/page.tsx
  modified:
    - grid/src/db/schema.ts
    - grid/src/api/portal/support.ts
decisions:
  - "Migration version assigned v22 (not v18 as planned) because v18-v21 already existed in schema from prior plans"
  - "No audit event emitted for ticket creation — allowlist stays at 53 (D-15)"
  - "File upload (attachment_url) deferred — column exists in DB but form has no file input (D-14)"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-23"
  tasks_completed: 3
  files_changed: 3
---

# Phase 30 Plan 05: Support Ticket Flow Summary

Full support ticket flow delivered: DB migration, two Grid API endpoints, and the dashboard contact page with form and ticket history.

## What Was Built

### Migration v22 — support_tickets table (`grid/src/db/schema.ts`)

Added append-only migration v22 (the plan specified v18, but v18-v21 were already present — see Deviations):

```sql
CREATE TABLE IF NOT EXISTS support_tickets (
    id             CHAR(36)     NOT NULL,
    human_did      VARCHAR(255) NOT NULL,
    subject        VARCHAR(64)  NOT NULL,
    message        TEXT         NOT NULL,
    attachment_url TEXT         NULL,
    status         ENUM('open','closed') NOT NULL DEFAULT 'open',
    created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_support_tickets_human (human_did)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

### Grid API — `grid/src/api/portal/support.ts`

Two routes added to `registerSupportRoutes`:

**POST /api/v1/portal/support/tickets**
- Validates subject against `VALID_SUBJECTS` Set (server-side enum enforcement)
- Validates message: 1-1000 characters
- Inserts row with `randomUUID()` pk, humanDid from JWT session
- Returns `{ id, status: 'open' }` with HTTP 201
- No audit event emitted (D-15, allowlist stays at 53)

**GET /api/v1/portal/support/tickets**
- Returns authenticated user's own last 20 tickets (newest first)
- WHERE human_did = ? prevents cross-user data leakage (T-30-10 mitigated)
- Returns `{ tickets: [...] }`

Subject enum values as implemented:
```
Bug Report | Feature Request | Account Issue | Payment Issue | Other
```

### Dashboard Contact Page — `dashboard/src/app/portal/help/contact/page.tsx`

- `'use client'` component with fully controlled form state
- Subject dropdown (select) + message textarea with 1000-char counter
- Client-side pre-validation before fetch
- POST to `/api/v1/portal/support/tickets` with `credentials: 'include'`
- GET on mount + after successful submit (via `successId` dep in useEffect)
- Success banner showing ticket ID
- Ticket history list with status badge (bronze=open, muted=closed), subject, date
- No file input — D-14: attachment upload deferred
- Breadcrumb: Help / Contact Support

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Adaptation] Migration assigned v22 instead of v18**
- **Found during:** Task 1
- **Issue:** Plan specified migration v18 for `support_tickets`, but the schema already contained v18 (`add_ousia_to_human_users`), v19 (`create_community_posts`), v20 (`create_community_replies`), and v21 (`create_user_follows`) from prior plans shipped in this branch.
- **Fix:** Assigned v22 as the next available version. The MIGRATIONS array remains strictly ordered and append-only. Idempotent `CREATE TABLE IF NOT EXISTS` ensures safe re-runs.
- **Files modified:** `grid/src/db/schema.ts`
- **Commit:** 019148f

## Known Stubs

None. The ticket form submits to a real endpoint, the ticket list fetches real data. The `attachment_url` column exists in the DB schema (NULL-able) but no form field is wired — this is intentional deferral (D-14), not a stub preventing the plan goal.

## Allowlist Verification

Allowlist count: **53** (unchanged). Verified by absence of `emitAudit`, `audit.emit`, or `auditTrail.add` calls in `support.ts`. The progress endpoint and both ticket routes deliberately omit audit events per D-15.

## Threat Surface Scan

No new network endpoints beyond those specified in the plan's threat model. T-30-07 (auth gate), T-30-08 (subject enum validation), T-30-10 (WHERE human_did = ?) all implemented as designed.

## Self-Check: PASSED

- `grid/src/db/schema.ts` — version 22 present, support_tickets appears 4 times
- `grid/src/api/portal/support.ts` — VALID_SUBJECTS (4 references), support/tickets (6 references), randomUUID (2), no audit emission
- `dashboard/src/app/portal/help/contact/page.tsx` — exists, 'use client', credentials: 'include' (2x), maxLength, no file input
- Grid TypeScript: clean compile
- Dashboard TypeScript: clean compile (pre-existing test file errors unrelated to this plan)
- Commits: 019148f, 4008cc9, 9829d4c
