import { useState } from 'react'
import { ThesesListView } from './theses/ThesesListView'
import { KnowledgeListView } from './knowledge/KnowledgeListView'
import { PlannerConfigView } from './planner/PlannerConfigView'
import { BatchDashboard } from './batch/BatchDashboard'
import { CalendarView } from './calendar/CalendarView'
import { ContentReviewView } from './review/ContentReviewView'
import { PromptManagerView } from './prompts/PromptManagerView'
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard'

const sections = [['theses', 'Teses'], ['knowledge', 'Conhecimento'], ['planner', 'Planejador'], ['batch', 'Lote'], ['calendar', 'Calendário'], ['review', 'Revisão'], ['prompts', 'Prompts'], ['analytics', 'Métricas']] as const
type Section = (typeof sections)[number][0]
export function EditorialView() { const [section, setSection] = useState<Section>('theses'); return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-ui-bg"><div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ui-border bg-ui-panel px-4 py-3">{sections.map(([id, label]) => <button key={id} onClick={() => setSection(id)} className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${section === id ? 'bg-brand-red text-white' : 'text-ui-muted hover:bg-ui-panel2 hover:text-ui-text'}`}>{label}</button>)}</div><main className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">{section === 'theses' && <ThesesListView />}{section === 'knowledge' && <KnowledgeListView />}{section === 'planner' && <PlannerConfigView />}{section === 'batch' && <BatchDashboard />}{section === 'calendar' && <CalendarView />}{section === 'review' && <ContentReviewView />}{section === 'prompts' && <PromptManagerView />}{section === 'analytics' && <AnalyticsDashboard />}</main></div> }
