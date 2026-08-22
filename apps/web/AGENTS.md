@RTK.md

## ⚠️ REGRA CRÍTICA — Branch e commit

**Sempre commitar diretamente em `main`. NUNCA criar branches nem PRs.**

A proteção de branch foi removida no GitHub para este repositório.
Fluxo correto após qualquer alteração:

```bash
git add <arquivos-modificados>
git commit -m "tipo: descrição"
git push origin main
```

Push em `main` → CI builda Docker → GHCR → deploy automático na VPS.
Ver regras completas em `../../AGENTS.md`.

# Regras obrigatórias — apps/web (Prospector)

## basePath (`/prospector`)

O app é publicado com `basePath=/prospector` compilado no bundle (via `ARG NEXT_PUBLIC_BASE_PATH` no Dockerfile).
Isso muda o comportamento de várias APIs do Next.js e do next-auth de formas não óbvias:

| Contexto | Regra |
|---|---|
| `<a href>`, `fetch()`, `window.location` | Usar `appPath('/caminho')` — é obrigatório incluir o basePath |
| `<Link href>`, `router.push()`, `router.replace()` | Usar o caminho **sem** o basePath (`'/content-items/123'`). O Next.js adiciona o basePath automaticamente. Usar `appPath()` aqui duplica o prefixo. |
| Middleware — `request.nextUrl.pathname` | Vem **sem** o basePath. O basePath fica em `request.nextUrl.basePath`. |
| Middleware — redirect | **Nunca** usar `request.nextUrl.clone()` para montar o destino. Usar `new URL(loginPath, request.url)` — o `NextURL` reaplica o basePath na serialização. |
| Matcher do middleware | O Next prefixa o `config.matcher` com o basePath no build. Incluir `'/'` explicitamente para cobrir a raiz. |

## NEXTAUTH_URL

O contrato do next-auth v4 é que `NEXTAUTH_URL` aponta para a **base da API de autenticação**, não para a raiz do app:

```
NEXTAUTH_URL=https://design.rotadeataque.com.br/prospector/api/auth   # correto
APP_URL=https://design.rotadeataque.com.br/prospector
```

`NEXTAUTH_URL` sem o sufixo `/api/auth` faz o `signIn()` do lado cliente chamar `/api/auth/...` sem o prefixo `/prospector`, que o nginx entrega para o app design-system (porta 3002) em vez do Prospector (porta 3010).

O `SessionProvider` na página de login **deve** receber `basePath={appPath('/api/auth')}` via `<NextAuthBasePath>` para garantir que o next-auth resolva a base corretamente no navegador.

## Rebuild obrigatório no deploy

O `NEXT_PUBLIC_BASE_PATH` é gravado no bundle em build time. Restart do container **não** aplica mudanças de basePath — é obrigatório um rebuild completo da imagem:

```bash
pwsh -File deploy/deploy-all.ps1 -Only prospector
```
