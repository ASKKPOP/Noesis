"""T-16-02: Sleep trigger uses asyncio.create_task — never bare await in on_tick."""
from __future__ import annotations
import inspect
import pytest


def test_run_sleep_is_coroutine():
    """HypnosRuntime.run_sleep must be a coroutine function (async def). T-16-02."""
    pytest.importorskip("noesis_brain.hypnos.runtime")
    from noesis_brain.hypnos.runtime import HypnosRuntime
    assert inspect.iscoroutinefunction(HypnosRuntime.run_sleep), (
        "run_sleep must be async def — it is called via asyncio.create_task in on_tick"
    )


def test_handler_source_does_not_await_run_sleep_directly_in_on_tick():
    """handler.py on_tick must NOT directly await run_sleep — only create_task. T-16-02.

    The accepted pattern is:
        async def _run(): result = await rt.run_sleep(...)
        asyncio.create_task(_run())

    A violation would be:
        result = await self._hypnos_runtime.run_sleep(...)  # bare await in on_tick body
    """
    import pathlib
    import re
    handler_path = (
        pathlib.Path(__file__).parent.parent.parent
        / "src" / "noesis_brain" / "rpc" / "handler.py"
    )
    source = handler_path.read_text()

    # Extract the on_tick method body (everything between "async def on_tick" and the
    # next top-level method "async def on_message" or end-of-class).
    on_tick_match = re.search(r"async def on_tick\(.*?(?=\n    async def |\nclass |\Z)", source, re.DOTALL)
    assert on_tick_match is not None, "on_tick method not found in handler.py"
    on_tick_body = on_tick_match.group(0)

    # In the on_tick body, look for direct (non-nested) await run_sleep.
    # The pattern should NOT appear as a direct statement — only inside nested coroutines.
    # A direct await would be at the on_tick indentation level (8 spaces) directly.
    # Nested awaits inside inner async defs (_run, etc.) are allowed.
    bad_pattern = re.compile(r"^        result_hash\s*=\s*await\s+\S*run_sleep", re.MULTILINE)
    direct_awaits = bad_pattern.findall(on_tick_body)
    assert not direct_awaits, (
        f"on_tick body contains a direct 'await run_sleep' at handler scope — "
        f"must be wrapped in asyncio.create_task: {direct_awaits}"
    )


def test_handler_source_contains_create_task_for_sleep():
    """handler.py must contain asyncio.create_task for sleep invocation. T-16-02."""
    import pathlib
    handler_path = (
        pathlib.Path(__file__).parent.parent.parent
        / "src" / "noesis_brain" / "rpc" / "handler.py"
    )
    source = handler_path.read_text()
    assert "create_task" in source, "handler.py must use asyncio.create_task for sleep trigger"
