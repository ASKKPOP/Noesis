"""RED tests for FixtureBrainAdapter (Wave 1 creates the implementation)."""
import asyncio
import json
import os
import tempfile
import pytest

pytestmark = pytest.mark.asyncio

FIXTURE_LINES = [
    {"key": "action_selection", "response_text": "MOVE agora", "tokens": 12, "tier": "PRIMARY"},
    {"key": "reflection", "response_text": "I considered.", "tokens": 18, "tier": "LARGE"},
]


def _write_fixture(lines):
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False)
    for line in lines:
        f.write(json.dumps(line) + "\n")
    f.close()
    return f.name


def test_fixture_module_exists():
    """Wave 1 must create brain/src/noesis_brain/llm/fixture.py with FixtureBrainAdapter."""
    try:
        from noesis_brain.llm.fixture import FixtureBrainAdapter  # noqa: F401
    except ImportError:
        pytest.fail("Wave 1 must create brain/src/noesis_brain/llm/fixture.py with FixtureBrainAdapter")


async def test_serves_record_by_key():
    from noesis_brain.llm.fixture import FixtureBrainAdapter
    from noesis_brain.llm.types import GenerateOptions
    path = _write_fixture(FIXTURE_LINES)
    adapter = FixtureBrainAdapter(fixture_path=path)
    opts = GenerateOptions(purpose="action_selection")
    resp = await adapter.generate(prompt="anything", options=opts)
    assert resp.text == "MOVE agora"
    assert resp.provider == "fixture"


async def test_cache_miss_strict_default_raises_with_frozen_message():
    """D-14-05: error message is verbatim-locked."""
    from noesis_brain.llm.fixture import FixtureBrainAdapter
    from noesis_brain.llm.types import GenerateOptions
    path = _write_fixture(FIXTURE_LINES)
    adapter = FixtureBrainAdapter(fixture_path=path)  # permissive defaults to False
    opts = GenerateOptions(purpose="unknown_key")
    with pytest.raises(RuntimeError) as exc:
        await adapter.generate(prompt="x", options=opts)
    assert str(exc.value) == (
        '[FIXTURE ERROR] No fixture record for key "unknown_key". '
        'Run with --permissive to use stub.'
    )


async def test_cache_miss_permissive_returns_stub():
    from noesis_brain.llm.fixture import FixtureBrainAdapter
    from noesis_brain.llm.types import GenerateOptions
    path = _write_fixture(FIXTURE_LINES)
    adapter = FixtureBrainAdapter(fixture_path=path, permissive=True)
    opts = GenerateOptions(purpose="unknown_key")
    resp = await adapter.generate(prompt="x", options=opts)
    assert resp.text == "[UNMATCHED FIXTURE]"
    assert resp.usage.get("completion_tokens", 0) == 0


async def test_provider_name_is_fixture():
    from noesis_brain.llm.fixture import FixtureBrainAdapter
    path = _write_fixture(FIXTURE_LINES)
    adapter = FixtureBrainAdapter(fixture_path=path)
    assert adapter.provider_name == "fixture"


async def test_is_available_true_when_records_loaded():
    from noesis_brain.llm.fixture import FixtureBrainAdapter
    path = _write_fixture(FIXTURE_LINES)
    adapter = FixtureBrainAdapter(fixture_path=path)
    assert await adapter.is_available() is True
