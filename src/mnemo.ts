/**
 * Mnemo - Main facade class for vector memory operations
 * @module mnemo
 */

import type { QdrantClient } from './client/client.ts'
import type { CountParams, CountResult } from './client/filters.types.ts'
import { QdrantValidationError, type SearchQuery, type SearchResult, type VectorRecord } from './client/client.types.ts'
import { type Embedder, EmbedderValidationError } from './embedder/embedder.types.ts'

/**
 * Options for searching memory with text input
 */
export interface SearchFromTextOptions {
  /** Text to search for */
  text: string
  /** Maximum number of results to return */
  topK?: number
  /** Filter conditions for payload metadata */
  filter?: Record<string, unknown>
  /** Collection name to search in */
  collection?: string
}

/**
 * Configuration options for Mnemo instance
 */
export interface MnemoOptions {
  /** Default collection name for operations */
  defaultCollection?: string
  /** Whether to validate vector dimensions */
  validateDimensions?: boolean
  /** Maximum batch size for bulk operations */
  maxBatchSize?: number
}

/**
 * Mnemo - The main interface for vector memory operations
 *
 * This class provides a high-level API for storing and searching vector-encoded
 * representations using Qdrant as the vector database and configurable embedding
 * providers like Ollama or OpenAI.
 *
 * @example
 * ```typescript
 * import { Mnemo, QdrantClient, OllamaEmbedder } from 'mnemo'
 *
 * const client = new QdrantClient({ url: 'http://localhost:6333' })
 * const embedder = new OllamaEmbedder({ endpoint: 'http://localhost:11434' })
 * const mnemo = new Mnemo(client, embedder)
 *
 * // Store a memory
 * await mnemo.storeFromText('event:NVDA:2025', 'NVIDIA announces stock split', {
 *   ticker: 'NVDA',
 *   type: 'announcement',
 *   sentiment: 0.8
 * })
 *
 * // Search for similar memories
 * const results = await mnemo.searchFromText({
 *   text: 'stock split news',
 *   topK: 5,
 *   filter: { ticker: 'NVDA' }
 * })
 * ```
 */
export class Mnemo {
  private readonly qdrant: QdrantClient
  private readonly embedder: Embedder
  private readonly config: Required<MnemoOptions>

  /**
   * Create a new Mnemo instance
   *
   * @param qdrantClient - Configured QdrantClient for vector database operations
   * @param embedder - Configured embedder for text-to-vector conversion
   * @param options - Optional configuration for the Mnemo instance
   *
   * @example
   * ```typescript
   * const client = new QdrantClient({ url: 'http://localhost:6333' })
   * const embedder = new OllamaEmbedder()
   * const mnemo = new Mnemo(client, embedder, {
   *   defaultCollection: 'memories',
   *   validateDimensions: true
   * })
   * ```
   */
  constructor(qdrantClient: QdrantClient, embedder: Embedder, options: MnemoOptions = {}) {
    if (!qdrantClient) {
      throw new QdrantValidationError('QdrantClient is required')
    }

    if (!embedder) {
      throw new EmbedderValidationError('Embedder is required')
    }

    this.qdrant = qdrantClient
    this.embedder = embedder
    this.config = {
      defaultCollection: options.defaultCollection || 'default',
      validateDimensions: options.validateDimensions ?? true,
      maxBatchSize: options.maxBatchSize || 100,
    }
  }

  /**
   * Generate a vector embedding from text input
   *
   * @param text - The input text to embed
   * @returns Promise resolving to a vector representation of the text
   * @throws {EmbedderError} When the embedding service fails
   * @throws {EmbedderValidationError} When the input text is invalid
   *
   * @example
   * ```typescript
   * const vector = await mnemo.embed('Hello, world!')
   * console.log(vector.length) // e.g., 768 depending on model
   * ```
   */
  async embed(text: string): Promise<number[]> {
    return await this.embedder.embed(text)
  }

  /**
   * Insert or update a vector record in the database
   *
   * @param record - The vector record to store
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise that resolves when the operation completes
   * @throws {QdrantError} When the database operation fails
   * @throws {QdrantValidationError} When the record is invalid
   *
   * @example
   * ```typescript
   * await mnemo.upsert({
   *   id: 'doc:123',
   *   vector: [0.1, 0.2, 0.3, ...],
   *   payload: { title: 'Important Document', category: 'research' }
   * })
   * ```
   */
  async upsert(record: VectorRecord, collection?: string): Promise<void> {
    const collectionName = collection || this.config.defaultCollection

    // Validate the record
    this.validateVectorRecord(record)

    await this.qdrant.upsert(collectionName, record)
  }

  /**
   * Store text as a vector memory by embedding it first
   *
   * This is a convenience method that combines embedding and upserting in one operation.
   *
   * @param id - Unique identifier for the memory
   * @param text - Text content to embed and store
   * @param payload - Additional metadata to associate with the memory
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise that resolves when the operation completes
   * @throws {EmbedderError} When embedding fails
   * @throws {QdrantError} When storage fails
   *
   * @example
   * ```typescript
   * await mnemo.storeFromText(
   *   'event:AAPL:2025-01-15',
   *   'Apple reports record quarterly earnings',
   *   {
   *     ticker: 'AAPL',
   *     type: 'earnings',
   *     sentiment: 0.9,
   *     timestamp: '2025-01-15T16:00:00Z'
   *   }
   * )
   * ```
   */
  async storeFromText(
    id: string,
    text: string,
    collection?: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    if (!id?.trim()) {
      throw new QdrantValidationError('Record ID is required and cannot be empty')
    }

    if (!text?.trim()) {
      throw new EmbedderValidationError('Text content is required and cannot be empty')
    }

    // First, generate the embedding
    const vector = await this.embed(text)

    // Then store the vector record
    await this.upsert({
      id: id.trim(),
      vector,
      payload,
    }, collection)
  }

  /**
   * Search for similar memories by embedding text and querying vectors
   *
   * This is a convenience method that combines embedding and searching in one operation.
   *
   * @param options - Search configuration including text, filters, and limits
   * @returns Promise resolving to an array of search results
   * @throws {EmbedderError} When embedding fails
   * @throws {QdrantError} When search fails
   *
   * @example
   * ```typescript
   * const results = await mnemo.searchFromText({
   *   text: 'artificial intelligence breakthrough',
   *   topK: 10,
   *   filter: { category: 'tech', sentiment: { gte: 0.7 } },
   *   collection: 'news'
   * })
   *
   * for (const result of results) {
   *   console.log(`${result.id}: ${result.score}`)
   * }
   * ```
   */
  async searchFromText(options: SearchFromTextOptions): Promise<SearchResult[]> {
    const { text, topK, filter, collection } = options

    if (!text?.trim()) {
      throw new EmbedderValidationError('Search text is required and cannot be empty')
    }

    // First, generate the embedding for the search text
    const vector = await this.embed(text.trim())

    // Then search using the vector
    return await this.search({
      vector,
      topK,
      filter,
    }, collection)
  }

  /**
   * Search for similar vectors in the database
   *
   * @param query - Search query with vector and optional filters
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise resolving to an array of search results
   * @throws {QdrantError} When the search operation fails
   *
   * @example
   * ```typescript
   * const results = await mnemo.search({
   *   vector: await mnemo.embed('machine learning'),
   *   topK: 5,
   *   filter: { category: 'research' }
   * })
   * ```
   */
  async search(query: SearchQuery, collection?: string): Promise<SearchResult[]> {
    const collectionName = collection || this.config.defaultCollection
    return await this.qdrant.search(collectionName, query)
  }

  /**
   * Delete a memory by its ID
   *
   * @param id - The ID of the memory to delete
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise that resolves when the operation completes
   * @throws {QdrantError} When the delete operation fails
   *
   * @example
   * ```typescript
   * await mnemo.delete('event:NVDA:2025-01-15')
   * ```
   */
  async delete(id: string, collection?: string): Promise<void> {
    if (!id?.trim()) {
      throw new QdrantValidationError('Memory ID is required and cannot be empty')
    }

    const collectionName = collection || this.config.defaultCollection
    await this.qdrant.deletePoints(collectionName, [id.trim()])
  }

  /**
   * Get points by their IDs
   *
   * @param ids - Array of point IDs to retrieve
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise resolving to an array of search results
   * @throws {QdrantError} When the get operation fails
   *
   * @example
   * ```typescript
   * const points = await mnemo.getPoints(['event:NVDA:2025-01-15', 'event:AAPL:2025-01-15'])
   * ```
   */
  async getPoints(ids: string[], collection?: string): Promise<SearchResult[]> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new QdrantValidationError('IDs array cannot be empty')
    }

    const collectionName = collection || this.config.defaultCollection
    const qdrantResults = await this.qdrant.getPoints(collectionName, ids.map((id) => id.trim()))

    // Convert QdrantSearchResult to SearchResult format
    return qdrantResults.map((result) => ({
      id: String(result.id),
      score: result.score,
      vector: result.vector,
      payload: result.payload || {},
    }))
  }

  /**
   * Count the number of points in a collection with optional filtering
   *
   * @param params - Optional count parameters including filters
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise resolving to count result
   * @throws {QdrantError} When the count operation fails
   *
   * @example
   * ```typescript
   * // Count all points in the default collection
   * const result = await mnemo.count()
   * console.log(`Total memories: ${result.count}`)
   *
   * // Count points matching a filter
   * const filteredResult = await mnemo.count({
   *   filter: { match: { key: 'category', value: 'research' } },
   *   exact: true
   * })
   * console.log(`Research memories: ${filteredResult.count}`)
   *
   * // Count points in a specific collection
   * const collectionResult = await mnemo.count(undefined, 'news')
   * console.log(`News memories: ${collectionResult.count}`)
   * ```
   */
  async count(params?: CountParams, collection?: string): Promise<CountResult> {
    const collectionName = collection || this.config.defaultCollection
    return await this.qdrant.countPoints(collectionName, params)
  }

  /**
   * Store multiple memories in a batch operation
   *
   * @param records - Array of vector records to store
   * @param collection - Collection name (uses default if not specified)
   * @returns Promise that resolves when the operation completes
   * @throws {QdrantError} When the batch operation fails
   *
   * @example
   * ```typescript
   * await mnemo.upsertBatch([
   *   { id: 'doc:1', vector: [0.1, 0.2], payload: { type: 'article' } },
   *   { id: 'doc:2', vector: [0.3, 0.4], payload: { type: 'research' } }
   * ])
   * ```
   */
  async upsertBatch(records: VectorRecord[], collection?: string): Promise<void> {
    if (!Array.isArray(records) || records.length === 0) {
      throw new QdrantValidationError('Records array cannot be empty')
    }

    const collectionName = collection || this.config.defaultCollection

    // Validate all records
    for (const record of records) {
      this.validateVectorRecord(record)
    }

    // Process in batches if needed
    if (records.length <= this.config.maxBatchSize) {
      await this.qdrant.upsertBatch(collectionName, records)
    } else {
      // Split into smaller batches
      for (let i = 0; i < records.length; i += this.config.maxBatchSize) {
        const batch = records.slice(i, i + this.config.maxBatchSize)
        await this.qdrant.upsertBatch(collectionName, batch)
      }
    }
  }

  /**
   * Check if a collection exists
   *
   * @param collection - Collection name to check
   * @returns Promise resolving to true if collection exists, false otherwise
   */
  async collectionExists(collection?: string): Promise<boolean> {
    const collectionName = collection || this.config.defaultCollection
    return await this.qdrant.collectionExists(collectionName)
  }

  /**
   * Validate a vector record
   */
  private validateVectorRecord(record: VectorRecord): void {
    if (!record.id?.trim()) {
      throw new QdrantValidationError('Record ID is required and cannot be empty')
    }

    if (!Array.isArray(record.vector) || record.vector.length === 0) {
      throw new QdrantValidationError('Record vector is required and must be a non-empty array')
    }

    if (this.config.validateDimensions) {
      if (!record.vector.every((val) => typeof val === 'number' && !isNaN(val))) {
        throw new QdrantValidationError('Record vector must contain only valid numbers')
      }
    }
  }

  /**
   * Get the default collection name
   */
  getDefaultCollection(): string {
    return this.config.defaultCollection
  }

  /**
   * Get Mnemo configuration
   */
  getConfig(): Readonly<Required<MnemoOptions>> {
    return { ...this.config }
  }

  /**
   * Get information about the Mnemo instance
   */
  getInfo(): {
    defaultCollection: string
    qdrantInfo: ReturnType<QdrantClient['getInfo']>
    embedderInfo: unknown
    config: Readonly<Required<MnemoOptions>>
  } {
    return {
      defaultCollection: this.config.defaultCollection,
      qdrantInfo: this.qdrant.getInfo(),
      embedderInfo: 'getInfo' in this.embedder ? (this.embedder as { getInfo(): unknown }).getInfo() : undefined,
      config: this.getConfig(),
    }
  }
}

/**
 * Factory function to create a Mnemo instance
 */
export function createMnemo(
  qdrantClient: QdrantClient,
  embedder: Embedder,
  options?: MnemoOptions,
): Mnemo {
  return new Mnemo(qdrantClient, embedder, options)
}
