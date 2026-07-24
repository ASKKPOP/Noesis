"""Notebook provider (synopsis bridge) — read real documents into synthesis.

The Open-Notebook idea, bridged to the operator's real machine: read the
documents in an operator-configured directory and turn them into `SourceNote`s
that feed the deterministic `Synthesizer` (→ `episteme`). READ-ONLY — the
lowest-risk provider.

Safety:
- Non-recursive scan of exactly the configured directory (no traversal): only
  files whose resolved parent is that directory are read.
- Extension allowlist (`.txt` / `.md` / `.pdf`) + per-file byte cap + file count
  cap, so a huge or hostile tree cannot flood memory.
- PDF text needs the optional `pypdf` library; when it is absent, PDFs are
  skipped (not an error) — txt/md still work with no dependency.
"""

from __future__ import annotations

from pathlib import Path

from noesis_brain.bridge.types import BridgeCapability
from noesis_brain.synopsis.types import SourceNote

_TEXT_EXTS = {".txt", ".md"}
_PDF_EXT = ".pdf"
_ALLOWED_EXTS = _TEXT_EXTS | {_PDF_EXT}


def _pdf_available() -> bool:
    try:
        import pypdf  # noqa: F401
        return True
    except Exception:
        return False


class NotebookProvider:
    capability = BridgeCapability.NOTEBOOK

    def __init__(
        self,
        notebook_dir: Path | str | None,
        *,
        max_files: int = 20,
        max_bytes: int = 200_000,
    ) -> None:
        self._dir: Path | None = Path(notebook_dir).expanduser() if notebook_dir else None
        self._max_files = max_files
        self._max_bytes = max_bytes

    def available(self) -> bool:
        return self._dir is not None and self._dir.is_dir()

    def ingest(self) -> list[SourceNote]:
        """Read the notebook directory into SourceNotes (deterministic order)."""
        if not self.available():
            return []
        assert self._dir is not None
        root = self._dir.resolve()
        notes: list[SourceNote] = []
        # Sorted for deterministic ordering; non-recursive (iterdir, not rglob).
        for path in sorted(root.iterdir(), key=lambda p: p.name):
            if len(notes) >= self._max_files:
                break
            if not path.is_file():
                continue
            if path.suffix.lower() not in _ALLOWED_EXTS:
                continue
            # Defense-in-depth: never read outside the configured directory.
            if path.resolve().parent != root:
                continue
            text = self._read(path)
            if text:
                notes.append(SourceNote(title=path.name, content=text, source="notebook"))
        return notes

    def digest(self, notes: list[SourceNote]) -> str:
        """Privacy-safe journal digest — count + titles only, no content."""
        return f"{len(notes)} docs: " + ", ".join(n.title for n in notes[:5])

    # -- internals -----------------------------------------------------------

    def _read(self, path: Path) -> str:
        try:
            if path.suffix.lower() in _TEXT_EXTS:
                data = path.read_bytes()[: self._max_bytes]
                return data.decode("utf-8", errors="replace").strip()
            if path.suffix.lower() == _PDF_EXT:
                return self._read_pdf(path)
        except Exception:
            return ""
        return ""

    def _read_pdf(self, path: Path) -> str:
        if not _pdf_available():
            return ""  # optional dependency absent — skip, do not raise
        try:
            import pypdf

            reader = pypdf.PdfReader(str(path))
            parts: list[str] = []
            for page in reader.pages:
                parts.append(page.extract_text() or "")
                if sum(len(p) for p in parts) >= self._max_bytes:
                    break
            return "\n".join(parts).strip()[: self._max_bytes]
        except Exception:
            return ""
