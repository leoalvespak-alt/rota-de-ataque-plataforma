#!/usr/bin/env bash
set -euo pipefail

# Consolidation backup — Etapa 0 do plano de operação orgânica
# Executa no VPS antes da consolidação de banco.
# Gera dumps verificados dos dois Postgres e sobe para o R2.

RUN_ID="${1:-$(date +%Y%m%d%H%M%S)}"
BACKUP_DIR="/opt/consolidation-backups/$RUN_ID"
mkdir -p "$BACKUP_DIR"

echo "==> [$RUN_ID] Backup completo dos dois bancos"

# --- Prospector ---
echo "  Prospector: pg_dump..."
docker compose -p prospector-platform -f /opt/prospector-platform/current/docker/docker-compose.yml \
  exec -T postgres pg_dump -U prospector -d prospector -Fc > "$BACKUP_DIR/prospector.dump"
echo "  Prospector: verificando integridade..."
pg_restore --list "$BACKUP_DIR/prospector.dump" > "$BACKUP_DIR/prospector.toc"
echo "  Prospector: $(wc -l < "$BACKUP_DIR/prospector.toc") objetos no dump"

# --- Design System ---
echo "  Design System: pg_dump..."
docker compose -p rota-design-api -f /opt/rota-design-api/current/apps/design-system/docker-compose.yml \
  exec -T postgres pg_dump -U rota_design -d rota_design -Fc > "$BACKUP_DIR/rota_design.dump"
echo "  Design System: verificando integridade..."
pg_restore --list "$BACKUP_DIR/rota_design.dump" > "$BACKUP_DIR/rota_design.toc"
echo "  Design System: $(wc -l < "$BACKUP_DIR/rota_design.toc") objetos no dump"

# --- Metadata ---
cat > "$BACKUP_DIR/manifest.json" <<EOF
{
  "run_id": "$RUN_ID",
  "created_at": "$(date -Iseconds)",
  "prospector_dump": "prospector.dump",
  "prospector_size": $(stat -c%s "$BACKUP_DIR/prospector.dump"),
  "design_dump": "rota_design.dump",
  "design_size": $(stat -c%s "$BACKUP_DIR/rota_design.dump"),
  "purpose": "pre-consolidation-backup"
}
EOF

echo "==> Backup local concluído em $BACKUP_DIR"
echo "    Prospector: $(du -h "$BACKUP_DIR/prospector.dump" | cut -f1)"
echo "    Design System: $(du -h "$BACKUP_DIR/rota_design.dump" | cut -f1)"

# --- Upload R2 (se rclone configurado) ---
if command -v rclone &>/dev/null && rclone listremotes | grep -q 'r2:'; then
  echo "==> Subindo para R2..."
  rclone copy "$BACKUP_DIR" "r2:prospector-backups/consolidation/$RUN_ID/" --progress
  echo "    R2 upload concluído"
else
  echo "    rclone/R2 não configurado — backup apenas local"
fi

echo "==> [$RUN_ID] Backup completo finalizado"
