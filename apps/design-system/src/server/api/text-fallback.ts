type TextFallbackCandidate = {
  id: string
  provider: string
  keyEnv: string
  capabilities: readonly string[]
}

export function selectTextFallback<T extends TextFallbackCandidate>(
  preferred: Pick<T, 'id' | 'provider'>,
  models: readonly T[],
  environment: Record<string, string | undefined>,
): T | undefined {
  const fallbackId = preferred.provider === 'deepseek' ? 'glm-fallback' : undefined
  if (!fallbackId || fallbackId === preferred.id) return undefined

  return models.find((model) =>
    model.id === fallbackId
    && model.capabilities.includes('text')
    && Boolean(environment[model.keyEnv]?.trim()),
  )
}
