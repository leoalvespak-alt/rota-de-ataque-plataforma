#!/usr/bin/env bash
set -euo pipefail

# Production deploy for the Design System + Prospector stack hosted on the
# production WSL machine. GitHub Actions builds immutable GHCR images; this
# script only pulls a commit tag, runs idempotent migrations, and promotes it.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROTA_EDITORIAL_COMPOSE_FILE:-$ROOT_DIR/docker/docker-compose.production.yml}"
ENV_FILE="${ROTA_EDITORIAL_ENV_FILE:-$ROOT_DIR/docker/.env.phase7.local}"
PROJECT_NAME="${ROTA_EDITORIAL_PROJECT_NAME:-rota-editorial-fase7}"
TAG="${1:-}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

[[ "$TAG" =~ ^[0-9a-fA-F]{7,40}$ ]] || fail "use the immutable Git SHA tag (7-40 hexadecimal characters)"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || fail "production env file not found: $ENV_FILE"

cd "$ROOT_DIR"
export IMAGE_TAG="$TAG"
COMPOSE=(docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

echo "=== Editorial production deploy: $TAG ==="
echo "--- Validating Compose configuration ---"
"${COMPOSE[@]}" config --quiet

echo "--- Pulling immutable images from GHCR ---"
"${COMPOSE[@]}" pull

echo "--- Running Prospector migrations ---"
"${COMPOSE[@]}" run --rm --no-deps prospector-migrate

echo "--- Running Design System migrations ---"
"${COMPOSE[@]}" run --rm --no-deps design-migrate

echo "--- Promoting the production stack ---"
"${COMPOSE[@]}" up -d --no-build --no-deps prospector-web design-api design-web editorial-caddy

wait_for_health() {
  local url="$1"
  local code
  for ((i = 1; i <= 30; i += 1)); do
    code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$url" || true)"
    if [[ "$code" == "200" ]]; then
      echo "Health OK: $url"
      return 0
    fi
    sleep 3
  done
  echo "Health failed: $url (last HTTP ${code:-000})" >&2
  return 1
}

wait_for_health "http://127.0.0.1:8080/prospector/api/health/live"
wait_for_health "http://127.0.0.1:8080/api/health"

echo "--- Running containers ---"
"${COMPOSE[@]}" ps
echo "=== Editorial production deploy complete: $TAG ==="
