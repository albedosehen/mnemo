# Mnemo 🐠

A powerful TypeScript library for vector similarity search that seamlessly integrates Qdrant vector database with multiple embedding providers. Mnemo provides a unified, type-safe interface for storing, searching, and managing vector embeddings, making it easy to build semantic search applications, recommendation systems, and AI-powered memory systems.

[![CI](https://github.com/albedosehen/mnemo/workflows/CI/badge.svg)](https://github.com/albedosehen/mnemo/actions)

## Features

### Core Functionality

- **Qdrant Integration**: Full-featured client for Qdrant vector database operations
- **Multiple Embedding Providers**: Support for OpenAI, Ollama, and custom embedding models
- **Semantic Search**: Advanced similarity search with filtering and ranking capabilities
- **Memory Management**: Store, retrieve, update, and delete vector memories
- **Batch Operations**: Efficient bulk operations for large datasets

### Developer Experience

- **Type Safety**: Comprehensive TypeScript definitions and compile-time safety
- **MCP Tools**: Model Context Protocol tools for AI agent integration
- **Flexible Configuration**: Customizable clients, embedders, and search parameters
- **Error Handling**: Robust error handling with detailed error types
- **Testing Support**: Comprehensive test utilities and mocks

### Advanced Features

- **Custom Filters**: Complex filtering with boolean logic, ranges, and geo-queries
- **Collection Management**: Create, delete, and manage vector collections
- **Metadata Support**: Rich metadata storage and querying capabilities
- **Retry Logic**: Built-in retry mechanisms for reliability
- **Performance Monitoring**: Built-in timing and performance metrics

## Installation

```bash
# Using Deno
deno add jsr:@albedosehen/mnemo

# Or specify a version
deno add jsr:@albedosehen/mnemo@^0.1.0
```

## Quick Start

### Basic Setup

```typescript
import { Mnemo, QdrantClient, OllamaEmbedder } from '@albedosehen/mnemo'

// Initialize individual components
const client = new QdrantClient({
  url: 'http://localhost:6333',
  apiKey: 'your-api-key' // optional
})

// And the embedder
const embedder = new OllamaEmbedder({
  model: 'nomic-embed-text',
  endpoint: 'http://localhost:11434'
})

// Or use the all-in-one Mnemo class
// which combines both client and embedder
const mnemo = new Mnemo(client, embedder, {
  defaultCollection: 'my-memories',
  maxBatchSize: 100
})
```

### Store and Search Memories

```typescript
// Store a memory
await mnemo.storeFromText(
  'doc-1',
  'Artificial intelligence is transforming software development',
  'tech-docs',
  { category: 'AI', tags: ['programming', 'ai'] }
)

// Search for similar content
const results = await mnemo.searchFromText({
  text: 'How is AI changing programming?',
  topK: 5,
  filter: { category: 'AI' },
  collection: 'tech-docs'
})

console.log(results[0].payload) // { category: 'AI', tags: [...] }
```

### Advanced Filtering

```typescript
import { createFilter } from '@albedosehen/mnemo'

// Complex filter with boolean logic
const filter = createFilter()
  .where('category').equals('AI')
  .and()
  .where('score').greaterThan(0.8)
  .and()
  .or()
  .where('tags').matches('important')
  .build()

const results = await mnemo.searchFromText({
  text: 'machine learning concepts',
  filter,
  topK: 10
})
```

### Batch Operations

```typescript
// Batch store multiple documents
const documents = [
  { id: 'doc-1', text: 'Content 1', payload: { type: 'article' } },
  { id: 'doc-2', text: 'Content 2', payload: { type: 'blog' } },
  { id: 'doc-3', text: 'Content 3', payload: { type: 'paper' } }
]

for (const doc of documents) {
  await mnemo.storeFromText(doc.id, doc.text, 'documents', doc.payload)
}

// Count memories with filters
const count = await mnemo.count({
  filter: { type: 'article' },
  exact: true
})
```

### Using Different Embedding Providers

```typescript
// OpenAI Embedder
import { OpenAIEmbedder } from '@albedosehen/mnemo'

const openaiEmbedder = new OpenAIEmbedder({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
  organizationId: 'your-org-id' // optional
})

// Custom Embedder
import { BaseEmbedder } from '@albedosehen/mnemo'

class CustomEmbedder extends BaseEmbedder {
  protected getDefaultModel() { return 'custom-model' }
  protected getProviderName() { return 'custom' }

  protected async performEmbed(text: string): Promise<number[]> {
    // Your custom embedding logic
    return await yourCustomEmbeddingFunction(text)
  }
}
```

## Configuration

### QdrantClient Options

```typescript
const client = new QdrantClient({
  url: 'http://localhost:6333',
  apiKey: 'your-api-key',
  timeout: 30000, // ms
})
```

### Embedder Options

```typescript
// Ollama config
const ollamaEmbedder = new OllamaEmbedder({
  endpoint: 'http://localhost:11434',
  model: 'nomic-embed-text',
  timeout: 60000,
  maxRetries: 3,
  retryDelay: 1000
})

// OpenAI config
const openaiEmbedder = new OpenAIEmbedder({
  apiKey: 'your-key',
  model: 'text-embedding-3-small',
  baseURL: 'https://api.openai.com/v1', // custom
  timeout: 30000,
  maxRetries: 3
})
```

### Mnemo Options

```typescript
const mnemo = new Mnemo(client, embedder, {
  defaultCollection: 'memories',
  validateDimensions: true,
  maxBatchSize: 100
})
```

## MCP Tools Integration

Mnemo includes Model Context Protocol tools for AI agent integration:

```typescript
import { createMnemoToolRegistry } from '@albedosehen/mnemo'

const registry = createMnemoToolRegistry(mnemo)

// Available tools: searchMemory, storeMemory, deleteMemory, countMemory
const searchTool = registry.getToolMetadata('searchMemory')
const result = await registry.execute('searchMemory', {
  query: 'artificial intelligence',
  topK: 5
})
```

## Error Handling

```typescript
import {
  QdrantError,
  QdrantValidationError,
  EmbedderError,
  EmbedderValidationError
} from '@albedosehen/mnemo'

try {
  await mnemo.storeFromText('', 'text', 'collection')
} catch (error) {
  if (error instanceof QdrantValidationError) {
    console.error('Validation failed:', error.message)
  } else if (error instanceof EmbedderError) {
    console.error('Embedding failed:', error.message)
  }
}
```

## Development

### Running Tests

```bash
deno test --allow-net --allow-env
```

### Building

```bash
deno task build
```

### Linting

```bash
deno lint
deno fmt
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and ensure all tests pass before submitting a pull request.

## License

MIT License

## Links

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Ollama](https://ollama.ai/)
