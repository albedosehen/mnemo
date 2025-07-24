/**
 * Unit tests for BaseEmbedder abstract class
 * Tests core embedder functionality including validation, retry logic, and error handling
 * @module tests/unit/embedder/embedder_test
 */

import { assertEquals, assertInstanceOf, assertRejects, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { OllamaEmbedder } from '../../../src/embedder/ollama.ts'
import { OpenAIEmbedder } from '../../../src/embedder/openai.ts'
import {
  EmbedderError,
  EmbedderValidationError,
} from '../../../src/embedder/embedder.types.ts'
import type { Embedder } from '../../../src/embedder/embedder.types.ts'
import { MockEmbedder, FailingMockEmbedder, InvalidOutputMockEmbedder } from '../../mocks/embedder.ts'

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
  const embedder = new FailingMockEmbedder(2, [1, 2, 3])

  // Should retry and eventually succeed
  const result = await embedder.embed('test')
  assertEquals(result, [1, 2, 3])
  assertEquals(embedder.getCallCount(), 3) // Failed twice, succeeded on third try
})

Deno.test('BaseEmbedder - getInfo returns correct structure', () => {
  const embedder = new MockEmbedder()
  const info = embedder.getInfo()

  assertEquals(info.provider, 'mock')
  assertEquals(info.model, 'mock-model')
  assertEquals(typeof info.config, 'object')
  assertEquals(typeof info.config.timeout, 'number')
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
  const embedder = new InvalidOutputMockEmbedder()

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