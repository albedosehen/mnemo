/**
 * Core types and interfaces for embedding providers
 * @module embedder.types
 */

/**
 * Base interface for all embedding providers
 */
export interface Embedder {
  /**
   * Generate vector embedding from text input
   * @param text - The input text to embed
   * @returns Promise resolving to a vector representation of the text
   * @throws {EmbedderError} When the embedding service is unavailable
   * @throws {EmbedderValidationError} When the input text is invalid
   * @example
   * ```typescript
   * const embedder = new OllamaEmbedder({ endpoint: 'http://localhost:11434' });
   * const vector = await embedder.embed('Hello world');
   * console.log(vector.length); // 768 (depending on model)
   * ```
   */
  embed(text: string): Promise<number[]>
}

/**
 * Configuration for embedding batch operations
 */
export interface EmbedBatchOptions {
  /** Array of text inputs to embed */
  texts: string[]
  /** Maximum batch size for processing */
  batchSize?: number
  /** Delay between batch requests in milliseconds */
  delayMs?: number
}

/**
 * Result from batch embedding operation
 */
export interface EmbedBatchResult {
  /** Array of vectors corresponding to input texts */
  embeddings: number[][]
  /** Number of successful embeddings */
  successCount: number
  /** Number of failed embeddings */
  failureCount: number
  /** Array of error messages for failed embeddings */
  errors: string[]
}

/**
 * Base error class for embedding operations
 */
export class EmbedderError extends Error {
  /**
   * Create a new EmbedderError instance
   * @param message - Error message
   * @param provider - Provider name where the error occurred
   * @param cause - Underlying cause of the error
   */
  constructor(
    message: string,
    public readonly provider?: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'EmbedderError'
  }
}

/**
 * Error for network-related issues with embedding services
 */
export class EmbedderConnectionError extends EmbedderError {
  /**
   * Create a new EmbedderConnectionError instance
   * @param message - Error message
   * @param provider - Provider name where the error occurred
   * @param cause - Underlying cause of the error
   */
  constructor(message: string, provider?: string, cause?: unknown) {
    super(message, provider, cause)
    this.name = 'EmbedderConnectionError'
  }
}

/**
 * Error for authentication failures with embedding services
 */
export class EmbedderAuthenticationError extends EmbedderError {
  /**
   * Create a new EmbedderAuthenticationError instance
   * @param message - Error message
   * @param provider - Provider name where the error occurred
   */
  constructor(message: string, provider?: string) {
    super(message, provider)
    this.name = 'EmbedderAuthenticationError'
  }
}

/**
 * Error for invalid input or configuration
 */
export class EmbedderValidationError extends EmbedderError {
  /**
   * Create a new EmbedderValidationError instance
   * @param message - Error message
   * @param provider - Provider name where the error occurred
   * @param details - Additional validation error details
   */
  constructor(message: string, provider?: string, details?: unknown) {
    super(message, provider, details)
    this.name = 'EmbedderValidationError'
  }
}

/**
 * Error for rate limiting by embedding services
 */
export class EmbedderRateLimitError extends EmbedderError {
  /**
   * Create a new EmbedderRateLimitError instance
   * @param message - Error message
   * @param provider - Provider name where the error occurred
   * @param retryAfter - Seconds to wait before retrying
   */
  constructor(
    message: string,
    provider?: string,
    public readonly retryAfter?: number,
  ) {
    super(message, provider)
    this.name = 'EmbedderRateLimitError'
  }
}

/**
 * Error for model-specific issues
 */
export class EmbedderModelError extends EmbedderError {
  /**
   * Create a new EmbedderModelError instance
   * @param message - Error message
   * @param provider - Provider name where the error occurred
   * @param modelName - Name of the model that caused the error
   */
  constructor(
    message: string,
    provider?: string,
    public readonly modelName?: string,
  ) {
    super(message, provider)
    this.name = 'EmbedderModelError'
  }
}

/**
 * Common configuration options for embedder providers
 */
export interface BaseEmbedderOptions {
  /** Model name to use for embeddings */
  model?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Maximum number of retries for failed requests */
  maxRetries?: number
  /** Delay between retries in milliseconds */
  retryDelay?: number
}

/**
 * HTTP client configuration for embedder providers
 */
export interface EmbedderHttpOptions {
  /** Custom headers to include in requests */
  headers?: Record<string, string>
  /** User agent string for requests */
  userAgent?: string
  /** Whether to follow redirects */
  followRedirects?: boolean
}

/**
 * Standard response format from embedding APIs
 */
export interface EmbeddingApiResponse {
  /** Array of embedding vectors */
  data: Array<{
    /** The embedding vector */
    embedding: number[]
    /** Index of the input text */
    index: number
  }>
  /** Model used for embedding */
  model: string
  /** Usage statistics */
  usage?: {
    /** Number of input tokens */
    prompt_tokens: number
    /** Total tokens processed */
    total_tokens: number
  }
}

/**
 * Metadata about an embedding model
 */
export interface EmbeddingModelInfo {
  /** Model identifier */
  name: string
  /** Vector dimension size */
  dimensions: number
  /** Maximum input length in tokens */
  maxTokens: number
  /** Model description */
  description?: string
  /** Whether the model is available */
  available: boolean
}
