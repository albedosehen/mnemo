/**
 * Types and interfaces specific to OpenAI embedder
 * @module openai.types
 */

import type { BaseEmbedderOptions, EmbedderHttpOptions } from './embedder.types.ts'

/**
 * Configuration options for OpenAIEmbedder
 */
export interface OpenAIEmbedderOptions extends BaseEmbedderOptions, EmbedderHttpOptions {
  /** OpenAI API key for authentication */
  apiKey?: string
  /** OpenAI API base URL (for custom endpoints) */
  baseURL?: string
  /** Organization ID for API requests */
  organization?: string
  /** Project ID for API requests */
  project?: string
  /** Model name to use for embeddings */
  model?: string
  /** Number of dimensions for embeddings (some models support this) */
  dimensions?: number
  /** Encoding format for embeddings */
  encodingFormat?: 'float' | 'base64'
}

/**
 * Request payload for OpenAI embeddings API
 */
export interface OpenAIEmbedRequest {
  /** Input text(s) to embed */
  input: string | string[]
  /** Model name to use */
  model: string
  /** Number of dimensions (optional, model-dependent) */
  dimensions?: number
  /** Encoding format for the embeddings */
  encoding_format?: 'float' | 'base64'
  /** User identifier for tracking */
  user?: string
}

/**
 * Individual embedding result from OpenAI API
 */
export interface OpenAIEmbeddingData {
  /** The embedding vector */
  embedding: number[]
  /** Index of the input that generated this embedding */
  index: number
  /** Object type */
  object: 'embedding'
}

/**
 * Usage statistics from OpenAI API
 */
export interface OpenAIUsage {
  /** Number of tokens in the input */
  prompt_tokens: number
  /** Total tokens processed */
  total_tokens: number
}

/**
 * Response from OpenAI embeddings API
 */
export interface OpenAIEmbedResponse {
  /** Array of embedding results */
  data: OpenAIEmbeddingData[]
  /** Model used for embedding */
  model: string
  /** Object type */
  object: 'list'
  /** Usage statistics */
  usage: OpenAIUsage
}

/**
 * Error response from OpenAI API
 */
export interface OpenAIErrorResponse {
  /** Error details */
  error: {
    /** Error message */
    message: string
    /** Error type */
    type: string
    /** Error parameter (if applicable) */
    param?: string
    /** Error code (if applicable) */
    code?: string
  }
}

/**
 * Rate limit information from OpenAI headers
 */
export interface OpenAIRateLimitInfo {
  /** Requests remaining in current window */
  requestsRemaining?: number
  /** Tokens remaining in current window */
  tokensRemaining?: number
  /** Time until rate limit resets */
  resetTime?: Date
  /** Rate limit window duration */
  resetTokens?: number
  /** Current rate limit */
  limitRequests?: number
  /** Current token limit */
  limitTokens?: number
}

/**
 * Configuration constants for OpenAI
 */
export const OPENAI_DEFAULTS = {
  /** Default OpenAI API base URL */
  baseURL: 'https://api.openai.com/v1',
  /** Default embedding model */
  model: 'text-embedding-3-small',
  /** Default request timeout */
  timeout: 60000,
  /** Default encoding format */
  encodingFormat: 'float' as const,
  /** API endpoints */
  endpoints: {
    embeddings: '/embeddings',
    models: '/models',
  },
  /** Rate limit headers */
  rateLimitHeaders: {
    requestsRemaining: 'x-ratelimit-remaining-requests',
    tokensRemaining: 'x-ratelimit-remaining-tokens',
    resetRequests: 'x-ratelimit-reset-requests',
    resetTokens: 'x-ratelimit-reset-tokens',
    limitRequests: 'x-ratelimit-limit-requests',
    limitTokens: 'x-ratelimit-limit-tokens',
  },
} as const

/**
 * Common OpenAI embedding models with their specifications
 */
export const OPENAI_EMBEDDING_MODELS = {
  'text-embedding-3-small': {
    name: 'text-embedding-3-small',
    dimensions: 1536,
    maxTokens: 8191,
    description: 'High performance, cost-effective embedding model',
    supportsDimensions: true,
    cost: { input: 0.00002 }, // per 1K tokens
  },
  'text-embedding-3-large': {
    name: 'text-embedding-3-large',
    dimensions: 3072,
    maxTokens: 8191,
    description: 'Most capable embedding model',
    supportsDimensions: true,
    cost: { input: 0.00013 }, // per 1K tokens
  },
  'text-embedding-ada-002': {
    name: 'text-embedding-ada-002',
    dimensions: 1536,
    maxTokens: 8191,
    description: 'Legacy embedding model (still supported)',
    supportsDimensions: false,
    cost: { input: 0.0001 }, // per 1K tokens
  },
} as const

/**
 * Type for valid OpenAI embedding model names
 */
export type OpenAIEmbeddingModelName = keyof typeof OPENAI_EMBEDDING_MODELS

/**
 * OpenAI model information response
 */
export interface OpenAIModelInfo {
  /** Model ID */
  id: string
  /** Object type */
  object: 'model'
  /** Model creation timestamp */
  created: number
  /** Model owner */
  owned_by: string
  /** Permission details */
  permission?: Array<{
    /** Permission ID */
    id: string
    /** Object type */
    object: 'model_permission'
    /** Permission creation timestamp */
    created: number
    /** Whether creation is allowed */
    allow_create_engine: boolean
    /** Whether sampling is allowed */
    allow_sampling: boolean
    /** Whether log probabilities are allowed */
    allow_logprobs: boolean
    /** Whether search indices are allowed */
    allow_search_indices: boolean
    /** Whether view access is allowed */
    allow_view: boolean
    /** Whether fine-tuning is allowed */
    allow_fine_tuning: boolean
    /** Organization permissions */
    organization: string
    /** Group permissions */
    group?: string
    /** Whether blocking is enabled */
    is_blocking: boolean
  }>
}

/**
 * Response for listing OpenAI models
 */
export interface OpenAIModelsResponse {
  /** Object type */
  object: 'list'
  /** Array of available models */
  data: OpenAIModelInfo[]
}

/**
 * Environment variable names for OpenAI configuration
 */
export const OPENAI_ENV_VARS = {
  /** API key environment variable */
  apiKey: 'OPENAI_API_KEY',
  /** Organization environment variable */
  organization: 'OPENAI_ORG_ID',
  /** Project environment variable */
  project: 'OPENAI_PROJECT_ID',
  /** Base URL environment variable */
  baseURL: 'OPENAI_BASE_URL',
} as const
