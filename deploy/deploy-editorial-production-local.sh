#!/usr/bin/env bash
set -euo pipefail

# Production deploy for the Design System + Prospector stack hosted on WSL2.
# Images are built locally or pulled by immutable release tag, then promoted
# after idempotent migrations. An enabled executor is supervised by systemd.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROTA_EDITORIAL_COMPOSE_FILE:-$ROOT_DIR/docker/docker-compose.production.yml}"
COMPOSE_OVERRIDE_FILE="${ROTA_EDITORIAL_COMPOSE_OVERRIDE_FILE:-}"
ENV_FILE="${ROTA_EDITORIAL_ENV_FILE:-$ROOT_DIR/docker/.env.phase7.local}"
PROJECT_NAME="${ROTA_EDITORIAL_PROJECT_NAME:-rota-editorial-fase7}"
EXECUTOR_UNIT="rota-editorial-executor.service"
EXECUTOR_SYSTEMD_FILE="/etc/systemd/system/$EXECUTOR_UNIT"
EXECUTOR_ENV_FILE="/etc/rota-editorial/editorial-executor.env"
TAG="${1:-}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

[[ "$TAG" =~ ^[0-9a-fA-F]{7,40}$ ]] || fail "use the immutable Git SHA tag (7-40 hexadecimal characters)"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v curl >/dev/null 2>&1 || fail "curl is not installed"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"
if [[ -n "$COMPOSE_OVERRIDE_FILE" ]]; then
  [[ -f "$COMPOSE_OVERRIDE_FILE" ]] || fail "compose override file not found: $COMPOSE_OVERRIDE_FILE"
fi
[[ -f "$ENV_FILE" ]] || fail "production env file not found: $ENV_FILE"

cd "$ROOT_DIR"
export IMAGE_TAG="$TAG"
export RELEASE_ID="${RELEASE_ID:-$TAG}"
COMPOSE=(docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
if [[ -n "$COMPOSE_OVERRIDE_FILE" ]]; then
  COMPOSE+=(-f "$COMPOSE_OVERRIDE_FILE")
fi
EXECUTOR_REQUESTED="${EDITORIAL_EXECUTOR_ENABLED:-false}"
EXECUTOR_PREVIOUSLY_ENABLED=false
if sudo -n systemctl is-enabled --quiet "$EXECUTOR_UNIT" 2>/dev/null; then
  EXECUTOR_PREVIOUSLY_ENABLED=true
fi
EXECUTOR_MANAGED=false
if [[ "$EXECUTOR_REQUESTED" == "true" || "$EXECUTOR_PREVIOUSLY_ENABLED" == "true" ]]; then
  EXECUTOR_MANAGED=true
fi

echo "=== Editorial production deploy: $TAG ==="
echo "--- Validating Compose configuration ---"
"${COMPOSE[@]}" config --quiet

if [[ "${ROTA_EDITORIAL_SKIP_IMAGE_PULL:-false}" == "true" ]]; then
  echo "--- Using locally built immutable images ---"
  for image in \
    "ghcr.io/leoalvespak-alt/prospector-platform-migrations:$TAG" \
    "ghcr.io/leoalvespak-alt/prospector-platform-web:$TAG" \
    "ghcr.io/leoalvespak-alt/rota-design-api:$TAG" \
    "ghcr.io/leoalvespak-alt/rota-design-web:$TAG"; do
    docker image inspect "$image" >/dev/null 2>&1 || fail "required local image is missing: $image"
  done
  if [[ "$EXECUTOR_MANAGED" == "true" ]]; then
    docker image inspect "ghcr.io/leoalvespak-alt/rota-editorial-executor:$TAG" >/dev/null 2>&1 || fail "required local executor image is missing: ghcr.io/leoalvespak-alt/rota-editorial-executor:$TAG"
  fi
else
  echo "--- Pulling immutable images from GHCR ---"
  "${COMPOSE[@]}" pull
  if [[ "$EXECUTOR_MANAGED" == "true" ]]; then
    docker pull "ghcr.io/leoalvespak-alt/rota-editorial-executor:$TAG"
  fi
fi

if [[ "$EXECUTOR_MANAGED" == "true" ]] && sudo -n systemctl is-active --quiet "$EXECUTOR_UNIT" 2>/dev/null; then
  echo "--- Stopping the systemd executor before migrations ---"
  sudo -n systemctl stop "$EXECUTOR_UNIT"
fi

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

if [[ "$EXECUTOR_MANAGED" == "true" ]]; then
  echo "--- Installing and starting the systemd editorial executor ---"
  sudo -n install -d -m 0755 /etc/rota-editorial
  printf 'IMAGE_TAG=%s\n' "$TAG" | sudo -n tee "$EXECUTOR_ENV_FILE.tmp" >/dev/null
  sudo -n chmod 0644 "$EXECUTOR_ENV_FILE.tmp"
  sudo -n mv "$EXECUTOR_ENV_FILE.tmp" "$EXECUTOR_ENV_FILE"
  sudo -n install -m 0644 "$ROOT_DIR/deploy/systemd/rota-editorial-executor.service" "$EXECUTOR_SYSTEMD_FILE"
  sudo -n systemctl daemon-reload
  sudo -n systemctl enable --now "$EXECUTOR_UNIT"
  sudo -n systemctl is-active --quiet "$EXECUTOR_UNIT" || fail "systemd editorial executor is not active"
fi

echo "--- Running containers ---"
"${COMPOSE[@]}" ps
echo "=== Editorial production deploy complete: $TAG ==="
