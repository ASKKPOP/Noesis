"""D-MIND-07 — prose calls keep reasoning ON with headroom.

Structured per-tick decisions run think-off + json_mode (fast, constrained).
The two PROSE calls — the Agora conversational reply and reflection — instead
keep think=True with a larger budget, so qwen3 puts a clean line in `content`
(reasoning hidden in `thinking`) rather than the task-narrating preamble that
think-off produces. These regressions lock those call-site options.
"""
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.reflection import ReflectionEngine
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


class CapturingLLM:
    """Records the GenerateOptions of the last call; returns fixed prose."""
    def __init__(self):
        self.last_options = None
        self.supports_tools = False
    async def generate(self, prompt, options=None):
        self.last_options = options
        return LLMResponse(text="A calm, in-character line.", model="cap", provider="test", usage={})


@pytest.mark.asyncio
async def test_conversation_reply_keeps_thinking_on_with_headroom():
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    llm = CapturingLLM()
    h = BrainHandler(
        psyche=load_psyche(data=data), thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})), llm=llm, did="did:noesis:sophia",
    )
    await h.on_message({
        "sender_name": "Hermes", "sender_did": "did:noesis:hermes",
        "channel": "agora", "text": "What are you working on?", "tick": 5,
    })
    assert llm.last_options is not None
    assert llm.last_options.think is True          # reasoning hidden, clean spoken words
    assert llm.last_options.json_mode is False     # prose, not JSON
    assert llm.last_options.max_tokens >= 1024     # room for reasoning + the line


@pytest.mark.asyncio
async def test_reflection_keeps_thinking_on_with_headroom():
    llm = CapturingLLM()
    stream = MagicMock()
    # >=3 memories so reflect() proceeds past its early-out
    from types import SimpleNamespace
    mems = [SimpleNamespace(content=f"mem {i}") for i in range(4)]
    stream.recent = MagicMock(return_value=mems)
    stream.format_for_prompt = MagicMock(return_value="- mem 0\n- mem 1\n- mem 2\n- mem 3")
    stream.add_reflection = MagicMock(return_value=SimpleNamespace(content="x"))

    engine = ReflectionEngine(stream, llm)
    await engine.reflect(tick=100)

    assert llm.last_options.think is True
    assert llm.last_options.json_mode is False
    assert llm.last_options.max_tokens >= 1024
    assert llm.last_options.purpose == "reflection"
