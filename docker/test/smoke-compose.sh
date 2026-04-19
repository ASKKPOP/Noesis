#!/usr/bin/env bash
# Local-only compose smoke. CI-deferred per D13 (Playwright E2E deferred).
# Usage: docker/test/smoke-compose.sh
#   Brings up the full stack, polls grid + dashboard healthchecks, tears down.
set -euo pipefail

cleanup() { docker compose down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker compose up -d --build

wait_for() {
    local url=$1 name=$2 retries=30
    until curl -fsS "$url" >/dev/null 2>&1; do
        retries=$((retries - 1))
        if [[ $retries -le 0 ]]; then
            echo "✖ $name never came up ($url)" >&2
            docker compose logs --tail=100
            exit 1
        fi
        sleep 2
    done
    echo "✓ $name OK ($url)"
}

wait_for "http://localhost:${GRID_PORT:-8080}/health"                  "grid"
wait_for "http://localhost:${DASHBOARD_PORT:-3001}/api/dash/health"    "dashboard"

echo "✓ smoke-compose passed"
