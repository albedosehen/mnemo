/**
 * Centralized mock implementations for integration testing
 * These mocks provide more realistic behavior for integration test scenarios
 * @module tests/mocks/integration
 */

import type { VectorRecord, SearchQuery } from '../../src/client/client.types.ts'
import { QdrantValidationError } from '../../src/client/client.types.ts'
import { BaseEmbedder } from '../../src/embedder/embedder.ts'
import { EmbedderConnectionError } from '../../src/embedder/embedder.types.ts'

/**
 * Integration mock for QdrantClient with more realistic behavior
 */
export class IntegrationMockQdrantClient {
  private collections = new Map<string, {
    records: Map<string, VectorRecord>
    config: { size: number; distance: string }
  }>()

  constructor(public readonly config: { url: string; apiKey?: string; timeout?: number }) {}

  async createCollection(name: string, config: { size: number; distance: string }) {
    if (this.collections.has(name)) {
      throw new QdrantValidationError(`Collection '${name}' already exists`)
    }
    this.collections.set(name, {
      records: new Map(),
      config
    })
    return { result: true, time: 0.1 }
  }

  async collectionExists(name: string): Promise<boolean> {
    return this.collections.has(name)
  }

  async deleteCollection(name: string) {
    if (!this.collections.has(name)) {
      throw new QdrantValidationError(`Collection '${name}' not found`)
    }
    this.collections.delete(name)
    return { result: true, time: 0.05 }
  }

  async getCollection(name: string) {
    const collection = this.collections.get(name)
    if (!collection) {
      throw new QdrantValidationError(`Collection '${name}' not found`)
    }
    return {
      result: {
        name,
        vectors_count: collection.records.size,
        config: collection.config
      },
      time: 0.01
    }
  }

  async upsert(collectionName: string, record: VectorRecord) {
    const collection = this.collections.get(collectionName)
    if (!collection) {
      throw new QdrantValidationError(`Collection '${collectionName}' not found`)
    }
    
    // Validate vector dimension
    if (record.vector.length !== collection.config.size) {
      throw new QdrantValidationError(`Vector dimension mismatch: expected ${collection.config.size}, got ${record.vector.length}`)
    }

    collection.records.set(record.id, { ...record })
    return { 
      result: { operation_id: Date.now(), status: 'completed' as const }, 
      status: 'ok' as const, 
      time: 0.1 
    }
  }

  async upsertBatch(collectionName: string, records: VectorRecord[]) {
    const collection = this.collections.get(collectionName)
    if (!collection) {
      throw new QdrantValidationError(`Collection '${collectionName}' not found`)
    }

    for (const record of records) {
      if (record.vector.length !== collection.config.size) {
        throw new QdrantValidationError(`Vector dimension mismatch: expected ${collection.config.size}, got ${record.vector.length}`)
      }
      collection.records.set(record.id, { ...record })
    }

    return { 
      result: { operation_id: Date.now(), status: 'completed' as const }, 
      status: 'ok' as const, 
      time: records.length * 0.02 
    }
  }

  async search(collectionName: string, query: SearchQuery) {
    const collection = this.collections.get(collectionName)
    if (!collection) {
      throw new QdrantValidationError(`Collection '${collectionName}' not found`)
    }

    // Simple mock search - return records sorted by similarity score
    const results = Array.from(collection.records.values())
      .filter(record => {
        // Apply filter if provided
        if (query.filter) {
          return this.applyFilter(record.payload || {}, query.filter)
        }
        return true
      })
      .map(record => ({
        id: record.id,
        score: Math.random() * 0.5 + 0.5, // Random score between 0.5-1.0
        payload: record.payload,
        vector: undefined // Vectors not returned by default in search results
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK || 10)

    return results
  }

  async deletePoints(collectionName: string, pointIds: string[]) {
    const collection = this.collections.get(collectionName)
    if (!collection) {
      throw new QdrantValidationError(`Collection '${collectionName}' not found`)
    }

    for (const id of pointIds) {
      collection.records.delete(id)
    }

    return { result: true, time: pointIds.length * 0.01 }
  }

  async countPoints(collectionName: string, params?: any) {
    const collection = this.collections.get(collectionName)
    if (!collection) {
      throw new QdrantValidationError(`Collection '${collectionName}' not found`)
    }

    let count = collection.records.size
    
    // Apply filter if provided
    if (params?.filter) {
      count = Array.from(collection.records.values())
        .filter(record => this.applyFilter(record.payload || {}, params.filter))
        .length
    }

    return { count }
  }

  private applyFilter(payload: Record<string, any>, filter: any): boolean {
    // Simple filter implementation for testing
    if (filter.match) {
      const { key, value } = filter.match
      return payload[key] === value
    }
    
    if (filter.range) {
      const { key, gte, lte, gt, lt } = filter.range
      const fieldValue = payload[key]
      if (typeof fieldValue !== 'number') return false
      
      if (gte !== undefined && fieldValue < gte) return false
      if (lte !== undefined && fieldValue > lte) return false
      if (gt !== undefined && fieldValue <= gt) return false
      if (lt !== undefined && fieldValue >= lt) return false
      
      return true
    }

    if (filter.must) {
      return filter.must.every((condition: any) => this.applyFilter(payload, condition))
    }

    if (filter.should) {
      return filter.should.some((condition: any) => this.applyFilter(payload, condition))
    }

    if (filter.must_not) {
      return !filter.must_not.some((condition: any) => this.applyFilter(payload, condition))
    }

    return true
  }

  getInfo() {
    return {
      url: this.config.url,
      hasApiKey: Boolean(this.config.apiKey),
      timeout: this.config.timeout || 30000,
    }
  }

  // Helper methods for testing
  getCollectionCount(): number {
    return this.collections.size
  }

  getRecordCount(collectionName: string): number {
    const collection = this.collections.get(collectionName)
    return collection ? collection.records.size : 0
  }

  clearAllCollections(): void {
    this.collections.clear()
  }
}

/**
 * Integration mock embedder with realistic behavior and network simulation
 */
export class IntegrationMockEmbedder extends BaseEmbedder {
  private shouldSimulateNetworkDelay: boolean
  private networkDelayMs: number
  private shouldFailOnText: string[]
  private vectorDimensions: number

  constructor(options: {
    vectorDimensions?: number
    simulateNetworkDelay?: boolean
    networkDelayMs?: number
    shouldFailOnText?: string[]
  } = {}) {
    super()
    this.vectorDimensions = options.vectorDimensions || 768
    this.shouldSimulateNetworkDelay = options.simulateNetworkDelay || false
    this.networkDelayMs = options.networkDelayMs || 100
    this.shouldFailOnText = options.shouldFailOnText || []
  }

  protected getDefaultModel(): string {
    return 'integration-mock-model'
  }

  protected getProviderName(): string {
    return 'integration-mock'
  }

  protected async performEmbed(text: string): Promise<number[]> {
    // Simulate network delay if configured
    if (this.shouldSimulateNetworkDelay) {
      await new Promise(resolve => setTimeout(resolve, this.networkDelayMs))
    }

    // Simulate specific failures
    if (this.shouldFailOnText.includes(text)) {
      throw new EmbedderConnectionError(`Simulated failure for text: ${text}`)
    }

    // Generate deterministic vector based on text content
    const vector = new Array(this.vectorDimensions)
    for (let i = 0; i < this.vectorDimensions; i++) {
      vector[i] = Math.sin((text.charCodeAt(i % text.length) + i) * 0.1)
    }

    return vector
  }

  // Configuration methods for testing
  setNetworkDelay(enabled: boolean, delayMs = 100): void {
    this.shouldSimulateNetworkDelay = enabled
    this.networkDelayMs = delayMs
  }

  addFailureText(text: string): void {
    this.shouldFailOnText.push(text)
  }

  clearFailureTexts(): void {
    this.shouldFailOnText = []
  }

  getVectorDimensions(): number {
    return this.vectorDimensions
  }
}

/**
 * Factory function to create an integration mock QdrantClient
 */
export function createIntegrationMockQdrantClient(config?: { url?: string; apiKey?: string; timeout?: number }) {
  return new IntegrationMockQdrantClient({
    url: config?.url || 'http://localhost:6333',
    apiKey: config?.apiKey,
    timeout: config?.timeout,
  }) as any
}

/**
 * Factory function to create an integration mock embedder
 */
export function createIntegrationMockEmbedder(options?: {
  vectorDimensions?: number
  simulateNetworkDelay?: boolean
  networkDelayMs?: number
  shouldFailOnText?: string[]
}) {
  return new IntegrationMockEmbedder(options)
}