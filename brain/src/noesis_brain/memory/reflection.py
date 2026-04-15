"""Reflection system — generates higher-level insights from memories.

Periodically reviews recent memories and uses the LLM to produce
reflections: patterns noticed, relationship changes, goal adjustments.
"""

from __future__ import annotations

from typing import Any

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.memory.types import MemoryType


REFLECTION_PROMPT = """Review these recent experiences and generate a brief reflection.

Recent memories:
{memories}

Tasks:
1. What patterns do you notice?
2. What did you learn?
3. How have your relationships changed?

Write a concise reflection (2-4 sentences) capturing the most important insight.
Also suggest one wiki page title that should be created or updated, in the format:
WIKI_UPDATE: <page title>"""


class ReflectionEngine:
    """Generates periodic reflections from accumulated memories.

    Should be called every N cycles (default: 20) or after significant events.
    """

    def __init__(
        self,
        stream: MemoryStream,
        llm: LLMAdapter,
        reflection_interval: int = 20,
    ) -> None:
        self._stream = stream
        self._llm = llm
        self._interval = reflection_interval
        self._cycles_since_reflection = 0

    def should_reflect(self) -> bool:
        """Check if it's time for a reflection cycle."""
        return self._cycles_since_reflection >= self._interval

    def tick(self) -> None:
        """Increment cycle counter."""
        self._cycles_since_reflection += 1

    async def reflect(self, tick: int = 0) -> dict[str, Any]:
        """Generate a reflection from recent memories.

        Returns dict with:
            - reflection: str (the insight text)
            - wiki_suggestion: str | None (suggested wiki page to update)
            - memory: Memory (the stored reflection memory)
        """
        recent = self._stream.recent(limit=20)
        if len(recent) < 3:
            return {"reflection": None, "wiki_suggestion": None, "memory": None}

        formatted = self._stream.format_for_prompt(recent)
        prompt = REFLECTION_PROMPT.format(memories=formatted)

        try:
            response = await self._llm.generate(
                prompt,
                GenerateOptions(
                    temperature=0.8,
                    max_tokens=300,
                    purpose="reflection",
                ),
            )
            text = response.text.strip()
        except LLMError:
            return {"reflection": None, "wiki_suggestion": None, "memory": None}

        # Parse wiki suggestion
        wiki_suggestion = None
        reflection_text = text
        if "WIKI_UPDATE:" in text:
            parts = text.split("WIKI_UPDATE:", 1)
            reflection_text = parts[0].strip()
            wiki_suggestion = parts[1].strip()

        # Store the reflection as a memory
        memory = self._stream.add_reflection(
            content=reflection_text,
            importance=8.0,
            tick=tick,
        )

        self._cycles_since_reflection = 0

        return {
            "reflection": reflection_text,
            "wiki_suggestion": wiki_suggestion,
            "memory": memory,
        }
