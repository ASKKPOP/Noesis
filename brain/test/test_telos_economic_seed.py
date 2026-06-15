"""Economic goal — Task 2: auto-seed for all spawned Nous (config path), opt-out."""
from __future__ import annotations

from noesis_brain.telos.manager import ECONOMIC_GOAL_TEXT, TelosManager
from noesis_brain.telos.types import GoalDomain, GoalType


def _economic(mgr: TelosManager):
    return [g for g in mgr.all_goals() if g.domain == GoalDomain.ECONOMIC]


def test_bare_manager_is_not_seeded() -> None:
    # __init__ must stay empty — unit tests + zero-diff fixtures depend on it.
    assert TelosManager().all_goals() == []


def test_from_yaml_auto_seeds_economic_goal_by_default() -> None:
    mgr = TelosManager.from_yaml({"short_term": ["Wake up"]})
    econ = _economic(mgr)
    assert len(econ) == 1
    assert econ[0].goal_type == GoalType.LONG_TERM
    assert econ[0].description == ECONOMIC_GOAL_TEXT
    assert econ[0].is_active()


def test_from_yaml_opt_out_disables_seed() -> None:
    mgr = TelosManager.from_yaml({"earn_money": False, "short_term": ["Wake up"]})
    assert _economic(mgr) == []


def test_economic_goal_text_is_axiom_aligned() -> None:
    # D-MONEY-01: compute-labor, never "Ousia" / "Cyber Money".
    low = ECONOMIC_GOAL_TEXT.lower()
    assert "labor" in low or "work" in low
    assert "ousia" not in low


def test_seed_is_deterministic() -> None:
    a = TelosManager.from_yaml({})
    b = TelosManager.from_yaml({})
    assert [g.description for g in _economic(a)] == [g.description for g in _economic(b)]
