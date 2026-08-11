# Dados e jobs

## Função

Reúne o schema relacional e as abstrações de processamento assíncrono, renderização e armazenamento.

## Arquivos principais

- `src/db/schema.ts`, `drizzle.config.ts` e `src/domain/migrations.ts`
- `src/server/queue/jobQueues.ts`
- `src/server/storage/StorageAdapter.ts`
- `src/server/images/imageProcessor.ts`
- `docker-compose.yml`

## Fluxo básico

1. Drizzle define tabelas e migrações do banco.
2. Filas BullMQ recebem dados de render/exportação e usam Redis configurado por ambiente.
3. Workers usam renderer, processador de imagens e adapter de storage conforme o job.

## Dependências internas

Projetos, exportação/renderização, variáveis de ambiente e infraestrutura externa.

## Regras importantes

- Não registre segredos ou endpoints de produção em docs, logs ou fixtures.
- Mudanças de schema exigem revisão de migrações e consumidores de dados.
- Hosts de Redis e adapters de storage dependem de ambiente; verificar no código/configuração antes de alterar.

## Quando atualizar este documento

Ao mudar tabelas, migrações, payloads de job, Redis, processamento de imagens ou contratos de storage.
