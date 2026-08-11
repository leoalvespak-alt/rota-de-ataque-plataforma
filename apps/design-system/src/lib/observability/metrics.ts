interface MetricEntry {
  name: string
  value: number
  unit: string
  tags: Record<string, string>
  timestamp: number
}

const metrics: MetricEntry[] = []

export function recordMetric(
  name: string,
  value: number,
  unit: string = 'ms',
  tags: Record<string, string> = {},
) {
  metrics.push({
    name,
    value,
    unit,
    tags,
    timestamp: Date.now(),
  })

  if (metrics.length > 1000) {
    metrics.splice(0, 500)
  }
}

export function timeOperation<T>(
  name: string,
  fn: () => T | Promise<T>,
  tags: Record<string, string> = {},
): T | Promise<T> {
  const start = performance.now()
  const result = fn()

  if (result instanceof Promise) {
    return result.finally(() => {
      recordMetric(name, performance.now() - start, 'ms', tags)
    })
  }

  recordMetric(name, performance.now() - start, 'ms', tags)
  return result
}

export function getMetrics(name?: string): MetricEntry[] {
  if (name) return metrics.filter((m) => m.name === name)
  return [...metrics]
}

export function clearMetrics() {
  metrics.length = 0
}
