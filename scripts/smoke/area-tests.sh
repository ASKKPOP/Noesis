#!/usr/bin/env bash
# Run only one feature area's unit tests across grid, dashboard and brain —
# the local tier of docs/test-scenarios.html. No database, no Docker, no model.
#
#   scripts/smoke/area-tests.sh registration
#   scripts/smoke/area-tests.sh --list
#
# Env: BRAIN_PY — Python with the Brain's deps (default brain/.venv/bin/python).
set -euo pipefail
cd "$(dirname "$0")/../.."

AREAS="registration chat groups city polis economy library audit health"
pattern() {
  case "$1" in
    registration) echo 'nous-registration|registry-brain-key|registry-routes|brain-token|portal-civic|human-charter|enrollment' ;;
    chat)         echo 'chat|conversation|inbox' ;;
    groups)       echo 'group' ;;
    city)         echo 'parcel|zoning|civic-map|orbital|residence' ;;
    polis)        echo 'gov|polis|bill|ballot|governance' ;;
    economy)      echo 'market|irs|treasury|trade|procurement|due|escrow|wallet' ;;
    library)      echo 'library|lore|curator' ;;
    audit)        echo 'audit|chain|firehose' ;;
    health)       echo 'health|system-map|watchdog|status' ;;
  esac
}

if [[ -z "${1:-}" || "$1" == "--list" ]]; then
  for a in $AREAS; do echo "$a"; done
  [[ -z "${1:-}" ]] && { echo "usage: $0 <area>" >&2; exit 2; }
  exit 0
fi
re="$(pattern "$1")"
[[ -z "$re" ]] && { echo "unknown area: $1 (try --list)" >&2; exit 2; }

status=0
grid=$(cd grid && find test -name '*.test.ts' | grep -Ei "$re" || true)
dash=$(cd dashboard && find src -name '*.test.ts' -o -name '*.test.tsx' | grep -Ei "$re" || true)
brain=$(cd brain && find test -name 'test_*.py' | grep -Ei "$re" || true)

if [[ -n "$grid" ]]; then
  echo "── grid ($(wc -l <<<"$grid" | tr -d ' ') files)"
  (cd grid && npx vitest run $grid 2>&1 | grep -E 'Test Files|Tests |FAIL') || status=1
fi
if [[ -n "$dash" ]]; then
  echo "── dashboard ($(wc -l <<<"$dash" | tr -d ' ') files)"
  (cd dashboard && npx vitest run $dash 2>&1 | grep -E 'Test Files|Tests |FAIL') || status=1
fi
if [[ -n "$brain" ]]; then
  py="${BRAIN_PY:-$PWD/brain/.venv/bin/python}"
  if [[ -x "$py" ]]; then
    echo "── brain ($(wc -l <<<"$brain" | tr -d ' ') files)"
    (cd brain && PYTHONPATH=src "$py" -m pytest -q $brain 2>&1 | tail -1) || status=1
  else
    echo "── brain: skipped (no Python at $py; set BRAIN_PY)"
  fi
fi
exit $status
