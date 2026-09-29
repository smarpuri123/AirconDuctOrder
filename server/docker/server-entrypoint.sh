#!/bin/sh
set -e

echo "==> Prisma db push"
npx prisma db push

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "==> Seeding database (set RUN_DB_SEED=false after first successful deploy)"
  if ! npx tsx prisma/seed.ts; then
    echo "ERROR: database seed failed (see logs above). API will not start." >&2
    exit 1
  fi
fi

exec "$@"
