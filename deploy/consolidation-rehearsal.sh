#!/usr/bin/env bash
set -euo pipefail

# Consolidation rehearsal — Etapa 0, Passo 0.2
# Restaura os dumps em bancos de ensaio e cronometra a migração.

RUN_ID="${1:?Uso: $0 <run_id>}"
BACKUP_DIR="/opt/consolidation-backups/$RUN_ID"

test -f "$BACKUP_DIR/prospector.dump" || { echo "Dump do Prospector não encontrado"; exit 1; }
test -f "$BACKUP_DIR/rota_design.dump" || { echo "Dump do Design System não encontrado"; exit 1; }

PG_CONTAINER=$(docker compose -p prospector-platform -f /opt/prospector-platform/current/docker/docker-compose.yml ps -q postgres)
test -n "$PG_CONTAINER" || { echo "Container do Postgres do Prospector não encontrado"; exit 1; }

dpsql() { docker exec -i "$PG_CONTAINER" psql -U prospector -d postgres "$@"; }

echo "==> Criando bancos de ensaio..."
dpsql -c "DROP DATABASE IF EXISTS prospector_rehearsal;" 2>/dev/null || true
dpsql -c "DROP DATABASE IF EXISTS rota_design_rehearsal;" 2>/dev/null || true
dpsql -c "CREATE DATABASE prospector_rehearsal;"
dpsql -c "CREATE DATABASE rota_design_rehearsal;"

echo "==> Restaurando Prospector no banco de ensaio..."
docker exec -i "$PG_CONTAINER" pg_restore -U prospector -d prospector_rehearsal --no-owner --no-acl < "$BACKUP_DIR/prospector.dump" || true

echo "==> Restaurando Design System no banco de ensaio..."
docker exec -i "$PG_CONTAINER" pg_restore -U prospector -d rota_design_rehearsal --no-owner --no-acl < "$BACKUP_DIR/rota_design.dump" || true

echo "==> Ensaiando consolidação (renomear schema + transferir)..."
START=$(date +%s%N)

docker exec -i "$PG_CONTAINER" psql -U prospector -d rota_design_rehearsal -c "ALTER SCHEMA public RENAME TO design;"
docker exec "$PG_CONTAINER" pg_dump -U prospector -d rota_design_rehearsal -Fc > /tmp/design_ns_rehearsal.dump
docker exec -i "$PG_CONTAINER" pg_restore -U prospector -d prospector_rehearsal --no-owner --no-acl < /tmp/design_ns_rehearsal.dump || true

END=$(date +%s%N)
ELAPSED_MS=$(( (END - START) / 1000000 ))

echo "==> Verificando paridade de contagem..."
docker exec -i "$PG_CONTAINER" psql -U prospector -d rota_design_rehearsal -tAc "
  SELECT schemaname || '.' || tablename || ': ' || n_live_tup
  FROM pg_stat_user_tables WHERE schemaname = 'design' ORDER BY tablename;
"

docker exec -i "$PG_CONTAINER" psql -U prospector -d prospector_rehearsal -tAc "
  SELECT schemaname || '.' || tablename || ': ' || n_live_tup
  FROM pg_stat_user_tables WHERE schemaname = 'design' ORDER BY tablename;
"

echo "==> Verificando pgvector disponível..."
docker exec -i "$PG_CONTAINER" psql -U prospector -d prospector_rehearsal -tAc "SELECT extname FROM pg_extension WHERE extname = 'vector';"

echo "==> Ensaio concluído em ${ELAPSED_MS}ms"

cat > "$BACKUP_DIR/rehearsal-result.json" <<EOF
{
  "run_id": "$RUN_ID",
  "rehearsal_at": "$(date -Iseconds)",
  "elapsed_ms": $ELAPSED_MS,
  "status": "completed"
}
EOF

echo "==> Limpando bancos de ensaio..."
dpsql -c "DROP DATABASE IF EXISTS prospector_rehearsal;"
dpsql -c "DROP DATABASE IF EXISTS rota_design_rehearsal;"
rm -f /tmp/design_ns_rehearsal.dump

echo "==> Ensaio limpo. Resultado salvo em $BACKUP_DIR/rehearsal-result.json"
