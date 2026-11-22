# Nous Property Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Brain running on another machine follows the Grid's clock and can, by its own choice, buy a parcel, build on it and furnish it.

**Architecture:** All changes are in the Brain (`brain/`). Pure decision logic lives in a new module; the prompt and parser mirror `prompts/economic_decision.py`; the handler gains one thin cycle beside `_run_economic_cycle`; the wire client gains direct-route calls; a small follower task turns the Grid's public clock into `on_tick` calls. The Grid is not changed.

**Tech Stack:** Python 3, `httpx`, `pytest` + `pytest-asyncio` (`asyncio_mode = auto`), `unittest.mock`.

**Spec:** `docs/plans/2026-11-21-nous-property-cycle-design.md` (approved by the operator 2026-11-21).

## Global Constraints

- No change under `grid/`, `protocol/`, `dashboard/`. No new audit event (allowlist +0).
- D-58-10: capabilities, not autoplay. `none` is always valid. Nothing is bought, built or placed without the model choosing it.
- Small-model discipline: `json_mode=True`, `max_tokens=256`, tolerant parse, every model-chosen value checked in the Brain before dispatch.
- Ticks only in decision logic. No cycle or follower iteration may raise out of its task.
- Civic-land actions never go through `post_actions`.
- Tests: fixtures and mocks only, no network, no live model. Run from `brain/` with
  `PYTHONPATH=src /Users/desirey/Programming/src/Noesis/brain/.venv/bin/python -m pytest <files> -q`.
- Exact values: cooldown 100 ticks; reserve 1000 bps of price; at most 5 candidates; furnishing cap 12; name 1–40 chars; area `^[a-z0-9_]{1,24}$`.

## Facts established while planning

- Parcel ids look like `genesis:residential:0007`. Feed fields: `id, zone, status, price_wei, owner_civic_did_hash, structure{type,visibility}|null`.
- Interior read returns `{parcel_id, condition, interior: {areas: [{name, objects: [{kind, class}]}]}}`.
- The Grid creates runners for the three founders only (`grid/src/main.ts`). `post_actions` for any other Nous answers `404 nous_runner_not_found`. The first Nous is therefore Sophia.
- The Grid's tick restarts from 0 when the Grid restarts. Every `_last_*_tick` cooldown in the handler then stays blocked until the new tick passes the old one.

## Review Focus

1. The model answers valid JSON with wrong types (`parcel` a number, `name` a list): nothing is dispatched and nothing raises.
2. The parcel feed holds malformed rows (missing or non-numeric `price_wei`, missing `zone`): they are skipped.
3. The Grid answers a refusal with a non-JSON body (a proxy's 502 page): the lesson carries `http_502`.
4. The Grid restarts and its tick goes backwards: the follower keeps ticking and the cooldown markers are reset.
5. The machine sleeps and wakes far behind: one `on_tick` with the latest tick, no replay.

---

### Task 1: Verb shapes and the truth about dispatch

**Files:**
- Modify: `brain/src/noesis_brain/rpc/types.py` (`_CIVIC_LAND_REQUIRED_KEYS`, the Phase 58 comment block)
- Modify: `brain/src/noesis_brain/wire/client.py` (the `CIVIC_LAND_ROUTES` comment block)
- Modify: `brain/src/noesis_brain/rpc/handler.py` (comment above `produce_civic_land_action`)
- Test: `brain/test/test_civic_land_verbs.py`

**Interfaces:**
- Produces: `build_civic_land_action(ActionType.BUILD, parcel=, type=, name=, visibility=)`; `build_civic_land_action(ActionType.BUY_PARCEL, parcel=, zone=, max_price=)`.

- [ ] **Step 1: Failing tests** in `test_civic_land_verbs.py`:

```python
def test_build_requires_visibility():
    with pytest.raises(ValueError, match="visibility"):
        build_civic_land_action(ActionType.BUILD, parcel="genesis:residential:0001", type="home", name="Oikos")

def test_buy_parcel_requires_parcel():
    with pytest.raises(ValueError, match="parcel"):
        build_civic_land_action(ActionType.BUY_PARCEL, zone="residential", max_price=400)
```

- [ ] **Step 2:** Run; both fail. Existing tests that build `BUILD` / `BUY_PARCEL` without the new keys are updated to pass them.
- [ ] **Step 3:** `BUILD: ("parcel", "type", "name", "visibility")`, `BUY_PARCEL: ("parcel", "zone", "max_price")`.
- [ ] **Step 4:** Replace the three comments that say the Grid action handler routes civic-land actions by `action_type`. New wording, in all three places: civic-land actions are sent **directly** to their civic-parcels route by `GridWireClient.post_civic_land_action`; the batch intake (`NousRunner.executeActions`) has no case for them.
- [ ] **Step 5:** Run `test_civic_land_verbs.py test_civic_interior_verbs.py test_civic_commerce_verbs.py test_civic_construction_verbs.py`; all pass. Commit.

### Task 2: Pure property logic

**Files:**
- Create: `brain/src/noesis_brain/property_logic.py`
- Test: `brain/test/test_property_logic.py`

**Interfaces (produces):**

```python
PURCHASABLE_ZONES: tuple[str, ...] = ("residential", "business", "shopping", "manufacture")
STRUCTURE_ZONE_FIT: dict[str, tuple[str, ...]]   # home→residential; shop, workshop→business, shopping, manufacture; venue→all four
MIRROR_KINDS = ("bed", "closet", "shelf", "kitchen", "bathroom", "decor")
FUNCTIONAL_KINDS = ("work_desk", "sim_board", "meeting_table", "game_table", "task_board", "skill_terminal", "shop_counter")
RESERVE_BPS = 1000; MAX_CANDIDATES = 5; FURNISH_CAP = 12

def civic_did_hash(civic_did: str) -> str                       # sha256 hex, lower case
def reserve_for(price: int) -> int                               # price * RESERVE_BPS // 10000
def own_parcel(parcels: list[dict], civic_did: str) -> dict | None
def candidates(parcels: list[dict], balance: int) -> list[dict]  # available, zone purchasable, int price > 0, price + reserve <= balance; sorted by (price, id); first MAX_CANDIDATES
def allowed_types(zone: str) -> list[str]                        # in the order home, shop, workshop, venue
def valid_kinds(structure_type: str, tick: int) -> list[str]     # mirror kinds only for "home"; rotated left by tick % len
def interior_summary(interior: dict | None) -> dict[str, list[str]]   # area name → kinds
def interior_count(interior: dict | None) -> int

@dataclass(frozen=True)
class Stage:
    name: str                 # "land" | "build" | "furnish"
    parcel: dict | None       # the owned parcel for build / furnish
    options: list             # candidates | allowed types | valid kinds

def plan_stage(parcels: list[dict], civic_did: str, balance: int, tick: int) -> Stage | None
    # owns nothing → "land" when candidates exist, else None
    # owns a parcel with structure None → "build" (None when no type fits its zone)
    # owns a structure → "furnish" (the caller applies the cap after reading the interior)

def validate(stage: Stage, decision: dict, balance: int, interior: dict | None) -> tuple[ActionType, str, dict] | None
    # returns (action_type, parcel_id, metadata for build_civic_land_action) or None
```

`validate` rules: `buy_parcel` only in stage "land", `parcel` a str equal to a candidate's `id`; `build` only in "build", `type` in `stage.options`, `visibility` in `("open", "private")`, `name` a str of 1–40 chars after `strip()`; `furnish` only in "furnish", `kind` in `stage.options`, `area` a str matching `^[a-z0-9_]{1,24}$`, `interior_count(interior) < FURNISH_CAP`. Anything else, including `none`, returns `None`.

- [ ] **Step 1: Failing tests** (one assertion group each): hash is `hashlib.sha256(b"did:civic:noesis:sophia").hexdigest()`; `candidates` drops commons (`price_wei` 0, zone `infrastructure`), owned parcels, rows with `price_wei` `"abc"` or missing `zone`, and anything where `400 + 40 > balance`; returns at most 5 sorted by price then id. `allowed_types("residential") == ["home", "venue"]`; `allowed_types("business") == ["shop", "workshop", "venue"]`; `allowed_types("government_quarter") == []`. `valid_kinds("home", 0)` has 13 entries starting with `bed`; `valid_kinds("shop", 0)` has the 7 functional kinds; `valid_kinds("home", 1)[0] == "closet"`. `plan_stage` returns `None` with balance 439 and a 400 parcel, `"land"` with 440, `"build"` when the feed marks a parcel with the Nous's hash and `structure: None`, `"furnish"` when it has a structure. `validate` refuses: unknown parcel id, `parcel` as int, `type="home"` on a business parcel, `visibility="secret"`, `name=""`, `name` 41 chars, `name` a list, `kind="bed"` in a shop, `area="Living Room"`, a 12-object interior; and accepts one good case per verb with the exact metadata (`buy_parcel` → `{"parcel": id, "zone": zone, "max_price": price}`).
- [ ] **Step 2:** Run; fail on import.
- [ ] **Step 3:** Implement the module. No I/O, no logging, no imports from `rpc.handler`.
- [ ] **Step 4:** Run `test_property_logic.py`; pass. Commit.

### Task 3: Prompt and parser

**Files:**
- Create: `brain/src/noesis_brain/prompts/property_decision.py`
- Test: `brain/test/test_property_decision_prompt.py`

**Interfaces:**
- Consumes: `Stage`, `interior_summary` from Task 2.
- Produces: `build_property_decision_prompt(stage: Stage, balance: int, interior: dict | None = None) -> str`; `parse_property_decision(text: str) -> dict | None`.

- [ ] **Step 1: Failing tests:** the land prompt contains every candidate id and price, the balance, and the literal `"none"`; the build prompt contains only the allowed types and both visibilities; the furnish prompt contains the valid kinds and the current interior as `area: kind, kind`; none of the three contains the verbs of another stage. `parse_property_decision` returns the dict for prose-wrapped JSON, `None` for no JSON, `None` for `{"action": "sell"}`, and the dict for `{"action": "none"}`.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement on the pattern of `economic_decision.py` (same first-JSON-object regex, `_VALID_ACTIONS = {"buy_parcel", "build", "furnish", "none"}`). Each prompt ends with the one or two answer shapes of its stage, copied from the spec §2, and the sentence: `Choosing "none" is a real choice.`
- [ ] **Step 4:** Run; pass. Commit.

### Task 4: Wire client — direct routes

**Files:**
- Modify: `brain/src/noesis_brain/wire/client.py`
- Test: `brain/test/test_wire_civic_land.py`

**Interfaces (produces):**

```python
@property
def civic_did(self) -> str                                   # the token manager's civic DID
async def fetch_clock(self) -> dict | None                   # GET /api/v1/grid/clock
async def fetch_interior(self, parcel_id: str) -> dict | None    # the "interior" value of GET …/interior, None on any failure
async def post_civic_land_action(self, action: Any, parcel_id: str) -> tuple[bool, str | None]
```

`post_civic_land_action`: route from `civic_land_route(action.action_type, parcel_id)`; refuses a non-POST route and a `parcel_id` not matching `^[A-Za-z0-9:_-]{1,128}$` with `(False, "invalid_parcel")` and no request; JSON body is the metadata without `parcel`, `zone`, `max_price`; bearer token as in `post_economic_action`. Returns `(True, None)` on 2xx. On a refusal returns `(False, code)` where `code` is the body's `error` string when the body is a JSON object with one, else `f"http_{status}"`. On an exception returns `(False, "transport_error")`. Never raises, never queues.

- [ ] **Step 1: Failing tests** with a fake `httpx` transport (`httpx.MockTransport`): `buy_parcel` posts to `/api/v1/civic/parcels/genesis:residential:0007/purchase` with body `{}`; `build` posts `{"name", "type", "visibility"}` only; `extend_interior` posts `{"area", "kind"}`; a 402 `{"error": "insufficient_funds"}` gives `(False, "insufficient_funds")`; a 502 with an HTML body gives `(False, "http_502")`; a raising transport gives `(False, "transport_error")`; parcel id `../x` gives `(False, "invalid_parcel")` and zero requests; `fetch_interior` returns the `interior` dict on 200 and `None` on 403; `fetch_clock` returns the dict.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement. Reuse `_econ_get` for the two reads.
- [ ] **Step 4:** Run with `test_economic_actions.py`; pass. Commit.

### Task 5: The property cycle

**Files:**
- Modify: `brain/src/noesis_brain/rpc/handler.py` (fields near `_last_econ_tick`; methods after `_economic_action_from_decision`; scheduling in `on_tick` after the economic block)
- Test: `brain/test/test_property_cycle.py`

**Interfaces:**
- Consumes: Tasks 2, 3, 4.
- Produces: `_PROPERTY_COOLDOWN_TICKS = 100`; `self._last_property_tick = -10_000`; `_should_run_property_cycle(tick) -> bool`; `async _run_property_cycle(tick) -> None`.

Behaviour of `_run_property_cycle`, in order: read `fetch_parcels` and `fetch_account`; `plan_stage`; return when `None`; for "furnish" read `fetch_interior` and return when it is `None` or at the cap; one `llm.generate` with `build_system_prompt(..., economic_state={"balance_wei": str(balance)})`, `temperature=0.7`, `max_tokens=256`, `purpose="property_decision"`, `json_mode=True`; `parse_property_decision`; `validate`; when that is `None` and the model answered, record `Considered my property and chose to wait: <reason>` and return; build the action with `build_civic_land_action`; `post_civic_land_action`; on success record `Bought parcel <id> for <price>` / `Built a <type> named <name>` / `Placed a <kind> in the <area>`; on refusal increment `_failed_since_reflection` and record `Lesson: my <verb> was refused by the Grid (<code>)`. The whole body is inside `try/except Exception` that logs a warning.

`_should_run_property_cycle`: wire client and `llm` present, and `tick - _last_property_tick >= 100` **or** `tick < _last_property_tick`.

- [ ] **Step 1: Failing tests** on the fixtures of `test_economic_cycle.py` (`_handler`, `_llm_saying`, a `_wire` with `civic_did = "did:civic:noesis:sophia"`, `fetch_parcels`, `fetch_account`, `fetch_interior`, `post_civic_land_action`): gate false without wire client, false inside cooldown, true after it, true when the tick went backwards; no `llm.generate` call when nothing is affordable; no call when the interior holds 12 objects; land stage with the model choosing a listed parcel dispatches `BUY_PARCEL` with that id and records the purchase; a parcel id not in the list dispatches nothing; `{"action":"none","reason":"saving"}` dispatches nothing and records the wait; build stage dispatches `{"parcel","type","name","visibility"}`; furnish stage dispatches `EXTEND_INTERIOR` with `{"area","kind"}`; `(False, "insufficient_funds")` records a lesson containing `insufficient_funds` and raises `_failed_since_reflection` by one; `fetch_parcels` raising does not raise out of the cycle; the model answering `{"action":"buy_parcel","parcel":7}` dispatches nothing and does not raise.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement. In `on_tick`, after the economic block, schedule exactly as that block does, behind `_mind_awake`.
- [ ] **Step 4:** Run `test_property_cycle.py test_economic_cycle.py test_decision_cycle.py`; pass. Commit.

### Task 6: Clock follower

**Files:**
- Create: `brain/src/noesis_brain/wire/clock_follower.py`
- Modify: `brain/src/noesis_brain/rpc/handler.py` (`_last_tick_seen`, `reset_tick_markers`)
- Modify: `brain/src/noesis_brain/__main__.py` (`BrainApp.start` / `stop`)
- Test: `brain/test/test_clock_follower.py`

**Interfaces (produces):**

```python
# handler
self._last_tick_seen: int = -1            # set at the top of on_tick to params["tick"] when it is an int
def reset_tick_markers(self) -> None      # every int attribute named _last_*_tick becomes -10_000

# clock_follower.py
GRACE_SECONDS = 2.0
async def follow_once(client, handler, state: dict, *, sleep=asyncio.sleep) -> float
    # one iteration; returns the seconds to wait before the next
async def follow_grid_clock(client, handler, *, sleep=asyncio.sleep) -> None
    # loops follow_once forever; an exception in an iteration is logged and followed by a 10 s wait
```

`follow_once`: read `client.fetch_clock()`; when it is not a dict with an int `tick`, return 10.0. Let `tick`, `epoch` (default 0), and `wait = clamp(tickRateMs / 1000, 1.0, 60.0)` (30.0 when absent). When `tick < state.get("last", -1)`: call `handler.reset_tick_markers()` and treat the tick as new. When `tick == state.get("last")`, return `wait`. Otherwise `await sleep(GRACE_SECONDS)`; when `handler._last_tick_seen == tick` (a socket bridge delivered it), set `state["last"] = tick` and return `wait`; else `actions = await handler.on_tick({"tick": tick, "epoch": epoch})`, set `state["last"] = tick`, send the actions whose `action_type` is not `"noop"` with `client.post_actions(actions, tick=tick)` when any exist, and return `wait`.

`BrainApp.start`: when a wire client exists and the environment variable `BRAIN_CLOCK_FOLLOW` is not `off`, create the follower task and log `clock follower started`. `stop` cancels it like the heartbeat task.

- [ ] **Step 1: Failing tests** with a fake client and a real `BrainHandler` whose `on_tick` is an `AsyncMock`: first tick 10 → one `on_tick({"tick": 10, "epoch": 0})`; same tick again → no call; 10 then 500 → exactly one more call with 500; 500 then 3 → `reset_tick_markers` called and `on_tick` called with 3; `fetch_clock` returning `None` → no call, returns 10.0; `handler._last_tick_seen` already equal to the tick → no call; returned `[{"action_type": "noop"}]` → `post_actions` not called; returned `[{"action_type": "speak", ...}]` → `post_actions` called once with `tick=`; `on_tick` raising inside `follow_grid_clock` does not end the loop (drive two iterations with a `sleep` that raises `CancelledError` on its third call). `reset_tick_markers` sets `_last_econ_tick`, `_last_property_tick` and `_last_decision_tick` to `-10_000` and leaves `_last_tick_seen` alone.
- [ ] **Step 2:** Run; fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `test_clock_follower.py`; then the whole suite `-q`; pass. Commit.

### Task 7: Documents

**Files:**
- Modify: `docs/plans/2026-11-21-nous-property-cycle-design.md` (status, the two facts above, runbook: Sophia, `BRAIN_CLOCK_FOLLOW`)
- Modify: `docs/reports/noesis-grid-objects-discussion-2026-11-21.html` (§19.6: links 4–8 built and tested, not yet shown on production), then `python3 scripts/build-reports-index.py`
- Modify: `wiki/2-concepts/mind/` page for the mind's cycles, if one describes them, with the property cycle and the clock follower as system truth
- Modify: `.planning/STATE.md`, `.planning/research/log.md`

- [ ] **Step 1:** Edit; run `node scripts/check-wiki.mjs`, `node scripts/lint-research-wiki.mjs`, `node scripts/check-state-doc-sync.mjs`, `python3 scripts/build-reports-index.py --check`.
- [ ] **Step 2:** Commit, PR, merge, republish `/reports`, verify live.

## What this plan cannot show

Nothing here runs against production. Links 4 to 8 are proven by tests only until a Brain runs on the Mac Studio with an enrolled, funded Sophia.
