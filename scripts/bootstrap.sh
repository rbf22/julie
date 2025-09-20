#!/usr/bin/env bash
set -euo pipefail

echo ">>> Installing JS deps"

if [ -d "apps/web" ]; then
  pnpm -C apps/web install
else
  echo "(!) Skipping apps/web (folder not found)"
fi

if [ -d "server" ]; then
  pnpm -C server install
else
  echo "(!) Skipping server (folder not found)"
fi

# Optional shared package — only if present
if [ -d "packages/shared" ]; then
  pnpm -C packages/shared install
else
  echo "(!) Skipping packages/shared (folder not found)"
fi

echo ">>> Sync Python deps with uv"
if [ -d "python" ]; then
  (cd python && uv sync --dev)
else
  echo "(!) Skipping python (folder not found)"
fi

pnpm config set ignore-scripts false || true

echo ">>> Done. Next:"
echo "    1) pnpm -C server dev"
echo "    2) pnpm -C apps/web dev"