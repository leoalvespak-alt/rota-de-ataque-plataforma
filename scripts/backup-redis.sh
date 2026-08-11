#!/usr/bin/env sh
set -eu
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="/tmp/redis-${stamp}.rdb"
redis-cli -u "$REDIS_URL" --rdb "$file"
mc alias set backup "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc cp "$file" "backup/$S3_BUCKET_BACKUPS/redis/$stamp.rdb"
mc rm --recursive --force --older-than 30d "backup/$S3_BUCKET_BACKUPS/redis/"
rm -f "$file"
