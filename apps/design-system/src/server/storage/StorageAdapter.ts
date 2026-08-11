export interface StorageAdapter {
  upload(key: string, data: Buffer, contentType: string): Promise<string>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getUrl(key: string): string
  exists(key: string): Promise<boolean>
}

interface MinioConfig {
  endPoint: string
  port: number
  accessKey: string
  secretKey: string
  bucket: string
  useSSL?: boolean
}

export class MinioStorageAdapter implements StorageAdapter {
  private client: import('minio').Client | null = null
  private bucket: string
  private config: MinioConfig

  constructor(config: MinioConfig) {
    this.config = config
    this.bucket = config.bucket
  }

  private async getClient() {
    if (!this.client) {
      const { Client } = await import('minio')
      this.client = new Client({
        endPoint: this.config.endPoint,
        port: this.config.port,
        useSSL: this.config.useSSL ?? false,
        accessKey: this.config.accessKey,
        secretKey: this.config.secretKey,
      })
      const exists = await this.client.bucketExists(this.bucket)
      if (!exists) {
        await this.client.makeBucket(this.bucket)
      }
    }
    return this.client
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    const client = await this.getClient()
    await client.putObject(this.bucket, key, data, data.length, {
      'Content-Type': contentType,
    })
    return this.getUrl(key)
  }

  async download(key: string): Promise<Buffer> {
    const client = await this.getClient()
    const stream = await client.getObject(this.bucket, key)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as ArrayBuffer))
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient()
    await client.removeObject(this.bucket, key)
  }

  getUrl(key: string): string {
    const protocol = this.config.useSSL ? 'https' : 'http'
    return `${protocol}://${this.config.endPoint}:${this.config.port}/${this.bucket}/${key}`
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient()
    try {
      await client.statObject(this.bucket, key)
      return true
    } catch {
      return false
    }
  }
}
