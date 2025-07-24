/**
 * MCP tool for deleting vector memories
 * @module tools.deleteMemory
 */

import type { Mnemo } from '../mnemo.ts'
import type { MnemoToolMetadata } from './registry.ts'

/**
 * Parameters for deleting vector memories
 */
export interface DeleteMemoryParams {
  /** Unique identifier of the memory to delete */
  id: string
  /** Collection name to delete from (optional) */
  collection?: string
}

/**
 * Result from memory deletion operation
 */
export interface DeleteMemoryResult {
  /** Whether the deletion operation was successful */
  success: boolean
  /** ID of the memory that was deleted */
  id: string
  /** Whether the memory was found and deleted */
  found: boolean
  /** Collection where deletion was attempted */
  collection: string
  /** Deletion metadata */
  metadata: {
    timestamp: string
    operation: 'delete'
  }
  /** Error message if deletion failed */
  error?: string
}

/**
 * Validation error for delete parameters
 */
export class DeleteMemoryValidationError extends Error {
  /**
   * Create a new delete memory validation error
   * @param message - Error message describing the validation failure
   * @param field - Optional field name that failed validation
   */
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'DeleteMemoryValidationError'
  }
}

/**
 * MCP tool implementation for deleting vector memories
 *
 * This tool enables autonomous agents to remove stored memories from
 * the vector database using their unique identifiers. It provides
 * safe deletion with validation and error handling.
 *
 * @example
 * ```typescript
 * const tool = new DeleteMemoryTool(mnemo)
 * const result = await tool.execute({
 *   id: 'article:NVDA:2025-01-15',
 *   collection: 'news'
 * })
 * ```
 */
export class DeleteMemoryTool {
  /**
   * Create a new delete memory tool instance
   * @param mnemo - Configured Mnemo instance for vector operations
   */
  constructor(private readonly mnemo: Mnemo) {}

  /**
   * Execute memory deletion operation
   *
   * @param params - Deletion parameters including ID and collection
   * @returns Promise resolving to deletion result and metadata
   * @throws {DeleteMemoryValidationError} When parameters are invalid
   */
  async execute(params: DeleteMemoryParams | null | undefined): Promise<DeleteMemoryResult> {
    try {
      // Handle null/undefined params gracefully for error response
      if (!params) {
        return this.handleError(new DeleteMemoryValidationError('Deletion parameters are required'), params)
      }

      // For malformed input like {}, handle gracefully
      if (typeof params === 'object' && (!('id' in params) || typeof params.id !== 'string')) {
        return this.handleError(
          new DeleteMemoryValidationError('Memory ID is required and must be a string'),
          params as DeleteMemoryParams,
        )
      }

      // Validate input parameters - let validation errors bubble up for proper input
      this.validateParams(params)

      const { id, collection } = params

      // Check if memory exists before deletion (for better feedback)
      const existed = await this.checkIfExists(id, collection)

      // Perform the deletion using Mnemo
      await this.mnemo.delete(id, collection)

      // Build successful response
      const result: DeleteMemoryResult = {
        success: true,
        id,
        found: existed,
        collection: collection || this.mnemo.getDefaultCollection(),
        metadata: {
          timestamp: new Date().toISOString(),
          operation: 'delete',
        },
      }

      return result
    } catch (error) {
      // Let validation errors bubble up, only handle other errors
      if (error instanceof DeleteMemoryValidationError) {
        throw error
      }
      // Handle and wrap other errors
      return this.handleError(error, params)
    }
  }

  /**
   * Validate deletion parameters
   *
   * @param params - Parameters to validate
   * @throws {DeleteMemoryValidationError} When validation fails
   */
  private validateParams(params: DeleteMemoryParams): void {
    if (!params) {
      throw new DeleteMemoryValidationError('Deletion parameters are required')
    }

    if (typeof params.id !== 'string') {
      throw new DeleteMemoryValidationError('Memory ID is required and must be a string', 'id')
    }

    if (!params.id || params.id.trim().length === 0) {
      throw new DeleteMemoryValidationError('Memory ID cannot be empty', 'id')
    }

    if (params.id.length > 512) {
      throw new DeleteMemoryValidationError('Memory ID is too long (max 512 characters)', 'id')
    }

    if (params.collection !== undefined) {
      if (typeof params.collection !== 'string') {
        throw new DeleteMemoryValidationError('Collection name must be a string', 'collection')
      }

      if (params.collection.trim().length === 0) {
        throw new DeleteMemoryValidationError('Collection name cannot be empty', 'collection')
      }
    }
  }

  /**
   * Check if a memory with the given ID exists before deletion
   *
   * @param id - Memory ID to check
   * @param collection - Collection to check in
   * @returns Promise resolving to true if memory was found
   */
  private async checkIfExists(id: string, collection?: string): Promise<boolean> {
    try {
      // Use the getPoints method to check if the point exists
      const results = await this.mnemo.getPoints([id], collection)
      return results.length > 0
    } catch {
      // If getPoints fails (e.g., collection doesn't exist), assume point doesn't exist
      return false
    }
  }

  /**
   * Handle and format errors for consistent response structure
   *
   * @param error - Error that occurred during deletion
   * @param params - Original deletion parameters
   * @returns Error response in standard format
   */
  private handleError(error: unknown, params: DeleteMemoryParams | null | undefined): DeleteMemoryResult {
    let errorMessage = 'Unknown error occurred during deletion'

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    return {
      success: false,
      id: params?.id || '',
      found: false,
      collection: params?.collection || '',
      metadata: {
        timestamp: new Date().toISOString(),
        operation: 'delete',
      },
      error: errorMessage,
    }
  }

  /**
   * Get tool metadata for MCP registration
   *
   * @returns Tool metadata including name, description, and parameters schema
   */
  static getToolMetadata(): MnemoToolMetadata {
    return {
      name: 'deleteMemory',
      description: 'Delete a stored memory by its unique identifier',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier of the memory to delete',
            minLength: 1,
            maxLength: 512,
          },
          collection: {
            type: 'string',
            description: 'Collection name to delete from (optional)',
            minLength: 1,
          },
        },
        required: ['id'],
        additionalProperties: false,
      },
      examples: [
        {
          description: 'Delete a specific article',
          parameters: {
            id: 'article:NVDA:2025-01-15',
          },
        },
        {
          description: 'Delete from specific collection',
          parameters: {
            id: 'analysis:market:volatility:2025-01-15',
            collection: 'market_analysis',
          },
        },
        {
          description: 'Delete a note',
          parameters: {
            id: 'note:reminder:2025-01-15',
          },
        },
      ],
    }
  }
}

/**
 * Factory function to create a deleteMemory tool instance
 *
 * @param mnemo - Configured Mnemo instance
 * @returns DeleteMemoryTool instance
 *
 * @example
 * ```typescript
 * const deleteTool = createDeleteMemoryTool(mnemo)
 * const result = await deleteTool.execute({
 *   id: 'outdated:doc:123'
 * })
 * ```
 */
export function createDeleteMemoryTool(mnemo: Mnemo): DeleteMemoryTool {
  return new DeleteMemoryTool(mnemo)
}

/**
 * MCP-compatible tool executor function
 *
 * @param mnemo - Mnemo instance for performing operations
 * @param params - Deletion parameters from MCP request
 * @returns Promise resolving to deletion response
 */
export async function executeDeleteMemory(
  mnemo: Mnemo,
  params: DeleteMemoryParams,
): Promise<DeleteMemoryResult> {
  const tool = new DeleteMemoryTool(mnemo)
  return await tool.execute(params)
}
