"""Phase 72 — web_search + web_fetch tools wrap the existing aau/ safety layer."""
from __future__ import annotations

from noesis_brain.aau.config import AAUConfig
from noesis_brain.aau.types import SourceKind
from noesis_brain.tools.research import build_research_tools


class _FakeFetchResult:
    def __init__(self, content: str) -> None:
        self._content = content

    def truncated_content(self, max_chars: int = 3000) -> str:
        return self._content[:max_chars]


class _FakeFetcher:
    def __init__(self, result):
        self._result = result
        self.calls: list[str] = []

    async def fetch(self, url, source_kind=SourceKind.WEB):
        self.calls.append(url)
        return self._result


def _by_name(bundles, name):
    return next(b for b in bundles if b.spec.name == name)


async def test_web_search_tool_wraps_discovery(monkeypatch):
    async def fake_discover(query, config):
        return [("https://example.com/a", SourceKind.WEB), ("https://example.com/b", SourceKind.WIKIPEDIA)]

    monkeypatch.setattr("noesis_brain.tools.research.discover_urls", fake_discover)
    bundles = build_research_tools(AAUConfig(), fetcher=_FakeFetcher(None))
    web_search = _by_name(bundles, "web_search")

    out = await web_search.handler({"query": "noesis grid"})
    assert "example.com/a" in out
    assert "example.com/b" in out


async def test_web_fetch_tool_wraps_fetcher():
    fetcher = _FakeFetcher(_FakeFetchResult("Hello from the live web. " * 10))
    bundles = build_research_tools(AAUConfig(), fetcher=fetcher)
    web_fetch = _by_name(bundles, "web_fetch")

    out = await web_fetch.handler({"url": "https://example.com/page"})
    assert "Hello from the live web." in out
    assert fetcher.calls == ["https://example.com/page"]


async def test_web_fetch_handles_no_content():
    bundles = build_research_tools(AAUConfig(), fetcher=_FakeFetcher(None))
    web_fetch = _by_name(bundles, "web_fetch")
    out = await web_fetch.handler({"url": "https://example.com/missing"})
    assert "no content" in out.lower()


async def test_research_tools_register_cleanly():
    from noesis_brain.tools.registry import ToolRegistry

    reg = ToolRegistry()
    for b in build_research_tools(AAUConfig(), fetcher=_FakeFetcher(None)):
        reg.register(b.spec, b.handler)
    assert reg.has("web_search")
    assert reg.has("web_fetch")
