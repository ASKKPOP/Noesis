---
status: pending
phase: 31-audit-pipeline-persistence
source: [31-CONTEXT.md, 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md, 31-05-SUMMARY.md]
started: PENDING
updated: PENDING
---

# Phase 31 HUMAN-UAT — Cutover & Verification

This document closes Phase 31 by converting the code shipped in plans 01-05 into deployed production state. It is the load-bearing artifact for **R-31-03 mitigation (zero data loss across restart)** and the runtime evidence for OBS-01..04 Success Criteria 1-4.

**Critical invariant (PHILOSOPHY §1 + CONTEXT.md `<specifics>` 4):** the 237+ at-risk in-memory audit entries that have accumulated since 2026-05-22T06:57Z MUST be persisted to MySQL BEFORE the cutover restart. The "deploy-first, accept tail loss" alternative was REJECTED. Backfill is the FIRST cutover action — not the last.

**Operator preflight (do before Step 1):**

- [ ] Plans 01-05 are merged to `main` and `docker compose build grid` will produce an image containing the wired `PersistentAuditChain` + `AuditReconcile`.
- [ ] `noesis-mysql` is running (`docker compose ps mysql` shows `Up`).
- [ ] OLD grid container is currently running and serving `/api/v1/audit/trail` on port 8080.
- [ ] MySQL credentials are set in shell env: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`. Verify with `env | grep -E '^MYSQL_'` (do NOT echo the password).
- [ ] `git status` on the working directory is clean.

---

## Step 1 — Leave OLD Grid running

**Pre-state:** OLD Grid (plain `AuditChain`) is up. Its in-memory chain has accumulated entries since 2026-05-22T06:57Z that never reached MySQL.

**Action:** No-op. DO NOT restart, DO NOT redeploy. The OLD process is the only source of truth for the at-risk entries.

**Expected output:** `docker compose ps grid` shows `Up`. `curl -s localhost:8080/api/v1/audit/trail?limit=1 | jq .total` returns a positive integer.

**Go / no-go:** If `total` is 0, the in-memory chain is empty — investigate before proceeding. The cutover is safe to run on an empty chain (nothing to backfill) but the apparent stall might have already caused a process restart somewhere. Halt and triage.

- [ ] Result: ___________________

---

## Step 2 — Dry-run divergence report

**Pre-state:** Step 1 confirmed OLD Grid is healthy and chain is non-empty.

**Action:**

```
node scripts/backfill-audit-trail.mjs \
    --grid genesis \
    --rest-url http://localhost:8080 \
    --dry-run
```

**Expected output:** Stdout includes lines:
- `[backfill] REST: fetched N entries`
- `[backfill] MySQL: grid_name='genesis' rows=M max_id=K`
- `[backfill] divergence: in_memory=N persisted=M delta=<positive integer>`
- `[backfill] would insert X entries (id > K, up to id=N)`
- `[backfill] --dry-run: no rows written.`

Exit code: 0.

**Go / no-go:** `delta > 0` is expected (this is GAP-A: the in-memory chain is ahead of MySQL). Record `delta`. If `delta < 0`, MySQL has rows that the in-memory chain doesn't — this is a different bug; halt and triage. If `delta == 0`, there's nothing to backfill (proceed to Step 5 directly, skip steps 3-4).

- [ ] Recorded divergence (delta): ___________________
- [ ] Recorded MySQL max_id: ___________________

---

## Step 3 — Live backfill (no --dry-run)

**Pre-state:** Step 2 reported `delta > 0` and a confirmed list of entries to insert.

**Action:**

```
node scripts/backfill-audit-trail.mjs \
    --grid genesis \
    --rest-url http://localhost:8080
```

(Note: same as Step 2 minus `--dry-run`.)

**Expected output:** `[backfill] DONE: inserted=X skipped(idempotent)=0`. Exit code 0. `inserted` should match the `delta` recorded in Step 2.

**Go / no-go:** If `inserted < delta`, some rows failed silently (script does not silently fail — it would have already exited non-zero). Re-read the stdout for any earlier error lines. If `inserted == delta`, proceed.

- [ ] Recorded inserted count: ___________________
- [ ] Inserted count matches Step 2 delta: yes / no

---

## Step 4 — Verify row count matches in-memory chain length

**Pre-state:** Step 3 inserted the missing tail.

**Action:**

```sh
# In a fresh shell, against the same MySQL instance the Grid uses:
docker compose exec mysql mysql \
    -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
    -e "SELECT COUNT(*) AS row_count, MAX(id) AS max_id FROM ${MYSQL_DATABASE}.audit_trail WHERE grid_name='genesis';"
```

And separately:
```sh
curl -s localhost:8080/api/v1/audit/trail?limit=1 | jq .total
```

**Expected output:** `row_count` from MySQL == `total` from REST. `max_id` from MySQL matches the last id observed in the REST response.

**Go / no-go:** If equal, GAP-A is closed in MySQL — the OLD Grid's in-memory entries are now durably persisted. If unequal, run Step 2 again (dry-run) to see the new divergence — INSERT IGNORE means the script can be re-run safely. If still divergent after re-run, halt and triage (likely the OLD Grid is appending faster than the script ran; pause Nous activity or re-run Step 3).

- [ ] MySQL row_count: ___________________
- [ ] REST .total: ___________________
- [ ] Equal: yes / no

---

## Step 5 — Graceful-stop OLD Grid

**Pre-state:** Step 4 confirmed at-risk entries are in MySQL. OLD Grid can now be stopped without data loss.

**Action:**

```
docker compose stop grid
```

**Expected output:** Container transitions from `Up` to `Exited`. `docker compose ps grid` shows `Exited (0)`.

**Go / no-go:** If container exits non-zero, the OLD process panicked on shutdown. Inspect `docker compose logs grid --tail=50` for the cause. The MySQL state from Step 4 is safe regardless — the in-memory chain is gone but its content is already in `audit_trail`.

- [ ] Exit code from docker: ___________________

---

## Step 6 — Build and deploy NEW Grid

**Pre-state:** OLD Grid is stopped. Plans 01-05 are merged. Step 4's MySQL state is intact.

**Action (per deploy-docker memory rule):**

```
docker compose build grid
docker compose up -d grid
```

**Expected output:** Build completes without errors. `docker compose ps grid` shows `Up`. The NEW container contains the post-plan-03 main.ts that constructs PersistentAuditChain when `config.db` is set.

**Go / no-go:** If build fails, investigate the build error (most likely a typecheck error from one of the plan-01..05 changes). If build succeeds but `up -d` fails, check `docker compose logs grid --tail=100` for boot errors.

- [ ] Build succeeded: yes / no
- [ ] Container Up: yes / no

---

## Step 7 — Confirm NEW process is the wired version

**Pre-state:** Step 6 produced a running NEW Grid container.

**Action:** Tail logs for 30 seconds AFTER container is Up:

```
docker compose logs grid --tail=200 -f
```

**Expected output:** Within 30s of container start, logs include JSON lines like:
- `{"level":30,"time":<epoch>,"pid":...,"hostname":"...","module":"persistent-chain", ...}` — confirms Pino is the logger AND the persistent-chain module is initialized
- One or more `{event:"audit_reconcile_ok",divergence:0,replayed:0,remaining:0, ...}` lines — confirms AuditReconcile is wired and firing on the tick cadence

Press `Ctrl+C` to stop the tail.

**Go / no-go:** If you see NO Pino-shaped JSON in stdout (still `[PersistentAuditChain] Failed to persist...` plain text), the build did not include plan 03's changes — roll back to OLD Grid (`docker compose stop grid && [restart-old-image-command]`) and investigate. If you see Pino-shaped JSON but NO `audit_reconcile_ok` line in 60+ seconds of tail, AuditReconcile is not wired — same rollback.

Note: the FIRST `audit_reconcile_ok` fires at tick 60 (~30s after start at default tickRateMs). If the container just started, give it at least 60 seconds before concluding the heartbeat is absent.

- [ ] Saw Pino JSON: yes / no
- [ ] Saw audit_reconcile_ok heartbeat: yes / no

---

## Step 8 — Heartbeat steady-state observation

**Pre-state:** Step 7 confirmed initial heartbeat fired.

**Action:** Tail logs for 5 minutes, counting heartbeats:

```
docker compose logs grid -f --since=5m | grep -c 'audit_reconcile_ok'
```

(Or: run `docker compose logs grid -f` for 5 min and visually count.)

**Expected output:** At least 10 `audit_reconcile_ok` lines (one per 60-tick cadence at default tickRateMs — Success Criterion 2). Each should have `divergence: 0` once steady state is reached.

**Go / no-go:** If fewer than 10 lines in 5 min: cadence is broken (or clock is paused). Inspect `event.tick` from the `tick` audit entries to confirm clock is advancing. If `divergence: 0` is never reached, OBS-02 is broken — check the SELECT MAX(id) result against `audit.length`.

- [ ] Heartbeat count in 5 min: ___________________
- [ ] Divergence stable at 0: yes / no

---

## Step 9 — End-to-end smoke test

**Pre-state:** Steady-state heartbeat confirmed.

**Action 9a — REST returns recent entries:**

```
curl -s localhost:8080/api/v1/audit/trail?limit=5 | jq '.entries | length'
```

Expected: `5` (or however many entries exist if chain is small).

**Action 9b — MAX(id) monotonic over 2 minutes:**

```sh
# Run twice, 120 seconds apart:
docker compose exec mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
    -e "SELECT MAX(id) FROM ${MYSQL_DATABASE}.audit_trail WHERE grid_name='genesis';"
# (wait 2 min)
docker compose exec mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
    -e "SELECT MAX(id) FROM ${MYSQL_DATABASE}.audit_trail WHERE grid_name='genesis';"
```

Expected: second value strictly greater than the first (Grid is ticking, new entries appending, persistence wired). If Nous are idle, only `tick` events drive growth — still monotonic over 2 min at default tickRateMs.

**Go / no-go:**
- 9a returns >= 1: REST is alive and chain is populated.
- 9b second MAX(id) > first MAX(id): persistence path is live.
Both pass → Phase 31 cutover SUCCESS. Either fails → rollback to OLD Grid and triage.

- [ ] 9a entries length: ___________________
- [ ] 9b first MAX(id): ___________________
- [ ] 9b second MAX(id): ___________________
- [ ] Monotonic: yes / no

---

## Summary

total: 9
passed: 0
issues: 0
pending: 9

## Final state

- [ ] Phase 31 cutover: PASS / FAIL
- [ ] If PASS: confirm `STATE.md` is ticked per plan 06 Task 6.2
- [ ] If FAIL: document the failure step, rollback, and open a follow-up task in `STATE.md`

## Rollback procedure (if any step fails)

1. `docker compose stop grid`
2. Restore the OLD image (operator records the exact image tag in Step 6 preflight)
3. `docker compose up -d grid` with the OLD image
4. Verify `/api/v1/audit/trail?limit=1` responds — chain restored from snapshot (some most-recent in-memory entries lost — this is why backfill ran first).
5. File the failure mode in `.planning/STATE.md` `## Active Issues` for a follow-up phase.
