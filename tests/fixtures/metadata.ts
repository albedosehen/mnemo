/**
 * Test fixtures for metadata objects and payload data
 * @module tests/fixtures/metadata
 */

/**
 * Sample metadata payloads for different content types
 */
export const sampleMetadata = {
  basicDocument: {
    title: "Sample Document",
    content: "This is a sample document for testing purposes.",
    type: "document",
    created: new Date("2024-01-15T10:30:00Z").toISOString(),
    updated: new Date("2024-01-16T14:20:00Z").toISOString(),
  },
  newsArticle: {
    title: "AI Technology Breakthrough",
    content: "Scientists announce major breakthrough in artificial intelligence research.",
    type: "news",
    category: "technology",
    source: "Tech News Daily",
    author: "Dr. Jane Smith",
    publishedAt: new Date("2024-01-10T09:00:00Z").toISOString(),
    url: "https://technews.example.com/ai-breakthrough",
    sentiment: 0.8,
    tags: ["AI", "research", "breakthrough", "technology"],
  },
  researchPaper: {
    title: "Vector Similarity Search in High-Dimensional Spaces",
    content: "This paper presents novel approaches to efficient similarity search in vector databases.",
    type: "research",
    category: "computer-science",
    authors: ["Dr. Alice Johnson", "Dr. Bob Wilson"],
    journal: "Journal of Machine Learning Research",
    year: 2024,
    doi: "10.1234/jmlr.2024.001",
    abstract: "We propose new methods for approximate nearest neighbor search in high-dimensional vector spaces.",
    keywords: ["vector search", "similarity", "indexing", "machine learning"],
    citations: 42,
  },
  email: {
    subject: "Project Update Meeting",
    content: "Hi team, let's schedule a meeting to discuss the project updates for next week.",
    type: "email",
    from: "project.manager@company.com",
    to: ["team@company.com"],
    cc: ["director@company.com"],
    sentAt: new Date("2024-01-12T15:45:00Z").toISOString(),
    priority: "normal",
    labels: ["work", "meeting", "project"],
    hasAttachments: false,
  },
  socialPost: {
    content: "Excited to share our latest findings on vector embeddings! #MachineLearning #AI",
    type: "social",
    platform: "twitter",
    author: "@researcher_ai",
    authorId: "12345",
    postId: "987654321",
    postedAt: new Date("2024-01-08T12:30:00Z").toISOString(),
    likes: 156,
    retweets: 42,
    replies: 23,
    hashtags: ["MachineLearning", "AI"],
    mentions: [],
    isReply: false,
  },
  product: {
    name: "Vector Database Pro",
    description: "High-performance vector database for similarity search and AI applications.",
    type: "product",
    category: "software",
    price: 299.99,
    currency: "USD",
    sku: "VDB-PRO-001",
    brand: "VectorTech",
    inStock: true,
    rating: 4.8,
    reviewCount: 127,
    features: ["Fast similarity search", "Scalable architecture", "API integration"],
    tags: ["database", "vector", "AI", "search"],
  },
  supportTicket: {
    title: "Integration Issue with API",
    content: "Having trouble connecting to the vector search API. Getting timeout errors.",
    type: "support",
    ticketId: "SUPP-2024-001",
    priority: "high",
    status: "open",
    customer: "customer@example.com",
    assignedTo: "support@company.com",
    createdAt: new Date("2024-01-14T11:20:00Z").toISOString(),
    updatedAt: new Date("2024-01-14T16:45:00Z").toISOString(),
    category: "technical",
    tags: ["API", "timeout", "integration"],
  },
  userContent: {
    title: "My Experience with Vector Databases",
    content: "After working with vector databases for 6 months, here are my insights...",
    type: "blog",
    author: "John Developer",
    authorId: "user_456",
    publishedAt: new Date("2024-01-11T20:15:00Z").toISOString(),
    category: "technology",
    readTime: 8,
    viewCount: 1247,
    likeCount: 89,
    commentCount: 15,
    tags: ["databases", "vectors", "experience", "tutorial"],
    isPublic: true,
  },
}

/**
 * Filter test scenarios with metadata
 */
export const filterTestCases = {
  byType: {
    filter: { match: { key: "type", value: "news" } },
    expectedMatches: ["newsArticle"],
    description: "Filter by content type"
  },
  byCategory: {
    filter: { match: { key: "category", value: "technology" } },
    expectedMatches: ["newsArticle", "userContent"],
    description: "Filter by category"
  },
  byDateRange: {
    filter: {
      range: {
        key: "publishedAt",
        gte: "2024-01-10T00:00:00Z",
        lte: "2024-01-12T23:59:59Z"
      }
    },
    expectedMatches: ["newsArticle", "email", "userContent"],
    description: "Filter by date range"
  },
  bySentimentRange: {
    filter: {
      range: {
        key: "sentiment",
        gte: 0.7,
        lte: 1.0
      }
    },
    expectedMatches: ["newsArticle"],
    description: "Filter by sentiment range"
  },
  byTagContains: {
    filter: { match: { key: "tags", value: "AI" } },
    expectedMatches: ["newsArticle", "userContent"],
    description: "Filter by tag contains"
  },
  complexAnd: {
    filter: {
      must: [
        { match: { key: "type", value: "news" } },
        { range: { key: "sentiment", gte: 0.5 } }
      ]
    },
    expectedMatches: ["newsArticle"],
    description: "Complex AND filter"
  },
  complexOr: {
    filter: {
      should: [
        { match: { key: "type", value: "email" } },
        { match: { key: "type", value: "social" } }
      ]
    },
    expectedMatches: ["email", "socialPost"],
    description: "Complex OR filter"
  },
  notFilter: {
    filter: {
      must_not: [
        { match: { key: "type", value: "news" } }
      ]
    },
    expectedMatches: ["basicDocument", "researchPaper", "email", "socialPost", "product", "supportTicket", "userContent"],
    description: "NOT filter"
  }
}

/**
 * Metadata validation test cases
 */
export const validationTestCases = {
  valid: [
    sampleMetadata.basicDocument,
    sampleMetadata.newsArticle,
    sampleMetadata.researchPaper,
  ],

  invalid: [
    null,
    undefined,
    "not an object",
    123,
    [],
    { cyclicReference: {} },
  ],

  edge: [
    {},
    { onlyOneField: "value" },
    { nullValue: null },
    { undefinedValue: undefined },
    { arrayValue: [1, 2, 3] },
    { nestedObject: { deep: { value: "test" } } },
  ]
}

/**
 * Performance test metadata
 */
export const performanceTestData = {
  small: Array.from({ length: 10 }, (_, i) => ({
    id: `small_${i}`,
    title: `Small Document ${i}`,
    content: `This is small test document number ${i}`,
    type: "test",
    index: i,
    timestamp: new Date(Date.now() - i * 1000 * 60).toISOString(),
  })),
  medium: Array.from({ length: 100 }, (_, i) => ({
    id: `medium_${i}`,
    title: `Medium Document ${i}`,
    content: `This is medium test document number ${i} with more content than small documents`,
    type: i % 3 === 0 ? "news" : i % 3 === 1 ? "blog" : "research",
    category: i % 5 === 0 ? "technology" : i % 5 === 1 ? "science" : i % 5 === 2 ? "business" : i % 5 === 3 ? "health" : "education",
    index: i,
    score: Math.random(),
    timestamp: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
    tags: [`tag_${i % 10}`, `category_${i % 5}`],
  })),
  large: Array.from({ length: 1000 }, (_, i) => ({
    id: `large_${i}`,
    title: `Large Document ${i}`,
    content: `This is large test document number ${i} with extensive content for performance testing. It contains multiple sentences and various metadata fields to simulate real-world scenarios.`,
    type: i % 4 === 0 ? "news" : i % 4 === 1 ? "blog" : i % 4 === 2 ? "research" : "documentation",
    category: ["technology", "science", "business", "health", "education", "entertainment", "sports", "politics"][i % 8],
    priority: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
    index: i,
    score: Math.random(),
    views: Math.floor(Math.random() * 10000),
    likes: Math.floor(Math.random() * 1000),
    timestamp: new Date(Date.now() - i * 1000 * 60 * 30).toISOString(),
    tags: Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, j) => `tag_${(i + j) % 20}`),
    author: `author_${i % 50}`,
    location: ["USA", "UK", "Canada", "Australia", "Germany", "France", "Japan", "China"][i % 8],
  }))
}

/**
 * Helper functions for metadata operations
 */
export const metadataUtils = {
  /**
   * Create metadata with current timestamp
   */
  withCurrentTimestamp: (base: Record<string, any>): Record<string, any> => ({
    ...base,
    timestamp: new Date().toISOString(),
  }),

  /**
   * Create metadata with random values
   */
  withRandomValues: (template: Record<string, any>): Record<string, any> => {
    const result = { ...template }
    if ('score' in result && typeof result.score === 'number') {
      result.score = Math.random()
    }
    if ('views' in result && typeof result.views === 'number') {
      result.views = Math.floor(Math.random() * 10000)
    }
    if ('likes' in result && typeof result.likes === 'number') {
      result.likes = Math.floor(Math.random() * 1000)
    }
    return result
  },

  /**
   * Merge multiple metadata objects
   */
  merge: (...metadata: Record<string, any>[]): Record<string, any> => {
    return Object.assign({}, ...metadata)
  },

  /**
   * Validate metadata structure
   */
  isValid: (metadata: any): boolean => {
    return metadata !== null && 
           metadata !== undefined && 
           typeof metadata === 'object' && 
           !Array.isArray(metadata)
  }
}