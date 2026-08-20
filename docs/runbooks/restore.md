# Runbook de restore

1. Coloque a plataforma em modo somente leitura e confirme o objeto do backup no bucket.
2. Crie um snapshot do banco atual.
3. Em staging, execute `scripts/restore-backup.sh <chave>` e rode migrations/contratos.
4. Valide contagens, constraints, extensão pgvector, duas contas e eventos recentes.
5. Repita em produção, habilite tráfego e registre o teste trimestral em `audit_log`.

Nunca restaure `.env` ou perfis Chromium sem descriptografia e dupla revisão.
Para a migration 0011, o banco Prospector-only cria `theses_from_design` como
view vazia compatível quando `design.editorial_theses` ainda não existe; não
crie a tabela nem insira a versão no ledger manualmente para contornar o runner.
Para a migration 0014, confirme que `candidate_sources` possui `platform`,
`handle` e `display_name` antes do seed de concorrentes; a própria migration
faz a ampliação idempotente.
Para a migration 0015, confira antes do downgrade se não existem reservas
provider-only nem reservas no estado `released`. O `0015.down.sql` aborta nesses
casos para evitar perda do modelo novo; use restore/snapshot ou uma migração de
dados aprovada antes de tentar voltar à forma da 0010. Após o upgrade, valide a
quarentena de reservas sem provider e a soma de `estimated_usd`, `actual_usd`,
`spent_usd` e `reserved_usd`.
Para a migration 0016, valide antes do rollback a contagem e a unicidade das
sugestões por origem, além dos vínculos `radar_findings.promoted_publication_id`.
O downgrade remove apenas estado/índices adicionados pela 0016; faça o ensaio
em banco descartável antes de operar sobre um ambiente persistente.
Para a migration 0017, expire ou preserve tokens de undo ativos antes do
rollback e confirme que não há decisões humanas dentro da janela de undo. O
downgrade remove somente colunas/índice de undo.
Para a migration 0018, valide antes do rollback os títulos, campanhas e links
de páginas que usam o novo contexto. Linhas com `campaign_id` nulo são globais
por contrato e não devem receber backfill implícito.
Para a migration 0019, pare o worker enrichment, confirme que não há jobs
`running`/`persisting` e registre o estado da fila seguinte antes do rollback.
O downgrade remove o ledger de idempotência; prefira snapshot/restore se houver
jobs concluídos que precisem ser reprocessados sem duplicidade.
