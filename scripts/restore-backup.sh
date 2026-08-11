#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then echo "uso: restore-backup.sh s3-key" >&2; exit 2; fi
file="/tmp/prospector-restore.dump"
mc alias set backup "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc cp "backup/$S3_BUCKET_BACKUPS/$1" "$file"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$file"
rm -f "$file"
