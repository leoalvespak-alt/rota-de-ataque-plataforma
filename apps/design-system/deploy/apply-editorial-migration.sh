#!/usr/bin/env bash
set -euo pipefail

container='design-postgres'
database='design_system'
user='design_app'
docker cp /tmp/0001_safe_sunfire.sql "$container":/tmp/0001_safe_sunfire.sql
docker exec "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" -f /tmp/0001_safe_sunfire.sql
docker exec "$container" psql -U "$user" -d "$database" -tAc "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker exec "$container" psql -U "$user" -d "$database" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('editorial_theses', 'knowledge_documents', 'editorial_plans', 'content_items');"
rm -f /tmp/0001_safe_sunfire.sql
