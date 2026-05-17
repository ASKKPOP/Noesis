"""LoreStore — SQLite-backed lore library with FTS5 retrieval (Phase 20).

Sole writer: BrainHandler.on_message() -> __lore_response: prefix dispatch.
Reader: build_system_prompt() via retrieve().

Retrieval ranking (EvoAgent §4 three-stage cascade):
  1. Fast pre-filter (empty query guard).
  2. FTS5 BM25 match over title + content.
  3. Return top-k by BM25 score.

Capacity: soft cap LORE_CAPACITY entries. Evict oldest received_tick (FIFO, D-20-09).
"""

from __future__ import annotations

import sqlite3

from noesis_brain.lore.types import LoreEntry


class LoreStore:
    """Wraps the shared MemoryStore SQLite connection for lore_entries table.

    Accepts the same sqlite3.Connection used by MemoryStore — one DB file per Nous.
    Creating a separate connection would produce a second SQLite file (Pitfall 7).
    """

    LORE_CAPACITY = 50  # default; configurable via TOML lore_capacity (D-20-09)

    def __init__(self, conn: sqlite3.Connection, capacity: int = 50) -> None:
        self._conn = conn
        self._conn.row_factory = sqlite3.Row
        self._capacity = capacity
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        """Create lore_entries, FTS5 virtual table, and sync triggers if not already present."""
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS lore_entries (
                content_hash    TEXT PRIMARY KEY,
                contributor_did TEXT NOT NULL,
                category_tag    TEXT NOT NULL,
                title           TEXT NOT NULL,
                content         TEXT NOT NULL,
                received_tick   INTEGER NOT NULL
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS lore_entries_fts USING fts5(
                content_hash UNINDEXED,
                title,
                content,
                content='lore_entries',
                content_rowid='rowid'
            );
            CREATE TRIGGER IF NOT EXISTS lore_entries_fts_ai
                AFTER INSERT ON lore_entries BEGIN
                    INSERT INTO lore_entries_fts(rowid, content_hash, title, content)
                    VALUES (new.rowid, new.content_hash, new.title, new.content);
                END;
            CREATE TRIGGER IF NOT EXISTS lore_entries_fts_au
                AFTER UPDATE ON lore_entries BEGIN
                    INSERT INTO lore_entries_fts(lore_entries_fts, rowid, content_hash, title, content)
                    VALUES ('delete', old.rowid, old.content_hash, old.title, old.content);
                    INSERT INTO lore_entries_fts(rowid, content_hash, title, content)
                    VALUES (new.rowid, new.content_hash, new.title, new.content);
                END;
            CREATE TRIGGER IF NOT EXISTS lore_entries_fts_ad
                AFTER DELETE ON lore_entries BEGIN
                    INSERT INTO lore_entries_fts(lore_entries_fts, rowid, content_hash, title, content)
                    VALUES ('delete', old.rowid, old.content_hash, old.title, old.content);
                END;
        """)
        self._conn.commit()

    def add(self, entry: LoreEntry) -> None:
        """Store lore entry; evict oldest by received_tick if over capacity (D-20-09)."""
        self._conn.execute(
            """INSERT OR REPLACE INTO lore_entries
               (content_hash, contributor_did, category_tag, title, content, received_tick)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entry.content_hash, entry.contributor_did, entry.category_tag,
             entry.title, entry.content, entry.received_tick),
        )
        self._conn.commit()
        self._evict_if_over_capacity()

    def _evict_if_over_capacity(self) -> None:
        count = self._conn.execute("SELECT COUNT(*) FROM lore_entries").fetchone()[0]
        if count > self._capacity:
            excess = count - self._capacity
            self._conn.execute("""
                DELETE FROM lore_entries WHERE content_hash IN (
                    SELECT content_hash FROM lore_entries
                    ORDER BY received_tick ASC
                    LIMIT ?
                )
            """, (excess,))
            self._conn.commit()

    def has(self, content_hash: str) -> bool:
        """Return True if the given content_hash is stored locally."""
        row = self._conn.execute(
            "SELECT 1 FROM lore_entries WHERE content_hash = ?", (content_hash,)
        ).fetchone()
        return row is not None

    def retrieve(self, query: str, k: int = 3) -> list[LoreEntry]:
        """Return top-k lore entries for the query using FTS5 BM25.

        Empty or whitespace query returns [].
        FTS5 tokenizer uses default unicode61 (same as SkillStore — follow SkillStore exactly).
        """
        if not query.strip():
            return []
        # Sanitize query: keep alphanumeric + underscore tokens; fall back to prefix
        safe_query = " ".join(
            w for w in query.split() if w.isalnum() or "_" in w
        )
        if not safe_query:
            safe_query = query[:50]
        try:
            rows = self._conn.execute(
                """SELECT le.content_hash, le.contributor_did, le.category_tag,
                          le.title, le.content, le.received_tick
                   FROM lore_entries_fts
                   JOIN lore_entries le ON lore_entries_fts.rowid = le.rowid
                   WHERE lore_entries_fts MATCH ?
                   ORDER BY rank
                   LIMIT ?""",
                (safe_query, k * 4),  # over-fetch then slice to top-k
            ).fetchall()
            return [LoreEntry.from_row(r) for r in rows[:k]]
        except Exception:
            return []

    def count(self) -> int:
        """Return current number of stored lore entries."""
        row = self._conn.execute("SELECT COUNT(*) FROM lore_entries").fetchone()
        return row[0]

    def retrieve_by_hash(self, content_hash: str) -> LoreEntry | None:
        """Return the stored LoreEntry for the given content_hash, or None if not held.

        Used by __lore_request: handler to serve content to requesting peers (D-20-07).
        """
        row = self._conn.execute(
            """SELECT content_hash, contributor_did, category_tag, title, content, received_tick
               FROM lore_entries WHERE content_hash = ?""",
            (content_hash,),
        ).fetchone()
        if row is None:
            return None
        return LoreEntry.from_row(row)
