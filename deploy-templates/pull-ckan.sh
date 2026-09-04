#!/bin/sh
# Sync CKAN datasets from ckan.dataplatform.nl.
# Run after seeding, and optionally on a schedule to keep data fresh.
set -e

echo "==> Syncing CKAN datasets"
node scripts/pull-ckan.mjs

echo "==> CKAN sync complete"
