#!/bin/sh
set -e

echo "==> Waiting for database..."
until nc -z "${DB_HOST:-postgres}" "${DB_PORT:-5432}" 2>/dev/null; do
  sleep 1
done
echo "==> Database is ready"

echo "==> Pushing Prisma schema..."
npx prisma db push --accept-data-loss || {
  echo "FATAL: Database schema push failed"
  exit 1
}

echo "==> Seeding database..."
npx tsx prisma/seed.ts || echo "WARN: Seed failed (non-fatal, may already be seeded)"

echo "==> Starting server..."
exec pnpm start
