---
phase: 25b-sanctions-and-spawn-wizard
plan: 11
type: execute
wave: 2
depends_on: [25b-09, 25b-10]
files_modified:
  - steward/src/app/nous/[id]/page.tsx
autonomous: true
requirements: [D-25b-07]
tags: [steward-ui, sanctions, nous-detail]

must_haves:
  truths:
    - "Nous detail page has Sanctions card with 4 actions (mute, force-sleep, quarantine, slash)"
    - "H3 actions (mute, force-sleep) use single-click + reason prompt pattern"
    - "H4 actions (quarantine, slash) use single-click + reason prompt; slash adds amount field"
    - "All sanction fetches use header-auth (x-operator-tier + x-operator-id), never body tier"
    - "Successful sanction shows confirmation banner; error response shows error code"
  artifacts:
    - path: "steward/src/app/nous/[id]/page.tsx"
      provides: "Sanctions card with 4 sanction rows, header-auth fetches"
      contains: "Sanctions"
  key_links:
    - from: "Sanctions card submit"
      to: "POST /api/v1/operator/nous/:did/{mute,force-sleep,quarantine,slash}"
      via: "fetch with x-operator-tier + x-operator-id headers, body {reason, [amount]}"
      pattern: "x-operator-tier"
---

<objective>
Add a Sanctions card to the Steward `/nous/[id]` detail page exposing all 4 Nous sanction actions. Each action submits via the header-auth fetch pattern established in 25a-07. H4 actions use the same single-click + reason prompt as H3 (per Phase 6 H3 pattern in PATTERNS.md — H5 IrreversibilityDialog NOT required for these per umbrella decisions).

Purpose: Operator UI for Wave 2 routes.

Output: One UI file modification adding the Sanctions card.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-CONTEXT.md
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-PATTERNS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Sanctions card to /nous/[id] page</name>
  <files>steward/src/app/nous/[id]/page.tsx</files>
  <read_first>
    - steward/src/app/nous/[id]/page.tsx (entire file — note Force Telos form lines ~751-839 for H3 pattern, Danger Zone lines ~842-952 for shape reference, fetch header-auth pattern at lines ~221-231)
  </read_first>
  <action>
    Add a new card titled "Sanctions" between the existing Force Telos card and the Danger Zone card (preserve existing structure — do NOT modify Force Telos or Danger Zone).

    **Card structure** (clone steward-card visual shape from existing cards in this file):

    ```tsx
    {/* Sanctions */}
    <div className="steward-card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)',
                      fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>
            Sanctions
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Each SanctionRow below */}
        </div>
    </div>
    ```

    **Four sanction rows** — implement as inline JSX (do NOT extract to a separate component file; keep change surgical to this single page file per CLAUDE.md §3 "Surgical Changes"):

    1. **Mute Broadcast (H3)** — label "Mute Broadcast (H3)" + reason textarea + Submit button → fetch `POST /api/v1/operator/nous/${id}/mute` body `{reason}`
    2. **Force Sleep (H3)** — label "Force Sleep (H3)" + reason textarea + Submit button → fetch `POST /api/v1/operator/nous/${id}/force-sleep` body `{reason}`
    3. **Quarantine (H4)** — label "Quarantine (H4)" + reason textarea + Submit button → fetch `POST /api/v1/operator/nous/${id}/quarantine` body `{reason}`
    4. **Slash Cyber Coin (H4)** — label "Slash Cyber Coin (H4)" + amount number input + reason textarea + Submit button → fetch `POST /api/v1/operator/nous/${id}/slash` body `{amount, reason}`

    **Fetch pattern (clone of [id]/page.tsx:221-231) — use for EVERY sanction submit:**

    ```typescript
    const tier = '3'; // or '4' per row
    const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(id)}/mute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-operator-tier': tier,
        'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID
          ?? 'op:00000000-0000-4000-8000-000000000001',
      },
      body: JSON.stringify({ reason: reasonText /* , amount for slash */ }),
    });
    ```

    **Response handling:**
    - 200: show success banner ("Mute applied" etc.)
    - 400/401/403/404/410: show `{error.error}` code from response JSON
    - Network error: show "Network error" message

    **State management:** Use local `useState` hooks per row for reason text, amount (slash only), submit-in-flight flag, last-error/last-success message. Do NOT lift state to a global store.

    **Styling:** Match existing card styling in this file. Do not introduce new CSS files or design tokens.

    **D-25b-NEW-1 compliance:** NEVER include `tier` or `operator_id` in request body. All routes are header-auth.
  </action>
  <verify>
    <automated>npm --prefix steward run build</automated>
  </verify>
  <done>
    - Sanctions card visible in page tree
    - 4 sanction rows each with submit handler using header-auth fetch
    - No body field named `tier` or `operator_id` in any fetch
    - Builds without TS errors
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Browser → Steward Next.js → Grid sanction routes | Tier header sent client-side; Grid validates (defense in depth — Steward isn't auth source, Grid is) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-11-01 | Elevation of Privilege | Browser-side tier value | accept | Tier value originates client-side; final enforcement at Grid header-auth gate (plans 09-10). Steward is operator-trusted environment per umbrella decisions; SIWE-derived operator session is a later phase. |
| T-25b-11-02 | Information Disclosure | Reason text in browser | accept | Reason text typed by operator into their own browser; transmitted over HTTPS; stored Grid-side in sanction_reasons table. No new exposure beyond existing operator console surface. |
</threat_model>

<verification>
- `npm --prefix steward run build` succeeds
- Visual smoke: load `/nous/[id]` and confirm Sanctions card renders between Force Telos and Danger Zone
- `grep -c "x-operator-tier" steward/src/app/nous/[id]/page.tsx` shows ≥4 new occurrences (one per sanction row)
- `grep "JSON.stringify.*tier.*H" steward/src/app/nous/[id]/page.tsx` returns nothing (no body-tier)
</verification>

<success_criteria>
- Sanctions card rendered with 4 actions
- All fetches use header-auth
- Build passes
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-11-SUMMARY.md`
</output>
