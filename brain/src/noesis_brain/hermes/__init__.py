"""Hermes Agent adapter for Noēsis brain.

Provides ``HermesBrainHandler`` — a drop-in replacement for ``BrainHandler``
that routes cognition through Nous Research's Hermes Agent (AIAgent) instead
of a bare LLM adapter.

Hermes brings:
  - Self-improving skills (procedural memory)
  - Cross-session FTS5 memory search
  - Multi-model support (200+ providers via OpenRouter)
  - The ``noesis_grid`` toolset (nous_speak, nous_move, nous_trade, etc.)

Usage::

    from noesis_brain.hermes import HermesBrainHandler, create_hermes_brain_app

    app = create_hermes_brain_app(
        nous_name="hermes",
        config_path="data/nous/hermes.yaml",
        hermes_provider="anthropic",
        hermes_model="claude-opus-4-5",
    )
    await app.serve_forever()
"""

from noesis_brain.hermes.handler import HermesBrainHandler
from noesis_brain.hermes.factory import create_hermes_brain_app

__all__ = ["HermesBrainHandler", "create_hermes_brain_app"]
