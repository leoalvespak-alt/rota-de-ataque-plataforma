#!/usr/bin/env bash
set -euo pipefail

container='design-postgres'
backup='design-postgres-pre-pgvector'
volume='design-system_design_postgres_data'
env_lines="$(docker inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}')"
password="$(printf '%s\n' "$env_lines" | sed -n 's/^POSTGRES_PASSWORD=//p')"
database="$(printf '%s\n' "$env_lines" | sed -n 's/^POSTGRES_DB=//p')"
user="$(printf '%s\n' "$env_lines" | sed -n 's/^POSTGRES_USER=//p')"

test -n "$password" -a -n "$database" -a -n "$user"
docker stop "$container"
docker rename "$container" "$backup"
docker run -d --name "$container" --restart unless-stopped -p 127.0.0.1:5433:5432 \
  -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB="$database" -e POSTGRES_USER="$user" \
  -v "$volume":/var/lib/postgresql/data pgvector/pgvector:pg16 >/dev/null

for attempt in {1..15}; do
  if docker exec "$container" pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
    docker exec "$container" psql -U "$user" -d "$database" -tAc "SELECT name FROM pg_available_extensions WHERE name = 'vector';" | grep -qx vector
    exit 0
  fi
  sleep 2
done

echo 'PostgreSQL did not become ready; restore design-postgres-pre-pgvector.' >&2
exit 1
