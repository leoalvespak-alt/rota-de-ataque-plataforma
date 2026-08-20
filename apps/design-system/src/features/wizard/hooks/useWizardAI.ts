import { useCallback, useState, useRef } from 'react'
import { useWizardStore } from '@/stores/useWizardStore'
import { useAIStore } from '@/stores/useAIStore'
import { generateCopy, generateCarouselCopy, generateValidatedCopy } from '@/lib/ai/generateCopy'
import { mapCustomFieldsToCard } from '@/lib/ai/validateCopy'
import { getTemplateContract } from '@/domain/templateContracts'
import { createIdempotencyKey } from '@/lib/api/idempotency'

type GenerationErrorCode =
  | 'MODELO_NAO_CONFIGURADO'
  | 'CHAVE_NAO_CONFIGURADA'
  | 'CARDS_NAO_INICIALIZADOS'
  | 'TEMPLATE_AUSENTE'
  | 'GERACAO_FALHOU'
  | 'TIMEOUT'
  | 'ABORTADO'

interface UseWizardAIParams {
  onSuccess?: () => void
  onError?: (error: { code: GenerationErrorCode; message: string; retryable: boolean }) => void
}

export function useWizardAI({ onSuccess, onError }: UseWizardAIParams = {}) {
  const { models, copyModel } = useAIStore()
  const {
    creativeType,
    freeText,
    thesisId,
    templateId,
    setScriptCards,
    getTemplateForSlide,
    scriptCards,
  } = useWizardStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)

  const getActiveModel = useCallback(() => {
    return models.find((m) => m.id === copyModel && m.enabled)
  }, [models, copyModel])

  const getAvailableFields = useCallback((templateId: string) => {
    const contract = getTemplateContract(templateId)
    return contract
      ? contract.fieldSchema.fields.filter(f => f.type === 'text').map(f => f.name)
      : ['title', 'body', 'eyebrow']
  }, [])

  const generateForPrompt = useCallback(async (prompt: string, templateId: string, signal?: AbortSignal) => {
    const activeModel = getActiveModel()
    if (!activeModel) {
      throw new Error('Nenhum modelo de IA configurado. Configure em IA → Configuração.')
    }

    const availableFields = getAvailableFields(templateId)
    return await generateCopy({
      model: activeModel,
      prompt,
      career: 'geral', // Valor fixo conforme instrução
      availableFields,
      signal,
      idempotencyKey: createIdempotencyKey('wizard-card', templateId, prompt),
    })
  }, [getActiveModel, getAvailableFields])

  const generate = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsGenerating(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const timeoutId = setTimeout(() => abortController.abort(), 300000)

    try {
      const existingCards = scriptCards.length > 0 ? scriptCards : useWizardStore.getState().scriptCards
      if (existingCards.length === 0) {
        throw { code: 'CARDS_NAO_INICIALIZADOS' as GenerationErrorCode, message: 'Não há cards criados. Selecione um template e quantidade antes de avançar.', retryable: true }
      }

      if (!templateId) {
        throw { code: 'TEMPLATE_AUSENTE' as GenerationErrorCode, message: 'Template não selecionado. Escolha um modelo antes de avançar.', retryable: true }
      }

      const activeModel = getActiveModel()
      if (!activeModel) {
        throw { code: 'MODELO_NAO_CONFIGURADO' as GenerationErrorCode, message: 'Nenhum modelo de IA configurado. Configure em IA → Configuração.', retryable: false }
      }

      if (creativeType === 'carousel') {
        const slides = existingCards.map((_card, index) => ({
          templateId: getTemplateForSlide(index) ?? templateId,
          availableFields: getAvailableFields(getTemplateForSlide(index) ?? templateId),
        }))

        const copies = await generateCarouselCopy({
          model: activeModel,
          career: 'geral',
          markdown: freeText || `Tese ${thesisId}`,
          slides,
          signal: abortController.signal,
          idempotencyKey: createIdempotencyKey('wizard-carousel', templateId, freeText, thesisId),
        })

        const newCards = existingCards.map((card, i) => {
          const slideTemplateId = slides[i]?.templateId ?? templateId
          const mappedFields = mapCustomFieldsToCard(slideTemplateId, copies[i] ?? {})
          return {
            ...card,
            fields: copies[i] ?? {},
            ...mappedFields,
          }
        })
        setScriptCards(newCards)
      } else {
        const copy = await generateValidatedCopy({
          model: activeModel,
          prompt: freeText || `Tese ${thesisId}`,
          career: 'geral',
          templateId,
          availableFields: getAvailableFields(templateId),
          signal: abortController.signal,
          idempotencyKey: createIdempotencyKey('wizard-single', templateId, freeText, thesisId),
        })
        const mappedFields = mapCustomFieldsToCard(templateId, copy)
        setScriptCards([{
          id: existingCards[0]?.id ?? crypto.randomUUID(),
          role: 'cover' as const,
          templateId,
          fields: copy,
          title: mappedFields.title ?? '',
          body: mappedFields.body ?? '',
          eyebrow: mappedFields.eyebrow ?? '',
        }])
      }

      clearTimeout(timeoutId)
      onSuccess?.()
      return { ok: true as const, cards: useWizardStore.getState().scriptCards }
    } catch (error) {
      clearTimeout(timeoutId)
      abortControllerRef.current = null

      let result: { code: GenerationErrorCode; message: string; retryable: boolean }
      if (abortController.signal.aborted) {
        result = { code: 'ABORTADO', message: 'Geração foi cancelada.', retryable: true }
      } else if (error instanceof Error && error.message.includes('AbortError')) {
        result = { code: 'ABORTADO', message: 'Geração foi cancelada.', retryable: true }
      } else if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
        result = { code: 'TIMEOUT', message: 'Tempo limite excedido. Tente novamente.', retryable: true }
      } else if (typeof error === 'object' && error && 'code' in error) {
        result = error as { code: GenerationErrorCode; message: string; retryable: boolean }
      } else {
        result = { code: 'GERACAO_FALHOU', message: error instanceof Error ? error.message : 'Falha desconhecida na geração de copy.', retryable: true }
      }

      onError?.(result)
      throw result
    } finally {
      setIsGenerating(false)
      inFlightRef.current = false
    }
  }, [
    templateId,
    freeText,
    thesisId,
    creativeType,
    getActiveModel,
    getAvailableFields,
    setScriptCards,
    onSuccess,
    onError,
    scriptCards,
    getTemplateForSlide,
  ])

  const regenerateAll = useCallback(async (context?: string) => {
    if (isGenerating) return []

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 300000)

    try {
      const existingCards = scriptCards.length > 0 ? scriptCards : useWizardStore.getState().scriptCards
      if (existingCards.length === 0) return []

      if (!templateId) {
        throw { code: 'TEMPLATE_AUSENTE' as GenerationErrorCode, message: 'Template não selecionado.', retryable: true }
      }

      const activeModel = getActiveModel()
      if (!activeModel) {
        throw { code: 'MODELO_NAO_CONFIGURADO' as GenerationErrorCode, message: 'Modelo não configurado.', retryable: false }
      }

      const prompt = context ? `${freeText || `Tese ${thesisId}`}\n\nContexto adicional: ${context}` : freeText || `Tese ${thesisId}`

      if (creativeType === 'carousel') {
        const slides = existingCards.map((_card, index) => ({
          templateId: getTemplateForSlide(index) ?? templateId,
          availableFields: getAvailableFields(getTemplateForSlide(index) ?? templateId),
        }))

        const copies = await generateCarouselCopy({
          model: activeModel,
          career: 'geral',
          markdown: prompt,
          slides,
          signal: abortController.signal,
          idempotencyKey: createIdempotencyKey('wizard-regenerate-all', templateId, context),
        })

        const newCards = existingCards.map((card, i) => ({
          ...card,
          fields: copies[i] ?? {},
          title: copies[i]?.title ?? '',
          body: copies[i]?.body ?? '',
          eyebrow: copies[i]?.eyebrow ?? '',
        }))
        setScriptCards(newCards)
        return newCards
      } else {
        const copy = await generateForPrompt(prompt, templateId, abortController.signal)
        const newCard = {
          id: existingCards[0]?.id ?? crypto.randomUUID(),
          role: 'cover' as const,
          templateId,
          fields: copy,
          title: copy.title ?? '',
          body: copy.body ?? '',
          eyebrow: copy.eyebrow ?? '',
        }
        setScriptCards([newCard])
        return [newCard]
      }
    } catch (error) {
      clearTimeout(timeoutId)

      let result: { code: GenerationErrorCode; message: string; retryable: boolean }
      if (abortController.signal.aborted) {
        result = { code: 'ABORTADO', message: 'Geração foi cancelada.', retryable: true }
      } else if (error instanceof Error && error.message.includes('AbortError')) {
        result = { code: 'ABORTADO', message: 'Geração foi cancelada.', retryable: true }
      } else if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
        result = { code: 'TIMEOUT', message: 'Tempo limite excedido.', retryable: true }
      } else if (typeof error === 'object' && error && 'code' in error) {
        result = error as { code: GenerationErrorCode; message: string; retryable: boolean }
      } else {
        result = { code: 'GERACAO_FALHOU', message: error instanceof Error ? error.message : 'Falha ao regenerar copy.', retryable: true }
      }

      onError?.(result)
      throw result
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }, [
    templateId,
    freeText,
    thesisId,
    creativeType,
    generateForPrompt,
    getActiveModel,
    getAvailableFields,
    setScriptCards,
    scriptCards,
    isGenerating,
    onError,
    getTemplateForSlide,
  ])

  const regenerateCard = useCallback(async (cardId: string, context?: string) => {
    if (isGenerating) return null

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), 300000)

    try {
      const existingCards = scriptCards.length > 0 ? scriptCards : useWizardStore.getState().scriptCards
      const cardIndex = existingCards.findIndex(c => c.id === cardId)
      if (cardIndex === -1) return null

      if (!templateId) {
        throw { code: 'TEMPLATE_AUSENTE' as GenerationErrorCode, message: 'Template não selecionado.', retryable: true }
      }

      const activeModel = getActiveModel()
      if (!activeModel) {
        throw { code: 'MODELO_NAO_CONFIGURADO' as GenerationErrorCode, message: 'Modelo não configurado.', retryable: false }
      }

      const cardTemplateId = getTemplateForSlide(cardIndex) ?? templateId
      const prompt = context ? `Regenerar apenas o conteúdo deste card:\n${context}` : 'Regenerar apenas o conteúdo deste card'

      const copy = await generateForPrompt(prompt, cardTemplateId, abortController.signal)
      onSuccess?.()
      return copy
    } catch (error) {
      clearTimeout(timeoutId)

      let result: { code: GenerationErrorCode; message: string; retryable: boolean }
      if (abortController.signal.aborted) {
        result = { code: 'ABORTADO', message: 'Geração foi cancelada.', retryable: true }
      } else if (error instanceof Error && error.message.includes('AbortError')) {
        result = { code: 'ABORTADO', message: 'Geração foi cancelada.', retryable: true }
      } else if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
        result = { code: 'TIMEOUT', message: 'Tempo limite excedido.', retryable: true }
      } else if (typeof error === 'object' && error && 'code' in error) {
        result = error as { code: GenerationErrorCode; message: string; retryable: boolean }
      } else {
        result = { code: 'GERACAO_FALHOU', message: error instanceof Error ? error.message : 'Falha ao regenerar card.', retryable: true }
      }

      onError?.(result)
      throw result
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }, [
    templateId,
    generateForPrompt,
    onSuccess,
    onError,
    scriptCards,
    isGenerating,
    getActiveModel,
    getTemplateForSlide,
  ])

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  return { generate, regenerateAll, regenerateCard, cancelGeneration, isGenerating }
}
