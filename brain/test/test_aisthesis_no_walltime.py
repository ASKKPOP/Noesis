"""v3.3 Mind — Wall-clock grep gate for the aisthesis faculty (Brain side).

Perception must be deterministic and pure given inputs: `aisthesis/**` MUST NOT
reference wall-clock or nondeterministic sources. Successive perceptions diff two
world-sight snapshots only — no time, no randomness — so the same inputs always
yield the same percepts (contract test: test_aisthesis.test_deterministic_ordering).

Mirrors test_ananke_no_walltime.py exactly (walk the faculty src dir, collect any
offending files, assert empty so the failure names the file + matched snippet).
"""

from __future__ import annotations

import re
from pathlib import Path

AISTHESIS_SRC = Path(__file__).resolve().parents[1] / "src" / "noesis_brain" / "aisthesis"

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


def test_aisthesis_no_walltime_or_nondeterminism() -> None:
    assert AISTHESIS_SRC.is_dir(), f"aisthesis source dir must exist: {AISTHESIS_SRC}"
    files = list(_iter_py_files(AISTHESIS_SRC))
    assert files, f"aisthesis source dir must contain python files: {AISTHESIS_SRC}"

    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")

    assert not violations, "\n".join(violations)
