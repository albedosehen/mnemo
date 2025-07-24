/**
 * MCP tool for storing text as vector memories
 * @module tools.storeMemory
 */

import type { Mnemo } from '../mnemo.ts'
import type { MnemoToolMetadata } from './registry.ts'

/**
 * Parameters for storing text as vector memory
 */
export interface StoreMemoryParams {
  /** Unique identifier for the memory */
  id: string
  /** Text content to embed and store */
  text: string
  /** Optional metadata to associate with the memory */
  payload?: Record<string, unknown>
  /** Collection name to store in (optional) */
  collection?: string
}

/**
 * Result from memory storage operation
 */
export interface StoreMemoryResult {
  /** Whether the storage operation was successful */
  success: boolean
  /** ID of the stored memory */
  id: string
  /** Number of dimensions in the generated vector */
  vectorDimensions: number
  /** Collection where the memory was stored */
  collection: string
  /** Whether this was an update to existing memory */
  wasUpdate: boolean
  /** Storage metadata */
  metadata: {
    textLength: number
    payloadKeys: string[]
    timestamp: string
  }
  /** Error message if storage failed */
  error?: string
}

/**
 * Validation error for store parameters
 */
export class StoreMemoryValidationError extends Error {
  /**
   * Create a new store memory validation error
   * @param message - Error message describing the validation failure
   * @param field - Optional field name that failed validation
   */
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'StoreMemoryValidationError'
  }
}

/**
 * MCP tool implementation for storing text as vector memories
 *
 * This tool enables autonomous agents to store text content as searchable
 * vector memories. It automatically generates embeddings from text and
 * stores them with associated metadata in the vector database.
 *
 * @example
 * ```typescript
 * const tool = new StoreMemoryTool(mnemo)
 * const result = await tool.execute({
 *   id: 'article:NVDA:2025-01-15',
 *   text: 'NVIDIA reports record quarterly earnings',
 *   payload: {
 *     ticker: 'NVDA',
 *     type: 'earnings',
 *     sentiment: 0.9,
 *     source: 'WSJ'
 *   }
 * })
 * ```
 */
export class StoreMemoryTool {
  /**
   * Create a new store memory tool instance
   * @param mnemo - Configured Mnemo instance for vector operations
   */
  constructor(private readonly mnemo: Mnemo) {}

  /**
   * Execute memory storage operation
   *
   * @param params - Storage parameters including ID, text, and metadata
   * @returns Promise resolving to storage result and metadata
   * @throws {StoreMemoryValidationError} When parameters are invalid
   */
  async execute(params: StoreMemoryParams | null | undefined): Promise<StoreMemoryResult> {
    try {
      // Handle null/undefined params gracefully for error response
      if (!params) {
        return this.handleError(new StoreMemoryValidationError('Storage parameters are required'), params)
      }

      // Validate input parameters - let validation errors bubble up
      this.validateParams(params)

      const { id, text, payload = {}, collection } = params

      // Check if memory already exists (for update detection)
      const wasUpdate = await this.checkIfExists(id, collection)

      // Enhance payload with storage metadata
      const enhancedPayload = this.enhancePayload(text, payload)

      // Store the memory using Mnemo
      await this.mnemo.storeFromText(id, text, collection, enhancedPayload)

      // Generate vector to get dimensions (for response metadata)
      const vector = await this.mnemo.embed(text)

      // Build successful response
      const result: StoreMemoryResult = {
        success: true,
        id,
        vectorDimensions: vector.length,
        collection: collection || this.mnemo.getDefaultCollection(),
        wasUpdate,
        metadata: {
          textLength: text.length,
          payloadKeys: Object.keys(enhancedPayload),
          timestamp: new Date().toISOString(),
        },
      }

      return result
    } catch (error) {
      // Let validation errors bubble up, only handle other errors
      if (error instanceof StoreMemoryValidationError) {
        throw error
      }
      // Handle and wrap other errors
      return this.handleError(error, params)
    }
  }

  /**
   * Validate storage parameters
   *
   * @param params - Parameters to validate
   * @throws {StoreMemoryValidationError} When validation fails
   */
  private validateParams(params: StoreMemoryParams): void {
    if (!params) {
      throw new StoreMemoryValidationError('Storage parameters are required')
    }

    if (typeof params.id !== 'string') {
      throw new StoreMemoryValidationError('Memory ID is required and must be a string', 'id')
    }

    if (!params.id || params.id.trim().length === 0) {
      throw new StoreMemoryValidationError('Memory ID cannot be empty', 'id')
    }

    if (params.id.length > 512) {
      throw new StoreMemoryValidationError('Memory ID is too long (max 512 characters)', 'id')
    }

    if (typeof params.text !== 'string') {
      throw new StoreMemoryValidationError('Text content is required and must be a string', 'text')
    }

    if (!params.text || params.text.trim().length === 0) {
      throw new StoreMemoryValidationError('Text content cannot be empty', 'text')
    }

    if (params.text.length > 1000000) {
      throw new StoreMemoryValidationError('Text content is too long (max 1,000,000 characters)', 'text')
    }

    if (params.collection !== undefined) {
      if (typeof params.collection !== 'string') {
        throw new StoreMemoryValidationError('Collection name must be a string', 'collection')
      }

      if (params.collection.trim().length === 0) {
        throw new StoreMemoryValidationError('Collection name cannot be empty', 'collection')
      }
    }

    if (params.payload !== undefined) {
      if (typeof params.payload !== 'object' || params.payload === null || Array.isArray(params.payload)) {
        throw new StoreMemoryValidationError('Payload must be a valid object', 'payload')
      }

      // Validate payload size
      try {
        const payloadSize = JSON.stringify(params.payload).length
        if (payloadSize > 100000) {
          throw new StoreMemoryValidationError('Payload is too large (max 100KB when serialized)', 'payload')
        }
      } catch {
        throw new StoreMemoryValidationError('Payload contains non-serializable data', 'payload')
      }
    }
  }

  /**
   * Check if a memory with the given ID already exists
   *
   * @param id - Memory ID to check
   * @param collection - Collection to check in
   * @returns Promise resolving to true if memory exists
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
   * Enhance payload with automatic metadata
   *
   * @param text - Original text content
   * @param payload - User-provided payload
   * @returns Enhanced payload with additional metadata
   */
  private enhancePayload(text: string, payload: Record<string, unknown>): Record<string, unknown> {
    const enhanced = { ...payload }

    // Add original text if not already present
    if (!enhanced.text && !enhanced.content) {
      enhanced.text = text
    }

    // Add automatic metadata
    enhanced._stored_at = new Date().toISOString()
    enhanced._text_length = text.length
    enhanced._word_count = this.countWords(text)

    // Add text analysis metadata
    const analysis = this.analyzeText(text)
    enhanced._analysis = analysis

    return enhanced
  }

  /**
   * Count words in text content
   *
   * @param text - Text to analyze
   * @returns Word count
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter((word) => word.length > 0).length
  }

  /**
   * Analyze text content for metadata
   *
   * @param text - Text to analyze
   * @returns Analysis results
   */
  private analyzeText(text: string): Record<string, unknown> {
    const words = text.trim().split(/\s+/)
    const characters = text.length
    const lines = text.split('\n').length
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length

    return {
      word_count: words.length,
      character_count: characters,
      line_count: lines,
      sentence_count: sentences,
      avg_word_length: words.length > 0 ? characters / words.length : 0,
      contains_urls: /https?:\/\//.test(text),
      contains_emails: /@\w+\.\w+/.test(text),
      contains_numbers: /\d/.test(text),
      language_hints: this.detectLanguageHints(text),
    }
  }

  /**
   * Detect language hints from text
   *
   * @param text - Text to analyze
   * @returns Language detection hints
   */
  private detectLanguageHints(text: string): Record<string, unknown> {
    const lower = text.toLowerCase()

    return {
      likely_english: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/.test(lower),
      has_punctuation: /[.,;:!?]/.test(text),
      has_capitalization: /[A-Z]/.test(text),
    }
  }

  /**
   * Handle and format errors for consistent response structure
   *
   * @param error - Error that occurred during storage
   * @param params - Original storage parameters
   * @returns Error response in standard format
   */
  private handleError(error: unknown, params: StoreMemoryParams | null | undefined): StoreMemoryResult {
    let errorMessage = 'Unknown error occurred during storage'

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    return {
      success: false,
      id: params?.id || '',
      vectorDimensions: 0,
      collection: params?.collection || '',
      wasUpdate: false,
      metadata: {
        textLength: params?.text ? params.text.length : 0,
        payloadKeys: params?.payload ? Object.keys(params.payload) : [],
        timestamp: new Date().toISOString(),
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
      name: 'storeMemory',
      description: 'Store text content as a searchable vector memory with metadata',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the memory (e.g., "article:NVDA:2025-01-15")',
            minLength: 1,
            maxLength: 512,
          },
          text: {
            type: 'string',
            description: 'Text content to embed and store as a memory',
            minLength: 1,
            maxLength: 1000000,
          },
          payload: {
            type: 'object',
            description: 'Optional metadata to associate with the memory',
            additionalProperties: true,
          },
          collection: {
            type: 'string',
            description: 'Collection name to store the memory in (optional)',
            minLength: 1,
          },
        },
        required: ['id', 'text'],
        additionalProperties: false,
      },
      examples: [
        {
          description: 'Store a news article with metadata',
          parameters: {
            id: 'article:NVDA:2025-01-15',
            text: 'NVIDIA reports record quarterly earnings, beating analyst expectations by 15%',
            payload: {
              ticker: 'NVDA',
              type: 'earnings',
              sentiment: 0.9,
              source: 'WSJ',
              date: '2025-01-15',
            },
          },
        },
        {
          description: 'Store market analysis',
          parameters: {
            id: 'analysis:market:volatility:2025-01-15',
            text: 'Current market conditions show increased volatility due to geopolitical tensions',
            payload: {
              type: 'analysis',
              category: 'market',
              analyst: 'AI_System',
            },
            collection: 'market_analysis',
          },
        },
        {
          description: 'Store simple note',
          parameters: {
            id: 'note:reminder:2025-01-15',
            text: 'Remember to review portfolio allocation next week',
          },
        },
      ],
    }
  }
}

/**
 * Factory function to create a storeMemory tool instance
 *
 * @param mnemo - Configured Mnemo instance
 * @returns StoreMemoryTool instance
 *
 * @example
 * ```typescript
 * const storeTool = createStoreMemoryTool(mnemo)
 * const result = await storeTool.execute({
 *   id: 'doc:123',
 *   text: 'Important document content',
 *   payload: { category: 'research' }
 * })
 * ```
 */
export function createStoreMemoryTool(mnemo: Mnemo): StoreMemoryTool {
  return new StoreMemoryTool(mnemo)
}

/**
 * MCP-compatible tool executor function
 *
 * @param mnemo - Mnemo instance for performing operations
 * @param params - Storage parameters from MCP request
 * @returns Promise resolving to storage response
 */
export async function executeStoreMemory(
  mnemo: Mnemo,
  params: StoreMemoryParams,
): Promise<StoreMemoryResult> {
  const tool = new StoreMemoryTool(mnemo)
  return await tool.execute(params)
}
