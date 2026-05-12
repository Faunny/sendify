#!/usr/bin/env bash
# Sendify — one-shot local setup
# Installs Node (via nvm) if missing, installs deps, starts Postgres+Redis, seeds DB, runs dev server.
set -euo pipefail

cd "$(dirname "$0")"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }

bold "▶ Sendify setup"

# ── Node via nvm if not present
if ! command -v node >/dev/null 2>&1; then
  yellow "node not found — installing via nvm"
  if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install 22
  nvm use 22
fi

green "✓ node $(node --version)"

# ── Dependencies
bold "▶ Installing dependencies"
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
else
  npm install
fi

# ── Local services
if command -v docker >/dev/null 2>&1; then
  bold "▶ Starting Postgres + Redis via Docker"
  docker compose up -d
else
  yellow "docker not found — start Postgres on :5432 and Redis on :6379 manually"
fi

# ── .env
if [ ! -f .env ]; then
  cp .env.example .env
  yellow "Created .env from template — edit it before running production tasks"
fi

# ── Prisma
bold "▶ Generating Prisma client + pushing schema"
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

green "✓ Setup complete"
bold "▶ Run: npm run dev   (then open http://localhost:3000)"
