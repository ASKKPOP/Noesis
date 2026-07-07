# Track B — Reusable QA Agent Runbook

**Purpose:** paste the block below to a `general-purpose` agent each QA round to run
Track B (the 8 civic institutions) against a **local** Grid. It replaces `/qa` — which is a
*browser* QA skill and the wrong tool for HTTP/JSON API contract testing.

Source of truth for expectations: <https://noesiis.com/qa> (Track B), reconciled with the
Grid decision log where the guide is stale (see B-08 / D-42-02 below).

---

## Prompt to paste (self-contained)

> You are a Track B API tester for the Noēsis Grid. Test the 8 civic institutions against the
> **local** Grid at `http://localhost:8080` and return a verdict table. Do NOT modify source code.
>
> **Preflight**
> 1. Confirm the stack is up: `docker ps` should show `noesis-grid` (healthy) on `:8080` and
>    `noesis-mysql` on `:3306`. If `:8080` is down, stop and report `BLOCKED — grid not running`.
> 2. Smoke: `GET /health` → 200 `{status:"ok"}`; `GET /api/v1/system/map` → 200. Keep the map JSON —
>    it is the source-of-truth counts for B-10.
> 3. Get a real Civic-DID for the 200-paths:
>    `GET /api/v1/civic/presence` → take a `nous[].civic_did`, OR
>    `docker exec noesis-mysql mysql -unoesis -pchangeme noesis_grid -N -e "SELECT civic_did FROM civic_did_registry LIMIT 1"`.
>
> **DB helper (local CRUD is allowed):**
> `DB(){ docker exec noesis-mysql mysql -unoesis -pchangeme noesis_grid -e "$1" 2>/dev/null; }`
> *(the `2>/dev/null` drops MySQL's harmless "password on the command line is insecure" warning).*
>
> **Before any DB write, snapshot the working tree** so cleanup can be checked against a real baseline:
> `git -C G:/xampp/htdocs/ASKKPOP/noesis status --porcelain > /tmp/qa_git_baseline.txt`
>
> **Run these items.** For each, record HTTP code + body + PASS/PARTIAL/FAIL.
>
> | ID | Request | Expect |
> |----|---------|--------|
> | B-01a | `GET /api/v1/registry/civic-did/<REAL_DID>` | 200, `status:"active"`, `credential` present |
> | B-01b | `GET /api/v1/registry/civic-did/did:civic:noesis:00000000-0000-0000-0000-000000000000` | 404 `not_found` |
> | B-01c | `GET /api/v1/registry/civic-did/garbage` | 404 `not_found` |
> | B-02 | `GET /api/v1/polis/bills` | 200 `{bills:[...]}` (may be empty) |
> | B-03 | `GET /api/v1/police/complaints` (no auth) | **401** `did_required` (must carry a reason code, not empty body) |
> | B-04 | `GET /api/v1/irs/treasury` | 200 with `balance_wei` + `current_rate_percent`; both must equal `institutions.irs` in the map |
> | B-05 | `GET /api/v1/market/listings` | 200 `{listings:[...]}`; count == map |
> | B-06a | `GET /api/v1/library/entries` | 200 `{entries:[...],count}`; count == map |
> | B-06b | `GET /api/v1/library/entries?page=-1&limit=99999` | 200, `limit` clamped to 100, `page` ≥ 0 (no crash) |
> | B-06c | `GET /api/v1/library/entries?limit=abc` | 200, `limit` falls back to default (no crash) |
> | B-07a | `GET /api/v1/community/00000000-0000-0000-0000-000000000000` | 404 `unknown_community` |
> | B-07b | write-path auth gate: `POST /api/v1/community/found` (no auth) | 401 `did_required` |
> | B-08a | `GET /api/v1/p2p/peers/<REAL_DID>` (peer offline) | **404** `peer_offline` — NOT 200. Per **D-42-02** offline peers return 404, so the noesiis.com/qa guide's "200 status online\|offline" is STALE. Flag the guide, not the code. |
> | B-08b | `GET /api/v1/p2p/peers/garbage` | 400 `invalid_civic_did` |
> | B-09 | `GET /api/v1/civic/presence` | 200 `{nous:[...]}` snapshot |
> | B-10 | Compare every `institutions.*` count in the map to its own endpoint above | all equal |
>
> **B-07 live-data check (create → read → verify map → CLEAN UP).** Communities usually start empty,
> so prove the read path AND that the map is not hardcoded. **Substitute `<REAL_DID>` (2 places below)
> with the actual Civic-DID captured in Preflight step 3 — do NOT paste the literal `<REAL_DID>`.**
> ```
> CID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee ; H=$(printf '%064d' 0)
> DB "INSERT INTO communities (community_id,grid_name,founder_civic_did,name,purpose,charter_json,charter_hash,wei_paid,status,founded_tick) VALUES ('$CID','genesis','<REAL_DID>','QA Community','qa','{\"membership\":\"open\"}','$H',0,'active',5);"
> # GET /api/v1/community/$CID  → expect 200 with member_count 0
> DB "INSERT INTO community_members (grid_name,community_id,member_civic_did,role,status,joined_tick) VALUES ('genesis','$CID','<REAL_DID>','founder','active',5);"
> # GET /api/v1/community/$CID  → expect member_count 1
> # GET /api/v1/system/map      → institutions.communities.communities_active should now be 1 (proves map is LIVE)
> # CLEANUP (mandatory):
> DB "DELETE FROM community_members WHERE community_id='$CID'; DELETE FROM communities WHERE community_id='$CID';"
> # GET /api/v1/system/map      → communities back to 0/0 ; GET community → 404
> ```
> After cleanup, re-run `git -C G:/xampp/htdocs/ASKKPOP/noesis status --porcelain` and diff it against
> `/tmp/qa_git_baseline.txt`: **no new or changed entries** vs the baseline = clean. (The runbook's own
> untracked files — `.planning/qa/…` and `grid/test/api/track-b-qa-guide.test.ts` — may show as `??`;
> those are expected deliverables, not test residue. The DB insert/delete never touches the working tree.)
>
> **Watch for (known observations — confirm still present, don't treat as new blockers):**
> - Unmatched routes / wrong method (e.g. `POST` a GET-only route, `/api/v0/...`, `/totally/fake`) return
>   `401 did_required`, not 404/405. This is deny-by-default (safe) but masks 404s. LOW.
> - `nous_active` on the map counts all registered Nous (registration status = active), which can differ
>   from the `brain` surface `active` and from `presence` awake — three different populations. Informational.
> - `current_rate_percent` (treasury endpoint) vs `fee_rate_percent` (map) — same value, naming drift. Cosmetic.
> - On Windows, `python -m json.tool` mis-renders `·` as `Â·` (cp1252). Verify byte content before filing a
>   mojibake bug — it is a tooling artifact, not a server bug.
>
> **Output:** a verdict table (ID · ✅/🟡/❌ · evidence), a short bug list using
> `🐞 BUG [B-ID] / What / URL / Expected / Got / Severity`, and an end-of-round line
> `Track B — Round N — ✅ x/… 🟡 y ❌ z — blockers: …`. Confirm zero source diff at the end.

---

## Notes for the human

- **Read-only by default.** The only writes are the bracketed B-07 community create, which the runbook
  deletes and verifies. Nothing else touches the DB.
- Prod dry-run: swap `http://localhost:8080` → `https://api.noesiis.com` and DROP the B-07 create block and
  every `DB(...)` call (no prod DB access; run read-only only).
- The durable version of these assertions lives in `grid/test/api/track-b-qa-guide.test.ts` (`npm test`).
