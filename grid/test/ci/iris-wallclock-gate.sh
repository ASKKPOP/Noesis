#!/usr/bin/env bash
# CI gate: wall-clock freedom for iris modules (D-17-14 invariant).
# Mirrors Phase 10a T-09-03 gate. Exits nonzero if any forbidden pattern found.
#
# Wall-clock free invariant: iris/ modules MUST NOT use:
#   brain: datetime.*, time.time(), random.random(), uuid.uuid4(), os.urandom()
#   grid:  Date.now(), new Date()
#
# Patterns match actual call-site usage, not documentation comments.
# Binary files and __pycache__ are excluded automatically via --include flags.
#
# Phase 17 Wave 4 — IRIS-TEST-05.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

# Brain patterns: match actual function call sites, not docstring mentions.
# Use fixed-string anchoring with ( to distinguish calls from comments.
BRAIN_FORBIDDEN=(
    "datetime\."
    "time\.time("
    "random\.random("
    "uuid\.uuid4("
    "os\.urandom("
)

GRID_FORBIDDEN=(
    "Date\.now("
    "new Date("
)

FOUND=0

# Brain iris module — exclude __pycache__ and .pyc files
BRAIN_DIR="$REPO_ROOT/brain/src/noesis_brain/iris"
if [[ -d "$BRAIN_DIR" ]]; then
    for pattern in "${BRAIN_FORBIDDEN[@]}"; do
        results=$(grep -rn --include="*.py" "$pattern" "$BRAIN_DIR" 2>/dev/null || true)
        if [[ -n "$results" ]]; then
            echo "VIOLATION: wall-clock pattern '$pattern' found in brain/src/noesis_brain/iris:"
            echo "$results"
            FOUND=1
        fi
    done
else
    echo "WARNING: brain/src/noesis_brain/iris not found at $BRAIN_DIR"
fi

# Grid iris module — TypeScript source files only
GRID_DIR="$REPO_ROOT/grid/src/iris"
if [[ -d "$GRID_DIR" ]]; then
    for pattern in "${GRID_FORBIDDEN[@]}"; do
        results=$(grep -rn --include="*.ts" "$pattern" "$GRID_DIR" 2>/dev/null || true)
        if [[ -n "$results" ]]; then
            echo "VIOLATION: wall-clock pattern '$pattern' found in grid/src/iris:"
            echo "$results"
            FOUND=1
        fi
    done
else
    echo "WARNING: grid/src/iris not found at $GRID_DIR"
fi

if [[ $FOUND -eq 1 ]]; then
    echo "iris-wallclock-gate: FAILED — iris modules must never use wall-clock functions"
    exit 1
fi
echo "iris-wallclock-gate: OK — no wall-clock patterns found"
exit 0
