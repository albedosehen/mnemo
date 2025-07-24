/**
 * Types and interfaces specific to Ollama embedder
 * @module ollama.types
 */

import type { BaseEmbedderOptions, EmbedderHttpOptions } from './embedder.types.ts'

/**
 * Configuration options for OllamaEmbedder
 */
export interface OllamaEmbedderOptions extends BaseEmbedderOptions, EmbedderHttpOptions {
  /** Ollama server endpoint URL */
  endpoint?: string
  /** Model name to use for embeddings */
  model?: string
  /** Custom options to pass to Ollama */
  options?: OllamaModelOptions
}

/**
 * Options for Ollama model configuration
 */
export interface OllamaModelOptions {
  /** Temperature for model (if applicable) */
  temperature?: number
  /** Top-p sampling parameter */
  top_p?: number
  /** Top-k sampling parameter */
  top_k?: number
  /** Random seed for reproducibility */
  seed?: number
  /** Custom model parameters */
  [key: string]: unknown
}

/**
 * Request payload for Ollama embeddings API
 */
export interface OllamaEmbedRequest {
  /** Model name to use */
  model: string
  /** Input text to embed */
  prompt: string
  /** Optional model options */
  options?: OllamaModelOptions
}

/**
 * Response from Ollama embeddings API
 */
export interface OllamaEmbedResponse {
  /** The embedding vector */
  embedding: number[]
  /** Model used for embedding */
  model?: string
  /** Total duration of the request */
  total_duration?: number
  /** Time spent loading the model */
  load_duration?: number
  /** Number of tokens in the prompt */
  prompt_eval_count?: number
  /** Time spent evaluating the prompt */
  prompt_eval_duration?: number
}

/**
 * Error response from Ollama API
 */
export interface OllamaErrorResponse {
  /** Error message */
  error: string
  /** Additional error details */
  details?: string
  /** HTTP status code */
  status?: number
}

/**
 * Available models response from Ollama
 */
export interface OllamaModelsResponse {
  /** List of available models */
  models: OllamaModelInfo[]
}

/**
 * Information about an Ollama model
 */
export interface OllamaModelInfo {
  /** Model name */
  name: string
  /** Model size in bytes */
  size: number
  /** Model digest/hash */
  digest: string
  /** Model creation date */
  modified_at: string
  /** Model details */
  details?: {
    /** Model format */
    format: string
    /** Model family */
    family: string
    /** Parameter count */
    parameter_size: string
    /** Quantization level */
    quantization_level: string
  }
}

/**
 * Health check response from Ollama server
 */
export interface OllamaHealthResponse {
  /** Server status */
  status: 'ok' | 'error'
  /** Version information */
  version?: string
  /** Uptime in seconds */
  uptime?: number
}

/**
 * Configuration constants for Ollama
 */
export const OLLAMA_DEFAULTS = {
  /** Default Ollama server endpoint */
  endpoint: 'http://localhost:11434',
  /** Default embedding model */
  model: 'nomic-embed-text',
  /** Default request timeout */
  timeout: 30000,
  /** Default API endpoints */
  endpoints: {
    embed: '/api/embeddings',
    models: '/api/tags',
    health: '/api/version',
  },
} as const

/**
 * Common Ollama embedding models with their specifications
 */
export const OLLAMA_EMBEDDING_MODELS = {
  'nomic-embed-text': {
    name: 'nomic-embed-text',
    dimensions: 768,
    maxTokens: 8192,
    description: 'High-quality text embeddings from Nomic AI',
  },
  'mxbai-embed-large': {
    name: 'mxbai-embed-large',
    dimensions: 1024,
    maxTokens: 512,
    description: 'Large embedding model from MixedBread AI',
  },
  'all-minilm': {
    name: 'all-minilm',
    dimensions: 384,
    maxTokens: 256,
    description: 'Compact and fast embedding model',
  },
} as const

/**
 * Type for valid Ollama embedding model names
 */
export type OllamaEmbeddingModelName = keyof typeof OLLAMA_EMBEDDING_MODELS
