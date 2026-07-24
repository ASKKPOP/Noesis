"""Notebook provider — read real docs into SourceNotes (Phase 76)."""

from __future__ import annotations

from noesis_brain.bridge import NotebookProvider


def test_unavailable_without_dir() -> None:
    assert NotebookProvider(None).available() is False


def test_reads_txt_and_md(tmp_path) -> None:
    (tmp_path / "a.md").write_text("# Energy\nThe residential ring needs power.")
    (tmp_path / "b.txt").write_text("Solar surplus routes to manufacture.")
    (tmp_path / "ignore.png").write_bytes(b"\x89PNG")  # not allowlisted
    notes = NotebookProvider(tmp_path).ingest()
    titles = {n.title for n in notes}
    assert titles == {"a.md", "b.txt"}
    assert any("residential ring" in n.content for n in notes)


def test_deterministic_order(tmp_path) -> None:
    for name in ["z.txt", "a.txt", "m.txt"]:
        (tmp_path / name).write_text("content here for the note")
    titles = [n.title for n in NotebookProvider(tmp_path).ingest()]
    assert titles == ["a.txt", "m.txt", "z.txt"]


def test_file_count_cap(tmp_path) -> None:
    for i in range(30):
        (tmp_path / f"{i:02d}.txt").write_text("some readable content")
    notes = NotebookProvider(tmp_path, max_files=5).ingest()
    assert len(notes) == 5


def test_byte_cap(tmp_path) -> None:
    (tmp_path / "big.txt").write_text("x" * 10_000)
    notes = NotebookProvider(tmp_path, max_bytes=100).ingest()
    assert len(notes[0].content) <= 100


def test_no_traversal_only_direct_children(tmp_path) -> None:
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / "deep.txt").write_text("should not be read recursively")
    (tmp_path / "top.txt").write_text("top level note content")
    notes = NotebookProvider(tmp_path).ingest()
    assert {n.title for n in notes} == {"top.txt"}


def test_digest_is_titles_only(tmp_path) -> None:
    (tmp_path / "secret.md").write_text("very private content")
    prov = NotebookProvider(tmp_path)
    notes = prov.ingest()
    digest = prov.digest(notes)
    assert "secret.md" in digest
    assert "private content" not in digest
