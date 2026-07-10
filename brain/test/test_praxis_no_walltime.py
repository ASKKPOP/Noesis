"""v3.3 Mind — Wall-clock grep gate for the praxis faculty (Brain side).

The deed journal must be deterministic: `praxis/**` MUST NOT reference wall-clock
or nondeterministic sources. All time flows in as the tick; the same action batch
+ tick always yields the same deeds (contract: test_praxis.test_deterministic).

Mirrors test_ananke_no_walltime.py exactly.
"""

from __future__ import annotations

import re
from pathlib import Path

PRAXIS_SRC = Path(__file__).resolve().parents[1] / "src" / "noesis_brain" / "praxis"

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


def test_praxis_no_walltime_or_nondeterminism() -> None:
    assert PRAXIS_SRC.is_dir(), f"praxis source dir must exist: {PRAXIS_SRC}"
    files = list(_iter_py_files(PRAXIS_SRC))
    assert files, f"praxis source dir must contain python files: {PRAXIS_SRC}"

    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")

    assert not violations, "\n".join(violations)
