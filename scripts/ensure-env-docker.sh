#!/usr/bin/env bash
# Ensures .env.docker exists on the VPS (never committed to git).
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.docker}"
APP_DIR="${APP_DIR:-$(pwd)}"
cd "$APP_DIR"

if [[ -f "$ENV_FILE" ]]; then
  exit 0
fi

if [[ -n "${ENV_DOCKER_B64:-}" ]]; then
  echo "==> Creating $ENV_FILE from ENV_DOCKER_B64 (GitHub Actions secret)"
  echo "$ENV_DOCKER_B64" | base64 -d > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  exit 0
fi

if [[ -f .env.docker.example ]]; then
  cat >&2 <<EOF
Missing $ENV_FILE (secrets are not stored in git).

On the VPS, run once:
  cp .env.docker.example $ENV_FILE
  nano $ENV_FILE

Or store the file in GitHub Actions:
  1. Create $ENV_FILE locally from .env.docker.example
  2. Base64-encode it and add secret ENV_DOCKER_B64 (see docs/GITHUB_ACTIONS_VPS.md)

Template in git: .env.docker.example
EOF
  exit 1
fi

echo "Missing $ENV_FILE and .env.docker.example" >&2
exit 1
