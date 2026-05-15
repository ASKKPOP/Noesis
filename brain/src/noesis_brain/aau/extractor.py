"""AAU Extractor — convert raw HTTP responses to clean text (Phase 15).

Priority chain:
  1. HTML → trafilatura (F1=0.945, best multilingual extractor)
  2. HTML → Jina Reader fallback if trafilatura returns None (JS-rendered pages)
  3. PDF → pypdf (if installed)
  4. JSON → structured field extraction
  5. Plain text → passthrough (truncated)

Credential leak scan runs on all extracted text before it's returned.
LLM is never called inside the extraction pipeline (deterministic only).
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING

from noesis_brain.aau.types import FetchResult, LearnedFact, SourceKind

if TYPE_CHECKING:
    from noesis_brain.aau.config import AAUConfig

logger = logging.getLogger(__name__)


class AAUExtractor:
    """Converts FetchResult → LearnedFact with clean text content."""

    def __init__(self, config: "AAUConfig") -> None:
        self._config = config
        self._cred_patterns = [
            re.compile(p) for p in config.credential_patterns
        ]

    def extract(self, result: FetchResult) -> LearnedFact | None:
        """Extract clean text from a FetchResult.

        Returns None if extraction yields nothing useful or content is too short.
        This is synchronous — all extraction libraries are CPU-bound.
        Call via asyncio.to_thread() if needed in async context.
        """
        text: str | None = None

        if result.is_html:
            text = self._extract_html(result.body)
        elif result.is_pdf:
            text = self._extract_pdf(result.body)
        elif result.is_json:
            text = self._extract_json(result.body)
        else:
            # Plain text or unknown — treat as text
            try:
                text = result.body.decode("utf-8", errors="replace")
            except Exception:
                return None

        if not text or len(text.strip()) < self._config.min_content_chars:
            return None

        # Credential leak scan — block before storage
        if self._contains_credentials(text):
            logger.warning("Extractor: credential pattern detected in %s — skipping", result.url)
            return None

        # Truncate at sentence boundary
        text = self._truncate(text.strip())

        title = self._derive_title(result.url, text)

        return LearnedFact(
            url=result.url,
            title=title,
            content=text,
            source_kind=self._kind_from_url(result.url),
        )

    async def extract_via_jina(self, url: str, config: "AAUConfig") -> LearnedFact | None:
        """Fallback: fetch via Jina Reader and return extracted markdown.

        Use when trafilatura returns None (JS-rendered page).
        Jina Reader runs headless Chrome internally so we get the rendered DOM.
        Free tier: 20 req/min unauthenticated.
        """
        jina_url = config.jina_prefix + url
        try:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.get(
                    jina_url,
                    headers={"User-Agent": config.user_agent},
                )
            if r.status_code != 200:
                return None
            text = r.text.strip()
        except Exception as exc:
            logger.debug("Jina Reader failed for %s: %s", url, exc)
            return None

        if not text or len(text) < self._config.min_content_chars:
            return None
        if self._contains_credentials(text):
            return None

        text = self._truncate(text)
        return LearnedFact(
            url=url,
            title=self._derive_title(url, text),
            content=text,
            source_kind=SourceKind.JINA,
        )

    # ── HTML ─────────────────────────────────────────────────────────────────

    def _extract_html(self, body: bytes) -> str | None:
        try:
            import trafilatura
        except ImportError:
            # Fallback to very basic decode if trafilatura not installed
            try:
                return body.decode("utf-8", errors="replace")[:3000]
            except Exception:
                return None

        result = trafilatura.extract(
            body,
            output_format="markdown",
            with_metadata=False,
            include_tables=True,
            include_links=False,    # links bloat prompt context
            favor_precision=True,   # prefer clean output over recall
        )
        return result  # may be None for JS-rendered pages

    # ── PDF ──────────────────────────────────────────────────────────────────

    def _extract_pdf(self, body: bytes) -> str | None:
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(body))
            pages_text = []
            for page in reader.pages[:10]:  # cap at 10 pages to avoid bloat
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            return "\n\n".join(pages_text) if pages_text else None
        except ImportError:
            logger.debug("pypdf not installed; skipping PDF extraction")
            return None
        except Exception as exc:
            logger.debug("PDF extraction failed: %s", exc)
            return None

    # ── JSON ─────────────────────────────────────────────────────────────────

    def _extract_json(self, body: bytes) -> str | None:
        """Extract readable text from a JSON response (Wikipedia, PyPI, etc.)."""
        try:
            data = json.loads(body)
        except Exception:
            return None

        # Wikipedia REST API summary
        if "extract" in data:
            return data["extract"]

        # Generic: flatten top-level string values
        parts = []
        for key, val in data.items():
            if isinstance(val, str) and len(val) > 20:
                parts.append(f"**{key}**: {val}")
        return "\n\n".join(parts) if parts else None

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _truncate(self, text: str) -> str:
        max_chars = self._config.max_content_chars
        if len(text) <= max_chars:
            return text
        cut = text[:max_chars]
        for sep in (". ", ".\n", "! ", "? "):
            idx = cut.rfind(sep)
            if idx > max_chars // 2:
                return cut[: idx + 1]
        return cut

    def _contains_credentials(self, text: str) -> bool:
        return any(p.search(text) for p in self._cred_patterns)

    @staticmethod
    def _derive_title(url: str, text: str) -> str:
        # Try first non-empty line as title
        for line in text.splitlines():
            line = line.lstrip("#").strip()
            if line:
                return line[:80]
        # Fall back to URL path component
        path = url.split("/")[-1].split("?")[0]
        return (path or url)[:80]

    @staticmethod
    def _kind_from_url(url: str) -> SourceKind:
        if "arxiv.org" in url:
            return SourceKind.ARXIV
        if "wikipedia.org" in url:
            return SourceKind.WIKIPEDIA
        if "pypi.org" in url:
            return SourceKind.PYPI
        if "npmjs.com" in url:
            return SourceKind.NPM
        if "jina.ai" in url:
            return SourceKind.JINA
        return SourceKind.WEB
