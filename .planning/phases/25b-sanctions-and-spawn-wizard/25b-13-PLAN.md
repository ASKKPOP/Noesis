---
phase: 25b-sanctions-and-spawn-wizard
plan: 13
type: execute
wave: 3
depends_on: [25b-12]
files_modified:
  - grid/src/api/portal/check-frozen.ts
  - grid/src/api/portal/index.ts
  - steward/src/app/humans/[did]/page.tsx
  - grid/test/portal/check-frozen.test.ts
autonomous: true
requirements: [D-25b-08, D-25b-NEW-4]
tags: [portal-middleware, steward-ui, sanctions, humans]

must_haves:
  truths:
    - "Portal middleware checks human_users.frozen and returns 403 human_frozen on portal action routes"
    - "SIWE sign-in is NOT blocked (frozen humans can still authenticate)"
    - "Steward /humans/[did] page has Sanctions tab/card with ban + freeze actions (H5 confirm dialog)"
    - "All sanction fetches from Steward use header-auth"
  artifacts:
    - path: "grid/src/api/portal/check-frozen.ts"
      provides: "Fastify preHandler that blocks portal action routes for frozen humans"
      exports: ["registerFrozenCheck"]
    - path: "steward/src/app/humans/[did]/page.tsx"
      provides: "Sanctions tab with ban + freeze rows using H5 confirm dialog"
      contains: "Sanctions"
  key_links:
    - from: "Portal action routes"
      to: "check-frozen preHandler"
      via: "Fastify addHook('preHandler')"
      pattern: "addHook.*preHandler"
    - from: "Steward humans page Sanctions tab"
      to: "POST /api/v1/operator/humans/:did/{ban,freeze}"
      via: "fetch with header-auth"
      pattern: "x-operator-tier"
---

<objective>
Two coordinated changes for human-sanction enforcement:
1. Portal middleware (Grid-side): preHandler reads `human_users.frozen` and blocks portal action routes (forward-compat for phases 26+27 chat/tip/spawn). SIWE sign-in remains allowed.
2. Steward UI: add Sanctions tab to `/humans/[did]` page with H5 confirm dialog for ban and freeze.

Purpose: Close the loop — sanctions emitted in plan 12 must produce observable runtime effects + operator UI to trigger them.

Output: 1 new middleware file + portal index registration + Steward UI mod + middleware tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-CONTEXT.md
@.planning/phases/25b-sanctions-and-spawn-wizard/25b-PATTERNS.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Portal preHandler middleware — frozen check</name>
  <files>grid/src/api/portal/check-frozen.ts, grid/src/api/portal/index.ts, grid/test/portal/check-frozen.test.ts</files>
  <read_first>
    - grid/src/api/portal/auth.ts (existing SIWE preHandler — pattern reference for hook registration + session reads)
    - grid/src/api/portal/index.ts (where preHandlers are registered)
    - grid/src/api/portal/wallet.ts (example portal action route — for "what counts as a portal action")
  </read_first>
  <behavior>
    - Frozen human (human_users.frozen=1) → portal action routes return 403 `{error:'human_frozen'}`
    - Frozen human → SIWE sign-in routes (auth.ts endpoints) return 200 normally
    - Non-frozen human → portal action routes proceed to handler
    - Unauthenticated request (no session.humanDid) → middleware passes through (auth.ts handles)
    - Banned human (human_users.banned=1) → ALSO returns 403, but with `{error:'human_banned'}` (banned implies frozen behavior PLUS no auth)
  </behavior>
  <action>
    Create `grid/src/api/portal/check-frozen.ts`:

    ```typescript
    import type { FastifyInstance, FastifyRequest } from 'fastify';
    import type { GridServices } from '../server.js';

    // Routes that constitute portal "actions" (write-side). Auth-only routes excluded.
    // Forward-compat: phases 26 (chat, tip), 27 (spawn) will add to this list.
    const PORTAL_ACTION_PATTERNS: RegExp[] = [
      /^\/api\/v1\/portal\/wallet\//,  // existing wallet write actions
      // Phase 26+27 routes added here when shipped
    ];

    function isPortalActionRoute(url: string): boolean {
      return PORTAL_ACTION_PATTERNS.some(re => re.test(url));
    }

    export function registerFrozenCheck(app: FastifyInstance, services: GridServices): void {
      app.addHook('preHandler', async (req, reply) => {
        if (!isPortalActionRoute(req.url)) return;
        const humanDid = (req as FastifyRequest & { session?: { humanDid?: string } }).session?.humanDid;
        if (!humanDid) return;  // auth middleware handles unauth
        const row = await services.db.queryOne<{ frozen: number; banned: number }>(
          'SELECT frozen, banned FROM human_users WHERE did = ?',
          [humanDid],
        );
        if (row?.banned === 1) {
          reply.code(403);
          return { error: 'human_banned' };
        }
        if (row?.frozen === 1) {
          reply.code(403);
          return { error: 'human_frozen' };
        }
      });
    }
    ```

    Adapt the DB query call signature to match the actual `services.db` API in this codebase (read auth.ts to confirm).

    Register in `grid/src/api/portal/index.ts` AFTER the SIWE auth middleware (order matters — SIWE populates session.humanDid which this middleware reads).

    Tests in `grid/test/portal/check-frozen.test.ts`:
    - Frozen human + portal action URL → 403 human_frozen
    - Banned human + portal action URL → 403 human_banned (takes priority over frozen)
    - Frozen human + SIWE login URL → not intercepted (returns whatever auth.ts returns)
    - Non-frozen human + portal action URL → middleware passes through
    - No session → middleware passes through
  </action>
  <verify>
    <automated>npm --prefix grid run test -- run test/portal/check-frozen.test.ts</automated>
  </verify>
  <done>
    - Middleware exists, registered after SIWE auth
    - Blocks portal actions for frozen/banned humans
    - Allows SIWE sign-in for frozen humans
    - All test cases pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Sanctions tab to Steward /humans/[did] page</name>
  <files>steward/src/app/humans/[did]/page.tsx</files>
  <read_first>
    - steward/src/app/humans/[did]/page.tsx (entire file — note TABS array at lines ~118-122 + existing tab panel structure)
    - steward/src/app/nous/[id]/page.tsx (Danger Zone H5 IrreversibilityDialog pattern at lines ~842-952 — clone confirm-typing pattern for human sanctions)
    - steward/src/app/nous/[id]/page.tsx (Sanctions card from plan 11 — fetch header-auth pattern)
  </read_first>
  <action>
    1. Add "Sanctions" entry to the TABS array (alongside existing Profile/History/Nous tabs).
    2. Add a corresponding tab panel rendering two sanction rows:

       **Ban Human (H5)** — H5 confirm dialog (clone Danger Zone shape):
       - Title: "Ban Human (H5)"
       - Warning text: "This revokes all portal access. Sanction is reversible only by H5 operator clearing the flag manually (no UI in 25b)."
       - Confirm field: type the human's wallet address (last 6 chars) to enable submit
       - Reason textarea (required, ≥10 chars)
       - Submit button (disabled until confirm matches) → fetch `POST /api/v1/operator/humans/${did}/ban` body `{reason}`

       **Freeze Wallet (H5)** — H5 confirm dialog (same shape):
       - Title: "Freeze Wallet (H5)"
       - Warning text: "This blocks portal actions (chat, tip, spawn). User can still sign in to see status. Zero-custody: on-chain wallet is NOT affected."
       - Confirm field: type last 6 chars of wallet address
       - Reason textarea (required, ≥10 chars)
       - Submit button → fetch `POST /api/v1/operator/humans/${did}/freeze` body `{reason}`

    3. Both fetches use the header-auth pattern from plan 11 with `x-operator-tier: '5'` and the env-supplied operator_id. NEVER include tier/operator_id in body.

    4. Response handling: 200 → success banner; 400/401/403/404 → show error code; network error → "Network error".

    5. State: local useState per row. Do not lift to global store.

    Do NOT modify existing Profile/History/Nous tabs — surgical change per CLAUDE.md §3.
  </action>
  <verify>
    <automated>npm --prefix steward run build</automated>
  </verify>
  <done>
    - Sanctions tab added to TABS array
    - Tab panel renders 2 rows with H5 confirm dialogs
    - All fetches use header-auth, no body tier
    - Build succeeds
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Portal session → portal action routes | Frozen flag enforced server-side; client cannot bypass |
| Frozen flag → on-chain wallet | NEVER cross — D-25b-NEW-4 zero-custody |
| Steward UI → ban/freeze routes | Untrusted client must not claim H5 (validated by Grid header-auth from plan 12) |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25b-13-01 | Bypass | Portal middleware | mitigate | Hook order: SIWE auth runs first to populate session; check-frozen runs after; PORTAL_ACTION_PATTERNS list explicit; tests assert SIWE sign-in NOT blocked for frozen users |
| T-25b-13-02 | Accidental sanction | Steward Sanctions tab | mitigate | H5 confirm dialog requires typing wallet-address suffix + reason ≥10 chars before submit enabled (clone of Phase 8 IrreversibilityDialog) |
| T-25b-13-03 | Information Disclosure | Frozen status in error response | accept | Returning `{error:'human_frozen'}` to authenticated user is intentional — user has right to know their own status |
</threat_model>

<verification>
- `npm --prefix grid run test -- run test/portal/check-frozen.test.ts` passes
- `npm --prefix steward run build` succeeds
- `grep -n "isPortalActionRoute" grid/src/api/portal/check-frozen.ts` confirms the helper exists
- `grep -c "x-operator-tier" steward/src/app/humans/[did]/page.tsx` shows ≥2 new occurrences
</verification>

<success_criteria>
- Portal middleware blocks frozen/banned humans on action routes; allows SIWE sign-in
- Steward humans page has Sanctions tab with 2 H5 actions and confirm dialogs
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/25b-sanctions-and-spawn-wizard/25b-13-SUMMARY.md`
</output>
