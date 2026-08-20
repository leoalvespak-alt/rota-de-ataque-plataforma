import React, { Suspense } from 'react'
import { loadDashboardView, type DashboardView } from '@/lib/dashboard-data'
import { PageHeader, KpiRow, KpiCard, EmptyState, DataTable, ThreePaneLayout, ChannelBadge, StatusBadge, KpiSkeleton, TableSkeleton, SidebarSkeleton, LiveBadge, ChartContainer, MetricGroup, PriorityChip } from '@plataforma/ui-bridge'
import { OperationalInteractive, RefreshButton } from './OperationalInteractive'
import { dashboardSettings, dashboardLabels } from '@/lib/dashboard-config'
import { OverviewReadiness } from './OverviewReadiness'

type Item = Record<string, unknown>

async function KpiSection({ view }: { view: DashboardView }) {
  const result = await loadDashboardView(view)
  const items = result.items
  const config = dashboardSettings[view]
  
  let metrics: Array<any> = []
  
  if(view === 'overview') {
    const sum = (field:string) => items.reduce((total,row) => total + Number(row[field]??0),0)
    metrics = [
      {label:'Leads',value:sum('leads'), period:'na campanha ativa'},
      {label:'Conversões',value:sum('conversions'), period:'resultado registrado'},
      {label:'Ações concluídas',value:sum('completed_actions'), period:'execução confirmada'},
      {label:'Recomendações',value:sum('recommendations'), period:'próximas decisões'}
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
        <KpiCard key={metric.label} label={metric.label} value={metric.value} sparklineData={metric.sparklineData} delta={metric.delta} trend={metric.trend} period={metric.period} />
      ))}
    </KpiRow>
  )
}

async function MainContent({ view, title, pane }: { view: DashboardView, title: string, pane: boolean }) {
  const result = await loadDashboardView(view)
  const sum = (field: string) => result.items.reduce((total, row) => total + Number(row[field] ?? 0), 0)
  const overviewTotals = {
    leads: sum('leads'),
    conversions: sum('conversions'),
    actions: sum('completed_actions'),
    recommendations: sum('recommendations'),
  }
  const hasOverviewActivity = Object.values(overviewTotals).some((value) => value > 0)

  return (
    <>
      {result.stale && (
        <div className="banner" role="status" aria-live="polite" style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span aria-hidden="true">⏳</span>
          <span>
            Dados ainda não consolidados — aguardando primeira sincronização.
            {view === 'overview' && ' A visão geral aparecerá após o worker de qualidade de dados rodar pela primeira vez.'}
          </span>
        </div>
      )}
      {view === 'overview' && (
        <OverviewReadiness />
      )}
      {view === 'overview' && (
        <MetricGroup title="Visão estratégica da campanha">
          <div className="dashboard-visual-grid">
            <article className="dashboard-chart-card dashboard-chart-card-wide">
              <header>
                <div>
                  <span>Funil atual</span>
                  <h4>Da descoberta à conversão</h4>
                </div>
                <strong>{overviewTotals.conversions}</strong>
              </header>
              {hasOverviewActivity ? (
                <ChartContainer
                  option={{
                    tooltip: { trigger: 'item', formatter: '{b} : {c}' },
                    series: [
                      {
                        name: 'Funil',
                        type: 'funnel',
                        left: '4%',
                        top: 12,
                        bottom: 12,
                        width: '92%',
                        minSize: '28%',
                        maxSize: '100%',
                        sort: 'descending',
                        gap: 5,
                        label: { show: true, position: 'inside', formatter: '{b}  {c}', fontWeight: 700 },
                        itemStyle: { borderColor: 'var(--surface-card)', borderWidth: 3, borderRadius: 7 },
                        data: [
                          { value: overviewTotals.leads, name: 'Leads' },
                          { value: overviewTotals.actions, name: 'Ações' },
                          { value: overviewTotals.conversions, name: 'Conversões' }
                        ]
                      }
                    ]
                  }}
                  height={270}
                />
              ) : <ChartEmpty message="O funil aparecerá assim que houver atividade real." />}
            </article>

            <article className="dashboard-chart-card">
              <header>
                <div>
                  <span>Comparativo</span>
                  <h4>Volume por campanha</h4>
                </div>
                <strong>{overviewTotals.leads}</strong>
              </header>
              {hasOverviewActivity ? (
                <ChartContainer
                  option={{
                    tooltip: { trigger: 'axis' },
                    legend: { bottom: 0 },
                    grid: { left: 8, right: 8, top: 12, bottom: 42, containLabel: true },
                    xAxis: { type: 'category', data: result.items.map((item) => String(item.name ?? 'Campanha')), axisLabel: { interval: 0, overflow: 'truncate', width: 100 } },
                    yAxis: { type: 'value', minInterval: 1 },
                    series: [
                      { name: 'Leads', type: 'bar', data: result.items.map((item) => Number(item.leads ?? 0)) },
                      { name: 'Conversões', type: 'bar', data: result.items.map((item) => Number(item.conversions ?? 0)) }
                    ]
                  }}
                  height={270}
                />
              ) : <ChartEmpty message="Sem volume suficiente para comparar campanhas." />}
            </article>

            <article className="dashboard-chart-card">
              <header>
                <div>
                  <span>Distribuição</span>
                  <h4>Mix operacional</h4>
                </div>
                <strong>{Object.values(overviewTotals).reduce((total, value) => total + value, 0)}</strong>
              </header>
              {hasOverviewActivity ? (
                <ChartContainer
                  option={{
                    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                    legend: { bottom: 0 },
                    series: [{
                      name: 'Mix operacional',
                      type: 'pie',
                      radius: ['52%', '76%'],
                      center: ['50%', '44%'],
                      avoidLabelOverlap: true,
                      padAngle: 3,
                      itemStyle: { borderRadius: 8, borderColor: 'var(--surface-card)', borderWidth: 3 },
                      label: { show: false },
                      data: [
                        { name: 'Leads', value: overviewTotals.leads },
                        { name: 'Conversões', value: overviewTotals.conversions },
                        { name: 'Ações', value: overviewTotals.actions },
                        { name: 'Recomendações', value: overviewTotals.recommendations }
                      ]
                    }]
                  }}
                  height={270}
                />
              ) : <ChartEmpty message="O mix será calculado com os primeiros registros." />}
            </article>
          </div>

          <div className="overview-priority-strip">
            <div><PriorityChip priority="P0" /><span>Leads para qualificar</span><strong>{overviewTotals.leads}</strong></div>
            <div><PriorityChip priority="P1" /><span>Recomendações para decidir</span><strong>{overviewTotals.recommendations}</strong></div>
            <div><PriorityChip priority="P2" /><span>Ações concluídas</span><strong>{overviewTotals.actions}</strong></div>
          </div>
        </MetricGroup>
      )}
      {view === 'source-roi' && result.items.length > 0 && (
        <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <ChartContainer
            option={{
              title: { text: 'Conversão por Origem' },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category' as const, data: result.items.map(item => String(item.source_id ?? '')) },
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

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="dashboard-chart-empty">
      <span aria-hidden>◇</span>
      <p>{message}</p>
    </div>
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
