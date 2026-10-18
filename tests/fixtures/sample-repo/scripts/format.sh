#!/usr/bin/env bash
# Formats source files with Prettier after an AI edit.
set -euo pipefail
npx --no-install prettier --write "src/**/*.{ts,tsx}"
