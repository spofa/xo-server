import {format} from 'json-rpc-peer'
import {parseSize} from '../utils'
import {JsonRpcError} from '../api-errors'

// ===================================================================

export async function create ({name, size, sr}) {
  const vdi = await this.getXAPI(sr).createVdi(parseSize(size), {
    name_label: name,
    sr: sr._xapiId
  })
  return vdi.$id
}

create.description = 'create a new disk on a SR'

create.params = {
  name: { type: 'string' },
  size: { type: ['integer', 'string'] },
  sr: { type: 'string' }
}

create.resolve = {
  sr: ['sr', 'SR', 'administrate']
}

// -------------------------------------------------------------------

export async function resize ({ vdi, size }) {
  await this.getXAPI(vdi).resizeVdi(vdi._xapiId, parseSize(size))
}

resize.description = 'resize an existing VDI'

resize.params = {
  id: { type: 'string' },
  size: { type: ['integer', 'string'] }
}

resize.resolve = {
  vdi: ['id', 'VDI', 'administrate']
}

exports.resize = resize

// -------------------------------------------------------------------

function handleExport (req, res, { stream }) {
  const upstream = stream.response

  // Remove the filename as it is already part of the URL.
  upstream.headers['content-disposition'] = 'attachment'

  res.writeHead(
    upstream.statusCode,
    upstream.statusMessage ? upstream.statusMessage : '',
    upstream.headers
  )

  stream.pipe(res)
}

// TODO: integrate in xapi.js
async function export_ ({ vdi, snapshot }) {
  const stream = await this.getXAPI(vdi).exportVdi(vdi._xapiId, snapshot)

  return {
    $getFrom: await this.registerHttpRequest(handleExport, { stream }, {
      suffix: encodeURI(`/${vdi.name_label}.vhd`)
    })
  }
}

export_.description = 'Exports a Disk to a file system'

export_.params = {
  vdi: { type: 'string' },
  snapshot: { type: 'string', optional: true }
}

export_.resolve = {
  vdi: ['vdi', 'VDI', 'administrate']
}

exports.export = export_

// -------------------------------------------------------------------

async function handleImportContent (req, res, { xapi, vdi }) {
  // Timeout seems to be broken in Node 4.
  // See https://github.com/nodejs/node/issues/3319
  req.setTimeout(43200000) // 12 hours

  const contentLength = req.headers['content-length']

  if (!contentLength) {
    res.writeHead(411)
    res.end('Content length is mandatory')
  }

  try {
    await xapi.importVdiContent(vdi._xapiId, req, { length: contentLength, format: 'vhd' })
    res.end(format.response(0, true))
  } catch (e) {
    res.writeHead(500)
    res.end(format.error(new JsonRpcError(e.message)))
  }
}

export async function importContent ({vdi}) {
  const xapi = this.getXAPI(vdi)

  return {
    $sendTo: await this.registerHttpRequest(handleImportContent, { xapi, vdi })
  }
}

importContent.description = 'Imports a Disk from a file system to an existing virtual disk'

importContent.params = {
  vdi: { type: 'string' }
}

importContent.resolve = {
  vdi: ['vdi', 'VDI', 'administrate']
}
