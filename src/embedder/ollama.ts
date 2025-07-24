/**
 * Ollama embedder implementation using HTTP client
 * @module ollama
 */

import { BaseEmbedder } from './embedder.ts'
import {
  EmbedderAuthenticationError,
  EmbedderConnectionError,
  EmbedderModelError,
  EmbedderValidationError,
} from './embedder.types.ts'
import type {
  OllamaEmbedderOptions,
  OllamaEmbedRequest,
  OllamaEmbedResponse,
  OllamaErrorResponse,
  OllamaHealthResponse,
  OllamaModelInfo,
  OllamaModelsResponse,
} from './ollama.types.ts'
import { OLLAMA_DEFAULTS, OLLAMA_EMBEDDING_MODELS } from './ollama.types.ts'

/**
 * Ollama embedder implementation
 * Connects to local or remote Ollama instances for text embeddings
 */
export class OllamaEmbedder extends BaseEmbedder {
  private readonly endpoint: string
  private readonly headers: Record<string, string>

  /**
   * Create a new OllamaEmbedder instance
   * @param options - Configuration options for the Ollama embedder
   * @throws {EmbedderValidationError} When the endpoint URL is invalid
   */
  constructor(options: OllamaEmbedderOptions = {}) {
    super(options)

    this.endpoint = options.endpoint?.replace(/\/$/, '') || OLLAMA_DEFAULTS.endpoint
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': options.userAgent || 'mnemo-ollama-client/1.0.0',
      ...options.headers,
    }

    this.validateOllamaConfig()
  }

  /**
   * Get the default model name for Ollama embeddings
   * @returns The default model name
   */
  protected getDefaultModel(): string {
    return OLLAMA_DEFAULTS.model
  }

  /**
   * Get the provider name for this embedder
   * @returns The provider name 'ollama'
   */
  protected getProviderName(): string {
    return 'ollama'
  }

  /**
   * Validate Ollama-specific configuration
   */
  private validateOllamaConfig(): void {
    try {
      new URL(this.endpoint)
    } catch {
      throw new EmbedderValidationError(
        `Invalid Ollama endpoint URL: ${this.endpoint}`,
        this.getProviderName(),
      )
    }
  }

  /**
   * Perform the actual embedding operation
   */
  protected async performEmbed(text: string): Promise<number[]> {
    const url = `${this.endpoint}${OLLAMA_DEFAULTS.endpoints.embed}`
    const controller = this.createTimeoutController()

    const requestBody: OllamaEmbedRequest = {
      model: this.config.model,
      prompt: text,
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      const data = await response.json() as OllamaEmbedResponse

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new EmbedderModelError(
          'Invalid embedding response format from Ollama',
          this.getProviderName(),
          this.config.model,
        )
      }

      return data.embedding
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EmbedderConnectionError(
          `Request timed out after ${this.config.timeout}ms`,
          this.getProviderName(),
          error,
        )
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new EmbedderConnectionError(
          `Failed to connect to Ollama at ${this.endpoint}`,
          this.getProviderName(),
          error,
        )
      }

      throw error
    }
  }

  /**
   * Handle error responses from Ollama API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: OllamaErrorResponse | null = null

    try {
      errorData = await response.json() as OllamaErrorResponse
    } catch {
      // Ignore JSON parsing errors, use status text instead
    }

    const errorMessage = errorData?.error || response.statusText || 'Unknown error'

    switch (response.status) {
      case 400:
        throw new EmbedderValidationError(
          `Bad request: ${errorMessage}`,
          this.getProviderName(),
          errorData,
        )
      case 401:
        throw new EmbedderAuthenticationError(
          `Authentication failed: ${errorMessage}`,
          this.getProviderName(),
        )
      case 404:
        if (errorMessage.toLowerCase().includes('model')) {
          throw new EmbedderModelError(
            `Model not found: ${this.config.model}. Make sure the model is pulled in Ollama.`,
            this.getProviderName(),
            this.config.model,
          )
        }
        throw new EmbedderConnectionError(
          `Endpoint not found: ${errorMessage}`,
          this.getProviderName(),
        )
      case 500:
        throw new EmbedderConnectionError(
          `Server error: ${errorMessage}`,
          this.getProviderName(),
        )
      default:
        throw new EmbedderConnectionError(
          `HTTP ${response.status}: ${errorMessage}`,
          this.getProviderName(),
        )
    }
  }

  /**
   * Check if Ollama server is healthy and reachable
   */
  async healthCheck(): Promise<OllamaHealthResponse> {
    const url = `${this.endpoint}${OLLAMA_DEFAULTS.endpoints.health}`
    const controller = this.createTimeoutController()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': this.headers['User-Agent'] },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new EmbedderConnectionError(
          `Health check failed: HTTP ${response.status}`,
          this.getProviderName(),
        )
      }

      const data = await response.json() as OllamaHealthResponse
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EmbedderConnectionError(
          `Health check timed out after ${this.config.timeout}ms`,
          this.getProviderName(),
          error,
        )
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new EmbedderConnectionError(
          `Cannot reach Ollama server at ${this.endpoint}`,
          this.getProviderName(),
          error,
        )
      }

      throw error
    }
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<OllamaModelInfo[]> {
    const url = `${this.endpoint}${OLLAMA_DEFAULTS.endpoints.models}`
    const controller = this.createTimeoutController()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': this.headers['User-Agent'] },
        signal: controller.signal,
      })

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      const data = await response.json() as OllamaModelsResponse
      return data.models || []
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new EmbedderConnectionError(
          `List models timed out after ${this.config.timeout}ms`,
          this.getProviderName(),
          error,
        )
      }

      throw error
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    try {
      const models = await this.listModels()
      const targetModel = modelName || this.config.model
      return models.some((model) => model.name === targetModel)
    } catch {
      return false
    }
  }

  /**
   * Get information about the current model
   */
  async getModelInfo(modelName?: string): Promise<OllamaModelInfo | null> {
    try {
      const models = await this.listModels()
      const targetModel = modelName || this.config.model
      return models.find((model) => model.name === targetModel) || null
    } catch {
      return null
    }
  }

  /**
   * Get expected embedding dimensions for the current model
   */
  getModelDimensions(): number | null {
    const modelSpecs = OLLAMA_EMBEDDING_MODELS[this.config.model as keyof typeof OLLAMA_EMBEDDING_MODELS]
    return modelSpecs?.dimensions || null
  }

  /**
   * Get model specifications if known
   * @returns Model specifications or null if not found
   */
  getModelSpecs(): typeof OLLAMA_EMBEDDING_MODELS[keyof typeof OLLAMA_EMBEDDING_MODELS] | null {
    return OLLAMA_EMBEDDING_MODELS[this.config.model as keyof typeof OLLAMA_EMBEDDING_MODELS] || null
  }

  /**
   * Test the embedder with a simple embedding request
   */
  async test(): Promise<{
    success: boolean
    embedding?: number[]
    dimensions?: number
    latency?: number
    error?: string
  }> {
    const testText = 'Hello, world!'
    const startTime = Date.now()

    try {
      const embedding = await this.embed(testText)
      const latency = Date.now() - startTime

      return {
        success: true,
        embedding,
        dimensions: embedding.length,
        latency,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get detailed embedder information
   * @returns Extended embedder information including Ollama-specific details
   */
  override getInfo(): ReturnType<typeof BaseEmbedder.prototype.getInfo> & {
    endpoint: string
    expectedDimensions: number | null
    modelSpecs: typeof OLLAMA_EMBEDDING_MODELS[keyof typeof OLLAMA_EMBEDDING_MODELS] | null
  } {
    const baseInfo = super.getInfo()
    return {
      ...baseInfo,
      endpoint: this.endpoint,
      expectedDimensions: this.getModelDimensions(),
      modelSpecs: this.getModelSpecs(),
    }
  }
}

/**
 * Factory function to create an OllamaEmbedder with common configurations
 */
export function createOllamaEmbedder(options: OllamaEmbedderOptions = {}): OllamaEmbedder {
  return new OllamaEmbedder(options)
}

/**
 * Create an OllamaEmbedder with default settings for local development
 */
export function createLocalOllamaEmbedder(model?: string): OllamaEmbedder {
  return new OllamaEmbedder({
    endpoint: OLLAMA_DEFAULTS.endpoint,
    model: model || OLLAMA_DEFAULTS.model,
  })
}
