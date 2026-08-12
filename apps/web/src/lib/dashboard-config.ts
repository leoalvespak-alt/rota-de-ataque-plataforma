// @ts-nocheck
import type { DashboardView } from '@/lib/dashboard-data'

type Setting = { empty: string; fields: string[]; primary: string; countLabel: string; scoreField?: string }

export const dashboardSettings: Record<DashboardView, Setting> = {
  overview:{empty:'Nenhum desempenho consolidado para a campanha.',fields:['name','leads','conversions','completed_actions','recommendations'],primary:'name',countLabel:'Campanhas'},
  radar:{empty:'Nenhuma oportunidade detectada no radar.',fields:['competitor','opportunity_score','velocity','new_leads','avg_intent','post_url'],primary:'competitor',countLabel:'Posts no radar',scoreField:'opportunity_score'},
  'competitive-intel':{empty:'A inteligência competitiva aparecerá após a primeira coleta.',fields:['topic','competitor','momentum_7d','momentum_30d','pain_points','questions','last_seen_at'],primary:'topic',countLabel:'Temas',scoreField:'momentum_7d'},
  'content-opportunity':{empty:'Nenhuma oportunidade editorial calculada.',fields:['thesis','campaign','angle','hook','opportunity_score','status','created_at'],primary:'thesis',countLabel:'Oportunidades',scoreField:'opportunity_score'},
  community:{empty:'Nenhuma comunidade identificada para a campanha.',fields:['name','size','members','cohesion_score','last_refreshed_at'],primary:'name',countLabel:'Comunidades',scoreField:'cohesion_score'},
  conversations:{empty:'Nenhuma conversa recebida nos canais conectados.',fields:['participant','channel','account','unread_count','stage','detected_intent','requires_human_review','last_message_at'],primary:'participant',countLabel:'Conversas'},
  timeline:{empty:'A timeline será preenchida conforme eventos reais forem recebidos.',fields:['lead','channel','event_type','source','at'],primary:'event_type',countLabel:'Eventos'},
  identities:{empty:'Nenhum candidato de identidade encontrado.',fields:['lead_a','lead_b','reason','confidence','status','created_at'],primary:'lead_a',countLabel:'Candidatos',scoreField:'confidence'},
  'email-flows':{empty:'Nenhum fluxo de e-mail configurado.',fields:['name','campaign','active','version','subscribers','active_subscribers'],primary:'name',countLabel:'Fluxos'},
  'contact-policies':{empty:'Nenhuma política de contato configurada.',fields:['campaign','channel','cadence_seconds','enabled','rules'],primary:'channel',countLabel:'Políticas'},
  'source-roi':{empty:'Ainda não há janela de ROI calculada.',fields:['source_type','source_id','campaign','window_days','unique_leads','followback_rate','retention_7d_rate','conversion_rate','source_score','computed_at'],primary:'source_id',countLabel:'Origens',scoreField:'source_score'},
}

export const dashboardLabels: Record<string, string> = {
  name:'Nome',leads:'Leads',conversions:'Conversões',completed_actions:'Ações concluídas',recommendations:'Recomendações',competitor:'Concorrente',opportunity_score:'Score',velocity:'Velocidade',new_leads:'Novos Leads',avg_intent:'Intenção Média',post_url:'URL',topic:'Tema',momentum_7d:'Momentum (7d)',momentum_30d:'Momentum (30d)',pain_points:'Dores',questions:'Perguntas',last_seen_at:'Visto em',thesis:'Tese',campaign:'Campanha',angle:'Ângulo',hook:'Hook',status:'Status',created_at:'Criado em',size:'Tamanho',members:'Membros',cohesion_score:'Coesão',last_refreshed_at:'Atualizado em',participant:'Participante',channel:'Canal',account:'Conta',unread_count:'Não lidas',stage:'Etapa',detected_intent:'Intenção',requires_human_review:'Revisão humana',last_message_at:'Última msg',lead:'Lead',event_type:'Evento',source:'Origem',at:'Data',lead_a:'Lead A',lead_b:'Lead B',reason:'Motivo',confidence:'Confiança',active:'Ativo',version:'Versão',subscribers:'Inscritos',active_subscribers:'Ativos',cadence_seconds:'Cadência',enabled:'Habilitada',rules:'Regras',source_type:'Tipo de Origem',source_id:'Identificador',window_days:'Janela',unique_leads:'Leads únicos',followback_rate:'Followback',retention_7d_rate:'Retenção 7d',conversion_rate:'Conversão',source_score:'Score de Origem',computed_at:'Calculado em'
}

export function displayValue(value: unknown) { 
  if(value===null||value===undefined||value==='') return '—';
  if(typeof value==='boolean') return value ? 'Sim' : 'Não';
  if(typeof value==='object') return Object.entries(value as Record<string,unknown>).map(([key,item]) => `${key}: ${String(item)}`).join(' · ') || '—';
  if(typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleString('pt-BR');
  return String(value) 
}
