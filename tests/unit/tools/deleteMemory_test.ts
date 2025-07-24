/**
 * @fileoverview Unit tests for DeleteMemoryTool functionality
 *
 * Tests cover:
 * - MCP delete tool functionality
 * - Parameter validation for memory deletion
 * - Deletion execution and confirmation handling
 * - Error handling for invalid deletion parameters
 * - Tool metadata compliance
 * - Registry integration for deletion operations
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  DeleteMemoryTool,
  DeleteMemoryValidationError,
} from '../../../src/tools/deleteMemory.ts'
import { Mnemo } from '../../../src/mnemo.ts'

// Mock Mnemo class for testing
class MockMnemo {
  defaultCollection = 'test'

  async delete(id: string, collection?: string): Promise<void> {
    // Mock deletion
    if (!id) throw new Error('ID required')
  }

  getDefaultCollection(): string {
    return this.defaultCollection
  }
}

const createMockMnemo = () => new MockMnemo() as unknown as Mnemo

// DeleteMemoryTool Tests
Deno.test('DeleteMemoryTool - Basic deletion', async () => {
  const mnemo = createMockMnemo()
  const tool = new DeleteMemoryTool(mnemo)

  const result = await tool.execute({
    id: 'test:doc:1',
  })

  assertEquals(result.success, true)
  assertEquals(result.id, 'test:doc:1')
  assertEquals(result.metadata.operation, 'delete')
})

Deno.test('DeleteMemoryTool - Deletion with collection', async () => {
  const mnemo = createMockMnemo()
  const tool = new DeleteMemoryTool(mnemo)

  const result = await tool.execute({
    id: 'test:doc:2',
    collection: 'documents',
  })

  assertEquals(result.success, true)
  assertEquals(result.collection, 'documents')
})

Deno.test('DeleteMemoryTool - Validation errors', async () => {
  const mnemo = createMockMnemo()
  const tool = new DeleteMemoryTool(mnemo)

  // Empty ID
  await assertRejects(
    () => tool.execute({ id: '' }),
    DeleteMemoryValidationError,
    'Memory ID cannot be empty',
  )

  // Too long ID
  await assertRejects(
    () => tool.execute({ id: 'x'.repeat(600) }),
    DeleteMemoryValidationError,
    'Memory ID is too long',
  )

  // Empty collection name
  await assertRejects(
    () => tool.execute({ id: 'test', collection: '' }),
    DeleteMemoryValidationError,
    'Collection name cannot be empty',
  )
})

Deno.test('DeleteMemoryTool - Tool metadata', () => {
  const metadata = DeleteMemoryTool.getToolMetadata()

  assertEquals(metadata.name, 'deleteMemory')
  assertEquals(typeof metadata.description, 'string')
  assertEquals(metadata.parameters.required.includes('id'), true)
})

Deno.test('DeleteMemoryTool - Error handling with malformed input', async () => {
  const mnemo = createMockMnemo()
  const deleteTool = new DeleteMemoryTool(mnemo)

  // Test tool handles empty object input gracefully
  const deleteResult = await deleteTool.execute({} as never)
  assertEquals(deleteResult.success, false)
  assertEquals(typeof deleteResult.error, 'string')
})

Deno.test('DeleteMemoryTool - Factory function', () => {
  const mnemo = createMockMnemo()
  const deleteTool = new DeleteMemoryTool(mnemo)

  assertEquals(typeof deleteTool.execute, 'function')
})