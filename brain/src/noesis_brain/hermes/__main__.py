"""Hermes Brain entry point.

Run with:
    python -m noesis_brain.hermes

Environment variables (same as standard brain, plus Hermes-specific):
    NOUS_NAME           - Nous name (used in socket path, default: hermes)
    NOUS_CONFIG         - Path to Nous YAML config file
    NOUS_DID            - DID override (default: did:noesis:<slugified-name>)
    GRID_NAME           - Grid name (default: genesis)
    NOUS_REGION         - Starting region (default: Agora Central)
    SOCKET_DIR          - Unix socket directory (default: /tmp)

    HERMES_PROVIDER     - LLM provider key (default: anthropic)
    HERMES_MODEL        - Model override (e.g. claude-opus-4-5)
    HERMES_API_KEY      - API key override (else uses ~/.hermes/.env)
    HERMES_AGENT_DIR    - Path to hermes-agent checkout
                          (default: ~/Programming/src/hermes-agent)
    HERMES_TICK_CADENCE - Act every N ticks (default: 10)

Example:
    NOUS_NAME=hermes \\
    NOUS_CONFIG=/app/data/nous/hermes.yaml \\
    HERMES_PROVIDER=anthropic \\
    HERMES_MODEL=claude-opus-4-5 \\
    python -m noesis_brain.hermes
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
from pathlib import Path

from noesis_brain.hermes.factory import create_hermes_brain_app

log = logging.getLogger(__name__)


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    nous_name = os.environ.get("NOUS_NAME", "hermes")
    config_path_str = os.environ.get("NOUS_CONFIG")

    if config_path_str:
        config_path = Path(config_path_str)
    else:
        default = Path(__file__).parent.parent.parent.parent.parent / "data" / "nous" / f"{nous_name}.yaml"
        config_path = default

    app = create_hermes_brain_app(
        nous_name=nous_name,
        config_path=config_path,
        grid_name=os.environ.get("GRID_NAME", "genesis"),
        location=os.environ.get("NOUS_REGION", "Agora Central"),
        hermes_provider=os.environ.get("HERMES_PROVIDER", "anthropic"),
        hermes_model=os.environ.get("HERMES_MODEL", ""),
        hermes_api_key=os.environ.get("HERMES_API_KEY"),
        socket_dir=os.environ.get("SOCKET_DIR", "/tmp"),
    )

    log.info("[HermesBrain:%s] Starting…", app.nous_name)

    loop = asyncio.get_event_loop()

    def _shutdown() -> None:
        log.info("[HermesBrain:%s] Shutdown signal received", app.nous_name)
        for task in asyncio.all_tasks(loop):
            task.cancel()

    loop.add_signal_handler(signal.SIGTERM, _shutdown)
    loop.add_signal_handler(signal.SIGINT, _shutdown)

    await app.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
