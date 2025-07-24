/**
 * @fileoverview Unit tests for StoreMemoryTool functionality
 *
 * Tests cover:
 * - MCP store tool functionality
 * - Parameter validation for memory storage
 * - Storage execution and confirmation handling
 * - Error handling for invalid storage parameters
 * - Tool metadata compliance
 * - Registry integration for storage operations
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  StoreMemoryTool,
  StoreMemoryValidationError,
} from '../../../src/tools/storeMemory.ts'
import { createMockMnemo } from '../../mocks/mnemo.ts'

// StoreMemoryTool Tests
Deno.test('StoreMemoryTool - Basic storage', async () => {
  const mnemo = createMockMnemo()
  const tool = new StoreMemoryTool(mnemo)

  const result = await tool.execute({
    id: 'test:doc:1',
    text: 'This is a test document to store',
    payload: { type: 'test', category: 'example' },
  })

  assertEquals(result.success, true)
  assertEquals(result.id, 'test:doc:1')
  assertEquals(result.vectorDimensions, 768) // Mock embedding size
  assertEquals(result.metadata.textLength, 32) // 'This is a test document to store' is 32 chars
})

Deno.test('StoreMemoryTool - Storage with collection', async () => {
  const mnemo = createMockMnemo()
  const tool = new StoreMemoryTool(mnemo)

  const result = await tool.execute({
    id: 'test:doc:2',
    text: 'Document for specific collection',
    collection: 'documents',
  })

  assertEquals(result.success, true)
  assertEquals(result.collection, 'documents')
})

Deno.test('StoreMemoryTool - Validation errors', async () => {
  const mnemo = createMockMnemo()
  const tool = new StoreMemoryTool(mnemo)

  // Empty ID
  await assertRejects(
    () => tool.execute({ id: '', text: 'test' }),
    StoreMemoryValidationError,
    'Memory ID cannot be empty',
  )

  // Empty text
  await assertRejects(
    () => tool.execute({ id: 'test', text: '' }),
    StoreMemoryValidationError,
    'Text content cannot be empty',
  )

  // Too long ID
  await assertRejects(
    () => tool.execute({ id: 'x'.repeat(600), text: 'test' }),
    StoreMemoryValidationError,
    'Memory ID is too long',
  )

  // Too long text
  await assertRejects(
    () => tool.execute({ id: 'test', text: 'x'.repeat(2000000) }),
    StoreMemoryValidationError,
    'Text content is too long',
  )
})

Deno.test('StoreMemoryTool - Tool metadata', () => {
  const metadata = StoreMemoryTool.getToolMetadata()

  assertEquals(metadata.name, 'storeMemory')
  assertEquals(typeof metadata.description, 'string')
  assertEquals(metadata.parameters.required.includes('id'), true)
  assertEquals(metadata.parameters.required.includes('text'), true)
})

Deno.test('StoreMemoryTool - Error handling with malformed input', async () => {
  const mnemo = createMockMnemo()
  const storeTool = new StoreMemoryTool(mnemo)

  // Test tool handles undefined input gracefully
  const storeResult = await storeTool.execute(undefined as never)
  assertEquals(storeResult.success, false)
  assertEquals(typeof storeResult.error, 'string')
})

Deno.test('StoreMemoryTool - Factory function', () => {
  const mnemo = createMockMnemo()
  const storeTool = new StoreMemoryTool(mnemo)

  assertEquals(typeof storeTool.execute, 'function')
})