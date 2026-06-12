#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Noēsis — production deploy (AWS, noesiis.com)
#
# Pushes go to GitHub (origin/main). This script SSHes into the EC2 host,
# fast-forwards the checkout, and rebuilds + restarts the named services using
# the AWS compose overlay (nginx behind the ALB; TLS at the ALB).
#
#   ./deploy.sh                 # rebuild dashboard + guide (default)
#   ./deploy.sh dashboard       # just the dashboard (landing + embedded map)
#   ./deploy.sh grid            # just the Grid API
#   ./deploy.sh nginx guide mysql grid dashboard steward   # full stack
#
# Overridable via env: NOESIS_DEPLOY_KEY, NOESIS_DEPLOY_HOST, NOESIS_DEPLOY_DIR,
# NOESIS_DEPLOY_BRANCH.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

KEY="${NOESIS_DEPLOY_KEY:-$HOME/shell/sierrabiolab/sierrabiolab-aws.pem}"
HOST="${NOESIS_DEPLOY_HOST:-ec2-user@52.9.147.202}"
DIR="${NOESIS_DEPLOY_DIR:-~/noesiis}"
BRANCH="${NOESIS_DEPLOY_BRANCH:-main}"
COMPOSE="-f docker-compose.yml -f docker-compose.aws.yml --env-file .env"
SERVICES="${*:-dashboard guide}"

[ -f "$KEY" ] || { echo "✖ SSH key not found: $KEY"; exit 1; }

echo "▶ Deploying [$SERVICES] to $HOST:$DIR (branch $BRANCH)"

ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$HOST" bash -se <<EOF
set -euo pipefail
cd $DIR
echo "── pull ──────────────────────────────────────────"
git fetch origin $BRANCH
git checkout $BRANCH
git pull --ff-only origin $BRANCH
git log -1 --oneline
echo "── build + up: $SERVICES ─────────────────────────"
docker compose $COMPOSE up -d --build $SERVICES
echo "── status ────────────────────────────────────────"
docker compose $COMPOSE ps
EOF

echo "✔ Deploy complete — https://${NOESIS_DEPLOY_DOMAIN:-noesiis.com}"
