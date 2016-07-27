/* eslint-env mocha */

import {expect} from 'chai'
import leche from 'leche'

import {
  crossProduct,
  thunkToArray,
  vectorToObject
} from './job-executor'

describe('vectorToObject', function () {
  leche.withData({
    'Two sets of one': [
      {a: 1, b: 2}, {a: 1}, {b: 2}
    ],
    'Two sets of two': [
      {a: 1, b: 2, c: 3, d: 4}, {a: 1, b: 2}, {c: 3, d: 4}
    ],
    'Three sets': [
      {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6}, {a: 1}, {b: 2, c: 3}, {d: 4, e: 5, f: 6}
    ],
    'One set': [
      {a: 1, b: 2}, {a: 1, b: 2}
    ],
    'Empty set': [
      {a: 1}, {a: 1}, {}
    ],
    'All empty': [
      {}, {}, {}
    ],
    'No set': [
      {}
    ]
  }, function (resultSet, ...sets) {
    it('Assembles all given param sets in on set', function () {
      expect(vectorToObject(sets)).to.eql(resultSet)
    })
  })
})

describe('crossProduct', function () {
  leche.withData({
    '2 sets of 2 items': [
      // Expected result
      [ { a: 2, c: 5 }, { b: 3, c: 5 }, { a: 2, d: 7 }, { b: 3, d: 7 } ],
      // Entries
      [ { a: 2 }, { b: 3 } ],
      [ { c: 5 }, { d: 7 } ]
    ],
    '3 sets of 2 items': [
      // Expected result
      [ { a: 2, c: 5, e: 11 },
        { b: 3, c: 5, e: 11 },
        { a: 2, d: 7, e: 11 },
        { b: 3, d: 7, e: 11 },
        { a: 2, c: 5, f: 13 },
        { b: 3, c: 5, f: 13 },
        { a: 2, d: 7, f: 13 },
        { b: 3, d: 7, f: 13 } ],
      // Entries
      [ { a: 2 }, { b: 3 } ],
      [ { c: 5 }, { d: 7 } ],
      [ { e: 11 }, { f: 13 } ]
    ],
    '2 sets of 3 items (1)': [
      // Expected result
      [ { a: 7 },
        { b: 3, a: 7 },
        { c: 5, a: 7 },
        { a: 2, d: 11 },
        { b: 3, d: 11 },
        { c: 5, d: 11 },
        { a: 2, e: 13 },
        { b: 3, e: 13 },
        { c: 5, e: 13 } ],
      // Entries
      [ { a: 2 }, { b: 3 }, { c: 5 } ],
      [ { a: 7 }, { d: 11 }, { e: 13 } ]
    ],
    '2 sets of 3 items (2)': [
      // Expected result
      [ { a: 12, b: 3, c: 4 },
        { a: 12, b: 6, c: 4 },
        { a: 12, b: 4, c: 4 },
        { a: 15, b: 3 },
        { a: 15, b: 3 },
        { a: 15, b: 3 },
        { a: 2, b: 3, c: 16 },
        { a: 5, b: 6, c: 16 },
        { a: 8, b: 4, c: 16 } ],
      // Entries
      [ { a: 2, b: 3 }, { a: 5, b: 6 }, { a: 8, b: 4 } ],
      [ { a: 12, c: 4 }, { a: 15, b: 3 }, { c: 16 } ]
    ]
  }, function (product, ...items) {
    it('Crosses sets of values with a crossProduct callback', function () {
      expect(thunkToArray(crossProduct(items))).to.deep.have.members(product)
    })
  })
})
