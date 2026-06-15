"""Research tools — web_search + web_fetch, wrapping the existing aau/ layer.

These reuse aau's rate limiter, SSRF guard, robots.txt check, credential block,
and content-type allowlist — never reimplemented here. They turn the AAU
background-learning machinery into tools the model can call mid-reasoning.
"""
from __future__ import annotations

from dataclasses import dataclass

from noesis_brain.aau.config import AAUConfig
from noesis_brain.aau.discovery import discover_urls
from noesis_brain.aau.fetcher import AAUFetcher
from noesis_brain.aau.types import SourceKind
from noesis_brain.llm.types import ToolSpec
from noesis_brain.tools.registry import ToolHandler

# Keep fetched pages bounded so the tool loop's context stays manageable.
_FETCH_CHAR_CAP = 8000


@dataclass(frozen=True)
class ResearchTool:
    spec: ToolSpec
    handler: ToolHandler


def build_research_tools(config: AAUConfig, fetcher: object | None = None) -> list[ResearchTool]:
    """Build the web_search + web_fetch tool bundles bound to one AAUConfig."""
    fetch_client = fetcher if fetcher is not None else AAUFetcher(config)

    async def web_search(tool_input: dict) -> str:
        query = str(tool_input.get("query", "")).strip()
        if not query:
            return "(empty query)"
        pairs = await discover_urls(query, config)
        if not pairs:
            return f"(no results for {query!r})"
        return "\n".join(f"- {url} [{kind.value}]" for url, kind in pairs)

    async def web_fetch(tool_input: dict) -> str:
        url = str(tool_input.get("url", "")).strip()
        if not url:
            return "(empty url)"
        result = await fetch_client.fetch(url, SourceKind.WEB)
        if result is None:
            return "(no content retrieved — blocked, unreachable, or disallowed)"
        return result.truncated_content(_FETCH_CHAR_CAP)

    return [
        ResearchTool(
            spec=ToolSpec(
                name="web_search",
                description=(
                    "Search the live web for current information. Returns a list of "
                    "candidate URLs with their source kind. Follow up with web_fetch."
                ),
                input_schema={
                    "type": "object",
                    "properties": {"query": {"type": "string", "description": "Search query."}},
                    "required": ["query"],
                },
            ),
            handler=web_search,
        ),
        ResearchTool(
            spec=ToolSpec(
                name="web_fetch",
                description=(
                    "Fetch and extract readable text from one URL (SSRF/robots/credential "
                    "guarded). Output is truncated for context budget."
                ),
                input_schema={
                    "type": "object",
                    "properties": {"url": {"type": "string", "description": "URL to fetch."}},
                    "required": ["url"],
                },
            ),
            handler=web_fetch,
        ),
    ]
