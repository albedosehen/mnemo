/**
 * Unit tests for OllamaEmbedder class
 * Tests Ollama-specific configuration, API interactions, and provider-specific functionality
 * @module tests/unit/embedder/ollama_test
 */

import { assertEquals, assertInstanceOf, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { OllamaEmbedder } from '../../../src/embedder/ollama.ts'
import {
  EmbedderValidationError,
} from '../../../src/embedder/embedder.types.ts'

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

Deno.test('OllamaEmbedder - implements Embedder interface', () => {
  const embedder = new OllamaEmbedder()

  // Should have required methods
  assertEquals(typeof embedder.embed, 'function')
  assertEquals(typeof embedder.getInfo, 'function')

  // Should implement the interface
  assertInstanceOf(embedder, OllamaEmbedder)
})

Deno.test('OllamaEmbedder - default configuration', () => {
  const embedder = new OllamaEmbedder()
  const info = embedder.getInfo()

  // Should have default values
  assertEquals(info.provider, 'ollama')
  assertEquals(typeof info.model, 'string')
  assertEquals(typeof info.endpoint, 'string')
  assertEquals(info.endpoint.startsWith('http'), true)
})

Deno.test('OllamaEmbedder - custom configuration', () => {
  const customConfig = {
    endpoint: 'http://localhost:11434',
    model: 'custom-model',
    timeout: 60000,
    maxRetries: 5,
    retryDelay: 2000,
  }

  const embedder = new OllamaEmbedder(customConfig)
  const info = embedder.getInfo()

  assertEquals(info.provider, 'ollama')
  assertEquals(info.model, 'custom-model')
  assertEquals(info.endpoint, 'http://localhost:11434')
  assertEquals(info.config.timeout, 60000)
  assertEquals(info.config.maxRetries, 5)
  assertEquals(info.config.retryDelay, 2000)
})

Deno.test('OllamaEmbedder - config validation through constructor', () => {
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

Deno.test('OllamaEmbedder - endpoint URL validation', () => {
  // Should accept valid HTTP URLs
  const embedder1 = new OllamaEmbedder({ endpoint: 'http://localhost:11434' })
  assertInstanceOf(embedder1, OllamaEmbedder)

  // Should accept valid HTTPS URLs
  const embedder2 = new OllamaEmbedder({ endpoint: 'https://api.ollama.com' })
  assertInstanceOf(embedder2, OllamaEmbedder)

  // Should reject invalid URLs
  assertThrows(
    () => new OllamaEmbedder({ endpoint: 'not-a-url' }),
    EmbedderValidationError,
    'Invalid Ollama endpoint URL',
  )

  assertThrows(
    () => new OllamaEmbedder({ endpoint: 'ftp://invalid.com' }),
    EmbedderValidationError,
    'Invalid Ollama endpoint URL',
  )
})

Deno.test('OllamaEmbedder - provider name and model methods', () => {
  const embedder = new OllamaEmbedder({ model: 'test-model' })
  const info = embedder.getInfo()

  // Should return correct provider name
  assertEquals(info.provider, 'ollama')

  // Should return specified model
  assertEquals(info.model, 'test-model')
})

Deno.test('OllamaEmbedder - expected dimensions handling', () => {
  const embedder = new OllamaEmbedder()
  const info = embedder.getInfo()

  // Expected dimensions should be defined (number or null)
  const expectedDims = info.expectedDimensions
  assertEquals(
    typeof expectedDims === 'number' || expectedDims === null,
    true,
    'Expected dimensions should be number or null'
  )
})