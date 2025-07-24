/**
 * Test fixtures for vector data and embeddings
 * @module tests/fixtures/vectors
 */

/**
 * Sample vector embeddings for testing
 */
export const sampleVectors = {
  small: [0.1, 0.2, 0.3],
  
  // 12-dimensional
  medium: [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6,
    -0.1, -0.2, -0.3, -0.4, -0.5, -0.6
  ],
  
  // 1536-dimensional
  openai_standard: new Array(1536).fill(0).map((_, i) => Math.sin(i * 0.01)),
  
  // 1536-dimensional
  ada_002: new Array(1536).fill(0).map((_, i) => Math.cos(i * 0.02)),

  // 1536-dimensional
  embedding_3_small: new Array(1536).fill(0).map((_, i) => Math.sin(i * 0.015) * Math.cos(i * 0.025)),

  // 3072-dimensional
  embedding_3_large: new Array(3072).fill(0).map((_, i) => Math.sin(i * 0.005) * Math.cos(i * 0.01)),
  
  // Common Ollama embedding size (768-dimensional)
  ollama_standard: new Array(768).fill(0).map((_, i) => Math.sin(i * 0.02)),
  
  // Alternative embedding sizes
  dimension_512: new Array(512).fill(0).map((_, i) => Math.sin(i * 0.03)),
  dimension_384: new Array(384).fill(0).map((_, i) => Math.cos(i * 0.04)),
  dimension_256: new Array(256).fill(0).map((_, i) => Math.sin(i * 0.05) * 0.8),
  
  // Zero vectors
  zero_small: new Array(3).fill(0),
  zero_standard: new Array(768).fill(0),
  
  // Unit vectors
  unit_x: [1, 0, 0],
  unit_y: [0, 1, 0],
  unit_z: [0, 0, 1],
  
  // Normalized vectors for similarity
  normalized_a: [0.57735, 0.57735, 0.57735], // All components equal, normalized
  normalized_b: [0.7071, 0.7071, 0], // Two components equal, normalized
  
  // Similar vectors for testing high similarity
  similar_a: new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1)),
  similar_b: new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1) + 0.01), // slight difference
  
  // Dissimilar vectors for testing low similarity
  dissimilar_a: new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1)),
  dissimilar_b: new Array(768).fill(0).map((_, i) => Math.cos(i * 0.2)), // major difference
}

/**
 * Sample text content with expected embeddings
 */
export const textVectorPairs = [
  {
    text: "Hello world",
    vector: sampleVectors.small,
    expectedSimilarity: 0.95
  },
  {
    text: "Machine learning and artificial intelligence",
    vector: sampleVectors.medium,
    expectedSimilarity: 0.87
  },
  {
    text: "Vector database for semantic search",
    vector: sampleVectors.ollama_standard,
    expectedSimilarity: 0.92
  },
  {
    text: "Natural language processing with transformers",
    vector: sampleVectors.openai_standard,
    expectedSimilarity: 0.89
  },
  {
    text: "Deep learning neural networks",
    vector: sampleVectors.ada_002,
    expectedSimilarity: 0.91
  }
]

/**
 * Vector collections for batch testing
 */
export const vectorCollections = {
  smallBatch: [
    sampleVectors.small,
    sampleVectors.unit_x,
    sampleVectors.unit_y,
    sampleVectors.unit_z,
    sampleVectors.normalized_a
  ],
  
  mediumBatch: Array.from({ length: 10 }, (_, i) => 
    new Array(768).fill(0).map((_, j) => Math.sin((i + 1) * j * 0.01))
  ),
  
  largeBatch: Array.from({ length: 100 }, (_, i) => 
    new Array(768).fill(0).map((_, j) => Math.cos((i + 1) * j * 0.005))
  )
}

/**
 * Invalid vectors for error testing
 */
export const invalidVectors = {
  empty: [],
  withNaN: [0.1, NaN, 0.3],
  withInfinity: [0.1, Infinity, 0.3],
  withString: [0.1, "invalid" as any, 0.3],
  withNull: [0.1, null as any, 0.3],
  withUndefined: [0.1, undefined as any, 0.3],
  tooLarge: new Array(10000).fill(1), // unreasonable 1MB vector
}

/**
 * Helper functions for vector operations
 */
export const vectorUtils = {
  /**
   * Generate a random vector of specified dimension
   */
  generateRandom: (dimension: number): number[] => {
    return new Array(dimension).fill(0).map(() => Math.random() * 2 - 1)
  },
  
  /**
   * Generate a normalized random vector
   */
  generateNormalizedRandom: (dimension: number): number[] => {
    const vector = vectorUtils.generateRandom(dimension)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    return vector.map(val => val / magnitude)
  },
  
  /**
   * Create a vector with specific pattern for testing
   */
  createPattern: (dimension: number, pattern: 'sine' | 'cosine' | 'linear' | 'alternating'): number[] => {
    switch (pattern) {
      case 'sine':
        return new Array(dimension).fill(0).map((_, i) => Math.sin(i * 0.1))
      case 'cosine':
        return new Array(dimension).fill(0).map((_, i) => Math.cos(i * 0.1))
      case 'linear':
        return new Array(dimension).fill(0).map((_, i) => i / dimension)
      case 'alternating':
        return new Array(dimension).fill(0).map((_, i) => i % 2 === 0 ? 1 : -1)
      default:
        return new Array(dimension).fill(0)
    }
  },
  
  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity: (a: number[], b: number[]): number => {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}