"""Phase 10b Wave 0 RED stub — T-09-03 wall-clock grep gate (Brain side).

T-09-03 / D-10b-09 defense: `brain/src/noesis_brain/bios/**` AND
`brain/src/noesis_brain/chronos/**` MUST NOT reference `time.time`,
`time.monotonic`, `time.perf_counter`, `datetime.now`, `datetime.utcnow`,
`random.random`, `random.seed`, or `uuid.uuid4`.

All time on the Brain-side bios + chronos paths flows from the audit
chain tick (carried explicitly into BiosRuntime.on_tick(tick) and
compute_multiplier(curiosity_level, boredom_level)). All randomness
must derive from the per-Nous SHA256(did)[:8] seed at construction.

Gate pattern: clones brain/test/test_ananke_no_walltime.py shape.
Walks both bios + chronos source dirs; collects offending files;
asserts the offender list is empty so the failure message names the
file + matched snippet.

RED at Wave 0 because the source directories do not yet exist (the
assertion `is_dir()` fails). Wave 1 + Wave 3 create the dirs; the
gate then passes only if no wall-clock pattern appears in either.
"""

from __future__ import annotations

import re
from pathlib import Path

BRAIN_SRC = Path(__file__).resolve().parents[1] / "src" / "noesis_brain"
BIOS_SRC = BRAIN_SRC / "bios"
CHRONOS_SRC = BRAIN_SRC / "chronos"

FORBIDDEN_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("time.time()", re.compile(r"\btime\.time\s*\(")),
    ("time.monotonic()", re.compile(r"\btime\.monotonic\s*\(")),
    ("time.perf_counter()", re.compile(r"\btime\.perf_counter\s*\(")),
    ("datetime.now", re.compile(r"\bdatetime\.now\s*\(")),
    ("datetime.utcnow", re.compile(r"\bdatetime\.utcnow\s*\(")),
    ("random.random", re.compile(r"\brandom\.random\s*\(")),
    ("random.seed", re.compile(r"\brandom\.seed\s*\(")),
    ("uuid.uuid4", re.compile(r"\buuid\.uuid4\s*\(")),
]


def _iter_py_files(root: Path):
    for path in root.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        yield path


def _scan(root: Path) -> list[str]:
    assert root.is_dir(), f"source dir must exist: {root}"
    files = list(_iter_py_files(root))
    assert files, f"source dir must contain python files: {root}"
    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")
    return violations


def test_bios_no_walltime_or_nondeterminism() -> None:
    """brain/src/noesis_brain/bios/** is wall-clock + non-determinism free."""
    violations = _scan(BIOS_SRC)
    assert not violations, "\n".join(violations)


def test_chronos_no_walltime_or_nondeterminism() -> None:
    """brain/src/noesis_brain/chronos/** is wall-clock + non-determinism free."""
    violations = _scan(CHRONOS_SRC)
    assert not violations, "\n".join(violations)
