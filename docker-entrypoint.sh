#!/bin/sh
set -e

echo "==> Waiting for database..."
until nc -z "${DB_HOST:-postgres}" "${DB_PORT:-5432}" 2>/dev/null; do
  sleep 1
done
echo "==> Database is ready"

echo "==> Running Prisma migrations..."
pnpm exec prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database..."
  pnpm exec tsx prisma/seed.ts || echo "WARN: Seed failed"
else
  echo "==> Skipping seed. Set RUN_SEED=true to enable."
fi

echo "==> Starting server..."
exec pnpm start
