/**
 * Unit tests for Mnemo facade class
 * @module tests/mnemo
 */

import { assertEquals, assertInstanceOf, assertRejects, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { Mnemo, createMnemo } from '../src/mnemo.ts'
import { QdrantClient } from '../src/client.ts'
import { BaseEmbedder } from '../src/embedder/embedder.ts'
import { QdrantValidationError } from '../src/client.types.ts'
import { EmbedderValidationError } from '../src/embedder/embedder.types.ts'
import type { VectorRecord, SearchQuery } from '../src/client.types.ts'
import type { Embedder } from '../src/embedder/embedder.types.ts'
import type { CountParams, CountResult } from '../src/filters.types.ts'

// Mock QdrantClient for testing
class MockQdrantClient {
  constructor(public readonly config: { url: string; apiKey?: string; timeout?: number }) {}

  async upsert(collectionName: string, record: VectorRecord) {
    return { result: { operation_id: 1, status: 'completed' as const }, status: 'ok' as const, time: 0.1 }
  }

  async search(collectionName: string, query: SearchQuery) {
    return [
      {
        id: 'test-result',
        score: 0.95,
        payload: { text: 'mock result' },
      },
    ]
  }

  async deletePoints(collectionName: string, pointIds: string[]) {
    return { result: true, time: 0.05 }
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    return collectionName === 'existing-collection'
  }

  async upsertBatch(collectionName: string, records: VectorRecord[]) {
    return { result: { operation_id: 2, status: 'completed' as const }, status: 'ok' as const, time: 0.2 }
  }

  async countPoints(collectionName: string, params?: any) {
    // Default behavior: return different counts based on collection name and filters
    if (collectionName === 'test-collection') {
      // Check for direct match filter
      if (params?.filter?.match?.key === 'category') {
        return { count: 15 }
      }
      // Check for complex filter with must array containing match
      if (params?.filter?.must && Array.isArray(params.filter.must)) {
        for (const condition of params.filter.must) {
          if (condition.match?.key === 'category') {
            return { count: 15 }
          }
        }
      }
      return { count: 42 }
    }
    if (collectionName === 'custom-collection') {
      return { count: 100 }
    }
    if (collectionName === 'error-collection') {
      throw new QdrantValidationError('Test error from client')
    }
    return { count: 0 }
  }

  getInfo() {
    return {
      url: this.config.url,
      hasApiKey: Boolean(this.config.apiKey),
      timeout: this.config.timeout || 30000,
    }
  }
}

// Mock Embedder for testing
class MockEmbedder extends BaseEmbedder {
  constructor(private mockVector = [0.1, 0.2, 0.3, 0.4]) {
    super()
  }

  protected getDefaultModel(): string {
    return 'mock-model'
  }

  protected getProviderName(): string {
    return 'mock'
  }

  protected async performEmbed(_text: string): Promise<number[]> {
    return this.mockVector
  }
}

Deno.test('Mnemo - constructor validation', () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()

  // Should reject null/undefined client
  assertThrows(
    () => new Mnemo(null as any, embedder),
    QdrantValidationError,
    'QdrantClient is required',
  )

  // Should reject null/undefined embedder
  assertThrows(
    () => new Mnemo(client, null as any),
    EmbedderValidationError,
    'Embedder is required',
  )

  // Should work with valid parameters
  const mnemo = new Mnemo(client, embedder)
  assertInstanceOf(mnemo, Mnemo)
})

Deno.test('Mnemo - constructor with options', () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()

  const mnemo = new Mnemo(client, embedder, {
    defaultCollection: 'custom-collection',
    validateDimensions: false,
    maxBatchSize: 50,
  })

  const config = mnemo.getConfig()
  assertEquals(config.defaultCollection, 'custom-collection')
  assertEquals(config.validateDimensions, false)
  assertEquals(config.maxBatchSize, 50)
})

Deno.test('Mnemo - embed method delegates to embedder', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder([1, 2, 3, 4, 5])
  const mnemo = new Mnemo(client, embedder)

  const result = await mnemo.embed('test text')
  assertEquals(result, [1, 2, 3, 4, 5])
})

Deno.test('Mnemo - embed method validates input', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  // Should reject empty text
  await assertRejects(
    () => mnemo.embed(''),
    EmbedderValidationError,
    'Input text cannot be empty',
  )
})

Deno.test('Mnemo - upsert method delegates to QdrantClient', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  const record: VectorRecord = {
    id: 'test-record',
    vector: [1, 2, 3],
    payload: { text: 'test' },
  }

  await mnemo.upsert(record)
  // Test passes if no exception is thrown
})

Deno.test('Mnemo - upsert validates record', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  // Should reject invalid record
  const invalidRecord = {
    id: '',
    vector: [1, 2, 3],
    payload: {},
  }

  await assertRejects(
    () => mnemo.upsert(invalidRecord),
    QdrantValidationError,
    'Record ID is required and cannot be empty',
  )
})

Deno.test('Mnemo - storeFromText convenience method', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder([0.1, 0.2, 0.3])
  const mnemo = new Mnemo(client, embedder)

  await mnemo.storeFromText(
    'test-id',
    'Hello world',
    'custom-collection',
    { category: 'test' },
  )

  // Test passes if no exception is thrown
  // In a real test, we'd verify the embedder was called with 'Hello world'
  // and the client was called with the resulting vector
})

Deno.test('Mnemo - storeFromText validates inputs', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  // Should reject empty ID
  await assertRejects(
    () => mnemo.storeFromText('', 'test text'),
    QdrantValidationError,
    'Record ID is required and cannot be empty',
  )

  // Should reject empty text
  await assertRejects(
    () => mnemo.storeFromText('test-id', ''),
    EmbedderValidationError,
    'Text content is required and cannot be empty',
  )
})

Deno.test('Mnemo - searchFromText method', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder([0.5, 0.6, 0.7])
  const mnemo = new Mnemo(client, embedder)

  const results = await mnemo.searchFromText({
    text: 'search query',
    topK: 5,
    filter: { category: 'test' },
  })

  assertEquals(Array.isArray(results), true)
  assertEquals(results.length, 1)
  assertEquals(results[0].id, 'test-result')
  assertEquals(results[0].score, 0.95)
})

Deno.test('Mnemo - search method delegates to QdrantClient', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  const query: SearchQuery = {
    vector: [1, 2, 3],
    topK: 3,
  }

  const results = await mnemo.search(query)
  assertEquals(Array.isArray(results), true)
})

Deno.test('Mnemo - delete method', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  await mnemo.delete('test-id')
  // Test passes if no exception is thrown

  // Should reject empty ID
  await assertRejects(
    () => mnemo.delete(''),
    QdrantValidationError,
    'Memory ID is required and cannot be empty',
  )
})

Deno.test('Mnemo - upsertBatch method', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  const records: VectorRecord[] = [
    { id: 'record1', vector: [1, 2, 3], payload: {} },
    { id: 'record2', vector: [4, 5, 6], payload: {} },
  ]

  await mnemo.upsertBatch(records)
  // Test passes if no exception is thrown

  // Should reject empty array
  await assertRejects(
    () => mnemo.upsertBatch([]),
    QdrantValidationError,
    'Records array cannot be empty',
  )
})

Deno.test('Mnemo - collectionExists method', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  const exists = await mnemo.collectionExists('existing-collection')
  assertEquals(exists, true)

  const notExists = await mnemo.collectionExists('non-existing-collection')
  assertEquals(notExists, false)
})

Deno.test('Mnemo - getDefaultCollection method', () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()

  // Default collection
  const mnemo1 = new Mnemo(client, embedder)
  assertEquals(mnemo1.getDefaultCollection(), 'default')

  // Custom collection
  const mnemo2 = new Mnemo(client, embedder, { defaultCollection: 'custom' })
  assertEquals(mnemo2.getDefaultCollection(), 'custom')
})

Deno.test('Mnemo - getConfig method returns immutable copy', () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { maxBatchSize: 25 })

  const config1 = mnemo.getConfig()
  const config2 = mnemo.getConfig()

  // Should be different objects
  assertEquals(config1 !== config2, true)
  // But with same values
  assertEquals(config1.maxBatchSize, config2.maxBatchSize)
})

Deno.test('Mnemo - getInfo method', () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333', apiKey: 'test' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { defaultCollection: 'test-collection' })

  const info = mnemo.getInfo()
  assertEquals(info.defaultCollection, 'test-collection')
  assertEquals(typeof info.qdrantInfo, 'object')
  assertEquals(typeof info.embedderInfo, 'object')
  assertEquals(typeof info.config, 'object')
})

Deno.test('Mnemo - factory function', () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()

  const mnemo = createMnemo(client, embedder, { defaultCollection: 'factory-test' })
  assertInstanceOf(mnemo, Mnemo)
  assertEquals(mnemo.getDefaultCollection(), 'factory-test')
})

Deno.test('Mnemo - batch size handling in upsertBatch', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { maxBatchSize: 2 })

  // Create records that exceed batch size
  const records: VectorRecord[] = [
    { id: 'record1', vector: [1, 2, 3], payload: {} },
    { id: 'record2', vector: [4, 5, 6], payload: {} },
    { id: 'record3', vector: [7, 8, 9], payload: {} },
  ]

  // Should handle batching internally
  await mnemo.upsertBatch(records)
  // Test passes if no exception is thrown
})

Deno.test('Mnemo - count with default collection', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { defaultCollection: 'test-collection' })

  const result = await mnemo.count()
  assertEquals(result.count, 42)
})

Deno.test('Mnemo - count with specific collection parameter', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  const result = await mnemo.count(undefined, 'custom-collection')
  assertEquals(result.count, 100)
})

Deno.test('Mnemo - count with filter parameters', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { defaultCollection: 'test-collection' })

  const params = {
    filter: { match: { key: 'category', value: 'research' } },
    exact: true
  }

  const result = await mnemo.count(params)
  assertEquals(result.count, 15)
})

Deno.test('Mnemo - count delegates to client.countPoints method', async () => {
  let capturedCollectionName = ''
  let capturedParams: any = null

  // Mock client that captures method calls
  const mockClient = {
    async countPoints(collectionName: string, params?: any) {
      capturedCollectionName = collectionName
      capturedParams = params
      return { count: 25 }
    }
  }

  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(mockClient as any, embedder, { defaultCollection: 'delegation-test' })

  const testParams = {
    filter: { match: { key: 'type', value: 'article' } },
    exact: false
  }

  const result = await mnemo.count(testParams, 'specific-collection')

  assertEquals(result.count, 25)
  assertEquals(capturedCollectionName, 'specific-collection')
  assertEquals(capturedParams, testParams)
})

Deno.test('Mnemo - count uses default collection when none specified', async () => {
  let capturedCollectionName = ''

  const mockClient = {
    async countPoints(collectionName: string, params?: any) {
      capturedCollectionName = collectionName
      return { count: 30 }
    }
  }

  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(mockClient as any, embedder, { defaultCollection: 'default-test' })

  const result = await mnemo.count()

  assertEquals(result.count, 30)
  assertEquals(capturedCollectionName, 'default-test')
})

Deno.test('Mnemo - count error propagation from client layer', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder)

  // Test error propagation
  await assertRejects(
    () => mnemo.count(undefined, 'error-collection'),
    QdrantValidationError,
    'Test error from client',
  )
})

Deno.test('Mnemo - count with complex filter', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { defaultCollection: 'test-collection' })

  const complexParams = {
    filter: {
      must: [
        { match: { key: 'category', value: 'research' } },
        { range: { key: 'score', gte: 0.8 } }
      ]
    },
    exact: true
  }

  // The mock client will return 15 for any filter with match.key === 'category'
  const result = await mnemo.count(complexParams)
  assertEquals(result.count, 15)
})

Deno.test('Mnemo - count with empty parameters', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { defaultCollection: 'test-collection' })

  const result = await mnemo.count({})
  assertEquals(result.count, 42)
})

Deno.test('Mnemo - dimension validation when enabled', async () => {
  const client = new MockQdrantClient({ url: 'http://localhost:6333' }) as any
  const embedder = new MockEmbedder()
  const mnemo = new Mnemo(client, embedder, { validateDimensions: true })

  // Should reject invalid vector (non-numeric values)
  const invalidRecord: VectorRecord = {
    id: 'test',
    vector: [1, NaN, 3], // NaN should be rejected
    payload: {},
  }

  await assertRejects(
    () => mnemo.upsert(invalidRecord),
    QdrantValidationError,
    'Record vector must contain only valid numbers',
  )
})