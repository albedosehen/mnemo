/**
 * Main source export file for Mnemo.
 * All exports are explicit for public API clarity.
 * @module client
 */

export {
  type CreateCollectionConfig,
  createLocalQdrantClient,
  createQdrantClient,
  createQdrantCloudClient,
  DEFAULT_QDRANT_CONFIG,
  type DeletePointsRequest,
  type GetPointsRequest,
  type GetPointsResponse,
  QdrantClient,
  type QdrantPoint,
  type QdrantSearchResult,
  type SearchPointsRequest,
  type SearchPointsResponse,
  type UpsertPointsRequest,
  type UpsertPointsResponse,
} from './client.ts'

export {
  type CollectionInfo,
  type CollectionResponse,
  QdrantAuthenticationError,
  type QdrantClientOptions,
  QdrantConnectionError,
  QdrantError,
  QdrantValidationError,
  type SearchQuery,
  type SearchResult,
  type VectorRecord,
} from './client.types.ts'

export type {
  AndFilter,
  BatchSearchParams,
  CountParams,
  CountResult,
  DeleteParams,
  Filter,
  FilterCondition,
  FilterValidationError,
  GeoBoundingBoxFilter,
  GeoPoint,
  GeoRadiusFilter,
  MatchFilter,
  NotFilter,
  OrFilter,
  QuantizationParams,
  RangeFilter,
  RecommendParams,
  ScrollParams,
  SearchParams,
  SearchQueryParams,
  UpdateParams,
} from './filters.types.ts'

export {
  combineFiltersAnd,
  combineFiltersOr,
  createEqualityFilter,
  createFilter,
  createRangeFilter,
  FieldFilter,
  FilterBuilder,
  isEmptyFilter,
  negateFilter,
  serializeFilter,
  validateFilterCondition,
} from './filters.ts'
