/**
 * Base embedder interface and utilities
 * @module embedder
 */

import {
  type BaseEmbedderOptions,
  type EmbedBatchOptions,
  type EmbedBatchResult,
  type Embedder,
  EmbedderConnectionError,
  EmbedderError,
  EmbedderValidationError,
} from './embedder.types.ts'

/**
 * Default configuration values for embedders
 */
export const DEFAULT_EMBEDDER_CONFIG = {
  /** Default request timeout in milliseconds */
  timeout: 30000,
  /** Default maximum retries */
  maxRetries: 3,
  /** Default retry delay in milliseconds */
  retryDelay: 1000,
  /** Default batch size for batch operations */
  batchSize: 10,
  /** Default delay between batches in milliseconds */
  batchDelayMs: 100,
} as const

/**
 * Abstract base class for embedder implementations
 * Provides common functionality like validation, retries, and error handling
 */
export abstract class BaseEmbedder implements Embedder {
  /** Configuration options for the embedder */
  protected readonly config: Required<BaseEmbedderOptions>

  /**
   * Create a new BaseEmbedder instance
   * @param options - Configuration options for the embedder
   */
  constructor(options: BaseEmbedderOptions = {}) {
    this.config = {
      model: options.model || this.getDefaultModel(),
      timeout: options.timeout ?? DEFAULT_EMBEDDER_CONFIG.timeout,
      maxRetries: options.maxRetries ?? DEFAULT_EMBEDDER_CONFIG.maxRetries,
      retryDelay: options.retryDelay ?? DEFAULT_EMBEDDER_CONFIG.retryDelay,
    }

    this.validateConfig()
  }

  /**
   * Get the default model name for this embedder
   * Must be implemented by concrete classes
   */
  protected abstract getDefaultModel(): string

  /**
   * Get the provider name for this embedder
   * Must be implemented by concrete classes
   */
  protected abstract getProviderName(): string

  /**
   * Perform the actual embedding operation
   * Must be implemented by concrete classes
   */
  protected abstract performEmbed(text: string): Promise<number[]>

  /**
   * Validate embedder configuration
   * Can be overridden by concrete classes for additional validation
   */
  protected validateConfig(): void {
    if (this.config.timeout <= 0) {
      throw new EmbedderValidationError(
        'Timeout must be greater than 0',
        this.getProviderName(),
      )
    }

    if (this.config.maxRetries < 0) {
      throw new EmbedderValidationError(
        'Max retries must be non-negative',
        this.getProviderName(),
      )
    }

    if (this.config.retryDelay < 0) {
      throw new EmbedderValidationError(
        'Retry delay must be non-negative',
        this.getProviderName(),
      )
    }
  }

  /**
   * Validate input text before embedding
   */
  protected validateInput(text: string): void {
    if (typeof text !== 'string') {
      throw new EmbedderValidationError(
        'Input must be a string',
        this.getProviderName(),
      )
    }

    if (text.trim().length === 0) {
      throw new EmbedderValidationError(
        'Input text cannot be empty',
        this.getProviderName(),
      )
    }

    // Check for reasonable text length (most models have token limits)
    if (text.length > 100000) {
      throw new EmbedderValidationError(
        'Input text is too long (max 100,000 characters)',
        this.getProviderName(),
      )
    }
  }

  /**
   * Execute operation with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        // Don't retry on validation errors
        if (error instanceof EmbedderValidationError) {
          throw error
        }

        // Don't retry on final attempt
        if (attempt === this.config.maxRetries) {
          break
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * Math.pow(2, attempt))
      }
    }

    // If we get here, all retries failed
    throw new EmbedderConnectionError(
      `${operationName} failed after ${this.config.maxRetries + 1} attempts`,
      this.getProviderName(),
      lastError,
    )
  }

  /**
   * Delay execution for specified milliseconds
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Create an AbortController with timeout
   */
  protected createTimeoutController(): AbortController {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, this.config.timeout)

    // Clear timeout if operation completes
    const _originalSignal = controller.signal
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId)
    })

    return controller
  }

  /**
   * Main embed method with validation and error handling
   */
  async embed(text: string): Promise<number[]> {
    try {
      this.validateInput(text)

      const result = await this.withRetry(
        () => this.performEmbed(text),
        'embed',
      )

      this.validateOutput(result)
      return result
    } catch (error) {
      if (error instanceof EmbedderError) {
        throw error
      }

      throw new EmbedderError(
        `Embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.getProviderName(),
        error,
      )
    }
  }

  /**
   * Validate embedding output
   */
  protected validateOutput(embedding: number[]): void {
    if (!Array.isArray(embedding)) {
      throw new EmbedderError(
        'Embedding result must be an array',
        this.getProviderName(),
      )
    }

    if (embedding.length === 0) {
      throw new EmbedderError(
        'Embedding result cannot be empty',
        this.getProviderName(),
      )
    }

    if (!embedding.every((val) => typeof val === 'number' && !isNaN(val))) {
      throw new EmbedderError(
        'Embedding result must contain only valid numbers',
        this.getProviderName(),
      )
    }
  }

  /**
   * Embed multiple texts in batches
   * Useful for processing large amounts of text efficiently
   */
  async embedBatch(options: EmbedBatchOptions): Promise<EmbedBatchResult> {
    const { texts, batchSize = DEFAULT_EMBEDDER_CONFIG.batchSize, delayMs = DEFAULT_EMBEDDER_CONFIG.batchDelayMs } =
      options

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new EmbedderValidationError(
        'Texts array cannot be empty',
        this.getProviderName(),
      )
    }

    const embeddings: number[][] = []
    const errors: string[] = []
    let successCount = 0
    let failureCount = 0

    // Process texts in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      // Process batch items in parallel
      const batchPromises = batch.map(async (text, index) => {
        try {
          const embedding = await this.embed(text)
          return { index: i + index, embedding, error: null }
        } catch (error) {
          return {
            index: i + index,
            embedding: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)

      // Process batch results
      for (const result of batchResults) {
        if (result.embedding) {
          embeddings[result.index] = result.embedding
          successCount++
        } else {
          errors[result.index] = result.error!
          failureCount++
        }
      }

      // Add delay between batches (except for last batch)
      if (i + batchSize < texts.length && delayMs > 0) {
        await this.delay(delayMs)
      }
    }

    return {
      embeddings,
      successCount,
      failureCount,
      errors,
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<BaseEmbedderOptions>> {
    return { ...this.config }
  }

  /**
   * Get embedder information
   */
  getInfo(): { provider: string; model: string; config: Readonly<Required<BaseEmbedderOptions>> } {
    return {
      provider: this.getProviderName(),
      model: this.config.model,
      config: this.getConfig(),
    }
  }
}

/**
 * Utility function to validate embedding dimensions consistency
 */
export function validateEmbeddingDimensions(embeddings: number[][]): void {
  if (embeddings.length === 0) return

  const expectedDimensions = embeddings[0].length
  for (let i = 1; i < embeddings.length; i++) {
    if (embeddings[i].length !== expectedDimensions) {
      throw new EmbedderError(
        `Inconsistent embedding dimensions: expected ${expectedDimensions}, got ${embeddings[i].length} at index ${i}`,
      )
    }
  }
}

/**
 * Utility function to normalize embeddings to unit length
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding
}

/**
 * Utility function to calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new EmbedderError('Embeddings must have the same dimensions for similarity calculation')
  }

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

  return magnitudeA > 0 && magnitudeB > 0 ? dotProduct / (magnitudeA * magnitudeB) : 0
}
