#!/usr/bin/env bash
set -euo pipefail

PROJECT="${1:-}"
ARGUMENT="${2:-}"
GHCR="ghcr.io/leoalvespak-alt"
DOKPLOY_API="http://127.0.0.1:3100/api"
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

require_dokploy_key() {
  [[ -n "${DOKPLOY_API_KEY:-}" ]] || fail "DOKPLOY_API_KEY is missing from $DEPLOY_CONFIG"
}

dokploy_post() {
  local endpoint="$1"
  local payload="$2"
  local response_file http_code
  require_dokploy_key
  response_file="$(mktemp)"
  http_code="$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
    --output "$response_file" --write-out '%{http_code}' \
    --request POST "$DOKPLOY_API/$endpoint" \
    --header "x-api-key: $DOKPLOY_API_KEY" \
    --header 'Content-Type: application/json' \
    --data "$payload" || true)"
  rm -f -- "$response_file"
  [[ "$http_code" =~ ^2[0-9][0-9]$ ]] || fail "Dokploy API $endpoint returned HTTP ${http_code:-000}"
}

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

find_prospector_compose_file() {
  local compose_file
  compose_file="$(find /etc/dokploy/compose -type f -path '*prospector*/code/docker/docker-compose.dokploy.yml' -print -quit 2>/dev/null || true)"
  [[ -n "$compose_file" ]] || return 1
  printf '%s\n' "$compose_file"
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

deploy_prospector() {
  local tag web_image worker_image expected_image expected_worker_image
  local compose_file compose_dir web_container migration_container migration_image

  tag="$(standard_image_tag)"
  web_image="$GHCR/prospector-platform-web:$tag"
  worker_image="$GHCR/prospector-platform-worker:$tag"

  log "Deploying Prospector"
  docker pull "$web_image"
  docker pull "$worker_image"
  if [[ "$tag" != "latest" ]]; then
    docker tag "$web_image" "$GHCR/prospector-platform-web:latest"
    docker tag "$worker_image" "$GHCR/prospector-platform-worker:latest"
  fi
  expected_image="$(docker image inspect --format '{{.Id}}' "$web_image")"
  expected_worker_image="$(docker image inspect --format '{{.Id}}' "$worker_image")"
  compose_file="$(find_prospector_compose_file)" || fail "Prospector Dokploy compose file not found under /etc/dokploy/compose"
  compose_dir="$(dirname "$compose_file")"

  log "Running Prospector migrations before web replacement"
  migration_container="prospector-migrate-$(date +%s)-$$"
  TEMP_CONTAINER="$migration_container"
  (
    cd "$compose_dir"
    docker compose \
      --project-name rotadeataque-prospector-czj6hb \
      --file "$compose_file" \
      --profile tools \
      run --no-deps --pull never --env-from-file .env --name "$migration_container" migrate
  )
  migration_image="$(docker inspect --format '{{.Image}}' "$migration_container")"
  [[ "$migration_image" == "$expected_worker_image" ]] \
    || fail "Prospector migrations did not use the image built by this workflow"
  docker rm "$migration_container" >/dev/null
  TEMP_CONTAINER=""

  dokploy_post "compose.deploy" '{"composeId":"PXQCDj9zwHR772nHRE-pu"}'
  web_container="rotadeataque-prospector-czj6hb-web-1"
  wait_for_image "$web_container" "$expected_image" 60 5 \
    || fail "Prospector did not switch to the image built by this workflow"
  health_check "https://design.rotadeataque.com.br/prospector/api/health" 30 5 \
    || fail "Prospector health check failed"
  (
    cd "$compose_dir"
    runtime_count=0
    while IFS= read -r service; do
      case "$service" in
        scheduler|worker-*)
          container_id="$(docker compose --project-name rotadeataque-prospector-czj6hb --file "$compose_file" ps -q "$service")"
          [[ -n "$container_id" ]] || fail "Prospector runtime service $service is not running"
          running_worker_image="$(docker inspect --format '{{.Image}}' "$container_id")"
          [[ "$running_worker_image" == "$expected_worker_image" ]] \
            || fail "Prospector runtime service $service still uses an older worker image"
          runtime_count=$((runtime_count + 1))
          ;;
      esac
    done < <(docker compose --project-name rotadeataque-prospector-czj6hb --file "$compose_file" config --services)
    [[ "$runtime_count" -eq 8 ]] || fail "Prospector runtime expected scheduler plus 7 engine supervisors, found $runtime_count"
  )
  cleanup_images "prospector-platform-web"
  cleanup_images "prospector-platform-worker"
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
  prospector)
    deploy_prospector
    ;;
  design-prospector)
    deploy_design_web
    deploy_design_api
    deploy_prospector
    ;;
  plataforma-v2)
    deploy_plataforma_v2 "${ARGUMENT:-latest}"
    ;;
  gazeta)
    log "Triggering Gazeta deploy in Dokploy"
    dokploy_post "application.deploy" '{"applicationId":"AJcua9f7P4PYRWRkO-72W"}'
    health_check "https://gazeta.rotadeataque.com.br" 40 10 || fail "Gazeta health check failed"
    ;;
  plataforma)
    log "Triggering legacy Plataforma 2.0 Dokploy application"
    dokploy_post "application.deploy" '{"applicationId":"kiMKbGqJOo5cSXbMcruMv"}'
    health_check "https://app.rotadeataque.com.br" 40 10 || fail "Plataforma health check failed"
    ;;
  all)
    "$0" design-prospector
    "$0" gazeta
    "$0" plataforma-v2 latest
    ;;
  cleanup)
    cleanup_images "rota-design-web"
    cleanup_images "rota-design-api"
    cleanup_images "prospector-platform-web"
    cleanup_images "prospector-platform-worker"
    cleanup_images "plataforma-2.0"
    docker image prune --force >/dev/null
    ;;
  status)
    show_status
    ;;
  *)
    printf '%s\n' \
      'Usage: deploy.sh <project> [argument]' \
      'Projects: design-web, design-api, prospector, design-prospector,' \
      '          plataforma-v2 [tag], gazeta, plataforma, all, cleanup, status'
    exit 1
    ;;
esac
