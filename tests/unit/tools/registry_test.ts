/**
 * @fileoverview Unit tests for MnemoToolRegistry functionality
 * 
 * Tests cover:
 * - Tool registry functionality
 * - Tool registration and unregistration
 * - Registry metadata and statistics
 * - Tool execution through registry
 * - Error handling for registry operations
 * - Tool validation and metadata compliance
 */

import { assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  CountMemoryTool,
  SearchMemoryTool,
  StoreMemoryTool,
  DeleteMemoryTool,
  MnemoToolRegistry,
  createMnemoToolRegistry,
  CountMemoryValidationError,
  ToolRegistrationError,
} from '../../../src/tools/mod.ts'
import { Mnemo } from '../../../src/mnemo.ts'

// Mock Mnemo class for testing
class MockMnemo {
  defaultCollection = 'test'

  async embed(text: string): Promise<number[]> {
    // Return a mock embedding based on text length
    return new Array(768).fill(0).map((_, i) => Math.sin(i * text.length))
  }

  async searchFromText(options: {
    text: string
    topK?: number
    filter?: Record<string, unknown>
    collection?: string
  }) {
    // Mock search results
    return [
      {
        id: 'test:1',
        score: 0.95,
        payload: { text: 'Mock search result', type: 'test' },
        vector: undefined,
      },
      {
        id: 'test:2',
        score: 0.87,
        payload: { text: 'Another mock result', type: 'test' },
        vector: undefined,
      },
    ].slice(0, options.topK || 5)
  }

  async storeFromText(
    id: string,
    text: string,
    collection?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    // Mock storage - just validate inputs
    if (!id) throw new Error('ID required')
    if (!text) throw new Error('Text required')
  }

  async delete(id: string, collection?: string): Promise<void> {
    // Mock deletion
    if (!id) throw new Error('ID required')
  }

  async count(params?: {
    filter?: unknown
    exact?: boolean
  }, collection?: string) {
    // Mock count - return different values based on filter
    const hasFilter = params?.filter && Object.keys(params.filter as Record<string, unknown>).length > 0
    return {
      count: hasFilter ? 42 : 100, // Different counts for filtered vs unfiltered
    }
  }

  getDefaultCollection(): string {
    return this.defaultCollection
  }

  async search(query: {
    vector: number[]
    topK?: number
    filter?: Record<string, unknown>
  }, collection?: string) {
    return []
  }
}

const createMockMnemo = () => new MockMnemo() as unknown as Mnemo

// CountMemoryTool Tests
Deno.test('CountMemoryTool - Basic count', async () => {
  const mnemo = createMockMnemo()
  const tool = new CountMemoryTool(mnemo)

  const result = await tool.execute({})

  assertEquals(result.success, true)
  assertEquals(result.count, 100) // Mock returns 100 for unfiltered count
  assertEquals(result.metadata.operation, 'count')
  assertEquals(result.metadata.hasFilter, false)
  assertEquals(result.metadata.exact, false)
})

Deno.test('CountMemoryTool - Count with filter', async () => {
  const mnemo = createMockMnemo()
  const tool = new CountMemoryTool(mnemo)

  const result = await tool.execute({
    filter: { type: 'news', sentiment: 'positive' },
    exact: true,
  })

  assertEquals(result.success, true)
  assertEquals(result.count, 42) // Mock returns 42 for filtered count
  assertEquals(result.metadata.hasFilter, true)
  assertEquals(result.metadata.exact, true)
})

Deno.test('CountMemoryTool - Count with collection', async () => {
  const mnemo = createMockMnemo()
  const tool = new CountMemoryTool(mnemo)

  const result = await tool.execute({
    collection: 'articles',
    filter: { category: 'tech' },
  })

  assertEquals(result.success, true)
  assertEquals(result.collection, 'articles')
  assertEquals(result.metadata.hasFilter, true)
})

Deno.test('CountMemoryTool - Count with null/undefined params', async () => {
  const mnemo = createMockMnemo()
  const tool = new CountMemoryTool(mnemo)

  // Test null params
  const nullResult = await tool.execute(null)
  assertEquals(nullResult.success, true)
  assertEquals(nullResult.count, 100)

  // Test undefined params
  const undefinedResult = await tool.execute(undefined)
  assertEquals(undefinedResult.success, true)
  assertEquals(undefinedResult.count, 100)
})

Deno.test('CountMemoryTool - Validation errors', async () => {
  const mnemo = createMockMnemo()
  const tool = new CountMemoryTool(mnemo)

  // Invalid collection type
  await assertRejects(
    () => tool.execute({ collection: 123 as never }),
    CountMemoryValidationError,
    'Collection name must be a string',
  )

  // Empty collection name
  await assertRejects(
    () => tool.execute({ collection: '' }),
    CountMemoryValidationError,
    'Collection name cannot be empty',
  )

  // Invalid filter type
  await assertRejects(
    () => tool.execute({ filter: 'invalid' as never }),
    CountMemoryValidationError,
    'Filter must be a valid object',
  )

  // Invalid exact type
  await assertRejects(
    () => tool.execute({ exact: 'true' as never }),
    CountMemoryValidationError,
    'Exact parameter must be a boolean',
  )
})

Deno.test('CountMemoryTool - Tool metadata', () => {
  const metadata = CountMemoryTool.getToolMetadata()

  assertEquals(metadata.name, 'countMemory')
  assertEquals(typeof metadata.description, 'string')
  assertEquals(metadata.parameters.type, 'object')
  assertEquals(Array.isArray(metadata.parameters.required), true)
  assertEquals(metadata.parameters.required.length, 0) // No required parameters
  assertEquals(Array.isArray(metadata.examples), true)
  assertEquals(metadata.examples!.length > 0, true)
})

// MnemoToolRegistry Tests
Deno.test('MnemoToolRegistry - Basic registration', () => {
  const mnemo = createMockMnemo()
  const registry = new MnemoToolRegistry(mnemo)

  // Register default tools
  registry.registerDefaultTools()

  const stats = registry.getStats()
  assertEquals(stats.totalTools, 4)
  assertEquals(stats.hasDefaultTools, true)
  assertEquals(stats.toolNames.sort(), ['countMemory', 'deleteMemory', 'searchMemory', 'storeMemory'])
})

Deno.test('MnemoToolRegistry - Tool execution', async () => {
  const mnemo = createMockMnemo()
  const registry = createMnemoToolRegistry(mnemo)

  // Execute search tool
  const searchResult = await registry.execute('searchMemory', {
    query: 'test search',
    topK: 3,
  })

  assertEquals(typeof searchResult, 'object')
  assertEquals('success' in searchResult, true)
})

Deno.test('MnemoToolRegistry - Tool metadata retrieval', () => {
  const mnemo = createMockMnemo()
  const registry = createMnemoToolRegistry(mnemo)

  const searchMetadata = registry.getToolMetadata('searchMemory')
  assertEquals(searchMetadata?.name, 'searchMemory')

  const allMetadata = registry.getAllToolsMetadata()
  assertEquals(allMetadata.length, 4)
})

Deno.test('MnemoToolRegistry - Error handling', async () => {
  const mnemo = createMockMnemo()
  const registry = new MnemoToolRegistry(mnemo)

  // Tool not found
  await assertRejects(
    () => registry.execute('nonexistent', { query: 'test' } as never),
    ToolRegistrationError,
    'Tool \'nonexistent\' is not registered',
  )
})

Deno.test('MnemoToolRegistry - Duplicate registration prevention', () => {
  const mnemo = createMockMnemo()
  const registry = new MnemoToolRegistry(mnemo)

  const toolDef = {
    metadata: SearchMemoryTool.getToolMetadata(),
    executor: async () => ({ success: true }),
  }

  // First registration should work
  registry.register(toolDef)

  // Second registration should fail
  assertThrows(
    () => registry.register(toolDef),
    ToolRegistrationError,
    'Tool \'searchMemory\' is already registered',
  )
})

Deno.test('MnemoToolRegistry - Allow overwrite option', () => {
  const mnemo = createMockMnemo()
  const registry = new MnemoToolRegistry(mnemo, { allowOverwrite: true })

  const toolDef = {
    metadata: SearchMemoryTool.getToolMetadata(),
    executor: async () => ({ success: true }),
  }

  // First registration
  registry.register(toolDef)

  // Second registration should work with allowOverwrite
  registry.register(toolDef)

  assertEquals(registry.isRegistered('searchMemory'), true)
})

Deno.test('MnemoToolRegistry - Tool unregistration', () => {
  const mnemo = createMockMnemo()
  const registry = createMnemoToolRegistry(mnemo)

  assertEquals(registry.isRegistered('searchMemory'), true)

  const removed = registry.unregister('searchMemory')
  assertEquals(removed, true)
  assertEquals(registry.isRegistered('searchMemory'), false)

  const notRemoved = registry.unregister('nonexistent')
  assertEquals(notRemoved, false)
})

Deno.test('MnemoToolRegistry - Clear all tools', () => {
  const mnemo = createMockMnemo()
  const registry = createMnemoToolRegistry(mnemo)

  assertEquals(registry.getStats().totalTools, 4)

  registry.clear()
  assertEquals(registry.getStats().totalTools, 0)
})

Deno.test('MnemoToolRegistry - Metadata validation', () => {
  const mnemo = createMockMnemo()
  const registry = new MnemoToolRegistry(mnemo, { validateMetadata: true })

  // Invalid metadata - missing name
  assertThrows(
    () => registry.register({
      metadata: {
        description: 'test',
        parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      } as never,
      executor: async () => ({}),
    }),
    ToolRegistrationError,
    'Tool metadata must have a valid name',
  )

  // Invalid metadata - wrong parameters type
  assertThrows(
    () => registry.register({
      metadata: {
        name: 'test',
        description: 'test',
        parameters: { type: 'string', properties: {}, required: [], additionalProperties: false },
      } as never,
      executor: async () => ({}),
    }),
    ToolRegistrationError,
    'Tool parameters must be of type "object"',
  )
})

Deno.test('Tool factory functions', () => {
  const mnemo = createMockMnemo()

  // Test factory functions exist and work
  const countTool = new CountMemoryTool(mnemo)
  assertEquals(typeof countTool.execute, 'function')

  const searchTool = new SearchMemoryTool(mnemo)
  assertEquals(typeof searchTool.execute, 'function')

  const storeTool = new StoreMemoryTool(mnemo)
  assertEquals(typeof storeTool.execute, 'function')

  const deleteTool = new DeleteMemoryTool(mnemo)
  assertEquals(typeof deleteTool.execute, 'function')
})