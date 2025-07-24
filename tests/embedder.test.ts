/**
 * Unit tests for embedder implementations
 * @module tests/embedder
 */

import { assertEquals, assertInstanceOf, assertRejects, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { BaseEmbedder } from '../src/embedder/embedder.ts'
import { OllamaEmbedder } from '../src/embedder/ollama.ts'
import { OpenAIEmbedder } from '../src/embedder/openai.ts'
import {
  EmbedderError,
  EmbedderValidationError,
  EmbedderConnectionError,
} from '../src/embedder/embedder.types.ts'
import type { Embedder } from '../src/embedder/embedder.types.ts'

// Mock embedder for testing base functionality
class MockEmbedder extends BaseEmbedder {
  constructor(mockResponse?: number[]) {
    super()
    this.mockResponse = mockResponse || [0.1, 0.2, 0.3]
  }

  private mockResponse: number[]

  protected getDefaultModel(): string {
    return 'mock-model'
  }

  protected getProviderName(): string {
    return 'mock'
  }

  protected async performEmbed(_text: string): Promise<number[]> {
    if (_text === 'error') {
      throw new Error('Mock error')
    }
    return this.mockResponse
  }
}

Deno.test('BaseEmbedder - embed validates input', async () => {
  const embedder = new MockEmbedder()

  // Should reject empty strings
  await assertRejects(
    () => embedder.embed(''),
    EmbedderValidationError,
    'Input text cannot be empty',
  )

  // Should reject whitespace-only strings
  await assertRejects(
    () => embedder.embed('   '),
    EmbedderValidationError,
    'Input text cannot be empty',
  )

  // Should work with valid text
  const result = await embedder.embed('hello world')
  assertEquals(result, [0.1, 0.2, 0.3])
})

Deno.test('BaseEmbedder - implements Embedder interface', () => {
  const embedder = new MockEmbedder()
  
  // Should have required methods
  assertEquals(typeof embedder.embed, 'function')
  
  // Should implement the interface
  assertInstanceOf(embedder, MockEmbedder)
})

Deno.test('BaseEmbedder - retry logic works', async () => {
  let callCount = 0
  
  class FailingEmbedder extends BaseEmbedder {
    protected getDefaultModel(): string {
      return 'failing-model'
    }

    protected getProviderName(): string {
      return 'failing'
    }

    protected async performEmbed(_text: string): Promise<number[]> {
      callCount++
      if (callCount <= 2) {
        throw new Error('Temporary failure')
      }
      return [1, 2, 3]
    }
  }

  const embedder = new FailingEmbedder()
  
  // Should retry and eventually succeed
  const result = await embedder.embed('test')
  assertEquals(result, [1, 2, 3])
  assertEquals(callCount, 3) // Failed twice, succeeded on third try
})

Deno.test('BaseEmbedder - getInfo returns correct structure', () => {
  const embedder = new MockEmbedder()
  const info = embedder.getInfo()

  assertEquals(info.provider, 'mock')
  assertEquals(info.model, 'mock-model')
  assertEquals(typeof info.config, 'object')
  assertEquals(typeof info.config.timeout, 'number')
})

Deno.test('OllamaEmbedder - constructor validation', () => {
  // Should work with default config
  const embedder1 = new OllamaEmbedder()
  assertInstanceOf(embedder1, OllamaEmbedder)

  // Should work with custom config
  const embedder2 = new OllamaEmbedder({
    endpoint: 'http://custom:11434',
    model: 'custom-model',
  })
  assertInstanceOf(embedder2, OllamaEmbedder)

  // Should reject invalid endpoint URLs
  assertThrows(
    () => new OllamaEmbedder({ endpoint: 'invalid-url' }),
    EmbedderValidationError,
    'Invalid Ollama endpoint URL',
  )
})

Deno.test('OllamaEmbedder - getInfo returns provider information', () => {
  const embedder = new OllamaEmbedder({
    model: 'test-model',
    endpoint: 'http://test:11434',
  })

  const info = embedder.getInfo()
  assertEquals(info.provider, 'ollama')
  assertEquals(info.model, 'test-model')
  assertEquals(info.endpoint, 'http://test:11434')
  assertEquals(typeof info.expectedDimensions, 'object') // can be number or null
  assertEquals(typeof info.config, 'object')
})

Deno.test('OpenAIEmbedder - constructor validation', () => {
  // Mock Deno.env.get to avoid permission issues
  const originalEnvGet = Deno.env.get
  Deno.env.get = (key: string) => {
    if (key === 'OPENAI_API_KEY') return undefined
    if (key === 'OPENAI_ORG_ID') return undefined
    if (key === 'OPENAI_PROJECT_ID') return undefined
    return undefined
  }

  try {
    // Should reject missing API key
    assertThrows(
      () => new OpenAIEmbedder({}),
      EmbedderValidationError,
      'OpenAI API key is required',
    )

    // Should work with API key
    const embedder = new OpenAIEmbedder({ apiKey: 'test-key' })
    assertInstanceOf(embedder, OpenAIEmbedder)

    // Should work with environment variable
    Deno.env.get = (key: string) => {
      if (key === 'OPENAI_API_KEY') return 'env-key'
      if (key === 'OPENAI_ORG_ID') return undefined
      if (key === 'OPENAI_PROJECT_ID') return undefined
      return undefined
    }
    const embedder2 = new OpenAIEmbedder()
    assertInstanceOf(embedder2, OpenAIEmbedder)
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('OpenAIEmbedder - getInfo returns provider information', () => {
  // Mock Deno.env.get to avoid permission issues
  const originalEnvGet = Deno.env.get
  Deno.env.get = (key: string) => {
    if (key === 'OPENAI_API_KEY') return undefined
    if (key === 'OPENAI_ORG_ID') return undefined
    if (key === 'OPENAI_PROJECT_ID') return undefined
    return undefined
  }

  try {
    const embedder = new OpenAIEmbedder({
      apiKey: 'test-key',
      model: 'text-embedding-3-small',
    })

    const info = embedder.getInfo()
    assertEquals(info.provider, 'openai')
    assertEquals(info.model, 'text-embedding-3-small')
    assertEquals(typeof info.baseURL, 'string')
    assertEquals(typeof info.config, 'object')
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('OpenAIEmbedder - estimateCost calculates correctly', () => {
  // Mock Deno.env.get to avoid permission issues
  const originalEnvGet = Deno.env.get
  Deno.env.get = (key: string) => {
    if (key === 'OPENAI_API_KEY') return undefined
    if (key === 'OPENAI_ORG_ID') return undefined
    if (key === 'OPENAI_PROJECT_ID') return undefined
    return undefined
  }

  try {
    const embedder = new OpenAIEmbedder({ apiKey: 'test-key' })

    // Should calculate cost for text length
    const cost = embedder.estimateCost('hello world'.length)
    if (cost !== null) {
      assertEquals(typeof cost, 'number')
      assertEquals(cost >= 0, true)
    }
  } finally {
    Deno.env.get = originalEnvGet
  }
})

// Integration tests would require actual API endpoints, so we test the interface compliance
Deno.test('All embedders implement the Embedder interface', () => {
  // Mock Deno.env.get to avoid permission issues
  const originalEnvGet = Deno.env.get
  Deno.env.get = (key: string) => {
    if (key === 'OPENAI_API_KEY') return undefined
    if (key === 'OPENAI_ORG_ID') return undefined
    if (key === 'OPENAI_PROJECT_ID') return undefined
    return undefined
  }

  try {
    const mockEmbedder: Embedder = new MockEmbedder()
    const ollamaEmbedder: Embedder = new OllamaEmbedder()
    const openaiEmbedder: Embedder = new OpenAIEmbedder({ apiKey: 'test' })

    // All should have embed method
    assertEquals(typeof mockEmbedder.embed, 'function')
    assertEquals(typeof ollamaEmbedder.embed, 'function')
    assertEquals(typeof openaiEmbedder.embed, 'function')
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('Embedder error handling', async () => {
  const errorEmbedder = new MockEmbedder()

  // Should handle performEmbed errors properly
  await assertRejects(
    () => errorEmbedder.embed('error'),
    Error,
    'embed failed after 4 attempts',
  )
})

Deno.test('BaseEmbedder - validateInput utility', async () => {
  const embedder = new MockEmbedder()

  // Should reject non-string input
  await assertRejects(
    () => embedder.embed(null as any),
    EmbedderValidationError,
    'Input must be a string',
  )

  await assertRejects(
    () => embedder.embed(undefined as any),
    EmbedderValidationError,
    'Input must be a string',
  )

  // Should reject empty strings
  await assertRejects(
    () => embedder.embed(''),
    EmbedderValidationError,
    'Input text cannot be empty',
  )

  await assertRejects(
    () => embedder.embed('   '),
    EmbedderValidationError,
    'Input text cannot be empty',
  )

  // Should accept valid strings
  const result = await embedder.embed('hello')
  assertEquals(result, [0.1, 0.2, 0.3])
})

Deno.test('BaseEmbedder - output validation', async () => {
  class InvalidOutputEmbedder extends BaseEmbedder {
    protected getDefaultModel(): string {
      return 'invalid-model'
    }

    protected getProviderName(): string {
      return 'invalid'
    }

    protected async performEmbed(text: string): Promise<number[]> {
      if (text === 'empty') return []
      if (text === 'non-array') return 'not an array' as any
      if (text === 'invalid-numbers') return [1, 'not a number', 3] as any
      return [1, 2, 3]
    }
  }

  const embedder = new InvalidOutputEmbedder()

  // Should reject empty arrays
  await assertRejects(
    () => embedder.embed('empty'),
    EmbedderError,
    'Embedding result cannot be empty',
  )

  // Should reject non-arrays
  await assertRejects(
    () => embedder.embed('non-array'),
    EmbedderError,
    'Embedding result must be an array',
  )

  // Should reject invalid numbers
  await assertRejects(
    () => embedder.embed('invalid-numbers'),
    EmbedderError,
    'Embedding result must contain only valid numbers',
  )

  // Should accept valid arrays
  const result = await embedder.embed('valid')
  assertEquals(result, [1, 2, 3])
})

Deno.test('BaseEmbedder - config validation', () => {
  // Test validation through actual embedder constructors that call validateConfig

  // Should reject invalid timeout
  assertThrows(
    () => new OllamaEmbedder({ timeout: -1 }),
    EmbedderValidationError,
    'Timeout must be greater than 0',
  )

  // Should reject invalid max retries
  assertThrows(
    () => new OllamaEmbedder({ maxRetries: -1 }),
    EmbedderValidationError,
    'Max retries must be non-negative',
  )

  // Should reject invalid retry delay
  assertThrows(
    () => new OllamaEmbedder({ retryDelay: -1 }),
    EmbedderValidationError,
    'Retry delay must be non-negative',
  )
})