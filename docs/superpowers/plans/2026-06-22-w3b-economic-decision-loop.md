# W3b — per-tick economic decision (a Nous spontaneously pays its due / bids on an RFP)

**Date:** 2026-06-22
**Choice:** the operator picked the "new per-tick decision call" path (over sight-only /
tool-loop-extension). The most *alive* option: the Brain autonomously decides, each cycle,
whether to act economically.

## The gap (from the Brain map)

- The Brain can **emit** the W3 economic actions (`pay_due`/`bid_rfp`) but is **economically
  blind** — no wire-client method reads its wei balance, outstanding dues, or open RFPs, and
  none of that enters the LLM prompt. It literally cannot know it owes a due.
- The autonomous tick (`on_tick`) makes **no LLM decision** — it's driven by drives/bios/telos.
  The only autonomous LLM loop is the agentic *tool* loop (research, curiosity-gated).
- Motivation already exists: Telos seeds a standing "earn a living" goal in the prompt. Drives
  are a frozen 5-enum, so "wanting money" stays in Telos, not a new drive.

## Design — mirror the agentic tool-loop

`_should_run_economic_cycle(tick)` (cheap sync gate) + background `_run_economic_cycle(tick)`
launched from `on_tick`, exactly like `_should_run_tool_cycle` / `_run_tool_cycle`.

### Unit 1 — wire sight + dispatch (`GridWireClient`)
- `fetch_account() -> dict`     GET `/api/v1/civic/account`     → `{civic_did, balance_wei}` ; `{}` on error
- `fetch_dues() -> list[dict]`  GET `/api/v1/civic/dues`        → the `dues` list ; `[]` on error
- `fetch_open_rfps() -> list`   GET `/api/v1/procurement/notices` → the `notices` list ; `[]` on error
- `post_economic_action(action) -> bool` — resolves `economic_route(type, **metadata)`, splits
  path-params (`due_id`/`notice_id`) from the JSON body, Bearer-auth POST, `True` on 2xx, never
  raises. **This was the missing piece** — W3 had `ECONOMIC_ROUTES` but nothing that POSTs.

### Unit 2 — sight + decision prompt (`prompts/`)
- `build_system_prompt(..., economic_state=None)` + `_economic_section()` — the "sight":
  `## Your economic position` (wei balance · outstanding due id+amount · open RFPs).
- `prompts/economic_decision.py`:
  - `build_economic_decision_prompt(account, due, rfps) -> str` — presents state + options,
    asks for ONE JSON object.
  - `parse_economic_decision(text) -> dict | None` — extract first JSON object, normalize.

  Decision schema:
  `{"action":"pay_due"|"bid_rfp"|"none", "method":"wei"|"labor", "notice_id":"…",
    "price_wei":"<digits>", "artifact_spec":"…", "reason":"…"}`

### Unit 3 — decision cycle (`handler`)
`_ECON_COOLDOWN_TICKS = 50`, `_last_econ_tick = -10_000`.
- `_should_run_economic_cycle(tick)`: `_grid_wire_client is not None` AND cooldown elapsed.
- `_run_economic_cycle(tick)`:
  1. fetch dues + RFPs (+ account for balance).
  2. outstanding due = oldest `status=='assessed'`; if **no due AND no RFP → return, NO LLM call**.
  3. build system prompt (character + goal + sight) + decision prompt → `llm.generate(purpose="economic_decision")`.
  4. parse; guardrails:
     - `pay_due`: needs an outstanding due; `method ∈ {wei,labor}`; if `wei`, require `balance ≥ amount_wei`.
     - `bid_rfp`: `notice_id` ∈ presented list; `price_wei` digits; `price_wei ≤ budget_wei`.
     - else / parse-fail → record reasoning, no post.
  5. `post_economic_action(action)`; record the decision to memory.
  - try/except, never fatal (mirror tool cycle).
- Wire into `on_tick` right after the tool-cycle launch.

## Guardrails (autonomous money-spend)
Cost-gated (no LLM unless a due/RFP exists) · 50-tick cooldown · Brain-side validation of every
LLM-chosen value · never-fatal · the Grid still enforces own-due-only / insufficient_balance /
bid≤budget as defense-in-depth.

## Scope (YAGNI)
`pay_due` + `bid_rfp` only — the economic-survival decisions. `request_approval` /
`post_conversation` stay capability-only.

## Tests (pytest, TDD)
`test/test_wire_economic.py` (reads + dispatch) · `test/test_economic_decision_prompt.py`
(prompt + parse + sight section) · `test/test_economic_cycle.py` (gate, actionable→post,
nothing→no-LLM, guardrails). No real Grid/LLM — `MagicMock` wire client + stub LLM adapter.

## Doc-sync
nous-spec-coverage (§3 economic decision now ACTIVE), STATE/ROADMAP (W3b shipped), TASK-LOG,
wiki economy (the loop is now self-driving). No new audit events / allowlist change (the Grid
routes already emit due.paid / procurement.bid_placed).
