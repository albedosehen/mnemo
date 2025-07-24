/**
 * Filter builder and utilities for Qdrant query operations
 * @module filters
 */

import type {
  AndFilter,
  Filter,
  FilterCondition,
  GeoPoint,
  MatchFilter,
  NotFilter,
  OrFilter,
  RangeFilter,
} from './filters.types.ts'
import { FilterValidationError } from './filters.types.ts'

/**
 * Filter builder for creating type-safe Qdrant filter queries
 *
 * Provides a fluent API for constructing complex filter conditions
 * that are compatible with Qdrant's filter syntax.
 *
 * @example
 * ```typescript
 * const filter = new FilterBuilder()
 *   .where('ticker').equals('NVDA')
 *   .and()
 *   .where('sentiment').greaterThan(0.7)
 *   .build()
 * ```
 */
export class FilterBuilder {
  private conditions: FilterCondition[] = []
  private logicalOperator: 'must' | 'should' | 'must_not' = 'must'

  /**
   * Start a new filter condition for a specific field
   * @param field - The payload field name to filter on
   * @returns FieldFilter instance for chaining conditions
   */
  where(field: string): FieldFilter {
    return new FieldFilter(field, this)
  }

  /**
   * Add a pre-built filter condition
   * @param condition - Filter condition to add
   * @returns This FilterBuilder instance for chaining
   */
  addCondition(condition: Filter): FilterBuilder {
    this.conditions.push(condition as unknown as FilterCondition)
    return this
  }

  /**
   * Set logical operator to AND (must) for subsequent conditions
   * @returns This FilterBuilder instance for chaining
   */
  and(): FilterBuilder {
    this.logicalOperator = 'must'
    return this
  }

  /**
   * Set logical operator to OR (should) for subsequent conditions
   * @returns This FilterBuilder instance for chaining
   */
  or(): FilterBuilder {
    this.logicalOperator = 'should'
    return this
  }

  /**
   * Set logical operator to NOT (must_not) for subsequent conditions
   * @returns This FilterBuilder instance for chaining
   */
  not(): FilterBuilder {
    this.logicalOperator = 'must_not'
    return this
  }

  /**
   * Combine multiple filter builders with AND logic
   * @param builders - Array of FilterBuilder instances
   * @returns This FilterBuilder instance for chaining
   */
  andAll(...builders: FilterBuilder[]): FilterBuilder {
    for (const builder of builders) {
      const filter = builder.build()
      if (filter) {
        this.conditions.push(filter as FilterCondition)
      }
    }
    return this
  }

  /**
   * Combine multiple filter builders with OR logic
   * @param builders - Array of FilterBuilder instances
   * @returns This FilterBuilder instance for chaining
   */
  orAny(...builders: FilterBuilder[]): FilterBuilder {
    const orConditions: FilterCondition[] = []
    for (const builder of builders) {
      const filter = builder.build()
      if (filter) {
        orConditions.push(filter as FilterCondition)
      }
    }
    if (orConditions.length > 0) {
      this.conditions.push({ should: orConditions } as unknown as FilterCondition)
    }
    return this
  }

  /**
   * Build the final filter object
   * @returns Complete Filter object or null if no conditions
   */
  build(): Filter | null {
    if (this.conditions.length === 0) {
      return null
    }

    if (this.conditions.length === 1) {
      return this.conditions[0]
    }

    // Return composite filter based on logical operator
    switch (this.logicalOperator) {
      case 'must':
        return { must: this.conditions } as AndFilter
      case 'should':
        return { should: this.conditions } as OrFilter
      case 'must_not':
        return { must_not: this.conditions } as NotFilter
      default:
        return { must: this.conditions } as AndFilter
    }
  }

  /**
   * Validate the current filter structure
   * @throws {FilterValidationError} When validation fails
   */
  validate(): void {
    if (this.conditions.length === 0) {
      throw new FilterValidationError('Filter must have at least one condition')
    }

    for (const condition of this.conditions) {
      validateFilterCondition(condition)
    }
  }
}

/**
 * Field-specific filter builder for creating conditions on a single field
 */
export class FieldFilter {
  /**
   * Create a new field filter for a specific field
   * @param field - Field name to create conditions for
   * @param builder - Parent FilterBuilder instance for chaining
   */
  constructor(
    private readonly field: string,
    private readonly builder: FilterBuilder,
  ) {}

  /**
   * Create an equality match condition
   * @param value - Value to match exactly
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('status').equals('active')
   * ```
   */
  equals(value: string | number | boolean): FilterBuilder {
    const condition: MatchFilter = {
      match: {
        key: this.field,
        value,
      },
    }
    return this.builder.addCondition(condition)
  }

  /**
   * Create a not-equals condition (inverted match)
   * @param value - Value to exclude
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('type').notEquals('deleted')
   * ```
   */
  notEquals(value: string | number | boolean): FilterBuilder {
    const condition: MatchFilter = {
      match: {
        key: this.field,
        value,
      },
    }
    // Wrap in NOT logic
    const notCondition: NotFilter = {
      must_not: [condition],
    }
    return this.builder.addCondition(notCondition as unknown as FilterCondition)
  }

  /**
   * Create a greater-than condition
   * @param value - Minimum value (exclusive)
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('price').greaterThan(100)
   * ```
   */
  greaterThan(value: number): FilterBuilder {
    const condition: RangeFilter = {
      range: {
        key: this.field,
        gt: value,
      },
    }
    return this.builder.addCondition(condition)
  }

  /**
   * Create a greater-than-or-equal condition
   * @param value - Minimum value (inclusive)
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('score').greaterThanOrEqual(0.5)
   * ```
   */
  greaterThanOrEqual(value: number): FilterBuilder {
    const condition: RangeFilter = {
      range: {
        key: this.field,
        gte: value,
      },
    }
    return this.builder.addCondition(condition)
  }

  /**
   * Create a less-than condition
   * @param value - Maximum value (exclusive)
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('timestamp').lessThan(Date.now())
   * ```
   */
  lessThan(value: number): FilterBuilder {
    const condition: RangeFilter = {
      range: {
        key: this.field,
        lt: value,
      },
    }
    return this.builder.addCondition(condition)
  }

  /**
   * Create a less-than-or-equal condition
   * @param value - Maximum value (inclusive)
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('age').lessThanOrEqual(65)
   * ```
   */
  lessThanOrEqual(value: number): FilterBuilder {
    const condition: RangeFilter = {
      range: {
        key: this.field,
        lte: value,
      },
    }
    return this.builder.addCondition(condition)
  }

  /**
   * Create a range condition (between two values)
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('price').inRange(100, 200)
   * ```
   */
  inRange(min: number, max: number): FilterBuilder {
    if (min > max) {
      throw new FilterValidationError('Range minimum cannot be greater than maximum', 'range', this.field)
    }

    const condition: RangeFilter = {
      range: {
        key: this.field,
        gte: min,
        lte: max,
      },
    }
    return this.builder.addCondition(condition)
  }

  /**
   * Create a text matching condition (alias for equals with string values)
   * @param text - Text to match
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('source').matches('WSJ')
   * ```
   */
  matches(text: string): FilterBuilder {
    return this.equals(text)
  }

  /**
   * Create a condition checking if field contains a value (for array fields)
   * @param value - Value that should be contained in the array
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('tags').contains('earnings')
   * ```
   */
  contains(value: string | number | boolean): FilterBuilder {
    // In Qdrant, array containment is handled via match
    return this.equals(value)
  }

  /**
   * Create a geographic bounding box condition
   * @param topLeft - Top-left corner coordinates
   * @param bottomRight - Bottom-right corner coordinates
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('location').inBoundingBox(
   *   { lat: 40.8, lon: -74.0 },
   *   { lat: 40.7, lon: -73.9 }
   * )
   * ```
   */
  inBoundingBox(topLeft: GeoPoint, bottomRight: GeoPoint): FilterBuilder {
    const condition = {
      geo_bounding_box: {
        key: this.field,
        bounding_box: {
          top_left: topLeft,
          bottom_right: bottomRight,
        },
      },
    }
    return this.builder.addCondition(condition as FilterCondition)
  }

  /**
   * Create a geographic radius condition
   * @param center - Center point coordinates
   * @param radiusMeters - Radius in meters
   * @returns The parent FilterBuilder for chaining
   *
   * @example
   * ```typescript
   * filter.where('location').withinRadius(
   *   { lat: 40.7589, lon: -73.9851 },
   *   1000
   * )
   * ```
   */
  withinRadius(center: GeoPoint, radiusMeters: number): FilterBuilder {
    if (radiusMeters <= 0) {
      throw new FilterValidationError('Radius must be positive', 'geo_radius', this.field)
    }

    const condition = {
      geo_radius: {
        key: this.field,
        center,
        radius: radiusMeters,
      },
    }
    return this.builder.addCondition(condition as FilterCondition)
  }
}

/**
 * Validate a filter condition structure
 * @param condition - Filter condition to validate
 * @throws {FilterValidationError} When validation fails
 */
export function validateFilterCondition(condition: FilterCondition): void {
  if (!condition || typeof condition !== 'object') {
    throw new FilterValidationError('Filter condition must be an object')
  }

  // Check for match filter
  if ('match' in condition) {
    const match = condition.match
    if (!match.key || typeof match.key !== 'string') {
      throw new FilterValidationError('Match filter must have a valid key', 'match')
    }
    if (match.value === undefined || match.value === null) {
      throw new FilterValidationError('Match filter must have a value', 'match', match.key)
    }
  }

  // Check for range filter
  if ('range' in condition) {
    const range = condition.range
    if (!range.key || typeof range.key !== 'string') {
      throw new FilterValidationError('Range filter must have a valid key', 'range')
    }

    const hasCondition = range.gte !== undefined || range.lte !== undefined ||
      range.gt !== undefined || range.lt !== undefined

    if (!hasCondition) {
      throw new FilterValidationError('Range filter must have at least one condition', 'range', range.key)
    }

    // Validate numeric values
    const values = [range.gte, range.lte, range.gt, range.lt].filter((v) => v !== undefined)
    for (const value of values) {
      if (typeof value !== 'number' || !isFinite(value)) {
        throw new FilterValidationError('Range filter values must be finite numbers', 'range', range.key)
      }
    }
  }

  // Check for geographic filters
  if ('geo_bounding_box' in condition) {
    const geo = condition.geo_bounding_box
    if (!geo.key || typeof geo.key !== 'string') {
      throw new FilterValidationError('Geographic bounding box filter must have a valid key', 'geo_bounding_box')
    }
    validateGeoPoint(geo.bounding_box.top_left, 'top_left')
    validateGeoPoint(geo.bounding_box.bottom_right, 'bottom_right')
  }

  if ('geo_radius' in condition) {
    const geo = condition.geo_radius
    if (!geo.key || typeof geo.key !== 'string') {
      throw new FilterValidationError('Geographic radius filter must have a valid key', 'geo_radius')
    }
    validateGeoPoint(geo.center, 'center')
    if (typeof geo.radius !== 'number' || geo.radius <= 0) {
      throw new FilterValidationError('Geographic radius must be a positive number', 'geo_radius', geo.key)
    }
  }
}

/**
 * Validate a geographic point
 * @param point - Geographic point to validate
 * @param context - Context for error reporting
 * @throws {FilterValidationError} When validation fails
 */
function validateGeoPoint(point: GeoPoint, context: string): void {
  if (!point || typeof point !== 'object') {
    throw new FilterValidationError(`Geographic point ${context} must be an object`)
  }

  if (typeof point.lat !== 'number' || !isFinite(point.lat)) {
    throw new FilterValidationError(`Geographic point ${context} latitude must be a finite number`)
  }

  if (typeof point.lon !== 'number' || !isFinite(point.lon)) {
    throw new FilterValidationError(`Geographic point ${context} longitude must be a finite number`)
  }

  if (point.lat < -90 || point.lat > 90) {
    throw new FilterValidationError(`Geographic point ${context} latitude must be between -90 and 90`)
  }

  if (point.lon < -180 || point.lon > 180) {
    throw new FilterValidationError(`Geographic point ${context} longitude must be between -180 and 180`)
  }
}

/**
 * Helper function to create a simple equality filter
 * @param field - Field name to filter on
 * @param value - Value to match
 * @returns Complete filter object
 *
 * @example
 * ```typescript
 * const filter = createEqualityFilter('status', 'active')
 * ```
 */
export function createEqualityFilter(field: string, value: string | number | boolean): Filter {
  return {
    match: {
      key: field,
      value,
    },
  } as MatchFilter
}

/**
 * Helper function to create a simple range filter
 * @param field - Field name to filter on
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Complete filter object
 *
 * @example
 * ```typescript
 * const filter = createRangeFilter('price', 100, 200)
 * ```
 */
export function createRangeFilter(field: string, min?: number, max?: number): Filter {
  const range: { key: string; gte?: number; lte?: number } = { key: field }

  if (min !== undefined) {
    range.gte = min
  }
  if (max !== undefined) {
    range.lte = max
  }

  if (min === undefined && max === undefined) {
    throw new FilterValidationError('Range filter must have at least min or max value', 'range', field)
  }

  return {
    range,
  } as RangeFilter
}

/**
 * Helper function to combine multiple filters with AND logic
 * @param filters - Array of filter conditions to combine
 * @returns Combined filter with AND logic
 *
 * @example
 * ```typescript
 * const combined = combineFiltersAnd([
 *   createEqualityFilter('type', 'news'),
 *   createRangeFilter('sentiment', 0.5, 1.0)
 * ])
 * ```
 */
export function combineFiltersAnd(filters: Filter[]): Filter {
  if (filters.length === 0) {
    throw new FilterValidationError('Cannot combine empty filter array')
  }

  if (filters.length === 1) {
    return filters[0]
  }

  return {
    must: filters as FilterCondition[],
  } as AndFilter
}

/**
 * Helper function to combine multiple filters with OR logic
 * @param filters - Array of filter conditions to combine
 * @returns Combined filter with OR logic
 *
 * @example
 * ```typescript
 * const combined = combineFiltersOr([
 *   createEqualityFilter('type', 'news'),
 *   createEqualityFilter('type', 'analysis')
 * ])
 * ```
 */
export function combineFiltersOr(filters: Filter[]): Filter {
  if (filters.length === 0) {
    throw new FilterValidationError('Cannot combine empty filter array')
  }

  if (filters.length === 1) {
    return filters[0]
  }

  return {
    should: filters as FilterCondition[],
  } as OrFilter
}

/**
 * Helper function to negate a filter with NOT logic
 * @param filter - Filter to negate
 * @returns Negated filter
 *
 * @example
 * ```typescript
 * const negated = negateFilter(createEqualityFilter('status', 'deleted'))
 * ```
 */
export function negateFilter(filter: Filter): Filter {
  return {
    must_not: [filter as FilterCondition],
  } as NotFilter
}

/**
 * Serialize a filter to JSON string for debugging
 * @param filter - Filter to serialize
 * @returns JSON representation of the filter
 */
export function serializeFilter(filter: Filter): string {
  return JSON.stringify(filter, null, 2)
}

/**
 * Check if a filter is empty (has no conditions)
 * @param filter - Filter to check
 * @returns True if filter is empty or null
 */
export function isEmptyFilter(filter: Filter | null | undefined): boolean {
  if (!filter) {
    return true
  }

  if ('must' in filter) {
    return filter.must.length === 0
  }

  if ('should' in filter) {
    return filter.should.length === 0
  }

  if ('must_not' in filter) {
    return filter.must_not.length === 0
  }

  return false
}

/**
 * Create a new FilterBuilder instance
 * @returns New FilterBuilder for chaining
 *
 * @example
 * ```typescript
 * const filter = createFilter()
 *   .where('ticker').equals('NVDA')
 *   .and()
 *   .where('sentiment').greaterThan(0.7)
 *   .build()
 * ```
 */
export function createFilter(): FilterBuilder {
  return new FilterBuilder()
}
