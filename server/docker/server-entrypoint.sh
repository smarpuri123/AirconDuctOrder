#!/bin/sh
set -e

echo "==> Prisma db push"
npx prisma db push

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "==> Seeding database"
  npx tsx prisma/seed.ts
fi

exec "$@"
