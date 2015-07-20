import assign from 'lodash.assign'
import forEach from 'lodash.foreach'
import {BaseError} from 'make-error'

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

export const productParams = (...args) => {
  let product = Object.create(null)
  assign(product, ...args)
  return product
}

export default class JobExecutor {
  constructor (xo, api) {
    this.xo = xo
    this.api = api
    this._extractValueCb = {
      'set': items => items.values
    }
  }

  exec (job) {
    if (job.type === 'call') {
      this._execCall(job.userId, job.method, job.paramsVector)
    } else {
      throw new UnsupportedJobType(job)
    }
  }

  async _execCall (userId, method, paramsVector) {
    let paramsFlatVector
    if (paramsVector.type === 'crossProduct') {
      paramsFlatVector = this._computeCrossProduct(paramsVector.items, productParams, this._extractValueCb)
    } else {
      throw new UnsupportedVectorType(paramsVector)
    }
    const connection = this.xo.createUserConnection()
    connection.set('user_id', userId)
    forEach(paramsFlatVector, params => {
      const _params = assign({}, params)
      forEach(_params, async (value, key) => {
        _params[key] = this._r(value, connection)
      })
      this.api.call(connection, method, _params)
    })
    connection.close()
  }

  async _r (value, _c) {
    if (value && value.$dynamic) {
      const {$dynMethod, $dynParams, $dynProperty} = value
      if ($dynMethod) {
        value = await this.api.call(_c, this._r($dynMethod, _c), this._r($dynParams, _c) || {})
      }
      if ($dynProperty) {
        value = value[this._r($dynProperty, _c)]
      }
    }
    return value
  }

  _computeCrossProduct (items, productCb, extractValueMap = {}) {
    const upstreamValues = []
    const itemsCopy = items.slice()
    const item = itemsCopy.pop()
    const values = extractValueMap[item.type] && extractValueMap[item.type](item) || item
    forEach(values, value => {
      if (itemsCopy.length) {
        let downstreamValues = this._computeCrossProduct(itemsCopy, productCb, extractValueMap)
        forEach(downstreamValues, downstreamValue => {
          upstreamValues.push(productCb(value, downstreamValue))
        })
      } else {
        upstreamValues.push(value)
      }
    })
    return upstreamValues
  }
}
