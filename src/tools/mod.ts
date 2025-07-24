/**
 * MCP tools module exports
 * All exports are explicit for public API clarity.
 * @module tools
 */

// Tool implementations
export {
  type CountMemoryParams,
  type CountMemoryResult,
  CountMemoryTool,
  CountMemoryValidationError,
  createCountMemoryTool,
  executeCountMemory,
} from './countMemory.ts'

export {
  createDeleteMemoryTool,
  type DeleteMemoryParams,
  type DeleteMemoryResult,
  DeleteMemoryTool,
  DeleteMemoryValidationError,
  executeDeleteMemory,
} from './deleteMemory.ts'

export {
  createSearchMemoryTool,
  executeSearchMemory,
  type SearchMemoryParams,
  type SearchMemoryResponse,
  type SearchMemoryResult,
  SearchMemoryTool,
  SearchMemoryValidationError,
} from './searchMemory.ts'

export {
  createStoreMemoryTool,
  executeStoreMemory,
  type StoreMemoryParams,
  type StoreMemoryResult,
  StoreMemoryTool,
  StoreMemoryValidationError,
} from './storeMemory.ts'

export {
  createMCPToolRegistry,
  createMnemoToolRegistry,
  type MnemoTool,
  type MnemoToolDefinition,
  type MnemoToolExecutor,
  type MnemoToolMetadata,
  type MnemoToolParams,
  MnemoToolRegistry,
  type MnemoToolResult,
  ToolRegistrationError,
  type ToolRegistrationOptions,
} from './registry.ts'
