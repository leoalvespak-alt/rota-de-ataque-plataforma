import { describe, it, expect, beforeEach } from 'vitest'
import { recordMetric, getMetrics, clearMetrics, timeOperation } from './metrics'

describe('Metrics', () => {
  beforeEach(() => {
    clearMetrics()
  })

  it('records a metric', () => {
    recordMetric('render-time', 150, 'ms', { template: 'sq-cover' })
    const metrics = getMetrics()
    expect(metrics).toHaveLength(1)
    expect(metrics[0]!.name).toBe('render-time')
    expect(metrics[0]!.value).toBe(150)
    expect(metrics[0]!.tags.template).toBe('sq-cover')
  })

  it('filters metrics by name', () => {
    recordMetric('render-time', 100)
    recordMetric('export-time', 200)
    recordMetric('render-time', 150)
    expect(getMetrics('render-time')).toHaveLength(2)
    expect(getMetrics('export-time')).toHaveLength(1)
  })

  it('clears all metrics', () => {
    recordMetric('test', 1)
    recordMetric('test', 2)
    clearMetrics()
    expect(getMetrics()).toHaveLength(0)
  })

  it('caps at 1000 entries', () => {
    for (let i = 0; i < 1100; i++) {
      recordMetric('bulk', i)
    }
    const all = getMetrics()
    expect(all.length).toBeLessThanOrEqual(1000)
  })

  it('times a synchronous operation', () => {
    const result = timeOperation('sync-op', () => 42)
    expect(result).toBe(42)
    const metrics = getMetrics('sync-op')
    expect(metrics).toHaveLength(1)
    expect(metrics[0]!.value).toBeGreaterThanOrEqual(0)
  })

  it('times an async operation', async () => {
    const result = await timeOperation('async-op', async () => {
      return 'done'
    })
    expect(result).toBe('done')
    const metrics = getMetrics('async-op')
    expect(metrics).toHaveLength(1)
  })
})
