/**
 * OpenAI embedder implementation using REST API
 * @module openai
 */

import { BaseEmbedder } from './embedder.ts'
import {
  EmbedderAuthenticationError,
  EmbedderConnectionError,
  EmbedderModelError,
  EmbedderRateLimitError,
  EmbedderValidationError,
} from './embedder.types.ts'
import type {
  OpenAIEmbedderOptions,
  OpenAIEmbedRequest,
  OpenAIEmbedResponse,
  OpenAIErrorResponse,
  OpenAIModelInfo,
  OpenAIModelsResponse,
  OpenAIRateLimitInfo,
} from './openai.types.ts'
import { OPENAI_DEFAULTS, OPENAI_EMBEDDING_MODELS, OPENAI_ENV_VARS } from './openai.types.ts'

/**
 * OpenAI embedder implementation
 * Connects to OpenAI API for text embeddings
 */
export class OpenAIEmbedder extends BaseEmbedder {
  private readonly apiKey: string
  private readonly baseURL: string
  private readonly organization?: string
  private readonly project?: string
  private readonly dimensions?: number
  private readonly encodingFormat: 'float' | 'base64'
  private readonly headers: Record<string, string>

  /**
   * Create a new OpenAIEmbedder instance
   * @param options - Configuration options for the OpenAI embedder
   * @throws {EmbedderValidationError} When API key is missing or configuration is invalid
   */
  constructor(options: OpenAIEmbedderOptions = {}) {
    super(options)

    // Get API key from options or environment
    this.apiKey = options.apiKey || Deno.env.get(OPENAI_ENV_VARS.apiKey) || ''
    if (!this.apiKey) {
      throw new EmbedderValidationError(
        'OpenAI API key is required. Provide it via options.apiKey or OPENAI_API_KEY environment variable.',
        this.getProviderName(),
      )
    }

    this.baseURL = options.baseURL?.replace(/\/$/, '') || OPENAI_DEFAULTS.baseURL
    this.organization = options.organization || Deno.env.get(OPENAI_ENV_VARS.organization)
    this.project = options.project || Deno.env.get(OPENAI_ENV_VARS.project)
    this.dimensions = options.dimensions
    this.encodingFormat = options.encodingFormat || OPENAI_DEFAULTS.encodingFormat

    // Build headers
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': options.userAgent || 'mnemo-openai-client/1.0.0',
      ...options.headers,
    }

    if (this.organization) {
      this.headers['OpenAI-Organization'] = this.organization
    }

    if (this.project) {
      this.headers['OpenAI-Project'] = this.project
    }

    this.validateOpenAIConfig()
  }

  /**
   * Get the default model name for OpenAI embeddings
   * @returns The default model name
   */
  protected getDefaultModel(): string {
    return OPENAI_DEFAULTS.model
  }

  /**
   * Get the provider name for this embedder
   * @returns The provider name 'openai'
   */
  protected getProviderName(): string {
    return 'openai'
  }

  /**
   * Validate OpenAI-specific configuration
   */
  private validateOpenAIConfig(): void {
    try {
      new URL(this.baseURL)
    } catch {
      throw new EmbedderValidationError(
        `Invalid OpenAI base URL: ${this.baseURL}`,
        this.getProviderName(),
      )
    }

    // Validate dimensions if specified
    if (this.dimensions !== undefined) {
      const modelSpecs = this.getModelSpecs()
      if (modelSpecs && !modelSpecs.supportsDimensions) {
        throw new EmbedderValidationError(
          `Model ${this.config.model} does not support custom dimensions`,
          this.getProviderName(),
        )
      }

      if (this.dimensions <= 0) {
        throw new EmbedderValidationError(
          'Dimensions must be a positive number',
          this.getProviderName(),
        )
      }
    }
  }

  /**
   * Perform the actual embedding operation
   */
  protected async performEmbed(text: string): Promise<number[]> {
    const url = `${this.baseURL}${OPENAI_DEFAULTS.endpoints.embeddings}`
    const controller = this.createTimeoutController()

    const requestBody: OpenAIEmbedRequest = {
      input: text,
      model: this.config.model,
      encoding_format: this.encodingFormat,
    }

    // Add dimensions if supported and specified
    if (this.dimensions !== undefined) {
      requestBody.dimensions = this.dimensions
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      // Parse rate limit information
      const rateLimitInfo = this.parseRateLimitHeaders(response.headers)

      if (!response.ok) {
        await this.handleErrorResponse(response, rateLimitInfo)
      }

      const data = await response.json() as OpenAIEmbedResponse

      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new EmbedderModelError(
          'Invalid embedding response format from OpenAI',
          this.getProviderName(),
          this.config.model,
        )
      }

      const embedding = data.data[0].embedding
      if (!Array.isArray(embedding)) {
        throw new EmbedderModelError(
          'Invalid embedding data format from OpenAI',
          this.getProviderName(),
          this.config.model,
        )
      }

      return embedding
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
          `Failed to connect to OpenAI API at ${this.baseURL}`,
          this.getProviderName(),
          error,
        )
      }

      throw error
    }
  }

  /**
   * Parse rate limit information from response headers
   */
  private parseRateLimitHeaders(headers: Headers): OpenAIRateLimitInfo {
    const rateLimitHeaders = OPENAI_DEFAULTS.rateLimitHeaders

    return {
      requestsRemaining: this.parseHeaderNumber(headers.get(rateLimitHeaders.requestsRemaining)),
      tokensRemaining: this.parseHeaderNumber(headers.get(rateLimitHeaders.tokensRemaining)),
      limitRequests: this.parseHeaderNumber(headers.get(rateLimitHeaders.limitRequests)),
      limitTokens: this.parseHeaderNumber(headers.get(rateLimitHeaders.limitTokens)),
      resetTime: this.parseResetTime(headers.get(rateLimitHeaders.resetRequests)),
    }
  }

  /**
   * Parse a numeric header value
   * @param value - The header value to parse
   * @returns The parsed number or undefined if invalid
   */
  private parseHeaderNumber(value: string | null): number | undefined {
    return value ? parseInt(value, 10) || undefined : undefined
  }

  /**
   * Parse a date header value for rate limit reset time
   * @param value - The header value to parse
   * @returns The parsed date or undefined if invalid
   */
  private parseResetTime(value: string | null): Date | undefined {
    return value ? new Date(value) : undefined
  }

  /**
   * Handle error responses from OpenAI API
   */
  private async handleErrorResponse(
    response: Response,
    rateLimitInfo: OpenAIRateLimitInfo,
  ): Promise<never> {
    let errorData: OpenAIErrorResponse | null = null

    try {
      errorData = await response.json() as OpenAIErrorResponse
    } catch {
      // Ignore JSON parsing errors, use status text instead
    }

    const errorMessage = errorData?.error?.message || response.statusText || 'Unknown error'
    const errorType = errorData?.error?.type

    switch (response.status) {
      case 400:
        throw new EmbedderValidationError(
          `Bad request: ${errorMessage}`,
          this.getProviderName(),
          errorData,
        )
      case 401:
        throw new EmbedderAuthenticationError(
          `Authentication failed: ${errorMessage}. Check your API key.`,
          this.getProviderName(),
        )
      case 403:
        throw new EmbedderAuthenticationError(
          `Forbidden: ${errorMessage}. Check your API permissions.`,
          this.getProviderName(),
        )
      case 404:
        if (errorType === 'invalid_request_error' && errorMessage.toLowerCase().includes('model')) {
          throw new EmbedderModelError(
            `Model not found: ${this.config.model}. Available models: ${
              Object.keys(OPENAI_EMBEDDING_MODELS).join(', ')
            }`,
            this.getProviderName(),
            this.config.model,
          )
        }
        throw new EmbedderConnectionError(
          `Endpoint not found: ${errorMessage}`,
          this.getProviderName(),
        )
      case 429: {
        const retryAfter = rateLimitInfo.resetTime
          ? Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000)
          : undefined

        throw new EmbedderRateLimitError(
          `Rate limit exceeded: ${errorMessage}`,
          this.getProviderName(),
          retryAfter,
        )
      }
      case 500:
      case 502:
      case 503:
      case 504:
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
   * List available models from OpenAI
   */
  async listModels(): Promise<OpenAIModelInfo[]> {
    const url = `${this.baseURL}${OPENAI_DEFAULTS.endpoints.models}`
    const controller = this.createTimeoutController()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.headers['Authorization'],
          'User-Agent': this.headers['User-Agent'],
          ...(this.organization && { 'OpenAI-Organization': this.organization }),
          ...(this.project && { 'OpenAI-Project': this.project }),
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const rateLimitInfo = this.parseRateLimitHeaders(response.headers)
        await this.handleErrorResponse(response, rateLimitInfo)
      }

      const data = await response.json() as OpenAIModelsResponse
      return data.data || []
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
      return models.some((model) => model.id === targetModel)
    } catch {
      return false
    }
  }

  /**
   * Get information about a specific model
   */
  async getModelInfo(modelName?: string): Promise<OpenAIModelInfo | null> {
    try {
      const models = await this.listModels()
      const targetModel = modelName || this.config.model
      return models.find((model) => model.id === targetModel) || null
    } catch {
      return null
    }
  }

  /**
   * Get expected embedding dimensions for the current model
   */
  getModelDimensions(): number | null {
    const modelSpecs = this.getModelSpecs()
    return this.dimensions || modelSpecs?.dimensions || null
  }

  /**
   * Get model specifications if known
   * @returns Model specifications or null if not found
   */
  getModelSpecs(): typeof OPENAI_EMBEDDING_MODELS[keyof typeof OPENAI_EMBEDDING_MODELS] | null {
    return OPENAI_EMBEDDING_MODELS[this.config.model as keyof typeof OPENAI_EMBEDDING_MODELS] || null
  }

  /**
   * Estimate cost for embedding operation
   */
  estimateCost(textLength: number): number | null {
    const modelSpecs = this.getModelSpecs()
    if (!modelSpecs?.cost) return null

    // Rough estimate: ~4 characters per token
    const estimatedTokens = Math.ceil(textLength / 4)
    return (estimatedTokens / 1000) * modelSpecs.cost.input
  }

  /**
   * Test the embedder with a simple embedding request
   */
  async test(): Promise<{
    success: boolean
    embedding?: number[]
    dimensions?: number
    latency?: number
    cost?: number
    error?: string
  }> {
    const testText = 'Hello, world!'
    const startTime = Date.now()

    try {
      const embedding = await this.embed(testText)
      const latency = Date.now() - startTime
      const cost = this.estimateCost(testText.length)

      return {
        success: true,
        embedding,
        dimensions: embedding.length,
        latency,
        cost: cost || undefined,
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
   * @returns Extended embedder information including OpenAI-specific details
   */
  override getInfo(): ReturnType<typeof BaseEmbedder.prototype.getInfo> & {
    baseURL: string
    organization?: string
    project?: string
    dimensions?: number
    encodingFormat: 'float' | 'base64'
    expectedDimensions: number | null
    modelSpecs: typeof OPENAI_EMBEDDING_MODELS[keyof typeof OPENAI_EMBEDDING_MODELS] | null
  } {
    const baseInfo = super.getInfo()
    return {
      ...baseInfo,
      baseURL: this.baseURL,
      organization: this.organization,
      project: this.project,
      dimensions: this.dimensions,
      encodingFormat: this.encodingFormat,
      expectedDimensions: this.getModelDimensions(),
      modelSpecs: this.getModelSpecs(),
    }
  }
}

/**
 * Factory function to create an OpenAIEmbedder with common configurations
 */
export function createOpenAIEmbedder(options: OpenAIEmbedderOptions = {}): OpenAIEmbedder {
  return new OpenAIEmbedder(options)
}

/**
 * Create an OpenAIEmbedder with API key from environment
 */
export function createOpenAIEmbedderFromEnv(overrides: Partial<OpenAIEmbedderOptions> = {}): OpenAIEmbedder {
  return new OpenAIEmbedder({
    apiKey: Deno.env.get(OPENAI_ENV_VARS.apiKey),
    organization: Deno.env.get(OPENAI_ENV_VARS.organization),
    project: Deno.env.get(OPENAI_ENV_VARS.project),
    baseURL: Deno.env.get(OPENAI_ENV_VARS.baseURL),
    ...overrides,
  })
}
