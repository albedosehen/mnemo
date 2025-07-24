/**
 * MCP tool registry and validation system
 * @module tools.registry
 */

import type { Mnemo } from '../mnemo.ts'
import { type CountMemoryParams, type CountMemoryResult, CountMemoryTool, executeCountMemory } from './countMemory.ts'
import {
  type DeleteMemoryParams,
  type DeleteMemoryResult,
  DeleteMemoryTool,
  executeDeleteMemory,
} from './deleteMemory.ts'
import {
  executeSearchMemory,
  type SearchMemoryParams,
  type SearchMemoryResponse,
  SearchMemoryTool,
} from './searchMemory.ts'
import { executeStoreMemory, type StoreMemoryParams, type StoreMemoryResult, StoreMemoryTool } from './storeMemory.ts'

/**
 * Generic tool execution parameters
 */
export type MnemoToolParams = CountMemoryParams | SearchMemoryParams | StoreMemoryParams | DeleteMemoryParams

/**
 * Generic tool execution results
 */
export type MnemoToolResult = CountMemoryResult | SearchMemoryResponse | StoreMemoryResult | DeleteMemoryResult

/**
 * Tool executor function signature
 */
export type MnemoToolExecutor = (
  mnemo: Mnemo,
  params: unknown,
) => Promise<unknown>

/**
 * Tool metadata for MCP registration
 */
export interface MnemoToolMetadata {
  /** Tool name identifier */
  name: string
  /** Human-readable description */
  description: string
  /** JSON schema for parameters */
  parameters: {
    type: string
    properties: Record<string, unknown>
    required: string[]
    additionalProperties: boolean
  }
  /** Usage examples */
  examples?: Array<{
    description: string
    parameters: Record<string, unknown>
  }>
}

/**
 * Complete tool definition
 */
export interface MnemoToolDefinition {
  /** Tool metadata */
  metadata: MnemoToolMetadata
  /** Execution function */
  executor: MnemoToolExecutor
  /** Tool instance class */
  toolClass?: new (mnemo: Mnemo) => MnemoTool
}

/**
 * Base interface for tool implementations
 */
export interface MnemoTool {
  /** Execute the tool with given parameters */
  execute(params: unknown): Promise<unknown>
}

/**
 * Options for tool registration
 */
export interface ToolRegistrationOptions {
  /** Whether to validate tool metadata on registration */
  validateMetadata?: boolean
  /** Whether to allow overwriting existing tools */
  allowOverwrite?: boolean
  /** Custom validation functions */
  customValidators?: Array<(tool: MnemoToolDefinition) => void>
}

/**
 * Error thrown during tool registration
 */
export class ToolRegistrationError extends Error {
  /**
   * Create a new tool registration error
   * @param message - Error message describing the registration failure
   * @param toolName - Optional name of the tool that failed registration
   * @param cause - Optional underlying error that caused the registration failure
   */
  constructor(
    message: string,
    public readonly toolName?: string,
    public override readonly cause?: Error,
  ) {
    super(message)
    this.name = 'ToolRegistrationError'
  }
}

/**
 * Registry for managing MCP-compatible tools
 *
 * This class provides a centralized system for registering, validating,
 * and executing Mnemo tools. It ensures tool compatibility with MCP
 * protocol requirements and provides type-safe execution.
 *
 * @example
 * ```typescript
 * const registry = new MnemoToolRegistry(mnemo)
 *
 * // Register all default tools
 * registry.registerDefaultTools()
 *
 * // Execute a tool
 * const result = await registry.execute('searchMemory', {
 *   query: 'machine learning',
 *   topK: 5
 * })
 * ```
 */
export class MnemoToolRegistry {
  private readonly tools: Map<string, MnemoToolDefinition> = new Map()
  private readonly mnemo: Mnemo
  private readonly options: Required<ToolRegistrationOptions>

  /**
   * Create a new tool registry
   *
   * @param mnemo - Mnemo instance for tool execution
   * @param options - Registration options
   */
  constructor(mnemo: Mnemo, options: ToolRegistrationOptions = {}) {
    this.mnemo = mnemo
    this.options = {
      validateMetadata: options.validateMetadata ?? true,
      allowOverwrite: options.allowOverwrite ?? false,
      customValidators: options.customValidators ?? [],
    }
  }

  /**
   * Register a tool in the registry
   *
   * @param definition - Complete tool definition
   * @throws {ToolRegistrationError} When registration fails
   */
  register(definition: MnemoToolDefinition): void {
    const { name } = definition.metadata

    try {
      // Check for existing tool
      if (this.tools.has(name) && !this.options.allowOverwrite) {
        throw new ToolRegistrationError(`Tool '${name}' is already registered`, name)
      }

      // Validate metadata if enabled
      if (this.options.validateMetadata) {
        this.validateToolMetadata(definition.metadata)
      }

      // Run custom validators
      for (const validator of this.options.customValidators) {
        validator(definition)
      }

      // Register the tool
      this.tools.set(name, definition)
    } catch (error) {
      if (error instanceof ToolRegistrationError) {
        throw error
      }

      throw new ToolRegistrationError(
        `Failed to register tool '${name}': ${error instanceof Error ? error.message : String(error)}`,
        name,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Register all default Mnemo tools
   */
  registerDefaultTools(): void {
    // Register countMemory tool
    this.register({
      metadata: CountMemoryTool.getToolMetadata() as MnemoToolMetadata,
      executor: executeCountMemory as MnemoToolExecutor,
      toolClass: CountMemoryTool as new (mnemo: Mnemo) => MnemoTool,
    })

    // Register searchMemory tool
    this.register({
      metadata: SearchMemoryTool.getToolMetadata() as MnemoToolMetadata,
      executor: executeSearchMemory as MnemoToolExecutor,
      toolClass: SearchMemoryTool as new (mnemo: Mnemo) => MnemoTool,
    })

    // Register storeMemory tool
    this.register({
      metadata: StoreMemoryTool.getToolMetadata() as MnemoToolMetadata,
      executor: executeStoreMemory as MnemoToolExecutor,
      toolClass: StoreMemoryTool as new (mnemo: Mnemo) => MnemoTool,
    })

    // Register deleteMemory tool
    this.register({
      metadata: DeleteMemoryTool.getToolMetadata() as MnemoToolMetadata,
      executor: executeDeleteMemory as MnemoToolExecutor,
      toolClass: DeleteMemoryTool as new (mnemo: Mnemo) => MnemoTool,
    })
  }

  /**
   * Execute a registered tool
   *
   * @param toolName - Name of the tool to execute
   * @param params - Parameters for tool execution
   * @returns Promise resolving to tool execution result
   * @throws {ToolRegistrationError} When tool is not found or execution fails
   */
  async execute<TResult = MnemoToolResult>(
    toolName: string,
    params: MnemoToolParams,
  ): Promise<TResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new ToolRegistrationError(`Tool '${toolName}' is not registered`, toolName)
    }

    try {
      const result = await tool.executor(this.mnemo, params)
      return result as TResult
    } catch (error) {
      throw new ToolRegistrationError(
        `Tool '${toolName}' execution failed: ${error instanceof Error ? error.message : String(error)}`,
        toolName,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Get tool metadata by name
   *
   * @param toolName - Name of the tool
   * @returns Tool metadata or undefined if not found
   */
  getToolMetadata(toolName: string): MnemoToolMetadata | undefined {
    const tool = this.tools.get(toolName)
    return tool?.metadata
  }

  /**
   * Get all registered tool names
   *
   * @returns Array of registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Get all registered tools metadata
   *
   * @returns Array of all tool metadata
   */
  getAllToolsMetadata(): MnemoToolMetadata[] {
    return Array.from(this.tools.values()).map((tool) => tool.metadata)
  }

  /**
   * Check if a tool is registered
   *
   * @param toolName - Name of the tool to check
   * @returns True if tool is registered
   */
  isRegistered(toolName: string): boolean {
    return this.tools.has(toolName)
  }

  /**
   * Unregister a tool
   *
   * @param toolName - Name of the tool to unregister
   * @returns True if tool was found and removed
   */
  unregister(toolName: string): boolean {
    return this.tools.delete(toolName)
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear()
  }

  /**
   * Get registry statistics
   *
   * @returns Registry statistics
   */
  getStats(): {
    totalTools: number
    toolNames: string[]
    hasDefaultTools: boolean
  } {
    const toolNames = this.getToolNames()
    const defaultTools = ['countMemory', 'searchMemory', 'storeMemory', 'deleteMemory']
    const hasDefaultTools = defaultTools.every((name) => toolNames.includes(name))

    return {
      totalTools: toolNames.length,
      toolNames,
      hasDefaultTools,
    }
  }

  /**
   * Validate tool metadata structure
   *
   * @param metadata - Tool metadata to validate
   * @throws {ToolRegistrationError} When validation fails
   */
  private validateToolMetadata(metadata: MnemoToolMetadata): void {
    if (!metadata.name || typeof metadata.name !== 'string') {
      throw new ToolRegistrationError('Tool metadata must have a valid name')
    }

    if (!metadata.description || typeof metadata.description !== 'string') {
      throw new ToolRegistrationError('Tool metadata must have a valid description', metadata.name)
    }

    if (!metadata.parameters || typeof metadata.parameters !== 'object') {
      throw new ToolRegistrationError('Tool metadata must have valid parameters schema', metadata.name)
    }

    if (metadata.parameters.type !== 'object') {
      throw new ToolRegistrationError('Tool parameters must be of type "object"', metadata.name)
    }

    if (!metadata.parameters.properties || typeof metadata.parameters.properties !== 'object') {
      throw new ToolRegistrationError('Tool parameters must have properties', metadata.name)
    }

    if (!Array.isArray(metadata.parameters.required)) {
      throw new ToolRegistrationError('Tool parameters must have required fields array', metadata.name)
    }

    // Validate examples if present
    if (metadata.examples) {
      if (!Array.isArray(metadata.examples)) {
        throw new ToolRegistrationError('Tool examples must be an array', metadata.name)
      }

      for (const example of metadata.examples) {
        if (!example.description || typeof example.description !== 'string') {
          throw new ToolRegistrationError('Tool example must have description', metadata.name)
        }

        if (!example.parameters || typeof example.parameters !== 'object') {
          throw new ToolRegistrationError('Tool example must have parameters', metadata.name)
        }
      }
    }
  }
}

/**
 * Factory function to create a tool registry with default tools
 *
 * @param mnemo - Mnemo instance for tool execution
 * @param options - Registration options
 * @returns Configured tool registry with default tools
 *
 * @example
 * ```typescript
 * const registry = createMnemoToolRegistry(mnemo)
 * const searchResults = await registry.execute('searchMemory', {
 *   query: 'artificial intelligence',
 *   topK: 10
 * })
 * ```
 */
export function createMnemoToolRegistry(
  mnemo: Mnemo,
  options: ToolRegistrationOptions = {},
): MnemoToolRegistry {
  const registry = new MnemoToolRegistry(mnemo, options)
  registry.registerDefaultTools()
  return registry
}

/**
 * Create tool registry for MCP server implementation
 *
 * @param mnemo - Mnemo instance
 * @returns Registry with MCP-compatible tool definitions
 */
export function createMCPToolRegistry(mnemo: Mnemo): {
  registry: MnemoToolRegistry
  mcpTools: Array<{
    name: string
    description: string
    inputSchema: MnemoToolMetadata['parameters']
  }>
} {
  const registry = createMnemoToolRegistry(mnemo)
  const metadata = registry.getAllToolsMetadata()

  const mcpTools = metadata.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
  }))

  return { registry, mcpTools }
}
