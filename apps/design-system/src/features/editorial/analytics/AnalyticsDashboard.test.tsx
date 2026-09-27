import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api/client'
import { AnalyticsDashboard } from './AnalyticsDashboard'

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }))

const metrics = {
  contents: { total: 5, approved: 3, rejected: 1, averageQuality: 0.81 },
  jobs: { total: 4, failed: 1, totalCost: '0.25' },
  thesisUsage: [],
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset())

  it('shows real metrics after a successful response', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(metrics)
    render(<AnalyticsDashboard />)

    expect(await screen.findByText('81%')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows an actionable error and retries after a failed response', async () => {
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new Error('avg(text) is not supported'))
      .mockResolvedValueOnce(metrics)
    render(<AnalyticsDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as métricas editoriais.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('81%')).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('distinguishes a missing valid quality score from zero quality', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...metrics, contents: { ...metrics.contents, averageQuality: null } })
    render(<AnalyticsDashboard />)

    expect(await screen.findByText('Sem dados válidos')).toBeInTheDocument()
  })

  it('does not display a quality score outside the 0–1 range', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...metrics, contents: { ...metrics.contents, averageQuality: 1.2 } })
    render(<AnalyticsDashboard />)

    expect(await screen.findByText('Sem dados válidos')).toBeInTheDocument()
  })
})
