#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${ROTA_EDITORIAL_COMPOSE_FILE:-$ROOT_DIR/docker/docker-compose.production.yml}"
COMPOSE_OVERRIDE_FILE="${ROTA_EDITORIAL_COMPOSE_OVERRIDE_FILE:-$ROOT_DIR/docker/docker-compose.editorial-shared.yml}"
ENV_FILE="${ROTA_EDITORIAL_ENV_FILE:-$ROOT_DIR/docker/.env.phase7.local}"
PROJECT_NAME="${ROTA_EDITORIAL_PROJECT_NAME:-rota-editorial-fase7}"
IMAGE_PREFIX="ghcr.io/leoalvespak-alt"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
command -v git >/dev/null 2>&1 || fail "git is not installed"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file not found: $COMPOSE_FILE"
[[ -f "$COMPOSE_OVERRIDE_FILE" ]] || fail "shared-editorial compose overlay not found: $COMPOSE_OVERRIDE_FILE"
[[ -f "$ENV_FILE" ]] || fail "production env file not found: $ENV_FILE"

HEAD_SHA="$(git rev-parse --verify HEAD)"
SOURCE_HASH="${ROTA_EDITORIAL_SOURCE_HASH:-}"
if [[ -z "$SOURCE_HASH" ]]; then
  SOURCE_HASH="$(
    {
      {
        git diff --name-only -z HEAD
        git ls-files --others --exclude-standard -z
      } | sort -zu |
        while IFS= read -r -d '' path; do
          printf '%s\0' "$path"
          if [[ -f "$path" ]]; then
            git hash-object --no-filters -- "$path"
          else
            printf 'deleted\n'
          fi
        done
    } | sha256sum | cut -c1-12
  )"
fi
[[ "$SOURCE_HASH" =~ ^[0-9a-f]{12}$ ]] || fail "ROTA_EDITORIAL_SOURCE_HASH must be 12 lowercase hexadecimal characters"
TAG="${HEAD_SHA:0:12}${SOURCE_HASH}"
[[ "$TAG" =~ ^[0-9a-f]{24}$ ]] || fail "could not create a valid local release tag"

export IMAGE_TAG="$TAG"
export RELEASE_ID="$TAG"
export ROTA_EDITORIAL_ENV_FILE="$ENV_FILE"
export ROTA_EDITORIAL_COMPOSE_OVERRIDE_FILE="$COMPOSE_OVERRIDE_FILE"
COMPOSE=(docker compose --project-name "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE_FILE")

echo "=== Local editorial build: $TAG ==="
echo "--- Validating production Compose configuration ---"
"${COMPOSE[@]}" config --quiet

echo "--- Building Prospector migrations ---"
docker build --label "org.opencontainers.image.revision=$HEAD_SHA" --label "org.opencontainers.image.version=$TAG" -f docker/prospector-migrations.Dockerfile -t "$IMAGE_PREFIX/prospector-platform-migrations:$TAG" .

echo "--- Building Prospector web ---"
docker build --label "org.opencontainers.image.revision=$HEAD_SHA" --label "org.opencontainers.image.version=$TAG" -f apps/web/Dockerfile -t "$IMAGE_PREFIX/prospector-platform-web:$TAG" .

echo "--- Building Design API ---"
docker build --label "org.opencontainers.image.revision=$HEAD_SHA" --label "org.opencontainers.image.version=$TAG" -f apps/design-system/Dockerfile.api -t "$IMAGE_PREFIX/rota-design-api:$TAG" .

echo "--- Building Design web ---"
docker build --label "org.opencontainers.image.revision=$HEAD_SHA" --label "org.opencontainers.image.version=$TAG" -f apps/design-system/Dockerfile.web -t "$IMAGE_PREFIX/rota-design-web:$TAG" .

echo "--- Building editorial executor ---"
docker build --label "org.opencontainers.image.revision=$HEAD_SHA" --label "org.opencontainers.image.version=$TAG" -f workers/editorial-executor/Dockerfile -t "$IMAGE_PREFIX/rota-editorial-executor:$TAG" .

for image in \
  "$IMAGE_PREFIX/prospector-platform-migrations:$TAG" \
  "$IMAGE_PREFIX/prospector-platform-web:$TAG" \
  "$IMAGE_PREFIX/rota-design-api:$TAG" \
  "$IMAGE_PREFIX/rota-design-web:$TAG" \
  "$IMAGE_PREFIX/rota-editorial-executor:$TAG"; do
  docker image inspect "$image" >/dev/null 2>&1 || fail "local build did not produce $image"
done

if ! docker image inspect caddy:2.9-alpine >/dev/null 2>&1; then
  echo "--- Pulling public Caddy runtime image ---"
  docker pull caddy:2.9-alpine
fi

echo "--- Deploying local images to the shared editorial database ---"
EDITORIAL_EXECUTOR_ENABLED=true \
ROTA_EDITORIAL_SKIP_IMAGE_PULL=true \
  ROTA_EDITORIAL_COMPOSE_OVERRIDE_FILE="$COMPOSE_OVERRIDE_FILE" \
  RELEASE_ID="$TAG" \
  bash "$ROOT_DIR/deploy/deploy-editorial-production-local.sh" "$TAG"

echo "=== Local editorial build and deploy complete: $TAG ==="
