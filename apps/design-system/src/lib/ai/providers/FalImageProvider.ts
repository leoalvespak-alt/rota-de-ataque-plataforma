import type { ImageProvider, ImageGenerationRequest, ImageGenerationResponse } from './types'

export class FalImageProvider implements ImageProvider {
  id = 'fal'
  name = 'fal.ai FLUX'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const submitResponse = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${this.apiKey}`,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        image_size: 'square_hd',
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!submitResponse.ok) {
      throw new Error(`fal.ai API error: ${submitResponse.status}`)
    }

    const submitData = (await submitResponse.json()) as {
      request_id?: string
      images?: Array<{ url: string; width: number; height: number }>
    }

    if (submitData.images?.[0]) {
      const img = submitData.images[0]
      return {
        url: img.url,
        width: img.width,
        height: img.height,
        model: 'flux-schnell',
        provider: this.id,
      }
    }

    if (!submitData.request_id) {
      throw new Error('No request_id or images in response')
    }

    const statusUrl = `https://queue.fal.run/fal-ai/flux/schnell/requests/${submitData.request_id}/status`
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const statusResponse = await fetch(statusUrl, {
        headers: { Authorization: `Key ${this.apiKey}` },
      })
      const statusData = (await statusResponse.json()) as {
        status: string
        response?: { images?: Array<{ url: string; width: number; height: number }> }
      }
      if (statusData.status === 'COMPLETED' && statusData.response?.images?.[0]) {
        const img = statusData.response.images[0]
        return {
          url: img.url,
          width: img.width,
          height: img.height,
          model: 'flux-schnell',
          provider: this.id,
        }
      }
    }

    throw new Error('Image generation timed out')
  }
}
