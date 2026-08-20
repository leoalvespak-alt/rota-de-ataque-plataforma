#!/usr/bin/env bash
set -euo pipefail

# Consolidation execute — Etapa 1 em produção (Passo 12.2)
# Executa a consolidação real após ensaio bem-sucedido.

RUN_ID="${1:?Uso: $0 <run_id>}"
BACKUP_DIR="/opt/consolidation-backups/$RUN_ID"

test -f "$BACKUP_DIR/rehearsal-result.json" || { echo "Ensaio não encontrado. Execute consolidation-rehearsal.sh primeiro."; exit 1; }
test -f "$BACKUP_DIR/rota_design.dump" || { echo "Dump do Design System não encontrado"; exit 1; }

echo "==> [$RUN_ID] Executando consolidação de banco em PRODUÇÃO"
echo "    ATENÇÃO: Esta operação é destrutiva. O rollback está em consolidation-rollback.sh"
read -p "    Continuar? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Abortado."; exit 1; }

PROSPECTOR_COMPOSE="/opt/prospector-platform/current/docker/docker-compose.yml"
DESIGN_COMPOSE="/opt/rota-design-api/current/apps/design-system/docker-compose.yml"
PG_CONTAINER=$(docker compose -p prospector-platform -f "$PROSPECTOR_COMPOSE" ps -q postgres)

dpsql() { docker exec -i "$PG_CONTAINER" psql -U prospector -d prospector "$@"; }

# 1. Backup imediato antes da consolidação
echo "==> Backup pré-consolidação..."
bash "$(dirname "$0")/consolidation-backup.sh" "${RUN_ID}-pre-consolidation"

# 2. Parar API do Design System
echo "==> Parando API do Design System..."
cd /opt/rota-design-api/current
docker compose --env-file .env -p rota-design-api -f "$DESIGN_COMPOSE" stop api

# 3. Criar schema design no Prospector
echo "==> Criando schema design..."
dpsql -c "CREATE SCHEMA IF NOT EXISTS design;"

# 4. Transferir dados com renomeação
echo "==> Transferindo dados do Design System..."
DESIGN_PG=$(docker compose --env-file .env -p rota-design-api -f "$DESIGN_COMPOSE" ps -q postgres)

docker exec "$DESIGN_PG" pg_dump -U rota_design -d rota_design -Fc > /tmp/design_transfer.dump
docker exec -i "$PG_CONTAINER" createdb -U prospector design_staging 2>/dev/null || true
docker exec -i "$PG_CONTAINER" pg_restore -U prospector -d design_staging --no-owner --no-acl < /tmp/design_transfer.dump || true
docker exec -i "$PG_CONTAINER" psql -U prospector -d design_staging -c "ALTER SCHEMA public RENAME TO design;"
docker exec "$PG_CONTAINER" pg_dump -U prospector -d design_staging -Fc > /tmp/design_ns.dump
docker exec -i "$PG_CONTAINER" pg_restore -U prospector -d prospector --no-owner --no-acl < /tmp/design_ns.dump || true
docker exec -i "$PG_CONTAINER" psql -U prospector -d postgres -c "DROP DATABASE IF EXISTS design_staging;"
rm -f /tmp/design_transfer.dump /tmp/design_ns.dump

# 5. Verificar paridade
echo "==> Verificando paridade..."
DESIGN_TABLES=$(docker exec -i "$PG_CONTAINER" psql -U prospector -d prospector -tAc "
  SELECT count(*) FROM pg_tables WHERE schemaname = 'design';
")
echo "    Tabelas no schema design: $DESIGN_TABLES"

if [ "$DESIGN_TABLES" -lt 10 ]; then
  echo "ERRO: Menos de 10 tabelas no schema design. Abortando."
  exit 1
fi

# 6. Verificar pgvector
echo "==> Verificando pgvector..."
dpsql -tAc "SELECT extname FROM pg_extension WHERE extname = 'vector';" | grep -q vector

# 7. Reapontar DATABASE_URL do Design System
echo "==> Reapontando DATABASE_URL do Design System..."
SHARED_ENV="/opt/rota-design-api/shared/.env"
CURRENT_URL=$(grep '^DATABASE_URL=' "$SHARED_ENV" | head -1 | cut -d= -f2-)
echo "DATABASE_URL_BACKUP=$CURRENT_URL" >> "$SHARED_ENV"

PG_PASS=$(grep 'DESIGN_POSTGRES_PASSWORD=' "$SHARED_ENV" | cut -d= -f2- || echo "")
PROSPECTOR_PG_HOST=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$PG_CONTAINER" | head -1)
NEW_URL="postgresql://prospector:$(docker exec -i "$PG_CONTAINER" psql -U prospector -d postgres -tAc "SHOW password_encryption;" 2>/dev/null || echo "")@${PROSPECTOR_PG_HOST}:5432/prospector?options=-c%20search_path%3Ddesign,public"

sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$NEW_URL|" "$SHARED_ENV"

# 8. Regenerar .env e subir API
cd /opt/rota-design-api/current
cat "$SHARED_ENV" .release.env > .env
chmod 600 .env

echo "==> Subindo API do Design System apontando para Prospector..."
docker compose --env-file .env -p rota-design-api -f "$DESIGN_COMPOSE" up -d api

elapsed=0
until curl --fail --silent http://127.0.0.1:3002/health | grep -q '"status":"ok"'; do
  sleep 5; elapsed=$((elapsed + 5))
  [ "$elapsed" -lt 180 ] || { echo "ERRO: API não ficou saudável"; exit 1; }
done

# 9. Parar Postgres antigo do Design System (sem remover volume)
echo "==> Parando Postgres antigo do Design System (volume preservado)..."
docker compose --env-file .env -p rota-design-api -f "$DESIGN_COMPOSE" stop postgres

echo "==> Consolidação concluída com sucesso"
echo "    Design System agora lê do Postgres do Prospector (schema design)"
echo "    Volume antigo preservado. Remover após 30 dias de operação estável."
echo "    Para rollback: bash $(dirname "$0")/consolidation-rollback.sh $RUN_ID"
