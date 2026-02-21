#!/bin/sh

echo "Running database migration..."
node ./node_modules/prisma/build/index.js db push --skip-generate 2>&1 || {
  echo "Warning: Database migration failed. Check database connection."
  echo "The application will start anyway."
}

echo "Starting FitEvo..."
exec node server.js
