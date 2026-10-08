"""O1b — Wall-clock grep gate for the task scheduler (Brain side).

The scheduler must be deterministic: `scheduler/**` MUST NOT reference wall-clock
or nondeterministic sources. Due-ness and ordering are a pure function of
(priority, due_tick, insertion id) against the world tick. Persistence (SQLite)
carries the tick, never a clock.

Mirrors test_synopsis_no_walltime.py exactly.
"""

from __future__ import annotations

import re
from pathlib import Path

SCHEDULER_SRC = Path(__file__).resolve().parents[1] / "src" / "noesis_brain" / "scheduler"

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


def test_scheduler_no_walltime_or_nondeterminism() -> None:
    assert SCHEDULER_SRC.is_dir(), f"scheduler source dir must exist: {SCHEDULER_SRC}"
    files = list(_iter_py_files(SCHEDULER_SRC))
    assert files, f"scheduler source dir must contain python files: {SCHEDULER_SRC}"

    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")

    assert not violations, "\n".join(violations)
