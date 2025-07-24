/**
 * Centralized mock implementations for Mnemo class and utilities
 * @module tests/mocks/mnemo
 */

import type { Mnemo } from '../../src/mnemo.ts'

/**
 * Mock Mnemo class for testing tools and other functionality
 */
export class MockMnemo {
  defaultCollection = 'test'

  async embed(text: string): Promise<number[]> {
    // Return a mock embedding based on text length
    return new Array(768).fill(0).map((_, i) => Math.sin(i * text.length))
  }

  async searchFromText(options: {
    text: string
    topK?: number
    filter?: Record<string, unknown>
    collection?: string
  }) {
    // Mock search results
    return [
      {
        id: 'test:1',
        score: 0.95,
        payload: { text: 'Mock search result', type: 'test' },
        vector: undefined,
      },
      {
        id: 'test:2',
        score: 0.87,
        payload: { text: 'Another mock result', type: 'test' },
        vector: undefined,
      },
    ].slice(0, options.topK || 5)
  }

  async storeFromText(
    id: string,
    text: string,
    collection?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    // Mock storage - just validate inputs
    if (!id) throw new Error('ID required')
    if (!text) throw new Error('Text required')
  }

  async delete(id: string, collection?: string): Promise<void> {
    // Mock deletion
    if (!id) throw new Error('ID required')
  }

  async count(params?: {
    filter?: unknown
    exact?: boolean
  }, collection?: string) {
    // Mock count - return different values based on filter
    const hasFilter = params?.filter && Object.keys(params.filter as Record<string, unknown>).length > 0
    return {
      count: hasFilter ? 42 : 100, // Different counts for filtered vs unfiltered
    }
  }

  getDefaultCollection(): string {
    return this.defaultCollection
  }

  async search(query: {
    vector: number[]
    topK?: number
    filter?: Record<string, unknown>
  }, collection?: string) {
    return []
  }
}

/**
 * Factory function to create a mock Mnemo instance
 */
export function createMockMnemo() {
  return new MockMnemo() as unknown as Mnemo
}

/**
 * Mock Mnemo class with customizable behavior for advanced testing
 */
export class CustomizableMockMnemo extends MockMnemo {
  private searchResults: any[] = []
  private countValue = 100
  private shouldThrowError = false
  private errorMessage = 'Mock error'

  setSearchResults(results: any[]): void {
    this.searchResults = results
  }

  setCountValue(count: number): void {
    this.countValue = count
  }

  setErrorBehavior(shouldThrow: boolean, message = 'Mock error'): void {
    this.shouldThrowError = shouldThrow
    this.errorMessage = message
  }

  override async searchFromText(options: {
    text: string
    topK?: number
    filter?: Record<string, unknown>
    collection?: string
  }) {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    return this.searchResults.slice(0, options.topK || 5)
  }

  override async count(params?: {
    filter?: unknown
    exact?: boolean
  }, collection?: string) {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    return { count: this.countValue }
  }

  override async storeFromText(
    id: string,
    text: string,
    collection?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    // Call parent validation
    return super.storeFromText(id, text, collection, payload)
  }

  override async delete(id: string, collection?: string): Promise<void> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage)
    }
    return super.delete(id, collection)
  }
}

/**
 * Factory function to create a customizable mock Mnemo instance
 */
export function createCustomizableMockMnemo() {
  return new CustomizableMockMnemo() as unknown as Mnemo
}