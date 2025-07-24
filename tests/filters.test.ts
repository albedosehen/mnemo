/**
 * Tests for the filter system and builder
 * @module tests.filters
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  FilterBuilder,
  createFilter,
  createEqualityFilter,
  createRangeFilter,
  combineFiltersAnd,
  combineFiltersOr,
  negateFilter,
  serializeFilter,
  isEmptyFilter,
  validateFilterCondition,
} from '../src/filters.ts'
import { FilterValidationError } from '../src/filters.types.ts'

Deno.test('FilterBuilder - Basic equality filter', () => {
  const filter = new FilterBuilder()
    .where('ticker').equals('NVDA')
    .build()

  assertEquals(filter, {
    match: {
      key: 'ticker',
      value: 'NVDA',
    },
  })
})

Deno.test('FilterBuilder - Range filter', () => {
  const filter = new FilterBuilder()
    .where('price').greaterThan(100)
    .build()

  assertEquals(filter, {
    range: {
      key: 'price',
      gt: 100,
    },
  })
})

Deno.test('FilterBuilder - Complex AND filter', () => {
  const filter = new FilterBuilder()
    .where('ticker').equals('NVDA')
    .and()
    .where('sentiment').greaterThan(0.7)
    .build()

  const expected = {
    must: [
      {
        match: {
          key: 'ticker',
          value: 'NVDA',
        },
      },
      {
        range: {
          key: 'sentiment',
          gt: 0.7,
        },
      },
    ],
  }

  assertEquals(filter, expected)
})

Deno.test('FilterBuilder - OR filter combination', () => {
  const filter = new FilterBuilder()
    .or()
    .where('type').equals('news')
    .where('type').equals('analysis')
    .build()

  const expected = {
    should: [
      {
        match: {
          key: 'type',
          value: 'news',
        },
      },
      {
        match: {
          key: 'type',
          value: 'analysis',
        },
      },
    ],
  }

  assertEquals(filter, expected)
})

Deno.test('FilterBuilder - NOT filter', () => {
  const filter = new FilterBuilder()
    .where('status').notEquals('deleted')
    .build()

  const expected = {
    must_not: [
      {
        match: {
          key: 'status',
          value: 'deleted',
        },
      },
    ],
  }

  assertEquals(filter, expected)
})

Deno.test('FilterBuilder - Range between values', () => {
  const filter = new FilterBuilder()
    .where('price').inRange(100, 200)
    .build()

  assertEquals(filter, {
    range: {
      key: 'price',
      gte: 100,
      lte: 200,
    },
  })
})

Deno.test('FilterBuilder - Invalid range throws error', () => {
  assertThrows(
    () => {
      new FilterBuilder()
        .where('price').inRange(200, 100) // min > max
        .build()
    },
    FilterValidationError,
    'Range minimum cannot be greater than maximum',
  )
})

Deno.test('FilterBuilder - Geographic bounding box', () => {
  const filter = new FilterBuilder()
    .where('location').inBoundingBox(
      { lat: 40.8, lon: -74.0 },
      { lat: 40.7, lon: -73.9 },
    )
    .build()

  const expected = {
    geo_bounding_box: {
      key: 'location',
      bounding_box: {
        top_left: { lat: 40.8, lon: -74.0 },
        bottom_right: { lat: 40.7, lon: -73.9 },
      },
    },
  }

  assertEquals(filter, expected)
})

Deno.test('FilterBuilder - Geographic radius', () => {
  const filter = new FilterBuilder()
    .where('location').withinRadius(
      { lat: 40.7589, lon: -73.9851 },
      1000,
    )
    .build()

  const expected = {
    geo_radius: {
      key: 'location',
      center: { lat: 40.7589, lon: -73.9851 },
      radius: 1000,
    },
  }

  assertEquals(filter, expected)
})

Deno.test('FilterBuilder - Invalid radius throws error', () => {
  assertThrows(
    () => {
      new FilterBuilder()
        .where('location').withinRadius(
          { lat: 40.7589, lon: -73.9851 },
          -100, // negative radius
        )
        .build()
    },
    FilterValidationError,
    'Radius must be positive',
  )
})

Deno.test('FilterBuilder - Empty filter returns null', () => {
  const filter = new FilterBuilder().build()
  assertEquals(filter, null)
})

Deno.test('FilterBuilder - Complex nested filters', () => {
  const stockFilter = new FilterBuilder()
    .where('ticker').equals('NVDA')
    .and()
    .where('sentiment').greaterThan(0.7)

  const newsFilter = new FilterBuilder()
    .where('type').equals('news')
    .and()
    .where('source').matches('WSJ')

  const combinedFilter = new FilterBuilder()
    .andAll(stockFilter, newsFilter)
    .build()

  // Should create a complex filter combining both sub-filters
  assertEquals(typeof combinedFilter, 'object')
  assertEquals(combinedFilter !== null, true)
})

Deno.test('createFilter - Factory function', () => {
  const filter = createFilter()
    .where('ticker').equals('AAPL')
    .build()

  assertEquals(filter, {
    match: {
      key: 'ticker',
      value: 'AAPL',
    },
  })
})

Deno.test('createEqualityFilter - Helper function', () => {
  const filter = createEqualityFilter('status', 'active')

  assertEquals(filter, {
    match: {
      key: 'status',
      value: 'active',
    },
  })
})

Deno.test('createRangeFilter - Helper function', () => {
  const filter = createRangeFilter('price', 100, 200)

  assertEquals(filter, {
    range: {
      key: 'price',
      gte: 100,
      lte: 200,
    },
  })
})

Deno.test('createRangeFilter - Only minimum value', () => {
  const filter = createRangeFilter('price', 100, undefined)

  assertEquals(filter, {
    range: {
      key: 'price',
      gte: 100,
    },
  })
})

Deno.test('createRangeFilter - Only maximum value', () => {
  const filter = createRangeFilter('price', undefined, 200)

  assertEquals(filter, {
    range: {
      key: 'price',
      lte: 200,
    },
  })
})

Deno.test('createRangeFilter - No values throws error', () => {
  assertThrows(
    () => createRangeFilter('price', undefined, undefined),
    FilterValidationError,
    'Range filter must have at least min or max value',
  )
})

Deno.test('combineFiltersAnd - Multiple filters', () => {
  const filter1 = createEqualityFilter('type', 'news')
  const filter2 = createRangeFilter('sentiment', 0.5, 1.0)
  
  const combined = combineFiltersAnd([filter1, filter2])

  const expected = {
    must: [
      {
        match: {
          key: 'type',
          value: 'news',
        },
      },
      {
        range: {
          key: 'sentiment',
          gte: 0.5,
          lte: 1.0,
        },
      },
    ],
  }

  assertEquals(combined, expected)
})

Deno.test('combineFiltersOr - Multiple filters', () => {
  const filter1 = createEqualityFilter('type', 'news')
  const filter2 = createEqualityFilter('type', 'analysis')
  
  const combined = combineFiltersOr([filter1, filter2])

  const expected = {
    should: [
      {
        match: {
          key: 'type',
          value: 'news',
        },
      },
      {
        match: {
          key: 'type',
          value: 'analysis',
        },
      },
    ],
  }

  assertEquals(combined, expected)
})

Deno.test('negateFilter - NOT operation', () => {
  const filter = createEqualityFilter('status', 'deleted')
  const negated = negateFilter(filter)

  const expected = {
    must_not: [
      {
        match: {
          key: 'status',
          value: 'deleted',
        },
      },
    ],
  }

  assertEquals(negated, expected)
})

Deno.test('serializeFilter - JSON serialization', () => {
  const filter = createEqualityFilter('ticker', 'NVDA')
  const serialized = serializeFilter(filter)
  
  assertEquals(typeof serialized, 'string')
  assertEquals(JSON.parse(serialized), filter)
})

Deno.test('isEmptyFilter - Detects empty filters', () => {
  assertEquals(isEmptyFilter(null), true)
  assertEquals(isEmptyFilter(undefined), true)
  assertEquals(isEmptyFilter({ must: [] }), true)
  assertEquals(isEmptyFilter({ should: [] }), true)
  assertEquals(isEmptyFilter({ must_not: [] }), true)
  
  const nonEmpty = createEqualityFilter('ticker', 'NVDA')
  assertEquals(isEmptyFilter(nonEmpty), false)
})

Deno.test('validateFilterCondition - Valid match filter', () => {
  const filter = {
    match: {
      key: 'ticker',
      value: 'NVDA',
    },
  }

  // Should not throw
  validateFilterCondition(filter)
})

Deno.test('validateFilterCondition - Valid range filter', () => {
  const filter = {
    range: {
      key: 'price',
      gte: 100,
      lte: 200,
    },
  }

  // Should not throw
  validateFilterCondition(filter)
})

Deno.test('validateFilterCondition - Invalid filter throws error', () => {
  assertThrows(
    () => validateFilterCondition(null as unknown as never),
    FilterValidationError,
    'Filter condition must be an object',
  )
})

Deno.test('validateFilterCondition - Match filter missing key', () => {
  const filter = {
    match: {
      value: 'NVDA',
    },
  }

  assertThrows(
    () => validateFilterCondition(filter as never),
    FilterValidationError,
    'Match filter must have a valid key',
  )
})

Deno.test('validateFilterCondition - Range filter missing conditions', () => {
  const filter = {
    range: {
      key: 'price',
    },
  }

  assertThrows(
    () => validateFilterCondition(filter as never),
    FilterValidationError,
    'Range filter must have at least one condition',
  )
})

Deno.test('validateFilterCondition - Geographic filter validation', () => {
  const validGeoFilter = {
    geo_radius: {
      key: 'location',
      center: { lat: 40.7589, lon: -73.9851 },
      radius: 1000,
    },
  }

  // Should not throw
  validateFilterCondition(validGeoFilter)

  const invalidGeoFilter = {
    geo_radius: {
      key: 'location',
      center: { lat: 200, lon: -73.9851 }, // Invalid latitude
      radius: 1000,
    },
  }

  assertThrows(
    () => validateFilterCondition(invalidGeoFilter),
    FilterValidationError,
    'latitude must be between -90 and 90',
  )
})

Deno.test('FilterBuilder - Fluent API chaining', () => {
  const filter = createFilter()
    .where('ticker').equals('NVDA')
    .and()
    .where('sentiment').greaterThanOrEqual(0.5)
    .and()
    .where('timestamp').lessThan(Date.now())
    .and()
    .where('price').inRange(500, 1000)
    .build()

  // Should create a complex filter with multiple conditions
  assertEquals(typeof filter, 'object')
  assertEquals(filter !== null, true)
  
  if (filter && 'must' in filter) {
    assertEquals(filter.must.length, 4)
  }
})