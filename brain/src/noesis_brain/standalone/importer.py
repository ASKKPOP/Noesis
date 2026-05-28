"""Phase 43 — fork archive importer (D-43-05, T-43-slip defense).

Extracts a .tar.gz fork package, verifies manifest.export_hash, returns the manifest dict.
Rejects path-traversal attempts (member names that resolve outside data_dir).
"""
from __future__ import annotations

import hashlib
import json
import tarfile
from pathlib import Path


def verify_and_unpack(import_archive: Path, data_dir: Path) -> dict:
    """Unpack fork .tar.gz to data_dir; verify manifest.export_hash; return manifest dict.

    Raises:
        FileNotFoundError: import_archive does not exist.
        ValueError: manifest.json missing, export_hash mismatch, or path-traversal detected.
    """
    if not import_archive.exists():
        raise FileNotFoundError(f"Import file not found: {import_archive}")
    data_dir.mkdir(parents=True, exist_ok=True)
    data_dir_resolved = data_dir.resolve()

    # ── Extract with explicit path-traversal guard (T-43-slip) ──
    with tarfile.open(import_archive, "r:gz") as tf:
        for member in tf.getmembers():
            # Reject absolute paths, '..' segments, or anything that resolves outside data_dir.
            target = (data_dir / member.name).resolve()
            try:
                target.relative_to(data_dir_resolved)
            except ValueError:
                raise ValueError(
                    f"Path traversal detected in archive: {member.name!r}"
                )
            if member.islnk() or member.issym():
                raise ValueError(
                    f"Symbolic/hard links not permitted in fork archive: {member.name!r}"
                )
        # Safe to extract — all members validated
        tf.extractall(data_dir)

    # ── Read manifest ──
    manifest_path = data_dir / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("Import package missing manifest.json — not a valid fork package")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    expected_hash = manifest.get("export_hash")
    if not isinstance(expected_hash, str) or len(expected_hash) != 64:
        raise ValueError("manifest.export_hash missing or invalid format")

    # ── Recompute export_hash ──
    # MUST match Grid-side algorithm in fork-archive-builder.ts:
    #   sha256 over sorted (path, content) tuples, EXCLUDING manifest.json itself.
    h = hashlib.sha256()
    files_to_hash = sorted(
        p for p in data_dir.rglob("*")
        if p.is_file() and p.relative_to(data_dir).as_posix() != "manifest.json"
    )
    for f in files_to_hash:
        rel = f.relative_to(data_dir).as_posix()  # forward-slash on all platforms
        h.update(rel.encode("utf-8"))
        h.update(b"\x00")
        h.update(f.read_bytes())
    computed = h.hexdigest()

    if computed != expected_hash:
        raise ValueError(
            f"export_hash mismatch: expected {expected_hash}, computed {computed}"
        )
    return manifest
