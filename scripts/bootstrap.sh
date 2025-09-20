#!/usr/bin/env bash
set -e

echo ">>> Installing JS deps"
pnpm -C apps/web install
pnpm -C server install
pnpm -C packages/shared install

echo ">>> Sync Python deps with uv"
cd python
uv sync --dev
cd -

echo ">>> Done. Use: pnpm -C server dev  (then) pnpm -C apps/web dev"
