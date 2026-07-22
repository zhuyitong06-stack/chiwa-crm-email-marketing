#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
NODE_BIN="/Users/ricky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
PNPM_BIN="/Users/ricky/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback"

cd "$BACKEND_DIR"

if [ -d "$NODE_BIN" ]; then
  export PATH="$NODE_BIN:$PATH"
fi

if [ -d "$PNPM_BIN" ]; then
  export PATH="$PNPM_BIN:$PATH"
fi

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm start
fi

if [ -x "$PNPM_BIN/pnpm" ]; then
  exec "$PNPM_BIN/pnpm" start
fi

echo "pnpm was not found. Install Node.js 24 and pnpm, then run: cd backend && pnpm start" >&2
exit 1
