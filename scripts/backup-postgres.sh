#!/usr/bin/env sh
set -eu
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="/tmp/prospector-${stamp}.dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$file"
mc alias set backup "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc cp "$file" "backup/$S3_BUCKET_BACKUPS/postgres/$stamp.dump"
mc rm --recursive --force --older-than 30d "backup/$S3_BUCKET_BACKUPS/postgres/"
rm -f "$file"
