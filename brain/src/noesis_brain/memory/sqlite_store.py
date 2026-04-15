"""SQLite persistence for memories and wiki pages."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from noesis_brain.memory.types import Memory, MemoryType, WikiPage, WikiCategory


class MemoryStore:
    """SQLite-backed storage for the memory stream and personal wiki.

    Usage:
        store = MemoryStore("/path/to/nous.db")
        store.add_memory(Memory(...))
        memories = store.recent_memories(limit=10)
    """

    def __init__(self, db_path: str | Path = ":memory:") -> None:
        self._db_path = str(db_path)
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS memories (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_type TEXT NOT NULL,
                content     TEXT NOT NULL,
                importance  REAL NOT NULL DEFAULT 5.0,
                source_did  TEXT DEFAULT '',
                location    TEXT DEFAULT '',
                tick        INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
            CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
            CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);

            CREATE TABLE IF NOT EXISTS wiki_pages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL UNIQUE,
                category    TEXT NOT NULL,
                content     TEXT NOT NULL,
                confidence  REAL NOT NULL DEFAULT 0.5,
                source      TEXT DEFAULT '',
                version     INTEGER NOT NULL DEFAULT 1,
                updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

    # ── Memory operations ───────────────────────────────────

    def add_memory(self, memory: Memory) -> Memory:
        """Store a memory and return it with its assigned ID."""
        cur = self._conn.execute(
            """INSERT INTO memories (memory_type, content, importance, source_did, location, tick, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                memory.memory_type.value,
                memory.content,
                memory.importance,
                memory.source_did,
                memory.location,
                memory.tick,
                memory.created_at.isoformat(),
            ),
        )
        self._conn.commit()
        memory.id = cur.lastrowid
        return memory

    def get_memory(self, memory_id: int) -> Memory | None:
        """Get a single memory by ID."""
        row = self._conn.execute(
            "SELECT * FROM memories WHERE id = ?", (memory_id,)
        ).fetchone()
        return self._row_to_memory(row) if row else None

    def recent_memories(self, limit: int = 20, memory_type: MemoryType | None = None) -> list[Memory]:
        """Get most recent memories, optionally filtered by type."""
        if memory_type:
            rows = self._conn.execute(
                "SELECT * FROM memories WHERE memory_type = ? ORDER BY created_at DESC LIMIT ?",
                (memory_type.value, limit),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    def memories_by_source(self, source_did: str, limit: int = 20) -> list[Memory]:
        """Get memories related to a specific source DID."""
        rows = self._conn.execute(
            "SELECT * FROM memories WHERE source_did = ? ORDER BY created_at DESC LIMIT ?",
            (source_did, limit),
        ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    def memories_by_importance(self, min_importance: float = 7.0, limit: int = 20) -> list[Memory]:
        """Get high-importance memories."""
        rows = self._conn.execute(
            "SELECT * FROM memories WHERE importance >= ? ORDER BY importance DESC, created_at DESC LIMIT ?",
            (min_importance, limit),
        ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    def memory_count(self) -> int:
        """Total number of memories."""
        row = self._conn.execute("SELECT COUNT(*) FROM memories").fetchone()
        return row[0]

    def all_memories(self) -> list[Memory]:
        """Get all memories (for retrieval scoring)."""
        rows = self._conn.execute(
            "SELECT * FROM memories ORDER BY created_at DESC"
        ).fetchall()
        return [self._row_to_memory(r) for r in rows]

    # ── Wiki operations ─────────────────────────────────────

    def add_wiki_page(self, page: WikiPage) -> WikiPage:
        """Create a new wiki page."""
        cur = self._conn.execute(
            """INSERT INTO wiki_pages (title, category, content, confidence, source, version, updated_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                page.title,
                page.category.value,
                page.content,
                page.confidence,
                page.source,
                page.version,
                page.updated_at.isoformat(),
                page.created_at.isoformat(),
            ),
        )
        self._conn.commit()
        page.id = cur.lastrowid
        return page

    def get_wiki_page(self, title: str) -> WikiPage | None:
        """Get a wiki page by title."""
        row = self._conn.execute(
            "SELECT * FROM wiki_pages WHERE title = ?", (title,)
        ).fetchone()
        return self._row_to_wiki(row) if row else None

    def update_wiki_page(self, title: str, content: str, confidence: float | None = None, source: str | None = None) -> WikiPage | None:
        """Update an existing wiki page, incrementing version."""
        existing = self.get_wiki_page(title)
        if not existing:
            return None
        new_confidence = confidence if confidence is not None else existing.confidence
        new_source = source if source is not None else existing.source
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """UPDATE wiki_pages SET content = ?, confidence = ?, source = ?,
               version = version + 1, updated_at = ? WHERE title = ?""",
            (content, new_confidence, new_source, now, title),
        )
        self._conn.commit()
        return self.get_wiki_page(title)

    def wiki_pages_by_category(self, category: WikiCategory) -> list[WikiPage]:
        """Get all wiki pages in a category."""
        rows = self._conn.execute(
            "SELECT * FROM wiki_pages WHERE category = ? ORDER BY title",
            (category.value,),
        ).fetchall()
        return [self._row_to_wiki(r) for r in rows]

    def all_wiki_pages(self) -> list[WikiPage]:
        """Get all wiki pages."""
        rows = self._conn.execute(
            "SELECT * FROM wiki_pages ORDER BY updated_at DESC"
        ).fetchall()
        return [self._row_to_wiki(r) for r in rows]

    def wiki_page_count(self) -> int:
        """Total number of wiki pages."""
        row = self._conn.execute("SELECT COUNT(*) FROM wiki_pages").fetchone()
        return row[0]

    def delete_wiki_page(self, title: str) -> bool:
        """Delete a wiki page. Returns True if deleted."""
        cur = self._conn.execute("DELETE FROM wiki_pages WHERE title = ?", (title,))
        self._conn.commit()
        return cur.rowcount > 0

    # ── Helpers ──────────────────────────────────────────────

    def _row_to_memory(self, row: sqlite3.Row) -> Memory:
        return Memory(
            id=row["id"],
            memory_type=MemoryType(row["memory_type"]),
            content=row["content"],
            importance=row["importance"],
            source_did=row["source_did"],
            location=row["location"],
            tick=row["tick"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def _row_to_wiki(self, row: sqlite3.Row) -> WikiPage:
        return WikiPage(
            id=row["id"],
            title=row["title"],
            category=WikiCategory(row["category"]),
            content=row["content"],
            confidence=row["confidence"],
            source=row["source"],
            version=row["version"],
            updated_at=datetime.fromisoformat(row["updated_at"]),
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def close(self) -> None:
        self._conn.close()
