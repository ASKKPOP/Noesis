#!/usr/bin/env bash
# Noēsis wiki helper. Usage: scripts/wiki.sh [serve|build|check|setup]
set -euo pipefail
cd "$(dirname "$0")/.."

VENV=".venv-wiki"

case "${1:-serve}" in
  setup)
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -r requirements-wiki.txt
    echo "✅ wiki env ready. Run: scripts/wiki.sh serve"
    ;;
  serve)
    [ -d "$VENV" ] || { echo "Run scripts/wiki.sh setup first"; exit 1; }
    "$VENV/bin/mkdocs" serve
    ;;
  build)
    [ -d "$VENV" ] || { echo "Run scripts/wiki.sh setup first"; exit 1; }
    # NOTE: --strict (fail on dangling links) is enabled at migration Step 6,
    # once every linked page exists. During migration, links to not-yet-moved
    # docs are expected.
    "$VENV/bin/mkdocs" build
    echo "✅ built static HTML wiki → site/"
    ;;
  check)
    node scripts/check-wiki.mjs
    ;;
  *)
    echo "Usage: scripts/wiki.sh [serve|build|check|setup]"; exit 1
    ;;
esac
