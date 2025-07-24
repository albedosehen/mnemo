/**
 * Test fixtures for complete document data combining vectors and metadata
 * @module tests/fixtures/documents
 */

import { sampleVectors, vectorUtils, invalidVectors } from './vectors.ts'
import { sampleMetadata } from './metadata.ts'
import type { VectorRecord } from '../../src/client/client.types.ts'

/**
 * Document fixtures
 */
export const sampleDocuments: Record<string, VectorRecord> = {
  techNews: {
    id: 'doc:news:tech:001',
    vector: sampleVectors.ollama_standard,
    payload: {
      ...sampleMetadata.newsArticle,
      vectorModel: 'ollama-embedding',
      vectorDimensions: 768,
    }
  },
  researchPaper: {
    id: 'doc:research:ml:001',
    vector: sampleVectors.openai_standard,
    payload: {
      ...sampleMetadata.researchPaper,
      vectorModel: 'text-embedding-ada-002',
      vectorDimensions: 1536,
    }
  },

  blogPost: {
    id: 'doc:blog:user:001',
    vector: sampleVectors.embedding_3_small,
    payload: {
      ...sampleMetadata.userContent,
      vectorModel: 'text-embedding-3-small',
      vectorDimensions: 1536,
    }
  },

  productDoc: {
    id: 'doc:product:info:001',
    vector: sampleVectors.dimension_512,
    payload: {
      ...sampleMetadata.product,
      vectorModel: 'custom-embedding-512',
      vectorDimensions: 512,
    }
  },

  supportTicket: {
    id: 'doc:support:ticket:001',
    vector: sampleVectors.medium,
    payload: {
      ...sampleMetadata.supportTicket,
      vectorModel: 'mini-embedding',
      vectorDimensions: 12,
    }
  },

  email: {
    id: 'doc:email:team:001',
    vector: sampleVectors.dimension_384,
    payload: {
      ...sampleMetadata.email,
      vectorModel: 'sentence-transformer-384',
      vectorDimensions: 384,
    }
  },

  socialPost: {
    id: 'doc:social:twitter:001',
    vector: sampleVectors.dimension_256,
    payload: {
      ...sampleMetadata.socialPost,
      vectorModel: 'social-embedding-256',
      vectorDimensions: 256,
    }
  },

  basicDoc: {
    id: 'doc:basic:001',
    vector: sampleVectors.small,
    payload: {
      ...sampleMetadata.basicDocument,
      vectorModel: 'test-embedding',
      vectorDimensions: 3,
    }
  }
}

/**
 * Document collections
 */
export const documentCollections = {
  small: [
    sampleDocuments.basicDoc,
    sampleDocuments.email,
    sampleDocuments.socialPost,
  ],
  medium: [
    sampleDocuments.techNews,
    sampleDocuments.researchPaper,
    sampleDocuments.blogPost,
    sampleDocuments.productDoc,
    sampleDocuments.supportTicket,
  ],
  mixedDimensions: [
    sampleDocuments.basicDoc,        // 3D
    sampleDocuments.supportTicket,   // 12D
    sampleDocuments.socialPost,      // 256D
    sampleDocuments.email,           // 384D
    sampleDocuments.productDoc,      // 512D
    sampleDocuments.blogPost,        // 1536D
    sampleDocuments.researchPaper,   // 1536D
  ],
  technology: [
    sampleDocuments.techNews,
    sampleDocuments.researchPaper,
    sampleDocuments.blogPost,
    sampleDocuments.productDoc,
  ],
  communication: [
    sampleDocuments.email,
    sampleDocuments.socialPost,
    sampleDocuments.supportTicket,
  ],
}

/**
 * Generated document collections for performance testing
 */
export const generatedCollections = {
  /**
   * Generate a collection of documents for performance testing
   */
  generate: (count: number, options: {
    vectorDimensions?: number
    vectorModel?: string
    contentTypes?: string[]
    includeMetadata?: boolean
  } = {}): VectorRecord[] => {
    const {
      vectorDimensions = 768,
      vectorModel = 'test-embedding',
      contentTypes = ['news', 'blog', 'research', 'product'],
      includeMetadata = true
    } = options

    return Array.from({ length: count }, (_, i) => {
      const contentType = contentTypes[i % contentTypes.length]
      const vector = vectorUtils.generateNormalizedRandom(vectorDimensions)
      
      let payload: Record<string, any> = {
        vectorModel,
        vectorDimensions,
      }

      if (includeMetadata) {
        payload = {
          ...payload,
          title: `Generated ${contentType} document ${i}`,
          content: `This is generated content for ${contentType} document number ${i}. It contains sample text for testing purposes.`,
          type: contentType,
          category: ['technology', 'science', 'business', 'health'][i % 4],
          index: i,
          generatedAt: new Date().toISOString(),
          score: Math.random(),
          tags: [`tag_${i % 10}`, `type_${contentType}`],
        }
      }

      return {
        id: `generated:${contentType}:${i.toString().padStart(6, '0')}`,
        vector,
        payload,
      }
    })
  },

  /**
   * Generate documents with similar content for similarity testing
   */
  generateSimilar: (baseText: string, variations: number, vectorDimensions = 768): VectorRecord[] => {
    const baseVector = vectorUtils.createPattern(vectorDimensions, 'sine')
    
    return Array.from({ length: variations }, (_, i) => {
      const vector = baseVector.map(val => val + (Math.random() - 0.5) * 0.1)
      
      return {
        id: `similar:${i.toString().padStart(3, '0')}`,
        vector,
        payload: {
          title: `${baseText} - Variation ${i}`,
          content: `${baseText} with slight variation ${i}`,
          type: 'similar',
          variation: i,
          baseText,
          similarity: 0.9 + Math.random() * 0.1, // High similarity
          vectorModel: 'similarity-test',
          vectorDimensions,
        }
      }
    })
  },

  /**
   * Generate documents with diverse content for diversity testing
   */
  generateDiverse: (count: number, vectorDimensions = 768): VectorRecord[] => {
    const patterns = ['sine', 'cosine', 'linear', 'alternating'] as const
    
    return Array.from({ length: count }, (_, i) => {
      const pattern = patterns[i % patterns.length]
      const vector = vectorUtils.createPattern(vectorDimensions, pattern)
      
      return {
        id: `diverse:${pattern}:${i.toString().padStart(3, '0')}`,
        vector,
        payload: {
          title: `Diverse Document ${i} - ${pattern} pattern`,
          content: `This document uses ${pattern} pattern for vector generation`,
          type: 'diverse',
          pattern,
          diversity: Math.random(),
          vectorModel: 'diversity-test',
          vectorDimensions,
        }
      }
    })
  }
}

/**
 * Search scenarios
 */
export const searchScenarios = {
  technologySearch: {
    query: "artificial intelligence machine learning",
    expectedVector: sampleVectors.ollama_standard,
    expectedResults: [
      { id: sampleDocuments.techNews.id, minScore: 0.8 },
      { id: sampleDocuments.researchPaper.id, minScore: 0.7 },
      { id: sampleDocuments.blogPost.id, minScore: 0.6 },
    ],
    filters: {
      category: "technology",
      type: ["news", "research", "blog"]
    }
  },

  productSearch: {
    query: "vector database software",
    expectedVector: sampleVectors.dimension_512,
    expectedResults: [
      { id: sampleDocuments.productDoc.id, minScore: 0.9 },
    ],
    filters: {
      type: "product"
    }
  },

  supportSearch: {
    query: "API integration problem timeout",
    expectedVector: sampleVectors.medium,
    expectedResults: [
      { id: sampleDocuments.supportTicket.id, minScore: 0.8 },
    ],
    filters: {
      type: "support",
      priority: ["high", "medium"]
    }
  },

  communicationSearch: {
    query: "meeting project update team",
    expectedVector: sampleVectors.dimension_384,
    expectedResults: [
      { id: sampleDocuments.email.id, minScore: 0.7 },
    ],
    filters: {
      type: ["email", "social"]
    }
  }
}

/**
 * Batch operation test data
 */
export const batchTestData = {
  smallBatch: documentCollections.small,
  mediumBatch: generatedCollections.generate(50, {
    vectorDimensions: 768,
    vectorModel: 'batch-test-768',
    contentTypes: ['news', 'blog', 'research'],
  }),
  largeBatch: generatedCollections.generate(500, {
    vectorDimensions: 1536,
    vectorModel: 'stress-test-1536',
    contentTypes: ['news', 'blog', 'research', 'product', 'support'],
  }),
  mixedDimensionBatch: [
    ...generatedCollections.generate(10, { vectorDimensions: 256 }),
    ...generatedCollections.generate(10, { vectorDimensions: 512 }),
    ...generatedCollections.generate(10, { vectorDimensions: 768 }),
    ...generatedCollections.generate(10, { vectorDimensions: 1536 }),
  ]
}

/**
 * Error test cases with invalid documents
 */
export const errorTestCases = {
  invalidDocuments: [
    { id: '', vector: sampleVectors.small, payload: {} },
    { id: 'valid-id', vector: [], payload: {} },
    { id: 'valid-id', vector: sampleVectors.small, payload: null as any },
    { id: 'invalid-vector-1', vector: invalidVectors.withNaN, payload: {} },
    { id: 'invalid-vector-2', vector: invalidVectors.withInfinity, payload: {} },
    { id: 'invalid-vector-3', vector: invalidVectors.withString, payload: {} },
    {
      id: 'large-payload',
      vector: sampleVectors.small,
      payload: {
        largeText: 'x'.repeat(1000000), // 1MB of text
        type: 'stress'
      }
    }
  ],

  dimensionMismatches: [
    { id: 'dim-3', vector: sampleVectors.small, payload: { expectedDim: 768 } },
    { id: 'dim-768', vector: sampleVectors.ollama_standard, payload: { expectedDim: 1536 } },
    { id: 'dim-1536', vector: sampleVectors.openai_standard, payload: { expectedDim: 512 } },
  ]
}

/**
 * Utility functions for document operations
 */
export const documentUtils = {
  /**
   * Create a document with current timestamp
   */
  withTimestamp: (base: Omit<VectorRecord, 'payload'> & { payload?: Record<string, any> }): VectorRecord => ({
    ...base,
    payload: {
      ...base.payload,
      createdAt: new Date().toISOString(),
    }
  }),

  /**
   * Validate document structure
   */
  isValidDocument: (doc: any): doc is VectorRecord => {
    return doc &&
           typeof doc.id === 'string' &&
           doc.id.length > 0 &&
           Array.isArray(doc.vector) &&
           doc.vector.length > 0 &&
           doc.vector.every((val: any) => typeof val === 'number' && !isNaN(val) && isFinite(val)) &&
           (doc.payload === undefined || (typeof doc.payload === 'object' && doc.payload !== null))
  },

  /**
   * Calculate document similarity based on vector cosine similarity
   */
  calculateSimilarity: (doc1: VectorRecord, doc2: VectorRecord): number => {
    return vectorUtils.cosineSimilarity(doc1.vector, doc2.vector)
  },

  /**
   * Filter documents by payload criteria
   */
  filterByPayload: (docs: VectorRecord[], criteria: Record<string, any>): VectorRecord[] => {
    return docs.filter(doc => {
      if (!doc.payload) return false
      
      return Object.entries(criteria).every(([key, value]) => {
        const docValue = doc.payload![key]
        if (Array.isArray(value)) {
          return value.includes(docValue)
        }
        return docValue === value
      })
    })
  },

  /**
   * Sort documents by similarity to a query vector
   */
  sortBySimilarity: (docs: VectorRecord[], queryVector: number[]): VectorRecord[] => {
    return docs
      .map(doc => ({
        doc,
        similarity: vectorUtils.cosineSimilarity(doc.vector, queryVector)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .map(item => item.doc)
  }
}