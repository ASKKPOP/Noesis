# W3 — Brain economic awareness (action-types) — Implementation Plan

> Overnight autonomous · local branch `night/loop-wiring` · **NO push**. REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Close the core round-2 finding — *the Brain has zero economic awareness*. Give a Nous the **action-types to decide** economic acts, routed to the live Grid HTTP routes (built this session): pay a civic due, bid on an RFP, request human approval, send a chat message. Brain-only slice (the Grid routes already exist); mirrors the established civic-land-verb pattern.

**Architecture (Brain, Python `brain/`):** add 4 `ActionType` members + `build_*` validators (mirror `build_civic_land_action`) + map each to its Grid route in the wire client's civic-land-style route table (so the action is dispatched to the live endpoint, NOT NousRunner). Route targets (built this session):
- `PAY_DUE` → `POST /api/v1/civic/dues/{due_id}/pay`, body `{method}` · metadata `{due_id, method}` (method ∈ wei|labor)
- `BID_RFP` → `POST /api/v1/procurement/notices/{notice_id}/bids`, body `{price_wei, artifact_spec}` · metadata `{notice_id, price_wei, artifact_spec}`
- `REQUEST_APPROVAL` → `POST /api/v1/civic/approvals`, body `{human_did, kind, summary, payload, deadline_tick}` · metadata same
- `POST_CONVERSATION` → `POST /api/v1/civic/conversation/{partner_did}/messages`, body `{text}` · metadata `{partner_did, text}`

The LLM *prompt* awareness (so the Nous spontaneously chooses these) is a later slice (W3b) — this slice delivers the callable capability + routing + validation.

**Tech Stack:** Python, pytest (`brain/test/`). Run: `cd brain && python -m pytest <target> -q` (match the repo's pytest invocation). **Commit locally, NO push.**

**Invariants:** the 4 verbs route through the existing wire mechanism (path-param substitution from metadata, rest as body); validators reject missing keys; no Grid change (routes exist); no audit/allowlist change.

---

## Task 1: Brain action-types + routing + validators + tests

Read first: `brain/src/noesis_brain/rpc/types.py` (`ActionType` enum, `Action` dataclass, `build_civic_land_action`, `_CIVIC_LAND_REQUIRED_KEYS`) and `brain/src/noesis_brain/wire/client.py` (`CIVIC_LAND_ROUTES` map ActionType → (METHOD, path-template) + how path params are substituted from metadata + body assembled). Mirror both exactly.

- [ ] **Step 1: Failing tests** — `brain/test/test_economic_actions.py`:
  - `build_economic_action(ActionType.PAY_DUE, due_id='d1', method='wei')` → metadata correct; missing key raises ValueError; non-economic verb raises.
  - one test per verb (PAY_DUE, BID_RFP, REQUEST_APPROVAL, POST_CONVERSATION) with required keys.
  - assert each verb is present in the wire route table mapping to the right (METHOD, path-template) — import the map from `wire/client.py`.

- [ ] **Step 2:** Add to `ActionType` (after the civic-land verbs): `PAY_DUE = "pay_due"`, `BID_RFP = "bid_rfp"`, `REQUEST_APPROVAL = "request_approval"`, `POST_CONVERSATION = "post_conversation"`.

- [ ] **Step 3:** Add `_ECONOMIC_REQUIRED_KEYS` (per the metadata lists above) + `build_economic_action(action_type, **metadata)` (mirror `build_civic_land_action`: validate it's an economic verb + required keys present, return `Action(...)`).

- [ ] **Step 4:** Add the 4 route mappings to the wire client's route table (the `CIVIC_LAND_ROUTES` analog), with path templates using `{due_id}`/`{notice_id}`/`{partner_did}` placeholders substituted from metadata (mirror the existing substitution). Ensure the remaining metadata becomes the JSON body. If the existing map is named/structured specifically, extend it (or add an `ECONOMIC_ROUTES` map merged into the dispatch the same way) — match the existing dispatch path so these verbs POST to the live routes.

- [ ] **Step 5: Verify** — `cd brain && python -m pytest test/test_economic_actions.py -q` → pass; run the rpc-types/handler/wire tests (`python -m pytest test/test_rpc_handler.py test/test_rpc_types.py -q` + any wire-client test) → no regression.

- [ ] **Step 6: Commit LOCALLY (NO push):**
```bash
git add brain/src/noesis_brain/rpc/types.py brain/src/noesis_brain/wire/client.py brain/test/test_economic_actions.py
git commit -m "feat(brain): W3 economic action-types (pay_due/bid_rfp/request_approval/post_conversation)

Routes a Nous's economic decisions to the live Grid routes. Closes the Brain-blind gap. Local only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Do NOT push.

## Self-Review
The Brain can now express 4 economic decisions, routed to the live Grid endpoints; validators enforce metadata; no Grid/audit/allowlist change; LLM-prompt awareness deferred to W3b; local commit only.
