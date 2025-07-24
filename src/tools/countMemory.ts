/**
 * MCP tool for counting vector memories
 * @module tools.countMemory
 */

import type { Mnemo } from '../mnemo.ts'
import type { CountParams, CountResult } from '../client/filters.types.ts'

/**
 * Parameters for counting vector memories
 */
export interface CountMemoryParams {
  /** Metadata filters to apply for counting */
  filter?: Record<string, unknown>
  /** Collection name to count in (optional) */
  collection?: string
  /** Whether to return exact count vs approximate */
  exact?: boolean
}

/**
 * Result from memory count operation
 */
export interface CountMemoryResult {
  /** Whether the count operation was successful */
  success: boolean
  /** Number of memories matching the filter */
  count: number
  /** Collection where counting was performed */
  collection: string
  /** Count operation metadata */
  metadata: {
    timestamp: string
    operation: 'count'
    hasFilter: boolean
    exact: boolean
  }
  /** Error message if count failed */
  error?: string
}

/**
 * Validation error for count parameters
 */
export class CountMemoryValidationError extends Error {
  /**
   * Create a new count memory validation error
   * @param message - Error message describing the validation failure
   * @param field - Optional field name that failed validation
   */
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'CountMemoryValidationError'
  }
}

/**
 * MCP tool implementation for counting vector memories
 *
 * This tool enables autonomous agents to count stored memories with optional
 * filtering. It provides insights into data scale, helps validate operations,
 * and supports resource management decisions.
 *
 * @example
 * ```typescript
 * const tool = new CountMemoryTool(mnemo)
 * const result = await tool.execute({
 *   filter: { ticker: 'NVDA', type: 'earnings' },
 *   exact: true
 * })
 * console.log(`Found ${result.count} NVDA earnings memories`)
 * ```
 */
export class CountMemoryTool {
  /**
   * Create a new count memory tool instance
   * @param mnemo - Configured Mnemo instance for vector operations
   */
  constructor(private readonly mnemo: Mnemo) {}

  /**
   * Execute memory count operation
   *
   * @param params - Count parameters including filters and options
   * @returns Promise resolving to count result and metadata
   * @throws {CountMemoryValidationError} When parameters are invalid
   */
  async execute(params: CountMemoryParams | null | undefined): Promise<CountMemoryResult> {
    try {
      // Handle null/undefined params gracefully
      if (params === null || params === undefined) {
        params = {} // Empty params means count all
      }

      // Validate input parameters
      this.validateParams(params)

      const { filter, collection, exact = false } = params

      // Build count parameters for Mnemo
      const countParams: CountParams = {
        filter: filter ? (filter as unknown as CountParams['filter']) : undefined,
        exact,
      }

      // Perform the count using Mnemo
      const countResult: CountResult = await this.mnemo.count(countParams, collection)

      // Build successful response
      const result: CountMemoryResult = {
        success: true,
        count: countResult.count,
        collection: collection || this.mnemo.getDefaultCollection(),
        metadata: {
          timestamp: new Date().toISOString(),
          operation: 'count',
          hasFilter: Boolean(filter && Object.keys(filter).length > 0),
          exact,
        },
      }

      return result
    } catch (error) {
      // Let validation errors bubble up, only handle other errors
      if (error instanceof CountMemoryValidationError) {
        throw error
      }
      // Handle and wrap other errors
      return this.handleError(error, params)
    }
  }

  /**
   * Validate count parameters
   *
   * @param params - Parameters to validate
   * @throws {CountMemoryValidationError} When validation fails
   */
  private validateParams(params: CountMemoryParams): void {
    if (typeof params !== 'object' || params === null) {
      throw new CountMemoryValidationError('Count parameters must be an object')
    }

    if (params.collection !== undefined) {
      if (typeof params.collection !== 'string') {
        throw new CountMemoryValidationError('Collection name must be a string', 'collection')
      }

      if (params.collection.trim().length === 0) {
        throw new CountMemoryValidationError('Collection name cannot be empty', 'collection')
      }
    }

    if (params.filter !== undefined) {
      if (typeof params.filter !== 'object' || params.filter === null || Array.isArray(params.filter)) {
        throw new CountMemoryValidationError('Filter must be a valid object', 'filter')
      }
    }

    if (params.exact !== undefined) {
      if (typeof params.exact !== 'boolean') {
        throw new CountMemoryValidationError('Exact parameter must be a boolean', 'exact')
      }
    }
  }

  /**
   * Handle and format errors for consistent response structure
   *
   * @param error - Error that occurred during count
   * @param params - Original count parameters
   * @returns Error response in standard format
   */
  private handleError(error: unknown, params: CountMemoryParams | null | undefined): CountMemoryResult {
    let errorMessage = 'Unknown error occurred during count operation'

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    return {
      success: false,
      count: 0,
      collection: params?.collection || '',
      metadata: {
        timestamp: new Date().toISOString(),
        operation: 'count',
        hasFilter: Boolean(params?.filter && Object.keys(params.filter).length > 0),
        exact: params?.exact || false,
      },
      error: errorMessage,
    }
  }

  /**
   * Get tool metadata for MCP registration
   *
   * @returns Tool metadata including name, description, and parameters schema
   */
  static getToolMetadata(): {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, unknown>
      required: string[]
      additionalProperties: boolean
    }
    examples: Array<{
      description: string
      parameters: Record<string, unknown>
    }>
  } {
    return {
      name: 'countMemory',
      description: 'Count the number of stored memories with optional filtering',
      parameters: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: 'Metadata filters to apply when counting memories',
            additionalProperties: true,
          },
          collection: {
            type: 'string',
            description: 'Collection name to count memories in (optional)',
            minLength: 1,
          },
          exact: {
            type: 'boolean',
            description: 'Whether to return exact count vs approximate (default: false)',
            default: false,
          },
        },
        required: [],
        additionalProperties: false,
      },
      examples: [
        {
          description: 'Count all memories in default collection',
          parameters: {},
        },
        {
          description: 'Count memories with filter',
          parameters: {
            filter: {
              ticker: 'NVDA',
              type: 'earnings',
            },
            exact: true,
          },
        },
        {
          description: 'Count memories in specific collection',
          parameters: {
            collection: 'news_articles',
            filter: {
              sentiment: 'positive',
            },
          },
        },
        {
          description: 'Count with range filter',
          parameters: {
            filter: {
              score: { gte: 0.8 },
              date: '2025-01-15',
            },
            exact: false,
          },
        },
      ],
    }
  }
}

/**
 * Factory function to create a countMemory tool instance
 *
 * @param mnemo - Configured Mnemo instance
 * @returns CountMemoryTool instance
 *
 * @example
 * ```typescript
 * const countTool = createCountMemoryTool(mnemo)
 * const result = await countTool.execute({
 *   filter: { category: 'research' },
 *   exact: true
 * })
 * ```
 */
export function createCountMemoryTool(mnemo: Mnemo): CountMemoryTool {
  return new CountMemoryTool(mnemo)
}

/**
 * MCP-compatible tool executor function
 *
 * @param mnemo - Mnemo instance for performing operations
 * @param params - Count parameters from MCP request
 * @returns Promise resolving to count response
 */
export async function executeCountMemory(
  mnemo: Mnemo,
  params: CountMemoryParams,
): Promise<CountMemoryResult> {
  const tool = new CountMemoryTool(mnemo)
  return await tool.execute(params)
}
