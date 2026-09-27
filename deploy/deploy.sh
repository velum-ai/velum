#!/usr/bin/env bash
set -euo pipefail

# Pulls the given branch and deploys it via docker compose, safely: lint,
# the test suite, and the Next.js build all run inside `docker compose
# build` itself (see the Dockerfile's `test` stage), so a broken commit
# fails the build before any running container is touched. `--wait` blocks
# until the new container reports healthy (see the Dockerfile's
# HEALTHCHECK, hitting /api/health); if it doesn't in time, this rolls back
# to the previous image automatically.
#
# Run from the persistent git clone on the deploy host:
#   cd /opt/velum && bash deploy/deploy.sh [branch]

cd "$(dirname "$0")/.."

BRANCH="${1:-main}"
SERVICE="velum"
ROLLBACK_TAG="velum-rollback:latest"

echo "==> fetching origin/$BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

IMAGE="$(docker compose config --images "$SERVICE")"
PREV_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || true)"

echo "==> building (lint + test + next build all run inside this step)"
docker compose build "$SERVICE"
[ -n "$PREV_ID" ] && docker tag "$PREV_ID" "$ROLLBACK_TAG"

echo "==> deploying, waiting for healthy"
if docker compose up -d --force-recreate --wait --wait-timeout 90 "$SERVICE"; then
  echo "==> healthy, deploy complete ($IMAGE)"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

echo "==> did not become healthy in time, rolling back"
if docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
  docker tag "$ROLLBACK_TAG" "$IMAGE"
  docker compose up -d --force-recreate --wait "$SERVICE"
  echo "==> rolled back to the previous image, it was serving before this deploy"
else
  echo "==> no previous image on this host to roll back to, left as-is, investigate manually"
fi
exit 1
