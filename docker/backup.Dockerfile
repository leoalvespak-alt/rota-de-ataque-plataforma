FROM minio/mc:RELEASE.2025-02-21T16-00-46Z AS minio
FROM postgres:16-alpine
RUN apk add --no-cache redis openssl tzdata
COPY --from=minio /usr/bin/mc /usr/local/bin/mc
COPY scripts/backup-postgres.sh scripts/backup-redis.sh scripts/backup-profiles.sh /scripts/
COPY docker/crontab /etc/crontabs/root
RUN chmod 0555 /scripts/*.sh && chmod 0600 /etc/crontabs/root
CMD ["crond", "-f", "-l", "2"]
