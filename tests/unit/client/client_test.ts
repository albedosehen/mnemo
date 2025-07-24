/**
 * Unit tests for QdrantClient implementation
 * @module tests/unit/client/client
 */

import { assertEquals, assertInstanceOf, assertRejects, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { QdrantClient } from '../../../src/client/client.ts'
import {
  QdrantError,
  QdrantValidationError,
  QdrantConnectionError,
  type VectorRecord,
  type SearchQuery
} from '../../../src/client/client.types.ts'
import { createMockFetch } from '../../mocks/client.ts'

Deno.test('QdrantClient - constructor validation', () => {
  // Should reject missing URL
  assertThrows(
    () => new QdrantClient({} as any),
    QdrantValidationError,
    'Qdrant URL is required',
  )

  // Should reject invalid URL
  assertThrows(
    () => new QdrantClient({ url: 'invalid-url' }),
    QdrantValidationError,
    'Invalid Qdrant URL',
  )

  // Should reject invalid timeout
  assertThrows(
    () => new QdrantClient({ url: 'http://localhost:6333', timeout: -1 }),
    QdrantValidationError,
    'Timeout must be greater than 0',
  )

  // Should work with valid config
  const client = new QdrantClient({ url: 'http://localhost:6333' })
  assertInstanceOf(client, QdrantClient)
})

Deno.test('QdrantClient - configuration management', () => {
  const client = new QdrantClient({
    url: 'http://localhost:6333',
    apiKey: 'test-key',
    timeout: 5000,
  })

  const config = client.getConfig()
  assertEquals(config.url, 'http://localhost:6333')
  assertEquals(config.apiKey, 'test-key')
  assertEquals(config.timeout, 5000)

  const info = client.getInfo()
  assertEquals(info.url, 'http://localhost:6333')
  assertEquals(info.hasApiKey, true)
  assertEquals(info.timeout, 5000)
})

Deno.test('QdrantClient - URL normalization', () => {
  // Should remove trailing slash
  const client = new QdrantClient({ url: 'http://localhost:6333/' })
  const config = client.getConfig()
  assertEquals(config.url, 'http://localhost:6333')
})

Deno.test('QdrantClient - headers configuration', () => {
  const clientWithoutApiKey = new QdrantClient({ url: 'http://localhost:6333' })
  const configWithoutApiKey = clientWithoutApiKey.getConfig()
  assertEquals(configWithoutApiKey.apiKey, '')

  const clientWithApiKey = new QdrantClient({
    url: 'http://localhost:6333',
    apiKey: 'test-key',
  })
  const configWithApiKey = clientWithApiKey.getConfig()
  assertEquals(configWithApiKey.apiKey, 'test-key')
})


Deno.test('QdrantClient - input validation', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  // Collection name validation
  await assertRejects(
    () => client.getCollection(''),
    QdrantValidationError,
    'Collection name is required',
  )

  await assertRejects(
    () => client.createCollection('', { size: 768, distance: 'Cosine' }),
    QdrantValidationError,
    'Collection name is required',
  )

  // Vector size validation
  await assertRejects(
    () => client.createCollection('test', { size: 0, distance: 'Cosine' }),
    QdrantValidationError,
    'Vector size must be a positive number',
  )

  // Records validation
  await assertRejects(
    () => client.upsertBatch('test', []),
    QdrantValidationError,
    'Records array cannot be empty',
  )

  // Point IDs validation
  await assertRejects(
    () => client.deletePoints('test', []),
    QdrantValidationError,
    'Point IDs array cannot be empty',
  )
})

Deno.test('QdrantClient - record validation', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const invalidRecords: VectorRecord[] = [
    { id: '', vector: [1, 2, 3], payload: {} }, // Empty ID
    { id: 'valid', vector: [], payload: {} }, // Empty vector
    { id: 'valid', vector: [1, 2, 3], payload: {} }, // Valid record
  ]

  await assertRejects(
    () => client.upsertBatch('test', invalidRecords),
    QdrantValidationError,
    'Record ID is required',
  )
})

Deno.test('QdrantClient - search query validation', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const invalidQuery: SearchQuery = {
    vector: [], // Empty vector
    topK: 5,
  }

  await assertRejects(
    () => client.search('test', invalidQuery),
    QdrantValidationError,
    'Query vector is required and must be a non-empty array',
  )
})

Deno.test('QdrantClient - error extraction', () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  // Access private method for testing
  const extractErrorMessage = (client as any).extractErrorMessage.bind(client)

  // Should extract error from different formats
  assertEquals(extractErrorMessage({ error: 'test error' }), 'test error')
  assertEquals(extractErrorMessage({ message: 'test message' }), 'test message')
  assertEquals(extractErrorMessage({ detail: 'test detail' }), 'test detail')
  assertEquals(extractErrorMessage({ status: { error: 'nested error' } }), 'nested error')
  assertEquals(extractErrorMessage('not an object'), null)
  assertEquals(extractErrorMessage(null), null)
})

// Mock fetch for count operations
Deno.test('QdrantClient - countPoints success', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const mockCount = { count: 42 }
  const originalFetch = globalThis.fetch
  globalThis.fetch = createMockFetch({
    ok: true,
    status: 200,
    data: { result: mockCount }
  }) as typeof fetch

  try {
    const result = await client.countPoints('test-collection')
    assertEquals(result.count, 42)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - countPoints with filter parameters', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const mockCount = { count: 15 }
  let capturedUrl = ''
  let capturedBody = ''

  const originalFetch = globalThis.fetch
  globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    capturedUrl = String(input)
    capturedBody = init?.body as string

    // Handle abort signal to prevent timer leaks
    if (init?.signal) {
      const signal = init.signal as AbortSignal
      if (signal.aborted) {
        return Promise.reject(new DOMException('Operation was aborted', 'AbortError'))
      }

      // Return response immediately to simulate successful completion
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: mockCount }),
        headers: new Headers(),
      } as Response)
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: mockCount }),
      headers: new Headers(),
    } as Response)
  }) as typeof fetch

  try {
    const params = {
      filter: { match: { key: 'category', value: 'research' } },
      exact: true
    }

    const result = await client.countPoints('test-collection', params)

    assertEquals(result.count, 15)
    assertEquals(capturedUrl, 'http://localhost:6333/collections/test-collection/points/count')

    const requestBody = JSON.parse(capturedBody)
    assertEquals(requestBody.filter.match.key, 'category')
    assertEquals(requestBody.filter.match.value, 'research')
    assertEquals(requestBody.exact, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - countPoints without parameters', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const mockCount = { count: 100 }
  let capturedBody = ''

  const originalFetch = globalThis.fetch
  globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    capturedBody = init?.body as string

    // Handle abort signal to prevent timer leaks
    if (init?.signal) {
      const signal = init.signal as AbortSignal
      if (signal.aborted) {
        return Promise.reject(new DOMException('Operation was aborted', 'AbortError'))
      }

      // Return response immediately to simulate successful completion
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: mockCount }),
        headers: new Headers(),
      } as Response)
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: mockCount }),
      headers: new Headers(),
    } as Response)
  }) as typeof fetch

  try {
    const result = await client.countPoints('test-collection')

    assertEquals(result.count, 100)
    // Should send empty object when no parameters provided
    const requestBody = JSON.parse(capturedBody)
    assertEquals(Object.keys(requestBody).length, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - countPoints collection name validation', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  // Should reject empty collection name
  await assertRejects(
    () => client.countPoints(''),
    QdrantValidationError,
    'Collection name is required',
  )
})

Deno.test('QdrantClient - countPoints with exact parameter', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const mockCount = { count: 25 }
  let capturedBody = ''

  const originalFetch = globalThis.fetch
  globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    capturedBody = init?.body as string

    // Handle abort signal to prevent timer leaks
    if (init?.signal) {
      const signal = init.signal as AbortSignal
      if (signal.aborted) {
        return Promise.reject(new DOMException('Operation was aborted', 'AbortError'))
      }
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: mockCount }),
      headers: new Headers(),
    } as Response)
  }) as typeof fetch

  try {
    const result = await client.countPoints('test-collection', { exact: true })

    assertEquals(result.count, 25)
    const requestBody = JSON.parse(capturedBody)
    assertEquals(requestBody.exact, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - countPoints handles 404 error', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const originalFetch = globalThis.fetch
  globalThis.fetch = createMockFetch({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    data: { error: 'Collection not found' }
  }) as typeof fetch

  try {
    await assertRejects(
      () => client.countPoints('non-existing-collection'),
      QdrantError,
      'Not found: Collection not found',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - countPoints handles validation error', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const originalFetch = globalThis.fetch
  globalThis.fetch = createMockFetch({
    ok: false,
    status: 422,
    statusText: 'Unprocessable Entity',
    data: { detail: 'Invalid filter format' }
  }) as typeof fetch

  try {
    await assertRejects(
      () => client.countPoints('test-collection', { filter: {} as any }),
      QdrantValidationError,
      'Validation error: Invalid filter format',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - countPoints handles server error', async () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })

  const originalFetch = globalThis.fetch
  globalThis.fetch = createMockFetch({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    data: { error: 'Database connection failed' }
  }) as typeof fetch

  try {
    await assertRejects(
      () => client.countPoints('test-collection'),
      QdrantConnectionError,
      'Server error: Database connection failed',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test('QdrantClient - default configuration values', () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })
  const config = client.getConfig()

  assertEquals(config.timeout, 30000) // Default timeout
  assertEquals(config.apiKey, '') // Default empty API key
})

Deno.test('QdrantClient - immutable configuration', () => {
  const client = new QdrantClient({ url: 'http://localhost:6333' })
  const config1 = client.getConfig()
  const config2 = client.getConfig()

  // Should return different objects (not the same reference)
  assertEquals(config1 !== config2, true)
  // But with the same values
  assertEquals(config1.url, config2.url)
  assertEquals(config1.timeout, config2.timeout)
})

Deno.test('QdrantClient - info vs config differences', () => {
  const client = new QdrantClient({
    url: 'http://localhost:6333',
    apiKey: 'secret-key',
    timeout: 5000,
  })

  const config = client.getConfig()
  const info = client.getInfo()

  // Config should contain the actual API key
  assertEquals(config.apiKey, 'secret-key')

  // Info should only indicate if API key is present
  assertEquals(info.hasApiKey, true)
  assertEquals('apiKey' in info, false) // Should not expose the actual key
})

// Note: Integration tests with actual network calls would require a running Qdrant instance
// These tests focus on validation, configuration, and error handling logic