# Phase 73 — Code Sandbox ("Nous Can Program Locally") — Scope

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A `run_code` tool a Nous can call (through the Phase 72 ToolRunner) to **write, run, and test Python locally** under strict isolation — closing spec §5 "Nous Can Program Locally" and unblocking the Phase 74 task pipeline + reporting.

**Architecture:** A new `brain/src/noesis_brain/sandbox/` package: `SandboxConfig` (limits + policy), an isolated executor, and `build_code_tool(config)` returning a `(ToolSpec, handler)` bundle that registers into the existing `ToolRegistry` exactly like `research.py`. Raw program output never crosses the Grid audit boundary — only an `output_sha256` digest (same discipline as web tools + Whisper).

**Tech Stack:** Python 3.12; isolation mechanism = **the open decision below**; pytest.

---

## Why this is gated on a decision

The sandbox runs **code the Nous itself wrote** — potentially buggy or, in an adversarial society, hostile. Isolation strength is therefore a security property, not an implementation detail. The three viable mechanisms trade isolation strength against operator dependencies:

| Option | Isolation | Operator dep | Notes |
|---|---|---|---|
| **A. Subprocess + `resource` rlimits** | Weak–medium | None (pure stdlib) | CPU/mem/file-size/time limits + temp cwd. **Network hard to block on macOS** (no namespaces); shares the kernel + filesystem. Portable, zero-dep. |
| **B. Docker container** (`--network none`, `--memory`, `--cpus`, `--read-only` + tmpfs) | Strong | Docker daemon must be present | Real isolation incl. no-network. Brain runs locally on operator hardware (Ollama default) — Docker may not be installed. |
| **C. WASM** (wasmtime + Python-in-wasm / Pyodide) | Strong | New runtime dep | Sandboxed without Docker, but limited stdlib and heavier integration. |

**DECISION (LOCKED 2026-06-15):** **B — Docker, no weak fallback.** If Docker is absent the `run_code` tool is not registered (capability off). No subprocess fallback. **Capabilities:** compute-only + scoped ephemeral temp FS; **network OFF**; no operator-home/keys access.

> **Verification caveat (this machine has no Docker, 2026-06-15):** the container-execution path cannot be run here. Tests are split — pure-logic tests (config defaults, docker argv assembly, output digest, the Docker-absent gate returning `None`) run everywhere; real-container tests are `@pytest.mark.skipif(no docker)` and must be run on a Docker host to confirm the isolation behaves (kills infinite loops, blocks network, caps memory/output).

**Invariant regardless of mechanism:**
- **Network OFF** by default. The Nous already has guarded `web_search`/`web_fetch` for web access; sandboxed code does not get raw network.
- **Filesystem:** a scoped, ephemeral temp dir as cwd; no access to the operator home / brain data / keys.
- **Limits:** wall-time, CPU-time, memory, and output-size caps — exhaustion kills the run cleanly.
- **Money axiom:** the sandbox cannot import/reach wallet/key material; `run_code` registers under the same registry that already rejects economic-mutation tool *names*, and the executor has no filesystem path to key stores.
- **Audit:** `tool.code_run` (Phase 72b vocabulary) carries `output_sha256` + `exit_status` only — never `output`/`stdout`/`content`/`text`.
- **Fixture mode:** the tool loop around it stays fixture-driven in CI; sandbox unit tests run real code in the chosen isolation but **never** the network.

---

## Plan (assumes the isolation decision is settled)

### Task 1: `SandboxConfig` + `SandboxResult` types
- `brain/.../sandbox/types.py`: `SandboxConfig(wall_timeout_s, cpu_timeout_s, memory_mb, max_output_bytes, network=False, mechanism)`; `SandboxResult(stdout, stderr, exit_code, timed_out, output_sha256)`.
- Tests: defaults are safe (network off, bounded); `output_sha256` computed from stdout.

### Task 2: the executor (per chosen mechanism)
- `brain/.../sandbox/executor.py`: `async def run_python(code: str, config) -> SandboxResult`.
- Enforces limits; captures stdout/stderr bounded to `max_output_bytes`; kills on timeout; returns digest.
- Tests (real execution, no network): a `print()` returns stdout; an infinite loop is killed at the wall limit; an oversized output is truncated; a network attempt fails/blocked; a crash yields non-zero exit without taking down the Brain.

### Task 3: the `run_code` tool bundle
- `brain/.../sandbox/tool.py`: `build_code_tool(config) -> (ToolSpec, handler)` mirroring `research.py`. Handler runs `run_python`, returns stdout (truncated) to the model.
- Availability gate: if the mechanism is unavailable (e.g. no Docker), `build_code_tool` returns `None` and is not registered (logged).
- Tests: registers into `ToolRegistry`; a ToolRunner loop with a scripted adapter drives `run_code` and gets the result back; digest recorded in the trace, raw output not.

### Task 4: audit vocabulary + wiki doc-sync
- Grid: add `tool.code_run` via a sole-producer emitter (folds into Phase 72b's brain→grid producer work) — keys `output_sha256`, `exit_status`, dodging `FORBIDDEN_KEY_PATTERN`; allowlist +1; bump the count test.
- Wiki: extend `wiki/2-concepts/mind/agentic-tools.md` (the "Where this is going" section already names the sandbox) with the execution + isolation model and a Mermaid; `node scripts/check-wiki.mjs` clean.

---

## Verification
- [ ] `cd brain && .venv/bin/pytest test/` green; sandbox tests exercise real isolation, never the network.
- [ ] Infinite-loop / OOM / oversized-output / network-attempt cases all fail *safely* (Brain process survives).
- [ ] No audit payload for `tool.code_run` carries raw output (`output`/`stdout`/`content`/`text`/`body`).
- [ ] `node scripts/check-wiki.mjs` clean.
- [ ] Grep: no sandbox code path can read the operator home, brain data dir, or any key material.

## Out of scope (Phase 74)
- The plan → build → QA *pipeline* that orchestrates `run_code` across a task lifecycle.
- Live reporting/visualization of sandbox output to the Grid.
- Non-Python languages.
