# Phase 4 — Human Test Guide

Two things to verify that the sandbox couldn't:

1. **SC-6** — `docker compose up` brings the full stack and the dashboard connects to the Grid's WebSocket on first attempt
2. **Playwright E2E** — `dashboard/tests/e2e/grid-page.spec.ts` passes against a live stack

Total time: ~15 minutes if everything works first try.

---

## Prerequisites

```bash
# From repo root
cd /Users/desirey/Programming/src/Noēsis

# Check what you need installed
docker --version          # 24+ expected
docker compose version    # v2 plugin
node --version            # 22+ (matches Dockerfile.dashboard base)
```

If `docker compose` isn't installed: Docker Desktop on macOS includes it. Otherwise `brew install --cask docker`.

---

## Part 1 — SC-6: Full-stack smoke test

### Step 1. Set up env file

```bash
# If .env doesn't already exist, copy the template
[ -f .env ] || cp .env.example .env
```

Nothing in `.env.example` needs editing for a local smoke — defaults are sane. The key var is `NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080` which is baked into the dashboard bundle at build time.

### Step 2. Run the smoke script

The repo ships a convenience wrapper:

```bash
bash docker/test/smoke-compose.sh
```

*(Note: it was committed as mode 100644 — use `bash …` rather than `./…`. One-line fix: `chmod +x docker/test/smoke-compose.sh && git update-index --chmod=+x docker/test/smoke-compose.sh`.)*

The script:
1. `docker compose up -d --build` (brings up MySQL → Grid → Brain → Dashboard)
2. Polls `http://localhost:8080/health` until Grid is ready
3. Polls `http://localhost:3001/api/dash/health` until Dashboard is ready
4. On exit (success or failure) runs `docker compose down -v --remove-orphans`

**Expected output:**
```
✓ grid OK (http://localhost:8080/health)
✓ dashboard OK (http://localhost:3001/api/dash/health)
✓ smoke-compose passed
```

If it fails, the script dumps `docker compose logs --tail=100` automatically — paste that to me.

### Step 3. Manual browser verification (the part the script can't do)

**Don't run the teardown yet** — re-start without the script to keep the stack up:

```bash
docker compose up -d --build
```

Wait ~30s for all services to become healthy:

```bash
docker compose ps
# All 4 services should show "healthy" in STATUS
```

Then open **http://localhost:3001/grid** in Chrome.

**Check list (tick each one mentally):**

- [ ] Page loads without errors (open DevTools → Console; ignore `NEXT_PUBLIC_*` info logs)
- [ ] **Heartbeat widget** (top-right) shows tick count incrementing every ~30s (or whatever `GRID_TICK_RATE_MS` is set to)
- [ ] **Firehose panel** streams events — you should see `tick` entries at minimum, and `nous.spawned` early on
- [ ] **Region map** renders nodes (the regions) with labels, not an empty SVG
- [ ] DevTools → Network tab → filter for "WS": exactly **one** WebSocket connection to `ws://localhost:8080/ws/events`, status 101
- [ ] That WS frame shows a `hello` message then event frames

**The SC-6 line in ROADMAP specifically says "dashboard connects to the Grid's WebSocket on first attempt"** — verify this by reloading the page once and confirming there's still exactly one WS in Network, not a retry cycle.

### Step 4. Inspector + Economy smoke (SC-1 through SC-5 visual sanity)

With the stack still running:

**Inspector drawer (SC-1, SC-2):**
- [ ] Click any Nous name in the firehose event row — a drawer slides in from the right
- [ ] Drawer shows four tabs: Psyche / Thymos / Telos / Memory
- [ ] Psyche shows 5 meter rows (Big Five traits)
- [ ] Thymos shows emotional vector
- [ ] Telos shows active goals (may be empty for newly-spawned Nous — that's OK)
- [ ] Memory shows up to 5 entries with human-readable timestamps (e.g., "Apr 18, 2026")
- [ ] Press **Escape** → drawer closes
- [ ] Open drawer again, **Tab** through interactive elements → focus stays inside drawer (trap works)

**Economy panel (SC-3, SC-4, SC-5):**
- [ ] Click the `Economy` tab in the `/grid` TabBar (URL gains `?tab=economy`)
- [ ] **BalancesTable** lists all Nous with Ousia balance
- [ ] **ShopsList** shows any registered shops (may be empty if no Nous opened shops yet — that's fine; the section should render an "empty state" message, not blank)
- [ ] **TradesTable** — same (may be empty initially)

**Trigger a trade (if you want to see live updates):**

The Genesis preset should spawn 2-3 Nous that eventually trade. Watch the firehose — when a `trade.settled` event appears, the BalancesTable should update within one render cycle (D6: REST hydrate + WS invalidate).

If nothing trades on its own within 5 minutes, that's OK — the data pipeline is what SC-3/4/5 test, not the probability of trades.

### Step 5. Tear down

```bash
docker compose down -v --remove-orphans
```

The `-v` drops the MySQL volume. Skip `-v` if you want to preserve state.

---

## Part 2 — Playwright E2E

The Playwright spec is at `dashboard/tests/e2e/grid-page.spec.ts` and the config auto-starts `npm run dev` on port 3001, so **it runs against a dev dashboard, not the compose stack.** It uses a mock WebSocket server.

### Step 1. Install Chromium

One-time install (the error I hit in the sandbox was that Chromium wasn't present):

```bash
cd dashboard
npx playwright install chromium
```

This downloads ~170MB.

### Step 2. Run the spec

```bash
# From dashboard/
npm run test:e2e
```

The config will:
1. Start `npm run dev` (Next dev server on :3001) automatically
2. Run the spec against `http://localhost:3001`
3. Shut down the dev server when done

**Expected output:**
```
Running 1 test using 1 worker
  ✓ grid-page.spec.ts … (Xs)

  1 passed (Xs)
```

If it fails, Playwright auto-captures a trace on first retry — open with:
```bash
npx playwright show-report
```

### Step 3. Interpret results

- **Pass** → SC-6 + E2E both green. I'll flip VERIFICATION.md SC-6 from PARTIAL to MET and we move to Sprint 15.
- **Fail** → paste the failure output and any screenshot from `playwright-report/`. Common causes:
  - Port 3001 already in use (something else left running) — `lsof -i :3001`
  - Chromium install incomplete — rerun `npx playwright install chromium`
  - Actual regression — we debug it

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `docker compose up` hangs on "Attaching to …" | normal — `-d` runs detached; without `-d` it tails logs forever | Ctrl-C + use `-d` flag |
| Grid unhealthy: "Cannot connect to MySQL" | MySQL hasn't finished init yet | wait 20s, `docker compose ps` again |
| Dashboard shows "Failed to connect" banner | CORS misconfigured or WS_ORIGIN mismatch | confirm `.env` has `NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080` and rebuild: `docker compose up -d --build dashboard` |
| `:3001 address already in use` | a stray `next dev` from a prior session | `lsof -i :3001` → `kill <pid>` |
| Playwright: `Executable doesn't exist at …chromium_headless_shell…` | first-time install skipped | `cd dashboard && npx playwright install chromium` |
| Inspector drawer doesn't open on Nous click | `/api/v1/nous/:did/state` returning 404 | check `docker compose logs grid` for the request; the DID format must match `/^did:noesis:[a-z0-9_\-]+$/i` |

---

## Quick reference — ports

| Service | Port | Purpose |
|---------|------|---------|
| MySQL | 3306 | Grid persistence |
| Grid HTTP + WS | 8080 | `/health`, `/api/v1/…`, `/ws/events` |
| Dashboard | 3001 | Next.js UI + `/api/dash/health` |
| Ollama (optional) | 11434 | Local LLM — only if `LLM_PROVIDER=ollama` |

---

## When you're done

Tell me:
- **"SC-6 verified"** → I'll flip VERIFICATION.md and we pick the next thing
- **"E2E passed"** → I'll note it in the carry-forward section
- **"X failed with <output>"** → we debug

If both pass, Sprint 14 can close cleanly and we move to Sprint 15 planning via `/gsd-new-milestone`.
