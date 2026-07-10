"""Praxis types — deeds and validation outcomes.

A `Deed` is one in-world action the Nous actually took this tick (an *act on the
world*, as opposed to internal cognition). An `Outcome` is the result of
validating a proposed action against the in-world repertoire.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Outcome:
    """Result of validating a proposed in-world action."""

    ok: bool
    reason: str = ""


@dataclass(frozen=True)
class Deed:
    """One in-world act the Nous took (journaled for inspectability)."""

    verb: str
    tick: int
    valid: bool
    reason: str = ""
