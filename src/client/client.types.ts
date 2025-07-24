/**
 * Core types and interfaces for Qdrant client operations
 * @module client.types
 */

/**
 * Configuration options for QdrantClient
 */
export interface QdrantClientOptions {
  /** Qdrant server URL (e.g., 'http://localhost:6333' or Qdrant Cloud URL) */
  url: string
  /** API key for authentication (required for Qdrant Cloud) */
  apiKey?: string
  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Represents a vector record with metadata
 */
export interface VectorRecord {
  /** Unique identifier for the vector record */
  id: string
  /** Vector embedding as array of numbers */
  vector: number[]
  /** Additional metadata and payload data */
  payload: Record<string, unknown>
}

/**
 * Search query parameters for vector similarity search
 */
export interface SearchQuery {
  /** Query vector for similarity search */
  vector: number[]
  /** Maximum number of results to return */
  topK?: number
  /** Filter conditions for payload metadata */
  filter?: Record<string, unknown>
}

/**
 * Result from a vector search operation
 */
export interface SearchResult {
  /** Unique identifier of the matched record */
  id: string
  /** Similarity score (higher = more similar) */
  score: number
  /** Vector embedding of the matched record */
  vector?: number[]
  /** Payload metadata of the matched record */
  payload: Record<string, unknown>
}

/**
 * Collection information from Qdrant
 */
export interface CollectionInfo {
  /** Name of the collection */
  name: string
  /** Current status of the collection */
  status: string
  /** Vector configuration settings */
  config: {
    /** Size of vectors in the collection */
    size: number
    /** Distance metric used for similarity */
    distance: string
  }
  /** Number of vectors in the collection */
  vectorsCount?: number
}

/**
 * Response from collection operations
 */
export interface CollectionResponse {
  /** Operation result status */
  result: boolean
  /** Operation execution time in seconds */
  time: number
}

/**
 * Base error class for Qdrant operations
 */
export class QdrantError extends Error {
  /**
   * Create a new QdrantError instance
   * @param message - Error message
   * @param statusCode - HTTP status code if applicable
   * @param details - Additional error details
   */
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'QdrantError'
  }
}

/**
 * Error for network-related issues
 */
export class QdrantConnectionError extends QdrantError {
  /**
   * Create a new QdrantConnectionError instance
   * @param message - Error message
   * @param cause - Underlying cause of the error
   */
  constructor(message: string, cause?: unknown) {
    super(message, undefined, cause)
    this.name = 'QdrantConnectionError'
  }
}

/**
 * Error for authentication failures
 */
export class QdrantAuthenticationError extends QdrantError {
  /**
   * Create a new QdrantAuthenticationError instance
   * @param message - Error message
   */
  constructor(message: string) {
    super(message, 401)
    this.name = 'QdrantAuthenticationError'
  }
}

/**
 * Error for invalid requests or validation failures
 */
export class QdrantValidationError extends QdrantError {
  /**
   * Create a new QdrantValidationError instance
   * @param message - Error message
   * @param details - Additional validation error details
   */
  constructor(message: string, details?: unknown) {
    super(message, 400, details)
    this.name = 'QdrantValidationError'
  }
}
