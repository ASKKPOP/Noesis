"""Shared fixtures for the Ananke test suite."""

from __future__ import annotations

import pytest

from noesis_brain.ananke import AnankeRuntime


@pytest.fixture
def runtime_seed_42() -> AnankeRuntime:
    """A fresh AnankeRuntime with seed=42 and baseline drive vector."""
    return AnankeRuntime(seed=42)
