#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROTA_EDITORIAL_ROOT:-/mnt/c/Users/Lenovo/Desktop/Rota de Ataque/Sistema de Design/plataforma}"
ENV_FILE="${ROTA_EDITORIAL_ENV_FILE:-$ROOT_DIR/docker/.env.phase7.local}"
COMPOSE_FILE="${ROTA_EDITORIAL_COMPOSE_FILE:-$ROOT_DIR/docker/docker-compose.production.yml}"
COMPOSE_OVERRIDE_FILE="${ROTA_EDITORIAL_COMPOSE_OVERRIDE_FILE:-$ROOT_DIR/docker/docker-compose.editorial-shared.yml}"
PROJECT_NAME="${ROTA_EDITORIAL_PROJECT_NAME:-rota-editorial-fase7}"
TAG="${IMAGE_TAG:-}"

[[ "$TAG" =~ ^[0-9a-fA-F]{7,40}$ ]] || { echo "FAIL: IMAGE_TAG must be an immutable release tag (7-40 hex characters)" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "FAIL: production environment file not found" >&2; exit 1; }
docker image inspect "ghcr.io/leoalvespak-alt/rota-editorial-executor:$TAG" >/dev/null 2>&1 || {
  echo "FAIL: local editorial executor image is missing for IMAGE_TAG" >&2
  exit 1
}

export EDITORIAL_EXECUTOR_ENABLED=true
exec docker compose \
  --project-name "$PROJECT_NAME" \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  -f "$COMPOSE_OVERRIDE_FILE" \
  --profile editorial-runtime \
  run --rm --no-deps editorial-executor
