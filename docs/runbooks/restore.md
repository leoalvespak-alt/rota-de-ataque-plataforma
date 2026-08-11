# Runbook de restore

1. Coloque a plataforma em modo somente leitura e confirme o objeto do backup no bucket.
2. Crie um snapshot do banco atual.
3. Em staging, execute `scripts/restore-backup.sh <chave>` e rode migrations/contratos.
4. Valide contagens, constraints, extensão pgvector, duas contas e eventos recentes.
5. Repita em produção, habilite tráfego e registre o teste trimestral em `audit_log`.

Nunca restaure `.env` ou perfis Chromium sem descriptografia e dupla revisão.
