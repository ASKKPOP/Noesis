"""AAU configuration — rate limits, curiosity gate, source toggles."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class AAUConfig:
    """Runtime configuration for the Autonomous Action Unit.

    All fields have safe defaults. Override per-Nous via psyche config or
    operator settings.
    """

    # ── Curiosity gate ───────────────────────────────────────────────────────
    # Minimum Ananke curiosity level to trigger a learning cycle.
    # "low" | "med" | "high"
    min_curiosity_level: str = "med"

    # ── Discovery ───────────────────────────────────────────────────────────
    max_urls_per_cycle: int = 3        # Hard cap on URLs fetched per learning cycle
    ddg_sleep_seconds: float = 2.0     # Polite delay between DuckDuckGo searches
    arxiv_max_results: int = 3
    enable_arxiv: bool = True
    enable_wikipedia: bool = True
    enable_pypi: bool = True
    enable_rss: bool = False           # Disabled by default; operator configures feed URLs
    rss_feeds: list[str] = field(default_factory=list)

    # ── Fetch ────────────────────────────────────────────────────────────────
    fetch_timeout_seconds: float = 15.0
    fetch_max_retries: int = 3
    fetch_inter_url_sleep: float = 1.0  # Polite delay between URL fetches
    user_agent: str = "Noesis-AAU/1.0 (learning agent; +https://noesis.ai)"
    jina_prefix: str = "https://r.jina.ai/"

    # ── Content limits ───────────────────────────────────────────────────────
    max_content_chars: int = 3000      # Truncate at word boundary before wiki insert
    min_content_chars: int = 80        # Reject pages shorter than this

    # ── Security ─────────────────────────────────────────────────────────────
    # SSRF: block private/loopback addresses (checked in fetcher)
    block_private_ips: bool = True
    # Credential leak: regex patterns to detect and block before storage
    credential_patterns: list[str] = field(default_factory=lambda: [
        r"Bearer\s+[A-Za-z0-9\-._~+/]+=*",
        r"sk-[A-Za-z0-9]{20,}",
        r"password\s*=\s*\S+",
        r"token\s*=\s*[A-Za-z0-9\-._~+/]{16,}",
    ])

    # ── Allowed content types ────────────────────────────────────────────────
    allowed_content_types: list[str] = field(default_factory=lambda: [
        "text/html",
        "application/xhtml+xml",
        "application/pdf",
        "application/json",
        "text/plain",
        "application/rss+xml",
        "application/atom+xml",
    ])
