export interface IntegrationCapability {
  id: string
  name: string
  status: 'ready'|'partial'|'not_configured'|'disabled'|'degraded'|'rate_limited'|'budget_blocked'|'error'
  detail: string
  missing: string[]
}

interface Queryable { query<T>(sql:string,values?:unknown[]):Promise<{rows:T[]}> }

function capability(id:string,name:string,required:string[],extraReady=true):IntegrationCapability {
  const missing=required.filter((key)=>!process.env[key]?.trim())
  const status=missing.length===0&&extraReady?'ready':missing.length===required.length?'not_configured':'partial'
  return {id,name,status,missing,detail:status==='ready'?'Variáveis obrigatórias presentes.':`Faltam: ${missing.join(', ')||'vínculo da conta'}`}
}

function organicProvider(id:string,name:string,enabledKey:string,required:string[],budgetBlocked=false):IntegrationCapability {
  const configured=capability(id,name,required)
  if(process.env[enabledKey]!=='true') return {...configured,status:'disabled',detail:'Integração configurável, desativada por feature flag.'}
  if(budgetBlocked) return {...configured,status:'budget_blocked',detail:'Hard limit do orçamento atingido antes da próxima chamada.'}
  return configured
}

export async function getIntegrationCapabilities(database?:Queryable):Promise<IntegrationCapability[]> {
  let accounts:Array<{role:string;meta_access_token_encrypted:string|null;meta_token_expires_at:string|null;threads_user_id:string|null}>=[]
  let aiReady=false
  let organicBudgetBlocked=false
  if(database){try{accounts=(await database.query(`SELECT role,meta_access_token_encrypted,meta_token_expires_at,threads_user_id FROM accounts`)).rows as typeof accounts}catch{accounts=[]}}
  if(database){try{aiReady=Boolean((await database.query<{ready:boolean}>(`SELECT EXISTS(SELECT 1 FROM ai_models model JOIN ai_providers provider ON provider.id=model.provider_id WHERE model.is_default AND model.enabled AND provider.enabled AND provider.deleted_at IS NULL AND (provider.kind='local' OR provider.secret_configured)) ready`)).rows[0]?.ready)}catch{aiReady=false}}
  if(database){try{organicBudgetBlocked=Boolean((await database.query<{blocked:boolean}>(`SELECT EXISTS(SELECT 1 FROM organic_budgets WHERE hard_limit AND spent_usd+reserved_usd>=limit_usd AND period_started_at<=now()) blocked`)).rows[0]?.blocked)}catch{organicBudgetBlocked=false}}
  const actor=accounts.find((account)=>account.role==='actor'),collector=accounts.find((account)=>account.role==='collector')
  const metaLinked=Boolean(actor?.meta_access_token_encrypted||collector?.meta_access_token_encrypted||process.env.META_ACCESS_TOKEN)
  const meta=capability('meta','Meta / Instagram',['META_APP_ID','META_APP_SECRET','META_WEBHOOK_VERIFY_TOKEN'],metaLinked)
  if(!metaLinked&&meta.missing.length<3){meta.status='partial';meta.detail='Aplicativo configurado; falta vincular uma conta pelo OAuth.'}
  const threads=capability('threads','Threads',['META_APP_ID','META_APP_SECRET'],Boolean(actor?.threads_user_id||process.env.THREADS_ACCESS_TOKEN))
  if(threads.status!=='ready'&&!threads.missing.length)threads.detail='Falta vincular o usuário Threads.'
  const hashSaltReady = Boolean(process.env.DISCOVERY_AUTHOR_HASH_SALT?.trim())
  const apifyRedditReady = process.env.APIFY_ENABLED === 'true' && hashSaltReady && Boolean(process.env.APIFY_API_TOKEN?.trim() && process.env.APIFY_REDDIT_ACTOR_ID?.trim())
  const brightRedditReady = process.env.BRIGHT_DATA_ENABLED === 'true' && hashSaltReady && Boolean(process.env.BRIGHT_DATA_API_KEY?.trim() && process.env.BRIGHT_DATA_DATASET_ID?.trim())
  const redditMissing = [
    !process.env.APIFY_API_TOKEN?.trim() ? 'APIFY_API_TOKEN' : '',
    !process.env.APIFY_REDDIT_ACTOR_ID?.trim() ? 'APIFY_REDDIT_ACTOR_ID' : '',
    !process.env.BRIGHT_DATA_API_KEY?.trim() ? 'BRIGHT_DATA_API_KEY' : '',
    !process.env.BRIGHT_DATA_DATASET_ID?.trim() ? 'BRIGHT_DATA_DATASET_ID' : '',
    !hashSaltReady ? 'DISCOVERY_AUTHOR_HASH_SALT' : '',
  ].filter(Boolean)
  const redditEnabled = process.env.APIFY_ENABLED === 'true' || process.env.BRIGHT_DATA_ENABLED === 'true'
  const redditStatus: IntegrationCapability['status'] = apifyRedditReady || brightRedditReady
    ? 'ready'
    : redditEnabled
      ? 'partial'
      : 'disabled'
  const redditExternal: IntegrationCapability = {
    id: 'reddit-external',
    name: 'Reddit via provedores externos',
    status: redditStatus,
    missing: redditMissing,
    detail: apifyRedditReady ? 'Apify está pronto como provider primário; Bright Data permanece fallback controlado.' : brightRedditReady ? 'Bright Data está pronto como fallback externo.' : redditEnabled ? 'Integração habilitada, mas faltam credenciais do provider e o salt de anonimização. O cliente oficial não é necessário.' : 'Integração externa desativada. Habilite Apify ou Bright Data somente após preencher todas as variáveis.',
  }
  const capabilities=[
    meta,
    threads,
    redditExternal,
    capability('whatsapp','WhatsApp Cloud',['WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_ACCESS_TOKEN','WHATSAPP_WEBHOOK_VERIFY_TOKEN','WHATSAPP_APP_SECRET']),
    capability('email','E-mail / Resend',['RESEND_API_KEY','EMAIL_FROM','RESEND_WEBHOOK_SECRET']),
    {id:'llm',name:'Modelos de IA',status:(aiReady||Boolean(process.env.LLM_MODEL&&process.env.LLM_ENDPOINT&&process.env.LLM_API_KEY)?'ready':'not_configured') as IntegrationCapability['status'],missing:[],detail:aiReady?'Modelo padrão e provedor ativos no cofre do Prospector.':process.env.LLM_MODEL&&process.env.LLM_ENDPOINT&&process.env.LLM_API_KEY?'Modelo configurado pelas variáveis de ambiente.':'Cadastre uma chave e ative o modelo padrão em Modelos de IA.'},
    capability('embeddings','Embeddings',['EMBEDDINGS_ENDPOINT']),
    capability('runtime','Banco e filas',['DATABASE_URL','REDIS_URL']),
    organicProvider('exa','Exa discovery','EXA_ENABLED',['EXA_API_KEY'],organicBudgetBlocked),
    organicProvider('apify','Apify collectors','APIFY_ENABLED',['APIFY_API_TOKEN'],organicBudgetBlocked),
    organicProvider('bright-data','Bright Data fallback','BRIGHT_DATA_ENABLED',['BRIGHT_DATA_API_KEY','BRIGHT_DATA_DATASET_ID'],organicBudgetBlocked),
  ]
  const groups=capability('whatsapp-groups','WhatsApp Groups',['WHATSAPP_BUSINESS_ACCOUNT_ID'],process.env.WHATSAPP_GROUPS_AVAILABLE==='true')
  if(process.env.WHATSAPP_GROUPS_AVAILABLE!=='true'){groups.status=groups.missing.length?'not_configured':'partial';groups.detail='Aguardando disponibilidade da Groups API para esta conta Meta.'}
  capabilities.push(groups)
  return capabilities
}
