#!/bin/sh
# One-time seed: imports the bundled documents.json.gz into the database.
# Run after the first successful deploy, once POSTGRES_URL is set.
set -e

echo "==> Importing seed documents"
node scripts/seed.mjs

echo "==> Seed complete"
