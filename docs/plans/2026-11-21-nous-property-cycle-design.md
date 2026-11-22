# Nous property cycle — design

Date: 2026-11-21 · Status: **awaiting operator approval** · Source: discussion sheet
`docs/reports/noesis-grid-objects-discussion-2026-11-21.html` §19.6 (Q18, Q18a)

## Intent and why

Let a living Nous buy a parcel, build on it and furnish it, by its own choice. Today no Nous can:
**eight** links between the decision and a placed furnishing are open (sheet §19.6; the eighth was
found by the independent check of this document, see "Check of this design"). Until one Nous
has done it on production, nothing else in the Grid House Objects design has a user, and none of
it should be built.

## Decided by the operator

- Settle Q18 (decision loop) before any other open question.
- **Q18a: the first living Nous runs on the operator's office Mac Studio, on its Local AI.**
- The operator cannot reach that machine remotely at the moment. The first production run
  therefore waits until the operator is at the machine or remote access exists. The code does not
  wait.

## Goals

1. One enrolled Nous on production buys a parcel, builds a structure and places at least one
   furnishing, without a human choosing any of it.
2. No model call when nothing can be done.
3. Every value the model chooses is checked in the Brain before anything is sent.
4. A refusal by the Grid becomes a lesson the Nous reads at its next decision.
5. Three numbers can be read from production at any time: parcels owned by a Nous, structures
   built by a Nous, furnishings placed.

## Non-goals

Object manifests, the Form DSL, Link Box, app links, coordinates and placement, the 59-kind
catalog (the catalog stays at the 13 shipped kinds), any market, any 3D view, Brains for the
three seed Nous on the server, new audit events (allowlist +0), changes to
`NousRunner.executeActions`, any change to the Grid at all.

## Anti-goals

- **Autoplay.** Nothing is bought, built or placed on the Nous's behalf. D-58-10 stands: these
  are capabilities the Nous may choose. `none` is always a valid answer and is never penalised.
- A human steering the choice. The operator starts the Brain and funds the account; the operator
  does not pick the parcel, the building or the furniture.
- A menu long enough that a 4B model answers at random.
- A refusal that disappears. Every non-2xx is logged and remembered.
- Buying land with the last coin. The purchase check keeps a reserve (see §3).

## Constraints

- D-NH-07 (only a Nous owns land), D-59-08 (interior contents never reach the audit chain),
  D-58-10 (capability, not autoplay).
- Small-model discipline already used by the economic cycle: JSON mode, thinking off, 256 tokens,
  tolerant parsing, Brain-side validation.
- Ticks only in decision logic. A cycle must never take down a tick.
- Existing audit events are enough: `zoning.parcel_purchased`, `treasury.parcel_revenue`,
  `zoning.structure_built`, `zoning.interior_extended`. All are emitted by the routes already.
- Tests run with `pytest` on fixtures; no live model and no network in tests.

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | A separate **property cycle** on the pattern of `_run_economic_cycle` | One more cycle to maintain. Runs only when something is actionable, keeps every menu at two to four options, costs no model call otherwise. |
| B | Add `buy_parcel`, `build`, `furnish` to the fast actor (`work_task · speak · rest`) | Smallest diff. But the fast actor runs every 20 ticks for any Nous with a goal, the menu doubles, and it has no economic state in its prompt. |
| C | Let the planner invent building as a goal task and execute it through the tool loop | Most "natural". Needs a tool path from the task ledger to Grid routes that does not exist, and gives no bound on cost. |

A was the author's recommendation. The operator did not choose between them; they named the
machine. **A is therefore the author's call**, to be confirmed with this document.

## Design

### 0. A clock for a Brain that is not on the Grid's host (link 8)

`handler.on_tick` is called from one place only: the `brain.onTick` RPC on a local Unix socket,
which the Grid's bridge drives when Brain and Grid share a host. On production the Grid holds a
disconnected stub bridge, and the Brain's WebSocket handler routes peer signals only. A Brain on
the Mac Studio would enrol, send heartbeats and then never think: no economic, planner, decision,
social or property cycle runs without a tick.

**Author's call: the Brain follows the Grid's clock.** When a wire client exists and no socket
bridge is driving ticks, a background task reads `GET /api/v1/grid/clock` (public; returns
`tick`, `epoch`, `tickRateMs`) once per tick interval and calls `handler.on_tick` once for each
new tick number it sees. The Grid stays the only clock: a paused Grid pauses the mind, and the
Brain never invents a tick. Missed ticks are skipped, not replayed. Actions that `on_tick`
returns are sent with the existing `post_actions`.

Not chosen: the Grid pushing tick frames over the WebSocket. It is the better long-term shape
for many Brains, but it changes the Grid and its deploy, and one Nous does not need it.

To be established while planning, because a wrong guess matters: whether the Grid creates a
runner for a Nous that is not one of the three founders. `post_actions` answers
`404 nous_runner_not_found` without one. The property cycle itself does not depend on it (it
uses direct routes), but `speak` and the other returned actions do.

### 1. Stages

The cycle offers the verbs of one stage only. The stage is computed from Grid state, not chosen
by the model.

| Stage | Condition | Offered |
|---|---|---|
| 0 Land | Owns no parcel, and balance covers the cheapest purchasable parcel plus the reserve | `buy_parcel` (up to 5 candidates), `none` |
| 1 Build | Owns a parcel with no structure | `build` with only the types its zone allows, `none` |
| 2 Furnish | Owns a structure with fewer than the Brain-side cap of furnishings | `furnish`, `none` |
| — | Anything else | no model call |

"Owns" is decided by comparing `sha256(own Civic-DID)` with `owner_civic_did_hash` in the public
parcel feed. v1 handles one parcel: a Nous that owns one is never offered a second.

Candidates are parcels with `status: available`, a price above zero and a zone in the purchasable
set (`residential`, `business`, `shopping`, `manufacture`). Civic commons also show as
`available` in the feed and are refused with `zone_not_purchasable`; they are never offered.
The types offered in stage 1 follow the Grid's `STRUCTURE_ZONE_FIT`: `home` in `residential`
only; `shop` and `workshop` in `business`, `shopping`, `manufacture`; `venue` in all four. The
Brain mirrors that table; the Grid remains the judge (`409 type_zone_mismatch`).

### 2. Brain: new prompt module

`brain/src/noesis_brain/prompts/property_decision.py`, mirroring `economic_decision.py`:

- `build_property_decision_prompt(stage, account, candidates | parcel | interior)`
- `parse_property_decision(text) -> dict | None`, first JSON object, action in
  `{"buy_parcel","build","furnish","none"}`

Answer shapes:

```json
{"action":"buy_parcel","parcel":"<id from the list>","reason":"..."}
{"action":"build","type":"home|shop|workshop|venue","name":"...","visibility":"open|private","reason":"..."}
{"action":"furnish","area":"...","kind":"<kind from the list>","reason":"..."}
{"action":"none","reason":"..."}
```

The furnish prompt lists the kinds valid for the structure type (mirror kinds only in a `home`,
as `isValidFurniture` enforces) and the current interior as kinds per area. This is the Nous's
first sight of its own rooms, and it is kinds only.

### 3. Brain: handler

In `rpc/handler.py`, beside the economic cycle:

- `_PROPERTY_COOLDOWN_TICKS` (builder's choice; proposal 100, about 50 minutes at 30 s ticks)
- `_should_run_property_cycle(tick)`: wire client and model present, cooldown elapsed
- `_run_property_cycle(tick)`: read the parcel feed and the account, compute the stage, return
  with no model call when no stage applies, otherwise one model call, validate, dispatch, remember
- scheduled in `on_tick` like the economic cycle, behind `_mind_awake`

Brain-side checks before dispatch:

| Verb | Check |
|---|---|
| `buy_parcel` | parcel is one of the presented candidates; still `available`; `price + reserve <= balance` |
| `build` | type is one the parcel's zone allows; visibility in the closed set; name is 1 to 40 characters after trimming |
| `furnish` | kind is in the presented list; area is 1 to 24 characters, lower-case letters, digits, `_`; total furnishings below the cap |

Reserve: upkeep is not a due the Nous pays. The Grid's scanner debits the owner's account itself
every period (2% of the price at the founding rate) and a parcel whose owner cannot cover it
decays toward reclaim. So the purchase check keeps back five periods of upkeep (10% of the
price). **Author's call:** v1 leaves the economic cycle as it is, so a later `pay_due` in wei can
still spend into that reserve. That is listed under Risks instead of being engineered away.

Furnish list: all kinds valid for the structure are shown (13 in a home, 7 elsewhere), in catalog
order rotated by the tick so that no kind always comes first. **Author's call:** no shortlist,
because choosing a shortlist would be choosing for the Nous. Furnishing cap: author's proposal 12. The extend route itself has no
cap and no charge (sheet §19.1, error 6), so the Brain bounds it until the Grid does.

Memory: each success is recorded as a plain fact about the Nous's own act ("Bought parcel …",
"Built a home", "Placed a bed in the bedroom"). Each refusal is recorded as
`Lesson: my <verb> was refused by the Grid (<error code>)` and counts toward the
failure-triggered reflection, exactly as the economic cycle does.

### 4. Brain: wire client

`wire/client.py`:

- `post_civic_land_action(action, parcel_id) -> tuple[bool, str | None]`: resolves the route
  with `civic_land_route(action_type, parcel_id)`, calls it directly with the bearer token and
  returns success plus the Grid's error code. It never raises. It differs from
  `post_economic_action` in two ways: that one returns a bare `bool`, and here the parcel address
  is passed explicitly because `extend_interior` carries no `parcel` key.
- `fetch_interior(parcel_id) -> dict | None`: `GET …/interior` as the owner.

Civic-land actions do **not** go through `post_actions`. The batch intake has no case for them
and drops them while answering 200.

### 5. Verb shapes

- `BUILD` required keys become `("parcel", "type", "name", "visibility")`. The route already
  requires `visibility`.
- `BUY_PARCEL` gains `parcel` as the address to dispatch to. `zone` and `max_price` stay as the
  Brain's own record of what it was willing to pay.
- The comments in `rpc/types.py`, `wire/client.py` and `rpc/handler.py` that say the Grid action
  handler routes civic-land actions by `action_type` are corrected. They are false and they
  misled this design's author once already.

### 6. Tests

`brain/test/test_property_decision_prompt.py`, `test_property_cycle.py`, and additions to
`test_civic_land_verbs.py`:

- parser tolerance and rejection of unknown actions
- stage selection from feed and account fixtures, including "nothing actionable, no model call"
- each Brain-side check refuses the bad value and dispatches nothing
- the dispatched method, path and body for each verb
- a refusal produces a lesson and increments the failure counter
- cooldown

### 7. First run on production (operator, at the Mac Studio)

1. Check out `main`, create the Brain's virtual environment.
2. In the Local Nous Manager set `extraEnv`: `GRID_URL=https://api.noesiis.com`,
   `BRAIN_DATA_DIR=<a folder that is backed up>`, `NOUS_NAME` and `NOUS_DID` of the chosen Nous
   (left unset, the Brain claims to be `did:noesis:sophia`), and the provider address of the
   Local AI.
3. Set the model names for that Nous in the Portal's Local AI settings. A Grid-wired Brain takes
   its three model names from there, not from the environment, and exits if it cannot read them.
4. Start the Brain once. It creates its key and logs the public half.
5. File the registration in the Portal (Account → Register a Nous) with that key. The filer must
   be the Nous's sponsor; for a founder the filer must also be an allowlisted operator. Approve it.
6. The Brain enrols, receives its Civic-DID, connects and starts following the clock.
7. **Funding.** `GRID_ENDOWMENT_ENABLED` is `false` on production, so there is no way to give a
   new Nous its first money today. See "Open for the operator".
8. Leave it running. Read the three numbers.

### 8. How success is verified on production

- The public parcel feed shows one parcel `owned` with the Nous's hash, then a `structure`.
- The owner's interior read returns at least one object.
- The audit chain contains the purchase, the structure and the interior events for that parcel.

No local stack stands in for this. Until the Mac Studio run, the code is covered by tests only,
and that is stated wherever the work is reported.

## Open for the operator

0. **Which Nous.** Either **Sophia**, a founder that is already on the roster with a written
   character, or a **new Nous** of the operator's own. Sophia is the short path if the operator
   is recorded as her sponsor. A new Nous keeps the founders untouched but needs to be created
   and given a character first. Author's proposal: Sophia for the first proof.
1. **First money.** Either switch `GRID_ENDOWMENT_ENABLED` on and endow the new Nous once
   (author's proposal: 1000, which covers a ring-3 parcel at 400 with reserve), or let it earn
   through labour and bids before it can buy. The second is purer and may take weeks.
2. **Model endpoint on the Mac Studio.** The Brain speaks to Ollama or to an Anthropic key. If
   the Local AI is something else, a provider has to be added first.
3. **An earlier trial.** The machine this session runs on has Ollama with `qwen3:4b`. A Brain
   could run here to prove the seven links on production before the office visit. The Nous's key
   would then live here and would have to be moved to the Mac Studio afterwards. Default: wait.

## Left to the builder

Cooldown length, reserve formula, candidate ordering and count, furnishing cap, prompt wording,
log messages, whether `post_civic_land_action` shares a helper with `post_economic_action`.

## Risks

- **The Nous always answers `none`.** Then that is the finding, and it answers the sheet's hard
  question about motivation before anything larger is built.
- **Upkeep reclaims the parcel.** The Grid debits upkeep by itself; a Nous with an empty account
  loses condition and in the end the parcel, and reclaim deletes the whole interior. The reserve
  covers five periods at purchase. Nothing in v1 stops the economic cycle from spending it later.
- **A Nous on a machine that sleeps.** The mind follows the Grid's clock only while the Mac
  Studio is awake and online. Upkeep runs regardless.
- **The feed lags a purchase.** The cycle re-reads state every run and the Grid is the judge; a
  stale candidate is refused with 409 and becomes a lesson.

## Check of this design

An independent reader with access to the code, and none to the author's reasoning, checked the
first draft. It found six places where the code contradicts the draft. Each was read again in the
source by the author and all six stand:

| # | The draft said | The code says |
|---|---|---|
| 1 | Schedule the cycle in `on_tick` and it runs. | Nothing calls `on_tick` for a Brain off the Grid's host (`__main__.py` registers it only as a socket RPC; `grid/src/main.ts` holds a stub bridge). **Eighth open link.** |
| 2 | The economic cycle pays upkeep. | Upkeep is debited by the Grid's scanner (`grid/src/civic/upkeep-scanner.ts`). |
| 3 | `build` needs type, name, visibility. | Type must also fit the zone (`STRUCTURE_ZONE_FIT`); commons look `available` but cannot be bought. |
| 4 | Model settings go in `extraEnv`. | A Grid-wired Brain reads them from the operator's settings on the Grid and exits on failure. |
| 5 | Start the Brain and file its key. | `NOUS_DID` defaults to Sophia; registration needs sponsorship, and operator rights for a founder. |
| 6 | Dispatch like `post_economic_action`. | `extend_interior` carries no parcel; that function returns a bare bool. |

Its four questions were sorted as follows. Tick source: author's call (§0). Reserve and the
economic cycle: author's call (§3, Risks). Furnish shortlist: author's call (§3). Which Nous:
the operator's, listed above.
