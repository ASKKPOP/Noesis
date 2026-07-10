"""Tests for Aisthesis — in-world perception and salient-change detection."""

from noesis_brain.aisthesis import (
    AisthesisTracker,
    Percept,
    PerceptKind,
)


def _sight(parcels=None, objects=None):
    return {"parcels": parcels or [], "objects": objects or []}


class TestPercept:
    def test_describe_appeared_with_zone(self):
        p = Percept(
            kind=PerceptKind.APPEARED,
            subject="object:1",
            label="a relay",
            zone="Business",
            salience=0.6,
        )
        desc = p.describe()
        assert "relay" in desc
        assert "Business" in desc
        assert "appeared" in desc

    def test_describe_no_zone(self):
        p = Percept(PerceptKind.CHANGED, "parcel:3", "a parcel", "", 0.4)
        assert "parcel" in p.describe()
        assert "changed" in p.describe()


class TestAisthesisTracker:
    def test_first_perception_is_baseline_no_percepts(self):
        t = AisthesisTracker()
        out = t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}]))
        assert out == []
        # baseline is now established
        assert t.snapshot()["world_size"] == 1

    def test_none_and_empty_sight_yield_nothing(self):
        t = AisthesisTracker()
        assert t.perceive(None) == []
        assert t.perceive({}) == []
        assert t.perceive(_sight()) == []

    def test_object_appeared(self):
        t = AisthesisTracker()
        t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}]))
        out = t.perceive(
            _sight(
                objects=[
                    {"id": 1, "kind": "relay", "zone": "Business"},
                    {"id": 2, "kind": "foundry", "zone": "Manufacture"},
                ]
            )
        )
        assert len(out) == 1
        assert out[0].kind == PerceptKind.APPEARED
        assert out[0].subject == "object:2"
        assert out[0].zone == "Manufacture"

    def test_object_vanished_keeps_last_known_label(self):
        t = AisthesisTracker()
        t.perceive(_sight(objects=[{"id": 7, "kind": "beacon", "zone": "Infrastructure"}]))
        out = t.perceive(_sight(objects=[]))
        assert len(out) == 1
        assert out[0].kind == PerceptKind.VANISHED
        assert out[0].subject == "object:7"
        # label survives from the prior snapshot
        assert "beacon" in out[0].label

    def test_parcel_changed_when_structure_built(self):
        t = AisthesisTracker()
        t.perceive(
            _sight(parcels=[{"id": 3, "zone": "Business", "status": "empty", "owner": "", "structure": ""}])
        )
        out = t.perceive(
            _sight(parcels=[{"id": 3, "zone": "Business", "status": "built", "owner": "did:x", "structure": "shop"}])
        )
        assert len(out) == 1
        assert out[0].kind == PerceptKind.CHANGED
        assert out[0].subject == "parcel:3"

    def test_no_change_yields_nothing(self):
        t = AisthesisTracker()
        s = _sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}])
        t.perceive(s)
        assert t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}])) == []

    def test_salience_floor_filters(self):
        # floor above CHANGED salience drops parcel-change percepts
        t = AisthesisTracker({"salience_floor": 0.5})
        t.perceive(_sight(parcels=[{"id": 3, "zone": "Business", "status": "empty"}]))
        out = t.perceive(_sight(parcels=[{"id": 3, "zone": "Business", "status": "built"}]))
        assert out == []  # CHANGED (0.4) below floor 0.5

    def test_salient_helper(self):
        t = AisthesisTracker()
        t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}]))
        t.perceive(
            _sight(
                objects=[
                    {"id": 1, "kind": "relay", "zone": "Business"},
                    {"id": 2, "kind": "foundry", "zone": "Manufacture"},
                ]
            )
        )
        assert len(t.salient(0.5)) == 1  # APPEARED is 0.6

    def test_describe_calm(self):
        t = AisthesisTracker()
        assert "Nothing new" in t.describe()

    def test_describe_active(self):
        t = AisthesisTracker()
        t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}]))
        t.perceive(
            _sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}, {"id": 2, "kind": "foundry", "zone": "Manufacture"}])
        )
        desc = t.describe()
        assert "notice" in desc.lower()
        assert "foundry" in desc

    def test_snapshot_shape(self):
        t = AisthesisTracker()
        t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}]))
        snap = t.snapshot()
        assert set(snap.keys()) == {"percept_count", "percepts", "world_size"}
        assert snap["world_size"] == 1

    def test_deterministic_ordering(self):
        # two objects appear at once → percepts sorted by stable subject key
        t = AisthesisTracker()
        t.perceive(_sight(objects=[{"id": 1, "kind": "relay", "zone": "Business"}]))
        out1 = t.perceive(
            _sight(objects=[
                {"id": 1, "kind": "relay", "zone": "Business"},
                {"id": 9, "kind": "nine", "zone": "Shopping"},
                {"id": 3, "kind": "three", "zone": "Residential"},
            ])
        )
        subjects = [p.subject for p in out1]
        assert subjects == sorted(subjects)
