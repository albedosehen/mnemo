/**
 * Unit tests for QdrantClient factory functions
 * @module tests/unit/client/factory
 */

import { assertEquals, assertInstanceOf } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { QdrantClient, createQdrantClient, createLocalQdrantClient, createQdrantCloudClient } from '../../../src/client/client.ts'

Deno.test('createQdrantClient - Factory function', () => {
  const client = createQdrantClient({ url: 'http://localhost:6333' })
  assertInstanceOf(client, QdrantClient)

  const info = client.getInfo()
  assertEquals(info.url, 'http://localhost:6333')
  assertEquals(info.hasApiKey, false)
})

Deno.test('createQdrantClient - With API key', () => {
  const client = createQdrantClient({
    url: 'http://localhost:6333',
    apiKey: 'test-key',
    timeout: 5000
  })
  assertInstanceOf(client, QdrantClient)

  const info = client.getInfo()
  assertEquals(info.url, 'http://localhost:6333')
  assertEquals(info.hasApiKey, true)
  assertEquals(info.timeout, 5000)
})

Deno.test('createLocalQdrantClient - Default port', () => {
  const client = createLocalQdrantClient()
  assertInstanceOf(client, QdrantClient)

  const info = client.getInfo()
  assertEquals(info.url, 'http://localhost:6333')
  assertEquals(info.hasApiKey, false)
})

Deno.test('createLocalQdrantClient - Custom port', () => {
  const client = createLocalQdrantClient(6334)
  assertInstanceOf(client, QdrantClient)

  const info = client.getInfo()
  assertEquals(info.url, 'http://localhost:6334')
  assertEquals(info.hasApiKey, false)
})

Deno.test('createQdrantCloudClient - Cloud configuration', () => {
  const client = createQdrantCloudClient('https://xyz.qdrant.tech', 'api-key')
  assertInstanceOf(client, QdrantClient)

  const info = client.getInfo()
  assertEquals(info.url, 'https://xyz.qdrant.tech')
  assertEquals(info.hasApiKey, true)
})

Deno.test('createQdrantCloudClient - Configuration check', () => {
  const client = createQdrantCloudClient('https://xyz.qdrant.tech', 'api-key')
  assertInstanceOf(client, QdrantClient)

  const info = client.getInfo()
  assertEquals(info.url, 'https://xyz.qdrant.tech')
  assertEquals(info.hasApiKey, true)
  assertEquals(info.timeout, 30000) // Default timeout
})

Deno.test('Factory functions - Return QdrantClient instances', () => {
  // All factory functions should return QdrantClient instances
  const client1 = createQdrantClient({ url: 'http://localhost:6333' })
  const client2 = createLocalQdrantClient()
  const client3 = createQdrantCloudClient('https://test.qdrant.tech', 'key')

  assertInstanceOf(client1, QdrantClient)
  assertInstanceOf(client2, QdrantClient)
  assertInstanceOf(client3, QdrantClient)
})