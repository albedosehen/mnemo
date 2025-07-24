/**
 * @fileoverview Unit tests for SearchMemoryTool functionality
 *
 * Tests cover:
 * - MCP search tool functionality
 * - Parameter validation for search queries and filters
 * - Search execution and result handling
 * - Error handling for invalid search parameters
 * - Tool metadata compliance
 * - Registry integration for search operations
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  SearchMemoryTool,
  SearchMemoryValidationError,
} from '../../../src/tools/searchMemory.ts'
import { createMockMnemo } from '../../mocks/mnemo.ts'

// SearchMemoryTool Tests
Deno.test('SearchMemoryTool - Basic search', async () => {
  const mnemo = createMockMnemo()
  const tool = new SearchMemoryTool(mnemo)

  const result = await tool.execute({
    query: 'test search query',
    topK: 3,
  })

  assertEquals(result.success, true)
  assertEquals(result.results.length, 2) // Mock returns 2 results
  assertEquals(result.searchParams.query, 'test search query')
  assertEquals(result.searchParams.topK, 3)
})

Deno.test('SearchMemoryTool - Search with filter', async () => {
  const mnemo = createMockMnemo()
  const tool = new SearchMemoryTool(mnemo)

  const result = await tool.execute({
    query: 'filtered search',
    topK: 5,
    filter: { type: 'news' },
  })

  assertEquals(result.success, true)
  assertEquals(result.searchParams.hasFilter, true)
})

Deno.test('SearchMemoryTool - Validation errors', async () => {
  const mnemo = createMockMnemo()
  const tool = new SearchMemoryTool(mnemo)

  // Empty query
  await assertRejects(
    () => tool.execute({ query: '' }),
    SearchMemoryValidationError,
    'Query text cannot be empty',
  )

  // Invalid topK
  await assertRejects(
    () => tool.execute({ query: 'test', topK: 0 }),
    SearchMemoryValidationError,
    'topK must be at least 1',
  )

  // Too large topK
  await assertRejects(
    () => tool.execute({ query: 'test', topK: 2000 }),
    SearchMemoryValidationError,
    'topK cannot exceed 1000',
  )

  // Too long query
  await assertRejects(
    () => tool.execute({ query: 'x'.repeat(20000) }),
    SearchMemoryValidationError,
    'Query text is too long',
  )
})

Deno.test('SearchMemoryTool - Tool metadata', () => {
  const metadata = SearchMemoryTool.getToolMetadata()

  assertEquals(metadata.name, 'searchMemory')
  assertEquals(typeof metadata.description, 'string')
  assertEquals(metadata.parameters.type, 'object')
  assertEquals(Array.isArray(metadata.parameters.required), true)
  assertEquals(metadata.parameters.required.includes('query'), true)
})

Deno.test('SearchMemoryTool - Error handling with malformed input', async () => {
  const mnemo = createMockMnemo()
  const searchTool = new SearchMemoryTool(mnemo)

  // Test tool handles null/undefined input gracefully
  const searchResult = await searchTool.execute(null as never)
  assertEquals(searchResult.success, false)
  assertEquals(typeof searchResult.error, 'string')
})

Deno.test('SearchMemoryTool - Parameter validation edge cases', async () => {
  const mnemo = createMockMnemo()
  const searchTool = new SearchMemoryTool(mnemo)

  // Test various invalid input types
  await assertRejects(
    () => searchTool.execute({ query: 123 as never }),
    SearchMemoryValidationError,
    'Query text is required and must be a string',
  )

  await assertRejects(
    () => searchTool.execute({ query: 'test', topK: 'invalid' as never }),
    SearchMemoryValidationError,
    'topK must be an integer',
  )

  await assertRejects(
    () => searchTool.execute({ query: 'test', filter: 'invalid' as never }),
    SearchMemoryValidationError,
    'Filter must be a valid object',
  )

  await assertRejects(
    () => searchTool.execute({ query: 'test', collection: 123 as never }),
    SearchMemoryValidationError,
    'Collection name must be a string',
  )
})

Deno.test('SearchMemoryTool - Factory function', () => {
  const mnemo = createMockMnemo()
  const searchTool = new SearchMemoryTool(mnemo)

  assertEquals(typeof searchTool.execute, 'function')
})