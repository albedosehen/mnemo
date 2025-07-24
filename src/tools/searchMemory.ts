/**
 * MCP tool for semantic memory search
 * @module tools.searchMemory
 */

import type { Mnemo } from '../mnemo.ts'
import type { SearchResult } from '../client/client.types.ts'
import type { MnemoToolMetadata } from './registry.ts'

/**
 * Parameters for searching memory with semantic similarity
 */
export interface SearchMemoryParams {
  /** Search text to find similar memories */
  query: string
  /** Maximum number of results to return (default: 5) */
  topK?: number
  /** Metadata filters for payload data */
  filter?: Record<string, unknown>
  /** Collection name to search in (optional) */
  collection?: string
}

/**
 * Result from memory search operation
 */
export interface SearchMemoryResult {
  /** Unique identifier of the matched memory */
  id: string
  /** Similarity score (higher = more similar) */
  score: number
  /** Metadata payload of the matched memory */
  payload: Record<string, unknown>
  /** Original text if stored in payload */
  text?: string
}

/**
 * Response from searchMemory tool
 */
export interface SearchMemoryResponse {
  /** Whether the search was successful */
  success: boolean
  /** Array of search results */
  results: SearchMemoryResult[]
  /** Total number of results found */
  totalResults: number
  /** Search parameters used */
  searchParams: {
    query: string
    topK: number
    collection: string
    hasFilter: boolean
  }
  /** Error message if search failed */
  error?: string
}

/**
 * Validation error for search parameters
 */
export class SearchMemoryValidationError extends Error {
  /**
   * Create a new search memory validation error
   * @param message - Error message describing the validation failure
   * @param field - Optional field name that failed validation
   */
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'SearchMemoryValidationError'
  }
}

/**
 * MCP tool implementation for semantic memory search
 *
 * This tool enables autonomous agents to search for semantically similar
 * memories using natural language queries. It leverages the embedding
 * system to convert text queries to vectors and performs similarity search
 * against the vector database.
 *
 * @example
 * ```typescript
 * const tool = new SearchMemoryTool(mnemo)
 * const result = await tool.execute({
 *   query: 'NVIDIA earnings report',
 *   topK: 5,
 *   filter: { ticker: 'NVDA', type: 'earnings' }
 * })
 * ```
 */
export class SearchMemoryTool {
  /**
   * Create a new search memory tool instance
   * @param mnemo - Configured Mnemo instance for vector operations
   */
  constructor(private readonly mnemo: Mnemo) {}

  /**
   * Execute semantic memory search
   *
   * @param params - Search parameters including query text and filters
   * @returns Promise resolving to search results and metadata
   * @throws {SearchMemoryValidationError} When parameters are invalid
   */
  async execute(params: SearchMemoryParams | null | undefined): Promise<SearchMemoryResponse> {
    try {
      // Handle null/undefined params gracefully for error response
      if (!params) {
        return this.handleError(new SearchMemoryValidationError('Search parameters are required'), params)
      }

      // Validate input parameters - let validation errors bubble up
      this.validateParams(params)

      const { query, topK = 5, filter, collection } = params

      // Perform the search using Mnemo
      const searchResults: SearchResult[] = await this.mnemo.searchFromText({
        text: query,
        topK,
        filter,
        collection,
      })

      // Transform results to tool format
      const results: SearchMemoryResult[] = searchResults.map((result) => ({
        id: result.id,
        score: result.score,
        payload: result.payload,
        text: this.extractTextFromPayload(result.payload),
      }))

      // Build successful response
      const response: SearchMemoryResponse = {
        success: true,
        results,
        totalResults: results.length,
        searchParams: {
          query,
          topK,
          collection: collection || this.mnemo.getDefaultCollection(),
          hasFilter: Boolean(filter && Object.keys(filter).length > 0),
        },
      }

      return response
    } catch (error) {
      // Let validation errors bubble up, only handle other errors
      if (error instanceof SearchMemoryValidationError) {
        throw error
      }
      // Handle and wrap other errors
      return this.handleError(error, params)
    }
  }

  /**
   * Validate search parameters
   *
   * @param params - Parameters to validate
   * @throws {SearchMemoryValidationError} When validation fails
   */
  private validateParams(params: SearchMemoryParams): void {
    if (!params) {
      throw new SearchMemoryValidationError('Search parameters are required')
    }

    if (typeof params.query !== 'string') {
      throw new SearchMemoryValidationError('Query text is required and must be a string', 'query')
    }

    if (!params.query || params.query.trim().length === 0) {
      throw new SearchMemoryValidationError('Query text cannot be empty', 'query')
    }

    if (params.query.length > 10000) {
      throw new SearchMemoryValidationError('Query text is too long (max 10,000 characters)', 'query')
    }

    if (params.topK !== undefined) {
      if (typeof params.topK !== 'number' || !Number.isInteger(params.topK)) {
        throw new SearchMemoryValidationError('topK must be an integer', 'topK')
      }

      if (params.topK < 1) {
        throw new SearchMemoryValidationError('topK must be at least 1', 'topK')
      }

      if (params.topK > 1000) {
        throw new SearchMemoryValidationError('topK cannot exceed 1000', 'topK')
      }
    }

    if (params.collection !== undefined) {
      if (typeof params.collection !== 'string') {
        throw new SearchMemoryValidationError('Collection name must be a string', 'collection')
      }

      if (params.collection.trim().length === 0) {
        throw new SearchMemoryValidationError('Collection name cannot be empty', 'collection')
      }
    }

    if (params.filter !== undefined) {
      if (typeof params.filter !== 'object' || params.filter === null || Array.isArray(params.filter)) {
        throw new SearchMemoryValidationError('Filter must be a valid object', 'filter')
      }
    }
  }

  /**
   * Extract text content from payload data
   *
   * @param payload - Payload object to search for text
   * @returns Extracted text or undefined
   */
  private extractTextFromPayload(payload: Record<string, unknown>): string | undefined {
    // Common field names that might contain the original text
    const textFields = ['text', 'content', 'body', 'description', 'message', 'title']

    for (const field of textFields) {
      const value = payload[field]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim()
      }
    }

    return undefined
  }

  /**
   * Handle and format errors for consistent response structure
   *
   * @param error - Error that occurred during search
   * @param params - Original search parameters
   * @returns Error response in standard format
   */
  private handleError(error: unknown, params: SearchMemoryParams | null | undefined): SearchMemoryResponse {
    let errorMessage = 'Unknown error occurred during search'

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    return {
      success: false,
      results: [],
      totalResults: 0,
      searchParams: {
        query: params?.query || '',
        topK: params?.topK || 5,
        collection: params?.collection || '',
        hasFilter: Boolean(params?.filter && Object.keys(params.filter).length > 0),
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
      name: 'searchMemory',
      description: 'Search for semantically similar memories using natural language queries',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query to find similar memories',
            minLength: 1,
            maxLength: 10000,
          },
          topK: {
            type: 'integer',
            description: 'Maximum number of results to return',
            minimum: 1,
            maximum: 1000,
            default: 5,
          },
          filter: {
            type: 'object',
            description: 'Metadata filters to apply to the search results',
            additionalProperties: true,
          },
          collection: {
            type: 'string',
            description: 'Collection name to search in (optional)',
            minLength: 1,
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
      examples: [
        {
          description: 'Basic semantic search',
          parameters: {
            query: 'artificial intelligence breakthrough',
            topK: 5,
          },
        },
        {
          description: 'Filtered search for specific stock',
          parameters: {
            query: 'earnings report revenue growth',
            topK: 10,
            filter: {
              ticker: 'NVDA',
              type: 'earnings',
            },
          },
        },
        {
          description: 'Search in specific collection',
          parameters: {
            query: 'market volatility analysis',
            topK: 3,
            collection: 'financial_analysis',
          },
        },
      ],
    }
  }
}

/**
 * Factory function to create a searchMemory tool instance
 *
 * @param mnemo - Configured Mnemo instance
 * @returns SearchMemoryTool instance
 *
 * @example
 * ```typescript
 * const searchTool = createSearchMemoryTool(mnemo)
 * const results = await searchTool.execute({
 *   query: 'machine learning advances',
 *   topK: 10
 * })
 * ```
 */
export function createSearchMemoryTool(mnemo: Mnemo): SearchMemoryTool {
  return new SearchMemoryTool(mnemo)
}

/**
 * MCP-compatible tool executor function
 *
 * @param mnemo - Mnemo instance for performing operations
 * @param params - Search parameters from MCP request
 * @returns Promise resolving to search response
 */
export async function executeSearchMemory(
  mnemo: Mnemo,
  params: SearchMemoryParams,
): Promise<SearchMemoryResponse> {
  const tool = new SearchMemoryTool(mnemo)
  return await tool.execute(params)
}
