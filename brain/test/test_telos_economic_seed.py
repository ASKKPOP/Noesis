"""Economic goal — Task 2: seed_economic_goal() + the spawn-only contract.

Seeding happens once at SPAWN (see test_main.py::test_goals_loaded_from_config,
which goes through the __main__ build path). from_yaml is a *rebuild* contract
(operator force_telos + dialogue refinement) and must NOT seed.
"""
from __future__ import annotations

from noesis_brain.telos.manager import ECONOMIC_GOAL_TEXT, TelosManager
from noesis_brain.telos.types import GoalDomain, GoalType


def _economic(mgr: TelosManager):
    return [g for g in mgr.all_goals() if g.domain == GoalDomain.ECONOMIC]


def test_bare_manager_is_not_seeded() -> None:
    # __init__ must stay empty — unit tests + zero-diff fixtures depend on it.
    assert TelosManager().all_goals() == []


def test_seed_economic_goal_adds_long_term_economic_target() -> None:
    mgr = TelosManager()
    g = mgr.seed_economic_goal()
    assert g.goal_type == GoalType.LONG_TERM
    assert g.domain == GoalDomain.ECONOMIC
    assert g.description == ECONOMIC_GOAL_TEXT
    assert mgr.economic_goals() == [g]


def test_from_yaml_does_not_seed_rebuild_contract_is_literal() -> None:
    # Operator force_telos / dialogue refinement rebuild via from_yaml — literal,
    # so an empty payload yields zero goals (no auto-seed).
    assert TelosManager.from_yaml({}).all_goals() == []
    assert _economic(TelosManager.from_yaml({"short_term": ["Wake up"]})) == []


def test_economic_goal_text_is_axiom_aligned() -> None:
    # D-MONEY-01: compute-labor, never "Ousia" / "Cyber Money".
    low = ECONOMIC_GOAL_TEXT.lower()
    assert "labor" in low or "work" in low
    assert "ousia" not in low


def test_seed_is_deterministic() -> None:
    a, b = TelosManager(), TelosManager()
    a.seed_economic_goal()
    b.seed_economic_goal()
    assert [g.description for g in _economic(a)] == [g.description for g in _economic(b)]
