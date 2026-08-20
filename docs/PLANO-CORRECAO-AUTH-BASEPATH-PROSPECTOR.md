# Plano de Correção — Loop de Redirect, 502 e basePath duplicado (Prospector)

**Data:** 19/08/2026
**Alvo:** `apps/web` (`@plataforma/web`) publicado em `https://design.rotadeataque.com.br/prospector`
**Branch atual:** `feat/ui-ux-prospector-completion`
**Método:** systematic-debugging — causa raiz confirmada antes de qualquer correção.

---

## 1. Sintomas relatados

1. Aba Overview (`/prospector`) carrega a casca da aplicação mas o conteúdo cai no boundary de erro: *"Não deu para carregar — 4085371870"*.
2. Sidebar mostra `viewer` / **"Sessão indisponível"**.
3. Todas as outras abas falham: `Failed to fetch RSC payload` + `net::ERR_TOO_MANY_REDIRECTS`.
4. A URL do redirect tem **`/prospector/prospector/login`** com `callbackUrl` reencodado dezenas de vezes.
5. Abrir essa URL direto entrega **502 Bad Gateway (nginx/1.24.0)**.

---

## 2. Causa raiz (confirmada, não inferida)

### 2.1 O `NextURL` já reaplica o `basePath` — o middleware aplica de novo

`apps/web/src/middleware.ts` monta o destino assim:

```ts
const { loginPath } = authRedirectPaths(pathname, search, normalizedBasePath(request))
// loginPath === '/prospector/login'
const login = request.nextUrl.clone()
login.pathname = loginPath          // <-- aqui
return NextResponse.redirect(login)
```

Dentro do middleware, `request.nextUrl.pathname` vem **sem** o basePath (`/leads`), e o basePath fica em `request.nextUrl.basePath`. Na serialização, `NextURL.href` chama `formatPathname()`, que executa `addPathPrefix(pathname, info.basePath)` — ou seja, **o `/prospector` é recolocado automaticamente**.

Evidência (`node_modules/next/dist/shared/lib/router/utils/format-next-pathname-info.js`):

```js
pathname = addPathPrefix(pathname, info.basePath)
```

Reprodução executada localmente com o próprio `NextURL` do Next 15.5.9 instalado no projeto:

```
request /prospector/leads -> nextUrl.pathname = /leads | basePath = /prospector
   redirect Location => https://design.rotadeataque.com.br/prospector/prospector/login?callbackUrl=%2Fprospector%2Fleads
```

Isso é **byte a byte** a URL que aparece no console do navegador.

### 2.2 O middleware não isenta a própria página de login → loop infinito

Não há nenhuma condição de escape para `/login`. Então a requisição gerada em 2.1 entra de novo no middleware, gera um novo `callbackUrl` contendo o `callbackUrl` anterior **já percent-encoded**, e cada salto aproximadamente **dobra o tamanho da URL**. Esse é o `%25252525...` do console.

> Atenção: **esse bug é independente do 2.1**. Corrigir só o basePath duplicado ainda deixaria `/login` → `/login?callbackUrl=/login` → … em loop.

### 2.3 O 502 é consequência, não uma falha separada

O nginx faz `proxy_pass http://127.0.0.1:3010`. A cada salto o header `Location:` da resposta cresce. Quando o header de resposta do upstream ultrapassa o `proxy_buffer_size` (padrão 4k/8k), o nginx aborta com `upstream sent too big header while reading response header from upstream` e devolve **502**. A URL do print já tinha ~3,9 KB — o salto seguinte estoura o buffer.

**Verificação obrigatória no VPS antes de dar como fechado:**

```bash
grep -c "too big header" /var/log/nginx/error.log
```

### 2.4 Por que só a Overview renderiza (e por que isso é uma falha de segurança)

O matcher do middleware é `'/((?!_next/static|_next/image|favicon.ico).*)'`. No build, o Next **prefixa o matcher com o basePath** (`node_modules/next/dist/build/analysis/get-page-static-info.js:260`):

```js
if (nextConfig.basePath) { source = `${nextConfig.basePath}${source}` }
```

Regex resultante e teste executado com o compilador de matcher do próprio Next:

```
^\/prospector(?:\/(_next\/data\/[^/]{1,}))?(?:\/((?!_next\/static|_next\/image|favicon.ico).*))(\.json)?[\/#\?]?$

/prospector                    false   <-- middleware NÃO roda
/prospector/                   true
/prospector/leads              true
/prospector/login              true
```

Consequências:

- `/prospector` (sem barra final) **não passa pelo middleware** → renderiza sem sessão. É exatamente o print 2: casca montada, `getServerSession()` retorna `null` → fallback `"Sessão indisponível"` com papel `viewer` (`apps/web/src/app/layout.tsx`).
- Todos os prefetches do sidebar (`/prospector/leads`, `/prospector/radar`, …) **passam** pelo matcher → caem no loop.
- **Isso é um bypass de autenticação:** a Overview é renderizada no servidor com dados reais de campanha (`mv_campaign_performance`, `campaigns`) para qualquer visitante anônimo.

### 2.5 O login está quebrado por baixo de tudo isso

`apps/web/src/app/login/page.tsx` usa `signIn()` do `next-auth/react`. No navegador, o next-auth resolve a base da API assim (`node_modules/next-auth/react/index.js:54` + `client/_utils.js`):

```js
basePath: parseUrl(process.env.NEXTAUTH_URL).path
// apiBaseUrl(): typeof window !== 'undefined' ? __NEXTAUTH.basePath : ...
```

O Next só injeta variáveis `NEXT_PUBLIC_*` no bundle do cliente (`node_modules/next/dist/build/define-env.js` → `getNextPublicEnvironmentVariables()`). Logo `process.env.NEXTAUTH_URL` é `undefined` no browser e `parseUrl(undefined).path` cai no default **`/api/auth`**, sem o `/prospector`.

E o nginx do host tem, inserido por `deploy/deploy-all.ps1`:

```nginx
location ^~ /api/ { proxy_pass http://127.0.0.1:3002; }   # rota-design-api
location ^~ /prospector { proxy_pass http://127.0.0.1:3010; }
```

Ou seja: o `POST /api/auth/callback/credentials` do formulário de login vai para **o app design-system (porta 3002)**, não para o Prospector. O envio do código OTP funciona (usa `appPath()` → `/prospector/api/auth/otp`), mas a autenticação em si nunca chega ao destino. Isso explica a sessão inexistente do print 2.

---

## 3. Achados consolidados

| # | Achado | Arquivo | Severidade |
|---|--------|---------|-----------|
| A1 | Matcher não cobre a raiz `/prospector` → **bypass de autenticação** e Overview servida sem sessão | `apps/web/src/middleware.ts` (`config.matcher`) | **Crítica (segurança)** |
| A2 | `basePath` duplicado no redirect (`/prospector/prospector/login`) | `apps/web/src/middleware.ts` | **Crítica** |
| A3 | `/login` não isento → loop infinito de redirect | `apps/web/src/middleware.ts` | **Crítica** |
| A4 | `signIn()` do next-auth aponta para `/api/auth` (app errado no nginx) → login impossível | `apps/web/src/app/login/page.tsx` | **Crítica** |
| A5 | 502 do nginx (header `Location` maior que `proxy_buffer_size`) | consequência de A2+A3 | Alta (some com A2/A3) |
| B1 | `appPath()` usado com `<Link>` / `router.push` → `/prospector/prospector/content-items/...` | `content-items/ContentItemsClient.tsx:21,23`; `content-items/[id]/ContentItemActions.tsx:5` | Alta |
| B2 | Erro de Server Component na Overview (digest `4085371870`) — precisa do log do container | `apps/web/src/lib/dashboard-data.ts` (`mv_campaign_performance`) | Alta |
| B3 | Um `Pool` do Postgres **por request** + `pool.end()` — 92 ocorrências; com ~25 prefetches simultâneos vira tempestade de conexões | `apps/web/src/**` + `packages/db/src/index.ts` | Média |
| B4 | Views materializadas só são atualizadas pelo worker `data-quality`, que está desabilitado (`WORKER_*_ENABLED=false`) → Overview congelada no último `REFRESH` da migration 0007 | `workers/data-quality/src/main.ts`, `deploy/deploy-all.ps1` | Média |
| B5 | `middleware.test.ts` testa só a função pura `authRedirectPaths` — nunca o `Location` real; por isso o bug passou verde | `apps/web/src/middleware.test.ts` | Média |
| B6 | `/prospector/api/health` é público (isento no middleware) e expõe contagem de workers e de falhas | `apps/web/src/middleware.ts`, `api/health/route.ts` | Baixa |
| B7 | Health check é vacuamente verde: com todos os workers desabilitados, `enabledWorkers = []` → `workersOk` sempre `true` (badge "Ao vivo" no print 2 mesmo sem nada rodando) | `apps/web/src/app/api/health/route.ts` | Baixa |
| B8 | Em `authRedirectPaths`, os operadores `|| '/login'` e `|| '/'` são código morto (template literal nunca é falsy) | `apps/web/src/middleware.ts` | Baixa |
| B9 | `/organic-budgets` existe como página mas não está em nenhum grupo da navegação | `apps/web/src/components/AppShell.tsx` | Baixa |

---

## 4. Correções

### Etapa 1 — Middleware: matcher, basePath e isenção do login *(A1 + A2 + A3)*

**Arquivo:** `apps/web/src/middleware.ts`

**1.1** Reescrever `authRedirectPaths` devolvendo também o caminho relativo, e manter o `callbackPath` como o caminho **visto pelo navegador** (com basePath):

```ts
export function authRedirectPaths(pathname: string, search: string, basePath: string) {
  const relative = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname
  return {
    relativePath: relative,
    loginPath: `${basePath}/login`,
    callbackPath: `${basePath}${relative}${search}`,
  }
}
```

**1.2** Parar de usar `request.nextUrl.clone()` para o destino. Montar um `URL` comum, que **não** aplica basePath automaticamente:

```ts
const basePath = normalizedBasePath(request)
const { relativePath, loginPath, callbackPath } = authRedirectPaths(pathname, request.nextUrl.search, basePath)

if (relativePath === '/login') return NextResponse.next()   // 1.3

const login = new URL(loginPath, request.url)
login.searchParams.set('callbackUrl', callbackPath)
return NextResponse.redirect(login)
```

> Por que `URL` e não `NextURL`: `NextResponse.redirect()` só faz `String(new URL(...))` no valor recebido. Com `URL` puro o caminho vai literalmente como escrito, e a correção funciona **tanto** quando o basePath foi compilado no build **quanto** quando só existe a variável de ambiente (fallback já previsto em `normalizedBasePath`).

**1.3** Isentar `/login` (linha acima). A isenção precisa usar o caminho **relativo**, não o `pathname` cru, para funcionar nos dois modos de deploy.

**1.4** Fechar o buraco da raiz no matcher:

```ts
export const config = { matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)'] }
```

**Validação já executada** (compilador de matcher do próprio Next, com `basePath: '/prospector'`):

```
/prospector                    true
/prospector/                   true
/prospector/leads              true
/prospector/login              true
/prospector/api/health         true
/prospector/_next/static/x.js  false
/prospector/_next/image        false
```

**Simulação do redirect corrigido** (executada, nos dois modos de deploy):

```
/prospector/leads                      -> /prospector/login?callbackUrl=%2Fprospector%2Fleads
/prospector/content-items?status=draft -> /prospector/login?callbackUrl=%2Fprospector%2Fcontent-items%3Fstatus%3Ddraft
/prospector/login                      -> PASS (sem redirect)
```

---

### Etapa 2 — Login: apontar o next-auth para o basePath correto *(A4)*

**Arquivos:** `apps/web/src/app/login/page.tsx` + um wrapper client novo

O `signIn()` lê `__NEXTAUTH.basePath` **no momento da chamada**, e o `SessionProvider` do próprio next-auth sobrescreve esse valor quando recebe a prop `basePath` (`node_modules/next-auth/react/index.js:368` → `if (basePath) __NEXTAUTH.basePath = basePath`).

**2.1** Envolver a página de login com o provider do next-auth, sem ligar polling de sessão (o `SessionProvider` próprio do app, server-side, continua como está):

```tsx
// apps/web/src/components/NextAuthBasePath.tsx
'use client'
import { SessionProvider } from 'next-auth/react'
import { appPath } from '@/lib/base-path'
export function NextAuthBasePath({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={appPath('/api/auth')} refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  )
}
```

Usar em `src/app/login/page.tsx` (ou em `layout.tsx`, se outras telas passarem a usar `signOut()`).

**2.2 (alternativa, se preferir não depender do provider):** trocar `signIn('credentials', …)` por um POST direto, que já é a rota real do app:

```ts
const csrf = await (await fetch(appPath('/api/auth/csrf'))).json()
const response = await fetch(appPath('/api/auth/callback/credentials'), {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, otp, callbackUrl, json: 'true' }),
})
```

**2.3** Corrigir `NEXTAUTH_URL`. O contrato do next-auth v4 é a **base da API**, não a raiz do app. Em `deploy/deploy-all.ps1` (bloco que gera `$shared/.env`) e em `.env.example`:

```diff
-NEXTAUTH_URL=https://design.rotadeataque.com.br/prospector
+NEXTAUTH_URL=https://design.rotadeataque.com.br/prospector/api/auth
```

`APP_URL` continua `https://design.rotadeataque.com.br/prospector`. `NEXTAUTH_URL` começa com `https://` nos dois casos, então o nome do cookie (`__Secure-next-auth.session-token`) usado por `getToken()` no middleware e por `getServerSession()` não muda.

**2.4** Verificação manual: pedir o código, autenticar e conferir no DevTools → Network que o POST vai para `/prospector/api/auth/callback/credentials` (**e não** `/api/auth/...`), com resposta 200.

---

### Etapa 3 — Remover `appPath()` de navegação interna *(B1)*

Regra: `appPath()` é **só** para URLs que o navegador resolve sozinho — `<a href>`, `fetch()`, `window.location`. `next/link` e `useRouter()` **já aplicam o basePath**; usar `appPath()` neles duplica.

| Arquivo | Linha | Correção |
|---|---|---|
| `apps/web/src/app/content-items/ContentItemsClient.tsx` | 21 | `router.push(appPath(...))` → `router.push('/content-items/' + body.itemId)` |
| `apps/web/src/app/content-items/ContentItemsClient.tsx` | 23 | `<Link href={appPath(...)}>` → `<Link href={'/content-items/' + item.id}>` |
| `apps/web/src/app/content-items/[id]/ContentItemActions.tsx` | 5 | `router.push(appPath(...))` → `router.push('/content-items/' + body.item.id)` |

Usos que estão **corretos** e não devem ser mexidos: `AccountsClient.tsx:88,127,131`, `RunbooksClient.tsx:36`, `SystemHealthClient.tsx:49` (`RunbookLink` renderiza `<a>`), `error.tsx`, e todos os `fetch(appPath('/api/...'))`.

**Guardrail:** adicionar em `src/production-ui-guardrails.test.ts` uma asserção que falhe se o código-fonte contiver `href={appPath(` dentro de um `<Link` ou `router.push(appPath(` / `router.replace(appPath(`.

---

### Etapa 4 — Diagnosticar o erro da Overview *(B2)*

Ainda **não** há evidência suficiente para nomear a causa: o digest `4085371870` só existe no log do servidor. Não aplicar correção especulativa aqui.

**4.1 Coletar a evidência no VPS:**

```bash
docker compose -p prospector-platform -f /opt/prospector-platform/current/docker/docker-compose.yml logs --tail=400 web | grep -A20 4085371870
```

**4.2 Hipótese mais provável (ranqueada primeiro):** a Overview é a **única** view de `apps/web/src/lib/dashboard-data.ts` que lê uma *materialized view* (`mv_campaign_performance`); todas as outras leem tabelas normais. A MV é criada `WITH NO DATA` na migration `0003_reliability_and_scheduling.up.sql` e populada só pela `0007_populate_materialized_views.up.sql`. Consultar uma MV não populada gera `ERROR 55000: materialized view "mv_campaign_performance" has not been populated`. Isso explica precisamente "só a primeira aba quebra".

Checagem direta:

```bash
docker compose -p prospector-platform -f /opt/prospector-platform/current/docker/docker-compose.yml exec -T postgres psql -U prospector -d prospector -c "SELECT relname, relispopulated FROM pg_class WHERE relkind='m';"
```

Se `relispopulated = false`, aplicar:

```sql
REFRESH MATERIALIZED VIEW mv_campaign_performance;
```

**4.3 Correção estrutural (independente do resultado):** `loadDashboardView` deve degradar em vez de derrubar a página inteira — capturar `55000` / `42P01` e devolver `{ items: [], stale: true }`, com a UI mostrando um aviso de "dados ainda não consolidados" em vez do `ErrorState`.

**4.4** Hipótese secundária, só se 4.2 for descartada: exaustão de conexões (ver Etapa 6). Contra essa hipótese pesa o fato de o badge "Ao vivo" estar verde no print — `/api/health` executou `SELECT 1` com sucesso no mesmo instante.

---

### Etapa 5 — Testes que teriam pego o bug *(B5)*

`apps/web/src/middleware.test.ts` hoje só valida a função pura. Adicionar um teste do **middleware inteiro**, verificando o header `Location`:

```ts
import { NextRequest } from 'next/server'
import middleware from './middleware'

const request = (path: string) =>
  new NextRequest(new URL(`https://design.rotadeataque.com.br${path}`), { nextConfig: { basePath: '/prospector' } })

it('redireciona para o login sem duplicar o basePath', async () => {
  const response = await middleware(request('/prospector/leads'))
  expect(response.headers.get('location'))
    .toBe('https://design.rotadeataque.com.br/prospector/login?callbackUrl=%2Fprospector%2Fleads')
})

it('não redireciona a própria tela de login', async () => {
  expect((await middleware(request('/prospector/login'))).headers.get('location')).toBeNull()
})
```

E um teste do matcher compilado, que é o que falhou em A1:

```ts
import { getMiddlewareMatchers } from 'next/dist/build/analysis/get-page-static-info.js'
import { config } from './middleware'

it('cobre a raiz do basePath', () => {
  const regexes = getMiddlewareMatchers(config.matcher, { basePath: '/prospector' }).map(m => new RegExp(m.regexp))
  expect(regexes.some(r => r.test('/prospector'))).toBe(true)
  expect(regexes.some(r => r.test('/prospector/_next/static/x.js'))).toBe(false)
})
```

Comandos: `pnpm --filter @plataforma/web test` e `pnpm --filter @plataforma/web typecheck`.

---

### Etapa 6 — Pool de Postgres por request *(B3)* — pós-incidente

92 pontos fazem `createDatabase(process.env.DATABASE_URL!)` + `await pool.end()` a cada request. `packages/db/src/index.ts` cria um `new Pool(...)` novo em toda chamada. Uma navegação simples abre pelo menos 2 pools (layout + página); a montagem do sidebar dispara ~25 prefetches simultâneos.

Correção sugerida (fora do hotfix, em PR separado):

```ts
// packages/db/src/index.ts
const pools = new Map<string, { pool: Pool; db: ReturnType<typeof drizzle> }>()
export const createDatabase = (connectionString: string) => {
  let entry = pools.get(connectionString)
  if (!entry) {
    const pool = new Pool({ connectionString, max: 10, application_name: 'plataforma' })
    entry = { pool, db: drizzle(pool) }
    pools.set(connectionString, entry)
  }
  return entry
}
```

**Esse refactor obriga a remover os 91 `await pool.end()`** — encerrar um pool compartilhado quebraria as requisições seguintes. Por isso ele **não** entra no hotfix: é mudança ampla, precisa de PR próprio, `pnpm test` completo e smoke de todas as rotas.

---

### Etapa 7 — Itens menores *(B4, B6, B7, B8, B9)*

- **B4:** decidir entre habilitar `WORKER_DATA_QUALITY_ENABLED=true` no `$shared/.env` do VPS ou criar um cron de `REFRESH MATERIALIZED VIEW`. Sem isso a Overview mostra sempre o mesmo número.
- **B6:** avaliar reduzir o payload público de `/api/health` para `{ ok, at }`, movendo detalhes de workers e falhas para uma rota autenticada.
- **B7:** em `api/health/route.ts`, quando `enabledWorkers.length === 0`, reportar `status: 'idle'` em vez de `ok`, para o badge não mentir.
- **B8:** remover os `|| '/login'` e `|| '/'` mortos de `authRedirectPaths`.
- **B9:** incluir `/organic-budgets` em um grupo do `AppShell` ou remover a página.

---

## 5. Ordem de execução

| Ordem | Etapa | Status |
|---|---|---|
| 1 | Etapa 1 (middleware) + Etapa 5 (testes) | ✅ Concluído (19/08/2026) |
| 2 | Etapa 2 (login next-auth + `NEXTAUTH_URL`) | ✅ Concluído (19/08/2026) |
| 3 | Etapa 3 (`appPath` em navegação) | ✅ Concluído (19/08/2026) |
| 4 | Deploy + Etapa 4.1/4.2 (diagnóstico da Overview no VPS) | ⏳ Pendente — requer `pwsh -File deploy/deploy-all.ps1 -Only prospector` e leitura dos logs do container |
| 5 | Etapa 4.3 (degradação suave) | ✅ Concluído (19/08/2026) — `loadDashboardView` captura 55000/42P01 e devolve `{ items: [], stale: true }`; banner de aviso renderizado na UI |
| 6 | Etapa 6 (pool compartilhado) | ✅ Concluído (19/08/2026) — singleton via Map, 92 `pool.end()` removidos, 33/33 testes verdes |
| 7 | Etapa 7 (itens menores B4, B6–B9) | ⏳ Pendente |

Etapas 1–3 são um único hotfix, buildado e publicado por:

```bash
pwsh -File deploy/deploy-all.ps1 -Only prospector
```

O `NEXT_PUBLIC_BASE_PATH` é fixado como `ARG` no `apps/web/Dockerfile` (`/prospector`), então o basePath é gravado no bundle em build time — **rebuild da imagem é obrigatório**, não basta restart do container.

---

## 6. Critérios de aceite

1. `curl -sI https://design.rotadeataque.com.br/prospector/leads` responde `302` com `Location: https://design.rotadeataque.com.br/prospector/login?callbackUrl=%2Fprospector%2Fleads` — **uma** ocorrência de `/prospector`.
2. `curl -sI https://design.rotadeataque.com.br/prospector/login` responde `200` (sem `Location`).
3. `curl -s -o /dev/null -w '%{http_code}' https://design.rotadeataque.com.br/prospector` responde `302` para o login quando anônimo (fim do bypass A1).
4. `grep -c "too big header" /var/log/nginx/error.log` para de crescer.
5. Login completo (OTP → código → sessão) com o POST em `/prospector/api/auth/callback/credentials`.
6. Navegação por todas as 25 entradas do sidebar sem `Failed to fetch RSC payload` no console.
7. Abrir um item em Conteúdos vai para `/prospector/content-items/<id>` (sem duplicação).
8. Overview renderiza KPIs e gráfico sem cair no `ErrorState`.
9. `pnpm --filter @plataforma/web test` e `pnpm --filter @plataforma/web typecheck` verdes.

---

## 7. Documentação a atualizar junto com a correção

- `docs/architecture/` — registrar a regra de basePath: `appPath()` **apenas** para `<a>`, `fetch` e `window.location`; `next/link` e `useRouter` nunca.
- `apps/web/AGENTS.md` / `CLAUDE.md` — mesma regra, mais o contrato de `NEXTAUTH_URL` (base da API, terminando em `/api/auth`).
- `.env.example` e `deploy/deploy-all.ps1` — novo valor de `NEXTAUTH_URL`.
- `CHANGELOG.md` — entrada do hotfix.
- Este plano — marcar as etapas concluídas e anexar a causa real do digest `4085371870` quando o log do VPS for lido.
