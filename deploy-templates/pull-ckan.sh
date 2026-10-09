#!/bin/sh
# Sync open data from the gemeente Den Haag OpenDataSoft portal
# (den-haag-opendata.opendatasoft.com). Run after seeding, and optionally on a
# schedule to keep data fresh. Pass --force for a one-time full re-sync (e.g.
# after a portal/schema migration); do NOT bake --force into a recurring job.
set -e

echo "==> Syncing open data (OpenDataSoft)"
node scripts/pull-ckan.mjs "$@"

echo "==> Open data sync complete"
