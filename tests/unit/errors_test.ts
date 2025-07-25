/**
 * Unit tests for type definitions and error classes
 * @module tests/types
 */

import { assertEquals, assertInstanceOf } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  QdrantAuthenticationError,
  QdrantConnectionError,
  QdrantError,
  QdrantValidationError,
} from '../../src/client/client.types.ts'
import {
  EmbedderAuthenticationError,
  EmbedderConnectionError,
  EmbedderError,
  EmbedderRateLimitError,
  EmbedderValidationError,
} from '../../src/embedder/embedder.types.ts'

Deno.test('QdrantError - base error class', () => {
  const error = new QdrantError('Test error')
  
  assertEquals(error.message, 'Test error')
  assertEquals(error.name, 'QdrantError')
  assertInstanceOf(error, Error)
  assertInstanceOf(error, QdrantError)
})

Deno.test('QdrantError - with status code', () => {
  const error = new QdrantError('Test error', 404)
  
  assertEquals(error.message, 'Test error')
  assertEquals(error.statusCode, 404)
  assertEquals(error.name, 'QdrantError')
})

Deno.test('QdrantValidationError - inherits from QdrantError', () => {
  const error = new QdrantValidationError('Validation failed')
  
  assertEquals(error.message, 'Validation failed')
  assertEquals(error.name, 'QdrantValidationError')
  assertInstanceOf(error, QdrantError)
  assertInstanceOf(error, QdrantValidationError)
})

Deno.test('QdrantConnectionError - inherits from QdrantError', () => {
  const originalError = new Error('Network failure')
  const error = new QdrantConnectionError('Connection failed', originalError)
  
  assertEquals(error.message, 'Connection failed')
  assertEquals(error.name, 'QdrantConnectionError')
  assertEquals(error.details, originalError)
  assertInstanceOf(error, QdrantError)
  assertInstanceOf(error, QdrantConnectionError)
})

Deno.test('QdrantAuthenticationError - inherits from QdrantError', () => {
  const error = new QdrantAuthenticationError('Auth failed')
  
  assertEquals(error.message, 'Auth failed')
  assertEquals(error.name, 'QdrantAuthenticationError')
  assertInstanceOf(error, QdrantError)
  assertInstanceOf(error, QdrantAuthenticationError)
})

Deno.test('EmbedderError - base embedder error class', () => {
  const error = new EmbedderError('Embedder error', 'test-provider')
  
  assertEquals(error.message, 'Embedder error')
  assertEquals(error.provider, 'test-provider')
  assertEquals(error.name, 'EmbedderError')
  assertInstanceOf(error, Error)
  assertInstanceOf(error, EmbedderError)
})

Deno.test('EmbedderValidationError - inherits from EmbedderError', () => {
  const error = new EmbedderValidationError('Invalid input', 'test-provider')
  
  assertEquals(error.message, 'Invalid input')
  assertEquals(error.provider, 'test-provider')
  assertEquals(error.name, 'EmbedderValidationError')
  assertInstanceOf(error, EmbedderError)
  assertInstanceOf(error, EmbedderValidationError)
})

Deno.test('EmbedderConnectionError - inherits from EmbedderError', () => {
  const originalError = new Error('Network error')
  const error = new EmbedderConnectionError('Connection failed', 'test-provider', originalError)
  
  assertEquals(error.message, 'Connection failed')
  assertEquals(error.provider, 'test-provider')
  assertEquals(error.cause, originalError)
  assertEquals(error.name, 'EmbedderConnectionError')
  assertInstanceOf(error, EmbedderError)
  assertInstanceOf(error, EmbedderConnectionError)
})

Deno.test('EmbedderAuthenticationError - inherits from EmbedderError', () => {
  const error = new EmbedderAuthenticationError('Auth failed', 'test-provider')
  
  assertEquals(error.message, 'Auth failed')
  assertEquals(error.provider, 'test-provider')
  assertEquals(error.name, 'EmbedderAuthenticationError')
  assertInstanceOf(error, EmbedderError)
  assertInstanceOf(error, EmbedderAuthenticationError)
})

Deno.test('EmbedderRateLimitError - inherits from EmbedderError', () => {
  const error = new EmbedderRateLimitError('Rate limited', 'test-provider', 60)
  
  assertEquals(error.message, 'Rate limited')
  assertEquals(error.provider, 'test-provider')
  assertEquals(error.retryAfter, 60)
  assertEquals(error.name, 'EmbedderRateLimitError')
  assertInstanceOf(error, EmbedderError)
  assertInstanceOf(error, EmbedderRateLimitError)
})

Deno.test('EmbedderRateLimitError - without retry after', () => {
  const error = new EmbedderRateLimitError('Rate limited', 'test-provider')
  
  assertEquals(error.message, 'Rate limited')
  assertEquals(error.provider, 'test-provider')
  assertEquals(error.retryAfter, undefined)
  assertEquals(error.name, 'EmbedderRateLimitError')
})

// Test type guards and utility functions
Deno.test('Error inheritance chain works correctly', () => {
  const qdrantError = new QdrantValidationError('test')
  const embedderError = new EmbedderValidationError('test', 'provider')
  
  // Qdrant errors
  assertInstanceOf(qdrantError, Error)
  assertInstanceOf(qdrantError, QdrantError)
  assertInstanceOf(qdrantError, QdrantValidationError)
  
  // Embedder errors  
  assertInstanceOf(embedderError, Error)
  assertInstanceOf(embedderError, EmbedderError)
  assertInstanceOf(embedderError, EmbedderValidationError)
  
  // Cross-hierarchy should not match
  assertEquals(qdrantError instanceof EmbedderError, false)
  assertEquals(embedderError instanceof QdrantError, false)
})