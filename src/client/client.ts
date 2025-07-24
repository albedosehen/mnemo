/**
 * Qdrant REST API client
 * @module client
 */

import type {
  CollectionInfo,
  CollectionResponse,
  QdrantClientOptions,
  SearchQuery,
  SearchResult,
  VectorRecord,
} from './client.types.ts'
import { QdrantAuthenticationError, QdrantConnectionError, QdrantError, QdrantValidationError } from './client.types.ts'
import type { CountParams, CountResult, Filter } from './filters.types.ts'

/**
 * Default configuration values for QdrantClient
 */
export const DEFAULT_QDRANT_CONFIG = {
  /** Default request timeout in milliseconds */
  timeout: 30000,
  /** Default maximum retries */
  maxRetries: 3,
  /** Default retry delay in milliseconds */
  retryDelay: 1000,
} as const

/**
 * Collection configuration for creating new collections
 */
export interface CreateCollectionConfig {
  /** Vector size (dimensions) */
  size: number
  /** Distance metric for similarity calculation */
  distance: 'Cosine' | 'Euclidean' | 'Dot'
  /** Enable on-disk storage for vectors */
  onDisk?: boolean
  /** HNSW index configuration */
  hnsw?: {
    /** Number of connections per node */
    m?: number
    /** Size of the dynamic candidate list */
    ef_construct?: number
  }
  /** Quantization configuration */
  quantization?: {
    /** Scalar quantization settings */
    scalar?: {
      /** Type of scalar quantization */
      type: 'int8'
      /** Quantile for quantization bounds */
      quantile?: number
      /** Whether to always use RAM */
      always_ram?: boolean
    }
  }
}

/**
 * Point (vector record) for Qdrant operations
 */
export interface QdrantPoint {
  /** Unique identifier */
  id: string | number
  /** Vector data */
  vector: number[]
  /** Associated metadata */
  payload?: Record<string, unknown>
}

/**
 * Batch operation for multiple points
 */
export interface UpsertPointsRequest {
  /** Array of points to upsert */
  points: QdrantPoint[]
}

/**
 * Response from upsert operation
 */
export interface UpsertPointsResponse {
  /** Operation result */
  result: {
    /** Operation status */
    operation_id: number
    /** Update status */
    status: 'acknowledged' | 'completed'
  }
  /** Execution status */
  status: 'ok'
  /** Execution time */
  time: number
}

/**
 * Search request for vector similarity
 */
export interface SearchPointsRequest {
  /** Query vector */
  vector: number[]
  /** Number of results to return */
  limit?: number
  /** Filter conditions */
  filter?: Filter
  /** Include vector data in results */
  with_vector?: boolean
  /** Include payload data in results */
  with_payload?: boolean
  /** Score threshold for results */
  score_threshold?: number
  /** Search parameters */
  params?: {
    /** HNSW search parameter */
    hnsw_ef?: number
    /** Use exact search */
    exact?: boolean
  }
}

/**
 * Individual search result
 */
export interface QdrantSearchResult {
  /** Point ID */
  id: string | number
  /** Similarity score */
  score: number
  /** Vector data (if requested) */
  vector?: number[]
  /** Payload data (if requested) */
  payload?: Record<string, unknown>
}

/**
 * Response from search operation
 */
export interface SearchPointsResponse {
  /** Search results */
  result: QdrantSearchResult[]
  /** Execution status */
  status: 'ok'
  /** Execution time */
  time: number
}

/**
 * Request to delete points
 */
export interface DeletePointsRequest {
  /** Point IDs to delete */
  points?: (string | number)[]
  /** Filter for points to delete */
  filter?: Filter
}

/**
 * Request to get points by IDs
 */
export interface GetPointsRequest {
  /** Point IDs to retrieve */
  ids: (string | number)[]
  /** Include payload data in results */
  with_payload?: boolean
  /** Include vector data in results */
  with_vector?: boolean
}

/**
 * Response from get points operation
 */
export interface GetPointsResponse {
  /** Retrieved points */
  result: QdrantSearchResult[]
  /** Execution status */
  status: 'ok'
  /** Execution time */
  time: number
}

/**
 * Qdrant REST API client
 * Provides interface to Qdrant vector database operations
 */
export class QdrantClient {
  private readonly config: Required<QdrantClientOptions>
  private readonly headers: Record<string, string>

  /**
   * Create a new QdrantClient instance
   * @param options - Configuration options for the client
   * @throws {QdrantValidationError} When required options are missing or invalid
   */
  constructor(options: QdrantClientOptions) {
    // Validate required options
    if (!options.url) {
      throw new QdrantValidationError('Qdrant URL is required')
    }

    this.config = {
      url: options.url.replace(/\/$/, ''), // Remove trailing slash
      apiKey: options.apiKey || '',
      timeout: options.timeout ?? DEFAULT_QDRANT_CONFIG.timeout,
    }

    // Build headers
    this.headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'mnemo-qdrant-client/1.0.0',
    }

    if (this.config.apiKey) {
      this.headers['api-key'] = this.config.apiKey
    }

    this.validateConfig()
  }

  /**
   * Validate client configuration
   */
  private validateConfig(): void {
    try {
      new URL(this.config.url)
    } catch {
      throw new QdrantValidationError(`Invalid Qdrant URL: ${this.config.url}`)
    }

    if (this.config.timeout <= 0) {
      throw new QdrantValidationError('Timeout must be greater than 0')
    }
  }

  /**
   * Create an AbortController with timeout
   */
  private createTimeoutController(): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, this.config.timeout)

    const cleanup = () => {
      clearTimeout(timeoutId)
    }

    // Clear timeout if operation is aborted
    controller.signal.addEventListener('abort', cleanup, { once: true })

    return { controller, cleanup }
  }

  /**
   * Execute HTTP request with error handling
   */
  private async executeRequest<T>(
    endpoint: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: unknown
    },
  ): Promise<T> {
    const url = `${this.config.url}${endpoint}`
    const { controller, cleanup } = this.createTimeoutController()

    const requestOptions: RequestInit = {
      method: options.method,
      headers: this.headers,
      signal: controller.signal,
    }

    if (options.body !== undefined) {
      requestOptions.body = JSON.stringify(options.body)
    }

    try {
      const response = await fetch(url, requestOptions)

      // Clean up the timeout on successful completion
      cleanup()

      if (!response.ok) {
        await this.handleErrorResponse(response)
      }

      const data = await response.json() as T
      return data
    } catch (error) {
      // Clean up the timeout on error
      cleanup()

      if (error instanceof Error && error.name === 'AbortError') {
        throw new QdrantConnectionError(
          `Request timed out after ${this.config.timeout}ms`,
          error,
        )
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new QdrantConnectionError(
          `Failed to connect to Qdrant at ${this.config.url}`,
          error,
        )
      }

      throw error
    }
  }

  /**
   * Handle error responses from Qdrant API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: unknown = null

    try {
      errorData = await response.json()
    } catch {
      // Ignore JSON parsing errors
    }

    const errorMessage = this.extractErrorMessage(errorData) || response.statusText || 'Unknown error'

    switch (response.status) {
      case 400:
        throw new QdrantValidationError(
          `Bad request: ${errorMessage}`,
          response.status,
        )
      case 401:
        throw new QdrantAuthenticationError(
          `Authentication failed: ${errorMessage}. Check your API key.`,
        )
      case 403:
        throw new QdrantAuthenticationError(
          `Forbidden: ${errorMessage}. Check your API permissions.`,
        )
      case 404:
        throw new QdrantError(
          `Not found: ${errorMessage}`,
          response.status,
        )
      case 422:
        throw new QdrantValidationError(
          `Validation error: ${errorMessage}`,
          response.status,
        )
      case 500:
      case 502:
      case 503:
      case 504:
        throw new QdrantConnectionError(
          `Server error: ${errorMessage}`,
          response.status,
        )
      default:
        throw new QdrantError(
          `HTTP ${response.status}: ${errorMessage}`,
          response.status,
        )
    }
  }

  /**
   * Extract error message from error response
   */
  private extractErrorMessage(errorData: unknown): string | null {
    if (typeof errorData === 'object' && errorData !== null) {
      const data = errorData as Record<string, unknown>

      // Try common error message fields
      if (typeof data.error === 'string') return data.error
      if (typeof data.message === 'string') return data.message
      if (typeof data.detail === 'string') return data.detail

      // Handle nested error structures
      if (typeof data.status === 'object' && data.status !== null) {
        const status = data.status as Record<string, unknown>
        if (typeof status.error === 'string') return status.error
      }
    }

    return null
  }

  /**
   * Get information about a collection
   */
  async getCollection(collectionName: string): Promise<CollectionInfo> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    const response = await this.executeRequest<{ result: CollectionInfo }>(
      `/collections/${encodeURIComponent(collectionName)}`,
      { method: 'GET' },
    )

    return response.result
  }

  /**
   * Create a new collection
   */
  async createCollection(collectionName: string, config: CreateCollectionConfig): Promise<CollectionResponse> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    if (!config.size || config.size <= 0) {
      throw new QdrantValidationError('Vector size must be a positive number')
    }

    const requestBody = {
      vectors: {
        size: config.size,
        distance: config.distance,
        on_disk: config.onDisk,
        hnsw_config: config.hnsw,
      },
      quantization_config: config.quantization,
    }

    const response = await this.executeRequest<CollectionResponse>(
      `/collections/${encodeURIComponent(collectionName)}`,
      {
        method: 'PUT',
        body: requestBody,
      },
    )

    return response
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<CollectionResponse> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    const response = await this.executeRequest<CollectionResponse>(
      `/collections/${encodeURIComponent(collectionName)}`,
      { method: 'DELETE' },
    )

    return response
  }

  /**
   * Check if a collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await this.getCollection(collectionName)
      return true
    } catch (error) {
      if (error instanceof QdrantError && error.statusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Upsert a single vector record
   */
  upsert(collectionName: string, record: VectorRecord): Promise<UpsertPointsResponse> {
    return this.upsertBatch(collectionName, [record])
  }

  /**
   * Upsert multiple vector records
   */
  async upsertBatch(collectionName: string, records: VectorRecord[]): Promise<UpsertPointsResponse> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new QdrantValidationError('Records array cannot be empty')
    }

    // Validate records
    for (const record of records) {
      if (!record.id) {
        throw new QdrantValidationError('Record ID is required')
      }
      if (!Array.isArray(record.vector) || record.vector.length === 0) {
        throw new QdrantValidationError('Record vector is required and must be a non-empty array')
      }
    }

    const points: QdrantPoint[] = records.map((record) => ({
      id: record.id,
      vector: record.vector,
      payload: record.payload,
    }))

    const requestBody: UpsertPointsRequest = { points }

    const response = await this.executeRequest<UpsertPointsResponse>(
      `/collections/${encodeURIComponent(collectionName)}/points`,
      {
        method: 'PUT',
        body: requestBody,
      },
    )

    return response
  }

  /**
   * Search for similar vectors
   */
  async search(collectionName: string, query: SearchQuery): Promise<SearchResult[]> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    if (!Array.isArray(query.vector) || query.vector.length === 0) {
      throw new QdrantValidationError('Query vector is required and must be a non-empty array')
    }

    const requestBody: SearchPointsRequest = {
      vector: query.vector,
      limit: query.topK || 10,
      filter: query.filter ? (query.filter as unknown as Filter) : undefined,
      with_vector: false,
      with_payload: true,
    }

    const response = await this.executeRequest<SearchPointsResponse>(
      `/collections/${encodeURIComponent(collectionName)}/points/search`,
      {
        method: 'POST',
        body: requestBody,
      },
    )

    return response.result.map((result) => ({
      id: String(result.id),
      score: result.score,
      vector: result.vector,
      payload: result.payload || {},
    }))
  }

  /**
   * Count points in a collection with optional filtering
   *
   * @param collectionName - Name of the collection to count points in
   * @param params - Optional count parameters including filters
   * @returns Promise resolving to count result
   * @throws {QdrantValidationError} When collection name is missing
   * @throws {QdrantError} When the count operation fails
   *
   * @example
   * ```typescript
   * // Count all points in collection
   * const result = await client.countPoints('my-collection')
   * console.log(`Total points: ${result.count}`)
   *
   * // Count points matching a filter
   * const filteredResult = await client.countPoints('my-collection', {
   *   filter: { match: { key: 'category', value: 'research' } },
   *   exact: true
   * })
   * console.log(`Filtered points: ${filteredResult.count}`)
   * ```
   */
  async countPoints(collectionName: string, params?: CountParams): Promise<CountResult> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    const requestBody: CountParams = params || {}

    const response = await this.executeRequest<{ result: CountResult }>(
      `/collections/${encodeURIComponent(collectionName)}/points/count`,
      {
        method: 'POST',
        body: requestBody,
      },
    )

    return response.result
  }

  /**
   * Delete points by IDs
   */
  async deletePoints(collectionName: string, pointIds: string[]): Promise<CollectionResponse> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    if (!Array.isArray(pointIds) || pointIds.length === 0) {
      throw new QdrantValidationError('Point IDs array cannot be empty')
    }

    const requestBody: DeletePointsRequest = {
      points: pointIds,
    }

    const response = await this.executeRequest<CollectionResponse>(
      `/collections/${encodeURIComponent(collectionName)}/points/delete`,
      {
        method: 'POST',
        body: requestBody,
      },
    )

    return response
  }

  /**
   * Delete points by filter
   */
  async deletePointsByFilter(collectionName: string, filter: Filter): Promise<CollectionResponse> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    if (!filter) {
      throw new QdrantValidationError('Filter is required')
    }

    const requestBody: DeletePointsRequest = {
      filter,
    }

    const response = await this.executeRequest<CollectionResponse>(
      `/collections/${encodeURIComponent(collectionName)}/points/delete`,
      {
        method: 'POST',
        body: requestBody,
      },
    )

    return response
  }

  /**
   * Get points by IDs
   */
  async getPoints(collectionName: string, pointIds: string[], withPayload = true): Promise<QdrantSearchResult[]> {
    if (!collectionName) {
      throw new QdrantValidationError('Collection name is required')
    }

    if (!Array.isArray(pointIds) || pointIds.length === 0) {
      throw new QdrantValidationError('Point IDs array cannot be empty')
    }

    const requestBody: GetPointsRequest = {
      ids: pointIds,
      with_payload: withPayload,
      with_vector: false,
    }

    const response = await this.executeRequest<GetPointsResponse>(
      `/collections/${encodeURIComponent(collectionName)}/points`,
      {
        method: 'POST',
        body: requestBody,
      },
    )

    return response.result.map((result) => ({
      id: String(result.id),
      score: result.score || 0,
      vector: result.vector,
      payload: result.payload || {},
    }))
  }

  /**
   * Health check for Qdrant server
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      await this.executeRequest<unknown>('/health', { method: 'GET' })
      return { status: 'ok' }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get client configuration
   */
  getConfig(): Readonly<Required<QdrantClientOptions>> {
    return { ...this.config }
  }

  /**
   * Get client information
   */
  getInfo(): {
    url: string
    hasApiKey: boolean
    timeout: number
  } {
    return {
      url: this.config.url,
      hasApiKey: Boolean(this.config.apiKey),
      timeout: this.config.timeout,
    }
  }
}

/**
 * Factory function to create a QdrantClient
 */
export function createQdrantClient(options: QdrantClientOptions): QdrantClient {
  return new QdrantClient(options)
}

/**
 * Create a QdrantClient for local development
 */
export function createLocalQdrantClient(port = 6333): QdrantClient {
  return new QdrantClient({
    url: `http://localhost:${port}`,
  })
}

/**
 * Create a QdrantClient for Qdrant Cloud
 */
export function createQdrantCloudClient(url: string, apiKey: string): QdrantClient {
  return new QdrantClient({
    url,
    apiKey,
  })
}
