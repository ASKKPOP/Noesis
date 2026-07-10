"""Tests for Synopsis — in-world research synthesis + persistence."""

from noesis_brain.synopsis import (
    SourceNote,
    Synopsis,
    Synthesizer,
    SynopsisStore,
)


def _notes():
    return [
        SourceNote(title="m1", content="The ring needs energy. Solar relays are efficient."),
        SourceNote(title="m2", content="Solar relays are efficient. Demand peaks at dusk."),
        SourceNote(title="m3", content="Demand peaks at dusk. Storage smooths the curve."),
    ]


class TestSynthesizer:
    def test_produces_synopsis_with_topic(self):
        s = Synthesizer().synthesize("Ring energy", _notes(), tick=10)
        assert isinstance(s, Synopsis)
        assert s.topic == "Ring energy"
        assert s.created_tick == 10
        assert s.source_titles == ("m1", "m2", "m3")

    def test_dedupes_and_ranks_by_frequency(self):
        s = Synthesizer().synthesize("Ring energy", _notes(), tick=1)
        # "Solar relays are efficient" and "Demand peaks at dusk" each appear twice
        # → they should rank above the single-occurrence points.
        assert s.key_points[0] in ("Solar relays are efficient.", "Demand peaks at dusk.")
        # no duplicates
        assert len(set(s.key_points)) == len(s.key_points)

    def test_filters_trivially_short_fragments(self):
        s = Synthesizer().synthesize("t", [SourceNote("m", "ok. A longer meaningful point here.")], tick=1)
        assert all(len(p) >= 12 for p in s.key_points)

    def test_outline_lists_points(self):
        s = Synthesizer().synthesize("Ring energy", _notes(), tick=1)
        assert s.outline.startswith("# Ring energy")
        if s.key_points:
            assert "1." in s.outline

    def test_empty_sources_is_safe(self):
        s = Synthesizer().synthesize("nothing", [], tick=1)
        assert s.key_points == ()
        assert s.topic == "nothing"

    def test_deterministic(self):
        a = Synthesizer().synthesize("Ring energy", _notes(), tick=5)
        b = Synthesizer().synthesize("Ring energy", _notes(), tick=5)
        assert a == b


class TestSynopsisStore:
    def test_save_and_latest_roundtrip(self):
        store = SynopsisStore(db_path=":memory:", nous_did="did:noesis:sophia")
        syn = Synthesizer().synthesize("Ring energy", _notes(), tick=3)
        rid = store.save(syn)
        assert rid >= 1
        assert store.count() == 1
        latest = store.latest(limit=5)
        assert len(latest) == 1
        got = latest[0]
        assert got.topic == "Ring energy"
        assert got.key_points == syn.key_points
        assert got.source_titles == syn.source_titles
        assert got.created_tick == 3

    def test_latest_orders_newest_first(self):
        store = SynopsisStore(db_path=":memory:", nous_did="d")
        store.save(Synthesizer().synthesize("first", _notes(), tick=1))
        store.save(Synthesizer().synthesize("second", _notes(), tick=2))
        latest = store.latest(limit=5)
        assert [s.topic for s in latest] == ["second", "first"]

    def test_directory_path_derives_per_nous_file(self, tmp_path):
        store = SynopsisStore(db_path=tmp_path, nous_did="did:noesis:sophia")
        store.save(Synthesizer().synthesize("t", _notes(), tick=1))
        files = list(tmp_path.glob("synopsis_*.db"))
        assert len(files) == 1
