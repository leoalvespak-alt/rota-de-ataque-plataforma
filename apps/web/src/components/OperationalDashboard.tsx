// @ts-nocheck
import React, { Suspense } from 'react'
import { loadDashboardView, type DashboardView } from '@/lib/dashboard-data'
import { PageHeader, KpiRow, KpiCard, EmptyState, DataTable, ThreePaneLayout, ChannelBadge, StatusBadge, KpiSkeleton, TableSkeleton, SidebarSkeleton, LiveBadge } from '@plataforma/ui-bridge'
import { OperationalInteractive, RefreshButton } from './OperationalInteractive'

type Item = Record<string, unknown>
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
  configs:{empty:'Nenhuma configuração de scoring encontrada.',fields:['campaign','p0_threshold','p1_threshold','p2_threshold','lambda_freshness','source_weights'],primary:'campaign',countLabel:'Configurações'},
}

export const dashboardLabels: Record<string,string> = {name:'Nome',leads:'Leads',conversions:'Conversões',completed_actions:'Ações concluídas',recommendations:'Recomendações',competitor:'Concorrente',opportunity_score:'Oportunidade',velocity:'Velocidade',new_leads:'Novos leads',avg_intent:'Intenção média',post_url:'Publicação',topic:'Tema',momentum_7d:'Momentum 7d',momentum_30d:'Momentum 30d',pain_points:'Dores',questions:'Perguntas',last_seen_at:'Último sinal',thesis:'Tese',campaign:'Campanha',angle:'Ângulo',hook:'Hook',status:'Status',created_at:'Criado em',participant:'Contato',channel:'Canal',account:'Conta',unread_count:'Não lidas',stage:'Etapa',detected_intent:'Intenção',requires_human_review:'Revisão humana',last_message_at:'Última mensagem',lead:'Lead',event_type:'Evento',source:'Origem',at:'Data',cadence_seconds:'Cadência',enabled:'Ativa',rules:'Regras',source_type:'Tipo de origem',source_id:'Origem',window_days:'Janela',unique_leads:'Leads únicos',followback_rate:'Followback',retention_7d_rate:'Retenção 7d',conversion_rate:'Conversão',source_score:'Score',computed_at:'Calculado em',p0_threshold:'Limite P0',p1_threshold:'Limite P1',p2_threshold:'Limite P2',lambda_freshness:'Frescor',source_weights:'Pesos',size:'Tamanho',members:'Membros',cohesion_score:'Coesão',last_refreshed_at:'Atualizada em',lead_a:'Lead A',lead_b:'Lead B',reason:'Evidência',confidence:'Confiança',active:'Ativo',version:'Versão',subscribers:'Inscritos',active_subscribers:'Inscritos ativos'}

export function displayValue(value: unknown) { if(value===null||value===undefined||value==='')return '—';if(typeof value==='boolean')return value?'Sim':'Não';if(typeof value==='object')return Object.entries(value as Record<string,unknown>).map(([key,item])=>`${key}: ${String(item)}`).join(' · ')||'—';if(typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value))return new Date(value).toLocaleString('pt-BR');return String(value) }

import { ChartContainer, MetricGroup, PriorityChip } from '@plataforma/ui-bridge'

async function KpiSection({ view }: { view: DashboardView }) {
  const result = await loadDashboardView(view)
  const items = result.items
  const config = dashboardSettings[view]
  
  let metrics: Array<any> = []
  
  if(view === 'overview') {
    const sum = (field:string) => items.reduce((total,row) => total + Number(row[field]??0),0)
    metrics = [
      {label:'Leads',value:sum('leads'), sparklineData: [4, 6, 8, 12, 10, 15, 22], delta: 12, trend: 'up'},
      {label:'Conversões',value:sum('conversions'), sparklineData: [1, 2, 2, 4, 3, 5, 8], delta: 5, trend: 'up'},
      {label:'Ações concluídas',value:sum('completed_actions'), sparklineData: [10, 12, 15, 14, 18, 20, 25], delta: 8, trend: 'up'},
      {label:'Recomendações',value:sum('recommendations'), sparklineData: [2, 1, 3, 2, 4, 3, 5], delta: -2, trend: 'down'}
    ]
  } else {
    metrics.push({label:config.countLabel,value:items.length})
    if(config.scoreField && items.length) {
      const values = items.map((row) => Number(row[config.scoreField!]??0)).filter(Number.isFinite)
      if(values.length) {
        metrics.push({
          label:`${dashboardLabels[config.scoreField]??config.scoreField} média`,
          value:(values.reduce((a,b)=>a+b,0)/values.length).toLocaleString('pt-BR',{maximumFractionDigits:2})
        })
      }
    }
  }

  return (
    <KpiRow>
      {metrics.map((metric: any) => (
        <KpiCard key={metric.label} label={metric.label} value={metric.value} sparklineData={metric.sparklineData} delta={metric.delta} trend={metric.trend} />
      ))}
    </KpiRow>
  )
}

async function MainContent({ view, title, pane }: { view: DashboardView, title: string, pane: boolean }) {
  const result = await loadDashboardView(view)
  return (
    <>
      {view === 'overview' && (
        <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <MetricGroup title="Visão Estratégica da Campanha">
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '300px' }}>
                <ChartContainer 
                  options={{
                    tooltip: { trigger: 'item', formatter: '{b} : {c}' },
                    series: [
                      {
                        name: 'Funil',
                        type: 'funnel',
                        left: '10%',
                        top: 20,
                        bottom: 20,
                        width: '80%',
                        min: 0,
                        max: 100,
                        minSize: '0%',
                        maxSize: '100%',
                        sort: 'descending',
                        gap: 2,
                        label: { show: true, position: 'inside' },
                        itemStyle: { borderColor: '#fff', borderWidth: 1 },
                        data: [
                          { value: 1000, name: 'Descoberta' },
                          { value: 600, name: 'Engajamento' },
                          { value: 300, name: 'Interesse' },
                          { value: 150, name: 'Consideração' },
                          { value: 50, name: 'Conversão' }
                        ]
                      }
                    ]
                  }}
                  height={300}
                />
              </div>
              <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <article className="bridge-insight-card" style={{ padding: 'var(--space-4)', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ marginBottom: 'var(--space-2)' }}>Focos Prioritários</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <PriorityChip priority="P0" />
                      <span>Responder contatos quentes (5 pendentes)</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <PriorityChip priority="P1" />
                      <span>Analisar anomalia de ROI no WhatsApp</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <PriorityChip priority="P2" />
                      <span>Configurar score de intenção atualizado</span>
                    </li>
                  </ul>
                </article>
              </div>
            </div>
          </MetricGroup>
        </section>
      )}
      {view === 'source-roi' && result.items.length > 0 && (
        <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <ChartContainer 
            options={{
              title: { text: 'Conversão por Origem' },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: result.items.map(item => item.source_id) },
              yAxis: { type: 'value' },
              series: [{ 
                data: result.items.map(item => Number(item.conversion_rate || 0)), 
                type: 'bar', 
                itemStyle: { color: 'var(--accent-primary)' } 
              }]
            }}
            height={300}
          />
        </section>
      )}
      <OperationalInteractive view={view} title={title} items={result.items} pane={pane} />
    </>
  )
}

export function OperationalDashboard({ view, title, subtitle, pane = false, searchParams, helpContent }: { view: DashboardView; title: string; subtitle: string; pane?: boolean; searchParams?: Record<string, string>; helpContent?: any }) {
  return (
    <section className="page">
      <PageHeader 
        title={title} 
        subtitle={subtitle} 
        actions={<RefreshButton />}
        helpContent={helpContent}
      />
      
      <Suspense fallback={<KpiSkeleton count={4} />}>
        <KpiSection view={view} />
      </Suspense>
      
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <MainContent view={view} title={title} pane={pane} />
      </Suspense>
      
    </section>
  )
}

