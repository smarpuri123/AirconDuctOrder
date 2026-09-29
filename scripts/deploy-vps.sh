#!/usr/bin/env bash
# Run on the VPS after git pull (also invoked by GitHub Actions deploy workflow).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ecovent}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

if [[ ! -d .git ]]; then
  echo "Not a git checkout: $APP_DIR" >&2
  exit 1
fi

echo "==> Fetch $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [[ ! -f server/.env ]]; then
  echo "Missing server/.env — create it on the VPS (see docs/DEPLOYMENT_VPS.md)" >&2
  exit 1
fi

echo "==> API dependencies & database"
cd server
npm ci
npx prisma generate
npx prisma db push
npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe ecovent-api >/dev/null 2>&1; then
    pm2 restart ecovent-api
  else
    pm2 start dist/index.js --name ecovent-api
    pm2 save
  fi
else
  echo "pm2 not found — start API manually: node dist/index.js" >&2
fi

echo "==> Frontend build"
cd "$APP_DIR"
npm ci

if [[ ! -f .env.production ]]; then
  echo "Warning: .env.production missing; using VITE_USE_API=true VITE_API_URL=/api" >&2
  export VITE_USE_API=true
  export VITE_API_URL=/api
fi

npm run build

echo "==> Deploy finished ($(date -Is))"
