#!/usr/bin/env bash
# Self-hosted deploy script for PT Ibukota Valasindo back office.
# Run this ON THE PRODUCTION SERVER, from the repo root, as the deploy user
# (never as root). It is meant to be idempotent: safe to re-run if a step fails.
#
# What it does, in order: backs up the database, pulls main, installs deps,
# applies pending Drizzle migrations, builds, restarts the pm2 process, then
# does a plain HTTP smoke check. It stops (set -e) on the first failure so a
# bad step never silently continues into "restart the app with broken code".
#
# Required env (put these in the server's shell profile or an .env this
# script sources — never commit real values):
#   DATABASE_URL        - same value the app uses (drizzle.config.ts needs it)
#   PM2_APP_NAME         - pm2 process name (default: moneychanger)
#   PORT                 - port the app listens on (default: 3000)
#   SKIP_DB_BACKUP        - set to "1" to skip the mysqldump step (not recommended)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

PM2_APP_NAME="${PM2_APP_NAME:-ibv-backoffice}"
PORT="${PORT:-3000}"
BACKUP_DIR="$REPO_DIR/backups"

log() { printf '\n[deploy] %s\n' "$1"; }

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[deploy] DATABASE_URL is not set (checked env and ./.env). Aborting before touching anything." >&2
  exit 1
fi

log "Step 1/6: database backup"
if [ "${SKIP_DB_BACKUP:-0}" = "1" ]; then
  echo "[deploy] SKIP_DB_BACKUP=1 set — skipping backup. Only do this if a fresh backup already exists."
else
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql.gz"
  # Parse mysql://user:pass@host:port/dbname out of DATABASE_URL without a subshell eval.
  DB_USER=$(node -e "console.log(new URL(process.env.DATABASE_URL).username)")
  DB_PASS=$(node -e "console.log(decodeURIComponent(new URL(process.env.DATABASE_URL).password))")
  DB_HOST=$(node -e "console.log(new URL(process.env.DATABASE_URL).hostname)")
  DB_PORT=$(node -e "const u=new URL(process.env.DATABASE_URL); console.log(u.port || 3306)")
  DB_NAME=$(node -e "console.log(new URL(process.env.DATABASE_URL).pathname.replace(/^\//,''))")
  MYSQL_PWD="$DB_PASS" mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
  echo "[deploy] Backup written to $BACKUP_FILE"
fi

log "Step 2/6: git pull origin main"
git fetch origin main
git status --porcelain --untracked-files=no | grep -q . && { echo "[deploy] Tracked files have uncommitted changes. Aborting — commit, stash, or discard first." >&2; exit 1; }
git checkout main
git pull --ff-only origin main

log "Step 3/6: install dependencies"
corepack pnpm install --frozen-lockfile

log "Step 4/6: apply database migrations"
corepack pnpm exec drizzle-kit migrate

log "Step 5/6: build"
corepack pnpm build

log "Step 6/6: restart pm2 process ($PM2_APP_NAME) and smoke-check"
pm2 restart "$PM2_APP_NAME" --update-env
sleep 3
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/" || echo "000")
if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 500 ]; then
  echo "[deploy] Smoke check failed: got HTTP $HTTP_STATUS from http://127.0.0.1:${PORT}/. Check 'pm2 logs $PM2_APP_NAME'." >&2
  exit 1
fi

log "Deploy finished. HTTP smoke check: $HTTP_STATUS. Run through the manual checklist in the deploy notes before calling it done."
