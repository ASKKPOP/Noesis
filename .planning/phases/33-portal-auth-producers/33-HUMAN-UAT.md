# 33-HUMAN-UAT — Portal Auth Producers Operator Verification

**Phase:** 33 — portal.auth.* Producers (OBS-08, OBS-08b, OBS-09, OBS-10)
**REQs verified:** OBS-08 (`portal.auth.login`), OBS-08b (`human.identified`), OBS-09 (`portal.auth.register`), OBS-10 (`PORTAL_AUTH_FORBIDDEN_KEYS` + word-boundary regex)
**Risks pinned:** R-33-01 (forbidden-keys regression — gated in CI via Plan 33-05 tests), R-33-02 (perf — soft-log only per D-33-C1), R-33-03 (wiring asymmetry — pinned in Plan 33-05 wiring tests)
**Last updated:** [operator fills date on first run]

---

## Why this UAT exists

The 5 Phase 33 success criteria from ROADMAP.md include behaviors that cannot be verified inside vitest:

1. **SC#1** — After a real human logs in via SIWE with a real wallet, `GET /api/v1/audit/trail?type=portal.auth.login&limit=10` returns at least one entry within 30s. Requires real SIWE crypto + a real wallet.
2. **SC#2** — UAT item #5c from `25a-HUMAN-UAT.md` (`/users` → `/humans/[did]` deep-link click) returns PASS — the `/users` directory is non-empty after at least one auth event.
3. **SC#3** — PII enforcement at the producer boundary works in a real live-server scenario (the test layer covers unit-level discipline, but operator confirms no PII reaches the chain in a real session).
4. **SC#4** — `grid/src/audit/broadcast-allowlist.ts` count assertion (CI gate `scripts/check-state-doc-sync.mjs` + `scripts/check-sole-producer-discipline.mjs` cover this; operator verifies CI green).
5. **SC#5** — Sole-producer discipline at the codebase layer (CI gate covers; operator verifies CI green).

This UAT mirrors Phase 31 + Phase 32 UAT shape and respects the operator's persistent rules (memory `feedback_deploy_docker.md`):
- ALWAYS rebuild Grid Docker after every source change before any verification.
- Push to git after committing per `feedback_push_after_commit.md`.

---

## Prerequisites

- macOS or Linux operator workstation with `docker`, `docker compose`, `curl`, `jq`, `node` (>=20).
- Phase 33 plans 33-01 through 33-06 ALL landed + committed + pushed to git.
- MySQL container in the docker compose stack (already present from Phase 31).
- A web wallet (e.g., MetaMask) for SIWE flow OR a willingness to use the email signup/signin path.
- Phase 31 `audit_reconcile_ok` heartbeat is firing (verify in Step 0).
- Phase 32 `/health/detailed` endpoint returns valid JSON (verify in Step 0).

---

## Step 0 — Deploy and confirm baseline

Per project memory `feedback_deploy_docker.md`, EVERY source change requires a Grid Docker rebuild + restart before verification. This is non-negotiable.

```sh
# 1. Rebuild the Grid image with the Phase 33 changes.
docker compose build grid

# 2. Restart the Grid container.
docker compose up -d grid

# 3. Wait 60 seconds for cold-start grace + first reconcile heartbeat.
sleep 60

# 4. Confirm Phase 31 baseline: audit_reconcile_ok heartbeat firing.
docker compose logs grid --since 90s | grep audit_reconcile_ok | tail -5

# 5. Confirm Phase 32 baseline: /health/detailed returns ok.
curl -s http://localhost:8080/health/detailed | jq '.status'
```

**Expected (Step 0.4):** at least 1–2 lines of `{"event":"audit_reconcile_ok","divergence":0,...}`.
**Expected (Step 0.5):** `"ok"`.

**If absent:** Phase 31/32 is not running correctly. STOP and investigate before continuing Phase 33 UAT.

Operator notes (fill in):
- Deploy completed at: __________________
- Phase 31 heartbeat confirmed: [ ] yes / [ ] no
- Phase 32 /health/detailed status: __________________

---

## Step 1 — CI gates green (D-33-D1, D-33-D3, Plan 33-06)

Run the Phase 33 gates locally to verify they pass (they must already be green if Phase 33 plans landed cleanly):

```sh
# Phase 33 D-33-D1 audit-wide sole-producer discipline gate
node scripts/check-sole-producer-discipline.mjs

# Phase 33 D-33-D3 extended STATE.md doc-sync gate
node scripts/check-state-doc-sync.mjs

# Also confirm Phase 31 + 32 gates still pass (no regression)
node scripts/check-no-silent-catch.mjs
node scripts/check-observability-no-todo.mjs
node scripts/check-interval-lifecycle.mjs
```

**Expected:** all 5 commands exit with `[check-*] OK ...` and exit code 0.

Operator notes:
- check-sole-producer-discipline result: [ ] OK / [ ] FAIL: __________________
- check-state-doc-sync result: [ ] OK / [ ] FAIL: __________________
- Phase 31/32 gates still green: [ ] yes / [ ] no

---

## Step 2 — Allowlist literal count and 3 new event names present

```sh
# Count quoted entries in ALLOWLIST_MEMBERS — should be exactly 56.
awk '/export const ALLOWLIST_MEMBERS/,/^\] as const;/' grid/src/audit/broadcast-allowlist.ts \
  | grep -cE "^\s+'[a-z][a-z0-9_.]+'"

# Confirm the 3 new entries are present at canonical positions.
grep -nE "'portal\.auth\.login'|'portal\.auth\.register'|'human\.identified'" grid/src/audit/broadcast-allowlist.ts
```

**Expected (count):** `56`.
**Expected (positions):** three lines, all near the end of the ALLOWLIST_MEMBERS array, in this order: portal.auth.login → portal.auth.register → human.identified.

Operator notes:
- ALLOWLIST_MEMBERS entry count: __________________
- 3 new entries present at canonical positions: [ ] yes / [ ] no

---

## Step 3 — End-to-end SIWE flow (REQ OBS-08, OBS-08b, OBS-09)

**Setup:** Open the Portal in a browser with a wallet connected (or use a test wallet generator if Steward Console isn't operational; SIWE flow requires a wallet signature).

**Action:** Complete the SIWE login flow at the Portal:
1. Navigate to the portal login page.
2. Click "Sign in with Ethereum".
3. Approve the signature in your wallet.
4. Confirm you land on the post-login page (e.g., dashboard).

**Verify in chain — first-connect (use a wallet you've NEVER used in this Grid before):**

```sh
# Wait 5 seconds for events to land in the chain.
sleep 5

# Pull the last 10 entries of each event type.
curl -s "http://localhost:8080/api/v1/audit/trail?type=human.joined&limit=5" | jq '.[].payload | {human_did, eth_address_hash, tick}'
curl -s "http://localhost:8080/api/v1/audit/trail?type=human.identified&limit=5" | jq '.[].payload | {grid_name, human_did, identity_hash, identity_method, tick}'
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.register&limit=5" | jq '.[].payload | {human_did, method, tick}'
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.login&limit=5" | jq '.[].payload | {human_did, method, tick}'
```

**Expected:** all 4 queries return at least 1 entry with the same `human_did`. The `human.identified` entry's `identity_hash` is byte-identical to the `human.joined` entry's `eth_address_hash` for the same human (D-33-A4 correlation invariant). The `portal.auth.register` AND `portal.auth.login` entries have `method: 'siwe'`.

**Verify in chain — repeat-connect (sign out + sign in again with the SAME wallet):**

```sh
# After re-login with the same wallet:
sleep 5
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.login&limit=10" | jq 'length'
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.register&limit=10" | jq 'length'
```

**Expected:** `portal.auth.login` count INCREMENTED by 1; `portal.auth.register` count UNCHANGED (no new register on repeat-connect — D-33-A4). `human.joined` count also unchanged.

Operator notes:
- SIWE first-connect emitted all 4 events (human.joined + human.identified + portal.auth.register + portal.auth.login): [ ] yes / [ ] no
- identity_hash equals eth_address_hash for the same human: [ ] yes / [ ] no
- SIWE repeat-connect emitted ONLY portal.auth.login: [ ] yes / [ ] no

---

## Step 4 — End-to-end email signup + signin flow (REQ OBS-08, OBS-08b, OBS-09)

**Setup:** Open the Portal email signup form.

**Action 1 — Email signup:**
1. Submit a NEW email address (e.g., `uat-step4-{timestamp}@example.com`) + password ≥ 8 chars.
2. Confirm you land on the post-signup page.

```sh
sleep 5
# Confirm 3 events emitted (no human.joined for email).
curl -s "http://localhost:8080/api/v1/audit/trail?type=human.identified&limit=5" | jq '.[] | select(.payload.identity_method == "email") | .payload'
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.register&limit=5" | jq '.[] | select(.payload.method == "email") | .payload'
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.login&limit=5" | jq '.[] | select(.payload.method == "email") | .payload'

# Confirm NO new human.joined entry for this email (Phase 22's SIWE-only contract).
curl -s "http://localhost:8080/api/v1/audit/trail?type=human.joined&limit=10" | jq 'length'
```

**Expected:** human.identified entry with `identity_method: 'email'`; portal.auth.register entry with `method: 'email'`; portal.auth.login entry with `method: 'email'`. human.joined count UNCHANGED (D-33-A4/D-33-A7).

**Action 2 — Email signin (sign out + sign in with the SAME email):**

```sh
sleep 5
# Confirm ONLY portal.auth.login incremented.
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.login&limit=20" | jq '[.[] | select(.payload.method == "email")] | length'
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.register&limit=20" | jq '[.[] | select(.payload.method == "email")] | length'
```

**Expected:** portal.auth.login count for email INCREMENTED by 1; portal.auth.register count UNCHANGED (D-33-A6).

Operator notes:
- Email signup emitted human.identified + portal.auth.register + portal.auth.login (3 events, no human.joined): [ ] yes / [ ] no
- Email signin emitted ONLY portal.auth.login (1 event): [ ] yes / [ ] no

---

## Step 5 — PII discipline confirmation (REQ OBS-10)

Sample several emitted entries to confirm NO forbidden keys cross the wire.

```sh
# Pull the most recent 10 entries of each Phase 33 event type and grep for forbidden keys.
for type in portal.auth.login portal.auth.register human.identified; do
  echo "=== $type ==="
  curl -s "http://localhost:8080/api/v1/audit/trail?type=$type&limit=10" \
    | jq -r '.[].payload | tostring' \
    | grep -iE 'ip_address|ip[^a-z_]|user_agent|ua[^a-z_]|session_id|token|jwt|cookie|email[^_]|password|nonce[^_]|signature|device_fingerprint' \
    && echo "PII LEAK DETECTED" || echo "clean"
done
```

**Expected:** each section prints `clean` (no PII matches). If `PII LEAK DETECTED` appears, STOP — Plan 33-03 producer guards have a bug.

**Spot-check shape:** confirm portal.auth.login payload is exactly the closed 3-key tuple `{human_did, method, tick}`.

```sh
curl -s "http://localhost:8080/api/v1/audit/trail?type=portal.auth.login&limit=1" | jq '.[].payload | keys'
```

**Expected:** `["human_did", "method", "tick"]` (alphabetical).

Same for human.identified — exactly 5 keys:

```sh
curl -s "http://localhost:8080/api/v1/audit/trail?type=human.identified&limit=1" | jq '.[].payload | keys'
```

**Expected:** `["grid_name", "human_did", "identity_hash", "identity_method", "tick"]` (alphabetical).

Operator notes:
- All 3 event types pass PII grep: [ ] yes / [ ] no
- portal.auth.login payload keys are exactly the closed 3-tuple: [ ] yes / [ ] no
- human.identified payload keys are exactly the closed 5-tuple: [ ] yes / [ ] no

---

## Step 6 — /users directory and /humans/[did]/history surfaces (closes 25a-HUMAN-UAT #5c)

Open Steward Console (or hit the API directly):

```sh
# /users directory — should be NON-EMPTY after Steps 3 + 4.
curl -s "http://localhost:8080/api/v1/humans?gridName=genesis" | jq 'length'
```

**Expected:** ≥ 1 (or however many distinct humans you authenticated as in Steps 3 + 4).

```sh
# /humans/[did]/history for the SIWE human from Step 3 — should show siwe_sessions non-empty.
SIWE_DID="<paste the human_did from Step 3>"
curl -s "http://localhost:8080/api/v1/humans/$SIWE_DID/history" | jq '.siwe_sessions | length'
```

**Expected:** ≥ 1 (at least 1 portal.auth.login entry for this human after first-connect).

Operator notes:
- /users directory non-empty: [ ] yes / [ ] no
- /humans/[did]/history siwe_sessions non-empty: [ ] yes / [ ] no
- This unblocks 25a-HUMAN-UAT #5c (Phase 35 re-verification): [ ] yes (Phase 35 can mark this PASS) / [ ] no (re-investigate)

---

## Step 7 — auth.ts console.* preserved (D-33-E1)

Confirm CLAUDE.md §3 Surgical Changes was respected — Phase 33 did NOT clean up the unrelated `console.warn` + `console.error` in `auth.ts`:

```sh
grep -n "console.warn\|console.error" grid/src/api/portal/auth.ts
```

**Expected:** at least 2 lines printed (lines 308-312 console.warn in /me handler; line 356 console.error in PATCH /me handler — preserved per D-33-E1).

If these are GONE, Phase 33 over-stepped its scope and someone must investigate.

Operator notes:
- auth.ts console.warn + console.error preserved at L308-312 + L356: [ ] yes / [ ] no

---

## Step 8 — Push to git (per memory feedback_push_after_commit.md)

After all Steps 1-7 PASS:

```sh
git status   # Confirm no uncommitted UAT artifacts
git log --oneline -10   # Confirm Phase 33 commits are in git history
git push origin main    # Push immediately after every commit per memory
```

**Expected:** No uncommitted files. Phase 33 plans 33-01 through 33-06 SUMMARY files committed. Remote is up to date.

Operator notes:
- All commits pushed to remote: [ ] yes / [ ] no
- Repo clean (no uncommitted files): [ ] yes / [ ] no

---

## Final UAT Sign-off

If all Steps 1-8 above show PASS or `[ ] yes`:

```
Phase 33 — portal.auth.* Producers — UAT PASS

Operator: __________________
Date: __________________
Notes: __________________
```

If any step FAILS, halt the Phase 33 ship and file a gap-closure note pointing back to the specific failing step. Re-run Plan 33-NN where the issue lies (most likely 33-03 producers or 33-04 wiring) and re-execute this UAT from Step 0.

---

## Operator notes — discovered gaps / suggested v2.7+ work

Use this section to capture anything noticed during UAT that doesn't fit Phase 33's scope:

- [ ] Steward Console `/users` UI polish (Phase 34 territory — note observed UX issues)
- [ ] Performance: if `node scripts/check-sole-producer-discipline.mjs` took more than 5s, scope a perf improvement to v2.7
- [ ] Forbidden-keys regex: if a new corner case appears (e.g., `webauthn_credential_id`) — add as v2.7 follow-up
- [ ] Any audit-pipeline silence — report immediately, do NOT defer to v2.7
