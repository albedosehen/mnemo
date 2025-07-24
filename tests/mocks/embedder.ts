/**
 * Centralized mock implementations for Embedder classes and utilities
 * @module tests/mocks/embedder
 */

import { BaseEmbedder } from '../../src/embedder/embedder.ts'

/**
 * Mock embedder for testing base functionality
 */
export class MockEmbedder extends BaseEmbedder {
  constructor(mockResponse?: number[]) {
    super()
    this.mockResponse = mockResponse || [0.1, 0.2, 0.3]
  }

  private mockResponse: number[]

  protected getDefaultModel(): string {
    return 'mock-model'
  }

  protected getProviderName(): string {
    return 'mock'
  }

  protected async performEmbed(_text: string): Promise<number[]> {
    if (_text === 'error') {
      throw new Error('Mock error')
    }
    return this.mockResponse
  }
}

/**
 * Factory function to create a mock embedder with specified response
 */
export function createMockEmbedder(mockVector?: number[]) {
  return new MockEmbedder(mockVector)
}

/**
 * Mock embedder that simulates failures for testing retry logic
 */
export class FailingMockEmbedder extends BaseEmbedder {
  private callCount = 0
  
  constructor(private failureCount = 2, private successResponse = [1, 2, 3]) {
    super()
  }

  protected getDefaultModel(): string {
    return 'failing-model'
  }

  protected getProviderName(): string {
    return 'failing'
  }

  protected async performEmbed(_text: string): Promise<number[]> {
    this.callCount++
    if (this.callCount <= this.failureCount) {
      throw new Error('Temporary failure')
    }
    return this.successResponse
  }

  getCallCount(): number {
    return this.callCount
  }

  reset(): void {
    this.callCount = 0
  }
}

/**
 * Mock embedder that returns invalid outputs for testing validation
 */
export class InvalidOutputMockEmbedder extends BaseEmbedder {
  protected getDefaultModel(): string {
    return 'invalid-model'
  }

  protected getProviderName(): string {
    return 'invalid'
  }

  protected async performEmbed(text: string): Promise<number[]> {
    if (text === 'empty') return []
    if (text === 'non-array') return 'not an array' as any
    if (text === 'invalid-numbers') return [1, 'not a number', 3] as any
    return [1, 2, 3]
  }
}

/**
 * Factory function to create a failing mock embedder
 */
export function createFailingMockEmbedder(failureCount = 2, successResponse = [1, 2, 3]) {
  return new FailingMockEmbedder(failureCount, successResponse)
}

/**
 * Factory function to create an invalid output mock embedder
 */
export function createInvalidOutputMockEmbedder() {
  return new InvalidOutputMockEmbedder()
}