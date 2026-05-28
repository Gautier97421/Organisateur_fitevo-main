#!/bin/sh
set -e

export CI=true
export PNPM_CONFIRM_MODULES_PURGE=false

echo "==> Node version:"
node --version

echo "==> pnpm version:"
pnpm --version

echo "==> Waiting for database..."
until nc -z "${DB_HOST:-postgres}" "${DB_PORT:-5432}" 2>/dev/null; do
  sleep 1
done
echo "==> Database is ready"

echo "==> Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "==> Seeding database..."
  ./node_modules/.bin/tsx prisma/seed.ts || echo "WARN: Seed failed"
else
  echo "==> Skipping seed. Set RUN_SEED=true to enable."
fi

echo "==> Starting server..."
exec ./node_modules/.bin/next start
