#!/usr/bin/env bash
# CI gate: three-tier content leak check for iris (D-17-17 invariant).
#
# Tier 1: Grid emitters (grid/src/iris/) — must not reference belief_content etc.
# Tier 2: Brain wire (brain/src/noesis_brain/rpc/) — metadata keys must not include content keys.
# Tier 3: Dashboard (dashboard/src/) — must not render iris belief content.
#
# Exits nonzero on any violation.
#
# Phase 17 Wave 4 — IRIS-TEST-05 / T-17-W4-01.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

FORBIDDEN_KEYS=(
    "belief_content"
    "target_content"
    "emotion_text"
    "dimension_text"
    "belief_prose"
    "iris_content"
)

TIERS=(
    "grid/src/iris"
    "brain/src/noesis_brain/rpc"
    "dashboard/src"
)

FOUND=0
for tier in "${TIERS[@]}"; do
    tier_path="$REPO_ROOT/$tier"
    [[ -d "$tier_path" ]] || continue
    for key in "${FORBIDDEN_KEYS[@]}"; do
        results=$(grep -rn "\"$key\"\|'$key'\|\`$key\`" "$tier_path" 2>/dev/null || true)
        if [[ -n "$results" ]]; then
            echo "VIOLATION: content key '$key' referenced in $tier:"
            echo "$results"
            FOUND=1
        fi
    done
done

if [[ $FOUND -eq 1 ]]; then
    echo "iris-content-leak-gate: FAILED — iris content keys must never cross the wire"
    exit 1
fi
echo "iris-content-leak-gate: OK — no content leak patterns found"
exit 0
