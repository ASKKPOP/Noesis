# 32-HUMAN-UAT — Firehose Observability Operator Verification

**Phase:** 32 — Firehose Observability
**REQs verified:** OBS-05, OBS-06, OBS-07
**Risks pinned:** R-32-01 (CI gate), R-32-02 (CI gate), R-32-03 (in-process test + UAT Step 3)
**Last updated:** [operator fills date on first run]

## Why this UAT exists

The five Phase 32 success criteria from ROADMAP.md include behaviors that cannot be verified inside vitest:

1. `frames_sent_total` increments at least once per tick under LIVE load (requires real WorldClock cadence + connected Steward client).
2. MySQL outage flips `/health/detailed` to `degraded` within 60s and recovery returns it to `ok` within 60s (requires real docker compose lifecycle + real reconcile-loop wall-clock interaction).
3. `ab` p95 latency over 1000 HTTP requests is < 50ms (CI vitest covers in-process timing; HTTP-layer + Fastify stack + localhost overhead need real-server measurement).
4. Half-closed socket causes `frames_dropped_total` to advance without `frames_sent_total` advancing (programmatic half-close is fragile in unit tests; production socket lifecycle exercises the real failure mode).
5. `audit_reconcile_ok` heartbeat from Phase 31 keeps firing AND `health_status_changed` warn-logs from Phase 32 only fire on state transitions (operator visually inspects log stream).

## Prerequisites

- macOS or Linux operator workstation with `docker`, `docker compose`, `curl`, `jq`, `node` (>=20), and optionally `ab` (ApacheBench) installed. Fallback for `ab`: `for i in $(seq 1 1000); do curl -s http://localhost:8080/health/detailed > /dev/null; done` with a wall-clock timer.
- MySQL container in the docker compose stack (already present from Phase 31).
- Phase 31 `audit_reconcile_ok` heartbeat is firing (verify with the first command in Step 0).
- A Steward dev process able to open `/firehose` is helpful but NOT required for any step (Step 2 can be exercised via raw `wscat` if needed).

## Step 0 — Deploy and confirm baseline

Per project memory `feedback_deploy_docker.md`, EVERY source change requires a Grid Docker rebuild + restart before any verification. This is non-negotiable — vitest passing locally is not deployment verification.

```sh
# 1. Rebuild the Grid image with the Phase 32 changes.
docker compose build grid

# 2. Restart the Grid container.
docker compose up -d grid

# 3. Wait 60 seconds for the cold-start grace window to clear AND for the
#    first audit_reconcile_ok heartbeat to land. NO commands during this window.
sleep 60

# 4. Confirm Phase 31 baseline: audit_reconcile_ok heartbeat is firing.
docker compose logs grid --since 90s | grep audit_reconcile_ok | tail -5
```

**Expected output (Step 0.4):** at least 1–2 lines like `{"level":30,"time":...,"event":"audit_reconcile_ok","divergence":0,"replayed":0,"remaining":0,"msg":"reconcile cycle complete"}`.

**If absent:** Phase 31 is not running correctly. STOP and investigate before continuing Phase 32 UAT.

Operator notes (fill in):
- Deploy completed at: __________________
- Heartbeat confirmed: [ ] yes / [ ] no

---

## Step 1 — /health/detailed shape after 60s uptime (OBS-06)

```sh
curl -s http://localhost:8080/health/detailed | jq .
```

**Expected output (Step 1):** valid JSON with EXACTLY these 5 top-level keys:

```json
{
  "status": "ok",
  "timestamp": "<ms-epoch>",
  "audit": {
    "in_memory_length": "<number | null>",
    "persisted_max_id": "<number | null>",
    "divergence": "<number | null>",
    "divergence_threshold": 10,
    "last_persist_attempt_at": "<ms-epoch | null>",
    "last_persist_error": null
  },
  "firehose": {
    "client_count": 0,
    "frames_sent_total": "<int>",
    "frames_dropped_total": 0,
    "last_frame_at": "<ms-epoch | null>",
    "watermark_bytes": 1048576
  },
  "clock": {
    "tick": "<int >= 60>",
    "running": true,
    "last_tick_at": null
  }
}
```

**Pass criteria:**
- `status === "ok"`.
- `audit.divergence === 0` (Phase 31 reconcile keeps it at 0).
- `audit.divergence_threshold === 10` (HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED).
- `firehose.frames_dropped_total === 0` on a clean fresh boot.
- `clock.tick >= 60` (cold-start grace window elapsed).

Operator notes:
- status returned: __________________
- audit.divergence: __________________
- clock.tick: __________________
- Pass: [ ] yes / [ ] no

---

## Step 2 — frames_sent_total advances under live load (OBS-05 success #2)

1. Open a Steward firehose tab (e.g., http://localhost:3002/firehose) OR connect any WebSocket client to `ws://localhost:8080/api/v1/audit/firehose`.
2. Confirm the tab is receiving events (color-coded rows scrolling, NOT just the hello frame).
3. Run two polls 5 seconds apart:

```sh
curl -s http://localhost:8080/health/detailed | jq '{sent: .firehose.frames_sent_total, last: .firehose.last_frame_at, clients: .firehose.client_count}'
sleep 5
curl -s http://localhost:8080/health/detailed | jq '{sent: .firehose.frames_sent_total, last: .firehose.last_frame_at, clients: .firehose.client_count}'
```

**Pass criteria:**
- Second poll's `sent` value is STRICTLY GREATER than first poll's `sent`.
- Second poll's `last` value is within the 5-second window between the two polls (specifically: `last > (first_poll_timestamp - 1000)` — the `-1000` accounts for slight clock skew).
- `clients` is at least 1 during both polls (your Steward tab counts).

Operator notes:
- Poll 1 sent: __________________
- Poll 2 sent: __________________
- Poll 2 last: __________________
- Pass: [ ] yes / [ ] no

---

## Step 3 — Half-closed socket increments dropped but not sent (OBS-05 R-32-03)

This step exercises the R-32-03 failure mode in production. The half-close harness script is `scripts/uat-half-close-socket.mjs`.

```sh
# Snapshot 1: record counters BEFORE the half-close.
curl -s http://localhost:8080/health/detailed | jq '{sent: .firehose.frames_sent_total, dropped: .firehose.frames_dropped_total}'

# Run the harness — connects, receives hello, calls ws.terminate().
node scripts/uat-half-close-socket.mjs

# Wait 10s for buffer fill + drain attempts.
sleep 10

# Snapshot 2: record counters AFTER.
curl -s http://localhost:8080/health/detailed | jq '{sent: .firehose.frames_sent_total, dropped: .firehose.frames_dropped_total}'
```

**Pass criteria (R-32-03 pinned):**
- `dropped` in Snapshot 2 is GREATER THAN OR EQUAL to Snapshot 1's `dropped` (overflow detected when half-open client's buffer fills).
- `sent` in Snapshot 2 may have increased (other connected clients' sends continue) — the key invariant is that the half-open client itself contributes ZERO new sends.
- Other clients (e.g., your Steward tab) keep receiving events — observable visually.
- The grid container does NOT panic (no restart, no crash log).

```sh
# Sanity: confirm grid container did not restart.
docker compose ps grid | grep -i "Up"
```

Operator notes:
- Snapshot 1 dropped: __________________
- Snapshot 2 dropped: __________________
- Other clients still receiving: [ ] yes / [ ] no
- Grid container Up: [ ] yes / [ ] no
- Pass: [ ] yes / [ ] no

---

## Step 4 — MySQL outage flips status, recovery returns to ok (OBS-06 success #4)

```sh
# Stop MySQL — reconcile loop will fail.
docker stop noesis-mysql

# Wait 60 seconds (one reconcile cycle + propagation).
sleep 60

# Verify degraded status with persist error.
curl -s http://localhost:8080/health/detailed | jq '{status, divergence: .audit.divergence, error: .audit.last_persist_error}'
```

**Pass criteria (degraded state):**
- `status === "degraded"`.
- `audit.last_persist_error` is non-null with `{code: <string>, at: <ms-epoch>}`.
- `audit.divergence > 0`.
- The grid container did NOT panic — `docker compose ps grid` shows `Up`.

```sh
# Restart MySQL.
docker start noesis-mysql

# Wait for one reconcile cycle (~30s) + propagation buffer.
sleep 45

# Verify return to ok.
curl -s http://localhost:8080/health/detailed | jq '{status, divergence: .audit.divergence, error: .audit.last_persist_error}'
```

**Pass criteria (recovery):**
- `status === "ok"`.
- `audit.divergence === 0` (or near-zero — reconcile catches up).
- `audit.last_persist_error === null` (cleared on successful reconcile cycle).

Also confirm a `health_status_changed` transition log fired:

```sh
docker compose logs grid --since 3m | grep health_status_changed
```

**Expected:** at least 2 lines — one `to: 'degraded'` warn and one `to: 'ok'` info.

Operator notes:
- Degraded status reached: [ ] yes / [ ] no
- Recovery to ok reached: [ ] yes / [ ] no
- health_status_changed log lines: __________________
- Pass: [ ] yes / [ ] no

---

## Step 5 — ab load test: p95 < 50ms (OBS-06 success #5)

If `ab` (ApacheBench) is installed:

```sh
ab -n 1000 -c 10 http://localhost:8080/health/detailed
```

**Expected output:** search for the line `95%   <ms>` in the "Percentage of the requests served within a certain time" section. Pass criteria: `95%` value is `< 50ms`. CI headroom: < 100ms is acceptable for resource-constrained operator machines (note in operator log).

Fallback (no ab):

```sh
START=$(date +%s%N)
for i in $(seq 1 1000); do curl -s http://localhost:8080/health/detailed > /dev/null; done
END=$(date +%s%N)
echo "Total ms: $(( (END - START) / 1000000 )) -- mean ms/req: $(( (END - START) / 1000000 / 1000 ))"
```

**Pass criteria for fallback:** mean ms/req < 100ms (10% of the budget × number of requests gives a coarse upper bound on p95).

Operator notes:
- ab p95: __________________
- Pass: [ ] yes / [ ] no

---

## Sign-off

| Step | Description | Pass | Operator | Date | Notes |
|------|-------------|------|----------|------|-------|
| 0 | Deploy + heartbeat baseline | [ ] | | | |
| 1 | /health/detailed shape after 60s | [ ] | | | |
| 2 | frames_sent_total advances under load | [ ] | | | |
| 3 | Half-close: dropped advances, sent does not on offending client | [ ] | | | |
| 4 | MySQL stop → degraded → restart → ok within 60s each | [ ] | | | |
| 5 | ab p95 < 50ms | [ ] | | | |

**Phase 32 ship gate:** ALL six rows must be `[x]` for STATE.md close-out.

**If any step fails:** capture the curl/jq output, the grid logs (`docker compose logs grid --since 5m`), and any container restart events. File as a verification gap blocking Phase 32 close-out.
