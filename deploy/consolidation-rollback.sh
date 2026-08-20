#!/usr/bin/env bash
set -euo pipefail

# Consolidation rollback — Etapa 0, Passo 0.3
# Reverte a consolidação: Design System volta a usar seu próprio Postgres.

RUN_ID="${1:?Uso: $0 <run_id>}"
BACKUP_DIR="/opt/consolidation-backups/$RUN_ID"

test -f "$BACKUP_DIR/rota_design.dump" || { echo "Dump do Design System não encontrado"; exit 1; }

echo "==> ROLLBACK: Revertendo consolidação de banco"

# 1. Parar a API do Design System
echo "  Parando API do Design System..."
cd /opt/rota-design-api/current
docker compose --env-file .env -p rota-design-api -f apps/design-system/docker-compose.yml stop api

# 2. Restaurar DATABASE_URL original no .env do Design System
echo "  Restaurando DATABASE_URL original..."
SHARED_ENV="/opt/rota-design-api/shared/.env"
if grep -q 'DATABASE_URL_BACKUP=' "$SHARED_ENV"; then
  ORIGINAL_URL=$(grep 'DATABASE_URL_BACKUP=' "$SHARED_ENV" | cut -d= -f2-)
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$ORIGINAL_URL|" "$SHARED_ENV"
  echo "    DATABASE_URL restaurada do backup"
else
  PG_PASS=$(grep 'DESIGN_POSTGRES_PASSWORD=' "$SHARED_ENV" | cut -d= -f2-)
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://rota_design:${PG_PASS}@postgres:5432/rota_design|" "$SHARED_ENV"
  echo "    DATABASE_URL reconstruída para container local"
fi

# 3. Subir o Postgres original do Design System
echo "  Subindo Postgres original do Design System..."
docker compose --env-file .env -p rota-design-api -f apps/design-system/docker-compose.yml up -d postgres
sleep 10

# 4. Verificar se o volume antigo tem dados
DESIGN_PG=$(docker compose --env-file .env -p rota-design-api -f apps/design-system/docker-compose.yml ps -q postgres)
TABLE_COUNT=$(docker exec -i "$DESIGN_PG" psql -U rota_design -d rota_design -tAc "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -lt 5 ]; then
  echo "  Volume antigo vazio ou corrompido. Restaurando do dump..."
  docker exec -i "$DESIGN_PG" pg_restore -U rota_design -d rota_design --no-owner --no-acl < "$BACKUP_DIR/rota_design.dump" || true
  echo "    Dump restaurado"
else
  echo "  Volume antigo contém $TABLE_COUNT tabelas — dados preservados"
fi

# 5. Regenerar .env e subir API
echo "  Regenerando .env da release..."
cat "$SHARED_ENV" "/opt/rota-design-api/current/.release.env" > "/opt/rota-design-api/current/.env"
chmod 600 "/opt/rota-design-api/current/.env"

echo "  Subindo API do Design System..."
docker compose --env-file .env -p rota-design-api -f apps/design-system/docker-compose.yml up -d api

# 6. Verificar saúde
echo "  Verificando saúde..."
elapsed=0
until curl --fail --silent http://127.0.0.1:3002/health | grep -q '"status":"ok"'; do
  sleep 5; elapsed=$((elapsed + 5))
  if [ "$elapsed" -ge 120 ]; then
    echo "ERRO: API não ficou saudável em 120s"
    exit 1
  fi
done

echo "==> ROLLBACK concluído com sucesso"
echo "    Design System voltou ao Postgres próprio"
echo "    Verificar manualmente: https://design.rotadeataque.com.br/api/health"
