#!/usr/bin/env bash
# VPS deploy: git pull + Docker Compose production stack.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ecovent}"
BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.docker}"

cd "$APP_DIR"

if [[ ! -d .git ]]; then
  echo "Not a git checkout: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.docker.example to $ENV_FILE on the VPS" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. See docs/DOCKER_VPS.md" >&2
  exit 1
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo "==> Fetch $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Build images"
"${COMPOSE[@]}" build

echo "==> Start / update containers"
"${COMPOSE[@]}" up -d

echo "==> Status"
"${COMPOSE[@]}" ps

echo "==> Deploy finished ($(date -Is))"
