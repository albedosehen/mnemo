/**
 * Types and interfaces for Qdrant filtering and query operations
 * @module filters.types
 */

/**
 * Base filter condition for payload metadata
 */
export type FilterCondition = MatchFilter | RangeFilter | GeoBoundingBoxFilter | GeoRadiusFilter

/**
 * Match filter for exact value matching
 */
export interface MatchFilter {
  /** Match operation type */
  match: {
    /** Field name in payload */
    key: string
    /** Value to match (string, number, or boolean) */
    value: string | number | boolean
  }
}

/**
 * Range filter for numeric comparisons
 */
export interface RangeFilter {
  /** Range operation type */
  range: {
    /** Field name in payload */
    key: string
    /** Minimum value (inclusive) */
    gte?: number
    /** Maximum value (inclusive) */
    lte?: number
    /** Greater than (exclusive) */
    gt?: number
    /** Less than (exclusive) */
    lt?: number
  }
}

/**
 * Geographic bounding box filter
 */
export interface GeoBoundingBoxFilter {
  /** Geographic bounding box operation */
  geo_bounding_box: {
    /** Field name containing geo coordinates */
    key: string
    /** Bounding box coordinates */
    bounding_box: {
      /** Top-left corner */
      top_left: GeoPoint
      /** Bottom-right corner */
      bottom_right: GeoPoint
    }
  }
}

/**
 * Geographic radius filter
 */
export interface GeoRadiusFilter {
  /** Geographic radius operation */
  geo_radius: {
    /** Field name containing geo coordinates */
    key: string
    /** Center point */
    center: GeoPoint
    /** Radius in meters */
    radius: number
  }
}

/**
 * Geographic point coordinates
 */
export interface GeoPoint {
  /** Longitude coordinate */
  lon: number
  /** Latitude coordinate */
  lat: number
}

/**
 * Logical AND filter combination
 */
export interface AndFilter {
  /** Logical AND operation */
  must: FilterCondition[]
}

/**
 * Logical OR filter combination
 */
export interface OrFilter {
  /** Logical OR operation */
  should: FilterCondition[]
}

/**
 * Logical NOT filter negation
 */
export interface NotFilter {
  /** Logical NOT operation */
  must_not: FilterCondition[]
}

/**
 * Complex filter combining multiple conditions
 */
export type Filter = FilterCondition | AndFilter | OrFilter | NotFilter

/**
 * Search parameters for vector similarity queries
 */
export interface SearchParams {
  /** Query vector for similarity search */
  vector: number[]
  /** Maximum number of results to return */
  limit?: number
  /** Minimum score threshold for results */
  score_threshold?: number
  /** Filter conditions to apply */
  filter?: Filter
  /** Additional search parameters */
  params?: SearchQueryParams
  /** Whether to include vectors in response */
  with_vector?: boolean
  /** Whether to include payload in response */
  with_payload?: boolean
}

/**
 * Additional query parameters for search optimization
 */
export interface SearchQueryParams {
  /** Search quality vs speed trade-off (0.0 to 1.0) */
  hnsw_ef?: number
  /** Use exact search instead of approximate */
  exact?: boolean
  /** Quantization parameters */
  quantization?: QuantizationParams
}

/**
 * Quantization parameters for search optimization
 */
export interface QuantizationParams {
  /** Whether to ignore quantization */
  ignore?: boolean
  /** Whether to rescore using original vectors */
  rescore?: boolean
  /** Oversampling factor for rescoring */
  oversampling?: number
}

/**
 * Parameters for batch search operations
 */
export interface BatchSearchParams {
  /** Array of search queries */
  searches: SearchParams[]
}

/**
 * Scroll parameters for pagination
 */
export interface ScrollParams {
  /** Filter conditions */
  filter?: Filter
  /** Maximum number of results per page */
  limit?: number
  /** Whether to include vectors in response */
  with_vector?: boolean
  /** Whether to include payload in response */
  with_payload?: boolean
  /** Offset ID for pagination */
  offset?: string
}

/**
 * Count parameters for counting vectors
 */
export interface CountParams {
  /** Filter conditions to apply for counting */
  filter?: Filter
  /** Whether to return exact count */
  exact?: boolean
}

/**
 * Result from count operation
 */
export interface CountResult {
  /** Number of vectors matching the filter */
  count: number
}

/**
 * Recommendation parameters for finding similar vectors
 */
export interface RecommendParams {
  /** Positive example vector IDs */
  positive: string[]
  /** Negative example vector IDs */
  negative?: string[]
  /** Maximum number of results */
  limit?: number
  /** Filter conditions */
  filter?: Filter
  /** Additional search parameters */
  params?: SearchQueryParams
  /** Whether to include vectors in response */
  with_vector?: boolean
  /** Whether to include payload in response */
  with_payload?: boolean
}

/**
 * Update parameters for modifying vectors
 */
export interface UpdateParams {
  /** Filter to select vectors for update */
  filter?: Filter
  /** New payload values to set */
  payload?: Record<string, unknown>
}

/**
 * Delete parameters for removing vectors
 */
export interface DeleteParams {
  /** Vector IDs to delete */
  points?: string[]
  /** Filter to select vectors for deletion */
  filter?: Filter
}

/**
 * Validation error for filter operations
 */
export class FilterValidationError extends Error {
  /**
   * Create a new filter validation error
   * @param message - Error message describing the validation failure
   * @param filterType - Optional type of filter that failed validation
   * @param field - Optional field name that failed validation
   */
  constructor(
    message: string,
    public readonly filterType?: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'FilterValidationError'
  }
}
