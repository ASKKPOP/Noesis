"""Tests for Telos — goal management system."""

from noesis_brain.telos import Goal, GoalStatus, GoalType, TelosManager


class TestGoal:
    def test_basic(self):
        goal = Goal(description="Learn philosophy", goal_type=GoalType.LONG_TERM)
        assert goal.is_active()
        assert goal.progress == 0.0

    def test_advance(self):
        goal = Goal(description="Test", goal_type=GoalType.SHORT_TERM)
        goal.advance(0.3)
        assert goal.progress == 0.3
        assert goal.is_active()

    def test_advance_completes(self):
        goal = Goal(description="Test", goal_type=GoalType.SHORT_TERM)
        goal.advance(1.0)
        assert goal.progress == 1.0
        assert goal.status == GoalStatus.COMPLETED
        assert not goal.is_active()

    def test_advance_caps_at_one(self):
        goal = Goal(description="Test", goal_type=GoalType.SHORT_TERM)
        goal.advance(0.7)
        goal.advance(0.7)
        assert goal.progress == 1.0

    def test_abandon(self):
        goal = Goal(description="Test", goal_type=GoalType.SHORT_TERM)
        goal.abandon()
        assert goal.status == GoalStatus.ABANDONED
        assert not goal.is_active()

    def test_block_unblock(self):
        goal = Goal(description="Test", goal_type=GoalType.SHORT_TERM)
        goal.block()
        assert goal.status == GoalStatus.BLOCKED
        assert not goal.is_active()
        goal.unblock()
        assert goal.status == GoalStatus.ACTIVE
        assert goal.is_active()


class TestTelosManager:
    def test_add_and_list(self):
        mgr = TelosManager()
        mgr.add_goal("Learn", GoalType.SHORT_TERM)
        mgr.add_goal("Build", GoalType.MEDIUM_TERM)
        assert len(mgr.active_goals()) == 2
        assert len(mgr.all_goals()) == 2

    def test_goals_by_type(self):
        mgr = TelosManager()
        mgr.add_goal("A", GoalType.SHORT_TERM)
        mgr.add_goal("B", GoalType.SHORT_TERM)
        mgr.add_goal("C", GoalType.LONG_TERM)
        assert len(mgr.goals_by_type(GoalType.SHORT_TERM)) == 2
        assert len(mgr.goals_by_type(GoalType.LONG_TERM)) == 1

    def test_top_priority(self):
        mgr = TelosManager()
        mgr.add_goal("Low", GoalType.SHORT_TERM, priority=0.2)
        mgr.add_goal("High", GoalType.SHORT_TERM, priority=0.9)
        mgr.add_goal("Med", GoalType.SHORT_TERM, priority=0.5)
        top = mgr.top_priority(2)
        assert len(top) == 2
        assert top[0].description == "High"
        assert top[1].description == "Med"

    def test_excludes_inactive_from_active(self):
        mgr = TelosManager()
        g1 = mgr.add_goal("Active", GoalType.SHORT_TERM)
        g2 = mgr.add_goal("Done", GoalType.SHORT_TERM)
        g2.advance(1.0)
        assert len(mgr.active_goals()) == 1
        assert len(mgr.all_goals()) == 2

    def test_describe(self):
        mgr = TelosManager()
        mgr.add_goal("Learn regions", GoalType.SHORT_TERM)
        mgr.add_goal("Build wiki", GoalType.LONG_TERM)
        desc = mgr.describe()
        assert "Learn regions" in desc
        assert "Build wiki" in desc
        assert "short-term" in desc
        assert "long-term" in desc

    def test_describe_empty(self):
        mgr = TelosManager()
        assert "No active goals" in mgr.describe()

    def test_describe_with_progress(self):
        mgr = TelosManager()
        g = mgr.add_goal("Half done", GoalType.SHORT_TERM)
        g.advance(0.5)
        desc = mgr.describe()
        assert "50%" in desc

    def test_from_yaml_sophia(self):
        config = {
            "short_term": [
                "Learn about the Grid's regions",
                "Meet other Nous and understand their goals",
            ],
            "medium_term": [
                "Establish a knowledge-sharing service",
                "Build reputation as a trusted source",
            ],
            "long_term": [
                "Become the Grid's foremost philosopher",
                "Create a comprehensive knowledge wiki",
            ],
        }
        mgr = TelosManager.from_yaml(config)
        assert len(mgr.active_goals()) == 6
        assert len(mgr.goals_by_type(GoalType.SHORT_TERM)) == 2
        assert len(mgr.goals_by_type(GoalType.MEDIUM_TERM)) == 2
        assert len(mgr.goals_by_type(GoalType.LONG_TERM)) == 2

        # Short-term goals should have higher priority
        short = mgr.goals_by_type(GoalType.SHORT_TERM)
        long = mgr.goals_by_type(GoalType.LONG_TERM)
        assert short[0].priority > long[0].priority

    def test_from_yaml_hermes(self):
        config = {
            "short_term": [
                "Identify what other Nous need",
                "Make first profitable trade",
            ],
            "medium_term": [
                "Build a trading network",
                "Create the first marketplace shop",
            ],
            "long_term": [
                "Become the wealthiest Nous in the Grid",
                "Control the most valuable trade routes",
            ],
        }
        mgr = TelosManager.from_yaml(config)
        assert len(mgr.active_goals()) == 6
        top = mgr.top_priority(1)
        # Should be a short-term goal
        assert top[0].goal_type == GoalType.SHORT_TERM


# ── Goal evolution over time (spec §3) ─────────────────────────────────


class TestEvolve:
    def test_demotes_stale_unprogressed_goal(self):
        from noesis_brain.telos.manager import TelosManager
        from noesis_brain.telos.types import GoalType
        mgr = TelosManager()
        g = mgr.add_goal("explore", GoalType.SHORT_TERM, priority=0.8, tick=0)
        assert mgr.evolve(499) is False        # not stale yet
        assert g.priority == 0.8
        assert mgr.evolve(500) is True         # stale → demoted to floor
        assert g.priority == 0.1
        assert mgr.evolve(600) is False        # already at floor → no-op

    def test_skips_progressed_goal(self):
        from noesis_brain.telos.manager import TelosManager
        from noesis_brain.telos.types import GoalType
        mgr = TelosManager()
        g = mgr.add_goal("build", GoalType.MEDIUM_TERM, priority=0.7, tick=0)
        g.advance(0.3, tick=10)
        assert mgr.evolve(600) is False        # has progress → not demoted
        assert g.priority == 0.7

    def test_exempts_economic_goal(self):
        from noesis_brain.telos.manager import TelosManager
        mgr = TelosManager()
        e = mgr.seed_economic_goal()
        assert mgr.evolve(10_000) is False     # standing economic goal never demoted
        assert e.priority == 0.4

    def test_staleness_measured_from_last_touch(self):
        from noesis_brain.telos.manager import TelosManager
        from noesis_brain.telos.types import GoalType
        mgr = TelosManager()
        g = mgr.add_goal("x", GoalType.SHORT_TERM, priority=0.8, tick=0)
        g.advance(0.0, tick=300)               # touched at 300, still no progress
        assert mgr.evolve(700) is False        # 700-300 = 400 < 500
        assert mgr.evolve(800) is True         # 800-300 = 500 → demoted
