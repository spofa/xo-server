import assign from 'lodash/assign'
import filter from 'lodash/filter'
import includes from 'lodash/includes'
import map from 'lodash/map'
import mapValues from 'lodash/mapValues'
import { BaseError } from 'make-error'

import { crossProduct } from './math'
import {
  forEach,
  thunkToArray
} from './utils'

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

const paramsVectorActionsMap = {
  extractProperties ({ pattern, value }) {
    return mapValues(pattern, key => value[key])
  },
  crossProduct ({ items }) {
    return thunkToArray(crossProduct(
      map(items, value => resolveParamsVector.call(this, value))
    ))
  },
  fetchObjects (node) {
    const { pattern } = node

    const predicate = object => {
      for (const key in pattern) {
        const value = pattern[key]
        const objectValue = object[key]

        if (!Array.isArray(value)) {
          // Value is a scalar & objectValue too.
          if (!Array.isArray(objectValue)) {
            if (value !== objectValue) {
              return false
            }
          } else {
            // Value is a scalar & objectValue an array.
            if (!includes(objectValue, value)) {
              return false
            }
          }
        } else {
          if (!Array.isArray(objectValue)) {
            // Value is an array & not objectValue.
            if (!includes(value, objectValue)) {
              return false
            }
          } else {
            // Value is an array & objectValue too.
            let exists = false
            for (const elem of objectValue) {
              if (includes(value, elem)) {
                exists = true
                break
              }
            }

            if (!exists) {
              return false
            }
          }
        }
      }

      return true
    }

    return filter(this.xo.getObjects(), predicate)
  },
  map ({ collection, iteratee, iterateeArgs }) {
    return map(resolveParamsVector.call(this, collection), value =>
      resolveParamsVector.call(this, { type: iteratee, ...iterateeArgs, value })
    )
  },
  set: ({ values }) => values
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
