#!/bin/sh
set -e

echo "==> Waiting for database..."
until nc -z "${DB_HOST:-db}" "${DB_PORT:-5432}" 2>/dev/null; do
  sleep 1
done
echo "==> Database is ready"

echo "==> Running Prisma migrations..."
npx prisma migrate deploy || {
  echo "FATAL: Migration failed"
  exit 1
}

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database..."
  npx tsx prisma/seed.ts || echo "WARN: Seed failed (non-fatal)"
fi

echo "==> Starting server..."
exec node server.js
