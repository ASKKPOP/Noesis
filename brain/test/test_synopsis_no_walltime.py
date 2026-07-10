"""v3.3 Mind — Wall-clock grep gate for the synopsis faculty (Brain side).

Synthesis must be deterministic: `synopsis/**` MUST NOT reference wall-clock or
nondeterministic sources. The digest is a pure function of (topic, sources, tick)
— the same inputs always yield the same synopsis (contract: test_synopsis.
test_deterministic). Persistence (SQLite) carries the tick, never a clock.

Mirrors test_ananke_no_walltime.py exactly.
"""

from __future__ import annotations

import re
from pathlib import Path

SYNOPSIS_SRC = Path(__file__).resolve().parents[1] / "src" / "noesis_brain" / "synopsis"

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


def test_synopsis_no_walltime_or_nondeterminism() -> None:
    assert SYNOPSIS_SRC.is_dir(), f"synopsis source dir must exist: {SYNOPSIS_SRC}"
    files = list(_iter_py_files(SYNOPSIS_SRC))
    assert files, f"synopsis source dir must contain python files: {SYNOPSIS_SRC}"

    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")

    assert not violations, "\n".join(violations)
