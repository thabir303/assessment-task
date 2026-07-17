#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_dir"

fail() {
  printf 'init.sh: %s\n' "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js 22.18.0 or newer is required. Install Node.js, then rerun ./init.sh."
command -v npm >/dev/null 2>&1 || fail "npm is required. Install npm, then rerun ./init.sh."

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then
  fail "Found Node.js $(node --version); Node.js 22.18.0 or newer is required."
fi

if [ ! -f package.json ]; then
  fail "package.json is missing; run this script from the repository root."
fi

if [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then
    printf 'Installing locked workspace dependencies with npm ci...\n'
    npm ci
  else
    printf 'Installing declared workspace dependencies with npm install...\n'
    npm install
  fi
else
  printf 'Dependencies already exist; skipping installation.\n'
fi

config_file=""
if [ -f .env.local ]; then
  config_file=".env.local"
elif [ -f .env ]; then
  config_file=".env"
fi

if [ -n "$config_file" ]; then
  if rg -q '^NEXT_PUBLIC_CONVEX_URL=http://' "$config_file"; then
    fail "NEXT_PUBLIC_CONVEX_URL in $config_file must be an HTTPS URL when set."
  fi
  if rg -q '^AGENT_RUNNER_PORT=([^0-9]|$)' "$config_file"; then
    fail "AGENT_RUNNER_PORT in $config_file must be a whole-number port."
  fi
  printf 'Validated safe local configuration shape in %s.\n' "$config_file"
else
  printf 'No local environment file found. The static shell can run; copy .env.example to .env.local before Convex or external integration work.\n'
fi

npm run check:structure

printf '\nBaseline smoke check passed.\n'
printf 'Start the local frontend: npm run dev\n'
printf 'After configuring Convex, start its development environment: npx convex dev\n'
printf 'This script never provisions Daytona resources.\n'
