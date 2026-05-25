# 34-HUMAN-UAT — Steward `/system` Health Surfaces Operator Verification

**Phase:** 34 — Steward `/system` Health Surfaces
**REQs verified:** OBS-11, OBS-12, OBS-13, OBS-14
**Risks pinned:** R-34-01 (multi-tab poll accepted MVP), R-34-02 (REST-not-WS sparkline tested in Step 3), R-34-03 (watchdog suppression window tested in Step 4)
**Last updated:** [operator fills date on first run]

## Why this UAT exists

The five Phase 34 success criteria from ROADMAP.md include behaviors that cannot be verified inside vitest:

1. Operator opens `/system` and SEES the three new cards above the Allowlist Monitor with live data (requires a running Grid + a running Steward + a real browser).
2. Cards REFRESH every 5s without page reload — observed visually across 60 seconds.
3. The Events per Minute by Family sparkline RENDERS even when the firehose is down (the orthogonal-channel claim — REST-driven survives WS failure).
4. The firehose watchdog forces reconnect when `last_frame_at` goes stale despite `client_count > 0` — observed via the connection status pill on `/firehose`.
5. The MySQL outage cutover scenario (`docker stop noesis-mysql` → cards turn red within 60s → restart → cards turn green within 60s) requires real Docker lifecycle interaction.

## Prerequisites

- macOS or Linux operator workstation with `docker`, `docker compose`, `curl`, `jq`, `node` (>=20).
- Phase 31 + Phase 32 + Phase 33 already shipped (verifiable by `audit_reconcile_ok` heartbeat lines in `docker compose logs grid`).
- Steward dev or production container available; if running Steward from source, `cd steward && npm run build && npm start` works.
- Browser with developer console open (Chrome / Firefox / Safari all acceptable; Chrome preferred for the Network tab inspection in Step 3).

## Step 0 — Deploy and confirm baseline

Per project memory `feedback_deploy_docker.md`, EVERY source change requires a Docker rebuild + restart before any verification.

```sh
# 1. Rebuild and restart Grid for the Plan 01 reasons-payload extension.
docker compose build grid
docker compose up -d grid

# 2. Rebuild and restart Steward for the Plan 02-04 UI changes.
docker compose build steward
docker compose up -d steward

# 3. Wait 90 seconds for cold-start grace AND for use-health-detailed to accumulate
#    a baseline frame-counter delta. NO commands during this window.
sleep 90

# 4. Confirm Phase 31 + 32 baseline still healthy.
curl -s http://localhost:8080/health/detailed | jq '.status, .reasons, (.audit | {persisted_max_id, divergence}), (.firehose | {client_count, frames_sent_total, last_frame_at})'
```

**Expected output (Step 0.4):** JSON showing:
- `.status` is `"ok"` (or `"degraded"` if there's a pre-existing stale frame; investigate before continuing).
- `.reasons` is `[]` for `ok` status, or a populated array of snake_case keys for non-ok.
- `.audit.persisted_max_id` is a positive number.
- `.audit.divergence` is `0` or a small number.
- `.firehose.client_count` is `0` (no Steward client open yet) or whatever count of pre-existing connections.

**If `.reasons` is missing from the response:** Plan 01 was not deployed. Run `docker compose logs grid --since 5m | grep -i health-watchdog` and verify the Grid restart picked up the latest image.

Operator notes (fill in):
- Deploy completed at: __________________
- `/health/detailed` returns `reasons` field: [ ] yes / [ ] no

---

## Step 1 — Audit Pipeline Health card visible on /system (OBS-11)

1. Open Steward in a browser at `http://localhost:3000/system` (adjust port if Steward is on a different one).
2. Scroll to the section ABOVE the existing "Allowlist Monitor" heading.
3. Verify the **Audit Pipeline Health** card is present, with:
   - h2 heading "Audit Pipeline Health".
   - A large divergence big-number (likely "0") rendered in green (`#2d7a2d`) with a light-green background panel.
   - A row beneath the panel showing `In-memory: N  Persisted: M` where N and M are equal under normal load.

4. Open the browser DevTools Network tab and filter by "health/detailed". Confirm `GET /health/detailed` fires approximately every 5 seconds (Status 200, Type "xhr" or "fetch").

**Expected output (Step 1):**
- Card renders with green divergence banner.
- Polling fires every 5s (visible in Network tab).
- No console errors.

**Manual divergence color test:** Step 5 below induces the amber/red color change via MySQL outage.

Operator notes:
- Card visible above Allowlist Monitor: [ ] yes / [ ] no
- 5s polling confirmed in Network tab: [ ] yes / [ ] no
- Divergence value displayed: __________________
- Console errors: [ ] none / [ ] some (paste below): __________________

---

## Step 2 — Firehose Diagnostics card visible on /system (OBS-12)

1. With Steward `/system` still open, scroll to the **Firehose Diagnostics** card (immediately below Audit Pipeline Health).
2. Confirm three big-number stat cards: **Connected Clients**, **Frames Sent (1m)**, **Time Since Last Frame**.
3. Confirm a two-row sparkline below the stat cards: a top row of grey bars (frames sent per 5s) and a bottom row of terracotta bars (frames dropped per 5s).
4. The Time Since Last Frame value should be a small number ("3s", "8s") if there's any audit activity. If `Connected Clients` is 0, the value may show "—" — that's expected per the OBS-12 `null` semantics.

5. To exercise the live render: open a SECOND browser tab at `/firehose`. The first tab's `/system` Firehose Diagnostics card should show `Connected Clients: 1` (or more) within 5s. Frames Sent (1m) should start incrementing as audit events fire.

**Expected output (Step 2):**
- All three stat cards render with the big-serif font.
- Sparkline shows ≤ 12 bars per row.
- Opening `/firehose` in a second tab increments `Connected Clients`.
- With audit traffic flowing, Frames Sent (1m) is > 0.

Operator notes:
- All three stat cards visible: [ ] yes / [ ] no
- Sparkline rendered (two rows of bars): [ ] yes / [ ] no
- Opening /firehose incremented Connected Clients: [ ] yes / [ ] no
- Frames Sent (1m) > 0 after 30s of observation: [ ] yes / [ ] no

---

## Step 3 — Events per Minute by Family sparkline visible (OBS-13)

1. With Steward `/system` still open, scroll to the **Events per Minute by Family** card (immediately below Firehose Diagnostics).
2. Confirm an SVG sparkline renders, ~600px wide × ~90px tall, with stacked vertical bars (one bar per 5s × 60 buckets = 5 minutes).
3. Below the SVG, a family legend renders showing the family names + color swatches (e.g., `nous`, `human`, `portal`, `bios`).
4. The "X events / 5min" count should be > 0 if there's been audit activity in the last 5 minutes.

5. **REST-not-WS resilience test (R-34-02):** in the browser DevTools, switch to the Network tab and confirm requests to `/api/v1/audit/trail?limit=200` fire every 5s. Then open another browser tab at `/firehose` and observe — the WS connection there is independent of the sparkline (which uses REST). Close the `/firehose` tab. The sparkline on `/system` keeps updating because it never depended on the WS.

6. **Optional firehose-down stress test:** kill the WS handler on the Grid (this requires a Grid code change for testing; alternatively skip this test or use the watchdog stall scenario from Step 4 instead). The sparkline should KEEP rendering because it reads `/api/v1/audit/trail`, not the firehose.

**Expected output (Step 3):**
- SVG sparkline renders.
- Family legend shows at least one family.
- Network tab shows `/api/v1/audit/trail?limit=200` polling at 5s.
- The card does NOT have a WS connection in the Network tab (REST-only).

Operator notes:
- SVG sparkline rendered: [ ] yes / [ ] no
- Family legend visible: [ ] yes / [ ] no
- Network tab confirms REST-only (no WS for this card): [ ] yes / [ ] no
- Events count > 0 after 5 minutes uptime: [ ] yes / [ ] no

---

## Step 4 — Firehose watchdog forces reconnect (OBS-14)

Inducing the "WS opens but never delivers" failure mode requires either:
- **Option A (recommended):** Open `/firehose`, then on the Grid side use `docker exec` to interrupt the WS frame loop. NOTE: this requires a Grid-side test harness — Phase 32 ships `uat-half-close-socket.mjs` per `32-HUMAN-UAT.md` for a related case but not exactly for this. Easier alternative:
- **Option B (preferred for Phase 34 UAT):** Simulate by manually advancing the Steward client's `last_frame_at` interpretation. Since the watchdog reads from `/health/detailed`, the cleanest test is to wait for a natural quiet period in the audit stream — but that requires waiting for production-grade silence.
- **Option C (most reliable):** Pause the Grid (via Steward's `/system` Clock Control "Pause Clock" button with a reason like "OBS-14 watchdog UAT"), wait 60+ seconds for `last_frame_at` to grow stale, then observe the connection status pill on `/firehose` flips from "connected" → "disconnected" → "connecting" → "connected" (auto-reconnect via watchdog).

Use Option C:

1. Open Steward at `/firehose` in one browser tab. Confirm the status pill reads "connected".
2. In a second tab, open `/system` and click the **Pause Clock** button (Clock Control card). Enter reason: `OBS-14 watchdog UAT`. Click "Pause Clock".
3. Wait 75 seconds (60s stale threshold + 15s buffer for the next 5s `/health/detailed` poll).
4. Switch back to the `/firehose` tab. The status pill should have flipped to "disconnected" then immediately to "connecting", then back to "connected" within 30s.
5. Resume the clock from `/system` Clock Control. Audit traffic resumes; the firehose receives frames again.

**Expected output (Step 4):**
- With clock paused for 75s, `/firehose` status pill shows reconnection cycle.
- The watchdog effect's suppression window (60s per R-34-03) prevents a tight loop.
- In the browser DevTools console, no "Maximum update depth exceeded" or "Too many re-renders" errors.

**If the watchdog does NOT trigger:** Inspect `/health/detailed` directly — `data.firehose.client_count` must be > 0 for the watchdog to fire. If `client_count` is 0 (perhaps the `/firehose` tab lost focus and browser hibernated the WS), close the tab, refresh, and retry.

Operator notes:
- /firehose status pill flipped through reconnection cycle: [ ] yes / [ ] no
- Reconnection completed within 30s after the 75s wait: [ ] yes / [ ] no
- No console errors during the cycle: [ ] yes / [ ] no

---

## Step 5 — MySQL outage cutover scenario (Phase 34 ROADMAP SC #5)

This is the integration test of all four REQs together — the operator's most important manual verification.

1. Open Steward at `/system` in a browser. Confirm the Audit Pipeline Health card shows green (divergence 0).
2. In a terminal, induce a MySQL outage:
   ```sh
   docker stop noesis-mysql
   ```
3. Observe the `/system` page. Within 60 seconds the Audit Pipeline Health card should:
   - Stay at the current divergence number (in-memory chain grows but persistence stalls).
   - The "Last persist error" field should populate with `ECONNREFUSED` (or similar) at a recent timestamp.
   - Eventually the divergence big-number turns amber (1-10) or red (>10) as the in-memory chain pulls ahead.
   - The reasons sub-line should populate with `Audit divergence elevated`, `Persist failing with divergence`, or `Reconcile loop stale` depending on which threshold trips first.
4. After confirming the red/amber state, restart MySQL:
   ```sh
   docker start noesis-mysql
   ```
5. Within 60 seconds (one reconcile cycle), the Audit Pipeline Health card should:
   - Return to green (divergence 0).
   - "Last persist error" should clear or become stale (the reconcile loop catches up).
   - reasons sub-line should disappear (empty array).
6. **No browser refresh required.** The 5s polling drives the updates.

**Expected output (Step 5):**
- Card turns amber/red within 60s of `docker stop noesis-mysql`.
- Card returns to green within 60s of `docker start noesis-mysql`.
- reasons sub-line populates during the outage and clears on recovery.
- No browser refresh required at any step.

Operator notes:
- Card turned amber/red within 60s of stop: [ ] yes / [ ] no (time observed: ___s)
- reasons sub-line populated during outage: [ ] yes / [ ] no (text observed: ___________________)
- Card returned to green within 60s of start: [ ] yes / [ ] no (time observed: ___s)
- No browser refresh required: [ ] yes / [ ] no

---

## Document close-out

On all-PASS:

1. Create `.planning/phases/34-steward-system-health-surfaces/34-VERIFICATION.md` summarizing:
   - Operator name + date.
   - Pass/fail per step (1-5).
   - Any anomalies observed.
2. Commit + push the VERIFICATION file (per project memory `feedback_push_after_commit.md`).
3. Update STATE.md `stopped_at` to "Phase 34 UAT complete".
4. Phase 35 (UAT Re-Verification + Documentation Close-Out) begins.

On any-FAIL:

1. File the failure mode in `34-VERIFICATION.md` with as much detail as possible (browser console logs, Network tab waterfall, `docker compose logs grid` snippet).
2. Plan a gap-closure phase (use `/gsd-plan-phase 34 --gaps`).
3. DO NOT advance to Phase 35 until the gap closes.

---

*Phase: 34-steward-system-health-surfaces*
*Playbook: 34-HUMAN-UAT.md*
