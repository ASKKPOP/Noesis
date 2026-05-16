"""Skill lineage SQL self-join test — Phase 18 SKILL-04.

Verifies that a 3-hop teach chain (A -> B -> C -> D) is reconstructable
from a skill table via SQL WITH RECURSIVE self-join on lineage_parent_hash.
Uses deterministic in-memory SQLite — no wall-clock, no LLM.

Note: the production skills table stores lineage_parent_hash but not a
precomputed skill_hash column. This test adds a skill_hash column to the
test fixture table to demonstrate the 3-hop lineage query pattern from
RESEARCH.md §Code Examples. skill_hash = sha256(instructions) per D-18-10.
"""
import hashlib
import sqlite3
import pytest


def _h(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _create_lineage_test_table(conn: sqlite3.Connection) -> None:
    """Create a skills-like table with explicit skill_hash for lineage queries.

    Production skills table uses lineage_parent_hash only; this test table
    adds skill_hash to enable the WITH RECURSIVE self-join from RESEARCH.md.
    skill_hash = sha256(instructions) per D-18-10.
    """
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS skills (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            skill_hash          TEXT NOT NULL UNIQUE,  -- sha256(instructions), D-18-10
            name                TEXT NOT NULL UNIQUE,
            description         TEXT NOT NULL DEFAULT '',
            instructions        TEXT NOT NULL DEFAULT '',
            triggers            TEXT NOT NULL DEFAULT '[]',
            tags                TEXT NOT NULL DEFAULT '[]',
            usage_count         INTEGER NOT NULL DEFAULT 0,
            success_rate        REAL NOT NULL DEFAULT 0.0,
            source_did          TEXT NOT NULL DEFAULT '',
            peer_verified       INTEGER NOT NULL DEFAULT 0,
            lineage_parent_hash TEXT,
            created_at          INTEGER NOT NULL DEFAULT 0,
            last_used_at        INTEGER NOT NULL DEFAULT 0
        );
    """)


def _insert_skill(
    conn: sqlite3.Connection,
    name: str,
    instructions: str,
    parent_hash: str,
) -> str:
    """Insert a skill row with skill_hash and lineage_parent_hash. Returns skill_hash."""
    skill_hash = _h(instructions)
    conn.execute(
        """INSERT OR IGNORE INTO skills
           (skill_hash, name, description, instructions, triggers, tags,
            usage_count, success_rate, source_did, peer_verified,
            lineage_parent_hash, created_at, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0.0, ?, 0, ?, 0, 0)""",
        (skill_hash, name, "desc", instructions, "[]", "[]", "did:noesis:test", parent_hash),
    )
    conn.commit()
    return skill_hash


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    _create_lineage_test_table(c)
    return c


class TestLineageColumn:
    def test_lineage_column_exists(self, conn):
        cols = [r[1] for r in conn.execute("PRAGMA table_info(skills)").fetchall()]
        assert "lineage_parent_hash" in cols

    def test_skill_hash_column_exists(self, conn):
        cols = [r[1] for r in conn.execute("PRAGMA table_info(skills)").fetchall()]
        assert "skill_hash" in cols


class TestLineageReconstruction:
    def test_3hop_chain_reconstructable(self, conn):
        """A -> B -> C -> D: 3 hops, reconstructable via SQL self-join.

        Chain:
          A: first-gen root, lineage_parent_hash = skill_hash (self-referential, D-18-10)
          B: taught by A, lineage_parent_hash = A's skill_hash
          C: taught by B, lineage_parent_hash = B's skill_hash
          D: taught by C, lineage_parent_hash = C's skill_hash
        """
        a_instr = "Skill A: root procedure for greeting peers"
        b_instr = "Skill B: extension of greeting with name check"
        c_instr = "Skill C: add timing check to extended greeting"
        d_instr = "Skill D: add confirmation step to timed greeting"

        a_hash = _h(a_instr)
        b_hash = _h(b_instr)
        c_hash = _h(c_instr)
        d_hash = _h(d_instr)

        # A is first-gen: lineage_parent_hash = skill_hash (self-referential root, D-18-10)
        _insert_skill(conn, "skill_a", a_instr, parent_hash=a_hash)
        _insert_skill(conn, "skill_b", b_instr, parent_hash=a_hash)
        _insert_skill(conn, "skill_c", c_instr, parent_hash=b_hash)
        _insert_skill(conn, "skill_d", d_instr, parent_hash=c_hash)

        # SQL self-join lineage reconstruction (RESEARCH.md §Code Examples, D-18-10).
        # The recursive CTE traverses the parent chain starting from self-referential roots.
        rows = conn.execute("""
            WITH RECURSIVE lineage(skill_hash, parent_hash, depth) AS (
                -- Base case: self-referential root (first-gen skill, D-18-10)
                SELECT skill_hash, lineage_parent_hash, 0
                FROM skills
                WHERE skill_hash = lineage_parent_hash
                UNION ALL
                -- Recursive case: follow parent chain
                SELECT s.skill_hash, s.lineage_parent_hash, l.depth + 1
                FROM skills s
                JOIN lineage l ON s.lineage_parent_hash = l.skill_hash
                WHERE l.depth < 10
                  AND s.skill_hash != s.lineage_parent_hash  -- exclude root re-match
            )
            SELECT skill_hash, parent_hash, depth FROM lineage ORDER BY depth
        """).fetchall()

        assert len(rows) == 4, (
            f"Expected 4 nodes in lineage chain, got {len(rows)}: "
            f"{[dict(r) for r in rows]}"
        )

        depths = {row["skill_hash"]: row["depth"] for row in rows}
        assert depths[a_hash] == 0, "A should be root (depth 0)"
        assert depths[b_hash] == 1, "B should be depth 1"
        assert depths[c_hash] == 2, "C should be depth 2"
        assert depths[d_hash] == 3, "D should be depth 3"

    def test_non_lineage_skill_excluded(self, conn):
        """A skill with no lineage (not connected to any root) should not appear."""
        isolated_instr = "Isolated skill with no lineage connection"
        isolated_hash = _h(isolated_instr)
        # lineage_parent_hash points to a non-existent skill (not self-referential)
        _insert_skill(conn, "isolated", isolated_instr, parent_hash="a" * 64)

        rows = conn.execute("""
            WITH RECURSIVE lineage(skill_hash, parent_hash, depth) AS (
                SELECT skill_hash, lineage_parent_hash, 0
                FROM skills
                WHERE skill_hash = lineage_parent_hash
                UNION ALL
                SELECT s.skill_hash, s.lineage_parent_hash, l.depth + 1
                FROM skills s
                JOIN lineage l ON s.lineage_parent_hash = l.skill_hash
                WHERE l.depth < 10
                  AND s.skill_hash != s.lineage_parent_hash
            )
            SELECT skill_hash FROM lineage
        """).fetchall()

        found = {r["skill_hash"] for r in rows}
        assert isolated_hash not in found
