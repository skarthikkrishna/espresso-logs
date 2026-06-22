#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.evidence.yml"
DATABASE_URL_VALUE="postgresql+asyncpg://espresso:espresso@127.0.0.1:5433/spec043_evidence"
LOG_DIR="$ROOT_DIR/.logs"
BACKEND_LOG="$LOG_DIR/spec043-evidence-backend.log"
FRONTEND_LOG="$LOG_DIR/spec043-evidence-frontend.log"
backend_pid=""
frontend_pid=""

mkdir -p "$LOG_DIR"

cleanup_servers() {
  if [[ -n "${frontend_pid:-}" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid"
    wait "$frontend_pid" 2>/dev/null || true
  fi
  if [[ -n "${backend_pid:-}" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid"
    wait "$backend_pid" 2>/dev/null || true
  fi
}

db_up() {
  docker compose -f "$COMPOSE_FILE" up -d spec043-evidence-db
  docker compose -f "$COMPOSE_FILE" exec -T spec043-evidence-db sh -c \
    'until pg_isready -U espresso -d spec043_evidence; do sleep 1; done'
}

db_down() {
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
}

migrate() {
  (
    cd "$ROOT_DIR"
    APP_ENV=test USE_POSTGRES=true DATABASE_URL="$DATABASE_URL_VALUE" uv run alembic upgrade head
  )
}

wait_for_url() {
  local url="$1"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

capture() {
  trap cleanup_servers RETURN EXIT INT TERM

  (
    cd "$ROOT_DIR"
    APP_ENV=test \
      USE_POSTGRES=true \
      E2E_AUTH_BYPASS=1 \
      SPREADSHEET_ID=dummy \
      SESSION_SECRET=spec043-local-session-secret-32-characters-minimum \
      JWT_SECRET=spec043-local-jwt-secret-32-characters-minimum \
      DATABASE_URL="$DATABASE_URL_VALUE" \
      exec uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 >"$BACKEND_LOG" 2>&1
  ) &
  backend_pid="$!"
  wait_for_url "http://127.0.0.1:8000/health"

  (
    cd "$ROOT_DIR/frontend"
    npm run build
  )
  (
    cd "$ROOT_DIR/frontend"
    exec ./node_modules/.bin/vite --host 127.0.0.1 >"$FRONTEND_LOG" 2>&1
  ) &
  frontend_pid="$!"
  wait_for_url "http://127.0.0.1:5173/"

  (
    cd "$ROOT_DIR/frontend"
    PW_BASE_URL=http://127.0.0.1:8000 npx playwright test e2e/spec043-screenshot-grid.spec.ts --project=chromium
  )
}

case "${1:-run}" in
  up)
    db_up
    ;;
  down)
    db_down
    ;;
  migrate)
    migrate
    ;;
  capture)
    capture
    ;;
  run)
    db_up
    migrate
    capture
    db_down
    ;;
  *)
    echo "Usage: $0 [up|down|migrate|capture|run]" >&2
    exit 2
    ;;
esac
