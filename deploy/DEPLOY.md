# Deploy — Plataforma Rota de Ataque

Script unificado que publica o sistema completo no VPS compartilhado.

## O que ele faz

| Componente | Build | Destino VPS | Servido por |
|------------|-------|-------------|-------------|
| Design System (Vite SPA + API) | SPA local; API remota | `/var/www/design-rota-ataque` + `/opt/rota-design-api` | nginx + Docker |
| Prospector web (Next.js) | Remoto (Docker no VPS) | `/opt/prospector-platform` | Docker → nginx proxy |
| Prospector scheduler + 40 workers | Uma imagem remota imutável | mesma stack | Docker Compose |
| Migrations (SQL) | Remoto | PostgreSQL no Docker | Container `migrate` |

O build do Prospector roda **no VPS** (Docker), não no PC local — o script envia apenas o código-fonte (sem `node_modules`), e o Docker faz o build lá. Isso evita sobrecarregar o PC.

## Uso

```powershell
cd plataforma

# Deploy completo
.\deploy\deploy-all.ps1

# Só Design System
.\deploy\deploy-all.ps1 -Only design

# Só Prospector (web + workers + migrations)
.\deploy\deploy-all.ps1 -Only prospector

# Recuperar/recriar serviços usando a imagem de worker já validada
.\deploy\deploy-all.ps1 -Only prospector -ReuseWorkerImage

# Pular build (publica dist/ existente ou imagem Docker existente)
.\deploy\deploy-all.ps1 -SkipBuild

# Usar outra chave SSH
.\deploy\deploy-all.ps1 -IdentityFile "C:\caminho\para\chave"
```

## Pré-requisitos

1. **Chave SSH** autorizada no VPS. Padrão: `C:\Users\Lenovo\.ssh\id_rsa`
2. **CREDENCIAIS_VPS.txt** na raiz do workspace (`Sistema de Design/`). Contém IPv4 e nome do usuário SSH. Nunca commitar.
3. **Node.js + pnpm** no PATH (para build local do Design System)
4. **tar, ssh, scp** no PATH (vem com Git Bash no Windows)

## Fluxo interno

### Design System (`-Only design`)

1. `pnpm run build` local (Vite) → gera `apps/design-system/dist/`.
2. Empacota SPA e fonte da API sem `.env` ou artefatos locais.
3. No VPS, constrói a API, sobe PostgreSQL/Redis, executa o runner com ledger/checksum e espera `/api/health`.
4. Extrai a SPA em diretório temporário, valida `index.html`, permissões e nginx.
5. Faz swap atômico, reload e rollback do site em falha.

### Prospector (`-Only prospector`)

1. Valida que Gazeta Concursos está saudável (n8n + worker rodando)
2. Empacota código-fonte (sem node_modules/dist/.env)
3. Envia via SCP para `/tmp/` no VPS
4. No VPS:
   - Extrai em `/opt/prospector-platform/releases/<run-id>/`
   - Gera `.env` com secrets na primeira vez (preserva nas seguintes)
   - constrói web/migrate e uma única imagem imutável compartilhada pelos 40 workers e scheduler
   - Sobe postgres, redis, embeddings → espera healthy
   - Gera backup custom-format do PostgreSQL antes das migrations
   - Roda o runner canônico de migrations → valida que a versão mais recente foi aplicada
   - Recria container web → espera healthy → valida `/api/health`
   - `docker compose up -d` para scheduler e os 40 workers; cada módulo só carrega com sua flag individual
   - Configura proxy nginx na primeira vez
   - Valida que Gazeta Concursos não foi afetada
   - Ativa release e limpa releases antigas (mantém 3)

## Verificação após deploy

```powershell
# Design System
Start-Process "https://design.rotadeataque.com.br"

# Prospector
Start-Process "https://design.rotadeataque.com.br/prospector"

# Inspecionar containers remotamente
.\deploy\inspect-vps.ps1

# Validar migrations em banco vazio e em clone da produção, com restore
.\deploy\validate-migrations.ps1
```

Providers orgânicos e workers ficam `false` por padrão. Configure credenciais e budget no servidor, execute um canário limitado e só então habilite a flag individual. `cleanup-build-cache.ps1` remove apenas cache de build Docker regenerável e deve ser usado quando o VPS estiver sem espaço; ele confirma a Gazeta antes de encerrar.

O processo de cada worker sobe mesmo quando o estado desejado está pausado. O runtime consulta `worker_settings` periodicamente e aplica pause/resume sem redeploy; o deployment não deve mais usar uma flag de ambiente como fonte concorrente de estado. Após as migrations do control plane, confirme `worker_commands`, `worker_runs` e heartbeat antes de habilitar qualquer canário.

O `docker/worker.Dockerfile` e o `apps/web/Dockerfile` executam
`pnpm check:runtime-deps` dentro do build, antes de instalar/compilar. O deploy
também conserva o backup pré-migration em `shared/backups/`; não marque uma
migration manualmente no ledger para contornar falha do runner.

Os scripts remotos são gravados em arquivo temporário antes de executar. Não volte a enviá-los diretamente ao `stdin` de `bash`: comandos como `docker compose` podem consumir o restante do script e produzir falso sucesso. O rollout do Design também exige container `api` identificado, health Docker saudável, readiness público e rota protegida retornando 401 sem sessão.

## Diagnóstico

| Erro | Solução |
|------|---------|
| `Chave SSH não encontrada` | Passe `-IdentityFile` com caminho correto |
| `Permission denied (publickey)` | Confirme que a chave está autorizada no VPS |
| `Build do Design System falhou` | Rode `pnpm run build` manualmente em `apps/design-system` para ver erros |
| `Upload falhou` | Verifique conectividade com o VPS |
| `nginx -t falhou` | Versão anterior é restaurada automaticamente |
| `Migrations falharam` | Verifique logs: `ssh root@IP "docker logs prospector-platform-migrate-run-*"` |
| `Gazeta não preservada` | Deploy aborta se Gazeta for afetada; inspecione com `inspect-vps.ps1` |
