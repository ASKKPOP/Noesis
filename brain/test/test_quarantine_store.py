"""QuarantineStore unit tests — Phase 18 SKILL-01.

Tests cover:
- Enqueue inserts with correct promote_at_tick = tick + QUARANTINE_TICKS
- Sweep promotes when trust >= 0.35 (inserts into skills, deletes from quarantine)
- Sweep evicts when trust < 0.35 (deletes from quarantine, does NOT insert into skills)
- has() returns True for quarantined skill_hash, False otherwise
- Enqueue is idempotent (INSERT OR IGNORE)
- Trust eviction runs at every sweep (D-18-02)
- No wall-clock references (determinism)
"""
import hashlib
import sqlite3
import pytest
from noesis_brain.skills.quarantine import QuarantineStore, QUARANTINE_TICKS
from noesis_brain.skills.types import Skill


FAKE_INSTRUCTIONS = "Always greet new traders politely before negotiating."
FAKE_INSTRUCTIONS_2 = "Prioritize safety when crossing high-traffic zones."


def _make_skill(instructions: str = FAKE_INSTRUCTIONS) -> Skill:
    """Create a minimal Skill for testing."""
    return Skill(
        name="test-skill",
        description="test",
        instructions=instructions,
        triggers=[],
        tags=[],
    )


def _compute_hash(instructions: str) -> str:
    return hashlib.sha256(instructions.encode()).hexdigest()


def _make_conn() -> sqlite3.Connection:
    """In-memory SQLite with skills table (needed for promotion path)."""
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.executescript("""
        CREATE TABLE IF NOT EXISTS skills (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT NOT NULL UNIQUE,
            description         TEXT NOT NULL DEFAULT '',
            instructions        TEXT NOT NULL DEFAULT '',
            triggers            TEXT NOT NULL DEFAULT '[]',
            tags                TEXT NOT NULL DEFAULT '[]',
            usage_count         INTEGER NOT NULL DEFAULT 0,
            success_rate        REAL NOT NULL DEFAULT 0.0,
            source_did          TEXT NOT NULL DEFAULT '',
            peer_verified       INTEGER NOT NULL DEFAULT 1,
            lineage_parent_hash TEXT,
            created_at          TEXT NOT NULL DEFAULT (datetime('now')),
            last_used_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    return c


@pytest.fixture
def conn():
    return _make_conn()


@pytest.fixture
def store(conn):
    return QuarantineStore(conn)


class TestEnqueue:
    def test_enqueue_inserts_row(self, store, conn):
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        row = conn.execute(
            "SELECT * FROM skills_quarantine WHERE skill_hash = ?", (skill_hash,)
        ).fetchone()
        assert row is not None
        assert row["source_did"] == "did:noesis:teacher"
        assert row["promote_at_tick"] == QUARANTINE_TICKS  # 0 + QUARANTINE_TICKS

    def test_enqueue_is_idempotent(self, store, conn):
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:a", tick=0, parent_hash=skill_hash)
        store.enqueue(skill, source_did="did:noesis:b", tick=0, parent_hash=skill_hash)
        count = conn.execute("SELECT COUNT(*) FROM skills_quarantine").fetchone()[0]
        assert count == 1  # INSERT OR IGNORE

    def test_has_returns_true_after_enqueue(self, store):
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        assert store.has(skill_hash) is True

    def test_has_returns_false_for_unknown(self, store):
        assert store.has("a" * 64) is False


class TestSweep:
    def test_sweep_promotes_when_trust_high(self, store, conn):
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        trust_fn = lambda did: 0.9  # high trust
        results = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=trust_fn)
        assert len(results) == 1
        assert results[0].promoted is True
        # Skill moved to active store
        promoted = conn.execute(
            "SELECT * FROM skills WHERE instructions = ?", (skill.instructions,)
        ).fetchone()
        assert promoted is not None
        # Removed from quarantine
        in_q = conn.execute(
            "SELECT * FROM skills_quarantine WHERE skill_hash = ?", (skill_hash,)
        ).fetchone()
        assert in_q is None

    def test_sweep_evicts_when_trust_low(self, store, conn):
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        trust_fn = lambda did: 0.1  # low trust (< 0.35)
        results = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=trust_fn)
        assert len(results) == 1
        assert results[0].promoted is False
        # Skill NOT in active store
        not_promoted = conn.execute(
            "SELECT * FROM skills WHERE instructions = ?", (skill.instructions,)
        ).fetchone()
        assert not_promoted is None
        # Removed from quarantine
        in_q = conn.execute(
            "SELECT * FROM skills_quarantine WHERE skill_hash = ?", (skill_hash,)
        ).fetchone()
        assert in_q is None

    def test_sweep_does_not_promote_before_tick(self, store, conn):
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        trust_fn = lambda did: 0.9
        results = store.sweep(current_tick=QUARANTINE_TICKS - 1, trust_fn=trust_fn)
        assert len(results) == 0  # not ready yet
        in_q = conn.execute(
            "SELECT * FROM skills_quarantine WHERE skill_hash = ?", (skill_hash,)
        ).fetchone()
        assert in_q is not None  # still in quarantine

    def test_trust_eviction_runs_at_sweep_time(self, store, conn):
        """D-18-02: trust is live precondition, not just admission gate."""
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        # First sweep with high trust -- skill not ready yet
        trust_fn_high = lambda did: 0.9
        results = store.sweep(current_tick=QUARANTINE_TICKS - 1, trust_fn=trust_fn_high)
        assert len(results) == 0
        # Teacher drops trust before promotion tick
        trust_fn_low = lambda did: 0.1
        results = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=trust_fn_low)
        assert len(results) == 1
        assert results[0].promoted is False  # evicted despite passing admission gate

    def test_sweep_is_deterministic(self, store, conn):
        """Same state + same tick + same trust -> same result (zero wall-clock)."""
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        trust_fn = lambda did: 0.9
        # Only first sweep returns a result (row deleted)
        r1 = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=trust_fn)
        r2 = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=trust_fn)
        assert len(r1) == 1
        assert len(r2) == 0  # idempotent -- row gone


class TestSourceProvenance:
    """Gap-closure tests for Truth 11 and Truth 12 (VERIFICATION.md gaps)."""

    def test_enqueue_stores_source_observed_in_payload(self, store, conn):
        """Truth 12: source='observed' must persist in payload_json."""
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(
            skill,
            source_did="did:noesis:ol-agent",
            tick=0,
            parent_hash=skill_hash,
            source="observed",
        )
        row = conn.execute(
            "SELECT payload_json FROM skills_quarantine WHERE skill_hash = ?",
            (skill_hash,),
        ).fetchone()
        assert row is not None
        import json
        payload = json.loads(row["payload_json"])
        assert payload["source"] == "observed", (
            f"source not stored in payload_json; got {payload.get('source')!r}"
        )

    def test_enqueue_default_source_is_peer(self, store, conn):
        """Peer-path (whisper) enqueue uses 'peer' source by default."""
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(skill, source_did="did:noesis:teacher", tick=0, parent_hash=skill_hash)
        row = conn.execute(
            "SELECT payload_json FROM skills_quarantine WHERE skill_hash = ?",
            (skill_hash,),
        ).fetchone()
        import json
        payload = json.loads(row["payload_json"])
        assert payload.get("source", "peer") == "peer"

    def test_sweep_result_source_observed(self, store, conn):
        """Truth 12: QuarantineResult.source == 'observed' for OL-path skills."""
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(
            skill,
            source_did="did:noesis:ol-agent",
            tick=0,
            parent_hash=skill_hash,
            source="observed",
        )
        results = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=lambda did: 0.9)
        assert len(results) == 1
        assert results[0].source == "observed", (
            f"Expected source='observed' on QuarantineResult, got {results[0].source!r}"
        )

    def test_sweep_result_source_peer_for_whisper_path(self, store, conn):
        """Peer-path (default) promotions carry source='peer' on QuarantineResult."""
        skill = _make_skill(FAKE_INSTRUCTIONS_2)
        skill_hash = _compute_hash(skill.instructions)
        store.enqueue(
            skill,
            source_did="did:noesis:teacher",
            tick=0,
            parent_hash=skill_hash,
            # source omitted -- defaults to 'peer'
        )
        results = store.sweep(current_tick=QUARANTINE_TICKS, trust_fn=lambda did: 0.9)
        assert len(results) == 1
        assert results[0].source == "peer"

    def test_enqueue_stores_source_event_hash_for_ol_path(self, store, conn):
        """Truth 12: source_event_hash persists in payload_json for OL-path skills."""
        import hashlib
        import json as _json
        skill = _make_skill()
        skill_hash = _compute_hash(skill.instructions)
        expected_event_hash = hashlib.sha256(b"buyer|seller|item|42").hexdigest()
        store.enqueue(
            skill,
            source_did="did:noesis:ol-agent",
            tick=0,
            parent_hash=skill_hash,
            source="observed",
            source_event_hash=expected_event_hash,
        )
        row = conn.execute(
            "SELECT payload_json FROM skills_quarantine WHERE skill_hash = ?",
            (skill_hash,),
        ).fetchone()
        payload = _json.loads(row["payload_json"])
        assert payload.get("source_event_hash") == expected_event_hash
