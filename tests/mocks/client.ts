/**
 * Centralized mock implementations for QdrantClient and related utilities
 * @module tests/mocks/client
 */

import type { VectorRecord, SearchQuery } from '../../src/client/client.types.ts'
import { QdrantValidationError } from '../../src/client/client.types.ts'

/**
 * Mock fetch function for testing without actual network calls
 */
export function createMockFetch(mockResponse: {
  ok: boolean
  status: number
  statusText?: string
  data?: any
  json?: () => Promise<any>
}) {
  return (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    // Handle abort signal to prevent timer leaks
    if (init?.signal) {
      const signal = init.signal as AbortSignal
      if (signal.aborted) {
        return Promise.reject(new DOMException('Operation was aborted', 'AbortError'))
      }

      // Create response immediately and trigger cleanup
      const response = {
        ok: mockResponse.ok,
        status: mockResponse.status,
        statusText: mockResponse.statusText || 'OK',
        json: mockResponse.json || (() => Promise.resolve(mockResponse.data)),
        headers: new Headers(),
      } as Response

      // Return response immediately - this simulates successful completion
      // which should trigger the timeout cleanup in the AbortController
      return Promise.resolve(response)
    }

    const response = {
      ok: mockResponse.ok,
      status: mockResponse.status,
      statusText: mockResponse.statusText || 'OK',
      json: mockResponse.json || (() => Promise.resolve(mockResponse.data)),
      headers: new Headers(),
    } as Response

    return Promise.resolve(response)
  }
}

/**
 * Mock QdrantClient for testing
 */
export class MockQdrantClient {
  constructor(public readonly config: { url: string; apiKey?: string; timeout?: number }) {}

  async upsert(collectionName: string, record: VectorRecord) {
    return { result: { operation_id: 1, status: 'completed' as const }, status: 'ok' as const, time: 0.1 }
  }

  async search(collectionName: string, query: SearchQuery) {
    return [
      {
        id: 'test-result',
        score: 0.95,
        payload: { text: 'mock result' },
      },
    ]
  }

  async deletePoints(collectionName: string, pointIds: string[]) {
    return { result: true, time: 0.05 }
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    return collectionName === 'existing-collection'
  }

  async upsertBatch(collectionName: string, records: VectorRecord[]) {
    return { result: { operation_id: 2, status: 'completed' as const }, status: 'ok' as const, time: 0.2 }
  }

  async countPoints(collectionName: string, params?: any) {
    // Default behavior: return different counts based on collection name and filters
    if (collectionName === 'test-collection') {
      // Check for direct match filter
      if (params?.filter?.match?.key === 'category') {
        return { count: 15 }
      }
      // Check for complex filter with must array containing match
      if (params?.filter?.must && Array.isArray(params.filter.must)) {
        for (const condition of params.filter.must) {
          if (condition.match?.key === 'category') {
            return { count: 15 }
          }
        }
      }
      return { count: 42 }
    }
    if (collectionName === 'custom-collection') {
      return { count: 100 }
    }
    if (collectionName === 'error-collection') {
      throw new QdrantValidationError('Test error from client')
    }
    return { count: 0 }
  }

  getInfo() {
    return {
      url: this.config.url,
      hasApiKey: Boolean(this.config.apiKey),
      timeout: this.config.timeout || 30000,
    }
  }
}

/**
 * Factory function to create a mock QdrantClient
 */
export function createMockQdrantClient(config?: { url?: string; apiKey?: string; timeout?: number }) {
  return new MockQdrantClient({
    url: config?.url || 'http://localhost:6333',
    apiKey: config?.apiKey,
    timeout: config?.timeout,
  }) as any
}