# Deploy — Gerador de Criativos

O frontend é publicado como build estático no diretório exclusivo do Sistema de
Design no VPS. Por padrão, ao terminar essa troca atômica, o script também chama
`plataforma/deploy/deploy.ps1`: sobe a plataforma compartilhada, aplica migrations
e valida que os containers da Gazeta Concursos não foram recriados.

## Pré-requisitos locais

- Uma chave privada SSH autorizada no VPS. O padrão é
  `C:\Users\Lenovo\.ssh\id_rsa`.
- `deploy/.env` criado localmente a partir de `deploy/.env.example`.
- Node.js, npm, tar, ssh e scp disponíveis.

`deploy/.env` contém somente os parâmetros não sensíveis abaixo e já está no
`.gitignore`:

```dotenv
VPS_HOST=seu-vps.exemplo
VPS_USER=usuario-administrativo
VPS_TARGET_DIR=/var/www/design-rota-ataque
VPS_DOMAIN=design.seu-dominio.exemplo
```

Nunca salve senhas, tokens ou a chave privada no repositório ou no arquivo de
ambiente de deploy.

## Publicação segura

No PowerShell, dentro de `Gerador-React`:

```powershell
.\deploy\deploy.ps1 -NoPush
```

O parâmetro `-NoPush` é o modo recomendado e não faz `git add`, commit ou push.
Na prática, o script não altera Git em nenhum modo.

Para publicar somente o frontend estático, sem executar o deploy conjunto da
plataforma, use `-DesignOnly`.

Para usar outra chave autorizada:

```powershell
.\deploy\deploy.ps1 -NoPush -IdentityFile "C:\caminho\para\id_rsa"
```

O fluxo executa, nesta ordem:

1. Confere a chave e os valores não sensíveis em `deploy/.env`.
2. Faz preflight SSH não interativo com `-i`, `IdentitiesOnly=yes`,
   `BatchMode=yes` e timeout de conexão.
3. Confirma que o alvo é exatamente `/var/www/design-rota-ataque`.
4. Executa lint e build, salvo quando `-SkipBuild` é solicitado.
5. Envia um `.tar.gz` com nome exclusivo para `/tmp` no VPS.
6. Extrai o build em diretório temporário irmão, valida `index.html`, ajusta
   dono/permissões e executa `nginx -t`.
7. Troca o diretório publicado somente depois das validações. Se a troca ou o
   reload falhar, restaura automaticamente a versão anterior.
8. Executa o deploy da plataforma para as campanhas Rota de Ataque e Gazeta
   Concursos; `-DesignOnly` interrompe o fluxo antes desta etapa.
9. Remove os arquivos temporários locais e remotos controlados pelo script.

## Verificação após deploy

O próprio script interrompe a publicação se o preflight, lint, build, upload ou
validação do nginx falhar. Depois, confira o domínio configurado em
`VPS_DOMAIN` e a rota de saúde da API quando ela estiver disponível no domínio.

## Diagnóstico

- `Chave SSH não encontrada`: informe `-IdentityFile` com um caminho válido.
- `Permission denied (publickey)`: confirme que a chave indicada está
  autorizada para o usuário configurado; não use senha como alternativa.
- `nginx -t` ou reload falhou: a versão anterior é restaurada automaticamente.
- `dist/index.html não existe`: rode sem `-SkipBuild` para gerar o artefato.
