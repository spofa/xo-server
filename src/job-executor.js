import assign from 'lodash/assign'
import filter from 'lodash/filter'
import map from 'lodash/map'
import {BaseError} from 'make-error'

import { forEach } from './utils'

export class JobExecutorError extends BaseError {}
export class UnsupportedJobType extends JobExecutorError {
  constructor (job) {
    super('Unknown job type: ' + job.type)
  }
}
export class UnsupportedVectorType extends JobExecutorError {
  constructor (vector) {
    super('Unknown vector type: ' + vector.type)
  }
}

// ===================================================================

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

export const vectorToObject = vector => {
  const obj = {}
  const n = vector.length
  for (let i = 0; i < n; ++i) {
    assign(obj, vector[i])
  }

  return obj
}

export const crossProduct = vectors => cb => combine(vectors)(vector => {
  cb(vectorToObject(vector))
})

// ===================================================================

export const thunkToArray = thunk => {
  const values = []
  thunk(::values.push)
  return values
}

// ===================================================================

const getNodeValues = node => node.values || node.items

const paramsVectorActionsMap = {
  extractProperties ({ pattern, value }) {
    return map(pattern, key => value[key])
  },
  crossProduct (node) {
    return thunkToArray(crossProduct(
      map(getNodeValues(node), value => resolveParamsVector.call(this, value))
    ))
  },
  fetchObjects (node) {
    return filter(this.xo.getObjects(), node.filter)
  },
  map ({ collection, iteratee, iterateeArgs }) {
    return map(resolveParamsVector.call(this, collection), value =>
      resolveParamsVector.call(this, { type: iteratee, ...iterateeArgs, value })
    )
  },
  set: getNodeValues
}

function resolveParamsVector (paramsVector) {
  const visitor = paramsVectorActionsMap[paramsVector.type]
  if (!visitor) {
    throw new Error(`Unsupported function '${paramsVector.type}'.`)
  }

  return visitor.call(this, paramsVector)
}

// ===================================================================

export default class JobExecutor {
  constructor (xo) {
    this.xo = xo
    this._extractValueCb = {
      'set': items => items.values
    }

    // The logger is not available until Xo has started.
    xo.on('start', () => xo.getLogger('jobs').then(logger => {
      this._logger = logger
    }))
  }

  async exec (job) {
    const runJobId = this._logger.notice(`Starting execution of ${job.id}.`, {
      event: 'job.start',
      userId: job.userId,
      jobId: job.id,
      key: job.key
    })

    try {
      if (job.type === 'call') {
        const execStatus = await this._execCall(job, runJobId)

        this.xo.emit('job:terminated', execStatus)
      } else {
        throw new UnsupportedJobType(job)
      }

      this._logger.notice(`Execution terminated for ${job.id}.`, {
        event: 'job.end',
        runJobId
      })
    } catch (e) {
      this._logger.error(`The execution of ${job.id} has failed.`, {
        event: 'job.end',
        runJobId,
        error: e
      })
    }
  }

  async _execCall (job, runJobId) {
    const { paramsVector } = job
    const paramsFlatVector = paramsVector
      ? resolveParamsVector.call(this, paramsVector)
      : [{}] // One call with no parameters

    const connection = this.xo.createUserConnection()
    const promises = []

    connection.set('user_id', job.userId)

    const execStatus = {
      runJobId,
      start: Date.now(),
      calls: {}
    }

    forEach(paramsFlatVector, params => {
      const runCallId = this._logger.notice(`Starting ${job.method} call. (${job.id})`, {
        event: 'jobCall.start',
        runJobId,
        method: job.method,
        params
      })

      const call = execStatus.calls[runCallId] = {
        method: job.method,
        params,
        start: Date.now()
      }

      promises.push(
        this.xo.api.call(connection, job.method, assign({}, params)).then(
          value => {
            this._logger.notice(`Call ${job.method} (${runCallId}) is a success. (${job.id})`, {
              event: 'jobCall.end',
              runJobId,
              runCallId,
              returnedValue: value
            })

            call.returnedValue = value
            call.end = Date.now()
          },
          reason => {
            this._logger.notice(`Call ${job.method} (${runCallId}) has failed. (${job.id})`, {
              event: 'jobCall.end',
              runJobId,
              runCallId,
              error: {...reason, message: reason.message}
            })

            call.error = reason
            call.end = Date.now()
          }
        )
      )
    })

    connection.close()
    await Promise.all(promises)
    execStatus.end = Date.now()

    return execStatus
  }
}
