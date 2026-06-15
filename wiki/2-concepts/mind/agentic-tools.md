---
canonical: true
topic: concept-agentic-tools
status: live
last_verified: 2026-06-15
owners: [henry, claude]
---

# Agentic tools

> **A Nous can reach for tools mid-thought.** Instead of only answering from what it already knows, the mind can pause, call a tool — search the live web, fetch a page — read the result, and keep reasoning. The loop repeats until the mind has what it needs.

This is the foundation of the **Nous-as-builder** direction: the same mechanism that lets a mind search the web today is the one that will later let it run code and carry a task from plan to test.

## 🗺️ At a glance

```mermaid
flowchart TD
  MIND[Mind / LLM] -->|"I need to look this up"| RUNNER[ToolRunner]
  RUNNER -->|asks the model| MIND
  MIND -->|tool_use: web_search| RUNNER
  RUNNER -->|execute locally| REG[ToolRegistry]
  REG --> WS[web_search<br/>aau discovery]
  REG --> WF[web_fetch<br/>aau fetcher · SSRF guard]
  WS -->|result| RUNNER
  WF -->|result| RUNNER
  RUNNER -->|tool_result fed back| MIND
  MIND -->|stop_reason ≠ tool_use| DONE[final answer]
  RUNNER -.->|sha256 digest only| TRACE[(auditable trace)]
```

## The loop

1. The mind is asked a question and given a list of available tools.
2. If it decides it needs one, it emits a **tool call** (e.g. `web_search` with a query) instead of a final answer.
3. The **ToolRunner** executes that tool locally through the **ToolRegistry**, feeds the result back, and asks the mind again.
4. This repeats until the mind stops asking for tools (or a safety limit is reached) — then its final text is the answer.

## The first two tools

Both reuse the existing **autonomous-acquisition (AAU)** safety layer — they do not reimplement any of it:

- **`web_search`** — finds candidate URLs for a query (DuckDuckGo / arXiv / Wikipedia), respecting the existing rate limiter.
- **`web_fetch`** — fetches and extracts readable text from one URL, behind the existing SSRF guard, robots.txt check, credential-leak block, and content-type allowlist. Output is truncated to keep the loop's context bounded.

## What the city sees — and what it never sees

The mind's tool work happens **locally in the Brain**, mirroring the [Brain ↔ Grid principle](nous.md): the engine is local, the city is the window.

Raw tool output — a web page's text, a search result body — is **free content that never crosses the audit boundary**. The runner keeps a trace of each call that records only the tool name, its input, and a **`sha256` digest** of the output. This is the same discipline as [Whisper](../social/whisper.md): the plaintext stays in the Brain; only a tamper-evident fingerprint is shareable. The audit payload keys are chosen to never collide with the forbidden-key pattern (`output_sha256`, never `output`/`content`/`text`).

## Guardrails

- **Money axiom ([D-MONEY-01](../../1-design/economy.md)).** The registry **refuses** to register any tool whose name hints at moving funds (`trade`, `transfer`, `wallet`, `treasury`, `account`). No tool in this layer moves money or touches keys.
- **No network in test/rig mode.** The tool loop is exercised by scripted fixtures; live model calls remain forbidden when fixture mode is set.
- **Bounded.** Every loop has a maximum iteration count; exhaustion ends the run cleanly rather than spinning.

## Programming locally — the `run_code` tool

Beyond research, a Nous can **write and run its own Python** through the same loop. The `run_code` tool hands code to a throwaway, locked-down container and returns its output — so the mind can compute, test, and verify its own work, not just reason about it.

```mermaid
flowchart LR
  MIND[Mind] -->|"run_code(code)"| TOOL[run_code tool]
  TOOL --> BOX["Docker container<br/>--network none · --read-only<br/>memory · cpu · time caps<br/>code mounted read-only"]
  BOX -->|stdout / exit| TOOL
  TOOL -->|truncated output| MIND
  TOOL -.->|output_sha256 only| AUDIT[(audit)]
  NODOCKER{Docker present?} -->|no| OFF[tool not registered]
```

The isolation is the security boundary, because the code is the Nous's *own* — possibly buggy, possibly hostile:

- **Docker, no weak fallback.** If Docker isn't installed, `run_code` is simply **off** (not registered) — never a quiet downgrade to running untrusted code unprotected.
- **No network.** Sandboxed code cannot reach the internet; web access stays via the guarded `web_search`/`web_fetch` tools.
- **Scoped, ephemeral filesystem.** A fresh temp dir mounted read-only; root filesystem read-only; the only writable surface is a small in-memory `/tmp`. No path to the operator's home, the Brain's data, or any keys.
- **Bounded.** Wall-clock, CPU, memory, process-count, and output-size caps — an infinite loop or fork bomb is killed without touching the Brain.
- **Audit-safe.** Only an `output_sha256` digest + exit status may cross the Grid boundary; the program's actual output stays Brain-local.

## Carrying a task: plan → build → QA

The tools and the sandbox let a Nous take on a whole **task**, not just answer a question. A task runs through three phases, each one a tool-loop turn:

```mermaid
flowchart LR
  TASK[Task] --> PLAN[Plan<br/>steps + how to test]
  PLAN --> BUILD[Build<br/>write code · run_code]
  BUILD --> QA[QA<br/>write tests · run_code]
  QA -->|all pass| DONE[Done]
  QA -->|failure| FAILED[Failed]
  PLAN -.-> REPORT[(Activity report<br/>digests only)]
  BUILD -.-> REPORT
  QA -.-> REPORT
```

- **Plan** — the mind lays out the steps and how it will verify them (no code yet).
- **Build** — it writes the code and runs it in the sandbox to confirm it executes.
- **QA** — it writes and runs tests; the phase ends with a clear pass/fail.

The run produces an **activity report**: one entry per phase with a short summary and a `sha256` digest of that phase's output. As with everything in this layer, the report carries **digests, not raw output** — so it can be shown to the operator and (later) the Grid without leaking what the Nous actually ran.

## Where this is going

The **Brain-side** capabilities — the tool loop, the research tools, the `run_code` sandbox, and the plan→build→QA task lifecycle — are in place. What's still ahead, all Grid-side:

- **Public audit mirror** — emitting `tool.invoked` / `tool.result` / `tool.code_run` onto the Grid's audit chain (digest-only) through a dedicated sole-producer, so the city can *see that* a Nous worked without seeing *what*.
- **Live visualization** — rendering the activity report on the Grid as a Nous works, so others watch progress unfold.
