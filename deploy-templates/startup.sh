#!/bin/sh
set -e

echo "==> Running database migrations"
node ./node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

echo "==> Importing seed data in background (skipped if already present)"
( node scripts/seed.mjs 2>&1 | sed 's/^/[seed] /' || echo "[seed] failed non-fatally — check logs" ) &

echo "==> Starting API server"
exec node dist/index.js
