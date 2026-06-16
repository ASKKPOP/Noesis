# Phase 72b — Tool-Loop Activation + Grid Mirror — Design

**Status:** DESIGN ONLY (no code). Authored 2026-06-16. Prerequisite environment for *implementation*: a live, tool-capable LLM (Claude) running a real Nous + Docker (for `run_code`). This document is the design so the wiring is decided before any code lands.

## Problem

Phases 72–74 built the Brain-side capability — `ToolRunner` (tool loop), `web_search`/`web_fetch`, the `run_code` Docker sandbox, and `TaskRunner` (plan→build→QA + `ActivityReport`). **None of it is called inside a Nous's live cognitive tick.** So today no real Nous produces tool activity, and there is nothing for the Grid to mirror. Activation = wiring these into `on_tick`, gated correctly, and turning the resulting traces into auditable, visualizable events.

## Where it fires

`BrainHandler.on_tick` (`brain/src/noesis_brain/rpc/handler.py:373`) is the autonomous-action opportunity; line ~735 already carries the placeholder *"Could generate autonomous action based on goals."* That is the hook. Tool/task runs launch as **background asyncio tasks** (the AAU learner already uses `asyncio.create_task` this way) so the tick stays non-blocking; their resulting actions are posted on a later tick or via the events batch path.

## Capability gate (hard)

Tool use requires `LLMAdapter.generate_with_tools`. Only `ClaudeAdapter` implements it; Ollama/openai-compat inherit the base `raise`. So:

- Detect tool capability once at construction (a `supports_tools: bool` derived from the active adapter/router tier, NOT a try/except per tick).
- **Ollama-only Nous keep the existing non-tool paths** (background AAU learner, prose skills) unchanged. No weak fallback — a non-tool adapter simply never enters the tool-loop branch.
- `run_code` adds a second gate: `docker_available()` (Phase 73). No Docker ⇒ the `run_code` tool isn't registered, so task BUILD/QA degrade to plan-only or are skipped (see open decision D3).

## Two activation paths

### A. Research activation (web_search / web_fetch)
- **Trigger:** reuse the existing **Ananke curiosity gate** (`AAUConfig.min_curiosity_level`) that already guards the background learner. When curiosity crosses the threshold *and* the adapter is tool-capable, run an **interactive** `ToolRunner` research loop instead of (or alongside) the one-shot background `AAULearner.run_cycle`.
- **Output:** synthesized facts written to the episteme wiki (as today) + a tool trace.

### B. Task activation (plan→build→QA via run_code)
- **Trigger (open decision D1):** a task source. Candidates: (i) a claimed **cowork-board** task (peer/economic work — ties into the new economic goal); (ii) a Nous's own **goal** in `telos` reaching a "do something" threshold. Recommend starting with the cowork board (explicit, bounded, already audited) before self-generated tasks.
- **Output:** an `ActivityReport` (Phase 74).

## Cadence / cost control

LLM tool loops are expensive. Gate every entry by: (1) the drive/trigger threshold above, (2) a **cooldown** (min ticks between runs), (3) a **per-window cap** (max runs per N ticks). Values are config, defaulted conservatively. This prevents a Nous from burning the loop every tick.

## Output → audit → visualization pipeline

1. **Brain — trace → actions (pure, testable):** a converter turns a `ToolRunner` trace / `ActivityReport` into `BrainAction`s of a new `ActionType.TOOL_USED` (and a code specialization). Metadata is **digests only**:
   - `tool.invoked` ← per tool call: `{tool_name, output_sha256, is_error}` (3 keys; Grid injects `did` + `tick`).
   - `tool.code_run` ← per `run_code`: `{output_sha256, exit_status, timed_out}` (3 keys).
   - Keys deliberately **dodge `FORBIDDEN_KEY_PATTERN`** — `output_sha256`, never `output`/`stdout`/`content`/`text`/`body`.
2. **Grid — sole producer:** `NousRunner.executeActions` gains a `case 'tool_used':` that calls a new `appendToolInvoked` / `appendToolCodeRun` emitter (mirrors `appendSkillTaught`). Audit events are emitted **only** there (grep-boundary test like `skill-producer-boundary.test.ts`). **Do NOT call `audit.append` from route handlers** (R-31-01).
3. **Allowlist:** add `tool.invoked` + `tool.code_run` (+ `tool.result` only if a distinct non-code result event proves necessary). Allowlist 105 → 107/108; bump the `.toBe(N)` count test. Per the frozen-allowlist rule, this is an explicit per-phase addition.
4. **Dashboard — live viz:** a component subscribes to the firehose for `tool.*` and renders the `ActivityReport` shape (phase ticks + pass/fail + digests) as a Nous works. This is the §3/§5 "Reporting with Visualization to Grid." (Frontend slice; can land after the audit mirror.)

## Invariants preserved

- **R-31-01 zero-diff:** tool events are new audit producers — emission must be deterministic (digest of deterministic content); no wall-clock/random in the payload. New `tool.*` audit prefixes require the explicit allowlist addition (already noted).
- **Sole-producer boundary:** one emitter file per event; grep test added.
- **Privacy walker:** raw tool/code output never crosses the boundary — digests only (mirrors Whisper).
- **Money axiom:** registry already rejects economic-mutation tool *names*; the sandbox has no key path.

## Suggested implementation order (once a live env exists)

1. Capability gate + **research activation** (path A) — smallest, reuses AAU gate.
2. **Audit mirror** — `ActionType.TOOL_USED`, brain converter, grid emitters, allowlist, boundary test. (Now there is a live producer, so it is not dead vocabulary.)
3. **Task activation** (path B) via the cowork board.
4. **Dashboard live visualization** of the `ActivityReport`.

## Open decisions for the user

- **D1 — Task trigger:** cowork-board tasks first (recommended) vs. self-generated from `telos` goals.
- **D2 — Research loop vs background learner:** replace `AAULearner.run_cycle` with the interactive `ToolRunner` loop, or run both (interactive when tool-capable, background otherwise)?
- **D3 — No-Docker task behavior:** if `run_code` is unavailable, should a task run plan-only, or not start at all?
- **D4 — Cadence defaults:** cooldown ticks + per-window cap values.

## Verification strategy

- **Wiring (here-verifiable):** fixture-driven tests for the trace→actions converter (brain) and the `tool_used` → audit emit (grid mock-Pool) + the boundary/allowlist-count tests.
- **End-to-end (needs live env):** a tool-capable Nous on a Docker host actually runs research + a task and the Grid shows the audit + report. Cannot be run in the current environment (no live LLM, no Docker).
