"""Phase 10a Plan 06 Task 1 Test D — Wall-clock grep gate (Brain side).

T-10a-29 / T-09-03 defense: `brain/src/noesis_brain/ananke/**` MUST NOT
reference `time.time`, `time.monotonic`, `time.perf_counter`,
`datetime.now`, `datetime.utcnow`, `random.random`, `random.seed`, or
`uuid.uuid4`. The drive math consumes tick deltas only — all time must
flow from the audit chain tick (carried explicitly into AnankeRuntime.
step(tick)), and all randomness must be seeded from the per-Nous seed
derived SHA256(did)[:8] at constructor time.

Gate pattern: mirrors grid/test/ci/ananke-no-walltime.test.ts shape
(Python-side). Walks brain/src/noesis_brain/ananke/**/*.py, collects
any offending files into a list, asserts the list is empty so the
failure message names the offending file + matched snippet.

Running on every commit means: if a future edit introduces e.g. a
timing-based throttle, the CI gate breaks immediately with a clear
diagnostic.

Note on path discovery: `brain/test/` is flat per pyproject.toml
testpaths. Placing this file directly under brain/test/ (not under a
`ci/` subfolder) keeps discovery trivial.
"""

from __future__ import annotations

import re
from pathlib import Path

ANANKE_SRC = Path(__file__).resolve().parents[1] / "src" / "noesis_brain" / "ananke"

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


def test_ananke_no_walltime_or_nondeterminism() -> None:
    assert ANANKE_SRC.is_dir(), f"ananke source dir must exist: {ANANKE_SRC}"
    files = list(_iter_py_files(ANANKE_SRC))
    assert files, f"ananke source dir must contain python files: {ANANKE_SRC}"

    violations: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        for name, regex in FORBIDDEN_PATTERNS:
            m = regex.search(text)
            if m:
                violations.append(f"{path}: {name} (matched {m.group(0)!r})")

    assert not violations, "\n".join(violations)
