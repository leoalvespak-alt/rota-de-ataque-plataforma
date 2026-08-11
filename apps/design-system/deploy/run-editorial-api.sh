#!/usr/bin/env bash
set -euo pipefail

app_dir='/opt/design-editorial-api'
postgres='design-postgres'
api='design-editorial-api'
env_lines="$(docker inspect "$postgres" --format '{{range .Config.Env}}{{println .}}{{end}}')"
password="$(printf '%s\n' "$env_lines" | sed -n 's/^POSTGRES_PASSWORD=//p')"
database="$(printf '%s\n' "$env_lines" | sed -n 's/^POSTGRES_DB=//p')"
user="$(printf '%s\n' "$env_lines" | sed -n 's/^POSTGRES_USER=//p')"
test -n "$password" -a -n "$database" -a -n "$user"

docker build -f "$app_dir/Dockerfile.api" -t "$api:latest" "$app_dir"
docker rm -f "$api" >/dev/null 2>&1 || true
docker run -d --name "$api" --restart unless-stopped --link "$postgres:postgres" -p 127.0.0.1:3001:3001 \
  -e DATABASE_URL="postgresql://$user:$password@postgres:5432/$database" \
  -e API_PORT=3001 -e WEB_ORIGIN='https://design.rotadeataque.com.br' "$api:latest" >/dev/null
for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:3001/health >/dev/null; then exit 0; fi
  sleep 2
done
docker logs "$api" >&2
exit 1
