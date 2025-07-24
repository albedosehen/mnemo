/**
 * Mnemo Embedder Module Exports
 * All exports are explicit for public API clarity.
 * @module embedder
 */

export {
  type BaseEmbedderOptions,
  type EmbedBatchOptions,
  type EmbedBatchResult,
  type Embedder,
  EmbedderAuthenticationError,
  EmbedderConnectionError,
  EmbedderError,
  type EmbedderHttpOptions,
  EmbedderModelError,
  EmbedderRateLimitError,
  EmbedderValidationError,
  type EmbeddingApiResponse,
  type EmbeddingModelInfo,
} from './embedder.types.ts'

export {
  BaseEmbedder,
  cosineSimilarity,
  DEFAULT_EMBEDDER_CONFIG,
  normalizeEmbedding,
  validateEmbeddingDimensions,
} from './embedder.ts'

export { createLocalOllamaEmbedder, createOllamaEmbedder, OllamaEmbedder } from './ollama.ts'
export {
  OLLAMA_DEFAULTS,
  OLLAMA_EMBEDDING_MODELS,
  type OllamaEmbedderOptions,
  type OllamaEmbeddingModelName,
  type OllamaEmbedRequest,
  type OllamaEmbedResponse,
  type OllamaErrorResponse,
  type OllamaHealthResponse,
  type OllamaModelInfo,
  type OllamaModelOptions,
  type OllamaModelsResponse,
} from './ollama.types.ts'

export { createOpenAIEmbedder, createOpenAIEmbedderFromEnv, OpenAIEmbedder } from './openai.ts'
export {
  OPENAI_DEFAULTS,
  OPENAI_EMBEDDING_MODELS,
  OPENAI_ENV_VARS,
  type OpenAIEmbedderOptions,
  type OpenAIEmbeddingData,
  type OpenAIEmbeddingModelName,
  type OpenAIEmbedRequest,
  type OpenAIEmbedResponse,
  type OpenAIErrorResponse,
  type OpenAIModelInfo,
  type OpenAIModelsResponse,
  type OpenAIRateLimitInfo,
  type OpenAIUsage,
} from './openai.types.ts'
