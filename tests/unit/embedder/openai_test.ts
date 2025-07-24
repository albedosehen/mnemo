/**
 * Unit tests for OpenAIEmbedder class
 * Tests OpenAI-specific configuration, API interactions, cost estimation, and provider-specific functionality
 * @module tests/unit/embedder/openai_test
 */

import { assertEquals, assertInstanceOf, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { OpenAIEmbedder } from '../../../src/embedder/openai.ts'
import {
  EmbedderValidationError,
} from '../../../src/embedder/embedder.types.ts'

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

Deno.test('OpenAIEmbedder - implements Embedder interface', () => {
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

    // Should have required methods
    assertEquals(typeof embedder.embed, 'function')
    assertEquals(typeof embedder.getInfo, 'function')
    assertEquals(typeof embedder.estimateCost, 'function')

    // Should implement the interface
    assertInstanceOf(embedder, OpenAIEmbedder)
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('OpenAIEmbedder - environment variable handling', () => {
  // Mock Deno.env.get to test environment variable scenarios
  const originalEnvGet = Deno.env.get

  try {
    // Test with API key from environment
    Deno.env.get = (key: string) => {
      if (key === 'OPENAI_API_KEY') return 'env-api-key'
      if (key === 'OPENAI_ORG_ID') return 'env-org-id'
      if (key === 'OPENAI_PROJECT_ID') return 'env-project-id'
      return undefined
    }

    const embedder = new OpenAIEmbedder()
    assertInstanceOf(embedder, OpenAIEmbedder)

    // Test with no environment variables
    Deno.env.get = (key: string) => {
      if (key === 'OPENAI_API_KEY') return undefined
      if (key === 'OPENAI_ORG_ID') return undefined
      if (key === 'OPENAI_PROJECT_ID') return undefined
      return undefined
    }

    // Should require API key when not in environment
    assertThrows(
      () => new OpenAIEmbedder({}),
      EmbedderValidationError,
      'OpenAI API key is required',
    )
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('OpenAIEmbedder - custom configuration', () => {
  // Mock Deno.env.get to avoid permission issues
  const originalEnvGet = Deno.env.get
  Deno.env.get = (key: string) => {
    if (key === 'OPENAI_API_KEY') return undefined
    if (key === 'OPENAI_ORG_ID') return undefined
    if (key === 'OPENAI_PROJECT_ID') return undefined
    return undefined
  }

  try {
    const customConfig = {
      apiKey: 'custom-api-key',
      model: 'text-embedding-ada-002',
      organizationId: 'custom-org',
      projectId: 'custom-project',
      timeout: 60000,
      maxRetries: 5,
      retryDelay: 2000,
    }

    const embedder = new OpenAIEmbedder(customConfig)
    const info = embedder.getInfo()

    assertEquals(info.provider, 'openai')
    assertEquals(info.model, 'text-embedding-ada-002')
    assertEquals(info.config.timeout, 60000)
    assertEquals(info.config.maxRetries, 5)
    assertEquals(info.config.retryDelay, 2000)
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('OpenAIEmbedder - default configuration', () => {
  // Mock Deno.env.get to provide API key
  const originalEnvGet = Deno.env.get
  Deno.env.get = (key: string) => {
    if (key === 'OPENAI_API_KEY') return 'test-api-key'
    if (key === 'OPENAI_ORG_ID') return undefined
    if (key === 'OPENAI_PROJECT_ID') return undefined
    return undefined
  }

  try {
    const embedder = new OpenAIEmbedder()
    const info = embedder.getInfo()

    // Should have default values
    assertEquals(info.provider, 'openai')
    assertEquals(typeof info.model, 'string')
    assertEquals(typeof info.baseURL, 'string')
    assertEquals(info.baseURL.startsWith('https://'), true)
  } finally {
    Deno.env.get = originalEnvGet
  }
})

Deno.test('OpenAIEmbedder - cost estimation edge cases', () => {
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

    // Should handle zero-length text
    const cost1 = embedder.estimateCost(0)
    if (cost1 !== null) {
      assertEquals(cost1, 0)
    }

    // Should handle negative values gracefully
    const cost2 = embedder.estimateCost(-1)
    if (cost2 !== null) {
      assertEquals(cost2 >= 0, true)
    }
  } finally {
    Deno.env.get = originalEnvGet
  }
})