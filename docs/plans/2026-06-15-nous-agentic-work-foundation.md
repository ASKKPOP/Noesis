# Nous Agentic-Work Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the Brain a real tool-use loop so a Nous can call tools mid-reasoning — starting with safe research tools (live web search + web fetch) — turning spec §4 (Research & Connected Resources) from "background-learner only" into "interactive during reasoning," and laying the substrate every later agentic-work item (task pipeline, code sandbox, reporting) depends on.

**Architecture:** The LLM adapter interface gains one new method, `generate_with_tools(messages, tools, options)`, that only cloud-capable adapters implement. A new `noesis_brain/tools/` package holds a `ToolSpec`/`ToolCall` model, a `ToolRegistry`, and a `ToolRunner` that drives the Anthropic tool loop (assistant `tool_use` → execute → `tool_result` → repeat until `stop_reason != "tool_use"`). The first two registered tools wrap the **already-safe** `aau/discovery.py` (rate-limited search) and `aau/fetcher.py` (SSRF + credential-guarded fetch). The runner is wired into the **AAU background learner first** (lowest-risk integration point — it already does discovery/fetch), not the conversational tick. Raw tool output never crosses the Grid audit boundary: audit events carry **hashes/digests only** (mirrors the Whisper plaintext-stays-local pattern).

**Tech Stack:** Python 3.12, `anthropic` AsyncAnthropic SDK (already a dep), existing `httpx`/`ddgs` in `aau/`, pytest. Grid-side: TypeScript audit allowlist additions.

---

## Critical constraints (read before any task)

These are repo invariants that this work touches. Violating one breaks CI or a frozen guarantee.

1. **FixtureBrainAdapter / `NOESIS_FIXTURE_MODE=1`** (D-14-06): network LLM calls are forbidden in rig/test mode (`llm/claude.py:18-22`). The tool loop **must** be exercised by a scripted fixture adapter in tests — never a live Claude call. `FixtureBrainAdapter` must return canned `tool_calls`.
2. **Audit allowlist is frozen** (CLAUDE.md). Every new `tool.*` audit event needs an explicit per-phase allowlist addition. Authoritative count lives in `grid/test/audit/broadcast-allowlist.test.ts` (`.toBe(N)`) — bump it in the same commit.
3. **FORBIDDEN_KEY_PATTERN** (memory: audit-key-privacy-walker): audit payload keys must dodge `body|session_id|text|content`. Tool output is *literally* free text/content — so audit events carry `query_hash`, `result_digest`, `output_sha256`, **never** `output`/`content`/`text`/`body`. Rename the key; never weaken the regex.
4. **Money axiom** (D-MONEY-01): no tool may move ETH, hold keys, or enter wallet credentials. The research tools are read-only web; the registry must reject any tool that mutates economic state in this phase.
5. **Doc-sync gate** (CLAUDE.md + `scripts/check-wiki.mjs`): not done until a `wiki/` page reflects the new capability, in the same commit. Mermaid diagram required on the page.
6. **Surgical**: `generate()` stays untouched. Tool use is an *additive* method so non-tool paths are unaffected.

**Phase:** **Phase 72** of new milestone **v3.3 Agentic Brain (Nous-as-Builder)** (reconciled 2026-06-15 — next free after Groups Phase 71; Money reserves 62–66). Phase 73 (Code Sandbox) and Phase 74 (Task Pipeline + Reporting) are the reserved follow-ons. See `.planning/ROADMAP.md` → "v3.3 Agentic Brain". Plan 5's `.planning` edits should mark Phase 72 in progress on execution.

---

## Plan 1: Tool-use types + adapter interface

**Files:**
- Modify: `brain/src/noesis_brain/llm/types.py`
- Modify: `brain/src/noesis_brain/llm/base.py`
- Test: `brain/test/llm/test_tool_types.py` (Create)

**Step 1 — Write the failing test**

```python
# brain/test/llm/test_tool_types.py
from noesis_brain.llm.types import ToolSpec, ToolCall, LLMResponse

def test_toolspec_to_anthropic_schema():
    spec = ToolSpec(
        name="web_search",
        description="Search the live web.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    )
    d = spec.to_anthropic()
    assert d["name"] == "web_search"
    assert d["input_schema"]["required"] == ["query"]

def test_llmresponse_carries_tool_calls_and_stop_reason():
    r = LLMResponse(
        text="", model="m", provider="claude",
        tool_calls=[ToolCall(id="t1", name="web_search", input={"query": "x"})],
        stop_reason="tool_use",
    )
    assert r.stop_reason == "tool_use"
    assert r.tool_calls[0].name == "web_search"
```

**Step 2 — Run, verify it fails**

Run: `cd brain && .venv/bin/pytest test/llm/test_tool_types.py -v`
Expected: FAIL — `ImportError: cannot import name 'ToolSpec'`.

**Step 3 — Implement**

Add to `llm/types.py`:

```python
@dataclass(frozen=True)
class ToolSpec:
    """A tool the model may call. Maps 1:1 to an Anthropic tool definition."""

    name: str
    description: str
    input_schema: dict[str, Any]

    def to_anthropic(self) -> dict[str, Any]:
        return {"name": self.name, "description": self.description, "input_schema": self.input_schema}


@dataclass(frozen=True)
class ToolCall:
    """A model-requested tool invocation (Anthropic `tool_use` block)."""

    id: str
    name: str
    input: dict[str, Any]
```

Extend `LLMResponse` with two fields (keep defaults so existing call sites are unaffected):

```python
    tool_calls: list["ToolCall"] = field(default_factory=list)
    stop_reason: str | None = None
```

Add an abstract method to `base.py` `LLMAdapter` — **with a default `NotImplementedError` body so existing adapters don't break until updated** (make it a regular method, not `@abstractmethod`, to keep it additive):

```python
    async def generate_with_tools(
        self,
        messages: list[dict],
        tools: list["ToolSpec"],
        options: "GenerateOptions | None" = None,
    ) -> "LLMResponse":
        """Multi-turn generation that may emit tool_use blocks.

        `messages` is an Anthropic-style message list. Default: unsupported.
        """
        raise LLMError(self.provider_name, "tool use not supported by this adapter")
```

**Step 4 — Run, verify pass**

Run: `cd brain && .venv/bin/pytest test/llm/test_tool_types.py -v`
Expected: PASS.

**Step 5 — Commit**

```bash
git add brain/src/noesis_brain/llm/types.py brain/src/noesis_brain/llm/base.py brain/test/llm/test_tool_types.py
git commit -m "feat(brain): tool-use types + additive generate_with_tools interface"
```

---

## Plan 2: ClaudeAdapter + FixtureBrainAdapter tool support

**Files:**
- Modify: `brain/src/noesis_brain/llm/claude.py`
- Modify: `brain/src/noesis_brain/llm/fixture.py`
- Test: `brain/test/llm/test_claude_tools.py` (Create), `brain/test/llm/test_fixture_tools.py` (Create)

**Step 1 — Write the failing fixture test** (fixture first — it's the one tests actually run, no network)

```python
# brain/test/llm/test_fixture_tools.py
from noesis_brain.llm.fixture import FixtureBrainAdapter
from noesis_brain.llm.types import ToolSpec, GenerateOptions

async def test_fixture_emits_scripted_tool_call_then_final(monkeypatch):
    adapter = FixtureBrainAdapter(scripted_tool_calls=[
        [("web_search", {"query": "noesis"})],  # round 1: one tool call
        [],                                       # round 2: no calls → final text
    ], final_text="done")
    tools = [ToolSpec("web_search", "search", {"type": "object", "properties": {}})]
    r1 = await adapter.generate_with_tools([{"role": "user", "content": "hi"}], tools, GenerateOptions())
    assert r1.stop_reason == "tool_use" and r1.tool_calls[0].name == "web_search"
    r2 = await adapter.generate_with_tools([{"role": "user", "content": "hi"}], tools, GenerateOptions())
    assert r2.stop_reason == "end_turn" and r2.text == "done"
```

**Step 2 — Run, verify fail.** Run: `cd brain && .venv/bin/pytest test/llm/test_fixture_tools.py -v` → FAIL.

**Step 3 — Implement `FixtureBrainAdapter.generate_with_tools`** — pop one scripted round per call; empty round → `stop_reason="end_turn"` + `final_text`. Generate deterministic `ToolCall.id` from a per-instance counter (no `random`/`time` — fixture must stay reproducible for rigs).

**Step 4 — Implement `ClaudeAdapter.generate_with_tools`** — pass `tools=[t.to_anthropic() for t in tools]` and the `messages` list to `client.messages.create`, then map `response.content` blocks: `text` blocks → `text`, `tool_use` blocks → `ToolCall(id, name, input)`; set `stop_reason=response.stop_reason`. Reuse the existing `_FIXTURE_MODE_VAR` guard (already in `__init__`) so a live call in fixture mode still raises.

Claude test (network-gated — skip unless `ANTHROPIC_API_KEY` present, mirror existing claude test pattern):

```python
# brain/test/llm/test_claude_tools.py
import os, pytest
pytestmark = pytest.mark.skipif(not os.environ.get("ANTHROPIC_API_KEY"), reason="no key")
# ... asserts a real round-trip returns a tool_use or end_turn stop_reason
```

**Step 5 — Run both, verify pass.** `cd brain && .venv/bin/pytest test/llm/ -v`

**Step 6 — Commit**

```bash
git add brain/src/noesis_brain/llm/claude.py brain/src/noesis_brain/llm/fixture.py brain/test/llm/test_claude_tools.py brain/test/llm/test_fixture_tools.py
git commit -m "feat(brain): Claude + Fixture adapters implement generate_with_tools"
```

---

## Plan 3: ToolRegistry + ToolRunner loop

**Files:**
- Create: `brain/src/noesis_brain/tools/__init__.py`, `registry.py`, `runner.py`
- Test: `brain/test/tools/test_runner.py` (Create)

**Step 1 — Write the failing test** (drives the whole loop with the fixture adapter — no network, no real tools)

```python
# brain/test/tools/test_runner.py
from noesis_brain.llm.fixture import FixtureBrainAdapter
from noesis_brain.llm.types import ToolSpec
from noesis_brain.tools.registry import ToolRegistry
from noesis_brain.tools.runner import ToolRunner

async def test_runner_executes_tool_then_returns_final():
    calls = []
    reg = ToolRegistry()
    reg.register(
        ToolSpec("echo", "echo", {"type": "object", "properties": {"q": {"type": "string"}}}),
        lambda inp: calls.append(inp) or f"echoed:{inp['q']}",
    )
    adapter = FixtureBrainAdapter(
        scripted_tool_calls=[[("echo", {"q": "hi"})], []],
        final_text="all done",
    )
    runner = ToolRunner(adapter, reg, max_iterations=5)
    result = await runner.run(system="s", user="please echo")
    assert calls == [{"q": "hi"}]            # tool actually executed
    assert result.final_text == "all done"
    assert result.trace[0].tool_name == "echo"   # trace records the call
    assert result.trace[0].output_sha256          # digest present, raw output NOT required in trace
```

**Step 2 — Run, verify fail.** `cd brain && .venv/bin/pytest test/tools/test_runner.py -v` → FAIL (module missing).

**Step 3 — Implement.**

`registry.py`: `ToolRegistry` mapping `name → (ToolSpec, handler)`. `register(spec, handler)`; `specs() -> list[ToolSpec]`; `execute(name, input) -> str`. **Guard:** `register` rejects a duplicate name and rejects any handler whose spec name matches an economic-mutation denylist (`trade|transfer|wallet|treasury|account`) — enforces the money-axiom read-only constraint for this phase.

`runner.py`: `ToolRunner(adapter, registry, max_iterations=8)`. `run(system, user)`:
1. `messages = [{"role": "user", "content": user}]`.
2. Loop up to `max_iterations`: call `adapter.generate_with_tools(messages, registry.specs(), opts)`.
3. If `stop_reason != "tool_use"` → return `RunResult(final_text=resp.text, trace=trace)`.
4. Append the assistant turn; for each `ToolCall`, run `registry.execute` (wrap exceptions → error string), append a `tool_result` user turn, and record a `ToolTrace(tool_name, input, output_sha256=sha256(output))` — **store the digest, keep raw output only in the in-memory result for the Brain, never in the trace that may be audited.**
5. On `max_iterations` exhaustion → return with `final_text=""` and `truncated=True`.

Use `hashlib.sha256` for the digest. No `random`/`time`.

**Step 4 — Run, verify pass.** `cd brain && .venv/bin/pytest test/tools/ -v`

**Step 5 — Commit**

```bash
git add brain/src/noesis_brain/tools/ brain/test/tools/
git commit -m "feat(brain): ToolRegistry + ToolRunner agentic loop (digest-only trace)"
```

---

## Plan 4: Research tools (web_search, web_fetch) wrapping aau/

**Files:**
- Create: `brain/src/noesis_brain/tools/research.py`
- Test: `brain/test/tools/test_research_tools.py` (Create)

**Step 1 — Write the failing test** (mock the aau layer — no real network)

```python
# brain/test/tools/test_research_tools.py
from noesis_brain.tools.research import build_research_tools

async def test_web_search_tool_wraps_discovery(monkeypatch):
    async def fake_discover(query, **kw):
        return [("https://example.com/a", "web"), ("https://example.com/b", "web")]
    monkeypatch.setattr("noesis_brain.tools.research.discover_urls", fake_discover)
    specs = build_research_tools()
    web_search = next(s for s in specs if s.spec.name == "web_search")
    out = await web_search.handler({"query": "noesis grid"})
    assert "example.com/a" in out
```

**Step 2 — Run, verify fail.** → FAIL (module missing).

**Step 3 — Implement** `build_research_tools()` returning two `(ToolSpec, handler)` bundles:
- `web_search(query)` → calls existing `aau.discovery.discover_urls`, returns a compact URL+kind list (respects the existing rate limiter — do **not** add a second limiter).
- `web_fetch(url)` → calls existing `aau.fetcher` (keeps SSRF guard, robots.txt, credential-block, content-type allowlist — reuse, never reimplement). Returns extracted text truncated to a sane cap (e.g. 8 KB) so the loop context stays bounded.

Handlers are `async`; update `ToolRegistry.execute` to `await` async handlers (sync handlers still allowed via `inspect.iscoroutinefunction`).

**Step 4 — Run, verify pass.** `cd brain && .venv/bin/pytest test/tools/ -v`

**Step 5 — Commit**

```bash
git add brain/src/noesis_brain/tools/research.py brain/test/tools/test_research_tools.py
git commit -m "feat(brain): web_search + web_fetch tools reusing aau safety guards"
```

---

## Plan 5: Wire into the AAU learner + audit + wiki doc-sync

**Files:**
- Modify: AAU learner entrypoint (the background research task — confirm exact file: `brain/src/noesis_brain/aau/` learner) to optionally drive research through `ToolRunner` when a cloud tool-capable adapter is configured (fall back to existing discovery path otherwise — Ollama has no tool use).
- Modify: `grid/src/audit/broadcast-allowlist.ts` — add `tool.invoked`, `tool.result` (payload keys: `tool_name`, `query_hash`, `output_sha256`, `iterations` — **no** `output`/`content`/`text`/`body`).
- Modify: `grid/test/audit/broadcast-allowlist.test.ts` — bump `.toBe(N)` count.
- Create: `wiki/2-concepts/the-mind/agentic-tools.md` (or correct concepts path) — capability page **with a Mermaid sequence diagram** of the tool loop (Brain → LLM → tool → digest → audit).
- Modify: `wiki/.pages` nav + `.planning/ROADMAP.md` (open the milestone block) + `.planning/STATE.md` (focus).

**Step 1 — Audit allowlist test first**

Add a test asserting `tool.invoked`/`tool.result` are allowlisted and that an event built with a forbidden key (`output`) is rejected by the privacy walker. Run the existing `broadcast-allowlist` + privacy-walker suites: `cd grid && npm test -- broadcast-allowlist`.

**Step 2 — Make it pass:** add the two events, bump the count, name keys to dodge `FORBIDDEN_KEY_PATTERN`.

**Step 3 — Wire the learner**, guarded so non-tool adapters keep the old path (surgical, no behavior change for Ollama-only operators).

**Step 4 — Full suites green:**
- `cd brain && .venv/bin/pytest test/` (singular `test/`)
- `cd grid && npm test`
- `node scripts/check-wiki.mjs` (doc-sync gate)

**Step 5 — Commit**

```bash
git add grid/src/audit/broadcast-allowlist.ts grid/test/audit/broadcast-allowlist.test.ts \
        brain/src/noesis_brain/aau/ wiki/ .planning/ROADMAP.md .planning/STATE.md
git commit -m "feat: wire tool loop into AAU learner + tool.* audit events + wiki capability page"
```

---

## Verification (whole phase)

- [ ] `cd brain && .venv/bin/pytest test/` green (fixture-driven tool loop, no network in CI).
- [ ] `cd grid && npm test` green; allowlist count test updated.
- [ ] `node scripts/check-wiki.mjs` passes (wiki page + Mermaid present).
- [ ] Grep confirms no audit payload carries `output`/`content`/`text`/`body` for `tool.*` events.
- [ ] `generate()` call sites unchanged (surgical check: `git diff` shows only additive changes to adapters).
- [ ] Manual smoke (operator machine, real key, **not CI**): a Nous research tick performs a live `web_search`→`web_fetch`→synthesis loop and writes a wiki fact.

---

## Deliberately OUT of scope (next foundation phase)

**Code sandbox / "Nous Can Program Locally" (§5)** is *not* in this plan. It needs its own design discussion before any code: process/container isolation model, resource limits, filesystem jail, reuse of the `aau` SSRF/credential guards, and a `tool.code_run` audit event carrying **only** an `output_sha256` (raw program output is exactly the free-text the privacy walker forbids). It rides on this phase's `ToolRunner` but is a separate, higher-risk phase. Likewise the **Task Plan→Build→QA pipeline** and **Reporting/Visualization** (§3) build *on top of* the sandbox and are sequenced after it.

The dependency chain this plan establishes:

```
tool-use loop (THIS PHASE)
   ├── live web research §4 ........... delivered here
   └── code sandbox §5 (next) ......... unblocks:
          ├── Task Plan→Build→QA §3
          └── Reporting + Visualization §3/§5
```
