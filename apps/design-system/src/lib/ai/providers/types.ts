import type { z } from 'zod'

export interface TextGenerationRequest {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  responseSchema?: z.ZodType<unknown>
}

export interface TextGenerationResponse {
  text: string
  parsed?: unknown
  usage?: { inputTokens: number; outputTokens: number }
  model: string
  provider: string
}

export interface ImageGenerationRequest {
  prompt: string
  width?: number
  height?: number
  style?: string
  negativePrompt?: string
}

export interface ImageGenerationResponse {
  url: string
  width: number
  height: number
  model: string
  provider: string
}

export interface TextProvider {
  id: string
  name: string
  generate(request: TextGenerationRequest): Promise<TextGenerationResponse>
  isConfigured(): boolean
}

export interface ImageProvider {
  id: string
  name: string
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse>
  isConfigured(): boolean
}

export interface EmbeddingProvider {
  id: string
  name: string
  embed(text: string): Promise<number[]>
  embedMany?(texts: string[]): Promise<number[][]>
  getDimensions?(): number
  isConfigured(): boolean
}

export interface VisionProvider {
  id: string
  name: string
  analyze(imageUrl: string, prompt: string): Promise<string>
  isConfigured(): boolean
}
