#!/usr/bin/env sh
set -eu
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY é obrigatória}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="/tmp/chromium-profiles-${stamp}.tar.gz"
encrypted="${archive}.enc"
tar -C /data -czf "$archive" chromium_profiles
openssl enc -aes-256-cbc -pbkdf2 -salt -in "$archive" -out "$encrypted" -pass env:BACKUP_ENCRYPTION_KEY
mc alias set backup "$S3_ENDPOINT" "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
mc cp "$encrypted" "backup/$S3_BUCKET_BACKUPS/chromium-profiles/$stamp.tar.gz.enc"
mc rm --recursive --force --older-than 90d "backup/$S3_BUCKET_BACKUPS/chromium-profiles/"
rm -f "$archive" "$encrypted"
