import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './AppShell'

const TabLoading = () => (
  <div className="flex flex-1 items-center justify-center text-sm text-ui-muted">Carregando…</div>
)

const wrap = (fn: () => Promise<{ default: React.ComponentType }>) =>
  lazy(fn)

// ── Tabs principais ──────────────────────────────────────────────
const DashboardView = wrap(() =>
  import('@/features/dashboard/DashboardView').then((m) => ({ default: m.DashboardView })),
)
const BrandView = wrap(() =>
  import('@/features/brand/BrandView').then((m) => ({ default: m.BrandView })),
)
const AIConfigView = wrap(() =>
  import('@/features/ai/AIConfigView').then((m) => ({ default: m.AIConfigView })),
)
const RendersView = wrap(() =>
  import('@/features/renders/RendersView').then((m) => ({ default: m.RendersView })),
)
const HistoryView = wrap(() =>
  import('@/features/history/HistoryView').then((m) => ({ default: m.HistoryView })),
)
const WizardView = wrap(() =>
  import('@/features/wizard/WizardView').then((m) => ({ default: m.WizardView })),
)

// ── Editor (criar) ───────────────────────────────────────────────
const CreateTab = wrap(() =>
  import('./CreateTab').then((m) => ({ default: m.CreateTab })),
)

// ── Sub-abas editoriais ──────────────────────────────────────────
const EditorialLayout = wrap(() =>
  import('@/features/editorial/EditorialLayout').then((m) => ({ default: m.EditorialLayout })),
)
const ThesesListView = wrap(() =>
  import('@/features/editorial/theses/ThesesListView').then((m) => ({ default: m.ThesesListView })),
)
const KnowledgeListView = wrap(() =>
  import('@/features/editorial/knowledge/KnowledgeListView').then((m) => ({
    default: m.KnowledgeListView,
  })),
)
const PlannerConfigView = wrap(() =>
  import('@/features/editorial/planner/PlannerConfigView').then((m) => ({
    default: m.PlannerConfigView,
  })),
)
const BatchDashboard = wrap(() =>
  import('@/features/editorial/batch/BatchDashboard').then((m) => ({
    default: m.BatchDashboard,
  })),
)
const CalendarView = wrap(() =>
  import('@/features/editorial/calendar/CalendarView').then((m) => ({
    default: m.CalendarView,
  })),
)
const ContentReviewView = wrap(() =>
  import('@/features/editorial/review/ContentReviewView').then((m) => ({
    default: m.ContentReviewView,
  })),
)
const PromptManagerView = wrap(() =>
  import('@/features/editorial/prompts/PromptManagerView').then((m) => ({
    default: m.PromptManagerView,
  })),
)
const AnalyticsDashboard = wrap(() =>
  import('@/features/editorial/analytics/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  })),
)

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<TabLoading />}>{children}</Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <S><DashboardView /></S> },
      { path: 'marca', element: <S><BrandView /></S> },
      { path: 'ia', element: <S><AIConfigView /></S> },
      { path: 'renders', element: <S><RendersView /></S> },
      { path: 'historico', element: <S><HistoryView /></S> },
      { path: 'criar', element: <S><CreateTab /></S> },
      { path: 'wizard', element: <S><WizardView /></S> },
      {
        path: 'teses',
        element: <S><EditorialLayout /></S>,
        children: [
          { index: true, element: <S><ThesesListView /></S> },
          { path: 'conhecimento', element: <S><KnowledgeListView /></S> },
          { path: 'planejador', element: <S><PlannerConfigView /></S> },
          { path: 'lote', element: <S><BatchDashboard /></S> },
          { path: 'calendario', element: <S><CalendarView /></S> },
          { path: 'revisao', element: <S><ContentReviewView /></S> },
          { path: 'prompts', element: <S><PromptManagerView /></S> },
          { path: 'metricas', element: <S><AnalyticsDashboard /></S> },
        ],
      },
      // Redirecionar rotas antigas de tab (compatibilidade)
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: 'editorial', element: <Navigate to="/teses" replace /> },
    ],
  },
])
