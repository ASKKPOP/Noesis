"""AAU Fetcher — async HTTP fetch with backoff, robots.txt, SSRF guard (Phase 15).

Safety:
  - SSRF: blocks loopback (127.x, ::1) and private RFC-1918 ranges.
  - robots.txt: cached per domain for the lifetime of the fetcher instance.
  - Exponential backoff + jitter on 429 / 5xx / timeout.
  - Content-type check before returning — rejects binary content.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import random
import socket
import urllib.parse
import urllib.robotparser
from typing import TYPE_CHECKING

from noesis_brain.aau.types import FetchResult, SourceKind

if TYPE_CHECKING:
    from noesis_brain.aau.config import AAUConfig

logger = logging.getLogger(__name__)

_PRIVATE_NETS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


class AAUFetcher:
    """Stateful async fetcher with per-domain robots.txt caching."""

    def __init__(self, config: "AAUConfig") -> None:
        self._config = config
        self._robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}

    async def fetch(self, url: str, source_kind: SourceKind = SourceKind.WEB) -> FetchResult | None:
        """Fetch a URL and return a FetchResult, or None if blocked/failed.

        Applies:
          1. URL scheme validation (https/http only)
          2. SSRF guard (block private IPs)
          3. robots.txt check
          4. Exponential backoff on retry-able errors
          5. Content-type allowlist
        """
        # Scheme check
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            logger.debug("Fetcher: rejected non-http scheme: %s", url)
            return None

        # SSRF guard
        if self._config.block_private_ips and self._is_private(parsed.hostname or ""):
            logger.warning("Fetcher: SSRF block — private IP for %s", url)
            return None

        # robots.txt
        if not await self._allows_crawl(url):
            logger.debug("Fetcher: robots.txt disallows %s", url)
            return None

        try:
            import httpx
        except ImportError:
            logger.error("httpx not installed; cannot fetch")
            return None

        headers = {"User-Agent": self._config.user_agent}
        timeout = self._config.fetch_timeout_seconds

        async with httpx.AsyncClient(http2=True, follow_redirects=True, timeout=timeout) as client:
            for attempt in range(self._config.fetch_max_retries):
                try:
                    resp = await client.get(url, headers=headers)
                except (httpx.TimeoutException, httpx.ConnectError) as exc:
                    wait = (2 ** attempt) + random.uniform(0, 0.5)
                    logger.debug("Fetcher: %s on attempt %d — retry in %.1fs", exc, attempt, wait)
                    await asyncio.sleep(wait)
                    continue

                if resp.status_code == 200:
                    ct = resp.headers.get("content-type", "")
                    if not self._is_allowed_content_type(ct):
                        logger.debug("Fetcher: rejected content-type %r for %s", ct, url)
                        return None
                    return FetchResult(
                        url=url,
                        status=200,
                        content_type=ct,
                        body=resp.content,
                    )

                if resp.status_code == 429:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    logger.debug("Fetcher: 429 — sleeping %.1fs before retry", wait)
                    await asyncio.sleep(wait)
                    continue

                if resp.status_code >= 500:
                    wait = (2 ** attempt) + random.uniform(0, 0.5)
                    await asyncio.sleep(wait)
                    continue

                # 4xx — not retryable
                logger.debug("Fetcher: %d for %s — not retrying", resp.status_code, url)
                return None

        return None

    # ── robots.txt ───────────────────────────────────────────────────────────

    async def _allows_crawl(self, url: str) -> bool:
        """Check robots.txt for the domain (cached per session)."""
        parsed = urllib.parse.urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        if domain not in self._robots_cache:
            rp = urllib.robotparser.RobotFileParser()
            robots_url = f"{domain}/robots.txt"
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.get(robots_url)
                if r.status_code == 200:
                    rp.parse(r.text.splitlines())
                else:
                    rp.allow_all = True
            except Exception:
                rp.allow_all = True
            self._robots_cache[domain] = rp
        rp = self._robots_cache[domain]
        return rp.can_fetch(self._config.user_agent, url)

    # ── Content-type ─────────────────────────────────────────────────────────

    def _is_allowed_content_type(self, ct: str) -> bool:
        return any(allowed in ct for allowed in self._config.allowed_content_types)

    # ── SSRF ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _is_private(hostname: str) -> bool:
        if not hostname:
            return True
        try:
            addr = ipaddress.ip_address(hostname)
            return any(addr in net for net in _PRIVATE_NETS)
        except ValueError:
            pass
        # Resolve hostname and check resolved IPs
        try:
            infos = socket.getaddrinfo(hostname, None)
            for info in infos:
                addr_str = info[4][0]
                try:
                    addr = ipaddress.ip_address(addr_str)
                    if any(addr in net for net in _PRIVATE_NETS):
                        return True
                except ValueError:
                    pass
        except Exception:
            pass
        return False
