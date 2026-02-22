#!/bin/sh

echo "Running database migration..."
pnpm db:push 2>&1 || {
  echo "Warning: Database migration failed. Check database connection."
  echo "The application will start anyway."
}

echo "Starting FitEvo..."
exec pnpm start
