import assign from 'lodash/assign'

const _combine = (vectors, n, cb) => {
  if (!n) {
    return
  }

  const nLast = n - 1

  const vector = vectors[nLast]
  const m = vector.length
  if (n === 1) {
    for (let i = 0; i < m; ++i) {
      cb([ vector[i] ])
    }
    return
  }

  for (let i = 0; i < m; ++i) {
    const value = vector[i]

    _combine(vectors, nLast, (vector) => {
      vector.push(value)
      cb(vector)
    })
  }
}
const combine = vectors => cb => _combine(vectors, vectors.length, cb)

// Merge the properties of an objects set in one object.
//
// Ex: mergeObjects([ { a: 1 }, { b: 2 } ]) => { a: 1, b: 2 }
export const mergeObjects = objects => assign({}, ...objects)

// Compute a cross product between vectors.
//
// Ex: crossProduct([ [ { a: 2 }, { b: 3 } ], [ { c: 5 }, { d: 7 } ] ] )
// => [ { a: 2, c: 5 }, { b: 3, c: 5 }, { a: 2, d: 7 }, { b: 3, d: 7 } ]
export const crossProduct = (vectors, mergeFn = mergeObjects) => cb => (
  combine(vectors)(vector => {
    cb(mergeFn(vector))
  })
)
