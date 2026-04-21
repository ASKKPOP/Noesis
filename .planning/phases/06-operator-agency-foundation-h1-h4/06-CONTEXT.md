# Phase 6: Operator Agency Foundation (H1–H4) - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** `/gsd-discuss-phase 6 --auto` (all gray areas auto-resolved with recommended options)

<domain>
## Phase Boundary

Every operator-initiated dashboard action declares a Human Agency Scale tier (H1–H4), elevates explicitly above H1 via a per-action confirmation dialog, and records the tier at commit time in the audit chain. The Agency Indicator is a persistent header element visible on every dashboard route. H5 Sovereign operations (Nous deletion) are explicitly OUT of scope — surfaced as a disabled affordance noting "requires Phase 8."

**In scope:**
- 5 new broadcast allowlist events: `operator.inspected`, `operator.paused`, `operator.resumed`, `operator.law_changed`, `operator.telos_forced` (11 → 16 events)
- Shared audit payload shape `{tier, action, target_did?, operator_id}` — with a test that fails if any `operator.*` event lacks `tier`
- Persistent `<AgencyIndicator />` header component (H1 default, tooltip with H1–H5 definitions)
- Per-action elevation dialog: "Entering H{N} — {TierName}. This will be logged." (exact text from REQ)
- Tier-stamped Grid API endpoints for H2 memory query, H3 pause/resume, H3 allowlist mutation, H3 law change, H4 force-Telos
- Operator identity scheme: session-scoped UUID (`op:<uuid>`) stored client-side
- H4 force-Telos emits hash-only `{telos_hash_before, telos_hash_after}` in broadcast payload (no goal contents — matches Phase 7 `telos.refined` privacy discipline)
- H5 affordance surfaces as disabled "requires Phase 8" placeholder
- Regression tests: tier-required invariant, elevation-race invariant (SC#4), payload privacy for all 5 new events

**Explicitly out of scope:**
- H5 Sovereign Nous deletion (Phase 8 — AGENCY-05)
- Multi-operator conflict resolution (deferred — OP-MULTI-01)
- Actual `telos.refined` peer-dialogue path (Phase 7 — DIALOG-01/02/03)
- Server-side enforcement of tier hierarchy (single-operator v2.1 — Grid trusts the stamp; future OP-MULTI-01 may add per-tier rate limits)
- Operator identity as a DID (explicitly rejected — DIDs are for Nous, per Phase 1 IDENT-01 semantics)
- Persistent operator sessions across browsers or cross-device sync (localStorage-scoped only)
- Session-wide elevation (explicitly rejected — single confirmation covers one action only, per AGENCY-04)

</domain>

<decisions>
## Implementation Decisions

### Agency Indicator — Persistence & Rendering

- **D-01:** Agency Indicator state is **per-operator, client-side, session-scoped** (localStorage in the dashboard). Grid does NOT hold tier state. This resolves the STATE.md open question ("per-operator session state vs global sim mode"). Rationale: global sim mode would require multi-operator conflict resolution (deferred to OP-MULTI-01); per-session state matches the single-operator v2.1 scope and leaves the future path open. On first page load, tier defaults to **H1 Observer**. Tier persists across reloads within the same browser but does not cross device/browser boundaries.
- **D-02:** The `<AgencyIndicator />` component mounts in the dashboard **root layout** (`dashboard/src/app/layout.tsx`) so it appears on every route without per-page plumbing. Test: no dashboard route can be entered without the indicator in the DOM (SC#1 from roadmap). The indicator exposes a tooltip (click or hover) containing the H1–H5 definitions verbatim from `PHILOSOPHY.md §7`. H5 in the tooltip renders with a "requires Phase 8" subdued affordance.
- **D-03:** The indicator is visually prominent but not intrusive: a single pill/chip in the top-right of the header with the current tier label (e.g. "H1 Observer"). Reuses existing `<Chip />` primitive from `dashboard/src/components/primitives/chip.tsx`. Tier-to-color mapping: H1 neutral, H2 blue, H3 amber, H4 red, H5 (disabled) gray with strikethrough affordance.

### Operator Identity

- **D-04:** Operator identity is a **session-scoped UUID** generated on first Agency Indicator mount and stored in `localStorage` under key `noesis.operator.id`. Format: `op:<uuid-v4>`. **Not a DID.** DIDs are reserved for Nous (per Phase 1 IDENT-01); widening that semantic space risks downstream confusion. `op:*` is a distinct, compact namespace. Every `operator.*` audit event carries this ID in payload. Stable across reloads in the same browser, ephemeral across devices/browsers.
- **D-05:** `operator_id` is NOT authenticated in Phase 6. Single-operator v2.1 means the audit trail's utility is forensic attribution within one steward session, not cross-operator accountability. OP-MULTI-01 may later bind `operator_id` to a login session or signed header.

### Elevation Dialog — UX & Race Handling

- **D-06:** Elevation from H1 to H2/H3/H4 triggers a **modal dialog** that intercepts the action before any HTTP dispatch. Dialog body text is REQ-verbatim: `"Entering H{N} — {TierName}. This will be logged."` Tier name map is: H2 Reviewer, H3 Partner, H4 Driver, H5 Sovereign. Cancel button → action aborts entirely, no request dispatched. Confirm button → dispatches the request with tier captured at the moment of confirm-click, then **the dialog closes and tier auto-downgrades back to H1**. This enforces AGENCY-04 "single confirmation covers one action only."
- **D-07:** Elevation-race invariant (SC#4 from roadmap): the tier committed to the audit chain is the tier captured at dialog-confirm time, NOT the tier active when the HTTP request arrives at Grid. Implementation: request body is constructed inside the dialog's confirm handler — body `{tier: "H{N}", ...}` is serialized before any network I/O. Regression test forces the following sequence: (1) operator clicks H4 action → dialog opens; (2) operator clicks Confirm; (3) before the request resolves, operator's client-side tier state downgrades to H1 (auto per D-06); (4) assert the committed audit event carries `tier: "H4"` (the confirmed value), not `tier: "H1"`.
- **D-08:** Dialog primitive lives at `dashboard/src/components/primitives/elevation-dialog.tsx`. Reuses existing primitives (`<Chip />`, typography). Built with native `<dialog>` element (accessibility: focus trap, Escape to cancel, keyboard-first). Test harness: RTL with fake timers to simulate the race sequence.

### Tier Map (AGENCY-02 locked)

- **D-09:** Action-to-tier mapping (REQ AGENCY-02 verbatim, restated for planner clarity):
  | Tier | Actions | Audit Events |
  |------|---------|--------------|
  | **H1 Observer** | Firehose read, region map, heartbeat, inspector open (presence-only) | none emitted |
  | **H2 Reviewer** | Query Nous memory (read-only, audit-logged) | `operator.inspected` |
  | **H3 Partner** | Pause sim, resume sim, mutate broadcast allowlist *(deferred — see below)*, change Grid law | `operator.paused`, `operator.resumed`, `operator.law_changed` |
  | **H4 Driver** | Force-mutate a Nous's Telos | `operator.telos_forced` |
  | **H5 Sovereign** | Delete a Nous | `operator.nous_deleted` (Phase 8 only) |
- **D-09a:** "Mutate broadcast allowlist" (AGENCY-02 H3 item #2) is deferred to a later phase. The allowlist is frozen at Grid bootstrap per the v2.0 invariant (`buildFrozenAllowlist` throws on Set.add/delete/clear); introducing runtime mutation requires rethinking that invariant and is non-trivial. Phase 6 ships 4 of the 5 H3 actions (pause, resume, law_changed, + the shared elevation infrastructure). Note this explicitly in VERIFICATION.md with a `partial REQ coverage` flag against AGENCY-02.
- **D-09b:** Inspector "open" at H1 displays presence-only data (DID, region, recent `nous.spoke` lines from firehose). Reading Nous memory requires explicit H2 elevation — this is the first elevation experience a dashboard user encounters and should be well-polished.

### Broadcast Allowlist Additions (5 new events)

- **D-10:** Allowlist grows from 11 → 16. New members appended to `ALLOWLIST_MEMBERS` in `grid/src/audit/broadcast-allowlist.ts` in this exact tuple order after `grid.stopped`:
  1. `operator.inspected` (H2)
  2. `operator.paused` (H3)
  3. `operator.resumed` (H3)
  4. `operator.law_changed` (H3)
  5. `operator.telos_forced` (H4)
- **D-11:** Shared payload shape for all 5 new events: `{tier: 'H1'|'H2'|'H3'|'H4'|'H5', action: string, operator_id: string, target_did?: string}`. Event-specific payload extensions (documented inline):
  - `operator.inspected`: `{tier, action: 'inspect', operator_id, target_did}` — `target_did` required
  - `operator.paused` / `operator.resumed`: `{tier, action, operator_id}` — no target, Grid-scoped
  - `operator.law_changed`: `{tier, action, operator_id, law_id, change_type: 'added'|'amended'|'repealed'}` — no law content in broadcast
  - `operator.telos_forced`: `{tier, action, operator_id, target_did, telos_hash_before, telos_hash_after}` — **hash-only**, matches Phase 7 `telos.refined` privacy discipline
- **D-12:** Every `operator.*` event passes `payloadPrivacyCheck()`. The `FORBIDDEN_KEY_PATTERN` (`/prompt|response|wiki|reflection|thought|emotion_delta/i`) already excludes `tier`, `action`, `operator_id`, `target_did`, `law_id`, `change_type`, `telos_hash_before`, `telos_hash_after`. Regression test in `grid/test/audit/broadcast-allowlist.test.ts` enumerates all 5 new event payloads.
- **D-13:** Tier-required invariant test: a contract test in `grid/test/audit/operator-events.test.ts` asserts that `audit.append(eventType, ...)` for any `eventType.startsWith('operator.')` rejects (throws or emits a validator failure) if the payload is missing the `tier` field. This enforces REQ AGENCY-03 as a structural guarantee, not a lint warning.

### Server-Side Enforcement Boundary

- **D-14:** Grid API middleware validates that every request to an operator action endpoint (`POST /api/v1/operator/...`) has a well-formed `{tier}` field in the request body. Rejects 400 Bad Request with a clear error if missing or malformed. **Grid does NOT verify tier-to-action mapping** — it trusts the dashboard to enforce tier rules. This is the correct scope for single-operator v2.1. Tier-hierarchy enforcement (e.g. "cannot force-Telos without elevating to H4") is client-side only.
- **D-15:** Dashboard enforces tier rules at the UI layer: actions mapped to H2+ are guarded by the elevation dialog (D-06). Bypassing this requires crafting direct HTTP requests, which is acceptable for v2.1 (single-operator, localhost-first, no untrusted clients). OP-MULTI-01 will add server-side hierarchy enforcement when the threat model changes.

### H2, H3, H4 Endpoint Shapes

- **D-16:** H2 memory query endpoint: `POST /api/v1/operator/memory/query` — body `{tier: 'H2', operator_id, target_did, query_params: {...}}`. Grid proxies to Brain via the existing JSON-RPC bridge. Response returns memory entries (IDs + content, audit-logged). Emits `operator.inspected` on every call.
- **D-17:** H3 pause/resume endpoints: `POST /api/v1/operator/clock/pause` and `POST /api/v1/operator/clock/resume`. Body `{tier: 'H3', operator_id}`. Wraps `WorldClock.pause()` / `WorldClock.resume()`. Sim resumes from exact tick where paused (determinism preserved, zero-diff invariant respected across pause/resume boundary — regression test asserts chain hashes match a non-paused simulation that reaches the same tick).
- **D-18:** H3 law-change endpoints: `POST /api/v1/operator/governance/laws` (add), `PUT /api/v1/operator/governance/laws/:id` (amend), `DELETE /api/v1/operator/governance/laws/:id` (repeal). Wraps `LogosEngine.proposeLaw()` (or equivalent) — see existing `grid/src/logos/engine.ts`. Body carries `{tier: 'H3', operator_id, law_body, change_type}`. Emits `operator.law_changed` with no law content in broadcast (content remains in the Grid's law store, accessible via the existing `GET /api/v1/governance/laws/:id` endpoint).
- **D-19:** H4 force-Telos endpoint: `POST /api/v1/operator/nous/:did/telos`. Body `{tier: 'H4', operator_id, target_did, new_telos: {...}}`. Grid forwards to Brain via bridge; Brain replaces its active Telos and returns `{telos_hash_before, telos_hash_after}`. Grid emits `operator.telos_forced` with the hashes (no goal contents in broadcast, matches Phase 7 `telos.refined` precedent). Full Telos content stays in Brain (sovereign memory per PHILOSOPHY §1).

### H5 Placeholder

- **D-20:** H5 delete affordance surfaces in the Inspector drawer as a **disabled** button with tooltip "Requires Phase 8 (Sovereign Operations)". Clicking is a no-op. No endpoint exists yet. The Agency Indicator tooltip shows H5 with subdued styling. This ensures SC#5 from roadmap ("H5 surfaces appear disabled with 'requires Phase 8' affordance") without leaking any deletion path into Phase 6 code.

### Testing Strategy

- **D-21:** Regression test matrix (REQ-to-test mapping):
  - AGENCY-01 → dashboard RTL test: every route renders `<AgencyIndicator />`
  - AGENCY-02 → tier-map test: each action's dispatcher carries the expected tier constant
  - AGENCY-03 → audit invariant test (D-13) + payload enumerator (D-12)
  - AGENCY-04 → elevation dialog test: single confirmation covers one action; tier auto-downgrades after dispatch
  - SC#4 → elevation-race regression (D-07): confirm tier survives mid-flight downgrade
  - SC#5 → H5 disabled affordance test: button is disabled, tooltip matches
- **D-22:** Allowlist addition tests live in the existing `grid/test/audit/broadcast-allowlist.test.ts` (append cases for 5 new events). Grid API endpoint tests live in `grid/test/api/operator/` (new subtree). Dashboard tests live in `dashboard/src/app/grid/components/` co-located with components.

### Claude's Discretion

- Exact Chip color palette (D-03) — match existing Tailwind theme tokens.
- Whether `<AgencyIndicator />` mounts in `layout.tsx` or inside a top-level client component wrapper (D-02) — planner to resolve based on React Server Component boundaries.
- Elevation-dialog animation style — use whatever matches existing Inspector drawer polish.
- File layout for operator API endpoints (`grid/src/api/operator/` subtree vs inline in `server.ts`) — planner to decide; follow existing patterns.
- `operator_id` UUID generation: `crypto.randomUUID()` on the client is fine; no need for server-side allocation.
- Tier enum representation: TypeScript string-literal union `type HumanAgencyTier = 'H1'|'H2'|'H3'|'H4'|'H5'` parallel to `ReviewFailureCode` (D-09 Phase 5 precedent). Store in `dashboard/src/lib/protocol/agency-types.ts` + a shared copy in `grid/src/api/types.ts` (two sources intentional — Grid and dashboard are separate packages).
- Error handling when Brain is unreachable for H2/H4 endpoints — return 503 with clear message, do NOT emit the `operator.*` audit event (no action took place).

### Folded Todos

*None — no matching todos in the backlog for Phase 6.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (milestone-level)
- `.planning/research/stanford-peer-agent-patterns.md` §3 (Human Agency Scale H1–H5 — arxiv 2506.06576; workers want higher agency than experts deem necessary on 47.5% of tasks)
- `PHILOSOPHY.md` §7 "Humans Are Guardians, Not Puppeteers" — authoritative H1–H5 definitions (Agency Scale paragraph) used verbatim in the Agency Indicator tooltip

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — AGENCY-01 (Indicator), AGENCY-02 (tier map), AGENCY-03 (audit-stamped tier + 5 allowlist events), AGENCY-04 (elevation dialog exact text + single-action scope)
- `.planning/ROADMAP.md` §"Phase 6" — 5 success criteria including elevation-race invariant (SC#4) and H5 disabled-surface affordance (SC#5)

### Existing code patterns (MUST match)
- `grid/src/audit/broadcast-allowlist.ts` — frozen-set pattern; Phase 6 appends 5 members (order-locked by D-10)
- `grid/src/audit/chain.ts` — `AuditChain.append()` signature; no new seam introduced
- `grid/src/api/server.ts` — existing Fastify endpoint patterns (example: lines 244–254 law endpoints); operator endpoints follow the same shape
- `grid/src/logos/engine.ts` — `LogosEngine` methods that D-18 wraps
- `grid/src/clock/...` — `WorldClock.pause()` / `WorldClock.resume()` that D-17 wraps (planner to verify these methods exist or add them)
- `grid/src/review/Reviewer.ts` — Phase 5 precedent for module-style Grid service bootstrapped at startup; operator endpoints don't need a singleton but share the injection-at-construction pattern
- `dashboard/src/app/layout.tsx` — root layout where Agency Indicator mounts (D-02)
- `dashboard/src/app/grid/grid-client.tsx` — client-boundary shell with shared stores; Agency Indicator state likely colocates here
- `dashboard/src/app/grid/components/inspector.tsx` — drawer that hosts H5 disabled affordance (D-20) and H4 force-Telos action
- `dashboard/src/components/primitives/chip.tsx` — existing primitive reused by the Agency Indicator (D-03)

### Project philosophy (sovereignty invariants)
- `PHILOSOPHY.md` §1 (sovereign intelligence — H4 force-Telos forwards to Brain via bridge; Grid never edits Brain state directly)
- `PHILOSOPHY.md` §4 (memory earned — H2 memory query is audit-logged, surfaces existing memory without summarizing or mutating)
- `PHILOSOPHY.md` §7 (Agency Scale H1–H5 authoritative definitions)

### v2.0 / Phase 5 frozen contracts (MUST preserve)
- `.planning/phases/archived/v2.0/01-auditchain-listener-api-broadcast-allowlist/01-CONTEXT.md` — zero-diff invariant + allowlist policy
- `.planning/phases/05-reviewernous-objective-only-pre-commit-review/05-CONTEXT.md` §D-10..D-13 — allowlist addition procedure (STATE.md reconciliation in the same commit)
- DID regex `/^did:noesis:[a-z0-9_\-]+$/i` at 3 entry points — Phase 1 invariant; `target_did` payload field is validated against this regex
- `payloadPrivacyCheck()` — reused for all 5 new operator event payloads
- `scripts/check-state-doc-sync.mjs` — Phase 5 regression gate; must be extended in Phase 6 to assert the post-phase allowlist count is 16 and the 5 new `operator.*` events are present

### CLAUDE.md doc-sync rule
- `CLAUDE.md` — when the allowlist changes, STATE.md + README + MILESTONES + PROJECT + ROADMAP are reconciled in the same phase-completion commit stream (mirror of Phase 5 D-11 mechanism)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<Chip />` primitive (`dashboard/src/components/primitives/chip.tsx`) — basis for the Agency Indicator pill
- Existing Inspector drawer (`dashboard/src/app/grid/components/inspector.tsx`) — host for H2 memory query UI, H4 force-Telos action, H5 disabled affordance
- `buildFrozenAllowlist()` — extend `ALLOWLIST_MEMBERS` tuple; frozen-set invariant protects against runtime mutation
- `payloadPrivacyCheck()` — reused directly for operator event payloads
- `AuditChain.append()` — no modification; Phase 6 adds 5 new emit sites
- Fastify API patterns at `grid/src/api/server.ts` (existing laws endpoints lines 244–254) — operator endpoints follow same shape
- Phase 5 Reviewer bootstrap pattern — Grid services instantiate in `main.ts` / genesis launcher and inject into constructors; operator endpoints don't need a singleton but reuse Fastify wiring
- `dashboard/src/lib/transport/ws-client.ts` — unchanged; operator events flow through the same firehose channel

### Established Patterns
- **Privacy at producer boundary** — `nous-runner.ts` and soon the operator API endpoints sanitize payloads before `audit.append`. H4 `telos_hash_*` hash-only shape matches this discipline.
- **Closed-enum typing** — `ReviewFailureCode` (Phase 5 D-09) and now `HumanAgencyTier` both use TypeScript string-literal unions for runtime + compile-time safety.
- **Grid trusts client for single-operator** — existing dashboard endpoints (e.g. `/api/v1/grid/regions`) don't authenticate requests. Operator endpoints extend this trust model with an explicit tier stamp, which OP-MULTI-01 can later harden.
- **State is held where it belongs** — Grid holds world state; dashboard holds UI state; brain holds cognition. Agency Indicator tier is UI state, so it lives in the dashboard.
- **Frozen allowlist as a sovereignty moat** — extending requires explicit per-phase addition. Phase 6 is one of those phases.

### Integration Points
- `grid/src/audit/broadcast-allowlist.ts` — 5-line addition to `ALLOWLIST_MEMBERS`
- `grid/src/api/server.ts` OR new `grid/src/api/operator/` subtree — 5 new endpoint handlers (or 7 if D-18 splits into add/amend/repeal)
- `grid/src/main.ts` — wire operator router alongside existing routes; Brain bridge already available for H2/H4
- `dashboard/src/app/layout.tsx` — mount `<AgencyIndicator />`
- `dashboard/src/components/primitives/elevation-dialog.tsx` — new primitive (D-08)
- `dashboard/src/lib/protocol/agency-types.ts` — new types file for `HumanAgencyTier` union
- `grid/test/audit/broadcast-allowlist.test.ts` — append 5 new assertion cases
- `grid/test/audit/operator-events.test.ts` — new file: tier-required invariant (D-13)
- `grid/test/api/operator/` — new subtree: endpoint tests
- `dashboard/src/app/grid/components/agency-indicator.test.tsx` — new file: mount invariant, tier rendering, tooltip content
- `dashboard/src/components/primitives/elevation-dialog.test.tsx` — new file: elevation-race regression (D-07)
- `scripts/check-state-doc-sync.mjs` — extend to assert 16 events + 5 new `operator.*` members

</code_context>

<specifics>
## Specific Ideas

- **Agency Indicator sketch:**
  ```tsx
  // dashboard/src/app/grid/components/agency-indicator.tsx
  'use client';
  export function AgencyIndicator(): React.ReactElement {
      const tier = useAgencyTier();  // client-side store, localStorage-backed
      return (
          <Chip color={TIER_COLOR[tier]} aria-label={`Current agency tier: ${tier} ${TIER_NAME[tier]}`}>
              <Tooltip content={<AgencyScaleDefinitions activeTier={tier} />}>
                  {tier} {TIER_NAME[tier]}
              </Tooltip>
          </Chip>
      );
  }
  ```
- **Elevation dialog sketch:**
  ```tsx
  // dashboard/src/components/primitives/elevation-dialog.tsx
  export function useElevatedAction(targetTier: HumanAgencyTier) {
      return async (payload: unknown, dispatch: (body: unknown) => Promise<Response>) => {
          const confirmed = await openElevationDialog(targetTier);
          if (!confirmed) return { ok: false, reason: 'cancelled' };
          // Tier captured at this moment — serialized into body before any I/O.
          const body = { tier: targetTier, operator_id: getOperatorId(), ...payload };
          try {
              return await dispatch(body);
          } finally {
              // AGENCY-04: auto-downgrade after dispatch (single-action scope).
              setAgencyTier('H1');
          }
      };
  }
  ```
- **Tier-required invariant test sketch:**
  ```ts
  // grid/test/audit/operator-events.test.ts
  describe('AGENCY-03: tier field required on all operator.* events', () => {
      for (const eventType of OPERATOR_EVENTS) {
          it(`${eventType} rejects payload missing tier`, () => {
              expect(() => audit.append(eventType, 'did:noesis:test', { action: 'x', operator_id: 'op:1' }))
                  .toThrow(/tier.*required/i);
          });
      }
  });
  ```
- **Elevation-race regression sketch:**
  ```tsx
  // dashboard/src/components/primitives/elevation-dialog.test.tsx
  it('SC#4: committed tier is the confirmed tier, not the tier at HTTP arrival', async () => {
      const dispatch = vi.fn().mockImplementation(async (body) => {
          // Simulate mid-flight downgrade.
          act(() => setAgencyTier('H1'));
          return new Response(JSON.stringify({ ok: true }));
      });
      const fire = useElevatedAction('H4');
      await act(async () => { await fire({ target_did: 'did:noesis:x' }, dispatch); });
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ tier: 'H4' }));
      expect(getAgencyTier()).toBe('H1');  // auto-downgrade fired
  });
  ```
- **AGENCY-02 deferred item flag:** D-09a carves out "mutate broadcast allowlist" from Phase 6 because it requires rethinking the frozen-set invariant. VERIFICATION.md must flag this as `partial AGENCY-02 coverage` with a deferred-ideas entry for the next phase or future milestone.

</specifics>

<deferred>
## Deferred Ideas

- **Broadcast allowlist runtime mutation (AGENCY-02 H3 item #2)** — requires redesigning the frozen-set invariant. Ship the other 4 H3 actions in Phase 6; file a dedicated mini-phase (or fold into OP-MULTI-01) for runtime allowlist management. VERIFICATION flags this as partial AGENCY-02 coverage.
- **H5 Sovereign Nous deletion** — Phase 8 (AGENCY-05). Phase 6 ships only the disabled placeholder.
- **Multi-operator conflict resolution (OP-MULTI-01)** — deferred. Single-operator v2.1 means tier state lives in localStorage; cross-operator coordination is a later concern.
- **Server-side tier-hierarchy enforcement** — single-operator v2.1 trusts the client's tier stamp. OP-MULTI-01 would add per-tier rate limits and hierarchy checks at Grid.
- **Authenticated operator identity (`operator_id` bound to a login)** — session UUID suffices for v2.1. Future phases can bind to an auth system.
- **Cross-device/cross-browser session sync** — out of scope; localStorage per browser only.
- **Session-wide elevation (stay in H3 for multiple actions)** — explicitly rejected by AGENCY-04's "single confirmation covers one action" rule. Do not revisit without REQ revision.
- **Operator identity as a DID (`did:noesis:op:*`)** — explicitly rejected in D-04. DIDs are for Nous (Phase 1 IDENT-01 semantics). Do not confuse namespaces.
- **WHISPER-01 regional peer channel** — already deferred to Sprint 16+ (per `.planning/research/stanford-peer-agent-patterns.md`); no connection to Phase 6 but noted here for completeness.
- **AI-judged operator action evaluation** — rejected per REV-04 (Phase 5 invariant). Reviewer judges trade invariants only; operator actions judged by the operator.

</deferred>

---

*Phase: 06-operator-agency-foundation-h1-h4*
*Context gathered: 2026-04-21*
*Mode: `--auto` — all 12 gray areas auto-resolved with recommended options (see DISCUSSION-LOG.md).*
*Downstream: `/gsd-plan-phase 6 --auto` to produce research + plans.*
