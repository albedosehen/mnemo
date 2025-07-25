/**
 * Integration tests for the Mnemo library
 *
 * These tests focus on end-to-end workflows and component interactions,
 * testing how QdrantClient, Embedders, Tools, and the main Mnemo facade
 * work together as a cohesive system.
 *
 * @module tests.unit.mnemo
 */

import { assertEquals, assertInstanceOf, assertRejects, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { Mnemo, createMnemo } from '../../src/mnemo.ts'
import { QdrantClient } from '../../src/client/client.ts'
import { BaseEmbedder } from '../../src/embedder/embedder.ts'
import { OllamaEmbedder } from '../../src/embedder/ollama.ts'
import { OpenAIEmbedder } from '../../src/embedder/openai.ts'
import {
  StoreMemoryTool,
  SearchMemoryTool,
  DeleteMemoryTool,
  CountMemoryTool,
  MnemoToolRegistry,
} from '../../src/tools/mod.ts'
import {
  QdrantError,
  QdrantValidationError,
  QdrantConnectionError,
  QdrantAuthenticationError,
  type VectorRecord,
  type SearchQuery,
  type SearchResult,
} from '../../src/client/client.types.ts'
import {
  EmbedderError,
  EmbedderValidationError,
  EmbedderConnectionError,
  EmbedderAuthenticationError,
  EmbedderRateLimitError,
  type Embedder,
} from '../../src/embedder/embedder.types.ts'
import type { CountParams } from '../../src/client/filters.types.ts'

// Integration Test Mocks
// These mocks simulate realistic interactions between components

class IntegrationMockQdrantClient {
  private storage: Map<string, Map<string, VectorRecord>> = new Map()
  private connectionFailures = 0
  private authFailures = 0

  constructor(
    public readonly config: { url: string; apiKey?: string; timeout?: number },
    private simulateFailures = false
  ) {
    // Initialize default collection
    this.storage.set('default', new Map())
  }

  async upsert(collectionName: string, record: VectorRecord) {
    this.checkConnection()
    this.checkAuth()

    if (!this.storage.has(collectionName)) {
      this.storage.set(collectionName, new Map())
    }

    this.storage.get(collectionName)!.set(record.id, { ...record })
    return { result: { operation_id: Date.now(), status: 'completed' as const }, status: 'ok' as const, time: 0.1 }
  }

  async upsertBatch(collectionName: string, records: VectorRecord[]) {
    this.checkConnection()
    this.checkAuth()

    if (!this.storage.has(collectionName)) {
      this.storage.set(collectionName, new Map())
    }

    const collection = this.storage.get(collectionName)!
    for (const record of records) {
      collection.set(record.id, { ...record })
    }

    return { result: { operation_id: Date.now(), status: 'completed' as const }, status: 'ok' as const, time: 0.2 }
  }

  async search(collectionName: string, query: SearchQuery): Promise<SearchResult[]> {
    this.checkConnection()
    this.checkAuth()

    const collection = this.storage.get(collectionName)
    if (!collection) {
      return []
    }

    const results: SearchResult[] = []
    const { vector, topK = 10, filter } = query

    for (const [id, record] of collection.entries()) {
      // Simple similarity calculation (dot product)
      const similarity = this.calculateSimilarity(vector, record.vector)

      // Apply filter if provided
      if (filter && !this.matchesFilter(record.payload || {}, filter)) {
        continue
      }

      results.push({
        id,
        score: similarity,
        vector: record.vector,
        payload: record.payload || {}
      })
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  async deletePoints(collectionName: string, pointIds: string[]) {
    this.checkConnection()
    this.checkAuth()

    const collection = this.storage.get(collectionName)
    if (!collection) {
      throw new QdrantValidationError(`Collection ${collectionName} does not exist`)
    }

    for (const id of pointIds) {
      collection.delete(id)
    }

    return { result: true, time: 0.05 }
  }

  async getPoints(collectionName: string, pointIds: string[]): Promise<SearchResult[]> {
    this.checkConnection()
    this.checkAuth()

    const collection = this.storage.get(collectionName)
    if (!collection) {
      return []
    }

    const results: SearchResult[] = []
    for (const id of pointIds) {
      const record = collection.get(id)
      if (record) {
        results.push({
          id,
          score: 1.0, // Perfect match for get operations
          vector: record.vector,
          payload: record.payload || {}
        })
      }
    }

    return results
  }

  async countPoints(collectionName: string, params?: CountParams) {
    this.checkConnection()
    this.checkAuth()

    const collection = this.storage.get(collectionName)
    if (!collection) {
      return { count: 0 }
    }

    if (!params?.filter) {
      return { count: collection.size }
    }

    let count = 0
    for (const [, record] of collection.entries()) {
      if (this.matchesFilter(record.payload || {}, params.filter)) {
        count++
      }
    }

    return { count }
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    this.checkConnection()
    return this.storage.has(collectionName)
  }

  getInfo() {
    return {
      url: this.config.url,
      hasApiKey: Boolean(this.config.apiKey),
      timeout: this.config.timeout || 30000,
    }
  }

  // Simulation helpers
  simulateConnectionFailure() {
    this.connectionFailures++
  }

  simulateAuthFailure() {
    this.authFailures++
  }

  private checkConnection() {
    if (this.simulateFailures && this.connectionFailures > 0) {
      this.connectionFailures--
      throw new QdrantConnectionError('Simulated connection failure', new Error('Network error'))
    }
  }

  private checkAuth() {
    if (this.simulateFailures && this.authFailures > 0) {
      this.authFailures--
      throw new QdrantAuthenticationError('Simulated authentication failure')
    }
  }

  private calculateSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i]
      norm1 += vector1[i] * vector1[i]
      norm2 += vector2[i] * vector2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  private matchesFilter(payload: Record<string, unknown>, filter: any): boolean {
    // Simple filter matching for testing
    if (filter.match) {
      return payload[filter.match.key] === filter.match.value
    }
    if (filter.must && Array.isArray(filter.must)) {
      return filter.must.every((condition: any) => this.matchesFilter(payload, condition))
    }
    if (filter.should && Array.isArray(filter.should)) {
      return filter.should.some((condition: any) => this.matchesFilter(payload, condition))
    }
    return true
  }
}

class IntegrationMockEmbedder extends BaseEmbedder {
  private embeddingFailures = 0
  private rateLimitFailures = 0
  private currentOperationShouldFail = false
  private currentOperationRateLimited = false

  constructor(
    private dimensions = 384,
    private simulateFailures = false,
    private provider = 'mock'
  ) {
    super({ maxRetries: 0 }) // Disable retries for deterministic testing
  }

  protected getDefaultModel(): string {
    return 'mock-model'
  }

  protected getProviderName(): string {
    return this.provider
  }

  override async embed(text: string): Promise<number[]> {
    try {
      // For test mocks, bypass the retry mechanism and call performEmbed directly
      this.validateInput(text)
      const result = await this.performEmbed(text)
      this.validateOutput(result)
      return result
    } finally {
      // Reset operation flags after each complete embed operation
      this.currentOperationShouldFail = false
      this.currentOperationRateLimited = false
    }
  }

  protected async performEmbed(text: string): Promise<number[]> {
    // Check for rate limit failures first
    this.checkRateLimit()

    // Check for connection failures
    this.checkConnection()

    // Generate deterministic but realistic embeddings based on text
    const hash = this.simpleHash(text)
    const vector = new Array(this.dimensions)

    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = Math.sin(hash + i) * 0.5 + Math.cos(hash * i) * 0.3
    }

    return vector
  }

  // Simulation helpers
  simulateEmbeddingFailure(): void {
    this.embeddingFailures++
    this.currentOperationShouldFail = true
  }

  simulateRateLimitFailure(): void {
    this.rateLimitFailures++
    this.currentOperationRateLimited = true
  }

  private checkConnection(): void {
    if (this.simulateFailures && this.currentOperationShouldFail) {
      throw new EmbedderConnectionError('Simulated embedding failure', this.provider, new Error('Network error'))
    }
  }

  private checkRateLimit(): void {
    if (this.simulateFailures && this.currentOperationRateLimited) {
      throw new EmbedderRateLimitError('Simulated rate limit', this.provider, 60)
    }
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }
}

// End-to-End Workflow Tests
Deno.test('Integration - Complete store-search-delete workflow', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(384)
  const mnemo = new Mnemo(client, embedder)

  // Store multiple related memories
  await mnemo.storeFromText('doc:1', 'Machine learning algorithms for prediction', 'documents', {
    category: 'ai',
    type: 'research',
    sentiment: 0.8
  })

  await mnemo.storeFromText('doc:2', 'Deep learning neural networks implementation', 'documents', {
    category: 'ai',
    type: 'implementation',
    sentiment: 0.7
  })

  await mnemo.storeFromText('doc:3', 'Web development best practices guide', 'documents', {
    category: 'web',
    type: 'guide',
    sentiment: 0.6
  })

  // Search for AI-related content
  const searchResults = await mnemo.searchFromText({
    text: 'artificial intelligence machine learning',
    topK: 2,
    filter: { match: { key: 'category', value: 'ai' } },
    collection: 'documents'
  })

  assertEquals(searchResults.length, 2)
  assertEquals(searchResults[0].payload.category, 'ai')
  assertEquals(searchResults[1].payload.category, 'ai')

  // Verify we can retrieve specific documents
  const retrievedDocs = await mnemo.getPoints(['doc:1', 'doc:3'], 'documents')
  assertEquals(retrievedDocs.length, 2)

  // Count total documents
  const totalCount = await mnemo.count(undefined, 'documents')
  assertEquals(totalCount.count, 3)

  // Count filtered documents
  const aiCount = await mnemo.count({
    filter: { match: { key: 'category', value: 'ai' } }
  }, 'documents')
  assertEquals(aiCount.count, 2)

  // Delete one document
  await mnemo.delete('doc:2', 'documents')

  // Verify deletion
  const finalCount = await mnemo.count(undefined, 'documents')
  assertEquals(finalCount.count, 2)

  const finalSearchResults = await mnemo.searchFromText({
    text: 'deep learning neural networks',
    collection: 'documents'
  })
  assertEquals(finalSearchResults.every(r => r.id !== 'doc:2'), true)
})

Deno.test('Integration - Batch operations across components', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(256)
  const mnemo = new Mnemo(client, embedder, { maxBatchSize: 3 })

  // Prepare batch data
  const documents = [
    { id: 'batch:1', text: 'First document content', metadata: { priority: 1 } },
    { id: 'batch:2', text: 'Second document content', metadata: { priority: 2 } },
    { id: 'batch:3', text: 'Third document content', metadata: { priority: 3 } },
    { id: 'batch:4', text: 'Fourth document content', metadata: { priority: 4 } },
    { id: 'batch:5', text: 'Fifth document content', metadata: { priority: 5 } },
  ]

  // Generate embeddings for all documents
  const embeddings = await Promise.all(
    documents.map(doc => mnemo.embed(doc.text))
  )

  // Create vector records
  const vectorRecords: VectorRecord[] = documents.map((doc, i) => ({
    id: doc.id,
    vector: embeddings[i],
    payload: doc.metadata
  }))

  // Store as batch (should handle automatic batching due to maxBatchSize: 3)
  await mnemo.upsertBatch(vectorRecords, 'batch-test')

  // Verify all documents were stored
  const count = await mnemo.count(undefined, 'batch-test')
  assertEquals(count.count, 5)

  // Search across the batch
  const searchResults = await mnemo.searchFromText({
    text: 'document content',
    topK: 3,
    collection: 'batch-test'
  })

  assertEquals(searchResults.length, 3)
  assertEquals(searchResults.every(r => r.score > 0), true)
})

Deno.test('Integration - Multiple collections management', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(512)
  const mnemo = new Mnemo(client, embedder, { defaultCollection: 'main' })

  // Store data in different collections
  await mnemo.storeFromText('user:1', 'User profile information', 'users', { type: 'profile' })
  await mnemo.storeFromText('doc:1', 'Document content', 'documents', { type: 'content' })
  await mnemo.storeFromText('default:1', 'Default collection data') // Uses default collection

  // Verify collection existence
  assertEquals(await mnemo.collectionExists('users'), true)
  assertEquals(await mnemo.collectionExists('documents'), true)
  assertEquals(await mnemo.collectionExists('main'), true)
  assertEquals(await mnemo.collectionExists('nonexistent'), false)

  // Search in specific collections
  const userResults = await mnemo.searchFromText({
    text: 'profile',
    collection: 'users'
  })
  assertEquals(userResults.length, 1)
  assertEquals(userResults[0].payload.type, 'profile')

  const docResults = await mnemo.searchFromText({
    text: 'content',
    collection: 'documents'
  })
  assertEquals(docResults.length, 1)
  assertEquals(docResults[0].payload.type, 'content')

  // Search in default collection
  const defaultResults = await mnemo.searchFromText({
    text: 'default'
  })
  assertEquals(defaultResults.length, 1)
  assertEquals(defaultResults[0].id, 'default:1')

  // Count across collections
  assertEquals((await mnemo.count(undefined, 'users')).count, 1)
  assertEquals((await mnemo.count(undefined, 'documents')).count, 1)
  assertEquals((await mnemo.count(undefined, 'main')).count, 1)
})

// Component Integration Tests
Deno.test('Integration - QdrantClient and Embedder error propagation', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }, true) as any
  const embedder = new IntegrationMockEmbedder(384, true)
  const mnemo = new Mnemo(client, embedder)

  // Test embedder error propagation
  embedder.simulateEmbeddingFailure()
  await assertRejects(
    () => mnemo.storeFromText('test:1', 'test content'),
    EmbedderConnectionError,
    'Simulated embedding failure'
  )

  // Test rate limit error propagation
  embedder.simulateRateLimitFailure()
  await assertRejects(
    () => mnemo.embed('test text'),
    EmbedderRateLimitError,
    'Simulated rate limit'
  )

  // Test client connection error propagation
  client.simulateConnectionFailure()
  await assertRejects(
    () => mnemo.storeFromText('test:2', 'test content'),
    QdrantConnectionError,
    'Simulated connection failure'
  )

  // Test client auth error propagation
  client.simulateAuthFailure()
  await assertRejects(
    () => mnemo.search({ vector: [1, 2, 3] }),
    QdrantAuthenticationError,
    'Simulated authentication failure'
  )
})

Deno.test('Integration - Tools with Mnemo integration', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(128)
  const mnemo = new Mnemo(client, embedder)

  // Create tools
  const storeToolP = new StoreMemoryTool(mnemo)
  const searchTool = new SearchMemoryTool(mnemo)
  const deleteTool = new DeleteMemoryTool(mnemo)
  const countTool = new CountMemoryTool(mnemo)

  // Store memory using tool
  const storeResult = await storeToolP.execute({
    id: 'tool-test:1',
    text: 'Content stored via tool',
    payload: { source: 'tool-integration', timestamp: Date.now() }
  })

  assertEquals(storeResult.success, true)
  assertEquals(storeResult.id, 'tool-test:1')

  // Search using tool
  const searchResult = await searchTool.execute({
    query: 'content stored',
    topK: 1
  })

  assertEquals(searchResult.success, true)
  assertEquals(searchResult.results.length, 1)
  assertEquals(searchResult.results[0].id, 'tool-test:1')

  // Count using tool
  const countResult = await countTool.execute({})
  assertEquals(countResult.success, true)
  assertEquals(countResult.count, 1)

  // Delete using tool
  const deleteResult = await deleteTool.execute({
    id: 'tool-test:1'
  })

  assertEquals(deleteResult.success, true)

  // Verify deletion
  const finalCountResult = await countTool.execute({})
  assertEquals(finalCountResult.success, true)
  assertEquals(finalCountResult.count, 0)
})

Deno.test('Integration - Tool registry with multiple tools', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(256)
  const mnemo = new Mnemo(client, embedder)

  const registry = new MnemoToolRegistry(mnemo)

  // Register default tools
  registry.registerDefaultTools()

  // Verify registration
  const toolNames = registry.getToolNames()
  assertEquals(toolNames.length, 4)
  assertEquals(toolNames.includes('storeMemory'), true)
  assertEquals(toolNames.includes('searchMemory'), true)

  // Use tools through registry
  const storeResult = await registry.execute('storeMemory', {
    id: 'registry-test:1',
    text: 'Registry integration test',
    payload: { via: 'registry' }
  })
  assertEquals(storeResult.success, true)

  const searchResult = await registry.execute('searchMemory', {
    query: 'registry integration',
    topK: 1
  }) as any
  assertEquals(searchResult.success, true)
  assertEquals(searchResult.results[0].payload.via, 'registry')

  // Test tool metadata access
  const metadata = registry.getToolMetadata('storeMemory')
  assertEquals(metadata?.name, 'storeMemory')
  assertEquals(typeof metadata?.description, 'string')
})

// Real-World Scenario Tests
Deno.test('Integration - Large dataset simulation', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(384)
  const mnemo = new Mnemo(client, embedder, { maxBatchSize: 10 })

  // Simulate storing a large dataset
  const categories = ['tech', 'science', 'business', 'health', 'education']
  const documents: VectorRecord[] = []

  for (let i = 0; i < 50; i++) {
    const category = categories[i % categories.length]
    const text = `Document ${i + 1} about ${category} topics and related content`
    const vector = await embedder.embed(text)

    documents.push({
      id: `large-dataset:${i + 1}`,
      vector,
      payload: {
        category,
        index: i + 1,
        text,
        created: new Date().toISOString()
      }
    })
  }

  // Store in batches
  await mnemo.upsertBatch(documents, 'large-dataset')

  // Verify storage
  const totalCount = await mnemo.count(undefined, 'large-dataset')
  assertEquals(totalCount.count, 50)

  // Test category-specific searches
  for (const category of categories) {
    const categoryResults = await mnemo.searchFromText({
      text: `${category} topics`,
      topK: 5,
      filter: { match: { key: 'category', value: category } },
      collection: 'large-dataset'
    })

    assertEquals(categoryResults.length, 5)
    assertEquals(categoryResults.every(r => r.payload.category === category), true)
  }

  // Test cross-category search
  const generalResults = await mnemo.searchFromText({
    text: 'content topics',
    topK: 15,
    collection: 'large-dataset'
  })

  assertEquals(generalResults.length, 15)
  assertEquals(generalResults.every(r => r.score > 0), true)
})

Deno.test('Integration - Error recovery scenarios', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }, true) as any
  const embedder = new IntegrationMockEmbedder(384, true)
  const mnemo = new Mnemo(client, embedder)

  // Test partial success in batch operations
  const records: VectorRecord[] = [
    { id: 'recovery:1', vector: [1, 2, 3], payload: { test: true } },
    { id: 'recovery:2', vector: [4, 5, 6], payload: { test: true } },
  ]

  // First operation should succeed
  await mnemo.upsertBatch(records, 'recovery-test')

  // Simulate failure for next operation
  client.simulateConnectionFailure()

  // This should fail
  await assertRejects(
    () => mnemo.search({ vector: [1, 2, 3] }, 'recovery-test'),
    QdrantConnectionError
  )

  // But subsequent operations should work (failure was one-time)
  const count = await mnemo.count(undefined, 'recovery-test')
  assertEquals(count.count, 2)

  // Test embedder failure recovery
  embedder.simulateEmbeddingFailure()

  await assertRejects(
    () => mnemo.storeFromText('recovery:3', 'test text', 'recovery-test'),
    EmbedderConnectionError
  )

  // Should work after the simulated failure
  await mnemo.storeFromText('recovery:3', 'test text', 'recovery-test')

  const finalCount = await mnemo.count(undefined, 'recovery-test')
  assertEquals(finalCount.count, 3)
})

Deno.test('Integration - Configuration consistency across components', async () => {
  const clientConfig = {
    url: 'http://localhost:6333',
    apiKey: 'test-key',
    timeout: 45000
  }
  const client = new IntegrationMockQdrantClient(clientConfig) as any
  const embedder = new IntegrationMockEmbedder(512)

  const mnemoConfig = {
    defaultCollection: 'config-test',
    validateDimensions: true,
    maxBatchSize: 25
  }
  const mnemo = new Mnemo(client, embedder, mnemoConfig)

  // Test that configurations are properly maintained
  const mnemoInfo = mnemo.getInfo()
  assertEquals(mnemoInfo.defaultCollection, 'config-test')
  assertEquals(mnemoInfo.config.validateDimensions, true)
  assertEquals(mnemoInfo.config.maxBatchSize, 25)
  assertEquals(mnemoInfo.qdrantInfo.url, 'http://localhost:6333')
  assertEquals(mnemoInfo.qdrantInfo.hasApiKey, true)
  assertEquals(mnemoInfo.qdrantInfo.timeout, 45000)

  // Test that validation settings work
  const invalidRecord: VectorRecord = {
    id: 'config-test:1',
    vector: [1, NaN, 3], // Invalid due to NaN
    payload: {}
  }

  await assertRejects(
    () => mnemo.upsert(invalidRecord),
    QdrantValidationError,
    'Record vector must contain only valid numbers'
  )

  // Test that batch size limits are respected
  const largeRecordSet = Array.from({ length: 30 }, (_, i) => ({
    id: `batch:${i}`,
    vector: Array.from({ length: 512 }, () => Math.random()),
    payload: { index: i }
  }))

  // Should handle batching automatically
  await mnemo.upsertBatch(largeRecordSet, 'config-test')

  const count = await mnemo.count(undefined, 'config-test')
  assertEquals(count.count, 30)
})

// Type Safety Integration Tests
Deno.test('Integration - Error type inheritance across components', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }, true) as any
  const embedder = new IntegrationMockEmbedder(384, true)
  const mnemo = new Mnemo(client, embedder)

  // Test QdrantError inheritance chain
  client.simulateConnectionFailure()
  try {
    await mnemo.search({ vector: [1, 2, 3] })
    assertEquals(false, true, 'Should have thrown error')
  } catch (error) {
    assertInstanceOf(error, Error)
    assertInstanceOf(error, QdrantError)
    assertInstanceOf(error, QdrantConnectionError)
    assertEquals(error.name, 'QdrantConnectionError')
  }

  client.simulateAuthFailure()
  try {
    await mnemo.count()
    assertEquals(false, true, 'Should have thrown error')
  } catch (error) {
    assertInstanceOf(error, Error)
    assertInstanceOf(error, QdrantError)
    assertInstanceOf(error, QdrantAuthenticationError)
    assertEquals(error.name, 'QdrantAuthenticationError')
  }

  // Test EmbedderError inheritance chain
  embedder.simulateRateLimitFailure()
  try {
    await mnemo.embed('test')
    assertEquals(false, true, 'Should have thrown error')
  } catch (error) {
    assertInstanceOf(error, Error)
    assertInstanceOf(error, EmbedderError)
    assertInstanceOf(error, EmbedderRateLimitError)
    assertEquals(error.name, 'EmbedderRateLimitError')
    assertEquals((error as EmbedderRateLimitError).retryAfter, 60)
  }

  embedder.simulateEmbeddingFailure()
  try {
    await mnemo.storeFromText('test', 'content')
    assertEquals(false, true, 'Should have thrown error')
  } catch (error) {
    assertInstanceOf(error, Error)
    assertInstanceOf(error, EmbedderError)
    assertInstanceOf(error, EmbedderConnectionError)
    assertEquals(error.name, 'EmbedderConnectionError')
  }
})

Deno.test('Integration - Validation error consistency', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(384)
  const mnemo = new Mnemo(client, embedder)

  // Test consistent validation across all methods
  const validationTests = [
    // ID validation
    () => mnemo.storeFromText('', 'content'),
    () => mnemo.delete(''),
    () => mnemo.upsert({ id: '', vector: [1, 2, 3], payload: {} }),

    // Text validation
    () => mnemo.storeFromText('test', ''),
    () => mnemo.searchFromText({ text: '' }),
    () => mnemo.embed(''),

    // Array validation
    () => mnemo.upsertBatch([]),
    () => mnemo.getPoints([]),
  ]

  for (const test of validationTests) {
    try {
      await test()
      assertEquals(false, true, 'Should have thrown validation error')
    } catch (error) {
      // Should be either QdrantValidationError or EmbedderValidationError
      assertEquals(
        error instanceof QdrantValidationError || error instanceof EmbedderValidationError,
        true,
        `Expected validation error, got ${error instanceof Error ? error.constructor.name : typeof error}`
      )
    }
  }
})

Deno.test('Integration - Factory function integration', () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(384)

  // Test factory function creates properly integrated instance
  const mnemo = createMnemo(client, embedder, {
    defaultCollection: 'factory-integration',
    maxBatchSize: 50
  })

  assertInstanceOf(mnemo, Mnemo)
  assertEquals(mnemo.getDefaultCollection(), 'factory-integration')
  assertEquals(mnemo.getConfig().maxBatchSize, 50)

  // Test that the factory-created instance works with all integrations
  const info = mnemo.getInfo()
  assertEquals(typeof info.qdrantInfo, 'object')
  assertEquals(typeof info.embedderInfo, 'object')
  assertEquals(info.defaultCollection, 'factory-integration')
})

Deno.test('Integration - Complex filtering across components', async () => {
  const client = new IntegrationMockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new IntegrationMockEmbedder(256)
  const mnemo = new Mnemo(client, embedder)

  // Store documents with complex metadata
  const documents = [
    {
      id: 'filter:1',
      text: 'AI research paper on neural networks',
      payload: { category: 'research', topic: 'ai', priority: 1, tags: ['neural', 'deep-learning'] }
    },
    {
      id: 'filter:2',
      text: 'Machine learning implementation guide',
      payload: { category: 'guide', topic: 'ai', priority: 2, tags: ['ml', 'implementation'] }
    },
    {
      id: 'filter:3',
      text: 'Web development tutorial',
      payload: { category: 'tutorial', topic: 'web', priority: 1, tags: ['html', 'javascript'] }
    },
    {
      id: 'filter:4',
      text: 'Database optimization techniques',
      payload: { category: 'guide', topic: 'database', priority: 3, tags: ['sql', 'performance'] }
    }
  ]

  for (const doc of documents) {
    await mnemo.storeFromText(doc.id, doc.text, 'complex-filter', doc.payload)
  }

  // Test various filter combinations
  const aiResults = await mnemo.searchFromText({
    text: 'artificial intelligence',
    filter: { match: { key: 'topic', value: 'ai' } },
    collection: 'complex-filter'
  })
  assertEquals(aiResults.length, 2)
  assertEquals(aiResults.every(r => r.payload.topic === 'ai'), true)

  const priorityResults = await mnemo.searchFromText({
    text: 'guide tutorial',
    filter: { match: { key: 'priority', value: 1 } },
    collection: 'complex-filter'
  })
  assertEquals(priorityResults.length, 2)
  assertEquals(priorityResults.every(r => r.payload.priority === 1), true)

  // Test count with filters
  const guideCount = await mnemo.count({
    filter: { match: { key: 'category', value: 'guide' } }
  }, 'complex-filter')
  assertEquals(guideCount.count, 2)

  const aiCount = await mnemo.count({
    filter: { match: { key: 'topic', value: 'ai' } }
  }, 'complex-filter')
  assertEquals(aiCount.count, 2)
})