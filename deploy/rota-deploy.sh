#!/usr/bin/env bash
set -euo pipefail

PROJECT="${1:-}"
ARGUMENT="${2:-}"
GHCR="ghcr.io/leoalvespak-alt"
DEPLOY_CONFIG="${ROTA_DEPLOY_CONFIG:-/etc/rota-deploy.env}"
LOCK_FILE="/run/lock/rota-deploy.lock"

if [[ -r "$DEPLOY_CONFIG" ]]; then
  # shellcheck disable=SC1090
  source "$DEPLOY_CONFIG"
fi

if [[ "${ROTA_DEPLOY_LOCK_HELD:-0}" != "1" ]]; then
  SCRIPT_PATH="$(readlink -f "$0")"
  exec flock -w "${ROTA_DEPLOY_LOCK_TIMEOUT:-7200}" "$LOCK_FILE" \
    env ROTA_DEPLOY_LOCK_HELD=1 "$SCRIPT_PATH" "$@"
fi

TEMP_CONTAINER=""
TEMP_DIRECTORY=""

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  log "FAIL: $*"
  exit 1
}

standard_image_tag() {
  case "$ARGUMENT" in
    "" | --migrate)
      printf 'latest\n'
      ;;
    *)
      [[ "$ARGUMENT" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Invalid image tag"
      printf '%s\n' "$ARGUMENT"
      ;;
  esac
}

cleanup_temporary_resources() {
  if [[ -n "$TEMP_CONTAINER" ]]; then
    docker rm -f "$TEMP_CONTAINER" >/dev/null 2>&1 || true
  fi
  if [[ -n "$TEMP_DIRECTORY" && -d "$TEMP_DIRECTORY" ]]; then
    rm -rf -- "$TEMP_DIRECTORY"
  fi
}
trap cleanup_temporary_resources EXIT

health_check() {
  local url="$1"
  local retries="${2:-15}"
  local delay="${3:-4}"
  local code
  for _ in $(seq 1 "$retries"); do
    code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" 2>/dev/null || true)"
    if [[ "$code" == "200" ]]; then
      log "Health OK ($url) -> $code"
      return 0
    fi
    sleep "$delay"
  done
  log "Health failed ($url), last HTTP ${code:-000}"
  return 1
}

cleanup_images() {
  local repo="$1"
  local tags tag index
  mapfile -t tags < <(
    docker images "$GHCR/$repo" --format '{{.Tag}}' \
      | awk '$1 != "latest" && $1 != "<none>" && !seen[$1]++ { print $1 }'
  )
  for ((index = 1; index < ${#tags[@]}; index += 1)); do
    tag="${tags[$index]}"
    docker image rm "$GHCR/$repo:$tag" >/dev/null 2>&1 || true
  done
}

wait_for_image() {
  local container_name="$1"
  local expected_image="$2"
  local retries="${3:-40}"
  local delay="${4:-5}"
  local running_image
  for _ in $(seq 1 "$retries"); do
    running_image="$(docker inspect --format '{{.Image}}' "$container_name" 2>/dev/null || true)"
    if [[ "$running_image" == "$expected_image" ]]; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

deploy_design_web() {
  local tag image
  local target="/var/www/design-rota-ataque"
  local backup="/var/www/design-rota-ataque.prev"

  tag="$(standard_image_tag)"
  image="$GHCR/rota-design-web:$tag"
  log "Deploying Design System web"
  docker pull "$image"
  TEMP_CONTAINER="$(docker create "$image")"
  TEMP_DIRECTORY="$(mktemp -d /var/www/.design-rota-ataque.XXXXXX)"
  docker cp "$TEMP_CONTAINER:/usr/share/nginx/html/." "$TEMP_DIRECTORY/"
  [[ -s "$TEMP_DIRECTORY/index.html" ]] || fail "Design web image does not contain index.html"
  chown -R www-data:www-data "$TEMP_DIRECTORY"

  rm -rf -- "$backup"
  [[ -d "$target" ]] && mv "$target" "$backup"
  mv "$TEMP_DIRECTORY" "$target"
  TEMP_DIRECTORY=""

  if ! health_check "https://design.rotadeataque.com.br" 10 2; then
    rm -rf -- "$target"
    [[ -d "$backup" ]] && mv "$backup" "$target"
    fail "Design web health check failed; previous files restored"
  fi

  docker rm "$TEMP_CONTAINER" >/dev/null
  TEMP_CONTAINER=""
  cleanup_images "rota-design-web"
}

deploy_design_api() {
  local tag image latest_image expected_image running_image migration_url

  tag="$(standard_image_tag)"
  image="$GHCR/rota-design-api:$tag"
  latest_image="$GHCR/rota-design-api:latest"
  migration_url="${DESIGN_MIGRATION_DATABASE_URL:-}"
  log "Deploying Design System API"
  [[ -n "$migration_url" ]] || fail "DESIGN_MIGRATION_DATABASE_URL is missing from $DEPLOY_CONFIG"
  docker pull "$image"
  [[ "$tag" == "latest" ]] || docker tag "$image" "$latest_image"
  expected_image="$(docker image inspect --format '{{.Id}}' "$image")"

  log "Running Design API migrations before restart"
  DATABASE_URL="$migration_url" docker run --rm --network host \
    --env DATABASE_URL \
    "$image" pnpm --filter @plataforma/design-system db:migrate

  systemctl restart rota-design-api.service
  health_check "http://127.0.0.1:3002/api/health" 20 3 || fail "Design API health check failed"
  running_image="$(docker inspect --format '{{.Image}}' rota-design-api 2>/dev/null || true)"
  [[ "$running_image" == "$expected_image" ]] || fail "Design API is healthy but still uses an older image"
  cleanup_images "rota-design-api"
}

deploy_plataforma_v2() {
  local tag="${1:-latest}"
  local image="$GHCR/plataforma-2.0:$tag"
  local remote_base="/srv/rota-ataque/frontend"
  local shared_dir="$remote_base/shared"
  local current_dir="$remote_base/current"
  local release_ts release_dir

  [[ "$tag" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Invalid Plataforma 2.0 image tag"
  release_ts="$(date +%Y%m%d-%H%M%S)"
  release_dir="$remote_base/releases/$release_ts"

  log "Deploying Plataforma 2.0 from immutable image tag $tag"
  docker pull "$image"
  mkdir -p "$release_dir"
  TEMP_CONTAINER="$(docker create "$image")"
  docker cp "$TEMP_CONTAINER:/app/." "$release_dir/"
  docker rm "$TEMP_CONTAINER" >/dev/null
  TEMP_CONTAINER=""

  [[ -s "$release_dir/.next/BUILD_ID" ]] || fail "Plataforma image is missing .next/BUILD_ID"
  [[ -s "$release_dir/scripts/vps/activate-release.sh" ]] || fail "Plataforma image is missing activate-release.sh"
  [[ -s "$release_dir/package-lock.json" ]] || fail "Plataforma image is missing package-lock.json"

  export RELEASE_DIR="$release_dir"
  export SHARED_DIR="$shared_dir"
  export CURRENT_DIR="$current_dir"
  export REMOTE_BASE="$remote_base"
  export SERVICE_NAME="rota-frontend"
  export RELEASE_TS="$release_ts"
  bash "$release_dir/scripts/vps/activate-release.sh"
  health_check "https://app.rotadeataque.com.br" 20 3 || fail "Plataforma 2.0 health check failed"
  cleanup_images "plataforma-2.0"
}

show_status() {
  local failed=0
  local url code
  for url in \
    "https://design.rotadeataque.com.br" \
    "http://127.0.0.1:3002/api/health" \
    "https://design.rotadeataque.com.br/prospector/api/health" \
    "https://gazeta.rotadeataque.com.br" \
    "https://app.rotadeataque.com.br"; do
    code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" 2>/dev/null || true)"
    printf '%s -> %s\n' "$url" "${code:-000}"
    [[ "$code" == "200" ]] || failed=1
  done
  printf 'disk: '
  df -h / | tail -1
  return "$failed"
}

case "$PROJECT" in
  design-web)
    deploy_design_web
    ;;
  design-api)
    deploy_design_api
    ;;
  design-local)
    log "Design System local deployment is managed by docker/docker-compose.phase7.yml"
    ;;
  plataforma-v2)
    deploy_plataforma_v2 "${ARGUMENT:-latest}"
    ;;
  gazeta)
    log "Gazeta deployment is managed outside this local editorial stack"
    health_check "https://gazeta.rotadeataque.com.br" 40 10 || fail "Gazeta health check failed"
    ;;
  plataforma)
    log "Legacy Plataforma 2.0 deployment is managed outside this local editorial stack"
    health_check "https://app.rotadeataque.com.br" 40 10 || fail "Plataforma health check failed"
    ;;
  all)
    "$0" design-local
    "$0" gazeta
    "$0" plataforma-v2 latest
    ;;
  cleanup)
    cleanup_images "rota-design-web"
    cleanup_images "rota-design-api"
    cleanup_images "plataforma-2.0"
    docker image prune --force >/dev/null
    ;;
  status)
    show_status
    ;;
  *)
    printf '%s\n' \
      'Usage: deploy.sh <project> [argument]' \
      'Projects: design-web, design-api, design-local,' \
      '          plataforma-v2 [tag], gazeta, plataforma, all, cleanup, status'
    exit 1
    ;;
esac
