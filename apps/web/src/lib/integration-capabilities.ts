export interface IntegrationCapability {
  id: string
  name: string
  status: 'ready'|'partial'|'not_configured'|'error'
  detail: string
  missing: string[]
}

interface Queryable { query<T>(sql:string,values?:unknown[]):Promise<{rows:T[]}> }

function capability(id:string,name:string,required:string[],extraReady=true):IntegrationCapability {
  const missing=required.filter((key)=>!process.env[key]?.trim())
  const status=missing.length===0&&extraReady?'ready':missing.length===required.length?'not_configured':'partial'
  return {id,name,status,missing,detail:status==='ready'?'Variáveis obrigatórias presentes.':`Faltam: ${missing.join(', ')||'vínculo da conta'}`}
}

export async function getIntegrationCapabilities(database?:Queryable):Promise<IntegrationCapability[]> {
  let accounts:Array<{role:string;meta_access_token_encrypted:string|null;meta_token_expires_at:string|null;threads_user_id:string|null}>=[]
  if(database){try{accounts=(await database.query(`SELECT role,meta_access_token_encrypted,meta_token_expires_at,threads_user_id FROM accounts`)).rows as typeof accounts}catch{accounts=[]}}
  const actor=accounts.find((account)=>account.role==='actor'),collector=accounts.find((account)=>account.role==='collector')
  const metaLinked=Boolean(actor?.meta_access_token_encrypted||collector?.meta_access_token_encrypted||process.env.META_ACCESS_TOKEN)
  const meta=capability('meta','Meta / Instagram',['META_APP_ID','META_APP_SECRET','META_WEBHOOK_VERIFY_TOKEN'],metaLinked)
  if(!metaLinked&&meta.missing.length<3){meta.status='partial';meta.detail='Aplicativo configurado; falta vincular uma conta pelo OAuth.'}
  const threads=capability('threads','Threads',['META_APP_ID','META_APP_SECRET'],Boolean(actor?.threads_user_id||process.env.THREADS_ACCESS_TOKEN))
  if(threads.status!=='ready'&&!threads.missing.length)threads.detail='Falta vincular o usuário Threads.'
  const capabilities=[
    meta,
    threads,
    capability('reddit','Reddit',['REDDIT_CLIENT_ID','REDDIT_CLIENT_SECRET','REDDIT_USER_AGENT']),
    capability('whatsapp','WhatsApp Cloud',['WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_ACCESS_TOKEN','WHATSAPP_WEBHOOK_VERIFY_TOKEN','WHATSAPP_APP_SECRET']),
    capability('email','E-mail / Resend',['RESEND_API_KEY','EMAIL_FROM','RESEND_WEBHOOK_SECRET']),
    capability('embeddings','Embeddings',['EMBEDDINGS_ENDPOINT']),
    capability('runtime','Banco e filas',['DATABASE_URL','REDIS_URL']),
  ]
  const groups=capability('whatsapp-groups','WhatsApp Groups',['WHATSAPP_BUSINESS_ACCOUNT_ID'],process.env.WHATSAPP_GROUPS_AVAILABLE==='true')
  if(process.env.WHATSAPP_GROUPS_AVAILABLE!=='true'){groups.status=groups.missing.length?'not_configured':'partial';groups.detail='Aguardando disponibilidade da Groups API para esta conta Meta.'}
  capabilities.push(groups)
  return capabilities
}
