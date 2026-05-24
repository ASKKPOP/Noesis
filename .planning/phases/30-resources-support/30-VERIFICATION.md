---
phase: 30-resources-support
verified: 2026-05-23T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /portal/help and confirm the hub renders four section cards (Getting Started, FAQ, Glossary, Contact Support) with working links"
    expected: "All four cards are visible and clicking each navigates to the correct sub-route"
    why_human: "Visual layout and routing require a browser; CSS grid and Link rendering cannot be verified statically"
  - test: "Navigate to /portal/help/faq, type a query in the search box, and confirm Q&A pairs filter in real time"
    expected: "Matching questions remain visible; non-matching questions are hidden; empty state shows contact link"
    why_human: "Client-side useState search filter behavior requires browser hydration to verify"
  - test: "Navigate to /portal/help/guide while authenticated and confirm live progress checkmarks appear"
    expected: "Completed steps show a bronze filled circle with a checkmark and DONE badge; incomplete steps show the step number"
    why_human: "Progress fetch (GET /api/v1/portal/human/me/progress) requires a running Grid server and authenticated session"
  - test: "Navigate to /portal/help/contact, submit a support ticket, and confirm the success banner and ticket history list update"
    expected: "Submitted ticket ID appears in the success banner; ticket appears in the list below with status 'open'"
    why_human: "Form submission flow (POST then GET re-fetch) requires a running Grid server and authenticated session"
---

# Phase 30: Resources & Support Verification Report

**Phase Goal:** Deliver a complete Help & Resources section — help center hub, FAQ, glossary, getting-started guide with live progress, and support ticket flow — so portal users have self-serve documentation and a channel to request help.
**Verified:** 2026-05-23
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | /portal/help renders a hub page with four section cards linking to guide, faq, glossary, contact | VERIFIED | `help/page.tsx` SECTIONS array has 4 entries with hrefs to /portal/help/guide, /portal/help/faq, /portal/help/glossary, /portal/help/contact; all via Next.js `<Link>` |
| 2 | PortalSidebar nav group shows Help Center, Getting Started, FAQ, Glossary, Support as sub-items | VERIFIED | `PortalSidebar.tsx` Resources section has exactly these 5 items; Help Center has `exact: true`; /portal/docs removed |
| 3 | /portal/help/faq renders ~20 FAQ pairs organized in at least 4 categories with accordion and client-side search | VERIFIED | `faq/page.tsx` has 20 Q&A pairs across 4 categories (Wallet & Auth, Cyber Coin, Nous & Agents, Community); `'use client'`, `useState`, `<details>/<summary>` all present |
| 4 | /portal/help/glossary renders all key Noēsis terms with anchor IDs, letter nav, and cross-references | VERIFIED | `glossary/page.tsx` has 26 terms with `id={t.slug}`, letter jump nav (`id="jump-nav"`), and SEE ALSO cross-links |
| 5 | /portal/help/guide renders 6 steps with live completion checkmarks from Grid progress endpoint | VERIFIED | `guide/page.tsx` has 6-item STEPS array; fetches `/api/v1/portal/human/me/progress` with `credentials: 'include'`; shows bronze checkmark + DONE badge for completed steps |
| 6 | Grid endpoint returns onboarded/hasNous/hasChatted/hasTipped boolean flags | VERIFIED | `support.ts` GET /api/v1/portal/human/me/progress returns all 4 flags; queries human_users, nous_registry, and audit_trail |
| 7 | /portal/help/contact renders ticket form (subject select, message textarea) and ticket history list | VERIFIED | `contact/page.tsx` has controlled select + textarea with maxLength=1000; useEffect fetches GET tickets; POST on submit |
| 8 | POST /api/v1/portal/support/tickets validates subject enum and message length; returns {id, status: open} | VERIFIED | `support.ts` VALID_SUBJECTS Set enforces enum; message 1-1000 chars; randomUUID() pk; returns 201 {id, status: 'open'} |
| 9 | GET /api/v1/portal/support/tickets returns user's own last 20 tickets | VERIFIED | `support.ts` SELECT WHERE human_did = ? ORDER BY created_at DESC LIMIT 20; no cross-user leak |
| 10 | Migration v22 creates support_tickets table with UUID pk and human_did index | VERIFIED | `schema.ts` version 22, name 'create_support_tickets'; CHAR(36) pk, INDEX idx_support_tickets_human (human_did); attachment_url TEXT NULL present |
| 11 | No audit event emitted for ticket creation or progress fetch (allowlist stays at 53) | VERIFIED | `support.ts` contains no emitAudit/audit.emit calls; comment confirms D-15 compliance |
| 12 | registerSupportRoutes is registered in portal/index.ts | VERIFIED | `index.ts` line 16: import; line 96: call after all other route registrations |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `dashboard/src/app/portal/help/page.tsx` | Help center hub — four section cards + search bar | VERIFIED | Exists; substantive; linked from PortalSidebar |
| `dashboard/src/components/portal/PortalSidebar.tsx` | Updated nav with /portal/help/* sub-routes | VERIFIED | Exists; Resources section has 5 help items + exact guard |
| `dashboard/src/app/portal/help/faq/page.tsx` | FAQ page with accordion + client-side search | VERIFIED | Exists; 'use client'; useState; <details>/<summary>; 20 Q&As |
| `dashboard/src/app/portal/help/glossary/page.tsx` | Full glossary with anchor IDs and letter nav | VERIFIED | Exists; server component (no 'use client'); 26 terms; id={t.slug}; SEE ALSO |
| `dashboard/src/app/portal/help/guide/page.tsx` | Getting Started Guide with 6 steps and live progress | VERIFIED | Exists; 'use client'; STEPS[6]; fetch to me/progress |
| `grid/src/api/portal/support.ts` | GET /api/v1/portal/human/me/progress + POST/GET tickets | VERIFIED | Exists; all 3 endpoints present; VALID_SUBJECTS; randomUUID; real DB queries |
| `grid/src/db/schema.ts` | Migration v22 — support_tickets table | VERIFIED | version 22, name 'create_support_tickets', CREATE TABLE + DROP TABLE |
| `dashboard/src/app/portal/help/contact/page.tsx` | Support ticket form + ticket history list | VERIFIED | Exists; 'use client'; POST + GET fetches with credentials: include; maxLength=1000; no file input |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `help/page.tsx` | /portal/help/guide, /portal/help/faq, /portal/help/glossary, /portal/help/contact | Next.js Link hrefs | WIRED | SECTIONS array has all 4 hrefs; Link component used |
| `faq/page.tsx` | /portal/help (breadcrumb) | Link href="/portal/help" | WIRED | Breadcrumb Link confirmed |
| `glossary/page.tsx` | /portal/help (breadcrumb) | anchor href="/portal/help" | WIRED | Breadcrumb `<a>` confirmed |
| `guide/page.tsx` | GET /api/v1/portal/human/me/progress | fetch in useEffect with credentials: include | WIRED | `fetch('/api/v1/portal/human/me/progress', { credentials: 'include' })` in useEffect |
| `contact/page.tsx` | POST /api/v1/portal/support/tickets | fetch in handleSubmit with credentials: include | WIRED | fetch POST confirmed on form submit |
| `contact/page.tsx` | GET /api/v1/portal/support/tickets | fetch in useEffect with credentials: include | WIRED | fetch GET in useEffect with successId dependency |
| `grid/src/api/portal/support.ts` | grid/src/db/schema.ts support_tickets | INSERT INTO support_tickets via humanPool | WIRED | `services.humanPool.query('INSERT INTO support_tickets ...')` confirmed |
| `grid/src/api/portal/index.ts` | registerSupportRoutes | import + function call | WIRED | import line 16 + call line 96 confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `guide/page.tsx` | `progress` (Progress or null) | GET /api/v1/portal/human/me/progress | Yes — queries human_users, nous_registry, audit_trail | FLOWING |
| `contact/page.tsx` | `tickets` (Ticket[]) | GET /api/v1/portal/support/tickets | Yes — SELECT FROM support_tickets WHERE human_did = ? | FLOWING |
| `help/page.tsx` | Static content | Hardcoded SECTIONS const | n/a (static) | STATIC (intentional) |
| `faq/page.tsx` | `filtered` (filtered FAQS) | Hardcoded FAQS const + useState query | n/a (static + client filter) | STATIC (intentional) |
| `glossary/page.tsx` | TERMS array | Hardcoded const | n/a (static) | STATIC (intentional) |

### Behavioral Spot-Checks

Step 7b skipped — pages require a running Next.js dev server and Grid API. No standalone runnable entry point available for command-line spot-checks without starting services.

### Requirements Coverage

HELP-01 through HELP-05 are defined in phase plan frontmatter only — not present in `.planning/REQUIREMENTS.md` (which covers v2.2 through v2.4 milestones). These IDs are v2.5 portal-content requirements tracked exclusively via plan files.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HELP-01 | 30-01-PLAN.md | Help center hub at /portal/help + sidebar nav | SATISFIED | help/page.tsx hub verified; PortalSidebar Resources section verified |
| HELP-02 | 30-04-PLAN.md | Getting Started Guide with live progress from Grid | SATISFIED | guide/page.tsx fetches progress endpoint; endpoint queries real DB tables |
| HELP-03 | 30-02-PLAN.md | FAQ page with accordion categories and client-side search | SATISFIED | faq/page.tsx has 20 Q&As, 4 categories, details/summary accordion, useState filter |
| HELP-04 | 30-03-PLAN.md | Glossary with anchor IDs, letter nav, cross-references | SATISFIED | glossary/page.tsx has 26 terms, id={t.slug}, jump nav, SEE ALSO links |
| HELP-05 | 30-05-PLAN.md | Support ticket form + DB migration + Grid API (POST/GET) | SATISFIED | contact/page.tsx; schema.ts v22; support.ts POST+GET endpoints |

No orphaned requirements — all 5 HELP IDs are claimed and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `dashboard/src/app/portal/help/page.tsx` | 80 | `TODO: wire client-side filter` on search bar | Info | Intentional per plan D-06 — search bar is a decorative placeholder; FAQ page has real search |
| `dashboard/src/app/portal/help/contact/page.tsx` | 137 | `Screenshot upload coming soon.` | Info | Intentional per plan D-14 — attachment_url column exists in DB but file input deferred |

No blockers. Both patterns are explicitly sanctioned by plan decisions (D-06 and D-14). The search bar stub on the hub does not block any must-have — filtering is fully implemented on the FAQ page itself. The "coming soon" note on the contact page is intentional UX communication matching the intentionally deferred D-14 design decision.

One note: the 30-03-SUMMARY.md claims Hermes was added as a 26th term, but the actual glossary file does not contain a standalone Hermes entry. The 26 terms are: Agora, Agency Tier, Allowlist, Audit Chain, Brain, Creed, Cyber Coin, DID, Genesis Grid, Grid, Iris, Lore, Norm, Nous, Nous Registry, Ousia, Psyche, Region, SIWE, Skill, Sophia, Spawn, Telos, Themis, Tick, Whisper. The summary documentation was inaccurate on which term was "extra," but the outcome (26 substantive terms with anchors and cross-links) meets and exceeds the plan requirement of 25 terms. This is an Info-level discrepancy in the summary narrative only — the code is correct.

### Human Verification Required

#### 1. Hub Page Visual Layout

**Test:** Navigate to /portal/help while authenticated. Verify the 2x2 section card grid renders correctly with icons, titles, and descriptions.
**Expected:** Four cards visible in a 2-column grid; each card links to the correct sub-route; search bar placeholder renders but does not filter (intentional).
**Why human:** CSS grid layout and Next.js Link rendering require a browser.

#### 2. FAQ Client-Side Search Filter

**Test:** Navigate to /portal/help/faq and type a query (e.g., "wallet") in the filter input.
**Expected:** Only FAQ items matching the query text remain visible across all categories; categories with zero matching items are hidden; empty-state message appears when no results match with a link to /portal/help/contact.
**Why human:** useState + re-render behavior requires browser hydration.

#### 3. Getting Started Guide Live Progress

**Test:** Navigate to /portal/help/guide while authenticated with a known completion state (e.g., onboarded but no Nous spawned). Check step completion badges.
**Expected:** Step 1 (Connect Wallet) and Step 2 (Sophia Onboarding) show bronze checkmark circles with DONE badges; Steps 3-6 show numbered circles; progress subtitle reads "2 of 6 steps complete."
**Why human:** Requires a running Grid server with a valid JWT session and known DB state.

#### 4. Support Ticket Submission Flow

**Test:** Navigate to /portal/help/contact while authenticated. Select "Feature Request," enter a message, and submit.
**Expected:** Submit button shows "Submitting..." during POST; success banner appears with the ticket UUID; ticket list below updates to show the new ticket with status "open."
**Why human:** Requires a running Grid server with JWT authentication and MySQL connection for the support_tickets table.

### Gaps Summary

No gaps. All 12 must-have truths are verified in code. All 5 HELP requirements are satisfied. All key links are wired and data flows are confirmed. Two intentional stubs (hub search bar, contact file-upload note) are sanctioned by plan design decisions and do not block any phase goal.

The 4 human verification items test behaviors that require a running Next.js dev server and Grid API — they cannot be verified statically. All code paths leading to those behaviors are verified and correctly wired.

---

_Verified: 2026-05-23_
_Verifier: Claude (gsd-verifier)_
