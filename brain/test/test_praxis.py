"""Tests for Praxis — in-world action repertoire, validation, and deed journal."""

from noesis_brain.praxis import (
    Deed,
    Outcome,
    PraxisTracker,
    OUTWARD_VERBS,
)


class TestValidate:
    def test_valid_outward_verb_with_required_keys(self):
        t = PraxisTracker()
        out = t.validate("vote_commit", {"proposal_id": "p1", "commit_hash": "abc"})
        assert isinstance(out, Outcome)
        assert out.ok
        assert out.reason == ""

    def test_missing_required_keys(self):
        t = PraxisTracker()
        out = t.validate("vote_commit", {"proposal_id": "p1"})
        assert not out.ok
        assert "commit_hash" in out.reason

    def test_unknown_or_internal_verb_is_not_outward(self):
        t = PraxisTracker()
        out = t.validate("noop", {})
        assert not out.ok
        assert out.reason == "not_outward"

    def test_freeform_verb_needs_no_keys(self):
        t = PraxisTracker()
        assert t.validate("speak", {}).ok
        assert t.validate("move", {}).ok


class TestObserve:
    def _actions(self, *pairs):
        return [{"action_type": v, "metadata": m} for v, m in pairs]

    def test_internal_actions_are_not_deeds(self):
        t = PraxisTracker()
        deeds = t.observe(self._actions(("noop", {}), ("drive_crossed", {})), tick=1)
        assert deeds == []
        assert t.total_deeds == 0

    def test_outward_deed_recorded_and_counted(self):
        t = PraxisTracker()
        deeds = t.observe(self._actions(("speak", {"body_text": "hi"})), tick=3)
        assert len(deeds) == 1
        assert deeds[0].verb == "speak"
        assert deeds[0].valid
        assert deeds[0].tick == 3
        assert t.verb_counts["speak"] == 1
        assert t.total_deeds == 1

    def test_malformed_deed_recorded_invalid(self):
        t = PraxisTracker()
        deeds = t.observe(self._actions(("vote_commit", {"proposal_id": "p1"})), tick=2)
        assert len(deeds) == 1
        assert deeds[0].valid is False
        assert "commit_hash" in deeds[0].reason
        # still counted as an attempted deed
        assert t.total_deeds == 1

    def test_journal_is_bounded(self):
        t = PraxisTracker({"journal_size": 3})
        for i in range(5):
            t.observe(self._actions(("speak", {})), tick=i)
        assert len(t.snapshot()["recent"]) == 3
        assert t.total_deeds == 5  # count is cumulative, journal is bounded

    def test_observe_never_mutates_input(self):
        t = PraxisTracker()
        actions = self._actions(("speak", {"body_text": "hi"}))
        before = [dict(a) for a in actions]
        t.observe(actions, tick=1)
        assert actions == before


class TestIntrospection:
    def test_repertoire_sorted_and_nonempty(self):
        t = PraxisTracker()
        rep = t.repertoire()
        assert rep == sorted(rep)
        assert "speak" in rep
        assert "build" in rep

    def test_snapshot_shape(self):
        t = PraxisTracker()
        t.observe([{"action_type": "speak", "metadata": {}}], tick=1)
        snap = t.snapshot()
        assert set(snap.keys()) == {"total_deeds", "verb_counts", "recent", "repertoire_size"}
        assert snap["repertoire_size"] == len(OUTWARD_VERBS)
        assert snap["recent"][0]["verb"] == "speak"

    def test_deterministic(self):
        a = PraxisTracker()
        b = PraxisTracker()
        acts = [{"action_type": "vote_commit", "metadata": {"proposal_id": "p"}}]
        assert a.observe(acts, tick=7) == b.observe(acts, tick=7)
