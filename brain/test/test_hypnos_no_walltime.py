"""D-16-10 / T-16-03: Wall-clock grep gate for brain/src/noesis_brain/hypnos/**."""
import pathlib
import pytest

HYPNOS_DIR = pathlib.Path(__file__).parent.parent / "src" / "noesis_brain" / "hypnos"
FORBIDDEN_PATTERNS = [
    "datetime",
    "time.time",
    "random.random",
    "uuid.uuid4",
    "os.urandom",
]


def test_no_wall_clock_in_hypnos():
    if not HYPNOS_DIR.exists():
        pytest.skip("hypnos module not yet implemented (Wave 1+)")
    violations = []
    for py_file in HYPNOS_DIR.rglob("*.py"):
        source = py_file.read_text()
        for pattern in FORBIDDEN_PATTERNS:
            if pattern in source:
                violations.append(f"{py_file.name}: contains '{pattern}'")
    assert not violations, "Wall-clock forbidden in hypnos/: " + "; ".join(violations)
